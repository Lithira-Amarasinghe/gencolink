locals {
  app_name = "${var.project_name}-${var.environment}"
}

# App Service Plan (Free tier - F1)
resource "azurerm_service_plan" "main" {
  name                = "${local.app_name}-asp"
  location            = var.location
  resource_group_name = var.resource_group_name
  os_type             = "Linux"
  sku_name            = var.sku  # F1 = Free tier

  tags = var.tags
}

# Linux Web App (Node.js 20)
resource "azurerm_linux_web_app" "main" {
  name                = "${local.app_name}-appservice"
  location            = var.location
  resource_group_name = var.resource_group_name
  service_plan_id     = azurerm_service_plan.main.id

  # Application settings: merge config + secrets (as Key Vault references)
  app_settings = merge(
    var.directus_config,
    {
      WEBSITES_PORT                      = "8055"
      NODE_ENV                          = "production"
      WEBSITE_NODE_DEFAULT_VERSION      = "20-lts"
      SCM_DO_BUILD_DURING_DEPLOYMENT    = "true"
    },
    # Key Vault references for secrets (format: @Microsoft.KeyVault(...))
    {
      for key, _ in var.directus_secrets :
      key => "@Microsoft.KeyVault(SecretUri=${var.key_vault_uri}/secrets/${replace(lower(key), "_", "-")}/)"
    }
  )

  site_config {
    application_stack {
      node_version = "20-lts"
    }

    # Health check configuration
    health_check_path              = "/server/health"
    health_check_eviction_time_in_min = 2  # Minimum value required by Azure

    # Startup script: run setup.js then start Directus
    app_command_line = "node setup.js && npm start"
  }

  # System Assigned Managed Identity
  identity {
    type = "SystemAssigned"
  }

  # Enable HTTPS only
  https_only = true

  tags = var.tags
}

# Key Vault Access Policy for App Service
resource "azurerm_key_vault_access_policy" "app_service" {
  key_vault_id = var.key_vault_id
  tenant_id    = data.azurerm_client_config.current.tenant_id
  object_id    = azurerm_linux_web_app.main.identity[0].principal_id

  secret_permissions = ["Get", "List"]

  depends_on = [azurerm_linux_web_app.main]
}

# RBAC: Storage Blob Data Contributor
resource "azurerm_role_assignment" "app_service_storage" {
  scope              = var.storage_account_id
  role_definition_name = "Storage Blob Data Contributor"
  principal_id       = azurerm_linux_web_app.main.identity[0].principal_id

  depends_on = [azurerm_linux_web_app.main]
}

# Get current Azure subscription context
data "azurerm_client_config" "current" {}
