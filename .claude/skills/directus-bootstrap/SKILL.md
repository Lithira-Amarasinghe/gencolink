---
name: directus-bootstrap
description: Start the Directus CMS locally and bootstrap its collections/seed data for Gencolink. Use when Directus isn't running yet, when /items/site_content returns empty/missing, or when the user asks to "start Directus" or "set up the CMS".
disable-model-invocation: true
---

Directus lives in `Directus/` and requires a one-time bootstrap after first start — this is not automatic.

1. Confirm `Directus/.env` exists. If it doesn't, copy `Directus/.env.example` to `Directus/.env` and tell the user to fill in `KEY`/`SECRET`/`ADMIN_PASSWORD` before continuing — never invent or copy real secret values into it yourself.
2. From `Directus/`, run `docker compose up -d` to start the Directus container (SQLite backend, port 8055).
3. Wait for the container to report healthy, then run `node setup.js` from `Directus/` **exactly once** — this bootstraps the `site_content` collection, sets public read permissions, and seeds initial content. Re-running it against an already-bootstrapped instance may create duplicate data, so check with the user first if collections already appear to exist.
4. Confirm it worked by fetching `http://localhost:8055/items/site_content` (should return JSON, not a 403/404).
5. Admin login is at `http://localhost:8055/admin` — credentials are documented in `Directus/README.md`. Don't paste them into chat, logs, or other files.

If the user is also working on the Website, remind them that `Website/public/runtime-config.js` must point `window.__DIRECTUS_URL__` at this instance for local integration testing.
