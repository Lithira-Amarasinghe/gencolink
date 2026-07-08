# Directus Production Deployment - Final Checklist

**All 6 Issues Fixed ✅**

---

## Before Deployment (Do This First)

### 1. Azure Service Principal & GitHub Secrets

**Status:** ⏳ Manual Step Required

Follow: `AZURE_OIDC_SETUP.md`

Create service principal and add these secrets to GitHub:
- [ ] `AZURE_CLIENT_ID`
- [ ] `AZURE_TENANT_ID`
- [ ] `AZURE_SUBSCRIPTION_ID`

**Verify:**
```bash
az login --service-principal -u $AZURE_CLIENT_ID -p $AZURE_CLIENT_SECRET --tenant $AZURE_TENANT_ID
```

---

### 2. Create terraform.tfvars

**File:** `infra/terraform/terraform.tfvars`

```hcl
project_name            = "gencolink"
environment             = "prod"
location                = "eastus2"
location_short          = "eus"
resource_group_name     = "gencolink"
directus_admin_email    = "admin@gencolink.com"
github_owner            = "Lithira-Amarasinghe"
github_repository       = "gencolink"
github_repo_url         = "https://github.com/Lithira-Amarasinghe/gencolink"
github_branch           = "master"
github_repo_token       = "ghp_YOUR_PAT_TOKEN_HERE"
```

**IMPORTANT:** Add to `.gitignore`:
```bash
echo "terraform.tfvars" >> .gitignore
```

---

### 3. Verify Local Machine Setup

```bash
# Login to Azure
az login

# Check Terraform
terraform version  # Should be v1.5+

# Validate Terraform
cd infra/terraform
terraform validate
```

All should pass ✓

---

## Deployment (30 mins)

### Step 1: Plan Terraform Changes

```bash
cd infra/terraform
terraform init
terraform plan -out=tfplan
```

**Review output carefully:**
- Should see Container Apps, Storage, Key Vault, Static Web App resources
- Check for any errors before proceeding

### Step 2: Apply Terraform

```bash
terraform apply tfplan
```

**Wait for completion** (~5-10 mins)

### Step 3: Verify Outputs

```bash
# Get deployment URLs and credentials
terraform output

# Save these:
# - directus_url
# - directus_admin_email
# - directus_admin_password (IMPORTANT - save securely)
# - static_web_app_url
```

### Step 4: Wait for Container App

```bash
# Monitor deployment
DIRECTUS_URL=$(terraform output -raw directus_url)
echo "Monitoring: $DIRECTUS_URL"

# Health check (repeat until success)
curl -f "$DIRECTUS_URL/server/health"
```

**Expected:** `{"status":"ok"}` response

### Step 5: Run Schema Setup

```bash
# Get Container App name
CONTAINER_APP_NAME=$(terraform output -raw directus_container_app_name)

# Run setup (creates collections, seeds data)
az containerapp exec \
  --name $CONTAINER_APP_NAME \
  --resource-group gencolink \
  --command "node setup.js"
```

**Expected:** Collections created messages

### Step 6: Verify Admin Panel

```bash
# Open in browser
DIRECTUS_URL=$(terraform output -raw directus_url)
echo "Visit: $DIRECTUS_URL/admin"

# Login:
# Email: admin@gencolink.com
# Password: (from terraform output directus_admin_password)
```

Should see:
- Collections: services, products, values, faqs, company_details
- Data populated from setup.js

### Step 7: Verify Frontend

```bash
SWA_URL=$(terraform output -raw static_web_app_url)
echo "Visit: $SWA_URL"
```

Should see:
- Website loads
- Services, Products, FAQ sections visible
- Directus data displayed

---

## After Deployment (Important!)

### 1. Save Credentials Securely

From `terraform output`:
```
✓ directus_admin_email
✓ directus_admin_password → Save in password manager
✓ directus_url
✓ key_vault_name
```

### 2. Push Code to GitHub

```bash
cd /path/to/repo

# Add all changes
git add .

# Commit
git commit -m "Production deployment: Fix Directus configuration, pin versions, improve schema setup"

# Push to master
git push origin master
```

**This triggers:**
- Frontend build & deploy (if Website/ changed)
- Directus deployment (if Directus/ changed)

### 3. Verify GitHub Actions

Go to: GitHub → Actions

Watch these workflows complete:
- [ ] Frontend (Angular) - should deploy to Static Web App
- [ ] Directus - should restart Container App + run setup.js

Both should have ✓ green checks.

### 4. Test End-to-End

1. Visit Angular frontend (SWA URL)
2. Verify Directus data loads (services, products, etc.)
3. Visit Directus admin panel
4. Add test content → verify it appears on frontend

---

## Troubleshooting

### ❌ Schema Setup Failed

```bash
# Manual setup
az containerapp exec \
  --name gencolink-prod-eus-directus \
  --resource-group gencolink \
  --command "bash"

# Then run inside container:
node setup.js
```

### ❌ Directus Won't Start

```bash
# Check logs
az containerapp logs show \
  -n gencolink-prod-eus-directus \
  -g gencolink --follow
```

### ❌ Frontend Not Loading Directus Data

```bash
# Verify Directus API URL in frontend
# Check browser console (F12) for API errors
# Verify CORS_ORIGIN matches frontend domain
```

### ❌ Container App Deployment Stuck

```bash
# Check provisioning status
az containerapp show \
  -n gencolink-prod-eus-directus \
  -g gencolink \
  --query 'properties.provisioningState'
```

---

## What Was Fixed (Summary)

| Issue | Fix | Impact |
|-------|-----|--------|
| Storage 5GB → 2GB | Cost reduced by 60% | $1/month savings |
| Hardcoded password | Now fails if env var missing | Production security ✓ |
| Directus :latest | Pinned to 10.13.1 | Prevents unexpected breaks |
| Frontend URL logic | Removed broken `\|\|` fallback | Deployment reliability ✓ |
| Schema setup silent fail | Now blocks deployment on error | Catches failures immediately |
| Azure OIDC | Created setup guide | GitHub Actions can deploy |

---

## Success Criteria

✅ All checklist items completed  
✅ Terraform apply succeeded  
✅ Directus admin panel accessible  
✅ Frontend loads Directus content  
✅ GitHub Actions workflows pass  
✅ Azure resources cost < $20/month  

---

## Rollback Plan (If Needed)

```bash
# Destroy all Azure resources
cd infra/terraform
terraform destroy

# This will:
# - Delete Container App
# - Delete Storage Account (and data)
# - Delete Key Vault (and secrets)
# - Delete Static Web App
# WARNING: This is destructive, cannot be undone
```

**Backup before destroying:**
```bash
# Export Directus data
curl -s "https://DIRECTUS_URL/items/services" > services-backup.json
curl -s "https://DIRECTUS_URL/items/products" > products-backup.json
# ... backup other collections
```

---

## Next Steps After Successful Deployment

1. **Set up monitoring:**
   - Azure Monitor alerts for Container App
   - Budget alerts ($20/month threshold)
   - Backup verification tests

2. **Consider adding:**
   - PostgreSQL (instead of SQLite) for production HA
   - Automated backups to blob storage
   - CDN for static assets
   - Log Analytics for debugging

3. **Team onboarding:**
   - Share Directus admin credentials
   - Show team how to edit content
   - Document deployment process

---

**Deployment Guide prepared on:** 2026-07-08  
**Status:** Ready for Production ✅
