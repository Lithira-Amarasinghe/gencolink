locals {
  app_name = "${var.project_name}-${var.environment}-functions"
}

resource "azurerm_linux_function_app" "main" {
  name                = local.app_name
  resource_group_name = var.resource_group_name
  location            = var.location
  service_plan_id     = var.service_plan_id

  storage_account_name       = var.storage_account_name
  storage_account_access_key = var.storage_account_access_key

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
      allowed_origins = [var.cors_allowed_origin]
    }
  }

  app_settings = {
    FUNCTIONS_WORKER_RUNTIME = "node"
    ACS_SENDER_ADDRESS       = var.from_email_address
    CONTACT_RECIPIENT_EMAIL  = var.contact_recipient_email
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
  principal_id         = azurerm_linux_function_app.main.identity[0].principal_id
}

data "azurerm_resource_group" "current" {
  name = var.resource_group_name
}

# Reads the Function App's auto-generated default host key - lets the caller
# (Directus, via Key Vault) reach this Function without a secret ever being
# typed in manually.
data "azurerm_function_app_host_keys" "main" {
  name                = azurerm_linux_function_app.main.name
  resource_group_name = var.resource_group_name

  depends_on = [azurerm_linux_function_app.main]
}
