# Gencolink Production Deployment Guide

## Prerequisites

### Required Tools
- Azure CLI (`az` command)
- Terraform >= 1.5
- Docker (for building Directus image locally)
- Git
- Node.js 20+

### Required Accounts
- Azure subscription (free tier OK for testing, but requires payment method)
- GitHub account with admin access to repository

---

## Step 1: Setup Azure

### 1.1 Create Azure Service Principal for GitHub Actions

```bash
# Create a service principal for GitHub Actions
az ad sp create-for-rbac \
  --name "gencolink-github-actions" \
  --role "Contributor" \
  --scopes "/subscriptions/{subscription-id}"

# Output:
# {
#   "appId": "...",                    # Use as AZURE_CLIENT_ID
#   "displayName": "gencolink-github-actions",
#   "password": "...",                 # Keep secure!
#   "tenant": "..."                    # Use as AZURE_TENANT_ID
# }
```

**Save these values** — you'll need them for GitHub Secrets.

### 1.2 Get Subscription ID

```bash
az account show --query id -o tsv
# Output: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx (copy this)
```

---

## Step 2: Configure GitHub Secrets

Add these secrets to your GitHub repository (Settings → Secrets and variables → Actions):

| Secret Name | Value | Source |
|-------------|-------|--------|
| `AZURE_SUBSCRIPTION_ID` | Your subscription ID | Step 1.2 |
| `AZURE_TENANT_ID` | Service principal tenant | Step 1.1 output |
| `AZURE_CLIENT_ID` | Service principal appId | Step 1.1 output |
| `AZURE_CLIENT_SECRET` | Service principal password | Step 1.1 output |
| `AZURE_RESOURCE_GROUP` | `gencolink-prod-eus-rg` | Will create this |
| `AZURE_KEY_VAULT_NAME` | `gencolink-prod-eus-kv` | Will create this |
| `AZURE_CONTAINER_REGISTRY_NAME` | `gencolinkprodeus` | Will create this |
| `DIRECTUS_CONTAINER_APP_NAME` | `gencolink-prod-eus-directus` | Will create this |
| `AZURE_FUNCTIONS_APP_NAME` | `gencolink-prod-eus-funcapp` | Will create this |
| `AZURE_SWA_NAME` | `gencolink-prod-eus-swa` | Will create this |
| `AZURE_SWA_DEPLOYMENT_TOKEN` | (generated after Terraform) | Step 3 |
| `DIRECTUS_API_URL` | (e.g., `https://api.gencolink.com`) | Step 3 |
| `AZURE_FUNCTIONS_PUBLISH_PROFILE` | (generated after Terraform) | Step 3 |

---

## Step 3: Prepare Terraform Variables

### 3.1 Copy template and fill in values

```bash
cd infra/terraform
cp terraform.tfvars.example terraform.tfvars
```

### 3.2 Edit `terraform.tfvars`

```hcl
# Example values (replace with your own)
project_name = "gencolink"
environment  = "prod"
location     = "eastus"

# GitHub token (create at https://github.com/settings/tokens)
github_repo_token = "ghp_xxxxxxxxxxxxx"
github_repo_url   = "https://github.com/yourname/gencolink"
github_branch     = "main"

# PostgreSQL
db_admin_username = "pgadmin"
db_admin_password = "REPLACE_WITH_YOUR_OWN_STRONG_PASSWORD"
db_sku            = "B_Standard_B1ms"
db_storage_gb     = 32

# Directus
directus_image              = "gencolinkprodeus.azurecr.io/directus:latest"
directus_admin_email        = "admin@gencolink.com"
directus_admin_password     = "REPLACE_WITH_YOUR_OWN_STRONG_PASSWORD"
directus_admin_token        = "REPLACE_WITH_GENERATED_TOKEN"  # generate via: python -c "import secrets; print(secrets.token_urlsafe(32))"
directus_jwt_secret         = "REPLACE_WITH_GENERATED_SECRET"

# Email
azure_communication_email_domain = "https://gencolink.communication.azure.com/"
from_email_address              = "noreply@gencolink.com"
contact_recipient_email         = "contact@gencolink.com"

tags = {
  Project     = "Gencolink"
  Environment = "Production"
  ManagedBy   = "Terraform"
  Owner       = "Your Name"
}
```

### 3.3 Generate secure tokens

```bash
# Generate Directus admin token
python -c "import secrets; print(secrets.token_urlsafe(32))"
# Output: copy to directus_admin_token

# Generate JWT secret
python -c "import secrets; print(secrets.token_urlsafe(32))"
# Output: copy to directus_jwt_secret
```

