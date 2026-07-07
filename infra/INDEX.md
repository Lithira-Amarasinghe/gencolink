# Infrastructure & Deployment Index

Complete production-ready Azure infrastructure for Gencolink. Start here.

---

## 🎯 For Different Roles

### 👨‍💼 **Decision Makers / CTO**
1. **Cost**: [COST_ANALYSIS.md](./COST_ANALYSIS.md) — $55–85/month breakdown
2. **Architecture**: [ARCHITECTURE.md](./ARCHITECTURE.md) — System design, components
3. **ROI**: [INFRASTRUCTURE_DELIVERY.md](../INFRASTRUCTURE_DELIVERY.md) — What you get

### 🚀 **DevOps Engineers / SREs**
1. **Quick Deploy**: [QUICKSTART.md](./QUICKSTART.md) — 30-minute setup
2. **Deep Dive**: [DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md) — Step-by-step
3. **Reference**: [README.md](./README.md) — Commands & troubleshooting

### 👨‍💻 **Developers**
1. **Getting Started**: [QUICKSTART.md](./QUICKSTART.md) — Setup instructions
2. **Local Dev**: See Docker Compose setup in `Directus/docker-compose.prod.yml`
3. **CI/CD**: [GITHUB_SECRETS_SETUP.md](./GITHUB_SECRETS_SETUP.md) — How deployments work

