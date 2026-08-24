# Doc Review Projects & QC Path — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace four navigation tabs with one — Doc Review Projects & QC Path — that is both the catalogue of every matter and an ordered route from "never done this" to "QC-ready".

**Architecture:** Stage derivation is a pure function in `qc-engine.js` under `node --test`; interrupt scripts move there too, because they are configuration and their protocol-change predicates need testing against the real corpora. The eight case cards are **moved at runtime with `appendChild`** rather than having their markup rewritten — they are discrete `.proj-case-card` / `.fl-case-card` nodes, so moving them preserves every inline handler and touches no markup.

**Tech Stack:** Vanilla JS (ES5 in `qc-engine.js`), Node 22 `node --test`, Supabase, Vercel.

**Spec:** `docs/superpowers/specs/2026-08-24-doc-review-projects-and-qc-path-design.md`

**Predecessors:** `2026-08-17-qc-track-phase-1.md`, `2026-08-17-qc-track-phase-2.md` (both complete — 103 engine tests on `feat/qc-track-phase-2`)

## Global Constraints

- **Nothing locks.** Stages are `done` / `next` / `available`; every stage is clickable regardless of state. The distinction is advisory only.
- **Thresholds: 25 documents for stage 2 (Joba), 50 for stage 3 (any larger matter).** Calibration, not law — they live in one constant.
- **Escalate appears only when that case has a non-empty `QC_AMBIGUOUS` list.** Never derive ambiguity from `fa-flag`: 219 of TransRidge's 500 documents carry it as ordinary First Amendment qualified-privilege coding.
- **Every scripted protocol change must match ≥5% of its corpus and ≥10 documents.** A predicate that matches nothing is a *silent* no-op — instruction-drift never fires and nothing reports a problem.
- **CADE's interrupt messages are in Portuguese with an English gloss.** A PM writing to a Portuguese-language review team would not write in English.
- **All dynamic DOM content goes through `esc()` or `escAttr()`.**
- **`qc-engine.js` must not use `import`/`export`** — it loads as a classic script and via `require()`.
- **Run tests with bare `node --test`.** `node --test tests/` resolves the directory as a module on Node 22.22 and fails before running anything.

---

## Case inventory, as the code actually is

Verified by reading the launchers. Two entries differ from what earlier work assumed.

| Matter | Card selector | Shell | QC key | Certifiable |
| --- | --- | --- | --- | --- |
| Joba v. Bukando | `[onclick*="openCase(1)"]` | Relativity | `joba` | No — 55 docs |
| Harmon v. NovaCure | `[onclick*="openCase(2)"]` | Relativity | — | No |
| **SEC v. QuantumEdge AI** | `[onclick*="openAICase"]` | **Relativity** | `p4` | Yes |
| Veridian Bank — GDPR | `[onclick*="openEverlawCase"]` | Everlaw | `p3` | Yes |
| CADE v. Consórcio TechBrasil | `[onclick*="openCadeCase"]` | Everlaw | `ptbr` | Off by default |
| NorthStar v. Meridian | `[onclick*="antitrust"]` | Casepoint | — | No |
| St. Aurelius — data breach | `[onclick*="breach"]` | Casepoint | — | No |
| TransRidge v. Cascade Headwaters | `[onclick*="firstam"]` | Casepoint | `firstam` | Yes |
| ~~Grupo Velasco Motors~~ | `[onclick*="openCase(3)"]` | — | — | **Deleted in Task 5** |

Every card is a `.proj-case-card` or `.fl-case-card`. The launcher sits either on the card itself or on a nested button, so `element.closest('.proj-case-card, .fl-case-card')` finds the card in both cases.

## File structure

| File | Responsibility | Change |
| --- | --- | --- |
| `qc-engine.js` | Pure logic and configuration. Gains `pathStatus` and `INTERRUPTS`. | Modify |
| `tests/qc-engine.test.js` | Node suite. Grows from 103 to 113. | Modify |
| `tests/interrupt-corpora.test.js` | Asserts each protocol-change predicate matches its real corpus. | Create |
| `index.html` | New `page-review`; nav consolidation; path renderer; library; card moves; conditional Escalate; `p4` label; Velasco deletion. | Modify |
| `CLAUDE.md` | Correct the stale "Case 3" line; document the new tab. | Modify |

---

### Task 1: Path stage derivation

**Files:**
- Modify: `qc-engine.js`
- Modify: `tests/qc-engine.test.js`

**Interfaces:**
- Consumes: nothing
- Produces: `QC.PATH_STAGES -> string[]`; `QC.PATH_THRESHOLDS -> {firstPass:number, scale:number}`; `QC.pathStatus({attempts, firstPassCounts:{joba,scale}, marked:{rules}}) -> [{key, status}]` where `status` is `'done' | 'next' | 'available'`, in stage order

- [ ] **Step 1: Write the failing test**

Append to `tests/qc-engine.test.js`:

```js
function pstat(input) {
  var out = {};
  QC.pathStatus(input).forEach(function (s) { out[s.key] = s.status; });
  return out;
}

test('PATH_STAGES is the six stages in order', function () {
  assert.deepStrictEqual(QC.PATH_STAGES,
    ['rules', 'firstpass', 'scale', 'qcpractice', 'qccert', 'readiness']);
});

test('a fresh person is pointed at stage one', function () {
  var s = pstat({});
  assert.strictEqual(s.rules, 'next');
  assert.strictEqual(s.firstpass, 'available');
  assert.strictEqual(s.readiness, 'available');
});

test('exactly one stage is next, always', function () {
  [{}, { marked: { rules: true } },
   { marked: { rules: true }, firstPassCounts: { joba: 30 } },
   { attempts: [{ batch_type: 'certification' }] }
  ].forEach(function (input, i) {
    var n = QC.pathStatus(input).filter(function (x) { return x.status === 'next'; }).length;
    assert.strictEqual(n, 1, 'input ' + i + ' produced ' + n + ' next stages');
  });
});

test('marking the rules read completes stage one', function () {
  var s = pstat({ marked: { rules: true } });
  assert.strictEqual(s.rules, 'done');
  assert.strictEqual(s.firstpass, 'next');
});

test('stage two completes at the Joba threshold, not before', function () {
  assert.strictEqual(pstat({ firstPassCounts: { joba: 24 } }).firstpass, 'available');
  assert.strictEqual(pstat({ firstPassCounts: { joba: 25 } }).firstpass, 'done');
  assert.strictEqual(QC.PATH_THRESHOLDS.firstPass, 25);
});

test('stage three completes at the scale threshold, not before', function () {
  assert.strictEqual(pstat({ firstPassCounts: { scale: 49 } }).scale, 'available');
  assert.strictEqual(pstat({ firstPassCounts: { scale: 50 } }).scale, 'done');
  assert.strictEqual(QC.PATH_THRESHOLDS.scale, 50);
});

test('a practice batch completes stage four', function () {
  var s = pstat({ attempts: [{ batch_type: 'practice' }] });
  assert.strictEqual(s.qcpractice, 'done');
  assert.strictEqual(s.qccert, 'available');
});

test('certifying completes stage four as well as stage five', function () {
  var s = pstat({ attempts: [{ batch_type: 'certification' }] });
  assert.strictEqual(s.qcpractice, 'done', 'certifying proves you can practise');
  assert.strictEqual(s.qccert, 'done');
});

test('readiness is never done - it is a view, not a task', function () {
  var s = pstat({
    marked: { rules: true },
    firstPassCounts: { joba: 55, scale: 500 },
    attempts: [{ batch_type: 'certification' }, { batch_type: 'practice' }]
  });
  assert.strictEqual(s.rules, 'done');
  assert.strictEqual(s.qccert, 'done');
  assert.strictEqual(s.readiness, 'next', 'with everything else done, readiness is where to go');
});

test('pathStatus tolerates missing and malformed input', function () {
  assert.strictEqual(QC.pathStatus().length, 6);
  assert.strictEqual(QC.pathStatus({ attempts: null, firstPassCounts: null }).length, 6);
  assert.strictEqual(pstat({ attempts: [null, undefined] }).qcpractice, 'available');
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd ~/Documents/aa-mastery && node --test
```

Expected: FAIL — `QC.PATH_STAGES is undefined`

- [ ] **Step 3: Write minimal implementation**

Insert into `qc-engine.js` immediately before the module-scope `return {` (the line that is exactly `  return {`):

```js
  var PATH_STAGES = ['rules', 'firstpass', 'scale', 'qcpractice', 'qccert', 'readiness'];

  // Calibration, not law. They exist so that opening a case and coding two
  // documents does not read as "done".
  var PATH_THRESHOLDS = { firstPass: 25, scale: 50 };

  // Advisory only. Nothing here gates anything; the renderer draws every stage
  // as clickable regardless of status.
  function pathStatus(input) {
    input = input || {};
    var attempts = input.attempts || [];
    var counts = input.firstPassCounts || {};
    var marked = input.marked || {};

    var practice = 0, cert = 0;
    for (var i = 0; i < attempts.length; i++) {
      if (!attempts[i]) continue;
      if (attempts[i].batch_type === 'certification') cert++;
      else if (attempts[i].batch_type === 'practice') practice++;
    }

    var done = {
      rules:      !!marked.rules,
      firstpass:  (counts.joba || 0) >= PATH_THRESHOLDS.firstPass,
      scale:      (counts.scale || 0) >= PATH_THRESHOLDS.scale,
      qcpractice: (practice + cert) > 0,
      qccert:     cert > 0,
      readiness:  false      // a view, not a task - never completes
    };

    var out = [], claimed = false;
    for (var s = 0; s < PATH_STAGES.length; s++) {
      var key = PATH_STAGES[s], status;
      if (done[key]) status = 'done';
      else if (!claimed) { status = 'next'; claimed = true; }
      else status = 'available';
      out.push({ key: key, status: status });
    }
    return out;
  }
```

Add to the returned object: `PATH_STAGES: PATH_STAGES, PATH_THRESHOLDS: PATH_THRESHOLDS, pathStatus: pathStatus`.

- [ ] **Step 4: Run test to verify it passes**

```bash
cd ~/Documents/aa-mastery && node --test
```

Expected: PASS, 113 tests.

- [ ] **Step 5: Commit**

```bash
git add qc-engine.js tests/qc-engine.test.js
git commit -m "feat(review): path stage derivation"
```

---

### Task 2: Interrupt scripts for the remaining three matters

`QC_INTERRUPTS` currently lives in `index.html` and covers only `joba` and `firstam`. It is configuration, like `ERROR_TYPES`, and its protocol-change predicates need testing against the real corpora — so it moves into the engine.

**Files:**
- Modify: `qc-engine.js`
- Modify: `index.html` (remove the old `QC_INTERRUPTS`, read from `QC`)
- Create: `tests/interrupt-corpora.test.js`

**Interfaces:**
- Consumes: nothing
- Produces: `QC.INTERRUPTS` keyed by case, each an array of `{type, from, subject, body, change?}` where `change` is `{label, when:{field:value}, then:{field:value}}`

- [ ] **Step 1: Write the failing test**

Create `tests/interrupt-corpora.test.js`. This is the test that matters most in the whole plan — it is the only thing standing between a mistyped predicate and a drill that silently loses its sharpest mechanic.

