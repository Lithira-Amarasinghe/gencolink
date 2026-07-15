#!/usr/bin/env bash
#
# bootstrap-state.sh — Create the Azure Storage backend for Terraform remote
# state. Idempotent: safe to re-run: every step checks whether its resource
# already exists before creating it.
#
# Deliberately NOT managed by Terraform itself — state storage can't depend
# on the state it will hold, so this is a one-time, hand-run bootstrap.
#
# Auth: uses your current Azure CLI session (`az login`). Grants your own
# identity "Storage Blob Data Contributor" scoped to just this storage
# account (least privilege) via Azure AD — no storage account key is ever
# generated, so there is no key to rotate or leak.
#
# Usage:
#   ./bootstrap-state.sh
#
# Override defaults via environment variables, e.g.:
#   RESOURCE_GROUP=my-tfstate-rg LOCATION=westus2 ./bootstrap-state.sh

set -euo pipefail

# Git Bash on Windows rewrites leading "/subscriptions/..." as a Windows
# path; this disables that behavior for every az call in this script.
export MSYS_NO_PATHCONV=1

RESOURCE_GROUP="${RESOURCE_GROUP:-gencolink-rg-tfstate}"
STORAGE_ACCOUNT="${STORAGE_ACCOUNT:-gencolinktfstate}"
CONTAINER_NAME="${CONTAINER_NAME:-tfstate}"
LOCATION="${LOCATION:-eastus2}"
RETENTION_DAYS="${RETENTION_DAYS:-7}"

log()  { printf '\n\033[1;36m==>\033[0m %s\n' "$1"; }
ok()   { printf '\033[1;32m  OK\033[0m  %s\n' "$1"; }
skip() { printf '\033[1;33m  SKIP\033[0m %s\n' "$1"; }

log "Verifying Azure CLI session"
if ! az account show >/dev/null 2>&1; then
  echo "Not logged in. Run 'az login' first." >&2
  exit 1
fi
SUBSCRIPTION_NAME="$(az account show --query name -o tsv)"
ok "Authenticated (subscription: ${SUBSCRIPTION_NAME})"

log "Resource group: ${RESOURCE_GROUP}"
if az group show -n "${RESOURCE_GROUP}" >/dev/null 2>&1; then
  skip "already exists"
else
  az group create -n "${RESOURCE_GROUP}" -l "${LOCATION}" --output none
  ok "created in ${LOCATION}"
fi

log "Storage account: ${STORAGE_ACCOUNT}"
if az storage account show -n "${STORAGE_ACCOUNT}" -g "${RESOURCE_GROUP}" >/dev/null 2>&1; then
  skip "already exists"
else
  az storage account create \
    -n "${STORAGE_ACCOUNT}" \
    -g "${RESOURCE_GROUP}" \
    -l "${LOCATION}" \
    --sku Standard_LRS \
    --kind StorageV2 \
    --min-tls-version TLS1_2 \
    --https-only true \
    --allow-blob-public-access false \
    --output none
  ok "created (Standard_LRS, TLS 1.2 minimum, HTTPS-only, no public blob access)"
fi

STORAGE_ID="$(az storage account show -n "${STORAGE_ACCOUNT}" -g "${RESOURCE_GROUP}" --query id -o tsv)"

log "Blob versioning + soft delete (protects the state file's history)"
az storage account blob-service-properties update \
  --account-name "${STORAGE_ACCOUNT}" \
  -g "${RESOURCE_GROUP}" \
  --enable-versioning true \
  --enable-delete-retention true \
  --delete-retention-days "${RETENTION_DAYS}" \
  --output none
ok "versioning + ${RETENTION_DAYS}-day soft delete enabled"

log "RBAC: Storage Blob Data Contributor for the signed-in user"
MY_OBJECT_ID="$(az ad signed-in-user show --query id -o tsv)"
EXISTING_ROLE="$(az role assignment list \
  --assignee "${MY_OBJECT_ID}" \
  --scope "${STORAGE_ID}" \
  --role "Storage Blob Data Contributor" \
  --query "[0].id" -o tsv 2>/dev/null || true)"

if [[ -n "${EXISTING_ROLE}" ]]; then
  skip "already assigned"
else
  az role assignment create \
    --assignee "${MY_OBJECT_ID}" \
    --role "Storage Blob Data Contributor" \
    --scope "${STORAGE_ID}" \
    --output none
  ok "assigned (scoped to this storage account only — least privilege)"
fi

log "Blob container: ${CONTAINER_NAME}"
if az storage container exists \
  --name "${CONTAINER_NAME}" \
  --account-name "${STORAGE_ACCOUNT}" \
  --auth-mode login \
  --query exists -o tsv 2>/dev/null | grep -q true; then
  skip "already exists"
else
  # RBAC can take a few seconds to propagate after the role assignment above.
  attempt=1
  until az storage container create \
    --name "${CONTAINER_NAME}" \
    --account-name "${STORAGE_ACCOUNT}" \
    --auth-mode login \
    --output none 2>/dev/null; do
    if (( attempt >= 6 )); then
      echo "Failed to create the container after ${attempt} attempts (RBAC propagation timeout)." >&2
      exit 1
    fi
    echo "  Waiting for RBAC to propagate (attempt ${attempt})..."
    sleep 10
    ((attempt++))
  done
  ok "created (AAD auth, no storage key used)"
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
