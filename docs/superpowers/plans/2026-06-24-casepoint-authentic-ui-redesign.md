# Casepoint Authentic UI Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restyle the existing Casepoint review shell to resemble the real (light-themed, left-nav-rail) Casepoint eDiscovery platform, instead of the current dark re-skin of Everlaw.

**Architecture:** Presentation-only change inside the single `index.html`. Replace the `cp-*` CSS block with a light palette + new chrome classes; restructure the `#casepoint-shell` markup to add a left navigation rail and a workspace wrapper with a white top bar; update `cpRenderList` (grid rows) and `cpRenderDoc` (white "document page"); shift the project-card accent from teal to Casepoint blue. All JS-consumed element IDs are preserved, so coding logic, scoring, feedback, stats, and persistence are unchanged.

**Tech Stack:** Static HTML/CSS/vanilla JS, no build step, no test runner. Verification is manual in a browser (headless Playwright acceptable).

## Global Constraints

- All edits are in `/Users/jeff/Documents/aa-mastery/index.html`. **Live content ends at `</body>` (line ~6480 region); never edit at/after the `</html>TYPE html>` line that begins the inert duplicate fragment.** All edit anchors in this plan are in live content.
- **Preserve every JS-consumed ID and handler** — do not rename: `cp-doc-list`, `cp-doc-body`, `cp-doc-subject-bar`, `cp-doc-counter`, `cp-prev-btn`, `cp-next-btn`, `cp-panel-doc-id`, `cp-submit-btn`, `cp-progress-fill`, `cp-prog-pct`, `cp-accuracy-disp`, `cp-field-responsive`/`-privilege`/`-issues`/`-action`/`-conf`; handlers `closeCasepoint()`, `cpFilter(...)`, `cpNav(...)`, `cpSelect(...)`, `cpToggleIssue(...)`, `cpSubmitCoding()`, `cpOpenDoc(...)`. The `.cp-doc-item[data-id=...]` row class and `.cp-status-dot`/`.cp-option`/`.cp-tag-chip`/`.cp-hot-band` class names are also relied on by JS/CSS — keep them.
- Light palette (use these exact hex values): app bg `#eef1f6`; panels/cards `#ffffff`; section fills `#f7f9fc`; navy rail `#13294b`; primary text `#1a2b4a`; secondary text `#5b6b85`; muted `#8a97ab`; Casepoint blue accent `#1f6fc4` (hover `#175aa3`); borders `#dfe5ee` / `#eef1f6`; selected-row fill `#e8f1fb`.
- Do not touch the Relativity or Everlaw shells, `CP_DOCS`, scoring, or persistence.
- Any new dynamic content inserted into the DOM goes through `esc()` / `escAttr()`.

## File Structure

| File | Responsibility | Change |
|------|----------------|--------|
| `index.html` CSS, lines 1105-1185 | `cp-*` shell styles | Replace whole block (light theme + new chrome classes) |
| `index.html` markup, lines 6250-6263 | shell chrome (rail + top bar + workspace open) | Replace |
| `index.html` markup, lines 6266-6273 | doc-list panel (header + filters) | Replace |
| `index.html` markup, line ~6333 region | workspace/rail closing tags | Add one closing `</div>` |
| `index.html` JS, lines 4926-4944 | `cpRenderList` grid rows | Replace |
| `index.html` JS, lines 4969-4993 | `cpRenderDoc` white doc page | Replace |
| `index.html` markup, line 2406 | project card accent | Recolor teal→blue |

---

## Task 1: Replace the `cp-*` CSS block with the light Casepoint theme

**Files:**
- Modify: `index.html` lines 1105-1185 (between `/* ══ CASEPOINT SHELL ══ */` and the blank lines before `/* ══ BATCH SYSTEM ══ */`).

**Interfaces:**
- Produces (CSS classes/IDs consumed by Task 2 & 3 markup): `#casepoint-shell` (now `flex-direction:row`), `#cp-railnav`, `.cp-rail-btn`(`.active`), `.cp-rail-logo`, `#cp-workspace`, `#cp-topbar`, `.cp-wordmark`, `.cp-crumb`, `.cp-topbar-btn`, `#cp-progress-bar`/`#cp-progress-fill`, `#cp-main`, `#cp-left`, `.cp-list-header`, `.cp-filter-btn`(`.active`), `#cp-doc-list`, `.cp-doc-item`(`.active`), `.cp-doc-check`, `.cp-doc-id`, `.cp-doc-subject`, `.cp-doc-meta-row`, `.cp-status-dot`(`.uncoded`/`.coded-correct`/`.coded-partial`/`.coded-wrong`), `#cp-viewer`, `#cp-doc-gutter`, `.cp-doc-page`, `#cp-doc-header`, `#cp-doc-subject-bar`, `#cp-doc-nav`, `.cp-nav-btn`, `#cp-doc-counter`, `#cp-doc-body` (now the scrolling gutter), `.cp-doc-page`, `.cp-email-header`, `.cp-header-row`/`-label`/`-val`, `.cp-hot-band`, `.cp-body-text`, `.cp-tag-chip`, `#cp-coding-panel`, `#cp-panel-header`, `.cp-panel-title`, `.cp-field-label`, `.cp-option`(`.selected`), `.cp-submit-section`, `.cp-submit-btn`, `.cp-skip-btn`.

