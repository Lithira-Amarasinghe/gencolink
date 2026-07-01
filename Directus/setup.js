#!/usr/bin/env node
/**
 * Directus bootstrap — run once after `docker compose up -d`.
 *
 * Creates the `services` and `products` collections, grants public read access,
 * and seeds initial content. Safe to re-run (skips existing items).
 *
 * Usage:
 *   node setup.js
 *
 * Optional env overrides:
 *   DIRECTUS_URL     (default: http://localhost:8055)
 *   ADMIN_EMAIL      (default: admin@gencolink.com)
 *   ADMIN_PASSWORD   (default: GencoCMS2025!)
 */

const BASE = (process.env.DIRECTUS_URL ?? 'http://localhost:8055').replace(/\/$/, '');
const EMAIL = process.env.ADMIN_EMAIL ?? 'admin@gencolink.com';
const PASS = process.env.ADMIN_PASSWORD ?? 'GencoCMS2025!';

// ─── Seed data ────────────────────────────────────────────────────────────────

const SERVICES = [
  {
    sort: 1,
    icon: 'code',
    title: 'Web Design and Development',
    body: 'Professional websites, landing pages, custom web apps, and ongoing maintenance.',
    items: [
      'Personal Portfolio Websites',
      'Corporate and Company Websites',
      'Landing Pages',
      'Custom Web Applications',
      'Website Maintenance',
    ],
  },
  {
    sort: 2,
    icon: 'workflow',
    title: 'eCommerce Solutions',
    body: 'Online stores and commerce operations with payments, inventory, and marketplace support.',
    items: [
      'Online Store Development',
      'Payment Gateway Integration',
      'Order Management Systems',
      'Inventory Management',
      'Multi-Vendor Platforms',
    ],
  },
  {
    sort: 3,
    icon: 'workflow',
    title: 'Business Process Automation',
    body: 'Automation tools that reduce manual work and make approvals, CRM, and reporting easier.',
    items: [
      'Workflow Automation',
      'CRM Solutions',
      'Approval Systems',
      'Reporting Dashboards',
      'Custom Automation Tools',
    ],
  },
  {
    sort: 4,
    icon: 'data',
    title: 'Retail Management Systems',
    body: 'Retail platforms for point of sale, stock control, purchasing, and branch operations.',
    items: [
      'POS Systems',
      'Inventory Management',
      'Sales and Purchase Tracking',
      'Customer Management',
      'Multi-Branch Management',
    ],
  },
  {
    sort: 5,
    icon: 'data',
    title: 'Restaurant Management Systems',
    body: 'Restaurant operations software for POS, reservations, orders, billing, and kitchen workflows.',
    items: [
      'Restaurant POS Systems',
      'Table Reservation Systems',
      'Order and Billing Management',
      'Kitchen Display Systems',
      'Menu and Inventory Management',
    ],
  },
  {
    sort: 6,
    icon: 'cloud',
    title: 'Supply Chain Management Solutions',
    body: 'Supply chain tools for suppliers, warehouses, procurement, and connected operations.',
    items: ['Supplier Management', 'Warehouse Management', 'Procurement Management'],
  },
  {
    sort: 7,
    icon: 'globe',
    title: 'Hotel and Tourism Solutions',
    body: 'Digital systems for hotels, travel agencies, bookings, tour packages, and guest handling.',
    items: [
      'Hotel Management Systems',
      'Booking and Reservation Platforms',
      'Travel Agency Software',
      'Tour Package Management',
      'Guest Management Systems',
    ],
  },
  {
    sort: 8,
    icon: 'shield',
    title: 'Healthcare and Fitness Solutions',
    body: 'Clinic, pharmacy, appointment, patient record, and gym management systems.',
    items: [
      'Clinic Management Systems',
      'Appointment Scheduling',
      'Patient Record Management',
      'Pharmacy Management',
      'Gym Management Systems',
    ],
  },
  {
    sort: 9,
    icon: 'cloud',
    title: 'Education Technology Solutions',
    body: 'Learning and school management platforms for institutions, exams, and e-learning.',
    items: [
      'Learning Management Systems',
      'School Management Systems',
      'Student Information Systems',
      'Online Examination Systems',
      'E-Learning Platforms',
    ],
  },
  {
    sort: 10,
    icon: 'code',
    title: 'Custom Software Development',
    body: 'Tailor-made software, SaaS products, APIs, and enterprise-grade web or mobile applications.',
    items: [
      'Tailor-Made Business Applications',
      'SaaS Product Development',
      'Web and Mobile Applications',
      'API Development and Integration',
      'Enterprise Software Solutions',
    ],
  },
];

