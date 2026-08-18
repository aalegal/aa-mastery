# QC Track Phase 2 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make QC Track reproduce the conditions a client judges under — a pace clock that refuses to reward speed bought with accuracy, mid-batch interrupts that measure responsiveness and instruction-following as one observable act, and near-duplicate families that expose inconsistent coding.

**Architecture:** All new scoring stays pure and lives in `qc-engine.js` under Node's built-in test runner, exactly as Phase 1. The review shell gains a clock and an inbox; the completion screen and track home gain the two new pillars. Two `qc_projects` columns become editable by leadership.

**Tech Stack:** Vanilla JS (ES5 in `qc-engine.js`), Node 22 `node --test`, Supabase (Postgres + GoTrue), Vercel static hosting.

**Spec:** `docs/superpowers/specs/2026-08-17-qc-track-design.md`

**Predecessor:** `docs/superpowers/plans/2026-08-17-qc-track-phase-1.md` (complete — 49 engine tests, branch `feat/qc-track-phase-1`)

## Global Constraints

- **Target pace: 60 docs/hr. Response window: 2 minutes. Accuracy tolerance: 1 defect per 1,000 documents.** Live-project figures, already seeded as `qc_projects` defaults.
- **Pace is never scored alone.** `pace_pillar = 100 × min(1.25, effective_pace / target)` where `effective_pace = docs_per_hour × (accuracy_pillar/100)²`. The square is load-bearing: it makes rushing strictly worse than working properly.
- **Practice batches: density 0.15, size 50. Certification: density 0.02, size 250.** Only certification counts toward Accuracy.
- **Ambiguous documents stay rare** — a few percent of a batch at most. `QC_AMBIGUOUS` is an explicit per-case ID list; **never derive it from `fa-flag`**, which 219 of TransRidge's 500 documents carry as ordinary First Amendment qualified-privilege coding.
- **All dynamic DOM content goes through `esc()` or `escAttr()`.** Never raw interpolation.
- **RLS policies key on the JWT email claim only** — never `display_name`, which is spoofable.
- **This repository is public.** No employee name, score, or performance figure in any committed file.
- **`qc-engine.js` must not use `import`/`export`.** It loads as a classic script and via `require()`; the UMD wrapper makes both work.
- **Run tests with bare `node --test`.** `node --test tests/` resolves the directory as a module on Node 22.22 and fails before running anything.

## Assumptions carried into this plan

Phase 1 has not yet been through real use, so two numbers here are reasoned rather than observed. Both are single config values, changeable without touching code:

1. **A 250-document certification batch takes about four hours** at target pace. If that proves unworkable in practice, the lever is `cert_batch_size`, at the cost of a noisier per-batch reading.
2. **Three interrupts per batch** is the default (`QC_INTERRUPT_COUNT`). Enough to score responsiveness meaningfully without the drill becoming an interruption exercise.

---

## File structure

| File | Responsibility | Change |
| --- | --- | --- |
| `qc-engine.js` | All pure scoring. Gains pace, families, consistency, protocol change, responsiveness. | Modify |
| `tests/qc-engine.test.js` | Node test suite. Grows from 49 to ~90 tests. | Modify |
| `index.html` | `// ══ QC TRACK` section: clock, inbox, new completion sections, leadership editor. | Modify |
| `supabase/migrations/20260818_qc_track_phase2.sql` | New `qc_attempts` metric columns. | Create |

---

### Task 1: Pace computation

**Files:**
- Modify: `qc-engine.js`
- Modify: `tests/qc-engine.test.js`

**Interfaces:**
- Consumes: `QC.accuracyPillar` (Phase 1)
- Produces: `QC.paceStats(marks) -> {docsPerHour, thirds:[n,n,n], fade, elapsedMs, decisions}` where `marks` is an ascending array of epoch-ms numbers whose first element is the batch start and each subsequent element is one recorded decision; `QC.pacePillar(docsPerHour, accuracyPillarValue, targetPace) -> number`

- [ ] **Step 1: Write the failing test**

Append to `tests/qc-engine.test.js`:

```js
var HOUR = 3600000;

test('paceStats reports docs per hour from the mark stream', function () {
  // start, then 30 decisions spread over exactly half an hour => 60 docs/hr
  var marks = [0];
  for (var i = 1; i <= 30; i++) marks.push(i * (HOUR / 60));
  var s = QC.paceStats(marks);
  assert.strictEqual(s.decisions, 30);
  assert.strictEqual(Math.round(s.docsPerHour), 60);
  assert.strictEqual(s.elapsedMs, HOUR / 2);
});

test('paceStats splits the batch into thirds', function () {
  // 30 decisions: first 10 fast (1/min), middle 10 fast, last 10 at half speed
  var marks = [0], t = 0, i;
  for (i = 0; i < 20; i++) { t += HOUR / 60; marks.push(t); }
  for (i = 0; i < 10; i++) { t += HOUR / 30; marks.push(t); }
  var s = QC.paceStats(marks);
  assert.strictEqual(s.thirds.length, 3);
  assert.ok(Math.round(s.thirds[0]) === 60, 'first third ~60, got ' + s.thirds[0]);
  assert.ok(Math.round(s.thirds[2]) === 30, 'final third ~30, got ' + s.thirds[2]);
});

test('paceStats fade is the ratio of final third to first third', function () {
  var marks = [0], t = 0, i;
  for (i = 0; i < 20; i++) { t += HOUR / 60; marks.push(t); }
  for (i = 0; i < 10; i++) { t += HOUR / 30; marks.push(t); }
  var s = QC.paceStats(marks);
  assert.ok(s.fade > 0.45 && s.fade < 0.55, 'expected ~0.5 fade, got ' + s.fade);
});

test('paceStats handles a batch with no decisions', function () {
  var s = QC.paceStats([0]);
  assert.strictEqual(s.decisions, 0);
  assert.strictEqual(s.docsPerHour, 0);
  assert.strictEqual(s.fade, null);
});

test('paceStats tolerates an empty or missing mark stream', function () {
  assert.strictEqual(QC.paceStats([]).docsPerHour, 0);
  assert.strictEqual(QC.paceStats(null).docsPerHour, 0);
});

test('pacePillar scores 100 at target pace with perfect accuracy', function () {
  assert.strictEqual(QC.pacePillar(60, 100, 60), 100);
});

test('pacePillar squares the accuracy discount', function () {
  // accuracy pillar 90 => quality 0.81 => effective 48.6 of 60 => 81
  assert.strictEqual(Math.round(QC.pacePillar(60, 90, 60)), 81);
});

test('pacePillar makes rushing strictly worse than working properly', function () {
  var rushing  = QC.pacePillar(75, 60, 60);   // fast, sloppy
  var careful  = QC.pacePillar(60, 100, 60);  // at target, clean
  assert.ok(rushing < careful, 'rushing ' + rushing + ' should score below careful ' + careful);
  assert.strictEqual(Math.round(rushing), 45);
});

test('pacePillar caps the reward for beating target at 125', function () {
  assert.strictEqual(QC.pacePillar(200, 100, 60), 125);
  assert.strictEqual(QC.pacePillar(75, 100, 60), 125);
});

test('pacePillar returns zero when accuracy has collapsed', function () {
  assert.strictEqual(QC.pacePillar(60, 0, 60), 0);
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd ~/Documents/aa-mastery && node --test
```

Expected: FAIL — `QC.paceStats is not a function`

- [ ] **Step 3: Write minimal implementation**

Insert into `qc-engine.js` immediately before the module-scope `return {` (the line that is exactly `  return {`):

```js
  // marks[0] is the batch start; every later mark is one recorded decision.
  function paceStats(marks) {
    var empty = { docsPerHour: 0, thirds: [0, 0, 0], fade: null, elapsedMs: 0, decisions: 0 };
    if (!marks || marks.length < 2) return empty;

    var n = marks.length - 1;
    var elapsed = marks[n] - marks[0];
    var dph = elapsed > 0 ? (n / (elapsed / 3600000)) : 0;

    var size = Math.floor(n / 3);
    var thirds = [0, 0, 0];
    if (size > 0) {
      for (var t = 0; t < 3; t++) {
        var lo = 1 + t * size;
        var hi = (t === 2) ? n : (t + 1) * size;
        var span = marks[hi] - marks[lo - 1];
        var cnt = hi - lo + 1;
        thirds[t] = span > 0 ? (cnt / (span / 3600000)) : 0;
      }
    }

    return {
      docsPerHour: dph,
      thirds: thirds,
      fade: thirds[0] > 0 ? (thirds[2] / thirds[0]) : null,
      elapsedMs: elapsed,
      decisions: n
    };
  }

  // Pace is never scored alone. Throughput is discounted by the square of the
  // quality it was bought at, so 75 docs/hr at a collapsed accuracy scores below
  // 60 docs/hr done properly. That is the whole point.
  function pacePillar(docsPerHour, accuracyPillarValue, targetPace) {
    var target = targetPace || 60;
    var q = Math.max(0, Math.min(1, (accuracyPillarValue || 0) / 100));
    var effective = (docsPerHour || 0) * q * q;
    if (target <= 0) return 0;
    return 100 * Math.min(1.25, effective / target);
  }
```