- [ ] **Step 1: Replace the CSS block.** Select the exact text from line 1105 (`/* ══ CASEPOINT SHELL ══ */`) through line 1185 (`  transition:width .3s;}` — the `#cp-progress-fill` rule, the last line before the two blank lines and `/* ══ BATCH SYSTEM ══ */`). Replace that entire block with:

```css
/* ══ CASEPOINT SHELL (light platform theme) ══ */
#casepoint-shell{
  display:none;position:fixed;inset:0;z-index:200;
  background:#eef1f6;flex-direction:row;color:#1a2b4a;
  font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;
}
#casepoint-shell.open{display:flex;}
/* Left navigation rail */
#cp-railnav{width:64px;flex-shrink:0;background:#13294b;display:flex;flex-direction:column;
  align-items:center;padding-top:8px;gap:2px;}
.cp-rail-logo{width:34px;height:34px;border-radius:8px;background:#1f6fc4;color:#fff;
  display:flex;align-items:center;justify-content:center;font-weight:800;font-size:1rem;margin-bottom:10px;}
.cp-rail-btn{width:100%;border:none;background:transparent;color:#9fb1cd;cursor:pointer;
  padding:9px 0 7px;display:flex;flex-direction:column;align-items:center;gap:3px;
  font-size:.56rem;font-weight:600;letter-spacing:.2px;border-left:3px solid transparent;}
.cp-rail-btn .cp-rail-ico{font-size:1.02rem;line-height:1;}
.cp-rail-btn:hover{color:#dce6f5;background:rgba(255,255,255,.05);}
.cp-rail-btn.active{color:#fff;border-left:3px solid #4f9be8;background:rgba(79,155,232,.14);}
/* Workspace (everything right of the rail) */
#cp-workspace{flex:1;display:flex;flex-direction:column;min-width:0;}
#cp-topbar{background:#fff;border-bottom:1px solid #dfe5ee;height:48px;flex-shrink:0;
  display:flex;align-items:center;gap:12px;padding:0 16px;}
.cp-wordmark{font-size:1.02rem;font-weight:800;color:#13294b;letter-spacing:-.3px;}
.cp-wordmark span{color:#1f6fc4;}
.cp-crumb{color:#5b6b85;font-size:.78rem;}
.cp-crumb b{color:#1a2b4a;font-weight:700;}
.cp-topbar-btn{background:#1f6fc4;border:1px solid #1f6fc4;color:#fff;
  padding:5px 12px;border-radius:5px;font-size:.74rem;font-weight:600;cursor:pointer;}
.cp-topbar-btn:hover{background:#175aa3;border-color:#175aa3;}
#cp-progress-bar{height:3px;background:#dfe5ee;flex-shrink:0;}
#cp-progress-fill{height:100%;background:#1f6fc4;transition:width .3s;}
#cp-main{display:flex;flex:1;min-height:0;}
/* Doc list (grid style) */
#cp-left{width:248px;flex-shrink:0;background:#fff;border-right:1px solid #dfe5ee;
  display:flex;flex-direction:column;overflow:hidden;}
.cp-list-header{padding:9px 12px;background:#f7f9fc;border-bottom:1px solid #dfe5ee;
  font-size:.68rem;font-weight:700;color:#5b6b85;text-transform:uppercase;letter-spacing:.5px;
  display:flex;align-items:center;gap:8px;}
.cp-filter-bar{padding:6px 8px;border-bottom:1px solid #eef1f6;display:flex;gap:5px;}
.cp-filter-btn{flex:1;background:#f2f5fa;border:1px solid #dfe5ee;color:#5b6b85;
  padding:4px 0;border-radius:5px;font-size:.68rem;font-weight:600;cursor:pointer;}
.cp-filter-btn:hover{border-color:#1f6fc4;color:#1f6fc4;}
.cp-filter-btn.active{background:#e8f1fb;border-color:#1f6fc4;color:#15467f;}
#cp-doc-list{flex:1;overflow-y:auto;}
.cp-doc-item{padding:9px 12px;border-bottom:1px solid #eef1f6;cursor:pointer;
  display:flex;gap:8px;align-items:flex-start;transition:background .12s;border-left:3px solid transparent;}
.cp-doc-item:hover{background:#f5f8fd;}
.cp-doc-item.active{background:#e8f1fb;border-left:3px solid #1f6fc4;}
.cp-doc-check{width:13px;height:13px;border:1px solid #c2ccdb;border-radius:3px;flex-shrink:0;margin-top:2px;background:#fff;}
.cp-doc-main{min-width:0;flex:1;}
.cp-doc-toprow{display:flex;align-items:center;gap:6px;}
.cp-doc-id{font-size:.68rem;color:#1f6fc4;font-weight:700;font-family:ui-monospace,Menlo,monospace;}
.cp-doc-type{font-size:.64rem;color:#8a97ab;margin-left:auto;text-transform:uppercase;letter-spacing:.3px;}
.cp-doc-subject{font-size:.76rem;color:#1a2b4a;margin-top:2px;overflow:hidden;
  text-overflow:ellipsis;white-space:nowrap;font-weight:600;}
.cp-doc-meta-row{font-size:.66rem;color:#8a97ab;margin-top:2px;display:flex;gap:6px;}
.cp-status-dot{width:7px;height:7px;border-radius:50%;flex-shrink:0;margin-top:4px;}
.cp-status-dot.uncoded{background:#c2ccdb;}
.cp-status-dot.coded-correct{background:#2e9e5b;}
.cp-status-dot.coded-partial{background:#e0921a;}
.cp-status-dot.coded-wrong{background:#d6453a;}
/* Viewer */
#cp-viewer{flex:1;display:flex;flex-direction:column;overflow:hidden;background:#eef1f6;}
#cp-doc-header{padding:10px 16px;background:#fff;border-bottom:1px solid #dfe5ee;flex-shrink:0;}
#cp-doc-subject-bar{font-size:.9rem;font-weight:700;color:#1a2b4a;margin-bottom:5px;}
#cp-doc-nav{display:flex;gap:6px;align-items:center;}
.cp-nav-btn{background:#fff;border:1px solid #dfe5ee;color:#5b6b85;
  padding:3px 11px;border-radius:5px;cursor:pointer;font-size:.78rem;}
.cp-nav-btn:hover{border-color:#1f6fc4;color:#1f6fc4;}
.cp-nav-btn:disabled{opacity:.4;cursor:default;}
#cp-doc-counter{font-size:.74rem;color:#8a97ab;}
#cp-doc-body{flex:1;overflow-y:auto;padding:22px 18px;background:#eef1f6;}
.cp-doc-page{background:#fff;max-width:820px;margin:0 auto;border:1px solid #e3e9f2;
  border-radius:6px;box-shadow:0 1px 4px rgba(20,40,80,.08);padding:22px 26px;}
.cp-email-header{background:#f7f9fc;border:1px solid #e3e9f2;border-radius:8px;
  padding:12px 14px;margin-bottom:14px;}
.cp-header-row{display:flex;gap:8px;margin-bottom:4px;font-size:.8rem;}
.cp-header-label{color:#1f6fc4;font-weight:700;min-width:60px;flex-shrink:0;}
.cp-header-val{color:#38465e;}
.cp-hot-band{background:#fdecec;border:1px solid #f1b0b0;border-radius:6px;
  padding:8px 12px;margin-bottom:12px;font-size:.75rem;color:#b3261e;
  display:flex;align-items:center;gap:8px;}
.cp-body-text{font-size:.85rem;color:#38465e;line-height:1.8;white-space:pre-wrap;word-break:break-word;}
.cp-tag-chip{display:inline-block;padding:1px 8px;border-radius:10px;font-size:.67rem;
  font-weight:700;margin:2px;border:1px solid;}
/* Coding pane */
#cp-coding-panel{width:252px;flex-shrink:0;background:#fff;border-left:1px solid #dfe5ee;
  display:flex;flex-direction:column;overflow-y:auto;}
#cp-panel-header{padding:10px 14px;background:#f7f9fc;border-bottom:1px solid #dfe5ee;flex-shrink:0;}
.cp-panel-title{font-size:.76rem;font-weight:800;color:#13294b;text-transform:uppercase;letter-spacing:.5px;}
.cp-field-label{font-size:.66rem;font-weight:700;color:#8a97ab;text-transform:uppercase;
  letter-spacing:.4px;margin-bottom:4px;padding:0 12px;margin-top:12px;}
.cp-option{display:flex;align-items:center;gap:8px;padding:6px 11px;border-radius:6px;
  border:1px solid #dfe5ee;background:#fff;cursor:pointer;transition:all .12s;
  font-size:.76rem;color:#38465e;margin:0 10px 4px;}
.cp-option:hover{border-color:#1f6fc4;background:#f0f6fe;color:#15467f;}
.cp-option.selected{border-color:#1f6fc4;background:#e8f1fb;color:#15467f;font-weight:600;}
.cp-option input{width:13px;height:13px;flex-shrink:0;accent-color:#1f6fc4;}
.cp-submit-section{padding:12px 10px;margin-top:auto;border-top:1px solid #dfe5ee;flex-shrink:0;}
.cp-submit-btn{width:100%;background:#1f6fc4;color:#fff;border:none;border-radius:6px;
  padding:10px;font-weight:700;font-size:.82rem;cursor:pointer;margin-bottom:6px;}
.cp-submit-btn:hover{background:#175aa3;}
.cp-submit-btn:disabled{opacity:.45;cursor:default;background:#9fb6d6;}
.cp-skip-btn{width:100%;background:#fff;border:1px solid #dfe5ee;
  color:#5b6b85;border-radius:6px;padding:7px;font-size:.76rem;cursor:pointer;}
.cp-skip-btn:hover{border-color:#1f6fc4;color:#1f6fc4;}
```

