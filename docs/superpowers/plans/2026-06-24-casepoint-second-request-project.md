# Casepoint Second Request Project — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a new training project to AA Mastery that opens a full mock **Casepoint** review shell for a DOJ Antitrust HSR Second Request (NorthStar Logistics / Meridian Freight merger), with ~15 hand-authored documents the trainee codes.

**Architecture:** Everything lives in the single `index.html`. A new `casepoint-shell` fixed overlay (parallel to `#everlaw-shell`) holds a 3-panel review UI. A `cp-*` CSS block re-skins the Everlaw styles in teal. A `CP_DOCS` array holds the documents. A set of `cp*` JS functions mirror the existing `ev*` functions 1:1. Coding state persists through the existing `buildProgressData`/`applyProgressData` flow via a wrapper, exactly like the CADE module does.

**Tech Stack:** Static HTML/CSS/vanilla JS, no build step, no framework, no test runner. Axios via CDN (unused here). Verification is manual in a browser.

## Global Constraints

- Single file: all changes go in `/Users/jeff/Documents/aa-mastery/index.html`. **Live content runs through line 5726 (`</body>`).** The inert duplicate fragment begins mid-line at 5727 — the line reads `</html>TYPE html>`, where the live document ends at `</html>` and the leftover `TYPE html>` starts a dead second copy that runs to line 5755. **Never edit at or past the `TYPE html>` on line 5727.** (Note: CLAUDE.md's "avoid past line ~5451" is stale — the file has grown; lines 5438–5726 are live `rel-shell`/`everlaw-shell` markup. All five insert points in this plan — ~1103, ~2322, ~4668, ~5421, ~5721 — are in live content and safe.) The live `<script>` closes at line 5435; the shells region follows it; the Casepoint shell HTML goes right after the `#everlaw-shell` close (~line 5721).
- All dynamic/document-sourced content rendered into the DOM MUST go through `esc(v)` (body text) or `escAttr(v)` (attribute values). Never raw-interpolate doc fields.
- New CSS classes/IDs use the `cp-` / `#cp-*` prefix. New JS functions/vars use the `cp` prefix. Do not rename or touch any `ev*`, `rel*`, or `cade*` symbol.
- Casepoint accent color is teal `#16b5c4` (darker `#0fa0b0`); panel background `#08120f`/`#0a0f18`. Do not reuse Everlaw blue (`#7eb8f7` / `#2954a3`).
- Reuse shared helpers — do NOT duplicate them: `esc`, `escAttr`, `closeFeedbackOverlay` (line 3644), and the `.rel-feedback-overlay` / `.rel-feedback-box` feedback styles (line ~472).
- Coding model is the same 5 scored fields as Everlaw: `responsive`, `privilege`, `action` (Production), `conf` (Confidentiality), `issues[]`.

---

## File Structure

| File | Responsibility | Change |
|------|----------------|--------|
| `index.html` (CSS, ~line 1103) | `cp-*` teal shell styles | Add block |
| `index.html` (HTML, `page-other-projects`, ~line 2322) | Casepoint project card | Add block |
| `index.html` (HTML, shells region, ~line 5721) | `#casepoint-shell` 3-panel markup | Add block |
| `index.html` (JS, ~line 4668) | `CP_DOCS` data + `cp*` state & functions | Add block |
| `index.html` (JS, ~line 5421) | persistence wrapper for `cpCoding`/`cpAnswered` | Add block |

---

## Task 1: Casepoint shell — CSS, markup, and card scaffold

**Files:**
- Modify: `index.html` — CSS at ~line 1103; project card at ~line 2322; shell markup at ~line 5721.

**Interfaces:**
- Produces: DOM IDs `casepoint-shell`, `cp-toolbar`, `cp-prog-pct`, `cp-accuracy-disp`, `cp-progress-fill`, `cp-doc-list`, `cp-doc-subject-bar`, `cp-doc-nav`, `cp-prev-btn`, `cp-next-btn`, `cp-doc-counter`, `cp-doc-body`, `cp-coding-panel`, `cp-panel-doc-id`, fields `cp-field-responsive`/`-privilege`/`-issues`/`-action`/`-conf`, `cp-submit-btn`; landing stat IDs `cp-proj-coded`, `cp-proj-acc`. Onclick handlers `openCasepointCase()`, `closeCasepoint()`, `cpFilter(...)`, `cpNav(...)`, `cpSelect(...)`, `cpToggleIssue(...)`, `cpSubmitCoding()` are referenced here and defined in Task 2/3.

- [ ] **Step 1: Add the `cp-*` CSS block.** Insert immediately AFTER line 1102 (the `#ev-progress-fill{...}` rule) and BEFORE the `/* ══ BATCH SYSTEM ══ */` comment at line 1105:

```css
/* ══ CASEPOINT SHELL ══ */
#casepoint-shell{
  display:none;position:fixed;inset:0;z-index:200;
  background:var(--dark);flex-direction:column;
}
#casepoint-shell.open{display:flex;}
#cp-toolbar{
  background:linear-gradient(135deg,#06140f,#08231d);
  border-bottom:2px solid #0fa0b0;padding:0 16px;
  display:flex;align-items:center;height:46px;gap:10px;flex-shrink:0;
}
.cp-toolbar-logo{font-size:.85rem;font-weight:800;color:#16b5c4;letter-spacing:.5px;}
.cp-case-label{color:var(--muted);font-size:.78rem;font-style:italic;flex:1;}
.cp-toolbar-btn{background:rgba(22,181,196,.16);border:1px solid #0fa0b0;color:#16b5c4;
  padding:4px 12px;border-radius:5px;font-size:.74rem;font-weight:600;cursor:pointer;}
.cp-toolbar-btn:hover{background:rgba(22,181,196,.32);}
#cp-main{display:flex;flex:1;min-height:0;}
#cp-left{width:200px;flex-shrink:0;background:#080c12;border-right:1px solid var(--border);
  display:flex;flex-direction:column;overflow:hidden;}
#cp-doc-list{flex:1;overflow-y:auto;}
.cp-doc-item{padding:8px 10px;border-bottom:1px solid var(--border);cursor:pointer;
  transition:background .15s;}
.cp-doc-item:hover{background:#0e1420;}
.cp-doc-item.active{background:#08231d;border-left:3px solid #16b5c4;}
.cp-doc-id{font-size:.67rem;color:#16b5c4;font-weight:700;font-family:monospace;}
.cp-doc-subject{font-size:.74rem;color:var(--text2);margin-top:2px;overflow:hidden;
  text-overflow:ellipsis;white-space:nowrap;}
.cp-doc-meta-row{font-size:.67rem;color:var(--muted);margin-top:2px;display:flex;gap:6px;}
.cp-status-dot{width:6px;height:6px;border-radius:50%;flex-shrink:0;margin-top:2px;}
.cp-status-dot.uncoded{background:var(--muted);}
.cp-status-dot.coded-correct{background:#4caf50;}
.cp-status-dot.coded-partial{background:#f9a825;}
.cp-status-dot.coded-wrong{background:var(--red);}
#cp-viewer{flex:1;display:flex;flex-direction:column;overflow:hidden;}
#cp-doc-header{padding:10px 14px;background:#0e1420;border-bottom:1px solid var(--border);
  flex-shrink:0;}
#cp-doc-subject-bar{font-size:.88rem;font-weight:700;color:var(--text);margin-bottom:4px;}
#cp-doc-nav{display:flex;gap:6px;align-items:center;}
.cp-nav-btn{background:#111827;border:1px solid var(--border);color:var(--muted);
  padding:3px 10px;border-radius:5px;cursor:pointer;font-size:.75rem;}
.cp-nav-btn:hover{border-color:#0fa0b0;color:#16b5c4;}
.cp-nav-btn:disabled{opacity:.3;cursor:default;}
#cp-doc-counter{font-size:.74rem;color:var(--muted);}
#cp-doc-body{flex:1;overflow-y:auto;padding:16px;}
.cp-email-header{background:#08201b;border:1px solid #0f5a4e;border-radius:8px;
  padding:12px;margin-bottom:12px;}
.cp-header-row{display:flex;gap:8px;margin-bottom:4px;font-size:.8rem;}
.cp-header-label{color:#16b5c4;font-weight:700;min-width:60px;flex-shrink:0;}
.cp-header-val{color:var(--text2);}
.cp-hot-band{background:linear-gradient(90deg,#2a0a0a,#300a0a);
  border:1px solid #e53935;border-radius:6px;padding:7px 12px;margin-bottom:10px;
  font-size:.73rem;color:#ff9a9a;display:flex;align-items:center;gap:8px;}
.cp-body-text{font-size:.83rem;color:var(--text2);line-height:1.75;white-space:pre-wrap;
  word-break:break-word;}
.cp-tag-chip{display:inline-block;padding:1px 7px;border-radius:10px;font-size:.67rem;
  font-weight:700;margin:2px;border:1px solid;}
#cp-coding-panel{width:230px;flex-shrink:0;background:#0a0f18;border-left:1px solid var(--border);
  display:flex;flex-direction:column;overflow-y:auto;}
#cp-panel-header{padding:8px 12px;background:#080c12;border-bottom:1px solid var(--border);
  flex-shrink:0;}
.cp-panel-title{font-size:.74rem;font-weight:700;color:#16b5c4;text-transform:uppercase;
  letter-spacing:.5px;}
.cp-field-label{font-size:.67rem;font-weight:700;color:var(--muted);text-transform:uppercase;
  letter-spacing:.4px;margin-bottom:4px;padding:0 10px;margin-top:10px;}
.cp-option{display:flex;align-items:center;gap:7px;padding:5px 10px;border-radius:6px;
  border:1px solid var(--border);background:#111827;cursor:pointer;
  transition:all .15s;font-size:.75rem;color:var(--text2);margin:0 8px 3px;}
.cp-option:hover{border-color:#0fa0b0;background:#08231d;color:#16b5c4;}
.cp-option.selected{border-color:#0fa0b0;background:rgba(22,181,196,.18);color:#16b5c4;}
.cp-option input{width:13px;height:13px;flex-shrink:0;}
.cp-submit-section{padding:10px;margin-top:auto;border-top:1px solid var(--border);flex-shrink:0;}
.cp-submit-btn{width:100%;background:linear-gradient(135deg,#0c6b66,#16b5c4);
  color:#e8fbff;border:none;border-radius:7px;padding:9px;font-weight:700;
  font-size:.82rem;cursor:pointer;margin-bottom:5px;}
.cp-submit-btn:hover{filter:brightness(1.15);}
.cp-submit-btn:disabled{opacity:.4;cursor:default;filter:none;}
.cp-skip-btn{width:100%;background:transparent;border:1px solid var(--border);
  color:var(--muted);border-radius:7px;padding:6px;font-size:.76rem;cursor:pointer;}
#cp-progress-bar{height:3px;background:var(--border);flex-shrink:0;}
#cp-progress-fill{height:100%;background:linear-gradient(90deg,#0c6b66,#16b5c4);
  transition:width .3s;}
```

- [ ] **Step 2: Add the Casepoint project card.** In `page-other-projects`, find the comment `<!-- PROJECT 4: AI -->` (~line 2322) and insert this block IMMEDIATELY BEFORE that comment line:

```html
  <!-- PROJECT 5: CASEPOINT — ANTITRUST SECOND REQUEST -->
  <div class="card proj-case-card" onclick="openCasepointCase()" style="border-color:#0fa0b0;margin-bottom:14px;">
    <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px;flex-wrap:wrap;">
      <div>
        <div style="display:inline-flex;align-items:center;gap:6px;padding:3px 12px;border-radius:14px;font-size:.71rem;font-weight:700;margin-bottom:8px;background:rgba(22,181,196,.16);color:#16b5c4;border:1px solid #0fa0b0;">🏛️ Antitrust · DOJ Second Request · Casepoint Platform</div>
        <div class="proj-case-title" style="color:#16b5c4">📦 NorthStar / Meridian — Merger Review</div>
        <div class="proj-case-sub">NorthStar Logistics' Acquisition of Meridian Freight · DOJ Antitrust Division · HSR Second Request · Responsiveness, Privilege & Confidentiality Coding</div>
        <div class="proj-issues-bar" style="margin-top:8px;">
          <span class="proj-issue-tag" style="background:rgba(22,181,196,.15);color:#16b5c4;border:1px solid #0fa0b0;">Issue 1: Pricing/Bidding</span>
          <span class="proj-issue-tag" style="background:rgba(212,168,42,.15);color:var(--gold-light);border:1px solid var(--gold-deep);">Issue 2: Market Share</span>
          <span class="proj-issue-tag" style="background:rgba(0,105,92,.15);color:#4caf50;border:1px solid #00695c;">Issue 3: Merger Rationale</span>
          <span class="proj-issue-tag" style="background:rgba(229,57,53,.15);color:#ff5252;border:1px solid #e53935;">Issue 4: Hot Doc</span>
        </div>
        <div style="margin-top:10px;font-size:.78rem;color:var(--muted);">🖥️ Runs on <strong style="color:#16b5c4">Casepoint</strong> · 500 documents · DOJ Antitrust Division</div>
      </div>
      <div style="text-align:center;flex-shrink:0;">
        <div style="font-size:1.5rem;font-weight:800;color:#16b5c4" id="cp-proj-coded">0</div>
        <div style="font-size:.7rem;color:var(--muted)">coded</div>
        <div style="font-size:.78rem;color:var(--muted);margin-top:4px" id="cp-proj-acc">— accuracy</div>
      </div>
    </div>
    <div style="margin-top:12px;background:linear-gradient(135deg,#0c2f2b,#16b5c4);color:#06140f;border:none;border-radius:7px;padding:10px;font-weight:700;font-size:.84rem;text-align:center;">Open in Casepoint →</div>
  </div>
```

- [ ] **Step 3: Add the `#casepoint-shell` markup.** Find the closing `</div>` of `#everlaw-shell` at line 5721 (the line immediately before the three blank lines and `<div id="save-progress-toast"...`). Insert this block immediately AFTER that `</div>` (i.e., after line 5721, before the blank lines preceding the toast div):

```html

<!-- ══════ CASEPOINT SHELL ══════ -->
<div id="casepoint-shell">
  <div id="cp-toolbar">
    <span class="cp-toolbar-logo">Casepoint</span>
    <div style="width:1px;height:20px;background:var(--border);margin:0 4px;"></div>
    <span class="cp-case-label">NorthStar Logistics / Meridian Freight — DOJ Antitrust Second Request</span>
    <div style="display:flex;gap:6px;margin-left:auto;align-items:center;">
      <span style="font-size:.72rem;color:var(--muted)" id="cp-prog-pct">0%</span>
      <span style="font-size:.72rem;color:var(--muted)">coded</span>
      <span style="font-size:.72rem;color:#16b5c4" id="cp-accuracy-disp">—</span>
      <span style="font-size:.72rem;color:var(--muted)">accuracy</span>
      <button class="cp-toolbar-btn" onclick="closeCasepoint()">← Back to Projects</button>
    </div>
  </div>
  <div id="cp-progress-bar"><div id="cp-progress-fill" style="width:0%"></div></div>
  <div id="cp-main">
    <!-- Left doc list -->
    <div id="cp-left">
      <div style="padding:8px 10px;background:#080c12;border-bottom:1px solid var(--border);display:flex;gap:6px;flex-wrap:wrap;">
        <button class="cp-toolbar-btn" style="padding:3px 8px;font-size:.68rem;" onclick="cpFilter('all',this)">All</button>
        <button class="cp-toolbar-btn" style="padding:3px 8px;font-size:.68rem;" onclick="cpFilter('uncoded',this)">Uncoded</button>
        <button class="cp-toolbar-btn" style="padding:3px 8px;font-size:.68rem;" onclick="cpFilter('coded',this)">Coded</button>
      </div>
      <div id="cp-doc-list" style="flex:1;overflow-y:auto;"></div>
    </div>
    <!-- Center viewer -->
    <div id="cp-viewer">
      <div id="cp-doc-header">
        <div id="cp-doc-subject-bar" style="color:var(--muted);font-size:.84rem">Select a document to begin</div>
        <div id="cp-doc-nav">
          <button class="cp-nav-btn" id="cp-prev-btn" onclick="cpNav(-1)" disabled>←</button>
          <button class="cp-nav-btn" id="cp-next-btn" onclick="cpNav(1)" disabled>→</button>
          <span id="cp-doc-counter" style="font-size:.73rem;color:var(--muted)"></span>
        </div>
      </div>
      <div id="cp-doc-body">
        <div style="text-align:center;padding:60px 20px;color:var(--muted);">
          <div style="font-size:2.5rem;margin-bottom:12px;">📦</div>
          <div style="font-size:.95rem;font-weight:600;color:#16b5c4;margin-bottom:6px;">Casepoint Document Review</div>
          <div style="font-size:.82rem;">Select a document from the list to begin.</div>
        </div>
      </div>
    </div>
    <!-- Right coding panel -->
    <div id="cp-coding-panel">
      <div id="cp-panel-header">
        <div class="cp-panel-title">Second Request Coding</div>
        <div style="font-size:.68rem;color:var(--muted);margin-top:2px;" id="cp-panel-doc-id">No document loaded</div>
      </div>
      <div class="cp-field-label">RESPONSIVENESS</div>
      <div id="cp-field-responsive">
        <div class="cp-option" onclick="cpSelect('responsive','responsive',this)"><input type="radio" name="cp-responsive"><span>Responsive</span></div>
        <div class="cp-option" onclick="cpSelect('responsive','non-responsive',this)"><input type="radio" name="cp-responsive"><span>Not Responsive</span></div>
        <div class="cp-option" onclick="cpSelect('responsive','technical',this)"><input type="radio" name="cp-responsive"><span>Technical Issue</span></div>
      </div>
      <div class="cp-field-label">PRIVILEGE</div>
      <div id="cp-field-privilege">
        <div class="cp-option" onclick="cpSelect('privilege','not-privileged',this)"><input type="radio" name="cp-privilege"><span>Not Privileged</span></div>
        <div class="cp-option" onclick="cpSelect('privilege','privileged',this)"><input type="radio" name="cp-privilege"><span>Privileged</span></div>
        <div class="cp-option" onclick="cpSelect('privilege','redact-priv',this)"><input type="radio" name="cp-privilege"><span>Redact (Privilege)</span></div>
      </div>
      <div class="cp-field-label">ISSUE TAGS</div>
      <div id="cp-field-issues">
        <div class="cp-option" onclick="cpToggleIssue('issue1',this)"><input type="checkbox"><span style="font-size:.71rem;">Pricing/Bidding</span></div>
        <div class="cp-option" onclick="cpToggleIssue('issue2',this)"><input type="checkbox"><span style="font-size:.71rem;">Market Share</span></div>
        <div class="cp-option" onclick="cpToggleIssue('issue3',this)"><input type="checkbox"><span style="font-size:.71rem;">Merger Rationale</span></div>
        <div class="cp-option" onclick="cpToggleIssue('issue4',this)"><input type="checkbox"><span style="font-size:.71rem;">Hot Doc</span></div>
      </div>
      <div class="cp-field-label">PRODUCTION</div>
      <div id="cp-field-action">
        <div class="cp-option" onclick="cpSelect('action','produce',this)"><input type="radio" name="cp-action"><span>Produce</span></div>
        <div class="cp-option" onclick="cpSelect('action','withhold',this)"><input type="radio" name="cp-action"><span>Withhold</span></div>
        <div class="cp-option" onclick="cpSelect('action','redact',this)"><input type="radio" name="cp-action"><span>Redact</span></div>
      </div>
      <div class="cp-field-label">CONFIDENTIALITY</div>
      <div id="cp-field-conf">
        <div class="cp-option" onclick="cpSelect('conf','confidential',this)"><input type="radio" name="cp-conf"><span>Confidential</span></div>
        <div class="cp-option" onclick="cpSelect('conf','hc-aeo',this)"><input type="radio" name="cp-conf"><span>Highly Conf. – AEO</span></div>
      </div>
      <div class="cp-submit-section">
        <button class="cp-submit-btn" id="cp-submit-btn" onclick="cpSubmitCoding()" disabled>Save Coding →</button>
        <button class="cp-skip-btn" onclick="cpNav(1)">Skip →</button>
      </div>
    </div>
  </div>
</div>
```

- [ ] **Step 4: Verify the markup loads (no JS yet).** Serve and inspect:

Run:
```bash
cd /Users/jeff/Documents/aa-mastery && python -m http.server 8000 >/tmp/cp_http.log 2>&1 &
sleep 1 && curl -s http://localhost:8000/ | grep -c 'id="casepoint-shell"'
curl -s http://localhost:8000/ | grep -c 'openCasepointCase()'
```
Expected: each `grep -c` prints `1` (shell present) and `1` (card present). Then in a browser at `http://localhost:8000`, open DevTools console and run `document.getElementById('casepoint-shell').style.display='flex'` — the empty teal-toolbar shell with three panels and a "📦 Casepoint Document Review" placeholder should render. Run `document.getElementById('casepoint-shell').style.display='none'` to hide it again.

- [ ] **Step 5: Commit.**

```bash
cd /Users/jeff/Documents/aa-mastery
git add index.html
git commit -m "feat(casepoint): add Casepoint shell styles, markup, and project card

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 2: Casepoint data + navigation engine

**Files:**
- Modify: `index.html` — insert a new JS block at ~line 4668 (immediately AFTER the line `function openAICase() { openCase(4); }` and the blank lines after it, and BEFORE the `// ══ FEATURE 1: BATCH SYSTEM ══` comment at line 4670).

**Interfaces:**
- Consumes: `esc` (DOM escaping), the DOM IDs from Task 1.
- Produces (used by Task 3 & 4): globals `CP_DOCS` (array), `cpCoding` (object), `cpAnswered` (object), `cpCodingState` (object), `cpCurrentDoc`, `cpCurrentIdx`, `cpFilterMode`; functions `openCasepointCase()`, `closeCasepoint()`, `cpGetVisible()`, `cpFilter(mode,btn)`, `cpRenderList()`, `cpOpenDoc(id)`, `cpRenderDoc(doc)`, `cpNav(dir)`. Document shape: `{id, type, custodian, date, from, to, cc, subject, body, tags:[...], answer:{responsive,privilege,action,conf,issues:[...]}, explanation}`.

- [ ] **Step 1: Insert the data + state + navigation block.** Insert AFTER `function openAICase() { openCase(4); }` (line 4667) and BEFORE the `// ════...` `FEATURE 1: BATCH SYSTEM` comment (line 4670):

```javascript
// ══════════════════════════════════════════════════════════════════
// CASEPOINT — DOJ ANTITRUST SECOND REQUEST (NorthStar / Meridian)
// ══════════════════════════════════════════════════════════════════
var cpCoding = {};
var cpAnswered = {};
var cpCodingState = {};
var cpCurrentDoc = null;
var cpCurrentIdx = -1;
var cpFilterMode = 'all';

var CP_DOCS = [
  { id:"NS-0001", type:"email", custodian:"cust-ceo", tags:["issue2","issue3","issue4"],
    from:"Daniel Reyes (CEO) <d.reyes@northstarlog.com>", to:"Karen Whitfield (CFO) <k.whitfield@northstarlog.com>", cc:"Alan Pierce (Strategy) <a.pierce@northstarlog.com>",
    date:"March 3, 2024 · 9:12 AM", subject:"Why this deal matters",
    body:"Karen,\n\nLet's be blunt internally even if we never say it externally. Meridian is the only carrier that has been undercutting us in the Midwest lanes. Once they are part of NorthStar, that pressure disappears. Our modeling says we can move rates up 12-15% across the I-70 corridor within two quarters of close without losing meaningful volume — there is simply nowhere else for those shippers to go.\n\nThis is the whole rationale. Keep it in this thread.\n\nDan",
    answer:{ responsive:"responsive", privilege:"not-privileged", action:"produce", conf:"hc-aeo", issues:["issue2","issue3","issue4"] },
    explanation:"Classic hot document. The CEO ties the merger rationale directly to eliminating the only price competitor and raising rates — responsive, highly relevant to market share (Issue 2), merger rationale (Issue 3), and a hot doc (Issue 4). No legal advice, so not privileged; produce as Highly Confidential – AEO because it reveals competitive pricing strategy." },

  { id:"NS-0002", type:"email", custodian:"cust-gc", tags:["issue3"],
    from:"Susan Choi <s.choi@harlancrowe.com>", to:"Monica Feld (GC) <m.feld@northstarlog.com>", cc:"Daniel Reyes (CEO) <d.reyes@northstarlog.com>",
    date:"March 5, 2024 · 4:40 PM", subject:"PRIVILEGED & CONFIDENTIAL — Antitrust risk assessment",
    body:"Monica,\n\nAt your request, this memo sets out our legal assessment of antitrust exposure for the Meridian acquisition. Our analysis of the post-merger HHI in the relevant LTL markets, and our advice on litigation risk should DOJ challenge the transaction, are set out below. This communication is provided for the purpose of legal advice and is protected by the attorney-client privilege.\n\n[Legal analysis follows...]\n\nSusan Choi\nHarlan & Crowe LLP",
    answer:{ responsive:"responsive", privilege:"privileged", action:"withhold", conf:"hc-aeo", issues:["issue3"] },
    explanation:"Legal advice from outside antitrust counsel (Harlan & Crowe) to the GC, for the purpose of legal advice — attorney-client privileged. Responsive to merger rationale (Issue 3) but withheld for privilege. The CEO cc does not break privilege here because he is the client." },

  { id:"NS-0003", type:"email", custodian:"cust-cfo", tags:[],
    from:"Karen Whitfield (CFO) <k.whitfield@northstarlog.com>", to:"Daniel Reyes (CEO) <d.reyes@northstarlog.com>", cc:"",
    date:"March 6, 2024 · 7:30 PM", subject:"Saturday golf?",
    body:"Dan — the club has a 9:10 tee time open Saturday. Bring your better driver this time. Dinner with the families after? Karen",
    answer:{ responsive:"non-responsive", privilege:"not-privileged", action:"withhold", conf:"confidential", issues:[] },
    explanation:"Purely personal social arrangement with no connection to the transaction or any Second Request specification. Not responsive; withhold (do not produce). No privilege and no issue tags apply." },

  { id:"NS-0004", type:"email", custodian:"cust-strat", tags:["issue3"],
    from:"Alan Pierce (Strategy) <a.pierce@northstarlog.com>", to:"Daniel Reyes (CEO) <d.reyes@northstarlog.com>", cc:"Monica Feld (GC) <m.feld@northstarlog.com>",
    date:"March 8, 2024 · 11:05 AM", subject:"Meridian — deal terms + one legal note",
    body:"Dan,\n\nDeal structure for the board: $1.4B enterprise value, 60/40 cash-stock, targeting Q4 close. Synergy target $180M run-rate, mostly terminal consolidation.\n\nMonica adds (for our legal benefit): per counsel's advice, we should not circulate the integration pricing plan to operations until after the waiting period expires, to limit antitrust gun-jumping exposure.\n\nAlan",
    answer:{ responsive:"responsive", privilege:"redact-priv", action:"redact", conf:"confidential", issues:["issue3"] },
    explanation:"Mixed document: the deal terms are ordinary responsive business content (Issue 3, merger rationale), but the paragraph relaying the GC's legal advice on gun-jumping is privileged. Redact the privileged paragraph and produce the rest — code Privilege as 'Redact (Privilege)' and Production as 'Redact'." },

  { id:"NS-0005", type:"email", custodian:"cust-vps", tags:["issue1","issue4"],
    from:"Tom Bachová (VP Sales) <t.bachova@northstarlog.com>", to:"Regional Sales Leads <sales-leads@northstarlog.com>", cc:"",
    date:"February 19, 2024 · 3:21 PM", subject:"Re: ChainPoint RFP — don't get cute",
    body:"Team,\n\nOn the ChainPoint RFP — do NOT undercut Meridian's number. We are about to own them anyway, and a price war now just trains the customer to expect discounts we'll want to claw back post-close. Hold at list. If they push, tell them capacity is tight.\n\nTom",
    answer:{ responsive:"responsive", privilege:"not-privileged", action:"produce", conf:"hc-aeo", issues:["issue1","issue4"] },
    explanation:"Direct evidence of pricing/bidding strategy coordinated around the pending merger — responsive, Issue 1 (Pricing/Bidding) and Issue 4 (Hot Doc). Not privileged. Produce as Highly Confidential – AEO due to competitively sensitive bidding content." },

  { id:"NS-0006", type:"memo", custodian:"cust-strat", tags:["issue2"],
    from:"Alan Pierce (Strategy) <a.pierce@northstarlog.com>", to:"Strategy Distribution <strategy@northstarlog.com>", cc:"",
    date:"January 30, 2024 · 10:00 AM", subject:"Combined market share — Midwest LTL (analysis summary)",
    body:"Summary of attached model:\n\n- NorthStar regional LTL share: 28%\n- Meridian regional LTL share: 19%\n- Combined: 47% in the 5-state Midwest region\n- Next largest competitor (FreightCore): 16%\n\nIn three metro lanes the combined share exceeds 60%. Recommend legal review the concentration figures before any external use.",
    answer:{ responsive:"responsive", privilege:"not-privileged", action:"produce", conf:"hc-aeo", issues:["issue2"] },
    explanation:"Internal market-share analysis going to the heart of the competitive-effects inquiry — responsive, Issue 2 (Market Share). The 'recommend legal review' line is a routine business suggestion, not legal advice, so the document is not privileged. Produce as Highly Confidential – AEO." },

  { id:"NS-0007", type:"memo", custodian:"cust-ceo", tags:["issue3"],
    from:"Daniel Reyes (CEO) <d.reyes@northstarlog.com>", to:"Board of Directors <board@northstarlog.com>", cc:"",
    date:"February 2, 2024 · 8:00 AM", subject:"Board memo — strategic rationale for Meridian acquisition",
    body:"Directors,\n\nThe strategic case for acquiring Meridian rests on three pillars: (1) terminal network overlap that yields $180M in synergies, (2) removal of the most aggressive discounter in our core region, and (3) a stronger negotiating position with national shippers. Management recommends approval to proceed to definitive agreement.",
    answer:{ responsive:"responsive", privilege:"not-privileged", action:"produce", conf:"hc-aeo", issues:["issue3"] },
    explanation:"Board-level statement of deal rationale — squarely responsive and Issue 3 (Merger Rationale). 'Removal of the most aggressive discounter' is competitively significant. Not privileged; produce as Highly Confidential – AEO." },

  { id:"NS-0008", type:"file", custodian:"cust-cfo", tags:[],
    from:"", to:"", cc:"",
    date:"March 11, 2024", subject:"meridian_synergy_model_v7.xlsm (unreadable)",
    body:"[This file could not be rendered for review. The spreadsheet appears to be password-protected / corrupted and no text could be extracted. Flag to the technical/processing team for re-collection.]",
    answer:{ responsive:"technical", privilege:"not-privileged", action:"withhold", conf:"confidential", issues:[] },
    explanation:"The document cannot be reviewed because it failed processing. Code Responsiveness as 'Technical Issue' and route for re-collection rather than guessing. Withhold pending a readable version; do not assign substantive issue tags to an unreadable file." },

  { id:"NS-0009", type:"email", custodian:"cust-gc", tags:[],
    from:"Monica Feld (GC) <m.feld@northstarlog.com>", to:"Alan Pierce (Strategy) <a.pierce@northstarlog.com>", cc:"",
    date:"March 12, 2024 · 1:15 PM", subject:"Logistics for the DOJ document collection kickoff",
    body:"Alan — can you book the large conference room for Thursday 2pm and make sure IT has the custodian list ready? Also please order lunch for ~15. Thanks, Monica",
    answer:{ responsive:"responsive", privilege:"not-privileged", action:"produce", conf:"confidential", issues:[] },
    explanation:"Although it is from the GC, this is pure business/logistics (booking a room, ordering lunch) and contains no legal advice — so it is NOT privileged. It references the DOJ collection, making it responsive. Produce as Confidential. Teaches that counsel involvement alone does not create privilege." },

  { id:"NS-0010", type:"memo", custodian:"cust-gc", tags:["issue3"],
    from:"Monica Feld (GC) <m.feld@northstarlog.com>", to:"File — Litigation Prep", cc:"",
    date:"March 14, 2024 · 5:50 PM", subject:"WORK PRODUCT — DOJ Second Request response strategy",
    body:"Prepared in anticipation of a DOJ Second Request and potential merger challenge litigation. This memo reflects counsel's mental impressions and strategy regarding likely document custodians, anticipated agency theories of harm, and our defense approach. Attorney work product — do not distribute.",
    answer:{ responsive:"responsive", privilege:"privileged", action:"withhold", conf:"hc-aeo", issues:["issue3"] },
    explanation:"Attorney work product prepared in anticipation of litigation, reflecting counsel's mental impressions — privileged and withheld. Responsive and touches merger rationale/defense (Issue 3). Withhold and log on the privilege log." },

  { id:"NS-0011", type:"email", custodian:"cust-vps", tags:[],
    from:"Operations Desk <ops@northstarlog.com>", to:"Tom Bachová (VP Sales) <t.bachova@northstarlog.com>", cc:"",
    date:"March 1, 2024 · 6:00 AM", subject:"Weekly volume report — wk 09",
    body:"Weekly lane volumes attached. Notable: Meridian appears to have pulled capacity from the KC-STL lane; our tonnage there is up 4% week-over-week. No service issues to report.",
    answer:{ responsive:"responsive", privilege:"not-privileged", action:"produce", conf:"confidential", issues:[] },
    explanation:"Ordinary-course operational report that mentions the merger target's competitive behavior — responsive and producible, but routine. No hot-doc or strategy content, so no issue tags beyond responsiveness. Produce as Confidential." },

  { id:"NS-0012", type:"file", custodian:"cust-vps", tags:["issue1"],
    from:"", to:"", cc:"",
    date:"February 12, 2024", subject:"GlobalMart national rate card 2024 (confidential)",
    body:"Customer-specific negotiated rate card for GlobalMart, NorthStar's largest national account. Contains per-lane pricing, fuel surcharge formulas, and volume rebate tiers.",
    answer:{ responsive:"responsive", privilege:"not-privileged", action:"produce", conf:"hc-aeo", issues:["issue1"] },
    explanation:"Customer-specific competitive pricing — responsive and Issue 1 (Pricing/Bidding). Not privileged, but extremely competitively sensitive, so produce as Highly Confidential – AEO under the protective order." },

  { id:"NS-0013", type:"email", custodian:"cust-cfo", tags:[],
    from:"HR Shared Services <hr@northstarlog.com>", to:"Karen Whitfield (CFO) <k.whitfield@northstarlog.com>", cc:"",
    date:"March 9, 2024 · 9:45 AM", subject:"Retention bonus list — integration team",
    body:"Karen — proposed retention bonuses for the 11 integration-team employees, with names, home addresses, SSNs, and salary. Please approve. (Full PII included per Finance request.)",
    answer:{ responsive:"responsive", privilege:"not-privileged", action:"redact", conf:"confidential", issues:[] },
    explanation:"Responsive (integration planning), not privileged, but contains employee PII (SSNs, home addresses). Redact the PII before producing — code Production as 'Redact'. Confidential designation." },

  { id:"NS-0014", type:"email", custodian:"cust-cfo", tags:[],
    from:"RealCo Property <leasing@realco.com>", to:"Karen Whitfield (CFO) <k.whitfield@northstarlog.com>", cc:"",
    date:"January 8, 2024 · 2:00 PM", subject:"Office sublease — NorthStar Realty Holdings",
    body:"Karen — attached is the proposed sublease for the downtown office floor held by NorthStar Realty Holdings, your commercial real-estate subsidiary. This is unrelated to freight operations. Let us know on the renewal terms.",
    answer:{ responsive:"non-responsive", privilege:"not-privileged", action:"withhold", conf:"confidential", issues:[] },
    explanation:"Concerns a commercial real-estate subsidiary unrelated to the freight business under review — outside the scope of the Second Request specifications. Not responsive; withhold. No privilege or issue tags." },

  { id:"NS-0015", type:"email", custodian:"cust-ceo", tags:["issue1","issue4"],
    from:"Daniel Reyes (CEO) <d.reyes@northstarlog.com>", to:"Tom Bachová (VP Sales) <t.bachova@northstarlog.com>", cc:"",
    date:"March 4, 2024 · 8:55 PM", subject:"Re: post-close pricing plan",
    body:"Tom — good work on the rate plan, but let's NOT put the post-close increase schedule in writing or in any deck until the deal actually clears. If it's in an email it ends up in a government request someday. Talk it through with me by phone. — Dan",
    answer:{ responsive:"responsive", privilege:"not-privileged", action:"produce", conf:"hc-aeo", issues:["issue1","issue4"] },
    explanation:"Smoking-gun hot document: the CEO tries to keep the post-merger price-increase plan out of writing to evade government discovery. Highly responsive — Issue 1 (Pricing/Bidding) and Issue 4 (Hot Doc). Not privileged (no lawyer, no legal advice). Produce as Highly Confidential – AEO." }
];

function openCasepointCase() {
  var shell = document.getElementById('casepoint-shell');
  shell.style.display = 'flex';
  shell.style.position = 'fixed';
  shell.style.inset = '0';
  shell.style.zIndex = '500';
  setTimeout(function() {
    cpRenderList();
  }, 50);
}

function closeCasepoint() {
  saveProgress();
  var shell = document.getElementById('casepoint-shell');
  shell.style.display = 'none';
  nav('other-projects');
}

function cpGetVisible() {
  return CP_DOCS.filter(function(d) {
    if (cpFilterMode === 'uncoded') return !cpCoding[d.id];
    if (cpFilterMode === 'coded') return !!cpCoding[d.id];
    return true;
  });
}

function cpFilter(mode, btn) {
  cpFilterMode = mode;
  cpRenderList();
}

function cpRenderList() {
  var visible = cpGetVisible();
  var list = document.getElementById('cp-doc-list');
  if (!list) return;
  list.innerHTML = visible.map(function(d) {
    var ans = cpAnswered[d.id];
    var dotClass = ans ? (ans.correct ? 'coded-correct' : ans.partial ? 'coded-partial' : 'coded-wrong') : 'uncoded';
    var isActive = cpCurrentDoc && cpCurrentDoc.id === d.id ? ' active' : '';
    return '<div class="cp-doc-item' + isActive + '" onclick="cpOpenDoc(this.dataset.id)" data-id="' + escAttr(d.id) + '">'
      + '<div style="display:flex;align-items:center;gap:5px;">'
      + '<div class="cp-status-dot ' + dotClass + '"></div>'
      + '<span class="cp-doc-id">' + esc(d.id) + '</span>'
      + '<span style="font-size:.67rem;color:var(--muted);margin-left:auto;">' + esc(d.type||'') + '</span>'
      + '</div>'
      + '<div class="cp-doc-subject">' + esc(d.subject||'') + '</div>'
      + '<div class="cp-doc-meta-row"><span>' + esc((d.custodian||'').replace('cust-','')) + '</span><span>' + esc((d.date||'').split('·')[0].trim()) + '</span></div>'
      + '</div>';
  }).join('');
}

function cpOpenDoc(id) {
  var doc = CP_DOCS.find(function(d) { return d.id === id; });
  if (!doc) return;
  cpCurrentDoc = doc;
  var visible = cpGetVisible();
  cpCurrentIdx = visible.findIndex(function(d) { return d.id === id; });
  cpRenderDoc(doc);
  cpLoadCoding(doc);
  var subj = document.getElementById('cp-doc-subject-bar');
  if (subj) subj.textContent = doc.subject || '';
  var pid = document.getElementById('cp-panel-doc-id');
  if (pid) pid.textContent = doc.id + ' · ' + (doc.type||'');
  var ctr = document.getElementById('cp-doc-counter');
  if (ctr) ctr.textContent = (cpCurrentIdx+1) + ' of ' + visible.length;
  var prev = document.getElementById('cp-prev-btn');
  var next = document.getElementById('cp-next-btn');
  if (prev) prev.disabled = cpCurrentIdx <= 0;
  if (next) next.disabled = cpCurrentIdx >= visible.length - 1;
  document.querySelectorAll('.cp-doc-item').forEach(function(el) { el.classList.remove('active'); });
  var active = document.querySelector('.cp-doc-item[data-id="' + id + '"]');
  if (active) { active.classList.add('active'); active.scrollIntoView({block:'nearest'}); }
}

function cpRenderDoc(doc) {
  var html = '';
  if (doc.tags && doc.tags.indexOf('issue4') > -1) {
    html += '<div class="cp-hot-band">🔥 <strong>Hot Document:</strong> This document may contain competitively sensitive or smoking-gun content — code carefully.</div>';
  }
  if (doc.from) {
    html += '<div class="cp-email-header">'
      + '<div class="cp-header-row"><span class="cp-header-label">From:</span><span class="cp-header-val">' + esc(doc.from) + '</span></div>';
    if (doc.to) html += '<div class="cp-header-row"><span class="cp-header-label">To:</span><span class="cp-header-val">' + esc(doc.to) + '</span></div>';
    if (doc.cc) html += '<div class="cp-header-row"><span class="cp-header-label">CC:</span><span class="cp-header-val">' + esc(doc.cc) + '</span></div>';
    html += '<div class="cp-header-row"><span class="cp-header-label">Date:</span><span class="cp-header-val">' + esc(doc.date||'') + '</span></div>'
      + '<div class="cp-header-row"><span class="cp-header-label">Subject:</span><span class="cp-header-val" style="font-weight:700;color:var(--text)">' + esc(doc.subject||'') + '</span></div>'
      + '</div>';
  }
  var tagColors = {issue1:'#16b5c4',issue2:'#d4a82a',issue3:'#4caf50',issue4:'#e53935'};
  var tagLabels = {issue1:'Pricing/Bidding',issue2:'Market Share',issue3:'Merger Rationale',issue4:'Hot Doc'};
  if (doc.tags && doc.tags.length) {
    html += '<div style="margin-bottom:8px;">' + doc.tags.map(function(t) {
      return '<span class="cp-tag-chip" style="color:' + (tagColors[t]||'var(--muted)') + ';border-color:' + (tagColors[t]||'var(--border)') + ';background:' + (tagColors[t]||'#111') + '18;">' + esc(tagLabels[t]||t) + '</span>';
    }).join('') + '</div>';
  }
  html += '<div class="cp-body-text">' + esc(doc.body||'') + '</div>';
  var body = document.getElementById('cp-doc-body');
  if (body) body.innerHTML = html;
}

function cpNav(dir) {
  var visible = cpGetVisible();
  var currentId = cpCurrentDoc ? cpCurrentDoc.id : null;
  var freshIdx = currentId ? visible.findIndex(function(d){ return d.id === currentId; }) : -1;
  if (freshIdx === -1) freshIdx = Math.min(Math.max(cpCurrentIdx, 0), visible.length - 1);
  var newIdx = freshIdx + dir;
  if (newIdx < 0 || newIdx >= visible.length) return;
  cpCurrentIdx = newIdx;
  cpOpenDoc(visible[newIdx].id);
}
```

- [ ] **Step 2: Verify data + navigation in the browser.** Reload `http://localhost:8000`, go to **Other Projects**, click the **NorthStar / Meridian** card. In the console verify and exercise:

Run (in DevTools console):
```javascript
CP_DOCS.length                       // expect 15
document.querySelectorAll('.cp-doc-item').length  // expect 15
cpOpenDoc('NS-0001')                 // viewer renders headers + body + tag chips
cpFilter('uncoded')                  // list still shows 15 (none coded yet)
```
Expected: 15 doc rows; clicking a row (or `cpOpenDoc`) renders the email header, tag chips, and body; the prev/next buttons and "1 of 15" counter update; "Back to Projects" returns to Other Projects. The coding panel is visible but its buttons do nothing yet (Task 3).

- [ ] **Step 3: Commit.**

```bash
cd /Users/jeff/Documents/aa-mastery
git add index.html
git commit -m "feat(casepoint): add CP_DOCS dataset and review navigation engine

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 3: Coding logic, scoring, feedback, and live stats

**Files:**
- Modify: `index.html` — append to the Casepoint JS block created in Task 2 (immediately after the `cpNav` function, still before the `FEATURE 1: BATCH SYSTEM` comment). Also a one-line edit to `openCasepointCase` (added in Task 2).

**Interfaces:**
- Consumes: `cpCodingState`, `cpCoding`, `cpAnswered`, `cpCurrentDoc`, `cpGetVisible`, `cpRenderList`, `cpNav` (Task 2); `closeFeedbackOverlay` (line 3644); `.rel-feedback-overlay`/`.rel-feedback-box` styles.
- Produces: `cpLabel(val)`, `cpLoadCoding(doc)`, `cpSelect(field,val,el)`, `cpToggleIssue(issue,el)`, `cpCheckSubmit()`, `cpSubmitCoding()`, `cpShowFeedback(doc,errors,score,total,pct)`, `cpUpdateProgress()`, `cpUpdateLanding()`.

- [ ] **Step 1: Append the coding/scoring/feedback functions.** Insert immediately after the `cpNav` function from Task 2:

```javascript
function cpLabel(val) {
  if (!val && val !== 0) return "—";
  if (Array.isArray(val)) return val.length ? val.map(cpLabel).join(", ") : "none";
  var labels = {
    "responsive":"Responsive","non-responsive":"Not Responsive","technical":"Technical Issue",
    "not-privileged":"Not Privileged","privileged":"Privileged","redact-priv":"Redact (Privilege)",
    "produce":"Produce","withhold":"Withhold","redact":"Redact",
    "confidential":"Confidential","hc-aeo":"Highly Confidential – AEO",
    "issue1":"Pricing/Bidding","issue2":"Market Share","issue3":"Merger Rationale","issue4":"Hot Doc"
  };
  return labels[val] || val;
}

function cpLoadCoding(doc) {
  document.querySelectorAll('#cp-coding-panel .cp-option').forEach(function(o) {
    o.classList.remove('selected');
    var inp = o.querySelector('input');
    if (inp) inp.checked = false;
  });
  cpCodingState = {responsive:null,privilege:null,issues:[],action:null,conf:null};
  var saved = cpCoding[doc.id];
  if (saved) {
    cpCodingState = JSON.parse(JSON.stringify(saved));
    ['responsive','privilege','action','conf'].forEach(function(field) {
      if (saved[field]) {
        var container = document.getElementById('cp-field-' + field);
        if (!container) return;
        container.querySelectorAll('.cp-option').forEach(function(opt) {
          var oc = opt.getAttribute('onclick') || '';
          if (oc.indexOf("'" + saved[field] + "'") > -1) {
            opt.classList.add('selected');
            var inp = opt.querySelector('input[type=radio]');
            if (inp) inp.checked = true;
          }
        });
      }
    });
    (saved.issues || []).forEach(function(iss) {
      var container = document.getElementById('cp-field-issues');
      if (!container) return;
      container.querySelectorAll('.cp-option').forEach(function(opt) {
        var oc = opt.getAttribute('onclick') || '';
        if (oc.indexOf("'" + iss + "'") > -1) {
          opt.classList.add('selected');
          var cb = opt.querySelector('input[type=checkbox]');
          if (cb) cb.checked = true;
        }
      });
    });
  }
  cpCheckSubmit();
}

function cpSelect(field, val, el) {
  var container = document.getElementById('cp-field-' + field);
  if (!container) return;
  container.querySelectorAll('.cp-option').forEach(function(o) {
    o.classList.remove('selected');
    var r = o.querySelector('input[type=radio]');
    if (r) r.checked = false;
  });
  el.classList.add('selected');
  var radio = el.querySelector('input[type=radio]');
  if (radio) radio.checked = true;
  cpCodingState[field] = val;
  if (cpCodingState.responsive && cpCodingState.action) {
    if (!cpCodingState.privilege) cpCodingState.privilege = 'not-privileged';
    if (!cpCodingState.conf) cpCodingState.conf = 'confidential';
  }
  cpCheckSubmit();
}

function cpToggleIssue(issue, el) {
  el.classList.toggle('selected');
  var cb = el.querySelector('input[type=checkbox]');
  if (cb) cb.checked = el.classList.contains('selected');
  if (!cpCodingState.issues) cpCodingState.issues = [];
  if (el.classList.contains('selected')) {
    if (cpCodingState.issues.indexOf(issue) === -1) cpCodingState.issues.push(issue);
  } else {
    cpCodingState.issues = cpCodingState.issues.filter(function(i) { return i !== issue; });
  }
}

function cpCheckSubmit() {
  var ready = !!(cpCodingState.responsive && cpCodingState.action);
  var btn = document.getElementById('cp-submit-btn');
  if (btn) btn.disabled = !ready;
}

function cpSubmitCoding() {
  if (!cpCurrentDoc) return;
  var doc = cpCurrentDoc;
  var coding = JSON.parse(JSON.stringify(cpCodingState));
  if (!coding.privilege) coding.privilege = 'not-privileged';
  if (!coding.conf) coding.conf = 'confidential';
  cpCoding[doc.id] = coding;
  var answer = doc.answer || {};
  var errors = [];
  var score = 0;
  var total = 5;
  if (coding.responsive === answer.responsive) score++; else errors.push({field:'Responsiveness',yours:coding.responsive,correct:answer.responsive});
  if (coding.privilege === answer.privilege) score++; else errors.push({field:'Privilege',yours:coding.privilege,correct:answer.privilege});
  if (coding.action === answer.action) score++; else errors.push({field:'Production',yours:coding.action,correct:answer.action});
  if (coding.conf === answer.conf) score++; else errors.push({field:'Confidentiality',yours:coding.conf,correct:answer.conf});
  var correctIssues = answer.issues || [];
  var userIssues = coding.issues || [];
  var issuesOk = correctIssues.every(function(i){return userIssues.indexOf(i)>-1;}) && userIssues.every(function(i){return correctIssues.indexOf(i)>-1;});
  if (issuesOk) score++; else errors.push({field:'Issue Tags',yours:userIssues.join(',')||'none',correct:correctIssues.join(',')||'none'});
  var pct = Math.round(score/total*100);
  cpAnswered[doc.id] = {correct:score===total,partial:score>0&&score<total,score:score,total:total};
  cpShowFeedback(doc, errors, score, total, pct);
  cpRenderList();
  cpUpdateProgress();
  cpUpdateLanding();
  saveProgress();
}

function cpShowFeedback(doc, errors, score, total, pct) {
  var overlay = document.createElement('div');
  overlay.className = 'rel-feedback-overlay';
  var isCorrect = score === total;
  var isPartial = score > 0 && !isCorrect;
  var boxClass = isCorrect ? 'rel-feedback-correct' : isPartial ? 'rel-feedback-partial' : 'rel-feedback-wrong';
  var errHtml = '';
  if (errors.length) {
    errHtml = '<div style="margin-top:10px;display:flex;flex-direction:column;gap:4px;">';
    errors.forEach(function(e) {
      errHtml += '<div style="background:#0d1117;border-radius:5px;padding:6px 9px;font-size:.76rem;">'
        + '<span style="color:var(--muted);font-weight:600">' + esc(e.field) + ':</span> '
        + '<span style="color:#ff5252">You: ' + esc(cpLabel(e.yours)) + '</span> → '
        + '<span style="color:#4caf50">Correct: ' + esc(cpLabel(e.correct)) + '</span></div>';
    });
    errHtml += '</div>';
  }
  overlay.innerHTML = '<div class="rel-feedback-box ' + boxClass + '">'
    + '<div style="font-size:1.8rem;text-align:center;margin-bottom:5px">' + (isCorrect?'✅':isPartial?'⚠️':'❌') + '</div>'
    + '<div style="font-size:1rem;font-weight:800;text-align:center;color:var(--gold-light);margin-bottom:3px">' + (isCorrect?'Perfect Coding!':isPartial?'Partially Correct':'Incorrect Coding') + '</div>'
    + '<div style="text-align:center;font-size:.83rem;color:var(--muted);margin-bottom:10px">' + score + '/' + total + ' (' + pct + '%)</div>'
    + '<div style="background:#0e1420;border-radius:7px;padding:10px;font-size:.8rem;color:var(--text2);line-height:1.6;border-left:3px solid #16b5c4">💡 ' + esc(doc.explanation||'') + '</div>'
    + errHtml
    + '<div style="display:flex;gap:8px;margin-top:14px;">'
    + "<button onclick='closeFeedbackOverlay(this);cpNav(1);' style='flex:1;padding:9px;background:linear-gradient(135deg,#0c6b66,#16b5c4);color:#06140f;border:none;border-radius:7px;font-weight:700;cursor:pointer;font-size:.83rem'>Next Document →</button>"
    + "<button onclick='closeFeedbackOverlay(this);' style='padding:9px 13px;background:transparent;color:var(--muted);border:1px solid var(--border);border-radius:7px;cursor:pointer;font-size:.78rem'>Review</button>"
    + '</div></div>';
  document.body.appendChild(overlay);
}

function cpUpdateProgress() {
  var total = CP_DOCS.length;
  var coded = Object.keys(cpCoding).length;
  var pct = Math.round(coded/total*100);
  var pp = document.getElementById('cp-prog-pct');
  var pf = document.getElementById('cp-progress-fill');
  var ad = document.getElementById('cp-accuracy-disp');
  if (pp) pp.textContent = pct + '%';
  if (pf) pf.style.width = pct + '%';
  var correct = Object.values(cpAnswered).filter(function(a){return a.correct;}).length;
  var attempted = Object.keys(cpAnswered).length;
  if (ad) ad.textContent = attempted ? Math.round(correct/attempted*100) + '%' : '—';
}

function cpUpdateLanding() {
  var coded = Object.keys(cpCoding).length;
  var correct = Object.values(cpAnswered).filter(function(a){return a.correct;}).length;
  var attempted = Object.keys(cpAnswered).length;
  var p = document.getElementById('cp-proj-coded');
  var a = document.getElementById('cp-proj-acc');
  if (p) p.textContent = coded;
  if (a) a.textContent = attempted ? Math.round(correct/attempted*100) + '%' : '—';
}
```

- [ ] **Step 2: Wire `cpUpdateProgress` into shell open.** In `openCasepointCase` (added in Task 2), update the `setTimeout` body so progress renders on open. Replace:

```javascript
  setTimeout(function() {
    cpRenderList();
  }, 50);
```

with:

```javascript
  setTimeout(function() {
    cpRenderList();
    cpUpdateProgress();
  }, 50);
```

- [ ] **Step 3: Verify coding + feedback + stats.** Reload, open the Casepoint case, open `NS-0001`. In the panel select Responsiveness=Responsive, Privilege=Not Privileged, Issue tags = Market Share + Merger Rationale + Hot Doc, Production=Produce, Confidentiality=Highly Conf. – AEO → click **Save Coding**.

Expected: a ✅ "Perfect Coding! 5/5 (100%)" overlay with the explanation appears; "Next Document →" advances; the toolbar `cp-prog-pct` and `cp-accuracy-disp` update; the doc's list dot turns green. Then deliberately mis-code another doc and confirm a ⚠️/❌ overlay lists each wrong field as "You: X → Correct: Y" using the antitrust labels (e.g. "Highly Confidential – AEO"). Console check:
```javascript
cpAnswered['NS-0001']   // {correct:true, partial:false, score:5, total:5}
```

- [ ] **Step 4: Commit.**

```bash
cd /Users/jeff/Documents/aa-mastery
git add index.html
git commit -m "feat(casepoint): add coding panel logic, scoring, feedback, and live stats

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 4: Progress persistence

**Files:**
- Modify: `index.html` — add a wrapper block immediately AFTER the CADE `applyProgressData` override that ends at line 5421 (after the closing `};` on line 5421, before the `// Everlaw filter buttons...` comment on line 5423).

**Interfaces:**
- Consumes: `buildProgressData`, `applyProgressData` (already reassigned by the CADE override), and `cpCoding`/`cpAnswered` (Task 2).
- Produces: persisted keys `cp_coding`, `cp_answered` in the saved progress object; restores them on load.

- [ ] **Step 1: Add the persistence wrapper.** Insert after line 5421 (`};` closing the CADE `applyProgressData` override):

```javascript
// Include Casepoint state in saveProgress / loadProgress
var _origBuildProgressData_cp = buildProgressData;
buildProgressData = function() {
  var d = _origBuildProgressData_cp();
  d.cp_coding = cpCoding;
  d.cp_answered = cpAnswered;
  return d;
};

var _origApplyProgressData_cp = applyProgressData;
applyProgressData = function(d) {
  _origApplyProgressData_cp(d);
  if (d && d.cp_coding) cpCoding = d.cp_coding;
  if (d && d.cp_answered) cpAnswered = d.cp_answered;
};
```

- [ ] **Step 2: Verify persistence across reload.** Reload, open the Casepoint case, code `NS-0001` correctly and `NS-0005` (any way). Confirm `cp-proj-coded` on the Other Projects card shows `2`. Then:

Run (in DevTools console):
```javascript
JSON.parse(localStorage.getItem('aa_progress_' + (SB.user ? SB.user.id : 'guest'))).cp_coding
```
Expected: an object containing keys `NS-0001` and `NS-0005`. Now **reload the page** (F5), go to Other Projects — the card should still read `coded: 2` with an accuracy %. Open the Casepoint case and `NS-0001`: the previously selected radio/checkbox options are pre-filled (restored by `cpLoadCoding`), and the list dots reflect prior correctness.

- [ ] **Step 3: Commit.**

```bash
cd /Users/jeff/Documents/aa-mastery
git add index.html
git commit -m "feat(casepoint): persist coding state via buildProgressData wrapper

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 5: End-to-end verification & regression check

**Files:** none (verification only).

- [ ] **Step 1: Full Casepoint walkthrough.** With the server running, from a fresh reload:
  - Other Projects → the teal **NorthStar / Meridian** card shows, with "500 documents" and live `coded`/accuracy stats.
  - Open it → shell renders; All/Uncoded/Coded filters work; prev/next + counter work.
  - Code all 15 docs using each doc's `answer` (cross-check against the `explanation`). Confirm: every doc reaching 5/5 shows ✅; `NS-0008` accepts Responsiveness="Technical Issue"; `NS-0004` accepts Privilege="Redact (Privilege)" + Production="Redact"; hot docs (`NS-0001/0005/0015`) show the 🔥 hot-doc band.
  - After all 15, toolbar reads `100% coded`; the Coded filter lists 15, Uncoded lists 0.

- [ ] **Step 2: XSS-escaping spot check.** Confirm all document fields render through `esc()` — grep shows no raw interpolation of doc fields in the `cp*` functions:

Run:
```bash
cd /Users/jeff/Documents/aa-mastery
grep -nE "doc\.(body|subject|from|to|cc|date|explanation|id|type)" index.html | grep -i "cp" | grep -v "esc(" | grep -v "escAttr(" | grep -v "textContent" | grep -v "indexOf"
```
Expected: no output, OR only bare guard expressions like `if (doc.from)` / `if (doc.to)` (truthiness checks, not DOM insertions). Any line that actually concatenates a doc field into `innerHTML`/an HTML string MUST contain `esc(`/`escAttr(`; if such a line appears unwrapped, that is a bug to fix.

- [ ] **Step 3: Regression — Everlaw & Relativity still work.** Open the **VeridianBank (Everlaw)** project, code one document, confirm feedback + progress still work. Open a **Relativity** case (Joba v. Bukando) from Projects, open one doc, confirm it renders. Reload and confirm Everlaw progress persisted (the CADE/Everlaw `ev_coding` keys must coexist with the new `cp_coding` keys).

Run (in DevTools console after coding in both Casepoint and Everlaw):
```javascript
var p = JSON.parse(localStorage.getItem('aa_progress_' + (SB.user ? SB.user.id : 'guest')));
[!!p.cp_coding, !!p.ev_coding, !!p.cade_coding]   // expect [true, true, ...] both present
```
Expected: both `cp_coding` and `ev_coding` present in the same saved object — no key clobbered.

- [ ] **Step 4: Stop the server.**

```bash
pkill -f "http.server 8000" || true
```

- [ ] **Step 5: Final commit (if any verification fixes were needed).** If Steps 1-3 surfaced no issues, there is nothing to commit. If a fix was required, commit it:

```bash
cd /Users/jeff/Documents/aa-mastery
git add index.html
git commit -m "fix(casepoint): address verification findings

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Self-Review Notes (for the author)

- **Spec coverage:** Full review shell (Task 1+2+3) ✓; antitrust Second Request scenario + NorthStar/Meridian (Task 2 data) ✓; teal branding (Task 1 CSS) ✓; 5 coding fields incl. HSR confidentiality tiers (Task 1 markup + Task 3 scoring) ✓; ~15 docs (Task 2, 15 docs) ✓; "500 documents" backstory (Task 1 card) ✓; lives under Other Projects, no new nav page ✓; persistence alongside Everlaw (Task 4) ✓; shared helpers reused not duplicated (`closeFeedbackOverlay`, feedback styles) ✓.
- **Deliberate simplification vs. Everlaw:** the Casepoint shell omits the Everlaw batch selector/banner, the PII-tags toggle, and the CADE re-use layer. These were never in the spec; excluding them keeps the new code self-contained with no dependency on `batchState`, `renderBatchSelector`, or `completeBatchAndNext`. The doc list simply shows all 15 docs with All/Uncoded/Coded filters.
- **Issue-code reuse:** `issue1..issue4` codes are reused (as in Everlaw) but mapped to antitrust labels via `cpLabel` and the local `tagLabels` map in `cpRenderDoc` — they never reach the GDPR `humanLabel`, so no label collision.
- **Confidentiality default:** unset Confidentiality defaults to `confidential` (Everlaw defaults to `standard`); the Casepoint options are `confidential`/`hc-aeo`, so `confidential` is the correct neutral default.
