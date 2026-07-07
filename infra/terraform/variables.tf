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

variable "location" {
  description = "Azure region"
  type        = string
  default     = "eastus2"
}

variable "location_short" {
  description = "Short location code"
  type        = string
  default     = "eus"
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
  default     = "Lithira"
}

variable "github_repository" {
  description = "GitHub repository name (no owner prefix)"
  type        = string
  default     = "Gencolink"
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

variable "directus_image" {
  description = "Directus Docker image"
  type        = string
  default     = "directus/directus:latest"
}

variable "azure_communication_email_domain" {
  description = "Azure Communication Email domain"
  type        = string
  default     = ""
}

variable "sendgrid_api_key" {
  description = "SendGrid API key"
  type        = string
  sensitive   = true
  default     = ""
}

