const BASE = 'http://localhost:8055';
const EMAIL = 'admin@gencolink.com';
const PASS = 'GencoCMS2025!';

async function request(method, path, body, token) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined
  });
  if (!res.ok) throw new Error(`${method} ${path}: ${res.status}`);
  return res.json();
}

async function main() {
  console.log('Authenticating...');
  const auth = await request('POST', '/auth/login', { email: EMAIL, password: PASS }, null);
  const token = auth.data.access_token;
  console.log('✓ Authenticated\n');

  const collections = ['services', 'products', 'values', 'faqs', 'company_details'];
  const data = {};

  for (const col of collections) {
    try {
      const res = await request('GET', `/items/${col}`, null, token);
      data[col] = res.data;
      console.log(`✓ ${col}: ${res.data.length} items`);
    } catch (e) {
      console.log(`⚠ ${col}: ${e.message}`);
    }
  }

  console.log('\n=== EXTRACTED DATA ===\n');
  console.log(JSON.stringify(data, null, 2));
}

main().catch(e => console.error('Error:', e.message));
