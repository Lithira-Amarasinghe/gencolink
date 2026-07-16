#!/usr/bin/env node
/**
 * Directus bootstrap — run once after `docker compose up -d` locally, or
 * automatically by the `bootstrap` job in
 * .github/workflows/directus-appservice.yml after the deployed Azure Directus
 * container is up and healthy.
 *
 * Creates every content collection, grants public read (+ create on
 * contact_submissions), seeds initial content, and creates/re-syncs the
 * "Notify on Contact Submission" Flow. Fully idempotent — safe to re-run any
 * number of times; every step skips work that's already done.
 *
 * Usage:
 *   npm install && node setup.js
 *
 * Auth (pick one, checked in this order):
 *   AZURE_KEY_VAULT_NAME           Fetches the "admin-token" secret from this
 *                                   Key Vault via DefaultAzureCredential - no
 *                                   secret ever touches an env var or the
 *                                   Terraform config/state for this script.
 *                                   Works with `az login`, a Managed Identity,
 *                                   or any other credential in the default
 *                                   chain. Used by Terraform.
 *   DIRECTUS_ADMIN_TOKEN           Static API token supplied directly.
 *   ADMIN_EMAIL / ADMIN_PASSWORD   Interactive/local login (default for
 *                                   `docker compose up -d` local dev).
 *
 * Other env overrides:
 *   DIRECTUS_URL       (default: http://localhost:8055)
 *   AZURE_FUNCTION_URL / AZURE_FUNCTION_KEY
 *     Not read by this script directly — the Flow's webhook operation always
 *     points at the Directus-side placeholders {{$env.AZURE_FUNCTION_URL}} /
 *     {{$env.AZURE_FUNCTION_KEY}}, so Directus itself resolves them from its
 *     own environment (see FLOWS_ENV_ALLOW_LIST in both Directus/.env and
 *     Terraform's directus_config). Same Flow config works unchanged in
 *     every environment.
 */

const BASE = (process.env.DIRECTUS_URL ?? 'http://localhost:8055').replace(/\/$/, '');
const EMAIL = process.env.ADMIN_EMAIL ?? 'admin@gencolink.com';
const PASS = process.env.ADMIN_PASSWORD;
const STATIC_TOKEN = process.env.DIRECTUS_ADMIN_TOKEN;
const KEY_VAULT_NAME = process.env.AZURE_KEY_VAULT_NAME;

// Fail fast if we have no way to authenticate at all.
if (!KEY_VAULT_NAME && !STATIC_TOKEN && !PASS && !process.env.DIRECTUS_URL) {
  throw new Error('Set AZURE_KEY_VAULT_NAME, DIRECTUS_ADMIN_TOKEN, or ADMIN_PASSWORD to authenticate.');
}

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

const VALUES = [
  {
    sort: 1,
    title: 'Tailored Solutions',
    body: 'Every business is different. We take the time to understand your requirements and build solutions that align with your goals, processes, and future growth.',
  },
  {
    sort: 2,
    title: 'Quality Engineering',
    body: 'We follow modern development practices to create software that is secure, maintainable, and built with long-term reliability in mind.',
  },
  {
    sort: 3,
    title: 'Built to Scale',
    body: 'Our solutions are designed with flexibility and scalability, making it easier to adapt and grow as your business evolves.',
  },
  {
    sort: 4,
    title: 'Transparent Collaboration',
    body: 'We believe great results come from working together. Throughout every stage of the project, we keep communication open, provide regular updates, and value your feedback.',
  },
  {
    sort: 5,
    title: 'Ongoing Support',
    body: "Our commitment doesn't end at launch. We provide maintenance, improvements, and technical support to help keep your software running smoothly.",
  },
];

const FAQS = [
  {
    sort: 1,
    question: 'Do you work with startups and small businesses?',
    answer:
      'Yes. We enjoy working with startups, entrepreneurs, and growing businesses to transform ideas into practical digital solutions.',
  },
  {
    sort: 2,
    question: 'Can you build software tailored to our business?',
    answer:
      'Absolutely. Every solution we build is designed around your unique requirements, workflows, and business objectives.',
  },
  {
    sort: 3,
    question: 'Do you provide website maintenance and support?',
    answer:
      'Yes. We offer ongoing maintenance, security updates, performance improvements, and technical support for websites and web applications.',
  },
  {
    sort: 4,
    question: 'Can you improve an existing application or website?',
    answer:
      'Yes. We can enhance existing systems by adding new features, improving performance, modernizing the user experience, or resolving technical issues.',
  },
  {
    sort: 5,
    question: 'What happens after the project is completed?',
    answer:
      "We're happy to continue supporting your software with maintenance, enhancements, and technical guidance whenever you need us.",
  },
];

