output "server_id" {
  description = "PostgreSQL server ID"
  value       = azurerm_postgresql_flexible_server.main.id
  sensitive   = true
}

output "server_fqdn" {
  description = "PostgreSQL server FQDN"
  value       = azurerm_postgresql_flexible_server.main.fqdn
}

output "database_name" {
  description = "Directus database name"
  value       = azurerm_postgresql_flexible_server_database.directus.name
}
