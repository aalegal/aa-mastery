# Admin Redesign + AI Job Scanner Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tabbed admin dashboard with a daily AI job scanner that writes remote doc-review/eDiscovery leads into Supabase and pings Slack.

**Architecture:** A scheduled Claude cloud agent web-searches job sources daily and POSTs candidate leads to a new `job-scan-ingest` Supabase Edge Function, which dedupes, inserts into a new RLS-locked `job_leads` table, and posts a Slack summary. The admin page (in `index.html`) becomes a 3-tab dashboard whose Job Leads tab reads/updates the table via the existing `SB` wrapper.

**Tech Stack:** Single-file `index.html` (vanilla JS + Axios), Supabase (Postgres, RLS, Edge Functions/Deno), Slack incoming webhook, Claude scheduled routine.

## Global Constraints

- Repo root: `/Users/jeff/Documents copy/aa-mastery` (NOT `~/Documents/aa-mastery` — that path is iCloud-broken). Use `git -C` or absolute paths.
- All dynamic DOM content MUST go through `esc(v)` / `escAttr(v)` (defined near line 3278 of `index.html`).
- Do not edit past the duplicate `<!DOCTYPE html>` fragment near the end of `index.html`.
- Locate edit points by unique anchor strings, not line numbers (they shift).
- Supabase project ref: `mrxhydaoxlxuampmgaoi`. Admin email: `jeff@ataandeadvisors.com`. Anon key is the `SUPABASE_ANON_KEY` const in `index.html`.
- This project has no test framework or build step. Each task ends with explicit verification commands (SQL / curl / browser) instead of unit tests — run them and confirm output before committing.
- Reuse existing CSS: `.card`, `.rtabs`/`.rtab`/`.rpane`, `.stat-row`/`.stat`/`.stat-num`/`.stat-lbl`, `.data-table`, `.btn`/`.btn-sm`/`.btn-outline`, CSS vars `--gold`, `--sapphire`, `--sapphire-mid`, `--sapphire-light`, `--gold-light`, `--border`, `--muted`, `--red`.
- Commit after every task. Push to `main` only in the final task (Vercel auto-deploys).

---

### Task 1: `job_leads` table + RLS

**Files:**
- Create: `supabase/migrations/20260703_job_leads.sql` (repo copy for reference)
- Apply via Supabase MCP `apply_migration` (project `mrxhydaoxlxuampmgaoi`)

**Interfaces:**
- Produces: table `public.job_leads` with columns `id, title, company, source, url, apply_email, pay, location, description, posted_date, found_at, status, dedupe_hash` — consumed by Tasks 2, 3, 4.

- [ ] **Step 1: Write the migration file** (`supabase/migrations/20260703_job_leads.sql`):

```sql
create table public.job_leads (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  company text,
  source text not null default 'other',
  url text,
  apply_email text,
  pay text,
  location text,
  description text,
  posted_date date,
  found_at timestamptz not null default now(),
  status text not null default 'new' check (status in ('new','applied','dismissed')),
  dedupe_hash text not null unique
);

alter table public.job_leads enable row level security;

create policy "admin_select_job_leads" on public.job_leads
  for select using ((auth.jwt() ->> 'email') = 'jeff@ataandeadvisors.com');

create policy "admin_update_job_leads" on public.job_leads
  for update using ((auth.jwt() ->> 'email') = 'jeff@ataandeadvisors.com')
  with check ((auth.jwt() ->> 'email') = 'jeff@ataandeadvisors.com');
-- No insert/delete policies: inserts happen only via the Edge Function's service role (bypasses RLS).
```

- [ ] **Step 2: Apply it** with Supabase MCP `apply_migration` (name `job_leads`, same SQL).

- [ ] **Step 3: Verify RLS.** Via MCP `execute_sql`: `select count(*) from job_leads;` → 0 rows, no error. Then verify anon is blocked:

```bash
curl -s "https://mrxhydaoxlxuampmgaoi.supabase.co/rest/v1/job_leads?select=id" \
  -H "apikey: <ANON_KEY>" -H "Authorization: Bearer <ANON_KEY>"
```
Expected: `[]` (RLS filters everything out for anon).

- [ ] **Step 4: Commit** the migration file: `git -C "/Users/jeff/Documents copy/aa-mastery" add supabase && git -C ... commit -m "feat(admin): job_leads table with admin-only RLS"`

