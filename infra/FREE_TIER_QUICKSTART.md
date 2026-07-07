# FREE Tier Quickstart: Deploy in 20 Minutes ($0/Month)

**App Service FREE + Cosmos DB FREE = $0 total cost**

---

## ⏱️ **Timeline**

| Step | Time | What |
|------|------|------|
| 1 | 3 min | Generate tokens |
| 2 | 3 min | Setup Terraform |
| 3 | 10 min | Deploy infrastructure |
| 4 | 4 min | Access Directus |

**Total: ~20 minutes to live** 🚀

---

## ⚠️ **IMPORTANT: FREE TIER LIMITATIONS**

**READ FIRST**: Before deploying, understand:

1. **60 minutes/day running time**
   - App auto-stops after 60 min of active use
   - Resets daily at UTC midnight
   - Fine for dev/testing, NOT for 24/7

2. **1 GB RAM (shared compute)**
   - Performance may be slow with large datasets
   - OK for small Directus instance

3. **No custom domain**
   - Only `*.azurewebsites.net` URL
   - No `yoursite.com` support

4. **Cold starts (30-60s)**
   - First request after sleep takes 30-60s
   - Expected and normal

⚠️ **Only use for development, not production** ⚠️

---

## 🔧 **Step 1: Generate Tokens (3 min)**

Generate secure random tokens for Directus:

```bash
# Token 1: Admin Token
python -c "import secrets; print(secrets.token_urlsafe(32))"
# Copy output → save as DIRECTUS_ADMIN_TOKEN

# Token 2: JWT Secret
python -c "import secrets; print(secrets.token_urlsafe(32))"
# Copy output → save as DIRECTUS_JWT_SECRET
```