### 🔐 **Security / Compliance**
1. **Security Model**: [ARCHITECTURE.md](./ARCHITECTURE.md#security) — Auth, secrets, network
2. **Cost Controls**: [COST_ANALYSIS.md](./COST_ANALYSIS.md) — Budgets & alerts
3. **Terraform**: `terraform/` — Infrastructure as code (auditable)

---

## 📚 Documentation Files

| File | Purpose | Read Time | Audience |
|------|---------|-----------|----------|
| **[QUICKSTART.md](./QUICKSTART.md)** | 30-min setup guide | 10 min | Everyone (start here) |
| **[ARCHITECTURE.md](./ARCHITECTURE.md)** | System design & overview | 15 min | Tech leads, DevOps |
| **[DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md)** | Detailed instructions | 30 min | DevOps engineers |
| **[COST_ANALYSIS.md](./COST_ANALYSIS.md)** | Budget & optimization | 15 min | Finance, CTOs |
| **[GITHUB_SECRETS_SETUP.md](./GITHUB_SECRETS_SETUP.md)** | CI/CD configuration | 10 min | DevOps, developers |
| **[README.md](./README.md)** | Infrastructure reference | 5 min | Daily reference |

---

## 🗂️ File Structure

```
gencolink/
├── infra/                          # This directory
│   ├── terraform/                  # Infrastructure as Code
│   │   ├── modules/
│   │   │   ├── key-vault/         # Secrets management
│   │   │   ├── postgres/          # Database
│   │   │   ├── container-registry/# Image storage
│   │   │   ├── container-apps/    # CMS hosting
│   │   │   ├── functions/         # Serverless email
│   │   │   └── static-web-app/    # Frontend hosting
│   │   ├── main.tf                # Resource orchestration
│   │   ├── variables.tf           # Configuration (40+ params)
│   │   ├── outputs.tf             # Deployment outputs
│   │   ├── providers.tf           # Azure provider
│   │   └── terraform.tfvars.example  # Template
│   │
│   ├── QUICKSTART.md              # ⭐ Start here
│   ├── ARCHITECTURE.md            # System design
│   ├── DEPLOYMENT_GUIDE.md        # Step-by-step
│   ├── COST_ANALYSIS.md           # Budget
│   ├── GITHUB_SECRETS_SETUP.md    # Secrets config
│   ├── README.md                  # Reference
│   └── INDEX.md                   # This file
│
├── Directus/
│   ├── Dockerfile                 # Production image
│   ├── docker-compose.prod.yml    # Local + PostgreSQL
│   └── [existing Directus files]
│
├── Website/
│   ├── package.json
│   ├── angular.json
│   ├── public/
│   │   ├── runtime-config.js      # ⭐ CMS URL injection (NO rebuild needed)
│   │   └── staticwebapp.config.json
│   └── [existing Angular files]
│
├── functions/
│   ├── send-contact-email/        # Azure Function
│   ├── package.json
│   └── [existing function files]
│
├── .github/workflows/
│   ├── infra.yml                  # Terraform CI/CD
│   ├── frontend.yml               # Angular deployment
│   ├── directus.yml               # Container deployment
│   └── functions.yml              # Functions deployment
│
└── INFRASTRUCTURE_DELIVERY.md      # Delivery summary
```

---

## ⚡ 5-Minute Overview

### What This Provides

**Production-ready Azure infrastructure** for your multi-project Gencolink app:

```
🌐 Frontend (Angular 20)
   → Azure Static Web App (FREE tier)
   → Global CDN, auto-scaling

📊 CMS (Directus)
   → Azure Container Apps (scales 1-3)
   → PostgreSQL database with HA

📧 Email (Azure Functions)
   → Consumption plan (pay-per-call)
   → Triggered by Directus webhook

🔐 All secured with Key Vault + Managed Identity
```

### Why This Architecture

✅ **Cost-optimized** ($55–85/month)
✅ **Production-grade** (HA, backups, monitoring)
✅ **Fully automated** (GitHub Actions CI/CD)
✅ **Secure** (zero secrets in code)
✅ **Scalable** (auto-scale up/down)
✅ **Simple** (no Kubernetes, no VMs)

### How to Deploy

1. **Read**: `QUICKSTART.md` (10 min)
2. **Configure**: `terraform.tfvars` (5 min)
3. **Deploy**: `terraform apply` (15 min)
4. **Push**: Code to GitHub (auto-deploys)

**Total**: ~30 min to production

---

## 🔍 What You Get

### Infrastructure (Terraform)
- ✅ 6 reusable modules (800+ lines)
- ✅ 40+ input variables (fully documented)
- ✅ Outputs for CI/CD automation
- ✅ Production-grade resource configuration

### Deployment (GitHub Actions)
- ✅ 4 automated workflows
- ✅ Build → Test → Deploy pipelines
- ✅ PR deployment previews
- ✅ Secret management via Key Vault
- ✅ Health checks post-deployment

### Documentation
- ✅ 6 comprehensive guides
- ✅ Step-by-step deployment
- ✅ Cost analysis & optimization
- ✅ Troubleshooting & support
- ✅ Security best practices

### Docker
- ✅ Production Directus image
- ✅ PostgreSQL + Directus Compose file
- ✅ Health checks configured
- ✅ Ready for Container Apps

---

## 🚀 Quick Commands

```bash
# Get started
cd infra/terraform
cp terraform.tfvars.example terraform.tfvars
# Edit terraform.tfvars with your values

# Deploy infrastructure
terraform init
terraform plan -out=tfplan
terraform apply tfplan

# View deployment info
terraform output -json

# Deploy applications (via GitHub)
git add Website/ && git commit -m "Deploy: Frontend"
git push origin main  # Auto-deploys

git add Directus/ && git commit -m "Deploy: Directus"
git push origin main  # Auto-builds & deploys

git add functions/ && git commit -m "Deploy: Functions"
git push origin main  # Auto-deploys
```

---

## 📊 Architecture at a Glance

```
┌─────────────────────────────────────────────────────────────────┐
│                    INTERNET (HTTPS)                             │
└─────────────────┬───────────────────────────────────────────────┘
                  │
        ┌─────────▼──────────────┐
        │ Azure Static Web App   │  ← Frontend (Angular 20)
        │ (Free tier, global CDN)│     Zero cost, unlimited scale
        └────────────┬───────────┘
                     │ API calls
        ┌────────────▼──────────────────┐
        │ Azure Container Apps          │  ← CMS (Directus)
        │ (0.5 CPU, 1GB, 1-3 replicas) │     $26-39/month, scales auto
        └────────────┬──────────────────┘
                     │
        ┌────────────▼────────────────────┐
        │ Azure PostgreSQL Flexible Server │  ← Database
        │ (B1ms burstable, 32GB, HA)     │     $60/month, backups
        └────────────────────────────────┘

Contact Form Flow:
Angular → Directus → Webhook → Azure Functions → Email
                                (Free for 1M calls)
```

---

## ✅ Deployment Checklist

- [ ] Read QUICKSTART.md
- [ ] Create Azure service principal
- [ ] Add GitHub Secrets (9 total)
- [ ] Fill in terraform.tfvars
- [ ] Run terraform apply
- [ ] Deploy via GitHub push
- [ ] Verify all endpoints working
- [ ] Set up cost alerts
- [ ] Configure custom domain (optional)

---

## 💰 Cost Summary

| Item | Monthly |
|------|---------|
| Frontend (Static Web App) | $0 |
| CMS (Container Apps) | $26–39 |
| Database (PostgreSQL) | $60 |
| Registry (ACR) | $5 |
| Functions | ~$0 |
| Secrets (Key Vault) | $1 |
| Networking | ~$14 |
| **Total** | **$55–85** |

More in [COST_ANALYSIS.md](./COST_ANALYSIS.md)

---

## 🆘 Need Help?

### Common Questions
- **How do I deploy?** → Read [QUICKSTART.md](./QUICKSTART.md)
- **What does this cost?** → Read [COST_ANALYSIS.md](./COST_ANALYSIS.md)
- **How does it work?** → Read [ARCHITECTURE.md](./ARCHITECTURE.md)
- **I'm stuck on step X** → Read [DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md)
- **GitHub Actions failing?** → Read [GITHUB_SECRETS_SETUP.md](./GITHUB_SECRETS_SETUP.md)

### Support Resources
- Terraform: https://registry.terraform.io/
- Azure: https://docs.microsoft.com/azure/
- Directus: https://docs.directus.io/
- GitHub Actions: https://docs.github.com/actions/

---

## 📈 Next Steps (After Deploy)

1. **Configure DNS**: Point custom domain to Static Web App
2. **Setup Email**: Configure Azure Communication Email
3. **Add Monitoring**: Set up Application Insights dashboards
4. **Configure Webhooks**: Set up Directus Flow for contact form
5. **Set Alerts**: Cost alerts, error alerts, performance thresholds
6. **Security**: Enable Key Vault soft-delete, backup vaults

---

## 🎯 Philosophy

This infrastructure embodies:
- **Cost-first**: Every choice minimizes spend
- **Security-first**: Secrets in vault, zero trust networking
- **Simplicity-first**: Managed services, no Kubernetes
- **Scale-first**: Auto-scaling built-in everywhere
- **Documentation-first**: 7 guides, fully explained

---

## 📜 Version Info

- **Terraform**: v1.5+
- **Azure Provider**: v4.0+
- **Node.js**: v20+
- **Docker**: Latest
- **Date Created**: [Current Date]

---

## ✨ Ready to Deploy?

👉 **Start with [QUICKSTART.md](./QUICKSTART.md)**

Takes 30 minutes to go from zero to production.

---

**Questions?** See the documentation. Everything is explained. 🚀