---

### Task 2: `job-scan-ingest` Edge Function

**Files:**
- Create: `supabase/functions/job-scan-ingest/index.ts` (repo copy)
- Deploy via Supabase MCP `deploy_edge_function`

**Interfaces:**
- Consumes: `job_leads` table (Task 1); existing project secret `SLACK_WEBHOOK_URL` (already set for `login-alert` — Edge Function secrets are project-wide).
- Produces: `POST /functions/v1/job-scan-ingest` accepting headers `Authorization: Bearer <anon key>` + `x-ingest-token: <JOB_INGEST_TOKEN>` and body `{"leads":[{title, company?, source, url?, apply_email?, pay?, location?, description?, posted_date?}]}`; returns `{"received":N,"inserted":M}`. Consumed by Task 5 (scanner agent).

- [ ] **Step 1: Generate the ingest token** and record it for Task 5:

```bash
openssl rand -hex 24
```

- [ ] **Step 2: Set the secret.** Try CLI first:

```bash
npx supabase secrets set JOB_INGEST_TOKEN=<token> --project-ref mrxhydaoxlxuampmgaoi
```
If the CLI needs an interactive login, ask Jeff to run `! npx supabase login` or set it in Dashboard → Edge Functions → Secrets.

- [ ] **Step 3: Write the function** (`supabase/functions/job-scan-ingest/index.ts`):

```ts
import { createClient } from "npm:@supabase/supabase-js@2";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);
  const token = req.headers.get("x-ingest-token");
  if (!token || token !== Deno.env.get("JOB_INGEST_TOKEN")) {
    return json({ error: "unauthorized" }, 401);
  }
  let body: { leads?: unknown[] };
  try { body = await req.json(); } catch { return json({ error: "bad json" }, 400); }
  const leads = Array.isArray(body.leads) ? body.leads : [];

  const VALID_SOURCES = ["indeed","craigslist","linkedin","glassdoor","ziprecruiter","google","agency","other"];
  const rows = [];
  for (const raw of leads) {
    const l = raw as Record<string, string>;
    if (!l || !l.title) continue;
    const source = VALID_SOURCES.includes(l.source) ? l.source : "other";
    const norm = [l.title, l.company || "", source].join("|").toLowerCase().replace(/\s+/g, " ").trim();
    const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(norm));
    const hash = [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
    rows.push({
      title: String(l.title).slice(0, 300),
      company: l.company || null,
      source,
      url: l.url || null,
      apply_email: l.apply_email || null,
      pay: l.pay || null,
      location: l.location || null,
      description: l.description ? String(l.description).slice(0, 1000) : null,
      posted_date: l.posted_date && /^\d{4}-\d{2}-\d{2}$/.test(l.posted_date) ? l.posted_date : null,
      dedupe_hash: hash,
    });
  }

  let inserted = 0;
  if (rows.length) {
    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data, error } = await sb.from("job_leads")
      .upsert(rows, { onConflict: "dedupe_hash", ignoreDuplicates: true })
      .select("id,title");
    if (error) return json({ error: error.message }, 500);
    inserted = data?.length ?? 0;

    if (inserted > 0) {
      const hook = Deno.env.get("SLACK_WEBHOOK_URL");
      if (hook) {
        const top = (data ?? []).slice(0, 5).map((d) => "• " + d.title).join("\n");
        const more = inserted > 5 ? `\n…and ${inserted - 5} more` : "";
        const msg = `💼 *${inserted} new job lead${inserted === 1 ? "" : "s"} — AA Mastery Job Scanner*\n${top}${more}\n<https://aa-mastery.vercel.app|Open the admin board>`;
        await fetch(hook, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: msg }),
        }).catch(() => {});
      }
    }
  }
  return json({ received: leads.length, inserted });
});
```

- [ ] **Step 4: Deploy** via MCP `deploy_edge_function` (name `job-scan-ingest`, the file above as entrypoint).

- [ ] **Step 5: Test — insert + Slack.** POST two sample leads:

```bash
curl -s -X POST "https://mrxhydaoxlxuampmgaoi.supabase.co/functions/v1/job-scan-ingest" \
  -H "Authorization: Bearer <ANON_KEY>" -H "x-ingest-token: <token>" \
  -H "Content-Type: application/json" \
  -d '{"leads":[{"title":"TEST Remote Document Review Attorney","company":"Test Staffing","source":"agency","url":"https://example.com/job1","pay":"$35/hr","location":"Remote (US)","description":"Test lead — safe to dismiss.","posted_date":"2026-07-01"},{"title":"TEST eDiscovery Paralegal","company":"Test Corp","source":"indeed","apply_email":"jobs@example.com","location":"New York, NY"}]}'
