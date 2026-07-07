locals {
  resource_suffix = "${var.project_name}-${var.environment}-${var.location_short}"
}

# Container Apps Environment - uses Azure's Microsoft-managed default network.
# No custom VNet/subnet: Directus is public-facing and (since Cosmos DB was
# dropped) has nothing private to reach, so custom networking adds cost/
# complexity with no benefit here.
resource "azurerm_container_app_environment" "main" {
  name                       = "${local.resource_suffix}-cae"
  location                   = var.location
  resource_group_name        = var.resource_group_name
  log_analytics_workspace_id = azurerm_log_analytics_workspace.main.id
  tags                       = var.tags
}

# Log Analytics Workspace (required for Container Apps)
resource "azurerm_log_analytics_workspace" "main" {
  name                = "${local.resource_suffix}-law"
  location            = var.location
  resource_group_name = var.resource_group_name
  sku                 = "PerGB2018"
  retention_in_days   = 30
  tags                = var.tags
}

# Azure Files share (SQLite data file) mounted into the Container Apps environment
resource "azurerm_container_app_environment_storage" "sqlite" {
  name                         = "sqlite-storage"
  container_app_environment_id = azurerm_container_app_environment.main.id
  account_name                 = var.sqlite_storage_account_name
  share_name                   = var.sqlite_file_share_name
  access_key                   = var.sqlite_storage_account_key
  access_mode                  = "ReadWrite"
}

# Directus Container App
resource "azurerm_container_app" "directus" {
  name                         = "${local.resource_suffix}-directus"
  container_app_environment_id = azurerm_container_app_environment.main.id
  resource_group_name          = var.resource_group_name
  revision_mode                = "Single"
  tags                         = var.tags

  dynamic "secret" {
    for_each = var.directus_secrets
    content {
      name  = replace(lower(secret.key), "_", "-")
      value = secret.value
    }
  }

  template {
    container {
      name   = "directus"
      image  = var.directus_image
      cpu    = 0.5
      memory = "1Gi"

      dynamic "env" {
        for_each = var.directus_config
        content {
          name  = env.key
          value = env.value
        }
      }

      dynamic "env" {
        for_each = var.directus_secrets
        content {
          name        = env.key
          secret_name = replace(lower(env.key), "_", "-")
        }
      }

      volume_mounts {
        name = "sqlite-data"
        path = "/directus/database"
      }

      liveness_probe {
        transport               = "HTTP"
        path                    = "/server/health"
        port                    = 8055
        interval_seconds        = 30
        timeout                 = 5
        failure_count_threshold = 3
        initial_delay           = 30
      }

      readiness_probe {
        transport               = "HTTP"
        path                    = "/server/health"
        port                    = 8055
        interval_seconds        = 10
        timeout                 = 3
        failure_count_threshold = 2
      }
    }

    volume {
      name         = "sqlite-data"
      storage_type = "AzureFile"
      storage_name = azurerm_container_app_environment_storage.sqlite.name
    }

    # SQLite supports one writer at a time - do not scale beyond 1 replica or
    # concurrent writes will corrupt/lock the database file.
    min_replicas = 1
    max_replicas = 1

    revision_suffix = formatdate("YYYY-MM-DD-hhmm", timestamp())
  }

  ingress {
    external_enabled = true
    target_port      = 8055

    traffic_weight {
      latest_revision = true
      percentage      = 100
    }
  }

  identity {
    type = "SystemAssigned"
  }
}

# Note: no autoscale rule - Directus is capped at a single replica (see
# max_replicas above) because SQLite only supports one writer at a time.

# Application Insights diagnostic settings.
# Note: targets the Container App *Environment*, not the individual Container
# App - console/system log categories for Container Apps are only exposed at
# the environment scope; the per-app resource supports no log category groups
# at all (Azure API confirms: "supported [category groups] are: ''").
resource "azurerm_monitor_diagnostic_setting" "container_app" {
  count                      = var.enable_app_insights ? 1 : 0
  name                       = "${local.resource_suffix}-directus-diag"
  target_resource_id         = azurerm_container_app_environment.main.id
  log_analytics_workspace_id = azurerm_log_analytics_workspace.main.id

  enabled_log {
    category = "ContainerAppConsoleLogs"
  }

  enabled_log {
    category = "ContainerAppSystemLogs"
  }

  enabled_metric {
    category = "AllMetrics"
  }
}
