# QC Track Phase 1 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the QC Review Engine — trainees review documents a prior reviewer already coded, catch the seeded defects, and see their defect rate per 1,000 documents.

**Architecture:** All pure logic (seeded RNG, error generation, defect scoring, pillar mapping) lives in a new `qc-engine.js` loaded as a classic script and unit-tested under Node's built-in test runner. All DOM and Supabase work stays inline in `index.html`, following the existing single-file convention. Two new Postgres tables carry config and results.

**Tech Stack:** Vanilla JS (ES5-compatible, no build step), Node 22 `node --test` for unit tests, Supabase (Postgres + GoTrue), Vercel static hosting.

**Spec:** `docs/superpowers/specs/2026-08-17-qc-track-design.md`

## Global Constraints

- **Accuracy tolerance: 1 defect per 1,000 documents.** Target is 100%.
- **Target pace: 60 docs/hr.** **Response window: 2 minutes.** (Both consumed in Phase 2; stored as config now.)
- **Practice batches: density 0.15, size 50. Certification batches: density 0.02, size 250.**
- **Accuracy pillar is computed over a rolling window of the last 1,000 *certification* documents.** Practice batches never count toward it.
- **Two error types are out of scope for Phase 1:** `INSTRUCTION_DRIFT` (needs interrupts) and `INCONSISTENCY` (needs near-duplicate families). Both arrive in Phase 2.
- **All dynamic DOM content must go through `esc()` (body text) or `escAttr()` (attribute values).** Never raw string interpolation.
- **RLS policies key on the JWT email claim only** — never `display_name`, which is user-settable and spoofable.
- **This repository is public.** No employee name, score, or performance figure is ever written into a committed file.
- **`qc-engine.js` must not use `import` / `export` syntax.** It is loaded two ways — as a classic `<script>` in the browser and via `require()` in the Node test runner — and ES module syntax breaks both paths at once. The UMD-style wrapper in Task 1 is what makes the dual load work. (The file is written in ES5 throughout for internal consistency; `index.html` itself already uses ES6 freely, so the inline QC code may match whichever style surrounds it.)

---

### Task 1: QC engine module, seeded RNG, and serving

Creates the module, proves it loads in both Node and the browser, and fixes the Vercel rewrite that would otherwise serve it as HTML.

**Files:**
- Create: `qc-engine.js`
- Create: `tests/qc-engine.test.js`
- Modify: `vercel.json`
- Modify: `index.html:27` (add script tag after the Axios tag)

**Interfaces:**
- Consumes: nothing
- Produces: `QC.hashSeed(str) -> uint32`, `QC.makeRng(seed:uint32) -> function(): number in [0,1)`. In the browser the module is `window.QC`; in Node it is `require('./qc-engine.js')`.

- [ ] **Step 1: Write the failing test**

Create `tests/qc-engine.test.js`:

```js
'use strict';
var test = require('node:test');
var assert = require('node:assert');
var QC = require('../qc-engine.js');

test('hashSeed is deterministic and returns a uint32', function () {
  assert.strictEqual(QC.hashSeed('abc'), QC.hashSeed('abc'));
  assert.notStrictEqual(QC.hashSeed('abc'), QC.hashSeed('abd'));
  var h = QC.hashSeed('jeff@ataandeadvisors.com|firstam|1');
  assert.ok(h >= 0 && h <= 4294967295, 'in uint32 range');
  assert.strictEqual(h, Math.floor(h), 'is an integer');
});

test('makeRng is deterministic for a given seed', function () {
  var a = QC.makeRng(12345);
  var b = QC.makeRng(12345);
  var seqA = [a(), a(), a(), a(), a()];
  var seqB = [b(), b(), b(), b(), b()];
  assert.deepStrictEqual(seqA, seqB);
});

test('makeRng produces values in [0,1) and differs across seeds', function () {
  var r = QC.makeRng(1);
  for (var i = 0; i < 500; i++) {
    var v = r();
    assert.ok(v >= 0 && v < 1, 'value ' + v + ' out of range');
  }
  assert.notStrictEqual(QC.makeRng(1)(), QC.makeRng(2)());
});

test('makeRng is roughly uniform', function () {
  var r = QC.makeRng(99);
  var buckets = [0, 0, 0, 0];
  for (var i = 0; i < 4000; i++) buckets[Math.floor(r() * 4)]++;
  buckets.forEach(function (c) {
    assert.ok(c > 850 && c < 1150, 'bucket count ' + c + ' not near 1000');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd ~/Documents/aa-mastery && node --test tests/
```

Expected: FAIL — `Cannot find module '../qc-engine.js'`

- [ ] **Step 3: Write minimal implementation**

Create `qc-engine.js`:

```js
/*
 * QC Track engine — pure logic only. No DOM, no network, no globals beyond the
 * single export below. Loaded as a classic script in index.html (window.QC) and
 * as a CommonJS module by the Node test runner (require).
 *
 * ES5 only: this file is served directly to browsers with no build step.
 */
(function (factory) {
  'use strict';
  var QC = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = QC;
  if (typeof window !== 'undefined') window.QC = QC;
})(function () {
  'use strict';

  // FNV-1a. Turns a batch identity string into a uint32 seed.
  function hashSeed(str) {
    var h = 2166136261;
    for (var i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  // mulberry32. Small, fast, and good enough for seeding a document batch.
  function makeRng(seed) {
    var s = seed >>> 0;
    if (s === 0) s = 0x9e3779b9;
    return function () {
      s = (s + 0x6d2b79f5) >>> 0;
      var t = s;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  return {
    hashSeed: hashSeed,
    makeRng: makeRng
  };
});
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd ~/Documents/aa-mastery && node --test tests/
```

Expected: PASS, 4 tests.

- [ ] **Step 5: Make Vercel serve the file**

`vercel.json` currently rewrites every path except `og-image.png`, `accent-trainer`, and `wellness` to `index.html`. Without this change `qc-engine.js` is served as HTML in production and the app breaks only after deploy.

Replace the final rewrite rule's `source` so it reads:

```json
{
  "source": "/((?!og-image\\.png$|qc-engine\\.js$|accent-trainer|wellness).*)",
  "destination": "/index.html"
}
```

- [ ] **Step 6: Load it in the browser**

In `index.html`, immediately after the Axios tag on line 27, add:

```html
<script src="/qc-engine.js"></script>
```

- [ ] **Step 7: Verify it loads in a browser**

```bash
cd ~/Documents/aa-mastery && python3 -m http.server 8000
```

Open `http://localhost:8000`, then in the DevTools console run `typeof QC.makeRng`.
Expected: `"function"`. Confirm no 404 for `/qc-engine.js` in the Network tab.

- [ ] **Step 8: Commit**

```bash
git add qc-engine.js tests/qc-engine.test.js vercel.json index.html
git commit -m "feat(qc): add QC engine module with seeded RNG"
```

---

### Task 2: Coding vocabulary and error taxonomy

Each case uses its own coding vocabulary — `FA_DOCS` codes confidentiality as `confidential`/`hc-aeo` while the JSON sets use `standard`/`highly-conf`/`aeo`, and privilege runs `acp`/`acp-wpp` in one and `privileged`/`fa-flag` in the other. The generator must therefore learn each case's vocabulary from its own documents rather than hardcode values.

**Files:**
- Modify: `qc-engine.js`
- Modify: `tests/qc-engine.test.js`

**Interfaces:**
- Consumes: `QC.hashSeed`, `QC.makeRng` from Task 1
- Produces: `QC.buildVocabulary(docs) -> {responsive:[], privilege:[], action:[], conf:[], issues:[]}` (each sorted); `QC.isPrivileged(value) -> boolean`; `QC.ERROR_TYPES` keyed by type with `{key, weight, freq, label, blurb, spot, applies(answer, vocab), apply(answer, vocab, rng)}`; `QC.PHASE1_TYPES -> string[]`

- [ ] **Step 1: Write the failing test**

Append to `tests/qc-engine.test.js`:

```js
var JSON_SET = [
  { id: 'A1', answer: { responsive: 'responsive', privilege: 'not-privileged', action: 'produce', conf: 'standard', issues: ['issue1'] } },
  { id: 'A2', answer: { responsive: 'non-responsive', privilege: 'not-privileged', action: 'produce', conf: 'highly-conf', issues: [] } },
  { id: 'A3', answer: { responsive: 'responsive', privilege: 'acp-wpp', action: 'withhold', conf: 'aeo', issues: ['issue2', 'issue3'] } }
];

var FA_SET = [
  { id: 'F1', answer: { responsive: 'responsive', privilege: 'fa-flag', action: 'withhold', conf: 'hc-aeo', issues: ['issue1'] } },
  { id: 'F2', answer: { responsive: 'non-responsive', privilege: 'not-privileged', action: 'produce', conf: 'confidential', issues: [] } }
];

test('buildVocabulary collects distinct values, sorted', function () {
  var v = QC.buildVocabulary(JSON_SET);
  assert.deepStrictEqual(v.responsive, ['non-responsive', 'responsive']);
  assert.deepStrictEqual(v.privilege, ['acp-wpp', 'not-privileged']);
  assert.deepStrictEqual(v.conf, ['aeo', 'highly-conf', 'standard']);
  assert.deepStrictEqual(v.issues, ['issue1', 'issue2', 'issue3']);
});

test('buildVocabulary adapts to a different case vocabulary', function () {
  var v = QC.buildVocabulary(FA_SET);
  assert.deepStrictEqual(v.privilege, ['fa-flag', 'not-privileged']);
  assert.deepStrictEqual(v.conf, ['confidential', 'hc-aeo']);
});

test('buildVocabulary is order-independent', function () {
  var forward = QC.buildVocabulary(JSON_SET);
  var backward = QC.buildVocabulary(JSON_SET.slice().reverse());
  assert.deepStrictEqual(forward, backward);
});

test('buildVocabulary tolerates documents with no answer key', function () {
  var v = QC.buildVocabulary([{ id: 'X' }, JSON_SET[0]]);
  assert.deepStrictEqual(v.responsive, ['responsive']);
});

test('isPrivileged treats anything but not-privileged as privileged', function () {
  assert.strictEqual(QC.isPrivileged('acp'), true);
  assert.strictEqual(QC.isPrivileged('fa-flag'), true);
  assert.strictEqual(QC.isPrivileged('privileged'), true);
  assert.strictEqual(QC.isPrivileged('not-privileged'), false);
  assert.strictEqual(QC.isPrivileged(undefined), false);
});

test('PHASE1_TYPES excludes the two Phase 2 error types', function () {
  assert.strictEqual(QC.PHASE1_TYPES.indexOf('INSTRUCTION_DRIFT'), -1);
  assert.strictEqual(QC.PHASE1_TYPES.indexOf('INCONSISTENCY'), -1);
  assert.strictEqual(QC.PHASE1_TYPES.length, 6);
});

test('every error type carries reference copy and a severity weight', function () {
  QC.PHASE1_TYPES.forEach(function (k) {
    var t = QC.ERROR_TYPES[k];
    assert.ok(t, k + ' missing');
    assert.ok(t.weight >= 1 && t.weight <= 5, k + ' weight out of range');
    assert.ok(t.freq > 0, k + ' freq must be positive');
    assert.ok(t.label && t.label.length > 0, k + ' needs a label');
    assert.ok(t.blurb && t.blurb.length > 40, k + ' needs reference copy');
    assert.ok(t.spot && t.spot.length > 20, k + ' needs a how-to-spot line');
  });
});

test('missed privilege is the heaviest error type', function () {
  var weights = QC.PHASE1_TYPES.map(function (k) { return QC.ERROR_TYPES[k].weight; });
  assert.strictEqual(QC.ERROR_TYPES.MISSED_PRIVILEGE.weight, Math.max.apply(null, weights));
});

test('applies() gates each error type to documents that can carry it', function () {
  var v = QC.buildVocabulary(JSON_SET);
  var privileged = JSON_SET[2].answer;
  var clean = JSON_SET[0].answer;
  assert.strictEqual(QC.ERROR_TYPES.MISSED_PRIVILEGE.applies(privileged, v), true);
  assert.strictEqual(QC.ERROR_TYPES.MISSED_PRIVILEGE.applies(clean, v), false);
  assert.strictEqual(QC.ERROR_TYPES.OVER_PRIVILEGE.applies(clean, v), true);
  assert.strictEqual(QC.ERROR_TYPES.OVER_PRIVILEGE.applies(privileged, v), false);
  assert.strictEqual(QC.ERROR_TYPES.UNDER_DESIGNATION.applies(clean, v), true);
  assert.strictEqual(QC.ERROR_TYPES.OVER_DESIGNATION.applies(clean, v), false);
  assert.strictEqual(QC.ERROR_TYPES.OVER_DESIGNATION.applies(JSON_SET[1].answer, v), true);
});

test('apply() returns a patch that actually changes the coding', function () {
  var v = QC.buildVocabulary(JSON_SET);
  var rng = QC.makeRng(7);
  var patch = QC.ERROR_TYPES.MISSED_PRIVILEGE.apply(JSON_SET[2].answer, v, rng);
  assert.strictEqual(patch.privilege, 'not-privileged');
  var patch2 = QC.ERROR_TYPES.CONFIDENTIALITY.apply(JSON_SET[0].answer, v, rng);
  assert.notStrictEqual(patch2.conf, JSON_SET[0].answer.conf);
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd ~/Documents/aa-mastery && node --test tests/
```