- [ ] **Step 2: Verify the CSS parses and applies a light palette.** Serve and check via headless browser (the layout will look temporarily off until Task 2 adds the rail/workspace markup — that is expected; this step only confirms the palette is light and there are no errors):

Run:
```bash
cd /Users/jeff/Documents/aa-mastery
pkill -f "http.server 8000" 2>/dev/null; sleep 0.3
python3 -m http.server 8000 >/tmp/cp_http.log 2>&1 &
sleep 1.2
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:8000/
grep -c "CASEPOINT SHELL (light platform theme)" index.html
```
Expected: `200`, and `1`. Then in a browser console: `getComputedStyle(document.getElementById('casepoint-shell')).backgroundColor` → `rgb(238, 241, 246)` (light). No new console errors beyond the pre-existing favicon 404.

- [ ] **Step 3: Commit.**

```bash
cd /Users/jeff/Documents/aa-mastery
git add index.html
git commit -m "style(casepoint): replace shell CSS with light platform theme

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 2: Restructure the shell markup — left rail, top bar, workspace, list header

**Files:**
- Modify: `index.html` lines 6250-6263 (shell open + old toolbar + progress bar + main open); lines 6266-6273 (doc-list panel filters); and the workspace closing tag near line 6333.

**Interfaces:**
- Consumes: CSS classes from Task 1.
- Produces: the new chrome DOM (`#cp-railnav`, `#cp-workspace`, `#cp-topbar`, `.cp-list-header`, `.cp-filter-btn`); preserves `#cp-progress-bar`/`#cp-progress-fill`/`#cp-main`/`#cp-left`/`#cp-doc-list` and all stat IDs.

