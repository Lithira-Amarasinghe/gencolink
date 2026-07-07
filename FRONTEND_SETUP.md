# Frontend (Angular + Static Web App) Setup Guide

## Architecture Overview
```
Browser → CDN → Azure Static Web App → Angular App → Directus API
                                    ↓
                            Azure Communication Services
```

## Resources & Costs

| Resource | Tier | Cost | Purpose |
|----------|------|------|---------|
| Static Web App | Free | $0/month | Hosts Angular app + 1 free Function |
| CDN | Included | $0 | Global content delivery |
| Functions | Consumption | ~$0 (free tier) | Email, webhooks |
| **Total** | | **$0** | |

---

## Pre-Deployment Setup (Manual Steps)

### 1. Create Service Principal for CI/CD
```bash
az ad sp create-for-rbac \
  --name "github-actions-gencolink" \
  --role "Contributor" \
  --scopes /subscriptions/{SUBSCRIPTION_ID}/resourceGroups/gencolink

# Save these as GitHub secrets:
# - AZURE_CLIENT_ID
# - AZURE_CLIENT_SECRET
# - AZURE_SUBSCRIPTION_ID
# - AZURE_TENANT_ID
```

### 2. Deploy Terraform
```bash
cd infra/terraform
terraform init
terraform plan -var-file=prod.tfvars
terraform apply -var-file=prod.tfvars
```

**Save outputs:**
```bash
terraform output -json > outputs.json
# Extract: AZURE_SWA_NAME, DIRECTUS_API_URL
```

### 3. Get Static Web App Deployment Token
```bash
az staticwebapp secrets list \
  --name gencolink-prod-eus-swa \
  --resource-group gencolink

# Copy the 'apiKey' value → GitHub Secret: AZURE_SWA_DEPLOYMENT_TOKEN
```

### 4. Set GitHub Secrets
Go to: GitHub Repo → Settings → Secrets and Variables → Actions

| Secret | Value | Source |
|--------|-------|--------|
| `AZURE_CLIENT_ID` | From service principal | `az ad sp` output |
| `AZURE_CLIENT_SECRET` | From service principal | `az ad sp` output |
| `AZURE_SUBSCRIPTION_ID` | Your subscription ID | Azure portal |
| `AZURE_TENANT_ID` | Your tenant ID | Azure portal |
| `AZURE_RESOURCE_GROUP` | `gencolink` | Fixed |
| `AZURE_SWA_DEPLOYMENT_TOKEN` | From `az staticwebapp secrets list` | Step 3 above |
| `DIRECTUS_API_URL` | From Terraform output | Terraform outputs |

---

## Application Structure

### Files Changed/Created

```
Website/
├── public/
│   └── runtime-config.js          ✅ Updated - runtime Directus URL
├── staticwebapp.config.json        ✅ Created - routing & CORS
├── src/
│   ├── app/services/
│   │   ├── site-content.service.ts (reads window.__DIRECTUS_URL__)
│   │   └── contact.service.ts      (POSTs to /api/submit-contact-form)
│   └── ...
├── angular.json
└── package.json

.github/workflows/
└── frontend.yml                    ✅ Updated - build & deploy pipeline
```

---

## How Frontend Connects to Services

### 1. Frontend → Directus (CMS Data)
**Flow:**
1. Browser loads `index.html`
2. Loads `runtime-config.js` → Sets `window.__DIRECTUS_URL__`
3. Angular app starts
4. `SiteContentService` reads `window.__DIRECTUS_URL__`
5. Makes HTTP GET to Directus API
6. Renders content in Angular components

**Service Code:**
```typescript
// src/app/services/site-content.service.ts
export class SiteContentService {
  constructor(private http: HttpClient) {}
  
  getContent() {
    const directusUrl = (window as any).__DIRECTUS_URL__;
    return this.http.get(`${directusUrl}/items/site_content`);
  }
}
```

### 2. Frontend → Azure Function (Contact Form)
**Flow:**
1. User submits contact form
2. `ContactService` POSTs to `/api/submit-contact-form`
3. Static Web App routes to Azure Function (included in Free tier)
4. Function processes and triggers email
5. Returns response to frontend

