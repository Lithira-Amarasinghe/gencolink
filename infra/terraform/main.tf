locals {
  # Clean naming: NO location in resource names (location-independent design)
  app_name = "${var.project_name}-${var.environment}"

  # True for every tier except Free/Shared (F1, D1). Gates two things those
  # tiers don't support: regional VNet integration and always-on.
  plan_supports_vnet = !contains(["F1", "D1"], upper(var.app_service_sku))

  # Networking strategy is derived from the App Service Plan tier:
  #   - Basic (B1) and above: VNet integration + service endpoints.
  #     Storage/SQL firewalls allow the integration SUBNET, not IPs - no
  #     dependency on the App Service's mutable outbound IPs.
  #   - Free/Shared (F1, D1): regional VNet integration is NOT supported, so
  #     fall back to IP-based firewall rules scoped to the App Service's
  #     outbound IPs (weaker: those IPs can change on scale/SKU events).
  use_vnet = var.enable_app_service && local.plan_supports_vnet

  # Resolve service-specific locations (with fallbacks to primary)
  directus_location = coalesce(var.directus_location, var.primary_location)
  frontend_location = coalesce(var.frontend_location, var.primary_location)
  storage_location  = coalesce(var.storage_location, var.primary_location)
  sql_location      = coalesce(var.sql_location, var.primary_location)
  keyvault_location = coalesce(var.keyvault_location, var.primary_location)

  # Enterprise tagging strategy
  common_tags = merge(
    var.tags,
    {
      ManagedBy   = "Terraform"
      Environment = var.environment
      Project     = var.project_name
    }
  )

  # Service-specific tags (include location for visibility)
  directus_tags = merge(
    local.common_tags,
    {
      Service  = "CMS-Directus"
      Location = local.directus_location
      Tier     = "Critical"
    }
  )

  storage_tags = merge(
    local.common_tags,
    {
      Service  = "Storage"
      Location = local.storage_location
      Tier     = "Standard"
    }
  )

  sql_tags = merge(
    local.common_tags,
    {
      Service  = "Database-SQL"
      Location = local.sql_location
      Tier     = "Critical"
    }
  )

  keyvault_tags = merge(
    local.common_tags,
    {
      Service  = "Secrets"
      Location = local.keyvault_location
      Tier     = "Critical"
    }
  )

  frontend_tags = merge(
    local.common_tags,
    {
      Service  = "Frontend-Angular"
      Location = local.frontend_location
      Tier     = "Standard"
    }
  )

  functions_tags = merge(
    local.common_tags,
    {
      Service  = "Functions"
      Location = coalesce(var.app_service_location, var.primary_location)
      Tier     = "Standard"
    }
  )
}

data "azurerm_resource_group" "main" {
  name = var.resource_group_name
}

# ============================================================
# GENERATED SECRETS (single source of truth -> Key Vault + GitHub)
# ============================================================
resource "random_password" "directus_admin_password" {
  length  = 24
  special = true
}

resource "random_password" "directus_jwt_secret" {
  length  = 32
  special = false
}

resource "random_password" "directus_admin_token" {
  length  = 32
  special = false
}

resource "random_password" "directus_secret" {
  length  = 32
  special = false
}

# ============================================================
# NETWORKING: VNet + App Service integration subnet (B1+ tiers only)
# Storage/SQL firewalls allow this SUBNET via service endpoints instead of
# the App Service's mutable outbound IPs. Free (no Private Endpoint cost),
# and it removes the two-phase bootstrap: the subnet exists before both the
# App Service and the firewall rules, so Terraform's graph is naturally
# ordered. Skipped entirely on F1/D1, which don't support VNet integration.
# ============================================================
resource "azurerm_virtual_network" "main" {
  count               = local.use_vnet ? 1 : 0
  name                = "${local.app_name}-vnet"
  location            = coalesce(var.app_service_location, var.primary_location) # must match the App Service Plan's region
  resource_group_name = data.azurerm_resource_group.main.name
  address_space       = ["10.10.0.0/16"]
  tags                = local.common_tags
}

