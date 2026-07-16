output "app_service_id" {
  value       = azurerm_linux_web_app.main.id
  description = "App Service resource ID"
}

output "app_service_name" {
  value       = azurerm_linux_web_app.main.name
  description = "App Service name"
}

output "app_service_fqdn" {
  value       = azurerm_linux_web_app.main.default_hostname
  description = "App Service FQDN"
}

output "app_service_url" {
  value       = "https://${azurerm_linux_web_app.main.default_hostname}"
  description = "App Service public URL (HTTPS)"
}

output "principal_id" {
  value       = azurerm_linux_web_app.main.identity[0].principal_id
  description = "System Assigned Managed Identity principal ID (for RBAC)"
}

output "outbound_ip_addresses" {
  value       = split(",", azurerm_linux_web_app.main.outbound_ip_addresses)
  description = "App Service outbound IPs (shared, tied to the App Service Plan - not static across region/SKU changes). Informational only - NOT used for firewall scoping (SQL/Storage use the broad AllowAzureServices / Allow default on F1-D1, or the VNet integration subnet on B1+, since these IPs are unknown until after apply and can't drive a for_each in the same apply)."
}
