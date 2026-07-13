// Points the "Notify on Contact Submission" Flow's webhook operation at
// {{$env.AZURE_FUNCTION_URL}} / {{$env.AZURE_FUNCTION_KEY}} instead of a
// hardcoded URL/key, so the same Flow config works unchanged in every
// environment (local, prod) - only the env vars differ. Run by Terraform
// (null_resource.sync_directus_flow) after every apply, so it's idempotent
// and never needs manual editing in the Directus UI.
const directusUrl = process.env.DIRECTUS_URL;
const adminToken = process.env.DIRECTUS_ADMIN_TOKEN;

async function fetchWithRetry(url, options, attempts = 10, delayMs = 5000) {
  for (let i = 1; i <= attempts; i++) {
    try {
      const res = await fetch(url, options);
      if (res.ok) return res;
      if (i === attempts) return res;
    } catch (err) {
      if (i === attempts) throw err;
    }
    console.log(`Directus not ready yet, retrying (${i}/${attempts})...`);
    await new Promise((r) => setTimeout(r, delayMs));
  }
}

async function main() {
  if (!directusUrl || !adminToken) {
    throw new Error('DIRECTUS_URL and DIRECTUS_ADMIN_TOKEN must be set');
  }

  const listRes = await fetchWithRetry(
    `${directusUrl}/operations?filter[key][_eq]=call_azure_email`,
    { headers: { Authorization: `Bearer ${adminToken}` } }
  );
  if (!listRes.ok) {
    throw new Error(`Failed to list operations: ${listRes.status} ${await listRes.text()}`);
  }

  const { data } = await listRes.json();
  if (!data.length) {
    console.log('Operation "call_azure_email" not found - skipping (create the Flow once in Directus first)');
    return;
  }

  const operation = data[0];
  const patch = {
    options: {
      ...operation.options,
      url: '{{$env.AZURE_FUNCTION_URL}}',
      headers: [{ header: 'x-functions-key', value: '{{$env.AZURE_FUNCTION_KEY}}' }],
    },
  };

  const patchRes = await fetch(`${directusUrl}/operations/${operation.id}`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${adminToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(patch),
  });

  if (!patchRes.ok) {
    throw new Error(`Failed to update flow operation: ${patchRes.status} ${await patchRes.text()}`);
  }

  console.log('Directus Flow webhook now uses {{$env.AZURE_FUNCTION_URL}} / {{$env.AZURE_FUNCTION_KEY}}');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
