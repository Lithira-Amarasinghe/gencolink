# Gencolink Infrastructure as Code

Complete, production-ready Azure infrastructure for Gencolink using Terraform and GitHub Actions.

## 📁 Directory Structure

```
infra/
├── terraform/                  # Terraform infrastructure code
│   ├── modules/
│   │   ├── key-vault/         # Azure Key Vault (secrets management)
│   │   ├── postgres/          # Azure PostgreSQL (database)
│   │   ├── container-registry/# Azure Container Registry (image storage)
│   │   ├── container-apps/    # Azure Container Apps (Directus)
│   │   ├── functions/         # Azure Functions (email)
│   │   └── static-web-app/    # Azure Static Web App (frontend)
│   ├── main.tf                # Main resource definitions
│   ├── variables.tf           # Input variables
│   ├── outputs.tf             # Output values
│   ├── providers.tf           # Provider configuration
│   ├── terraform.tfvars.example  # Template for variables
│   └── terraform.lock.hcl     # (generated) Dependency lock file
├── ARCHITECTURE.md            # System architecture diagram & overview
├── DEPLOYMENT_GUIDE.md        # Step-by-step deployment instructions
├── GITHUB_SECRETS_SETUP.md    # How to configure GitHub Actions secrets
├── COST_ANALYSIS.md           # Detailed cost breakdown & optimization tips
└── README.md                  # This file
```

## 🚀 Quick Start

### 1. Prerequisites
- Azure CLI (`az` command)
- Terraform >= 1.5
- GitHub account with admin access to repository
- Docker (for building Directus image)

### 2. Create Service Principal
```bash
az ad sp create-for-rbac \
  --name "gencolink-github-actions" \
  --role "Contributor" \
  --scopes "/subscriptions/{subscription-id}"
```
Save the output—you'll need it for GitHub Secrets.

### 3. Prepare Terraform Variables
```bash
cd terraform
cp terraform.tfvars.example terraform.tfvars
# Edit terraform.tfvars with your values
```

### 4. Deploy Infrastructure
```bash
terraform init
terraform plan -out=tfplan
terraform apply tfplan
```

### 5. Configure GitHub Secrets
Copy Terraform outputs to GitHub Secrets (see GITHUB_SECRETS_SETUP.md).

### 6. Deploy Applications
- Push to `Website/` → Auto-deploys to Azure Static Web App
- Push to `Directus/` → Auto-builds Docker image and deploys to Container Apps
- Push to `functions/` → Auto-deploys to Azure Functions

## 📊 Architecture Overview

```
┌─────────────────────────────────────────────────────┐
│         Azure Static Web App (FREE)                 │
│         Angular 20 Frontend + runtime-config.js     │
└──────────────┬──────────────────────────────────────┘
               │ GET /api/*
┌──────────────▼──────────────────────────────────────┐
│    Azure Container Apps (Directus CMS)              │
│    0.5 CPU, 1GB RAM, Scales 1-3 replicas           │
└──────────────┬──────────────────────────────────────┘
               │ PostgreSQL queries
┌──────────────▼──────────────────────────────────────┐
│    Azure PostgreSQL Flexible Server                 │
│    B1ms burstable SKU, 32GB storage, Backups       │
└────────────────────────────────────────────────────┘

Contact Form Flow:
Website → Directus → Directus Flow Webhook → Azure Functions
                                              ↓
                                    Azure Communication Email
```

## 💰 Cost Estimate

| Service | Cost/Month |
|---------|-----------|
| Static Web App | $0 (Free) |
| Container Apps | $26–39 |
| PostgreSQL | $60 |
| Container Registry | $5 |
| Functions | ~$0 (first 1M free) |
| Key Vault | $1 |
| Other | ~$14 |
| **TOTAL** | **$55–85** |

See COST_ANALYSIS.md for detailed breakdown and optimization.

## 📖 Documentation

| Document | Purpose |
|----------|---------|
| **ARCHITECTURE.md** | System design, component details, data flow |
| **DEPLOYMENT_GUIDE.md** | Complete step-by-step deployment walkthrough |
| **GITHUB_SECRETS_SETUP.md** | Configure GitHub Actions CI/CD secrets |
| **COST_ANALYSIS.md** | Cost breakdown, scaling scenarios, alternatives |

## 🔐 Security

✅ **What we do**:
- Zero secrets in code
- All secrets stored in Azure Key Vault
- Managed Identity for service-to-service auth (no API keys)
- RBAC role-based access control
- Encrypted TLS for all endpoints
- 7-day automated database backups

❌ **What NOT to do**:
- Don't commit `terraform.tfvars` (contains secrets)
- Don't share `AZURE_CLIENT_SECRET` via email/Slack
- Don't hardcode passwords in code or logs
- Don't disable Key Vault access policies

## 🛠️ Terraform Commands

```bash
cd infra/terraform

# Initialize Terraform (required first time)
terraform init

# Validate configuration
terraform validate

# Format code (runs automatically in CI/CD)
terraform fmt -recursive

# View plan without applying
terraform plan -out=tfplan

# Apply infrastructure changes
terraform apply tfplan

# View current state
terraform state show

# Destroy all resources (caution!)
terraform destroy

# Refresh state from Azure
terraform refresh
```