Expected: FAIL — `QC.buildVocabulary is not a function`

- [ ] **Step 3: Write minimal implementation**

In `qc-engine.js`, inside the factory and before the `return`, add:

```js
  var CODING_FIELDS = ['responsive', 'privilege', 'action', 'conf'];

  function isPrivileged(v) {
    return typeof v === 'string' && v !== 'not-privileged';
  }

  // Each case set codes with its own vocabulary — FA_DOCS uses confidential /
  // hc-aeo / fa-flag where the JSON sets use standard / aeo / acp-wpp. Learn the
  // vocabulary from the documents rather than hardcoding either one.
  function buildVocabulary(docs) {
    var vocab = { responsive: [], privilege: [], action: [], conf: [], issues: [] };
    var seen = { responsive: {}, privilege: {}, action: {}, conf: {}, issues: {} };
    for (var i = 0; i < docs.length; i++) {
      var a = docs[i] && docs[i].answer;
      if (!a) continue;
      for (var f = 0; f < CODING_FIELDS.length; f++) {
        var field = CODING_FIELDS[f];
        var val = a[field];
        if (typeof val === 'string' && val && !seen[field][val]) {
          seen[field][val] = 1;
          vocab[field].push(val);
        }
      }
      if (Object.prototype.toString.call(a.issues) === '[object Array]') {
        for (var j = 0; j < a.issues.length; j++) {
          var iss = a.issues[j];
          if (!seen.issues[iss]) { seen.issues[iss] = 1; vocab.issues.push(iss); }
        }
      }
    }
    vocab.responsive.sort(); vocab.privilege.sort(); vocab.action.sort();
    vocab.conf.sort(); vocab.issues.sort();
    return vocab;
  }

  function pickFrom(list, rng) {
    return list[Math.floor(rng() * list.length)];
  }

  // freq values are relative real-world frequencies, not probabilities: over-
  // designation is the commonest finding in live QC, missed privilege the rarest
  // and most severe. They are normalised at selection time.
  var ERROR_TYPES = {
    MISSED_PRIVILEGE: {
      key: 'MISSED_PRIVILEGE', weight: 5, freq: 3,
      label: 'Missed privilege',
      blurb: 'A privileged document coded as not privileged. The most serious defect in review: protected material lands in a production, and recovering it means a clawback, an explanation to the client, and a re-review of everything around it.',
      spot: 'Read the participants before you read the text. Counsel on the From, To or CC line changes the analysis of everything below it.',
      applies: function (a) { return isPrivileged(a.privilege); },
      apply: function () { return { privilege: 'not-privileged', action: 'produce' }; }
    },
    OVER_PRIVILEGE: {
      key: 'OVER_PRIVILEGE', weight: 3, freq: 6,
      label: 'Over-privilege',
      blurb: 'A clean document withheld as privileged. It delays the production, inflates the privilege log, and invites a challenge that costs the client money to defend.',
      spot: 'A lawyer in the thread does not make a document privileged. Ask what legal advice is actually being sought or given.',
      applies: function (a, v) {
        if (isPrivileged(a.privilege)) return false;
        for (var i = 0; i < v.privilege.length; i++) if (isPrivileged(v.privilege[i])) return true;
        return false;
      },
      apply: function (a, v, rng) {
        var opts = [];
        for (var i = 0; i < v.privilege.length; i++) if (isPrivileged(v.privilege[i])) opts.push(v.privilege[i]);
        return { privilege: pickFrom(opts, rng), action: 'withhold' };
      }
    },
    UNDER_DESIGNATION: {
      key: 'UNDER_DESIGNATION', weight: 3, freq: 10,
      label: 'Under-designation',
      blurb: 'Responsive material coded non-responsive. The document is never produced and never surfaces again, so nobody downstream is in a position to catch the mistake.',
      spot: 'Check the document against every issue in the protocol, not only the one you are already pattern-matching on.',
      applies: function (a, v) {
        return a.responsive === 'responsive' && v.responsive.indexOf('non-responsive') !== -1;
      },
      apply: function () { return { responsive: 'non-responsive', issues: [] }; }
    },
    OVER_DESIGNATION: {
      key: 'OVER_DESIGNATION', weight: 2, freq: 30,
      label: 'Over-designation',
      blurb: 'Non-responsive material coded responsive. The commonest finding in real QC. It inflates the production, raises the client’s cost per document, and buries the material that actually matters.',
      spot: 'Responsiveness needs a link to a specific issue. "It mentions the company" is not a link.',
      applies: function (a, v) {
        return a.responsive === 'non-responsive' && v.responsive.indexOf('responsive') !== -1;
      },
      apply: function (a, v, rng) {
        return { responsive: 'responsive', issues: v.issues.length ? [pickFrom(v.issues, rng)] : [] };
      }
    },
    CONFIDENTIALITY: {
      key: 'CONFIDENTIALITY', weight: 2, freq: 12,
      label: 'Confidentiality mis-designation',
      blurb: 'The wrong confidentiality tier. Under-designating exposes client material to people who should not see it; over-designating triggers a challenge and a re-review of the whole set.',
      spot: 'The tier follows the content, not the sender. A routine scheduling email from an executive is still routine.',
      applies: function (a, v) { return !!a.conf && v.conf.length > 1; },
      apply: function (a, v, rng) {
        var opts = [];
        for (var i = 0; i < v.conf.length; i++) if (v.conf[i] !== a.conf) opts.push(v.conf[i]);
        return { conf: pickFrom(opts, rng) };
      }
    },
    WRONG_ISSUES: {
      key: 'WRONG_ISSUES', weight: 1, freq: 25,
      label: 'Wrong issue tags',
      blurb: 'The right responsiveness call with the wrong issue codes. Low severity on its own, but it silently corrupts every issue-based search, report and privilege cut built on top of the set.',
      spot: 'Re-read the issue definitions in the protocol. Tagging by topic rather than by the protocol’s definition is the usual cause.',
      applies: function (a, v) {
        return Object.prototype.toString.call(a.issues) === '[object Array]' &&
               a.issues.length > 0 && v.issues.length > 1;
      },
      apply: function (a, v, rng) {
        var others = [];
        for (var i = 0; i < v.issues.length; i++) {
          if (a.issues.indexOf(v.issues[i]) === -1) others.push(v.issues[i]);
        }
        if (!others.length) return { issues: a.issues.slice(0, a.issues.length - 1) };
        return { issues: [pickFrom(others, rng)] };
      }
    }
  };

  var PHASE1_TYPES = [
    'MISSED_PRIVILEGE', 'OVER_PRIVILEGE', 'UNDER_DESIGNATION',
    'OVER_DESIGNATION', 'CONFIDENTIALITY', 'WRONG_ISSUES'
  ];
```

Add to the returned object: `isPrivileged: isPrivileged, buildVocabulary: buildVocabulary, ERROR_TYPES: ERROR_TYPES, PHASE1_TYPES: PHASE1_TYPES`.

- [ ] **Step 4: Run test to verify it passes**

```bash
cd ~/Documents/aa-mastery && node --test tests/
```

Expected: PASS, 14 tests.

- [ ] **Step 5: Commit**

```bash
git add qc-engine.js tests/qc-engine.test.js
git commit -m "feat(qc): derive coding vocabulary per case and define the error taxonomy"
```

---

### Task 3: Error seeding generator

**Files:**
- Modify: `qc-engine.js`
- Modify: `tests/qc-engine.test.js`

**Interfaces:**
- Consumes: `QC.makeRng`, `QC.hashSeed`, `QC.buildVocabulary`, `QC.ERROR_TYPES`, `QC.PHASE1_TYPES`
- Produces: `QC.seedErrors(docs, opts) -> Array<{doc, priorCoding, seededError}>` where `opts` is `{seed:string, density:number, vocabulary?:object, allowedTypes?:string[]}` and `seededError` is `null` or `{type:string, weight:number, patch:object}`

- [ ] **Step 1: Write the failing test**

Append to `tests/qc-engine.test.js`:

