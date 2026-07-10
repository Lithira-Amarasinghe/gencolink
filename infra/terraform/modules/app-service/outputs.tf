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

output "service_plan_id" {
  value       = azurerm_service_plan.main.id
  description = "App Service Plan ID"
}
