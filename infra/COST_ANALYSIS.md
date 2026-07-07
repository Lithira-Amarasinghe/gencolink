# Cost Analysis: Gencolink Production Architecture

## Executive Summary

**Estimated Monthly Cost**: $55–85 USD  
**Annual Cost**: $660–1,020 USD

This is **production-grade** with auto-scaling, backups, and HA, while remaining cost-optimized for small to medium workloads.

---

## Cost Breakdown by Service

### 1. Azure Static Web App
**Tier**: Free  
**Cost**: **$0**

- Unlimited bandwidth ✅
- Custom domains ✅
- SSL/TLS certificates ✅
- Global CDN ✅
- 1 App included in free tier

**Why free?** Microsoft includes Static Web Apps in the free tier to encourage adoption. Perfect for SPAs like Angular.

---

### 2. Azure Container Apps (Directus)
**Configuration**: 0.5 CPU, 1 GB Memory, 1-3 replicas  
**Pricing**: $0.0000141 per vCPU-second + $0.000003 per GB-second

**Calculation** (assume 1 replica at low load):
- vCPU: 0.5 × 86,400 sec/day × 30 days × $0.0000141 = **$18.14/month**
- Memory: 1 GB × 86,400 sec/day × 30 days × $0.000003 = **$7.78/month**
- **Subtotal: ~$26/month**

**With scaling** (1-3 replicas during peak):
- Average 1.5 replicas: **~$39/month**

**Cost optimization**:
- ✅ Scales to 1 (not zero) to keep app warm
- ✅ Auto-scales based on CPU load
- ✅ Could scale to zero with cold-start penalty

---

### 3. Azure PostgreSQL Flexible Server
**Configuration**: B_Standard_B1ms burstable, 32 GB storage  
**Pricing**: 
- Compute: $0.079 per vCPU-hour (burstable)
- Storage: $0.115 per GB per month
- Backup: Included (7 days)

**Calculation**:
- Compute (0.5–1 vCPU, burstable): 720 hours × $0.079 = **$56.88/month**
- Storage: 32 GB × $0.115 = **$3.68/month**
- **Subtotal: ~$60/month**

**Cost optimization**:
- ✅ Burstable tier (lowest cost, scales automatically)
- ✅ Minimum 32 GB (requirement for Flexible Server)
- ✅ Zone-redundant HA included
- ❌ Could upgrade to Standard tier (+$70/month) for higher throughput

**Note**: This is the single largest cost. Alternatives:
- Basic tier (non-HA): ~$30/month, but no automatic failover
- Azure Database for PostgreSQL Single Server (deprecated): $28/month
- CosmosDB: $25+/month for similar workload

---

### 4. Azure Container Registry (ACR)
**Tier**: Basic SKU  
**Pricing**: 
- Base: $5/month
- Storage: $0.10 per GB per month (first 100 GB)

**Calculation** (storing 1-2 Directus images):
- Base: **$5/month**
- Storage (assume 500 MB × 3 image tags): **~$0.05/month**
- **Subtotal: ~$5/month**

**Cost optimization**:
- ✅ Basic tier (lowest cost)
- ✅ Auto-cleanup old images (optional)
- ❌ Could use Docker Hub (free) but loses integration with Azure

---

### 5. Azure Functions
**Plan**: Consumption (pay-per-execution)  
**Pricing**:
- Execution: $0.20 per 1M executions
- Duration: $0.000016667 per GB-second
- Storage: included

**Calculation** (assume 1000 contact submissions/month):
- Executions: 1,000 × $0.20 / 1,000,000 = **$0.0002/month** (negligible)
- Duration (assume 2 sec × 128 MB avg): 1,000 × 0.25 GB-sec × $0.000016667 = **$0.004/month** (negligible)
- **Subtotal: ~$0.01/month** (first 1M executions free)

**Cost optimization**:
- ✅ Consumption plan (pay per use)
- ✅ First 1M executions free (included)
- ✅ No charges while idle

**Scaling potential**:
- 100,000 emails/month: ~$20/month
- 1,000,000 emails/month: ~$200/month

