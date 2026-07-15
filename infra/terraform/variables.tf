variable "resource_group_name" {
  description = "Existing Azure resource group name"
  type        = string
  default     = "gencolink"
}

variable "project_name" {
  description = "Project name"
  type        = string
  default     = "gencolink"
}

variable "environment" {
  description = "Environment"
  type        = string
  default     = "prod"
}

# ============================================================
# PRIMARY LOCATION (for most services)
# ============================================================
variable "primary_location" {
  description = "Primary Azure region for most resources"
  type        = string
  default     = "eastus2"
}

# ============================================================
# SERVICE-SPECIFIC LOCATIONS (overrides primary if set)
# ============================================================
variable "directus_location" {
  description = "Location for the Directus App Service (CMS workload)"
  type        = string
  default     = null # Falls back to primary_location
}

variable "frontend_location" {
  description = "Location for Static Web App (limited regions: centralus, eastus2, westus2, westeurope, eastasia)"
  type        = string
  default     = null # Falls back to primary_location
}

variable "app_service_location" {
  description = "Location for App Service Plan + Web App (can be any region)"
  type        = string
  default     = null # Falls back to primary_location
}

variable "storage_location" {
  description = "Location for Storage Account (can be different for cost optimization)"
  type        = string
  default     = null # Falls back to primary_location
}

variable "sql_location" {
  description = "Location for Azure SQL Server"
  type        = string
  default     = null # Falls back to primary_location
}

variable "keyvault_location" {
  description = "Location for Key Vault"
  type        = string
  default     = null # Falls back to primary_location
}

variable "tags" {
  description = "Common tags"
  type        = map(string)
  default = {
    Project     = "Gencolink"
    Environment = "Production"
    ManagedBy   = "Terraform"
  }
}

# ============================================================
# DIRECTUS CONFIGURATION
# ============================================================
variable "directus_admin_email" {
  description = "Directus admin email"
  type        = string
}

# directus_admin_password / directus_admin_token / directus_jwt_secret are no
# longer input variables — main.tf generates them with random_password and
# writes them to Key Vault + GitHub Secrets, so there's one source of truth.

# ============================================================
# ADDITIONAL VARIABLES (for terraform.tfvars compatibility)
# ============================================================
variable "contact_recipient_email" {
  description = "Email to receive contact form submissions"
  type        = string
  default     = ""
}

variable "from_email_address" {
  description = "From email address for notifications"
  type        = string
  default     = "noreply@gencolink.com"
}

variable "github_repo_token" {
  description = "GitHub PAT token (needs repo scope to manage Actions secrets)"
  type        = string
  sensitive   = true
  default     = ""
}

variable "github_repo_url" {
  description = "GitHub repository URL"
  type        = string
  default     = ""
}

variable "github_owner" {
  description = "GitHub org/user that owns the repository"
  type        = string
  default     = "Lithira-Amarasinghe"
}

variable "github_repository" {
  description = "GitHub repository name (no owner prefix)"
  type        = string
  default     = "gencolink"
}

variable "github_branch" {
  description = "GitHub branch to deploy"
  type        = string
  default     = "master"
}

variable "directus_refresh_token_ttl" {
  description = "Directus refresh token TTL in days"
  type        = number
  default     = 7
}


variable "azure_communication_email_domain" {
  description = "Azure Communication Services resource endpoint URL, e.g. https://<name>.<region>.communication.azure.com/ (passed to the function as ACS_ENDPOINT for managed-identity auth)"
  type        = string
  default     = ""
}

variable "acs_resource_name" {
  description = "Name of the Azure Communication Services resource the Function App is granted email-send access on (used to build the RBAC scope). Not a secret."
  type        = string
  default     = ""
}

# ============================================================
# APP SERVICE DEPLOYMENT (hosts Directus + the Functions app)
# ============================================================
variable "enable_app_service" {
  description = "Deploy Directus + Functions to App Service. The Function App and the Directus bootstrap depend on this; there is no other hosting path, so this is effectively always true."
  type        = bool
  default     = true
}

variable "app_service_sku" {
  description = "App Service Plan SKU. B1 (~$13/mo) is the minimum viable tier - F1/Free was proven unusable for Directus (container startup exceeds the 230s timeout and exhausts the daily quota)."
  type        = string
  default     = "B1"
}

# ============================================================
# AZURE SQL SERVER CONFIGURATION
# ============================================================
variable "sql_admin_username" {
  description = "SQL Server admin username"
  type        = string
  default     = "sqladmin"
}

variable "sql_admin_password" {
  description = "SQL Server admin password. Leave empty (default) to let Terraform auto-generate and manage it via random_password.sql_admin_password - only set this to pin a specific password."
  type        = string
  sensitive   = true
  default     = ""
}

variable "sql_database_name" {
  description = "Azure SQL Database name"
  type        = string
  default     = "directus"
}