```js
'use strict';
var test = require('node:test');
var assert = require('node:assert');
var fs = require('node:fs');
var path = require('node:path');
var QC = require('../qc-engine.js');

var SRC = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

// The corpora live as JSON.parse("...") literals inside index.html.
function corpus(name) {
  var m = new RegExp('(?:const|var|let)\\s+' + name + '\\s*=\\s*JSON\\.parse\\(').exec(SRC);
  assert.ok(m, name + ' not found in index.html');
  var i = m.index + m[0].length;
  var j = SRC.indexOf('")', i);
  return JSON.parse(JSON.parse(SRC.slice(i, j + 1)));
}

var CORPUS_FOR = {
  joba:    'REL_DOCS',
  p3:      'P3_DOCS',
  p4:      'P4_DOCS',
  ptbr:    'PTBR_DOCS'
  // firstam is FA_DOCS, an array literal rather than JSON.parse - covered separately below
};

test('every QC-capable case has an interrupt script', function () {
  ['joba', 'firstam', 'p3', 'p4', 'ptbr'].forEach(function (k) {
    assert.ok(QC.INTERRUPTS[k], k + ' has no interrupt script');
    assert.strictEqual(QC.INTERRUPTS[k].length, 3, k + ' should have 3 messages');
  });
});

test('each script has one acknowledge, one change and one feedback message', function () {
  Object.keys(QC.INTERRUPTS).forEach(function (k) {
    var types = QC.INTERRUPTS[k].map(function (m) { return m.type; }).sort();
    assert.deepStrictEqual(types, ['ack', 'change', 'feedback'], k + ' has ' + types.join(','));
  });
});

test('every message carries real copy', function () {
  Object.keys(QC.INTERRUPTS).forEach(function (k) {
    QC.INTERRUPTS[k].forEach(function (m) {
      assert.ok(m.from && m.from.length > 2, k + '/' + m.type + ' needs a sender');
      assert.ok(m.subject && m.subject.length > 5, k + '/' + m.type + ' needs a subject');
      assert.ok(m.body && m.body.length > 60, k + '/' + m.type + ' body is too short to read as real');
    });
  });
});

test('every protocol change actually changes something', function () {
  Object.keys(QC.INTERRUPTS).forEach(function (k) {
    var change = QC.INTERRUPTS[k].filter(function (m) { return m.type === 'change'; })[0].change;
    assert.ok(change, k + ' change message has no change object');
    assert.ok(change.label && change.label.length > 10, k + ' change needs a label');
    Object.keys(change.when).forEach(function (f) {
      assert.notStrictEqual(change.then[f], change.when[f],
        k + ' change leaves ' + f + ' unchanged - it would be a no-op');
    });
  });
});

// The load-bearing one. A predicate matching nothing produces no effectiveAnswer,
// so instruction-drift never fires, compliance reads null, and nothing anywhere
// reports a problem.
Object.keys(CORPUS_FOR).forEach(function (key) {
  test('the ' + key + ' protocol change matches a meaningful share of its corpus', function () {
    var docs = corpus(CORPUS_FOR[key]);
    var change = QC.INTERRUPTS[key].filter(function (m) { return m.type === 'change'; })[0].change;
    var hits = docs.filter(function (d) {
      var a = d.answer || {};
      return Object.keys(change.when).every(function (f) { return a[f] === change.when[f]; });
    }).length;
    var pct = 100 * hits / docs.length;
    assert.ok(hits >= 10, key + ' matched only ' + hits + ' documents - too few to drill');
    assert.ok(pct >= 5, key + ' matched ' + pct.toFixed(1) + '% - below the 5% floor');
  });
});

// CORRECTED DURING EXECUTION: FA_DOCS is 15 hand-authored entries plus ~485 pushed by a
// generator at load time, so static analysis sees only the authored portion. The bar is
// scaled to that portion; full-corpus proof is the browser check in Step 6.
test('the firstam protocol change matches the hand-authored FA documents', function () {
  var block = SRC.slice(SRC.indexOf('var FA_DOCS'), SRC.indexOf('// FA-DATA-END'));
  var change = QC.INTERRUPTS.firstam.filter(function (m) { return m.type === 'change'; })[0].change;
  var field = Object.keys(change.when)[0];
  var needle = new RegExp(field + ':"' + change.when[field] + '"', 'g');
  var hits = (block.match(needle) || []).length;
  assert.ok(hits >= 10, 'firstam matched only ' + hits + ' documents');
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd ~/Documents/aa-mastery && node --test
```

Expected: FAIL — `QC.INTERRUPTS` is undefined.

- [ ] **Step 3: Move the scripts into the engine and add the three new ones**

Insert into `qc-engine.js` immediately before the module-scope `return {`. The `joba` and `firstam` entries are copied verbatim from `index.html`; the other three are new.

Predicate frequencies, measured against the real corpora: Veridian `standard` 280/510 (55%), QuantumEdge `highly-conf` 303/500 (61%), CADE `standard` 162/500 (32%). All clear the 5% floor comfortably.

```js
  // Interrupt scripts are configuration, like ERROR_TYPES, and their protocol-change
  // predicates need testing against the real corpora - so they live here rather than
  // in the page. Three messages per case: acknowledge, protocol change, feedback.
  var INTERRUPTS = {
    joba: [
      { type: 'ack', from: 'Project Manager',
        subject: 'Batch check-in',
        body: 'Confirm you have picked up this batch and are working it. Reply when you see this.' },
      { type: 'change', from: 'Outside Counsel',
        subject: 'PROTOCOL CHANGE — confidentiality tier',
        body: 'Client has revised the confidentiality call. Any document currently coded standard confidentiality is to be treated as highly confidential from this point forward. Apply going forward; do not go back and re-code what you have already submitted.',
        change: { label: 'Standard confidentiality is now highly confidential.',
                  when: { conf: 'standard' }, then: { conf: 'highly-conf' } } },
      { type: 'feedback', from: 'QC Lead',
        subject: 'Note on your last batch',
        body: 'You over-designated on responsiveness last batch — several non-responsive documents were coded responsive. Responsiveness needs a link to a specific issue, not just a mention of the company.' }
    ],
    firstam: [
      { type: 'ack', from: 'Project Manager',
        subject: 'Batch check-in',
        body: 'Confirm you have picked up this batch and are working it. Reply when you see this.' },
      { type: 'change', from: 'Outside Counsel',
        subject: 'PROTOCOL CHANGE — First Amendment flag',
        body: 'The court has narrowed the qualified privilege. From this point forward, documents currently coded not-privileged are to be flagged for escalation instead: code them fa-flag and withhold.',
        change: { label: 'Not-privileged documents are now fa-flag and withheld.',
                  when: { privilege: 'not-privileged' }, then: { privilege: 'fa-flag', action: 'withhold' } } },
      { type: 'feedback', from: 'QC Lead',
        subject: 'Note on your last batch',
        body: 'Two privileged documents went out coded not-privileged last batch. Read the participants before the text — counsel on the From, To or CC line changes the analysis of everything below it.' }
    ],
    p3: [
      { type: 'ack', from: 'Project Manager',
        subject: 'Veridian — batch check-in',
        body: 'Confirm you have picked up this batch of the Veridian review and are working it. The ICO liaison call is at four, so I need to know where we stand before then.' },
      { type: 'change', from: 'Data Protection Counsel',
        subject: 'PROTOCOL CHANGE — biometric and financial identifiers',
        body: 'BaFin has objected to the current designations. Any document presently coded standard confidentiality is to be treated as highly confidential from this point forward — the supervisory authorities are treating the biometric and account-level identifiers in this population as special category data. Apply going forward only; do not re-code what you have already submitted.',
        change: { label: 'Standard confidentiality is now highly confidential.',
                  when: { conf: 'standard' }, then: { conf: 'highly-conf' } } },
      { type: 'feedback', from: 'QC Lead',
        subject: 'Note on your last Veridian batch',
        body: 'Your confidentiality calls slipped last batch — several documents carrying account numbers were left at standard. The tier follows the content, not the sender: a routine-looking email with an account identifier in it is not routine.' }
    ],
    p4: [
      { type: 'ack', from: 'Project Manager',
        subject: 'QuantumEdge — batch check-in',
        body: 'Confirm you have picked up this batch and are working it. The SEC production window is tight on this one and I am tracking throughput hourly.' },
      { type: 'change', from: 'Securities Counsel',
        subject: 'PROTOCOL CHANGE — trading desk material is now AEO',
        body: 'The protective order has been amended. Material currently coded highly confidential is to be designated attorneys’ eyes only from this point forward — the trading-desk and position-limit content is commercially sensitive to a degree the previous tier does not cover. Apply going forward; do not re-code submitted work.',
        change: { label: 'Highly confidential is now attorneys’ eyes only.',
                  when: { conf: 'highly-conf' }, then: { conf: 'aeo' } } },
      { type: 'feedback', from: 'QC Lead',
        subject: 'Note on your last QuantumEdge batch',
        body: 'Two documents discussing the FINRA certification were coded non-responsive last batch. Check the document against every issue in the protocol, not just the one you are already pattern-matching on — the certification touches Issue 4 as well as Issue 2.' }
    ],
    ptbr: [
      { type: 'ack', from: 'Gerente de Projeto',
        subject: 'CADE — confirmação de lote',
        body: 'Confirme que você assumiu este lote e está trabalhando nele. Responda assim que vir esta mensagem. [EN: Confirm you have picked up this batch and are working it. Reply as soon as you see this.]' },
      { type: 'change', from: 'Advogado Externo',
        subject: 'MUDANÇA DE PROTOCOLO — nível de confidencialidade',
        body: 'O CADE ampliou a proteção conferida ao material do cartel. Todo documento atualmente codificado como confidencialidade padrão deve passar a ser tratado como altamente confidencial a partir de agora. Aplique daqui em diante; não recodifique o que já foi enviado. [EN: CADE has widened the protection given to the cartel material. Any document currently coded standard confidentiality must now be treated as highly confidential from this point forward. Apply going forward; do not re-code what you have already submitted.]',
        change: { label: 'Confidencialidade padrão agora é altamente confidencial.',
                  when: { conf: 'standard' }, then: { conf: 'highly-conf' } } },
      { type: 'feedback', from: 'Líder de QC',
        subject: 'Observação sobre seu último lote',
        body: 'Você super-designou responsividade no último lote — vários documentos não responsivos foram codificados como responsivos. A responsividade exige ligação com uma questão específica. [EN: You over-designated responsiveness last batch — several non-responsive documents were coded responsive. Responsiveness needs a link to a specific issue.]' }
    ]
  };
```