const COMPANY_DETAILS = {
  brandName: 'Gencolink',
  tagline: 'Building software that supports growth, innovation, and lasting value.',
  email: 'hello@gencolink.com',
  phonePrimary: '+94 71 4 280 380',
  phoneSecondary: '+94 77 5 690 380',
  linkedinUrl: 'https://www.linkedin.com',
  githubUrl: 'https://github.com',
  // Left blank on purpose — the website hides a social icon when its URL is empty,
  // so these stay off until an admin adds the real profile URL in the CMS.
  facebookUrl: '',
  instagramUrl: '',
  tiktokUrl: '',
};

const SERVICES_SECTION = {
  eyebrow: 'Our Services',
  heading: 'End-to-end engineering for modern businesses',
  description: 'From strategy to scale, we help you build, integrate, and operate software that drives impact.',
};

const CONTACT_SECTION = {
  eyebrow: "Let's Connect",
  heading: "Let's build something great together",
  description:
    "Whether you're starting a new project, exploring an idea, or looking to improve an existing system, we'd love to hear from you. Share your goals with us, and we'll get back to you within one business day.",
};

const WHY_SECTION = {
  eyebrow: 'Why Choose Gencolink',
  heading: 'A reliable partner for building modern software',
  description:
    'At Gencolink, we believe successful software is built on clear communication, thoughtful engineering, and a genuine understanding of your goals. We focus on delivering practical, scalable solutions while building long-term relationships based on trust and collaboration.',
};

const FAQ_SECTION = {
  eyebrow: 'Frequently Asked Questions',
  heading: 'Everything you might want to know',
};

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
//
// Startup gating follows the standard liveness -> readiness split:
//   1. waitForDirectus()  - LIVENESS.  /server/ping, public, no token. Only
//                           proves the HTTP process answers.
//   2. authenticate()     - obtains the admin token.
//   3. waitForHealthy()   - READINESS. /server/health, needs the token, and
//                           reports the real dependency state (database,
//                           cache, storage). This is what actually tells us
//                           the bootstrap can safely start writing.

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// LIVENESS probe. Deliberately /server/ping, NOT /server/health: Directus 12.x
// denies /server/health to the public role, so an unauthenticated probe gets
// 403 and would spin until timeout even though Directus is up. This runs
// before we hold a token, so the probe must be a public endpoint. Same
// endpoint the App Service health check and the CI liveness gate use.
async function waitForDirectus(maxWaitMs = 180_000) {
  const start = Date.now();
  let lastStatus = 'no response';
  process.stdout.write('Waiting for Directus (liveness)');
  while (Date.now() - start < maxWaitMs) {
    try {
      const res = await fetch(`${BASE}/server/ping`);
      if (res.ok) { console.log(' ready.\n'); return; }
      lastStatus = `HTTP ${res.status}`;
    } catch (err) {
      lastStatus = err.message;
    }
    process.stdout.write('.');
    await sleep(2000);
  }
  // Report what actually went wrong - a bare "not ready" hides an auth/URL
  // problem behind what looks like a slow boot.
  throw new Error(
    `Directus did not become ready in time (${maxWaitMs / 1000}s). ` +
    `Last probe of ${BASE}/server/ping returned: ${lastStatus}`,
  );
}

// Summarises which dependency checks are unhealthy, so a failure names the
// real cause ("database down") instead of just "not healthy".
// NOTE: /server/health is NOT wrapped in Directus's usual {"data": ...}
// envelope - it follows the health-check response format, so "status" and
// "checks" are top-level fields.
function describeChecks(body) {
  const checks = body?.checks ?? {};
  const failing = [];
  for (const [name, entries] of Object.entries(checks)) {
    for (const entry of entries ?? []) {
      if (entry?.status && entry.status !== 'ok') {
        failing.push(`${name}=${entry.status}${entry.output ? ` (${entry.output})` : ''}`);
      }
    }
  }
  return failing.length ? failing.join(', ') : 'no failing checks reported';
}

