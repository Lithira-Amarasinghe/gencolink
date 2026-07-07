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

variable "admin_username" {
  description = "Admin username for PostgreSQL"
  type        = string
}

variable "admin_password" {
  description = "Admin password for PostgreSQL"
  type        = string
  sensitive   = true
}

variable "sku" {
  description = "SKU for PostgreSQL (e.g., B_Standard_B1ms)"
  type        = string
}

variable "storage_gb" {
  description = "Storage in GB"
  type        = number
}

variable "version" {
  description = "PostgreSQL version"
  type        = string
  default     = "15"
}

variable "tags" {
  description = "Tags for resources"
  type        = map(string)
}