resource "azurerm_subnet" "app_integration" {
  count                = local.use_vnet ? 1 : 0
  name                 = "app-integration"
  resource_group_name  = data.azurerm_resource_group.main.name
  virtual_network_name = azurerm_virtual_network.main[0].name
  address_prefixes     = ["10.10.1.0/24"]

  # Microsoft.Sql: SQL Server is in the same region as this subnet.
  # Microsoft.Storage.Global: the Storage Account may be in a DIFFERENT
  # region (eastus2 vs westus2) - the plain Microsoft.Storage endpoint only
  # matches same-region accounts; Global covers cross-region.
  service_endpoints = ["Microsoft.Sql", "Microsoft.Storage.Global"]

  # Required for App Service regional VNet integration; one delegated subnet
  # serves every app on the same App Service Plan (Directus + Functions).
  delegation {
    name = "appservice-integration"
    service_delegation {
      name    = "Microsoft.Web/serverFarms"
      actions = ["Microsoft.Network/virtualNetworks/subnets/action"]
    }
  }
}

# ============================================================
# STORAGE ACCOUNT: Directus uploads (blob) + SQLite database file (Azure Files)
# Clean naming: location-independent
# ============================================================
resource "azurerm_storage_account" "content" {
  # Clean name: gencolink-prod-storage (location in tags, not name)
  name                       = replace("${local.app_name}-storage", "-", "")
  location                   = local.storage_location
  resource_group_name        = data.azurerm_resource_group.main.name
  account_tier               = "Standard"
  account_replication_type   = "LRS"
  https_traffic_only_enabled = true
  min_tls_version            = "TLS1_2"
  tags                       = local.storage_tags

  # Network lockdown - managed inline so Terraform always owns default_action
  # (it flips this value automatically between tiers; nothing manual):
  #   B1+ (use_vnet): Deny by default, allow ONLY the App Service integration
  #     subnet via its Microsoft.Storage service endpoint. The subnet is
  #     created independently of the App Service, so there is no cycle.
  #   F1/D1: Allow (public network access). Storage has no "allow all Azure
  #     IPs" sentinel like SQL, and a precise IP list is impossible in one
  #     apply (the App Service's outbound IPs are unknown until after apply).
  #     Data is still gated by the account key (Key Vault + RBAC), never
  #     anonymous - the accepted trade-off for the free/dev-test tier.
  # (This was briefly a standalone azurerm_storage_account_network_rules
  # resource to break a cycle when IP rules referenced the App Service's
  # outbound IPs. Those IP rules are gone, so the cycle is gone, and inline
  # is both simpler and always-managed - no drift, no manual reset.)
  # KNOWN GAP: the Functions app (Flex Consumption) has no VNet integration
  # here, so if use_vnet ever becomes true (Directus on B1+) while Functions
  # still needs this account, it will be locked out by Deny + subnet-only.
  # Not an issue today (Directus is F1, use_vnet=false, default_action=Allow).
  # Revisit only if Directus moves to B1+.
  network_rules {
    default_action             = local.use_vnet ? "Deny" : "Allow"
    bypass                     = ["AzureServices"]
    virtual_network_subnet_ids = local.use_vnet ? [azurerm_subnet.app_integration[0].id] : []
  }
}

resource "azurerm_storage_container" "directus_uploads" {
  name               = "directus-uploads"
  storage_account_id = azurerm_storage_account.content.id
  # private (not "blob"): the website doesn't reference this container at
  # all (confirmed - no code references blob URLs), and Directus serves
  # files through its own /assets endpoint using its Managed Identity RBAC
  # grant, which works independent of this public-access flag.
  container_access_type = "private"
}

# ============================================================
# AZURE SQL SERVER: Production database
# Clean naming: location-independent
# ============================================================
resource "random_password" "sql_admin_password" {
  length  = 16
  special = true
}

