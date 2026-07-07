# Ultra-Low-Cost Quickstart: Deploy in 15 Minutes ($1-2/month)

Get Gencolink running on **$1-2/month** in 15 minutes.

---

## ⏱️ Timeline

| Step | Time | Task |
|------|------|------|
| 1 | 2 min | Get SendGrid Free API key |
| 2 | 3 min | Setup Terraform variables |
| 3 | 10 min | Deploy with `terraform apply` |
| 4 | 5 min | Deploy Functions & test |

**Total: ~15 min to production** 🚀

---

## 🔧 Step 1: Get SendGrid Free Key (2 min)

**This replaces Directus for email — 12,500 emails/month FREE**

### 1.1 Sign up
```
Go to: https://sendgrid.com/pricing
Click "Free Tier" 
Sign up (takes 2 min)
```

### 1.2 Get API Key
```
1. Login to SendGrid: https://app.sendgrid.com
2. Go to: Settings → API Keys
3. Click "Create API Key"
4. Name it: "Gencolink-Azure"
5. Copy the key (starts with "SG.")
```

**Save this key** — you'll need it in Step 2.

---

## 📝 Step 2: Setup Terraform (3 min)

### 2.1 Prepare variables
```bash
cd infra/terraform

# Copy template
cp terraform.tfvars.example terraform.tfvars
```

### 2.2 Edit `terraform.tfvars`
```hcl
# Minimal config needed:

project_name = "gencolink"
environment  = "prod"
location     = "eastus"

# REQUIRED: Your contact email
contact_recipient_email = "your-email@example.com"

# REQUIRED: SendGrid key from Step 1
sendgrid_api_key = "SG.xxxxxxxxxxxxxx"

# Optional: From email
from_email_address = "noreply@gencolink.com"

# Tags (optional)
tags = {
  Project     = "Gencolink"
  Environment = "Production"
  CostModel   = "Ultra-Low-Cost"
}
```

**That's it!** Everything else has defaults.

---

## 🚀 Step 3: Deploy (10 min)

### 3.1 Verify setup
```bash
cd infra/terraform
terraform fmt
terraform validate
```

### 3.2 Plan
```bash
terraform plan -out=tfplan
# Review output (should show 5-6 resources)
```

### 3.3 Apply
```bash
terraform apply tfplan
# Watch it deploy (5-10 min)
# At end: shows resource names and URLs
```

### 3.4 Save outputs
```bash
terraform output -json > outputs.json
cat outputs.json
```

**Keep `outputs.json` handy** — you'll need the URLs.

---

## 🔌 Step 4: Deploy Functions (5 min)

### 4.1 Install & deploy
```bash
cd functions
npm install

# Option A: Via Azure Functions Core Tools
func azure functionapp publish <function-app-name>

# Option B: Via GitHub Actions (auto)
git add functions/
git commit -m "Deploy: Functions"
git push origin main
# Watch GitHub Actions → Functions workflow completes
```

### 4.2 Test endpoints
```bash
# Get function URL from outputs.json
FUNC_URL=$(terraform output -raw functions_url)

# Test 1: Get site content
curl $FUNC_URL/api/site-content
# Should return JSON with hero, about, sections

# Test 2: Get products
curl $FUNC_URL/api/products
# Should return product list

# Test 3: Submit contact form
curl -X POST $FUNC_URL/api/contact \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test User",
    "email": "test@example.com",
    "message": "Test message"
  }'
# Should return success + check your email
```

---

## 🎯 Step 5: Update Angular Frontend (3 min)

### 5.1 Update runtime-config.js
```javascript
// File: Website/public/runtime-config.js

window.__API_URL__ = 'https://<function-app-name>.azurewebsites.net/api';
window.__STATIC_MODE__ = true; // Use Azure Functions as backend
window.__API_TIMEOUT__ = 30000;
```

### 5.2 Update service
```typescript
// File: Website/src/app/services/site-content.service.ts

export class SiteContentService {
  constructor(private http: HttpClient) {}

  getSiteContent() {
    return this.http.get(`${window.__API_URL__}/site-content`);
  }

  getProducts() {
    return this.http.get(`${window.__API_URL__}/products`);
  }

  submitContactForm(data: any) {
    return this.http.post(`${window.__API_URL__}/contact`, data);
  }
}
```

### 5.3 Deploy frontend
```bash
git add Website/
git commit -m "Deploy: Updated API endpoints"
git push origin main
# GitHub Actions auto-deploys to Static Web App
```

---

## ✅ Verify Everything Works

### Test 1: Frontend loads
```bash
SWA_URL=$(terraform output -raw static_web_app_url)
curl $SWA_URL
# Should return HTML
```

