locals {
  resource_suffix = "${var.project_name}-${var.environment}-${var.location_short}"
}

# Storage Account (required for Azure Functions)
resource "azurerm_storage_account" "functions" {
  name                     = replace("${local.resource_suffix}func", "-", "")
  location                 = var.location
  resource_group_name      = var.resource_group_name
  account_tier             = "Standard"
  account_replication_type = "LRS"
  tags                     = var.tags
}

# App Service Plan for Functions (Consumption tier = pay per execution)
resource "azurerm_service_plan" "functions" {
  name                = "${local.resource_suffix}-funcplan"
  location            = var.location
  resource_group_name = var.resource_group_name
  os_type             = "Linux"
  sku_name            = "Y1" # Consumption tier - lowest cost, scales to zero
  tags                = var.tags
}

# Function App
resource "azurerm_function_app" "main" {
  name                       = "${local.resource_suffix}-funcapp"
  location                   = var.location
  resource_group_name        = var.resource_group_name
  app_service_plan_id        = azurerm_service_plan.functions.id
  storage_account_name       = azurerm_storage_account.functions.name
  storage_account_access_key = azurerm_storage_account.functions.primary_access_key
  os_type                    = "linux"
  runtime_stack              = "node"
  runtime_version            = var.functions_node_version
  tags                       = var.tags

  app_settings = merge(
    var.app_settings,
    {
      WEBSITE_RUN_FROM_PACKAGE    = "1"
      ENABLE_MSDEPLOY_OVER_HTTPS  = "true"
      FUNCTIONS_EXTENSION_VERSION = "~4"
      FUNCTIONS_WORKER_RUNTIME    = "node"
      NODE_ENV                    = "production"
      AzureWebJobsFeatureFlags    = "EnableWorkerIndexing"
    }
  )

  identity {
    type = "SystemAssigned"
  }

  https_only = true
}

# Function App HTTP trigger (send-contact-email)
resource "azurerm_function_app_function" "send_email" {
  name            = "send-contact-email"
  function_app_id = azurerm_function_app.main.id
  language        = "JavaScript"
  test_data       = jsonencode({ "name" = "Azure" })

  config_json = jsonencode({
    bindings = [
      {
        authLevel = "Function"
        type      = "httpTrigger"
        direction = "in"
        name      = "req"
        methods   = ["post"]
        route     = "send-email"
      },
      {
        type      = "http"
        direction = "out"
        name      = "$return"
      }
    ]
  })
}

# Application Insights integration
resource "azurerm_function_app_application_insights_binding" "main" {
  count                   = var.enable_app_insights ? 1 : 0
  app_id                  = azurerm_function_app.main.id
  application_insights_id = var.app_insights_id
}

# Grant Functions access to Key Vault (via Managed Identity)
resource "azurerm_key_vault_access_policy" "functions" {
  key_vault_id = var.key_vault_id
  tenant_id    = data.azurerm_client_config.current.tenant_id
  object_id    = azurerm_function_app.main.identity[0].principal_id

  secret_permissions = ["Get", "List"]
}

data "azurerm_client_config" "current" {}
