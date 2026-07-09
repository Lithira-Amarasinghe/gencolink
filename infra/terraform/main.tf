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
}

resource "azurerm_storage_container" "directus_uploads" {
  name                  = "directus-uploads"
  storage_account_id    = azurerm_storage_account.content.id
  container_access_type = "blob"
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

# Allow Container Apps to access SQL Server
resource "azurerm_mssql_firewall_rule" "allow_azure_services" {
  name             = "AllowAzureServices"
  server_id        = azurerm_mssql_server.directus.id
  start_ip_address = "0.0.0.0"
  end_ip_address   = "0.0.0.0"
}

# ============================================================
# MANAGED IDENTITY: RBAC Role Assignments
# ============================================================

# Grant Container App Managed Identity permission to read from Storage Account
# (no keys/passwords needed for Azure Blob Storage)
resource "azurerm_role_assignment" "container_app_storage_blob_contributor" {
  scope              = azurerm_storage_account.content.id
  role_definition_name = "Storage Blob Data Contributor"
  principal_id       = module.container_apps.principal_id
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

# Storage key and SQL password no longer stored (using Managed Identity instead)

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
# CONTAINER APPS: Directus CMS
# ============================================================
module "container_apps" {
  source = "./modules/container-apps"

  resource_group_name = data.azurerm_resource_group.main.name
  location            = local.directus_location
  project_name        = var.project_name
  environment         = var.environment
  location_short      = ""  # Deprecated: location-independent naming
  directus_image      = var.directus_image
  enable_app_insights = var.enable_app_insights
  tags                = local.directus_tags

  directus_config = {
    DB_CLIENT = "mssql"
    DB_HOST   = azurerm_mssql_server.directus.fully_qualified_domain_name
    DB_PORT   = "1433"
    DB_NAME   = var.sql_database_name
    DB_USER   = var.sql_admin_username

    ADMIN_EMAIL = var.directus_admin_email

    JWT_REFRESH_TOKEN_TTL = "${var.directus_refresh_token_ttl}d"

    PUBLIC_URL  = "https://${local.app_name}-directus.azurecontainerapps.io"
    CORS_ORIGIN = "https://${module.static_web_app.default_host_name}"

    # Storage: Using Managed Identity (no key needed)
    STORAGE_LOCATIONS       = "azure"
    STORAGE_AZURE_ACCOUNT   = azurerm_storage_account.content.name
    STORAGE_AZURE_CONTAINER = azurerm_storage_container.directus_uploads.name
    # Directus will use DefaultAzureCredential which includes Managed Identity

    RATE_LIMITER_ENABLED = "true"
    RATE_LIMITER_STORE   = "memory"
    CACHE_ENABLED        = "true"
    CACHE_STORE          = "memory"
    LOG_LEVEL            = "info"
  }

  # Sensitive values -> Container App "secret" blocks, referenced via secretRef
  # (never rendered as plain env values in the portal/revision diff)
  directus_secrets = {
    ADMIN_PASSWORD = random_password.directus_admin_password.result
    ADMIN_TOKEN    = random_password.directus_admin_token.result
    JWT_SECRET     = random_password.directus_jwt_secret.result
    DB_PASSWORD    = azurerm_mssql_server.directus.administrator_login_password
    STORAGE_AZURE_KEY = azurerm_storage_account.content.primary_access_key
  }

  depends_on = [azurerm_mssql_database.directus]
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
