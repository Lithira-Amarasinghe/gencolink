locals {
  app_name = "${var.project_name}-${var.environment}-functions"
}

# Flex Consumption plan function app. Always used regardless of Directus's
# App Service Plan tier - Flex Consumption has its own dedicated Plan
# (var.service_plan_id, SKU "FC1"), is Linux-only, $0 fixed cost (pay per
# execution), and needs no shared-plan or same-resource-group workaround.
resource "azurerm_function_app_flex_consumption" "main" {
  name                = local.app_name
  resource_group_name = var.resource_group_name
  location            = var.location
  service_plan_id     = var.service_plan_id

  # Deployment package storage (Flex Consumption's own required config, via
  # functionAppConfig - separate from Functions' bookkeeping storage below).
  storage_container_type      = "blobContainer"
  storage_container_endpoint  = var.storage_container_endpoint
  storage_authentication_type = "StorageAccountConnectionString"
  storage_access_key          = var.storage_account_access_key

  runtime_name           = "node"
  runtime_version        = "20"
  maximum_instance_count = 40
  instance_memory_in_mb  = 2048

  site_config {
    # Only the frontend origin may call these endpoints directly from the browser
    cors {
      allowed_origins = [var.cors_allowed_origin]
    }
  }

  app_settings = {
    ACS_SENDER_ADDRESS      = var.from_email_address
    CONTACT_RECIPIENT_EMAIL = var.contact_recipient_email
    # No secret: the function authenticates to ACS with its own managed
    # identity (see azurerm_role_assignment.acs_email_sender below). Only the
    # non-sensitive resource endpoint is needed.
    ACS_ENDPOINT = var.acs_endpoint
  }

  identity {
    type = "SystemAssigned"
  }

  tags = var.tags
}

# RBAC: Function App managed identity sends email through ACS via Entra ID -
# no connection string / access key stored anywhere. "Communication and Email
# Service Owner" is the built-in role that authorizes email send. Scoped to
# the single Communication Services resource (least privilege). The ACS
# resource is not managed by this Terraform, so its id is composed from the
# resource group.
resource "azurerm_role_assignment" "acs_email_sender" {
  scope                = "${data.azurerm_resource_group.current.id}/providers/Microsoft.Communication/communicationServices/${var.acs_resource_name}"
  role_definition_name = "Communication and Email Service Owner"
  principal_id         = azurerm_function_app_flex_consumption.main.identity[0].principal_id
}

data "azurerm_resource_group" "current" {
  name = var.resource_group_name
}

# Reads the Function App's auto-generated default host key - lets the caller
# (Directus, via Key Vault) reach this Function without a secret ever being
# typed in manually.
data "azurerm_function_app_host_keys" "main" {
  name                = azurerm_function_app_flex_consumption.main.name
  resource_group_name = var.resource_group_name

  depends_on = [azurerm_function_app_flex_consumption.main]
}