---

### 6. Azure Key Vault
**Tier**: Standard  
**Pricing**:
- Base: $0.60 per month (for up to 10 secrets)
- Operations: $0.03 per 10k operations

**Calculation**:
- Base (10 secrets): **$0.60/month**
- Operations (assume 10k reads/month from Container App + Functions): **~$0.03/month**
- **Subtotal: ~$0.63/month**

**Cost optimization**:
- ✅ Standard tier (sufficient for small production app)
- ✅ Managed Identity eliminates API call overhead
- ❌ Premium tier: $4/month (for FIPS compliance, soft-delete, purge protection)

---

### 7. Application Insights (Monitoring)
**Tier**: Free (up to 5 GB/month)  
**Cost**: **$0** (if under 5 GB/month)

**Calculation** (typical load):
- Container App logs: ~100 MB/month
- Function logs: ~10 MB/month
- Custom metrics: ~50 MB/month
- **Total: ~160 MB/month** ✅ Well under 5 GB

**If over 5 GB**:
- Excess data: $2.99 per GB/month

---

### 8. Data Transfer (Egress)
**Pricing**: $0.087 per GB (outbound from Azure)

**Calculation** (assume modest traffic):
- Frontend served by CDN (cache hits, minimal egress): ~100 GB/month
- API responses from Directus: ~50 GB/month
- Function responses: ~5 GB/month
- **Total: ~155 GB × $0.087 = ~$13.50/month**

**Cost optimization**:
- ✅ Static Web App CDN reduces egress
- ✅ Content caching in Static Web App (staticwebapp.config.json)
- ❌ At scale (1 TB+): Consider Azure Front Door ($0.21/month base + per-request pricing)

---

### 9. DNS (Optional)
**If using Azure DNS**: $1.25/month per hosted zone  
**If using external DNS** (Route 53, Cloudflare, etc.): $0 (with GitHub-registered domain)

---

## Monthly Cost Summary

| Service | Cost | Notes |
|---------|------|-------|
| Static Web App | $0 | Free tier |
| Container Apps | $26–39 | 1-3 replicas |
| PostgreSQL | $60 | Burstable B1ms |
| Container Registry | $5 | Basic tier |
| Functions | ~$0 | First 1M free |
| Key Vault | $1 | Standard tier |
| App Insights | $0 | Under 5 GB |
| Data Transfer | $14 | 155 GB egress |
| DNS (optional) | $1 | External DNS free |
| **TOTAL** | **$55–85** | **All-in** |

---

## Cost Scaling Scenarios

### Scenario 1: Doubled Traffic
- Container Apps: $39 → $52 (more replicas)
- PostgreSQL: $60 → $75 (more vCPU, storage)
- Data transfer: $14 → $28
- **New Total: ~$100/month**

### Scenario 2: 10x Traffic (viral growth)
- Container Apps: $39 → $150 (many replicas)
- PostgreSQL: $60 → $200 (larger SKU)
- Functions: $0 → $50 (if email spike)
- Data transfer: $14 → $200 (CDN helps but still high)
- **New Total: ~$600/month**

### Scenario 3: Ultra-High Performance (Premium Tier)
- PostgreSQL Standard tier: $60 → $150
- Premium Container Registry: $5 → $200/month
- Premium Key Vault: $1 → $4
- Premium App Insights: $0 → $10
- **Adds: ~$200/month for production hardening**

---

## Cost Optimization Tips

### Before Production
1. **Use Free tier for non-prod**
   - Free tier Static Web App ✅
   - Free tier App Insights (if < 5 GB) ✅
   - Standard tier Key Vault required for prod ✅

2. **Minimize database** (biggest cost driver)
   - Burstable tier B1ms: $60/month ✅
   - Basic tier: $30/month (single zone, slower recovery)
   - Premium tier: $200+/month (unnecessary for most apps)

3. **Use Managed Identity** (eliminates Key Vault API charges)
   - Container Apps + Managed Identity ✅
   - Functions + Managed Identity ✅