```js
function bigSet(n) {
  var out = [];
  for (var i = 0; i < n; i++) {
    var privileged = i % 7 === 0;
    var responsive = i % 3 !== 0;
    out.push({
      id: 'D' + i,
      answer: {
        responsive: responsive ? 'responsive' : 'non-responsive',
        privilege: privileged ? 'acp' : 'not-privileged',
        action: privileged ? 'withhold' : 'produce',
        conf: ['standard', 'highly-conf', 'aeo'][i % 3],
        issues: responsive ? ['issue' + (1 + (i % 3))] : []
      }
    });
  }
  return out;
}

test('seedErrors is deterministic for the same seed', function () {
  var docs = bigSet(200);
  var a = QC.seedErrors(docs, { seed: 'u|firstam|1', density: 0.15 });
  var b = QC.seedErrors(docs, { seed: 'u|firstam|1', density: 0.15 });
  assert.deepStrictEqual(
    a.map(function (e) { return e.seededError && e.seededError.type; }),
    b.map(function (e) { return e.seededError && e.seededError.type; })
  );
});

test('seedErrors differs across seeds', function () {
  var docs = bigSet(200);
  var a = QC.seedErrors(docs, { seed: 'u|firstam|1', density: 0.15 });
  var b = QC.seedErrors(docs, { seed: 'u|firstam|2', density: 0.15 });
  var sameCount = 0;
  for (var i = 0; i < a.length; i++) {
    var ta = a[i].seededError && a[i].seededError.type;
    var tb = b[i].seededError && b[i].seededError.type;
    if (ta === tb) sameCount++;
  }
  assert.ok(sameCount < a.length, 'two seeds produced identical batches');
});

test('seedErrors respects practice density within tolerance', function () {
  var docs = bigSet(1000);
  var seeded = QC.seedErrors(docs, { seed: 's', density: 0.15 });
  var n = seeded.filter(function (e) { return e.seededError; }).length;
  assert.ok(n > 110 && n < 190, 'expected ~150 errors, got ' + n);
});

test('seedErrors respects certification density within tolerance', function () {
  var docs = bigSet(1000);
  var seeded = QC.seedErrors(docs, { seed: 's', density: 0.02 });
  var n = seeded.filter(function (e) { return e.seededError; }).length;
  assert.ok(n > 8 && n < 40, 'expected ~20 errors, got ' + n);
});

test('seedErrors never seeds an error a document cannot carry', function () {
  var docs = bigSet(500);
  QC.seedErrors(docs, { seed: 's', density: 0.5 }).forEach(function (e) {
    if (!e.seededError) return;
    var t = QC.ERROR_TYPES[e.seededError.type];
    assert.strictEqual(t.applies(e.doc.answer, QC.buildVocabulary(docs)), true,
      e.seededError.type + ' seeded on an ineligible document ' + e.doc.id);
  });
});

test('seedErrors leaves the source document untouched', function () {
  var docs = bigSet(50);
  var before = JSON.stringify(docs);
  QC.seedErrors(docs, { seed: 's', density: 0.9 });
  assert.strictEqual(JSON.stringify(docs), before, 'source documents were mutated');
});

test('priorCoding equals the answer when no error is seeded', function () {
  var docs = bigSet(100);
  QC.seedErrors(docs, { seed: 's', density: 0.15 }).forEach(function (e) {
    if (e.seededError) return;
    assert.deepStrictEqual(e.priorCoding, e.doc.answer);
  });
});

test('priorCoding differs from the answer when an error is seeded', function () {
  var docs = bigSet(300);
  var any = false;
  QC.seedErrors(docs, { seed: 's', density: 0.4 }).forEach(function (e) {
    if (!e.seededError) return;
    any = true;
    assert.notDeepStrictEqual(e.priorCoding, e.doc.answer, e.doc.id + ' unchanged');
  });
  assert.ok(any, 'no errors were seeded at all');
});

test('seedErrors honours allowedTypes', function () {
  var docs = bigSet(400);
  QC.seedErrors(docs, { seed: 's', density: 0.5, allowedTypes: ['WRONG_ISSUES'] })
    .forEach(function (e) {
      if (e.seededError) assert.strictEqual(e.seededError.type, 'WRONG_ISSUES');
    });
});

test('seedErrors defaults to the Phase 1 type set', function () {
  var docs = bigSet(400);
  QC.seedErrors(docs, { seed: 's', density: 0.5 }).forEach(function (e) {
    if (e.seededError) {
      assert.notStrictEqual(QC.PHASE1_TYPES.indexOf(e.seededError.type), -1,
        'seeded a non-Phase-1 type: ' + e.seededError.type);
    }
  });
});

test('over-designation appears more often than missed privilege', function () {
  var docs = bigSet(2000);
  var counts = {};
  QC.seedErrors(docs, { seed: 'freq', density: 0.5 }).forEach(function (e) {
    if (e.seededError) counts[e.seededError.type] = (counts[e.seededError.type] || 0) + 1;
  });
  assert.ok((counts.OVER_DESIGNATION || 0) > (counts.MISSED_PRIVILEGE || 0),
    'frequency weighting not applied');
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd ~/Documents/aa-mastery && node --test tests/
```

Expected: FAIL — `QC.seedErrors is not a function`

- [ ] **Step 3: Write minimal implementation**

Add to `qc-engine.js` before the `return`:

```js
  function copyAnswer(a) {
    var out = {};
    for (var k in a) {
      if (!Object.prototype.hasOwnProperty.call(a, k)) continue;
      out[k] = Object.prototype.toString.call(a[k]) === '[object Array]' ? a[k].slice() : a[k];
    }
    return out;
  }

  function pickWeighted(candidates, rng) {
    var total = 0, i;
    for (i = 0; i < candidates.length; i++) total += candidates[i].freq;
    var roll = rng() * total;
    for (i = 0; i < candidates.length; i++) {
      roll -= candidates[i].freq;
      if (roll <= 0) return candidates[i];
    }
    return candidates[candidates.length - 1];
  }

  // Produces the coding a prior reviewer "submitted": either the correct answer,
  // or the answer mutated into a plausible mistake. Source documents are never
  // modified — priorCoding is always a fresh object.
  function seedErrors(docs, opts) {
    opts = opts || {};
    var density = opts.density == null ? 0.15 : opts.density;
    var vocab = opts.vocabulary || buildVocabulary(docs);
    var allowed = opts.allowedTypes || PHASE1_TYPES;
    var rng = opts.rng || makeRng(hashSeed(opts.seed || 'default'));
    var out = [];

    for (var i = 0; i < docs.length; i++) {
      var doc = docs[i];
      var answer = doc.answer || {};
      var prior = copyAnswer(answer);
      var seeded = null;

      // Draw for every document, error or not, so the stream stays aligned and
      // the batch remains reproducible from the seed alone.
      var roll = rng();
      if (roll < density) {
        var candidates = [];
        for (var t = 0; t < allowed.length; t++) {
          var type = ERROR_TYPES[allowed[t]];
          if (type && type.applies(answer, vocab)) candidates.push(type);
        }
        if (candidates.length) {
          var picked = pickWeighted(candidates, rng);
          var patch = picked.apply(answer, vocab, rng);
          for (var f in patch) {
            if (Object.prototype.hasOwnProperty.call(patch, f)) prior[f] = patch[f];
          }
          seeded = { type: picked.key, weight: picked.weight, patch: patch };
        }
      }
      out.push({ doc: doc, priorCoding: prior, seededError: seeded });
    }
    return out;
  }
```

Add `seedErrors: seedErrors` to the returned object.

- [ ] **Step 4: Run test to verify it passes**

```bash
cd ~/Documents/aa-mastery && node --test tests/
```

Expected: PASS, 25 tests.

- [ ] **Step 5: Commit**

```bash
git add qc-engine.js tests/qc-engine.test.js
git commit -m "feat(qc): seed plausible prior-reviewer errors from answer keys"
```

---

### Task 4: Decision classification and batch scoring

The two-sided scoring from the spec. Rubber-stamping and over-correcting are both defects.

**Files:**
- Modify: `qc-engine.js`
- Modify: `tests/qc-engine.test.js`

**Interfaces:**
- Consumes: `QC.seedErrors` output shape
- Produces: `QC.codingMatches(a, b) -> boolean`; `QC.classifyDecision(entry, decision, isAmbiguous) -> {correct:boolean, defect:string|null, weight:number}`; `QC.scoreBatch(entries, decisions, opts) -> {docsReviewed, defects, defectsPer1000, counts, diagnostics}`. `decision` is `{action:'agree'|'correct'|'escalate', coding?:object}`. `decisions` is an array parallel to `entries`. `opts` is `{ambiguousIds?:string[]}`.

Defect weights, from the spec: miss = `w(e)`; bad fix = `w(e)/2`; false correction = 2; missed escalation = 2; over-escalation = 1. Total defects are normalised by dividing by 2, so weight-2 is one defect unit.

- [ ] **Step 1: Write the failing test**

Append to `tests/qc-engine.test.js`:

```js
function entryWith(answer, prior, seeded) {
  return { doc: { id: 'T1', answer: answer }, priorCoding: prior, seededError: seeded };
}
var ANS = { responsive: 'responsive', privilege: 'acp', action: 'withhold', conf: 'standard', issues: ['issue1'] };

test('codingMatches ignores key order and issue order', function () {
  assert.strictEqual(QC.codingMatches(
    { responsive: 'responsive', issues: ['a', 'b'] },
    { issues: ['b', 'a'], responsive: 'responsive' }
  ), true);
  assert.strictEqual(QC.codingMatches({ issues: ['a'] }, { issues: ['a', 'b'] }), false);
  assert.strictEqual(QC.codingMatches({ conf: 'standard' }, { conf: 'aeo' }), false);
});

test('agreeing with a clean document is correct', function () {
  var e = entryWith(ANS, ANS, null);
  var r = QC.classifyDecision(e, { action: 'agree' }, false);
  assert.strictEqual(r.correct, true);
  assert.strictEqual(r.defect, null);
});

test('agreeing with a seeded error is a miss at the error weight', function () {
  var prior = { responsive: 'responsive', privilege: 'not-privileged', action: 'produce', conf: 'standard', issues: ['issue1'] };
  var e = entryWith(ANS, prior, { type: 'MISSED_PRIVILEGE', weight: 5, patch: {} });
  var r = QC.classifyDecision(e, { action: 'agree' }, false);
  assert.strictEqual(r.correct, false);
  assert.strictEqual(r.defect, 'MISS');
  assert.strictEqual(r.weight, 5);
});

test('correcting a seeded error to the right value is correct', function () {
  var prior = { responsive: 'responsive', privilege: 'not-privileged', action: 'produce', conf: 'standard', issues: ['issue1'] };
  var e = entryWith(ANS, prior, { type: 'MISSED_PRIVILEGE', weight: 5, patch: {} });
  var r = QC.classifyDecision(e, { action: 'correct', coding: ANS }, false);
  assert.strictEqual(r.correct, true);
});

test('correcting a seeded error to a wrong value is a bad fix at half weight', function () {
  var prior = { responsive: 'responsive', privilege: 'not-privileged', action: 'produce', conf: 'standard', issues: ['issue1'] };
  var e = entryWith(ANS, prior, { type: 'MISSED_PRIVILEGE', weight: 5, patch: {} });
  var wrong = { responsive: 'responsive', privilege: 'acp', action: 'withhold', conf: 'aeo', issues: ['issue1'] };
  var r = QC.classifyDecision(e, { action: 'correct', coding: wrong }, false);
  assert.strictEqual(r.defect, 'BAD_FIX');
  assert.strictEqual(r.weight, 2.5);
});

test('changing a clean document is a false correction at weight 2', function () {
  var e = entryWith(ANS, ANS, null);
  var changed = { responsive: 'non-responsive', privilege: 'acp', action: 'withhold', conf: 'standard', issues: [] };
  var r = QC.classifyDecision(e, { action: 'correct', coding: changed }, false);
  assert.strictEqual(r.defect, 'FALSE_CORRECTION');
  assert.strictEqual(r.weight, 2);
});

test('submitting an identical coding as a correction is not a defect', function () {
  var e = entryWith(ANS, ANS, null);
  var r = QC.classifyDecision(e, { action: 'correct', coding: ANS }, false);
  assert.strictEqual(r.correct, true);
});

test('escalating an ambiguous document is correct', function () {
  var e = entryWith(ANS, ANS, null);
  assert.strictEqual(QC.classifyDecision(e, { action: 'escalate' }, true).correct, true);
});

test('resolving an ambiguous document instead of escalating is a defect', function () {
  var e = entryWith(ANS, ANS, null);
  var r = QC.classifyDecision(e, { action: 'agree' }, true);
  assert.strictEqual(r.defect, 'MISSED_ESCALATION');
  assert.strictEqual(r.weight, 2);
});

test('escalating a clear document is over-escalation at weight 1', function () {
  var e = entryWith(ANS, ANS, null);
  var r = QC.classifyDecision(e, { action: 'escalate' }, false);
  assert.strictEqual(r.defect, 'OVER_ESCALATION');
  assert.strictEqual(r.weight, 1);
});

test('scoreBatch normalises defects against weight 2', function () {
  var priorMissed = { responsive: 'responsive', privilege: 'not-privileged', action: 'produce', conf: 'standard', issues: ['issue1'] };
  var entries = [
    entryWith(ANS, priorMissed, { type: 'MISSED_PRIVILEGE', weight: 5, patch: {} }),
    entryWith(ANS, ANS, null)
  ];
  var decisions = [{ action: 'agree' }, { action: 'agree' }];
  var s = QC.scoreBatch(entries, decisions, {});
  assert.strictEqual(s.docsReviewed, 2);
  assert.strictEqual(s.defects, 2.5);          // one weight-5 miss / 2
  assert.strictEqual(s.defectsPer1000, 1250);
  assert.strictEqual(s.counts.MISS, 1);
});

test('a flawless batch scores zero defects', function () {
  var entries = [entryWith(ANS, ANS, null), entryWith(ANS, ANS, null)];
  var s = QC.scoreBatch(entries, [{ action: 'agree' }, { action: 'agree' }], {});
  assert.strictEqual(s.defects, 0);
  assert.strictEqual(s.defectsPer1000, 0);
});

test('scoreBatch reports catch rate and false-correction rate as diagnostics', function () {
  var priorMissed = { responsive: 'responsive', privilege: 'not-privileged', action: 'produce', conf: 'standard', issues: ['issue1'] };
  var entries = [
    entryWith(ANS, priorMissed, { type: 'MISSED_PRIVILEGE', weight: 5, patch: {} }),
    entryWith(ANS, ANS, null),
    entryWith(ANS, ANS, null)
  ];
  var decisions = [
    { action: 'correct', coding: ANS },                                   // caught
    { action: 'agree' },                                                  // fine
    { action: 'correct', coding: { responsive: 'non-responsive', privilege: 'acp', action: 'withhold', conf: 'standard', issues: [] } }
  ];
  var s = QC.scoreBatch(entries, decisions, {});
  assert.strictEqual(s.diagnostics.catchRate, 1);
  assert.strictEqual(s.diagnostics.falseCorrectionRate, 0.5);   // 1 of 2 clean docs
  assert.strictEqual(s.diagnostics.familyAgreement, null);      // Phase 2
});

test('scoreBatch treats listed ids as ambiguous', function () {
  var e = { doc: { id: 'AMB1', answer: ANS }, priorCoding: ANS, seededError: null };
  var s = QC.scoreBatch([e], [{ action: 'escalate' }], { ambiguousIds: ['AMB1'] });
  assert.strictEqual(s.defects, 0);
});

test('scoreBatch handles an unreviewed batch without dividing by zero', function () {
  var s = QC.scoreBatch([], [], {});
  assert.strictEqual(s.docsReviewed, 0);
  assert.strictEqual(s.defectsPer1000, 0);
  assert.strictEqual(s.diagnostics.catchRate, null);
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd ~/Documents/aa-mastery && node --test tests/
```

