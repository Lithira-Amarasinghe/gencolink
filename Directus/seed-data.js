#!/usr/bin/env node
/**
 * Populate Azure Directus with sample data from local instance
 * Extracted from: http://localhost:8055
 *
 * Usage:
 *   TARGET_URL=https://gencolink-prod-directus.azurecontainerapps.io \
 *   TARGET_PASS=... \
 *   node seed-data.js
 */

const TARGET_URL = (process.env.TARGET_URL ?? 'https://gencolink-prod-directus.azurecontainerapps.io').replace(/\/$/, '');
const TARGET_EMAIL = process.env.TARGET_EMAIL ?? 'admin@gencolink.com';
const TARGET_PASS = process.env.TARGET_PASS;

// ─── DATA FROM LOCAL DIRECTUS ─────────────────────────────────────────────

const SERVICES = [
  { sort: 1, icon: 'code', title: 'Web Design and Development', body: 'Professional websites, landing pages, custom web apps, and ongoing maintenance.', items: '["Personal Portfolio Websites","Corporate and Company Websites","Landing Pages","Custom Web Applications","Website Maintenance"]', status: 'draft' },
  { sort: 2, icon: 'workflow', title: 'eCommerce Solutions', body: 'Online stores and commerce operations with payments, inventory, and marketplace support.', items: '["Online Store Development","Payment Gateway Integration","Order Management Systems","Inventory Management","Multi-Vendor Platforms"]', status: 'draft' },
  { sort: 4, icon: 'data', title: 'Retail Management Systems', body: 'Retail platforms for point of sale, stock control, purchasing, and branch operations.', items: '["POS Systems","Inventory Management","Sales and Purchase Tracking","Customer Management","Multi-Branch Management"]', status: 'draft' },
  { sort: 5, icon: 'data', title: 'Restaurant Management Systems', body: 'Restaurant operations software for POS, reservations, orders, billing, and kitchen workflows.', items: '["Restaurant POS Systems","Table Reservation Systems","Order and Billing Management","Kitchen Display Systems","Menu and Inventory Management"]', status: 'draft' },
  { sort: 6, icon: 'cloud', title: 'Supply Chain Management Solutions', body: 'Supply chain tools for suppliers, warehouses, procurement, and connected operations.', items: '["Supplier Management","Warehouse Management","Procurement Management"]', status: 'draft' },
  { sort: 7, icon: 'globe', title: 'Hotel and Tourism Solutions', body: 'Digital systems for hotels, travel agencies, bookings, tour packages, and guest handling.', items: '["Hotel Management Systems","Booking and Reservation Platforms","Travel Agency Software","Tour Package Management","Guest Management Systems"]', status: 'draft' },
  { sort: 8, icon: 'shield', title: 'Healthcare and Fitness Solutions', body: 'Clinic, pharmacy, appointment, patient record, and gym management systems.', items: '["Clinic Management Systems","Appointment Scheduling","Patient Record Management","Pharmacy Management","Gym Management Systems"]', status: 'draft' },
  { sort: 9, icon: 'cloud', title: 'Education Technology Solutions', body: 'Learning and school management platforms for institutions, exams, and e-learning.', items: '["Learning Management Systems","School Management Systems","Student Information Systems","Online Examination Systems","E-Learning Platforms"]', status: 'draft' },
  { sort: 10, icon: 'code', title: 'Custom Software Development', body: 'Tailor-made software, SaaS products, APIs, and enterprise-grade web or mobile applications.', items: '["Tailor-Made Business Applications","SaaS Product Development","Web and Mobile Applications","API Development and Integration","Enterprise Software Solutions"]', status: 'draft' },
  { sort: 11, icon: 'globe', title: 'Business Websites', body: 'Professional, responsive websites designed to establish your online presence, showcase your brand, and help your business attract more customers.', items: '["Corporate Websites","Responsive Design","SEO-Optimised Pages","Brand Identity Integration","Contact & Lead Forms"]', status: 'published' },
  { sort: 12, icon: 'code', title: 'Personal Portfolio Websites', body: 'Custom portfolio websites for professionals, freelancers, creatives, and job seekers to showcase their work, skills, and achievements.', items: '["Creative Portfolio Sites","Freelancer Profiles","Resume & CV Websites","Project Showcases","Personal Branding"]', status: 'published' },
  { sort: 13, icon: 'workflow', title: 'Business Process Automation', body: 'Automate repetitive tasks and streamline workflows to improve efficiency, reduce manual work, and increase productivity.', items: '["Workflow Automation","Task Scheduling","CRM Integration","Approval Pipelines","Reporting Dashboards"]', status: 'published' },
  { sort: 14, icon: 'data', title: 'Business Management Systems', body: 'Custom software solutions for managing business operations, including inventory, sales, employee management, customer records, reporting, and more.', items: '["Inventory Management","Sales Tracking","Employee Management","Customer Records","Business Reporting"]', status: 'published' },
  { sort: 15, icon: 'code', title: 'Landing Pages', body: 'High-converting landing pages designed for marketing campaigns, product launches, lead generation, and promotional events.', items: '["Campaign Landing Pages","Product Launch Pages","Lead Generation Pages","Promotional Event Pages","A/B Test Ready Designs"]', status: 'published' },
  { sort: 16, icon: 'shield', title: 'Website Maintenance & Support', body: 'Keep your website secure, updated, and running smoothly with regular maintenance, performance optimization, backups, and technical support.', items: '["Security Updates","Performance Optimisation","Regular Backups","Bug Fixes","Technical Support"]', status: 'published' },
  { sort: 17, icon: 'code', title: 'Custom Software Solutions', body: 'Tailor-made web and desktop applications built to solve unique business challenges and support your company\'s growth.', items: '["Bespoke Web Applications","Desktop Applications","API Development","Third-Party Integrations","Enterprise Solutions"]', status: 'published' },
  { sort: 18, icon: 'workflow', title: 'Mini Projects & MVP Development', body: 'Fast and affordable development of small applications, prototypes, and Minimum Viable Products (MVPs) to bring ideas to life.', items: '["Rapid Prototyping","MVP Development","Proof of Concept Builds","Small Business Tools","Idea Validation Apps"]', status: 'published' },
];

