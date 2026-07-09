# Managed Identity Upgrade - Complete Changes Summary

## Files Modified

### 1. `infra/terraform/variables.tf`
**Added:**
- `sql_entra_admin_name` - Your Entra ID admin email
- `sql_entra_admin_object_id` - Your Azure user object ID

### 2. `infra/terraform/main.tf`
**Added:**
```terraform
# SQL Entra ID Admin
resource "azurerm_mssql_server_azuread_administrator" "directus"

# RBAC: Storage Blob Data Contributor for Container App
resource "azurerm_role_assignment" "container_app_storage_blob_contributor"

# SQL Database User Provisioning (Managed Identity)
resource "null_resource" "sql_managed_identity_user"
```

**Removed:**
```terraform
# No longer store keys in Key Vault
azurerm_key_vault_secret.storage_key  ❌
azurerm_key_vault_secret.sql_connection_string  ❌
```

**Updated:**
- SQL Server resource: Added Entra ID admin block
- Container App module call: Updated env vars for Managed Identity

### 3. `infra/terraform/terraform.tfvars`
**Added:**
```hcl
sql_entra_admin_name = "your-email@company.com"
sql_entra_admin_object_id = "00000000-0000-0000-0000-000000000000"
```

### 4. `infra/terraform/modules/container-apps/variables.tf`
**Removed:**
- `sqlite_storage_account_name` (SQLite migration completed)
- `sqlite_storage_account_key` (SQLite migration completed)
- `sqlite_file_share_name` (SQLite migration completed)

### 5. `infra/terraform/modules/container-apps/main.tf`
**Added:**
- Managed Identity authentication strategy documentation

**Removed:**
- Azure Files storage mount (SQLite-specific)
- SQLite volume mount configuration
- SQLite scaling comments

---

## Environment Variable Changes

### Container App Secrets - REMOVED
```env
❌ STORAGE_AZURE_KEY = "..."
❌ DB_PASSWORD = "..."  (now using Managed Identity)
```

### Container App Secrets - KEPT
```env
✅ ADMIN_PASSWORD = (Directus admin)
✅ ADMIN_TOKEN = (Directus API token)
✅ JWT_SECRET = (Directus JWT)
```

### Container App Config - UPDATED
```env
# Storage: No key needed, Managed Identity handles auth
STORAGE_LOCATIONS = "azure"
STORAGE_AZURE_ACCOUNT = "gencolinkprodstorage"
STORAGE_AZURE_CONTAINER = "directus-uploads"

# SQL: Using Managed Identity (Entra ID) authentication
DB_CLIENT = "mssql"
DB_HOST = "gencolink-prod-sqlserver.database.windows.net"
DB_PORT = "1433"
DB_NAME = "directus"
DB_USER = "gencolink-prod-directus"  (the Managed Identity)
# (No DB_PASSWORD in config - using Entra ID)
```

---

## Security Improvements

### Before
- Storage Account key stored as secret
- SQL password stored as secret
- 2 secrets in Key Vault + 2 in Container App
- Manual credential management

### After
- ✅ No storage keys stored
- ✅ No passwords in secrets (using Managed Identity)
- ✅ Only 3 essential secrets in Container App
- ✅ RBAC-based access control
- ✅ Automatic credential rotation
- ✅ Full Azure audit logging
- ✅ Zero Trust authentication

---

## Deployment Checklist

Before running `terraform apply`:

- [ ] Get your Entra ID object ID:
  ```powershell
  az ad user show --id your-email@company.com --query id -o tsv
  ```

- [ ] Update `terraform.tfvars`:
  ```hcl
  sql_entra_admin_name = "your-email@company.com"
  sql_entra_admin_object_id = "YOUR_OBJECT_ID_HERE"
  ```

- [ ] Verify changes:
  ```powershell
  cd infra/terraform
  terraform plan
  ```

- [ ] Apply:
  ```powershell
  terraform apply
  ```

- [ ] Wait 2-3 minutes for provisioning

- [ ] Verify:
  ```powershell
  az containerapp logs show --name gencolink-prod-directus -g gencolink --tail 50
  ```

---

## Rollback Plan

If needed, revert to previous approach:
```powershell
git checkout HEAD~1 infra/terraform/
terraform apply
```

OR

```powershell
# Restore from backup
terraform state push backup.tfstate
terraform apply
```

---

## What Stayed the Same

✅ Local development (Directus/docker-compose.yml)
✅ Website frontend (no changes)
✅ Azure Functions (no changes)
✅ GitHub Actions workflows
✅ Container App CPU/memory configuration
✅ Database schema and data
✅ Public API endpoints

---

## Immediate Next Steps

1. **Get your Entra ID object ID** (5 min)
2. **Update terraform.tfvars** (2 min)
3. **Run terraform plan** (2 min review)
4. **Apply terraform** (5 min)
5. **Verify logs** (5 min)

**Total Time:** ~20 minutes

---

## Questions?

- Storage Managed Identity: See `MANAGED_IDENTITY_UPGRADE.md`
- SQL Entra ID setup: See `MANAGED_IDENTITY_UPGRADE.md`
- Troubleshooting: See `MANAGED_IDENTITY_UPGRADE.md`
- Previous SQL migration: See `SQL_SERVER_MIGRATION.md`

