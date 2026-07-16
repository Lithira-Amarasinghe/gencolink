locals {
  app_name = "${var.project_name}-${var.environment}"
}

# The App Service Plan is owned by the ROOT module (shared with the
# Functions app) and passed in as var.service_plan_id - both apps referencing
# one root-level Plan keeps the dependency graph acyclic.

# Linux Web App (Directus container)
resource "azurerm_linux_web_app" "main" {
  name                = "${local.app_name}-appservice"
  location            = var.location
  resource_group_name = var.resource_group_name
  service_plan_id     = var.service_plan_id

  # Regional VNet integration (B1+ only; null on F1/D1). Outbound traffic to
  # SQL/Storage then originates from the integration subnet, matched by their
  # service-endpoint firewall rules.
  virtual_network_subnet_id = var.vnet_integration_subnet_id

  # Application settings: Directus config + Key Vault secret references.
  # Secrets never appear as plaintext in app settings - App Service resolves
  # them at runtime via its Managed Identity ("Key Vault Secrets User" RBAC
  # role assigned below). trimsuffix avoids a double slash (vault_uri already
  # ends in "/").
  app_settings = merge(
    var.directus_config,
    {
      WEBSITES_PORT                       = "8055"  # Directus listens on 8055 by default in the container
      WEBSITES_ENABLE_APP_SERVICE_STORAGE = "false" # Per Directus's official Azure Web Apps guide: must stay off or startup breaks
    },
    {
      for key, _ in var.directus_secrets :
      key => "@Microsoft.KeyVault(SecretUri=${trimsuffix(var.key_vault_uri, "/")}/secrets/${replace(lower(key), "_", "-")}/)"
    }
  )

  site_config {
    # Docker container configuration
    application_stack {
      docker_image_name   = "directus/directus:12.1.1"
      docker_registry_url = "https://index.docker.io"
    }

    # Always-on only for paid tiers (not supported on F1/D1 - caller decides)
    always_on = var.always_on

    # Route ALL outbound traffic through the VNet when integrated. Required:
    # service endpoints target the services' public IP space, which is only
    # routed via the subnet (and thus matched by the firewall rules) when
    # route-all is on.
    vnet_route_all_enabled = var.vnet_integration_subnet_id != null

    # Health check configuration - /server/ping (not /server/health) because
    # Directus 12.x's public role denies /server/health by default
    health_check_path                 = "/server/ping"
    health_check_eviction_time_in_min = 2 # Minimum value required by Azure
  }

  # System Assigned Managed Identity
  identity {
    type = "SystemAssigned"
  }

  # Enable HTTPS only
  https_only = true

  tags = var.tags
}

# RBAC: App Service managed identity reads Key Vault secrets
# (vault uses rbac_authorization_enabled - access policies have no effect)
resource "azurerm_role_assignment" "app_service_kv_secrets_user" {
  scope                = var.key_vault_id
  role_definition_name = "Key Vault Secrets User"
  principal_id         = azurerm_linux_web_app.main.identity[0].principal_id

  depends_on = [azurerm_linux_web_app.main]
}

# RBAC: Storage Blob Data Contributor
resource "azurerm_role_assignment" "app_service_storage" {
  scope                = var.storage_account_id
  role_definition_name = "Storage Blob Data Contributor"
  principal_id         = azurerm_linux_web_app.main.identity[0].principal_id

  depends_on = [azurerm_linux_web_app.main]
}