const PRODUCTS = [
  { sort: 1, icon: 'workflow', title: 'LinkOps', body: 'Platform for observability, alerts, and incident management.', status: 'published' },
  { sort: 2, icon: 'data', title: 'DataLink', body: 'Data integration and pipelines for modern analytics.', status: 'published' },
  { sort: 3, icon: 'lock', title: 'AuthLink', body: 'Secure authentication and user management made simple.', status: 'published' },
  { sort: 4, icon: 'globe', title: 'FlowLink', body: 'Workflow automation for operations and approvals.', status: 'published' },
];

const VALUES = [
  { sort: 1, status: 'published', title: 'Tailored Solutions', body: 'Every business is different. We take the time to understand your requirements and build solutions that align with your goals, processes, and future growth.' },
  { sort: 2, status: 'published', title: 'Quality Engineering', body: 'We follow modern development practices to create software that is secure, maintainable, and built with long-term reliability in mind.' },
  { sort: 3, status: 'published', title: 'Built to Scale', body: 'Our solutions are designed with flexibility and scalability, making it easier to adapt and grow as your business evolves.' },
  { sort: 4, status: 'published', title: 'Transparent Collaboration', body: 'We believe great results come from working together. Throughout every stage of the project, we keep communication open, provide regular updates, and value your feedback.' },
  { sort: 5, status: 'draft', title: 'Ongoing Support', body: 'Our commitment doesn\'t end at launch. We provide maintenance, improvements, and technical support to help keep your software running smoothly.' },
];

