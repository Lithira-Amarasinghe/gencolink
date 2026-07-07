# GitHub Secrets Setup

Configure these secrets in your GitHub repository for CI/CD to work.

**Location**: Repository → Settings → Secrets and variables → Actions

---

## Required Secrets

### Azure Credentials (for all workflows)

```
AZURE_SUBSCRIPTION_ID
```
**Value**: Your Azure subscription ID  
**How to get**: 
```bash
az account show --query id -o tsv
```

---

```
AZURE_TENANT_ID
```
**Value**: Azure AD tenant ID from service principal  
**How to get**:
```bash
# From Step 1.1 of deployment guide
# Look for "tenant" in service principal output
az ad sp show --id {appId} --query appOwnerOrganizationId -o tsv
```

---

```
AZURE_CLIENT_ID
```
**Value**: Service principal app ID  
**How to get**:
```bash
# From Step 1.1 of deployment guide
# Look for "appId" in service principal output
```

---

```
AZURE_CLIENT_SECRET
```
**Value**: Service principal password  
**How to get**:
```bash
# From Step 1.1 of deployment guide
# This is SENSITIVE - keep secure!
# You can regenerate if lost:
az ad sp credential reset --id {appId}
```

---

### Azure Resource Names (for all workflows)

```
AZURE_RESOURCE_GROUP
```
**Value**: `gencolink-prod-eus-rg`  
**Note**: Terraform creates this automatically

---

```
AZURE_KEY_VAULT_NAME
```
**Value**: Name output by Terraform  
**How to get** (after Terraform):
```bash
terraform output -raw key_vault_name
```

---

```
AZURE_CONTAINER_REGISTRY_NAME
```
**Value**: Container registry name (no `.azurecr.io`)  
**Example**: `gencolinkprodeus`  
**How to get** (after Terraform):
```bash
terraform output -raw container_registry_name
```

---

```
AZURE_SWA_NAME
```
**Value**: Static Web App name  
**Example**: `gencolink-prod-eus-swa`  
**How to get** (after Terraform):
```bash
terraform output -raw static_web_app_name
```

---

```
DIRECTUS_CONTAINER_APP_NAME
```
**Value**: Container App name for Directus  
**Example**: `gencolink-prod-eus-directus`  
**How to get** (after Terraform):
```bash
terraform output -raw container_app_name
```

---

```
AZURE_FUNCTIONS_APP_NAME
```
**Value**: Functions App name  
**Example**: `gencolink-prod-eus-funcapp`  
**How to get** (after Terraform):
```bash
terraform output -raw functions_app_name
```

---

### Frontend Deployment

```
AZURE_SWA_DEPLOYMENT_TOKEN
```
**Value**: Static Web App deployment token  
**How to get** (after Terraform):
```bash
terraform output -raw static_web_app_deployment_token
```

---

```
DIRECTUS_API_URL
```
**Value**: Production Directus API base URL  
**Example**: `https://api.gencolink.com` (or Container App FQDN)  
**How to get** (after Terraform):
```bash
terraform output -raw container_app_fqdn
# Use as: https://{output}
```

---

### Functions Deployment

```
AZURE_FUNCTIONS_PUBLISH_PROFILE
```
**Value**: Functions App publish profile XML  
**How to get** (after Terraform):
```bash
az functionapp deployment list-publishing-credentials \
  --name gencolink-prod-eus-funcapp \
  --resource-group gencolink-prod-eus-rg \
  --xml
```
**Copy the entire XML output** and paste as secret value.

---

## Setup Checklist

