output "static_web_app_url" {
  description = "Angular frontend URL"
  value       = module.static_web_app.default_url
}

output "directus_url" {
  description = "Directus base URL"
  value       = var.enable_app_service ? "https://${module.app_service[0].app_service_fqdn}" : "App Service disabled"
}

output "directus_admin_url" {
  description = "Directus admin panel URL"
  value       = var.enable_app_service ? "https://${module.app_service[0].app_service_fqdn}/admin" : "App Service disabled"
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
    directus_app       = var.enable_app_service ? module.app_service[0].app_service_name : null
    storage_account    = azurerm_storage_account.content.name
    key_vault          = module.key_vault.vault_name
    static_web_app     = module.static_web_app.name
  }
}

output "deployment_summary" {
  value = {
    frontend_url       = module.static_web_app.default_url
    directus_admin_url = var.enable_app_service ? "https://${module.app_service[0].app_service_fqdn}/admin" : "App Service disabled"
    key_vault          = module.key_vault.vault_name

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

output "app_service_url" {
  description = "App Service Directus URL (Free tier F1 - 60 min/day limit)"
  value       = var.enable_app_service ? "https://${module.app_service[0].app_service_fqdn}" : "App Service disabled (set enable_app_service = true)"
}

output "app_service_admin_url" {
  description = "App Service Directus admin panel URL"
  value       = var.enable_app_service ? "${module.app_service[0].app_service_url}/admin" : "App Service disabled"
}

output "app_service_status" {
  description = "App Service deployment status and warnings"
  value = var.enable_app_service ? {
    status              = "Deployed"
    sku                 = var.app_service_sku
    daily_compute_limit = "60 minutes (Free tier F1)"
    warning             = "Free tier only viable for testing/demo (not 24/7 production)"
    endpoint            = "https://${module.app_service[0].app_service_fqdn}"
  } : {
    status  = "Disabled"
    message = "Set enable_app_service = true to enable"
  }
}
