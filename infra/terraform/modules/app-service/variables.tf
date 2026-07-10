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

variable "sku" {
  type        = string
  description = "App Service Plan SKU (F1=free, B1=basic)"
  default     = "F1"
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

variable "tags" {
  type        = map(string)
  description = "Resource tags"
  default     = {}
}
