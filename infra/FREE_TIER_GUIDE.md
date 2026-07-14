# FREE Tier Architecture: $0/Month with App Service + Cosmos DB

**Complete zero-cost setup using Azure App Service FREE + Cosmos DB FREE**

---

## 💰 **COST: $0/MONTH**

| Component | Tier | Cost |
|-----------|------|------|
| **App Service** | FREE | **$0** |
| **Cosmos DB** | FREE | **$0** |
| **Static Web App** | FREE | **$0** |
| **Blob Storage** | Standard | ~**$0.50** |
| **TOTAL** | | **~$0.50/month** 🎉 |

**Annual: ~$6** ✅

---

## 🏗️ **ARCHITECTURE**

```
┌─────────────────────────────────────┐
│  Static Web App (FREE)              │
│  Angular 20 Frontend                │
│  Cost: $0                           │
└──────────────┬──────────────────────┘
               │ HTTP API
    ┌──────────▼──────────────┐
    │  App Service (FREE)     │
    │  Directus CMS           │
    │  Cost: $0               │
    └──────────────┬──────────┘
                   │ Query
    ┌──────────────▼──────────────┐
    │  Cosmos DB (FREE)           │
    │  Database                   │
    │  Cost: $0                   │
    │  400 RU/s, 1GB storage      │
    └─────────────────────────────┘

Blob Storage: ~$0.50/month (uploads)
```

---

## ⚠️ **CRITICAL LIMITATIONS**

### **App Service FREE Tier**

| Limitation | Impact | Workaround |
|-----------|--------|-----------|
| **60 min/day runtime** | App stops after 60 min | Use for dev/testing only |
| **1 GB RAM** | Shared compute | OK for small Directus |
| **No custom domain** | Only Azure domain | Use `*.azurewebsites.net` |
| **No SLA** | No uptime guarantee | Not for production |
| **Shared resources** | Can be slow | OK for low traffic |
| **No IP restrictions** | Less secure | Use authentication |

### **Cosmos DB FREE Tier**

| Limit | Value | Impact |
|-------|-------|--------|
| **Throughput** | 400 RU/s | Enough for ~1,000 requests/day |
| **Storage** | 1 GB | Good for small DB |
| **Containers** | 25 max | Plenty for Directus |
| **Scaling** | Fixed | Can't increase in free tier |

### **When FREE tier exceeds limits**:
- Cosmos DB: Throttling errors (429) if > 400 RU/s
- App Service: Automatic stop after 60 minutes
- Storage: Auto-scales ($0.25 per GB beyond 1GB)

---

## 🎯 **WHO SHOULD USE THIS?**

✅ **Good for**:
- Development/testing
- Learning Azure + Directus
- Personal projects
- Low-traffic MVPs
- Prototypes

❌ **NOT for**:
- Production apps
- High traffic (> 1,000 requests/day)
- 24/7 availability needs
- Customer-facing apps
- SLA requirements

---

## 🚀 **DEPLOYMENT (20 minutes)**

### **Step 1: Prepare Variables (3 min)**

```bash
cd infra/terraform

# Use FREE tier config
mv main.tf main-expensive.tf
mv main-free-tier.tf main.tf
mv variables.tf variables-expensive.tf
mv variables-free-tier.tf variables.tf

# Copy template
cp terraform.tfvars.example terraform.tfvars
```

### **Step 2: Edit terraform.tfvars (3 min)**

```hcl
project_name           = "gencolink"
environment            = "prod"
location               = "eastus"

# Directus admin
directus_admin_email   = "admin@gencolink.com"
directus_admin_password = "REPLACE_WITH_YOUR_OWN_STRONG_PASSWORD"

# Generate tokens:
# python -c "import secrets; print(secrets.token_urlsafe(32))"
directus_admin_token   = "xxxxxxxxxxxxxxxxxxxxx"
directus_jwt_secret    = "xxxxxxxxxxxxxxxxxxxxx"

# Docker (optional, leave empty for public Docker Hub)
docker_registry_username = ""
docker_registry_password = ""
```

