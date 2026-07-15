# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repo structure

This is a multi-project repo, not a single app:

- **`Directus/`** — Directus 10.13.1 headless CMS, run via Docker Compose, SQLite backend. Manages "What We Do" and "Our Products" content so the website can be updated without redeploys.
- **`Website/`** — Angular 20 (standalone components, signals) frontend, project name `gencolink`.
- **`functions/`** — Azure Functions (JS, Node ≥18). Single HTTP function `send-contact-email` using `@azure/communication-email`. It's triggered by a **Directus Flow** (webhook on the `contact_submissions` collection) — this wiring lives in Directus config, not in code, so grepping `functions/` alone won't reveal the trigger.

Integration flow: Directus `GET /items/site_content` → `Website/public/runtime-config.js` (sets `window.__DIRECTUS_URL__`) → Angular `SiteContentService` (falls back to defaults if the fetch fails). **`runtime-config.js` is the only place to change the CMS URL for prod** — no rebuild needed, easy to miss.

## Setup / running each project

- **Directus**: `docker compose up -d` from `Directus/`, then run `node setup.js` once to bootstrap collections/seed data — this is a manual, one-time step, not automatic.
- **Website**: standard Angular CLI — `npm start` (`ng serve`), `npm run build`, `npm test` (Karma/Jasmine via Puppeteer). No lint script configured.
- **functions**: `npm start` runs `func start` (requires Azure Functions Core Tools). `npm run build` is a no-op (`echo`) — plain JS, no build step.

No CI is configured for this repo yet.

## Code style (Website/)

- Prettier config is inline in `Website/package.json`: `printWidth: 100`, `singleQuote: true`; HTML files use `parser: angular`.
- `tsconfig.json` is strict: `strict`, `noImplicitOverride`, `noPropertyAccessFromIndexSignature`, `noImplicitReturns`, `noFallthroughCasesInSwitch`, plus Angular `strictTemplates`, `strictInjectionParameters`, `strictInputAccessModifiers`. Don't loosen these.

## Secrets — do not expose

- `Directus/.env` contains real dev secrets. It's excluded via `Directus/.gitignore`, and a `.git/hooks/pre-commit` hook blocks commits that stage it — don't weaken either without flagging it to the user.
- Never put real credentials in tracked files (READMEs, docs, tfvars.example, compose files). Local secrets live only in gitignored files (`Directus/.env`, `functions/local.settings.json`, `infra/terraform/terraform.tfvars`); Azure secrets are Terraform-generated into Key Vault. Point docs at those, never inline the values.

## Ignore these when exploring/committing

`Website/qa-screenshot.mjs` and `.playwright-mcp/` session dumps are disposable manual-QA artifacts, not part of the app — don't treat them as reference material. `.playwright-mcp/` is gitignored; don't commit new dumps.

## Skills

Two user-triggered skills exist under `.claude/skills/` (both `disable-model-invocation: true`, so they only run via explicit slash command, never auto-invoked):
- `/directus-bootstrap` — starts Directus via Docker Compose and runs the one-time `setup.js` bootstrap.
- `/functions-local-dev` — bootstraps `functions/local.settings.json` from the example file and runs `func start`.