Expected: FAIL — `QC.codingMatches is not a function`

- [ ] **Step 3: Write minimal implementation**

Add to `qc-engine.js` before the `return`:

```js
  function sameIssues(a, b) {
    var x = (a || []).slice().sort();
    var y = (b || []).slice().sort();
    if (x.length !== y.length) return false;
    for (var i = 0; i < x.length; i++) if (x[i] !== y[i]) return false;
    return true;
  }

  function codingMatches(a, b) {
    a = a || {}; b = b || {};
    for (var i = 0; i < CODING_FIELDS.length; i++) {
      var f = CODING_FIELDS[i];
      if ((a[f] || null) !== (b[f] || null)) return false;
    }
    return sameIssues(a.issues, b.issues);
  }

  var DEFECT_WEIGHTS = { FALSE_CORRECTION: 2, MISSED_ESCALATION: 2, OVER_ESCALATION: 1 };

  function ok() { return { correct: true, defect: null, weight: 0 }; }
  function bad(defect, weight) { return { correct: false, defect: defect, weight: weight }; }

  function classifyDecision(entry, decision, isAmbiguous) {
    var action = decision && decision.action;
    var truth = entry.doc.answer || {};

    if (isAmbiguous) {
      return action === 'escalate' ? ok() : bad('MISSED_ESCALATION', DEFECT_WEIGHTS.MISSED_ESCALATION);
    }
    if (action === 'escalate') {
      return bad('OVER_ESCALATION', DEFECT_WEIGHTS.OVER_ESCALATION);
    }

    var seeded = entry.seededError;
    if (action === 'correct') {
      if (codingMatches(decision.coding, truth)) return ok();
      return seeded
        ? bad('BAD_FIX', seeded.weight / 2)
        : bad('FALSE_CORRECTION', DEFECT_WEIGHTS.FALSE_CORRECTION);
    }
    // agree
    return seeded ? bad('MISS', seeded.weight) : ok();
  }

  function scoreBatch(entries, decisions, opts) {
    opts = opts || {};
    var ambiguous = {};
    (opts.ambiguousIds || []).forEach(function (id) { ambiguous[id] = 1; });

    var counts = { MISS: 0, BAD_FIX: 0, FALSE_CORRECTION: 0, MISSED_ESCALATION: 0, OVER_ESCALATION: 0, CORRECT: 0 };
    var weighted = 0, cleanDocs = 0, falseCorrections = 0;
    var seededWeight = 0, caughtWeight = 0;

    for (var i = 0; i < entries.length; i++) {
      var e = entries[i];
      var isAmb = !!ambiguous[e.doc.id];
      var r = classifyDecision(e, decisions[i] || { action: 'agree' }, isAmb);

      if (r.defect) { counts[r.defect]++; weighted += r.weight; } else { counts.CORRECT++; }

      if (!isAmb) {
        if (e.seededError) {
          seededWeight += e.seededError.weight;
          if (r.correct) caughtWeight += e.seededError.weight;
          else if (r.defect === 'BAD_FIX') caughtWeight += e.seededError.weight * 0.5;
        } else {
          cleanDocs++;
          if (r.defect === 'FALSE_CORRECTION') falseCorrections++;
        }
      }
    }

    var defects = weighted / 2;
    return {
      docsReviewed: entries.length,
      defects: defects,
      defectsPer1000: entries.length ? (1000 * defects / entries.length) : 0,
      counts: counts,
      diagnostics: {
        catchRate: seededWeight ? (caughtWeight / seededWeight) : null,
        falseCorrectionRate: cleanDocs ? (falseCorrections / cleanDocs) : null,
        familyAgreement: null   // Phase 2 — requires near-duplicate families
      }
    };
  }
```

Add `codingMatches: codingMatches, classifyDecision: classifyDecision, scoreBatch: scoreBatch` to the returned object.

- [ ] **Step 4: Run test to verify it passes**

```bash
cd ~/Documents/aa-mastery && node --test tests/
```

Expected: PASS, 40 tests.

- [ ] **Step 5: Commit**

```bash
git add qc-engine.js tests/qc-engine.test.js
git commit -m "feat(qc): two-sided defect scoring for QC decisions"
```

---

### Task 5: Accuracy pillar and the rolling 1,000-document window

**Files:**
- Modify: `qc-engine.js`
- Modify: `tests/qc-engine.test.js`

**Interfaces:**
- Consumes: batch results from Task 4
- Produces: `QC.ACCURACY_ANCHORS -> Array<[defectsPer1000, pillar]>`; `QC.accuracyPillar(defectsPer1000) -> number 0..100`; `QC.rollingAccuracy(attempts, windowSize) -> {documents, defects, defectsPer1000, pillar, partial}`. `attempts` is an array of `{batch_type, docs_reviewed, defects, completed_at}` in any order; only `batch_type === 'certification'` rows count.

- [ ] **Step 1: Write the failing test**

Append to `tests/qc-engine.test.js`:

```js
test('accuracyPillar hits every published anchor exactly', function () {
  QC.ACCURACY_ANCHORS.forEach(function (pair) {
    assert.strictEqual(QC.accuracyPillar(pair[0]), pair[1], 'anchor ' + pair[0]);
  });
});

test('accuracyPillar interpolates between anchors and is monotonic', function () {
  assert.strictEqual(QC.accuracyPillar(1.5), 92.5);   // between (1,95) and (2,90)
  var prev = 101;
  [0, 0.5, 1, 2, 3, 5, 8, 10, 15, 20, 30, 40, 50, 60, 200].forEach(function (x) {
    var y = QC.accuracyPillar(x);
    assert.ok(y <= prev, 'pillar rose at ' + x);
    assert.ok(y >= 0 && y <= 100, 'pillar out of range at ' + x);
    prev = y;
  });
});

test('the QC-Ready floor of 90 means 2 defects per 1,000', function () {
  assert.strictEqual(QC.accuracyPillar(2), 90);
  assert.ok(QC.accuracyPillar(2.1) < 90);
});

test('accuracyPillar floors at zero beyond the last anchor', function () {
  assert.strictEqual(QC.accuracyPillar(60), 0);
  assert.strictEqual(QC.accuracyPillar(500), 0);
});

test('rollingAccuracy ignores practice batches entirely', function () {
  var r = QC.rollingAccuracy([
    { batch_type: 'practice', docs_reviewed: 50, defects: 20, completed_at: '2026-08-01' },
    { batch_type: 'certification', docs_reviewed: 250, defects: 1, completed_at: '2026-08-02' }
  ], 1000);
  assert.strictEqual(r.documents, 250);
  assert.strictEqual(r.defects, 1);
});

test('rollingAccuracy fills the window newest-first and stops at the limit', function () {
  var attempts = [];
  for (var i = 1; i <= 8; i++) {
    attempts.push({ batch_type: 'certification', docs_reviewed: 250, defects: i, completed_at: '2026-08-0' + i });
  }
  var r = QC.rollingAccuracy(attempts, 1000);
  assert.strictEqual(r.documents, 1000);
  assert.strictEqual(r.defects, 8 + 7 + 6 + 5, 'should take the four newest');
  assert.strictEqual(r.partial, false);
});

test('rollingAccuracy reports a partial window honestly', function () {
  var r = QC.rollingAccuracy([
    { batch_type: 'certification', docs_reviewed: 250, defects: 1, completed_at: '2026-08-02' },
    { batch_type: 'certification', docs_reviewed: 250, defects: 2, completed_at: '2026-08-03' }
  ], 1000);
  assert.strictEqual(r.documents, 500);
  assert.strictEqual(r.defects, 3);
  assert.strictEqual(r.defectsPer1000, 6);
  assert.strictEqual(r.partial, true);
});

test('rollingAccuracy with no certification data returns a null pillar', function () {
  var r = QC.rollingAccuracy([{ batch_type: 'practice', docs_reviewed: 50, defects: 0, completed_at: '2026-08-01' }], 1000);
  assert.strictEqual(r.documents, 0);
  assert.strictEqual(r.pillar, null);
  assert.strictEqual(r.partial, true);
});

test('rollingAccuracy converts one defect in a thousand to the tolerance line', function () {
  var r = QC.rollingAccuracy([
    { batch_type: 'certification', docs_reviewed: 1000, defects: 1, completed_at: '2026-08-05' }
  ], 1000);
  assert.strictEqual(r.defectsPer1000, 1);
  assert.strictEqual(r.pillar, 95);
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd ~/Documents/aa-mastery && node --test tests/
```

