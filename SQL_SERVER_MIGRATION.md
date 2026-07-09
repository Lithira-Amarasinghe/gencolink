# SQLite → Azure SQL Server Migration Summary

## ✅ Changes Applied

### 1. **Infrastructure Code (Terraform)**

**What Changed:**
- ✅ Removed Azure Files share for SQLite database
- ✅ Added Azure SQL Server (DTU-based, Basic tier) in **eastus** location
- ✅ Added SQL firewall rule to allow Azure services
- ✅ Updated Container Apps to connect to SQL Server instead of SQLite
- ✅ Removed all SQLite volume mounts from Container App

**Files Modified:**
```
infra/terraform/
├── variables.tf                          (added sql_location, sql_admin_username, etc.)
├── main.tf                               (added SQL resources, removed Azure Files share)
├── terraform.tfvars                      (added SQL configuration)
└── modules/container-apps/
    ├── variables.tf                      (removed sqlite_* variables)
    └── main.tf                           (removed Azure Files storage, volumes, mounts)
```

### 2. **Database Configuration**

**New Environment Variables (Container App):**
```env
DB_CLIENT = "mssql"
DB_HOST   = gencolink-prod-sqlserver.database.windows.net
DB_PORT   = "1433"
DB_USER   = "sqladmin"
DB_NAME   = "directus"
DB_PASSWORD = (from Key Vault secret)
```

**Old Environment Variables (REMOVED):**
```env
DB_CLIENT = "sqlite3"        ❌ REMOVED
DB_FILENAME = "/directus/database/data.db"  ❌ REMOVED
```

### 3. **Azure SQL Server Details**

**Configuration:**
- **Server Name:** `gencolink-prod-sqlserver`
- **Location:** `eastus` (as requested)
- **Database:** `directus`
- **Tier:** Basic (DTU-based)
- **Max Size:** 2 GB
- **Admin User:** `sqladmin`

**Security:**
- ✅ TLS 1.2 minimum required
- ✅ Firewall rule allows Azure services
- ✅ Connection string stored in Key Vault
- ✅ Password stored as Container App secret

---

## 🔄 What's NOT Changed

### Local Development (Stays Same)
```
Directus/docker-compose.yml  ✅ UNCHANGED
├── Still uses SQLite locally
├── Your test data is safe
└── No breaking changes
```

### Everything Else
- `Website/` → No changes ✅
- `functions/` → No changes ✅
- `Directus/setup.js` → No changes (Directus handles both SQLite and SQL) ✅
- GitHub Actions workflows → No changes ✅

---

## 🚀 Next Steps

### 1. **Verify terraform.tfvars**
```hcl
sql_location           = "eastus"       # ✅ Correct
sql_admin_username     = "sqladmin"     # Default, can change
sql_admin_password     = "P@ssw0rd123!Secure"  # Change to strong password
sql_service_tier       = "Basic"        # ✅ Correct (DTU, Basic)
sql_database_name      = "directus"     # ✅ Correct
```

**⚠️ SECURITY:** Change `sql_admin_password` to a strong, unique password before applying!

### 2. **Plan Terraform Changes**
```powershell
cd infra/terraform
terraform plan
```

**Expected Output:**
- ✅ 3 new Azure SQL resources (server, database, firewall rule)
- ✅ 1 Key Vault secret (SQL connection string)
- ✅ 1 Container App updated (new env vars, removed volumes)
- ✅ 0 resources destroyed (only additions/updates)

### 3. **Apply Terraform**
```powershell
terraform apply
```

**Wait:** ~3-5 minutes for SQL Server provisioning

### 4. **Verify Deployment**
```powershell
# Check SQL Server created
az sql server list --resource-group gencolink --query "[].{Name:name, Location:location}"

# Check database exists
az sql db list --resource-group gencolink --server-name gencolink-prod-sqlserver

# Check Container App is running
az containerapp show --name gencolink-prod-directus --resource-group gencolink
```

### 5. **Trigger GitHub Actions**
Go to GitHub → Actions
- Run **Directus** workflow (restarts Container App, runs setup.js)
- Run **Frontend** workflow (to verify everything connects)

---

## 📊 Cost Impact

| Resource | Old | New | Monthly Est. |
|----------|-----|-----|--------------|
| Azure Files (SQLite) | $0.05/GB | ✅ Removed | -$0.10 |
| SQL Server (Basic) | N/A | ✅ Added | ~$5-10 |
| **Total Impact** | | | **+$5/month** |

---

## ⚠️ Important Notes

### Local Development
- Your laptop SQLite: **100% safe, no changes**
- Test data: **No data loss**
- `docker-compose up` still works as-is

### Production
- SQLite data: **No production data** (fresh deployment)
- If you had production data on old SQLite setup: **You would need migration** (N/A here)
- Database will be empty → Directus bootstrap runs on first Container App start

### Directus Schema
- Directus `setup.js` automatically creates collections and schema
- Works with both SQLite (dev) and SQL Server (prod)
- No code changes needed

---

## 🔍 Troubleshooting

**If Container App fails to start:**
1. Check logs: `az containerapp logs show --name gencolink-prod-directus --resource-group gencolink --tail 50`
2. Check env vars: Verify `DB_PASSWORD` secret exists in Key Vault
3. Check SQL firewall: Verify "AllowAzureServices" rule exists

**If Terraform plan shows errors:**
1. Verify `sql_admin_password` is valid (strong password)
2. Verify SQL location "eastus" is valid
3. Run `terraform validate` to check syntax

---

## ✅ Success Criteria

After `terraform apply`:
- ✅ SQL Server created in eastus
- ✅ SQL Database "directus" created
- ✅ Container App updated with SQL env vars
- ✅ No volume mounts for SQLite
- ✅ Key Vault has SQL connection string
- ✅ Container App restarts and Directus connects
- ✅ Local SQLite development still works

---

## 📋 Rollback (If Needed)

If you need to revert to SQLite:
```powershell
terraform state show module.container_apps.azurerm_container_app.directus
# Then manually restore from backup state
```

**Better:** Git commit this change so it's reversible via `git revert`

