variable "resource_group_name" {
  description = "Name of the resource group"
  type        = string
}

variable "location" {
  description = "Azure region - Static Web Apps' managed Functions/staging backend only supports a limited region set"
  type        = string
  default     = "eastus2"

  validation {
    condition     = contains(["centralus", "eastus2", "westus2", "westeurope", "eastasia"], var.location)
    error_message = "Static Web App region must be one of: centralus, eastus2, westus2, westeurope, eastasia."
  }
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

variable "github_repo_token" {
  description = "GitHub PAT for SWA deployment"
  type        = string
  sensitive   = true
}

variable "github_repo_url" {
  description = "GitHub repository URL"
  type        = string
}

variable "github_branch" {
  description = "GitHub branch to deploy from"
  type        = string
  default     = "master"
}

variable "tags" {
  description = "Tags for resources"
  type        = map(string)
}