### **Step 3: Deploy (10 min)**

```bash
terraform init
terraform plan
terraform apply

# Save outputs
terraform output -json > outputs.json
```

### **Step 4: Access Directus**

```bash
# Get URL from outputs
DIRECTUS_URL=$(terraform output -raw directus_url)
echo $DIRECTUS_URL
# Example: https://gencolink-prod-eus-directus.azurewebsites.net/admin

# Login:
# Email: admin@gencolink.com
# Password: (your configured password)
```

---

## 📊 **APP SERVICE FREE TIER DETAILS**

### **How it works:**
1. App starts when first request arrives (cold start ~30-60s)
2. Runs for up to 60 minutes per day
3. Automatically stops after 60 min of running time
4. Stops after 20 minutes of inactivity (sleep mode)
5. Resets daily at UTC midnight

### **Running time calculation:**
```
Day 1: 8am-9am (1 hour) → Full quota used
Day 2: Midnight reset → 1 hour quota available
Day 3: 8am-9am (1 hour) → Quota reset

Not calendar hours, but ACTIVE running time
```

### **Example timeline:**
```
8:00 AM - User visits → App starts
8:00-9:00 AM - App runs (60 min quota consumed)
9:00 AM - App automatically stops
9:05 AM - Another user tries → App is stopped (quota exhausted)
Error: 403 Forbidden (quota exceeded)
Next day (midnight UTC) - Quota resets
```

---

## 🔄 **COSMOS DB FREE TIER**

### **Included:**
- ✅ 400 RU/s provisioned throughput
- ✅ 1 GB storage
- ✅ 25 SQL (Core) containers
- ✅ Auto-backups
- ✅ Multi-region reads
- ✅ 99.99% SLA

### **NOT included:**
- ❌ Serverless (need provisioned)
- ❌ Auto-scaling beyond 400 RU/s
- ❌ Multiple write regions

### **If you exceed 400 RU/s:**
```
Error: 429 - Request rate is large
Solution: Upgrade to pay-per-request
Cost then: ~$0.25 per million RUs
```

---

## 📝 **DIRECTUS ON APP SERVICE**

### **What works:**
- ✅ Full Directus API
- ✅ Admin UI (`/admin`)
- ✅ Collections & items
- ✅ Uploads to Blob Storage
- ✅ Database operations

### **What's limited:**
- ❌ 60 min/day running time
- ❌ 1 GB RAM (may be slow with large datasets)
- ❌ No custom domain
- ❌ Cold starts (~30-60s)

### **Performance:**
- Cold start: 30-60 seconds (first request after restart)
- Query speed: OK for small DB (< 100MB)
- Upload speed: OK for small files (< 50MB)

---

## 🎯 **WHEN TO UPGRADE**

### **Upgrade if:**
- You need > 60 min/day
- Traffic > 1,000 requests/day
- Need custom domain
- Need 24/7 availability
- Database > 1 GB

### **Upgrade path:**

**From FREE → Basic B1**
```
App Service: Free ($0) → Basic B1 ($12/month)
Cost increase: +$12/month
Benefits:
- Always-on (no 60 min limit)
- 1 vCPU (not shared)
- Custom domain support
- SLA
```

---

## 📋 **DEPLOYMENT CHECKLIST**

- [ ] Read this entire guide
- [ ] Generate Directus tokens (use `python -c "import secrets; print(secrets.token_urlsafe(32))"`)
- [ ] Fill `terraform.tfvars`
- [ ] Run `terraform init`
- [ ] Run `terraform plan` (verify resources)
- [ ] Run `terraform apply`
- [ ] Save `terraform output -json > outputs.json`
- [ ] Access Directus at URL from outputs
- [ ] Login with admin email + password
- [ ] Test by creating a collection
- [ ] Update Angular frontend to point to Directus URL
- [ ] Deploy Angular to Static Web App

---

## 🔗 **INTEGRATION WITH ANGULAR**

