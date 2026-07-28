# Wellness Check-In & Mental Health Training — Design

**Date:** 2026-07-27
**Status:** Approved design, pending implementation plan

## Problem

AA Team paralegals do sustained document review, sometimes over distressing case
material, under deadline pressure. When someone is ill, low, or dealing with
something personal, there is currently no way to say so short of a direct message
to a supervisor — and no shared understanding of what either side should do next.

Two gaps:

1. **No signal.** A team member running at reduced capacity has no low-friction,
   non-awkward way to say so, and leads have no way to know before quality slips.
2. **No training.** Neither team members nor leads have guidance on recognizing
   burnout, coping with heavy material, or responding well to a disclosure.

## Goals

- Give team members a private, low-stakes way to flag reduced capacity.
- Give leads a reliable place to see those flags and act on them.
- Teach both sides — separately, because their needs differ.
- Make the support content reachable **without logging in**, from a phone, fast.
- Hold health-adjacent data as briefly and narrowly as is useful.

## Non-Goals

- This is not therapy, triage, or a clinical tool.
- No scoring, no leaderboard, no completion tracking on wellness content.
- No email or push notification infrastructure in v1.
- No HR case management, absence approval, or leave accounting.

## Architecture

Mirrors the existing `accent-trainer` pattern: a self-contained sub-app in its own
directory, linked from the main nav, excluded from the SPA rewrite.

| Change | Location |
|---|---|
| New standalone sub-app | `wellness/index.html` |
| Nav button `💚 Wellness` | `index.html:1430`, beside Accent Trainer |
| Rewrite exclusion | `vercel.json:6` |
| Flags table + RLS + purge | `supabase/migrations/20260727_wellness_flags.sql` |
| Unacknowledged-flag banner | `index.html` header |

**Why a separate file rather than a page in the main app.** The main `index.html`
is 2.1 MB. The moment someone most needs this page is the moment they have the
least patience for a 2.1 MB download on mobile data. A standalone file also means
the public surface cannot accidentally expose gated app content, and the content
lives in exactly one place — the main app links to it rather than duplicating it,
so the two cannot drift.

The nav button is a plain `location.href` navigation, matching Accent Trainer:

```html
<button onclick="location.href='/wellness/'">💚 Wellness</button>
```

`vercel.json` gains `wellness` alongside `accent-trainer` in the negative lookahead,
plus the two explicit `/wellness` → `/wellness/index.html` rewrites.

## Visual Design

Clones the accent-trainer shell (`accent-trainer/index.html:271-289` and its CSS
tokens at lines 20-40) so the two sub-apps read as one family:

- Sticky `.topbar`, `backdrop-filter: blur(18px)`, translucent dark background
- 34px `.brand-logo` gradient tile containing 💚
- `.brand-name` — `Team` in the violet→teal gradient via `<span class="g">`,
  `Wellness` in white
- `.brand-sub` tagline: *Look after yourself · check in · get support*
- Centered `.nav` row of `.nav-btn` tabs, violet underline on active
- Space Grotesk headings, Inter body, radial-gradient page background

### Tabs

| Tab | Visibility | Contents |
|---|---|---|
| 🌿 For You | Public | Team member training track |
| 🤝 For Leads | Public | Supervisor training track |
| 💬 Check In | Public content, login to submit | The flag form |
| 🆘 Help | Public | Verified crisis and support resources |
| 📥 Flags | Leadership only | Flag inbox |

Training content requires no authentication. Only submitting a flag and viewing
the inbox do.

## Training Content

Expandable sections per track, following the main app's Reference page pattern.
**Unscored and not wired to the leaderboard** — ranking people on mental health
material would discourage exactly the honesty the check-in depends on.

### 🌿 For You (team members)

- **Knowing your own warning signs** — dread before a batch, numbness, rereading
  the same document, error rate creeping up, losing hours without noticing.
- **When the material itself is heavy** — distressing evidence is a real
  occupational exposure in e-discovery, not a personal weakness. Practical
  distancing techniques, and why "just push through" makes it worse.
- **Fatigue and the body** — screen strain, posture, hydration, why batch breaks
  are performance, not indulgence.
- **Speaking up** — what a check-in actually does, who sees it, what it does not
  do (it is not a disciplinary record and not a leave request).
- **Boundaries** — after-hours, deadline pressure, and what is reasonable to expect.
- **Getting real help** — clear pointer to the 🆘 Help tab.

Closes with 3–4 scenarios, e.g. *"The case material you're reviewing is genuinely
disturbing and it's following you home."*

### 🤝 For Leads (supervisors)

- **Spotting it early** — quality drop, withdrawal from standups, over-apologizing,
  sudden overwork as avoidance.
- **Opening the conversation** — concrete scripts. Lead with the observation, not
  the diagnosis.
- **What not to say** — minimizing, comparing, offering diagnoses, pressing for
  detail they did not volunteer.
- **Handling a disclosure** — what may and may not be repeated, and to whom.
- **Adjusting workload** — practical reassignment, realistic deadline relief.
- **Knowing the limit** — a supervisor is not a clinician. Recognizing when to hand
  off matters more than knowing the right thing to say.
- **Responding to a flag** — how to acknowledge, and what acknowledgement means.

Closes with 3–4 scenarios, e.g. *"A team member says they're fine, but has missed
three deadlines this week."*

## Check-In Flag

Entry point: a button reading **"I'm not at 100% today."** Requires login, since
a flag is meaningless without knowing who sent it. Unauthenticated visitors see
the explanation and a prompt to sign in — the training content stays open to them.

### Fields

| Field | Required | Values |
|---|---|---|
| Category | Yes | Unwell / Low / Personal matter / Other |
| Capacity | Yes | Full / Reduced / Need the day |
| Note | **No** | Free text, their own words |
| Expected duration | **No** | Integer days |