Add `INTERRUPTS: INTERRUPTS` to the returned object.

- [ ] **Step 4: Point the page at the engine's copy**

In `index.html`, delete the whole `var QC_INTERRUPTS = { … };` literal and replace it with:

```js
var QC_INTERRUPTS = QC.INTERRUPTS;
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
cd ~/Documents/aa-mastery && node --test
```

Expected: PASS, 113 + 9 = 122 tests across both files, 0 failures.

- [ ] **Step 6: Verify a new case actually fires interrupts in the browser**

Start the preview (`preview_start` with the `aa-mastery` launch config, port 8199), open QC Track, and in the console:

```js
document.getElementById('login-wall').style.display='none'; nav('qc');
startQcBatch('p3','practice');
for (var i=0;i<qcState.entries.length;i++){ qcState.currentIdx=i; qcCheckInterrupts(); }
JSON.stringify({
  fired: qcState.interrupts.filter(function(x){return x.firedAt;}).length,
  amended: qcState.entries.filter(function(e){return e.instructionChanged;}).length
});
```

Expected: `fired` is 3, and `amended` is greater than 10 — the protocol change is reaching real documents.

- [ ] **Step 7: Commit**

```bash
git add qc-engine.js index.html tests/interrupt-corpora.test.js
git commit -m "feat(review): interrupt scripts for Veridian, QuantumEdge and CADE"
```

---

### Task 3: Conditional Escalate and the p4 label

**Files:**
- Modify: `index.html`

**Interfaces:**
- Consumes: `qcAmbiguousIds(caseKey)` (Phase 1)
- Produces: no new symbols

- [ ] **Step 1: Show Escalate only where escalation can be right**

Veridian, QuantumEdge and CADE have empty `QC_AMBIGUOUS` lists because those corpora contain no ambiguous documents — every hand-authored explanation states a firm call. On those cases the Escalate button can never be correct, so it should not be offered.

In `renderQcReview`, replace this line:

```js
            '<button onclick="qcDecide(\'escalate\')">Escalate</button>' +
```

with:

```js
            (qcAmbiguousIds(qcState.caseKey).length
              ? '<button onclick="qcDecide(\'escalate\')">Escalate</button>'
              : '') +
```

No scoring change is needed. With an empty ambiguity list neither `OVER_ESCALATION` nor `MISSED_ESCALATION` can trigger, so the engine is already correct.

- [ ] **Step 2: Fix the mislabelled case**

`QC_CASES.p4` is labelled "Project 4". It is SEC v. QuantumEdge AI, launched by `openAICase()` which delegates to `openCase(4)` — the Relativity shell. In `QC_CASES`, replace:

```js
  p4:      { label: 'Project 4',                        docs: function () { return P4_DOCS; },   certification: true },
```

with:

```js
  p4:      { label: 'SEC v. QuantumEdge AI',            docs: function () { return P4_DOCS; },   certification: true },
```

- [ ] **Step 3: Verify in the browser**

Reload and run in the console:

```js
document.getElementById('login-wall').style.display='none'; nav('qc');
startQcBatch('firstam','practice');
var withAmb = !!document.querySelector('[onclick*="escalate"]');
startQcBatch('p3','practice');
var withoutAmb = !!document.querySelector('[onclick*="escalate"]');
renderQcLaunch();
JSON.stringify({ firstamHasEscalate: withAmb, p3HasEscalate: withoutAmb,
  p4Label: document.getElementById('qc-view-launch').innerText.indexOf('QuantumEdge') > -1 });
```

Expected: `firstamHasEscalate` true, `p3HasEscalate` false, `p4Label` true.

- [ ] **Step 4: Commit**

```bash
git add index.html
git commit -m "feat(review): conditional Escalate, and name p4 as SEC v. QuantumEdge AI"
```

---

### Task 4: The page shell and navigation consolidation

**Files:**
- Modify: `index.html`

**Interfaces:**
- Consumes: `nav(p)`, `esc()`, `escAttr()`
- Produces: `page-review` with `#review-path`, `#review-tabs`, and `.vpane` divs `vpane-relativity` / `vpane-everlaw` / `vpane-casepoint`; `showReviewTab(id, btn)`; `reviewCurrentTab`

