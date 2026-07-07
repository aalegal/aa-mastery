# Casepoint Data Breach Project Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add "Project 6 — St. Aurelius Health Data Breach" to the Casepoint shell: a multi-case engine refactor, 400 breach documents (15 handwritten + 385 generated), click-to-redact PII/PHI/SBI spans with grading, a landing card, and Casepoint progress persistence.

**Architecture:** Everything lives in the single `index.html` (no build step, no framework). The existing `cp*` engine is generalized from one hardcoded case into a `CP_CASES` config keyed by case id, with per-case coding state. A new span-marker syntax (`⟦PHI|text⟧`) inside doc bodies drives an interactive redaction layer rendered in the Casepoint viewer. Persistence extends the existing localStorage + Supabase `reviewer_progress` pattern.

**Tech Stack:** Vanilla ES5-style JS in `index.html`, Axios (CDN), Supabase REST, Playwright MCP for browser verification, Supabase CLI for the migration.

## Global Constraints

- Single file: all code changes go in `/Users/jeff/aa-mastery/index.html`.
- The file ends with an inert duplicate HTML fragment (starts at the broken `</html>TYPE html>` at line ~6762). Never edit at or past it; insert all new code before it.
- All dynamic DOM content must pass through `esc(v)` or `escAttr(v)` (defined ~line 3278).
- Match existing style: `var`, function declarations, string-concatenation templates — no `let`/`const`/arrow functions/template literals (file is consistent ES5).
- Casepoint light-theme palette: navy `#13294b`, blue `#1f6fc4`, borders `#dfe5ee`, muted `#8a97ab`. Breach-case accent (dark landing card only): crimson `#c62828`.
- The antitrust case must be pixel-identical and behavior-identical after the refactor (except its card's counter element ids).
- Doc ids: breach uses `SAH-0001`…`SAH-0400`; antitrust keeps `NS-*`.
- No test framework exists — each task verifies via a local server (`python3 -m http.server 8000`) + Playwright MCP browser checks. Steps say exactly what to check.
- Deploy = push to `main` (Vercel auto-deploys). Supabase changes via `supabase` CLI with `--workdir /Users/jeff/aa-mastery` (MCP server is authenticated to the wrong org — never use it for this project). Project ref: `mrxhydaoxlxuampmgaoi`.
- Commit after every task.

---

### Task 1: Multi-case engine refactor (antitrust unchanged)

**Files:**
- Modify: `index.html` — state vars (~4944), `openCasepointCase` (~5304), `cpGetVisible`/`cpRenderList`/`cpOpenDoc`/`cpRenderDoc` (~5323–5404), `cpLabel` (~5417), `cpLoadCoding`/`cpSelect`/`cpToggleIssue` (~5430–5499), `cpSubmitCoding`/`cpShowFeedback`/`cpUpdateProgress`/`cpUpdateLanding` (~5507–5587), Casepoint shell HTML breadcrumb + coding panel (~6676, ~6714–6753), antitrust card (~2487–2507).

**Interfaces (produced, used by every later task):**
- `CP_CASES` — object keyed by case id; each case: `{ id, crumb, panelTitle, docs, fields, issues, labels, hotBand }`.
  - `fields`: array of `{ key, label, options: [{v, l}] }` radio groups, in panel order.
  - `issues`: `{ label, options: [{v, l, color}] }` multi-select group.
  - `labels`: flat `{ value: displayLabel }` map used by `cpLabel`.
- `CP_ACTIVE` — current case id string, default `'antitrust'`.
- `cpCase()` → active case config. `cpDocs()` → active case's docs array.
- `cpCodingFor()` / `cpAnsweredFor()` → the active case's per-doc maps (auto-create).
- `openCasepointCase(caseId)` — opens shell for that case (default `'antitrust'` when called with no arg, so any stale caller keeps working).
- `cpRenderPanel()` — rebuilds the coding-panel field groups from `cpCase().fields` + `cpCase().issues`.

- [ ] **Step 1: Introduce `CP_CASES` + per-case state**

After the `CP_DOCS` generator IIFE (~line 5302), add:

```js
var CP_CASES = {
  antitrust: {
    id: 'antitrust',
    crumb: '<b>NorthStar v. Meridian</b> &nbsp;›&nbsp; First Level Review &nbsp;›&nbsp; DOJ Second Request',
    panelTitle: 'Second Request Coding',
    docs: CP_DOCS,
    hotBand: '🔥 <strong>Hot Document:</strong> This document may contain competitively sensitive or smoking-gun content — code carefully.',
    fields: [
      { key:'responsive', label:'RESPONSIVENESS', options:[
        {v:'responsive',l:'Responsive'},{v:'non-responsive',l:'Not Responsive'},{v:'technical',l:'Technical Issue'}]},
      { key:'privilege', label:'PRIVILEGE', options:[
        {v:'not-privileged',l:'Not Privileged'},{v:'privileged',l:'Privileged'},{v:'redact-priv',l:'Redact (Privilege)'}]},
      { key:'action', label:'PRODUCTION', options:[
        {v:'produce',l:'Produce'},{v:'withhold',l:'Withhold'},{v:'redact',l:'Redact'}]},
      { key:'conf', label:'CONFIDENTIALITY', options:[
        {v:'confidential',l:'Confidential'},{v:'hc-aeo',l:'Highly Conf. – AEO'}]}
    ],
    issues: { label:'ISSUE TAGS', options:[
      {v:'issue1',l:'Pricing/Bidding',color:'#1f6fc4'},{v:'issue2',l:'Market Share',color:'#b8860b'},
      {v:'issue3',l:'Merger Rationale',color:'#2e9e5b'},{v:'issue4',l:'Hot Doc',color:'#d6453a'}]},
    labels: {
      'responsive':'Responsive','non-responsive':'Not Responsive','technical':'Technical Issue',
      'not-privileged':'Not Privileged','privileged':'Privileged','redact-priv':'Redact (Privilege)',
      'produce':'Produce','withhold':'Withhold','redact':'Redact',
      'confidential':'Confidential','hc-aeo':'Highly Confidential – AEO',
      'issue1':'Pricing/Bidding','issue2':'Market Share','issue3':'Merger Rationale','issue4':'Hot Doc'
    }
  }
};
var CP_ACTIVE = 'antitrust';
function cpCase(){ return CP_CASES[CP_ACTIVE]; }
function cpDocs(){ return cpCase().docs; }
function cpCodingFor(){ if(!cpCoding[CP_ACTIVE]) cpCoding[CP_ACTIVE]={}; return cpCoding[CP_ACTIVE]; }
function cpAnsweredFor(){ if(!cpAnswered[CP_ACTIVE]) cpAnswered[CP_ACTIVE]={}; return cpAnswered[CP_ACTIVE]; }
function cpMigrateFlatState(){ // one-time: flat NS-* keys -> antitrust bucket
  var flat = Object.keys(cpCoding).filter(function(k){ return k.indexOf('NS-')===0; });
  if (flat.length) {
    var bucket = cpCoding.antitrust = cpCoding.antitrust || {};
    flat.forEach(function(k){ bucket[k]=cpCoding[k]; delete cpCoding[k]; });
  }
  var flatA = Object.keys(cpAnswered).filter(function(k){ return k.indexOf('NS-')===0; });
  if (flatA.length) {
    var bucketA = cpAnswered.antitrust = cpAnswered.antitrust || {};
    flatA.forEach(function(k){ bucketA[k]=cpAnswered[k]; delete cpAnswered[k]; });
  }
}
```

- [ ] **Step 2: Rewire every `CP_DOCS` / `cpCoding[...]` / `cpAnswered[...]` reference through the helpers**

Mechanical replacements inside the cp engine only:
- `CP_DOCS.filter` / `CP_DOCS.find` / `CP_DOCS.length` in `cpGetVisible`, `cpOpenDoc`, `cpUpdateProgress` → `cpDocs().…`
- `cpCoding[d.id]` / `cpCoding[doc.id]` → `cpCodingFor()[d.id]` etc.
- `cpAnswered[d.id]` / `Object.values(cpAnswered)` / `Object.keys(cpAnswered)` in `cpRenderList`, `cpSubmitCoding`, `cpUpdateProgress`, `cpUpdateLanding` → per-case via `cpAnsweredFor()`.
- `cpLabel(val)` → look up `cpCase().labels[val] || val` (keep the array/empty handling).
- `cpRenderDoc` hot-band: use `cpCase().hotBand`, only when `doc.tags` contains `'issue4'`.
- `cpRenderDoc` tag chips: derive `tagColors`/`tagLabels` from `cpCase().issues.options` instead of the hardcoded maps.

- [ ] **Step 3: Dynamic coding panel + case-aware open**

Give the panel HTML a wrapper: replace the static field groups (between `#cp-panel-header` and `.cp-submit-section`, lines ~6719–6748) with `<div id="cp-panel-fields"></div>`, and add:

```js
function cpRenderPanel(){
  var c = cpCase(), html = '';
  c.fields.forEach(function(f){
    html += '<div class="cp-field-label">' + esc(f.label) + '</div><div id="cp-field-' + escAttr(f.key) + '">';
    f.options.forEach(function(o){
      html += '<div class="cp-option" data-f="' + escAttr(f.key) + '" data-v="' + escAttr(o.v) + '" onclick="cpSelect(this.dataset.f,this.dataset.v,this)">'
        + '<input type="radio" name="cp-' + escAttr(f.key) + '"><span>' + esc(o.l) + '</span></div>';
    });
    html += '</div>';
    if (f.key === 'privilege') { // issues group sits after privilege, matching current layout
      html += '<div class="cp-field-label">' + esc(c.issues.label) + '</div><div id="cp-field-issues">';
      c.issues.options.forEach(function(o){
        html += '<div class="cp-option" data-v="' + escAttr(o.v) + '" onclick="cpToggleIssue(this.dataset.v,this)">'
          + '<input type="checkbox"><span style="font-size:.71rem;">' + esc(o.l) + '</span></div>';
      });
      html += '</div>';
    }
  });
  document.getElementById('cp-panel-fields').innerHTML = html;
}
```

`cpSelect(field,val,el)` already receives explicit args so it needs no change; update `cpLoadCoding` to match saved values against `opt.dataset.v` instead of parsing `onclick` strings (both the radio fields and the issues checkboxes). Update `openCasepointCase`:

```js
function openCasepointCase(caseId) {
  CP_ACTIVE = CP_CASES[caseId] ? caseId : 'antitrust';
  cpMigrateFlatState();
  cpCurrentDoc = null; cpCurrentIdx = -1; cpFilterMode = 'all';
  document.getElementById('cp-crumb').innerHTML = cpCase().crumb;
  document.querySelector('#cp-coding-panel .cp-panel-title').textContent = cpCase().panelTitle;
  cpRenderPanel();
  var shell = document.getElementById('casepoint-shell');
  shell.style.display='flex'; shell.style.position='fixed'; shell.style.inset='0'; shell.style.zIndex='500';
  // reset viewer placeholder + subject bar to the "select a document" state
  setTimeout(function(){ cpRenderList(); cpUpdateProgress(); }, 50);
}
```

Give the breadcrumb span an id: `<span class="cp-crumb" id="cp-crumb">…</span>`. Change the antitrust card's `onclick` to `openCasepointCase('antitrust')` and its counter ids to `cp-proj-coded-antitrust` / `cp-proj-acc-antitrust`; `cpUpdateLanding()` loops over `CP_CASES` keys and updates `cp-proj-coded-<id>` / `cp-proj-acc-<id>` (skip missing elements).

- [ ] **Step 4: Verify antitrust is unchanged in the browser**

Run: `python3 -m http.server 8000` (background), Playwright → `http://localhost:8000`, dismiss/skip login if gated, navigate Other Projects → open Casepoint card. Check: breadcrumb reads "NorthStar v. Meridian…", panel shows all 5 field groups with correct labels, coding a doc (NS-0003: Not Responsive / Withhold) grades 5/5 with the same feedback overlay, doc-list dot turns green, filters work, Exit Review returns to Other Projects, landing counter shows 1 coded.

- [ ] **Step 5: Commit**

```bash
git add index.html && git commit -m "refactor(casepoint): config-driven multi-case engine (CP_CASES), per-case coding state"
```

---

### Task 2: Click-to-redact span engine

**Files:**
- Modify: `index.html` — CSS block after the Casepoint shell styles (~line 1221), `cpRenderDoc`, `cpSubmitCoding`, `cpShowFeedback`, new functions after `cpRenderPanel`.

**Interfaces:**
- Consumes: `cpCase()`, `cpCodingFor()`, `CP_ACTIVE` (Task 1).
- Produces:
  - Span marker syntax in doc bodies: `⟦PII|…⟧ ⟦PHI|…⟧ ⟦SBI|…⟧ ⟦DECOY|…⟧` (Tasks 3–4 author content against this).
  - `cpParseBody(body)` → `[{text, span:null|'pii'|'phi'|'sbi'|'decoy', idx}]`.
  - `cpRedactions` — `{caseId: {docId: {spanIdx: 'pii'|'phi'|'sbi'}}}` (Task 6 persists it).
  - `cpDocHasSpans(doc)` → bool. `cpGradeRedactions(doc)` → `{caught, mistyped, missed, over, total}` or `null` for span-less docs.

- [ ] **Step 1: CSS for redactable spans + tag popup**

```css
.cp-redactable{background:rgba(31,111,196,.08);border-bottom:1px dashed #9fb6d6;cursor:pointer;border-radius:2px;}
.cp-redactable:hover{background:rgba(31,111,196,.18);}
.cp-redacted{background:#111;color:#111;border-radius:3px;cursor:pointer;position:relative;border-bottom:none;user-select:none;}
.cp-redacted .cp-rdx-chip{position:absolute;top:-9px;right:-4px;background:#c62828;color:#fff;font-size:.52rem;
  font-weight:800;padding:0 4px;border-radius:6px;letter-spacing:.4px;line-height:1.5;}
#cp-rdx-pop{position:fixed;z-index:900;background:#fff;border:1px solid #dfe5ee;border-radius:8px;
  box-shadow:0 8px 28px rgba(19,41,75,.25);padding:8px;display:none;}
#cp-rdx-pop .cp-rdx-title{font-size:.62rem;font-weight:800;color:#8a97ab;text-transform:uppercase;
  letter-spacing:.5px;margin-bottom:6px;}
.cp-rdx-btn{display:block;width:100%;text-align:left;background:#f2f5fa;border:1px solid #dfe5ee;color:#13294b;
  border-radius:6px;padding:5px 10px;font-size:.74rem;font-weight:700;cursor:pointer;margin-bottom:4px;}
.cp-rdx-btn:hover{border-color:#1f6fc4;background:#e8f1fb;}
.cp-rdx-btn.unredact{color:#c62828;}
```

Popup element (add just before `</body>`-side Casepoint shell close, inside the shell div): `<div id="cp-rdx-pop"></div>`.

- [ ] **Step 2: Parser, render integration, click handling**

```js
var cpRedactions = {};
function cpRedactionsFor(docId){
  if(!cpRedactions[CP_ACTIVE]) cpRedactions[CP_ACTIVE]={};
  if(!cpRedactions[CP_ACTIVE][docId]) cpRedactions[CP_ACTIVE][docId]={};
  return cpRedactions[CP_ACTIVE][docId];
}
function cpParseBody(body){
  var out=[], re=/⟦(PII|PHI|SBI|DECOY)\|([^⟧]+)⟧/g, last=0, m, idx=0;
  while((m=re.exec(body))!==null){
    if(m.index>last) out.push({text:body.slice(last,m.index),span:null});
    out.push({text:m[2],span:m[1].toLowerCase(),idx:idx++});
    last=re.lastIndex;
  }
  if(last<body.length) out.push({text:body.slice(last),span:null});
  return out;
}
function cpDocHasSpans(doc){ return /⟦(PII|PHI|SBI)\|/.test(doc.body||''); }
```

In `cpRenderDoc`, replace `inner += '<div class="cp-body-text">' + esc(doc.body||'') + '</div>'` with segment rendering: plain segments `esc()`d; span segments as

```js
'<span class="' + (tag?'cp-redacted':'cp-redactable') + '" data-idx="' + seg.idx + '" onclick="cpSpanClick(event,this)">'
 + esc(seg.text) + (tag?'<span class="cp-rdx-chip">'+tag.toUpperCase()+'</span>':'') + '</span>'
```

where `tag = cpRedactionsFor(doc.id)[seg.idx]`. `cpSpanClick(ev, el)` positions `#cp-rdx-pop` at the click (clamped to viewport), showing either three tag buttons (PII/PHI/SBI → `cpTagSpan(idx, type)`) or an "✕ Remove redaction" button when already tagged. `cpTagSpan` writes/deletes `cpRedactionsFor(cpCurrentDoc.id)[idx]`, hides the popup, and re-runs `cpRenderDoc(cpCurrentDoc)`. A document-level click listener hides the popup on any outside click.

- [ ] **Step 3: Grading + feedback integration**

```js
function cpGradeRedactions(doc){
  var segs=cpParseBody(doc.body||''), user=cpRedactionsFor(doc.id);
  var res={caught:0,mistyped:0,missed:0,over:0,total:0,details:[]};
  var any=false;
  segs.forEach(function(s){
    if(!s.span) return;
    any=true;
    var tagged=user[s.idx];
    if(s.span==='decoy'){
      if(tagged){res.over++;res.details.push({kind:'over',text:s.text,yours:tagged});}
      return;
    }
    res.total++;
    if(!tagged){res.missed++;res.details.push({kind:'missed',text:s.text,correct:s.span});}
    else if(tagged===s.span){res.caught++;}
    else {res.mistyped++;res.details.push({kind:'mistyped',text:s.text,yours:tagged,correct:s.span});}
  });
  return any?res:null;
}
```

In `cpSubmitCoding`: compute `var rdx = cpGradeRedactions(doc);`. If `rdx`, perfection requires `rdx.missed===0 && rdx.mistyped===0 && rdx.over===0` in addition to `score===total`; store `rdx` on the `cpAnsweredFor()[doc.id]` record. In `cpShowFeedback`, when `rdx` exists append a redaction results block: summary line `Redactions: X/Y caught · N missed · N mistyped · N over-redacted` plus one row per `details` entry (`missed` rows show the span text + correct type in green; `mistyped`/`over` rows show yours in red → correct in green), reusing the existing error-row styling. All span text through `esc()`.

- [ ] **Step 4: Smoke-test with a temporary doc, then remove it**

Temporarily append one test doc with two real spans + one decoy to `CP_DOCS`, open it in the browser: spans render clickable, tagging draws the black box + chip, un-redact works, popup dismisses on outside click, submit shows the redaction block with all four outcome kinds reachable. Remove the test doc. Also confirm a normal antitrust doc (no markers) renders identically to Task 1.

- [ ] **Step 5: Commit**

```bash
git add index.html && git commit -m "feat(casepoint): click-to-redact span engine with PII/PHI/SBI tagging and grading"
```

---

### Task 3: Breach case config + 15 handwritten documents

**Files:**
- Modify: `index.html` — new `SAH_DOCS` array + `CP_CASES.breach` entry after the antitrust config.

**Interfaces:**
- Consumes: span marker syntax (Task 2); `CP_CASES` shape (Task 1).
- Produces: `SAH_DOCS` (docs `SAH-0001`…`SAH-0015`), `CP_CASES.breach` (Tasks 4–5 reference both).

- [ ] **Step 1: Add `CP_CASES.breach`**

```js
CP_CASES.breach = {
  id:'breach',
  crumb:'<b>Doe v. St. Aurelius Health</b> &nbsp;›&nbsp; First Level Review &nbsp;›&nbsp; Breach Litigation',
  panelTitle:'Breach Review Coding',
  docs: SAH_DOCS,
  hotBand:'🔥 <strong>Hot Document:</strong> This document may contain smoking-gun content about the breach, notification delay, or ignored warnings — code carefully.',
  fields: [
    { key:'responsive', label:'RESPONSIVENESS', options:[
      {v:'responsive',l:'Responsive'},{v:'non-responsive',l:'Not Responsive'},{v:'technical',l:'Technical Issue'}]},
    { key:'privilege', label:'PRIVILEGE', options:[
      {v:'not-privileged',l:'Not Privileged'},{v:'privileged',l:'Privileged'},{v:'redact-priv',l:'Redact (Privilege)'}]},
    { key:'action', label:'PRODUCTION', options:[
      {v:'produce',l:'Produce'},{v:'withhold',l:'Withhold'},{v:'redact',l:'Redact'}]},
    { key:'conf', label:'CONFIDENTIALITY', options:[
      {v:'confidential',l:'Confidential'},{v:'hc-aeo',l:'Highly Conf. – AEO'}]}
  ],
  issues: { label:'ISSUE TAGS', options:[
    {v:'issue1',l:'Security Failures',color:'#c62828'},
    {v:'issue2',l:'Timeline & Notification',color:'#b8860b'},
    {v:'issue3',l:'Incident Response',color:'#2e9e5b'},
    {v:'issue4',l:'Hot Doc',color:'#d6453a'}]},
  labels: { /* same coding labels as antitrust, plus */ 
    'issue1':'Security Failures','issue2':'Timeline & Notification','issue3':'Incident Response','issue4':'Hot Doc' }
};
```

- [ ] **Step 2: Author the 15 handwritten docs**

Same object shape as `CP_DOCS` entries (`id,type,custodian,tags,from,to,cc,date,subject,body,answer,explanation`). Custodians: `cust-ciso` (Priya Raman, CISO), `cust-ceo` (Robert Ellison, CEO), `cust-gc` (Diane Okafor, GC), `cust-it` (Marcus Webb, IT Dir.), `cust-hr` (Janet Cole, HR Dir.). Outside counsel: Whitmore & Gray LLP (Sarah Lindqvist); forensics vendor: Sentinel Forensics. Breach discovered March 14 2025; ransom note from CryptVault March 15; patients notified May 2 2025. Each doc's teaching point, answer, and required spans:

| ID | Doc (teaching point) | answer | Spans in body |
|---|---|---|---|
| SAH-0001 | Sentinel Forensics preliminary report **commissioned by Whitmore & Gray** "at direction of counsel in anticipation of litigation" — work product | responsive / privileged / withhold / hc-aeo / [issue3] | none |
| SAH-0002 | Routine **pre-breach** security audit (Jan 2025) flagging unpatched VPN — sounds legal, is not | responsive / not-privileged / produce / confidential / [issue1] | none |
| SAH-0003 | Press-release draft, GC merely cc'd — counsel cc ≠ privilege | responsive / not-privileged / produce / confidential / [issue3] | none |
| SAH-0004 | CryptVault ransom-negotiation chat transcript | responsive / not-privileged / produce / hc-aeo / [issue3,issue4] | `⟦SBI|$2.4M in Bitcoin⟧` demand figure |
| SAH-0005 | HR retention spreadsheet — employee `⟦PII|SSN⟧`s, `⟦PII|home address⟧`es, salaries | responsive / not-privileged / redact / confidential / [] | 3× PII + 1 DECOY (job title) |
| SAH-0006 | Patient complaint email — `⟦PHI|diagnosis⟧`, `⟦PHI|medical record number⟧`, `⟦PII|DOB⟧` | responsive / not-privileged / redact / confidential / [issue2] | 2× PHI, 1× PII, 1 DECOY (hospital dept name) |
| SAH-0007 | Board memo: `⟦SBI|cyber-insurance $40M coverage cap⟧` + `⟦SBI|pending Meridian Health acquisition⟧` | responsive / not-privileged / redact / hc-aeo / [issue3] | 2× SBI, 1 DECOY (board meeting date) |
| SAH-0008 | `backup_vault_2025.enc` — unreadable encrypted file | technical / not-privileged / withhold / confidential / [] | none |
| SAH-0009 | Personal email (CEO's kid's soccer schedule) | non-responsive / not-privileged / withhold / confidential / [] | none |
| SAH-0010 | Feb 2025 pen-test vendor email: "critical — exploitable in under an hour", IT Dir. replies "no budget until Q3" | responsive / not-privileged / produce / confidential / [issue1,issue4] | none |
| SAH-0011 | CISO→CEO March 20: "suggest we hold notification until after the bond issuance closes" | responsive / not-privileged / produce / hc-aeo / [issue2,issue4] | `⟦SBI|bond issuance⟧` |
| SAH-0012 | Whitmore & Gray advice memo on HIPAA/state notification deadlines | responsive / privileged / withhold / confidential / [issue2] | none |
| SAH-0013 | Incident timeline doc with one embedded paragraph of counsel's advice | responsive / redact-priv / redact / confidential / [issue3] | none (privilege redaction is coded, not span-tagged) |
| SAH-0014 | Sentinel Forensics invoice — routine vendor traffic | responsive / not-privileged / produce / confidential / [] | none |
| SAH-0015 | Patient notification letter template with sample patient `⟦PHI|test result⟧` + `⟦PII|name and DOB⟧` placeholders | responsive / not-privileged / redact / confidential / [issue2] | 1× PHI, 1× PII |

Every `explanation` states the rule being taught (2–4 sentences, same register as the NS docs). Bodies are realistic multi-paragraph emails/memos (~60–150 words) with the spans embedded in natural sentences.

- [ ] **Step 3: Verify in browser**

Temporarily point a console call at `openCasepointCase('breach')` (or add the card early): all 15 docs list, SAH-0006 renders with 4 clickable spans, coding + redacting it correctly yields "Perfect Coding!" with `3/3 caught`, deliberately tagging the decoy yields an over-redaction row.

- [ ] **Step 4: Commit**

```bash
git add index.html && git commit -m "feat(casepoint): St. Aurelius breach case config + 15 handwritten teaching docs"
```

---

### Task 4: Generated volume (SAH-0016 … SAH-0400)

**Files:**
- Modify: `index.html` — `buildBreachVolume()` IIFE directly after `SAH_DOCS`.

**Interfaces:**
- Consumes: `SAH_DOCS`, span syntax.
- Produces: `SAH_DOCS` grown to 400 entries, deterministic across loads.

- [ ] **Step 1: Write the generator**

Clone the structure of `buildCasepointVolume()` (~line 5067): same LCG PRNG (`Math.imul(s,1664525)+1013904223`, seed differs, e.g. 20250314), `pick()` helper, weighted archetype table. Archetypes (weight ≈ count out of 385):

| Archetype | ≈weight | answer | Spans emitted |
|---|---|---|---|
| patientComplaint | 70 | responsive/not-priv/**redact**/conf/[issue2] | 1–2 PHI (diagnosis, MRN) + 1 PII (DOB) + 0–1 DECOY |
| hrPiiList | 40 | responsive/not-priv/**redact**/conf/[] | 2 PII (SSN, address) + 0–1 DECOY |
| execSbi | 35 | responsive/not-priv/**redact**/hc-aeo/[issue3] | 1–2 SBI ($ figures, deal names) + 0–1 DECOY |
| itAlert (pre-breach warnings) | 45 | responsive/not-priv/produce/conf/[issue1] | none |
| forensicCounsel (at direction of counsel) | 30 | responsive/privileged/withhold/hc-aeo/[issue3] | none |
| forensicRoutine (status pings) | 35 | responsive/not-priv/produce/conf/[issue3] | none |
| notificationChatter | 40 | responsive/not-priv/produce/conf/[issue2] | none |
| pressDraft | 25 | responsive/not-priv/produce/conf/[issue3] | none |
| vendorInvoice | 25 | responsive/not-priv/produce/conf/[] | none |
| personalNoise | 25 | non-responsive/not-priv/withhold/conf/[] | none |
| encryptedFile | 15 | technical/not-priv/withhold/conf/[] | none |

Surface variation pools: 12 patient names, 10 employee names, diagnoses list (10 entries), MRN pattern `MRN-##⁠####`, SSN pattern, street addresses, $ figures, dates Feb–Jun 2025, custodians from Task 3. Bodies are 2–4 sentence templates with pool values (and span markers) interpolated by string concatenation. Each generated doc gets a one-sentence `explanation` derived from its archetype.

- [ ] **Step 2: Verify determinism + count**

Browser console: `SAH_DOCS.length` → 400; reload twice and compare `SAH_DOCS[250].subject` — identical. Spot-open a generated patientComplaint doc: spans clickable and gradeable. Update the breach `crumb`/card copy to "400 documents".

- [ ] **Step 3: Commit**

```bash
git add index.html && git commit -m "feat(casepoint): deterministic 385-doc breach review volume with redaction spans"
```

---

### Task 5: Other Projects landing card

**Files:**
- Modify: `index.html` — insert card after the antitrust card (~line 2508).

**Interfaces:**
- Consumes: `openCasepointCase('breach')`, counter ids `cp-proj-coded-breach` / `cp-proj-acc-breach` (Task 1's `cpUpdateLanding`).

- [ ] **Step 1: Add the card**

Copy the antitrust card structure with: crimson accent `#c62828`, badge `🏥 Data Breach · HIPAA / Class Action · Casepoint Platform`, title `🏥 St. Aurelius Health — Ransomware Data Breach`, sub `Doe v. St. Aurelius Health System · CryptVault Ransomware · 2.1M Patient Records · PII / PHI / SBI Redaction Training`, the four breach issue tags (colors from Task 3), footer `🖥️ Runs on Casepoint · 400 documents · HHS OCR + Class Action`, counters `cp-proj-coded-breach` / `cp-proj-acc-breach`, button `Open in Casepoint →` (crimson background).

- [ ] **Step 2: Verify + commit**

Browser: card renders between antitrust and AI cards, opens the breach case, counters update after coding a doc and exiting.

```bash
git add index.html && git commit -m "feat(casepoint): St. Aurelius breach project card on Other Projects"
```

---

### Task 6: Persistence (localStorage + Supabase)

**Files:**
- Modify: `index.html` — `buildProgressData` (~5770), `applyProgressData` (~5785), `saveProgressRemote` (~5821), `loadProgressRemote` (~5848).
- Migration: `supabase/migrations/20260707_add_casepoint_progress.sql`

**Interfaces:**
- Consumes: `cpCoding`, `cpAnswered`, `cpRedactions`, `cpMigrateFlatState()`.

- [ ] **Step 1: Local persistence**

`buildProgressData()` adds `cp_coding: cpCoding, cp_answered: cpAnswered, cp_redactions: cpRedactions`. `applyProgressData()` adds:

```js
if (d.cp_coding) cpCoding = d.cp_coding;
if (d.cp_answered) cpAnswered = d.cp_answered;
if (d.cp_redactions) cpRedactions = d.cp_redactions;
cpMigrateFlatState();
```

- [ ] **Step 2: Remote persistence**

`saveProgressRemote()`: stringify the three new keys like the existing ones. `loadProgressRemote()`: parse them with the same string-or-object guard, defaulting `{}`.

- [ ] **Step 3: Supabase migration**

```sql
alter table reviewer_progress
  add column if not exists cp_coding text,
  add column if not exists cp_answered text,
  add column if not exists cp_redactions text;
```

Apply with the CLI (never the MCP server — wrong org): confirm link with `supabase projects list --workdir /Users/jeff/aa-mastery` (ref `mrxhydaoxlxuampmgaoi`), then `supabase db push --workdir /Users/jeff/aa-mastery` (or `supabase migration up` equivalent for the linked remote; if the repo has no migrations history baseline, apply the single statement via `supabase db query` / SQL editor fallback and still commit the migration file).

- [ ] **Step 4: Verify + commit**

Browser: code 2 breach docs + 1 redaction, reload → progress and redaction boxes restored (localStorage). Logged in, confirm the POST to `reviewer_progress` returns 2xx in the network log (no silent 400).

```bash
git add index.html supabase/migrations/20260707_add_casepoint_progress.sql
git commit -m "feat(casepoint): persist per-case coding, answers, and redactions (local + Supabase)"
```

---

### Task 7: End-to-end verification + publish

- [ ] **Step 1: Full regression pass (Playwright)**

1. Antitrust: open, code NS-0001 correctly → 5/5; progress % and landing counters update.
2. Breach: open, code SAH-0006 with correct coding + all 3 spans → Perfect; miss a span on SAH-0005 → partial with "missed" row; tag the SAH-0005 decoy → over-redaction row.
3. Case isolation: coding in breach doesn't change antitrust counters and vice versa; switching cases mid-session re-renders panel/breadcrumb/doc list correctly.
4. Reload → both cases' progress restored.
5. Other pages (home, quiz, reference) still load with zero console errors.

- [ ] **Step 2: Publish**

```bash
git push origin main
```

Verify: `curl -s https://api.github.com/repos/aalegal/aa-mastery/deployments | head` shows a new deployment; then load https://aa-mastery.vercel.app, open Other Projects, confirm the St. Aurelius card is live and opens.
