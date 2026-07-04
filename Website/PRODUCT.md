# Gencolink — PRODUCT.md

## What it is
Marketing site for Gencolink, a software engineering studio in Sri Lanka that builds
custom software, business websites, automation, and management systems for startups and
growing businesses. Single-page Angular 20 app (standalone components, signals).

## Register
Brand. The site *is* the pitch — design carries credibility. Audience: founders and
operators evaluating a build partner. The page's job: make a small studio read as a
trustworthy, capable engineering partner and get the visitor to start a conversation.

## Voice
Grounded, precise, senior. Plain verbs, no hype, no buzzword salad. "We build software
that supports growth" — not "we leverage synergies." Confidence through specificity.

## Design system (committed — preserve)
- **Palette:** `--navy #162162`, `--blue #19428B`, `--signal #0F80CB`, `--paper #FAFAFA`,
  `--ink #0B1330`. Restrained: navy/ink surfaces, signal blue as the single accent.
- **Type:** Space Grotesk (display), Hanken Grotesk (body), JetBrains Mono (labels/data).
- **Motif:** the rotated-square "node" glyph (from the brand mark), used as a bullet /
  divider accent to literalize "Genco-*link*".
- **Hero:** scroll-pinned 192-frame canvas render of a 3D dashboard (GSAP ScrollTrigger).

## Constraints
- Angular strict mode; standalone components + signals + OnPush.
- Content for Services/Products comes from `SiteContentService` (Directus CMS w/ fallback).
- Keep accessibility: visible focus, reduced-motion paths, semantic HTML.
