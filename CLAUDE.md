# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Is

AA Mastery is a single-page web app for training AA Team paralegals in legal document review, privilege analysis, and e-discovery workflows. It is deployed at https://aa-mastery.vercel.app via Vercel.

## Running Locally

There is no build step. Serve the static file directly:

```bash
python -m http.server 8000
# or
npx serve .
```

Then open `http://localhost:8000`.

## Deploying

Push to `main` — Vercel auto-deploys. All routes are rewritten to `index.html` via `vercel.json`.

## Architecture

The entire application lives in a single file: `index.html` (~5,500 lines of inline CSS and JavaScript). There is no framework, no bundler, and no npm dependencies — only Axios loaded via CDN.

**Pages (14 total):** Navigation is managed by `nav(p)`, which hides all `page-*` divs and shows the requested one. Pages include: home dashboard, privilege reference (9 tabs), flashcards, quiz, leaderboard, escalation chains, withhold codes, eDis playbook, proxy calls, foreign review, mock Relativity simulator, admin panel, and leadership tools.

**Backend:** Supabase (PostgreSQL + GoTrue auth). All API calls go through the `SB` module — ~30 methods wrapping Axios calls to the Supabase REST and Auth APIs. Config constants (`SUPABASE_URL`, `SUPABASE_ANON_KEY`, `ADMIN_EMAIL`, `SITE_URL`, `LEADERSHIP_EMAILS`, `LEADERSHIP_NAMES`) are hardcoded near the top of the `<script>` block.

**Auth flow:** Email/password, magic links, and optional MFA/TOTP via Supabase GoTrue. Session tokens are stored in `SB.token`. Leadership and admin features are gated by checking the signed-in user's email against `LEADERSHIP_EMAILS` / `ADMIN_EMAIL`.

**Key module boundaries in the JS (use the section comments to navigate):**
- `SB.*` — Supabase auth + CRUD wrappers
- `quiz-*` / `initQuizPage()` — 161-question adaptive quiz; scores stored in `quiz_scores` table
- `rel-*` — Mock Relativity shell (3-panel e-discovery simulator, Joba v. Bukando case)
- `plog-*` — Privilege log modal
- `rdx-*` — Redaction workflow modal
- `ev-*` — Mock Everlaw coding interface
- `loadTimesheets()` / `loadPayments()` / `loadTactical()` — Leadership-only data views

**Supabase tables:** `quiz_scores`, `timesheets`, `payments`, `tactical`

## Styling

Dark theme with CSS custom properties. Key tokens: `--gold` (#d4a82a), `--sapphire` (#0a2463), `--emerald` (#004d40), `--dark` (#080c12), `--card` (#0e1420). Mobile breakpoint at 600px.

## HTML Escaping

All dynamic content inserted into the DOM must go through `esc(v)` (HTML body) or `escAttr(v)` (attribute values). Never use raw string interpolation for user-controlled or database-sourced values.
