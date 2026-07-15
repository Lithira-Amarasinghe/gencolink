terraform {
  required_version = ">= 1.5"
  required_providers {
    azurerm = {
      source  = "hashicorp/azurerm"
      version = "~> 4.0"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.1"
    }
    github = {
      source  = "integrations/github"
      version = "~> 6.0"
    }
    null = {
      source  = "hashicorp/null"
      version = "~> 3.2"
    }
  }

  # Uncomment after first apply to store state in Azure
  # backend "azurerm" {
  #   resource_group_name  = "gencolink-rg-tfstate"
  #   storage_account_name = "gencolinktfstate"
  #   container_name       = "tfstate"
  #   key                  = "prod.tfstate"
  # }
}

provider "azurerm" {
  features {
    key_vault {
      purge_soft_delete_on_destroy    = true
      recover_soft_deleted_key_vaults = true
    }
  }
}

# Auth: personal access token with `repo` scope. Prefer the GITHUB_TOKEN
# environment variable (the provider reads it automatically) over
# var.github_repo_token, so the token never has to sit in terraform.tfvars.
# token = null here means "not explicitly set" - Terraform then lets the
# provider fall back to GITHUB_TOKEN. var.github_repo_token remains as an
# explicit override only for workflows that genuinely need it in tfvars.
provider "github" {
  token = var.github_repo_token != "" ? var.github_repo_token : null
  owner = var.github_owner
}
