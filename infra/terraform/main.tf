locals {
  resource_suffix = "${var.project_name}-${var.environment}-${var.location_short}"

  common_tags = merge(
    var.tags,
    {
      CostOptimization = "FREE-Tier-Only"
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

# ============================================================
# STORAGE ACCOUNT: Directus uploads (blob) + SQLite database file (Azure Files)
# Directus does not support Cosmos DB as a database backend (Knex-based, needs
# a relational engine or SQLite) - SQLite on a persistent file share is the
# lowest-cost option and matches the local docker-compose setup's simplicity.
# ============================================================
resource "azurerm_storage_account" "content" {
  name                       = replace("${local.resource_suffix}content", "-", "")
  location                   = data.azurerm_resource_group.main.location
  resource_group_name        = data.azurerm_resource_group.main.name
  account_tier               = "Standard"
  account_replication_type   = "LRS"
  https_traffic_only_enabled = true
  min_tls_version            = "TLS1_2"
  tags                       = local.common_tags
}

resource "azurerm_storage_container" "directus_uploads" {
  name                  = "directus-uploads"
  storage_account_id    = azurerm_storage_account.content.id
  container_access_type = "blob"
}

# Azure Files share mounted into the Container App for the SQLite data file -
# survives container restarts/redeploys (local filesystem otherwise doesn't).
resource "azurerm_storage_share" "directus_database" {
  name               = "directus-database"
  storage_account_id = azurerm_storage_account.content.id
  quota              = 2 # GB - SQLite file + WAL (adjusted for cost optimization)
}

# ============================================================
# KEY VAULT (single source of truth for secrets)
# ============================================================
module "key_vault" {
  source = "./modules/key-vault"

  resource_group_name = data.azurerm_resource_group.main.name
  location            = var.location
  project_name        = var.project_name
  environment         = var.environment
  location_short      = var.location_short
  tags                = local.common_tags

  container_apps_principal_id = module.container_apps.principal_id
}

resource "azurerm_key_vault_secret" "directus_admin_email" {
  name         = "directus-admin-email"
  value        = var.directus_admin_email
  key_vault_id = module.key_vault.vault_id
}

resource "azurerm_key_vault_secret" "directus_admin_password" {
  name         = "directus-admin-password"
  value        = random_password.directus_admin_password.result
  key_vault_id = module.key_vault.vault_id
}

resource "azurerm_key_vault_secret" "directus_admin_token" {
  name         = "directus-admin-token"
  value        = random_password.directus_admin_token.result
  key_vault_id = module.key_vault.vault_id
}

resource "azurerm_key_vault_secret" "directus_jwt_secret" {
  name         = "directus-jwt-secret"
  value        = random_password.directus_jwt_secret.result
  key_vault_id = module.key_vault.vault_id
}

resource "azurerm_key_vault_secret" "storage_key" {
  name         = "directus-storage-key"
  value        = azurerm_storage_account.content.primary_access_key
  key_vault_id = module.key_vault.vault_id
}

# ============================================================
# STATIC WEB APP: Angular frontend
# ============================================================
module "static_web_app" {
  source = "./modules/static-web-app"

  resource_group_name = data.azurerm_resource_group.main.name
  # SWA managed Functions/staging only deploy to a limited region set
  # (centralus, eastus2, westus2, westeurope, eastasia) - must match one of
  # those explicitly, module's own default ("eastus") is not supported.
  location          = var.location
  project_name      = var.project_name
  environment       = var.environment
  location_short    = var.location_short
  github_repo_token = var.github_repo_token
  github_repo_url   = var.github_repo_url
  github_branch     = var.github_branch
  tags              = local.common_tags
}

# ============================================================
# CONTAINER APPS: Directus CMS
# ============================================================
module "container_apps" {
  source = "./modules/container-apps"

  resource_group_name = data.azurerm_resource_group.main.name
  location            = var.location
  project_name        = var.project_name
  environment         = var.environment
  location_short      = var.location_short
  directus_image      = var.directus_image
  enable_app_insights = var.enable_app_insights
  tags                = local.common_tags

  sqlite_storage_account_name = azurerm_storage_account.content.name
  sqlite_file_share_name      = azurerm_storage_share.directus_database.name

  directus_config = {
    DB_CLIENT   = "sqlite3"
    DB_FILENAME = "/directus/database/data.db"

    ADMIN_EMAIL = var.directus_admin_email

    JWT_REFRESH_TOKEN_TTL = "${var.directus_refresh_token_ttl}d"

    PUBLIC_URL  = "https://${local.resource_suffix}-directus.azurecontainerapps.io"
    CORS_ORIGIN = "https://${module.static_web_app.default_host_name}"

    STORAGE_LOCATIONS       = "azure"
    STORAGE_AZURE_ACCOUNT   = azurerm_storage_account.content.name
    STORAGE_AZURE_CONTAINER = azurerm_storage_container.directus_uploads.name

    RATE_LIMITER_ENABLED = "true"
    RATE_LIMITER_STORE   = "memory"
    CACHE_ENABLED        = "true"
    CACHE_STORE          = "memory"
    LOG_LEVEL            = "info"
  }

  # Sensitive values -> Container App "secret" blocks, referenced via secretRef
  # (never rendered as plain env values in the portal/revision diff)
  directus_secrets = {
    ADMIN_PASSWORD    = random_password.directus_admin_password.result
    ADMIN_TOKEN       = random_password.directus_admin_token.result
    JWT_SECRET        = random_password.directus_jwt_secret.result
    STORAGE_AZURE_KEY = azurerm_storage_account.content.primary_access_key
  }

  sqlite_storage_account_key = azurerm_storage_account.content.primary_access_key
}

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

resource "github_actions_secret" "directus_api_url" {
  repository  = var.github_repository
  secret_name = "DIRECTUS_API_URL"
  value       = module.container_apps.directus_url
}

resource "github_actions_secret" "directus_container_app_name" {
  repository  = var.github_repository
  secret_name = "DIRECTUS_CONTAINER_APP_NAME"
  value       = module.container_apps.app_name
}
