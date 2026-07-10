#!/usr/bin/env node
/**
 * Remove duplicate items from collections (keep only 1 of each title)
 * Usage: TARGET_PASS=... node cleanup-duplicates.js
 */

const TARGET_URL = (process.env.TARGET_URL ?? 'https://gencolink-prod-directus.mangopebble-81978e02.eastus2.azurecontainerapps.io').replace(/\/$/, '');
const TARGET_EMAIL = process.env.TARGET_EMAIL ?? 'admin@gencolink.com';
const TARGET_PASS = process.env.TARGET_PASS;

async function request(method, path, body, token) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return fetch(`${TARGET_URL}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

async function authenticate() {
  const res = await request('POST', '/auth/login', { email: TARGET_EMAIL, password: TARGET_PASS });
  if (!res.ok) throw new Error(`Auth failed: ${res.status} ${await res.text()}`);
  const { data } = await res.json();
  return data.access_token;
}

async function getItems(token, collection) {
  const res = await request('GET', `/items/${collection}?limit=-1`, undefined, token);
  if (!res.ok) return [];
  const { data } = await res.json();
  return data || [];
}

async function deleteItem(token, collection, id) {
  const res = await request('DELETE', `/items/${collection}/${id}`, undefined, token);
  if (!res.ok) {
    console.log(`    ⚠ Delete failed for id ${id}: ${res.status}`);
    return false;
  }
  return true;
}

async function main() {
  if (!TARGET_PASS) throw new Error('TARGET_PASS required');

  console.log(`Authenticating to ${TARGET_URL}...`);
  const token = await authenticate();
  console.log('✓ Authenticated\n');

  const collections = ['services', 'products', 'values', 'faqs'];

  for (const collection of collections) {
    console.log(`Processing ${collection}...`);
    const items = await getItems(token, collection);
    console.log(`  Found ${items.length} items`);

    // Group by title, keep only first of each
    const seen = new Set();
    const toDelete = [];

    for (const item of items) {
      const key = item.title || `id-${item.id}`;
      if (seen.has(key)) {
        toDelete.push(item.id);
      } else {
        seen.add(key);
      }
    }

    if (toDelete.length === 0) {
      console.log('  ✓ No duplicates\n');
      continue;
    }

    console.log(`  Found ${toDelete.length} duplicates to delete`);
    for (const id of toDelete) {
      const deleted = await deleteItem(token, collection, id);
      if (deleted) {
        process.stdout.write('.');
      }
    }
    console.log(`\n  ✓ Deleted ${toDelete.length} duplicates\n`);
  }

  console.log('✅ Cleanup complete');
}

main().catch(err => {
  console.error('\n❌ Failed:', err.message);
  process.exit(1);
});
