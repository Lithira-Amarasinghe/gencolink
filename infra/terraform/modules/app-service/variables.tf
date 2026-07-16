variable "resource_group_name" {
  type        = string
  description = "Azure Resource Group name"
}

variable "location" {
  type        = string
  description = "Azure region for App Service"
}

variable "project_name" {
  type        = string
  description = "Project name (e.g., gencolink)"
}

variable "environment" {
  type        = string
  description = "Environment (e.g., prod)"
}

variable "service_plan_id" {
  type        = string
  description = "ID of the (root-owned) App Service Plan to deploy onto - shared with the Functions app"
}

variable "always_on" {
  type        = bool
  description = "Keep the app loaded at all times. Required for reliable operation on B1+; NOT SUPPORTED on F1/D1 - must be false there"
  default     = true
}

variable "key_vault_id" {
  type        = string
  description = "Azure Key Vault ID for secret references"
}

variable "key_vault_uri" {
  type        = string
  description = "Azure Key Vault URI (https://...)"
}

variable "storage_account_id" {
  type        = string
  description = "Azure Storage Account ID for RBAC"
}

variable "directus_config" {
  type        = map(string)
  description = "Non-sensitive Directus environment variables"
}

variable "directus_secrets" {
  type        = map(string)
  description = "Sensitive Directus environment variables (stored in Key Vault)"
  sensitive   = true
}

variable "vnet_integration_subnet_id" {
  type        = string
  description = "Subnet ID for regional VNet integration (delegated to Microsoft.Web/serverFarms). null disables integration - required on F1/D1, which don't support it."
  default     = null
}

variable "tags" {
  type        = map(string)
  description = "Resource tags"
  default     = {}
}