### After Production Launch
4. **Monitor actual usage**
   - Container Apps: Scale down if CPU < 20%
   - PostgreSQL: Check actual connections/queries
   - Functions: Tune execution time

5. **Set up cost alerts**
   ```bash
   az monitor metrics alert create \
     --name "Daily budget exceeded" \
     --resource-group gencolink-prod-eus-rg \
     --scopes "/subscriptions/{id}" \
     --condition "total CostAlert > 100"
   ```

6. **Use reserved instances** (if stable workload)
   - PostgreSQL: 1-year reservation = ~$540 (vs. $720 PAYG) = 25% savings
   - Compute: 1-year reservation = ~$650 (vs. $780 PAYG) = 17% savings

### Disaster Recovery
7. **Backup costs** (usually minimal)
   - PostgreSQL: 7-day backup included ✅
   - Static Web App: Redeploy from GitHub ✅
   - Container App: Redeploy from ACR ✅

---

## ROI: When Does This Cost-Optimize?

| Scenario | Cost | Breakeven |
|----------|------|-----------|
| **Simple WordPress on VM** | $10–20/month | $0 (cheaper) |
| **AWS similar stack** | $80–120/month | Higher cost |
| **Heroku + managed DB** | $150–300/month | Faster at scale |
| **This architecture** | $55–85/month | **Optimal for small-medium apps** |

---

## Free Azure Credits

If starting with free trial:
- **$200 free credits** for 30 days
- **No production charges** during trial (but requires payment method)

**Estimated trial burn**:
- First 30 days: ~$85 = $55 from your account
- Keep 2+ months of credits for contingency

---

## Estimated Annual Costs

| Scale | Monthly | Annual | Notes |
|-------|---------|--------|-------|
| **Low** (1-100 submissions/month) | $60 | $720 | Home office SaaS |
| **Medium** (100-1k submissions/month) | $75 | $900 | SMB |
| **High** (1k-10k submissions/month) | $150 | $1,800 | Growing startup |
| **Very High** (10k+/month) | $600+ | $7,200+ | Scale-up (consider enterprise plan) |

---

## Comparing to Alternatives

### AWS Equivalent
- Static site hosting: CloudFront ($0.085/GB) + S3 ($0.023/GB)
- Database: RDS PostgreSQL (t3.micro): $20/month
- Functions: Lambda: ~$0.20/1M + $0.0000166667/GB-sec
- Total: **~$80–100/month** (similar)

### Google Cloud Equivalent
- Cloud Run (Directus): $0.00001167 per vCPU-second = **~$30/month**
- Cloud SQL PostgreSQL: ~$15/month (smaller SKU)
- Cloud Storage: negligible
- Cloud Functions: free (first 2M invocations)
- Total: **~$50–70/month** (slightly cheaper but different pricing model)

### Heroku + Supabase
- Heroku Dyno (Directus): $50/month (smallest paid tier)
- Supabase PostgreSQL: $25/month
- Heroku Functions: not offered (would use AWS Lambda separately)
- Total: **~$100+/month** (more expensive)

---

## Cost Monitoring Dashboard

```bash
# Enable cost analysis in Azure Portal
# Home → Cost Management + Billing → Cost analysis

# Or CLI:
az costmanagement query create \
  --type Usage \
  --timeframe MonthToDate \
  --dataset granularity=Daily aggregation=TotalCost
```

---

## Final Recommendation

**This architecture is optimal if**:
- ✅ Starting a small-to-medium production app
- ✅ Want to keep costs under $100/month
- ✅ Plan to scale without re-architecting
- ✅ Need production-grade security (Key Vault, Managed Identity)

**Consider alternatives if**:
- ❌ Need highest performance (upgrade PostgreSQL to Standard)
- ❌ Have massive static storage needs (add Blob Storage, ~$0.02 per GB)
- ❌ Plan extremely high scale (>1M requests/month): migrate to enterprise tier

---

## Next Steps

1. Create Azure subscription (free trial available)
2. Run `terraform plan` to see actual costs
3. Set up Azure Cost Management alerts
4. Monitor first month of actual spending
5. Optimize based on real usage patterns
