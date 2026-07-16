# Deployment Guide

The single source of truth for deploying Gencolink. (Older `*_GUIDE.md`,
`*_DELIVERY.md`, `ULTRA_LOW_COST_*`, and `FREE_TIER_*` docs described an
abandoned Container Apps / PostgreSQL / free-tier design and were removed — see
git history if you need them.)

## Architecture

| Layer | What runs it | Notes |
|-------|--------------|-------|
| **Frontend** | Azure Static Web App | Angular site; config injected at deploy time |
| **CMS** | Directus on Azure App Service (Linux, container) | Shares one **B1** App Service Plan |
| **Email function** | Azure Functions (`send-contact-email`) | Same B1 plan; **Managed Identity** auth to ACS (no secret) |
| **Database** | Azure SQL Server (Basic) | Directus backend |
| **Storage** | Azure Storage Account | Directus uploads (blob) |
| **Secrets** | Azure Key Vault | Terraform-generated; nothing hand-typed |
| **Email delivery** | Azure Communication Services | Managed outside Terraform |
| **Terraform state** | Azure Storage (`gencolink-rg-tfstate`/`gencolinktfstate`) | Remote, encrypted at rest; AAD auth, no access key |

Flow: contact form → Directus `contact_submissions` → Directus Flow webhook →
Function → ACS email.

## Network security (tier-dependent, automatic)

The Storage/SQL firewall strategy is derived from `app_service_sku`:

- **B1 and above**: a VNet + delegated subnet is created; Directus and the
  Function App use regional VNet integration, and Storage/SQL firewalls allow
  that **subnet** via service endpoints (`Microsoft.Sql`,
  `Microsoft.Storage.Global`). No IP rules, no dependency on mutable outbound
  IPs, lockdown active from the first apply.
- **F1/D1 (Free/Shared)**: VNet integration isn't supported on these tiers, so
  firewalls fall back to **IP rules** scoped to the App Service's outbound IPs.

Both paths deploy in a **single `terraform apply`** — no read-back data
sources, no multi-phase bootstrap flags.

### Functions hosting is tier-dependent

- **B1+**: the Function App shares Directus's App Service Plan, in the main RG.
- **F1/D1**: Azure forbids Function Apps on Free/Shared plans, so the Function
  App runs on its own **Consumption (Y1) plan in a dedicated resource group**
  (`gencolink-prod-functions-rg`). This is Azure's documented requirement — a
  resource group that hosts a Free/Shared Linux web-app plan cannot also host a
  Linux Consumption plan. Consumption is $0 fixed (1M free executions/month).

  ⚠️ **Extra permission on F1/D1**: creating that resource group requires the
  deploying identity to have rights at the **subscription** scope (e.g.
  Contributor on the subscription), not just Contributor on the `gencolink` RG.
  If your identity is scoped only to the RG, either widen it or switch to B1.

## Prerequisites (one-time)

1. **Azure**: an existing resource group named `gencolink`; `az login`; correct
   subscription selected. Terraform *reads* the RG, it does not create it.
2. **Terraform state backend**: a one-time bootstrap, deliberately done via
   Azure CLI rather than Terraform (state storage can't depend on itself):
   ```bash
   az group create -n gencolink-rg-tfstate -l eastus2
   az storage account create -n gencolinktfstate -g gencolink-rg-tfstate \
     --sku Standard_LRS --https-only true --allow-blob-public-access false
   az storage account blob-service-properties update \
     --account-name gencolinktfstate -g gencolink-rg-tfstate \
     --enable-versioning true --enable-delete-retention true --delete-retention-days 7
   az role assignment create --assignee "$(az ad signed-in-user show --query id -o tsv)" \
     --role "Storage Blob Data Contributor" \
     --scope "$(az storage account show -n gencolinktfstate -g gencolink-rg-tfstate --query id -o tsv)"
   az storage container create --name tfstate --account-name gencolinktfstate --auth-mode login
   ```
   Already done for this project. Costs a few cents/month.
3. **OIDC for GitHub Actions**: an App Registration + federated credential with
   Contributor on the RG. See [AZURE_OIDC_SETUP.md](../AZURE_OIDC_SETUP.md).
   Add these three as **GitHub repo secrets manually** (Terraform creates all
   the others): `AZURE_CLIENT_ID`, `AZURE_TENANT_ID`, `AZURE_SUBSCRIPTION_ID`.
4. **GitHub PAT** for Terraform's `github` provider (fine-grained, this repo,
   Actions read/write) - a token you generate yourself, distinct from GitHub
   Actions' own auto-issued `secrets.GITHUB_TOKEN` used inside workflows.
   Export it as `GITHUB_TOKEN` in the shell you run `terraform apply` from
   (the provider reads it automatically); don't put it in `terraform.tfvars`.
5. **Azure Communication Services**: the ACS resource + a verified email domain
   (DNS records). ACS is *not* managed by Terraform — it must exist first, and
   its endpoint/resource-name go in `terraform.tfvars`.
6. **`terraform.tfvars`**: `cp terraform.tfvars.example terraform.tfvars` and
   fill it in. All real secrets are either Terraform-generated or supplied via
   env vars; the file itself is gitignored.

## Deploy the infrastructure (manual, local)

```bash
cd infra/terraform
terraform init
terraform plan     # review
terraform apply
```

`apply` provisions everything above and auto-pushes the resource
names/URLs/tokens it generates into GitHub Actions secrets. It does **not** run
`Directus/setup.js` — that now runs in CI (see below), after the Directus
container is deployed and healthy.

There is no CI job that runs Terraform — you always run `apply` yourself.

**One-time OIDC grant for the bootstrap job:** the `directus-appservice.yml`
bootstrap job reads the Directus admin token from Key Vault, which needs a
data-plane role (Contributor is control-plane only and won't work on an
RBAC-authorized vault). Grant the GitHub Actions OIDC service principal
**"Key Vault Secrets User"** on the vault — done manually in the Azure Portal
(Key Vault → Access control (IAM) → Add role assignment), not by Terraform.

## Deploy the application code (automatic)

Push to `master`. Three path-filtered workflows deploy independently:

| Workflow | Fires on changes to |
|----------|---------------------|
| `frontend.yml` | `Website/**` |
| `directus-appservice.yml` | `Directus/**` |
| `functions.yml` | `functions/**` |

All three authenticate to Azure with OIDC (no stored publish profiles/keys).

## Secrets model

- **Azure**: generated by Terraform (`random_password`) → Key Vault → consumed
  by the apps. Retrieve one with e.g. `terraform output -raw directus_admin_password`.
- **GitHub Actions**: mostly auto-synced by Terraform; only the 3 OIDC ones are
  manual (step 2 above).
- **Local dev**: `Directus/.env`, `functions/local.settings.json`,
  `infra/terraform/terraform.tfvars` — all gitignored, independent of Azure.

## What is still manual

- `terraform apply` itself.
- The one-time OIDC setup + 3 GitHub secrets, ACS resource + domain
  verification, and filling `terraform.tfvars`.
- Custom-domain DNS, if you point a domain at the Static Web App / App Service.
