locals {
  resource_suffix = "${var.project_name}-${var.environment}-${var.location_short}"
}

resource "azurerm_postgresql_flexible_server" "main" {
  name                         = "${local.resource_suffix}-pgserver"
  location                     = var.location
  resource_group_name          = var.resource_group_name
  administrator_login          = var.admin_username
  administrator_password       = var.admin_password
  version                      = var.version
  sku_name                     = var.sku
  storage_mb                   = var.storage_gb * 1024
  backup_retention_days        = 7
  geo_redundant_backup_enabled = false
  zone                         = "1"
  high_availability {
    mode = "ZoneRedundant"
  }
  tags = var.tags

  # Allow public access (configure firewall rules below)
  public_network_access_enabled = true
}

# Firewall rule: Allow Azure services
resource "azurerm_postgresql_flexible_server_firewall_rule" "azure_services" {
  name             = "AllowAzureServices"
  server_id        = azurerm_postgresql_flexible_server.main.id
  start_ip_address = "0.0.0.0"
  end_ip_address   = "0.0.0.0"
}

# Database for Directus
resource "azurerm_postgresql_flexible_server_database" "directus" {
  name       = "directus"
  server_id  = azurerm_postgresql_flexible_server.main.id
  charset    = "UTF8"
  collation  = "en_US.utf8"
  depends_on = [azurerm_postgresql_flexible_server.main]
}

# Server parameters for Directus
resource "azurerm_postgresql_flexible_server_configuration" "log_statement" {
  name       = "log_statement"
  server_id  = azurerm_postgresql_flexible_server.main.id
  value      = "all"
  depends_on = [azurerm_postgresql_flexible_server.main]
}

resource "azurerm_postgresql_flexible_server_configuration" "log_min_duration" {
  name       = "log_min_duration_statement"
  server_id  = azurerm_postgresql_flexible_server.main.id
  value      = "1000"
  depends_on = [azurerm_postgresql_flexible_server.main]
}