Add `paceStats: paceStats,` and `pacePillar: pacePillar,` to the returned object.

- [ ] **Step 4: Run test to verify it passes**

```bash
cd ~/Documents/aa-mastery && node --test
```

Expected: PASS, 59 tests.

- [ ] **Step 5: Commit**

```bash
git add qc-engine.js tests/qc-engine.test.js
git commit -m "feat(qc): pace statistics and sustainable-pace scoring"
```

---

### Task 2: Pace clock in the review shell

**Files:**
- Modify: `index.html` — `// ══ QC TRACK` section

**Interfaces:**
- Consumes: `QC.paceStats`, `QC.pacePillar`, `qcState`, `qcConfig`
- Produces: `qcState.marks` (array of epoch ms); `qcMark()`; `qcLivePace()`; `qcStartClock()` / `qcStopClock()`; `qcState.clockTimer`

- [ ] **Step 1: Record a mark on every decision**

In `startQcBatch`, add `marks` to the state object so it is initialised with the batch start:

```js
  qcState = {
    caseKey: caseKey,
    batchType: batchType,
    batchNo: batchNo,
    seed: seed,
    startedAt: new Date().toISOString(),
    marks: [Date.now()],
    entries: QC.seedErrors(drawn, { seed: seed, density: density }),
    decisions: [],
    currentIdx: 0
  };
```

Then add the mark helper and the live readout to the QC TRACK section:

```js
function qcMark() {
  if (qcState && qcState.marks) qcState.marks.push(Date.now());
}

function qcLivePace() {
  var cfg = qcConfig(qcState.caseKey);
  var s = QC.paceStats(qcState.marks);
  var target = cfg.target_pace_docs_per_hour;
  return {
    docsPerHour: s.docsPerHour,
    target: target,
    onTarget: s.docsPerHour >= target,
    elapsedMin: Math.floor(s.elapsedMs / 60000)
  };
}
```

Record a mark in both decision paths. In `qcDecide`, before `qcAdvance()`:

```js
function qcDecide(action) {
  if (action === 'correct') { qcRenderCorrectionForm(); return; }
  qcState.decisions[qcState.currentIdx] = { action: action };
  qcMark();
  qcAdvance();
}
```

And in `qcSubmitCorrection`, before `qcAdvance()`:

```js
  qcState.decisions[qcState.currentIdx] = { action: 'correct', coding: coding };
  qcMark();
  qcAdvance();
```

- [ ] **Step 2: Show the clock in the top bar**

In `renderQcReview`, replace the `qc-shell-bar` contents. Find this fragment:

```js
        esc(String(done)) + ' of ' + esc(String(qcState.entries.length)) + ' reviewed' +
```

and replace it with:

```js
        esc(String(done)) + ' of ' + esc(String(qcState.entries.length)) + ' reviewed' +
        '<span class="qc-clock' + (pace.onTarget ? ' qc-clock-ok' : ' qc-clock-slow') + '">' +
          esc(pace.docsPerHour.toFixed(0)) + ' / ' + esc(String(pace.target)) + ' docs per hour' +
          ' · ' + esc(String(pace.elapsedMin)) + ' min' +
        '</span>' +
```

Add this line at the top of `renderQcReview`, immediately after `var done = 0;`'s loop:

```js
  var pace = qcLivePace();
```

- [ ] **Step 3: Keep the clock ticking while the reviewer reads**

Without a timer the readout only moves when a decision is made, which hides a stall — exactly the thing pace is meant to expose. Add to the QC TRACK section:

```js
function qcStartClock() {
  qcStopClock();
  qcState.clockTimer = setInterval(function () {
    var el = document.querySelector('.qc-clock');
    if (!el || !qcState) return;
    var pace = qcLivePace();
    el.className = 'qc-clock ' + (pace.onTarget ? 'qc-clock-ok' : 'qc-clock-slow');
    el.textContent = pace.docsPerHour.toFixed(0) + ' / ' + pace.target +
                     ' docs per hour · ' + pace.elapsedMin + ' min';
  }, 5000);
}

function qcStopClock() {
  if (qcState && qcState.clockTimer) { clearInterval(qcState.clockTimer); qcState.clockTimer = null; }
}
```

Call `qcStartClock()` at the end of `startQcBatch`, immediately before `renderQcReview();`, and `qcStopClock()` as the first statement of `finishQcBatch`.

- [ ] **Step 4: Style the clock**

Add at the end of the `/* ── QC TRACK */` CSS block:

```css
.qc-clock{margin-left:auto;font-size:.8rem;padding:.15rem .55rem;border-radius:999px;white-space:nowrap}
.qc-clock-ok{background:#0d3b34;color:#4fd1b5}
.qc-clock-slow{background:#3d2413;color:#e0a56a}
```

- [ ] **Step 5: Show pace on the completion screen**

In `renderQcComplete`, insert immediately after the closing `'</div>'` of the `qc-result` block:

```js
  var cfg = qcConfig(qcState.caseKey);
  var pstats = QC.paceStats(qcState.marks);
  var ppillar = QC.pacePillar(pstats.docsPerHour, pillar, cfg.target_pace_docs_per_hour);
  html += '<h3>Pace</h3><div class="qc-result">' +
    '<div class="qc-result-headline">' + esc(pstats.docsPerHour.toFixed(0)) +
      ' docs per hour</div>' +
    '<div class="qc-result-sub">Target ' + esc(String(cfg.target_pace_docs_per_hour)) +
      ' · sustainable pace ' + esc(String(Math.round(ppillar))) + ' / 100</div>' +
    '<div class="qc-result-note">Throughput is discounted by the square of your accuracy. ' +
      'Speed bought with mistakes is not speed.' +
      (pstats.fade != null && pstats.fade < 0.8
        ? ' Your final third ran at ' + esc(String(Math.round(pstats.fade * 100))) +
          '% of your opening pace.'
        : '') +
    '</div></div>';
```

- [ ] **Step 6: Verify in the browser**

Start the preview (`preview_start` with the `aa-mastery` launch config, port 8199), open QC Track, start a Joba practice batch, and make three decisions with a pause between them.

Expected: the top bar shows a pill reading `N / 60 docs per hour · M min`, coloured amber below target and teal at or above it, and it updates without a decision being made. On finishing, a **Pace** panel appears below the defect panel.

- [ ] **Step 7: Commit**

```bash
git add index.html
git commit -m "feat(qc): live pace clock and sustainable-pace reporting"
```

---

### Task 3: Near-duplicate families

Real productions are full of threads, re-sends and forwarded copies, and coding them inconsistently is a standard QC finding. Only 1 of Joba's 55 documents carries a `thread`, so families must be generated rather than found.

**Files:**
- Modify: `qc-engine.js`
- Modify: `tests/qc-engine.test.js`

**Interfaces:**
- Consumes: `QC.makeRng`, `QC.hashSeed`
- Produces: `QC.makeFamilies(docs, opts) -> {docs: Array, familyIds: string[]}` where `opts` is `{seed, familyCount, familySize}`. Family members are new document objects carrying `familyId` and a derived `id`; the originals are not mutated.

- [ ] **Step 1: Write the failing test**

Append to `tests/qc-engine.test.js`:

```js
test('makeFamilies produces the requested number of families', function () {
  var r = QC.makeFamilies(bigSet(100), { seed: 'f', familyCount: 4, familySize: 3 });
  assert.strictEqual(r.familyIds.length, 4);
  var counts = {};
  r.docs.forEach(function (d) { if (d.familyId) counts[d.familyId] = (counts[d.familyId] || 0) + 1; });
  r.familyIds.forEach(function (id) {
    assert.strictEqual(counts[id], 3, id + ' should have 3 members, had ' + counts[id]);
  });
});

test('makeFamilies keeps the batch the same length', function () {
  var docs = bigSet(100);
  var r = QC.makeFamilies(docs, { seed: 'f', familyCount: 5, familySize: 3 });
  assert.strictEqual(r.docs.length, docs.length);
});

test('family members share ground truth but differ in id and subject', function () {
  var r = QC.makeFamilies(bigSet(100), { seed: 'f', familyCount: 2, familySize: 3 });
  var byFam = {};
  r.docs.forEach(function (d) { if (d.familyId) (byFam[d.familyId] = byFam[d.familyId] || []).push(d); });
  Object.keys(byFam).forEach(function (fid) {
    var members = byFam[fid];
    var ids = {}, subjects = {};
    members.forEach(function (m) { ids[m.id] = 1; subjects[m.subject] = 1; });
    assert.strictEqual(Object.keys(ids).length, members.length, 'ids must be unique');
    assert.strictEqual(Object.keys(subjects).length, members.length, 'subjects must differ');
    for (var i = 1; i < members.length; i++) {
      assert.deepStrictEqual(members[i].answer, members[0].answer, 'ground truth must match');
    }
  });
});

test('makeFamilies is deterministic for a given seed', function () {
  var a = QC.makeFamilies(bigSet(100), { seed: 'f', familyCount: 4, familySize: 3 });
  var b = QC.makeFamilies(bigSet(100), { seed: 'f', familyCount: 4, familySize: 3 });
  assert.deepStrictEqual(a.docs.map(function (d) { return d.id; }),
                         b.docs.map(function (d) { return d.id; }));
});

test('makeFamilies does not mutate the source documents', function () {
  var docs = bigSet(60);
  var before = JSON.stringify(docs);
  QC.makeFamilies(docs, { seed: 'f', familyCount: 3, familySize: 3 });
  assert.strictEqual(JSON.stringify(docs), before);
});

test('makeFamilies defaults to roughly 6% of the batch', function () {
  var r = QC.makeFamilies(bigSet(250), { seed: 'f' });
  assert.ok(r.familyIds.length >= 12 && r.familyIds.length <= 18,
    'expected ~15 families, got ' + r.familyIds.length);
});

test('makeFamilies degrades gracefully on a batch too small to seed', function () {
  var r = QC.makeFamilies(bigSet(2), { seed: 'f', familyCount: 5, familySize: 3 });
  assert.strictEqual(r.docs.length, 2);
  assert.ok(r.familyIds.length <= 1);
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd ~/Documents/aa-mastery && node --test
```

