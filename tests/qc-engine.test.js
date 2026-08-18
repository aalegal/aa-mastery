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
  assert.strictEqual(s.defects, 2.5);
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
    { action: 'correct', coding: ANS },
    { action: 'agree' },
    { action: 'correct', coding: { responsive: 'non-responsive', privilege: 'acp', action: 'withhold', conf: 'standard', issues: [] } }
  ];
  var s = QC.scoreBatch(entries, decisions, {});
  assert.strictEqual(s.diagnostics.catchRate, 1);
  assert.strictEqual(s.diagnostics.falseCorrectionRate, 0.5);
  assert.strictEqual(s.diagnostics.familyAgreement, null);
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
