# Terraform IaC Refactoring Plan - Enterprise-Grade

## Current State Issues
1. ❌ Location hardcoded in all resource names
2. ❌ All resources forced to single region
3. ❌ Poor naming convention (reveals internal details)
4. ❌ No multi-region flexibility
5. ❌ Tight coupling between variables

## Target Architecture

### Principle: Location-Independent Naming
```
Resource names: gencolink-{service}-{purpose}
Location: Determined by service-specific variables
Region info: In tags, not in name
```

### Multi-Location Strategy

| Service | Location Variable | Reasoning |
|---------|-------------------|-----------|
| Container Apps (Directus) | `directus_location` | Close to users |
| Static Web App | `frontend_location` | SWA has limited regions |
| Storage | `storage_location` | Can be different (cheaper tier elsewhere) |
| Key Vault | `keyvault_location` | Primary region |
| Database (future) | `database_location` | Can be separate |

---

## Implementation Steps

### 1. **New Variables Structure**
```hcl
# Service-specific locations
variable "directus_location" { default = "eastus2" }
variable "frontend_location" { default = "eastus2" }
variable "storage_location" { default = "eastus" }  # Can be different
variable "keyvault_location" { default = "eastus2" }

# Remove: location_short (not needed)
# Deprecate: location (becomes directus_location)
```

### 2. **Clean Resource Naming**
```hcl
# OLD: gencolink-prod-eus2-directus
# NEW: gencolink-directus (location in tags, not name)

locals {
  # Project-based naming (clean, portable)
  app_name       = "${var.project_name}-${var.environment}"
  
  # NO location in resource names
  directus_name  = "${local.app_name}-directus"
  storage_name   = "${local.app_name}-storage"
  keyvault_name  = "${local.app_name}-kv"
  swa_name       = "${local.app_name}-frontend"
}
```

### 3. **Enhanced Tagging**
```hcl
locals {
  common_tags = merge(
    var.tags,
    {
      ManagedBy      = "Terraform"
      Environment    = var.environment
      CostCenter     = var.cost_center
      BackupRequired = "true"
      Project        = var.project_name
    }
  )
  
  # Service-specific tags (with location info)
  directus_tags = merge(
    local.common_tags,
    {
      Service  = "CMS"
      Location = var.directus_location
      Tier     = "Critical"
    }
  )
  
  storage_tags = merge(
    local.common_tags,
    {
      Service  = "Storage"
      Location = var.storage_location
      Tier     = "Standard"
    }
  )
}
```

### 4. **Flexible Outputs**
```hcl
output "resource_locations" {
  description = "Where each resource is deployed"
  value = {
    directus  = var.directus_location
    frontend  = var.frontend_location
    storage   = var.storage_location
    keyvault  = var.keyvault_location
  }
}

output "resource_names" {
  description = "All resource names (location-independent)"
  value = {
    directus_app = local.directus_name
    storage_account = local.storage_name
    key_vault = local.keyvault_name
    static_web_app = local.swa_name
  }
}
```

### 5. **GitOps Ready Variables**
```hcl
# For different environments (dev/staging/prod)
variable "environment" {}
variable "project_name" {}
variable "cost_center" {}

# Multi-region configuration
variable "primary_location" { default = "eastus2" }
variable "secondary_location" { default = "westus2" }  # Future HA

# Override per-service locations
variable "directus_location" { default = null }  # Falls back to primary
variable "storage_location" { default = null }
variable "frontend_location" { default = null }

# Post-processed with fallbacks
locals {
  directus_location = var.directus_location ?? var.primary_location
  storage_location = var.storage_location ?? var.primary_location
  frontend_location = var.frontend_location ?? var.primary_location
}
```

---

## Key Improvements

✅ **Location Independence**
- Change region by updating one variable
- No resource name changes needed
- Multi-region ready

✅ **Clean Naming**
- No internal details in names
- Portable across regions
- Easy to understand (gencolink-directus, not gencolink-prod-eus2-directus)

✅ **Enterprise Tags**
- Location visible in tags (not name)
- Cost center tracking
- Backup/tier information
- Service classification

✅ **Flexible Architecture**
- Different services in different regions
- Storage in cheaper region
- Frontend in limited SWA regions
- CMS in performance region

✅ **Future-Proof**
- Easy multi-region disaster recovery
- Blue/green deployments
- Service migration without renaming

---

## Migration Path

1. Add new variables (v1)
2. Update locals with location-independent naming (v1)
3. Update resource definitions (v1)
4. Update outputs and GitHub secrets (v1)
5. Test with `terraform plan` (v1)
6. Apply (v1)

**No resource destruction needed** - Terraform will rename in-place where possible.

---

## Cost Impact

- **No change** - Same resources, same locations
- **Future benefit** - Can optimize storage location (cheaper tiers elsewhere)

---

## Example terraform.tfvars (New Format)

```hcl
project_name     = "gencolink"
environment      = "prod"
cost_center      = "engineering"

# Use defaults (all primary location)
# primary_location = "eastus2"

# OR override per service:
# directus_location = "eastus2"   # Performance
# storage_location  = "eastus"    # Cost optimization
# frontend_location = "westus2"   # SWA region
```

---

## Success Metrics

✅ All resources deploy correctly  
✅ Resource names have NO location  
✅ Can change region with one variable  
✅ GitHub Actions still work  
✅ Multi-region ready  

