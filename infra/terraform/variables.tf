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
  description = "Location for Directus Container Apps (CMS workload)"
  type        = string
  default     = null  # Falls back to primary_location
}

variable "frontend_location" {
  description = "Location for Static Web App (limited regions: centralus, eastus2, westus2, westeurope, eastasia)"
  type        = string
  default     = null  # Falls back to primary_location
}

variable "app_service_location" {
  description = "Location for App Service Plan + Web App (can be any region)"
  type        = string
  default     = null  # Falls back to primary_location
}

variable "storage_location" {
  description = "Location for Storage Account (can be different for cost optimization)"
  type        = string
  default     = null  # Falls back to primary_location
}

variable "sql_location" {
  description = "Location for Azure SQL Server"
  type        = string
  default     = null  # Falls back to primary_location
}

variable "keyvault_location" {
  description = "Location for Key Vault"
  type        = string
  default     = null  # Falls back to primary_location
}

variable "tags" {
  description = "Common tags"
  type        = map(string)
  default = {
    Project     = "Gencolink"
    Environment = "Production"
    CostModel   = "FREE-Tier"
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
# DOCKER REGISTRY (for Docker Hub)
# ============================================================
variable "docker_registry_username" {
  description = "Docker registry username (leave empty for public images)"
  type        = string
  default     = ""
}

variable "docker_registry_password" {
  description = "Docker registry password"
  type        = string
  sensitive   = true
  default     = ""
}

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

variable "db_version" {
  description = "Database version"
  type        = string
  default     = "15"
}

variable "db_admin_username" {
  description = "Database admin username"
  type        = string
  default     = "pgadmin"
}

variable "db_admin_password" {
  description = "Database admin password"
  type        = string
  sensitive   = true
  default     = ""
}

variable "db_sku" {
  description = "Database SKU"
  type        = string
  default     = "B_Standard_B1ms"
}

variable "db_storage_gb" {
  description = "Database storage in GB"
  type        = number
  default     = 32
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

variable "enable_app_insights" {
  description = "Enable Application Insights"
  type        = bool
  default     = false
}

variable "directus_refresh_token_ttl" {
  description = "Directus refresh token TTL in days"
  type        = number
  default     = 7
}


variable "azure_communication_email_domain" {
  description = "Azure Communication Email domain"
  type        = string
  default     = ""
}

# ============================================================
# APP SERVICE DEPLOYMENT (Alternative to Container Apps)
# ============================================================
variable "enable_app_service" {
  description = "Deploy Directus to App Service (set to false to keep Container Apps only)"
  type        = bool
  default     = true
}

variable "app_service_sku" {
  description = "App Service Plan SKU (F1=free, B1=basic ~$13/mo)"
  type        = string
  default     = "F1"
}

variable "sendgrid_api_key" {
  description = "SendGrid API key"
  type        = string
  sensitive   = true
  default     = ""
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
  description = "SQL Server admin password"
  type        = string
  sensitive   = true
}

variable "sql_service_tier" {
  description = "SQL Database service tier (Basic, Standard, Premium)"
  type        = string
  default     = "Basic"
}

variable "sql_compute_model" {
  description = "SQL Database compute model (DTU or vCore)"
  type        = string
  default     = "DTU"
}

variable "sql_database_name" {
  description = "Azure SQL Database name"
  type        = string
  default     = "directus"
}

variable "sql_entra_admin_name" {
  description = "Entra ID admin user/group name for SQL Server (e.g., your Azure user principal name)"
  type        = string
  default     = "admin@example.com"
}

variable "sql_entra_admin_object_id" {
  description = "Entra ID admin object ID (get from: az ad user show --id your-email --query id)"
  type        = string
  default     = ""
}

