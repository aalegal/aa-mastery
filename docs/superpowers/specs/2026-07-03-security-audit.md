# Security Audit — 2026-07-03

Audit run alongside the admin-redesign/job-scanner work, covering the five requested prompts:
rate limiting, hardcoded-secret scan, secret storage, input sanitization, and a full vulnerability review.

## Summary

| Severity | Finding | Status |
|---|---|---|
| 🔴 High | Slack webhook URL committed to git history of a **public** repo | **ACTION NEEDED — rotate** |
| 🟠 Med | `quiz_scores` DELETE allowed for everyone | ✅ Fixed |
| 🟠 Med | `login_alerts` INSERT allowed for anyone (anon spam) | ✅ Fixed |
| 🟠 Med | `payments`/`tactical`/`timesheets` open to any authenticated user | ✅ Fixed |
| 🟠 Med | `login-alert` function callable with anon key only (Slack spam vector) | ✅ Fixed |
| 🟡 Low | No input validation / size caps on edge function payloads | ✅ Fixed |
| 🟡 Low | Supabase `password_min_length` = 6, no captcha | ⚠️ Recommend raising |
| ℹ Info | `SUPABASE_ANON_KEY` in frontend | Expected — safe by design |

## 🔴 HIGH — Rotate the Slack webhook (you must do this)

The Slack incoming-webhook URL is in git history:

```
commit 66deea1  (added)   const SLACK_WEBHOOK='https://hooks.slack.com/services/T04GB6AS7D2/B0B8ACAEBPH/…'
commit 687f843  (removed) — moved to Supabase secret SLACK_WEBHOOK_URL
```

It is **no longer in the current code** (functions read `Deno.env.get('SLACK_WEBHOOK_URL')`), but the repo
`aalegal/aa-mastery` is **public**, so anyone can read the old commit and POST arbitrary messages into your
Slack channel.

**Fix (requires Slack admin — cannot be automated here):**
1. Slack → the app that owns this webhook → **Incoming Webhooks** → revoke the old URL, generate a new one.
2. Update the Supabase secret:
   `npx supabase secrets set SLACK_WEBHOOK_URL='<new-url>' --project-ref mrxhydaoxlxuampmgaoi`
3. Optional: make the repo private (Settings → General → Danger Zone) — rewriting history with
   `git filter-repo` is possible but rotation is the real fix; the old URL is dead once revoked.

## Fixed in this pass

**RLS policies** (`supabase/migrations/20260703_security_hardening.sql`):
- `quiz_scores`: DELETE now admin-only (was `using true` — anyone could wipe scores).
- `login_alerts`: removed the public INSERT policy (anon could forge alert rows). Legit inserts go
  through the `login-alert` function's service role.
- `payments`, `tactical`, `timesheets`: were readable/writable by ANY logged-in user. Now gated by a
  `is_leadership()` SQL function mirroring the frontend `isLeadership()` check.

**Edge functions:**
- `login-alert`: now verifies a real user JWT via `auth.getUser()` (anon key alone → 401), whitelists and
  length-caps the columns it inserts, binds `user_id`/`user_email` to the verified caller, and rate-limits
  to **5 alerts per user per 15 min** (DB-backed) plus a per-instance Slack cap.
- `job-scan-ingest`: rejects payloads >512 KB, caps at 200 leads/request, and drops any `url` that isn't
  `http(s)` before storing.

**Rate limiting (the "5 attempts / 15 min" request):**
- Password login itself is handled by Supabase GoTrue, which enforces its own auth rate limits
  (`rate_limit_verify=30`, `rate_limit_token_refresh=150`, `rate_limit_email_sent=2/hr` observed).
  Application code cannot tighten GoTrue's login throttle — that lives in Supabase auth config.
- The 5/15-min limit was applied where we *do* own the code: the `login-alert` function.

**Input sanitization:**
- All DB-sourced/scraped content rendered in the admin job board goes through `esc()`/`escAttr()`
  (verified with an XSS probe: `<img onerror>`, `<script>`, quotes — all neutralized, no execution).
- Scraped `url` values are scheme-checked both client-side (only `http(s)` links render) and server-side.

## Recommendations (not yet actioned — need your decision)

1. **Rotate the Slack webhook** (High, above).
2. **Raise `password_min_length`** from 6 to 10–12, and enable hCaptcha on auth
   (`security_captcha_enabled` is currently false) to blunt credential-stuffing.
3. **Consider making the repo private** — it currently exposes full source + git history publicly.
4. **`is_leadership()` name fallback**: the policy trusts `user_metadata.display_name`, which users can set
   themselves. Collect real leadership emails into the email allowlist and drop the name check when feasible.

## Not a vulnerability

- `SUPABASE_ANON_KEY` in `index.html` is the intended public browser key; security rests on RLS, which is
  enabled on all 7 public tables. This is standard Supabase design, not an exposure.