Expected: FAIL — `QC.ACCURACY_ANCHORS is undefined`

- [ ] **Step 3: Write minimal implementation**

Add to `qc-engine.js` before the `return`:

```js
  // Calibration, not a derived law. Held in one table so it can be retuned once
  // real QC-Recognized outcomes accumulate. 2 defects/1,000 == pillar 90 is the
  // QC-Ready floor and matches the stated 1-in-1,000 tolerance plus headroom for
  // a single low-severity slip.
  var ACCURACY_ANCHORS = [
    [0, 100], [1, 95], [2, 90], [5, 78], [10, 60], [20, 35], [40, 10], [60, 0]
  ];

  function accuracyPillar(defectsPer1000) {
    var x = defectsPer1000;
    if (!(x > 0)) return 100;
    var last = ACCURACY_ANCHORS[ACCURACY_ANCHORS.length - 1];
    if (x >= last[0]) return 0;
    for (var i = 1; i < ACCURACY_ANCHORS.length; i++) {
      if (x <= ACCURACY_ANCHORS[i][0]) {
        var x0 = ACCURACY_ANCHORS[i - 1][0], y0 = ACCURACY_ANCHORS[i - 1][1];
        var x1 = ACCURACY_ANCHORS[i][0], y1 = ACCURACY_ANCHORS[i][1];
        return y0 + (y1 - y0) * (x - x0) / (x1 - x0);
      }
    }
    return 0;
  }

  // The denominator is literally 1,000 documents: the pillar IS the client's
  // metric, with no rescaling. Practice batches never contribute.
  function rollingAccuracy(attempts, windowSize) {
    var limit = windowSize || 1000;
    var certs = [];
    for (var i = 0; i < (attempts || []).length; i++) {
      if (attempts[i] && attempts[i].batch_type === 'certification') certs.push(attempts[i]);
    }
    certs.sort(function (a, b) {
      return String(b.completed_at || '').localeCompare(String(a.completed_at || ''));
    });

    var documents = 0, defects = 0;
    for (var j = 0; j < certs.length && documents < limit; j++) {
      documents += certs[j].docs_reviewed || 0;
      defects += certs[j].defects || 0;
    }

    var rate = documents ? (1000 * defects / documents) : 0;
    return {
      documents: documents,
      defects: defects,
      defectsPer1000: rate,
      pillar: documents ? accuracyPillar(rate) : null,
      partial: documents < limit
    };
  }
```

Add `ACCURACY_ANCHORS: ACCURACY_ANCHORS, accuracyPillar: accuracyPillar, rollingAccuracy: rollingAccuracy` to the returned object.

- [ ] **Step 4: Run test to verify it passes**

```bash
cd ~/Documents/aa-mastery && node --test tests/
```

Expected: PASS, 49 tests.

- [ ] **Step 5: Commit**

```bash
git add qc-engine.js tests/qc-engine.test.js
git commit -m "feat(qc): accuracy pillar and rolling 1,000-document window"
```

---

### Task 6: Database migration

**Files:**
- Create: `supabase/migrations/20260817_qc_track.sql`

**Interfaces:**
- Consumes: nothing
- Produces: tables `public.qc_projects` and `public.qc_attempts`; both read by Task 11.

- [ ] **Step 1: Write the migration**

Create `supabase/migrations/20260817_qc_track.sql`:

```sql
-- QC Track — Phase 1.
--
-- Two rules govern qc_attempts, for the same reasons set out in
-- 20260727_wellness_flags.sql:
--   1. Access is enforced here, in Postgres — never in the browser.
--   2. Policies key on the JWT email claim only. The app's client-side
--      isLeadership() also matches display_name against LEADERSHIP_NAMES, and
--      display_name is user-settable metadata and therefore spoofable. It is
--      fine for showing or hiding a button; it must never appear here.
--
-- This repository is public. No score and no employee name is ever committed to
-- a file — performance data lives only in these tables.

create table public.qc_projects (
  case_key                  text primary key,
  display_name              text not null,
  target_pace_docs_per_hour numeric not null default 60,
  max_defects_per_1000      numeric not null default 1,
  response_window_minutes   int     not null default 2,
  practice_density          numeric not null default 0.15,
  practice_batch_size       int     not null default 50,
  cert_density              numeric not null default 0.02,
  cert_batch_size           int     not null default 250,
  supports_certification    boolean not null default false,
  active                    boolean not null default true,
  updated_at                timestamptz not null default now()
);

-- Joba has 55 documents: enough for a 50-document practice batch, not for a
-- 250-document certification batch. TransRidge carries both.
insert into public.qc_projects (case_key, display_name, supports_certification) values
  ('joba',    'Joba v. Bukando',                      false),
  ('firstam', 'TransRidge v. Cascade Headwaters',     true);

alter table public.qc_projects enable row level security;

create policy "all_read_qc_projects" on public.qc_projects
  for select to authenticated using (true);

create policy "leadership_write_qc_projects" on public.qc_projects
  for all to authenticated
  using      ((auth.jwt() ->> 'email') in ('jeff@ataandeadvisors.com'))
  with check ((auth.jwt() ->> 'email') in ('jeff@ataandeadvisors.com'));

create table public.qc_attempts (
  id             uuid primary key default gen_random_uuid(),
  user_email     text not null,
  case_key       text not null references public.qc_projects(case_key),
  batch_no       int  not null,
  batch_type     text not null check (batch_type in ('practice','certification')),
  seed           text not null,
  started_at     timestamptz not null,
  completed_at   timestamptz,
  docs_reviewed  int     not null default 0,
  defects        numeric,
  accuracy       numeric,
  detail         jsonb   not null default '{}'::jsonb,
  created_at     timestamptz not null default now()
);

create index qc_attempts_user_idx on public.qc_attempts (user_email, completed_at desc);

alter table public.qc_attempts enable row level security;

-- A person records batches only as themselves.
create policy "own_insert_qc_attempts" on public.qc_attempts
  for insert to authenticated
  with check ((auth.jwt() ->> 'email') = user_email);

create policy "own_select_qc_attempts" on public.qc_attempts
  for select to authenticated
  using ((auth.jwt() ->> 'email') = user_email);

-- Leadership may read all attempts. Keep this list in sync with
-- LEADERSHIP_EMAILS in index.html.
create policy "leadership_select_qc_attempts" on public.qc_attempts
  for select to authenticated
  using ((auth.jwt() ->> 'email') in ('jeff@ataandeadvisors.com'));

-- No update and no delete policy for anyone. A completed batch is a record of
-- what happened; a score that can be edited after the fact is not a measurement.
```

- [ ] **Step 2: Apply the migration**

```bash
cd ~/Documents/aa-mastery && supabase db push
```

If the CLI is not linked to the project, paste the file's contents into the Supabase dashboard SQL editor instead. Expected: two tables created, two rows inserted.

- [ ] **Step 3: Verify RLS actually blocks cross-user reads**

In the Supabase SQL editor:

```sql
select tablename, policyname, cmd
from pg_policies
where tablename in ('qc_projects','qc_attempts')
order by tablename, policyname;
```

Expected: 5 rows. Confirm `qc_attempts` has no policy with `cmd` of `UPDATE` or `DELETE`, and that no policy body references `display_name`.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260817_qc_track.sql
git commit -m "feat(qc): add qc_projects and qc_attempts with RLS"
```

---

### Task 7: QC page shell, navigation, and track home

**Files:**
- Modify: `index.html` — add a `page-qc` div near the other `page-*` divs; add a `// ══ QC TRACK` section at the end of the inline script block; add a nav entry

**Interfaces:**
- Consumes: `window.QC` from Task 1; `nav(p)` and `esc()` / `escAttr()` from the existing app
- Produces: global `qcState = {caseKey, batchType, entries, decisions, batchNo, startedAt}`; functions `renderQcHome()`, `qcNav(view)` where view is `'home' | 'launch' | 'review' | 'complete' | 'taxonomy'`

- [ ] **Step 1: Add the page container**

Find the block of `page-*` divs (search `id="page-leaderboard"`). After the last one, add:

```html
<div id="page-qc" class="page" style="display:none">
  <div id="qc-view-home"></div>
  <div id="qc-view-launch" style="display:none"></div>
  <div id="qc-view-review" style="display:none"></div>
  <div id="qc-view-complete" style="display:none"></div>
  <div id="qc-view-taxonomy" style="display:none"></div>
</div>
```

- [ ] **Step 2: Register the page in navigation**

`nav(p)` hides all `page-*` divs and shows the requested one, so `nav('qc')` works with no change. Add a nav link alongside the existing ones (search for the link that calls `nav('flashcards')` and copy its markup):

```html
<a href="#" onclick="nav('qc');return false;">QC Track</a>
```

- [ ] **Step 3: Add the QC Track script section**

At the end of the inline `<script>` block, add:

```js
// ══════════════════════════════════════════════════════════════════
// QC TRACK
// ══════════════════════════════════════════════════════════════════

var QC_CASES = {
  joba:    { label: 'Joba v. Bukando',                  docs: function () { return REL_DOCS; }, certification: false },
  firstam: { label: 'TransRidge v. Cascade Headwaters', docs: function () { return FA_DOCS; },  certification: true }
};

var QC_DEFAULTS = {
  practice_density: 0.15, practice_batch_size: 50,
  cert_density: 0.02,     cert_batch_size: 250,
  target_pace_docs_per_hour: 60, max_defects_per_1000: 1, response_window_minutes: 2
};

var qcProjects = {};   // case_key -> config row, loaded in Task 11
var qcAttempts = [];   // this user's attempts, loaded in Task 11
var qcState = null;

function qcNav(view) {
  ['home', 'launch', 'review', 'complete', 'taxonomy'].forEach(function (v) {
    var el = document.getElementById('qc-view-' + v);
    if (el) el.style.display = (v === view) ? '' : 'none';
  });
}

function qcConfig(caseKey) {
  var row = qcProjects[caseKey] || {};
  var out = {};
  for (var k in QC_DEFAULTS) {
    if (Object.prototype.hasOwnProperty.call(QC_DEFAULTS, k)) {
      out[k] = (row[k] == null) ? QC_DEFAULTS[k] : row[k];
    }
  }
  return out;
}

function renderQcHome() {
  var roll = QC.rollingAccuracy(qcAttempts, 1000);
  var pillarText = roll.pillar == null
    ? 'No certification batches yet'
    : Math.round(roll.pillar) + ' / 100';
  var rateText = roll.documents
    ? roll.defectsPer1000.toFixed(1) + ' defects per 1,000 · ' +
      roll.defects + ' in ' + roll.documents + ' documents' + (roll.partial ? ' so far' : '')
    : 'Certify on a case to start measuring';

  var html = '' +
    '<h2>QC Track</h2>' +
    '<p class="qc-lede">Review documents another reviewer already coded. Catch what they got wrong — ' +
      'without changing what they got right.</p>' +
    '<div class="qc-dial">' +
      '<div class="qc-dial-label">Accuracy</div>' +
      '<div class="qc-dial-value">' + esc(pillarText) + '</div>' +
      '<div class="qc-dial-sub">' + esc(rateText) + '</div>' +
      '<div class="qc-dial-bar">Bar to clear: 2 defects per 1,000 documents</div>' +
    '</div>' +
    '<div class="qc-actions">' +
      '<button onclick="renderQcLaunch()">Start a batch</button> ' +
      '<button onclick="renderQcTaxonomy()">Error taxonomy</button>' +
    '</div>';

  document.getElementById('qc-view-home').innerHTML = html;
  qcNav('home');
}
```