- [ ] **Step 1: Add the page container**

Insert immediately before the existing `<div id="page-qc" class="page" style="display:none">`:

```html
<div id="page-review" class="page">
  <div class="card" style="border-color:var(--gold)">
    <h2 style="margin:0 0 4px">Doc Review Projects &amp; QC Path</h2>
    <p class="muted" style="margin:0">Every live-style matter in one place, and the route
      from first-pass review to QC-ready. Nothing is locked &mdash; the path tells you where
      to go next, the library lets you go anywhere.</p>
  </div>

  <div id="review-path"></div>

  <div class="card">
    <h3 style="margin:0 0 10px">Case library</h3>
    <div class="rtabs" id="review-tabs">
      <button class="rtab active" onclick="showReviewTab('relativity',this)">Relativity</button>
      <button class="rtab" onclick="showReviewTab('everlaw',this)">Everlaw</button>
      <button class="rtab" onclick="showReviewTab('casepoint',this)">Casepoint</button>
    </div>
    <div id="vpane-relativity" class="vpane active"></div>
    <div id="vpane-everlaw" class="vpane"></div>
    <div id="vpane-casepoint" class="vpane"></div>
  </div>
</div>
```

- [ ] **Step 2: Add the sub-tab switcher**

Add to the QC TRACK script section, following the `showLead` / `showAdminTab` pattern already used twice in this file:

```js
var reviewCurrentTab = 'relativity';

function showReviewTab(id, btn) {
  reviewCurrentTab = id;
  document.querySelectorAll('#page-review .vpane').forEach(function (p) { p.classList.remove('active'); });
  document.querySelectorAll('#review-tabs .rtab').forEach(function (t) { t.classList.remove('active'); });
  var pane = document.getElementById('vpane-' + id);
  if (pane) pane.classList.add('active');
  if (btn) btn.classList.add('active');
}
```

- [ ] **Step 3: Style the panes**

The `.rtab` / `.rtabs` classes already exist. Add the pane rule at the end of the `/* ── QC TRACK */` CSS block:

```css
.vpane{display:none}
.vpane.active{display:block}
```

- [ ] **Step 4: Consolidate the navigation**

Delete these four buttons from `#topnav`:

```html
    <button onclick="nav('qc')">🔎 QC Track</button>
    <button onclick="nav('other-projects')">🌐 Other Projects</button>
    <button onclick="nav('foreign-review')">🇧🇷 Foreign Language</button>
    <button onclick="nav('projects')">📁 Projects</button>
```

and add one in their place, positioned where `nav('projects')` was:

```html
    <button onclick="nav('review')">📁 Doc Review Projects &amp; QC Path</button>
```

- [ ] **Step 5: Register the page initialiser**

In `nav(p)`, replace:

```js
  if(p==='qc'){loadQcData();renderQcHome();}
```

with:

```js
  if(p==='review'){loadQcData();renderReviewPage();}
```

- [ ] **Step 6: Add a temporary renderer so the page is not blank**

`renderReviewPage` is written properly in Task 6. Add this placeholder now so Task 4 is independently testable:

```js
function renderReviewPage() {
  reviewMoveCards();
  document.getElementById('review-path').innerHTML =
    '<div class="card"><p class="muted">Path renders in Task 6.</p></div>';
}
```

`reviewMoveCards` arrives in Task 5; guard the call:

```js
function renderReviewPage() {
  if (typeof reviewMoveCards === 'function') reviewMoveCards();
  document.getElementById('review-path').innerHTML =
    '<div class="card"><p class="muted">Path renders in Task 6.</p></div>';
}
```

- [ ] **Step 7: Verify in the browser**

Reload. Expected: the nav shows **📁 Doc Review Projects & QC Path** and no longer shows QC Track, Other Projects, Foreign Language or Projects. Clicking it shows the header card, the placeholder, and three empty platform sub-tabs that switch when clicked. Console shows no errors.

- [ ] **Step 8: Commit**

```bash
git add index.html
git commit -m "feat(review): page shell and navigation consolidation"
```

---

### Task 5: Move the case cards, delete the dead one

Each card is a discrete `.proj-case-card` or `.fl-case-card` node, so moving it with `appendChild` preserves every inline `onclick` and rewrites no markup. This is deliberately a runtime move rather than markup surgery.

**Files:**
- Modify: `index.html`

**Interfaces:**
- Consumes: the `.vpane` divs from Task 4
- Produces: `REVIEW_LIBRARY`; `reviewCardFor(selector)`; `reviewMoveCards()`

- [ ] **Step 1: Delete the Grupo Velasco card**

No Spanish corpus is planned, and its button calls `openCase(3)`, which falls through `openCase`'s `else` branch and opens the English Joba case labelled "Joba v. Bukando".

Run this. It walks back from the `openCase(3)` line to the enclosing
`<div class="proj-case-card">`, then forward with a depth counter to that div's own
closing tag, and refuses to write anything unless the block it found actually contains
the button and nothing else's:

```bash
cd ~/Documents/aa-mastery && python3 - <<'PYEOF'
import io
p = 'index.html'
lines = io.open(p, encoding='utf-8').read().split('\n')

hits = [i for i, l in enumerate(lines) if 'openCase(3)' in l]
assert len(hits) == 1, 'expected exactly one openCase(3), found %d' % len(hits)
btn = hits[0]

start = max(i for i in range(btn + 1) if '<div class="proj-case-card">' in lines[i])

depth = 0
for end in range(start, len(lines)):
    depth += lines[end].count('<div')
    depth -= lines[end].count('</div>')
    if depth == 0:
        break
else:
    raise AssertionError('never closed the card div')

block = '\n'.join(lines[start:end + 1])
assert 'openCase(3)' in block, 'block does not contain the button'
assert 'Velasco' in block, 'block is not the Velasco card'
assert 'openCase(1)' not in block and 'openCase(2)' not in block, 'block swallowed a neighbour'
print('deleting lines %d-%d (%d lines)' % (start + 1, end + 1, end - start + 1))

del lines[start:end + 1]
io.open(p, 'w', encoding='utf-8').write('\n'.join(lines))
PYEOF
```

Then verify exactly one card was removed and no other reference survives:

```bash
cd ~/Documents/aa-mastery && grep -c 'proj-case-card' index.html && grep -c 'openCase(3)' index.html && grep -c 'Velasco' index.html
```

Expected: the `proj-case-card` count drops by exactly 1 from its previous value, and both `openCase(3)` and `Velasco` return 0.

