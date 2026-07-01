# Directus CMS

Headless CMS for the Gencolink website. Controls the **What We Do** (services) and **Our Products** sections without requiring a frontend redeploy.

## First-time setup

### 1. Start Directus

```bash
cd Directus
docker compose up -d
```

The `.env` file is already configured. Directus will be available at `http://localhost:8055`.

### 2. Bootstrap the collection

Run the setup script once after the container starts (requires Node 18+):

```bash
node setup.js
```

This will:
- Create the `site_content` collection with `services` and `products` JSON fields
- Grant public (unauthenticated) read access so the website can fetch content
- Seed the initial content that matches the website defaults

### 3. Open the admin panel

Go to `http://localhost:8055/admin` and log in with:

- **Email:** admin@gencolink.com
- **Password:** GencoCMS2025!

> Change the password in `.env` for any shared or production environment.

---

## Editing content

In the Directus admin panel, navigate to **Content → site_content → (the item)**.

Edit the `services` or `products` JSON fields. The website will reflect changes immediately on the next page load — no rebuild or redeploy needed.

### Services JSON shape

```json
[
  {
    "icon": "code",
    "title": "Service Name",
    "body": "Short description shown collapsed.",
    "items": ["Sub-item 1", "Sub-item 2"]
  }
]
```

Valid icon values: `code` `workflow` `data` `cloud` `globe` `shield`

### Products JSON shape

```json
[
  {
    "icon": "workflow",
    "title": "Product Name",
    "body": "One-line description."
  }
]
```

Valid icon values: `workflow` `data` `lock` `globe`

---

## How the integration works

```
Directus (port 8055)
    └── GET /items/site_content
            ↓
    Website/public/runtime-config.js   ← edit this file to change the CMS URL
            ↓
    Angular SiteContentService          ← fetches on app start, falls back to defaults
            ↓
    services() / products() signals
            ↓
    app.html template renders the sections
```

The Angular app reads `window.__DIRECTUS_URL__` from `runtime-config.js` at startup. To point to a different Directus instance (e.g. a production server), update that one file — no Angular rebuild required.

---

## Production notes

- Set `PUBLIC_URL` in `.env` to your public Directus domain.
- `CORS_ORIGIN=true` allows all origins (fine for public read-only data). Restrict it to your website domain for stricter security.
- The SQLite database is stored in `./database/data.db` — back this file up regularly.
- Uploads are stored in `./uploads/`.