The optional fields are deliberate. Requiring a written reason is what makes people
stop using a tool like this. Optional fields yield full detail from those who want
to give it, and a usable coarse signal from those who do not.

Before submitting, the form states plainly who will see the entry and how long it
is kept. No dark patterns, no pre-checked sharing.

## Leadership Inbox & Banner

The **📥 Flags** tab lists flags newest first: person, category, capacity, note if
given, duration if given, timestamp, and an **Acknowledge** button. Acknowledging
records who acknowledged and when.

In the main app, a header banner appears when unacknowledged flags exist, linking
to `/wellness/#flags`. Leads should not have to go looking. The banner queries the
count only; it renders no flag detail in the main app.

## Data Model

```sql
create table public.wellness_flags (
  id uuid primary key default gen_random_uuid(),
  user_email text not null,
  user_name text,
  category text not null check (category in ('unwell','low','personal','other')),
  capacity text not null check (capacity in ('full','reduced','none')),
  note text,
  expected_days int check (expected_days is null or expected_days between 1 and 90),
  created_at timestamptz not null default now(),
  acknowledged_by text,
  acknowledged_at timestamptz
);

alter table public.wellness_flags enable row level security;
```

### Row Level Security

Follows the `job_leads` pattern (`supabase/migrations/20260703_job_leads.sql:20`).

- **Insert** — authenticated users, and only rows where `user_email` matches their
  own JWT email. A person cannot file a flag as someone else.
- **Select own** — `(auth.jwt() ->> 'email') = user_email`.
- **Select all** — leadership emails only.
- **Update** — leadership only, for acknowledgement.
- **No delete policy.** Removal happens via the scheduled purge, which runs as the
  table owner and bypasses RLS.

**Security note.** The client-side `isLeadership()` at `index.html:2849` also
matches on `display_name` against `LEADERSHIP_NAMES`. Display name is user-settable
metadata, so it is spoofable. It is acceptable for showing or hiding a button; it
must **not** appear in any RLS policy. Wellness policies key on JWT email only.
Currently `LEADERSHIP_EMAILS = ['jeff@ataandeadvisors.com']`.

### Retention — tiered purge

```sql
create extension if not exists pg_cron;

select cron.schedule('purge-wellness', '0 3 * * *', $$
  update public.wellness_flags
     set note = null
   where note is not null
     and created_at < now() - interval '30 days';

  delete from public.wellness_flags
   where created_at < now() - interval '90 days';
$$);
```

The free-text note — the part someone might regret writing — is erased at **30
days**. The coarse record survives to **90 days**, long enough to notice a pattern
such as repeated flags in a quarter, then goes.

Rationale: bounded, deliberate retention on health-adjacent records about
identifiable employees is far easier to justify than indefinite storage, and the
short life of the note is what lets people be candid.

## Crisis Resources (🆘 Help)

The team is based in Tanzania. Resources below were verified 2026-07-27; a US
hotline would be useless here, and a wrong number is worse than none.

- **Afya Call Center — dial 199.** Tanzania's Ministry of Health national health
  helpline. Toll-free, 24/7, confidential, reachable from a feature phone by voice
  or SMS. Explicitly covers mental health counseling among other health areas.
  Capacity supported by WHO.
- **Mirembe National Mental Health Hospital, Dodoma.** Tanzania's national referral
  psychiatric hospital; the country's only specialized mental health hospital.
  General adult psychiatry, substance use, and neuropsychiatric services.
- **116 National Child Helpline.** 24/7 and free, but child-focused — listed only
  for completeness, as the team are adults.

The page must state plainly that it is not a clinical service and cannot handle
emergencies, and route people to 199 or a hospital when it is urgent.

**Open item for Jeff:** if AA Team has an HR contact, employer-provided counseling,
or a preferred local provider, that belongs at the top of this tab — it beats any
public directory.

## Privacy Posture

- The 🌿, 🤝, and 🆘 tabs make **zero** Supabase calls. Nothing read there is
  logged, and reading support material creates no record.
- Access control is enforced in Postgres via RLS, not by hiding UI.
- No analytics, no third-party scripts on the wellness sub-app.
- The purge is scheduled server-side, not dependent on anyone remembering.

## Testing

- **RLS** — verify with two accounts that user A cannot read or update A′s flags,
  cannot insert as another email, and that leadership can read all and acknowledge.
- **Public access** — load `/wellness/` signed out; confirm all four public tabs
  render, `📥 Flags` is absent, and no network calls hit Supabase.
- **Purge** — run the two statements against seeded rows backdated 31 and 91 days;
  confirm note nulling and row deletion respectively.
- **Banner** — confirm it appears on unacknowledged flags, clears on acknowledgement,
  and never renders flag detail in the main app.
- **Responsive** — verify header and tab row at 375px, matching accent-trainer.

## Out of Scope (possible later)

- Email or push notification on new flags (needs an Edge Function).
- Trends over time for leads.
- Anonymous flagging.
- Swahili translation of the training content — worth considering given the team
  is Tanzania-based, but v1 ships in English to match the rest of the site.

## Sources

- Afya Call Center (199): https://www.afro.who.int/countries/united-republic-of-tanzania/news/connecting-people-who-boosts-capacity-afya-call-center
- Afya Call Center listing: https://findahelpline.com/organizations/199-afya-call-center
- Ministry of Health contact: https://www.moh.go.tz/en/contact
- Mirembe National Mental Health Hospital: https://en.wikipedia.org/wiki/Mirembe_National_Mental_Health_Hospital
- Tanzania helplines directory: https://findahelpline.com/countries/tz