**Example output** (don't use these!):
```
Token 1: a1B2c3D4e5F6g7H8i9J0k1L2m3N4o5P6q7R8s9T0u1V2w3X4y5Z6
Token 2: x9Y8z7A6b5C4d3E2f1G0h9I8j7K6l5M4n3O2p1Q0r9S8t7U6v5W4x3Y2z1
```

**Save all three tokens**:
```
ADMIN_EMAIL: admin@gencolink.com
ADMIN_PASSWORD: StrongPassword123!@# (create your own)
ADMIN_TOKEN: (generated above)
JWT_SECRET: (generated above)
```

---

## 📝 **Step 2: Setup Terraform (3 min)**

### 2.1 Switch to FREE tier config
```bash
cd infra/terraform

# Swap files to use FREE tier
mv main.tf main-expensive.tf
mv main-free-tier.tf main.tf

mv variables.tf variables-expensive.tf
mv variables-free-tier.tf variables.tf
```

### 2.2 Create variables file
```bash
cp terraform.tfvars.example terraform.tfvars
```

### 2.3 Edit terraform.tfvars
```hcl
project_name = "gencolink"
environment  = "prod"
location     = "eastus"

# Directus admin credentials
directus_admin_email    = "admin@gencolink.com"
directus_admin_password = "YourStrongPassword123!@#"
directus_admin_token    = "PASTE_YOUR_ADMIN_TOKEN_HERE"
directus_jwt_secret     = "PASTE_YOUR_JWT_SECRET_HERE"

# Docker (leave empty for public Docker Hub)
docker_registry_username = ""
docker_registry_password = ""

tags = {
  Project     = "Gencolink"
  Environment = "Production"
  CostModel   = "FREE-Tier"
}
```

---

## 🚀 **Step 3: Deploy (10 min)**

### 3.1 Initialize Terraform
```bash
terraform init
# Downloads Azure provider
```

### 3.2 Plan
```bash
terraform plan
# Shows resources to be created:
# - App Service (FREE)
# - Cosmos DB (FREE)
# - Static Web App (FREE)
# - Storage Account
# Total cost: $0 (+ ~$0.50 storage)
```

### 3.3 Apply
```bash
terraform apply
# Watch deployment progress
# Should complete in 5-10 min
```

### 3.4 Save outputs
```bash
terraform output -json > outputs.json
cat outputs.json

# You'll see:
# - directus_url: https://gencolink-prod-eus-directus.azurewebsites.net
# - directus_hostname: gencolink-prod-eus-directus.azurewebsites.net
# - static_web_app_url: https://gencolink-prod-eus-swa.azurestaticapps.net
```

---

## 🔑 **Step 4: Access Directus (4 min)**

### 4.1 Get Directus URL
```bash
DIRECTUS_URL=$(terraform output -raw directus_url)
echo $DIRECTUS_URL
# Output: https://gencolink-prod-eus-directus.azurewebsites.net/admin
```

### 4.2 Open in browser
1. Copy the URL from above
2. Paste into browser
3. Wait for load (first load may take 30-60s)

### 4.3 Login
```
Email: admin@gencolink.com
Password: (your configured password)
```

### 4.4 Verify working
- You should see Directus admin panel
- Click "Content" to explore
- Create a test collection to confirm DB works

---

## ✅ **Verification**

### Test 1: Directus loads
```bash
curl https://$(terraform output -raw directus_hostname)/admin
# Should return HTML
```

### Test 2: API works
```bash
curl https://$(terraform output -raw directus_hostname)/server/info
# Should return Directus info JSON
```

### Test 3: Frontend loads
```bash
curl https://$(terraform output -raw static_web_app_url)
# Should return HTML
```

---

## 🎯 **What You've Deployed**

```
✅ Directus CMS
   ├─ Location: App Service (FREE)
   ├─ URL: https://<your-domain>.azurewebsites.net/admin
   ├─ Cost: $0/month
   └─ Limitation: 60 min/day runtime

✅ Cosmos DB
   ├─ Type: NoSQL database (FREE tier)
   ├─ Storage: 1 GB included
   ├─ Throughput: 400 RU/s included
   └─ Cost: $0/month

✅ Static Web App
   ├─ Angular frontend
   ├─ Cost: $0/month
   └─ URL: https://<your-domain>.azurestaticapps.net

Blob Storage: ~$0.50/month for uploads
─────────────────────────────────────────
TOTAL MONTHLY: $0.50
ANNUAL: $6
```

---

## 📱 **Update Angular**

### Update runtime-config.js
```javascript
// File: Website/public/runtime-config.js

window.__DIRECTUS_URL__ = 'https://gencolink-prod-eus-directus.azurewebsites.net';
window.__API_TIMEOUT__ = 30000;
```

### Deploy
```bash
git add Website/
git commit -m "Update: Directus API URL"
git push origin main
# Auto-deploys to Static Web App
```

---

## ⚠️ **Important Reminders**

### **60-Minute Limit**
```
Day 1: 9am-10am use Directus (60 min quota consumed)
       10am onwards: ❌ App stopped
       (Error: 403 Forbidden - Quota Exceeded)

Day 2: Midnight UTC reset → 60 min quota restored
       Can use again
```

### **Cold Start**
```
First request after sleep: 30-60s wait
This is NORMAL and expected
Not a bug, just how FREE tier works
```

### **NOT FOR PRODUCTION**
```
❌ Do NOT use for customer-facing app
❌ Do NOT use for high-traffic site
❌ Do NOT expect 24/7 uptime
✅ DO use for development/testing
✅ DO use for learning
✅ DO use for MVP/prototype
```

---

## 🆙 **When to Upgrade**

If you need:
- ✅ 24/7 uptime → Upgrade to Basic B1 ($12/month)
- ✅ More than 60 min/day → Upgrade to Basic B1
- ✅ Custom domain → Upgrade to Basic B1
- ✅ Better performance → Upgrade to Basic B1
- ✅ Production reliability → Upgrade to Standard S1 ($65+/month)

---

## 🚨 **Troubleshooting**

### **Problem: Directus takes forever to load (1-2 min)**
- **Cause**: Cold start (app waking from sleep)
- **Expected**: Yes, this is normal for FREE tier
- **Solution**: Wait, or upgrade to Basic tier

### **Problem: "403 Forbidden - Quota Exceeded"**
- **Cause**: Used all 60 minutes of running time
- **Expected**: Yes, FREE tier limitation
- **Solution**: Wait until next day, or upgrade

### **Problem: Database errors (429 Too Many Requests)**
- **Cause**: Exceeded 400 RU/s on Cosmos DB
- **Solution**: 
  - Reduce query load
  - Add caching
  - Upgrade Cosmos DB (costs money)

### **Problem: Can't login to Directus**
- **Cause**: Wrong credentials
- **Solution**: 
  - Check email address (admin@gencolink.com)
  - Check password (from terraform.tfvars)
  - Verify tokens were generated correctly

---

## 💰 **Cost Verification**

### Check your costs:
1. Go to Azure Portal
2. **Cost Management + Billing** → **Cost Analysis**
3. Filter by last **3 days**
4. Should show: **~$0.50 for storage only**

If higher:
- Check for accidental resources
- Delete old resources if any
- Cosmos DB should be FREE

---

## 🎉 **SUCCESS!**

You now have:
- ✅ Directus running for FREE
- ✅ Cosmos DB database for FREE
- ✅ Frontend on Static Web App for FREE
- ✅ Total cost: **$0/month** (+ $0.50 storage)
- ✅ Deployment time: **20 minutes**

**Limitations understood?** ✅
- 60 min/day runtime
- 1 GB RAM
- Cold starts (30-60s)
- No custom domain
- No SLA

**This is perfect for development!** 🚀

---

## 🔄 **Next Steps**

1. Configure content in Directus
2. Update Angular API endpoints
3. Deploy Angular to Static Web App
4. Test full integration
5. When ready for production → Upgrade to Basic B1 tier

---

**You're live on $0/month!** 🎊
