# Cyber Incident Response Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the Larkspur Benefit Services Cyber Incident Response matter, where reviewers extract PII/PHI into a spreadsheet drawer inside the Relativity shell and are graded against a generated answer key. First, fix the remote progress save, which has silently failed for every reviewer since 29 May 2026.

**Architecture:** The Relativity shell's hardwired `openCase` becomes a small matter registry (QuantumEdge = 4, Larkspur = 5). Accessors route batches, filters, counters and reset to whichever matter is open. Larkspur's documents live in a generated `cir-docs.js`. All grading lives in `extraction-engine.js`, a pure, unit-tested file in the same UMD style as `qc-engine.js`. The drawer, feedback and progress UI in `index.html` only render and handle input, and every DOM node they need is created from JavaScript rather than added as markup.

**Tech Stack:** Vanilla JavaScript (ES5 in the engine), Node 22 built-in test runner, Python 3 (stdlib for the document generator; ReportLab for the protocol PDF), Supabase PostgREST, Vercel static hosting.

**Spec:** `docs/superpowers/specs/2026-09-25-cyber-incident-response-design.md`

## Global Constraints

- There is no build step. Edit `index.html` directly. New JS files are plain scripts loaded by `<script>` tags.
- `extraction-engine.js` follows the UMD pattern of `qc-engine.js` and must not use `import`/`export`.
- Run tests with bare `node --test` from the repo root; `node --test tests/` fails on Node 22. Before any change the baseline is 134 passing.
- All dynamic DOM content goes through `esc()` (text) or `escAttr()` (attribute values), as the repo's `CLAUDE.md` requires.
- The repo is public, and the document set is fictional:
  - SSNs use area 900–999 with group `00`.
  - Phone numbers use `555-01xx`.
  - Email addresses use `example.com`.
  - Card numbers are published test numbers.
- Never add or delete markup blocks by hand inside the Relativity shell. This matter's DOM (drawer, kind list, progress box) is created from JavaScript. A hand-deleted `</div>` once hid every Relativity document.
- QuantumEdge (matter 4) must behave exactly as before, after every task that touches the Relativity shell.
- Fixed numbers:

  | Setting | Value |
  |---|---|
  | Matter ID | 5 |
  | Documents | 150 |
  | Batch size | 25 |
  | Pace target | 15 documents per hour |
  | Session gap | 30 minutes |

- Defect weights: `MISSED_INDIVIDUAL 5`, `MISSED_ELEMENT 3`, `EXTRA_INDIVIDUAL 2`, `EXTRA_ELEMENT 1`, `FIELD_ERROR 1`.
- Element keys, in this order everywhere: `ssn, dl, passport, fin, card, login, bio, mrn, plan, med`.
- Identity fields, in this order everywhere: `first, last, dob, street, city, state, zip`.
- Browser checks run against `/Users/jeff/Documents/aa-mastery`. Work in that checkout, on branch `feat/cyber-incident-response`, not in a separate worktree.
- Every commit message ends with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Refinements found while planning

These came from reading the code against the spec, and from checking the database. Each one is reflected in the tasks below.

1. **Task 1 is new: remote progress saving is broken.**
   - **What broke:** `buildProgressData()` gained a `saved_at` field on 29 May 2026 (commit `69ef2be`) and three CADE fields on 1 June (`79f2ebe`). `reviewer_progress` has none of those columns, so PostgREST rejects the whole insert, and `saveProgressRemote()` swallows the error.
   - **Since when:** the table's newest row is from 28 May at 22:33.
   - **How it was checked:** on 25 September, each field was inserted alone with the public key. The 14 real columns reach the security check (42501); the other four fail as unknown columns (PGRST204).
   - **The fix:** the spec's retry-without-an-unknown-column mechanism, planned for `rel_extract`, is built here for every column.
   - **Still local only:** CADE progress keeps saving only in the browser; it never had columns.
2. **Loading prefers the newer copy again.** `loadProgress()` keeps whichever copy has the later `saved_at`, but the remote row never had one. Local therefore always won, and work saved from a second computer never loaded. Task 1 maps the row's `updated_at`.
3. **Submit first, then feedback.**
   - **Buttons:** the approved mockup shows feedback right after Submit. The header button reads **Submit**, and **Next document →** lives on the feedback screen, replacing the spec's single "Submit & Next".
   - **Next batch:** once the whole batch is submitted, that button becomes **Batch N →**. The shell's own unlock banner sits inside the coding panel, which this matter hides.
4. **The engine hands the UI finished display lines** alongside the defects, so the UI decides nothing. It also explains itself in two cases:
   - a wrongly ticked box, through an optional per-person `whyNot` (for example, a masked SSN);
   - a second row for the same person.
5. **Protocol section 7 is "Pace and grading".** It adds the defect table, so reviewers know how they are scored.
6. **The shared Relativity counters count only the open matter.** `updateRelProgress`, `showRelResults` and the batch helpers used to count every key in `relCoding` and `relAnswered`.
7. **Reset works on the open matter only, and now saves.** `relResetAll` wiped all of `relCoding`, so inside Larkspur it would have erased QuantumEdge work. It also never saved, so a reload brought the reset work back.
8. **Saved progress no longer restores `ACTIVE_CASE`.** Nothing reads the restored value, and after Larkspur it would put the shell in Larkspur's mode while QuantumEdge's documents are loaded.
9. **Documents use the shell's own field names**, `type` and `subject`, rather than the spec's `kind` and `title`. That way the list, search and viewer work unchanged.
10. **The drawer splits the screen instead of overlaying it.** It is full width, as in the approved layout C, but the document list stays usable above it.
11. **The Larkspur card carries no capability label.** `REVIEW_CARD_QCKEY` would label it "First-pass review", which it is not.
12. **Two small shape changes.**
    - Extraction progress is `relExtract = { entries: { docId: entry }, batch }`, because Larkspur's batch unlocks must persist alongside the spec's per-document entries.
    - The matter registry declares each matter's mode, documents, labels and batch size. Larkspur's saved searches (its document kinds) sit in `CIR_SEARCHES`, which is used whenever the open matter is an extraction matter.

## File Structure

| File | Status | Responsibility |
|---|---|---|
| `index.html` | Modify | Task 1: remote save and load. Task 5: matter registry and accessors. Tasks 6–9: Larkspur card, viewer, sidebar, drawer, feedback, progress, persistence |
| `extraction-engine.js` | Create | Pure grading: normalizers, entry validation, matching, grading with display lines, summary, sessions |
| `tests/extraction-engine.test.js` | Create | Unit tests for the engine |
| `tools/build_cir_docs.py` | Create | Seeded generator for `cir-docs.js`; refuses to write a set that fails its checks |
| `cir-docs.js` | Create (generated) | The 150 documents and answer keys, one per line; `var CIR_DOCS` plus a CommonJS export |
| `tests/cir-docs.test.js` | Create | Tests the data and engine together: every answer key grades itself perfect, and the invariants hold |
| `supabase/migrations/20260925_rel_extract.sql` | Create | One column: `rel_extract jsonb` |
| `tools/protocols_content.py` | Modify | The seventh matter's protocol content |
| `tools/build_protocols.py` | Modify | An extraction layout, and a way to build one PDF |
| `protocols/Larkspur-Cyber-Incident-Response-Protocol.pdf` | Create (generated) | The protocol |
| `vercel.json` | Modify | Exclude `extraction-engine.js` and `cir-docs.js` from the SPA catch-all |
| `CLAUDE.md` | Modify | Document the fifth matter |

## How to verify in the browser

Several tasks end with browser checks.

1. **Start the server.** Call the Browser tool `preview_start` with `{name: "aa-mastery"}`. It serves `/Users/jeff/Documents/aa-mastery` and returns a port and a `tabId`.
2. **Load a fresh copy.** `navigate` to `http://localhost:<port>/index.html?v=<anything new>`; a fresh query string forces a reload.
3. **Run the snippet** with `javascript_tool` on that tab. Snippets use top-level `await`, which the tool supports. The page shows a login wall, so every snippet that opens a shell first hides it.

---

### Task 1: Stop dropping every remote progress save

**Files:**
- Modify: `index.html`: `saveProgressRemote()` (near line 7883) and `loadProgressRemote()` (near line 7914)

**Interfaces:**
- Consumes: `buildProgressData()` (wrapped twice near line 8412, adding CADE and Casepoint fields), `SB`, `axios`, `loadProgress()`
- Produces:
  - `PROGRESS_COLUMNS` (array of column names)
  - `progressColumnsMissing` (object)
  - `progressRemotePayload(data)`, returning only known, non-missing columns
  - `loadProgressRemote()`'s result gains `saved_at`

  Task 9 appends `'rel_extract'` to `PROGRESS_COLUMNS`.

- [ ] **Step 1: Reproduce the failure against the real database**

The public key cannot write, because of row-level security, so this changes nothing. It shows that an unknown column fails before the security check is even reached.

```bash
cd ~/Documents/aa-mastery
URL=$(grep -oE "SUPABASE_URL *= *['\"][^'\"]+" index.html | head -1 | sed -E "s/.*['\"]//")
KEY=$(grep -oE "SUPABASE_ANON_KEY *= *['\"][^'\"]+" index.html | head -1 | sed -E "s/.*['\"]//")
for c in saved_at cade_coding rel_coding; do
  printf '%s -> ' "$c"
  curl -s -X POST "$URL/rest/v1/reviewer_progress" -H "apikey: $KEY" -H "Authorization: Bearer $KEY" \
    -H "Content-Type: application/json" -H "Prefer: return=minimal" \
    -d "{\"user_id\":\"00000000-0000-0000-0000-000000000000\",\"$c\":null}"; echo
done
```

Expected:
- `saved_at` and `cade_coding` fail with `"code":"PGRST204"` ("Could not find the '…' column").
- `rel_coding` fails with `"code":"42501"`: the column exists, and the anonymous write is refused.

- [ ] **Step 2: Replace `saveProgressRemote` in full**

Replace the whole function `async function saveProgressRemote() { ... }` with:

```js
// The columns reviewer_progress actually has. Anything else in the payload makes
// PostgREST reject the whole insert, which is how saved_at (29 May 2026) and the
// CADE fields (1 June) silently stopped every remote save. Task-specific columns
// are appended as their migrations land.
var PROGRESS_COLUMNS = ['user_id', 'rel_coding', 'rel_answered', 'ev_coding', 'ev_answered',
  'cp_coding', 'cp_answered', 'cp_redactions', 'active_case', 'active_batch_rel',
  'active_batch_ev', 'current_doc_rel', 'current_doc_ev', 'updated_at'];

// Columns the database has told us it lacks, this session. A column is only
// dropped after the database names it, so a new column starts saving the moment
// its migration runs.
var progressColumnsMissing = {};

function progressRemotePayload(data) {
  var out = {};
  PROGRESS_COLUMNS.forEach(function (c) {
    if (progressColumnsMissing[c]) return;
    if (data[c] !== undefined) out[c] = data[c];
  });
  return out;
}

// Save to Supabase (background, non-blocking)
async function saveProgressRemote() {
  if (!SB.user) return;
  var data = buildProgressData();
  data.user_id = SB.user.id;
  ['rel_coding', 'rel_answered', 'ev_coding', 'ev_answered',
   'cp_coding', 'cp_answered', 'cp_redactions'].forEach(function (k) {
    data[k] = JSON.stringify(data[k]);
  });
  data.updated_at = new Date().toISOString();
  for (var attempt = 0; attempt < 2; attempt++) {
    try {
      await SB.ensureFresh();
      await axios({
        method: 'POST',
        url: SB.url + '/rest/v1/reviewer_progress',
        headers: {
          'Content-Type': 'application/json',
          'apikey': SB.key,
          'Authorization': 'Bearer ' + (SB.token || SB.key),
          'Prefer': 'resolution=merge-duplicates'
        },
        data: progressRemotePayload(data)
      });
      return;
    } catch (e) {
      var msg = (e.response && e.response.data && e.response.data.message) || '';
      var m = msg.match(/Could not find the '([^']+)' column/);
      if (m && PROGRESS_COLUMNS.indexOf(m[1]) !== -1 && !progressColumnsMissing[m[1]]) {
        progressColumnsMissing[m[1]] = true;   // retry once without it
        continue;
      }
      return;   // offline, signed out, or table missing: local storage is the backup
    }
  }
}
```

- [ ] **Step 3: Give the remote copy its timestamp**

In `loadProgressRemote()`, change the end of the returned object from:

```js
      current_doc_rel:  d.current_doc_rel,
      current_doc_ev:   d.current_doc_ev
    };
```

to:

```js
      current_doc_rel:  d.current_doc_rel,
      current_doc_ev:   d.current_doc_ev,
      // loadProgress() keeps whichever copy is newer. The row's timestamp is
      // updated_at; without it the remote copy always looked older than any
      // local one, so work saved from a second computer never loaded.
      saved_at:         d.updated_at
    };
```

- [ ] **Step 4: Parse check and tests**

```bash
cd ~/Documents/aa-mastery
node --test 2>&1 | grep -E "^# (tests|pass|fail)"
python3 - <<'PY'
import re, io, subprocess, tempfile
h = io.open('index.html', encoding='utf-8').read()
js = '\n;\n'.join(re.findall(r'<script(?![^>]*\bsrc=)[^>]*>(.*?)</script>', h, re.S))
with tempfile.NamedTemporaryFile('w', suffix='.js', delete=False) as f:
    f.write(js)
r = subprocess.run(['node', '--check', f.name], capture_output=True, text=True)
print('PARSE', 'OK' if r.returncode == 0 else 'FAIL\n' + r.stderr[:800])
PY
```

Expected: `# tests 134`, `# pass 134`, `# fail 0`, `PARSE OK`.

- [ ] **Step 5: Verify the payload and the retry in the browser**

```js
document.getElementById('login-wall').style.display = 'none';
const real = window.axios; const posts = [];
window.axios = function (cfg) {
  if (String(cfg.url).includes('reviewer_progress')) { posts.push(Object.keys(cfg.data).sort()); return Promise.resolve({ data: [] }); }
  return real.apply(this, arguments);
};
SB.user = { id: '00000000-0000-0000-0000-000000000000' }; SB.token = 'x';
await saveProgressRemote();
let calls = 0; const seen = [];
window.axios = function (cfg) {
  if (!String(cfg.url).includes('reviewer_progress')) return real.apply(this, arguments);
  calls++; seen.push(Object.keys(cfg.data));
  if (calls === 1) { const e = new Error('x'); e.response = { status: 400, data: { code: 'PGRST204', message: "Could not find the 'active_batch_ev' column of 'reviewer_progress' in the schema cache" } }; return Promise.reject(e); }
  return Promise.resolve({ data: [] });
};
await saveProgressRemote();
window.axios = real; SB.user = null; SB.token = null; progressColumnsMissing = {};
JSON.stringify({ firstPayload: posts[0], unknownSent: posts[0].filter(k => /saved_at|cade_/.test(k)), retryCalls: calls, retryDroppedColumn: !seen[1].includes('active_batch_ev') })
```

Expected:
- `firstPayload` is exactly `["active_batch_ev","active_batch_rel","active_case","cp_answered","cp_coding","cp_redactions","current_doc_ev","current_doc_rel","ev_answered","ev_coding","rel_answered","rel_coding","updated_at","user_id"]`.
- `unknownSent: []`, `retryCalls: 2`, `retryDroppedColumn: true`.

- [ ] **Step 6: Verify the app's real payload now reaches the security check**

```js
const d = buildProgressData(); d.user_id = '00000000-0000-0000-0000-000000000000';
['rel_coding','rel_answered','ev_coding','ev_answered','cp_coding','cp_answered','cp_redactions'].forEach(k => d[k] = JSON.stringify(d[k]));
d.updated_at = new Date().toISOString();
const r = await fetch(SB.url + '/rest/v1/reviewer_progress', { method: 'POST',
  headers: { apikey: SB.key, Authorization: 'Bearer ' + SB.key, 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates' },
  body: JSON.stringify(progressRemotePayload(d)) });
(await r.json()).code
```

Expected: `"42501"` (row-level security refused the anonymous write), **not** `"PGRST204"`. A signed-in reviewer passes that check, so their saves now land.

- [ ] **Step 7: Verify loading keeps the newer copy**

```js
const real = window.axios;
window.axios = function (cfg) {
  if (String(cfg.url).includes('reviewer_progress') && cfg.method === 'GET') {
    return Promise.resolve({ data: [{ rel_coding: '{"REMOTE-1":{}}', rel_answered: '{}', ev_coding: '{}', ev_answered: '{}',
      cp_coding: '{}', cp_answered: '{}', cp_redactions: '{}', updated_at: '2026-09-20T00:00:00Z' }] });
  }
  return real.apply(this, arguments);
};
SB.user = { id: '00000000-0000-0000-0000-000000000000' };
localStorage.setItem(getProgressKey(), JSON.stringify({ rel_coding: { 'LOCAL-1': {} }, saved_at: '2026-09-01T00:00:00Z' }));
const got = await loadProgress();
const picked = Object.keys(got.rel_coding)[0];
localStorage.removeItem(getProgressKey()); window.axios = real; SB.user = null;
relCoding = {}; relAnswered = {}; evCoding = {}; evAnswered = {}; cpCoding = {}; cpAnswered = {}; cpRedactions = {};
picked
```

Expected: `"REMOTE-1"`. Before Step 3, this returned `"LOCAL-1"`.

- [ ] **Step 8: Commit**

```bash
git add index.html
git commit -m "Stop dropping every remote progress save

buildProgressData() gained a saved_at field on 29 May 2026 (69ef2be)
and three CADE fields on 1 June (79f2ebe). reviewer_progress has none
of those columns, PostgREST rejects the whole insert when it meets an
unknown column, and saveProgressRemote() swallowed the error. So no
reviewer's progress has reached the database since: the newest row is
from 28 May at 22:33. Progress survived only in each browser.

The remote payload is now built from the table's real columns. If the
database names a column it lacks, the save retries once without it and
stops sending it for the session, so a new column can never take the
whole save down again.

Loading also compared a saved_at the remote row never had, so the local
copy always won and work saved on a second computer never loaded. The
row's updated_at is now its timestamp.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Extraction engine: normalizers and entry validation

**Files:**
- Create: `extraction-engine.js`
- Create: `tests/extraction-engine.test.js`

**Interfaces:**
- Produces, on `EX` (`window.EX` in the browser):

  | Export | Returns |
  |---|---|
  | `ELEMENTS` | array |
  | `FIELDS` | array |
  | `normalizeName(s)` | string |
  | `normalizeDob(s)` | `''`, `'YYYY-MM-DD'` or `null` |
  | `normalizeStreet(s)` | string |
  | `normalizeCity(s)` | string |
  | `normalizeState(s)` | string |
  | `normalizeZip(s)` | string |
  | `editDistance(a,b)` | number |
  | `hasElement(el)` | bool |
  | `isBlankRow(row)` | bool |
  | `validateEntry(entry)` | `{ok:bool, problems:[{code,row?,text}], rows:[row]}` |

- Data shapes:
  - An **entry** is `{ noPii: bool, rows: [row] }`.
  - A **row** is `{ first, last, dob, street, city, state, zip, el: { ssn, dl, passport, fin, card, login, bio, mrn, plan, med } }`. Missing `el` keys read as `false`.

- [ ] **Step 1: Write the failing tests**

Create `tests/extraction-engine.test.js`:

```js
'use strict';
var test = require('node:test');
var assert = require('node:assert');
var EX = require('../extraction-engine.js');

// A row with only the named elements ticked.
function row(o) {
  var el = {};
  EX.ELEMENTS.forEach(function (k) { el[k] = false; });
  (o.el || []).forEach(function (k) { el[k] = true; });
  return { first: o.first || '', last: o.last || '', dob: o.dob || '', street: o.street || '',
           city: o.city || '', state: o.state || '', zip: o.zip || '', el: el };
}

test('ELEMENTS and FIELDS are in the agreed order', function () {
  assert.deepStrictEqual(EX.ELEMENTS, ['ssn', 'dl', 'passport', 'fin', 'card', 'login', 'bio', 'mrn', 'plan', 'med']);
  assert.deepStrictEqual(EX.FIELDS, ['first', 'last', 'dob', 'street', 'city', 'state', 'zip']);
});

test('normalizeName ignores case, punctuation and middle initials', function () {
  assert.strictEqual(EX.normalizeName('Ana M.'), 'ana');
  assert.strictEqual(EX.normalizeName('  RIVERA '), 'rivera');
  assert.strictEqual(EX.normalizeName("O'Neil"), 'oneil');
  assert.strictEqual(EX.normalizeName('Mary-Jo'), 'mary jo');
  assert.strictEqual(EX.normalizeName('J'), 'j');
});

test('normalizeDob reads month-first dates with a four-digit year', function () {
  assert.strictEqual(EX.normalizeDob('3/14/1986'), '1986-03-14');
  assert.strictEqual(EX.normalizeDob('03-14-1986'), '1986-03-14');
  assert.strictEqual(EX.normalizeDob('1986-03-14'), '1986-03-14');
  assert.strictEqual(EX.normalizeDob(''), '');
  assert.strictEqual(EX.normalizeDob('3/14/86'), null);     // two-digit year
  assert.strictEqual(EX.normalizeDob('02/30/1990'), null);  // not a real date
  assert.strictEqual(EX.normalizeDob('13/01/1990'), null);  // month 13
});

test('normalizeStreet treats common abbreviations as equal', function () {
  assert.strictEqual(EX.normalizeStreet('41 Alder Court'), EX.normalizeStreet('41 alder ct.'));
  assert.strictEqual(EX.normalizeStreet('9 N Birch Lane'), EX.normalizeStreet('9 North Birch Ln'));
  assert.strictEqual(EX.normalizeStreet('12 Oak St #4B'), EX.normalizeStreet('12 Oak Street Apt 4B'));
  assert.notStrictEqual(EX.normalizeStreet('41 Alder Ct'), EX.normalizeStreet('14 Alder Ct'));
});

test('normalizeCity, normalizeState and normalizeZip', function () {
  assert.strictEqual(EX.normalizeCity('Gig  Harbor'), 'gig harbor');
  assert.strictEqual(EX.normalizeState('Washington'), 'WA');
  assert.strictEqual(EX.normalizeState('wa'), 'WA');
  assert.strictEqual(EX.normalizeState('W.A.'), 'WA');
  assert.strictEqual(EX.normalizeState(''), '');
  assert.strictEqual(EX.normalizeZip('98402-1234'), '98402');
  assert.strictEqual(EX.normalizeZip(' 98402 '), '98402');
});

test('editDistance counts single-character edits', function () {
  assert.strictEqual(EX.editDistance('same', 'same'), 0);
  assert.strictEqual(EX.editDistance('ana rivera', 'ana rivrea'), 2);
  assert.strictEqual(EX.editDistance('kitten', 'sitting'), 3);
});

test('validateEntry: a blank starter row plus "No PII/PHI" is fine', function () {
  var v = EX.validateEntry({ noPii: true, rows: [row({})] });
  assert.strictEqual(v.ok, true);
  assert.strictEqual(v.rows.length, 0);
});

test('validateEntry: rows and "No PII/PHI" together contradict', function () {
  var v = EX.validateEntry({ noPii: true, rows: [row({ first: 'Ana', last: 'Rivera', el: ['ssn'] })] });
  assert.strictEqual(v.ok, false);
  assert.strictEqual(v.problems[0].code, 'CONTRADICTION');
});

test('validateEntry: neither rows nor "No PII/PHI" is incomplete', function () {
  var v = EX.validateEntry({ noPii: false, rows: [row({})] });
  assert.strictEqual(v.ok, false);
  assert.strictEqual(v.problems[0].code, 'INCOMPLETE');
});