// READINESS probe. /server/health is a DEEP check - it reports database,
// cache and storage health, unlike /server/ping which only proves the process
// answers. Directus returns status "ok" | "warn" | "error" (HTTP 503 on
// error). Gating on this means a cold or still-connecting database surfaces
// as a retry with a clear reason, rather than as a confusing failure on the
// first real API call. Requires the admin token (public role is denied), so
// it must run after authenticate().
async function waitForHealthy(token, maxWaitMs = 120_000) {
  const start = Date.now();
  let last = 'no response';
  process.stdout.write('Checking Directus health (readiness)');
  while (Date.now() - start < maxWaitMs) {
    try {
      const res = await request('GET', '/server/health', undefined, token);
      const body = await res.json().catch(() => null);
      const status = body?.status;

      if (res.ok && status === 'ok') {
        console.log(' healthy.\n');
        return;
      }
      // "warn" = a dependency is degraded but functional; Directus is serving.
      // EXPECTED on the cheap tiers: Azure SQL Basic regularly exceeds the
      // 150ms mssql:responseTime threshold, so gating strictly on "ok" would
      // never pass. Proceed (the bootstrap is idempotent) but say so.
      if (res.ok && status === 'warn') {
        console.log(' degraded.\n');
        console.log(`  WARN: ${describeChecks(body)}\n`);
        return;
      }
      last = status ? `status="${status}": ${describeChecks(body)}` : `HTTP ${res.status}`;
    } catch (err) {
      last = err.message;
    }
    process.stdout.write('.');
    await sleep(2000);
  }
  throw new Error(
    `Directus is up but never became healthy within ${maxWaitMs / 1000}s. Last: ${last}`,
  );
}

async function authenticate() {
  // Key Vault (preferred for CI): the admin token never touches an env var or
  // any Terraform config/state - only the (non-secret) vault name does.
  // DefaultAzureCredential authenticates with whatever's available: `az login`
  // locally, the GitHub OIDC session in CI, or a Managed Identity in Azure.
  // Not retried: a failure here is a permissions/config problem (the identity
  // needs "Key Vault Secrets User" on the vault), which retrying won't fix -
  // fail fast with the real error instead of burning the timeout.
  if (KEY_VAULT_NAME) {
    const { DefaultAzureCredential } = require('@azure/identity');
    const { SecretClient } = require('@azure/keyvault-secrets');
    const client = new SecretClient(`https://${KEY_VAULT_NAME}.vault.azure.net`, new DefaultAzureCredential());
    const secret = await client.getSecret('admin-token');
    return secret.value;
  }

  // Static token (Directus's ADMIN_TOKEN env var) skips the login round-trip
  // entirely.
  if (STATIC_TOKEN) return STATIC_TOKEN;

  // Login path (local dev). Unlike the two above, this hits Directus - and
  // therefore the database - so it can legitimately fail while the DB is
  // still warming up even though /server/ping already answers. Retry briefly
  // before giving up.
  const maxAttempts = 5;
  let lastError = '';
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const res = await request('POST', '/auth/login', { email: EMAIL, password: PASS });
    if (res.ok) {
      const { data } = await res.json();
      return data.access_token;
    }
    lastError = `${res.status} ${await res.text()}`;
    // 401/403 = wrong credentials; that will never succeed on retry.
    if (res.status === 401 || res.status === 403) break;
    if (attempt < maxAttempts) await sleep(3000);
  }
  throw new Error(`Auth failed: ${lastError}`);
}

// ─── Collection builders ───────────────────────────────────────────────────────

async function collectionExists(token, name) {
  const res = await request('GET', `/collections/${name}`, undefined, token);
  return res.ok;
}

