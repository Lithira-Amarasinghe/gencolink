# Quickstart: Deploy Gencolink to Azure Production

Get your Gencolink multi-project app running on Azure in 30 minutes (plus deployment time).

## 🎯 What This Does

Creates a complete production setup:
- ✅ Angular frontend on Azure Static Web App (FREE)
- ✅ Directus CMS in Container Apps (scales automatically)
- ✅ PostgreSQL database with automated backups
- ✅ Azure Functions for email
- ✅ All secrets in Key Vault (Managed Identity auth)
- ✅ GitHub Actions CI/CD for everything

**Cost**: ~$55–85/month (all-in, production-ready)

---

## ⏱️ Time Required

| Step | Time |
|------|------|
| 1. Azure Setup | 5 min |
| 2. GitHub Secrets | 5 min |
| 3. Terraform Deploy | 15 min |
| 4. Deploy Apps | 5 min |
| **Total** | **30 min + 15 min (deployments)** |

---

## 📋 Prerequisites

```bash
# Check tools
az --version                    # Azure CLI
terraform -version             # Terraform
git --version                  # Git
```

If missing:
- **macOS**: `brew install azure-cli terraform`
- **Windows**: `choco install azure-cli terraform`
- **Linux**: Use package manager or download

---

## 🔧 Step 1: Azure Setup (5 minutes)

### 1.1 Login to Azure

```bash
az login
# Opens browser, sign in with your Microsoft account
```

### 1.2 Create Service Principal

```bash
# Get subscription ID
SUBSCRIPTION_ID=$(az account show --query id -o tsv)
echo $SUBSCRIPTION_ID  # Save this

# Create service principal for GitHub Actions
az ad sp create-for-rbac \
  --name "gencolink-github-actions" \
  --role "Contributor" \
  --scopes "/subscriptions/$SUBSCRIPTION_ID"

# Output:
# {
#   "appId": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
#   "displayName": "gencolink-github-actions",
#   "password": "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
#   "tenant": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
# }
```

**✅ Save this output** — you'll need it in Step 2.

---

## 🔐 Step 2: GitHub Secrets (5 minutes)

Go to your GitHub repository:
1. Settings → Secrets and variables → Actions
2. Add these secrets (from Step 1.2 output):

| Secret Name | Value |
|-------------|-------|
| `AZURE_SUBSCRIPTION_ID` | From step 1.2 (subscription ID) |
| `AZURE_TENANT_ID` | `tenant` from step 1.2 output |
| `AZURE_CLIENT_ID` | `appId` from step 1.2 output |
| `AZURE_CLIENT_SECRET` | `password` from step 1.2 output |

---

## 🏗️ Step 3: Terraform Deploy (15 minutes)

### 3.1 Copy template

```bash
cd infra/terraform
cp terraform.tfvars.example terraform.tfvars
```

### 3.2 Edit `terraform.tfvars`

```bash
# Open file
# macOS/Linux: nano terraform.tfvars
# Windows: notepad terraform.tfvars
```

Minimum required changes:

```hcl
project_name = "gencolink"
environment  = "prod"
location     = "eastus"

# GitHub token (create here: https://github.com/settings/tokens/new)
# Scopes: repo, workflow
github_repo_token = "ghp_xxx..."  # Generate at https://github.com/settings/tokens
github_repo_url   = "https://github.com/YOUR_USERNAME/gencolink"
github_branch     = "main"

# PostgreSQL credentials (create strong passwords)
db_admin_password    = "Generate_Strong_Password_123!@#"

# Directus credentials
directus_admin_email    = "admin@gencolink.com"
directus_admin_password = "Another_Strong_Password_456!@#"

# Generate tokens (use: python -c "import secrets; print(secrets.token_urlsafe(32))")
directus_admin_token = "xxxxxxxxxxxxxxxxxxxxxxxxxxxx"
directus_jwt_secret  = "xxxxxxxxxxxxxxxxxxxxxxxxxxxx"

# Email
contact_recipient_email = "your-email@example.com"

# Leave others as defaults
```

### 3.3 Deploy

```bash
terraform init
terraform plan -out=tfplan
# Review output (shows what will be created)

terraform apply tfplan
# Watch it deploy (takes 10-15 minutes)
```

**✅ After completion**, save the outputs:
```bash
terraform output -json > /tmp/outputs.json
cat /tmp/outputs.json
```

---

## 📡 Step 4: Update GitHub Secrets (after Terraform)

From the `outputs.json`:

| Secret Name | Value from outputs |
|-------------|-------------------|
| `AZURE_RESOURCE_GROUP` | `resource_group_name` |
| `AZURE_KEY_VAULT_NAME` | `key_vault_name` |
| `AZURE_CONTAINER_REGISTRY_NAME` | `container_registry_name` |
| `DIRECTUS_CONTAINER_APP_NAME` | `container_app_name` |
| `AZURE_FUNCTIONS_APP_NAME` | `functions_app_name` |
| `AZURE_SWA_NAME` | `static_web_app_name` |
| `DIRECTUS_API_URL` | Build from output: `https://{container_app_fqdn}` |
| `AZURE_SWA_DEPLOYMENT_TOKEN` | (see Step 5) |
| `AZURE_FUNCTIONS_PUBLISH_PROFILE` | (see Step 5) |

