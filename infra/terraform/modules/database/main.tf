locals {
  app_name = "${var.project_name}-${var.environment}"
}

resource "azurerm_mssql_server" "directus" {
  name                         = "${local.app_name}-sqlserver"
  resource_group_name          = var.resource_group_name
  location                     = var.location
  version                      = "12.0"
  administrator_login          = var.admin_username
  administrator_login_password = var.admin_password
  minimum_tls_version          = "1.2"
  tags                         = var.tags

  identity {
    type = "SystemAssigned"
  }
}

resource "azurerm_mssql_database" "directus" {
  name         = var.database_name
  server_id    = azurerm_mssql_server.directus.id
  collation    = "SQL_Latin1_General_CP1_CI_AS"
  license_type = "BasePrice"
  max_size_gb  = 2
  sku_name     = "Basic"
  tags         = var.tags
}

# Scoped to specific outbound IPs instead of the broad AllowAzureServices
# (0.0.0.0) rule, which lets ANY Azure tenant's resources attempt a
# connection. Free - no VNet/Private Endpoint cost.
resource "azurerm_mssql_firewall_rule" "app_service_outbound" {
  for_each         = toset(var.allowed_ip_addresses)
  name             = "AppService-${replace(each.value, ".", "-")}"
  server_id        = azurerm_mssql_server.directus.id
  start_ip_address = each.value
  end_ip_address   = each.value
}