```
Expected: `{"received":2,"inserted":2}` and a Slack message arrives.

- [ ] **Step 6: Test — dedupe.** Re-run the exact same curl. Expected: `{"received":2,"inserted":0}` and **no** Slack message.

- [ ] **Step 7: Test — auth.** Same curl with `-H "x-ingest-token: wrong"`. Expected: HTTP 401 `{"error":"unauthorized"}`.

- [ ] **Step 8: Commit** the function file: `git commit -m "feat(admin): job-scan-ingest edge function with dedupe + Slack ping"`. (Keep the two TEST rows in the table — Tasks 3–4 use them for browser verification; they're deleted in Task 6.)

---

### Task 3: Admin page restructure — tabs, stat strip, SB methods

**Files:**
- Modify: `index.html` — the `<div id="page-admin">` block (anchor: `<h2>⚙️ Admin Panel</h2>`), the `SB` object (anchor: `async deleteTactical`), CSS (anchor: `.admin-warning{`)

**Interfaces:**
- Consumes: existing `.rtabs`/`.rtab`/`.rpane` CSS, `stat-row` CSS, `SB.req`.
- Produces: `showAdminTab(id, btn)`; pane ids `apane-jobs`, `apane-users`, `apane-security`; stat ids `ast-new`, `ast-leads`, `ast-users`, `ast-alerts`; container ids `jl-list`, `jl-count`; `SB.getJobLeads()` → `{data:[...leads]}`, `SB.updateJobLead(id, patch)`. Consumed by Task 4.

- [ ] **Step 1: Add SB methods.** In the `SB` object, after the `deleteTactical` line, add:

```js
  ,
  // Job leads (admin-only via RLS)
  async getJobLeads(){return this.req('GET','/rest/v1/job_leads?select=*&order=found_at.desc&limit=500')},
  async updateJobLead(id,patch){return this.req('PATCH','/rest/v1/job_leads?id=eq.'+id,patch)}
```

- [ ] **Step 2: Add CSS.** Immediately after the `.admin-warning{...}` rule, add:

```css
.jl-row{display:flex;justify-content:space-between;gap:12px;align-items:flex-start;background:#0b111c;border:1px solid var(--border);border-radius:8px;padding:12px 14px;margin-bottom:10px;flex-wrap:wrap}
.jl-row.jl-new{border-color:var(--gold)}
.jl-badge{display:inline-block;font-size:.68rem;font-weight:700;padding:2px 8px;border-radius:10px;text-transform:uppercase;letter-spacing:.4px;color:#fff}
.jl-meta{font-size:.78rem;color:var(--muted);margin-top:4px}
.jl-title{font-weight:700;font-size:.95rem}
.jl-title a{color:var(--gold-light);text-decoration:none}
.jl-title a:hover{text-decoration:underline}
.jl-chip{background:#111827;border:1px solid var(--border);color:var(--muted);padding:4px 10px;border-radius:14px;cursor:pointer;font-size:.75rem}
.jl-chip.active{background:linear-gradient(135deg,var(--sapphire),var(--sapphire-mid));color:var(--gold-light);border-color:var(--sapphire-light);font-weight:700}
.jl-newtag{background:var(--gold);color:#111;font-size:.62rem;font-weight:800;border-radius:4px;padding:1px 5px;margin-left:6px;vertical-align:middle}
.jl-actions{display:flex;gap:6px;flex-wrap:wrap;align-items:center}
```

- [ ] **Step 3: Replace the admin page HTML.** Replace the whole `<div id="page-admin" class="page">…</div>` block (from `<div id="page-admin"` through the `</div>` before `<!-- ══════ PROJECTS PAGE ══════ -->`) with:

```html
<div id="page-admin" class="page">
  <div class="card">
    <h2>⚙️ Admin Panel</h2>
    <div class="admin-warning">⚠️ This panel is restricted to the site administrator only. Actions here are irreversible.</div>
    <div class="stat-row" style="margin:16px 0 14px">
      <div class="stat"><div class="stat-num" id="ast-new">—</div><div class="stat-lbl">New Leads Today</div></div>
      <div class="stat"><div class="stat-num" id="ast-leads">—</div><div class="stat-lbl">Total Leads</div></div>
      <div class="stat"><div class="stat-num" id="ast-users">—</div><div class="stat-lbl">Users</div></div>
      <div class="stat"><div class="stat-num" id="ast-alerts">—</div><div class="stat-lbl">Alerts (7d)</div></div>
    </div>
    <div class="rtabs" id="admin-tabs">
      <button type="button" class="rtab active" onclick="showAdminTab('jobs',this)">📋 Job Leads</button>
      <button type="button" class="rtab" onclick="showAdminTab('users',this)">👥 Users &amp; Scores</button>
      <button type="button" class="rtab" onclick="showAdminTab('security',this)">🛡️ Security</button>
    </div>
  </div>

  <div id="apane-jobs" class="rpane active">
    <div class="card">
      <h2>💼 Job Leads <span id="jl-count" style="font-size:.8rem;color:var(--muted);font-weight:400"></span></h2>
      <p style="color:var(--muted);font-size:.85rem;margin-bottom:12px">Remote document review &amp; eDiscovery roles found daily by the AI scanner (runs ~8 AM ET).</p>
      <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:6px" id="jl-status-chips">
        <button type="button" class="jl-chip active" onclick="jlSetFilter('status','new',this)">🆕 New</button>
        <button type="button" class="jl-chip" onclick="jlSetFilter('status','applied',this)">✅ Applied</button>
        <button type="button" class="jl-chip" onclick="jlSetFilter('status','dismissed',this)">🚫 Dismissed</button>
        <button type="button" class="jl-chip" onclick="jlSetFilter('status','all',this)">All</button>
      </div>
      <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:10px" id="jl-source-chips">
        <button type="button" class="jl-chip active" onclick="jlSetFilter('source','all',this)">All Sources</button>
        <button type="button" class="jl-chip" onclick="jlSetFilter('source','indeed',this)">Indeed</button>
        <button type="button" class="jl-chip" onclick="jlSetFilter('source','linkedin',this)">LinkedIn</button>
        <button type="button" class="jl-chip" onclick="jlSetFilter('source','craigslist',this)">Craigslist</button>
        <button type="button" class="jl-chip" onclick="jlSetFilter('source','glassdoor',this)">Glassdoor</button>
        <button type="button" class="jl-chip" onclick="jlSetFilter('source','ziprecruiter',this)">ZipRecruiter</button>
        <button type="button" class="jl-chip" onclick="jlSetFilter('source','google',this)">Google</button>
        <button type="button" class="jl-chip" onclick="jlSetFilter('source','agency',this)">Agencies</button>
      </div>
      <input id="jl-search" placeholder="Search title, company, description…" oninput="jlSearch(this.value)"
        style="width:100%;background:#0b111c;border:1px solid var(--border);border-radius:6px;color:inherit;padding:8px 10px;margin-bottom:12px;font-size:.85rem">
      <div id="jl-list"><div style="color:var(--muted)"><span class="spinner"></span>Loading leads...</div></div>
    </div>
  </div>

  <div id="apane-users" class="rpane">
    <div class="card">
      <h3>User Score Management</h3>
      <div id="admin-users"><div style="color:var(--muted)"><span class="spinner"></span>Loading users...</div></div>
    </div>
    <div class="card">
      <h2>📊 All Scores Overview</h2>
      <div id="admin-scores"><div style="color:var(--muted)"><span class="spinner"></span>Loading...</div></div>
    </div>
  </div>

  <div id="apane-security" class="rpane">
    <div class="card">
      <h2>🛡️ Login Security Alerts</h2>
      <p style="color:var(--muted);font-size:.85rem;margin-bottom:12px">Non-US logins and VPN/proxy connections are logged automatically and sent to Slack on every sign-in.</p>
      <div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:16px">
        <button class="btn btn-outline btn-sm" onclick="adminRunGeoTest()">🔍 Test My Current IP</button>
        <button class="btn btn-outline btn-sm" id="btn-test-slack" onclick="adminTestSlack()">📨 Send Test Slack Alert</button>
      </div>
      <div id="admin-geo-test" style="margin-bottom:16px"></div>
      <h3>Per-User Summary</h3>
      <div id="admin-alert-summary"><div style="color:var(--muted)"><span class="spinner"></span>Loading...</div></div>
      <h3 style="margin-top:24px">Recent Alerts <span id="admin-alerts-count" style="font-size:.8rem;color:var(--muted);font-weight:400"></span></h3>
      <div id="admin-alerts"><div style="color:var(--muted)"><span class="spinner"></span>Loading...</div></div>
    </div>
  </div>
</div>
```

- [ ] **Step 4: Add `showAdminTab`.** Immediately before `async function loadAdmin(){`, add:

```js
function showAdminTab(id,btn){
  document.querySelectorAll('#page-admin .rpane').forEach(function(p){p.classList.remove('active');});
  document.querySelectorAll('#admin-tabs .rtab').forEach(function(t){t.classList.remove('active');});
  var pane=document.getElementById('apane-'+id);if(pane)pane.classList.add('active');
  if(btn)btn.classList.add('active');
}
```

- [ ] **Step 5: Verify in browser.** `python -m http.server 8000` in the repo dir; open `http://localhost:8000`, log in as admin, open Admin. Expected: stat strip (dashes OK), three tabs switch correctly, Users & Scores and Security tabs show the existing data exactly as before, Job Leads tab shows its loading/empty state (data JS comes in Task 4 — a stuck spinner is acceptable here only if `loadJobLeads` is not yet defined; confirm no console errors other than that).

- [ ] **Step 6: Commit** — `git commit -m "feat(admin): tabbed dashboard layout with stat strip"`

---

### Task 4: Job leads board — load, render, filter, actions, stats

**Files:**
- Modify: `index.html` — add JS before `showAdminTab` (anchor from Task 3); modify `loadAdmin()` and `loadLoginAlerts()`

**Interfaces:**
- Consumes: `SB.getJobLeads()`, `SB.updateJobLead(id,patch)`, ids from Task 3, `esc`/`escAttr`.
- Produces: `loadJobLeads()`, `renderJobLeads()`, `jlSetFilter(kind,val,btn)`, `jlSearch(v)`, `jlSetStatus(id,status)`, `astSet(id,v)`.

- [ ] **Step 1: Add the module** immediately before `function showAdminTab`:

```js
/* ===================== JOB LEADS BOARD (admin) ===================== */
var JL_DATA=[],JL_FILTER={status:'new',source:'all',q:''},JL_LAST_VISIT=0;
var JL_SRC_COLORS={indeed:'#2557a7',craigslist:'#8a2be2',linkedin:'#0a66c2',glassdoor:'#0caa41',ziprecruiter:'#6fa82f',google:'#ea4335',agency:'#b8860b',other:'#5a6a7a'};
function astSet(id,v){var e=document.getElementById(id);if(e)e.textContent=v;}
async function loadJobLeads(){
  var el=document.getElementById('jl-list');if(!el)return;
  el.innerHTML='<div style="color:var(--muted)"><span class="spinner"></span>Loading leads...</div>';
  JL_LAST_VISIT=parseInt(localStorage.getItem('jl_last_visit')||'0',10);
  var r=await SB.getJobLeads();
  if(r.error){el.innerHTML='<p style="color:var(--red)">'+esc(r.error)+' <button type="button" class="btn btn-sm btn-outline" onclick="loadJobLeads()">Retry</button></p>';return;}
  JL_DATA=r.data||[];
  renderJobLeads();
  var t=new Date();t.setHours(0,0,0,0);
  astSet('ast-new',JL_DATA.filter(function(l){return new Date(l.found_at)>=t;}).length);
  astSet('ast-leads',JL_DATA.length);
  localStorage.setItem('jl_last_visit',String(Date.now()));
}
function jlSetFilter(kind,val,btn){
  JL_FILTER[kind]=val;
  if(btn){btn.parentElement.querySelectorAll('.jl-chip').forEach(function(c){c.classList.remove('active');});btn.classList.add('active');}
  renderJobLeads();
}
function jlSearch(v){JL_FILTER.q=(v||'').toLowerCase();renderJobLeads();}
async function jlSetStatus(id,status){
  var r=await SB.updateJobLead(id,{status:status});
  if(r.error){alert('Update failed: '+r.error);return;}
  JL_DATA.forEach(function(l){if(l.id===id)l.status=status;});
  renderJobLeads();
}
function renderJobLeads(){
  var el=document.getElementById('jl-list');if(!el)return;
  var f=JL_FILTER;
  var rows=JL_DATA.filter(function(l){
    if(f.status!=='all'&&l.status!==f.status)return false;
    if(f.source!=='all'&&l.source!==f.source)return false;
    if(f.q&&((l.title||'')+' '+(l.company||'')+' '+(l.description||'')).toLowerCase().indexOf(f.q)===-1)return false;
    return true;
  });
  var cnt=document.getElementById('jl-count');if(cnt)cnt.textContent='('+rows.length+' shown · '+JL_DATA.length+' total)';
  if(!rows.length){el.innerHTML='<p style="color:var(--muted)">No leads here. The scanner runs daily at ~8 AM ET — try the All filter or check back tomorrow.</p>';return;}
  var h='';
  rows.forEach(function(l){
    var c=JL_SRC_COLORS[l.source]||JL_SRC_COLORS.other;
    var isNew=l.status==='new'&&JL_LAST_VISIT&&new Date(l.found_at).getTime()>JL_LAST_VISIT;
    var title=l.url?'<a href="'+escAttr(l.url)+'" target="_blank" rel="noopener">'+esc(l.title)+'</a>':esc(l.title);
    var applyBtn=l.url?'<a class="btn btn-sm" href="'+escAttr(l.url)+'" target="_blank" rel="noopener">Apply ↗</a>':(l.apply_email?'<a class="btn btn-sm" href="mailto:'+escAttr(l.apply_email)+'">✉️ Email Resume</a>':'');
    var acts='';
    if(l.status==='new')acts='<button type="button" class="btn btn-sm btn-outline" onclick="jlSetStatus(\''+escAttr(l.id)+'\',\'applied\')">✅ Applied</button><button type="button" class="btn btn-sm btn-outline" onclick="jlSetStatus(\''+escAttr(l.id)+'\',\'dismissed\')">🚫 Dismiss</button>';
    else acts='<button type="button" class="btn btn-sm btn-outline" onclick="jlSetStatus(\''+escAttr(l.id)+'\',\'new\')">↩︎ Restore</button>';
    h+='<div class="jl-row'+(isNew?' jl-new':'')+'">'
      +'<div style="flex:1;min-width:240px">'
      +'<div class="jl-title">'+title+(isNew?'<span class="jl-newtag">NEW</span>':'')+'</div>'
      +'<div class="jl-meta">'+esc(l.company||'—')+(l.location?' · '+esc(l.location):'')+(l.pay?' · <strong style="color:var(--gold-light)">'+esc(l.pay)+'</strong>':'')+'</div>'
      +(l.description?'<div class="jl-meta">'+esc(l.description)+'</div>':'')
      +'<div class="jl-meta"><span class="jl-badge" style="background:'+c+'">'+esc(l.source)+'</span>'
      +(l.posted_date?' posted '+esc(l.posted_date):'')+' · found '+new Date(l.found_at).toLocaleDateString()+'</div>'
      +'</div>'
      +'<div class="jl-actions">'+applyBtn+acts+'</div>'
      +'</div>';
  });
  el.innerHTML=h;
}
```

- [ ] **Step 2: Wire into `loadAdmin()`.** Inside `loadAdmin()`, add `loadJobLeads();` on its own line right after the admin-email guard (after the `}` closing `if(!u||u.email!==ADMIN_EMAIL){...}`), and add `astSet('ast-users',Object.keys(byUser).length);` right after the existing line `document.getElementById('admin-users').innerHTML=Object.keys(byUser).length?uHtml:'<p style="color:var(--muted)">No scores yet.</p>';`

- [ ] **Step 3: Wire alerts stat.** In `loadLoginAlerts()`, right after `if(countEl)countEl.textContent='('+alerts.length+' total)';`, add:

```js
  var wk=Date.now()-7*24*60*60*1000;
  astSet('ast-alerts',alerts.filter(function(a){return new Date(a.created_at).getTime()>=wk;}).length);
```

- [ ] **Step 4: Verify in browser** (server from Task 3 still running; hard-refresh). As admin, open Admin → Job Leads. Expected: the two TEST leads from Task 2 render with source badges (agency = dark gold, indeed = blue), pay shown on the first, ✉️ Email Resume button on the second. Click 🚫 Dismiss on one → it disappears (filter is New); click Dismissed chip → it's there; ↩︎ Restore → back under New after switching chips. Reload the page → statuses persisted. Stat strip shows real numbers. Search "paralegal" filters to one row. No console errors.

- [ ] **Step 5: Verify XSS discipline.** Confirm every interpolation in the new render code goes through `esc`/`escAttr` (review the code, not just the output).

- [ ] **Step 6: Commit** — `git commit -m "feat(admin): job leads board with filters, statuses, and stats"`

---

### Task 5: Daily scanner — scheduled cloud agent

**Files:** none in repo (cloud routine). Uses the `schedule` skill.

**Interfaces:**
- Consumes: `job-scan-ingest` endpoint + `JOB_INGEST_TOKEN` (Task 2), `SUPABASE_ANON_KEY` from `index.html`.

- [ ] **Step 1: Create the routine** via the `schedule` skill: name `aa-job-scanner`, cron `0 8 * * *` timezone `America/New_York` (if timezone unsupported, `0 12 * * *` UTC), prompt (fill in real ANON_KEY and TOKEN):

```
You are the AA Mastery job scanner. Find remote document review / eDiscovery jobs posted within the last 7 days, New York based or fully remote (US).

Run multiple web searches covering: Google Jobs, Indeed, Craigslist NYC (legal/paralegal gigs), Glassdoor, LinkedIn public job posts, ZipRecruiter, and legal staffing agencies (Hire Counsel, Beacon Hill Legal, Adams & Martin Group, Special Counsel/Adecco Legal, Lexitas, Consilio, Epiq, TCDI, Trustpoint.One, Update Legal). Vary query phrasing: "remote document review attorney", "eDiscovery review paralegal remote", "privilege review contract attorney New York", "managed review remote", etc.

Keep ONLY genuine document review / eDiscovery / privilege review / managed review roles (attorney or paralegal). Exclude general attorney jobs, sales roles, and on-site-only roles outside NY.

For each lead extract: title, company, source (exactly one of: indeed, craigslist, linkedin, glassdoor, ziprecruiter, google, agency, other), url, apply_email (only if the posting says to email a resume), pay (e.g. "$32-38/hr"), location, description (1-2 sentences), posted_date (YYYY-MM-DD if known).

POST all leads in ONE request (the server dedupes — send everything you found, including possible repeats from previous days):

curl -s -X POST 'https://mrxhydaoxlxuampmgaoi.supabase.co/functions/v1/job-scan-ingest' \
  -H 'Authorization: Bearer <ANON_KEY>' \
  -H 'x-ingest-token: <TOKEN>' \
  -H 'Content-Type: application/json' \
  -d '{"leads":[ ... ]}'

Report the {"received":N,"inserted":M} response. If you found zero leads, do not POST — just report that.
```

- [ ] **Step 2: Trigger one run now** (run-once / manual trigger). Expected: routine completes, reports `received`/`inserted`, real leads appear in the table (`select count(*) from job_leads;` grows) and a Slack ping arrives if `inserted > 0`.

- [ ] **Step 3: Browser check** — reload admin Job Leads; real leads render alongside the TEST rows.

---

### Task 6: Cleanup, push, production verify

- [ ] **Step 1: Delete the TEST rows** via MCP `execute_sql`:

```sql
delete from job_leads where title like 'TEST %';
```

- [ ] **Step 2: Push** — `git -C "/Users/jeff/Documents copy/aa-mastery" push origin main` (Vercel auto-deploys).

- [ ] **Step 3: Production verify** — open https://aa-mastery.vercel.app as admin: tabs work, real leads visible, Apply opens the posting, status changes persist. Non-admin account: no Admin button; direct `nav('admin')` shows access denied and no lead data loads (RLS).

- [ ] **Step 4: Report** — summarize to Jeff: what shipped, the routine schedule, and where the Slack pings land.
