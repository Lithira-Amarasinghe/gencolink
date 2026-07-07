output "app_name" {
  description = "Container App name"
  value       = azurerm_container_app.directus.name
}

output "app_id" {
  description = "Container App ID"
  value       = azurerm_container_app.directus.id
  sensitive   = true
}

output "directus_fqdn" {
  description = "Directus FQDN"
  value       = azurerm_container_app.directus.ingress[0].fqdn
}

output "directus_url" {
  description = "Directus public URL"
  value       = "https://${azurerm_container_app.directus.ingress[0].fqdn}"
}

output "principal_id" {
  description = "Managed Identity principal ID"
  value       = azurerm_container_app.directus.identity[0].principal_id
  sensitive   = true
}
