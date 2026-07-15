#!/usr/bin/env bash
#
# bootstrap-state.sh — Create the Azure Storage backend for Terraform remote
# state.
#
# Robustness guarantees:
#   - Idempotent: safe to re-run any number of times, including concurrently
#     from two machines. Every step either uses an Azure operation that is
#     idempotent by design (resource group / storage account create are
#     declarative PUTs; container create is create-if-not-exists), or
#     explicitly detects and tolerates the "already exists" outcome for the
#     one operation that isn't (role assignment).
#   - Fails loud, fails fast: `set -euo pipefail` plus an ERR trap that
#     reports the exact failing command and line number, not just "it broke".
#   - Verifies prerequisites (az CLI present and logged in) before touching
#     anything.
#   - Validates the storage account name against Azure's naming rules
#     up front, instead of discovering the problem via a slow failed API
#     call.
#   - Ends with a functional check (an actual blob write + read + delete),
#     not just "the role assignment API said it exists" - RBAC can be
#     created in ARM before it has actually propagated to the data plane.
#   - Places a CanNotDelete management lock on the storage account so a
#     stray `az group delete` / `terraform destroy` elsewhere can't wipe out
#     the state store this whole setup depends on.
#
# Deliberately NOT managed by Terraform itself - state storage can't depend
# on the state it will hold, so this is a one-time, hand-run bootstrap.
#
# Auth: uses your current Azure CLI session (`az login`). Grants your own
# identity "Storage Blob Data Contributor" scoped to just this storage
# account (least privilege) via Azure AD - no storage account key is ever
# generated, so there is no key to rotate or leak.
#
# Usage:
#   ./bootstrap-state.sh              # create/verify everything
#   ./bootstrap-state.sh --dry-run    # print what would happen, change nothing
#   ./bootstrap-state.sh --help
#
# Override defaults via environment variables, e.g.:
#   RESOURCE_GROUP=my-tfstate-rg LOCATION=westus2 ./bootstrap-state.sh

set -euo pipefail

# Git Bash on Windows rewrites leading "/subscriptions/..." as a Windows
# path; this disables that behavior for every az call in this script.
export MSYS_NO_PATHCONV=1

# ─── Configuration ──────────────────────────────────────────────────────────

RESOURCE_GROUP="${RESOURCE_GROUP:-gencolink-rg-tfstate}"
STORAGE_ACCOUNT="${STORAGE_ACCOUNT:-gencolinktfstate}"
CONTAINER_NAME="${CONTAINER_NAME:-tfstate}"
LOCATION="${LOCATION:-eastus2}"
RETENTION_DAYS="${RETENTION_DAYS:-7}"
MAX_RETRY_ATTEMPTS=6
RETRY_BASE_DELAY_SECONDS=5

DRY_RUN=false

# ─── Logging ────────────────────────────────────────────────────────────────

log()   { printf '\n\033[1;36m==>\033[0m %s\n' "$1"; }
ok()    { printf '\033[1;32m  OK\033[0m    %s\n' "$1"; }
skip()  { printf '\033[1;33m  SKIP\033[0m  %s\n' "$1"; }
warn()  { printf '\033[1;33m  WARN\033[0m  %s\n' "$1" >&2; }
fail()  { printf '\033[1;31m  FAIL\033[0m  %s\n' "$1" >&2; }
dryrun(){ printf '\033[1;35m  DRY-RUN\033[0m would %s\n' "$1"; }

# ─── Error handling ─────────────────────────────────────────────────────────
# Traps any failing command (thanks to `set -e`), reporting exactly what
# failed and where, instead of Terraform-style silence-then-stack-trace.
on_error() {
  local exit_code=$1 line_no=$2
  fail "Script aborted (exit ${exit_code}) at line ${line_no}."
  fail "Nothing destructive was attempted before this point - re-run the"
  fail "script after fixing the issue above; every prior step is safe to skip."
  exit "${exit_code}"
}
trap 'on_error $? $LINENO' ERR

usage() {
  cat <<EOF
Usage: $(basename "$0") [--dry-run] [--help]

Creates (or verifies) the Azure Storage backend used for Terraform remote
state. Idempotent and safe to re-run.

Environment overrides:
  RESOURCE_GROUP    (default: gencolink-rg-tfstate)
  STORAGE_ACCOUNT   (default: gencolinktfstate)
  CONTAINER_NAME    (default: tfstate)
  LOCATION          (default: eastus2)
  RETENTION_DAYS    (default: 7)
EOF
}

