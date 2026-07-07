# Deploy Terraform Locally, Then Push to GitHub

**Complete guide to deploy infrastructure locally, then push code.**

---

## 🎯 **WORKFLOW**

```
Step 1: Deploy Terraform locally
        ↓ Creates infrastructure in Azure
        
Step 2: Infrastructure ready (empty)
        ↓
        
Step 3: Push code to GitHub
        ↓ GitHub Actions auto-deploys code
        
Step 4: Live on Azure
```

---

## 📋 **PREREQUISITES**

You need:
- ✅ Azure subscription + `gencolink` resource group
- ✅ Azure CLI installed (`az --version`)
- ✅ Terraform installed (`terraform --version`)
- ✅ Git installed
- ✅ GitHub account + repo
- ✅ Azure Service Principal (for GitHub Actions)

---

## 🚀 **PART 1: DEPLOY TERRAFORM LOCALLY**

### **Step 1.1: Prepare Terraform Files**

```bash
cd infra/terraform

# Use FREE tier configuration
mv main.tf main-expensive.tf
mv main-free-tier.tf main.tf

mv variables.tf variables-expensive.tf
mv variables-free-tier.tf variables.tf
```

### **Step 1.2: Create terraform.tfvars**

```bash
cp terraform.tfvars.example terraform.tfvars
```

### **Step 1.3: Generate Directus Tokens**

```bash
# Generate Token 1 (Admin Token)
python -c "import secrets; print(secrets.token_urlsafe(32))"
# Output: copy this

# Generate Token 2 (JWT Secret)
python -c "import secrets; print(secrets.token_urlsafe(32))"
# Output: copy this
```

**Save both tokens** — you'll paste them below.

### **Step 1.4: Edit terraform.tfvars**

Open the file and fill in:

```hcl
# Your existing resource group
resource_group_name = "gencolink"

# Project info
project_name = "gencolink"
environment  = "prod"
location     = "eastus"

# Directus admin credentials
directus_admin_email    = "admin@gencolink.com"
directus_admin_password = "YourStrongPassword123!@#"

# Paste your generated tokens here
directus_admin_token    = "7rXUQwA-LIwq8oLaJi6wWTm2hFCluByI6J4sGhoHoP0"
directus_jwt_secret     = "qAcFJcTSylEV9WGo8oMpOJ3a_MPDCigx7leECWSQ4Fo"

# Docker (leave empty for public images)
docker_registry_username = ""
docker_registry_password = ""
```

### **Step 1.5: Login to Azure**

```bash
az login
# Browser opens → Sign in with your Azure account
# Returns subscription info
```

### **Step 1.6: Initialize Terraform**

```bash
terraform init
# Downloads Azure provider and modules
```

### **Step 1.7: Review Plan**

```bash
terraform plan
# Shows ALL resources to be created
# Review carefully before applying
```

**Should show:**
- App Service Plan (FREE)
- App Service (Directus)
- Cosmos DB Account + Database
- Storage Account + Container
- Static Web App

### **Step 1.8: Apply Terraform**

```bash
terraform apply
# Creates infrastructure in Azure
# Takes 5-10 minutes
# Prompts: Type "yes" to confirm
```

**Wait for completion** — you'll see:
```
Apply complete! Resources: 8 added
```

### **Step 1.9: Save Outputs**

```bash
terraform output -json > outputs.json
cat outputs.json
```

**Save these values** — you'll need them:
```json
{
  "directus_url": "https://gencolink-prod-eus-directus.azurewebsites.net/admin",
  "directus_hostname": "gencolink-prod-eus-directus.azurewebsites.net",
  "static_web_app_url": "https://gencolink-prod-eus-swa.azurestaticapps.net",
  "cosmos_endpoint": "https://gencolink-prod-eus-cosmosdb.documents.azure.com:443/",
  "storage_account_name": "gencolinkprodeuscontent"
}
```

### **Step 1.10: Verify Infrastructure**

```bash
# Check Directus is accessible (may take 30-60s to wake up)
curl https://gencolink-prod-eus-directus.azurewebsites.net/admin
# Should return HTML
```

---

## ✅ **INFRASTRUCTURE NOW LIVE (EMPTY)**

Your Azure resources exist but have:
- ❌ No Directus code running yet
- ❌ No Angular app yet
- ✅ Empty databases
- ✅ Empty storage

**Next: Push code to GitHub to deploy it.**

---

## 📤 **PART 2: PUSH CODE TO GITHUB**

### **Step 2.1: Update Angular Config**

Update Directus URL so Angular can reach it:

```bash
# File: Website/public/runtime-config.js
# Edit and add:

window.__DIRECTUS_URL__ = 'https://gencolink-prod-eus-directus.azurewebsites.net';
window.__API_TIMEOUT__ = 30000;
```

### **Step 2.2: Create GitHub Secrets**

GitHub Actions needs Azure credentials to deploy.

Go to: **GitHub Repo → Settings → Secrets and variables → Actions**

Add these 4 secrets:

```
AZURE_SUBSCRIPTION_ID = (your subscription ID)
AZURE_TENANT_ID = (from Step 2.3 below)
AZURE_CLIENT_ID = (from Step 2.3 below)
AZURE_CLIENT_SECRET = (from Step 2.3 below)
```

**Don't have these?** Create Service Principal:

```bash
az ad sp create-for-rbac \
  --name "gencolink-github-actions" \
  --role "Contributor" \
  --scopes "/subscriptions/{subscription-id}"
```