module "database" {
  source = "./modules/database"

  resource_group_name = data.azurerm_resource_group.main.name
  location            = local.sql_location
  project_name        = var.project_name
  environment         = var.environment
  admin_username      = var.sql_admin_username
  admin_password      = coalesce(var.sql_admin_password != "" ? var.sql_admin_password : null, random_password.sql_admin_password.result)
  database_name       = var.sql_database_name
  # Firewall scoping (both free - no VNet/Private Endpoint cost):
  #   B1+ (use_vnet): allow the App Service integration subnet via its
  #   Microsoft.Sql service endpoint - precise, no IPs involved.
  #   F1/D1: the broad "AllowAzureServices" rule. A precise, IP-scoped rule
  #   is NOT possible here in a single apply - the App Service's outbound
  #   IPs are assigned by Azure at creation and stay unknown until after
  #   apply, so a for_each keyed on them fails at plan time. Accepted
  #   trade-off for the free/dev-test tier (see module for detail).
  allowed_subnet_ids   = local.use_vnet ? [azurerm_subnet.app_integration[0].id] : []
  allow_azure_services = !local.use_vnet && var.enable_app_service
  tags                 = local.sql_tags
}

# ============================================================
# KEY VAULT (single source of truth for secrets)
# ============================================================
module "key_vault" {
  source = "./modules/key-vault"

  resource_group_name = data.azurerm_resource_group.main.name
  location            = local.keyvault_location
  project_name        = var.project_name
  environment         = var.environment
  location_short      = "" # Deprecated: location-independent naming
  tags                = local.keyvault_tags
}

resource "azurerm_key_vault_secret" "directus_admin_email" {
  name         = "directus-admin-email"
  value        = var.directus_admin_email
  key_vault_id = module.key_vault.vault_id
}

# NOTE: Secret names below (no "directus-" prefix) MUST match the naming
# convention the App Service module derives from directus_secrets map keys:
# replace(lower(KEY), "_", "-")  e.g. ADMIN_PASSWORD -> admin-password
resource "azurerm_key_vault_secret" "admin_password" {
  name         = "admin-password"
  value        = random_password.directus_admin_password.result
  key_vault_id = module.key_vault.vault_id
}

resource "azurerm_key_vault_secret" "admin_token" {
  name         = "admin-token"
  value        = random_password.directus_admin_token.result
  key_vault_id = module.key_vault.vault_id
}

resource "azurerm_key_vault_secret" "jwt_secret" {
  name         = "jwt-secret"
  value        = random_password.directus_jwt_secret.result
  key_vault_id = module.key_vault.vault_id
}

resource "azurerm_key_vault_secret" "secret" {
  name         = "secret"
  value        = random_password.directus_secret.result
  key_vault_id = module.key_vault.vault_id
}

resource "azurerm_key_vault_secret" "db_password" {
  name         = "db-password"
  value        = module.database.administrator_login_password
  key_vault_id = module.key_vault.vault_id
}

resource "azurerm_key_vault_secret" "storage_azure_account_key" {
  name         = "storage-azure-account-key" # matches Directus's expected env var STORAGE_AZURE_ACCOUNT_KEY
  value        = azurerm_storage_account.content.primary_access_key
  key_vault_id = module.key_vault.vault_id
}

# NOTE: the ACS connection string secret was removed - the Function App now
# authenticates to ACS with its managed identity (Entra ID), so there is no
# ACS access key to store. See azurerm_role_assignment.functions_acs_email_sender.

# ============================================================
# STATIC WEB APP: Angular frontend
# ============================================================
module "static_web_app" {
  source = "./modules/static-web-app"

  resource_group_name = data.azurerm_resource_group.main.name
  # SWA supports: centralus, eastus2, westus2, westeurope, eastasia
  location          = local.frontend_location
  project_name      = var.project_name
  environment       = var.environment
  location_short    = "" # Deprecated: location-independent naming
  github_repo_token = var.github_repo_token
  github_repo_url   = var.github_repo_url
  github_branch     = var.github_branch
  tags              = local.frontend_tags
}