- [ ] **Step 4: Call the renderer on navigation**

In `nav(p)`, find the block that triggers per-page initialisers (it already calls `initQuizPage()` and `loadTimesheets()`). Add:

```js
  if (p === 'qc') renderQcHome();
```

- [ ] **Step 5: Add the stylesheet**

Every QC view in Tasks 7–12 uses these classes. Add once, at the end of the existing `<style>` block, using the established `:root` tokens:

```css
/* ── QC TRACK ─────────────────────────────────────────────── */
.qc-lede{color:#9fb0c9;max-width:60ch;margin:.5rem 0 1.25rem}
.qc-actions{margin-top:1.25rem;display:flex;gap:.5rem;flex-wrap:wrap}
.qc-note{color:#7d8ca3;font-size:.85rem;margin-left:.5rem}

.qc-dial{background:var(--card);border:1px solid #1c2740;border-radius:10px;padding:1.25rem;max-width:30rem}
.qc-dial-label{color:#9fb0c9;text-transform:uppercase;letter-spacing:.08em;font-size:.75rem}
.qc-dial-value{font-size:2.25rem;font-weight:700;color:var(--gold);line-height:1.2}
.qc-dial-sub{color:#c3d0e4;margin-top:.25rem}
.qc-dial-bar{color:#7d8ca3;font-size:.85rem;margin-top:.75rem;border-top:1px solid #1c2740;padding-top:.75rem}

.qc-case{background:var(--card);border:1px solid #1c2740;border-radius:10px;padding:1rem;margin-bottom:.75rem}
.qc-case h3{margin:0 0 .25rem}
.qc-case-meta{color:#7d8ca3;font-size:.85rem;margin-bottom:.75rem}

.qc-shell-bar{background:var(--card);border:1px solid #1c2740;border-radius:8px;padding:.6rem .9rem;margin-bottom:.75rem;display:flex;gap:.5rem;align-items:center;flex-wrap:wrap}
.qc-panes{display:grid;grid-template-columns:14rem 1fr 20rem;gap:.75rem;align-items:start}
.qc-pane-list{max-height:70vh;overflow:auto;background:var(--card);border:1px solid #1c2740;border-radius:8px}
.qc-pane-doc{background:var(--card);border:1px solid #1c2740;border-radius:8px;padding:1rem;max-height:70vh;overflow:auto}
.qc-pane-decide{display:flex;flex-direction:column;gap:.75rem}

.qc-list-row{display:flex;justify-content:space-between;align-items:center;gap:.5rem;padding:.45rem .65rem;border-bottom:1px solid #16203a;cursor:pointer;font-size:.85rem}
.qc-list-row:hover{background:#131c2e}
.qc-list-row-active{background:#16223c;border-left:3px solid var(--gold)}
.qc-list-id{font-family:ui-monospace,Menlo,monospace;color:#c3d0e4}

.qc-chip{font-size:.7rem;padding:.1rem .45rem;border-radius:999px;white-space:nowrap}
.qc-chip-none{background:#1c2740;color:#8b9ab3}
.qc-chip-agree{background:#0d3b34;color:#4fd1b5}
.qc-chip-correct{background:#3d3413;color:var(--gold)}
.qc-chip-esc{background:#3a2033;color:#e58fc0}

.qc-doc-meta{border-bottom:1px solid #1c2740;padding-bottom:.6rem;margin-bottom:.75rem;color:#9fb0c9;font-size:.85rem}
.qc-doc-body{white-space:pre-wrap;font-family:ui-monospace,Menlo,monospace;font-size:.82rem;line-height:1.55;color:#dbe4f0;margin:0}
.qc-thread-item{border-top:1px solid #16203a;margin-top:.75rem;padding-top:.75rem;font-size:.82rem;color:#c3d0e4}
.qc-thread-meta{color:#7d8ca3;margin-bottom:.25rem}

.qc-card{background:var(--card);border:1px solid #1c2740;border-radius:8px;padding:.9rem}
.qc-card h4{margin:0 0 .6rem;font-size:.8rem;text-transform:uppercase;letter-spacing:.08em;color:#9fb0c9}
.qc-code-row{display:flex;justify-content:space-between;gap:.75rem;padding:.3rem 0;border-bottom:1px solid #16203a;font-size:.85rem}
.qc-code-row span{color:#7d8ca3}
.qc-correct-form{margin-top:.75rem;display:flex;flex-direction:column;gap:.5rem}
.qc-correct-form label{display:flex;flex-direction:column;gap:.2rem;font-size:.8rem;color:#9fb0c9}
.qc-issue-list{display:flex;flex-wrap:wrap;gap:.5rem}
.qc-issue{flex-direction:row!important;align-items:center;gap:.3rem!important;color:#c3d0e4!important}

.qc-result{background:var(--card);border:1px solid #1c2740;border-left:3px solid var(--gold);border-radius:8px;padding:1.1rem;max-width:36rem}
.qc-result-headline{font-size:1.5rem;font-weight:700;color:var(--gold)}
.qc-result-sub{color:#c3d0e4;margin-top:.3rem}
.qc-result-note{color:#7d8ca3;font-size:.85rem;margin-top:.6rem}
.qc-breakdown{color:#c3d0e4;line-height:1.7}
.qc-diag{color:#9fb0c9;max-width:60ch}

.qc-wrong{background:var(--card);border:1px solid #1c2740;border-radius:8px;padding:.9rem;margin-bottom:.6rem}
.qc-wrong-head{margin-bottom:.4rem}
.qc-wrong-truth{margin:.5rem 0;padding:.5rem;background:#0b1220;border-radius:6px}
.qc-wrong-why{color:#9fb0c9;font-size:.85rem;line-height:1.6}

.qc-tax{background:var(--card);border:1px solid #1c2740;border-radius:8px;padding:1rem;margin-bottom:.75rem;max-width:60rem}
.qc-tax h3{margin:0 0 .5rem;display:flex;align-items:center;gap:.6rem;flex-wrap:wrap}
.qc-tax-weight{font-size:.7rem;background:#1c2740;color:var(--gold);padding:.15rem .5rem;border-radius:999px;font-weight:400}
.qc-tax-spot{color:#9fb0c9;font-size:.9rem}

@media (max-width:900px){
  .qc-panes{grid-template-columns:1fr}
  .qc-pane-list{max-height:16rem}
}
```

- [ ] **Step 6: Verify in the browser**

```bash
cd ~/Documents/aa-mastery && python3 -m http.server 8000
```

Open `http://localhost:8000`, click **QC Track**.
Expected: the QC Track heading, an Accuracy dial reading "No certification batches yet", the bar line, and two buttons — all styled to match the surrounding app rather than rendering as bare HTML. Console shows no errors.

- [ ] **Step 7: Commit**

```bash
git add index.html
git commit -m "feat(qc): add QC Track page shell, styles and track home"
```

---

### Task 8: Batch launcher

**Files:**
- Modify: `index.html` — QC TRACK script section

**Interfaces:**
- Consumes: `QC_CASES`, `qcConfig`, `qcNav`, `QC.seedErrors`, `QC.hashSeed`
- Produces: `renderQcLaunch()`; `startQcBatch(caseKey, batchType)` which populates `qcState` and calls `renderQcReview()`

- [ ] **Step 1: Implement the launcher**

Add to the QC TRACK section:

```js
function qcNextBatchNo(caseKey, batchType) {
  var n = 0;
  for (var i = 0; i < qcAttempts.length; i++) {
    if (qcAttempts[i].case_key === caseKey && qcAttempts[i].batch_type === batchType) n++;
  }
  return n + 1;
}

function renderQcLaunch() {
  var html = '<h2>Start a batch</h2>' +
    '<p class="qc-lede">Practice batches are dense with errors so you can learn the patterns. ' +
    'Certification batches are realistic — almost everything is clean, which is exactly why ' +
    'people stop looking. Only certification counts toward your Accuracy score.</p>';

  for (var key in QC_CASES) {
    if (!Object.prototype.hasOwnProperty.call(QC_CASES, key)) continue;
    var c = QC_CASES[key];
    var cfg = qcConfig(key);
    var available = c.docs() ? c.docs().length : 0;

    html += '<div class="qc-case">' +
      '<h3>' + esc(c.label) + '</h3>' +
      '<div class="qc-case-meta">' + esc(String(available)) + ' documents</div>' +
      '<button onclick="startQcBatch(\'' + escAttr(key) + '\',\'practice\')">' +
        'Practice · ' + esc(String(cfg.practice_batch_size)) + ' docs</button> ';

    if (c.certification && available >= cfg.cert_batch_size) {
      html += '<button onclick="startQcBatch(\'' + escAttr(key) + '\',\'certification\')">' +
        'Certify · ' + esc(String(cfg.cert_batch_size)) + ' docs</button>';
    } else {
      html += '<span class="qc-note">Too few documents to certify — needs ' +
        esc(String(cfg.cert_batch_size)) + '</span>';
    }
    html += '</div>';
  }

  html += '<div class="qc-actions"><button onclick="renderQcHome()">Back</button></div>';
  document.getElementById('qc-view-launch').innerHTML = html;
  qcNav('launch');
}

function startQcBatch(caseKey, batchType) {
  var cfg = qcConfig(caseKey);
  var all = QC_CASES[caseKey].docs();
  var size = batchType === 'certification' ? cfg.cert_batch_size : cfg.practice_batch_size;
  var density = batchType === 'certification' ? cfg.cert_density : cfg.practice_density;
  var batchNo = qcNextBatchNo(caseKey, batchType);
  var email = (SB.user && SB.user.email) || 'anonymous';
  var seed = email + '|' + caseKey + '|' + batchType + '|' + batchNo;

  // Draw the batch itself from the same seeded stream, so which documents appear
  // is as reproducible as which of them carry errors.
  var rng = QC.makeRng(QC.hashSeed(seed + '|draw'));
  var pool = all.slice();
  for (var i = pool.length - 1; i > 0; i--) {
    var j = Math.floor(rng() * (i + 1));
    var tmp = pool[i]; pool[i] = pool[j]; pool[j] = tmp;
  }
  var drawn = pool.slice(0, Math.min(size, pool.length));

  qcState = {
    caseKey: caseKey,
    batchType: batchType,
    batchNo: batchNo,
    seed: seed,
    startedAt: new Date().toISOString(),
    entries: QC.seedErrors(drawn, { seed: seed, density: density }),
    decisions: [],
    currentIdx: 0
  };
  for (var k = 0; k < qcState.entries.length; k++) qcState.decisions.push(null);

  renderQcReview();
}
```

> `SB.user` is the existing signed-in user object (`{email, id, user_metadata}`), set on the `SB` const declared around line 2939. It is `null` when signed out, hence the fallback to `'anonymous'` — a signed-out trainee can still practise, their batch just isn't recorded to Postgres.

- [ ] **Step 2: Verify in the browser**

Reload `http://localhost:8000`, go to **QC Track → Start a batch**.
Expected: two case cards. Joba shows a Practice button and the "Too few documents to certify" note. TransRidge shows both buttons.

- [ ] **Step 3: Verify the batch is reproducible**

In the console:

```js
startQcBatch('firstam','practice');
var a = qcState.entries.map(function(e){return e.doc.id + ':' + (e.seededError ? e.seededError.type : '-')}).join(',');
startQcBatch('firstam','practice');
var b = qcState.entries.map(function(e){return e.doc.id + ':' + (e.seededError ? e.seededError.type : '-')}).join(',');
a === b;
```

Expected: `true`.

- [ ] **Step 4: Commit**

```bash
git add index.html
git commit -m "feat(qc): batch launcher with seeded, reproducible document draw"
```

---

### Task 9: QC review shell

**Files:**
- Modify: `index.html` — QC TRACK script section

**Interfaces:**
- Consumes: `qcState` from Task 8
- Produces: `renderQcReview()`; `qcSelectDoc(idx)`; `qcDecide(action)`; `qcSubmitCorrection()`

- [ ] **Step 1: Implement the review shell**

Add to the QC TRACK section:

```js
var QC_FIELD_LABELS = {
  responsive: 'Responsiveness', privilege: 'Privilege',
  action: 'Action', conf: 'Confidentiality', issues: 'Issues'
};

function qcCodingRows(coding) {
  var rows = '';
  ['responsive', 'privilege', 'action', 'conf'].forEach(function (f) {
    if (coding[f] == null) return;
    rows += '<div class="qc-code-row"><span>' + esc(QC_FIELD_LABELS[f]) + '</span>' +
            '<strong>' + esc(String(coding[f])) + '</strong></div>';
  });
  var iss = (coding.issues || []).join(', ') || '—';
  rows += '<div class="qc-code-row"><span>' + esc(QC_FIELD_LABELS.issues) + '</span>' +
          '<strong>' + esc(iss) + '</strong></div>';
  return rows;
}

function qcStatusChip(idx) {
  var d = qcState.decisions[idx];
  if (!d) return '<span class="qc-chip qc-chip-none">unreviewed</span>';
  if (d.action === 'agree')    return '<span class="qc-chip qc-chip-agree">agreed</span>';
  if (d.action === 'correct')  return '<span class="qc-chip qc-chip-correct">corrected</span>';
  return '<span class="qc-chip qc-chip-esc">escalated</span>';
}

function renderQcReview() {
  var idx = qcState.currentIdx;
  var entry = qcState.entries[idx];
  var doc = entry.doc;
  var done = 0;
  for (var i = 0; i < qcState.decisions.length; i++) if (qcState.decisions[i]) done++;

  var list = '';
  for (var j = 0; j < qcState.entries.length; j++) {
    list += '<div class="qc-list-row' + (j === idx ? ' qc-list-row-active' : '') + '" ' +
      'onclick="qcSelectDoc(' + j + ')">' +
      '<span class="qc-list-id">' + esc(qcState.entries[j].doc.id) + '</span>' +
      qcStatusChip(j) + '</div>';
  }

  var thread = '';
  if (doc.thread && doc.thread.length) {
    for (var t = 0; t < doc.thread.length; t++) {
      thread += '<div class="qc-thread-item"><div class="qc-thread-meta">' +
        esc(doc.thread[t].from || '') + ' · ' + esc(doc.thread[t].date || '') +
        '</div><div>' + esc(doc.thread[t].text || '') + '</div></div>';
    }
  }

  var html = '' +
    '<div class="qc-shell">' +
      '<div class="qc-shell-bar">' +
        '<strong>' + esc(QC_CASES[qcState.caseKey].label) + '</strong> · ' +
        esc(qcState.batchType) + ' batch ' + esc(String(qcState.batchNo)) + ' · ' +
        esc(String(done)) + ' of ' + esc(String(qcState.entries.length)) + ' reviewed' +
        (done === qcState.entries.length
          ? ' <button onclick="finishQcBatch()">Finish batch</button>'
          : '') +
      '</div>' +
      '<div class="qc-panes">' +
        '<div class="qc-pane-list">' + list + '</div>' +
        '<div class="qc-pane-doc">' +
          '<div class="qc-doc-meta">' +
            '<div><strong>' + esc(doc.subject || doc.id) + '</strong></div>' +
            '<div>' + esc(doc.from || '') + '</div>' +
            '<div>' + esc(doc.to || '') + '</div>' +
            '<div>' + esc(doc.date || '') + '</div>' +
          '</div>' +
          '<pre class="qc-doc-body">' + esc(doc.body || '') + '</pre>' +
          thread +
        '</div>' +
        '<div class="qc-pane-decide">' +
          '<div class="qc-card">' +
            '<h4>Prior reviewer coding</h4>' + qcCodingRows(entry.priorCoding) +
          '</div>' +
          '<div class="qc-card">' +
            '<h4>Your QC decision</h4>' +
            '<button onclick="qcDecide(\'agree\')">Agree</button> ' +
            '<button onclick="qcDecide(\'correct\')">Correct</button> ' +
            '<button onclick="qcDecide(\'escalate\')">Escalate</button>' +
            '<div id="qc-correction"></div>' +
          '</div>' +
        '</div>' +
      '</div>' +
    '</div>';

  document.getElementById('qc-view-review').innerHTML = html;
  qcNav('review');
}

function qcSelectDoc(idx) {
  qcState.currentIdx = idx;
  renderQcReview();
}

function qcAdvance() {
  for (var i = qcState.currentIdx + 1; i < qcState.entries.length; i++) {
    if (!qcState.decisions[i]) { qcState.currentIdx = i; renderQcReview(); return; }
  }
  for (var j = 0; j < qcState.entries.length; j++) {
    if (!qcState.decisions[j]) { qcState.currentIdx = j; renderQcReview(); return; }
  }
  renderQcReview();   // all reviewed — the Finish button is now shown
}

function qcDecide(action) {
  if (action === 'correct') { qcRenderCorrectionForm(); return; }
  qcState.decisions[qcState.currentIdx] = { action: action };
  qcAdvance();
}

function qcRenderCorrectionForm() {
  var entry = qcState.entries[qcState.currentIdx];
  var vocab = QC.buildVocabulary(QC_CASES[qcState.caseKey].docs());
  var html = '<div class="qc-correct-form"><h5>Corrected coding</h5>';

  ['responsive', 'privilege', 'action', 'conf'].forEach(function (f) {
    if (entry.priorCoding[f] == null) return;
    html += '<label>' + esc(QC_FIELD_LABELS[f]) + '<select id="qc-fix-' + escAttr(f) + '">';
    vocab[f].forEach(function (v) {
      html += '<option value="' + escAttr(v) + '"' +
        (v === entry.priorCoding[f] ? ' selected' : '') + '>' + esc(v) + '</option>';
    });
    html += '</select></label>';
  });

  html += '<label>' + esc(QC_FIELD_LABELS.issues) + '<span class="qc-issue-list">';
  vocab.issues.forEach(function (v) {
    var on = (entry.priorCoding.issues || []).indexOf(v) !== -1;
    html += '<label class="qc-issue"><input type="checkbox" value="' + escAttr(v) + '"' +
      (on ? ' checked' : '') + '> ' + esc(v) + '</label>';
  });
  html += '</span></label>';

  html += '<button onclick="qcSubmitCorrection()">Submit correction</button></div>';
  document.getElementById('qc-correction').innerHTML = html;
}

function qcSubmitCorrection() {
  var coding = {};
  ['responsive', 'privilege', 'action', 'conf'].forEach(function (f) {
    var el = document.getElementById('qc-fix-' + f);
    if (el) coding[f] = el.value;
  });
  coding.issues = [];
  var boxes = document.querySelectorAll('#qc-correction .qc-issue input:checked');
  for (var i = 0; i < boxes.length; i++) coding.issues.push(boxes[i].value);

  qcState.decisions[qcState.currentIdx] = { action: 'correct', coding: coding };
  qcAdvance();
}
```

- [ ] **Step 2: Verify the review flow in the browser**

Reload, go to **QC Track → Start a batch → Joba, Practice**.
Expected: three panes; the document list shows 50 rows all reading "unreviewed"; the right pane shows the prior reviewer's coding and three buttons.

Click **Agree**. Expected: the first row's chip becomes "agreed", the counter reads "1 of 50 reviewed", and the view advances to the next document.

Click **Correct** on the next document. Expected: a form appears pre-filled with the prior coding. Change Confidentiality and submit. Expected: the chip reads "corrected".

- [ ] **Step 3: Verify escaping**

In the console:

```js
qcState.entries[0].doc.subject = '<img src=x onerror=alert(1)>';
renderQcReview();
```

Expected: the literal text `<img src=x onerror=alert(1)>` renders in the header. No alert fires.

- [ ] **Step 4: Commit**

```bash
git add index.html
git commit -m "feat(qc): QC review shell with agree, correct and escalate"
```

---

### Task 10: Batch-complete review screen

**Files:**
- Modify: `index.html` — QC TRACK script section

**Interfaces:**
- Consumes: `qcState`, `QC.scoreBatch`, `QC.accuracyPillar`, `QC.ERROR_TYPES`
- Produces: `finishQcBatch()`; `renderQcComplete(score)`; global `QC_AMBIGUOUS` map

- [ ] **Step 1: Implement the completion screen**

Add to the QC TRACK section:

```js
// Documents that are genuine close calls and should be escalated rather than
// silently resolved. In TransRidge these already exist in the data: any document
// coded fa-flag (Flag & Escalate). Other cases list ids explicitly. Keep this to
// roughly 5% of a case — beyond that, escalation stops being a judgment call and
// becomes the safe default.
var QC_AMBIGUOUS = {
  joba: []
};

function qcAmbiguousIds(caseKey) {
  if (QC_AMBIGUOUS[caseKey]) return QC_AMBIGUOUS[caseKey];
  var ids = [];
  var docs = QC_CASES[caseKey].docs();
  for (var i = 0; i < docs.length; i++) {
    if (docs[i].answer && docs[i].answer.privilege === 'fa-flag') ids.push(docs[i].id);
  }
  return ids;
}

function finishQcBatch() {
  var score = QC.scoreBatch(qcState.entries, qcState.decisions, {
    ambiguousIds: qcAmbiguousIds(qcState.caseKey)
  });
  qcState.completedAt = new Date().toISOString();
  qcState.score = score;
  // Persistence arrives in Task 11. Guarded so this task stands alone.
  if (typeof saveQcAttempt === 'function') saveQcAttempt(score);
  renderQcComplete(score);
}

function renderQcComplete(score) {
  var pillar = QC.accuracyPillar(score.defectsPer1000);
  var counted = qcState.batchType === 'certification';

  var html = '<h2>Batch complete</h2>' +
    '<div class="qc-result">' +
      '<div class="qc-result-headline">' +
        esc(score.defectsPer1000.toFixed(1)) + ' defects per 1,000 documents' +
      '</div>' +
      '<div class="qc-result-sub">' +
        esc(String(score.defects)) + ' defect units across ' +
        esc(String(score.docsReviewed)) + ' documents · ' +
        'Accuracy ' + esc(String(Math.round(pillar))) + ' / 100' +
      '</div>' +
      '<div class="qc-result-note">' +
        (counted
          ? 'This batch counts toward your rolling Accuracy score.'
          : 'Practice batch — this does not count toward your Accuracy score.') +
      '</div>' +
    '</div>';

  html += '<h3>Where the defects were</h3><ul class="qc-breakdown">' +
    '<li>Missed errors: ' + esc(String(score.counts.MISS)) + '</li>' +
    '<li>Corrected to the wrong value: ' + esc(String(score.counts.BAD_FIX)) + '</li>' +
    '<li>Changed a document that was already right: ' + esc(String(score.counts.FALSE_CORRECTION)) + '</li>' +
    '<li>Should have escalated: ' + esc(String(score.counts.MISSED_ESCALATION)) + '</li>' +
    '<li>Escalated something clear: ' + esc(String(score.counts.OVER_ESCALATION)) + '</li>' +
    '</ul>';

  if (score.diagnostics.catchRate != null) {
    html += '<p class="qc-diag">You caught ' +
      esc(String(Math.round(score.diagnostics.catchRate * 100))) +
      '% of the errors that were there, and changed ' +
      esc(String(Math.round((score.diagnostics.falseCorrectionRate || 0) * 100))) +
      '% of the documents that were already correct.</p>';
  }

  html += '<h3>Every document you got wrong</h3>';
  var anyWrong = false;
  var ambiguous = {};
  qcAmbiguousIds(qcState.caseKey).forEach(function (id) { ambiguous[id] = 1; });

  for (var i = 0; i < qcState.entries.length; i++) {
    var e = qcState.entries[i];
    var r = QC.classifyDecision(e, qcState.decisions[i] || { action: 'agree' }, !!ambiguous[e.doc.id]);
    if (r.correct) continue;
    anyWrong = true;
    var seededLabel = e.seededError
      ? QC.ERROR_TYPES[e.seededError.type].label
      : 'No error was present';
    html += '<div class="qc-wrong">' +
      '<div class="qc-wrong-head"><strong>' + esc(e.doc.id) + '</strong> · ' +
        esc(e.doc.subject || '') + '</div>' +
      '<div>You: <strong>' + esc((qcState.decisions[i] || {}).action || 'agree') + '</strong> · ' +
        'Defect: <strong>' + esc(r.defect) + '</strong> · ' +
        'Seeded: ' + esc(seededLabel) + '</div>' +
      '<div class="qc-wrong-truth">Correct coding: ' + qcCodingRows(e.doc.answer) + '</div>' +
      '<div class="qc-wrong-why">' + esc(e.doc.explanation || '') + '</div>' +
      '</div>';
  }
  if (!anyWrong) html += '<p>Nothing. A clean batch.</p>';

  html += '<div class="qc-actions"><button onclick="renderQcHome()">Back to QC Track</button></div>';
  document.getElementById('qc-view-complete').innerHTML = html;
  qcNav('complete');
}
```