**⚠️ IMPORTANT**: Do NOT commit `terraform.tfvars` to Git. Add to `.gitignore`:
```
infra/terraform/terraform.tfvars
infra/terraform/terraform.tfvars.json
```

---

## Step 4: Initialize Terraform State

Choose one:

### Option A: Local State (for testing)
```bash
cd infra/terraform
terraform init
```

### Option B: Remote State (recommended for production)

First, create a storage account for Terraform state:

```bash
az storage account create \
  --name gencolinktfstate \
  --resource-group gencolink-rg-tfstate \
  --location eastus \
  --sku Standard_LRS

az storage container create \
  --name tfstate \
  --account-name gencolinktfstate
```

Then, uncomment backend config in `providers.tf`:

```hcl
backend "azurerm" {
  resource_group_name  = "gencolink-rg-tfstate"
  storage_account_name = "gencolinktfstate"
  container_name       = "tfstate"
  key                  = "prod.tfstate"
}
```

Run:
```bash
terraform init
```

---

## Step 5: Plan & Deploy Infrastructure

### 5.1 Validate configuration

```bash
cd infra/terraform
terraform fmt -recursive
terraform validate
```

### 5.2 Plan changes

```bash
terraform plan -out=tfplan
# Review output — check costs, resource names, etc.
```

### 5.3 Apply (create resources)

```bash
terraform apply tfplan
# Watch for errors
# Typical duration: 10-15 minutes
```

### 5.4 Save outputs

```bash
terraform output -json > outputs.json
# Use these values for GitHub Secrets (next step)
```

---

## Step 6: Update GitHub Secrets with Terraform Outputs

After Terraform succeeds, update these secrets:

```bash
# Extract from outputs.json or terraform output
terraform output -raw static_web_app_deployment_token
# → Update AZURE_SWA_DEPLOYMENT_TOKEN in GitHub Secrets

terraform output -raw container_app_fqdn
# → Update DIRECTUS_API_URL to: https://{fqdn}

terraform output -raw functions_default_hostname
# → Update AZURE_FUNCTIONS_PUBLISH_PROFILE (see below)
```

**Getting Functions Publish Profile:**
```bash
az functionapp deployment list-publishing-credentials \
  --name gencolink-prod-eus-funcapp \
  --resource-group gencolink-prod-eus-rg \
  --query "{username:publishingUserName,password:publishingPassword,url:publishingProfileUrl}" \
  -o json
```

Download and save the publish profile XML to `AZURE_FUNCTIONS_PUBLISH_PROFILE` secret.

---

## Step 7: Build & Push Directus Docker Image

### 7.1 Login to Azure Container Registry

```bash
az acr login --name gencolinkprodeus
```

### 7.2 Build Docker image

```bash
docker build -t gencolinkprodeus.azurecr.io/directus:latest \
  ./Directus
```

### 7.3 Push to ACR

```bash
docker push gencolinkprodeus.azurecr.io/directus:latest
```

Or: Commit to `Directus/` → GitHub Actions auto-builds and pushes.

---

## Step 8: Initialize Directus Database

### 8.1 Get PostgreSQL connection string

```bash
terraform output postgres_server_fqdn
# Output: gencolink-prod-eus-pgserver.postgres.database.azure.com
```

### 8.2 Connect and initialize

```bash
# Using Azure Cloud Shell or psql locally
psql -h gencolink-prod-eus-pgserver.postgres.database.azure.com \
  -U pgadmin \
  -d directus

# Enter password from terraform.tfvars
```

### 8.3 Create Directus schema (via Directus UI)

Once Container App is running:
1. Visit `https://{directus-fqdn}/admin`
2. First-time setup wizard creates schema automatically
3. Login with `ADMIN_EMAIL` / `ADMIN_PASSWORD` from terraform.tfvars

---

## Step 9: Configure Directus Flow (Contact Webhook)

### 9.1 Create Flow in Directus UI

1. Admin → Flows → Create new
2. Trigger: Collection event on `contact_submissions`
3. Event: Create
4. Action: Webhook
5. URL: `https://{azure-functions-url}/api/send-email?code={function-key}`

### 9.2 Get Function Key

```bash
az functionapp keys list \
  --name gencolink-prod-eus-funcapp \
  --resource-group gencolink-prod-eus-rg \
  --query "functionKeys" \
  -o table
```

Copy the default key and add to webhook URL.

---

## Step 10: Deploy Frontend (Angular)

### 10.1 Verify frontend build locally

```bash
cd Website
npm install
npm run build -- --configuration production
```

### 10.2 Push to GitHub

```bash
git add Website/
git commit -m "Deploy: Angular frontend"
git push origin main
```