---

## 🚀 Step 5: Get Deployment Tokens

### Get Static Web App Token
```bash
RESOURCE_GROUP=$(terraform output -raw resource_group_name)
SWA_NAME=$(terraform output -raw static_web_app_name)

az staticwebapp secrets list \
  --name $SWA_NAME \
  --resource-group $RESOURCE_GROUP \
  --query "properties.apiKey" -o tsv
# Copy output → GitHub Secret: AZURE_SWA_DEPLOYMENT_TOKEN
```

### Get Functions Publish Profile
```bash
FUNC_NAME=$(terraform output -raw functions_app_name)

az functionapp deployment list-publishing-credentials \
  --name $FUNC_NAME \
  --resource-group $RESOURCE_GROUP \
  --query "publishingProfile" -o tsv | head -c 500
# Copy entire XML output → GitHub Secret: AZURE_FUNCTIONS_PUBLISH_PROFILE
```

---

## 🐳 Step 6: Build & Deploy Directus

### Option A: GitHub Actions (Recommended)
```bash
# Push Dockerfile
git add Directus/Dockerfile
git commit -m "Deploy: Directus container"
git push origin main
# GitHub Actions auto-builds and deploys (5-10 min)
```

### Option B: Manual Docker Build
```bash
# Login to registry
az acr login --name $(terraform output -raw container_registry_name)

# Build and push
docker build -f Directus/Dockerfile \
  -t $(terraform output -raw container_registry_name).azurecr.io/directus:latest \
  ./Directus
docker push $(terraform output -raw container_registry_name).azurecr.io/directus:latest
```

---

## 📱 Step 7: Deploy Frontend & Functions

### Deploy Frontend
```bash
git add Website/
git commit -m "Deploy: Angular frontend"
git push origin main
# Auto-deploys via GitHub Actions (2-3 min)
```

### Deploy Functions
```bash
git add functions/
git commit -m "Deploy: Azure Functions"
git push origin main
# Auto-deploys via GitHub Actions (1-2 min)
```

---

## ✅ Step 8: Verify Everything Works

### Test frontend
```bash
# Get URL
SWA_URL="https://$(terraform output -raw static_web_app_default_host_name)"
echo $SWA_URL
curl $SWA_URL | head -20
```

### Test Directus API
```bash
# Get URL
DIRECTUS_URL="https://$(terraform output -raw container_app_fqdn)"
curl $DIRECTUS_URL/server/health
# Should return: {"status":"ok"}
```

### Test Functions
```bash
FUNC_URL=$(terraform output -raw functions_default_hostname)
curl -X POST "https://$FUNC_URL/api/send-email" \
  -H "Content-Type: application/json" \
  -d '{"test":true}'
# May return auth error (expected without function key)
```

---

## 🎉 Done!

Your production app is now live:
- **Frontend**: `https://{static-web-app-domain}`
- **Directus API**: `https://{container-app-domain}`
- **Functions**: `https://{functions-domain}/api/send-email`

---

## 📚 Next: Full Documentation

Read these for detailed info:

1. **[ARCHITECTURE.md](./ARCHITECTURE.md)** — System design & components
2. **[DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md)** — Step-by-step instructions
3. **[COST_ANALYSIS.md](./COST_ANALYSIS.md)** — Cost breakdown & optimization
4. **[GITHUB_SECRETS_SETUP.md](./GITHUB_SECRETS_SETUP.md)** — Secrets management

---

## 🆘 Troubleshooting

### Terraform fails with "subscription not found"
```bash
az account set --subscription $SUBSCRIPTION_ID
terraform apply
```

### Container App won't start
```bash
az containerapp logs show -n gencolink-prod-eus-directus \
  -g gencolink-prod-eus-rg --follow
```

### GitHub Actions fails with permission error
- Check all GitHub Secrets are added
- Verify `AZURE_CLIENT_SECRET` is correct
- Re-run workflow from GitHub Actions tab

### Database connection error
```bash
# Test locally
psql -h gencolink-prod-eus-pgserver.postgres.database.azure.com \
  -U pgadmin \
  -d directus
# Enter password from terraform.tfvars
```

See [DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md) for more help.

---

## 💰 Monitor Costs

Go to Azure Portal:
1. Home → Cost Management + Billing
2. Cost analysis (shows daily spend)
3. Set budget alerts (recommended: $100/month)

Expected: ~$60/month

---

## 🔄 Next Steps

1. Configure custom domain (DNS CNAME records)
2. Setup Directus contact form webhook
3. Configure Azure Communication Email
4. Setup alerts in Application Insights
5. Enable Key Vault soft-delete for production hardening

---

## 📖 Quick Links

- **Azure Portal**: https://portal.azure.com
- **GitHub Actions**: https://github.com/{org}/{repo}/actions
- **Terraform Docs**: https://registry.terraform.io/providers/hashicorp/azurerm/latest
- **Directus Docs**: https://docs.directus.io/
- **Angular Docs**: https://angular.io/

---

**Questions?** Check [DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md) for detailed troubleshooting.

**Enjoy your production Gencolink app!** 🚀
