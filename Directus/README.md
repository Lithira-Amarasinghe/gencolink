# Directus CMS

Headless CMS for the Gencolink website. Controls every section's heading/copy, the
Services/Products/Values/FAQ lists, and company contact details — without requiring a
frontend redeploy.

## First-time setup

### 1. Start Directus

```bash
cd Directus
docker compose up -d
```

The `.env` file is already configured. Directus will be available at `http://localhost:8055`.

### 2. Bootstrap the collections

Run the setup script once after the container starts (requires Node 18+). It's safe to
re-run any time (e.g. after pulling changes that add new collections) — it skips
anything that already exists and never overwrites content an admin has already edited.

```bash
node setup.js
```

This will:
- Create all list collections (`services`, `products`, `values`, `faqs`) and singleton
  section collections (see below)
- Grant public (unauthenticated) read access so the website can fetch content
- Seed each collection with the content that matches the website defaults

### 3. Open the admin panel

Go to `http://localhost:8055/admin` and log in with the `ADMIN_EMAIL` /
`ADMIN_PASSWORD` values from your local `.env` (not committed to git — see
`.env.example` for the format).

> Never commit real credentials to this README or any other tracked file.
> Rotate `ADMIN_PASSWORD` in `.env` before sharing this environment with
> anyone, and always use a distinct, generated password for production.

---

## Editing content

In the Directus admin panel, go to **Content**.

**List collections** (Services, Products, Values, Faqs) show one row per item, with a
**Visible / Hidden** status toggle and a drag handle for reordering (`sort`).

**Singleton collections** (everything below with "section" or "details" in the name)
show a single settings-style form instead of a list — there's only ever one of these per
site, so there's nothing to add or reorder.

Changes appear on the website on the next page load — no rebuild or redeploy needed.

### Services (`services`)

| Field | Notes |
|---|---|
| `title` | Service name |
| `body` | Short description shown collapsed |
| `items` | Sub-items shown when expanded (tag list) |
| `icon` | One of `code` `workflow` `data` `cloud` `globe` `shield` |

### Products (`products`)

| Field | Notes |
|---|---|
| `title` | Product name |
| `body` | One-line description |
| `icon` | One of `workflow` `data` `lock` `globe` |

### Values (`values`) — items in the "Why Choose Gencolink" section

| Field | Notes |
|---|---|
| `title` | Value name, e.g. "Tailored Solutions" |
| `body` | One or two sentences explaining it |

### FAQs (`faqs`)

| Field | Notes |
|---|---|
| `question` | The question shown in the accordion |
| `answer` | The answer shown when expanded |

### Section headers (singletons)

Each of these controls the eyebrow/heading/intro copy for one section — the content
*around* the list above, not the list items themselves.

| Collection | Section | Fields |
|---|---|---|
| `services_section` | "Our Services" | `eyebrow`, `heading`, `description` |
| `why_section` | "Why Choose Gencolink" | `eyebrow`, `heading`, `description` |
| `faq_section` | "Frequently Asked Questions" | `eyebrow`, `heading` |
| `contact_section` | "Contact" | `eyebrow`, `heading`, `description` |

### Company details (`company_details`) — singleton

Brand name, tagline, and contact info shown in the header and footer.

| Field | Notes |
|---|---|
| `brandName` | Shown in the header logo and footer |
| `tagline` | Footer tagline, under the logo |
| `email` | Used for the footer "mailto:" link |
| `phonePrimary` / `phoneSecondary` | Displayed as-is; the site strips spaces automatically to build the `tel:` link, so type it however reads best (e.g. `+94 71 4 280 380`) |
| `linkedinUrl` / `githubUrl` / `facebookUrl` / `instagramUrl` / `tiktokUrl` | Full URLs for the footer social icons. Leave any of these blank to hide that icon — nothing shows for an empty field. |

---

## How the integration works

```
Directus (port 8055)
    └── GET /items/{services,products,values,faqs,
                     why_section,faq_section,services_section,contact_section,
                     company_details}
            ↓
    Website/public/runtime-config.js   ← edit this file to change the CMS URL
            ↓
    Angular SiteContentService          ← fetches on app start, falls back to defaults
            ↓
    services() / products() / values() / faqs() / whySection() / faqSection() /
    servicesSection() / contactSection() / companyDetails() signals
            ↓
    app.html template renders the sections
```

The Angular app reads `window.__DIRECTUS_URL__` from `runtime-config.js` at startup. To
point to a different Directus instance (e.g. a production server), update that one file —
no Angular rebuild required. If Directus is unreachable, or a collection is empty, the
website falls back to the built-in defaults in `SiteContentService`.

---

## Production notes

- Set `PUBLIC_URL` in `.env` to your public Directus domain.
- `CORS_ORIGIN=true` allows all origins (fine for public read-only data). Restrict it to your website domain for stricter security.
- The SQLite database is stored in `./database/data.db` — back this file up regularly.
- Uploads are stored in `./uploads/`.