### Test 2: API endpoint
```bash
curl https://<function-app>/api/site-content
# Should return JSON
```

### Test 3: Contact form (end-to-end)
1. Open frontend in browser
2. Find contact form
3. Submit:
   - Name: "Test User"
   - Email: "your-email@example.com"
   - Message: "This is a test"
4. Check your email inbox
5. **Should receive confirmation email** ✅

### Test 4: Check Cosmos DB
```bash
# In Azure Portal:
# Home → Gencolink → Cosmos DB → Data Explorer
# Select: contact_submissions container
# Should see your test submission
```

---

## 💰 Verify Cost ($1-2/month)

### In Azure Portal
1. Go to: **Cost Management + Billing**
2. Click: **Cost Analysis**
3. Filter: **Today**
4. Should show: **~$0.01-0.05 for day 1** ✅

If you see > $5:
- Check for deleted resources
- Verify Container Apps is NOT running
- Verify PostgreSQL is NOT running
- Delete old resources if present

---

## 🎉 YOU'RE DONE!

Your app is now live:
- **Frontend**: `https://<static-web-app>.azurestaticapps.net`
- **API**: `https://<function-app>.azurewebsites.net/api`
- **Database**: Cosmos DB (FREE tier)
- **Email**: SendGrid (12,500/month FREE)
- **Monthly Cost**: **$1-2** 🎊

---

## 📊 What You've Deployed

```
✅ Azure Static Web App (Frontend)
✅ Azure Functions (API backend)
✅ Cosmos DB Free Tier (Database)
✅ Blob Storage (Content storage)
✅ SendGrid Free Tier (Email)

❌ Container Apps (REMOVED - too expensive)
❌ PostgreSQL (REMOVED - too expensive)
❌ Container Registry (REMOVED - unnecessary)
❌ Key Vault (REMOVED - use GitHub Secrets)
❌ Application Insights (REMOVED - save cost)
```

---

## 🚨 Troubleshooting

### Functions not deploying
```bash
# Check logs
func azure functionapp log tail <function-app-name>

# Redeploy
npm install
func azure functionapp publish <function-app-name>
```

### Contact form not working
```bash
# Test manually
curl -X POST https://<func>.azurewebsites.net/api/contact \
  -H "Content-Type: application/json" \
  -d '{"name":"Test","email":"test@test.com","message":"Hi"}'

# Check SendGrid key is valid
# Verify contact_recipient_email is correct
```

### High costs appearing
```bash
# Check for these accidentally running:
az containerapp list -g <resource-group>
# If found: az containerapp delete

az postgres flexible-server list -g <resource-group>
# If found: az postgres flexible-server delete

# Verify in Portal: Cost Analysis → Last 3 days
```

### Angular not loading
```bash
# Check runtime-config.js has correct API_URL
cat Website/public/runtime-config.js

# Check service has correct endpoint
cat Website/src/app/services/site-content.service.ts

# Rebuild and push
git add Website/
git commit -m "Fix: API endpoints"
git push origin main
```

---

## 📚 Next Steps

1. **Setup custom domain** (optional)
   ```bash
   # Add DNS CNAME record pointing to Static Web App
   # Takes ~10 min
   ```

2. **Add more content**
   - Edit `site-content.json` in Blob Storage
   - Edit `products.json` in Blob Storage
   - No rebuild needed!

3. **Monitor costs**
   - Check Azure Cost Analysis weekly
   - Alert if > $5/month

4. **Scale if needed**
   - If Cosmos DB exceeds free tier, upgrade to pay-per-request
   - Cost increases gradually, not exponentially

---

## 💡 Key Differences from Original

| Original | Ultra-Low-Cost |
|----------|----------------|
| Directus + PostgreSQL | Functions + Cosmos DB |
| Always-on containers | Serverless (scale to zero) |
| $60/month database | $0 database (free tier) |
| Complex setup | Simple setup (3 functions) |
| Hard to update content | Easy (edit JSON, redeploy) |
| $55-85/month | **$1-2/month** |

---

## 🎯 Summary

**You just deployed**:
- ✅ Production-grade serverless app
- ✅ Global CDN for frontend
- ✅ NoSQL database (Cosmos)
- ✅ Email functionality (SendGrid)
- ✅ Total cost: **$1-2/month**
- ✅ Deployment time: **15 min**

**This is enterprise-grade infrastructure at startup prices!** 🚀

---

**Questions?** See [ULTRA_LOW_COST_GUIDE.md](./ULTRA_LOW_COST_GUIDE.md) for details.
