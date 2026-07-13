locals {
  # Clean naming: NO location in resource names (location-independent design)
  app_name = "${var.project_name}-${var.environment}"

  # Resolve service-specific locations (with fallbacks to primary)
  directus_location  = coalesce(var.directus_location, var.primary_location)
  frontend_location  = coalesce(var.frontend_location, var.primary_location)
  storage_location   = coalesce(var.storage_location, var.primary_location)
  sql_location       = coalesce(var.sql_location, var.primary_location)
  keyvault_location  = coalesce(var.keyvault_location, var.primary_location)

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

# Read App Service's outbound IPs independently of the module output, to
# avoid a circular dependency: the Storage Account must exist before App
# Service can be created (App Service needs its access key), so the
# Storage Account's network rules can't depend on App Service's own
# resource output. This data source breaks the cycle since it's a
# read-only lookup, not a creation dependency. Only valid once App Service
# already exists.
data "azurerm_linux_web_app" "existing" {
  count               = var.enable_app_service ? 1 : 0
  name                = "${local.app_name}-appservice"
  resource_group_name = data.azurerm_resource_group.main.name
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

  # Network lockdown: deny all data-plane access by default, allow only by
  # IP (not resource_access_rule - Directus authenticates to Azure Storage
  # with a shared account key, and the "resource instance" network
  # exception only matches AAD/Managed-Identity-authenticated calls, so it
  # would silently block Directus too). Terraform itself is unaffected
  # (resource management uses the ARM control plane, not this data-plane
  # firewall).
  network_rules {
    default_action = "Deny"
    bypass          = ["AzureServices"]
    ip_rules = var.enable_app_service ? split(",", data.azurerm_linux_web_app.existing[0].outbound_ip_addresses) : []
  }
}

resource "azurerm_storage_container" "directus_uploads" {
  name                  = "directus-uploads"
  storage_account_id    = azurerm_storage_account.content.id
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

resource "azurerm_mssql_server" "directus" {
  name                         = "${local.app_name}-sqlserver"
  resource_group_name          = data.azurerm_resource_group.main.name
  location                     = local.sql_location
  version                      = "12.0"
  administrator_login          = var.sql_admin_username
  administrator_login_password = coalesce(var.sql_admin_password != "" ? var.sql_admin_password : null, random_password.sql_admin_password.result)
  minimum_tls_version          = "1.2"
  tags                         = local.sql_tags

  identity {
    type = "SystemAssigned"
  }
}

resource "azurerm_mssql_database" "directus" {
  name           = var.sql_database_name
  server_id      = azurerm_mssql_server.directus.id
  collation      = "SQL_Latin1_General_CP1_CI_AS"
  license_type   = "BasePrice"
  max_size_gb    = 2
  sku_name       = "Basic"
  tags           = local.sql_tags
}

# SQL Server firewall: scoped to App Service's specific outbound IPs instead
# of the broad AllowAzureServices (0.0.0.0) rule, which let ANY Azure
# tenant's resources attempt a connection. Free - no VNet/Private Endpoint
# cost.
resource "azurerm_mssql_firewall_rule" "app_service_outbound" {
  for_each         = var.enable_app_service ? toset(module.app_service[0].outbound_ip_addresses) : toset([])
  name             = "AppService-${replace(each.value, ".", "-")}"
  server_id        = azurerm_mssql_server.directus.id
  start_ip_address = each.value
  end_ip_address   = each.value
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
  location_short      = ""  # Deprecated: location-independent naming
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
  value        = azurerm_mssql_server.directus.administrator_login_password
  key_vault_id = module.key_vault.vault_id
}

resource "azurerm_key_vault_secret" "storage_azure_account_key" {
  name         = "storage-azure-account-key" # matches Directus's expected env var STORAGE_AZURE_ACCOUNT_KEY
  value        = azurerm_storage_account.content.primary_access_key
  key_vault_id = module.key_vault.vault_id
}

resource "azurerm_key_vault_secret" "acs_connection_string" {
  name         = "acs-connection-string"
  value        = var.acs_connection_string
  key_vault_id = module.key_vault.vault_id
}

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
  location_short    = ""  # Deprecated: location-independent naming
  github_repo_token = var.github_repo_token
  github_repo_url   = var.github_repo_url
  github_branch     = var.github_branch
  tags              = local.frontend_tags
}

# ============================================================
# APP SERVICE: Directus CMS
# ============================================================
module "app_service" {
  count  = var.enable_app_service ? 1 : 0
  source = "./modules/app-service"

  resource_group_name = data.azurerm_resource_group.main.name
  location            = coalesce(var.app_service_location, var.primary_location)  # App Service specific location
  project_name        = var.project_name
  environment         = var.environment
  sku                 = var.app_service_sku

  # Key Vault integration
  key_vault_id  = module.key_vault.vault_id
  key_vault_uri = module.key_vault.vault_uri

  storage_account_id = azurerm_storage_account.content.id

  directus_config = {
    HOST                         = "0.0.0.0" # explicit - must bind all interfaces for App Service's warmup probe to reach it
    PORT                         = "8055"    # must match WEBSITES_PORT in the app-service module
    DB_CLIENT                   = "mssql"
    DB_HOST                     = azurerm_mssql_server.directus.fully_qualified_domain_name
    DB_PORT                     = "1433"
    DB_DATABASE                 = var.sql_database_name
    DB_USER                     = var.sql_admin_username
    DB_ENCRYPT                  = "true"
    DB_TRUST_SERVER_CERTIFICATE = "false"
    ADMIN_EMAIL                 = var.directus_admin_email
    JWT_REFRESH_TOKEN_TTL       = "${var.directus_refresh_token_ttl}d"
    PUBLIC_URL                  = "https://${local.app_name}-appservice.azurewebsites.net"
    CORS_ENABLED                = "true"  # required - CORS_ORIGIN alone is ignored without this
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
    # hardcoded values - kept in sync automatically (see null_resource
    # .sync_directus_flow below).
    FLOWS_ENV_ALLOW_LIST = "AZURE_FUNCTION_URL,AZURE_FUNCTION_KEY"
    AZURE_FUNCTION_URL   = "https://${azurerm_linux_function_app.main[0].default_hostname}/api/send-contact-email"
  }

  # Sensitive values
  directus_secrets = {
    ADMIN_PASSWORD          = random_password.directus_admin_password.result
    ADMIN_TOKEN             = random_password.directus_admin_token.result
    JWT_SECRET              = random_password.directus_jwt_secret.result
    SECRET                  = random_password.directus_secret.result
    DB_PASSWORD             = azurerm_mssql_server.directus.administrator_login_password
    STORAGE_AZURE_ACCOUNT_KEY = azurerm_storage_account.content.primary_access_key
    AZURE_FUNCTION_KEY      = data.azurerm_function_app_host_keys.main[0].default_function_key
  }

  tags       = local.directus_tags
  depends_on = [azurerm_mssql_database.directus, module.key_vault]
}

# ============================================================
# AZURE FUNCTIONS: send-contact-email (Directus Flow webhook target)
# Deployed onto the SAME App Service Plan as Directus (gencolink-prod-asp,
# B1) - Linux apps on one Plan share its compute/cost, so this adds no
# extra Plan charge. Only new cost is negligible Functions execution
# (well within free monthly grant) - no new Plan, no new compute SKU.
# ============================================================
# Read-only lookup of the already-created App Service Plan, independent of
# module.app_service's own outputs - avoids a circular dependency, since
# module.app_service's directus_config/directus_secrets now also reference
# this Function App (for AZURE_FUNCTION_URL/KEY). Same pattern as
# data.azurerm_linux_web_app.existing above. Only valid once the Plan
# already exists (true here - created by module.app_service previously).
data "azurerm_service_plan" "existing" {
  count               = var.enable_app_service ? 1 : 0
  name                = "${local.app_name}-asp"
  resource_group_name = data.azurerm_resource_group.main.name
}

resource "azurerm_linux_function_app" "main" {
  count               = var.enable_app_service ? 1 : 0
  name                = "${local.app_name}-functions"
  resource_group_name = data.azurerm_resource_group.main.name
  location            = coalesce(var.app_service_location, var.primary_location)
  service_plan_id     = data.azurerm_service_plan.existing[0].id

  # Reuses the Directus storage account for Functions' internal bookkeeping
  # (triggers/locks) instead of provisioning a dedicated one - avoids an
  # additional Storage Account cost.
  storage_account_name       = azurerm_storage_account.content.name
  storage_account_access_key = azurerm_storage_account.content.primary_access_key

  https_only = true

  site_config {
    application_stack {
      node_version = "20"
    }

    # Required on Dedicated (B1) plans - without it, the Function host isn't
    # kept warm/loaded and requests fail with a generic empty 500 from the
    # platform (Kestrel), before user code ever runs. Not needed (or billed
    # extra) on Consumption plans, but this Function shares Directus's paid
    # B1 plan, so it must be explicit here.
    always_on = true

    # Only the frontend origin may call these endpoints directly from the browser
    cors {
      allowed_origins = ["https://${module.static_web_app.default_host_name}"]
    }
  }

  app_settings = {
    FUNCTIONS_WORKER_RUNTIME = "node"
    ACS_SENDER_ADDRESS       = var.from_email_address
    CONTACT_RECIPIENT_EMAIL  = var.contact_recipient_email
    ACS_CONNECTION_STRING    = "@Microsoft.KeyVault(SecretUri=${trimsuffix(module.key_vault.vault_uri, "/")}/secrets/acs-connection-string)"
  }

  identity {
    type = "SystemAssigned"
  }

  tags = local.functions_tags

  depends_on = [data.azurerm_service_plan.existing, azurerm_key_vault_secret.acs_connection_string]
}

# RBAC: Function App managed identity reads Key Vault secrets (ACS connection string)
resource "azurerm_role_assignment" "functions_kv_secrets_user" {
  count                = var.enable_app_service ? 1 : 0
  scope                = module.key_vault.vault_id
  role_definition_name = "Key Vault Secrets User"
  principal_id         = azurerm_linux_function_app.main[0].identity[0].principal_id

  depends_on = [azurerm_linux_function_app.main]
}

# Reads the Function App's auto-generated default host key - lets Directus
# call it without a secret ever being typed in manually.
data "azurerm_function_app_host_keys" "main" {
  count               = var.enable_app_service ? 1 : 0
  name                = azurerm_linux_function_app.main[0].name
  resource_group_name = data.azurerm_resource_group.main.name

  depends_on = [azurerm_linux_function_app.main]
}

resource "azurerm_key_vault_secret" "azure_function_key" {
  count        = var.enable_app_service ? 1 : 0
  name         = "azure-function-key"
  value        = data.azurerm_function_app_host_keys.main[0].default_function_key
  key_vault_id = module.key_vault.vault_id
}

# Keeps the Directus Flow's webhook operation pointed at
# {{$env.AZURE_FUNCTION_URL}} / {{$env.AZURE_FUNCTION_KEY}} (set as App
# Service settings below) instead of a hardcoded URL/key - identical Flow
# config works in every environment, and `terraform apply` re-syncs it
# automatically whenever the Function's key/URL changes. No manual editing
# in the Directus UI.
resource "null_resource" "sync_directus_flow" {
  count = var.enable_app_service ? 1 : 0

  triggers = {
    function_url = "https://${azurerm_linux_function_app.main[0].default_hostname}/api/send-contact-email"
    function_key = data.azurerm_function_app_host_keys.main[0].default_function_key
  }

  provisioner "local-exec" {
    command     = "node \"${path.module}/scripts/sync-directus-flow.js\""
    interpreter = ["bash", "-c"]
    environment = {
      DIRECTUS_URL         = module.app_service[0].app_service_url
      DIRECTUS_ADMIN_TOKEN = random_password.directus_admin_token.result
    }
  }

  depends_on = [module.app_service, azurerm_linux_function_app.main, data.azurerm_function_app_host_keys.main]
}

# NOTE: App Service -> Key Vault access is an RBAC role assignment inside
# the app-service module (vault uses rbac_authorization_enabled; legacy
# access policies no longer apply).

# NOTE: App Service -> Storage RBAC (Storage Blob Data Contributor) is
# granted inside the app-service module itself
# (azurerm_role_assignment.app_service_storage) - this duplicate top-level
# resource was removed after it collided with the module's grant (Azure
# rejects two identical role assignments on the same scope/principal/role).

# Get current Azure context
data "azurerm_client_config" "current" {}

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
  count           = var.enable_app_service ? 1 : 0
  repository      = var.github_repository
  secret_name     = "AZURE_APPSERVICE_NAME"
  value           = module.app_service[0].app_service_name
}

resource "github_actions_secret" "azure_appservice_url" {
  count           = var.enable_app_service ? 1 : 0
  repository      = var.github_repository
  secret_name     = "AZURE_APPSERVICE_URL"
  value           = module.app_service[0].app_service_url
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
  value       = azurerm_linux_function_app.main[0].name
}