- [ ] **Step 1: Replace the shell-open + toolbar + progress + main-open block.** Replace exactly lines 6250-6264 — from `<div id="casepoint-shell">` through the `<div id="cp-main">` line (inclusive) — with:

```html
<div id="casepoint-shell">
  <!-- Left navigation rail -->
  <nav id="cp-railnav">
    <div class="cp-rail-logo">C</div>
    <button class="cp-rail-btn" type="button"><span class="cp-rail-ico">🏠</span>Home</button>
    <button class="cp-rail-btn" type="button"><span class="cp-rail-ico">📂</span>Batches</button>
    <button class="cp-rail-btn active" type="button"><span class="cp-rail-ico">📄</span>Review</button>
    <button class="cp-rail-btn" type="button"><span class="cp-rail-ico">🔍</span>Search</button>
    <button class="cp-rail-btn" type="button"><span class="cp-rail-ico">⚙️</span>Actions</button>
    <button class="cp-rail-btn" type="button"><span class="cp-rail-ico">📊</span>Reports</button>
  </nav>
  <!-- Workspace -->
  <div id="cp-workspace">
    <div id="cp-topbar">
      <span class="cp-wordmark">Case<span>point</span></span>
      <span class="cp-crumb"><b>NorthStar v. Meridian</b> &nbsp;›&nbsp; First Level Review &nbsp;›&nbsp; DOJ Second Request</span>
      <div style="display:flex;gap:8px;margin-left:auto;align-items:center;">
        <span style="font-size:.72rem;color:#5b6b85">Coded <b id="cp-prog-pct" style="color:#1a2b4a">0%</b></span>
        <span style="font-size:.72rem;color:#5b6b85">Accuracy <b id="cp-accuracy-disp" style="color:#1f6fc4">—</b></span>
        <button class="cp-topbar-btn" onclick="closeCasepoint()">Exit Review</button>
      </div>
    </div>
    <div id="cp-progress-bar"><div id="cp-progress-fill" style="width:0%"></div></div>
    <div id="cp-main">
```

