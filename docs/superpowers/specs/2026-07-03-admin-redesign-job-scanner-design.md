# Admin Redesign + AI Job Scanner — Design

**Date:** 2026-07-03
**Status:** Approved (Approach A + Slack ping)

## Overview

Two connected pieces of work:

1. **Admin UI redesign** — replace the flat stack of cards on `page-admin` with a tabbed dashboard.
2. **AI Job Scanner** — a daily scheduled Claude cloud agent that searches the web for remote document review / eDiscovery contract jobs (New York + fully remote), writes new leads into a Supabase `job_leads` table, and pings Slack when new leads land. The admin section displays the leads as a tracker-style job board. This replaces/upgrades the existing Cowork tool that writes to a doc.

## Goals

- One place (admin section) to see every new remote doc-review/eDiscovery job lead: title, company/agency, source, pay, apply link or email, date posted, date found.
- Runs automatically every day with no manual triggering.
- Board stays clean: leads are marked New / Applied / Dismissed.
- Slack notification when new leads are found (reuses existing Slack pipeline).
- Admin UI organized, beautiful, consistent with the existing gold/sapphire dark theme.

## Non-goals (v1)

- Auto-applying to jobs.
- Scraping behind logins (LinkedIn logged-in feed, Indeed apply flow). Coverage is what public web search surfaces.
- Multi-user job boards — this is admin-only.

## Architecture

```
┌─────────────────────────┐     POST /functions/v1/job-scan-ingest
│ Scheduled Claude agent   │ ──────────────────────────────────────┐
│ (daily cloud routine)    │                                       ▼
│ · web-searches sources   │                        ┌───────────────────────┐
│ · extracts + classifies  │                        │ Edge Fn: job-scan-    │
│ · sends candidate leads  │                        │ ingest (service role) │
└─────────────────────────┘                        │ · validates token     │
                                                    │ · dedupes (hash)      │
                                                    │ · inserts new rows    │
                                                    │ · Slack summary ping  │
                                                    └──────────┬────────────┘
                                                               ▼
┌─────────────────────────┐    SB REST (RLS: admin only)  ┌──────────────┐
│ Admin page — Job Leads  │ ◄──────────────────────────── │  job_leads   │
│ tab (index.html)        │  read + status updates        │  table       │
└─────────────────────────┘                               └──────────────┘
```

Three units, each independently testable:

### 1. Supabase: `job_leads` table + `job-scan-ingest` Edge Function

**Table `job_leads`:**

| column | type | notes |
|---|---|---|
| `id` | uuid PK default `gen_random_uuid()` | |
| `title` | text not null | job title |
| `company` | text | company or staffing agency |
| `source` | text not null | `indeed`, `craigslist`, `linkedin`, `glassdoor`, `ziprecruiter`, `google`, `agency`, `other` |
| `url` | text | posting/apply link |
| `apply_email` | text | if the posting says "email resume to…" |
| `pay` | text | free text, e.g. "$33–$40/hr" |
| `location` | text | e.g. "Remote (NY barred)", "NYC hybrid" |
| `description` | text | 1–3 sentence summary written by the agent |
| `posted_date` | date | when the job was published (agent's best read) |
| `found_at` | timestamptz default `now()` | when the scanner found it |
| `status` | text default `'new'` | `new` / `applied` / `dismissed` |
| `dedupe_hash` | text unique not null | normalized hash of title+company+source |

**RLS:** enabled. `SELECT`/`UPDATE` allowed only where the JWT email equals the admin email (matches the existing `ADMIN_EMAIL` gating). No client `INSERT`/`DELETE` — inserts happen only via the Edge Function's service role.

**Edge Function `job-scan-ingest`:**
- Auth: requires header `x-ingest-token` matching secret `JOB_INGEST_TOKEN` (single-purpose token so the scheduled agent never holds the service-role key).
- Body: `{ leads: [...] }` — array of candidate leads in the table shape (minus id/status/found_at).
- Computes `dedupe_hash` server-side (lowercased, whitespace-collapsed `title|company|source`), inserts with `ON CONFLICT DO NOTHING`.
- If ≥1 new row inserted, posts a Slack summary using the same `SLACK_WEBHOOK_URL` secret the `login-alert` function already uses: count + top titles + link to the admin page.
- Returns `{ received, inserted }` so the agent can report accurately.

### 2. Scheduled Claude cloud agent (the scanner)

Created via a scheduled routine, daily (~8:00 AM ET). Its prompt:

- Search for remote document review / eDiscovery contract attorney & paralegal roles, New York or fully remote, posted in the last 7 days. Sources to sweep: Google Jobs, Indeed, Craigslist NYC (legal/paralegal gigs), Glassdoor, LinkedIn public postings, ZipRecruiter, and legal staffing agencies (Hire Counsel, Beacon Hill Legal, Adams & Martin, Special Counsel/Adecco Legal, Lexitas, Consilio, Epiq, TCDI, etc.).
- Judge relevance: actual doc review / eDiscovery / privilege review roles, not general attorney or unrelated remote work.
- Extract per lead: title, company, source, url, apply_email, pay, location, description, posted_date.
- POST the batch to `job-scan-ingest` with the ingest token. The function handles dedupe — the agent does not need DB read access.

### 3. Admin UI redesign (`index.html`)

`page-admin` becomes a tabbed dashboard:

- **Stat strip** (top): New leads today · Total leads · Users · Security alerts this week.
- **Tabs:** `📋 Job Leads` (default) · `👥 Users & Scores` · `🛡️ Security`.
  - *Users & Scores* = merge of the two existing cards (User Score Management + All Scores Overview), unchanged functionality.
  - *Security* = existing Login Security Alerts card, unchanged functionality.
- **Job Leads tab:**
  - Each lead renders as a row/card: title (links to `url`), company, source badge (color per source), pay, location, posted date, found date, and an **Apply** button (`url` or `mailto:apply_email`).
  - Filter chips: status (New / Applied / Dismissed / All), source, plus a text search box.
  - Row actions: **Mark Applied**, **Dismiss** (and Restore from those states) — `PATCH` via the `SB` wrapper, RLS-gated to admin.
  - "New since last visit" highlight using a `localStorage` timestamp.
  - Empty/loading/error states consistent with existing cards (spinner pattern already in use).
- Tab state is in-page (no `nav()` changes); admin gating unchanged (`btn-admin` visibility + existing checks).
- All dynamic content goes through `esc()` / `escAttr()` per the project rule.

## Error handling

- Agent finds nothing → POSTs empty batch or skips; no Slack ping; board simply shows nothing new.
- Edge Function down / token wrong → agent reports failure in its routine run log; nothing corrupts.
- Duplicate leads → silently ignored via unique `dedupe_hash`.
- Slack webhook failure → inserts still succeed (Slack is fire-and-forget, same as `login-alert`).
- Client fetch failure → Job Leads tab shows a retry-able error state.

## Testing / verification

1. Apply migration; verify RLS by querying as anon (should see nothing) and as admin (should see rows).
2. Deploy `job-scan-ingest`; curl it with the token + 2 sample leads → rows appear, Slack ping arrives; curl again with same leads → `inserted: 0`, no ping.
3. Load admin page as admin → leads render, filters work, Apply/Dismiss persists across reload.
4. Trigger the scheduled agent once manually → real leads flow end-to-end.
5. Verify non-admin users see no admin button and get no data (RLS).

## Out of scope / future

- Approach B upgrade (JSearch API feed) if web-search coverage feels thin.
- Lead notes, application-date tracking, resume-version tracking.
- Weekly digest email.