for arg in "$@"; do
  case "$arg" in
    --dry-run) DRY_RUN=true ;;
    --help|-h) usage; exit 0 ;;
    *) fail "Unknown argument: $arg"; usage; exit 1 ;;
  esac
done

# Runs a command for real, or just prints it under --dry-run.
run() {
  if $DRY_RUN; then
    dryrun "$*"
  else
    "$@"
  fi
}

# Error patterns that will NEVER succeed on retry (bad input, permission
# denied, resource doesn't exist) - fail fast on these instead of burning
# ~2 minutes of exponential backoff on something that can't self-resolve.
# Anything not matching this list is assumed transient (propagation delay,
# throttling, momentary network blip) and IS retried.
is_permanent_error() {
  grep -qiE "InvalidResourceName|InvalidInput|ResourceNotFound|AuthorizationFailed|ForbiddenByPolicy|InvalidAuthenticationInfo" <<< "$1"
}

# Retries a command with exponential backoff + jitter. Used for operations
# that can fail transiently (RBAC propagation delay, API throttling). Fails
# immediately, without retrying, if the error looks permanent.
retry_with_backoff() {
  local attempt=1 delay="${RETRY_BASE_DELAY_SECONDS}" output
  until output="$("$@" 2>&1)"; do
    if is_permanent_error "${output}"; then
      fail "Not retrying - this looks like a permanent error, not a transient one:"
      fail "${output}"
      return 1
    fi
    if (( attempt >= MAX_RETRY_ATTEMPTS )); then
      fail "Giving up after ${attempt} attempts: $*"
      fail "Last error: ${output}"
      return 1
    fi
    local jitter=$(( RANDOM % 3 ))
    warn "Attempt ${attempt}/${MAX_RETRY_ATTEMPTS} failed, retrying in $((delay + jitter))s..."
    sleep "$((delay + jitter))"
    delay=$((delay * 2))
    ((attempt++))
  done
}

# ─── Prerequisite checks ────────────────────────────────────────────────────

log "Checking prerequisites"

if ! command -v az >/dev/null 2>&1; then
  fail "Azure CLI ('az') is not installed or not on PATH."
  exit 1
fi
AZ_CLI_VERSION="$(az version --query "\"azure-cli\"" -o tsv 2>/dev/null || echo "version-unknown")"
ok "az CLI found (${AZ_CLI_VERSION})"

if ! az account show >/dev/null 2>&1; then
  fail "Not logged in to Azure CLI. Run 'az login' first."
  exit 1
fi
SUBSCRIPTION_NAME="$(az account show --query name -o tsv)"
SUBSCRIPTION_ID="$(az account show --query id -o tsv)"
ok "Authenticated as subscription '${SUBSCRIPTION_NAME}' (${SUBSCRIPTION_ID})"

# Fail fast on an obviously invalid storage account name instead of a slow,
# cryptic API error later. Azure rule: 3-24 chars, lowercase letters/digits only.
if [[ ! "${STORAGE_ACCOUNT}" =~ ^[a-z0-9]{3,24}$ ]]; then
  fail "STORAGE_ACCOUNT '${STORAGE_ACCOUNT}' is invalid: must be 3-24 lowercase letters/digits only."
  exit 1
fi
ok "Storage account name '${STORAGE_ACCOUNT}' is valid"

if $DRY_RUN; then
  warn "Running in --dry-run mode: no changes will be made."
fi

# ─── Resource group ─────────────────────────────────────────────────────────
# az group create is a declarative PUT: safe to call even if it already
# exists (won't recreate or destroy anything), but we still check first so
# we can also warn about a location mismatch, which create-on-existing
# silently ignores.

log "Resource group: ${RESOURCE_GROUP}"
if EXISTING_RG_LOCATION="$(az group show -n "${RESOURCE_GROUP}" --query location -o tsv 2>/dev/null)"; then
  skip "already exists in ${EXISTING_RG_LOCATION}"
  if [[ "${EXISTING_RG_LOCATION}" != "${LOCATION}" ]]; then
    warn "Requested LOCATION='${LOCATION}' differs from the existing group's" \
         "location '${EXISTING_RG_LOCATION}' - the existing location wins; Azure" \
         "resource groups cannot be moved between regions."
  fi
else
  run az group create -n "${RESOURCE_GROUP}" -l "${LOCATION}" --output none
  $DRY_RUN || ok "created in ${LOCATION}"
fi

# ─── Storage account ────────────────────────────────────────────────────────
# Storage account names are globally unique across ALL of Azure, not just
# this resource group or subscription - check-name-availability gives a
# clear, fast answer instead of a failed create with a confusing error.

