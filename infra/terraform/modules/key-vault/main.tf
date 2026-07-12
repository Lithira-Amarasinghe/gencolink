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

  # Azure RBAC authorization (Microsoft-recommended over legacy access
  # policies). Access policies proved unreliable here: App Service Key Vault
  # references returned persistent AccessToKeyVaultDenied despite a correct
  # policy, and policies kept getting clobbered by unrelated applies.
  rbac_authorization_enabled = true

  tags = var.tags
}

# Deployer (Terraform runner) manages secret contents
resource "azurerm_role_assignment" "deployer_secrets_officer" {
  scope                = azurerm_key_vault.main.id
  role_definition_name = "Key Vault Administrator"
  principal_id         = data.azurerm_client_config.current.object_id
}

# Azure Functions managed identity reads secrets (if provided)
resource "azurerm_role_assignment" "functions_secrets_user" {
  count                = var.functions_principal_id != null ? 1 : 0
  scope                = azurerm_key_vault.main.id
  role_definition_name = "Key Vault Secrets User"
  principal_id         = var.functions_principal_id
}

data "azurerm_client_config" "current" {}
