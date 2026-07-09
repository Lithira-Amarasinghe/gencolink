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
  description = "DEPRECATED: Short location code (no longer used in naming)"
  type        = string
  default     = ""
}

variable "directus_image" {
  description = "Directus container image URI"
  type        = string
}

variable "directus_config" {
  description = "Directus non-sensitive environment variables"
  type        = map(string)
}

variable "directus_secrets" {
  description = "Directus sensitive environment variables, passed as Container App secrets"
  type        = map(string)
  sensitive   = true
  default     = {}
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

variable "tags" {
  description = "Tags for resources"
  type        = map(string)
}