async function fieldExists(token, collection, field) {
  const res = await request('GET', `/fields/${collection}/${field}`, undefined, token);
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

async function ensureValuesCollection(token) {
  if (await collectionExists(token, 'values')) {
    console.log('  values — already exists, skipping.');
    return;
  }

  await createCollection(token, 'values', {
    icon: 'workspace_premium',
    sort_field: 'sort',
    note: 'Value cards shown in the "Why Choose Gencolink" section of the website.',
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
      field: 'title',
      type: 'string',
      schema: {},
      meta: { interface: 'input', width: 'full' },
    },
    {
      field: 'body',
      type: 'text',
      schema: {},
      meta: { interface: 'input-multiline', width: 'full', note: 'One or two sentences describing this value.' },
    },
  ];

  for (const f of fields) {
    await createField(token, 'values', f);
  }

  console.log('  values — created with 4 fields (sort, status, title, body).');
}

async function ensureFaqsCollection(token) {
  if (await collectionExists(token, 'faqs')) {
    console.log('  faqs — already exists, skipping.');
    return;
  }

  await createCollection(token, 'faqs', {
    icon: 'quiz',
    sort_field: 'sort',
    note: 'Questions and answers shown in the "Frequently Asked Questions" section of the website.',
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
      field: 'question',
      type: 'string',
      schema: {},
      meta: { interface: 'input', width: 'full' },
    },
    {
      field: 'answer',
      type: 'text',
      schema: {},
      meta: { interface: 'input-multiline', width: 'full' },
    },
  ];

  for (const f of fields) {
    await createField(token, 'faqs', f);
  }

  console.log('  faqs — created with 4 fields (sort, status, question, answer).');
}

async function ensureWhySectionCollection(token) {
  if (await collectionExists(token, 'why_section')) {
    console.log('  why_section — already exists, skipping.');
    return;
  }

  await createCollection(token, 'why_section', {
    icon: 'workspace_premium',
    singleton: true,
    note: 'Eyebrow, heading, and intro text for the "Why Choose Gencolink" section.',
  });

  const fields = [
    { field: 'eyebrow', type: 'string', schema: {}, meta: { interface: 'input', width: 'full' } },
    { field: 'heading', type: 'string', schema: {}, meta: { interface: 'input', width: 'full' } },
    {
      field: 'description',
      type: 'text',
      schema: {},
      meta: { interface: 'input-multiline', width: 'full', note: 'Intro paragraph shown next to the heading.' },
    },
  ];

  for (const f of fields) {
    await createField(token, 'why_section', f);
  }

  console.log('  why_section — created with 3 fields (eyebrow, heading, description).');
}

async function ensureFaqSectionCollection(token) {
  if (await collectionExists(token, 'faq_section')) {
    console.log('  faq_section — already exists, skipping.');
    return;
  }

  await createCollection(token, 'faq_section', {
    icon: 'quiz',
    singleton: true,
    note: 'Eyebrow and heading for the "Frequently Asked Questions" section.',
  });

  const fields = [
    { field: 'eyebrow', type: 'string', schema: {}, meta: { interface: 'input', width: 'full' } },
    { field: 'heading', type: 'string', schema: {}, meta: { interface: 'input', width: 'full' } },
  ];

  for (const f of fields) {
    await createField(token, 'faq_section', f);
  }

  console.log('  faq_section — created with 2 fields (eyebrow, heading).');
}

async function ensureServicesSectionCollection(token) {
  if (await collectionExists(token, 'services_section')) {
    console.log('  services_section — already exists, skipping.');
    return;
  }

  await createCollection(token, 'services_section', {
    icon: 'design_services',
    singleton: true,
    note: 'Eyebrow, heading, and intro text for the "Our Services" section.',
  });

  const fields = [
    { field: 'eyebrow', type: 'string', schema: {}, meta: { interface: 'input', width: 'full' } },
    { field: 'heading', type: 'string', schema: {}, meta: { interface: 'input', width: 'full' } },
    {
      field: 'description',
      type: 'text',
      schema: {},
      meta: { interface: 'input-multiline', width: 'full', note: 'Intro line shown next to the heading.' },
    },
  ];

  for (const f of fields) {
    await createField(token, 'services_section', f);
  }

  console.log('  services_section — created with 3 fields (eyebrow, heading, description).');
}

async function ensureContactSectionCollection(token) {
  if (await collectionExists(token, 'contact_section')) {
    console.log('  contact_section — already exists, skipping.');
    return;
  }

  await createCollection(token, 'contact_section', {
    icon: 'mail',
    singleton: true,
    note: 'Eyebrow, heading, and intro text for the "Contact" section.',
  });

  const fields = [
    { field: 'eyebrow', type: 'string', schema: {}, meta: { interface: 'input', width: 'full' } },
    { field: 'heading', type: 'string', schema: {}, meta: { interface: 'input', width: 'full' } },
    {
      field: 'description',
      type: 'text',
      schema: {},
      meta: { interface: 'input-multiline', width: 'full', note: 'Intro line shown above the contact form.' },
    },
  ];

  for (const f of fields) {
    await createField(token, 'contact_section', f);
  }

  console.log('  contact_section — created with 3 fields (eyebrow, heading, description).');
}

const COMPANY_DETAILS_FIELDS = [
  { field: 'brandName', type: 'string', schema: {}, meta: { interface: 'input', width: 'half', note: 'Shown in the header and footer.' } },
  { field: 'tagline', type: 'string', schema: {}, meta: { interface: 'input', width: 'half' } },
  { field: 'email', type: 'string', schema: {}, meta: { interface: 'input', width: 'half' } },
  { field: 'phonePrimary', type: 'string', schema: {}, meta: { interface: 'input', width: 'half' } },
  { field: 'phoneSecondary', type: 'string', schema: {}, meta: { interface: 'input', width: 'half' } },
  { field: 'linkedinUrl', type: 'string', schema: {}, meta: { interface: 'input', width: 'half', note: 'Full URL. Leave blank to hide the icon.' } },
  { field: 'githubUrl', type: 'string', schema: {}, meta: { interface: 'input', width: 'half', note: 'Full URL. Leave blank to hide the icon.' } },
  { field: 'facebookUrl', type: 'string', schema: {}, meta: { interface: 'input', width: 'half', note: 'Full URL. Leave blank to hide the icon.' } },
  { field: 'instagramUrl', type: 'string', schema: {}, meta: { interface: 'input', width: 'half', note: 'Full URL. Leave blank to hide the icon.' } },
  { field: 'tiktokUrl', type: 'string', schema: {}, meta: { interface: 'input', width: 'half', note: 'Full URL. Leave blank to hide the icon.' } },
];

async function ensureCompanyDetailsCollection(token) {
  if (await collectionExists(token, 'company_details')) {
    // Collection already exists (e.g. from an earlier setup run) — backfill any fields
    // that were added since, such as new social links, without touching the rest.
    let added = 0;
    for (const f of COMPANY_DETAILS_FIELDS) {
      if (!(await fieldExists(token, 'company_details', f.field))) {
        await createField(token, 'company_details', f);
        added++;
      }
    }
    console.log(
      added > 0
        ? `  company_details — added ${added} new field(s).`
        : '  company_details — already exists, skipping.',
    );
    return;
  }

  await createCollection(token, 'company_details', {
    icon: 'apartment',
    singleton: true,
    note: 'Brand name, tagline, contact details, and social links shown across the site (mainly the header and footer).',
  });

  for (const f of COMPANY_DETAILS_FIELDS) {
    await createField(token, 'company_details', f);
  }

  console.log(`  company_details — created with ${COMPANY_DETAILS_FIELDS.length} fields (brand, tagline, email, phones, social links).`);
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

// Singleton collections have exactly one implicit row; PATCH upserts it (Directus
// creates the row on first write). Skip if an admin already set `checkField`, so
// re-runs never clobber edits made in the CMS.
async function seedSingletonIfEmpty(token, collection, fields, checkField = 'heading') {
  const res = await request('GET', `/items/${collection}`, undefined, token);
  const data = res.ok ? (await res.json()).data : null;
  if (data?.[checkField]) {
    console.log(`  ${collection} — already configured, skipping seed.`);
    return;
  }

  const patchRes = await request('PATCH', `/items/${collection}`, fields, token);
  if (!patchRes.ok) throw new Error(`Seed singleton "${collection}" failed: ${await patchRes.text()}`);
  console.log(`  ${collection} — seeded initial content.`);
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

// The webhook operation always points at Directus's own env-var placeholders
// rather than a literal URL/key, so the identical Flow config works unchanged
// across local dev and every deployed environment — only Directus's own
// AZURE_FUNCTION_URL / AZURE_FUNCTION_KEY settings differ (see
// FLOWS_ENV_ALLOW_LIST in Directus/.env and Terraform's directus_config).
const FLOW_OPERATION_OPTIONS = {
  url: '{{$env.AZURE_FUNCTION_URL}}',
  method: 'POST',
  headers: [{ header: 'x-functions-key', value: '{{$env.AZURE_FUNCTION_KEY}}' }],
  body: JSON.stringify({
    name: '{{$trigger.payload.name}}',
    email: '{{$trigger.payload.email}}',
    company: '{{$trigger.payload.company}}',
    message: '{{$trigger.payload.message}}',
  }),
};

async function ensureContactFlow(token) {
  const res = await request('GET', '/flows?filter[name][_eq]=Notify on Contact Submission', undefined, token);
  const { data } = await res.json();

  if (data?.length) {
    // Flow already exists — re-sync its operation to the current placeholder
    // form on every run. Covers flows created before this script wrote
    // placeholders directly (previously handled by a separate Terraform
    // provisioner script) and self-heals any manual edit in the Directus UI.
    await syncFlowOperation(token);
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
      options: FLOW_OPERATION_OPTIONS,
    },
    token,
  );
  if (!opRes.ok) throw new Error(`Create flow operation failed: ${await opRes.text()}`);

  // Set the flow's first operation
  await request('PATCH', `/flows/${flow.id}`, { operation: (await opRes.json()).data.id }, token);

  console.log('  contact flow — created (trigger: items.create on contact_submissions).');
}

async function syncFlowOperation(token) {
  const res = await request('GET', '/operations?filter[key][_eq]=call_azure_email', undefined, token);
  if (!res.ok) throw new Error(`List flow operation failed: ${await res.text()}`);
  const { data } = await res.json();

  if (!data.length) {
    console.log('  contact flow — exists but operation "call_azure_email" is missing, skipping sync.');
    return;
  }

  const operation = data[0];
  const alreadyInSync =
    operation.options?.url === FLOW_OPERATION_OPTIONS.url &&
    operation.options?.headers?.[0]?.value === FLOW_OPERATION_OPTIONS.headers[0].value;

  if (alreadyInSync) {
    console.log('  contact flow — already exists and in sync, skipping.');
    return;
  }

  const patchRes = await request(
    'PATCH',
    `/operations/${operation.id}`,
    { options: { ...operation.options, url: FLOW_OPERATION_OPTIONS.url, headers: FLOW_OPERATION_OPTIONS.headers } },
    token,
  );
  if (!patchRes.ok) throw new Error(`Sync flow operation failed: ${await patchRes.text()}`);

  console.log('  contact flow — re-synced webhook operation to current env-var placeholders.');
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  await waitForDirectus();

  console.log('Authenticating...');
  const token = await authenticate();
  console.log('  OK\n');

  await waitForHealthy(token);

  console.log('Setting up collections...');
  await ensureServicesCollection(token);
  await ensureProductsCollection(token);
  await ensureValuesCollection(token);
  await ensureFaqsCollection(token);
  await ensureWhySectionCollection(token);
  await ensureFaqSectionCollection(token);
  await ensureServicesSectionCollection(token);
  await ensureContactSectionCollection(token);
  await ensureCompanyDetailsCollection(token);
  await ensureContactSubmissionsCollection(token);
  console.log();

  console.log('Configuring public access...');
  await ensurePublicRead(token, 'services');
  await ensurePublicRead(token, 'products');
  await ensurePublicRead(token, 'values');
  await ensurePublicRead(token, 'faqs');
  await ensurePublicRead(token, 'why_section');
  await ensurePublicRead(token, 'faq_section');
  await ensurePublicRead(token, 'services_section');
  await ensurePublicRead(token, 'contact_section');
  await ensurePublicRead(token, 'company_details');
  await ensurePublicCreate(token, 'contact_submissions');
  console.log();

  console.log('Seeding content...');
  await seedIfEmpty(token, 'services', SERVICES.map((r) => ({ ...r, status: 'published' })));
  await seedIfEmpty(token, 'products', PRODUCTS.map((r) => ({ ...r, status: 'published' })));
  await seedIfEmpty(token, 'values', VALUES.map((r) => ({ ...r, status: 'published' })));
  await seedIfEmpty(token, 'faqs', FAQS.map((r) => ({ ...r, status: 'published' })));
  await seedSingletonIfEmpty(token, 'why_section', WHY_SECTION);
  await seedSingletonIfEmpty(token, 'faq_section', FAQ_SECTION);
  await seedSingletonIfEmpty(token, 'services_section', SERVICES_SECTION);
  await seedSingletonIfEmpty(token, 'contact_section', CONTACT_SECTION);
  await seedSingletonIfEmpty(token, 'company_details', COMPANY_DETAILS, 'brandName');
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