const PRODUCTS = [
  {
    sort: 1,
    icon: 'workflow',
    title: 'LinkOps',
    body: 'Platform for observability, alerts, and incident management.',
  },
  {
    sort: 2,
    icon: 'data',
    title: 'DataLink',
    body: 'Data integration and pipelines for modern analytics.',
  },
  {
    sort: 3,
    icon: 'lock',
    title: 'AuthLink',
    body: 'Secure authentication and user management made simple.',
  },
  {
    sort: 4,
    icon: 'globe',
    title: 'FlowLink',
    body: 'Workflow automation for operations and approvals.',
  },
];

// ─── HTTP helper ──────────────────────────────────────────────────────────────

async function request(method, path, body, token) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

// ─── Wait / Auth ──────────────────────────────────────────────────────────────

async function waitForDirectus(maxWaitMs = 60_000) {
  const start = Date.now();
  process.stdout.write('Waiting for Directus');
  while (Date.now() - start < maxWaitMs) {
    try {
      const res = await fetch(`${BASE}/server/health`);
      if (res.ok) { console.log(' ready.\n'); return; }
    } catch { /* not up yet */ }
    process.stdout.write('.');
    await new Promise((r) => setTimeout(r, 2000));
  }
  throw new Error('Directus did not become ready in time.');
}

async function authenticate() {
  const res = await request('POST', '/auth/login', { email: EMAIL, password: PASS });
  if (!res.ok) throw new Error(`Auth failed: ${res.status} ${await res.text()}`);
  const { data } = await res.json();
  return data.access_token;
}

// ─── Collection builders ───────────────────────────────────────────────────────

async function collectionExists(token, name) {
  const res = await request('GET', `/collections/${name}`, undefined, token);
  return res.ok;
}

async function createCollection(token, name, meta) {
  const res = await request('POST', '/collections', { collection: name, schema: { name }, meta }, token);
  if (!res.ok) throw new Error(`Create collection "${name}" failed: ${await res.text()}`);
}

async function createField(token, collection, fieldDef) {
  const res = await request('POST', `/fields/${collection}`, fieldDef, token);
  if (!res.ok) throw new Error(`Create field "${fieldDef.field}" on "${collection}" failed: ${await res.text()}`);
}

async function ensureServicesCollection(token) {
  if (await collectionExists(token, 'services')) {
    console.log('  services — already exists, skipping.');
    return;
  }

  await createCollection(token, 'services', {
    icon: 'design_services',
    sort_field: 'sort',
    note: 'Items shown in the "What We Do" section of the website.',
  });

  const fields = [
    {
      field: 'sort',
      type: 'integer',
      schema: {},
      meta: { interface: 'input', hidden: true, width: 'half' },
    },
    {
      field: 'status',
      type: 'string',
      schema: { default_value: 'published' },
      meta: {
        interface: 'select-dropdown',
        width: 'half',
        options: { choices: [{ text: 'Visible', value: 'published' }, { text: 'Hidden', value: 'draft' }] },
        display: 'labels',
        display_options: {
          choices: [
            { text: 'Visible', value: 'published', foreground: '#087443', background: '#d1fae5' },
            { text: 'Hidden', value: 'draft', foreground: '#b42318', background: '#fee2e2' },
          ],
        },
      },
    },
    {
      field: 'icon',
      type: 'string',
      schema: {},
      meta: {
        interface: 'select-dropdown',
        width: 'half',
        options: {
          choices: [
            { text: 'Code', value: 'code' },
            { text: 'Workflow', value: 'workflow' },
            { text: 'Data / Database', value: 'data' },
            { text: 'Cloud', value: 'cloud' },
            { text: 'Globe', value: 'globe' },
            { text: 'Shield', value: 'shield' },
          ],
        },
      },
    },
    {
      field: 'title',
      type: 'string',
      schema: {},
      meta: { interface: 'input', width: 'full' },
    },
    {
      field: 'body',
      type: 'text',
      schema: {},
      meta: { interface: 'input-multiline', width: 'full', note: 'Short description shown collapsed.' },
    },
    {
      field: 'items',
      type: 'json',
      schema: {},
      meta: {
        interface: 'tags',
        width: 'full',
        note: 'Sub-items shown when the card is expanded. Press Enter to add each item.',
      },
    },
  ];

  for (const f of fields) {
    await createField(token, 'services', f);
  }

  console.log('  services — created with 5 fields (sort, icon, title, body, items).');
}

