output "function_app_id" {
  value       = azurerm_linux_function_app.main.id
  description = "Function App resource ID"
}

output "function_app_name" {
  value       = azurerm_linux_function_app.main.name
  description = "Function App name"
}

output "default_hostname" {
  value       = azurerm_linux_function_app.main.default_hostname
  description = "Function App default hostname"
}

output "principal_id" {
  value       = azurerm_linux_function_app.main.identity[0].principal_id
  description = "System Assigned Managed Identity principal ID"
}

output "default_function_key" {
  value       = data.azurerm_function_app_host_keys.main.default_function_key
  description = "Auto-generated default host key (for Key Vault storage - never typed in manually)"
  sensitive   = true
}