`openCase` itself needs no change — its `else` branch remains correct as the path for case 1 (Joba).

- [ ] **Step 2: Declare the library**

Add to the QC TRACK script section:

```js
// Cards are discrete nodes, so the library is built by moving them rather than by
// rewriting markup - every inline onclick survives the move untouched.
var REVIEW_LIBRARY = {
  relativity: ['openCase(1)', 'openCase(2)', 'openAICase'],
  everlaw:    ['openEverlawCase', 'openCadeCase'],
  casepoint:  ['antitrust', 'breach', 'firstam']
};

// The launcher sits on the card for some matters and on a nested button for others,
// so match the launcher then walk up to the card.
function reviewCardFor(needle) {
  var hit = document.querySelector('[onclick*="' + needle + '"]');
  return hit ? hit.closest('.proj-case-card, .fl-case-card') : null;
}

function reviewMoveCards() {
  for (var group in REVIEW_LIBRARY) {
    if (!Object.prototype.hasOwnProperty.call(REVIEW_LIBRARY, group)) continue;
    var pane = document.getElementById('vpane-' + group);
    if (!pane) continue;
    var needles = REVIEW_LIBRARY[group];
    for (var i = 0; i < needles.length; i++) {
      var card = reviewCardFor(needles[i]);
      if (card && card.parentNode !== pane) pane.appendChild(card);
    }
  }
}
```

- [ ] **Step 3: Verify every card moved and every launcher still works**

Reload, open the new tab, and run in the console:

```js
document.getElementById('login-wall').style.display='none'; nav('review');
var counts = {
  relativity: document.querySelectorAll('#vpane-relativity .proj-case-card, #vpane-relativity .fl-case-card').length,
  everlaw:    document.querySelectorAll('#vpane-everlaw .proj-case-card, #vpane-everlaw .fl-case-card').length,
  casepoint:  document.querySelectorAll('#vpane-casepoint .proj-case-card, #vpane-casepoint .fl-case-card').length
};
var launchers = ['openCase(1)','openCase(2)','openAICase','openEverlawCase','openCadeCase','antitrust','breach','firstam'];
var found = launchers.filter(function(n){ return !!reviewCardFor(n); });
JSON.stringify({ counts: counts, total: counts.relativity+counts.everlaw+counts.casepoint,
                 launchersFound: found.length, missing: launchers.filter(function(n){return found.indexOf(n)<0;}) });
```

Expected: `relativity` 3, `everlaw` 2, `casepoint` 3, `total` 8, `launchersFound` 8, `missing` empty.

- [ ] **Step 4: Verify each shell actually opens**

Still in the console, open and close each of the three shells:

```js
openCase(1);        var relOpen = document.getElementById('rel-shell').classList.contains('open');
openEverlawCase();  var evOpen  = getComputedStyle(document.getElementById('everlaw-shell')).display !== 'none';
openCasepointCase('firstam'); var cpOpen = !!document.getElementById('cp-crumb').innerHTML;
JSON.stringify({ relOpen: relOpen, evOpen: evOpen, cpOpen: cpOpen });
```

Expected: all three true. The shells are siblings of the page divs rather than children, so moving cards does not affect them — this step proves it.

- [ ] **Step 5: Commit**

```bash
git add index.html
git commit -m "feat(review): move case cards into platform panes, delete the dead Velasco card"
```

---

### Task 6: The path renderer

**Files:**
- Modify: `index.html`

**Interfaces:**
- Consumes: `QC.pathStatus`, `QC.PATH_THRESHOLDS`, `qcAttempts`, `relCoding` / `cpCoding` / `evCoding`, `getProgressKey()`
- Produces: `REVIEW_PATH_COPY`; `reviewFirstPassCounts()`; `reviewRulesKey()` / `reviewRulesRead()` / `reviewToggleRules()`; `reviewGoToLibrary()`; `renderReviewPage()` (replacing the Task 4 placeholder)

- [ ] **Step 1: Read first-pass progress and the self-marked flag**

Stage 1 has no observable signal — nobody can detect reading — so it is self-marked and reversible. It rides the existing per-user progress key rather than a new table.

Add to the QC TRACK script section:

```js
function reviewRulesKey() { return getProgressKey() + '_path_rules'; }

function reviewRulesRead() {
  try { return localStorage.getItem(reviewRulesKey()) === '1'; } catch (e) { return false; }
}

function reviewToggleRules() {
  try { localStorage.setItem(reviewRulesKey(), reviewRulesRead() ? '0' : '1'); } catch (e) {}
  renderReviewPage();
}

// relCoding / cpCoding / evCoding are objects keyed by document id, maintained by the
// simulators as people work. Counting keys is the completion signal, so stages 2 and 3
// self-mark instead of asking anyone to tick a box.
function reviewCountKeys(obj) {
  var n = 0;
  for (var k in (obj || {})) if (Object.prototype.hasOwnProperty.call(obj, k)) n++;
  return n;
}

function reviewFirstPassCounts() {
  var joba = (typeof relCoding !== 'undefined') ? reviewCountKeys(relCoding) : 0;
  var cp   = (typeof cpCoding  !== 'undefined') ? reviewCountKeys(cpCoding)  : 0;
  var ev   = (typeof evCoding  !== 'undefined') ? reviewCountKeys(evCoding)  : 0;
  return { joba: joba, scale: Math.max(cp, ev) };
}
```

- [ ] **Step 2: Write the renderer**

Add to the QC TRACK script section:

```js
var REVIEW_PATH_COPY = {
  rules: {
    n: 1, title: 'Know the rules',
    blurb: 'The review protocol, the eDiscovery playbook, and the eight defects QC looks for.',
    action: 'Open the error taxonomy', onclick: 'renderQcTaxonomy()'
  },
  firstpass: {
    n: 2, title: 'First-pass review',
    blurb: 'Joba v. Bukando — 55 documents. The on-ramp: code a real matter end to end.',
    action: 'Open Joba in Relativity', onclick: 'openCase(1)'
  },
  scale: {
    n: 3, title: 'Review at scale',
    blurb: 'Any larger matter, on any platform. Volume changes how the work feels.',
    action: 'Choose a matter', onclick: 'reviewGoToLibrary()'
  },
  qcpractice: {
    n: 4, title: 'QC practice',
    blurb: 'Review what another reviewer already coded, under dense errors, and learn the patterns.',
    action: 'Start a practice batch', onclick: 'renderQcLaunch()'
  },
  qccert: {
    n: 5, title: 'QC certification',
    blurb: 'The real bar: 250 documents at realistic error density, where almost everything is clean.',
    action: 'Choose a matter to certify on', onclick: 'renderQcLaunch()'
  },
  readiness: {
    n: 6, title: 'Readiness',
    blurb: 'Your Accuracy, Pace and Responsiveness, and what to practise next.',
    action: 'View readiness', onclick: 'renderQcHome()'
  }
};

// A named helper rather than an inline call: the onclick goes through escAttr() into
// an HTML attribute, and nesting quotes inside that is fragile and hard to read.
function reviewGoToLibrary() {
  var firstTab = document.querySelector('#review-tabs .rtab');
  showReviewTab('relativity', firstTab);
  var lib = document.getElementById('review-tabs');
  if (lib) lib.scrollIntoView({ block: 'start' });
}

function renderReviewPage() {
  if (typeof reviewMoveCards === 'function') reviewMoveCards();

  var stages = QC.pathStatus({
    attempts: qcAttempts,
    firstPassCounts: reviewFirstPassCounts(),
    marked: { rules: reviewRulesRead() }
  });

  var counts = reviewFirstPassCounts();
  var h = '<div class="card"><h3 style="margin:0 0 4px">Your path to QC</h3>' +
    '<p class="muted" style="margin:0 0 12px">Nothing is locked. Every stage is open — ' +
    'the marker just says where to pick up.</p><div class="rv-path">';

  for (var i = 0; i < stages.length; i++) {
    var st = stages[i];
    var c = REVIEW_PATH_COPY[st.key];
    var detail = '';
    if (st.key === 'firstpass') {
      detail = counts.joba + ' of ' + QC.PATH_THRESHOLDS.firstPass + ' documents coded';
    } else if (st.key === 'scale') {
      detail = counts.scale + ' of ' + QC.PATH_THRESHOLDS.scale + ' documents coded';
    }

    h += '<div class="rv-stage rv-' + escAttr(st.status) + '">' +
      '<div class="rv-num">' + esc(String(c.n)) + '</div>' +
      '<div class="rv-body">' +
        '<div class="rv-title">' + esc(c.title) +
          (st.status === 'next' ? ' <span class="rv-flag">Start here</span>' : '') +
          (st.status === 'done' ? ' <span class="rv-done">✓ done</span>' : '') +
        '</div>' +
        '<div class="rv-blurb">' + esc(c.blurb) + '</div>' +
        (detail ? '<div class="rv-detail">' + esc(detail) + '</div>' : '') +
        '<button class="btn btn-outline btn-sm" onclick="' + escAttr(c.onclick) + '">' +
          esc(c.action) + '</button>' +
        (st.key === 'rules'
          ? ' <button class="btn btn-outline btn-sm" onclick="reviewToggleRules()">' +
            (reviewRulesRead() ? 'Mark as unread' : 'Mark as read') + '</button>'
          : '') +
      '</div>' +
    '</div>';
  }

  h += '</div></div>';
  document.getElementById('review-path').innerHTML = h;
}
```

- [ ] **Step 3: Style the path**

Add at the end of the `/* ── QC TRACK */` CSS block:

```css
.rv-path{display:flex;flex-direction:column;gap:.5rem}
.rv-stage{display:flex;gap:.75rem;align-items:flex-start;padding:.7rem;border:1px solid #1c2740;border-radius:8px;background:var(--card)}
.rv-num{flex:0 0 1.8rem;height:1.8rem;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:.85rem;background:#1c2740;color:#9fb0c9}
.rv-next{border-color:var(--gold);box-shadow:0 0 0 1px var(--gold)}
.rv-next .rv-num{background:var(--gold);color:#0b1220}
.rv-done .rv-num{background:#0d3b34;color:#4fd1b5}
.rv-title{font-weight:700;color:#dbe4f0;margin-bottom:.2rem}
.rv-blurb{color:#9fb0c9;font-size:.85rem;margin-bottom:.35rem;max-width:62ch}
.rv-detail{color:#7d8ca3;font-size:.78rem;margin-bottom:.45rem}
.rv-flag{background:var(--gold);color:#0b1220;font-size:.68rem;padding:.1rem .45rem;border-radius:999px;margin-left:.35rem}
.rv-done{color:#4fd1b5;font-size:.72rem;margin-left:.35rem}
```

- [ ] **Step 4: Verify in the browser**

Reload, open the tab, and run in the console:

```js
document.getElementById('login-wall').style.display='none';
localStorage.removeItem(reviewRulesKey()); nav('review');
var before = document.querySelector('.rv-next .rv-title').innerText;
reviewToggleRules();
var after = document.querySelector('.rv-next .rv-title').innerText;
JSON.stringify({ stages: document.querySelectorAll('.rv-stage').length,
  nextBefore: before, nextAfter: after,
  exactlyOneNext: document.querySelectorAll('.rv-next').length });
```

Expected: 6 stages, `nextBefore` is "Know the rules Start here", `nextAfter` is "First-pass review Start here", and `exactlyOneNext` is 1.

- [ ] **Step 5: Commit**

```bash
git add index.html
git commit -m "feat(review): the six-stage path renderer"
```

---

### Task 7: Capability labels on the library cards

**Files:**
- Modify: `index.html`

**Interfaces:**
- Consumes: `QC_CASES`, `qcProjects`, `reviewCardFor`, `REVIEW_LIBRARY`
- Produces: `REVIEW_CARD_QCKEY`; `reviewLabelCards()`

- [ ] **Step 1: Derive the label rather than hardcoding it**

Deriving from `QC_CASES` and `qcProjects` means the label cannot drift out of step with what the drills actually offer. Add to the QC TRACK script section:

```js
var REVIEW_CARD_QCKEY = {
  'openCase(1)':     'joba',
  'openCase(2)':     null,
  'openAICase':      'p4',
  'openEverlawCase': 'p3',
  'openCadeCase':    'ptbr',
  'antitrust':       null,
  'breach':          null,
  'firstam':         'firstam'
};

function reviewCapabilityText(qcKey) {
  if (!qcKey || !QC_CASES[qcKey]) return 'First-pass review';
  var row = qcProjects[qcKey] || {};
  var certifiable = (row.supports_certification != null)
    ? row.supports_certification
    : QC_CASES[qcKey].certification;
  return certifiable
    ? 'First-pass review · QC practice · QC certification'
    : 'First-pass review · QC practice';
}

function reviewLabelCards() {
  for (var needle in REVIEW_CARD_QCKEY) {
    if (!Object.prototype.hasOwnProperty.call(REVIEW_CARD_QCKEY, needle)) continue;
    var card = reviewCardFor(needle);
    if (!card) continue;
    var tag = card.querySelector('.rv-cap');
    if (!tag) {
      tag = document.createElement('div');
      tag.className = 'rv-cap';
      card.appendChild(tag);
    }
    tag.textContent = reviewCapabilityText(REVIEW_CARD_QCKEY[needle]);
  }
}
```