```bash
# Step 1: Create service principal (if not already done)
az ad sp create-for-rbac \
  --name "gencolink-github-actions" \
  --role "Contributor" \
  --scopes "/subscriptions/{subscription-id}"
# Output: Save appId, password, tenant

# Step 2: Get subscription ID
az account show --query id -o tsv

# Step 3: Create terraform.tfvars and run Terraform
cd infra/terraform
terraform apply

# Step 4: Get Terraform outputs
terraform output -json

# Step 5: Get publish profile
az functionapp deployment list-publishing-credentials \
  --name gencolink-prod-eus-funcapp \
  --resource-group gencolink-prod-eus-rg \
  --xml > /tmp/publish-profile.xml

# Step 6: Copy-paste into GitHub Secrets
# Go to: https://github.com/{user}/{repo}/settings/secrets/actions
# Add each secret from above
```

---

## Validation

After adding all secrets, run a workflow to validate:

1. Go to GitHub → Actions
2. Click "Infrastructure (Terraform)"
3. Click "Run workflow"
4. Select "main" branch
5. Click "Run workflow"

Expected: Workflow completes successfully (or shows Terraform plan output)

---

## Security Best Practices

✅ **DO**
- [ ] Use strong, randomly-generated passwords for DB and Directus
- [ ] Rotate `AZURE_CLIENT_SECRET` quarterly
- [ ] Use GitHub's secret masking (sensitive values hidden in logs)
- [ ] Keep Terraform state in Azure Storage, not in Git
- [ ] Review GitHub Actions logs for accidental secret exposure

❌ **DON'T**
- [ ] Store passwords in code or commit messages
- [ ] Share secrets via email or Slack
- [ ] Use same password for multiple services
- [ ] Commit `terraform.tfvars` to Git
- [ ] Log secrets in Application Insights

---

## Troubleshooting

### "Invalid service principal credentials"
```bash
# Verify service principal still exists
az ad sp show --id {appId}

# Regenerate credentials if needed
az ad sp credential reset --id {appId}
# Update AZURE_CLIENT_SECRET with new password
```

### "Workflow fails with permission denied"
```bash
# Verify service principal has Contributor role
az role assignment list --all --filter "principalId eq '{objectId}'"

# Grant role if missing
az role assignment create \
  --role "Contributor" \
  --assignee {appId} \
  --scope "/subscriptions/{subscriptionId}"
```

### "Secret not accessible in workflow"
```bash
# Secret must be added BEFORE workflow runs
# Delete workflow run and push again after adding secrets
git commit --allow-empty -m "Trigger workflow after secrets added"
git push origin main
```

---

## Rotating Secrets

### Database Password
```bash
# Update in Key Vault
az keyvault secret set \
  --vault-name gencolink-prod-eus-kv \
  --name db-password \
  --value "NEW_STRONG_PASSWORD"

# Update Directus Container App
az containerapp update \
  --name gencolink-prod-eus-directus \
  --resource-group gencolink-prod-eus-rg \
  --set-env-vars DB_PASSWORD="NEW_STRONG_PASSWORD"

# Update PostgreSQL
psql -h {server}.postgres.database.azure.com \
  -U pgadmin \
  -d directus
# ALTER ROLE pgadmin WITH PASSWORD 'NEW_STRONG_PASSWORD';
```

### Azure Client Secret
```bash
# Generate new secret
az ad sp credential reset --id {appId}
# Output: newCredential.password

# Update GitHub Secret
# Go to: Settings → Secrets → Update AZURE_CLIENT_SECRET
```

### Directus Admin Token
```bash
# Generate new token
python -c "import secrets; print(secrets.token_urlsafe(32))"

# Update Key Vault
az keyvault secret set \
  --vault-name gencolink-prod-eus-kv \
  --name directus-admin-token \
  --value "NEW_TOKEN"

# Restart Container App
az containerapp revision activate \
  --name gencolink-prod-eus-directus \
  --resource-group gencolink-prod-eus-rg \
  --revision {latest}
```

---

## Support

For issues with GitHub Secrets:
- https://docs.github.com/actions/security-guides/encrypted-secrets
- https://github.com/docs/issues

For Azure credential issues:
- https://docs.microsoft.com/azure/developer/github/connect-from-azure