GitHub Actions automatically:
1. Builds Angular
2. Injects `runtime-config.js` with Directus API URL
3. Deploys to Azure Static Web App

**Deployment time**: ~2-3 minutes

---

## Step 11: Deploy Azure Functions

### 11.1 Verify Functions locally

```bash
cd functions
npm install
func local start
# Visit http://localhost:7071/api/send-email
```

### 11.2 Push to GitHub

```bash
git add functions/
git commit -m "Deploy: Azure Functions"
git push origin main
```

GitHub Actions:
1. Builds Node.js function
2. Deploys to Azure Functions (Consumption Plan)

**Deployment time**: ~1-2 minutes

---

## Step 12: Deploy Directus

### 12.1 Verify Dockerfile builds locally

```bash
docker build -f Directus/Dockerfile -t directus:local ./Directus
```

### 12.2 Push to GitHub

```bash
git add Directus/Dockerfile
git commit -m "Deploy: Directus container"
git push origin main
```

GitHub Actions:
1. Builds Docker image
2. Pushes to Azure Container Registry
3. Updates Container App with new image

**Deployment time**: ~5-10 minutes

---

## Step 13: Test Full Stack

### 13.1 Test Frontend

```bash
# Static Web App default URL
curl https://gencolink-prod-eus-swa.azurestaticapps.net/
# Should return HTML with runtime-config.js
```

### 13.2 Test Directus API

```bash
DIRECTUS_URL=$(terraform output -raw container_app_fqdn)
curl https://$DIRECTUS_URL/server/health
# Should return: {"status":"ok"}

curl https://$DIRECTUS_URL/items/site_content \
  -H "Accept: application/json"
# Should return site content (may be empty initially)
```

### 13.3 Test Contact Form

1. Open frontend in browser
2. Submit contact form
3. Check Directus `contact_submissions` collection
4. Check recipient email inbox

---

## Troubleshooting

### Container App won't start
```bash
az containerapp logs show \
  --name gencolink-prod-eus-directus \
  --resource-group gencolink-prod-eus-rg \
  --follow
```

### Function not triggering
```bash
# Check Key Vault access
az keyvault secret list \
  --vault-name gencolink-prod-eus-kv
# Should see all secrets

# Check Function logs
az functionapp log tail \
  --name gencolink-prod-eus-funcapp \
  --resource-group gencolink-prod-eus-rg
```

### Database connection error
```bash
# Test PostgreSQL connectivity
psql -h gencolink-prod-eus-pgserver.postgres.database.azure.com \
  -U pgadmin \
  -d directus
# Enter password and check connection
```

### Static Web App not loading
```bash
# Check deployment
az staticwebapp show \
  --name gencolink-prod-eus-swa \
  --resource-group gencolink-prod-eus-rg
```

---

## Post-Deployment Checklist

- [ ] Frontend accessible at `https://gencolink.com` (or custom domain)
- [ ] Directus accessible at `https://api.gencolink.com` (or Container App FQDN)
- [ ] Directus admin login works
- [ ] Contact form submits successfully
- [ ] Email received at contact recipient
- [ ] PostgreSQL backups enabled
- [ ] Application Insights monitoring enabled
- [ ] Alert rules configured for critical metrics
- [ ] DNS records updated (CNAME for custom domain)
- [ ] SSL/TLS certificates auto-renewed
- [ ] Terraform state backed up to Azure Storage

---

## Maintenance

### Weekly
- Check Azure Cost Management dashboard
- Review Application Insights logs

### Monthly
- Review and rotate secrets in Key Vault
- Check PostgreSQL backup status
- Update dependencies (npm, Docker base images)

### Quarterly
- Disaster recovery test (restore from backup)
- Terraform plan to check for drift
- Security audit (Network Security Group rules, Key Vault access)

---

## Rolling Back

### Frontend
```bash
# Redeploy previous commit
git revert {commit-id}
git push origin main
# GitHub Actions auto-deploys
```

### Directus/Functions
```bash
# Rollback to previous container image
az containerapp update \
  --name gencolink-prod-eus-directus \
  --resource-group gencolink-prod-eus-rg \
  --image gencolinkprodeus.azurecr.io/directus:previous-tag
```

### Terraform
```bash
# Restore previous state
terraform plan -destroy # Review
terraform apply          # Don't recommend!
# Better: Edit terraform.tfvars to previous config and apply
```

---

## Support

- **Azure Docs**: https://docs.microsoft.com/azure/
- **Directus Docs**: https://docs.directus.io/
- **Terraform Registry**: https://registry.terraform.io/
- **GitHub Actions**: https://docs.github.com/actions/
