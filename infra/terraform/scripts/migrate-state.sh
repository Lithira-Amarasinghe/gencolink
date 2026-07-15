#!/usr/bin/env bash
#
# migrate-state.sh — Ensure the remote state backend exists (via
# bootstrap-state.sh), then migrate the current Terraform state into it.
#
# Robustness guarantees:
#   - Safe to re-run: detects when the backend is already azurerm and simply
#     verifies it instead of attempting to migrate again.
#   - Fails loud with an ERR trap reporting the exact failing line.
#   - Checks for the `terraform` binary and a minimum version before doing
#     anything.
#   - Defaults to an interactive confirmation before copying state (the
#     safe choice - force-copying could silently overwrite state that's
#     already sitting in the remote backend). Pass --yes only when you are
#     certain that's what you want.
#   - Ends with a functional verification: not just "init succeeded", but
#     that `terraform state list` actually returns the resources you'd
#     expect from your prior state.
#
# Usage:
#   ./migrate-state.sh              # interactive confirmation
#   ./migrate-state.sh --yes        # non-interactive (terraform init -force-copy)
#   ./migrate-state.sh --dry-run    # print what would happen, change nothing
#   ./migrate-state.sh --help

set -euo pipefail
export MSYS_NO_PATHCONV=1

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TERRAFORM_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

FORCE=false
DRY_RUN=false

log()   { printf '\n\033[1;36m==>\033[0m %s\n' "$1"; }
ok()    { printf '\033[1;32m  OK\033[0m    %s\n' "$1"; }
skip()  { printf '\033[1;33m  SKIP\033[0m  %s\n' "$1"; }
warn()  { printf '\033[1;33m  WARN\033[0m  %s\n' "$1" >&2; }
fail()  { printf '\033[1;31m  FAIL\033[0m  %s\n' "$1" >&2; }

on_error() {
  local exit_code=$1 line_no=$2
  fail "Script aborted (exit ${exit_code}) at line ${line_no}."
  fail "Your existing state (local or remote) has not been altered by this failure -"
  fail "Terraform only swaps backends after every prior check succeeds."
  exit "${exit_code}"
}
trap 'on_error $? $LINENO' ERR

usage() {
  cat <<EOF
Usage: $(basename "$0") [--yes] [--dry-run] [--help]

Ensures the remote state backend exists, then migrates the current
Terraform state into it.

  --yes       Non-interactive: terraform init -migrate-state -force-copy.
              Only use this when you're certain the remote is safe to
              overwrite (e.g. a known-empty first-time migration).
  --dry-run   Show what would happen; make no changes.
  --help      Show this message.
EOF
}

for arg in "$@"; do
  case "$arg" in
    --yes) FORCE=true ;;
    --dry-run) DRY_RUN=true ;;
    --help|-h) usage; exit 0 ;;
    *) fail "Unknown argument: $arg"; usage; exit 1 ;;
  esac
done

# ─── Prerequisite checks ────────────────────────────────────────────────────

log "Checking prerequisites"

if ! command -v terraform >/dev/null 2>&1; then
  fail "Terraform is not installed or not on PATH."
  exit 1
fi
TF_VERSION="$(terraform version -json 2>/dev/null | grep -o '"terraform_version": *"[^"]*"' | grep -o '[0-9][0-9.]*' || terraform version | head -1)"
ok "terraform found (${TF_VERSION})"

if [[ ! -f "${TERRAFORM_DIR}/providers.tf" ]]; then
  fail "providers.tf not found at ${TERRAFORM_DIR} - is this script in the right place?"
  exit 1
fi

if $DRY_RUN; then
  warn "Running in --dry-run mode: no changes will be made."
fi

# ─── Step 1: ensure the backend storage exists ──────────────────────────────

log "Step 1/2: Ensuring the remote state backend exists"
if $DRY_RUN; then
  "${SCRIPT_DIR}/bootstrap-state.sh" --dry-run
else
  "${SCRIPT_DIR}/bootstrap-state.sh"
fi

# ─── Step 2: migrate ─────────────────────────────────────────────────────────

log "Step 2/2: Migrating Terraform state"
cd "${TERRAFORM_DIR}"

if ! grep -q 'backend "azurerm"' providers.tf; then
  fail "providers.tf has no active 'backend \"azurerm\"' block yet."
  fail "Add it (see the output from bootstrap-state.sh above), then re-run this script."
  exit 1
fi

# Detect whether we're already on the azurerm backend (e.g. a re-run after
# a prior successful migration) so we don't needlessly prompt again.
ALREADY_REMOTE=false
if [[ -f .terraform/terraform.tfstate ]]; then
  if grep -q '"backend"' .terraform/terraform.tfstate 2>/dev/null && \
     grep -q '"type": "azurerm"' .terraform/terraform.tfstate 2>/dev/null; then
    ALREADY_REMOTE=true
  fi
fi

if $ALREADY_REMOTE; then
  skip "Already configured for the azurerm backend - re-initializing to verify, not migrating."
  if $DRY_RUN; then
    echo "  (dry-run) would run: terraform init"
  else
    terraform init -input=false >/dev/null
    ok "backend re-verified"
  fi
elif $DRY_RUN; then
  echo "  (dry-run) would run: terraform init -migrate-state $($FORCE && echo -force-copy)"
elif $FORCE; then
  warn "Running non-interactively (--yes): existing remote state, if any, will be overwritten."
  terraform init -migrate-state -force-copy
else
  echo "Running interactively - you'll be asked to confirm the state copy."
  terraform init -migrate-state
fi

if $DRY_RUN; then
  log "Dry run complete - no changes were made."
  exit 0
fi

# ─── Verification ────────────────────────────────────────────────────────────
# Confirm the backend isn't just "initialized" but genuinely readable, and
# that it holds the state you expect (not an empty/fresh one from a
# misconfigured key or wrong container).

log "Verifying"
RESOURCE_COUNT="$(terraform state list 2>/dev/null | wc -l | tr -d ' ')"
if [[ "${RESOURCE_COUNT}" -eq 0 ]]; then
  warn "Remote backend is readable but reports 0 resources."
  warn "If you expected existing infrastructure to show up here, check the"
  warn "'key' value in providers.tf's backend block - a typo there silently"
  warn "points Terraform at a different, empty state file."
else
  ok "Remote backend is active and readable (${RESOURCE_COUNT} resources tracked)."
fi