- [ ] **Step 2: Verify with a deliberately imperfect batch**

Reload, start a Joba practice batch, then in the console:

```js
qcState.decisions = qcState.entries.map(function(){ return {action:'agree'}; });
finishQcBatch();
```

Expected: a defects-per-1,000 headline well above zero, a breakdown showing every seeded error as a miss and zero false corrections, and one entry per wrong document with its ground-truth explanation.

- [ ] **Step 3: Verify a flawless batch scores zero**

```js
startQcBatch('joba','practice');
qcState.decisions = qcState.entries.map(function(e){ return {action:'correct', coding:e.doc.answer}; });
finishQcBatch();
```

Expected: "0.0 defects per 1,000 documents", Accuracy 100 / 100, and "Nothing. A clean batch."

- [ ] **Step 4: Commit**

```bash
git add index.html
git commit -m "feat(qc): batch-complete screen with per-document defect review"
```

---

### Task 11: Persist attempts and load the rolling score

**Files:**
- Modify: `index.html` — QC TRACK script section and the `SB` object

**Interfaces:**
- Consumes: `SB` (existing Axios wrapper), tables from Task 6
- Produces: `SB.qcLoadProjects()`, `SB.qcLoadAttempts(email)`, `SB.qcSaveAttempt(row)`; `saveQcAttempt(score)`; `loadQcData()`

- [ ] **Step 1: Add the Supabase methods**

Find the `SB` object (declared as `const SB={` around line 2939) and add three methods alongside the existing ones. `SB.hdr(extra)` already builds the apikey and bearer headers and falls back to the anon key when signed out — use it rather than hand-rolling headers, and match the existing method-shorthand style:

```js
  qcLoadProjects(){
    return axios.get(this.url+'/rest/v1/qc_projects?select=*',{headers:this.hdr()})
      .then(r=>r.data);
  },
  qcLoadAttempts(email){
    return axios.get(this.url+'/rest/v1/qc_attempts?select=*&user_email=eq.'+
      encodeURIComponent(email)+'&order=completed_at.desc',{headers:this.hdr()})
      .then(r=>r.data);
  },
  qcSaveAttempt(row){
    return axios.post(this.url+'/rest/v1/qc_attempts',row,
      {headers:this.hdr({'Prefer':'return=minimal'})});
  },
```

- [ ] **Step 2: Wire persistence into the QC section**

Add to the QC TRACK section:

```js
function saveQcAttempt(score) {
  var email = (SB.user && SB.user.email) || null;

  // localStorage first, mirroring the existing progress pattern: the score
  // survives a lost connection, and a signed-out trainee still sees their work.
  try {
    var local = JSON.parse(localStorage.getItem('qc_attempts') || '[]');
    local.push({
      case_key: qcState.caseKey, batch_type: qcState.batchType,
      batch_no: qcState.batchNo, docs_reviewed: score.docsReviewed,
      defects: score.defects, completed_at: qcState.completedAt
    });
    localStorage.setItem('qc_attempts', JSON.stringify(local));
  } catch (e) { /* storage full or disabled — the Supabase write still stands */ }

  if (!email || !SB.token) return;

  var row = {
    user_email: email,
    case_key: qcState.caseKey,
    batch_no: qcState.batchNo,
    batch_type: qcState.batchType,
    seed: qcState.seed,
    started_at: qcState.startedAt,
    completed_at: qcState.completedAt,
    docs_reviewed: score.docsReviewed,
    defects: score.defects,
    accuracy: QC.accuracyPillar(score.defectsPer1000),
    detail: { counts: score.counts, diagnostics: score.diagnostics }
  };

  SB.qcSaveAttempt(row).then(function () {
    qcAttempts.unshift(row);
  }).catch(function (err) {
    console.error('QC attempt save failed', err);
  });
}

function loadQcData() {
  SB.qcLoadProjects().then(function (rows) {
    qcProjects = {};
    for (var i = 0; i < rows.length; i++) qcProjects[rows[i].case_key] = rows[i];
  }).catch(function () { /* defaults in QC_DEFAULTS still apply */ });

  var email = (SB.user && SB.user.email) || null;
  if (!email || !SB.token) {
    try { qcAttempts = JSON.parse(localStorage.getItem('qc_attempts') || '[]'); }
    catch (e) { qcAttempts = []; }
    return Promise.resolve();
  }
  return SB.qcLoadAttempts(email).then(function (rows) {
    qcAttempts = rows || [];
    renderQcHome();
  }).catch(function () { qcAttempts = []; });
}
```

- [ ] **Step 3: Load on navigation**

Change the line added to `nav(p)` in Task 7 from `if (p === 'qc') renderQcHome();` to:

```js
  if (p === 'qc') { loadQcData(); renderQcHome(); }
```

- [ ] **Step 4: Verify the round trip**

Sign in, open **QC Track**, run a Joba practice batch to completion.
Expected: no console errors. Then in the Supabase SQL editor:

```sql
select user_email, case_key, batch_type, docs_reviewed, defects, accuracy
from public.qc_attempts order by created_at desc limit 5;
```

Expected: one row matching the batch just finished.

- [ ] **Step 5: Verify a certification batch reaches the dial**

Run a TransRidge certification batch, then return to the QC Track home.
Expected: the Accuracy dial shows a score and a line reading "N defects per 1,000 · X in 250 documents so far" — the "so far" confirming the partial-window path.

- [ ] **Step 6: Verify RLS blocks cross-user reads**

Sign in as a second, non-leadership account and open QC Track.
Expected: the dial reads "No certification batches yet". The first user's attempts are not visible.

- [ ] **Step 7: Commit**

```bash
git add index.html
git commit -m "feat(qc): persist QC attempts and load the rolling accuracy score"
```

---

### Task 12: Error taxonomy reference page

**Files:**
- Modify: `index.html` — QC TRACK script section

**Interfaces:**
- Consumes: `QC.ERROR_TYPES`, `QC.PHASE1_TYPES`
- Produces: `renderQcTaxonomy()`

- [ ] **Step 1: Implement the reference page**

The reference copy lives in `ERROR_TYPES` (Task 2), so it is written once and serves both this page and the in-drill feedback.

Add to the QC TRACK section:

```js
function renderQcTaxonomy() {
  var html = '<h2>QC error taxonomy</h2>' +
    '<p class="qc-lede">The defects seeded into your batches, and the defects real QC finds. ' +
    'They are not equal — the weight column is how much each one costs you.</p>';

  var ordered = QC.PHASE1_TYPES.slice().sort(function (a, b) {
    return QC.ERROR_TYPES[b].weight - QC.ERROR_TYPES[a].weight;
  });

  for (var i = 0; i < ordered.length; i++) {
    var t = QC.ERROR_TYPES[ordered[i]];
    html += '<div class="qc-tax">' +
      '<h3>' + esc(t.label) + ' <span class="qc-tax-weight">weight ' + esc(String(t.weight)) + '</span></h3>' +
      '<p>' + esc(t.blurb) + '</p>' +
      '<p class="qc-tax-spot"><strong>How to spot it:</strong> ' + esc(t.spot) + '</p>' +
      '</div>';
  }

  html += '<div class="qc-tax">' +
    '<h3>Two defects you can commit yourself</h3>' +
    '<p>Everything above is a mistake the prior reviewer made. These two are yours. ' +
    '<strong>False correction</strong> — changing a document that was already right — ' +
    'costs the same as a weight-2 error, because it is one: the document is now miscoded, ' +
    'and the team has to re-review the set to find out how far it spread. ' +
    '<strong>Over-escalation</strong> costs less, but escalating what you should have decided ' +
    'is how a QC reviewer becomes a bottleneck.</p>' +
    '</div>';

  html += '<div class="qc-actions"><button onclick="renderQcHome()">Back</button></div>';
  document.getElementById('qc-view-taxonomy').innerHTML = html;
  qcNav('taxonomy');
}
```

- [ ] **Step 2: Verify in the browser**

Reload, go to **QC Track → Error taxonomy**.
Expected: six entries ordered heaviest first, starting with Missed privilege (weight 5) and ending with Wrong issue tags (weight 1), each with a description and a "How to spot it" line, plus the closing section on false correction and over-escalation.

- [ ] **Step 3: Run the full test suite**

```bash
cd ~/Documents/aa-mastery && node --test tests/
```

Expected: PASS, 49 tests, 0 failures.

- [ ] **Step 4: Commit**

```bash
git add index.html
git commit -m "feat(qc): add the QC error taxonomy reference page"
```

---

## Deferred to Phase 2

Recorded here so nothing is silently dropped:

- `INSTRUCTION_DRIFT` and `INCONSISTENCY` error types (need interrupts and near-duplicate families)
- `familyAgreement` — currently returns `null` from `scoreBatch`
- Pace clock, sustainable-pace scoring, pace curve
- Mid-batch interrupts and the Responsiveness pillar
- Near-duplicate family generation
- Leadership editor for `qc_projects`
- Widening the certification pool across `P3_DOCS`, `P4_DOCS` and `PTBR_DOCS` to reach a full 1,000-document window

## Deferred to Phase 3

- `qc_readiness` table and the weekly supervisor form
- The remaining four pillar dials and the composite
- Status ladder and the simulation/live weighting
- Leadership roster view