async function ensureProductsCollection(token) {
  if (await collectionExists(token, 'products')) {
    console.log('  products — already exists, skipping.');
    return;
  }

  await createCollection(token, 'products', {
    icon: 'inventory_2',
    sort_field: 'sort',
    note: 'Items shown in the "Our Products" section of the website.',
  });

  const fields = [
    {
      field: 'sort',
      type: 'integer',
      schema: {},
      meta: { interface: 'input', hidden: true, width: 'half' },
    },
    {
      field: 'status',
      type: 'string',
      schema: { default_value: 'published' },
      meta: {
        interface: 'select-dropdown',
        width: 'half',
        options: { choices: [{ text: 'Visible', value: 'published' }, { text: 'Hidden', value: 'draft' }] },
        display: 'labels',
        display_options: {
          choices: [
            { text: 'Visible', value: 'published', foreground: '#087443', background: '#d1fae5' },
            { text: 'Hidden', value: 'draft', foreground: '#b42318', background: '#fee2e2' },
          ],
        },
      },
    },
    {
      field: 'icon',
      type: 'string',
      schema: {},
      meta: {
        interface: 'select-dropdown',
        width: 'half',
        options: {
          choices: [
            { text: 'Workflow', value: 'workflow' },
            { text: 'Data / Database', value: 'data' },
            { text: 'Lock', value: 'lock' },
            { text: 'Globe', value: 'globe' },
          ],
        },
      },
    },
    {
      field: 'title',
      type: 'string',
      schema: {},
      meta: { interface: 'input', width: 'full' },
    },
    {
      field: 'body',
      type: 'text',
      schema: {},
      meta: { interface: 'input-multiline', width: 'full', note: 'One-line product description.' },
    },
  ];

  for (const f of fields) {
    await createField(token, 'products', f);
  }

  console.log('  products — created with 4 fields (sort, icon, title, body).');
}

// ─── Permissions ──────────────────────────────────────────────────────────────

async function ensurePublicRead(token, collection) {
  const res = await request(
    'GET',
    `/permissions?filter[collection][_eq]=${collection}&filter[action][_eq]=read&filter[role][_null]=true`,
    undefined,
    token,
  );
  const { data } = await res.json();

  if (data?.length) {
    // Patch to ensure all fields are allowed
    await request('PATCH', `/permissions/${data[0].id}`, { fields: '*' }, token);
    console.log(`  ${collection} — public read permission updated.`);
    return;
  }

  const createRes = await request(
    'POST',
    '/permissions',
    { role: null, collection, action: 'read', fields: '*' },
    token,
  );
  if (!createRes.ok) throw new Error(`Create permission for "${collection}" failed: ${await createRes.text()}`);
  console.log(`  ${collection} — public read permission granted.`);
}

// ─── Seeding ──────────────────────────────────────────────────────────────────

async function seedIfEmpty(token, collection, rows) {
  const res = await request('GET', `/items/${collection}?limit=1`, undefined, token);
  const { data } = await res.json();
  if (data?.length) {
    console.log(`  ${collection} — already has data, skipping seed.`);
    return;
  }

  const createRes = await request('POST', `/items/${collection}`, rows, token);
  if (!createRes.ok) throw new Error(`Seed "${collection}" failed: ${await createRes.text()}`);
  console.log(`  ${collection} — seeded ${rows.length} rows.`);
}

// ─── Contact submissions collection ───────────────────────────────────────────

async function ensureContactSubmissionsCollection(token) {
  if (await collectionExists(token, 'contact_submissions')) {
    console.log('  contact_submissions — already exists, skipping.');
    return;
  }

  await createCollection(token, 'contact_submissions', {
    icon: 'mail',
    note: 'Submissions from the website contact form.',
  });

  const fields = [
    {
      field: 'submitted_at',
      type: 'timestamp',
      schema: { default_value: 'now()' },
      meta: { interface: 'datetime', readonly: true, width: 'half', display: 'datetime' },
    },
    {
      field: 'status',
      type: 'string',
      schema: { default_value: 'new' },
      meta: {
        interface: 'select-dropdown',
        width: 'half',
        options: {
          choices: [
            { text: 'New', value: 'new' },
            { text: 'In Progress', value: 'in_progress' },
            { text: 'Closed', value: 'closed' },
          ],
        },
      },
    },
    {
      field: 'name',
      type: 'string',
      schema: {},
      meta: { interface: 'input', width: 'half' },
    },
    {
      field: 'email',
      type: 'string',
      schema: {},
      meta: { interface: 'input', width: 'half' },
    },
    {
      field: 'company',
      type: 'string',
      schema: {},
      meta: { interface: 'input', width: 'full' },
    },
    {
      field: 'message',
      type: 'text',
      schema: {},
      meta: { interface: 'input-multiline', width: 'full' },
    },
  ];

  for (const f of fields) {
    await createField(token, 'contact_submissions', f);
  }

  console.log('  contact_submissions — created with 6 fields.');
}

