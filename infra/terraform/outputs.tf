output "static_web_app_url" {
  description = "Angular frontend URL"
  value       = module.static_web_app.default_url
}

output "directus_url" {
  description = "Directus base URL"
  value       = module.container_apps.directus_url
}

output "directus_admin_url" {
  description = "Directus admin panel URL"
  value       = "${module.container_apps.directus_url}/admin"
}

output "key_vault_name" {
  description = "Key Vault name (all secrets live here)"
  value       = module.key_vault.vault_name
}

output "directus_admin_email" {
  description = "Directus admin login email"
  value       = var.directus_admin_email
}

output "directus_admin_password" {
  description = "Directus admin login password (terraform output -raw directus_admin_password)"
  value       = random_password.directus_admin_password.result
  sensitive   = true
}

output "azure_swa_deployment_token" {
  description = "Static Web App deployment token for GitHub Actions (terraform output -raw azure_swa_deployment_token)"
  value       = module.static_web_app.api_key
  sensitive   = true
}

output "resource_locations" {
  description = "Where each resource is deployed (location-independent naming)"
  value = {
    directus  = local.directus_location
    frontend  = local.frontend_location
    storage   = local.storage_location
    keyvault  = local.keyvault_location
  }
}

output "resource_names" {
  description = "All resource names (clean, location-independent)"
  value = {
    app_name           = local.app_name
    directus_app       = module.container_apps.app_name
    storage_account    = azurerm_storage_account.content.name
    key_vault          = module.key_vault.vault_name
    static_web_app     = module.static_web_app.name
  }
}

output "deployment_summary" {
  value = {
    frontend_url       = module.static_web_app.default_url
    directus_admin_url = "${module.container_apps.directus_url}/admin"
    key_vault          = module.key_vault.vault_name
    directus_image     = var.directus_image

    # New: Location info
    locations = {
      directus  = local.directus_location
      frontend  = local.frontend_location
      storage   = local.storage_location
      keyvault  = local.keyvault_location
    }

    # New: Architecture info
    architecture = "Location-independent design: Services can be deployed to different regions"
    secrets_synced_to  = ["Azure Key Vault", "GitHub Actions Secrets"]
  }
}
