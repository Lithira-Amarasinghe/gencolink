# Azure OIDC Setup for GitHub Actions

GitHub Actions needs 3 secrets to authenticate to Azure. These must be created BEFORE deploying.

## Step 1: Create Azure Service Principal

```bash
az ad sp create-for-rbac \
  --name "gencolink-github-actions" \
  --role Contributor \
  --scopes /subscriptions/YOUR_SUBSCRIPTION_ID
```

**Output:**
```json
{
  "appId": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
  "displayName": "gencolink-github-actions",
  "password": "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
  "tenant": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
}
```

Save these values.

## Step 2: Get Your Subscription ID

```bash
az account show --query id -o tsv
```

## Step 3: Add GitHub Secrets

1. Go to GitHub → Your Repository → Settings → Secrets and variables → Actions
2. Click "New repository secret"
3. Add these 3 secrets:

| Secret Name | Value |
|---|---|
| `AZURE_CLIENT_ID` | appId from Step 1 |
| `AZURE_TENANT_ID` | tenant from Step 1 |
| `AZURE_SUBSCRIPTION_ID` | Output from Step 2 |

## Verify

```bash
# Test Azure login from GitHub Actions
az login --service-principal \
  -u $AZURE_CLIENT_ID \
  -p $AZURE_CLIENT_SECRET \
  --tenant $AZURE_TENANT_ID
```

**Done.** GitHub Actions can now deploy to Azure.

---

## Reference

- Azure CLI Docs: https://learn.microsoft.com/en-us/cli/azure/ad/sp
- GitHub OIDC: https://docs.github.com/en/actions/deployment/security-hardening-your-deployments/about-security-hardening-with-openid-connect