Expected: FAIL — `QC.makeFamilies is not a function`

- [ ] **Step 3: Write minimal implementation**

Insert into `qc-engine.js` before the module-scope `return {`:

```js
  var FAMILY_VARIANTS = [
    { suffix: '-A', prefix: 'RE: ' },
    { suffix: '-B', prefix: 'FW: ' },
    { suffix: '-C', prefix: 'RE: RE: ' },
    { suffix: '-D', prefix: 'FW: FW: ' }
  ];

  function familyMember(base, famId, k) {
    var copy = {};
    for (var key in base) {
      if (Object.prototype.hasOwnProperty.call(base, key)) copy[key] = base[key];
    }
    copy.answer = copyAnswer(base.answer || {});
    copy.familyId = famId;
    if (k > 0) {
      var v = FAMILY_VARIANTS[(k - 1) % FAMILY_VARIANTS.length];
      copy.id = base.id + v.suffix;
      copy.subject = v.prefix + (base.subject || base.id);
    }
    return copy;
  }

  // Threads, re-sends and forwarded copies are how real productions look, and
  // coding them differently is a standard QC finding. The corpus has almost no
  // natural near-duplicates, so they are generated: siblings share ground truth
  // and differ only in id and subject.
  function makeFamilies(docs, opts) {
    opts = opts || {};
    var rng = opts.rng || makeRng(hashSeed(opts.seed || 'families'));
    var familySize = opts.familySize || 3;
    var familyCount = opts.familyCount == null
      ? Math.max(1, Math.round(docs.length * 0.06))
      : opts.familyCount;

    var out = docs.slice();
    var used = {};
    var familyIds = [];

    function freeSlot() {
      for (var t = 0; t < 200; t++) {
        var c = Math.floor(rng() * out.length);
        if (!used[c]) return c;
      }
      for (var i = 0; i < out.length; i++) if (!used[i]) return i;
      return -1;
    }

    for (var f = 0; f < familyCount; f++) {
      var seedIdx = freeSlot();
      if (seedIdx < 0) break;
      used[seedIdx] = 1;
      var base = out[seedIdx];
      var famId = 'FAM-' + (f + 1);
      out[seedIdx] = familyMember(base, famId, 0);

      var placed = 1;
      for (var k = 1; k < familySize; k++) {
        var slot = freeSlot();
        if (slot < 0) break;
        used[slot] = 1;
        out[slot] = familyMember(base, famId, k);
        placed++;
      }
      // A one-member "family" cannot be inconsistent — drop it.
      if (placed < 2) { out[seedIdx] = base; break; }
      familyIds.push(famId);
    }

    return { docs: out, familyIds: familyIds };
  }
```

Add `makeFamilies: makeFamilies,` to the returned object.

- [ ] **Step 4: Run test to verify it passes**

```bash
cd ~/Documents/aa-mastery && node --test
```

Expected: PASS, 66 tests.

- [ ] **Step 5: Commit**

```bash
git add qc-engine.js tests/qc-engine.test.js
git commit -m "feat(qc): generate near-duplicate document families"
```

---

### Task 4: Inconsistency error type and family agreement

**Files:**
- Modify: `qc-engine.js`
- Modify: `tests/qc-engine.test.js`

**Interfaces:**
- Consumes: `QC.makeFamilies`, `QC.codingMatches`, `QC.ERROR_TYPES`
- Produces: `QC.ERROR_TYPES.INCONSISTENCY`; `QC.PHASE2_TYPES -> string[]` (all seven seedable types); `QC.familyAgreement(entries, decisions) -> number|null`. `ERROR_TYPES[*].applies` gains a third argument, `doc`.

- [ ] **Step 1: Write the failing test**

Append to `tests/qc-engine.test.js`:

```js
test('PHASE2_TYPES adds inconsistency to the Phase 1 set', function () {
  assert.strictEqual(QC.PHASE2_TYPES.length, 7);
  assert.notStrictEqual(QC.PHASE2_TYPES.indexOf('INCONSISTENCY'), -1);
  QC.PHASE1_TYPES.forEach(function (t) {
    assert.notStrictEqual(QC.PHASE2_TYPES.indexOf(t), -1, t + ' missing from Phase 2 set');
  });
});

test('inconsistency only applies to documents in a family', function () {
  var v = QC.buildVocabulary(JSON_SET);
  var t = QC.ERROR_TYPES.INCONSISTENCY;
  assert.strictEqual(t.applies(JSON_SET[0].answer, v, { id: 'X' }), false);
  assert.strictEqual(t.applies(JSON_SET[0].answer, v, { id: 'X', familyId: 'FAM-1' }), true);
});

test('inconsistency carries reference copy and weight 2', function () {
  var t = QC.ERROR_TYPES.INCONSISTENCY;
  assert.strictEqual(t.weight, 2);
  assert.ok(t.blurb.length > 40);
  assert.ok(t.spot.length > 20);
});

test('seedErrors passes the document to applies()', function () {
  var docs = QC.makeFamilies(bigSet(120), { seed: 'f', familyCount: 6, familySize: 3 }).docs;
  var seeded = QC.seedErrors(docs, {
    seed: 's', density: 1, allowedTypes: ['INCONSISTENCY']
  });
  seeded.forEach(function (e) {
    if (e.seededError) {
      assert.ok(e.doc.familyId, 'inconsistency seeded on a non-family document ' + e.doc.id);
    }
  });
  assert.ok(seeded.filter(function (e) { return e.seededError; }).length > 0, 'nothing seeded');
});

function famEntries(codings) {
  // codings: array of prior codings, all in one family
  return codings.map(function (c, i) {
    return { doc: { id: 'F' + i, familyId: 'FAM-1', answer: c }, priorCoding: c, seededError: null };
  });
}
var C1 = { responsive: 'responsive', privilege: 'not-privileged', action: 'produce', conf: 'standard', issues: ['issue1'] };
var C2 = { responsive: 'responsive', privilege: 'not-privileged', action: 'produce', conf: 'aeo', issues: ['issue1'] };

test('familyAgreement is 1 when every member ends up coded the same', function () {
  var e = famEntries([C1, C1, C1]);
  var d = [{ action: 'agree' }, { action: 'agree' }, { action: 'agree' }];
  assert.strictEqual(QC.familyAgreement(e, d), 1);
});

test('familyAgreement is 0 when a member is left coded differently', function () {
  var e = famEntries([C1, C1, C2]);
  var d = [{ action: 'agree' }, { action: 'agree' }, { action: 'agree' }];
  assert.strictEqual(QC.familyAgreement(e, d), 0);
});

test('familyAgreement counts a correction that realigns the family', function () {
  var e = famEntries([C1, C1, C2]);
  var d = [{ action: 'agree' }, { action: 'agree' }, { action: 'correct', coding: C1 }];
  assert.strictEqual(QC.familyAgreement(e, d), 1);
});

test('familyAgreement ignores escalated members rather than counting them wrong', function () {
  var e = famEntries([C1, C1, C2]);
  var d = [{ action: 'agree' }, { action: 'agree' }, { action: 'escalate' }];
  assert.strictEqual(QC.familyAgreement(e, d), 1);
});

test('familyAgreement returns null when the batch has no families', function () {
  var e = [{ doc: { id: 'X', answer: C1 }, priorCoding: C1, seededError: null }];
  assert.strictEqual(QC.familyAgreement(e, [{ action: 'agree' }]), null);
});

test('scoreBatch reports familyAgreement instead of null', function () {
  var e = famEntries([C1, C1, C2]);
  var d = [{ action: 'agree' }, { action: 'agree' }, { action: 'agree' }];
  var s = QC.scoreBatch(e, d, {});
  assert.strictEqual(s.diagnostics.familyAgreement, 0);
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd ~/Documents/aa-mastery && node --test
```

Expected: FAIL — `QC.PHASE2_TYPES is undefined`

- [ ] **Step 3: Extend `applies` to receive the document**

In `qc-engine.js`, inside `seedErrors`, change the candidate filter so each type sees the document:

```js
          if (type && type.applies(answer, vocab, doc)) candidates.push(type);
```

The six existing types ignore the extra argument, so they are unaffected.