## 📝 Modifying Infrastructure

### Add a resource
1. Edit `terraform/modules/{module}/main.tf`
2. Update `terraform/variables.tf` if needed
3. Run `terraform plan` to preview
4. Run `terraform apply` to deploy

### Update environment variables
1. Edit `terraform/variables.tf`
2. Update `terraform.tfvars`
3. Run `terraform apply`

### Scale Container App
Edit `terraform/modules/container-apps/main.tf`:
```hcl
min_replicas = 2  # Minimum replicas
max_replicas = 5  # Maximum replicas
```

## 📊 Monitoring

### Azure Portal
- Home → Resource Groups → gencolink-prod-eus-rg
- View all resources, costs, and metrics

### Azure CLI
```bash
# Get Container App status
az containerapp show -n gencolink-prod-eus-directus \
  -g gencolink-prod-eus-rg

# Get Functions metrics
az monitor metrics list \
  --resource /subscriptions/{id}/resourceGroups/gencolink-prod-eus-rg/providers/Microsoft.Web/sites/gencolink-prod-eus-funcapp \
  --metric RequestCount,SuccessCount,ServerErrors

# Get PostgreSQL status
az postgres flexible-server show -n gencolink-prod-eus-pgserver \
  -g gencolink-prod-eus-rg
```

### Application Insights
- Go to Azure Portal → Resource Groups → gencolink-prod-eus-rg → Application Insights
- View logs, metrics, failures, performance

## 🔄 CI/CD Workflows

GitHub Actions automatically deploys when you push to `main`:

| Push to | Workflow | Deploys to |
|---------|----------|-----------|
| `Website/` | frontend.yml | Azure Static Web App |
| `Directus/` | directus.yml | Azure Container Apps |
| `functions/` | functions.yml | Azure Functions |
| `infra/terraform/` | infra.yml | Azure (via Terraform) |

Each workflow:
1. Builds and tests code
2. Deploys to Azure
3. Runs health checks
4. Comments on PR with deployment URL

## 🚨 Troubleshooting

### Terraform apply fails
```bash
# Check Azure login
az login

# Refresh state
terraform refresh

# View detailed error
terraform apply -var-file=terraform.tfvars -parallelism=1 -no-color
```

### Container App won't start
```bash
# Check logs
az containerapp logs show -n gencolink-prod-eus-directus \
  -g gencolink-prod-eus-rg --follow

# Check configuration
az containerapp show -n gencolink-prod-eus-directus \
  -g gencolink-prod-eus-rg | jq '.properties.template'
```

### Functions not triggering
```bash
# Check Key Vault access
az keyvault secret list --vault-name gencolink-prod-eus-kv

# Check Function logs
az functionapp log tail --name gencolink-prod-eus-funcapp \
  -g gencolink-prod-eus-rg
```

### PostgreSQL connection error
```bash
# Test connectivity
psql -h gencolink-prod-eus-pgserver.postgres.database.azure.com \
  -U pgadmin \
  -d directus

# Check firewall rules
az postgres flexible-server firewall-rule list \
  --name gencolink-prod-eus-pgserver \
  --resource-group gencolink-prod-eus-rg
```

See DEPLOYMENT_GUIDE.md for more troubleshooting.

## 🔄 Disaster Recovery

### Restore PostgreSQL from backup
```bash
# List available backups
az postgres flexible-server backup list \
  --name gencolink-prod-eus-pgserver \
  --resource-group gencolink-prod-eus-rg

# Restore to point-in-time
az postgres flexible-server restore \
  --name gencolink-prod-eus-pgserver-restored \
  --resource-group gencolink-prod-eus-rg \
  --source-server gencolink-prod-eus-pgserver \
  --restore-time "2024-01-15T10:00:00Z"
```

### Redeploy frontend
```bash
# Redeploy from GitHub
git push origin main  # GitHub Actions auto-deploys
```

### Redeploy Directus
```bash
# Redeploy Container App with latest image
az containerapp update -n gencolink-prod-eus-directus \
  -g gencolink-prod-eus-rg \
  --image gencolinkprodeus.azurecr.io/directus:latest
```

## 📱 Maintenance Tasks

### Weekly
- Check Azure Cost Management dashboard
- Review Application Insights errors

### Monthly
- Update Terraform modules
- Review and rotate Key Vault secrets
- Check PostgreSQL backup status
- Update Docker base images

### Quarterly
- Test disaster recovery
- Run full security audit
- Review and optimize costs
- Update dependencies

## 🤝 Contributing

1. Create a feature branch: `git checkout -b feature/new-module`
2. Make changes to Terraform files
3. Run `terraform fmt` to format code
4. Run `terraform validate` to check syntax
5. Test with `terraform plan`
6. Submit PR with details
7. After approval, merge to `main`
8. GitHub Actions automatically deploys

## 📞 Support

- **Terraform Registry**: https://registry.terraform.io/
- **Azure Docs**: https://docs.microsoft.com/azure/
- **Directus Docs**: https://docs.directus.io/
- **GitHub Actions**: https://docs.github.com/actions/

## 📜 License

This infrastructure code is part of the Gencolink project. See repository LICENSE for details.

---

**Last Updated**: 2024  
**Terraform Version**: 1.5+  
**Azure Provider Version**: 4.0+
