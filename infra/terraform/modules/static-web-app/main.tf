locals {
  # Clean naming: location-independent (no location in name)
  app_name = "${var.project_name}-${var.environment}"
}

# Note: Azure Static Web App deployment integration with GitHub is set up
# through the Azure portal or GitHub Actions workflow, not pure Terraform.
# This resource creates the SWA; GitHub Actions handles the deployment.

resource "azurerm_static_web_app" "main" {
  name                = "${local.app_name}-frontend"
  location            = var.location
  resource_group_name = var.resource_group_name
  sku_tier            = "Free"
  sku_size            = "Free"
  tags                = var.tags
}

# App settings (frontend build injects runtime-config.js instead - see
# .github/workflows/frontend.yml) - no separate config resource needed.

# Bind custom domain (update with your actual domain)
# Note: Requires DNS CNAME/TXT records to be set up manually
# resource "azurerm_static_web_app_custom_domain" "main" {
#   static_web_app_id = azurerm_static_web_app.main.id
#   domain_name       = "gencolink.com"
# }

# Custom domain (uncomment once DNS CNAME/TXT records point to the SWA default hostname —
# applying this before DNS is configured fails validation)
# resource "azurerm_static_web_app_custom_domain" "www" {
#   static_web_app_id = azurerm_static_web_app.main.id
#   domain_name       = "www.gencolink.com"
#   validation_type   = "cname-delegation"
# }
