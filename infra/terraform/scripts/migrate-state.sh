#!/usr/bin/env bash
#
# migrate-state.sh — Ensure the remote state backend exists (via
# bootstrap-state.sh), then migrate the current Terraform state into it.
#
# By default this runs `terraform init -migrate-state` interactively, which
# asks for confirmation before copying state — the safe choice, since
# force-copying would silently overwrite any state already sitting in the
# remote backend. Pass --yes only when you are certain that's what you want
# (e.g. a first-time migration you already know the remote is empty for).
#
# Usage:
#   ./migrate-state.sh          # interactive confirmation
#   ./migrate-state.sh --yes    # non-interactive (terraform init -force-copy)

set -euo pipefail
export MSYS_NO_PATHCONV=1

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TERRAFORM_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

FORCE=false
if [[ "${1:-}" == "--yes" ]]; then
  FORCE=true
fi

log() { printf '\n\033[1;36m==>\033[0m %s\n' "$1"; }

log "Step 1/2: Ensuring the remote state backend exists"
"${SCRIPT_DIR}/bootstrap-state.sh"

log "Step 2/2: Migrating Terraform state"
cd "${TERRAFORM_DIR}"

if [[ ! -f providers.tf ]] || ! grep -q 'backend "azurerm"' providers.tf; then
  echo "providers.tf has no active 'backend \"azurerm\"' block yet." >&2
  echo "Add it (see the output from bootstrap-state.sh above), then re-run this script." >&2
  exit 1
fi

if ${FORCE}; then
  echo "Running non-interactively (--yes): existing remote state, if any, will be overwritten."
  terraform init -migrate-state -force-copy
else
  echo "Running interactively — you'll be asked to confirm the state copy."
  terraform init -migrate-state
fi

log "Verifying"
terraform state list >/dev/null
echo "Remote backend is active and readable."
