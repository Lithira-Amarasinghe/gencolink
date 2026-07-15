output "server_id" {
  value       = azurerm_mssql_server.directus.id
  description = "SQL Server resource ID"
}

output "server_fqdn" {
  value       = azurerm_mssql_server.directus.fully_qualified_domain_name
  description = "SQL Server fully qualified domain name (DB_HOST)"
}

output "administrator_login_password" {
  value       = azurerm_mssql_server.directus.administrator_login_password
  description = "The effective SQL admin password (echoes back var.admin_password)"
  sensitive   = true
}
