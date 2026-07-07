output "app_name" {
  description = "Function App name"
  value       = azurerm_function_app.main.name
}

output "app_id" {
  description = "Function App ID"
  value       = azurerm_function_app.main.id
  sensitive   = true
}

output "default_hostname" {
  description = "Function App default hostname"
  value       = azurerm_function_app.main.default_hostname
}

output "principal_id" {
  description = "Managed Identity principal ID"
  value       = azurerm_function_app.main.identity[0].principal_id
  sensitive   = true
}

output "functions_url" {
  description = "Base URL for function endpoints"
  value       = "https://${azurerm_function_app.main.default_hostname}"
}

output "send_email_function_url" {
  description = "Full URL for send-email function"
  value       = "https://${azurerm_function_app.main.default_hostname}/api/send-email"
}
