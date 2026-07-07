variable "resource_group_name" {
  description = "Name of the resource group"
  type        = string
}

variable "location" {
  description = "Azure region"
  type        = string
}

variable "project_name" {
  description = "Project name"
  type        = string
}

variable "environment" {
  description = "Environment name"
  type        = string
}

variable "location_short" {
  description = "Short location code"
  type        = string
}

variable "app_settings" {
  description = "Application settings for Function App"
  type        = map(string)
}

variable "functions_node_version" {
  description = "Node.js runtime version"
  type        = string
  default     = "~20"
}

variable "enable_app_insights" {
  description = "Enable Application Insights"
  type        = bool
  default     = false
}

variable "app_insights_id" {
  description = "Application Insights ID"
  type        = string
  default     = null
}

variable "key_vault_id" {
  description = "Key Vault ID for secret access"
  type        = string
}

variable "tags" {
  description = "Tags for resources"
  type        = map(string)
}