async function ensurePublicCreate(token, collection) {
  const res = await request(
    'GET',
    `/permissions?filter[collection][_eq]=${collection}&filter[action][_eq]=create&filter[role][_null]=true`,
    undefined,
    token,
  );
  const { data } = await res.json();

  if (data?.length) {
    console.log(`  ${collection} — public create permission already set.`);
    return;
  }

  const createRes = await request(
    'POST',
    '/permissions',
    { role: null, collection, action: 'create', fields: ['name', 'email', 'company', 'message'] },
    token,
  );
  if (!createRes.ok) throw new Error(`Create permission for "${collection}" failed: ${await createRes.text()}`);
  console.log(`  ${collection} — public create permission granted.`);
}

// ─── Directus Flow: notify via Azure Function on new submission ────────────────

// When running locally, Directus is inside Docker and cannot reach localhost on the host.
// Use the Docker bridge gateway IP (172.19.0.1) or your deployed Azure Function URL.
const AZURE_FUNCTION_URL = process.env.AZURE_FUNCTION_URL ?? 'http://host.docker.internal:7071/api/send-contact-email';
const AZURE_FUNCTION_KEY = process.env.AZURE_FUNCTION_KEY ?? 'REPLACE_WITH_YOUR_AZURE_FUNCTION_KEY';

async function ensureContactFlow(token) {
  // Check if a flow for contact_submissions already exists
  const res = await request('GET', '/flows?filter[name][_eq]=Notify on Contact Submission', undefined, token);
  const { data } = await res.json();

  if (data?.length) {
    console.log('  contact flow — already exists, skipping.');
    return;
  }

  // Create the flow (event trigger on contact_submissions item.create)
  const flowRes = await request(
    'POST',
    '/flows',
    {
      name: 'Notify on Contact Submission',
      status: 'active',
      trigger: 'event',
      options: {
        type: 'action',
        scope: ['items.create'],
        collections: ['contact_submissions'],
      },
    },
    token,
  );
  if (!flowRes.ok) throw new Error(`Create flow failed: ${await flowRes.text()}`);
  const { data: flow } = await flowRes.json();

  // Create the webhook operation that calls the Azure Function
  const opRes = await request(
    'POST',
    '/operations',
    {
      name: 'Call Azure Email Function',
      key: 'call_azure_email',
      type: 'request',
      position_x: 19,
      position_y: 1,
      flow: flow.id,
      resolve: null,
      reject: null,
      options: {
        url: AZURE_FUNCTION_URL,
        method: 'POST',
        headers: [{ header: 'x-functions-key', value: AZURE_FUNCTION_KEY }],
        body: JSON.stringify({
          name: '{{$trigger.payload.name}}',
          email: '{{$trigger.payload.email}}',
          company: '{{$trigger.payload.company}}',
          message: '{{$trigger.payload.message}}',
        }),
      },
    },
    token,
  );
  if (!opRes.ok) throw new Error(`Create flow operation failed: ${await opRes.text()}`);

  // Set the flow's first operation
  await request('PATCH', `/flows/${flow.id}`, { operation: (await opRes.json()).data.id }, token);

  console.log('  contact flow — created (trigger: items.create on contact_submissions).');
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  await waitForDirectus();

  console.log('Authenticating...');
  const token = await authenticate();
  console.log('  OK\n');

  console.log('Setting up collections...');
  await ensureServicesCollection(token);
  await ensureProductsCollection(token);
  await ensureContactSubmissionsCollection(token);
  console.log();

  console.log('Configuring public access...');
  await ensurePublicRead(token, 'services');
  await ensurePublicRead(token, 'products');
  await ensurePublicCreate(token, 'contact_submissions');
  console.log();

  console.log('Seeding content...');
  await seedIfEmpty(token, 'services', SERVICES.map((r) => ({ ...r, status: 'published' })));
  await seedIfEmpty(token, 'products', PRODUCTS.map((r) => ({ ...r, status: 'published' })));
  console.log();

  console.log('Setting up contact notification flow...');
  await ensureContactFlow(token);
  console.log();

  console.log(`Done. Open ${BASE}/admin to manage content.`);
}

main().catch((err) => {
  console.error('\nSetup failed:', err.message);
  process.exit(1);
});