Call it from `renderReviewPage`, immediately after `reviewMoveCards()`:

```js
  if (typeof reviewMoveCards === 'function') reviewMoveCards();
  if (typeof reviewLabelCards === 'function') reviewLabelCards();
```

- [ ] **Step 2: Style the label**

Add at the end of the `/* ── QC TRACK */` CSS block:

```css
.rv-cap{margin-top:.6rem;padding-top:.5rem;border-top:1px solid #1c2740;color:#7d8ca3;font-size:.74rem}
```

- [ ] **Step 3: Verify in the browser**

Reload, open the tab, and run in the console:

```js
document.getElementById('login-wall').style.display='none'; nav('review');
JSON.stringify([...document.querySelectorAll('.rv-cap')].map(function(t){
  var card = t.closest('.proj-case-card, .fl-case-card');
  var title = card.querySelector('.proj-case-title, div[style*="font-weight:800"]');
  return (title ? title.innerText.trim().slice(0,34) : '?') + '  ->  ' + t.textContent;
}), null, 1);
```

Expected: 8 labels. Joba reads "First-pass review · QC practice" (55 documents, never certifiable); TransRidge, Veridian and QuantumEdge read "… · QC certification"; NorthStar, St. Aurelius and Harmon read "First-pass review"; CADE reads "First-pass review · QC practice" while `supports_certification` is false.

- [ ] **Step 4: Commit**

```bash
git add index.html
git commit -m "feat(review): derive capability labels for library cards"
```

---

### Task 8: Repoint inbound links, fix the docs, verify the whole tab

**Files:**
- Modify: `index.html`
- Modify: `CLAUDE.md`

**Interfaces:**
- Consumes: everything from Tasks 1–7
- Produces: no new symbols

- [ ] **Step 1: Repoint the home page links**

Seven links on the home page point at the three retired pages. Find them:

```bash
cd ~/Documents/aa-mastery && grep -n "nav('projects')\|nav('other-projects')\|nav('foreign-review')" index.html
```

Replace every occurrence of `nav('projects')`, `nav('other-projects')` and `nav('foreign-review')` with `nav('review')`. Then confirm none survive:

```bash
cd ~/Documents/aa-mastery && grep -c "nav('projects')\|nav('other-projects')\|nav('foreign-review')" index.html
```

Expected: 0.

The retired `page-projects`, `page-other-projects` and `page-foreign-review` divs stay in the document as empty husks — their cards moved out in Task 5 — and `nav()` simply never shows them. Removing the husks is not worth the markup surgery.

- [ ] **Step 2: Correct the stale documentation**

In `CLAUDE.md`, the "Simulator cases" list claims:

```
- Case 3: `P3_DOCS` — GDPR/AI (Veridian Bank)
```

That matches neither the code nor any card: `openCase` handles only 2 and 4 explicitly, and Veridian is reached through `openEverlawCase()`. Replace that line with:

```
- Case 3: removed — was an unbuilt Spanish-language card that fell through to `REL_DOCS`
```

Then update the pages list in the same file. Replace the `**Pages (15 total):**` sentence's page-id list so `projects`, `other-projects`, `foreign-review` and `qc` are replaced by `review`, and add one line after it:

```
**Doc Review Projects & QC Path** (`page-review`) is the single entry point for every
matter and for the QC programme. It has a six-stage path at the top (`QC.pathStatus`
derives stage state) and a case library below, grouped into `.vpane` divs by platform.
Case cards are moved into those panes at runtime by `reviewMoveCards()` rather than
being duplicated in markup.
```

- [ ] **Step 3: Run the full test suite**

```bash
cd ~/Documents/aa-mastery && node --test
```

Expected: PASS, 122 tests, 0 failures.

- [ ] **Step 4: Verify every route end to end**

Reload and run in the console:

```js
document.getElementById('login-wall').style.display='none'; nav('review');
var launchers = ['openCase(1)','openCase(2)','openAICase','openEverlawCase','openCadeCase','antitrust','breach','firstam'];
var cards = launchers.filter(function(n){ return !!reviewCardFor(n); }).length;
var navGone = ['nav(\'projects\')','nav(\'other-projects\')','nav(\'foreign-review\')','nav(\'qc\')']
  .filter(function(s){ return document.body.innerHTML.indexOf(s) > -1; });
JSON.stringify({
  pathStages: document.querySelectorAll('.rv-stage').length,
  exactlyOneNext: document.querySelectorAll('.rv-next').length,
  cardsPresent: cards,
  capabilityLabels: document.querySelectorAll('.rv-cap').length,
  retiredNavRefsRemaining: navGone,
  velascoGone: document.body.innerHTML.indexOf('Velasco') === -1
});
```

Expected: `pathStages` 6, `exactlyOneNext` 1, `cardsPresent` 8, `capabilityLabels` 8, `retiredNavRefsRemaining` empty, `velascoGone` true.

- [ ] **Step 5: Check the page at a narrow viewport**

Resize to 375px wide and reload. Expected: the path stages stack without clipping, the platform sub-tabs wrap rather than overflow, and `document.body.scrollWidth` does not exceed `window.innerWidth`.

- [ ] **Step 6: Commit**

```bash
git add index.html CLAUDE.md
git commit -m "feat(review): repoint inbound links and document the consolidated tab"
```

---

## Deferred

Recorded so nothing is silently dropped:

- **QC configuration for NorthStar (`CP_DOCS`) and St. Aurelius (`SAH_DOCS`).** Both carry answer keys and could become QC-capable; each needs a vocabulary check and interrupt scripts. Their cards read "First-pass review" until then.
- **Ambiguity lists for Veridian, QuantumEdge and CADE.** These need legal judgement about what is genuinely escalate-worthy, not a textual heuristic. The conditional Escalate button means their absence costs nothing today, and the button reappears by itself once a list is populated.
- **Removing the three empty page husks.** `page-projects`, `page-other-projects` and `page-foreign-review` remain in the document with their cards moved out. Harmless, and deleting them is markup surgery with no user-visible benefit.
- **Per-case readiness.** Readiness stays global: one Accuracy figure per person, not one per matter.