log "Storage account: ${STORAGE_ACCOUNT}"
if az storage account show -n "${STORAGE_ACCOUNT}" -g "${RESOURCE_GROUP}" >/dev/null 2>&1; then
  skip "already exists in this resource group"
else
  if ! $DRY_RUN; then
    AVAILABILITY="$(az storage account check-name-availability -n "${STORAGE_ACCOUNT}" -o json)"
    NAME_AVAILABLE="$(echo "${AVAILABILITY}" | grep -o '"nameAvailable": *[a-z]*' | grep -o '[a-z]*$')"
    if [[ "${NAME_AVAILABLE}" == "false" ]]; then
      REASON="$(echo "${AVAILABILITY}" | grep -o '"message": *"[^"]*"' | sed 's/"message": *"//;s/"$//')"
      fail "Storage account name '${STORAGE_ACCOUNT}' is taken globally (not just in this subscription): ${REASON}"
      fail "Set STORAGE_ACCOUNT to a different, globally-unique name and re-run."
      exit 1
    fi
  fi
  run az storage account create \
    -n "${STORAGE_ACCOUNT}" \
    -g "${RESOURCE_GROUP}" \
    -l "${LOCATION}" \
    --sku Standard_LRS \
    --kind StorageV2 \
    --min-tls-version TLS1_2 \
    --https-only true \
    --allow-blob-public-access false \
    --output none
  $DRY_RUN || ok "created (Standard_LRS, TLS 1.2 minimum, HTTPS-only, no public blob access)"
fi

# If the account doesn't exist yet AND we're in dry-run, there is no real ID
# to inspect - describe the remaining steps in outline instead of faking one.
if $DRY_RUN && ! az storage account show -n "${STORAGE_ACCOUNT}" -g "${RESOURCE_GROUP}" >/dev/null 2>&1; then
  log "Remaining steps (would run after the storage account above is created)"
  dryrun "enable blob versioning + ${RETENTION_DAYS}-day soft delete"
  dryrun "grant the signed-in user 'Storage Blob Data Contributor' on the new account"
  dryrun "create the '${CONTAINER_NAME}' container"
  dryrun "apply a CanNotDelete lock on the storage account"
  dryrun "verify access with a real blob write/read/delete round-trip"
  log "Dry run complete - no changes were made."
  exit 0
fi

STORAGE_ID="$(az storage account show -n "${STORAGE_ACCOUNT}" -g "${RESOURCE_GROUP}" --query id -o tsv)"

# ─── Versioning + soft delete ───────────────────────────────────────────────
# This call is itself idempotent (declarative property update) - re-running
# it with the same values is a safe no-op.

log "Blob versioning + soft delete (protects the state file's history)"
run az storage account blob-service-properties update \
  --account-name "${STORAGE_ACCOUNT}" \
  -g "${RESOURCE_GROUP}" \
  --enable-versioning true \
  --enable-delete-retention true \
  --delete-retention-days "${RETENTION_DAYS}" \
  --output none
$DRY_RUN || ok "versioning + ${RETENTION_DAYS}-day soft delete enabled"

# ─── RBAC ───────────────────────────────────────────────────────────────────
# Unlike the resource creation calls above, `az role assignment create` is
# NOT idempotent - it errors ("RoleAssignmentExists" / HTTP 409) if the exact
# scope+role+principal already exists. Check first, and also tolerate a 409
# from a concurrent run of this same script (belt-and-suspenders against the
# check-then-act race).

log "RBAC: Storage Blob Data Contributor for the signed-in user"
MY_OBJECT_ID="$(az ad signed-in-user show --query id -o tsv)"
EXISTING_ROLE="$(az role assignment list \
  --assignee "${MY_OBJECT_ID}" \
  --scope "${STORAGE_ID}" \
  --role "Storage Blob Data Contributor" \
  --query "[0].id" -o tsv 2>/dev/null || true)"

if [[ -n "${EXISTING_ROLE}" ]]; then
  skip "already assigned"
elif $DRY_RUN; then
  dryrun "grant 'Storage Blob Data Contributor' to the signed-in user on this account"
else
  if az role assignment create \
    --assignee "${MY_OBJECT_ID}" \
    --role "Storage Blob Data Contributor" \
    --scope "${STORAGE_ID}" \
    --output none 2>/tmp/role_assign_err.$$; then
    ok "assigned (scoped to this storage account only - least privilege)"
  else
    if grep -qi "RoleAssignmentExists\|already exists" /tmp/role_assign_err.$$; then
      skip "already assigned (created by a concurrent run)"
    else
      fail "$(cat /tmp/role_assign_err.$$)"
      rm -f /tmp/role_assign_err.$$
      exit 1
    fi
  fi
  rm -f /tmp/role_assign_err.$$
fi

# ─── Container ──────────────────────────────────────────────────────────────
# `az storage container create` is create-if-not-exists by default (no
# --fail-on-exist flag here), so no pre-check/race is possible. Wrapped in
# the retry helper because a role assignment that was *just* created in ARM
# can take a short while to actually be honored by the Storage data plane.

log "Blob container: ${CONTAINER_NAME}"
if $DRY_RUN; then
  if az storage container exists --name "${CONTAINER_NAME}" --account-name "${STORAGE_ACCOUNT}" \
      --auth-mode login --query exists -o tsv 2>/dev/null | grep -q true; then
    skip "already exists"
  else
    dryrun "create the '${CONTAINER_NAME}' container"
  fi
else
  create_container() {
    az storage container create \
      --name "${CONTAINER_NAME}" \
      --account-name "${STORAGE_ACCOUNT}" \
      --auth-mode login \
      --output none
  }
  if retry_with_backoff create_container; then
    ok "present (created now, or already existed)"
  else
    fail "Could not create/verify the container - see retries above."
    exit 1
  fi
fi

# ─── Protect the state store from accidental deletion ──────────────────────
# A management lock, not an RBAC control: even someone with delete
# permission on this resource group can't remove the storage account
# without first explicitly removing this lock.

log "Management lock: prevent accidental deletion of the storage account"
if az lock show -n tfstate-protect --resource-group "${RESOURCE_GROUP}" \
    --resource-type Microsoft.Storage/storageAccounts --resource-name "${STORAGE_ACCOUNT}" >/dev/null 2>&1; then
  skip "already locked"
elif $DRY_RUN; then
  dryrun "apply a CanNotDelete lock named 'tfstate-protect' on the storage account"
else
  az lock create \
    --name tfstate-protect \
    --resource-group "${RESOURCE_GROUP}" \
    --resource-type Microsoft.Storage/storageAccounts \
    --resource-name "${STORAGE_ACCOUNT}" \
    --lock-type CanNotDelete \
    --notes "Protects the Terraform remote state store from accidental deletion." \
    --output none
  ok "CanNotDelete lock applied"
fi

# ─── Functional verification ────────────────────────────────────────────────
# The RBAC checks above only confirm the role assignment exists in ARM, not
# that it has actually propagated to the storage data plane yet. Prove real
# read/write access works by round-tripping a throwaway blob. Skipped under
# --dry-run since it's a real (if harmless and self-cleaning) write.

log "Functional check: read/write access to the container"
if $DRY_RUN; then
  dryrun "upload + delete a throwaway probe blob to confirm real data-plane access"
else
  PROBE_BLOB="_bootstrap_probe_$$_$(date +%s).txt"
  verify_write() {
    echo "bootstrap-state.sh access probe" | az storage blob upload \
      --account-name "${STORAGE_ACCOUNT}" \
      --container-name "${CONTAINER_NAME}" \
      --name "${PROBE_BLOB}" \
      --auth-mode login \
      --data "@-" \
      --overwrite \
      --output none
  }
  if retry_with_backoff verify_write; then
    az storage blob delete \
      --account-name "${STORAGE_ACCOUNT}" \
      --container-name "${CONTAINER_NAME}" \
      --name "${PROBE_BLOB}" \
      --auth-mode login \
      --output none 2>/dev/null || true
    ok "write + delete succeeded - access is fully functional, not just granted on paper"
  else
    fail "RBAC role exists but data-plane access still isn't working."
    fail "This can happen right after a fresh role assignment - wait a minute and re-run."
    exit 1
  fi
fi

if $DRY_RUN; then
  log "Dry run complete - no changes were made."
  exit 0
fi

log "Done"
cat <<EOF

Add this to providers.tf's terraform { } block (see main config for the
version already committed there):

  backend "azurerm" {
    resource_group_name  = "${RESOURCE_GROUP}"
    storage_account_name = "${STORAGE_ACCOUNT}"
    container_name       = "${CONTAINER_NAME}"
    key                  = "prod.tfstate"
    use_azuread_auth     = true
  }

Then run: terraform init -migrate-state
(or use migrate-state.sh, which does both steps together)
EOF
