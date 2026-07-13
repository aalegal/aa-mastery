# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Is

AA Mastery is a single-page web app for training AA Team paralegals in legal document review, privilege analysis, and e-discovery workflows. Deployed at https://aa-mastery.vercel.app via Vercel.

## Running Locally

No build step. Serve the static file directly:

```bash
python -m http.server 8000
# or
npx serve .
```

Then open `http://localhost:8000`.

## Deploying

Push to `main` — Vercel auto-deploys. All routes are rewritten to `index.html` via `vercel.json` (except `og-image.png`).

## Architecture

The entire application is a single file: `index.html` (~5,500 lines of inline CSS and JavaScript). No framework, no bundler, no npm — only Axios loaded via CDN.

**Pages (15 total):** Navigation is managed by `nav(p)` (line ~2635), which hides all `page-*` divs and shows the requested one. Page IDs: `home`, `reference`, `flashcards`, `quiz`, `leaderboard`, `escalation`, `withhold`, `playbook`, `proxy`, `other-projects`, `foreign-review`, `projects`, `timesheets`, `leadership`, `admin`.

**Backend:** Supabase (PostgreSQL + GoTrue auth). All API calls go through the `SB` object (line ~2590) — ~30 methods wrapping Axios calls to the Supabase REST and Auth APIs. Config constants (`SUPABASE_URL`, `SUPABASE_ANON_KEY`, `ADMIN_EMAIL`, `SITE_URL`, `LEADERSHIP_EMAILS`, `LEADERSHIP_NAMES`) are hardcoded near the top of the `<script>` block.

**Auth flow:** Email/password, magic links, and optional MFA/TOTP via Supabase GoTrue. Session token is stored in `SB.token`. Leadership and admin features are gated by `isLeadership(u)` (line ~2582), which checks email against `LEADERSHIP_EMAILS` and display name against `LEADERSHIP_NAMES`.

**Key module boundaries (use the `// ══` section comments to navigate):**
- `SB.*` (~line 2590) — Supabase auth + CRUD wrappers
- `nav(p)` (~line 2635) — page routing; triggers `initQuizPage()`, `loadTimesheets()`, `loadTactical()` on navigation
- `esc(v)` / `escAttr(v)` (~line 3278) — XSS escaping; must be used for all dynamic DOM content
- `// JOBA v. BUKANDO — MOCK RELATIVITY ENGINE` (~line 3127) — 3-panel e-discovery simulator; state in `relCoding`, `relAnswered`, `relCodingState`
- `// LOGIN WALL FUNCTIONS` (~line 3524) — login-gated navigation helpers
- `// REDACTION WORKFLOW` (~line 3641, ~3724) — `rdx-*` modal functions
- `// PRIVILEGE LOG WORKFLOW` (~line 3664, ~3836) — `plog-*` modal functions
- `// PROJECT DATA — GDPR + AI CASES` (~line 4107) — `P3_DOCS`, `P4_DOCS`, `PTBR_DOCS` datasets for additional simulator cases
- `// CASE SWITCHING` (~line 4042) — `openCase(caseNum)` sets `ACTIVE_DOCS` and `ACTIVE_CASE` to switch between simulator cases
- `// FEATURE 2: PROGRESS PERSISTENCE` / `// PROGRESS PERSISTENCE — localStorage PRIMARY + Supabase SECONDARY` (~line 4562) — `saveProgress()` writes to localStorage immediately then syncs to Supabase; `loadProgressRemote()` / `loadProgressLocal()` restore on login
- `ev-*` (~line 4776) — Mock Everlaw coding interface (GDPR case)
- `// CASEPOINT — TRANSRIDGE PIPELINE v. CASCADE HEADWATERS ALLIANCE` — `FA_DOCS` + `CP_CASES.firstam`; First Amendment qualified-privilege case with `fa-flag` (Flag & Escalate) coding option; `FA-DATA-START`/`FA-DATA-END`/`FA-CASE-END` markers are used by data-integrity check scripts — keep them
- `loadTimesheets()` / `loadPayments()` / `loadTactical()` — Leadership-only data views backed by `timesheets`, `payments`, `tactical` tables

**Simulator cases:** `ACTIVE_CASE` / `ACTIVE_DOCS` switch between the four document sets:
- Case 1: `REL_DOCS` — Joba v. Bukando (default)
- Case 2: `CASE2_DOCS`
- Case 3: `P3_DOCS` — GDPR/AI (Veridian Bank)
- Case 4: `P4_DOCS` — launched from `other-projects` page; Foreign language review uses `PTBR_DOCS`
- Casepoint cases (`CP_CASES`, launched from `other-projects` via `openCasepointCase(id)`): `antitrust` (NorthStar/Meridian, `CP_DOCS`), `breach` (St. Aurelius, `SAH_DOCS`), `firstam` (TransRidge v. Cascade Headwaters — First Amendment privilege, `FA_DOCS`, 500 docs: 15 hand-authored + seeded generator)

**Supabase tables:** `quiz_scores`, `timesheets`, `payments`, `tactical`

## Styling

Dark theme with CSS custom properties defined in `:root`. Key tokens: `--gold` (#d4a82a), `--sapphire` (#0a2463), `--emerald` (#004d40), `--dark` (#080c12), `--card` (#0e1420). Mobile breakpoint at 600px.

## HTML Escaping

All dynamic content inserted into the DOM must go through `esc(v)` (HTML body text) or `escAttr(v)` (attribute values). Never use raw string interpolation for user-controlled or database-sourced values.