- [ ] **Step 2: Replace the doc-list filter header.** Replace exactly lines 6266-6271 — from `<div id="cp-left">` through the closing `</div>` of the old inline filter bar (the `</div>` on line 6271, immediately before `<div id="cp-doc-list" ...>`) — with:

```html
    <div id="cp-left">
      <div class="cp-list-header">📄 Documents</div>
      <div class="cp-filter-bar">
        <button class="cp-filter-btn active" onclick="cpFilter('all',this)">All</button>
        <button class="cp-filter-btn" onclick="cpFilter('uncoded',this)">Uncoded</button>
        <button class="cp-filter-btn" onclick="cpFilter('coded',this)">Coded</button>
      </div>
```

- [ ] **Step 3: Add the workspace closing tag.** The new `#cp-workspace` wrapper needs one extra closing `</div>`. Find the closing of `#cp-main` and `#casepoint-shell` (the two `</div>` lines that currently end the shell, right before the blank lines preceding `<div id="save-progress-toast"`). They currently read:

```html
  </div>
</div>
```

(the first `</div>` closes `#cp-main`, the second closes `#casepoint-shell`). Replace with:

```html
  </div>
  </div>
</div>
```

(now: close `#cp-main`, close `#cp-workspace`, close `#casepoint-shell`).

- [ ] **Step 4: Verify the chrome renders.** Reload `http://localhost:8000`, then in the browser console:

```javascript
document.getElementById('casepoint-shell').style.display='flex';
JSON.stringify({
  rail: !!document.getElementById('cp-railnav'),
  workspace: !!document.getElementById('cp-workspace'),
  topbar: !!document.getElementById('cp-topbar'),
  railBtns: document.querySelectorAll('.cp-rail-btn').length,
  activeRail: document.querySelector('.cp-rail-btn.active') ? document.querySelector('.cp-rail-btn.active').textContent.trim() : null,
  filterBtns: document.querySelectorAll('.cp-filter-btn').length,
  progPctId: !!document.getElementById('cp-prog-pct'),
  accId: !!document.getElementById('cp-accuracy-disp')
})
```
Expected: `rail/workspace/topbar` all `true`, `railBtns` `6`, `activeRail` contains `Review`, `filterBtns` `3`, both stat IDs `true`. The rail (navy) sits left of a white top bar with the "Casepoint" wordmark; no console errors.

- [ ] **Step 5: Commit.**