test('validateEntry: each row needs both names, one element and a usable DOB', function () {
  var v = EX.validateEntry({ noPii: false, rows: [
    row({ first: 'Ana', el: ['ssn'] }),
    row({ first: 'David', last: 'Okafor' }),
    row({ first: 'Lily', last: 'Chen', dob: '7/22/12', el: ['plan'] })
  ] });
  var codes = v.problems.map(function (p) { return p.code + ':' + p.row; });
  assert.deepStrictEqual(codes, ['NAME:0', 'NO_ELEMENT:1', 'DOB:2']);
});

test('validateEntry: a complete row passes', function () {
  var v = EX.validateEntry({ noPii: false, rows: [row({ first: 'Ana', last: 'Rivera', dob: '03/14/1986', el: ['ssn'] })] });
  assert.strictEqual(v.ok, true);
  assert.strictEqual(v.rows.length, 1);
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node --test 2>&1 | grep -E "Cannot find module" | head -1`
Expected: `Cannot find module '../extraction-engine.js'`.

- [ ] **Step 3: Write `extraction-engine.js`**

```js
/*
 * Extraction engine — grading for the Cyber Incident Response matter. Pure logic
 * only: no DOM, no network, no globals beyond the single export below. Loaded as
 * a classic script in index.html (window.EX) and as a CommonJS module by the
 * Node test runner (require).
 *
 * Must not use import/export syntax: it is loaded both ways at once.
 */
(function (factory) {
  'use strict';
  var EX = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = EX;
  if (typeof window !== 'undefined') window.EX = EX;
})(function () {
  'use strict';

  var ELEMENTS = ['ssn', 'dl', 'passport', 'fin', 'card', 'login', 'bio', 'mrn', 'plan', 'med'];
  var FIELDS = ['first', 'last', 'dob', 'street', 'city', 'state', 'zip'];

  function clean(s) { return String(s === null || s === undefined ? '' : s).trim(); }

  // "Ana M." and "ana" are the same name; so are "O'Neil" and "ONeil".
  function normalizeName(s) {
    var t = clean(s).toLowerCase().replace(/['’]/g, '').replace(/[.,\-]/g, ' ');
    var parts = t.split(/\s+/).filter(Boolean);
    var long = parts.filter(function (p) { return p.length > 1; });
    return (long.length ? long : parts).join(' ');
  }

  function pad2(n) { return (n < 10 ? '0' : '') + n; }

  function validDate(y, m, d) {
    if (y < 1900 || y > 2100 || m < 1 || m > 12 || d < 1) return false;
    var dt = new Date(Date.UTC(y, m - 1, d));
    return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
  }

  // '' when blank, 'YYYY-MM-DD' when valid, null when present but unusable --
  // including any two-digit year, which entry refuses before grading can.
  function normalizeDob(s) {
    var v = clean(s), m;
    if (!v) return '';
    m = v.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
    if (m) return validDate(+m[1], +m[2], +m[3]) ? m[1] + '-' + pad2(+m[2]) + '-' + pad2(+m[3]) : null;
    m = v.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
    if (m) return validDate(+m[3], +m[1], +m[2]) ? m[3] + '-' + pad2(+m[1]) + '-' + pad2(+m[2]) : null;
    return null;
  }

  var STREET_WORDS = {
    street: 'st', avenue: 'ave', court: 'ct', lane: 'ln', road: 'rd', drive: 'dr',
    boulevard: 'blvd', apartment: 'apt', suite: 'ste', place: 'pl', terrace: 'ter',
    circle: 'cir', highway: 'hwy', parkway: 'pkwy', way: 'way',
    north: 'n', south: 's', east: 'e', west: 'w',
    northeast: 'ne', northwest: 'nw', southeast: 'se', southwest: 'sw'
  };

  function normalizeStreet(s) {
    var words = clean(s).toLowerCase().replace(/#/g, ' apt ').replace(/[.,]/g, ' ')
      .split(/\s+/).filter(Boolean)
      .map(function (w) { return STREET_WORDS[w] || w; });
    var out = [];
    words.forEach(function (w) { if (!(w === 'apt' && out[out.length - 1] === 'apt')) out.push(w); });
    return out.join(' ');
  }

  function normalizeCity(s) { return clean(s).toLowerCase().replace(/\s+/g, ' '); }

  var STATES = {
    alabama: 'AL', alaska: 'AK', arizona: 'AZ', arkansas: 'AR', california: 'CA',
    colorado: 'CO', connecticut: 'CT', delaware: 'DE', 'district of columbia': 'DC',
    florida: 'FL', georgia: 'GA', hawaii: 'HI', idaho: 'ID', illinois: 'IL',
    indiana: 'IN', iowa: 'IA', kansas: 'KS', kentucky: 'KY', louisiana: 'LA',
    maine: 'ME', maryland: 'MD', massachusetts: 'MA', michigan: 'MI', minnesota: 'MN',
    mississippi: 'MS', missouri: 'MO', montana: 'MT', nebraska: 'NE', nevada: 'NV',
    'new hampshire': 'NH', 'new jersey': 'NJ', 'new mexico': 'NM', 'new york': 'NY',
    'north carolina': 'NC', 'north dakota': 'ND', ohio: 'OH', oklahoma: 'OK',
    oregon: 'OR', pennsylvania: 'PA', 'rhode island': 'RI', 'south carolina': 'SC',
    'south dakota': 'SD', tennessee: 'TN', texas: 'TX', utah: 'UT', vermont: 'VT',
    virginia: 'VA', washington: 'WA', 'west virginia': 'WV', wisconsin: 'WI', wyoming: 'WY'
  };

  function normalizeState(s) {
    var v = clean(s).toLowerCase().replace(/\./g, '').replace(/\s+/g, ' ');
    if (!v) return '';
    return STATES[v] || v.toUpperCase();
  }

  function normalizeZip(s) { return clean(s).replace(/\D/g, '').slice(0, 5); }

  function editDistance(a, b) {
    if (a === b) return 0;
    var prev = [], cur, i, j;
    for (j = 0; j <= b.length; j++) prev[j] = j;
    for (i = 1; i <= a.length; i++) {
      cur = [i];
      for (j = 1; j <= b.length; j++) {
        cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1,
                          prev[j - 1] + (a.charAt(i - 1) === b.charAt(j - 1) ? 0 : 1));
      }
      prev = cur;
    }
    return prev[b.length];
  }

  function hasElement(el) { return ELEMENTS.some(function (k) { return !!(el && el[k]); }); }

  function isBlankRow(r) {
    return FIELDS.every(function (f) { return !clean(r && r[f]); }) && !hasElement(r && r.el);
  }

  // Problems block Submit. Wholly blank rows are ignored, so a fresh grid with
  // an empty starter row can still be submitted as "No PII/PHI".
  function validateEntry(entry) {
    var problems = [];
    var rows = ((entry && entry.rows) || []).filter(function (r) { return !isBlankRow(r); });
    var noPii = !!(entry && entry.noPii);
    if (noPii && rows.length) {
      problems.push({ code: 'CONTRADICTION', text: 'Rows are entered and "No PII/PHI" is ticked: pick one.' });
    }
    if (!noPii && !rows.length) {
      problems.push({ code: 'INCOMPLETE', text: 'Add at least one person, or tick "No PII/PHI".' });
    }
    rows.forEach(function (r, i) {
      var n = i + 1;
      if (!clean(r.first) || !clean(r.last)) {
        problems.push({ code: 'NAME', row: i, text: 'Row ' + n + ': first and last name are both required.' });
      }
      if (!hasElement(r.el)) {
        problems.push({ code: 'NO_ELEMENT', row: i, text: 'Row ' + n + ': tick at least one data element, or delete the row.' });
      }
      if (normalizeDob(r.dob) === null) {
        problems.push({ code: 'DOB', row: i, text: 'Row ' + n + ': date of birth must be a real date, month first, with a four-digit year.' });
      }
    });
    return { ok: problems.length === 0, problems: problems, rows: rows };
  }

  return {
    ELEMENTS: ELEMENTS,
    FIELDS: FIELDS,
    normalizeName: normalizeName,
    normalizeDob: normalizeDob,
    normalizeStreet: normalizeStreet,
    normalizeCity: normalizeCity,
    normalizeState: normalizeState,
    normalizeZip: normalizeZip,
    editDistance: editDistance,
    hasElement: hasElement,
    isBlankRow: isBlankRow,
    validateEntry: validateEntry
  };
});
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `node --test 2>&1 | grep -E "^# (tests|pass|fail)"`
Expected: `# tests 145`, `# pass 145`, `# fail 0` (134 existing + 11 new).

- [ ] **Step 5: Commit**

```bash
git add extraction-engine.js tests/extraction-engine.test.js
git commit -m "Add the extraction engine's normalizers and entry validation

Pure logic for the Cyber Incident Response matter, in the qc-engine UMD
pattern: names compared without case, punctuation or middle initials;
dates month-first with a four-digit year; street abbreviations, state
names and ZIP+4 normalized; and the entry rules that block Submit.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Extraction engine: matching, grading, summary, sessions

**Files:**
- Modify: `extraction-engine.js`
- Modify: `tests/extraction-engine.test.js`

**Interfaces:**
- Consumes: everything Task 2 exports.
- Produces:

  | Export | Returns |
  |---|---|
  | `DEFECT_WEIGHTS` | object |
  | `matchPeople(keyPeople, rows)` | `{pairs:[{key,row,nameTypo}], missed:[key], extra:[row]}` |
  | `gradeDocument(answer, entry)` | `{defects:[{type,weight,person,field?,expected?,got?,why?}], weight, perfect, lines}` |
  | `summarize(results)` | `{submitted, perfect, accuracy:number\|null, breakdown:{TYPE:count}}` |
  | `currentSession(marks:number[], gapMs)` | `number[]` |
  | `entryFromAnswer(answer)` | entry |
  | `resultStatus(result)` | `'none'`, `'correct'`, `'partial'` or `'wrong'` |

- Data shapes:
  - An **answer** is `{ noPii, people:[person], notPeople?:[{name, why}], why?:string }`.
  - A **person** is a row plus `why:{ person?, <element>?: string }` and an optional `whyNot:{ <element>: string }`.
- `lines` items, one of:
  - `{kind:'matched', row, key, fieldErrors:{field: expectedValue}, missedElements:[key], extraElements:[key]}`
  - `{kind:'extra', row, why}`
  - `{kind:'missed', key, why}`
- The reason given for an extra row is chosen in this order:
  1. the person already has a row;
  2. a `notPeople` entry naming them;
  3. the document's `why`;
  4. a generic sentence.

- [ ] **Step 1: Write the failing tests**

Append to `tests/extraction-engine.test.js`:

```js
// ── Task 3: matching and grading ─────────────────────────────────────────────

function person(o) {
  var p = row(o);
  p.why = o.why || {};
  if (o.whyNot) p.whyNot = o.whyNot;
  return p;
}

var ANA   = person({ first: 'Ana', last: 'Rivera', dob: '03/14/1986', street: '41 Alder Ct', city: 'Tacoma', state: 'WA', zip: '98402', el: ['ssn', 'plan', 'med'], why: { person: 'Row 1 of the census.' } });
var DAVID = person({ first: 'David', last: 'Okafor', dob: '11/02/1979', street: '9 Birch Ln', city: 'Olympia', state: 'WA', zip: '98501', el: ['ssn', 'fin'], why: { person: 'Row 2.', fin: 'The direct-deposit section on page 2.' } });
var LILY  = person({ first: 'Lily', last: 'Chen', dob: '07/22/2012', street: '41 Alder Ct', city: 'Tacoma', state: 'WA', zip: '98402', el: ['plan'], why: { person: 'Row 3; a dependent.' } });
var GRACE = person({ first: 'Grace', last: 'Holloway', dob: '05/30/1961', street: '7 Quarry Rd', city: 'Lakewood', state: 'WA', zip: '98499', el: ['ssn', 'dl', 'plan'], why: { person: 'The last row, below the page break.' } });

function typed(p) { return row({ first: p.first, last: p.last, dob: p.dob, street: p.street, city: p.city, state: p.state, zip: p.zip, el: EX.ELEMENTS.filter(function (k) { return p.el[k]; }) }); }

test('DEFECT_WEIGHTS match the spec', function () {
  assert.deepStrictEqual(EX.DEFECT_WEIGHTS, { MISSED_INDIVIDUAL: 5, MISSED_ELEMENT: 3, EXTRA_INDIVIDUAL: 2, EXTRA_ELEMENT: 1, FIELD_ERROR: 1 });
});

test('matchPeople pairs exact names, catches a typo, and reports missed and extra', function () {
  var m = EX.matchPeople([ANA, DAVID, GRACE], [typed(ANA), row({ first: 'Davd', last: 'Okafor', el: ['ssn'] }), row({ first: 'Meera', last: 'Patel', el: ['ssn'] })]);
  assert.strictEqual(m.pairs.length, 2);
  assert.strictEqual(m.pairs[0].nameTypo, false);
  assert.strictEqual(m.pairs[1].nameTypo, true);
  assert.strictEqual(m.pairs[1].key, DAVID);
  assert.deepStrictEqual(m.missed, [GRACE]);
  assert.strictEqual(m.extra[0].first, 'Meera');
});

test('matchPeople splits two people with one name by date of birth, then address', function () {
  var sr = person({ first: 'Robert', last: 'Hayes', dob: '01/05/1950', street: '1 Oak St', el: ['ssn'] });
  var jr = person({ first: 'Robert', last: 'Hayes', dob: '06/12/1980', street: '2 Elm St', el: ['ssn'] });
  var m = EX.matchPeople([sr, jr], [row({ first: 'Robert', last: 'Hayes', dob: '06/12/1980', el: ['ssn'] })]);
  assert.strictEqual(m.pairs[0].key, jr);
  m = EX.matchPeople([sr, jr], [row({ first: 'Robert', last: 'Hayes', street: '2 Elm Street', el: ['ssn'] })]);
  assert.strictEqual(m.pairs[0].key, jr);
});

test('gradeDocument: a perfect entry has no defects', function () {
  var answer = { noPii: false, people: [ANA, LILY] };
  var r = EX.gradeDocument(answer, { noPii: false, rows: [typed(ANA), typed(LILY)] });
  assert.strictEqual(r.perfect, true);
  assert.strictEqual(r.weight, 0);
  assert.strictEqual(r.lines.length, 2);
});

test('gradeDocument: normalization forgives formatting, never content', function () {
  var answer = { noPii: false, people: [ANA] };
  var t = typed(ANA); t.dob = '3/14/1986'; t.street = '41 Alder Court'; t.state = 'Washington'; t.zip = '98402-1234';
  assert.strictEqual(EX.gradeDocument(answer, { noPii: false, rows: [t] }).perfect, true);
  t.zip = '98403';
  var r = EX.gradeDocument(answer, { noPii: false, rows: [t] });
  assert.strictEqual(r.defects[0].type, 'FIELD_ERROR');
  assert.strictEqual(r.defects[0].field, 'zip');
});

test('gradeDocument: blank against blank is correct; a value against a blank is not', function () {
  var noAddr = person({ first: 'Kofi', last: 'Mensah', dob: '02/02/1990', el: ['mrn'] });
  var answer = { noPii: false, people: [noAddr] };
  assert.strictEqual(EX.gradeDocument(answer, { noPii: false, rows: [typed(noAddr)] }).perfect, true);
  var t = typed(noAddr); t.city = 'Tacoma';
  var r = EX.gradeDocument(answer, { noPii: false, rows: [t] });
  assert.deepStrictEqual(r.defects.map(function (d) { return d.type + ':' + d.field; }), ['FIELD_ERROR:city']);
});

test('gradeDocument: the approved mockup scores 4 defects, weight 11', function () {
  var answer = { noPii: false, people: [ANA, DAVID, LILY, GRACE],
                 notPeople: [{ name: 'Dr. Meera Patel', why: 'The treating provider: business contact details.' }] };
  var david = typed(DAVID); david.el.fin = false;
  var lily = typed(LILY); lily.dob = '07/22/2021';
  var meera = row({ first: 'Meera', last: 'Patel', street: '1200 Harbor Way', city: 'Tacoma', state: 'WA', zip: '98405' });
  var r = EX.gradeDocument(answer, { noPii: false, rows: [typed(ANA), david, lily, meera] });
  assert.strictEqual(r.defects.length, 4);
  assert.strictEqual(r.weight, 11);
  var byType = {};
  r.defects.forEach(function (d) { byType[d.type] = d; });
  assert.strictEqual(byType.MISSED_ELEMENT.field, 'fin');
  assert.strictEqual(byType.MISSED_ELEMENT.why, 'The direct-deposit section on page 2.');
  assert.strictEqual(byType.FIELD_ERROR.expected, '07/22/2012');
  assert.strictEqual(byType.EXTRA_INDIVIDUAL.why, 'The treating provider: business contact details.');
  assert.strictEqual(byType.MISSED_INDIVIDUAL.person, 'Grace Holloway');
  var kinds = r.lines.map(function (l) { return l.kind; });
  assert.deepStrictEqual(kinds, ['matched', 'matched', 'matched', 'extra', 'missed']);
  assert.deepStrictEqual(r.lines[1].missedElements, ['fin']);
  assert.strictEqual(r.lines[2].fieldErrors.dob, '07/22/2012');
});

test('gradeDocument: a wrongly ticked element explains itself when the key says why not', function () {
  var dd = person({ first: 'Tom', last: 'Reed', el: ['fin'], whyNot: { ssn: 'Only the last four digits are shown: a masked SSN does not count.' } });
  var t = typed(dd); t.el.ssn = true;
  var r = EX.gradeDocument({ noPii: false, people: [dd] }, { noPii: false, rows: [t] });
  assert.strictEqual(r.defects[0].type, 'EXTRA_ELEMENT');
  assert.strictEqual(r.defects[0].why, 'Only the last four digits are shown: a masked SSN does not count.');
  assert.deepStrictEqual(r.lines[0].extraElements, ['ssn']);
});

test('gradeDocument: the three "No PII/PHI" outcomes', function () {
  var empty = { noPii: true, people: [], why: 'A newsletter mailing list: names and addresses only.' };
  assert.strictEqual(EX.gradeDocument(empty, { noPii: true, rows: [] }).perfect, true);
  var extra = EX.gradeDocument(empty, { noPii: false, rows: [row({ first: 'Ana', last: 'Rivera', el: ['ssn'] })] });
  assert.deepStrictEqual(extra.defects.map(function (d) { return d.type; }), ['EXTRA_INDIVIDUAL']);
  assert.strictEqual(extra.defects[0].why, 'A newsletter mailing list: names and addresses only.');
  var missed = EX.gradeDocument({ noPii: false, people: [ANA, LILY] }, { noPii: true, rows: [] });
  assert.deepStrictEqual(missed.defects.map(function (d) { return d.type; }), ['MISSED_INDIVIDUAL', 'MISSED_INDIVIDUAL']);
  assert.strictEqual(missed.weight, 10);
});

test('gradeDocument: a second row for the same person is an extra individual, and says why', function () {
  var r = EX.gradeDocument({ noPii: false, people: [ANA] }, { noPii: false, rows: [typed(ANA), typed(ANA)] });
  assert.deepStrictEqual(r.defects.map(function (d) { return d.type; }), ['EXTRA_INDIVIDUAL']);
  assert.match(r.defects[0].why, /already has a row/);
});

test('entryFromAnswer grades perfect against its own answer', function () {
  var answer = { noPii: false, people: [ANA, DAVID, LILY, GRACE] };
  assert.strictEqual(EX.gradeDocument(answer, EX.entryFromAnswer(answer)).perfect, true);
  assert.strictEqual(EX.gradeDocument({ noPii: true, people: [] }, EX.entryFromAnswer({ noPii: true, people: [] })).perfect, true);
});

test('summarize reports accuracy and a defect breakdown', function () {
  var s = EX.summarize([
    { perfect: true, weight: 0, defects: [] },
    { perfect: false, weight: 5, defects: [{ type: 'MISSED_INDIVIDUAL' }] },
    { perfect: false, weight: 4, defects: [{ type: 'MISSED_ELEMENT' }, { type: 'FIELD_ERROR' }] },
    { perfect: true, weight: 0, defects: [] }
  ]);
  assert.strictEqual(s.submitted, 4);
  assert.strictEqual(s.perfect, 2);
  assert.strictEqual(s.accuracy, 0.5);
  assert.deepStrictEqual(s.breakdown, { MISSED_INDIVIDUAL: 1, MISSED_ELEMENT: 1, EXTRA_INDIVIDUAL: 0, EXTRA_ELEMENT: 0, FIELD_ERROR: 1 });
  assert.strictEqual(EX.summarize([]).accuracy, null);
});

test('currentSession keeps only the latest working session', function () {
  var H = 3600000, M = 60000;
  var marks = [0, 10 * M, 20 * M, 20 * H, 20 * H + 5 * M, 20 * H + 9 * M];
  assert.deepStrictEqual(EX.currentSession(marks, 30 * M), [20 * H, 20 * H + 5 * M, 20 * H + 9 * M]);
  assert.deepStrictEqual(EX.currentSession([], 30 * M), []);
});

test('resultStatus gives the document list one word per result', function () {
  assert.strictEqual(EX.resultStatus(null), 'none');
  assert.strictEqual(EX.resultStatus({ perfect: true, defects: [] }), 'correct');
  assert.strictEqual(EX.resultStatus({ perfect: false, defects: [{ type: 'FIELD_ERROR' }] }), 'partial');
  assert.strictEqual(EX.resultStatus({ perfect: false, defects: [{ type: 'MISSED_INDIVIDUAL' }] }), 'wrong');
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node --test 2>&1 | grep -E "^not ok" | head -3`
Expected: failures such as `not ok … DEFECT_WEIGHTS match the spec`, because `EX.DEFECT_WEIGHTS` is undefined.

- [ ] **Step 3: Implement matching and grading**

In `extraction-engine.js`, insert this block immediately before the final `  return {` of the factory:

```js
  var DEFECT_WEIGHTS = { MISSED_INDIVIDUAL: 5, MISSED_ELEMENT: 3, EXTRA_INDIVIDUAL: 2, EXTRA_ELEMENT: 1, FIELD_ERROR: 1 };

  var NORMALIZE = {
    first: normalizeName,
    last: normalizeName,
    dob: function (s) { var d = normalizeDob(s); return d === null ? '#invalid:' + clean(s) : d; },
    street: normalizeStreet,
    city: normalizeCity,
    state: normalizeState,
    zip: normalizeZip
  };

  function fullName(p) { return (normalizeName(p.first) + ' ' + normalizeName(p.last)).trim(); }
  function nameOf(p) { return (clean(p.first) + ' ' + clean(p.last)).trim(); }
  function sameDob(a, b) { var x = normalizeDob(a.dob), y = normalizeDob(b.dob); return !!x && x === y; }
  function sameStreet(a, b) { var x = normalizeStreet(a.street); return x !== '' && x === normalizeStreet(b.street); }

  // Among keys the row could be, prefer the one whose date of birth matches, then
  // the one whose street matches, then the first in document order.
  function bestKey(row, candidates) {
    var byDob = candidates.filter(function (c) { return sameDob(c.p, row); });
    if (byDob.length) return byDob[0];
    var byStreet = candidates.filter(function (c) { return sameStreet(c.p, row); });
    if (byStreet.length) return byStreet[0];
    return candidates[0];
  }

  // Exact names first; then a name within two edits of a remaining key is the
  // same person with a typo, so one slip is not scored as a missed person plus
  // an extra one.
  function matchPeople(keyPeople, rows) {
    var keys = (keyPeople || []).map(function (p) { return { p: p, name: fullName(p), used: false }; });
    var pairs = [], extra = [], pending = [];
    (rows || []).forEach(function (row) {
      var name = fullName(row);
      var exact = keys.filter(function (k) { return !k.used && name !== '' && k.name === name; });
      if (!exact.length) { pending.push(row); return; }
      var k = bestKey(row, exact);
      k.used = true;
      pairs.push({ key: k.p, row: row, nameTypo: false });
    });
    pending.forEach(function (row) {
      var name = fullName(row);
      var near = [];
      keys.forEach(function (k) {
        if (k.used || !name) return;
        var d = editDistance(name, k.name);
        if (d <= 2) near.push({ k: k, d: d });
      });
      if (!near.length) { extra.push(row); return; }
      var best = Math.min.apply(null, near.map(function (n) { return n.d; }));
      var closest = near.filter(function (n) { return n.d === best; }).map(function (n) { return n.k; });
      var k = bestKey(row, closest);
      k.used = true;
      pairs.push({ key: k.p, row: row, nameTypo: true });
    });
    var missed = keys.filter(function (k) { return !k.used; }).map(function (k) { return k.p; });
    return { pairs: pairs, missed: missed, extra: extra };
  }

  // The best explanation for a row that should not exist. A name that matches an
  // expected person means that person already has a row; otherwise a notPeople
  // entry whose name holds every word the reviewer typed; else the document's
  // own reason.
  function extraReason(answer, row) {
    var name = fullName(row);
    var twice = ((answer && answer.people) || []).some(function (p) {
      return name !== '' && editDistance(fullName(p), name) <= 2;
    });
    if (twice) return 'This person already has a row: one row per person per document.';
    var words = name.split(' ').filter(Boolean);
    var hits = ((answer && answer.notPeople) || []).filter(function (np) {
      var n = ' ' + normalizeName(np.name) + ' ';
      return words.length && words.every(function (w) { return n.indexOf(' ' + w + ' ') !== -1; });
    });
    if (hits.length) return hits[0].why;
    if (answer && answer.why) return answer.why;
    return 'Not an affected individual in this document.';
  }

  function gradeDocument(answer, entry) {
    var defects = [], lines = [];
    var keyPeople = (answer && !answer.noPii) ? (answer.people || []) : [];
    var rows = (entry && !entry.noPii)
      ? (entry.rows || []).filter(function (r) { return !isBlankRow(r); })
      : [];
    var m = matchPeople(keyPeople, rows);
    function add(d) { d.weight = DEFECT_WEIGHTS[d.type]; defects.push(d); }

    m.pairs.forEach(function (pr) {
      var who = nameOf(pr.key), why = pr.key.why || {}, whyNot = pr.key.whyNot || {};
      var line = { kind: 'matched', row: pr.row, key: pr.key, fieldErrors: {}, missedElements: [], extraElements: [] };
      FIELDS.forEach(function (f) {
        if ((f === 'first' || f === 'last') && !pr.nameTypo) return;
        if (NORMALIZE[f](pr.row[f]) !== NORMALIZE[f](pr.key[f])) {
          line.fieldErrors[f] = clean(pr.key[f]);
          add({ type: 'FIELD_ERROR', person: who, field: f, expected: clean(pr.key[f]), got: clean(pr.row[f]) });
        }
      });
      ELEMENTS.forEach(function (e) {
        var want = !!(pr.key.el && pr.key.el[e]), got = !!(pr.row.el && pr.row.el[e]);
        if (want && !got) { line.missedElements.push(e); add({ type: 'MISSED_ELEMENT', person: who, field: e, why: why[e] || '' }); }
        if (!want && got) { line.extraElements.push(e); add({ type: 'EXTRA_ELEMENT', person: who, field: e, why: whyNot[e] || '' }); }
      });
      lines.push(line);
    });
    m.extra.forEach(function (r) {
      var reason = extraReason(answer, r);
      lines.push({ kind: 'extra', row: r, why: reason });
      add({ type: 'EXTRA_INDIVIDUAL', person: nameOf(r), why: reason });
    });
    m.missed.forEach(function (k) {
      var reason = (k.why && k.why.person) || '';
      lines.push({ kind: 'missed', key: k, why: reason });
      add({ type: 'MISSED_INDIVIDUAL', person: nameOf(k), why: reason });
    });
    var weight = defects.reduce(function (s, d) { return s + d.weight; }, 0);
    return { defects: defects, weight: weight, perfect: defects.length === 0, lines: lines };
  }

  function summarize(results) {
    var breakdown = {};
    Object.keys(DEFECT_WEIGHTS).forEach(function (t) { breakdown[t] = 0; });
    var perfect = 0;
    (results || []).forEach(function (r) {
      if (r.perfect) perfect++;
      (r.defects || []).forEach(function (d) { if (breakdown[d.type] !== undefined) breakdown[d.type]++; });
    });
    var n = (results || []).length;
    return { submitted: n, perfect: perfect, accuracy: n ? perfect / n : null, breakdown: breakdown };
  }

  // The submission times of the latest working session. A gap longer than gapMs
  // starts a new session, so an overnight break does not drag pace toward zero.
  function currentSession(marks, gapMs) {
    var t = (marks || []).slice().sort(function (a, b) { return a - b; });
    if (!t.length) return [];
    var start = t.length - 1;
    while (start > 0 && t[start] - t[start - 1] <= gapMs) start--;
    return t.slice(start);
  }

  function entryFromAnswer(answer) {
    return {
      noPii: !!(answer && answer.noPii),
      rows: ((answer && answer.people) || []).map(function (p) {
        var el = {};
        ELEMENTS.forEach(function (e) { el[e] = !!(p.el && p.el[e]); });
        return { first: p.first, last: p.last, dob: p.dob, street: p.street,
                 city: p.city, state: p.state, zip: p.zip, el: el };
      })
    };
  }

  function resultStatus(result) {
    if (!result) return 'none';
    if (result.perfect) return 'correct';
    return (result.defects || []).some(function (d) { return d.type === 'MISSED_INDIVIDUAL'; }) ? 'wrong' : 'partial';
  }
```

Then extend the returned object. Change its last line from `    validateEntry: validateEntry` to `    validateEntry: validateEntry,` and add after it:

```js
    DEFECT_WEIGHTS: DEFECT_WEIGHTS,
    matchPeople: matchPeople,
    gradeDocument: gradeDocument,
    summarize: summarize,
    currentSession: currentSession,
    entryFromAnswer: entryFromAnswer,
    resultStatus: resultStatus
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `node --test 2>&1 | grep -E "^# (tests|pass|fail)"`
Expected: `# tests 159`, `# pass 159`, `# fail 0` (14 new).

- [ ] **Step 5: Commit**

```bash
git add extraction-engine.js tests/extraction-engine.test.js
git commit -m "Grade extraction entries: matching, weighted defects, display lines

A row matches an answer-key person by name; two edits away counts as the
same person with a typo, not a miss plus an extra. Same-name people split
by date of birth, then street. Five defect types carry the spec's
weights, and every defect carries its reason, including a second row for
someone already recorded. The mockup approved in brainstorming is a
test: four defects, weight 11.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: The Larkspur document set

**Files:**
- Create: `tools/build_cir_docs.py`
- Create (generated): `cir-docs.js`
- Create: `tests/cir-docs.test.js`

**Interfaces:**
- Consumes (tests only): `EX.gradeDocument`, `EX.entryFromAnswer`, `EX.ELEMENTS`.
- Produces: `cir-docs.js`, defining `var CIR_DOCS` (an array of 150) and, under Node, `module.exports = CIR_DOCS`. The file is one document per line, about 420 KB.
- Each document is `{ id:'LBS-0001', type, custodian, subject, date, from, hasAttachment:false, body, answer, traps }`, plus exactly one of `table`, `form`, `email` or `text`:
  - `table` is `{caption, columns, rows, pageBreakBefore:number|null}`.
  - `form` is `{heading, sections:[{label, fields:[[label, value]]}]}`.
  - `email` is `{from, to, cc, subject, body}`.
  - `text` is a string.
- `body` is the plain text of the whole document. Search and the generator's own checks use it.
- `type` is one of `roster`, `claim`, `visit-note`, `w2`, `direct-deposit`, `i9`, `email`, `policy`, `it-ticket`, `marketing`, `meeting-notes`.
- `custodian` is one of `cust-benefits`, `cust-claims`, `cust-hr`, `cust-it`, `cust-finance`. The sidebar shows these as Benefits, Claims, HR, IT and Finance.

- [ ] **Step 1: Write the failing data test**

Create `tests/cir-docs.test.js`:

```js
'use strict';
var test = require('node:test');
var assert = require('node:assert');
var DOCS = require('../cir-docs.js');
var EX = require('../extraction-engine.js');

test('150 documents with unique LBS ids', function () {
  assert.strictEqual(DOCS.length, 150);
  var ids = DOCS.map(function (d) { return d.id; });
  assert.strictEqual(new Set(ids).size, 150);
  ids.forEach(function (id) { assert.match(id, /^LBS-\d{4}$/); });
});

test('every answer key grades itself perfect', function () {
  DOCS.forEach(function (d) {
    var r = EX.gradeDocument(d.answer, EX.entryFromAnswer(d.answer));
    assert.ok(r.perfect, d.id + ': ' + JSON.stringify(r.defects));
  });
});

test('every SSN anywhere in the set is in the never-issued range', function () {
  DOCS.forEach(function (d) {
    (d.body.match(/\b\d{3}-\d{2}-\d{4}\b/g) || []).forEach(function (s) {
      assert.match(s, /^9\d\d-00-\d{4}$/, d.id + ' has ' + s);
    });
  });
});

test('no-PII documents expect no people, and every expected person has an element', function () {
  DOCS.forEach(function (d) {
    assert.strictEqual(d.answer.noPii, d.answer.people.length === 0, d.id);
    d.answer.people.forEach(function (p) {
      assert.ok(EX.ELEMENTS.some(function (k) { return p.el[k]; }), d.id + ' ' + p.first + ' ' + p.last);
    });
  });
});

test('about a quarter of the set has no PII', function () {
  var n = DOCS.filter(function (d) { return d.answer.noPii; }).length;
  assert.ok(n >= 38 && n <= 45, 'no-PII documents: ' + n);
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node --test 2>&1 | grep -E "Cannot find module '../cir-docs.js'" | head -1`
Expected: that line.

- [ ] **Step 3: Write the generator**

Create `tools/build_cir_docs.py`:

```python
"""
Generate cir-docs.js -- the Larkspur Benefit Services document set for the
Cyber Incident Response matter.

    python3 tools/build_cir_docs.py

Deterministic: a fixed seed produces the same 150 documents every run. Refuses
to write the file if the set fails any of its checks.

Every name, number and address is fictional. SSNs use area 900-999 with group
00, a combination never issued as an SSN or an ITIN. Phone numbers use the
reserved 555-01xx range; emails use example.com; card numbers are published
test numbers.
"""
import json
import os
import random
import re
import sys
from collections import Counter

SEED = 20260925
HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(os.path.dirname(HERE), "cir-docs.js")
rng = random.Random(SEED)

KIND_COUNTS = {"roster": 20, "claim": 25, "visit-note": 15, "w2": 10, "direct-deposit": 10, "i9": 8,
               "email": 22, "policy": 10, "it-ticket": 10, "marketing": 10, "meeting-notes": 10}
NO_PII_KINDS = {"policy", "it-ticket", "marketing", "meeting-notes"}
TRAP_MINIMUMS = {"page-break": 8, "duplicate-person": 3, "masked-ssn": 12, "provider": 40,
                 "unnamed-ssn": 3, "name-only": 2, "business-contact": 30, "dependent": 30}
EL_KEYS = ["ssn", "dl", "passport", "fin", "card", "login", "bio", "mrn", "plan", "med"]
NO_PII_PATTERNS = [r"\b\d{3}-\d{2}-\d{4}\b", r"MRN-\d", r"LKS\d{9}", r"WDL[A-Z0-9]{9}",
                   r"Routing number", r"Account number", r"\b\d{4} \d{4} \d{4} \d{4}\b",
                   r"(?i)password", r"FP-\d"]

FIRST = ["Ana", "David", "Lily", "Grace", "Marcus", "Priya", "Tomas", "Hannah", "Kevin", "Rosa",
         "Samuel", "Irene", "Owen", "Fatima", "Caleb", "Mei", "Victor", "Nora", "Isaac", "Leah",
         "Andre", "Julia", "Felix", "Amara", "Ethan", "Sofia", "Gabriel", "Chloe", "Ruben", "Maya",
         "Elliot", "Zara", "Hugo", "Ingrid", "Jonah", "Keira", "Luis", "Mira", "Nikhil", "Olga",
         "Pablo", "Quinn", "Rhea", "Stefan", "Talia", "Uma", "Wes", "Yara", "Aiden", "Bianca",
         "Colin", "Dara", "Emil", "Farah", "Gideon", "Hazel", "Ivan", "Jade", "Kofi", "Lena"]
LAST = ["Rivera", "Okafor", "Chen", "Holloway", "Lindqvist", "Nakamura", "Haddad", "Brennan", "Castillo", "Duarte",
        "Ellison", "Fitzgerald", "Garrow", "Hanley", "Ibarra", "Jansen", "Kowalski", "Larkin", "Mendel", "Novak",
        "Osei", "Pruitt", "Quiroga", "Ramsay", "Sandoval", "Thorne", "Underwood", "Vasko", "Whitlock", "Yamada",
        "Abernathy", "Bellamy", "Crowder", "Delacroix", "Easton", "Faraday", "Gallo", "Hendricks", "Iverson", "Joyner",
        "Kimura", "Lachance", "Moreau", "Nightingale", "Ostrowski", "Pemberton", "Rasmussen", "Sokolov", "Tennant", "Valdez",
        "Wexler", "Albright", "Barros", "Cordova", "Dunleavy", "Espinoza", "Fairbanks", "Gustafson", "Hargrove", "Ishikawa"]
STREETS = ["Alder Ct", "Birch Ln", "Quarry Rd", "Cedar Ave", "Juniper St", "Madrona Dr", "Sequoia Pl", "Hemlock Way",
           "Willow Ter", "Aspen Cir", "Larch Blvd", "Maple Pkwy", "Spruce St", "Hawthorn Ave", "Dogwood Ln",
           "Sycamore Rd", "Fircrest Dr", "Tamarack Ct", "Laurel St", "Elderberry Way", "Chinook Ave",
           "Salmonberry Ln", "Ridgeview Dr", "Harbor Point Rd"]
CITIES = [("Tacoma", "WA", "98402"), ("Olympia", "WA", "98501"), ("Lakewood", "WA", "98499"),
          ("Puyallup", "WA", "98371"), ("Federal Way", "WA", "98003"), ("Kent", "WA", "98030"),
          ("Renton", "WA", "98057"), ("Auburn", "WA", "98002"), ("Gig Harbor", "WA", "98335"),
          ("Bremerton", "WA", "98312"), ("Vancouver", "WA", "98660"), ("Portland", "OR", "97205"),
          ("Salem", "OR", "97301"), ("Boise", "ID", "83702")]
EMPLOYERS = ["Cascade Valley Schools", "Rainier Logistics", "Sound Harbor Foods", "Evergreen Dental Group",
             "Pinecrest Manufacturing"]
DIAGNOSES = [("E11.9", "Type 2 diabetes mellitus without complications"), ("I10", "Essential (primary) hypertension"),
             ("F41.1", "Generalized anxiety disorder"), ("J45.909", "Unspecified asthma, uncomplicated"),
             ("M54.50", "Low back pain, unspecified"), ("E78.5", "Hyperlipidemia, unspecified"),
             ("K21.9", "Gastro-esophageal reflux disease without esophagitis"), ("F32.A", "Depression, unspecified"),
             ("G43.909", "Migraine, unspecified"), ("N39.0", "Urinary tract infection, site not specified")]
MEDS = ["metformin 500 mg twice daily", "lisinopril 10 mg daily", "sertraline 50 mg daily",
        "albuterol inhaler as needed", "atorvastatin 20 mg nightly", "omeprazole 20 mg daily",
        "sumatriptan 50 mg as needed", "nitrofurantoin 100 mg for 5 days"]
PROVIDERS = [("Meera", "Patel", "MD"), ("Samuel", "Okonjo", "DO"), ("Helen", "Marchetti", "MD"),
             ("Arjun", "Rao", "MD"), ("Claire", "Dubois", "NP"), ("Martin", "Szabo", "MD"),
             ("Yusuf", "Karimi", "PA-C"), ("Beatrice", "Lowell", "MD")]
STAFF = [("Jordan", "Pike", "Benefits Specialist"), ("Morgan", "Tate", "Payroll Coordinator"),
         ("Riley", "Vance", "IT Service Desk"), ("Casey", "Holt", "Claims Analyst"),
         ("Avery", "Nash", "Finance Manager"), ("Drew", "Keller", "HR Generalist")]
TEST_CARDS = ["4111 1111 1111 1111", "5555 5555 5555 4444", "3782 822463 10005"]
MONTHS = ["January", "February", "March", "April", "May", "June"]

used = set()


def digits(n):
    return "".join(rng.choice("0123456789") for _ in range(n))


def ssn():
    return "%d-00-%s" % (rng.randint(900, 999), digits(4))


def masked_ssn():
    return "XXX-XX-" + digits(4)


def member_id():
    return "LKS" + digits(9)


def mrn():
    return "MRN-" + digits(8)


def dl_number():
    return "WDL" + "".join(rng.choice("ABCDEFGHJKLMNPRSTUVWXYZ0123456789") for _ in range(9))


def passport_number():
    return "5" + digits(8)


def phone():
    return "(253) 555-01" + digits(2)


def work_email(first, last):
    return "%s.%s@larkspur.example.com" % (first.lower(), last.lower())


def doc_date():
    return "%s %d, 2025" % (rng.choice(MONTHS), rng.randint(1, 28))


def new_person(minor=False, last=None, address_of=None):
    for _ in range(2000):
        first = rng.choice(FIRST)
        surname = last or rng.choice(LAST)
        if (first, surname) not in used:
            break
    else:
        sys.exit("ran out of unique names")
    used.add((first, surname))
    year = rng.randint(2008, 2019) if minor else rng.randint(1950, 2001)
    dob = "%02d/%02d/%04d" % (rng.randint(1, 12), rng.randint(1, 28), year)
    if address_of:
        street, city, state, zipc = (address_of[k] for k in ("street", "city", "state", "zip"))
    else:
        city, state, zipc = rng.choice(CITIES)
        street = "%d %s" % (rng.randint(10, 9899), rng.choice(STREETS))
    return {"first": first, "last": surname, "dob": dob, "street": street,
            "city": city, "state": state, "zip": zipc}


def affected(p, elements, why, why_not=None):
    person = dict(p)
    person["el"] = {k: (k in elements) for k in EL_KEYS}
    person["why"] = why
    if why_not:
        person["whyNot"] = why_not
    return person


def without(p, *fields):
    q = dict(p)
    for f in fields:
        q[f] = ""
    return q


ADDRESS = ("street", "city", "state", "zip")


def table_text(caption, columns, rows, page_break):
    lines = [caption, " | ".join(columns)]
    for i, r in enumerate(rows):
        if page_break is not None and i == page_break:
            lines.append("--- Page 2 ---")
        lines.append(" | ".join(r))
    return "\n".join(lines)


def form_text(heading, sections):
    lines = [heading]
    for s in sections:
        lines.append(s["label"])
        lines += ["%s: %s" % (a, b) for a, b in s["fields"]]
    return "\n".join(lines)


def email_text(e):
    return "From: %s\nTo: %s\nSubject: %s\n\n%s" % (e["from"], e["to"], e["subject"], e["body"])


def doc(kind, custodian, subject, content_key, content, body, people,
        not_people=None, traps=None, why=None, frm=""):
    d = {"type": kind, "custodian": custodian, "subject": subject, "date": doc_date(),
         "from": frm, "hasAttachment": False, content_key: content, "body": body,
         "answer": {"noPii": not people, "people": people}, "traps": traps or []}
    if not_people:
        d["answer"]["notPeople"] = not_people
    if why:
        d["answer"]["why"] = why
    return d


# ── Documents with PII ───────────────────────────────────────────────────────

def roster(dup=False):
    employer = rng.choice(EMPLOYERS)
    with_ssn = rng.random() < 0.5
    cols = ["Member ID", "Last Name", "First Name", "DOB"] + (["SSN"] if with_ssn else []) + \
           ["Relationship", "Street", "City", "State", "ZIP"]
    target = rng.randint(10, 40)
    rows, members, traps = [], [], []
    while len(members) < target:
        emp = new_person()
        household = [(emp, "Employee")]
        if rng.random() < 0.55:
            household.append((new_person(last=emp["last"], address_of=emp), "Spouse"))
        for _ in range(rng.choice([0, 0, 1, 1, 2, 3])):
            household.append((new_person(minor=True, last=emp["last"], address_of=emp), "Child"))
        for p, rel in household[:target - len(members)]:
            rows.append([member_id(), p["last"], p["first"], p["dob"]] + ([ssn()] if with_ssn else []) +
                        [rel, p["street"], p["city"], p["state"], p["zip"]])
            members.append((p, rel))
            if rel == "Child":
                traps.append("dependent")
    page_break = None
    if len(rows) >= 14:
        page_break = len(rows) - rng.randint(1, 4)
        traps.append("page-break")
    dup_index = None
    if dup:
        dup_index = rng.randrange(len(rows))
        rows.append(list(rows[dup_index]))
        traps.append("duplicate-person")
    people = []
    for i, (p, rel) in enumerate(members):
        where = "Row %d of the census" % (i + 1)
        if page_break is not None and i >= page_break:
            where += ", below the page break on page 2"
        if rel == "Child":
            where += "; a dependent, and still an affected individual"
        if i == dup_index:
            where += "; listed twice after a coverage change, so it is one row"
        why = {"person": where + ".", "plan": "Member ID on the census row."}
        if with_ssn:
            why["ssn"] = "SSN column on the census row."
        people.append(affected(p, {"plan"} | ({"ssn"} if with_ssn else set()), why))
    caption = "%s: plan year 2025 enrollment census%s" % (
        employer, " (includes a re-listed coverage change)" if dup else "")
    return doc("roster", "cust-benefits", "Enrollment census: " + employer, "table",
               {"caption": caption, "columns": cols, "rows": rows, "pageBreakBefore": page_break},
               table_text(caption, cols, rows, page_break), people, traps=traps)


def claim():
    p = new_person()
    prov = rng.choice(PROVIDERS)
    pc, ps, pz = rng.choice(CITIES)
    prov_addr = "%d %s, Suite %d, %s, %s %s" % (rng.randint(100, 4000), rng.choice(STREETS),
                                                rng.randint(100, 400), pc, ps, pz)
    dx = rng.sample(DIAGNOSES, rng.choice([1, 2]))
    sections = [
        {"label": "Patient", "fields": [
            ["Patient name", "%s, %s" % (p["last"], p["first"])], ["Date of birth", p["dob"]],
            ["Address", p["street"]], ["City / State / ZIP", "%s, %s %s" % (p["city"], p["state"], p["zip"])],
            ["Member ID", member_id()]]},
        {"label": "Rendering provider", "fields": [
            ["Provider", "Dr. %s %s, %s" % prov], ["Practice address", prov_addr],
            ["Phone", phone()], ["NPI", digits(10)]]},
        {"label": "Diagnosis (ICD-10)", "fields": [[code, desc] for code, desc in dx]},
        {"label": "Service", "fields": [
            ["Date of service", "%02d/%02d/2025" % (rng.randint(1, 5), rng.randint(1, 28))],
            ["Billed", "$%d.00" % rng.randint(90, 2400)]]}]
    heading = "CMS-1500 Health Insurance Claim Form"
    person = affected(p, {"plan", "med"}, {
        "person": "The patient on the claim form.", "plan": "Member ID in the patient block.",
        "med": "Diagnosis codes and descriptions for the patient."})
    np_ = [{"name": "Dr. %s %s" % (prov[0], prov[1]),
            "why": "The treating provider. The name and practice address are business contact details, "
                   "not an affected individual."}]
    return doc("claim", "cust-claims", "Claim: %s, %s" % (p["last"], p["first"]), "form",
               {"heading": heading, "sections": sections}, form_text(heading, sections), [person],
               not_people=np_, traps=["provider"])


def visit_note():
    p = new_person()
    prov = rng.choice(PROVIDERS)
    code, desc = rng.choice(DIAGNOSES)
    with_plan = rng.random() < 0.4
    fields = [["Patient", "%s %s" % (p["first"], p["last"])], ["DOB", p["dob"]], ["MRN", mrn()]]
    if with_plan:
        fields.append(["Member ID", member_id()])
    sections = [{"label": "Patient", "fields": fields},
                {"label": "Assessment", "fields": [["Diagnosis", "%s (%s)" % (desc, code)]]},
                {"label": "Plan", "fields": [["Medication", rng.choice(MEDS)],
                                             ["Follow-up", "%d weeks" % rng.randint(2, 12)]]},
                {"label": "Signed", "fields": [["Clinician", "%s %s, %s" % prov]]}]
    heading = "Progress note: Larkspur care-management review"
    elements = {"mrn", "med"} | ({"plan"} if with_plan else set())
    why = {"person": "The patient named in the progress note.",
           "mrn": "Medical record number in the patient block.",
           "med": "Diagnosis and medication for the patient."}
    if with_plan:
        why["plan"] = "Member ID in the patient block."
    person = affected(without(p, *ADDRESS), elements, why)
    np_ = [{"name": "%s %s" % (prov[0], prov[1]),
            "why": "The clinician who signed the note: business contact details, not an affected individual."}]
    return doc("visit-note", "cust-claims", "Progress note: %s %s" % (p["first"], p["last"]), "form",
               {"heading": heading, "sections": sections}, form_text(heading, sections), [person],
               not_people=np_, traps=["provider"])


def w2():
    p = new_person()
    ec, es, ez = rng.choice(CITIES)
    sections = [
        {"label": "Employer", "fields": [
            ["Name", rng.choice(EMPLOYERS)], ["EIN", "91-" + digits(7)],
            ["Address", "%d %s, %s, %s %s" % (rng.randint(100, 9000), rng.choice(STREETS), ec, es, ez)]]},
        {"label": "Employee", "fields": [
            ["a  Employee's SSN", ssn()], ["e  Employee's name", "%s %s" % (p["first"], p["last"])],
            ["f  Address", p["street"]], ["City / State / ZIP", "%s, %s %s" % (p["city"], p["state"], p["zip"])]]},
        {"label": "Wages", "fields": [
            ["1  Wages, tips", "$%s.00" % format(rng.randint(28000, 140000), ",")],
            ["2  Federal tax withheld", "$%s.00" % format(rng.randint(2000, 24000), ",")]]}]
    heading = "Form W-2 Wage and Tax Statement 2024"
    person = affected(without(p, "dob"), {"ssn"},
                      {"person": "The employee on the W-2.", "ssn": "Box a: the employee's SSN."})
    return doc("w2", "cust-hr", "W-2: %s %s" % (p["first"], p["last"]), "form",
               {"heading": heading, "sections": sections}, form_text(heading, sections), [person])


def direct_deposit():
    p = new_person()
    with_address = rng.random() < 0.5
    fields = [["Employee name", "%s %s" % (p["first"], p["last"])], ["Employee ID", "E" + digits(6)],
              ["SSN (last 4)", masked_ssn()]]
    if with_address:
        fields += [["Home address", p["street"]],
                   ["City / State / ZIP", "%s, %s %s" % (p["city"], p["state"], p["zip"])]]
    sections = [{"label": "Employee", "fields": fields},
                {"label": "Deposit account", "fields": [
                    ["Bank", rng.choice(["Puget First Credit Union", "Harborline Bank", "Summit Federal"])],
                    ["Routing number", digits(9)], ["Account number", digits(11)],
                    ["Account type", rng.choice(["Checking", "Savings"])]]}]
    heading = "Direct Deposit Authorization"
    base = without(p, "dob") if with_address else without(p, "dob", *ADDRESS)
    person = affected(base, {"fin"},
                      {"person": "The employee on the direct-deposit form.",
                       "fin": "Routing and account numbers in the deposit section."},
                      {"ssn": "Only the last four digits are shown (XXX-XX-dddd): a masked SSN does not count."})
    return doc("direct-deposit", "cust-hr", "Direct deposit: %s %s" % (p["first"], p["last"]), "form",
               {"heading": heading, "sections": sections}, form_text(heading, sections), [person],
               traps=["masked-ssn"])


def i9():
    p = new_person()
    use_passport = rng.random() < 0.5
    with_ssn = rng.random() < 0.5
    rep = rng.choice(STAFF)
    s1 = [["Last name", p["last"]], ["First name", p["first"]], ["Address", p["street"]],
          ["City / State / ZIP", "%s, %s %s" % (p["city"], p["state"], p["zip"])],
          ["Date of birth", p["dob"]], ["U.S. Social Security number", ssn() if with_ssn else ""]]
    if use_passport:
        s2 = [["List A document", "U.S. Passport"], ["Document number", passport_number()],
              ["Expiration", "%02d/%02d/203%d" % (rng.randint(1, 12), rng.randint(1, 28), rng.randint(0, 5))]]
    else:
        s2 = [["List B document", "Driver's license (%s)" % p["state"]], ["Document number", dl_number()],
              ["List C document", "Birth certificate"]]
    s3 = [["Employer representative", "%s %s, %s" % rep], ["Business email", work_email(rep[0], rep[1])]]
    sections = [{"label": "Section 1. Employee information", "fields": s1},
                {"label": "Section 2. Documents reviewed", "fields": s2},
                {"label": "Certification", "fields": s3}]
    heading = "Form I-9 Employment Eligibility Verification"
    doc_el = "passport" if use_passport else "dl"
    why = {"person": "The employee in Section 1.",
           doc_el: "Passport number in Section 2." if use_passport else "Driver's license number in Section 2."}
    if with_ssn:
        why["ssn"] = "SSN in Section 1."
    person = affected(p, {doc_el} | ({"ssn"} if with_ssn else set()), why)
    np_ = [{"name": "%s %s" % (rep[0], rep[1]),
            "why": "The employer's representative: a work name and email are business contact details."}]
    return doc("i9", "cust-hr", "I-9: %s %s" % (p["first"], p["last"]), "form",
               {"heading": heading, "sections": sections}, form_text(heading, sections), [person],
               not_people=np_, traps=["business-contact"])


# ── Emails ───────────────────────────────────────────────────────────────────

def signature(st):
    return "\n\n%s %s\n%s, Larkspur Benefit Services\n%s | %s" % (
        st[0], st[1], st[2], phone(), work_email(st[0], st[1]))


def email_doc(custodian, subject, body, people, traps=None, why=None, extra_np=None):
    st = rng.choice(STAFF)
    e = {"from": "%s %s <%s>" % (st[0], st[1], work_email(st[0], st[1])),
         "to": "claims-ops@larkspur.example.com", "cc": "", "subject": subject, "body": body + signature(st)}
    np_ = [{"name": "%s %s" % (st[0], st[1]),
            "why": "The Larkspur staff member who sent the email: a work signature is business contact details."}]
    return doc("email", custodian, subject, "email", e, email_text(e), people,
               not_people=np_ + (extra_np or []), traps=["business-contact"] + (traps or []),
               why=why, frm=e["from"])


def email_payroll():
    p = new_person()
    body = ("Hi team,\n\nPlease update the direct deposit for %s %s before Friday's run. "
            "New Routing number %s, Account number %s. Home address on file: %s, %s, %s %s.\n\nThanks,"
            % (p["first"], p["last"], digits(9), digits(11), p["street"], p["city"], p["state"], p["zip"]))
    person = affected(without(p, "dob"), {"fin"}, {"person": "The employee named in the payroll request.",
                                                   "fin": "The new routing and account numbers."})
    return email_doc("cust-hr", "Direct deposit change: %s %s" % (p["first"], p["last"]), body, [person])


def email_benefits():
    p = new_person()
    code, desc = rng.choice(DIAGNOSES)
    body = ("Member %s %s (DOB %s, member ID %s) called about a denied claim for %s (%s). "
            "Please review before the appeal deadline." % (p["first"], p["last"], p["dob"], member_id(), desc, code))
    person = affected(without(p, *ADDRESS), {"plan", "med"},
                      {"person": "The member who called.", "plan": "Member ID in the message.",
                       "med": "The diagnosis on the denied claim."})
    return email_doc("cust-benefits", "Denied claim follow-up", body, [person])


def email_credentials(unnamed):
    p = new_person()
    username = (p["first"][0] + p["last"]).lower()
    pw = "".join(rng.choice("ABCDEFGHJKMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!#") for _ in range(10))
    body = ("Temporary credentials for %s %s: username %s, password %s. Please change them at first login."
            % (p["first"], p["last"], username, pw))
    traps, why = [], None
    if unnamed:
        body += "\n\nLog excerpt from the failed sync:\n  ERR record %s not found in eligibility index" % ssn()
        traps = ["unnamed-ssn"]
        why = "The SSN in the log excerpt has no name attached, so it is not recorded."
    person = affected(without(p, "dob", *ADDRESS), {"login"},
                      {"person": "The account holder named in the message.",
                       "login": "Username and password together."})
    return email_doc("cust-it", "Temporary credentials", body, [person], traps=traps, why=why)


def email_biometric():
    p = new_person()
    body = ("%s %s's fingerprint template was enrolled on the new timeclock (template ID FP-%s)."
            % (p["first"], p["last"], digits(8)))
    person = affected(without(p, "dob", *ADDRESS), {"bio"},
                      {"person": "The employee enrolled on the timeclock.",
                       "bio": "The fingerprint template enrolment."})
    return email_doc("cust-hr", "Timeclock enrolment", body, [person])


def email_card():
    p = new_person()
    body = ("%s %s paid the COBRA premium by card %s, exp %02d/2%d. Billing address %s, %s, %s %s."
            % (p["first"], p["last"], rng.choice(TEST_CARDS), rng.randint(1, 12), rng.randint(6, 9),
               p["street"], p["city"], p["state"], p["zip"]))
    person = affected(without(p, "dob"), {"card"},
                      {"person": "The member who paid the premium.", "card": "The full card number."})
    return email_doc("cust-finance", "COBRA premium payment", body, [person])


def email_masked_pair():
    ghost, p = new_person(), new_person()
    body = ("Two follow-ups from the call queue:\n1. %s %s asked whether their SSN (%s) was exposed. "
            "No other details were given.\n2. %s %s (member ID %s) needs a replacement ID card mailed to "
            "%s, %s, %s %s." % (ghost["first"], ghost["last"], masked_ssn(), p["first"], p["last"],
                                member_id(), p["street"], p["city"], p["state"], p["zip"]))
    person = affected(without(p, "dob"), {"plan"},
                      {"person": "The member who needs a replacement card.",
                       "plan": "Member ID in the message."})
    np_ = [{"name": "%s %s" % (ghost["first"], ghost["last"]),
            "why": "Only a masked SSN is given: that is not a data element, so this is not an affected individual."}]
    return email_doc("cust-benefits", "Call queue follow-ups", body, [person],
                     traps=["masked-ssn"], extra_np=np_)


def email_census_excerpt():
    ps = [new_person() for _ in range(3)]
    lines = ["%s, %s | %s | %s | %s, %s, %s %s" % (p["last"], p["first"], p["dob"], ssn(), p["street"],
                                                   p["city"], p["state"], p["zip"]) for p in ps]
    body = "Pasting the three rows that failed the eligibility upload:\n" + "\n".join(lines)
    people = [affected(p, {"ssn"}, {"person": "A row pasted from the failed upload.",
                                    "ssn": "SSN in the pasted row."}) for p in ps]
    return email_doc("cust-benefits", "Failed eligibility rows", body, people)


# ── Documents without PII ────────────────────────────────────────────────────

POLICY_TOPICS = ["Acceptable Use", "Clean Desk", "Screen Lock", "Remote Work", "Records Retention",
                 "Vendor Onboarding", "Incident Escalation", "Travel and Expenses", "Visitor Access",
                 "Mobile Devices"]
TICKET_TOPICS = ["VPN drops on floor 3", "Printer queue stuck", "Laptop fan noise", "Shared drive slow",
                 "Monitor flicker", "Outlook calendar sync", "Badge reader offline", "Wi-Fi in room 204",
                 "Software licence renewal", "Conference room display"]
MARKETING_TOPICS = ["Open enrolment reminder", "Wellness fair", "Flu shot clinic", "New telehealth partner",
                    "Dental plan highlights", "Spring newsletter", "Retirement planning webinar",
                    "Member portal refresh"]
MEETING_TOPICS = ["Q2 vendor review", "Budget check-in", "Claims backlog stand-up", "Office move planning",
                  "Quarterly all-hands prep", "Audit readiness", "Broker renewal prep", "Portal release retro",
                  "Training calendar", "Facilities walkthrough"]


def text_doc(kind, custodian, subject, text, traps=None, why=None):
    return doc(kind, custodian, subject, "text", text, subject + "\n" + text,
               [], traps=traps, why=why)


def no_pii_docs():
    docs = []
    staff_note = ("No one here has a data element exposed: staff names and work contact details "
                  "are business information.")
    for t in POLICY_TOPICS:
        docs.append(text_doc("policy", rng.choice(["cust-hr", "cust-benefits"]), "%s Policy v%d.%d" % (
            t, rng.randint(1, 4), rng.randint(0, 9)),
            "Purpose. This policy sets out Larkspur's expectations for %s.\n\nScope. It applies to all "
            "staff and contractors.\n\nReview. Owned by the policy committee and reviewed annually." % t.lower()))
    for t in TICKET_TOPICS:
        st = rng.choice(STAFF)
        docs.append(text_doc("it-ticket", "cust-it", "INC-%s: %s" % (digits(5), t),
            "Reported by the %s team. Assigned to %s %s (%s). Status: resolved after a restart and a "
            "configuration check. No data was accessed." % (rng.choice(["claims", "benefits", "finance"]),
                                                            st[0], st[1], st[2]), why=staff_note))
    for t in MARKETING_TOPICS:
        docs.append(text_doc("marketing", "cust-benefits", t,
            "%s. Join us to learn what's new for plan year 2025. Visit the member portal for details, "
            "or call the member line." % t))
    for _ in range(2):
        people = [new_person() for _ in range(8)]
        cols = ["Name", "Street", "City", "State", "ZIP"]
        rows = [["%s %s" % (p["first"], p["last"]), p["street"], p["city"], p["state"], p["zip"]] for p in people]
        caption = "Spring newsletter: print mailing list"
        docs.append(doc("marketing", "cust-benefits", caption, "table",
                        {"caption": caption, "columns": cols, "rows": rows, "pageBreakBefore": None},
                        table_text(caption, cols, rows, None), [], traps=["name-only"],
                        why="A newsletter mailing list: names and addresses only, with no data element, "
                            "so no one here is an affected individual."))
    for t in MEETING_TOPICS:
        a, b = rng.sample(STAFF, 2)
        docs.append(text_doc("meeting-notes", rng.choice(["cust-finance", "cust-benefits"]), "Notes: " + t,
            "Attendees: %s %s, %s %s.\n\nDiscussed timelines, owners and open questions. Next check-in "
            "in two weeks." % (a[0], a[1], b[0], b[1]), why=staff_note))
    return docs


# ── Build, check, write ──────────────────────────────────────────────────────

def build():
    docs = [roster() for _ in range(17)] + [roster(dup=True) for _ in range(3)]
    docs += [claim() for _ in range(25)]
    docs += [visit_note() for _ in range(15)]
    docs += [w2() for _ in range(10)]
    docs += [direct_deposit() for _ in range(10)]
    docs += [i9() for _ in range(8)]
    docs += [email_payroll() for _ in range(4)]
    docs += [email_benefits() for _ in range(5)]
    docs += [email_credentials(unnamed=(i < 3)) for i in range(4)]
    docs += [email_biometric() for _ in range(2)]
    docs += [email_card() for _ in range(3)]
    docs += [email_masked_pair() for _ in range(2)]
    docs += [email_census_excerpt() for _ in range(2)]
    docs += no_pii_docs()
    rng.shuffle(docs)
    return [dict([("id", "LBS-%04d" % (i + 1))] + list(d.items())) for i, d in enumerate(docs)]


def check(docs):
    problems = []
    kinds = Counter(d["type"] for d in docs)
    if dict(kinds) != KIND_COUNTS:
        problems.append("kind counts %s differ from %s" % (dict(kinds), KIND_COUNTS))
    ids = [d["id"] for d in docs]
    if len(ids) != 150 or len(set(ids)) != 150:
        problems.append("ids are not 150 unique values")
    traps = Counter(t for d in docs for t in d["traps"])
    for t, n in TRAP_MINIMUMS.items():
        if traps[t] < n:
            problems.append("trap %s appears %d times; needs %d" % (t, traps[t], n))
    for d in docs:
        text, a = d["body"], d["answer"]
        for s in re.findall(r"\b\d{3}-\d{2}-\d{4}\b", text):
            if not re.match(r"^9\d\d-00-\d{4}$", s):
                problems.append("%s: unsafe SSN %s" % (d["id"], s))
        for ph in re.findall(r"555-\d{4}", text):
            if not ph.startswith("555-01"):
                problems.append("%s: phone outside 555-01xx: %s" % (d["id"], ph))
        for em in re.findall(r"[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+", text):
            if not em.endswith("example.com"):
                problems.append("%s: a real-looking email %s" % (d["id"], em))
        if a["noPii"] != (not a["people"]):
            problems.append("%s: noPii disagrees with people" % d["id"])
        if d["type"] in NO_PII_KINDS:
            if a["people"]:
                problems.append("%s: a no-PII kind has people" % d["id"])
            for pat in NO_PII_PATTERNS:
                if re.search(pat, text):
                    problems.append("%s: a no-PII document matches %s" % (d["id"], pat))
        names = [(p["first"], p["last"]) for p in a["people"]]
        for p in a["people"]:
            if not any(p["el"].values()):
                problems.append("%s: %s %s has no element" % (d["id"], p["first"], p["last"]))
            for f in ("first", "last", "dob", "street", "city", "state", "zip"):
                if p[f] and p[f] not in text:
                    problems.append("%s: %s %r is not in the document" % (d["id"], f, p[f]))
        for np_ in a.get("notPeople", []):
            for first, last in names:
                if first in np_["name"] and last in np_["name"]:
                    problems.append("%s: %s is both a person and not" % (d["id"], np_["name"]))
        if d["type"] == "direct-deposit" and any(p["el"]["ssn"] for p in a["people"]):
            problems.append("%s: a masked SSN ticks the SSN box" % d["id"])
        if "provider" in d["traps"] and not a.get("notPeople"):
            problems.append("%s: a provider document explains no provider" % d["id"])
    return problems


def write(docs):
    js = ("/* Generated by tools/build_cir_docs.py. Do not edit by hand.\n"
          "   Larkspur Benefit Services is a fictional matter: every person and number in it is\n"
          "   invented. See the generator's docstring for the safety rules. */\n"
          "var CIR_DOCS = [\n" + ",\n".join(json.dumps(d, separators=(",", ":")) for d in docs) + "\n];\n"
          "if (typeof module !== 'undefined' && module.exports) module.exports = CIR_DOCS;\n")
    with open(OUT, "w") as f:
        f.write(js)


if __name__ == "__main__":
    docs = build()
    problems = check(docs)
    if problems:
        print("Refusing to write cir-docs.js; %d problem(s):" % len(problems))
        for p in problems[:40]:
            print("  -", p)
        sys.exit(1)
    write(docs)
    print("wrote %s: %d documents, %d people" % (OUT, len(docs), sum(len(d["answer"]["people"]) for d in docs)))
```

- [ ] **Step 4: Generate the set**

Run: `python3 tools/build_cir_docs.py`

Expected: `wrote …/cir-docs.js: 150 documents, 496 people`, with no problems listed. The seed is fixed, so the count is exact.

If it lists problems, fix the builder that produced them. Do **not** relax a check to make it pass.

- [ ] **Step 5: Run all tests**

Run: `node --test 2>&1 | grep -E "^# (tests|pass|fail)"`
Expected: `# tests 164`, `# pass 164`, `# fail 0`.

- [ ] **Step 6: Commit**

```bash
git add tools/build_cir_docs.py cir-docs.js tests/cir-docs.test.js
git commit -m "Generate the Larkspur document set, with checks that refuse bad data

150 fictional documents from a fixed seed: rosters of 10 to 40 people,
claims, progress notes, W-2s, direct-deposit forms, I-9s, emails, and
40 documents with no PII at all. The generator refuses to write a set
that fails its checks: every expected value appears in its document,
every SSN is in the never-issued 9xx-00 range, no-PII documents hold
nothing PII-shaped, every expected person has an element, and each trap
appears often enough. A test confirms every answer key grades itself
perfect.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: The Relativity shell holds more than one matter

**Files:**
- Modify: `index.html`:
  - insert a block before `function openCase(caseNum) {`;
  - replace `openCase`, `getBatchDocs`, `getTotalBatches`, `isBatchComplete`, `getBatchProgress`, `renderBatchSelector`, `switchBatch`, `getBatchVisibleDocs`, `checkBatchCompletion`, `relBatchDocs`, `updateRelProgress` and `relResetAll`;
  - edit `completeBatchAndNext`, `showRelResults` and `applyProgressData`.

**Interfaces:**
- Produces:

  | Name | What it is |
  |---|---|
  | `REL_MATTERS` | object keyed by matter ID |
  | `relExtract` | `{entries:{}, batch:{currentBatch, unlockedBatches}}` |
  | `relMatter()` | the open matter |
  | `relIsExtraction()` | bool |
  | `relStore()` | the map whose keys mark a document done |
  | `relBatchState()` | object |
  | `relBatchSize()` | number |

- Later tasks define `relApplyMatterChrome()`, `cirUpdateProgress()` and `cirDrafts`. This task uses them only when they exist.

- [ ] **Step 1: Run the QuantumEdge check before changing anything**

This check is repeated after this task, after Task 6 and in Task 11. In the browser:

```js
document.getElementById('login-wall').style.display = 'none';
const wait = ms => new Promise(r => setTimeout(r, ms));
openAICase(); await wait(500);
const rows = document.querySelectorAll('#rel-doc-scroll .rel-doc-row').length;
const cols = [...document.getElementById('rel-body').children].map(c => c.id);
const batches = document.querySelectorAll('#rel-batch-selector .batch-item').length;
const mismatches = [];
for (const item of [...document.querySelectorAll('#rel-sidebar .rel-sidebar-item')].filter(e => e.offsetParent !== null && e.querySelector('.rel-count'))) {
  const n = +item.querySelector('.rel-count').textContent;
  item.click(); await wait(40);
  const listed = document.querySelectorAll('#rel-doc-scroll .rel-doc-row').length;
  if (n !== listed) mismatches.push(item.textContent.trim() + ': ' + n + ' vs ' + listed);
}
relSidebarFilter('all', null);
const doc = relGetVisible().find(d => d.answer.responsive === 'responsive' && d.answer.privilege === 'not-privileged');
relOpenDoc(doc.id);
relCodingState = { responsive: doc.answer.responsive, privilege: doc.answer.privilege, action: doc.answer.action, conf: doc.answer.conf, issues: doc.answer.issues.slice() };
relSubmitCoding(); await wait(200);
const graded = relAnswered[doc.id].score + '/' + relAnswered[doc.id].total;
relCoding['JB-0001'] = { responsive: 'responsive' };                       // a stale key from a removed matter
relAnswered['JB-0001'] = { correct: false, partial: false, score: 0, total: 5 };
updateRelProgress();
const accuracy = document.getElementById('rel-accuracy-disp').textContent;
clearTimeout(_progressSaveTimer);
document.querySelectorAll('.rel-feedback-overlay').forEach(o => o.remove());
delete relCoding[doc.id]; delete relAnswered[doc.id]; delete relCoding['JB-0001']; delete relAnswered['JB-0001'];
updateRelProgress(); relRenderList();
JSON.stringify({ rows, cols, batches, mismatches, panelShown: getComputedStyle(document.getElementById('rel-coding-panel')).display !== 'none', graded, accuracy })
```

Expected before this task:
- `rows: 50`, `cols: ["rel-sidebar","rel-doc-list","rel-viewer"]`, `batches: 10`, `mismatches: []`, `panelShown: true`, `graded: "5/5"`;
- `accuracy: "50%"`. That is the fault: the stale key's wrong answer is counted.

- [ ] **Step 2: Add the registry and accessors**

Insert immediately before `function openCase(caseNum) {`:

```js
// Every matter the Relativity shell can open. docs is a function because the
// document arrays are declared further down the file; reading them here, at
// load, would find them undefined.
var REL_MATTERS = {
  4: { id: 4, key: 'quantumedge', mode: 'coding', batchSize: 50,
       caseLabel: 'SEC v. QuantumEdge AI', batchLabel: 'Flash Crash Matter',
       docs: function () { return P4_DOCS; } },
  5: { id: 5, key: 'larkspur', mode: 'extraction', batchSize: 25,
       caseLabel: 'Larkspur Benefit Services', batchLabel: 'Cyber Incident Response',
       docs: function () { return (typeof CIR_DOCS !== 'undefined') ? CIR_DOCS : []; } }
};

// Extraction progress lives apart from relCoding/relAnswered: the Relativity
// counters were written for one matter and counted every key in those objects.
var relExtract = { entries: {}, batch: { currentBatch: 0, unlockedBatches: [0] } };

function relMatter() { return REL_MATTERS[ACTIVE_CASE] || REL_MATTERS[4]; }
function relIsExtraction() { return relMatter().mode === 'extraction'; }
function relStore() { return relIsExtraction() ? relExtract.entries : relCoding; }
function relBatchState() { return relIsExtraction() ? relExtract.batch : batchState.rel; }
function relBatchSize() { return relMatter().batchSize; }
```

- [ ] **Step 3: Replace `openCase` in full**

```js
function openCase(caseNum) {
  ACTIVE_CASE = REL_MATTERS[caseNum] ? caseNum : 4;
  var m = relMatter();
  ACTIVE_DOCS = m.docs();
  var el = document.getElementById('rel-toolbar-case-label');
  if (el) el.textContent = m.caseLabel;
  el = document.getElementById('rel-toolbar-batch-label');
  if (el) el.textContent = m.batchLabel;
  el = document.getElementById('proj-landing');
  if (el) el.style.display = 'none';
  var shell = document.getElementById('rel-shell');
  shell.style.display = 'flex';
  shell.style.position = 'fixed';
  shell.style.inset = '0';
  shell.style.zIndex = '500';
  // NEVER reset relCoding/relAnswered/relExtract: those are persistent progress.
  // Only reset the current session's navigation and form state.
  relCodingState = {};
  relCurrentDoc = null; relCurrentIdx = -1;
  relFilter = 'all'; relSearchQ = '';
  if (typeof rdxState !== 'undefined') rdxState.marks = {};
  if (typeof relApplyMatterChrome === 'function') relApplyMatterChrome();
  updateSidebarForCase(caseNum);
  renderRelCustodians();
  relRenderList();
  updateRelProgress();
}
```

- [ ] **Step 4: Give the batch helpers a size, and route `'rel'` through the accessors**

Replace these functions in full:

```js
function getBatchDocs(docs, batchIdx, size) {
  size = size || BATCH_SIZE;
  return docs.slice(batchIdx * size, (batchIdx + 1) * size);
}

function getTotalBatches(docs, size) {
  return Math.ceil(docs.length / (size || BATCH_SIZE));
}

function isBatchComplete(docs, batchIdx, coding, size) {
  var batchDocs = getBatchDocs(docs, batchIdx, size);
  return batchDocs.length > 0 && batchDocs.every(function(d) { return !!coding[d.id]; });
}

function getBatchProgress(docs, batchIdx, coding, size) {
  var batchDocs = getBatchDocs(docs, batchIdx, size);
  var coded = batchDocs.filter(function(d) { return !!coding[d.id]; }).length;
  return { coded: coded, total: batchDocs.length };
}

function renderBatchSelector(platform) {
  // platform: 'rel' or 'ev'
  var isRel = platform === 'rel';
  var containerId = isRel ? 'rel-batch-selector' : 'ev-batch-selector';
  var container = document.getElementById(containerId);
  if (!container) return;
  var docs = isRel ? ACTIVE_DOCS : P3_DOCS;
  var coding = isRel ? relStore() : evCoding;
  var state = isRel ? relBatchState() : batchState.ev;
  var size = isRel ? relBatchSize() : BATCH_SIZE;
  var totalBatches = getTotalBatches(docs, size);

  var html = '<div class="batch-selector-title">📦 Batches</div><div class="batch-list">';
  for (var i = 0; i < totalBatches; i++) {
    var prog = getBatchProgress(docs, i, coding, size);
    var isUnlocked = state.unlockedBatches.indexOf(i) > -1;
    var isActive = state.currentBatch === i;
    var isComplete = isBatchComplete(docs, i, coding, size);
    var cls = 'batch-item' + (isActive ? ' active' : '') + (isComplete ? ' completed' : '') + (!isUnlocked ? ' locked' : '');
    var icon = isComplete ? '✅' : (!isUnlocked ? '🔒' : (isActive ? '📂' : '📁'));
    var startDoc = i * size + 1;
    var endDoc = Math.min((i + 1) * size, docs.length);
    var batchLabel = 'Batch ' + (i + 1) + ' (Docs ' + startDoc + '–' + endDoc + ')';
    var progressLabel = prog.coded + '/' + prog.total;
    var onclick = isUnlocked ? 'onclick="switchBatch(\'' + platform + '\',' + i + ')"' : '';
    html += '<div class="' + cls + '" ' + onclick + '>'
      + '<span class="batch-icon">' + icon + '</span>'
      + '<span class="batch-label">' + batchLabel + '</span>'
      + '<span class="batch-progress">' + progressLabel + '</span>'
      + '</div>';
  }
  html += '</div>';
  container.innerHTML = html;
}

function switchBatch(platform, batchIdx) {
  var state = platform === 'rel' ? relBatchState() : batchState[platform];
  if (state.unlockedBatches.indexOf(batchIdx) === -1) return;
  state.currentBatch = batchIdx;
  if (platform === 'rel') {
    relFilter = 'all'; relSearchQ = '';
    relCurrentDoc = null; relCurrentIdx = -1;
    relRenderList();
    renderBatchSelector('rel');
    checkBatchCompletion('rel');
  } else {
    evFilterMode = 'all';
    evCurrentDoc = null; evCurrentIdx = -1;
    evRenderList();
    renderBatchSelector('ev');
    checkBatchCompletion('ev');
  }
}

function getBatchVisibleDocs(platform) {
  if (platform === 'rel') {
    var store = relStore();
    return getBatchDocs(ACTIVE_DOCS, relBatchState().currentBatch, relBatchSize()).filter(function(d) {
      if (relSearchQ) {
        var q = relSearchQ.toLowerCase();
        return (d.subject + d.body + d.from + d.id).toLowerCase().includes(q);
      }
      if (relFilter === 'uncoded') return !store[d.id];
      if (relFilter === 'coded') return !!store[d.id];
      return relMatchesSidebar(d, relFilter);
    });
  }
  return getBatchDocs(P3_DOCS, batchState.ev.currentBatch).filter(function(d) {
    if (evFilterMode === 'uncoded') return !evCoding[d.id];
    if (evFilterMode === 'coded') return !!evCoding[d.id];
    return true;
  });
}

function checkBatchCompletion(platform) {
  var isRel = platform === 'rel';
  var state = isRel ? relBatchState() : batchState.ev;
  var docs = isRel ? ACTIVE_DOCS : P3_DOCS;
  var coding = isRel ? relStore() : evCoding;
  var size = isRel ? relBatchSize() : BATCH_SIZE;
  var isComplete = isBatchComplete(docs, state.currentBatch, coding, size);
  var banner = document.getElementById(isRel ? 'rel-batch-banner' : 'ev-batch-banner');
  if (!banner) return;
  var hasNext = state.currentBatch < getTotalBatches(docs, size) - 1;
  if (isComplete && hasNext) {
    banner.classList.add('visible');
    banner.querySelector('.batch-next-num').textContent = state.currentBatch + 2;
  } else {
    banner.classList.remove('visible');
  }
}

function relBatchDocs() {
  return getBatchDocs(ACTIVE_DOCS || [], relBatchState().currentBatch || 0, relBatchSize());
}
```

In `completeBatchAndNext(platform)`, change only its first four lines from:

```js
  var state = batchState[platform];
  var docs = platform === 'rel' ? ACTIVE_DOCS : P3_DOCS;
  var nextBatch = state.currentBatch + 1;
  if (nextBatch >= getTotalBatches(docs)) return;
```

to:

```js
  var state = platform === 'rel' ? relBatchState() : batchState[platform];
  var docs = platform === 'rel' ? ACTIVE_DOCS : P3_DOCS;
  var nextBatch = state.currentBatch + 1;
  if (nextBatch >= getTotalBatches(docs, platform === 'rel' ? relBatchSize() : BATCH_SIZE)) return;
```

- [ ] **Step 5: Scope the counters and Reset to the open matter**

Replace `updateRelProgress` in full:

```js
// Counts only the open matter's documents. relCoding and relAnswered can hold
// other matters' keys, stale ones included, and counting every key blended them
// into one figure.
function updateRelProgress(){
  if (relIsExtraction()) { if (typeof cirUpdateProgress === 'function') cirUpdateProgress(); return; }
  var total = ACTIVE_DOCS.length;
  var coded = ACTIVE_DOCS.filter(function(d){ return !!relCoding[d.id]; }).length;
  var pct = total ? Math.round(coded / total * 100) : 0;
  document.getElementById("rel-prog-pct").textContent = pct + "%";
  document.getElementById("rel-prog-fill").style.width = pct + "%";
  var answers = ACTIVE_DOCS.map(function(d){ return relAnswered[d.id]; }).filter(Boolean);
  var correct = answers.filter(function(a){ return a.correct; }).length;
  document.getElementById("rel-accuracy-disp").textContent =
    answers.length ? Math.round(correct / answers.length * 100) + "%" : "—";
}
```

Replace `relResetAll` in full:

```js
// Resets only the open matter. It used to wipe every key in relCoding, so
// pressing it inside Larkspur would have erased QuantumEdge work. It saves, so
// a reload no longer brings the reset work back.
function relResetAll(){
  var m = relMatter();
  if(!confirm("Reset all your work on " + m.caseLabel + "? This cannot be undone."))return;
  if (relIsExtraction()) {
    relExtract = { entries: {}, batch: { currentBatch: 0, unlockedBatches: [0] } };
    if (typeof cirDrafts !== 'undefined') cirDrafts = {};
    var drawer = document.getElementById('cir-drawer');
    if (drawer) drawer.style.display = 'none';
  } else {
    ACTIVE_DOCS.forEach(function(d){ delete relCoding[d.id]; delete relAnswered[d.id]; });
  }
  relCodingState={};relCurrentDoc=null;relCurrentIdx=-1;
  document.getElementById("rel-doc-content").innerHTML="<div style=\"text-align:center;padding:60px 20px;color:var(--muted)\"><div style=\"font-size:3rem;margin-bottom:14px\">📂</div><div style=\"font-size:1rem;font-weight:600;color:var(--text2);margin-bottom:8px\">No Document Selected</div><div style=\"font-size:.84rem\">Select a document from the list to begin.</div></div>";
  document.getElementById("rel-doc-title").textContent="Select a document to begin review";
  document.getElementById("rel-panel-doc-id").textContent="No document loaded";
  relRenderList();updateRelProgress();
  triggerAutoSave();
}
```

In `showRelResults`, change its first three lines from:

```js
  var coded=Object.keys(relCoding).length;
  var correct=Object.values(relAnswered).filter(function(a){return a.correct;}).length;
  var attempted=Object.keys(relAnswered).length;
```

to:

```js
  var coded=ACTIVE_DOCS.filter(function(d){return !!relCoding[d.id];}).length;
  var answers=ACTIVE_DOCS.map(function(d){return relAnswered[d.id];}).filter(Boolean);
  var correct=answers.filter(function(a){return a.correct;}).length;
  var attempted=answers.length;
```

- [ ] **Step 6: Stop restoring `ACTIVE_CASE` from saved progress**

In the original `function applyProgressData(d) {`, replace the line

```js
  if (d.active_case) ACTIVE_CASE = d.active_case;
```

with

```js
  // ACTIVE_CASE is not restored: openCase() sets it together with ACTIVE_DOCS.
  // Restoring it alone could put the shell in Larkspur's mode while
  // QuantumEdge's documents are loaded. Nothing else read the restored value.
```

- [ ] **Step 7: Parse check and tests**

```bash
cd ~/Documents/aa-mastery
node --test 2>&1 | grep -E "^# (tests|pass|fail)"
python3 - <<'PY'
import re, io, subprocess, tempfile
h = io.open('index.html', encoding='utf-8').read()
js = '\n;\n'.join(re.findall(r'<script(?![^>]*\bsrc=)[^>]*>(.*?)</script>', h, re.S))
with tempfile.NamedTemporaryFile('w', suffix='.js', delete=False) as f:
    f.write(js)
r = subprocess.run(['node', '--check', f.name], capture_output=True, text=True)
print('PARSE', 'OK' if r.returncode == 0 else 'FAIL\n' + r.stderr[:800])
PY
```

Expected: `# pass 164`, `# fail 0`, `PARSE OK`.

- [ ] **Step 8: Verify QuantumEdge**

Reload the page, then run the Step 1 snippet again. Expected: identical to Step 1, except `accuracy: "100%"`. The stale key no longer counts.

- [ ] **Step 9: Commit**

```bash
git add index.html
git commit -m "Let the Relativity shell hold more than one matter

openCase was hardwired to QuantumEdge. A small registry now declares
each matter's documents, labels, batch size and mode, and accessors
route batches, the coded/uncoded filters, the counters and Reset to the
open matter. Larkspur is registered as matter 5 but is not reachable yet.

Faults fixed on the way, each harmless with one matter but wrong with
two: the progress and accuracy counters counted every key in relCoding
and relAnswered, including stale keys from removed matters; batch size
was a single global; Reset wiped all of relCoding, which inside a second
matter would have erased QuantumEdge's work, and never saved, so a
reload undid it; and saved progress restored ACTIVE_CASE without the
documents that go with it. QuantumEdge renders and grades as before.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Open Larkspur and read its documents

**Files:**
- Modify: `index.html`: script tags; the Larkspur card; `REVIEW_LIBRARY`; a new block before `function openCase`; `renderDocContent`; `relRenderList`; `relMatchesSidebar`; `updateRelSearchCounts`; CSS
- Modify: `vercel.json`

**Interfaces:**
- Consumes: Task 5's accessors; `CIR_DOCS`; `esc(s)`; `switchCodingMode(mode)`; `relSidebarFilter(mode, el)`.
- Produces: `openLarkspurCase()`, `CIR_KIND_LABELS`, `CIR_SEARCHES`, `cirIsDoc(doc)`, `cirRenderDoc(doc)`, `relSetShown(el, shown)`, `relApplyMatterChrome()`, `cirEnsureKindsBox()`, `cirRenderKinds(docs)`.

- [ ] **Step 1: Load the engine and the documents**

In `<head>`, directly after `<script src="/qc-engine.js"></script>`, add:

```html
<script src="/extraction-engine.js" defer></script>
<script src="/cir-docs.js" defer></script>
```

`defer` is safe: nothing touches `EX` or `CIR_DOCS` until a reviewer opens the matter.

In `vercel.json`, change the catch-all `source` to:

```json
      "source": "/((?!og-image\\.png$|qc-engine\\.js$|extraction-engine\\.js$|cir-docs\\.js$|accent-trainer|wellness|tactical|protocols/).*)",
```

- [ ] **Step 2: Add the library card**

Insert this block immediately before the line `  <!-- PROJECT 4: AI -->`. `reviewMoveCards()` places cards in `REVIEW_LIBRARY` order, so where the markup sits does not matter.

```html
  <!-- PROJECT 5: LARKSPUR (Cyber Incident Response, PII/PHI extraction) -->
  <div class="card proj-case-card" onclick="openLarkspurCase()" style="border-color:#1f6f8b;margin-bottom:14px;">
    <div style="display:inline-flex;align-items:center;gap:6px;padding:3px 12px;border-radius:14px;font-size:.71rem;font-weight:700;margin-bottom:8px;background:rgba(31,111,139,.18);color:#4fc3f7;border:1px solid #1f6f8b">🛡️ Cyber Incident Response · PII/PHI Extraction · Relativity Platform</div>
    <div style="font-size:1.05rem;font-weight:800;color:var(--text);margin-bottom:4px">🏥 Larkspur Benefit Services: Ransomware Data Incident</div>
    <div style="font-size:.8rem;color:var(--text2);margin-bottom:10px">Mine the stolen file share. Record every affected person and every exposed data element, for HIPAA and state breach notification.</div>
    <div style="font-size:.78rem;color:var(--muted)">🖥️ Runs on <strong style="color:#4fc3f7">Relativity</strong> · 150 documents · 15 docs/hour target · spreadsheet extraction</div>
    <div style="margin-top:12px;text-align:right"><span class="btn btn-sm" style="background:#1f6f8b;color:#fff;border-color:#1f6f8b">Open in Relativity →</span></div>
  </div>
```

In `REVIEW_LIBRARY`, change `  relativity: ['openAICase'],` to `  relativity: ['openAICase', 'openLarkspurCase'],`.

Leave `REVIEW_CARD_QCKEY` alone. It labels cards "First-pass review", which this matter is not.

- [ ] **Step 3: Add the Larkspur viewer, sidebar and chrome**

Insert immediately before `function openCase(caseNum) {`:

```js
// ── Cyber Incident Response (Larkspur, matter 5) ─────────────────────────────
var CIR_KIND_LABELS = { roster: 'roster', claim: 'claim', 'visit-note': 'visit note', w2: 'W-2',
  'direct-deposit': 'deposit', i9: 'I-9', email: 'email', policy: 'policy', 'it-ticket': 'IT ticket',
  marketing: 'marketing', 'meeting-notes': 'notes' };

var CIR_SEARCHES = [
  { mode: 'all', label: 'All Documents', icon: '📂' },
  { mode: 'kind:roster', label: 'Rosters', icon: '📋', types: ['roster'] },
  { mode: 'kind:claims', label: 'Claims', icon: '🧾', types: ['claim'] },
  { mode: 'kind:medical', label: 'Medical', icon: '🩺', types: ['visit-note'] },
  { mode: 'kind:hr', label: 'HR', icon: '🗂️', types: ['w2', 'direct-deposit', 'i9'] },
  { mode: 'kind:email', label: 'Email', icon: '✉️', types: ['email'] },
  { mode: 'kind:other', label: 'Other', icon: '📄', types: ['policy', 'it-ticket', 'marketing', 'meeting-notes'] }
];

// Opens straight onto the first document not yet submitted, so the drawer is
// ready to type into.
function openLarkspurCase() {
  openCase(5);
  var docs = relGetVisible();
  var next = docs.filter(function (d) { return !relExtract.entries[d.id]; })[0] || docs[0];
  if (next) relOpenDoc(next.id);
}

function cirIsDoc(doc) { return !!(doc && doc.answer && Array.isArray(doc.answer.people)); }

function cirRenderDoc(doc) {
  var el = document.getElementById('rel-doc-content');
  var h = '<div class="cir-doc"><div class="cir-doc-head"><span class="cir-kind">' +
    esc(CIR_KIND_LABELS[doc.type] || doc.type) + '</span><span class="cir-date">' + esc(doc.date) + '</span>' +
    '<span class="cir-fiction">Training matter: fictional people and data</span></div>';
  if (doc.email) {
    var e = doc.email;
    h += '<div class="rel-email-header">' +
      '<div class="rel-email-header-row"><span class="rel-email-header-label">From:</span><span class="rel-email-header-val">' + esc(e.from) + '</span></div>' +
      '<div class="rel-email-header-row"><span class="rel-email-header-label">To:</span><span class="rel-email-header-val">' + esc(e.to) + '</span></div>' +
      '<div class="rel-email-header-row"><span class="rel-email-header-label">Subject:</span><span class="rel-email-header-val" style="font-weight:700;color:var(--text)">' + esc(e.subject) + '</span></div>' +
      '</div><div class="rel-email-body">' + esc(e.body) + '</div>';
  } else if (doc.table) {
    var t = doc.table;
    h += '<div class="cir-caption">' + esc(t.caption) + '</div><table class="cir-table"><thead><tr>' +
      t.columns.map(function (c) { return '<th>' + esc(c) + '</th>'; }).join('') + '</tr></thead><tbody>';
    t.rows.forEach(function (r, i) {
      if (t.pageBreakBefore === i) h += '<tr class="cir-pagebreak"><td colspan="' + t.columns.length + '">Page 2</td></tr>';
      h += '<tr>' + r.map(function (c) { return '<td>' + esc(c) + '</td>'; }).join('') + '</tr>';
    });
    h += '</tbody></table>';
  } else if (doc.form) {
    h += '<div class="cir-form"><div class="cir-form-h">' + esc(doc.form.heading) + '</div>';
    doc.form.sections.forEach(function (s) {
      h += '<div class="cir-form-sec"><div class="cir-form-label">' + esc(s.label) + '</div>' +
        s.fields.map(function (f) { return '<div class="cir-field"><span>' + esc(f[0]) + '</span><b>' + esc(f[1]) + '</b></div>'; }).join('') +
        '</div>';
    });
    h += '</div>';
  } else {
    h += '<div class="rel-email-body">' + esc(doc.text || doc.body) + '</div>';
  }
  el.innerHTML = h + '</div>';
}

// Show or hide an element that belongs to one mode, remembering its previous
// inline display so leaving Larkspur restores QuantumEdge exactly as it was.
function relSetShown(el, shown) {
  if (!el) return;
  if (!shown) {
    if (el.dataset.relPrev === undefined) el.dataset.relPrev = el.style.display;
    el.style.display = 'none';
  } else if (el.dataset.relPrev !== undefined) {
    el.style.display = el.dataset.relPrev;
    delete el.dataset.relPrev;
  }
}

function relApplyMatterChrome() {
  var x = relIsExtraction();
  var shell = document.getElementById('rel-shell');
  // Back to standard coding first, so redaction or PLOG mode is not left half
  // on, and so what gets remembered below is the standard layout.
  if (x && typeof switchCodingMode === 'function') switchCodingMode('standard');
  shell.classList.toggle('cir-mode', x);
  ['rel-coding-panel', 'coding-mode-switcher', 'inline-rdx-panel', 'inline-plog-panel',
   'drag-rdx-hint', 'rel-filter-bar'].forEach(function (id) {
    relSetShown(document.getElementById(id), !x);
  });
  document.querySelectorAll('#rel-toolbar [onclick="openPlogViewer()"], #rel-toolbar [onclick="showRelResults()"]')
    .forEach(function (b) { relSetShown(b, !x); });
  var issues = document.getElementById('rel-sidebar-issues');
  relSetShown(issues && issues.closest('.rel-sidebar-section'), !x);
  var kinds = document.getElementById('rel-sidebar-kinds');
  if (kinds) kinds.style.display = x ? '' : 'none';
  var extra = document.getElementById('cir-progress-extra');
  if (extra) extra.style.display = x ? '' : 'none';
  var drawer = document.getElementById('cir-drawer');
  if (drawer) drawer.style.display = 'none';   // shown again when a document opens
  if (!x) shell.classList.remove('cir-collapsed');
}

function cirEnsureKindsBox() {
  var box = document.getElementById('rel-sidebar-kinds');
  if (box) return box;
  var anchor = document.getElementById('sc-chat');
  var last = anchor && anchor.closest('.rel-sidebar-item');
  if (!last) return null;
  box = document.createElement('div');
  box.id = 'rel-sidebar-kinds';
  last.parentNode.insertBefore(box, last.nextSibling);
  return box;
}

function cirRenderKinds(docs) {
  var box = cirEnsureKindsBox();
  if (!box) return;
  box.innerHTML = '';
  CIR_SEARCHES.forEach(function (s) {
    var n = docs.filter(function (d) { return relMatchesSidebar(d, s.mode); }).length;
    if (!n && s.mode !== 'all') return;
    var div = document.createElement('div');
    div.className = 'rel-sidebar-item' + (relFilter === s.mode ? ' active' : '');
    div.innerHTML = '<span>' + s.icon + ' ' + esc(s.label) + '</span><span class="rel-count">' + n + '</span>';
    div.onclick = (function (mode) { return function () { relSidebarFilter(mode, this); }; })(s.mode);
    box.appendChild(div);
  });
}
```

- [ ] **Step 4: Hook up the viewer, the list badge and the sidebar**

Make each of these edits:

**`renderDocContent`:** at the very start of `function renderDocContent(doc){`, add as the first line:

```js
  if (cirIsDoc(doc)) { cirRenderDoc(doc); return; }
```

**`relRenderList`:** change

```js
  var typeLabels={email:"email",attachment:"attachment",memo:"memo",contract:"contract",chat:"chat"};
```

to

```js
  var typeLabels=Object.assign({email:"email",attachment:"attachment",memo:"memo",contract:"contract",chat:"chat"},CIR_KIND_LABELS);
```

**`relMatchesSidebar(d, mode)`:** directly after the line `  if (!mode || mode === 'all') return true;`, add:

```js
  if (/^kind:/.test(mode)) {
    var kind = CIR_SEARCHES.filter(function (s) { return s.mode === mode; })[0];
    return !!kind && kind.types.indexOf(d.type) !== -1;
  }
```

**`updateRelSearchCounts()`:** directly after the line `  var docs = relBatchDocs();`, insert:

```js
  // Larkspur lists document kinds instead of Relativity's saved searches, and
  // has no issues: extraction does not code them.
  if (relIsExtraction()) {
    ['all', 'email', 'attachment', 'memo', 'contract', 'chat'].forEach(function (mode) {
      var el = document.getElementById('sc-' + mode);
      var row = el && el.closest('.rel-sidebar-item');
      if (row) row.style.display = 'none';
    });
    cirRenderKinds(docs);
    renderRelCustodians(docs);
    return;
  }
  var kindsBox = document.getElementById('rel-sidebar-kinds');
  if (kindsBox) kindsBox.innerHTML = '';
  var allCount = document.getElementById('sc-all');
  var allRow = allCount && allCount.closest('.rel-sidebar-item');
  if (allRow) allRow.style.display = '';
```

- [ ] **Step 5: Style the Larkspur documents**

Insert immediately before the line beginning `.rv-proto{`:

```css
#rel-shell.cir-mode .rel-doc-type-badge{background:#123040;color:#80deea;border:1px solid #1f6f8b}
.cir-doc{padding:14px 18px 22px;font-size:.84rem;color:var(--text2)}
.cir-doc-head{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:10px}
.cir-kind{font-size:.68rem;font-weight:800;letter-spacing:.06em;text-transform:uppercase;color:#80deea;background:#123040;border:1px solid #1f6f8b;border-radius:999px;padding:2px 9px}
.cir-date{color:var(--muted);font-size:.76rem}
.cir-fiction{margin-left:auto;color:var(--muted);font-size:.7rem;font-style:italic}
.cir-caption{font-weight:700;color:var(--text);margin-bottom:8px}
table.cir-table{border-collapse:collapse;width:100%;font-size:.76rem}
table.cir-table th{background:#16203a;color:#9fb0c9;text-align:left;padding:5px 6px;font-weight:700;white-space:nowrap}
table.cir-table td{border-top:1px solid #1c2740;padding:4px 6px;color:#dce6f5;white-space:nowrap}
tr.cir-pagebreak td{background:#0b1220;color:var(--muted);text-align:center;font-size:.7rem;letter-spacing:.2em;text-transform:uppercase;border-top:2px dashed #2a3550;border-bottom:2px dashed #2a3550;padding:7px}
.cir-form-h{font-weight:800;color:var(--text);font-size:.95rem;margin-bottom:10px}
.cir-form-sec{background:#0f1726;border:1px solid #1c2740;border-radius:8px;padding:8px 10px;margin-bottom:8px}
.cir-form-label{color:var(--gold-light);font-size:.7rem;font-weight:700;letter-spacing:.06em;text-transform:uppercase;margin-bottom:5px}
.cir-field{display:flex;gap:10px;padding:2px 0}
.cir-field span{flex:0 0 42%;color:var(--muted)}
.cir-field b{color:#dce6f5;font-weight:600}
```

- [ ] **Step 6: Parse check, tests and markup balance**

```bash
cd ~/Documents/aa-mastery
node --test 2>&1 | grep -E "^# (tests|pass|fail)"
python3 - <<'PY'
import re, io, subprocess, tempfile
h = io.open('index.html', encoding='utf-8').read()
js = '\n;\n'.join(re.findall(r'<script(?![^>]*\bsrc=)[^>]*>(.*?)</script>', h, re.S))
with tempfile.NamedTemporaryFile('w', suffix='.js', delete=False) as f:
    f.write(js)
r = subprocess.run(['node', '--check', f.name], capture_output=True, text=True)
print('PARSE', 'OK' if r.returncode == 0 else 'FAIL\n' + r.stderr[:800])
body = re.sub(r'<script\b.*?</script>', '', h[h.index('<body'):h.rindex('</body>')], flags=re.S)
print('div balance:', len(re.findall(r'<div\b', body)) - len(re.findall(r'</div>', body)))
PY
```

Expected: `# pass 164`, `# fail 0`, `PARSE OK`, `div balance: -2`. It was already −2 on `main`, and the card must not change it.

- [ ] **Step 7: Verify in the browser**

```js
document.getElementById('login-wall').style.display = 'none';
const wait = ms => new Promise(r => setTimeout(r, ms));
openLarkspurCase(); await wait(500);
const rows = document.querySelectorAll('#rel-doc-scroll .rel-doc-row').length;
const kinds = [...document.querySelectorAll('#rel-sidebar-kinds .rel-sidebar-item')].map(e => ({ label: e.textContent.replace(/\d+$/, '').trim(), n: +e.querySelector('.rel-count').textContent }));
const mismatches = [];
for (const item of [...document.querySelectorAll('#rel-sidebar .rel-sidebar-item')].filter(e => e.offsetParent !== null && e.querySelector('.rel-count'))) {
  const n = +item.querySelector('.rel-count').textContent;
  item.click(); await wait(40);
  const listed = document.querySelectorAll('#rel-doc-scroll .rel-doc-row').length;
  if (n !== listed) mismatches.push(item.textContent.trim() + ': ' + n + ' vs ' + listed);
}
relSidebarFilter('all', null);
const roster = relGetVisible().find(d => d.table && d.table.pageBreakBefore !== null);
relOpenDoc(roster.id);
const pageBreak = !!document.querySelector('#rel-doc-content tr.cir-pagebreak');
relOpenDoc(relGetVisible().find(d => d.form).id);
const formShown = !!document.querySelector('#rel-doc-content .cir-form-sec');
JSON.stringify({ rows, batches: document.querySelectorAll('#rel-batch-selector .batch-item').length, kinds, mismatches, pageBreak, formShown,
  codingPanelHidden: document.getElementById('rel-coding-panel').style.display === 'none',
  filterBarHidden: document.getElementById('rel-filter-bar').style.display === 'none',
  issuesHidden: document.getElementById('rel-sidebar-issues').closest('.rel-sidebar-section').style.display === 'none' })
```

Expected:
- `rows: 25`, `batches: 6`;
- `kinds` starts with `All Documents` at 25, and the other kinds' counts add up to 25;
- `mismatches: []`, `pageBreak: true`, `formShown: true`;
- `codingPanelHidden`, `filterBarHidden` and `issuesHidden` all `true`.

Then run the QuantumEdge check from Task 5 Step 1 again. It opens QuantumEdge straight from Larkspur. Expected: the same result as Task 5 Step 8, including `panelShown: true`.

- [ ] **Step 8: Commit**

```bash
git add index.html vercel.json
git commit -m "Open Larkspur in Relativity and render its documents

A library card opens matter 5 at its first unsubmitted document. The
documents render as they would look: rosters as tables with the page
break marked, claims and tax forms as forms, emails as emails, each
labelled fictional. Saved searches become document kinds. The coding
panel, mode switcher, issue list, filter chips and coding-only toolbar
buttons step aside for this matter, and come back exactly as they were
for QuantumEdge.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: The extraction drawer: entering people

**Files:**
- Modify: `index.html`: a new block before `function openCase`; `relOpenDoc`; CSS

**Interfaces:**
- Consumes: `EX.validateEntry`, `EX.ELEMENTS`, `relExtract`, `relIsExtraction()`, `relNav(dir)`, `CIR_KIND_LABELS`, `escAttr`.
- Produces:
  - constants and state: `CIR_FIELDS`, `CIR_ELEMENT_COLS`, `cirDrafts`, `cirDraft`, `cirReviewing`, `cirCollapsed`;
  - drawer lifecycle: `cirBlankRow()`, `cirEnsureDrawer()` (returns the element), `cirOpenDoc(doc)`, `cirRender()`, `cirFocus()`;
  - rendering: `cirGridHead()` (returns HTML), `cirSummaryText(entry)` (returns a string), `cirRenderEntry()`, `cirRenderEntryHead()`;
  - input handlers: `cirSetField(input)`, `cirSetEl(checkbox)`, `cirAddRow(at)`, `cirDeleteRow(i)`, `cirToggleNoPii(checkbox)`, `cirToggleCollapse()`, `cirKeydown(event)`.
- Task 8 defines `cirSubmit()`, `cirNext()` and `cirRenderFeedback()`. This task calls them only if they exist.

- [ ] **Step 1: Add the drawer code**

Insert immediately before `function openCase(caseNum) {`:

```js
var CIR_FIELDS = [
  { k: 'first', label: 'First' }, { k: 'last', label: 'Last' },
  { k: 'dob', label: 'DOB', ph: 'MM/DD/YYYY' }, { k: 'street', label: 'Street' },
  { k: 'city', label: 'City' }, { k: 'state', label: 'St' }, { k: 'zip', label: 'ZIP' }
];
var CIR_ELEMENT_COLS = [
  { k: 'ssn', label: 'SSN', g: 'pii', title: 'Social Security number' },
  { k: 'dl', label: 'DL', g: 'pii', title: "Driver's license / state ID" },
  { k: 'passport', label: 'Pass', g: 'pii', title: 'Passport' },
  { k: 'fin', label: 'Fin', g: 'pii', title: 'Financial account' },
  { k: 'card', label: 'Card', g: 'pii', title: 'Payment card' },
  { k: 'login', label: 'Login', g: 'pii', title: 'Login credentials' },
  { k: 'bio', label: 'Bio', g: 'pii', title: 'Biometric' },
  { k: 'mrn', label: 'MRN', g: 'phi', title: 'Medical record number' },
  { k: 'plan', label: 'Plan', g: 'phi', title: 'Health plan / member ID' },
  { k: 'med', label: 'Med', g: 'phi', title: 'Medical info: diagnosis, treatment, medication' }
];
var cirDrafts = {};        // docId -> unsubmitted entry, kept for this session
var cirDraft = null;       // the open document's draft
var cirReviewing = false;  // showing a submitted document's feedback
var cirCollapsed = false;

function cirBlankRow() {
  var el = {};
  EX.ELEMENTS.forEach(function (k) { el[k] = false; });
  return { first: '', last: '', dob: '', street: '', city: '', state: '', zip: '', el: el };
}

// Built from JavaScript rather than markup, directly after #rel-body.
function cirEnsureDrawer() {
  var d = document.getElementById('cir-drawer');
  if (d) return d;
  d = document.createElement('div');
  d.id = 'cir-drawer';
  d.innerHTML = '<div id="cir-drawer-head"></div><div id="cir-drawer-hint"></div><div id="cir-drawer-body"></div>';
  var body = document.getElementById('rel-body');
  body.parentNode.insertBefore(d, body.nextSibling);
  return d;
}

function cirOpenDoc(doc) {
  cirEnsureDrawer().style.display = '';
  if (relExtract.entries[doc.id]) {
    cirReviewing = true; cirDraft = null;
  } else {
    cirReviewing = false;
    cirDraft = cirDrafts[doc.id] || (cirDrafts[doc.id] = { docId: doc.id, noPii: false, rows: [cirBlankRow()] });
  }
  cirRender();
  cirFocus();
}

function cirRender() {
  if (!relCurrentDoc || !relIsExtraction()) return;
  if (cirReviewing && typeof cirRenderFeedback === 'function') cirRenderFeedback();
  else cirRenderEntry();
}

// The cursor goes where the next keystroke belongs: the first name cell when
// entering, the main button when reviewing.
function cirFocus() {
  var el = cirReviewing
    ? document.getElementById('cir-next')
    : document.querySelector('#cir-drawer-body input.cir-in[data-f="first"]');
  if (el) el.focus({ preventScroll: true });
}

function cirGridHead() {
  return '<thead><tr>' +
    CIR_FIELDS.map(function (f) { return '<th class="cir-f-' + f.k + '">' + f.label + '</th>'; }).join('') +
    CIR_ELEMENT_COLS.map(function (e) { return '<th class="cir-el ' + e.g + '" title="' + escAttr(e.title) + '">' + e.label + '</th>'; }).join('') +
    '<th class="cir-del"></th></tr></thead>';
}

function cirSummaryText(entry) {
  if (entry && entry.noPii) return 'No PII/PHI';
  var v = EX.validateEntry(entry || { rows: [] });
  var n = v.rows.length, tally = {};
  v.rows.forEach(function (r) { EX.ELEMENTS.forEach(function (k) { if (r.el[k]) tally[k] = (tally[k] || 0) + 1; }); });
  var parts = [n + ' individual' + (n === 1 ? '' : 's')];
  CIR_ELEMENT_COLS.forEach(function (e) { if (tally[e.k]) parts.push(tally[e.k] + ' ' + e.label); });
  return parts.join(' · ');
}

function cirRenderEntry() {
  cirEnsureDrawer();
  document.getElementById('rel-shell').classList.toggle('cir-collapsed', cirCollapsed);
  cirRenderEntryHead();
  var body = document.getElementById('cir-drawer-body');
  if (cirCollapsed) { body.innerHTML = ''; return; }
  var h = '<table class="cir-grid">' + cirGridHead() + '<tbody>';
  cirDraft.rows.forEach(function (r, i) {
    h += '<tr>';
    CIR_FIELDS.forEach(function (f) {
      h += '<td class="cir-f-' + f.k + '"><input class="cir-in" data-r="' + i + '" data-f="' + f.k + '" value="' +
        escAttr(r[f.k]) + '"' + (f.ph ? ' placeholder="' + f.ph + '"' : '') + ' oninput="cirSetField(this)"></td>';
    });
    CIR_ELEMENT_COLS.forEach(function (e) {
      h += '<td class="cir-el ' + e.g + '"><input type="checkbox" class="cir-ck" data-r="' + i + '" data-e="' + e.k + '"' +
        (r.el[e.k] ? ' checked' : '') + ' title="' + escAttr(e.title) + '" onchange="cirSetEl(this)"></td>';
    });
    // tabindex -1: Tab skips it, so Enter after the last box can never delete a row.
    h += '<td class="cir-del"><button class="cir-x" tabindex="-1" title="Delete row" onclick="cirDeleteRow(' + i + ')">×</button></td></tr>';
  });
  h += '</tbody></table><button class="cir-add" onclick="cirAddRow()">+ Add person</button>';
  body.innerHTML = h;
}

// Only the head re-renders while typing, so the cursor never leaves its cell.
function cirRenderEntryHead() {
  var doc = relCurrentDoc, v = EX.validateEntry(cirDraft);
  document.getElementById('cir-drawer-head').innerHTML =
    '<span class="cir-docid">' + esc(doc.id) + ' · ' + esc(CIR_KIND_LABELS[doc.type] || doc.type) + '</span>' +
    '<span class="cir-count">' + (cirCollapsed ? esc(cirSummaryText(cirDraft)) : 'Affected individuals · ' + v.rows.length) + '</span>' +
    '<label class="cir-nopii"><input type="checkbox"' + (cirDraft.noPii ? ' checked' : '') + ' onchange="cirToggleNoPii(this)"> No PII/PHI in this document</label>' +
    '<span class="cir-spacer"></span>' +
    '<button class="cir-btn" onclick="relNav(-1)">← Previous</button>' +
    '<button class="cir-btn gold" id="cir-submit"' + (v.ok ? '' : ' disabled') + ' onclick="cirSubmit()" title="Ctrl+Enter">Submit</button>' +
    '<button class="cir-btn" onclick="cirToggleCollapse()" title="' + (cirCollapsed ? 'Expand' : 'Collapse') + '">' + (cirCollapsed ? '▴' : '▾') + '</button>';
  document.getElementById('cir-drawer-hint').textContent = (!v.ok && !cirCollapsed) ? v.problems[0].text : '';
}

function cirSetField(inp) { cirDraft.rows[+inp.dataset.r][inp.dataset.f] = inp.value; cirRenderEntryHead(); }
function cirSetEl(cb) { cirDraft.rows[+cb.dataset.r].el[cb.dataset.e] = cb.checked; cirRenderEntryHead(); }

function cirAddRow(at) {
  var i = (at === undefined) ? cirDraft.rows.length : at;
  cirDraft.rows.splice(i, 0, cirBlankRow());
  cirRenderEntry();
  var first = document.querySelector('#cir-drawer-body input.cir-in[data-r="' + i + '"][data-f="first"]');
  if (first) first.focus();
}

function cirDeleteRow(i) { cirDraft.rows.splice(i, 1); cirRenderEntry(); }
function cirToggleNoPii(cb) { cirDraft.noPii = cb.checked; cirRenderEntryHead(); }

function cirToggleCollapse() {
  cirCollapsed = !cirCollapsed;
  cirRender();
}

// Tab / Shift+Tab and Space are native. Enter on a row's last box adds a row.
// Ctrl+Enter submits, and on the feedback screen moves on.
function cirKeydown(e) {
  if (!relCurrentDoc) return;
  if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
    e.preventDefault();
    if (cirReviewing) { if (typeof cirNext === 'function') cirNext(); else relNav(1); }
    else if (typeof cirSubmit === 'function') cirSubmit();
    return;
  }
  var t = e.target;
  if (e.key === 'Enter' && !cirReviewing && t && t.dataset && t.dataset.e === 'med') {
    e.preventDefault();
    cirAddRow(+t.dataset.r + 1);
  }
}

// On the document rather than the drawer, so Ctrl+Enter works wherever focus
// is while Larkspur is open, including after a click in the document.
document.addEventListener('keydown', function (e) {
  var shell = document.getElementById('rel-shell');
  if (!shell || shell.style.display === 'none' || !relIsExtraction()) return;
  cirKeydown(e);
});
```

- [ ] **Step 2: Route document opening to the drawer**

At the end of `function relOpenDoc(id){`, just before its closing `}`, add:

```js
  if (relIsExtraction()) cirOpenDoc(doc);
```

- [ ] **Step 3: Style the drawer**

Insert immediately before the line beginning `.rv-proto{`:

```css
#cir-drawer{flex:0 0 50%;min-height:0;display:flex;flex-direction:column;background:#0e1420;border-top:2px solid var(--gold);box-shadow:0 -8px 20px rgba(0,0,0,.45)}
#rel-shell.cir-collapsed #cir-drawer{flex:0 0 auto}
#cir-drawer-head{display:flex;align-items:center;gap:10px;flex-wrap:wrap;padding:7px 12px;background:#111a28;border-bottom:1px solid var(--border)}
#cir-drawer-hint{color:#ffb74d;font-size:.74rem;padding:0 12px}
#cir-drawer-hint:empty{display:none}
#cir-drawer-body{flex:1;overflow:auto;min-height:0;padding:4px 8px 8px}
.cir-docid{color:var(--gold-light);font-weight:700;font-size:.82rem}
.cir-count{color:var(--text2);font-size:.8rem}
.cir-nopii{display:flex;align-items:center;gap:5px;color:var(--text2);font-size:.78rem;cursor:pointer}
.cir-spacer{flex:1}
.cir-btn{background:#131d30;border:1px solid #2a3550;color:#dce6f5;border-radius:6px;padding:4px 10px;font-size:.76rem;font-weight:700;cursor:pointer}
.cir-btn.gold{background:var(--gold);border-color:var(--gold);color:#12100a}
.cir-btn:disabled{opacity:.4;cursor:default}
table.cir-grid{width:100%;border-collapse:collapse;table-layout:fixed}
table.cir-grid th{background:#16203a;color:#8fa3bf;font-size:.66rem;font-weight:700;text-align:left;padding:4px 3px;white-space:nowrap;overflow:hidden}
table.cir-grid th.pii{color:#ff8a80}
table.cir-grid th.phi{color:#80cbc4}
table.cir-grid td{border-top:1px solid #1c2740;padding:2px 3px;vertical-align:middle}
.cir-f-first,.cir-f-last,.cir-f-city,.cir-f-dob{width:9%}
.cir-f-street{width:15%}
.cir-f-state{width:4%}
.cir-f-zip{width:6%}
table.cir-grid .cir-el{width:3.6%;text-align:center}
table.cir-grid .cir-del{width:2.4%;text-align:center}
.cir-in{width:100%;background:#0b1220;border:1px solid #1c2740;border-radius:4px;color:#dce6f5;padding:3px 5px;font:inherit;font-size:.74rem}
.cir-in:focus{outline:none;border-color:var(--gold)}
.cir-ck{width:14px;height:14px;accent-color:#d4a82a;cursor:pointer}
.cir-x{background:none;border:none;color:#6e8aaa;font-size:1rem;cursor:pointer;line-height:1}
.cir-x:hover{color:#ff8a80}
.cir-add{margin-top:6px;background:none;border:1px dashed #2a3550;color:var(--gold-light);border-radius:6px;padding:4px 12px;font-size:.76rem;font-weight:700;cursor:pointer}
```

- [ ] **Step 4: Parse check and tests**

```bash
cd ~/Documents/aa-mastery
node --test 2>&1 | grep -E "^# (tests|pass|fail)"
python3 - <<'PY'
import re, io, subprocess, tempfile
h = io.open('index.html', encoding='utf-8').read()
js = '\n;\n'.join(re.findall(r'<script(?![^>]*\bsrc=)[^>]*>(.*?)</script>', h, re.S))
with tempfile.NamedTemporaryFile('w', suffix='.js', delete=False) as f:
    f.write(js)
r = subprocess.run(['node', '--check', f.name], capture_output=True, text=True)
print('PARSE', 'OK' if r.returncode == 0 else 'FAIL\n' + r.stderr[:800])
PY
```

Expected: `# pass 164`, `# fail 0`, `PARSE OK`.

- [ ] **Step 5: Verify entry in the browser**

```js
document.getElementById('login-wall').style.display = 'none';
const wait = ms => new Promise(r => setTimeout(r, ms));
openLarkspurCase(); await wait(400);
const openedFirst = relCurrentDoc && relCurrentDoc.id === ACTIVE_DOCS[0].id;
const focusedFirstCell = document.activeElement.dataset.f === 'first';
const submit = () => document.getElementById('cir-submit');
const f = q => document.querySelector('#cir-drawer-body ' + q);
const s0 = submit().disabled;                       // blank starter row, no "No PII": blocked
f('input[data-r="0"][data-f="first"]').value = 'Ana'; f('input[data-r="0"][data-f="first"]').dispatchEvent(new Event('input'));
const s1 = submit().disabled;                       // half-filled: blocked
f('input[data-r="0"][data-f="last"]').value = 'Rivera'; f('input[data-r="0"][data-f="last"]').dispatchEvent(new Event('input'));
f('input[data-r="0"][data-e="ssn"]').click();
const s2 = submit().disabled;                       // complete: allowed
document.querySelector('#cir-drawer-head .cir-nopii input').click();
const contradiction = submit().disabled;            // rows plus "No PII": blocked
document.querySelector('#cir-drawer-head .cir-nopii input').click();
f('input[data-r="0"][data-e="med"]').dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
const rowsAfterEnter = document.querySelectorAll('#cir-drawer-body tbody tr').length;
const focusedNewRow = document.activeElement.dataset.r === '1' && document.activeElement.dataset.f === 'first';
cirToggleCollapse(); const collapsedText = document.querySelector('#cir-drawer-head .cir-count').textContent; cirToggleCollapse();
const drawerSplit = document.getElementById('cir-drawer').previousElementSibling.id;
cirDrafts = {};
JSON.stringify({ openedFirst, focusedFirstCell, s0, s1, s2, contradiction, rowsAfterEnter, focusedNewRow, collapsedText, hint: document.getElementById('cir-drawer-hint').textContent, drawerSplit })
```

Expected:
- `openedFirst: true`, `focusedFirstCell: true`;
- `s0: true`, `s1: true`, `s2: false`, `contradiction: true`;
- `rowsAfterEnter: 2`, `focusedNewRow: true`;
- `collapsedText: "1 individual · 1 SSN"`;
- `hint: ""`, because the new blank row is ignored;
- `drawerSplit: "rel-body"`.

- [ ] **Step 6: Commit**

```bash
git add index.html
git commit -m "Add the extraction drawer for entering affected people

A full-width drawer under the document holds one row per person: seven
typed identity fields and ten element boxes. Tab, Space, Enter on a
row's last box for a new row, and Ctrl+Enter to submit. Submit stays
disabled with a plain reason until the entry is complete: a half-filled
row, a row with no element, a two-digit year, or rows alongside "No
PII/PHI". The drawer is built from JavaScript, not markup.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Submit, grade and show feedback

**Files:**
- Modify: `index.html`: a new block before `function openCase`; `relRenderList`; CSS

**Interfaces:**
- Consumes: `EX.validateEntry`, `EX.gradeDocument`, `EX.resultStatus`, Task 7's drawer functions, `triggerAutoSave()`, `completeBatchAndNext('rel')`, `isBatchComplete`, `getTotalBatches`.
- Produces: `cirSubmit()`, `cirNext()`, `cirBatchStatus()` (returns `{done, last, nextNum}`), `cirRenderFeedback()`, `cirReviewAgain()`, `cirAnswered(id)` (returns `{correct, partial}` or `null`), `CIR_DEFECT_LABELS`, `CIR_FIELD_NAMES`.
- A stored entry is `relExtract.entries[docId] = { noPii, rows, submittedAt: ISO string, result: { weight, perfect, defects } }`.

- [ ] **Step 1: Add submit, next and feedback**

Insert immediately before `function openCase(caseNum) {`:

```js
var CIR_DEFECT_LABELS = { MISSED_INDIVIDUAL: 'missed individual', MISSED_ELEMENT: 'missed element',
  EXTRA_INDIVIDUAL: 'extra individual', EXTRA_ELEMENT: 'extra element', FIELD_ERROR: 'field error' };
var CIR_FIELD_NAMES = { first: 'First name', last: 'Last name', dob: 'DOB', street: 'Street', city: 'City', state: 'State', zip: 'ZIP' };

// The first submission is the graded one: feedback reveals the full correct
// rows, so a resubmission would be trivially perfect.
function cirSubmit() {
  if (cirReviewing || !cirDraft || !relCurrentDoc) return;
  var v = EX.validateEntry(cirDraft);
  if (!v.ok) { cirRenderEntryHead(); return; }
  var entry = { noPii: !!cirDraft.noPii, rows: v.rows };
  var g = EX.gradeDocument(relCurrentDoc.answer, entry);
  relExtract.entries[relCurrentDoc.id] = { noPii: entry.noPii, rows: entry.rows,
    submittedAt: new Date().toISOString(), result: { weight: g.weight, perfect: g.perfect, defects: g.defects } };
  delete cirDrafts[relCurrentDoc.id];
  cirReviewing = true; cirDraft = null;
  cirRender();
  cirFocus();
  relRenderList();
  updateRelProgress();
  triggerAutoSave();
}

function cirBatchStatus() {
  var st = relBatchState(), size = relBatchSize();
  return {
    done: isBatchComplete(ACTIVE_DOCS, st.currentBatch, relExtract.entries, size),
    last: st.currentBatch >= getTotalBatches(ACTIVE_DOCS, size) - 1,
    nextNum: st.currentBatch + 2
  };
}

// The feedback screen's main button. Moves to the next unsubmitted document in
// the batch; once the whole batch is in, opens the next batch. The shell's own
// unlock banner sits inside the coding panel, which this matter hides.
function cirNext() {
  var b = cirBatchStatus();
  if (b.done) {
    if (b.last) return;
    completeBatchAndNext('rel');
    var first = relGetVisible()[0];
    if (first) relOpenDoc(first.id);
    return;
  }
  var list = relGetVisible();
  var at = relCurrentDoc ? list.findIndex(function (d) { return d.id === relCurrentDoc.id; }) : -1;
  var order = list.slice(at + 1).concat(list.slice(0, at + 1));
  var next = order.filter(function (d) { return !relExtract.entries[d.id]; })[0];
  if (next) relOpenDoc(next.id); else relNav(1);
}

function cirAnswered(id) {
  var e = relExtract.entries[id];
  if (!e) return null;
  var s = EX.resultStatus(e.result);
  return { correct: s === 'correct', partial: s === 'partial' };
}

// Back to the top of the document, to re-read it against the feedback.
function cirReviewAgain() { var c = document.getElementById('rel-doc-content'); if (c) c.scrollTop = 0; }

function cirLineClean(line) {
  return !!line && !Object.keys(line.fieldErrors).length && !line.missedElements.length && !line.extraElements.length;
}

function cirReviewRow(values, kind, line) {
  var cls = kind === 'extra' ? 'cir-row-extra' : kind === 'missed' ? 'cir-row-missed' : (cirLineClean(line) ? 'cir-row-ok' : '');
  var h = '<tr class="' + cls + '">';
  CIR_FIELDS.forEach(function (f) {
    var bad = !!line && line.fieldErrors[f.k] !== undefined;
    h += '<td class="cir-f-' + f.k + (bad ? ' cir-bad' : '') + '"' +
      (bad ? ' title="Should be ' + escAttr(line.fieldErrors[f.k] || '(blank)') + '"' : '') + '>' + esc(values[f.k] || '') + '</td>';
  });
  CIR_ELEMENT_COLS.forEach(function (e) {
    var on = !!(values.el && values.el[e.k]);
    var missed = !!line && line.missedElements.indexOf(e.k) !== -1;
    var extra = !!line && line.extraElements.indexOf(e.k) !== -1;
    h += '<td class="cir-el ' + e.g + (missed ? ' cir-miss' : '') + (extra ? ' cir-bad' : '') + '"><span class="cir-box' + (on ? ' on' : '') + '"></span></td>';
  });
  return h + '<td class="cir-del"></td></tr>';
}

function cirWhyRow(notes) {
  return '<tr class="cir-why"><td colspan="' + (CIR_FIELDS.length + CIR_ELEMENT_COLS.length + 1) + '">' +
    notes.map(function (n) { return '<span class="cir-tag ' + n.cls + '">' + n.tag + '</span>' + esc(n.text || ''); }).join('<br>') +
    '</td></tr>';
}

function cirElementTitle(k) { return CIR_ELEMENT_COLS.filter(function (c) { return c.k === k; })[0].title; }

function cirMatchedNotes(line) {
  if (cirLineClean(line)) return [{ tag: 'CORRECT', cls: 'ok', text: '' }];
  var notes = [], why = line.key.why || {}, whyNot = line.key.whyNot || {};
  Object.keys(line.fieldErrors).forEach(function (f) {
    notes.push({ tag: 'FIELD ERROR', cls: 'm', text: CIR_FIELD_NAMES[f] + ' should be ' + (line.fieldErrors[f] || '(blank)') + '.' });
  });
  line.missedElements.forEach(function (k) {
    notes.push({ tag: 'MISSED ELEMENT', cls: 'm', text: cirElementTitle(k) + ': ' + (why[k] || '') });
  });
  line.extraElements.forEach(function (k) {
    notes.push({ tag: 'EXTRA ELEMENT', cls: 'x', text: cirElementTitle(k) + (whyNot[k] ? ': ' + whyNot[k] : ' is not exposed for this person.') });
  });
  return notes;
}

function cirRenderFeedback() {
  var doc = relCurrentDoc, saved = relExtract.entries[doc.id];
  if (!saved) return;
  document.getElementById('rel-shell').classList.toggle('cir-collapsed', cirCollapsed);
  var r = saved.result, counts = {}, b = cirBatchStatus();
  (r.defects || []).forEach(function (d) { counts[d.type] = (counts[d.type] || 0) + 1; });
  var nextLabel = !b.done ? 'Next document →' : b.last ? 'All batches submitted' : 'Batch ' + b.nextNum + ' →';
  document.getElementById('cir-drawer-head').innerHTML =
    '<span class="cir-docid">' + esc(doc.id) + ' · ' + esc(CIR_KIND_LABELS[doc.type] || doc.type) + '</span>' +
    (r.perfect ? '<span class="cir-badge ok">Perfect</span>'
      : '<span class="cir-badge bad">' + r.defects.length + ' defect' + (r.defects.length === 1 ? '' : 's') + ' · weight ' + r.weight + '</span>' +
        Object.keys(CIR_DEFECT_LABELS).filter(function (t) { return counts[t]; }).map(function (t) {
          return '<span class="cir-tally"><b>' + counts[t] + '</b> ' + CIR_DEFECT_LABELS[t] + '</span>';
        }).join('')) +
    '<span class="cir-spacer"></span>' +
    '<button class="cir-btn" onclick="cirReviewAgain()">Review again</button>' +
    '<button class="cir-btn gold" id="cir-next" onclick="cirNext()" title="Ctrl+Enter"' + (b.done && b.last ? ' disabled' : '') + '>' + nextLabel + '</button>' +
    '<button class="cir-btn" onclick="cirToggleCollapse()" title="' + (cirCollapsed ? 'Expand' : 'Collapse') + '">' + (cirCollapsed ? '▴' : '▾') + '</button>';
  document.getElementById('cir-drawer-hint').textContent = '';
  var body = document.getElementById('cir-drawer-body');
  if (cirCollapsed) { body.innerHTML = ''; return; }
  if (doc.answer.noPii && saved.noPii) {
    body.innerHTML = '<div class="cir-empty">Correct: there is no PII or PHI in this document.' + (doc.answer.why ? ' ' + esc(doc.answer.why) : '') + '</div>';
    return;
  }
  var g = EX.gradeDocument(doc.answer, saved);   // recomputed for display; the stored result is the grade
  var h = '<table class="cir-grid cir-review">' + cirGridHead() + '<tbody>';
  g.lines.forEach(function (ln) {
    if (ln.kind === 'matched') h += cirReviewRow(ln.row, 'matched', ln) + cirWhyRow(cirMatchedNotes(ln));
    else if (ln.kind === 'extra') h += cirReviewRow(ln.row, 'extra', null) + cirWhyRow([{ tag: 'EXTRA INDIVIDUAL', cls: 'x', text: ln.why }]);
    else h += cirReviewRow(ln.key, 'missed', null) + cirWhyRow([{ tag: 'MISSED INDIVIDUAL', cls: 'm', text: (ln.why ? ln.why + ' ' : '') + 'The correct row is shown.' }]);
  });
  body.innerHTML = h + '</tbody></table>';
}
```

- [ ] **Step 2: Show extraction results as list dots**

In `relRenderList`, change

```js
    var answered=relAnswered[d.id];
```

to

```js
    var answered=relIsExtraction()?cirAnswered(d.id):relAnswered[d.id];
```

- [ ] **Step 3: Style the feedback**

Insert immediately before the line beginning `.rv-proto{`:

```css
.cir-badge{font-weight:800;padding:3px 10px;border-radius:999px;font-size:.74rem}
.cir-badge.ok{background:#0d3b34;color:#4fd1b5;border:1px solid #145146}
.cir-badge.bad{background:#3a2028;color:#ff8a80;border:1px solid #5a2f39}
.cir-tally{font-size:.72rem;padding:2px 8px;border-radius:999px;background:#16203a;color:#b0c4de}
.cir-tally b{color:#fff}
table.cir-review td{font-size:.74rem;color:#dce6f5;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;padding:4px 3px}
.cir-box{display:inline-block;width:11px;height:11px;border:1px solid #6e8aaa;border-radius:2px;vertical-align:middle}
.cir-box.on{background:#d4a82a;border-color:#d4a82a}
.cir-row-ok td:first-child{box-shadow:inset 3px 0 0 #26a69a}
.cir-bad{background:rgba(229,57,53,.18);outline:1px solid #e53935}
.cir-miss{background:rgba(229,57,53,.18);outline:1px dashed #e53935}
.cir-row-extra td{text-decoration:line-through;color:#8a95a8}
.cir-row-extra td:first-child{box-shadow:inset 3px 0 0 #9e9e9e}
.cir-row-missed{background:rgba(229,57,53,.10)}
.cir-row-missed td:first-child{box-shadow:inset 3px 0 0 #e53935}
tr.cir-why td{border-top:none;padding:0 4px 7px;white-space:normal;font-size:.72rem;color:#b0c4de}
.cir-tag{font-size:.6rem;font-weight:800;letter-spacing:.05em;padding:1px 5px;border-radius:3px;margin-right:5px}
.cir-tag.m{background:#e53935;color:#fff}
.cir-tag.x{background:#616161;color:#fff}
.cir-tag.ok{background:#26a69a;color:#062e2a}
.cir-empty{padding:14px;color:#4fd1b5;font-size:.84rem}
```

- [ ] **Step 4: Parse check and tests**

```bash
cd ~/Documents/aa-mastery
node --test 2>&1 | grep -E "^# (tests|pass|fail)"
python3 - <<'PY'
import re, io, subprocess, tempfile
h = io.open('index.html', encoding='utf-8').read()
js = '\n;\n'.join(re.findall(r'<script(?![^>]*\bsrc=)[^>]*>(.*?)</script>', h, re.S))
with tempfile.NamedTemporaryFile('w', suffix='.js', delete=False) as f:
    f.write(js)
r = subprocess.run(['node', '--check', f.name], capture_output=True, text=True)
print('PARSE', 'OK' if r.returncode == 0 else 'FAIL\n' + r.stderr[:800])
PY
```

Expected: `# pass 164`, `# fail 0`, `PARSE OK`.

- [ ] **Step 5: Verify grading, feedback and the next batch in the browser**

```js
document.getElementById('login-wall').style.display = 'none';
const wait = ms => new Promise(r => setTimeout(r, ms));
openLarkspurCase(); await wait(400);
const batch = ACTIVE_DOCS.slice(0, 25);
// 1. One person missed, one extra box ticked.
const multi = batch.find(d => d.answer.people.length >= 2);
relOpenDoc(multi.id);
const key = EX.entryFromAnswer(multi.answer);
cirDraft.rows = key.rows.slice(1);
cirDraft.rows[0].el[EX.ELEMENTS.find(k => !cirDraft.rows[0].el[k])] = true;
cirSubmit(); await wait(100);
const saved = relExtract.entries[multi.id];
const tallies = [...document.querySelectorAll('#cir-drawer-head .cir-tally')].map(t => t.textContent);
const missedRow = !!document.querySelector('#cir-drawer-body tr.cir-row-missed');
const dot = document.querySelector('.rel-doc-row[data-id="' + multi.id + '"] .rel-coded-dot').className;
const nextFocused = document.activeElement.id === 'cir-next';
// 2. A document with no PII, answered correctly.
const clean = batch.find(d => d.answer.noPii);
relOpenDoc(clean.id); cirDraft.noPii = true; cirSubmit(); await wait(100);
const noPiiMsg = document.querySelector('#cir-drawer-body .cir-empty').textContent;
// 3. Going back shows the feedback, not a fresh grid.
relOpenDoc(multi.id);
const revisitShowsFeedback = cirReviewing && !document.getElementById('cir-submit');
// 4. The rest of the batch from its own answer keys, then the next batch.
for (const d of batch) {
  if (relExtract.entries[d.id]) continue;
  relOpenDoc(d.id);
  const k = EX.entryFromAnswer(d.answer);
  cirDraft.noPii = k.noPii; cirDraft.rows = k.rows.length ? k.rows : [cirBlankRow()];
  cirSubmit();
}
const label = document.getElementById('cir-next').textContent;
cirNext(); await wait(150);
const after = { batch: relBatchState().currentBatch, unlocked: relBatchState().unlockedBatches.slice(), open: relCurrentDoc && relCurrentDoc.id, listed: document.querySelectorAll('#rel-doc-scroll .rel-doc-row').length, quantumEdgeBatch: batchState.rel.currentBatch };
clearTimeout(_progressSaveTimer);
relExtract = { entries: {}, batch: { currentBatch: 0, unlockedBatches: [0] } }; cirDrafts = {}; localStorage.removeItem('aa_progress_guest');
JSON.stringify({ weight: saved.result.weight, types: saved.result.defects.map(d => d.type), tallies, missedRow, dot, nextFocused, noPiiMsg, revisitShowsFeedback, label, after })
```

Expected:
- **Missed person:** `types` holds `MISSED_INDIVIDUAL` and `EXTRA_ELEMENT`, and `weight: 6`. `tallies` lists `1 missed individual` and `1 extra element`. `missedRow: true`, `dot` contains `dot-wrong`, `nextFocused: true`.
- **No-PII document:** `noPiiMsg` starts `Correct: there is no PII or PHI in this document.`
- **Going back:** `revisitShowsFeedback: true`.
- **Next batch:** `label: "Batch 2 →"`, and `after` is `{batch: 1, unlocked: [0, 1], open: "LBS-0026", listed: 25, quantumEdgeBatch: 0}`.

- [ ] **Step 6: Commit**

```bash
git add index.html
git commit -m "Grade a submitted document and show the feedback where it happened

Submit grades the entry once: the first submission is the graded one,
since feedback reveals the full correct rows. The drawer then shows each
defect in place, as mocked up in brainstorming: correct rows edged
green, wrong values outlined with the right one, boxes that should have
been ticked dashed, extra people struck through with the reason, and
missed people added in red with where they were. Next document moves to
the next unsubmitted one; when the batch is complete it opens the next
batch, since the shell's unlock banner lives in the hidden coding panel.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 9: Progress, pace and saving

**Files:**
- Modify: `index.html`: a new block before `function openCase`; `PROGRESS_COLUMNS`; the original `buildProgressData`, `applyProgressData` and `loadProgressRemote`; CSS
- Create: `supabase/migrations/20260925_rel_extract.sql`

**Interfaces:**
- Consumes: `EX.summarize`, `EX.currentSession`, `QC.paceStats(sortedMs)`, which returns `{docsPerHour, …}` and gives 0 for fewer than two marks. Also Task 1's `PROGRESS_COLUMNS` and `progressRemotePayload`.
- Produces: `cirUpdateProgress()`, `cirNormalizeStore(value)` (returns an object shaped like `relExtract`), `CIR_PACE_TARGET`, `CIR_SESSION_GAP_MS`. `rel_extract` saves locally always, and remotely once its column exists.

- [ ] **Step 1: Add progress and store normalization**

Insert immediately before `function openCase(caseNum) {`:

```js
var CIR_PACE_TARGET = 15;
var CIR_SESSION_GAP_MS = 30 * 60000;

// Whatever storage hands back (a JSON string, an object, or nothing) becomes a
// well-formed extraction store.
function cirNormalizeStore(v) {
  if (typeof v === 'string') { try { v = JSON.parse(v); } catch (e) { v = null; } }
  if (!v || typeof v !== 'object') v = {};
  var b = v.batch || {};
  return {
    entries: (v.entries && typeof v.entries === 'object') ? v.entries : {},
    batch: { currentBatch: +b.currentBatch || 0,
             unlockedBatches: (Array.isArray(b.unlockedBatches) && b.unlockedBatches.length) ? b.unlockedBatches : [0] }
  };
}

function cirUpdateProgress() {
  var total = ACTIVE_DOCS.length;
  var done = ACTIVE_DOCS.filter(function (d) { return !!relExtract.entries[d.id]; });
  var pct = total ? Math.round(done.length / total * 100) : 0;
  document.getElementById('rel-prog-pct').textContent = pct + '%';
  document.getElementById('rel-prog-fill').style.width = pct + '%';
  var s = EX.summarize(done.map(function (d) { return relExtract.entries[d.id].result; }));
  document.getElementById('rel-accuracy-disp').textContent = s.accuracy === null ? '—' : Math.round(s.accuracy * 100) + '%';
  var marks = done.map(function (d) { return Date.parse(relExtract.entries[d.id].submittedAt); }).filter(isFinite);
  var pace = QC.paceStats(EX.currentSession(marks, CIR_SESSION_GAP_MS)).docsPerHour;
  var box = document.getElementById('cir-progress-extra');
  if (!box) {
    var badge = document.getElementById('rel-accuracy-disp');
    var holder = badge && badge.closest('.rel-accuracy-badge');
    if (!holder) return;
    box = document.createElement('div');
    box.id = 'cir-progress-extra';
    holder.parentNode.insertBefore(box, holder.nextSibling);
  }
  box.style.display = '';
  box.innerHTML = '<div class="cir-pace' + (pace && pace < CIR_PACE_TARGET ? ' slow' : '') + '">Pace <b>' +
    (pace ? pace.toFixed(1) : '—') + '</b> docs/hr · target ' + CIR_PACE_TARGET + '</div>' +
    Object.keys(CIR_DEFECT_LABELS).map(function (t) {
      return '<div class="cir-bd"><span>' + CIR_DEFECT_LABELS[t] + '</span><b>' + s.breakdown[t] + '</b></div>';
    }).join('');
}
```

Add this CSS immediately before the line beginning `.rv-proto{`:

```css
#cir-progress-extra{margin-top:8px;font-size:.72rem;color:var(--muted)}
.cir-pace{margin-bottom:5px}
.cir-pace b{color:var(--gold-light)}
.cir-pace.slow b{color:#ffb74d}
.cir-bd{display:flex;justify-content:space-between;padding:1px 0}
.cir-bd b{color:#dce6f5}
```

- [ ] **Step 2: Save and restore `rel_extract`**

**`buildProgressData()`** (the original, near line 7825): add `rel_extract: relExtract,` after `cp_redactions: cpRedactions,`. The two wrappers further down pass it through untouched.

**`applyProgressData(d)`** (the original): add after the line `  if (d.cp_redactions) cpRedactions = d.cp_redactions;`:

```js
  if (d.rel_extract) relExtract = cirNormalizeStore(d.rel_extract);
```

**`PROGRESS_COLUMNS`** (Task 1): add `'rel_extract'` after `'cp_redactions'`. `rel_extract` is sent as an object, so do **not** add it to the `JSON.stringify` list in `saveProgressRemote`.

**`loadProgressRemote()`**: in the returned object, add after the `cp_redactions:` line:

```js
      rel_extract:  d.rel_extract,
```

- [ ] **Step 3: Add the migration**

Create `supabase/migrations/20260925_rel_extract.sql`:

```sql
-- Extraction progress for the Cyber Incident Response matter (Larkspur).
-- Kept apart from rel_coding/rel_answered, whose counters assumed one matter.
-- Until this runs, the app drops rel_extract from remote saves once the
-- database names it as missing, so every other matter keeps saving.
alter table public.reviewer_progress add column if not exists rel_extract jsonb;
```

Do not run it. Production schema changes are Jeff's to run, in the Supabase SQL editor, after the merge.

- [ ] **Step 4: Parse check and tests**

```bash
cd ~/Documents/aa-mastery
node --test 2>&1 | grep -E "^# (tests|pass|fail)"
python3 - <<'PY'
import re, io, subprocess, tempfile
h = io.open('index.html', encoding='utf-8').read()
js = '\n;\n'.join(re.findall(r'<script(?![^>]*\bsrc=)[^>]*>(.*?)</script>', h, re.S))
with tempfile.NamedTemporaryFile('w', suffix='.js', delete=False) as f:
    f.write(js)
r = subprocess.run(['node', '--check', f.name], capture_output=True, text=True)
print('PARSE', 'OK' if r.returncode == 0 else 'FAIL\n' + r.stderr[:800])
PY
```

Expected: `# pass 164`, `# fail 0`, `PARSE OK`.

- [ ] **Step 5: Verify progress, local persistence and the missing-column fallback**

```js
document.getElementById('login-wall').style.display = 'none';
const wait = ms => new Promise(r => setTimeout(r, ms));
openLarkspurCase(); await wait(400);
const first3 = ACTIVE_DOCS.slice(0, 3);
const t0 = Date.now() - 20 * 60000;
first3.forEach((d, i) => { relExtract.entries[d.id] = { noPii: d.answer.noPii, rows: EX.entryFromAnswer(d.answer).rows, submittedAt: new Date(t0 + i * 4 * 60000).toISOString(), result: { weight: 0, perfect: true, defects: [] } }; });
updateRelProgress();
const shown = { pct: document.getElementById('rel-prog-pct').textContent, acc: document.getElementById('rel-accuracy-disp').textContent, pace: document.querySelector('#cir-progress-extra .cir-pace').textContent };
saveProgressLocal();
relExtract = { entries: {}, batch: { currentBatch: 0, unlockedBatches: [0] } };
applyProgressData(loadProgressLocal());
const restored = Object.keys(relExtract.entries).length;
const real = window.axios; const sent = [];
window.axios = function (cfg) {
  if (!String(cfg.url).includes('reviewer_progress')) return real.apply(this, arguments);
  sent.push(Object.keys(cfg.data));
  if (sent.length === 1) { const e = new Error('x'); e.response = { status: 400, data: { message: "Could not find the 'rel_extract' column of 'reviewer_progress' in the schema cache" } }; return Promise.reject(e); }
  return Promise.resolve({ data: [] });
};
SB.user = { id: '00000000-0000-0000-0000-000000000000' }; SB.token = 'x';
await saveProgressRemote();
window.axios = real; SB.user = null; SB.token = null; progressColumnsMissing = {};
relExtract = { entries: {}, batch: { currentBatch: 0, unlockedBatches: [0] } }; localStorage.removeItem('aa_progress_guest');
openAICase(); await wait(300);
JSON.stringify({ shown, restored, firstSendHadIt: sent[0].includes('rel_extract'), retryDroppedIt: !sent[1].includes('rel_extract'), retryKeptRest: sent[1].includes('rel_coding'), extraHiddenInQuantumEdge: document.getElementById('cir-progress-extra').style.display === 'none' })
```

Expected:
- **Sidebar figures:** `shown.pct: "2%"` (3 of 150), `shown.acc: "100%"`, and `shown.pace` reads `Pace 15.0 docs/hr · target 15` (2 intervals in 8 minutes).
- **Local save:** `restored: 3`.
- **Missing column:** `firstSendHadIt: true`, `retryDroppedIt: true`, `retryKeptRest: true`.
- **Back in QuantumEdge:** `extraHiddenInQuantumEdge: true`.

- [ ] **Step 6: Commit**

```bash
git add index.html supabase/migrations/20260925_rel_extract.sql
git commit -m "Track extraction progress and pace, and save it

The sidebar shows the share of documents submitted, accuracy as the
share with zero defects, a count of each defect type, and pace in the
current working session against the 15-an-hour target. A gap of more
than 30 minutes starts a new session, so an overnight break doesn't
drag pace toward zero.

Extraction progress saves locally always, and remotely in a new
rel_extract column once its one-line migration runs. Until then the
database names the column as missing, the save retries without it, and
every other matter's progress keeps landing.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 10: The Larkspur protocol PDF

**Files:**
- Modify: `tools/protocols_content.py`
- Modify: `tools/build_protocols.py`
- Create (generated): `protocols/Larkspur-Cyber-Incident-Response-Protocol.pdf`
- Modify: `index.html`: `REVIEW_PROTOCOLS`

**Interfaces:**
- Consumes: `C.ESCALATION`, `C.ESCALATION_NOTES`, `C.QC_STANDARD` (whose `"Pace"` row reads 60 per hour), `C.TRAINING_NOTE`. Also the builder's helpers `P(text, style)`, `section(n, title)`, `table(head, rows, widths, bold_first=True)`, `bullets(items, style)`, `callout(title, text)`, `meta_row(meta)` (at most three items), `NumberedCanvas`, `FRAME_W`, `MARGIN`, `OUT`, `S`, `esc`.
- Produces: a matter dict with `"layout": "extraction"`, and `build_extraction(m)`. `build(m)` dispatches to it. `python3 tools/build_protocols.py <text>` builds only the PDFs whose file name contains `<text>`.

- [ ] **Step 1: Add the matter's content**

In `tools/protocols_content.py`:
- change the docstring's first line from `Review protocols for the six training matters.` to `Review protocols for the seven training matters.`;
- append this dict to the end of the `MATTERS` list, before its closing `]`:

```python
# 7 ─────────────────────────────────────────────────────────────────────────
{
    "file": "Larkspur-Cyber-Incident-Response-Protocol.pdf",
    "short": "Larkspur Cyber Incident Response",
    "title": "Larkspur Benefit Services: Cyber Incident Response",
    "subtitle": "PII/PHI extraction · HIPAA and state breach notification",
    "platform": "Relativity",
    "layout": "extraction",
    "meta": [("Platform", "Relativity"), ("Documents", "150 · rosters, claims, medical, HR, email"),
             ("Pace target", "15 documents per hour")],
    "overview": [
        "Larkspur Benefit Services, a health-benefits administrator, suffered a ransomware attack, and "
        "the attacker took a copy of a file share. Outside counsel has engaged the review team to mine "
        "the stolen files: to find every affected person and every data element exposed, so Larkspur "
        "can notify them under HIPAA and state breach-notification laws.",
        "Larkspur handles health-plan data for the plans it serves, which makes it a HIPAA business "
        "associate rather than a covered entity. It also holds ordinary employer HR data. You will meet "
        "both PII and PHI.",
        "This is extraction, not coding. You record who each document exposes and what was exposed. "
        "You do not decide responsiveness or privilege.",
    ],
    "custodians": [
        ("Benefits Operations", "Enrollment and eligibility files, member correspondence"),
        ("Claims", "Claim forms and care-management records"),
        ("HR", "W-2s, direct-deposit forms, I-9s"),
        ("IT", "Tickets and account administration"),
        ("Finance", "Billing and premium payments"),
    ],
    "template_fields": [
        ("First name, Last name", "As the document gives them. First and last only."),
        ("Date of birth", "Month first with a four-digit year, for example 03/14/1986."),
        ("Street, City", "As the document gives them."),
        ("State", "The two-letter code."),
        ("ZIP", "Five digits."),
    ],
    "pii_list": "SSN · Driver's license / state ID · Passport · Financial account · Payment card · "
                "Login credentials · Biometric",
    "phi_list": "Medical record no. · Health plan / member ID · Medical info (diagnosis, treatment, medication)",
    "no_pii_rule": "Every document ends with either at least one row or the \"No PII/PHI in this document\" "
                   "box ticked, never both. About a quarter of the set has no PII at all.",
    "rules": [
        "One row per person per document. Someone who appears twice in one document is one row, with "
        "their elements merged.",
        "Record only individuals the document names. An SSN with no name attached is not recorded.",
        "Type the name as the document gives it, first and last only.",
        "Leave a field blank when the document does not show it. Never infer an address or a date of birth.",
        "Business contact details are not PII, and providers are not affected individuals.",
        "A masked or last-4-only SSN does not count as an SSN.",
        "Dependents, including minors, are affected individuals.",
        "Record a person only when at least one data element is exposed for them. A name with only an "
        "address, or with only a masked SSN, is not an affected individual and gets no row.",
    ],
    "elements": [
        ("SSN", "A full Social Security number", "A masked or last-4-only number (XXX-XX-1234)"),
        ("Driver's license / state ID", "A license or state ID number", "The words \"driver's license\" with no number"),
        ("Passport", "A passport number", "A note that a passport was seen, with no number"),
        ("Financial account", "A bank account number, with or without a routing number", "A bank's name alone"),
        ("Payment card", "A full card number", "The last four digits alone"),
        ("Login credentials", "A username or email together with its password", "A username alone"),
        ("Biometric", "Fingerprint, face or voice data, or an enrolled template for it", "A photo on a staff badge"),
        ("Medical record no.", "A medical record number (MRN)", "A claim or invoice number"),
        ("Health plan / member ID", "A member or subscriber ID", "A plan's name alone"),
        ("Medical info", "A diagnosis, condition, treatment, procedure or medication tied to the person",
         "A provider's specialty or a clinic's name"),
    ],
    "traps": [
        ("The provider is not the patient",
         "Claims and progress notes name a doctor with a practice address. That is business contact "
         "information. The patient is the affected individual."),
        ("Masked numbers don't count",
         "Direct-deposit forms show only the last four digits of an SSN. Record the person for their bank "
         "account, and leave the SSN box empty."),
        ("Look below the page break",
         "Long rosters continue onto a second page. The last rows are as affected as the first."),
        ("Dependents are affected too",
         "Children listed on an enrollment census are affected individuals, with their own rows."),
        ("Names without data",
         "A newsletter mailing list holds names and addresses only. With no data element exposed, no one "
         "on it gets a row."),
    ],
    "pace_text": "The target for this matter is 15 documents per hour. Extraction is slower than coding: "
                 "rosters and claim files carry many people each. Pace is measured per working session; "
                 "a gap of more than 30 minutes starts a new one. Your first submission of each document "
                 "is the graded one.",
    "defects": [
        ("Missed individual", "Someone who should be notified is not", "5"),
        ("Missed data element", "The letter understates the exposure; it can change which laws apply", "3"),
        ("Extra individual", "Over-notification: cost, and needless alarm", "2"),
        ("Extra data element", "Overstates the exposure", "1"),
        ("Identity field error", "The letter is misaddressed or cannot be matched", "1"),
    ],
    "pace_line": "15 documents per hour for this extraction matter (60 applies to the coding matters).",
},
```

- [ ] **Step 2: Teach the builder the extraction layout**

In `tools/build_protocols.py`, make four edits:

**Edit 1, docstring.** Replace the lines

```
Build the six review-protocol PDFs into ../protocols/.

    python3 -m venv .venv && .venv/bin/pip install reportlab
    .venv/bin/python tools/build_protocols.py
```

with

```
Build the review-protocol PDFs into ../protocols/.

    python3 -m venv .venv && .venv/bin/pip install reportlab
    .venv/bin/python tools/build_protocols.py            # all of them
    .venv/bin/python tools/build_protocols.py Larkspur   # only files containing "Larkspur"
```

**Edit 2, new function.** Add this above `if __name__ == "__main__":`

```python
def build_extraction(m):
    story = [
        Paragraph("AA TEAM&nbsp;&nbsp;·&nbsp;&nbsp;DOCUMENT REVIEW PROTOCOL", S["eyebrow"]),
        Paragraph(esc(m["title"]), S["title"]),
        Paragraph(esc(m["subtitle"]), S["subtitle"]),
        meta_row(m["meta"]),
        Spacer(1, 6),
        P(C.TRAINING_NOTE, "training"),
    ]
    w = FRAME_W
    num = [0]

    def sect(title, *first, rest=()):
        """A heading bound to its first block, so it can never end a page alone."""
        num[0] += 1
        story.append(KeepTogether([section(num[0], title)] + list(first)))
        story.extend(rest)

    sect("Matter overview", *[P(t) for t in m["overview"]])
    sect("Parties and custodians",
         table(["Custodian", "What it holds"], m["custodians"], [w * 0.30, w * 0.70]))
    sect("The extraction template",
         P("One row per affected person in the document: typed identity values, then a tick box for "
           "each data element exposed."),
         table(["Identity field", "How to enter it"], m["template_fields"], [w * 0.30, w * 0.70]),
         rest=[Spacer(1, 6),
               table(["PII (state breach-law triggers)", "PHI (HIPAA)"], [[m["pii_list"], m["phi_list"]]],
                     [w * 0.5, w * 0.5], bold_first=False),
               Spacer(1, 4), P(m["no_pii_rule"], "note")])
    rules = [Paragraph(esc(t), S["bullet"], bulletText="%d." % (i + 1))
             for i, t in enumerate(m["rules"])]
    sect("How to extract", *rules[:2], rest=rules[2:])
    sect("Data elements: what counts",
         table(["Element", "Counts", "Does not count"], m["elements"], [w * 0.24, w * 0.40, w * 0.36]))
    al = [callout(t, x) for t, x in m["traps"]]
    rest = []
    for c in al[1:]:
        rest += [Spacer(1, 6), c]
    sect("Judgment traps", al[0], rest=rest)
    sect("Pace and grading", P(m["pace_text"]),
         table(["Defect", "What it costs the client", "Weight"], m["defects"], [w * 0.28, w * 0.58, w * 0.14]))
    qc = [(k, m["pace_line"] if k == "Pace" else v) for k, v in C.QC_STANDARD]
    # The closing section moves as one unit, as in the coding protocols.
    sect("Escalation and the QC standard",
         table(["Step", "Who", "When"], C.ESCALATION, [w * 0.08, w * 0.24, w * 0.68]),
         Spacer(1, 6), *bullets(C.ESCALATION_NOTES, "note"),
         Spacer(1, 6), table(["QC Track standard", ""], qc, [w * 0.30, w * 0.70]))

    path = os.path.join(OUT, m["file"])

    class _Canvas(NumberedCanvas):
        matter_short = m["short"]

    doc = SimpleDocTemplate(path, pagesize=letter, leftMargin=MARGIN, rightMargin=MARGIN,
                            topMargin=MARGIN, bottomMargin=MARGIN,
                            title="%s — Review Protocol" % m["title"],
                            author="AA Team", subject="Document review protocol",
                            creator="AA Team Mastery Hub")
    doc.build(story, canvasmaker=_Canvas)
    return path
```

**Edit 3, dispatch.** Add this as the first two lines of `def build(m):`

```python
    if m.get("layout") == "extraction":
        return build_extraction(m)
```

**Edit 4, build one file.** Replace the `if __name__ == "__main__":` block with

```python
if __name__ == "__main__":
    os.makedirs(OUT, exist_ok=True)
    only = sys.argv[1:]   # optional: build only files whose name contains one of these
    for m in C.MATTERS:
        if only and not any(o in m["file"] for o in only):
            continue
        print(build(m))
```

- [ ] **Step 3: Build the PDF and check it**

```bash
cd ~/Documents/aa-mastery
python3 -m venv .venv && .venv/bin/pip install -q reportlab pypdf pypdfium2 pillow
.venv/bin/python tools/build_protocols.py Larkspur
.venv/bin/python - <<'PY'
import re
from pypdf import PdfReader
r = PdfReader('protocols/Larkspur-Cyber-Incident-Response-Protocol.pdf')
t = ' '.join(' '.join(p.extract_text() for p in r.pages).split())
heads = ['Matter overview', 'Parties and custodians', 'The extraction template', 'How to extract',
         'Data elements: what counts', 'Judgment traps', 'Pace and grading', 'Escalation and the QC standard']
print('pages:', len(r.pages))
print('missing headings:', [h for h in heads if h not in t])
print('document ids:', re.findall(r'LBS-\d{4}', t))
print('SSN-shaped:', re.findall(r'\b\d{3}-\d{2}-\d{4}\b', t))
print('15 per hour shown:', '15 documents per hour' in t, '| 60 per hour shown:', '60 documents per hour' in t)
PY
git status --short protocols/
```

Expected:
- `missing headings: []`, `document ids: []`, `SSN-shaped: []`;
- `15 per hour shown: True | 60 per hour shown: False`;
- `git status` lists only the new PDF, since the other six were not rebuilt.

Then render every page and look at each one:

```bash
D=$(mktemp -d)
.venv/bin/python - "$D" <<'PY'
import sys, pypdfium2 as pdfium
pdf = pdfium.PdfDocument('protocols/Larkspur-Cyber-Incident-Response-Protocol.pdf')
for i in range(len(pdf)):
    pdf[i].render(scale=1.4).to_pil().save('%s/page-%d.png' % (sys.argv[1], i + 1))
print(sys.argv[1])
PY
```

Open each `page-N.png` with the Read tool. Every heading must sit with its content, never alone at the bottom of a page. No page may be empty or nearly empty.

- [ ] **Step 4: Offer the protocol above the card**

In `REVIEW_PROTOCOLS` in `index.html`, add this line after the `'openAICase'` entry:

```js
  'openLarkspurCase': {file: 'Larkspur-Cyber-Incident-Response-Protocol.pdf', label: 'Larkspur Benefit Services'},
```

Verify in the browser:

```js
nav('review'); await new Promise(r => setTimeout(r, 300));
const pane = document.getElementById('vpane-relativity');
const cards = [...pane.querySelectorAll('.proj-case-card')].map(c => ({ opens: c.getAttribute('onclick'), protocolBefore: !!(c.previousElementSibling && c.previousElementSibling.classList.contains('rv-proto')) }));
const res = await fetch('/protocols/Larkspur-Cyber-Incident-Response-Protocol.pdf');
JSON.stringify({ cards, status: res.status, type: res.headers.get('content-type') })
```

Expected:
- `cards` is `[{opens: "openAICase()", protocolBefore: true}, {opens: "openLarkspurCase()", protocolBefore: true}]`;
- `status: 200`, `type: "application/pdf"`.

- [ ] **Step 5: Commit**

```bash
git add tools/protocols_content.py tools/build_protocols.py protocols/Larkspur-Cyber-Incident-Response-Protocol.pdf index.html
git commit -m "Add the Larkspur extraction protocol

A seventh protocol with a layout of its own, since extraction needs
different sections: the template, what counts as each data element and
what does not, numbered rules, the judgment traps, and how pace and
grading work. The QC table shows this matter's 15-an-hour pace rather
than the coding matters' 60. Offered above the Larkspur card like the
other six. The builder can now rebuild one PDF, so the others are left
untouched.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 11: Document it, check it end to end, open the pull request

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: Document the fifth matter**

In `CLAUDE.md`, in the **Simulator cases** list, add this bullet after the `Case 4` bullet (and its indented continuation line):

```markdown
- Case 5: `CIR_DOCS` — **Larkspur Benefit Services, Cyber Incident Response**, launched by `openLarkspurCase()`.
  An extraction matter: reviewers record affected people and exposed data elements in a drawer under the
  document, graded by `extraction-engine.js` (`window.EX`, tested in `tests/extraction-engine.test.js`).
  `cir-docs.js` is generated by `tools/build_cir_docs.py`; never edit it by hand. The Relativity shell's
  matters are declared in `REL_MATTERS`.
```

In the same file, change `**Supabase tables:** \`quiz_scores\`, \`timesheets\`, \`payments\`, \`tactical\`` to:

```markdown
**Supabase tables:** `quiz_scores`, `timesheets`, `payments`, `tactical`, `reviewer_progress` (saved review progress; `saveProgressRemote()` sends only the columns in `PROGRESS_COLUMNS`)
```

- [ ] **Step 2: Full test run and parse check**

```bash
cd ~/Documents/aa-mastery
node --test 2>&1 | grep -E "^# (tests|pass|fail)"
python3 - <<'PY'
import re, io, subprocess, tempfile
h = io.open('index.html', encoding='utf-8').read()
js = '\n;\n'.join(re.findall(r'<script(?![^>]*\bsrc=)[^>]*>(.*?)</script>', h, re.S))
with tempfile.NamedTemporaryFile('w', suffix='.js', delete=False) as f:
    f.write(js)
r = subprocess.run(['node', '--check', f.name], capture_output=True, text=True)
print('PARSE', 'OK' if r.returncode == 0 else 'FAIL\n' + r.stderr[:800])
PY
```

Expected: `# pass 164`, `# fail 0`, `PARSE OK`.

- [ ] **Step 3: Work part of a batch the way a reviewer would**

In the browser, go to Doc Review Projects, open the Relativity tab, and click the Larkspur card. Then work five documents by keyboard, typing rows by hand for at least one roster. Submit each, read each feedback screen, and move on with **Next document →** and with **Ctrl+Enter**.

Confirm each of these:
- the protocol link sits above the card;
- the drawer opens on the first document, with the cursor in the first name cell;
- Submit refuses incomplete entries and says why;
- feedback follows the mockup's conventions;
- the list's dots update;
- the sidebar's accuracy, defect counts and pace move;
- collapse and expand both work;
- after reloading the page and reopening Larkspur, the submitted documents are still submitted.

Take a screenshot of one feedback screen for the pull request.

- [ ] **Step 4: QuantumEdge regression and Reset**

1. Run the QuantumEdge check from Task 5 Step 1. Expected: the Task 5 Step 8 result.
2. Code one QuantumEdge document by hand and note its ID.
3. Open Larkspur, press **Reset**, and accept.
4. Reopen QuantumEdge. That document must still show its coded dot.
5. Reload the page and reopen Larkspur. Nothing may be submitted: the reset was saved.

- [ ] **Step 5: Commit, push and open the pull request**

```bash
git add CLAUDE.md
git commit -m "Document the Larkspur matter and the progress columns

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
git push -u origin feat/cyber-incident-response
gh pr create --title "Cyber Incident Response: PII/PHI extraction on Relativity" --body "$(cat <<'EOF'
Adds the Larkspur Benefit Services matter: reviewers mine a fictional benefits administrator's stolen file share, recording every affected person and every exposed data element in a spreadsheet drawer inside Relativity, graded against a generated answer key.

Spec: docs/superpowers/specs/2026-09-25-cyber-incident-response-design.md
Plan: docs/superpowers/plans/2026-09-25-cyber-incident-response.md

**Also fixes remote progress saving**, which had failed silently for every reviewer since 29 May 2026: the payload carried fields the table does not have (saved_at, then three CADE fields). Loading now also prefers the newer of the remote and local copies.

**After merging:** run `supabase/migrations/20260925_rel_extract.sql` in the Supabase SQL editor. Until then, extraction progress saves locally and every other matter saves normally.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```