**Service Code:**
```typescript
// src/app/services/contact.service.ts
submitContact(form: any) {
  return this.http.post(`/api/submit-contact-form`, form);
  // Static Web App handles routing to Function
}
```

---

## Security Configuration

### CORS (Cross-Origin Resource Sharing)

**Static Web App** (`staticwebapp.config.json`):
```json
{
  "routes": [
    {
      "route": "/api/*",
      "allowedRoles": ["anonymous"]
    }
  ]
}
```

**Directus** (Container App `.env`):
```env
CORS_ENABLED=true
CORS_ORIGIN=https://gencolink-prod-eus-swa.azurestaticapps.net
```

### HTTPS/TLS
- ✅ Static Web App: Auto-managed SSL certificate
- ✅ Directus: Container Apps provides HTTPS
- ✅ All traffic encrypted in transit

### Environment Variables
- ✅ Secrets NOT in code
- ✅ `runtime-config.js` injected via CI/CD
- ✅ Database credentials in Key Vault (Directus)

---

## CI/CD Deployment Flow

### Pipeline: `.github/workflows/frontend.yml`

**Trigger:** Push to `main` → Changes in `Website/` folder

**Steps:**
1. ✅ Build: `npm run build`
2. ✅ Inject: `runtime-config.js` with Directus URL
3. ✅ Upload: Build artifacts
4. ✅ Deploy: To Static Web App via `azure/static-web-apps-deploy@v1`
5. ✅ Verify: Deployment is accessible

**Deployment takes:** ~2-3 minutes

---

## Testing & Verification

### Local Testing
```bash
cd Website
npm install
npm start  # Serves on http://localhost:4200

# runtime-config.js uses localhost:8055 (local Directus)
```

### Production Testing
After deployment:
```bash
# Get SWA URL
FRONTEND_URL=$(az staticwebapp show -n gencolink-prod-eus-swa -g gencolink --query defaultHostname -o tsv)
echo "https://$FRONTEND_URL"

# Test deployment
curl -I https://$FRONTEND_URL/
curl https://$FRONTEND_URL/api/submit-contact-form -X POST -d '{}' -H 'Content-Type: application/json'
```

### Monitoring
- **Application Insights:** Optional, set via Terraform `enable_app_insights = true`
- **Azure Portal:** Static Web App → Deployments tab
- **GitHub Actions:** Logs in Actions tab

---

## Cost Optimization

### Current Setup: **$0/month**
- Static Web App (Free): $0
- 1 included Function: $0
- CDN: $0
- Total bandwidth free tier: 100GB

### Cost limits before upgrade needed:
- **100k visitors** → Still Free
- **Bandwidth >100GB** → Pay per GB ($0.20/GB)
- **Functions >1M executions** → Pay per execution ($0.20/M)

---

## Troubleshooting

### Issue: "Cannot find Directus API"
**Solution:** Check `runtime-config.js`
```javascript
// Should have your production Directus URL
window.__DIRECTUS_URL__ = 'https://gencolink-prod-eus-directus.azurewebsites.net';
```

### Issue: CORS errors in browser console
**Solution:** 
1. Verify Directus CORS origin matches Frontend URL
2. Check `staticwebapp.config.json` has CORS rules
3. Inspect browser DevTools → Network tab

### Issue: CI/CD deployment fails
**Solution:**
1. Verify GitHub secrets are set correctly
2. Check `AZURE_SWA_DEPLOYMENT_TOKEN` is valid
3. Ensure resource group exists: `az group show -n gencolink`

---

## Next Steps

After Frontend is deployed:
1. ✅ Deploy Directus (Container App)
2. ✅ Deploy Azure Functions (Email)
3. ✅ Configure Directus webhooks
4. ✅ Test end-to-end flow

---

## Files Summary

| File | Status | Purpose |
|------|--------|---------|
| `Website/staticwebapp.config.json` | ✅ Created | Routing, CORS, headers |
| `Website/public/runtime-config.js` | ✅ Updated | Runtime Directus URL |
| `.github/workflows/frontend.yml` | ✅ Updated | Build & deploy pipeline |
| `infra/terraform/modules/static-web-app/` | ✅ Ready | Terraform module |

---

**Status:** Frontend ready for deployment ✅
