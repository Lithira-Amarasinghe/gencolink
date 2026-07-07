# Gencolink Production Architecture

## Overview

This document describes the production-ready Azure infrastructure for Gencolink—a multi-project system with Angular frontend, Directus headless CMS, and serverless email functions.

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                            INTERNET (HTTPS)                                  │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                    ┌─────────────────┼─────────────────┐
                    │                 │                 │
           ┌────────▼────────┐  ┌──────▼──────┐  ┌─────▼──────┐
           │                 │  │              │  │             │
        ┌──┴──────────────────┴──┴──────────────┴──┴─────────────┐
        │  Azure Static Web App (Frontend - FREE TIER)           │
        │  • Angular 20 SPA                                      │
        │  • Serves gencolink.com                                │
        │  • runtime-config.js (CMS URL injection)               │
        │  • Global CDN caching                                  │
        └────────────┬─────────────────────────────────────────┘
                     │ GET /api/* (CORS)
                     │
        ┌────────────▼─────────────────────────────────────────┐
        │  Azure Container Apps (Directus CMS - SCALE-TO-ZERO)  │
        │  • 0.5 CPU, 1 GB Memory                               │
        │  • Scales: 1-3 replicas based on CPU                  │
        │  • Health checks enabled                              │
        │  • Webhook endpoint: /flows/trigger/:id               │
        └────────────┬─────────────────────────────────────────┘
                     │
        ┌────────────▼─────────────────────────────────────────┐
        │  Azure PostgreSQL Flexible Server (DATABASE)          │
        │  • Burstable SKU: B_Standard_B1ms (LOW COST)           │
        │  • 32 GB storage                                       │
        │  • 7-day automated backups                             │
        │  • Zone redundant (HA)                                 │
        └─────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                         DIRECTUS FLOWS & WEBHOOKS                            │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
              Contact Form Submission │
              (contact_submissions)   │
                                      │
        ┌─────────────────────────────▼─────────────────────────┐
        │  Directus Flow (configured in CMS UI)                 │
        │  Trigger: Collection event on contact_submissions      │
        │  Action: Send HTTP POST to Azure Function webhook     │
        └─────────────────────────────┬─────────────────────────┘
                                      │
        ┌─────────────────────────────▼─────────────────────────┐
        │  Azure Functions (send-contact-email)                 │
        │  • Node.js 20 Consumption Plan (PAY-PER-CALL)         │
        │  • Triggered via Directus webhook                     │
        │  • Reads secrets from Key Vault (Managed Identity)    │
        │  • Calls Azure Communication Email API                │
        └─────────────────────────────┬─────────────────────────┘
                                      │
        ┌─────────────────────────────▼─────────────────────────┐
        │  Azure Communication Email Service                    │
        │  • Sends transactional emails                         │
        │  • SLA: 99.99%                                        │
        └────────────────────────────────────────────────────────┘
```

## Component Details

### 1. Azure Static Web App (Frontend)
**Purpose**: Serve Angular 20 single-page application  
**Tier**: Free (included, NO charges for traffic)  
**What runs here**:
- Built Angular app (production bundle)
- `runtime-config.js` injected with Directus API URL (no rebuild needed)
- SPA routing (all 404s → index.html)
- Global CDN for fast content delivery

**Auto-deploys**: GitHub Actions pushes to `main` → Auto-deploy via GitHub integration

**Cost**: $0 (Free tier)

---

### 2. Azure Container Apps (Directus CMS)
**Purpose**: Host production Directus headless CMS  
**Configuration**:
- 0.5 CPU, 1 GB Memory per replica
- Scales: 1-3 replicas (CPU-based)
- Scales to 1 (not zero) to keep CMS warm
- Health checks every 30s
- Liveness probe: GET `/server/health`

**Database**: PostgreSQL Flexible Server (see below)  
**Environment Variables**: Passed from Key Vault via managed identity

**Auto-deploys**: GitHub Actions builds Docker image → Pushes to ACR → Updates container app

**Cost**: ~$15-25/month (1 replica avg, scales with traffic)

---

### 3. Azure Container Registry (ACR)
**Purpose**: Store Directus Docker images  
**Tier**: Basic SKU  
**Auto-cleanup**: Old images can be auto-purged (optional)

**Cost**: ~$5/month

---

### 4. Azure PostgreSQL Flexible Server (Database)
**Purpose**: Store Directus data (replaces SQLite in prod)  
**Configuration**:
- SKU: `B_Standard_B1ms` (burstable, lowest cost)
- Storage: 32 GB minimum (auto-scales)
- Backup: 7 days automated
- HA: Zone-redundant (automatic failover)
- Firewall: Only Azure services + explicit IPs

**Connection String**:
```
postgresql://pgadmin:PASSWORD@gencolink-prod-eus-pgserver.postgres.database.azure.com:5432/directus
```

**Cost**: ~$30-40/month (burstable tier, low usage)

---

### 5. Azure Functions (Serverless Email)
**Purpose**: Send contact form emails (triggered by Directus webhook)  
**Tier**: Consumption Plan (pay-per-execution)  
**What runs here**:
- Node.js 20 runtime
- Function: `send-contact-email` (HTTP-triggered via Directus Flow)
- Reads secrets from Key Vault (Managed Identity)
- Calls Azure Communication Email API

**Scaling**: Auto-scales to 0 when not in use  
**Cost**: ~$0-2/month (only pay for executions)

---

### 6. Azure Key Vault (Secrets Management)
**Purpose**: Secure centralized secret storage  
**Stores**:
- `db-password` — PostgreSQL admin password
- `directus-admin-password` — Directus admin account
- `directus-admin-token` — Directus static API token
- `directus-jwt-secret` — JWT signing secret
- `email-domain` — Azure Communication Email endpoint

**Access**: Via Managed Identity (no keys in code or GitHub)

**Cost**: ~$0.6/month (10 secrets ÷ $6/month base fee)

---

### 7. Application Insights (Optional Monitoring)
**Purpose**: Monitor app health, performance, errors  
**Collects**:
- Container App logs (Directus)
- Function execution metrics
- Custom events and traces

**Retention**: 30 days (configurable)

**Cost**: ~$2-5/month (free tier if usage < 5GB)

---

## Data Flow

### Request Flow: User visits website
```
User (Browser)
    ↓
Azure CDN (Static Web App)
    ↓
Angular loads index.html
    ↓
runtime-config.js sets window.__DIRECTUS_URL__
    ↓
Angular SiteContentService fetches GET /items/site_content
    ↓
Azure Container Apps (Directus)
    ↓
PostgreSQL database query
    ↓
JSON response → rendered UI
```

### Contact Form Flow: User submits contact form
```
Angular form → POST /contact_submissions
    ↓
Directus collection (contact_submissions)
    ↓
[Directus Flow] → Webhook POST to Azure Function
    ↓
Azure Function (send-contact-email)
    ↓
Reads secrets from Key Vault (Managed Identity)
    ↓
Calls Azure Communication Email API
    ↓
Email delivered to recipient
```

---

## Deployment Pipeline

### GitHub Actions Workflows

| Workflow | Trigger | What Happens |
|----------|---------|--------------|
| **frontend.yml** | Push to `Website/` on main | Build Angular → Deploy to Static Web App |
| **directus.yml** | Push to `Directus/` on main | Build Docker → Push to ACR → Update Container App |
| **functions.yml** | Push to `functions/` on main | Build Node.js → Deploy to Azure Functions |
| **infra.yml** | Push to `infra/terraform/` on main | Plan → Apply Terraform changes |

---

## Security

### Network
- **Frontend**: Public (CDN, no auth needed)
- **Directus**: Public API, authenticated endpoints require token
- **Functions**: Public HTTP endpoint, triggered by Directus (internal webhook)
- **Database**: Private, only accessible from Container Apps subnet
- **No VPN/Bastion needed**: Managed Identity handles auth

### Secrets
- **Zero secrets in code** — All stored in Key Vault
- **Managed Identity**: Functions and Container Apps access Key Vault without keys
- **GitHub Secrets**: Only store IDs/names, not actual secrets
- **Rotation**: Manual (consider automating with Key Vault policies)

### Access Control
- **Static Web App**: Public (no IP restrictions)
- **Directus**: Public API, token-based auth for protected endpoints
- **Functions**: Triggered by Directus Flow only (webhook auth via Key Vault)
- **Database**: Private endpoint recommended for production hardening

---

## Cost Summary (Monthly Estimate)

| Service | Tier | Monthly Cost |
|---------|------|-------------|
| Static Web App | Free | $0 |
| Container Apps | Consumption (1 replica avg) | $20 |
| Container Registry | Basic | $5 |
| PostgreSQL | B1ms burstable | $35 |
| Azure Functions | Consumption | $1 |
| Key Vault | Standard | $1 |
| Application Insights | Free tier (< 5GB) | $0 |
| **TOTAL** | | **~$62/month** |

### Scaling Costs
- **+100k requests/month**: +$3-5
- **+1GB data**: +$0.20-0.50
- **Always-on Container App** (not recommended): +$40-60

---

## Deployment Checklist

- [ ] Terraform `.tfvars` file created with real values
- [ ] Azure subscription & credentials set up
- [ ] GitHub Secrets configured (`AZURE_CLIENT_ID`, `AZURE_TENANT_ID`, etc.)
- [ ] Directus Docker image built and pushed to ACR
- [ ] PostgreSQL database initialized with `directus` database
- [ ] Key Vault secrets stored
- [ ] Directus Flow webhook configured (in Directus UI)
- [ ] Azure Static Web App connected to GitHub repo
- [ ] Custom domain DNS records pointing to Static Web App
- [ ] SSL/TLS certificates auto-renewed (Static Web App + Container Apps)

---

## Monitoring & Alerts

### Key Metrics to Watch
1. **Container App**: CPU > 80% → scales up automatically
2. **PostgreSQL**: Connections > 70 → investigate slow queries
3. **Functions**: Error rate > 1% → check Key Vault access
4. **CDN**: 4xx errors → check frontend build

### Useful Commands
```bash
# Check Container App status
az containerapp show -n gencolink-prod-eus-directus -g gencolink-prod-eus-rg

# View Directus logs
az containerapp logs show -n gencolink-prod-eus-directus -g gencolink-prod-eus-rg

# Check Functions invocations
az functionapp show -n gencolink-prod-eus-funcapp -g gencolink-prod-eus-rg

# View PostgreSQL metrics
az postgres flexible-server show -n gencolink-prod-eus-pgserver -g gencolink-prod-eus-rg
```

---

## Disaster Recovery

### Backups
- **PostgreSQL**: Automated daily backups (7 days retention)
- **Static Web App**: Deployed from GitHub (redeploy on demand)
- **Container App**: Redeploy from ACR image (GitHub Actions)
- **Key Vault**: Premium for better redundancy (optional)

### Recovery Time Objectives (RTO)
- **Frontend**: < 5 min (redeploy via GitHub Actions)
- **CMS**: < 10 min (rebuild container from ACR)
- **Database**: < 30 min (restore from backup)

---

## Next Steps

1. **Initialize Infrastructure**: Run `terraform apply` to create all Azure resources
2. **Configure GitHub Secrets**: Add Azure credentials and resource names
3. **Setup Directus**: Initialize database and create admin account
4. **Deploy Frontend**: Push to `main` → Auto-deploy to Static Web App
5. **Configure Webhooks**: Set up Directus Flow for contact form
6. **Monitor**: Enable Application Insights dashboards
7. **Setup Alerts**: Create alert rules for critical metrics