- [ ] **Step 4: Add the inconsistency type and family agreement**

Add `INCONSISTENCY` to the `ERROR_TYPES` object, after `WRONG_ISSUES`:

```js
    INCONSISTENCY: {
      key: 'INCONSISTENCY', weight: 2, freq: 10,
      label: 'Inconsistency',
      blurb: 'One member of a near-duplicate family coded differently from its siblings. Threads, re-sends and forwarded copies must land on the same call, or the production contradicts itself and every downstream report inherits the contradiction.',
      spot: 'Read the subject line for RE: and FW: prefixes, then check what you did with the rest of the family before you decide this one.',
      applies: function (a, v, doc) { return !!(doc && doc.familyId) && v.conf.length > 1; },
      apply: function (a, v, rng) {
        var opts = [];
        for (var i = 0; i < v.conf.length; i++) if (v.conf[i] !== a.conf) opts.push(v.conf[i]);
        return { conf: pickFrom(opts, rng) };
      }
    }
```

Then add, before the module-scope `return {`:

```js
  var PHASE2_TYPES = PHASE1_TYPES.concat(['INCONSISTENCY']);

  // What coding the document actually ends up with once the reviewer is done.
  // Escalated documents have no resolved coding — they went up instead.
  function resultingCoding(entry, decision) {
    if (!decision) return null;
    if (decision.action === 'correct') return decision.coding;
    if (decision.action === 'agree') return entry.priorCoding;
    return null;
  }

  function familyAgreement(entries, decisions) {
    var byFam = {}, i;
    for (i = 0; i < entries.length; i++) {
      var fid = entries[i].doc.familyId;
      if (!fid) continue;
      if (!byFam[fid]) byFam[fid] = [];
      var c = resultingCoding(entries[i], (decisions || [])[i]);
      if (c) byFam[fid].push(c);
    }
    var total = 0, agreed = 0;
    for (var f in byFam) {
      if (!Object.prototype.hasOwnProperty.call(byFam, f)) continue;
      var list = byFam[f];
      if (list.length < 2) continue;
      total++;
      var same = true;
      for (i = 1; i < list.length; i++) {
        if (!codingMatches(list[0], list[i])) { same = false; break; }
      }
      if (same) agreed++;
    }
    return total ? (agreed / total) : null;
  }
```

Add `PHASE2_TYPES: PHASE2_TYPES,` and `familyAgreement: familyAgreement,` to the returned object.

- [ ] **Step 5: Wire it into `scoreBatch`**

In `scoreBatch`, replace the diagnostics line:

```js
        familyAgreement: null   // Phase 2 — requires near-duplicate families
```

with:

```js
        familyAgreement: familyAgreement(entries, decisions)
```

- [ ] **Step 6: Run test to verify it passes**

```bash
cd ~/Documents/aa-mastery && node --test
```

Expected: PASS, 76 tests. The Phase 1 test `scoreBatch reports catch rate and false-correction rate as diagnostics` still asserts `familyAgreement === null`, and still passes, because that fixture has no families.

- [ ] **Step 7: Commit**

```bash
git add qc-engine.js tests/qc-engine.test.js
git commit -m "feat(qc): inconsistency error type and family agreement diagnostic"
```

---

### Task 5: Families in batches, consistency on the completion screen

**Files:**
- Modify: `index.html` — `// ══ QC TRACK` section

**Interfaces:**
- Consumes: `QC.makeFamilies`, `QC.PHASE2_TYPES`, `scoreBatch` diagnostics
- Produces: batches whose documents carry `familyId`; a Consistency panel on the completion screen

- [ ] **Step 1: Build families into the draw**

In `startQcBatch`, replace the `entries:` line of the state object. The current line is:

```js
    entries: QC.seedErrors(drawn, { seed: seed, density: density }),
```

Replace the whole `qcState = { … }` assignment's `entries` construction by computing families first. Insert immediately before `qcState = {`:

```js
  // Families are built before seeding so the inconsistency type has something
  // to attach to, and so a family's members are drawn as one unit.
  var fam = QC.makeFamilies(drawn, { seed: seed + '|fam' });
  var entries = QC.seedErrors(fam.docs, {
    seed: seed, density: density, allowedTypes: QC.PHASE2_TYPES
  });
```

and change the state object's line to:

```js
    entries: entries,
```

Also add `familyIds: fam.familyIds,` to the state object so the completion screen can report the count.

- [ ] **Step 2: Show family membership in the review shell**

A reviewer cannot code a family consistently without seeing that it is a family. In `renderQcReview`, inside the document-list loop, replace:

```js
      '<span class="qc-list-id">' + esc(qcState.entries[j].doc.id) + '</span>' +
```

with:

```js
      '<span class="qc-list-id">' + esc(qcState.entries[j].doc.id) +
        (qcState.entries[j].doc.familyId
          ? ' <span class="qc-fam">' + esc(qcState.entries[j].doc.familyId) + '</span>'
          : '') +
      '</span>' +
```

Add the style to the QC TRACK CSS block:

```css
.qc-fam{font-size:.62rem;background:#2a2140;color:#b9a6f0;padding:.05rem .35rem;border-radius:999px;margin-left:.3rem}
```

- [ ] **Step 3: Report consistency on the completion screen**

In `renderQcComplete`, insert immediately after the Pace panel added in Task 2:

```js
  if (score.diagnostics.familyAgreement != null) {
    var fa = Math.round(score.diagnostics.familyAgreement * 100);
    html += '<h3>Consistency</h3><div class="qc-result">' +
      '<div class="qc-result-headline">' + esc(String(fa)) + '% of families coded alike</div>' +
      '<div class="qc-result-sub">' +
        esc(String((qcState.familyIds || []).length)) +
        ' near-duplicate families in this batch</div>' +
      '<div class="qc-result-note">Threads, re-sends and forwarded copies have to land on ' +
        'the same call. Where they do not, the production contradicts itself.</div>' +
    '</div>';
  }
```

- [ ] **Step 4: Verify in the browser**

Open QC Track, start a Joba practice batch.

Expected: roughly 3 documents in the 50-document list carry a violet `FAM-n` chip, and members of the same family share a subject stem with `RE:` / `FW:` prefixes. Code one family member differently from its siblings, finish the batch, and confirm the Consistency panel reports below 100%.

- [ ] **Step 5: Commit**

```bash
git add index.html
git commit -m "feat(qc): near-duplicate families in batches with consistency reporting"
```

---

### Task 6: Protocol change and instruction drift

The sharpest measurement in the program. A mid-batch instruction change makes responsiveness, careful reading, and applying feedback one observable act instead of three things a supervisor lectures about.

**Files:**
- Modify: `qc-engine.js`
- Modify: `tests/qc-engine.test.js`

**Interfaces:**
- Consumes: `QC.classifyDecision`, `copyAnswer`
- Produces: `QC.applyProtocolChange(entries, change, fromIndex) -> entries` where `change` is `{label, when:{field:value,…}, then:{field:value,…}}`. Sets `entry.effectiveAnswer` and `entry.instructionChanged` on matching entries at or after `fromIndex`. `classifyDecision` scores against `entry.effectiveAnswer || entry.doc.answer` and returns a new defect type `INSTRUCTION_DRIFT` at weight 3.

- [ ] **Step 1: Write the failing test**

Append to `tests/qc-engine.test.js`:

```js
var CHANGE = {
  label: 'Vendor comms with counsel copied are now privileged.',
  when: { privilege: 'not-privileged' },
  then: { privilege: 'acp-wpp', action: 'withhold' }
};

function plainEntries(n, answer) {
  var out = [];
  for (var i = 0; i < n; i++) {
    out.push({ doc: { id: 'P' + i, answer: answer }, priorCoding: answer, seededError: null });
  }
  return out;
}
var CLEAN = { responsive: 'responsive', privilege: 'not-privileged', action: 'produce', conf: 'standard', issues: ['issue1'] };

test('applyProtocolChange only touches documents at or after the change point', function () {
  var e = QC.applyProtocolChange(plainEntries(10, CLEAN), CHANGE, 5);
  for (var i = 0; i < 5; i++) assert.strictEqual(e[i].effectiveAnswer, undefined, 'index ' + i);
  for (var j = 5; j < 10; j++) assert.ok(e[j].effectiveAnswer, 'index ' + j + ' should be amended');
});

test('applyProtocolChange applies the amended coding', function () {
  var e = QC.applyProtocolChange(plainEntries(6, CLEAN), CHANGE, 3);
  assert.strictEqual(e[4].effectiveAnswer.privilege, 'acp-wpp');
  assert.strictEqual(e[4].effectiveAnswer.action, 'withhold');
  assert.strictEqual(e[4].effectiveAnswer.responsive, 'responsive', 'untouched fields survive');
  assert.strictEqual(e[4].instructionChanged, true);
});

test('applyProtocolChange skips documents that do not match the predicate', function () {
  var priv = { responsive: 'responsive', privilege: 'acp', action: 'withhold', conf: 'standard', issues: [] };
  var e = QC.applyProtocolChange(plainEntries(6, priv), CHANGE, 0);
  e.forEach(function (x) { assert.strictEqual(x.effectiveAnswer, undefined); });
});

test('applyProtocolChange leaves the source answer untouched', function () {
  var e = plainEntries(4, CLEAN);
  QC.applyProtocolChange(e, CHANGE, 0);
  assert.strictEqual(e[0].doc.answer.privilege, 'not-privileged');
});

test('agreeing after a protocol change is instruction drift at weight 3', function () {
  var e = QC.applyProtocolChange(plainEntries(4, CLEAN), CHANGE, 0);
  var r = QC.classifyDecision(e[1], { action: 'agree' }, false);
  assert.strictEqual(r.defect, 'INSTRUCTION_DRIFT');
  assert.strictEqual(r.weight, 3);
});

test('applying the protocol change correctly is scored correct', function () {
  var e = QC.applyProtocolChange(plainEntries(4, CLEAN), CHANGE, 0);
  var r = QC.classifyDecision(e[1], { action: 'correct', coding: e[1].effectiveAnswer }, false);
  assert.strictEqual(r.correct, true);
});

test('agreeing before the change point stays correct', function () {
  var e = QC.applyProtocolChange(plainEntries(8, CLEAN), CHANGE, 4);
  assert.strictEqual(QC.classifyDecision(e[0], { action: 'agree' }, false).correct, true);
});

test('scoreBatch counts instruction drift', function () {
  var e = QC.applyProtocolChange(plainEntries(10, CLEAN), CHANGE, 5);
  var d = []; for (var i = 0; i < 10; i++) d.push({ action: 'agree' });
  var s = QC.scoreBatch(e, d, {});
  assert.strictEqual(s.counts.INSTRUCTION_DRIFT, 5);
  assert.strictEqual(s.defects, 7.5);          // 5 × weight 3, normalised by 2
});

test('post-change compliance is reported as a diagnostic', function () {
  var e = QC.applyProtocolChange(plainEntries(10, CLEAN), CHANGE, 5);
  var d = []; for (var i = 0; i < 10; i++) {
    d.push(i >= 5 && i < 8 ? { action: 'correct', coding: e[i].effectiveAnswer } : { action: 'agree' });
  }
  var s = QC.scoreBatch(e, d, {});
  assert.strictEqual(s.diagnostics.postChangeCompliance, 3 / 5);
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd ~/Documents/aa-mastery && node --test
```

Expected: FAIL — `QC.applyProtocolChange is not a function`

- [ ] **Step 3: Write minimal implementation**

Insert into `qc-engine.js` before the module-scope `return {`:

```js
  // A mid-batch instruction change does not create a "mistake" by the prior
  // reviewer — it changes what correct means from this point on. Documents after
  // the change point are scored against the amended rule; agreeing with coding
  // that predates it is instruction drift.
  function applyProtocolChange(entries, change, fromIndex) {
    for (var i = fromIndex; i < entries.length; i++) {
      var a = entries[i].doc.answer || {};
      var hit = true, k;
      for (k in change.when) {
        if (!Object.prototype.hasOwnProperty.call(change.when, k)) continue;
        if (a[k] !== change.when[k]) { hit = false; break; }
      }
      if (!hit) continue;
      var eff = copyAnswer(a);
      for (k in change.then) {
        if (Object.prototype.hasOwnProperty.call(change.then, k)) eff[k] = change.then[k];
      }
      entries[i].effectiveAnswer = eff;
      entries[i].instructionChanged = true;
    }
    return entries;
  }
```

Then update `classifyDecision`. Replace its body's truth lookup and the two decision branches:

```js
  function classifyDecision(entry, decision, isAmbiguous) {
    var action = decision && decision.action;
    var truth = entry.effectiveAnswer || entry.doc.answer || {};

    if (isAmbiguous) {
      return action === 'escalate' ? ok() : bad('MISSED_ESCALATION', DEFECT_WEIGHTS.MISSED_ESCALATION);
    }
    if (action === 'escalate') {
      return bad('OVER_ESCALATION', DEFECT_WEIGHTS.OVER_ESCALATION);
    }

    var seeded = entry.seededError;
    if (action === 'correct') {
      if (codingMatches(decision.coding, truth)) return ok();
      if (seeded) return bad('BAD_FIX', seeded.weight / 2);
      // Tried to apply the change and got it wrong: a real attempt, half the cost
      // of not trying at all.
      if (entry.instructionChanged) return bad('BAD_FIX', DEFECT_WEIGHTS.INSTRUCTION_DRIFT / 2);
      return bad('FALSE_CORRECTION', DEFECT_WEIGHTS.FALSE_CORRECTION);
    }
    if (seeded) return bad('MISS', seeded.weight);
    if (entry.instructionChanged && !codingMatches(entry.priorCoding, truth)) {
      return bad('INSTRUCTION_DRIFT', DEFECT_WEIGHTS.INSTRUCTION_DRIFT);
    }
    return ok();
  }
```

Add `INSTRUCTION_DRIFT: 3` to `DEFECT_WEIGHTS`, add `INSTRUCTION_DRIFT: 0` to the `counts` object initialised in `scoreBatch`, and add the compliance diagnostic. Inside `scoreBatch`, declare two counters alongside the existing ones:

```js
    var changedDocs = 0, changedRight = 0;
```

then find the end of the `if (!isAmb) { … }` block inside the scoring loop — it closes
with these three lines:

```js
          if (r.defect === 'FALSE_CORRECTION') falseCorrections++;
        }
      }
```

and add the counter immediately after them, still inside the `for` loop:

```js
          if (r.defect === 'FALSE_CORRECTION') falseCorrections++;
        }
      }
      if (e.instructionChanged) { changedDocs++; if (r.correct) changedRight++; }
```

It sits outside the `!isAmb` guard deliberately: an instruction change applies to every
document it matches, ambiguous or not.

and add to the returned `diagnostics` object:

```js
        postChangeCompliance: changedDocs ? (changedRight / changedDocs) : null,
```

Add `applyProtocolChange: applyProtocolChange,` to the returned object.

- [ ] **Step 4: Run test to verify it passes**

```bash
cd ~/Documents/aa-mastery && node --test
```

Expected: PASS, 85 tests.

- [ ] **Step 5: Commit**

```bash
git add qc-engine.js tests/qc-engine.test.js
git commit -m "feat(qc): mid-batch protocol changes and instruction-drift scoring"
```

---

### Task 7: Responsiveness scoring

**Files:**
- Modify: `qc-engine.js`
- Modify: `tests/qc-engine.test.js`

**Interfaces:**
- Consumes: nothing
- Produces: `QC.responsivenessScore(interrupts, windowMinutes) -> number|null` where each interrupt is `{firedAt, ackAt}` in epoch ms and `ackAt` may be `null`

- [ ] **Step 1: Write the failing test**

Append to `tests/qc-engine.test.js`:

```js
var MIN = 60000;

test('responsivenessScore gives full credit inside the window', function () {
  var s = QC.responsivenessScore([{ firedAt: 0, ackAt: 1 * MIN }], 2);
  assert.strictEqual(s, 100);
});

test('responsivenessScore gives full credit exactly at the window', function () {
  assert.strictEqual(QC.responsivenessScore([{ firedAt: 0, ackAt: 2 * MIN }], 2), 100);
});

test('responsivenessScore decays linearly to zero at three windows', function () {
  // W=2min, so 4min is halfway between W and 3W => 0.5
  assert.strictEqual(QC.responsivenessScore([{ firedAt: 0, ackAt: 4 * MIN }], 2), 50);
  assert.strictEqual(QC.responsivenessScore([{ firedAt: 0, ackAt: 6 * MIN }], 2), 0);
});

test('responsivenessScore scores an unacknowledged interrupt zero', function () {
  assert.strictEqual(QC.responsivenessScore([{ firedAt: 0, ackAt: null }], 2), 0);
});

test('responsivenessScore averages across interrupts', function () {
  var s = QC.responsivenessScore([
    { firedAt: 0, ackAt: 1 * MIN },     // 1.0
    { firedAt: 0, ackAt: 4 * MIN },     // 0.5
    { firedAt: 0, ackAt: null }         // 0.0
  ], 2);
  assert.strictEqual(Math.round(s), 50);
});

test('responsivenessScore returns null when no interrupts fired', function () {
  assert.strictEqual(QC.responsivenessScore([], 2), null);
  assert.strictEqual(QC.responsivenessScore(null, 2), null);
});

test('responsivenessScore defaults to a two-minute window', function () {
  assert.strictEqual(QC.responsivenessScore([{ firedAt: 0, ackAt: 2 * MIN }]), 100);
  assert.strictEqual(QC.responsivenessScore([{ firedAt: 0, ackAt: 6 * MIN }]), 0);
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd ~/Documents/aa-mastery && node --test
```

Expected: FAIL — `QC.responsivenessScore is not a function`

- [ ] **Step 3: Write minimal implementation**

Insert into `qc-engine.js` before the module-scope `return {`:

```js
  // Full credit inside the window, linear decay to nothing at three windows.
  // At the calibrated W of 2 minutes that is: everything up to 2 min, nothing
  // past 6 — two documents' work at target pace, and six.
  function responsivenessScore(interrupts, windowMinutes) {
    if (!interrupts || !interrupts.length) return null;
    var W = (windowMinutes || 2) * 60000;
    var sum = 0;
    for (var i = 0; i < interrupts.length; i++) {
      var it = interrupts[i];
      if (!it || it.ackAt == null) continue;
      var d = it.ackAt - it.firedAt;
      if (d <= W) sum += 1;
      else if (d <= 3 * W) sum += 1 - (d - W) / (2 * W);
    }
    return 100 * sum / interrupts.length;
  }
```

Add `responsivenessScore: responsivenessScore,` to the returned object.

- [ ] **Step 4: Run test to verify it passes**

```bash
cd ~/Documents/aa-mastery && node --test
```

Expected: PASS, 92 tests.

- [ ] **Step 5: Commit**

```bash
git add qc-engine.js tests/qc-engine.test.js
git commit -m "feat(qc): responsiveness scoring against the project response window"
```

---

### Task 8: Interrupt inbox

**Files:**
- Modify: `index.html` — `// ══ QC TRACK` section

**Interfaces:**
- Consumes: `QC.responsivenessScore`, `QC.applyProtocolChange`, `qcState`, `qcConfig`
- Produces: `QC_INTERRUPTS` (per-case scripts); `qcBuildInterrupts(caseKey, total, rng)`; `qcCheckInterrupts()`; `qcAckInterrupt(i)`; `qcRenderInbox()`; `qcState.interrupts`

- [ ] **Step 1: Add the interrupt scripts**

Each case gets messages tied to its own coding rules. Add to the QC TRACK section:

```js
var QC_INTERRUPT_COUNT = 3;

// Three kinds, per the spec. 'ack' measures response time alone. 'change'
// additionally amends what correct means for every document after it. 'feedback'
// names an error type the reviewer was weak on last batch.
var QC_INTERRUPTS = {
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
      body: 'The court has narrowed the qualified privilege. Documents currently coded not-privileged that are being withheld on associational grounds are to be flagged for escalation instead. From this point forward, code not-privileged documents as fa-flag and withhold.',
      change: { label: 'Not-privileged documents are now fa-flag and withheld.',
                when: { privilege: 'not-privileged' }, then: { privilege: 'fa-flag', action: 'withhold' } } },
    { type: 'feedback', from: 'QC Lead',
      subject: 'Note on your last batch',
      body: 'Two privileged documents went out coded not-privileged last batch. Read the participants before the text — counsel on the From, To or CC line changes the analysis of everything below it.' }
  ]
};

function qcBuildInterrupts(caseKey, total, rng) {
  var script = QC_INTERRUPTS[caseKey] || [];
  var n = Math.min(QC_INTERRUPT_COUNT, script.length);
  var out = [];
  for (var i = 0; i < n; i++) {
    // Spread firing points across the batch, avoiding the first and last 10%.
    var lo = Math.floor(total * 0.1);
    var span = Math.floor(total * 0.8);
    var at = lo + Math.floor((span / n) * i + rng() * (span / n));
    out.push({
      atIndex: Math.min(at, total - 1),
      type: script[i].type,
      from: script[i].from,
      subject: script[i].subject,
      body: script[i].body,
      change: script[i].change || null,
      firedAt: null,
      ackAt: null
    });
  }
  return out;
}
```

- [ ] **Step 2: Build interrupts into the batch**

In `startQcBatch`, immediately after the `var entries = QC.seedErrors(...)` line added in Task 5, add:

```js
  var interrupts = qcBuildInterrupts(caseKey, entries.length,
    QC.makeRng(QC.hashSeed(seed + '|int')));
```

and add `interrupts: interrupts,` to the `qcState` object.

- [ ] **Step 3: Fire interrupts as the reviewer advances**

Add to the QC TRACK section:

```js
function qcCheckInterrupts() {
  if (!qcState || !qcState.interrupts) return;
  for (var i = 0; i < qcState.interrupts.length; i++) {
    var it = qcState.interrupts[i];
    if (it.firedAt == null && qcState.currentIdx >= it.atIndex) {
      it.firedAt = Date.now();
      // A protocol change amends what correct means from here on — including
      // the document currently on screen.
      if (it.change) {
        QC.applyProtocolChange(qcState.entries, it.change, qcState.currentIdx);
      }
    }
  }
}

function qcUnackedCount() {
  if (!qcState || !qcState.interrupts) return 0;
  var n = 0;
  for (var i = 0; i < qcState.interrupts.length; i++) {
    var it = qcState.interrupts[i];
    if (it.firedAt != null && it.ackAt == null) n++;
  }
  return n;
}

function qcAckInterrupt(i) {
  var it = qcState.interrupts[i];
  if (!it || it.firedAt == null || it.ackAt != null) return;
  it.ackAt = Date.now();
  renderQcReview();
}

function qcRenderInbox() {
  var html = '';
  for (var i = 0; i < qcState.interrupts.length; i++) {
    var it = qcState.interrupts[i];
    if (it.firedAt == null) continue;
    html += '<div class="qc-msg' + (it.ackAt == null ? ' qc-msg-new' : '') + '">' +
      '<div class="qc-msg-head"><strong>' + esc(it.from) + '</strong> · ' + esc(it.subject) + '</div>' +
      '<div class="qc-msg-body">' + esc(it.body) + '</div>' +
      (it.ackAt == null
        ? '<button onclick="qcAckInterrupt(' + i + ')">Acknowledge</button>'
        : '<span class="qc-msg-ack">acknowledged</span>') +
      '</div>';
  }
  return html || '<div class="qc-msg-empty">No messages.</div>';
}
```

Call `qcCheckInterrupts()` as the first statement of `renderQcReview`.

- [ ] **Step 4: Put the inbox in the decide pane**

In `renderQcReview`, inside the `qc-pane-decide` div, add a card above the "Prior reviewer coding" card:

```js
          '<div class="qc-card' + (qcUnackedCount() ? ' qc-card-alert' : '') + '">' +
            '<h4>Inbox' + (qcUnackedCount()
              ? ' <span class="qc-badge">' + esc(String(qcUnackedCount())) + '</span>'
              : '') + '</h4>' +
            qcRenderInbox() +
          '</div>' +
```

- [ ] **Step 5: Style the inbox**

At a 2-minute window an arriving message has to be genuinely noticeable — missing one should be a decision, not an accident of the interface. Add to the QC TRACK CSS block:

```css
.qc-card-alert{border-color:var(--gold);box-shadow:0 0 0 1px var(--gold)}
.qc-badge{background:var(--gold);color:#0b1220;border-radius:999px;padding:.05rem .4rem;font-size:.7rem}
.qc-msg{border-bottom:1px solid #16203a;padding:.5rem 0;font-size:.82rem}
.qc-msg:last-child{border-bottom:0}
.qc-msg-new{border-left:3px solid var(--gold);padding-left:.5rem}
.qc-msg-head{color:#c3d0e4;margin-bottom:.25rem}
.qc-msg-body{color:#9fb0c9;line-height:1.5;margin-bottom:.4rem}
.qc-msg-ack{color:#4fd1b5;font-size:.75rem}
.qc-msg-empty{color:#7d8ca3;font-size:.82rem}
```

- [ ] **Step 6: Report responsiveness on the completion screen**

In `renderQcComplete`, insert after the Consistency panel:

```js
  var resp = QC.responsivenessScore(qcState.interrupts, cfg.response_window_minutes);
  if (resp != null) {
    var fired = qcState.interrupts.filter(function (x) { return x.firedAt != null; }).length;
    var acked = qcState.interrupts.filter(function (x) { return x.ackAt != null; }).length;
    html += '<h3>Responsiveness</h3><div class="qc-result">' +
      '<div class="qc-result-headline">' + esc(String(Math.round(resp))) + ' / 100</div>' +
      '<div class="qc-result-sub">' + esc(String(acked)) + ' of ' + esc(String(fired)) +
        ' messages acknowledged · window ' + esc(String(cfg.response_window_minutes)) +
        ' minutes</div>' +
      '<div class="qc-result-note">Full credit inside the window, nothing after three times it. ' +
        'On a live project this is the number a PM notices first.</div>' +
    '</div>';
  }
  if (score.diagnostics.postChangeCompliance != null) {
    html += '<p class="qc-diag">After the protocol change you applied the new rule to ' +
      esc(String(Math.round(score.diagnostics.postChangeCompliance * 100))) +
      '% of the documents it affected.</p>';
  }
```

- [ ] **Step 7: Verify in the browser**

Open QC Track, start a Joba practice batch, and work through it.

Expected: at roughly document 5 the Inbox card gains a gold border and a badge. Acknowledge it and the badge clears. Around the midpoint the PROTOCOL CHANGE message arrives; from that point every document coded `standard` confidentiality must be corrected to `highly-conf` to be scored correct. Agreeing instead produces `INSTRUCTION_DRIFT` on the completion screen, and the compliance line reports the percentage applied.

- [ ] **Step 8: Commit**

```bash
git add index.html
git commit -m "feat(qc): mid-batch interrupt inbox with protocol changes"
```

---

### Task 9: Metric columns for the new pillars

**Files:**
- Create: `supabase/migrations/20260818_qc_track_phase2.sql`
- Modify: `index.html` — `saveQcAttempt`

