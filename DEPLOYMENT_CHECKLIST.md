# Refactored Infrastructure - Deployment Checklist

## ✅ Code Changes Complete

All Terraform files have been refactored:
- ✅ variables.tf (new location variables)
- ✅ main.tf (clean naming + enterprise tags)
- ✅ outputs.tf (location tracking)
- ✅ modules/key-vault/ (updated naming)
- ✅ modules/container-apps/ (updated naming)
- ✅ modules/static-web-app/ (updated naming)

---

## 📋 Pre-Deployment

### Step 1: Update terraform.tfvars

```hcl
# OLD (remove these lines):
# location = "eastus2"
# location_short = "eus2"

# NEW (add these):
primary_location = "eastus2"

# OPTIONAL: Cost optimization
# storage_location = "eastus"  # Cheaper region for storage
```

### Step 2: Verify Azure OIDC

Run:
```powershell
$APP_ID = (az ad app list --display-name "gencolink-github-actions" --query '[0].appId' -o tsv)
az ad app federated-credential list --id $APP_ID
```

Must show federated credentials listed.

### Step 3: Add GitHub Secrets (Manual - Only 3 Required)

Go to GitHub → Settings → Secrets → Actions

Add these 3:
- `AZURE_CLIENT_ID` = [from service principal]
- `AZURE_TENANT_ID` = [your tenant ID]
- `AZURE_SUBSCRIPTION_ID` = [your subscription ID]

(Other 3 secrets auto-sync from Terraform)

---

## 🚀 Deployment

### Step 1: Backup Current State
```powershell
cd infra/terraform
terraform state pull > backup.tfstate
```

### Step 2: Plan
```powershell
terraform plan
```

**Expected output:**
- 6 resources will be recreated (renamed)
- 0 destroyed (same underlying Azure resources)
- New tags applied
- No secrets affected

### Step 3: Apply
```powershell
terraform apply
```

**Wait for completion** (~5-10 minutes)

### Step 4: Verify Outputs
```powershell
terraform output resource_names
terraform output resource_locations
terraform output deployment_summary
```

**Expected names:**
```
gencolink-prod-directus      (was: gencolink-prod-eus2-directus)
gencolink-prod-frontend      (was: gencolink-prod-eus2-swa)
gencolink-prod-storage       (was: gencolink-prod-eus2-content)
gencolink-prod-kv            (was: gencolink-prod-eus2-kv)
```

---

## ✅ Post-Deployment Verification

### 1. Check GitHub Actions Secrets Auto-Updated
```
Expected:
DIRECTUS_CONTAINER_APP_NAME = gencolink-prod-directus (new name)
DIRECTUS_API_URL = https://gencolink-prod-directus.{...} (new URL)
```

### 2. Trigger GitHub Actions Workflows
Go to GitHub → Actions

Run:
- **Frontend** workflow (deploy)
- **Directus** workflow (restart + setup)

Both should complete successfully ✅

### 3. Verify Services Online
```powershell
# Directus health
curl -sf "https://gencolink-prod-directus.happyrock-060f39f7.eastus2.azurecontainerapps.io/server/health"

# Frontend  
https://gencolink-prod-frontend.azurestaticapps.net
```

### 4. Azure Portal Verification
- [ ] All resources show NEW names (no location_short)
- [ ] Tags applied to all resources
- [ ] Container App running
- [ ] Storage Account accessible
- [ ] Key Vault has secrets

---

## 📝 Git Commit

```powershell
cd infra/terraform

# Verify what changed
git status

# Add files
git add variables.tf main.tf outputs.tf modules/

# Commit
git commit -m "refactor: Implement enterprise IaC with location-independent design

- Remove location_short from resource names (cleaner, more portable)
- Add per-service location variables (multi-region ready)
- Implement enterprise tagging (cost tracking, service visibility)
- Update all modules to use clean naming convention
- Prepare infrastructure for multi-region HA/DR"

# Push
git push origin master
```

---

## 🔄 Post-Deployment Tasks

- [ ] Monitor Container App logs for errors
- [ ] Verify Directus collections created
- [ ] Test website data loading from Directus
- [ ] Run smoke tests
- [ ] Update documentation with new resource names

---

## ⚠️ Rollback Plan

If needed:
```powershell
# Restore old state
terraform state push backup.tfstate

# Recreate with old names
terraform apply
```

---

## 📊 Success Criteria

✅ All 6 resources deployed with new names  
✅ GitHub Actions secrets auto-updated  
✅ Directus accessible and running  
✅ Frontend deploying and loading  
✅ Enterprise tags on all resources  
✅ Can change region with single variable  

---

## Current Status

```
Code: ✅ Refactored
Tested: ⏳ Ready for deployment
GitHub Secrets: ⏳ Waiting for Azure OIDC + 3 secrets
Deployment: ⏳ Ready to execute
```

**Next Step:** Update terraform.tfvars and run `terraform plan`