const FAQS = [
  { sort: 1, status: 'published', question: 'Do you work with startups and small businesses?', answer: 'Yes. We enjoy working with startups, entrepreneurs, and growing businesses to transform ideas into practical digital solutions.' },
  { sort: 2, status: 'published', question: 'Can you build software tailored to our business?', answer: 'Absolutely. Every solution we build is designed around your unique requirements, workflows, and business objectives.' },
  { sort: 3, status: 'published', question: 'Do you provide website maintenance and support?', answer: 'Yes. We offer ongoing maintenance, security updates, performance improvements, and technical support for websites and web applications.' },
  { sort: 4, status: 'published', question: 'Can you improve an existing application or website?', answer: 'Yes. We can enhance existing systems by adding new features, improving performance, modernizing the user experience, or resolving technical issues.' },
  { sort: 5, status: 'published', question: 'What happens after the project is completed?', answer: 'We\'re happy to continue supporting your software with maintenance, enhancements, and technical guidance whenever you need us.' },
];

const COMPANY_DETAILS = {
  brandName: 'Gencolink',
  tagline: 'Building software that supports growth, innovation, and lasting value.',
  email: 'hello@gencolink.com',
  phonePrimary: '+94 71 4 280 380',
  phoneSecondary: '+94 77 5 690 380',
  linkedinUrl: 'https://www.linkedin.com',
  githubUrl: 'https://github.com',
  facebookUrl: null,
  instagramUrl: null,
  tiktokUrl: null,
};

// ─── HTTP helper ──────────────────────────────────────────────────────────

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

async function getExistingItems(token, collection) {
  const res = await request('GET', `/items/${collection}?limit=-1`, undefined, token);
  if (!res.ok) return [];
  const { data } = await res.json();
  return data || [];
}

async function insertItems(token, collection, items) {
  if (!items.length) return 0;

  const existing = await getExistingItems(token, collection);
  // Check by title + sort (more robust duplicate detection)
  const existingKeys = new Set(existing.map(item => `${item.title || ''}|${item.sort || ''}`));

  const toInsert = items.filter(item => {
    const key = `${item.title || ''}|${item.sort || ''}`;
    return !existingKeys.has(key);
  });

  if (!toInsert.length) return 0;

  const res = await request('POST', `/items/${collection}`, toInsert, token);
  if (!res.ok) throw new Error(`Insert ${collection} failed: ${await res.text()}`);
  return toInsert.length;
}

async function upsertSingleton(token, collection, data) {
  const res = await request('PATCH', `/items/${collection}`, data, token);
  if (!res.ok) throw new Error(`Upsert ${collection} failed: ${await res.text()}`);
  return res.json();
}

// ─── Main ─────────────────────────────────────────────────────────────────

async function main() {
  if (!TARGET_PASS) {
    throw new Error('TARGET_PASS env var required');
  }

  console.log(`Authenticating to ${TARGET_URL}...`);
  const token = await authenticate();
  console.log('  ✓ Authenticated\n');

  console.log('Populating data...');

  let inserted = await insertItems(token, 'services', SERVICES);
  if (inserted > 0) console.log(`  services — inserted ${inserted} rows`);
  else console.log('  services — already has all data, skipping');

  inserted = await insertItems(token, 'products', PRODUCTS);
  if (inserted > 0) console.log(`  products — inserted ${inserted} rows`);
  else console.log('  products — already has all data, skipping');

  inserted = await insertItems(token, 'values', VALUES);
  if (inserted > 0) console.log(`  values — inserted ${inserted} rows`);
  else console.log('  values — already has all data, skipping');

  inserted = await insertItems(token, 'faqs', FAQS);
  if (inserted > 0) console.log(`  faqs — inserted ${inserted} rows`);
  else console.log('  faqs — already has all data, skipping');

  await upsertSingleton(token, 'company_details', COMPANY_DETAILS);
  console.log('  company_details — upserted');

  console.log('\n✅ Seeding complete');
}

main().catch(err => {
  console.error('\n❌ Seeding failed:', err.message);
  process.exit(1);
});