# ============================================================
# APP SERVICE PLAN (shared by Directus and the Functions app)
# Owned at the root - both apps reference it directly, which keeps the
# dependency graph acyclic (when the Plan lived inside the app-service
# module, the Functions module had to read it back via a data source that
# only worked once the Plan already existed - a two-phase bootstrap).
# ============================================================
resource "azurerm_service_plan" "main" {
  count               = var.enable_app_service ? 1 : 0
  name                = "${local.app_name}-asp"
  location            = coalesce(var.app_service_location, var.primary_location)
  resource_group_name = data.azurerm_resource_group.main.name
  os_type             = "Linux"
  sku_name            = var.app_service_sku
  tags                = local.directus_tags
}

# ============================================================
# APP SERVICE: Directus CMS
# ============================================================
module "app_service" {
  count  = var.enable_app_service ? 1 : 0
  source = "./modules/app-service"

  resource_group_name = data.azurerm_resource_group.main.name
  location            = coalesce(var.app_service_location, var.primary_location) # App Service specific location
  project_name        = var.project_name
  environment         = var.environment
  service_plan_id     = azurerm_service_plan.main[0].id
  always_on           = local.plan_supports_vnet # F1/D1 don't support always-on

  # Key Vault integration
  key_vault_id  = module.key_vault.vault_id
  key_vault_uri = module.key_vault.vault_uri

  storage_account_id = azurerm_storage_account.content.id

  # B1+ only: VNet integration subnet (F1/D1 get null - unsupported there)
  vnet_integration_subnet_id = local.use_vnet ? azurerm_subnet.app_integration[0].id : null

  directus_config = {
    HOST                        = "0.0.0.0" # explicit - must bind all interfaces for App Service's warmup probe to reach it
    PORT                        = "8055"    # must match WEBSITES_PORT in the app-service module
    DB_CLIENT                   = "mssql"
    DB_HOST                     = module.database.server_fqdn
    DB_PORT                     = "1433"
    DB_DATABASE                 = var.sql_database_name
    DB_USER                     = var.sql_admin_username
    DB_ENCRYPT                  = "true"
    DB_TRUST_SERVER_CERTIFICATE = "false"
    ADMIN_EMAIL                 = var.directus_admin_email
    JWT_REFRESH_TOKEN_TTL       = "${var.directus_refresh_token_ttl}d"
    PUBLIC_URL                  = "https://${local.app_name}-appservice.azurewebsites.net"
    CORS_ENABLED                = "true" # required - CORS_ORIGIN alone is ignored without this
    CORS_ORIGIN                 = "https://${module.static_web_app.default_host_name}"
    RATE_LIMITER_ENABLED        = "true"
    RATE_LIMITER_STORE          = "memory"
    CACHE_ENABLED               = "true"
    CACHE_STORE                 = "memory"
    LOG_LEVEL                   = "info"

    # File storage: persist uploads to Azure Blob Storage instead of the
    # container's own (ephemeral) filesystem - without this, uploaded files
    # are lost on every restart/redeploy.
    STORAGE_LOCATIONS            = "azure"
    STORAGE_AZURE_DRIVER         = "azure"
    STORAGE_AZURE_CONTAINER_NAME = azurerm_storage_container.directus_uploads.name
    STORAGE_AZURE_ACCOUNT_NAME   = azurerm_storage_account.content.name

    # Lets the "Notify on Contact Submission" Flow reference these as
    # {{$env.AZURE_FUNCTION_URL}} / {{$env.AZURE_FUNCTION_KEY}} instead of
    # hardcoded values. The Flow itself is created by the CI bootstrap job
    # (setup.js in directus-appservice.yml), which writes those placeholders.
    FLOWS_ENV_ALLOW_LIST = "AZURE_FUNCTION_URL,AZURE_FUNCTION_KEY"
    # Direct reference is safe: module.functions doesn't depend on this
    # module (both reference the root-level Plan), so the graph is linear.
    AZURE_FUNCTION_URL = "https://${module.functions[0].default_hostname}/api/send-contact-email"
  }