```bash
cd /Users/jeff/Documents/aa-mastery
git add index.html
git commit -m "feat(casepoint): add left nav rail and white top bar chrome

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 3: Update `cpRenderList` (grid rows) and `cpRenderDoc` (white document page)

**Files:**
- Modify: `index.html` lines 4926-4944 (`cpRenderList`) and lines 4969-4993 (`cpRenderDoc`).

**Interfaces:**
- Consumes: `.cp-doc-item`/`.cp-doc-check`/`.cp-doc-main`/`.cp-doc-toprow`/`.cp-doc-id`/`.cp-doc-type`/`.cp-doc-subject`/`.cp-doc-meta-row`/`.cp-status-dot`, `.cp-doc-page`, `.cp-hot-band`, `.cp-email-header`, `.cp-tag-chip` (Task 1). Calls `esc`/`escAttr` (existing).
- Produces: unchanged function names/signatures `cpRenderList()`, `cpRenderDoc(doc)`; the `.cp-doc-item[data-id]` contract for `cpOpenDoc` is preserved.

- [ ] **Step 1: Replace `cpRenderList`.** Replace exactly lines 4926-4944 (the whole `function cpRenderList() { ... }`) with:

```javascript
function cpRenderList() {
  var visible = cpGetVisible();
  var list = document.getElementById('cp-doc-list');
  if (!list) return;
  list.innerHTML = visible.map(function(d) {
    var ans = cpAnswered[d.id];
    var dotClass = ans ? (ans.correct ? 'coded-correct' : ans.partial ? 'coded-partial' : 'coded-wrong') : 'uncoded';
    var isActive = cpCurrentDoc && cpCurrentDoc.id === d.id ? ' active' : '';
    return '<div class="cp-doc-item' + isActive + '" onclick="cpOpenDoc(this.dataset.id)" data-id="' + escAttr(d.id) + '">'
      + '<div class="cp-doc-check"></div>'
      + '<div class="cp-status-dot ' + dotClass + '"></div>'
      + '<div class="cp-doc-main">'
      + '<div class="cp-doc-toprow"><span class="cp-doc-id">' + esc(d.id) + '</span>'
      + '<span class="cp-doc-type">' + esc(d.type||'') + '</span></div>'
      + '<div class="cp-doc-subject">' + esc(d.subject||'') + '</div>'
      + '<div class="cp-doc-meta-row"><span>' + esc((d.custodian||'').replace('cust-','')) + '</span><span>' + esc((d.date||'').split('·')[0].trim()) + '</span></div>'
      + '</div>'
      + '</div>';
  }).join('');
}
```

- [ ] **Step 2: Replace `cpRenderDoc`.** Replace exactly lines 4969-4993 (the whole `function cpRenderDoc(doc) { ... }`) with:

```javascript
function cpRenderDoc(doc) {
  var inner = '';
  if (doc.tags && doc.tags.indexOf('issue4') > -1) {
    inner += '<div class="cp-hot-band">🔥 <strong>Hot Document:</strong> This document may contain competitively sensitive or smoking-gun content — code carefully.</div>';
  }
  if (doc.from) {
    inner += '<div class="cp-email-header">'
      + '<div class="cp-header-row"><span class="cp-header-label">From:</span><span class="cp-header-val">' + esc(doc.from) + '</span></div>';
    if (doc.to) inner += '<div class="cp-header-row"><span class="cp-header-label">To:</span><span class="cp-header-val">' + esc(doc.to) + '</span></div>';
    if (doc.cc) inner += '<div class="cp-header-row"><span class="cp-header-label">CC:</span><span class="cp-header-val">' + esc(doc.cc) + '</span></div>';
    inner += '<div class="cp-header-row"><span class="cp-header-label">Date:</span><span class="cp-header-val">' + esc(doc.date||'') + '</span></div>'
      + '<div class="cp-header-row"><span class="cp-header-label">Subject:</span><span class="cp-header-val" style="font-weight:700;color:#1a2b4a">' + esc(doc.subject||'') + '</span></div>'
      + '</div>';
  }
  var tagColors = {issue1:'#1f6fc4',issue2:'#b8860b',issue3:'#2e9e5b',issue4:'#d6453a'};
  var tagLabels = {issue1:'Pricing/Bidding',issue2:'Market Share',issue3:'Merger Rationale',issue4:'Hot Doc'};
  if (doc.tags && doc.tags.length) {
    inner += '<div style="margin-bottom:10px;">' + doc.tags.map(function(t) {
      return '<span class="cp-tag-chip" style="color:' + (tagColors[t]||'#5b6b85') + ';border-color:' + (tagColors[t]||'#dfe5ee') + ';background:' + (tagColors[t]||'#ccc') + '14;">' + esc(tagLabels[t]||t) + '</span>';
    }).join('') + '</div>';
  }
  inner += '<div class="cp-body-text">' + esc(doc.body||'') + '</div>';
  var body = document.getElementById('cp-doc-body');
  if (body) body.innerHTML = '<div class="cp-doc-page">' + inner + '</div>';
}
```

- [ ] **Step 3: Restyle the viewer empty-state to a white page.** `#cp-doc-body` is the scrolling gutter (styled in Task 1) and `cpRenderDoc` writes a `.cp-doc-page` into it. Update the placeholder so the empty state also shows on a white page. Locate the body element `<div id="cp-doc-body">` and its placeholder content (the `📦` "Casepoint Document Review" block) and replace that whole element with:

```html
      <div id="cp-doc-body">
        <div class="cp-doc-page" style="text-align:center;color:#8a97ab;">
          <div style="font-size:2.4rem;margin-bottom:12px;">📦</div>
          <div style="font-size:.98rem;font-weight:700;color:#13294b;margin-bottom:6px;">Casepoint Document Review</div>
          <div style="font-size:.83rem;">Select a document from the list to begin.</div>
        </div>
      </div>
```

(No CSS change needed here — Task 1 already styles `#cp-doc-body` as the gutter and `.cp-doc-page` as the white card.)

- [ ] **Step 4: Verify grid rows + white page + coding still works.** Reload, then in the console:

```javascript
document.getElementById('casepoint-shell').style.display='flex';
cpRenderList(); cpUpdateProgress();
cpOpenDoc('NS-0001');
function pick(f,v){var c=document.getElementById('cp-field-'+f);Array.from(c.querySelectorAll('.cp-option')).find(o=>(o.getAttribute('onclick')||'').indexOf("'"+v+"'")>-1).click();}
pick('responsive','responsive');pick('privilege','not-privileged');pick('action','produce');pick('conf','hc-aeo');
['issue2','issue3','issue4'].forEach(i=>{var c=document.getElementById('cp-field-issues');Array.from(c.querySelectorAll('.cp-option')).find(o=>(o.getAttribute('onclick')||'').indexOf("'"+i+"'")>-1).click();});
cpSubmitCoding();
JSON.stringify({
  rows: document.querySelectorAll('.cp-doc-item').length,
  checks: document.querySelectorAll('.cp-doc-check').length,
  docPage: !!document.querySelector('#cp-doc-body .cp-doc-page'),
  hotBand: !!document.querySelector('.cp-hot-band'),
  answered: cpAnswered['NS-0001'],
  progPct: document.getElementById('cp-prog-pct').textContent
})
```
Expected: `rows` 15, `checks` 15, `docPage` true, `hotBand` true (NS-0001 is a hot doc), `answered` `{correct:true,...,score:5,...}`, `progPct` `7%`. Dismiss the feedback overlay afterward.

- [ ] **Step 5: Commit.**

```bash
cd /Users/jeff/Documents/aa-mastery
git add index.html
git commit -m "feat(casepoint): grid-style doc rows and white document-page viewer

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 4: Recolor the project card accent teal → Casepoint blue

**Files:**
- Modify: `index.html` project card at lines ~2405-2425.

**Interfaces:**
- Consumes: nothing. Produces: visual-only recolor; stat IDs `cp-proj-coded`/`cp-proj-acc` unchanged.

- [ ] **Step 1: Recolor the card.** In the PROJECT 5 card, replace the teal accents with Casepoint blue. Make these exact replacements within the card block (lines ~2405-2425):
  - `border-color:#0fa0b0;` → `border-color:#1f6fc4;` (the card's outer `<div>` style)
  - `background:rgba(22,181,196,.16);color:#16b5c4;border:1px solid #0fa0b0;` → `background:rgba(31,111,196,.14);color:#1f6fc4;border:1px solid #1f6fc4;` (the badge)
  - `color:#16b5c4` → `color:#1f6fc4` (both the `proj-case-title` style and the "Runs on … Casepoint" `<strong>`) — there are also `id="cp-proj-coded"` and the Issue 1 tag using `#16b5c4`; replace **all** `#16b5c4` occurrences within this one card block with `#1f6fc4`, and the Issue 1 tag's `border:1px solid #0fa0b0` with `border:1px solid #1f6fc4` and its `background:rgba(22,181,196,.15)` with `background:rgba(31,111,196,.14)`.
  - The footer button: `background:linear-gradient(135deg,#0c2f2b,#16b5c4);color:#06140f;` → `background:#1f6fc4;color:#fff;`

After editing, verify no teal hex remains in the card:

Run:
```bash
cd /Users/jeff/Documents/aa-mastery
awk '/PROJECT 5: CASEPOINT/,/PROJECT 4: AI/' index.html | grep -nE "#16b5c4|#0fa0b0|#0c2f2b|22,181,196" || echo "no teal remaining in card"
```
Expected: `no teal remaining in card`.

- [ ] **Step 2: Verify the card visually.** Reload, navigate to Other Projects (or in console set the page), confirm the NorthStar/Meridian card now shows blue accents. Quick check:

```bash
curl -s http://localhost:8000/ | awk '/PROJECT 5: CASEPOINT/,/PROJECT 4: AI/' | grep -c "#1f6fc4"
```
Expected: a count `>= 4`.

- [ ] **Step 3: Commit.**