### **Update runtime-config.js**
```javascript
// File: Website/public/runtime-config.js

window.__DIRECTUS_URL__ = 'https://gencolink-prod-eus-directus.azurewebsites.net';
window.__API_TIMEOUT__ = 30000;
```

### **Angular service:**
```typescript
export class SiteContentService {
  private apiUrl = window.__DIRECTUS_URL__ + '/items';

  getSiteContent() {
    return this.http.get(`${this.apiUrl}/site_content`);
  }

  getProducts() {
    return this.http.get(`${this.apiUrl}/products`);
  }
}
```

---

## 🚨 **TROUBLESHOOTING**

### **Problem: "403 Forbidden - Quota Exceeded"**
```
Cause: Used all 60 minutes of running time for the day
Solution: Wait until next day (UTC midnight reset)
OR: Upgrade to Basic B1 tier (always-on)
```

### **Problem: "Cold start too slow (30-60s)"**
```
Cause: App Service waking up from sleep
Expected: Normal for FREE tier
Solution: 
  - Use for dev/testing (OK with delay)
  - Upgrade to Basic B1 (no cold start)
```

### **Problem: "429 - Request Rate is Large"**
```
Cause: Exceeded 400 RU/s on Cosmos DB
Solution:
  - Reduce query complexity
  - Add caching
  - Upgrade to pay-per-request ($$$)
```

### **Problem: "Cannot upload files"**
```
Cause: Blob Storage connection issue
Solution:
  - Check storage account name in app settings
  - Verify storage key is correct
  - Check container exists
```

---

## 💡 **TIPS & TRICKS**

### **Maximize FREE tier:**
1. **Cache content** - Reduce RU usage
2. **Batch queries** - Fewer requests
3. **Index wisely** - Faster queries
4. **Use timeouts** - Kill slow requests
5. **Monitor usage** - Alert on thresholds

### **Debug slow queries:**
```
Check Cosmos DB metrics:
Portal → Cosmos DB → Insights → Requests
Look for slow queries
Optimize indexes
```

### **Keep app alive (during working hours):**
```bash
# Scheduled task to ping app every 19 minutes
# Prevents sleep mode (20 min auto-sleep)
*/19 * * * * curl https://<app>.azurewebsites.net/health
```

---

## 📊 **EXAMPLE USAGE PATTERNS**

### **Pattern 1: Light dev work (15 min/day)**
```
8:00-8:15 AM - Directus admin work (15 min)
Rest of day - App sleeping (quota safe)
Status: ✅ WORKS GREAT
```

### **Pattern 2: Active development (60 min/day)**
```
9:00 AM - Start (cold start 30s)
9:00-10:00 AM - Continuous work (60 min)
10:00 AM - App stops (quota exhausted)
Rest of day - Manual testing only
Status: ✅ ACCEPTABLE
```

### **Pattern 3: Production app (24/7)**
```
Needs: Always-on, high availability
FREE tier: ❌ NOT SUITABLE
Recommendation: Upgrade to Basic B1+ tier
```

---

## 🎉 **SUMMARY**

**You have**:
- ✅ Directus CMS (App Service FREE)
- ✅ Cosmos DB database (FREE)
- ✅ Blob Storage for uploads (~$0.50)
- ✅ Static Web App frontend (FREE)
- ✅ Zero monthly cost (app + database)

**Perfect for**:
- Development/testing
- Learning Azure
- Personal projects
- MVP prototypes

**NOT for**:
- Production apps
- High traffic
- 24/7 availability
- Customer-facing

**To upgrade**: Change App Service from `F1` to `B1` in Terraform (adds $12/month)

---

## 🚀 **READY TO DEPLOY?**

1. Read this guide ✅
2. Prepare `terraform.tfvars`
3. Run `terraform apply`
4. Access Directus
5. Configure content
6. Deploy Angular

**Time to deployment: 20 minutes** ⏱️

**Cost: $0/month** 💰

---

**Next**: Follow deployment steps above! 🎯