**Interfaces:**
- Consumes: `qc_attempts` from Phase 1
- Produces: columns `pace`, `responsiveness`, `consistency` on `qc_attempts`

- [ ] **Step 1: Write the migration**

```sql
-- QC Track Phase 2 — pace, responsiveness and consistency per batch.
--
-- Same rules as 20260817_qc_track.sql: access is enforced in Postgres, policies
-- key on the JWT email claim only, and no update or delete policy exists — a
-- completed batch stays as recorded.
--
-- The existing policies cover these columns; RLS is per-row, not per-column, so
-- no policy changes are needed.

alter table public.qc_attempts add column pace           numeric;
alter table public.qc_attempts add column responsiveness numeric;
alter table public.qc_attempts add column consistency    numeric;

comment on column public.qc_attempts.pace is
  'Sustainable-pace pillar 0-125: throughput discounted by the square of accuracy.';
comment on column public.qc_attempts.responsiveness is
  'Responsiveness pillar 0-100 from in-batch interrupt acknowledgement times. Null if none fired.';
comment on column public.qc_attempts.consistency is
  'Share of near-duplicate families coded alike, 0-1. Null if the batch had no families.';
```

- [ ] **Step 2: Apply the migration**

```bash
cd ~/Documents/aa-mastery && supabase db push
```

If the CLI is not linked, paste the file into the Supabase dashboard SQL editor. Expected: three columns added.

- [ ] **Step 3: Record the new metrics**

In `saveQcAttempt`, extend the `row` object. After the `accuracy:` line add:

```js
    pace: QC.pacePillar(
      QC.paceStats(qcState.marks).docsPerHour,
      QC.accuracyPillar(score.defectsPer1000),
      qcConfig(qcState.caseKey).target_pace_docs_per_hour),
    responsiveness: QC.responsivenessScore(
      qcState.interrupts, qcConfig(qcState.caseKey).response_window_minutes),
    consistency: score.diagnostics.familyAgreement,
```

- [ ] **Step 4: Verify the round trip**

Sign in, run a Joba practice batch to completion, then in the Supabase SQL editor:

```sql
select batch_type, docs_reviewed, defects, accuracy, pace, responsiveness, consistency
from public.qc_attempts order by created_at desc limit 3;
```

Expected: the newest row carries non-null `pace`, `responsiveness` and `consistency`.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260818_qc_track_phase2.sql index.html
git commit -m "feat(qc): record pace, responsiveness and consistency per batch"
```

---

### Task 10: Wider certification pool with no repeats

A full accuracy window is 1,000 **unique** documents. TransRidge holds ~500, so certification must span cases — and a document a reviewer has already seen cannot measure them again, however the errors are reseeded.

**Files:**
- Modify: `index.html` — `// ══ QC TRACK` section

**Interfaces:**
- Consumes: `qcAttempts`, `QC_CASES`
- Produces: `QC_CASES` entries for `p3`, `p4`, `ptbr`; `qcSeenDocIds()`; `startQcBatch` excludes seen documents and records `detail.docIds`

- [ ] **Step 1: Register the additional cases**

`P3_DOCS`, `P4_DOCS` and `PTBR_DOCS` share the identical coding vocabulary as Joba (`acp`/`acp-wpp`/`not-privileged`, `aeo`/`highly-conf`/`standard`), so they need no vocabulary work. `PTBR_DOCS` is the Portuguese-language set and is off by default: it only belongs in certification for reviewers who actually do foreign-language review, which leadership toggles in Task 11.

Extend `QC_CASES`:

```js
var QC_CASES = {
  joba:    { label: 'Joba v. Bukando',                  docs: function () { return REL_DOCS; },  certification: false },
  firstam: { label: 'TransRidge v. Cascade Headwaters', docs: function () { return FA_DOCS; },   certification: true },
  p3:      { label: 'Veridian Bank — GDPR / AI',        docs: function () { return P3_DOCS; },   certification: true },
  p4:      { label: 'Project 4',                        docs: function () { return P4_DOCS; },   certification: true },
  ptbr:    { label: 'Cade Brazil — Portuguese',         docs: function () { return PTBR_DOCS; }, certification: false }
};
```

Add matching rows to `QC_AMBIGUOUS` so `qcAmbiguousIds` returns an empty list rather than undefined for the new cases:

```js
  p3: [],
  p4: [],
  ptbr: []
```

- [ ] **Step 2: Exclude documents the reviewer has already certified against**

Add to the QC TRACK section:

```js
// A document someone has already reviewed cannot measure them again — they
// remember it, whatever errors get reseeded. The rolling 1,000-document window
// therefore needs 1,000 distinct documents, which no single case holds.
function qcSeenDocIds() {
  var seen = {};
  for (var i = 0; i < qcAttempts.length; i++) {
    var ids = qcAttempts[i].detail && qcAttempts[i].detail.docIds;
    if (!ids) continue;
    for (var j = 0; j < ids.length; j++) seen[ids[j]] = 1;
  }
  return seen;
}
```

In `startQcBatch`, filter the pool before drawing. Replace:

```js
  var pool = all.slice();
```

with:

```js
  var pool = all.slice();
  if (batchType === 'certification') {
    var seen = qcSeenDocIds();
    var fresh = [];
    for (var s = 0; s < pool.length; s++) if (!seen[pool[s].id]) fresh.push(pool[s]);
    if (fresh.length >= size) {
      pool = fresh;
    } else {
      alert('Only ' + fresh.length + ' unreviewed documents remain in ' +
            QC_CASES[caseKey].label + ' — not enough for a ' + size +
            '-document certification batch. Pick another case to keep the window honest.');
      renderQcLaunch();
      return;
    }
  }
```

- [ ] **Step 3: Record which documents were drawn**

In `saveQcAttempt`, extend the `detail` field:

```js
    detail: {
      counts: score.counts,
      diagnostics: score.diagnostics,
      docIds: qcState.entries.map(function (e) {
        // Family variants carry derived ids; record the source document so a
        // sibling is not served back as if it were new.
        return String(e.doc.id).replace(/-[A-D]$/, '');
      })
    }
```

- [ ] **Step 4: Show remaining capacity in the launcher**

In `renderQcLaunch`, replace the `qc-case-meta` line:

```js
      '<div class="qc-case-meta">' + esc(String(available)) + ' documents</div>' +
```

with:

```js
      '<div class="qc-case-meta">' + esc(String(available)) + ' documents · ' +
        esc(String(qcFreshCount(key))) + ' not yet certified against</div>' +
```

and add the helper:

```js
function qcFreshCount(caseKey) {
  var seen = qcSeenDocIds();
  var docs = QC_CASES[caseKey].docs() || [];
  var n = 0;
  for (var i = 0; i < docs.length; i++) if (!seen[docs[i].id]) n++;
  return n;
}
```

- [ ] **Step 5: Verify in the browser**

Open QC Track. Expected: five cases listed, each showing "N documents · M not yet certified against". Run a TransRidge certification batch, return to the launcher, and confirm TransRidge's fresh count has dropped by 250 while the others are unchanged.

- [ ] **Step 6: Commit**

```bash
git add index.html
git commit -m "feat(qc): widen the certification pool and never re-serve a seen document"
```

---

### Task 11: Leadership editor for project targets

**Files:**
- Modify: `index.html` — `// ══ QC TRACK` section, `page-qc` markup

**Interfaces:**
- Consumes: `isLeadership(SB.user)`, `SB.req`, `qcProjects`
- Produces: `renderQcAdmin()`; `qcSaveProject(caseKey)`; a `qc-view-admin` sub-view

- [ ] **Step 1: Add the sub-view container**

In the `page-qc` markup, add a sixth div:

```html
  <div id="qc-view-admin" style="display:none"></div>
```

Add `'admin'` to the array in `qcNav`:

```js
  ['home', 'launch', 'review', 'complete', 'taxonomy', 'admin'].forEach(function (v) {
```

- [ ] **Step 2: Build the editor**

Add to the QC TRACK section:

```js
function renderQcAdmin() {
  if (!isLeadership(SB.user)) { renderQcHome(); return; }

  var html = '<h2>QC project targets</h2>' +
    '<p class="qc-lede">These are the numbers every drill is scored against. ' +
    'Changing them changes what the bar means, so change them because a client ' +
    'changed, not because a batch felt hard.</p>';

  for (var key in QC_CASES) {
    if (!Object.prototype.hasOwnProperty.call(QC_CASES, key)) continue;
    var cfg = qcConfig(key);
    var row = qcProjects[key] || {};
    html += '<div class="qc-case">' +
      '<h3>' + esc(QC_CASES[key].label) + '</h3>' +
      '<div class="qc-admin-grid">' +
        '<label>Target pace (docs/hr)<input type="number" min="1" max="500" ' +
          'id="qcp-pace-' + escAttr(key) + '" value="' + escAttr(String(cfg.target_pace_docs_per_hour)) + '"></label>' +
        '<label>Response window (min)<input type="number" min="1" max="120" ' +
          'id="qcp-resp-' + escAttr(key) + '" value="' + escAttr(String(cfg.response_window_minutes)) + '"></label>' +
        '<label>Max defects per 1,000<input type="number" min="0" max="100" step="0.5" ' +
          'id="qcp-tol-' + escAttr(key) + '" value="' + escAttr(String(cfg.max_defects_per_1000)) + '"></label>' +
        '<label>Certification batch size<input type="number" min="25" max="1000" ' +
          'id="qcp-size-' + escAttr(key) + '" value="' + escAttr(String(cfg.cert_batch_size)) + '"></label>' +
        '<label class="qc-admin-check"><input type="checkbox" ' +
          'id="qcp-cert-' + escAttr(key) + '"' + (row.supports_certification ? ' checked' : '') +
          '> Available for certification</label>' +
      '</div>' +
      '<button onclick="qcSaveProject(\'' + escAttr(key) + '\')">Save ' +
        esc(QC_CASES[key].label) + '</button>' +
      '<span id="qcp-status-' + escAttr(key) + '" class="qc-note"></span>' +
      '</div>';
  }

  html += '<div class="qc-actions"><button onclick="renderQcHome()">Back</button></div>';
  document.getElementById('qc-view-admin').innerHTML = html;
  qcNav('admin');
}

function qcSaveProject(caseKey) {
  var status = document.getElementById('qcp-status-' + caseKey);
  var body = {
    target_pace_docs_per_hour: Number(document.getElementById('qcp-pace-' + caseKey).value),
    response_window_minutes: Number(document.getElementById('qcp-resp-' + caseKey).value),
    max_defects_per_1000: Number(document.getElementById('qcp-tol-' + caseKey).value),
    cert_batch_size: Number(document.getElementById('qcp-size-' + caseKey).value),
    supports_certification: document.getElementById('qcp-cert-' + caseKey).checked,
    updated_at: new Date().toISOString()
  };

  if (!(body.target_pace_docs_per_hour > 0) || !(body.response_window_minutes > 0) ||
      !(body.cert_batch_size >= 25)) {
    status.textContent = 'Check the numbers — pace and window must be above zero, batch size at least 25.';
    return;
  }

  status.textContent = 'Saving…';
  SB.req('PATCH', '/rest/v1/qc_projects?case_key=eq.' + encodeURIComponent(caseKey), body)
    .then(function (r) {
      if (r && r.error) { status.textContent = 'Save failed.'; return; }
      qcProjects[caseKey] = qcProjects[caseKey] || { case_key: caseKey };
      for (var k in body) {
        if (Object.prototype.hasOwnProperty.call(body, k)) qcProjects[caseKey][k] = body[k];
      }
      status.textContent = 'Saved.';
    });
}
```

- [ ] **Step 3: Link it from the track home, for leadership only**

In `renderQcHome`, replace the actions block:

```js
    '<div class="qc-actions">' +
      '<button onclick="renderQcLaunch()">Start a batch</button> ' +
      '<button onclick="renderQcTaxonomy()">Error taxonomy</button>' +
    '</div>';
```

with:

```js
    '<div class="qc-actions">' +
      '<button onclick="renderQcLaunch()">Start a batch</button> ' +
      '<button onclick="renderQcTaxonomy()">Error taxonomy</button>' +
      (isLeadership(SB.user)
        ? ' <button onclick="renderQcAdmin()">Project targets</button>'
        : '') +
    '</div>';
```

- [ ] **Step 4: Style the editor**

Add to the QC TRACK CSS block:

```css
.qc-admin-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(11rem,1fr));gap:.6rem;margin-bottom:.75rem}
.qc-admin-grid label{display:flex;flex-direction:column;gap:.2rem;font-size:.78rem;color:#9fb0c9}
.qc-admin-check{flex-direction:row!important;align-items:center;gap:.4rem!important}
```

- [ ] **Step 5: Verify in the browser**

Sign in as a leadership account. Expected: a **Project targets** button on the QC Track home, and the editor lists all five cases. Change TransRidge's target pace to 45, save, confirm "Saved.", reload, and confirm the value persisted and the review shell's clock now reads `N / 45`.

Then sign in as a non-leadership account: the button must be absent, and calling `renderQcAdmin()` from the console must bounce back to the home view. The real gate is the `leadership_write_qc_projects` RLS policy — confirm a PATCH from that account is rejected.

- [ ] **Step 6: Commit**

```bash
git add index.html
git commit -m "feat(qc): leadership editor for per-project QC targets"
```

---

### Task 12: Three dials on the track home

**Files:**
- Modify: `index.html` — `// ══ QC TRACK` section

**Interfaces:**
- Consumes: `QC.rollingAccuracy`, `qcAttempts`
- Produces: `qcRollingPillar(field, windowSize)`; a three-dial track home

- [ ] **Step 1: Average the new pillars over the same window**

Accuracy is measured over the last 1,000 certification documents; pace and responsiveness are per-batch scores, so they are averaged over the certification batches inside that same window. Add to the QC TRACK section:

```js
// Averages a per-batch pillar across the certification batches that make up the
// rolling accuracy window, so all three dials describe the same stretch of work.
function qcRollingPillar(field, windowSize) {
  var limit = windowSize || 1000;
  var certs = [];
  for (var i = 0; i < qcAttempts.length; i++) {
    if (qcAttempts[i].batch_type === 'certification') certs.push(qcAttempts[i]);
  }
  certs.sort(function (a, b) {
    return String(b.completed_at || '').localeCompare(String(a.completed_at || ''));
  });
  var docs = 0, sum = 0, n = 0;
  for (var j = 0; j < certs.length && docs < limit; j++) {
    docs += certs[j].docs_reviewed || 0;
    if (certs[j][field] != null) { sum += Number(certs[j][field]); n++; }
  }
  return n ? (sum / n) : null;
}
```

- [ ] **Step 2: Render three dials**

Replace the single-dial block in `renderQcHome`. The current fragment is the `'<div class="qc-dial">' … '</div>'` group; replace it with:

```js
  var paceP = qcRollingPillar('pace', 1000);
  var respP = qcRollingPillar('responsiveness', 1000);

  function dial(label, value, sub, bar) {
    return '<div class="qc-dial">' +
      '<div class="qc-dial-label">' + esc(label) + '</div>' +
      '<div class="qc-dial-value">' + esc(value) + '</div>' +
      '<div class="qc-dial-sub">' + esc(sub) + '</div>' +
      '<div class="qc-dial-bar">' + esc(bar) + '</div>' +
    '</div>';
  }

  var html = '' +
    '<h2>QC Track</h2>' +
    '<p class="qc-lede">Review documents another reviewer already coded. Catch what they got wrong — ' +
      'without changing what they got right.</p>' +
    '<div class="qc-dials">' +
      dial('Accuracy', pillarText, rateText, 'Bar to clear: 2 defects per 1,000 documents') +
      dial('Pace',
           paceP == null ? 'No data yet' : Math.round(paceP) + ' / 100',
           paceP == null ? 'Certify on a case to start measuring'
                         : 'Throughput discounted by accuracy',
           'Bar to clear: 60 docs/hr, held at accuracy') +
      dial('Responsiveness',
           respP == null ? 'No data yet' : Math.round(respP) + ' / 100',
           respP == null ? 'Certify on a case to start measuring'
                         : 'Acknowledgement times across batches',
           'Bar to clear: acknowledge inside 2 minutes') +
    '</div>' +
    '<p class="qc-diag">Judgment and Reliability arrive with the live-project loop.</p>';
```

Keep the actions block from Task 11 appended after this.

- [ ] **Step 3: Style the dial row**

Add to the QC TRACK CSS block:

```css
.qc-dials{display:grid;grid-template-columns:repeat(auto-fit,minmax(17rem,1fr));gap:.75rem}
.qc-dials .qc-dial{max-width:none}
```

- [ ] **Step 4: Verify in the browser**

Open QC Track with at least one certification batch recorded.

Expected: three dials side by side on desktop, stacking on a narrow viewport, with Accuracy carrying its defects-per-1,000 line and Pace and Responsiveness each showing a score or "No data yet". Resize below 900px and confirm nothing overflows horizontally.

- [ ] **Step 5: Run the full suite**

```bash
cd ~/Documents/aa-mastery && node --test
```

Expected: PASS, 92 tests, 0 failures.

- [ ] **Step 6: Commit**

```bash
git add index.html
git commit -m "feat(qc): three-pillar track home with rolling pace and responsiveness"
```

---

## Deferred to Phase 3

- `qc_readiness` table and the weekly supervisor form
- Judgment and Reliability pillars, and the five-pillar composite
- Status ladder (Training → Approaching → QC-Ready → QC-Recognized)
- Simulation/live weighting, and the "Simulation only" label
- Leadership roster view

## Known gaps carried forward

- **Judgment is computed but not surfaced as a pillar.** Its three inputs all exist after this phase — escalation accuracy, `postChangeCompliance`, and correction quality — but the pillar itself belongs with the composite in Phase 3.
- **Reliability has only its simulation half.** Batch completion and pace-curve fade are available; cross-batch drift and the `timesheets` join arrive in Phase 3.
- **Interrupt scripts exist for two cases.** `p3`, `p4` and `ptbr` fall back to no interrupts, which scores responsiveness `null` rather than zero. Authoring their scripts is a content task, not a code change.
