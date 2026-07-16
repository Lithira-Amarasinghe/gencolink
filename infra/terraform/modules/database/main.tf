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

# Free/Shared plan tiers only (F1/D1 - no VNet integration available there).
# NOTE: this is the broad "AllowAllWindowsAzureIps" rule (0.0.0.0-0.0.0.0),
# not a per-IP rule scoped to just this App Service. A per-IP rule is not
# possible in a single apply: the App Service's actual outbound IPs are
# assigned by Azure at creation time and are NOT known until after apply,
# so a for_each keyed on them fails at plan time ("Invalid for_each argument
# ... known only after apply"). The only alternatives are a genuine
# two-phase apply (rejected as error-prone/tedious) or VNet integration
# (unavailable on F1/D1). This broad rule is the standard, documented
# trade-off for free/dev-test tiers (see Microsoft's own guidance: "Dev/test,
# low data sensitivity -> Public endpoint with service firewall"). Still
# requires the SQL admin credentials to actually connect - this only widens
# which network can attempt the connection. B1+ uses the strict, IP-free
# subnet rule below instead.
resource "azurerm_mssql_firewall_rule" "allow_azure_services" {
  count            = var.allow_azure_services ? 1 : 0
  name             = "AllowAllWindowsAzureIps"
  server_id        = azurerm_mssql_server.directus.id
  start_ip_address = "0.0.0.0"
  end_ip_address   = "0.0.0.0"
}

# VNet rule: allows the App Service integration subnet via its Microsoft.Sql
# service endpoint. Preferred over IP rules (B1+ tiers) - survives outbound-IP
# changes and needs no two-phase bootstrap. Also free.
resource "azurerm_mssql_virtual_network_rule" "app_service_subnet" {
  for_each  = toset(var.allowed_subnet_ids)
  name      = "AppServiceSubnet-${substr(sha1(each.value), 0, 8)}"
  server_id = azurerm_mssql_server.directus.id
  subnet_id = each.value
}