  # Sensitive values
  directus_secrets = {
    ADMIN_PASSWORD            = random_password.directus_admin_password.result
    ADMIN_TOKEN               = random_password.directus_admin_token.result
    JWT_SECRET                = random_password.directus_jwt_secret.result
    SECRET                    = random_password.directus_secret.result
    DB_PASSWORD               = module.database.administrator_login_password
    STORAGE_AZURE_ACCOUNT_KEY = azurerm_storage_account.content.primary_access_key
    AZURE_FUNCTION_KEY        = module.functions[0].default_function_key
  }

  # No module-level depends_on: dependencies on the database and Key Vault
  # are implicit through the expressions above (server_fqdn, vault_uri, ...).
  # An explicit depends_on on module.database would be a CYCLE now that the
  # database module's firewall rules reference this module's outbound IPs -
  # module-level depends_on covers every resource in the target module.
  tags = local.directus_tags
}

# ============================================================
# AZURE FUNCTIONS: send-contact-email (Directus Flow webhook target)
# Always deployed on its OWN Flex Consumption (FC1) plan, regardless of
# Directus's App Service Plan tier. This sidesteps two Azure limitations hit
# when trying to share Directus's plan:
#   - Function Apps are flatly rejected on Free/Shared plans (error 59919).
#   - A resource group hosting a Free/Shared Linux web-app plan can't also
#     host a Linux Consumption (Y1) plan (error 59324).
# Flex Consumption needs neither a shared plan nor a separate resource group:
# it's Linux-only, $0 fixed cost (pay-per-execution), and lives in the main
# RG alongside everything else. If Directus's tier changes later, this stays
# unaffected - re-evaluate only if explicitly asked to share Directus's plan.
# ============================================================
resource "azurerm_service_plan" "functions" {
  count               = var.enable_app_service ? 1 : 0
  name                = "${local.app_name}-functions-asp"
  location            = coalesce(var.app_service_location, var.primary_location)
  resource_group_name = data.azurerm_resource_group.main.name
  os_type             = "Linux"
  sku_name            = "FC1" # Flex Consumption: $0 fixed, pay-per-execution
  tags                = local.functions_tags
}

# Flex Consumption requires its own deployment-package container, separate
# from Directus's "directus-uploads" container on the same shared account.
resource "azurerm_storage_container" "functions_deployment" {
  name                  = "functions-deployment"
  storage_account_id    = azurerm_storage_account.content.id
  container_access_type = "private"
}

module "functions" {
  count  = var.enable_app_service ? 1 : 0
  source = "./modules/functions"

  resource_group_name = data.azurerm_resource_group.main.name
  location            = coalesce(var.app_service_location, var.primary_location)
  project_name        = var.project_name
  environment         = var.environment
  service_plan_id     = azurerm_service_plan.functions[0].id

  # Reuses the Directus storage account (not a dedicated one - avoids extra
  # Storage Account cost); the deployment container above is dedicated.
  storage_account_name       = azurerm_storage_account.content.name
  storage_account_access_key = azurerm_storage_account.content.primary_access_key
  storage_container_endpoint = "${azurerm_storage_account.content.primary_blob_endpoint}${azurerm_storage_container.functions_deployment.name}"

  cors_allowed_origin     = "https://${module.static_web_app.default_host_name}"
  from_email_address      = var.from_email_address
  contact_recipient_email = var.contact_recipient_email
  # var.azure_communication_email_domain holds the ACS endpoint URL, e.g.
  # https://<name>.<region>.communication.azure.com/. No secret: the
  # function authenticates to ACS with its own managed identity.
  acs_endpoint      = var.azure_communication_email_domain
  acs_resource_name = var.acs_resource_name

  tags = local.functions_tags
}

