variable "resource_group_name" {
  type        = string
  description = "Azure Resource Group name"
}

variable "location" {
  type        = string
  description = "Azure region for the Function App"
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
  description = "Flex Consumption (FC1) App Service Plan ID to deploy onto - dedicated to Functions, independent of Directus's plan/tier"
}

variable "storage_account_name" {
  type        = string
  description = "Storage account name (reuses Directus's account - no extra Storage cost)"
}

variable "storage_account_access_key" {
  type        = string
  description = "Storage account access key - used for Flex Consumption's required deployment-package storage auth"
  sensitive   = true
}

variable "storage_container_endpoint" {
  type        = string
  description = "Full blob endpoint URL of the dedicated container for Flex Consumption's deployment package (e.g. https://<account>.blob.core.windows.net/<container>)"
}

variable "cors_allowed_origin" {
  type        = string
  description = "The single origin allowed to call this Function directly from a browser (the frontend's URL)"
}

variable "from_email_address" {
  type        = string
  description = "ACS sender address (e.g. DoNotReply@yourdomain.com)"
}

variable "contact_recipient_email" {
  type        = string
  description = "Email address to receive contact form submissions"
}

variable "acs_endpoint" {
  type        = string
  description = "Azure Communication Services resource endpoint URL (not a secret - Managed Identity auth needs no connection string)"
}

variable "acs_resource_name" {
  type        = string
  description = "Name of the Azure Communication Services resource to grant this Function's identity email-send access on"
}

variable "tags" {
  type        = map(string)
  description = "Tags to apply to all resources in this module"
  default     = {}
}
