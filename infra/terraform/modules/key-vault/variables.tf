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

variable "tags" {
  description = "Tags for resources"
  type        = map(string)
}

variable "functions_principal_id" {
  description = "Principal ID of Azure Functions for access policy"
  type        = string
  default     = null
}

variable "container_apps_principal_id" {
  description = "Principal ID of Container Apps for access policy (always provided by root - see main.tf)"
  type        = string
}
