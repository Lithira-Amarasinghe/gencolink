output "id" {
  description = "Static Web App ID"
  value       = azurerm_static_web_app.main.id
}

output "name" {
  description = "Static Web App name"
  value       = azurerm_static_web_app.main.name
}

output "default_host_name" {
  description = "Static Web App default hostname"
  value       = azurerm_static_web_app.main.default_host_name
}

output "api_key" {
  description = "Static Web App deployment token"
  value       = azurerm_static_web_app.main.api_key
  sensitive   = true
}

output "default_url" {
  description = "Static Web App default URL"
  value       = "https://${azurerm_static_web_app.main.default_host_name}"
}

output "deployment_token" {
  description = "Deployment token for CI/CD"
  value       = azurerm_static_web_app.main.api_key
  sensitive   = true
}

output "github_actions_secret" {
  description = "GitHub Actions secret setup command"
  value       = "gh secret set AZURE_SWA_DEPLOYMENT_TOKEN --body '${azurerm_static_web_app.main.api_key}'"
  sensitive   = true
}