resource "azurerm_key_vault_secret" "azure_function_key" {
  count        = var.enable_app_service ? 1 : 0
  name         = "azure-function-key"
  value        = module.functions[0].default_function_key
  key_vault_id = module.key_vault.vault_id
}

# NOTE: Storage network lockdown is managed INLINE on azurerm_storage_account
# .content (network_rules block) - see that resource. Terraform owns
# default_action on every apply, so it flips Deny/Allow automatically by tier
# with no manual az command.

# Directus bootstrap (setup.js) is NOT run by Terraform. It runs as a
# post-deploy job in .github/workflows/directus-appservice.yml, so it fires
# only after the Directus container is deployed and healthy - the correct
# ordering, and it keeps Terraform to infrastructure-only (no local-exec /
# Node dependency on the applier's machine). That job's OIDC identity needs
# "Key Vault Secrets User" on the vault to read the admin token (Contributor
# is control-plane only and does NOT grant data-plane secret reads on an
# RBAC-authorized vault) - granted manually in the Azure Portal.

# NOTE: App Service -> Key Vault access is an RBAC role assignment inside
# the app-service module (vault uses rbac_authorization_enabled; legacy
# access policies no longer apply).

# NOTE: App Service -> Storage RBAC (Storage Blob Data Contributor) is
# granted inside the app-service module itself
# (azurerm_role_assignment.app_service_storage) - this duplicate top-level
# resource was removed after it collided with the module's grant (Azure
# rejects two identical role assignments on the same scope/principal/role).

# ============================================================
# GITHUB ACTIONS SECRETS
# Terraform manages all GitHub Actions secrets automatically.
# Ensure the PAT has "Actions: Read and write" (fine-grained) scope.
# ============================================================
resource "github_actions_secret" "azure_resource_group" {
  repository  = var.github_repository
  secret_name = "AZURE_RESOURCE_GROUP"
  value       = data.azurerm_resource_group.main.name
}

resource "github_actions_secret" "azure_key_vault_name" {
  repository  = var.github_repository
  secret_name = "AZURE_KEY_VAULT_NAME"
  value       = module.key_vault.vault_name
}

resource "github_actions_secret" "azure_swa_name" {
  repository  = var.github_repository
  secret_name = "AZURE_SWA_NAME"
  value       = module.static_web_app.name
}

resource "github_actions_secret" "azure_swa_deployment_token" {
  repository  = var.github_repository
  secret_name = "AZURE_SWA_DEPLOYMENT_TOKEN"
  value       = module.static_web_app.api_key
}

# App Service deployment secrets
resource "github_actions_secret" "azure_appservice_name" {
  count       = var.enable_app_service ? 1 : 0
  repository  = var.github_repository
  secret_name = "AZURE_APPSERVICE_NAME"
  value       = module.app_service[0].app_service_name
}

resource "github_actions_secret" "azure_appservice_url" {
  count       = var.enable_app_service ? 1 : 0
  repository  = var.github_repository
  secret_name = "AZURE_APPSERVICE_URL"
  value       = module.app_service[0].app_service_url
}

# frontend.yml injects this into the built site's runtime-config.js at
# deploy time - was previously pointed at Container Apps' URL under the
# name DIRECTUS_API_URL; must exist under that same secret name for the
# frontend workflow to keep working unchanged.
resource "github_actions_secret" "directus_api_url" {
  count       = var.enable_app_service ? 1 : 0
  repository  = var.github_repository
  secret_name = "DIRECTUS_API_URL"
  value       = module.app_service[0].app_service_url
}

resource "github_actions_secret" "azure_functions_app_name" {
  count       = var.enable_app_service ? 1 : 0
  repository  = var.github_repository
  secret_name = "AZURE_FUNCTIONS_APP_NAME"
  value       = module.functions[0].function_app_name
}

# The Function App lives in the same main resource group as everything else
# (Flex Consumption needs no dedicated RG) - functions.yml uses the shared
# AZURE_RESOURCE_GROUP secret, no separate one needed.