```bash
cd /Users/jeff/Documents/aa-mastery
git add index.html
git commit -m "style(casepoint): recolor project card accent to Casepoint blue

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 5: End-to-end verification, screenshot, and regression

**Files:** none (verification only).

- [ ] **Step 1: Full light-shell walkthrough + screenshot.** With the server running, drive the shell in a headless browser: open via `openCasepointCase()`, render the list, open a hot doc (`NS-0001`), and capture a screenshot (lift z-index above the login wall first, as the app gates content behind login):

```javascript
var s=document.getElementById('casepoint-shell'); s.style.display='flex'; s.style.zIndex='99999';
cpRenderList(); cpUpdateProgress(); cpOpenDoc('NS-0001');
```
Then screenshot and visually confirm: navy left rail with "Review" highlighted, white top bar with "Casepoint" wordmark + breadcrumb, light grid doc list, white centered document page with the email header, red hot-doc band, blue tag chips, and a white coding pane with a blue "Save Coding" button.

- [ ] **Step 2: Code all 15 docs against their answer keys.** In the console, loop every `CP_DOCS` entry, apply `doc.answer`, submit, and confirm all reach 5/5 and stats hit 100% (proves the markup/render changes didn't break the coding contract):

```javascript
localStorage.removeItem('aa_progress_guest'); cpCoding={}; cpAnswered={};
document.getElementById('casepoint-shell').style.display='flex'; cpRenderList();
CP_DOCS.forEach(function(doc){
  cpOpenDoc(doc.id); var a=doc.answer;
  function pick(f,v){if(!v)return;var c=document.getElementById('cp-field-'+f);var o=Array.from(c.querySelectorAll('.cp-option')).find(x=>(x.getAttribute('onclick')||'').indexOf("'"+v+"'")>-1);if(o)o.click();}
  pick('responsive',a.responsive);pick('privilege',a.privilege);pick('action',a.action);pick('conf',a.conf);
  (a.issues||[]).forEach(function(i){var c=document.getElementById('cp-field-issues');var o=Array.from(c.querySelectorAll('.cp-option')).find(x=>(x.getAttribute('onclick')||'').indexOf("'"+i+"'")>-1);if(o)o.click();});
  cpSubmitCoding(); document.querySelectorAll('.rel-feedback-overlay').forEach(o=>o.remove());
});
JSON.stringify({coded:Object.keys(cpCoding).length, allPerfect:Object.values(cpAnswered).every(a=>a.correct), pct:document.getElementById('cp-prog-pct').textContent, acc:document.getElementById('cp-accuracy-disp').textContent})
```
Expected: `{"coded":15,"allPerfect":true,"pct":"100%","acc":"100%"}`.

- [ ] **Step 3: XSS escaping spot-check.** Confirm no unescaped doc-field insertions in the updated render functions:

```bash
cd /Users/jeff/Documents/aa-mastery
grep -nE "doc\.(body|subject|from|to|cc|date|explanation|type)" index.html | grep -i "cp" | grep -v "esc(" | grep -v "escAttr(" | grep -v "textContent" | grep -v "indexOf" || echo "(clean — only object-key uses, if any)"
```
Expected: no unescaped HTML-insertion lines (object-key uses like `cpCoding[doc.id]` or bare `if (doc.from)` guards are fine).

- [ ] **Step 4: Regression — Everlaw & Relativity + persistence coexistence.** In the console:

```javascript
var d=buildProgressData();
openEverlawCase(); evRenderList(); evOpenDoc(P3_DOCS[0].id);
(function(){var a=P3_DOCS[0].answer;function p(f,v){var c=document.getElementById('ev-field-'+f);var o=Array.from(c.querySelectorAll('.ev-option')).find(x=>(x.getAttribute('onclick')||'').indexOf("'"+v+"'")>-1);if(o)o.click();}p('responsive',a.responsive);p('action',a.action);})();
evSubmitCoding(); document.querySelectorAll('.rel-feedback-overlay').forEach(o=>o.remove()); closeEverlaw();
openCase(1);
var stored=JSON.parse(localStorage.getItem('aa_progress_guest'));
JSON.stringify({buildKeys:['rel_coding','ev_coding','cade_coding','cp_coding'].map(k=>k in d), everlawWorks:Object.keys(evCoding).length>0, relCase:ACTIVE_CASE, storedCp:!!(stored&&stored.cp_coding), storedEv:!!(stored&&stored.ev_coding)})
```
Expected: `buildKeys` all `true`, `everlawWorks` true, `relCase` `1`, `storedCp` and `storedEv` both true.

- [ ] **Step 5: Stop server.**

```bash
pkill -f "http.server 8000" || true
```

- [ ] **Step 6: Final commit (only if Steps 1-4 required a fix).** If everything passed, nothing to commit. Otherwise:

```bash
cd /Users/jeff/Documents/aa-mastery
git add index.html
git commit -m "fix(casepoint): address redesign verification findings

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Self-Review Notes (for the author)

- **Spec coverage:** theme flip → Task 1 ✓; left nav rail + top bar chrome → Task 2 ✓; grid doc list → Task 3 Step 1 ✓; white document-page viewer → Task 3 Step 2-3 ✓; Casepoint-styled coding pane → Task 1 CSS (`.cp-option`/`.cp-submit-btn`/`#cp-coding-panel`) ✓; project card accent → Task 4 ✓; presentation-only / IDs preserved → Global Constraints + Task interfaces ✓; testing/regression → Task 5 ✓.
- **IDs preserved:** every JS-consumed id from the constraints list survives Tasks 2-3 (verified against the markup replacements). `cpUpdateProgress`/`cpUpdateLanding`/`cpSubmitCoding` are untouched.
- **Out of scope held:** no conditional/mutually-exclusive coding behavior added; `CP_DOCS`, scoring, persistence unchanged.
- **Interim-state caveat:** between Task 1 and Task 2 the shell layout looks off (shell is `row` but rail/workspace markup not yet added); Task 1 Step 2 verification only asserts palette + no errors, which is correct for that point.