Output will show:
```
{
  "appId": "copy-this",          # AZURE_CLIENT_ID
  "password": "copy-this",        # AZURE_CLIENT_SECRET
  "tenant": "copy-this"           # AZURE_TENANT_ID
}
```

Add more secrets:
```
AZURE_SWA_NAME = gencolink-prod-eus-swa
AZURE_RESOURCE_GROUP = gencolink
DIRECTUS_API_URL = https://gencolink-prod-eus-directus.azurewebsites.net
```

### **Step 2.3: Stage Files for Commit**

```bash
# From project root
git add .

# Don't commit terraform.tfvars (contains secrets!)
git reset infra/terraform/terraform.tfvars

# Check what's staged
git status
```

Should show:
```
Modified:
  Website/public/runtime-config.js
  infra/terraform/main-free-tier.tf
  infra/terraform/variables-free-tier.tf
  .github/workflows/frontend.yml
  .github/workflows/directus.yml
  etc.

Unstaged:
  infra/terraform/terraform.tfvars (NOT committed ✓)
```

### **Step 2.4: Commit**

```bash
git commit -m "Deploy: Infrastructure and code to Azure

- Terraform: App Service (FREE) + Cosmos DB (FREE)
- Directus: Running on App Service
- Frontend: Angular on Static Web App
- Database: Cosmos DB with FREE tier
- Cost: \$0/month for app + database

Deployment via GitHub Actions workflows:
- infra.yml: Terraform apply
- frontend.yml: Angular build & deploy
- directus.yml: Docker image build & deploy"
```

### **Step 2.5: Push to GitHub**

```bash
git push origin main
```

**GitHub Actions automatically triggers** ✅

---

## 🔄 **GITHUB ACTIONS NOW RUNS**

Go to: **GitHub Repo → Actions**

You'll see workflows running:

```
frontend.yml     → Building Angular
directus.yml     → Building Docker image
functions.yml    → Building Azure Functions
```

**Wait for all to complete** (5-10 minutes)

Each should show: ✅ **"All checks passed"**

---

## ✅ **VERIFY EVERYTHING WORKS**

### **Test 1: Directus Admin**
```bash
# Open in browser
https://gencolink-prod-eus-directus.azurewebsites.net/admin

# Login:
Email: admin@gencolink.com
Password: (your configured password)

# Should see Directus dashboard
```

### **Test 2: Frontend**
```bash
# Open in browser
https://gencolink-prod-eus-swa.azurestaticapps.net

# Should see Angular app
```

### **Test 3: API Connection**
```bash
# From Directus admin:
# Click "Content" → Create a test item
# Save it

# Check if it persists
# Refresh page → Item still there ✓
```

---

## 📊 **FULL DEPLOYMENT STATUS**

```
✅ Terraform (Infrastructure)
   ├─ App Service (FREE): Running
   ├─ Cosmos DB (FREE): Running
   ├─ Storage Account: Running
   └─ Static Web App: Running

✅ GitHub Actions (Code)
   ├─ Frontend deployed: Angular running
   ├─ Directus deployed: Docker image running
   └─ Functions deployed: Ready

✅ Database
   ├─ Cosmos DB: Connected
   ├─ Collections created: Yes
   └─ Ready for data: Yes

COST: $0/month
STATUS: LIVE 🎉
```

---

## ⏱️ **TIMELINE**

```
0 min:    terraform apply (you run locally)
          ↓
10 min:   Infrastructure created
          ↓
15 min:   git push (you push code)
          ↓
20 min:   GitHub Actions starts
          ↓
30 min:   Code deployed to infrastructure
          ↓
40 min:   Everything live, test passing
          ↓
Total: 40 minutes from start to live production
```

---

## 🚨 **TROUBLESHOOTING**

### **Problem: "terraform apply" fails**
```bash
# Check Azure login
az account show

# If no account, login again
az login

# Try terraform apply again
terraform apply
```

### **Problem: Directus takes 1-2 min to load**
- **Expected**: Cold start on FREE tier
- **Solution**: Wait, it's normal

### **Problem: GitHub Actions fails**
```bash
# Check secrets are added correctly
# Go to: Settings → Secrets → Actions
# Verify all 4 Azure secrets exist

# If missing, add them and re-run:
# Actions → Click workflow → "Re-run jobs"
```

### **Problem: Can't login to Directus**
```bash
# Wrong credentials?
# Check terraform.tfvars:
cat infra/terraform/terraform.tfvars | grep directus_admin

# Email should be: admin@gencolink.com
# Password: (your configured one)
```

---

## 🎯 **NEXT STEPS**

### **After Everything is Live:**

1. **Configure Content** in Directus
   - Create collections
   - Add products
   - Setup webhooks (optional)

2. **Update Angular** to use Directus data
   - Create services
   - Add HTTP calls
   - Display content

3. **Monitor Costs**
   - Go to: Azure Portal → Cost Management
   - Should show: ~$0.50/month (storage only)

4. **When You Outgrow FREE**
   - Upgrade App Service from F1 to B1 ($12/month)
   - Just change SKU in Terraform
   - Re-run `terraform apply`

---

## ✨ **SUMMARY**

**What you did:**
1. ✅ Deployed Terraform locally (created infrastructure)
2. ✅ Pushed code to GitHub (deployed applications)
3. ✅ GitHub Actions auto-deployed code to infrastructure
4. ✅ Everything now live and working

**Cost: $0/month** (app + database)
**Time: 40 minutes**
**Status: Production ready** 🚀

---

**DONE!** Your Gencolink app is live on Azure. 🎉
