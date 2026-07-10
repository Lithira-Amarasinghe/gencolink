#!/usr/bin/env node
/**
 * Migrate data from local Directus to Azure Directus
 * Copies all collections + data from source to target
 *
 * Usage:
 *   SOURCE_URL=http://localhost:8055 SOURCE_PASS=GencoCMS2025! \
 *   TARGET_URL=https://gencolink-prod-directus.azurecontainerapps.io TARGET_PASS=... \
 *   node migrate-data.js
 */

const SOURCE_URL = (process.env.SOURCE_URL ?? 'http://localhost:8055').replace(/\/$/, '');
const SOURCE_EMAIL = process.env.SOURCE_EMAIL ?? 'admin@gencolink.com';
const SOURCE_PASS = process.env.SOURCE_PASS;

const TARGET_URL = (process.env.TARGET_URL ?? 'https://gencolink-prod-directus.azurecontainerapps.io').replace(/\/$/, '');
const TARGET_EMAIL = process.env.TARGET_EMAIL ?? 'admin@gencolink.com';
const TARGET_PASS = process.env.TARGET_PASS;

const COLLECTIONS = ['services', 'products', 'values', 'faqs', 'why_section', 'faq_section', 'services_section', 'contact_section', 'company_details'];

async function request(method, path, body, token, baseUrl) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return fetch(`${baseUrl}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

async function authenticate(baseUrl, email, pass) {
  const res = await request('POST', '/auth/login', { email, password: pass }, undefined, baseUrl);
  if (!res.ok) throw new Error(`Auth failed: ${res.status} ${await res.text()}`);
  const { data } = await res.json();
  return data.access_token;
}

async function fetchItems(token, collection, baseUrl) {
  const res = await request('GET', `/items/${collection}?limit=-1`, undefined, token, baseUrl);
  if (!res.ok) throw new Error(`Fetch ${collection} failed: ${await res.text()}`);
  const { data } = await res.json();
  return data || [];
}

async function insertItems(token, collection, items, baseUrl) {
  if (!items.length) return;
  const res = await request('POST', `/items/${collection}`, items, token, baseUrl);
  if (!res.ok) throw new Error(`Insert ${collection} failed: ${await res.text()}`);
  return res.json();
}

async function main() {
  if (!SOURCE_PASS || !TARGET_PASS) {
    throw new Error('SOURCE_PASS and TARGET_PASS env vars required');
  }

  console.log(`Authenticating to source (${SOURCE_URL})...`);
  const sourceToken = await authenticate(SOURCE_URL, SOURCE_EMAIL, SOURCE_PASS);
  console.log('  ✓ Source authenticated\n');

  console.log(`Authenticating to target (${TARGET_URL})...`);
  const targetToken = await authenticate(TARGET_URL, TARGET_EMAIL, TARGET_PASS);
  console.log('  ✓ Target authenticated\n');

  console.log('Migrating collections...');
  for (const collection of COLLECTIONS) {
    const items = await fetchItems(sourceToken, collection, SOURCE_URL);
    if (items.length === 0) {
      console.log(`  ${collection} — no data to migrate`);
      continue;
    }

    // Remove ID fields to let target generate new ones
    const itemsToInsert = items.map(item => {
      const { id, ...rest } = item;
      return rest;
    });

    await insertItems(targetToken, collection, itemsToInsert, TARGET_URL);
    console.log(`  ${collection} — migrated ${items.length} rows`);
  }

  console.log('\n✅ Migration complete');
}

main().catch(err => {
  console.error('\n❌ Migration failed:', err.message);
  process.exit(1);
});
