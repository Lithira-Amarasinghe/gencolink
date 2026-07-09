locals {
  # Clean naming: location-independent (no location in name)
  app_name = "${var.project_name}-${var.environment}"
}

resource "azurerm_key_vault" "main" {
  name                       = substr(replace("${var.project_name}${var.environment}kv", "-", ""), 0, 24)
  location                   = var.location
  resource_group_name        = var.resource_group_name
  tenant_id                  = data.azurerm_client_config.current.tenant_id
  sku_name                   = "standard"
  soft_delete_retention_days = 7
  purge_protection_enabled   = false # Can be true for prod after initial setup
  rbac_authorization_enabled = false
  access_policy {
    tenant_id = data.azurerm_client_config.current.tenant_id
    object_id = data.azurerm_client_config.current.object_id

    secret_permissions = [
      "Get",
      "List",
      "Set",
      "Delete",
      "Purge",
      "Recover",
      "Backup",
      "Restore"
    ]
  }

  tags = var.tags
}

# Allow Azure Functions to read secrets (if principal_id provided)
resource "azurerm_key_vault_access_policy" "functions" {
  count              = var.functions_principal_id != null ? 1 : 0
  key_vault_id       = azurerm_key_vault.main.id
  tenant_id          = data.azurerm_client_config.current.tenant_id
  object_id          = var.functions_principal_id
  secret_permissions = ["Get", "List"]
}

# Allow Container Apps to read secrets. No count/conditional here on purpose:
# the caller always passes a real principal_id (Container App's managed
# identity), and that value is only known after the Container App is created
# - using count on an unknown value errors at plan time ("Invalid count
# argument"). An unconditional resource lets Terraform defer this to after
# the Container App exists, which is a normal dependency, not a cycle.
resource "azurerm_key_vault_access_policy" "container_apps" {
  key_vault_id       = azurerm_key_vault.main.id
  tenant_id          = data.azurerm_client_config.current.tenant_id
  object_id          = var.container_apps_principal_id
  secret_permissions = ["Get", "List"]
}

data "azurerm_client_config" "current" {}
