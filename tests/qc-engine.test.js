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

test('accuracyPillar hits every published anchor exactly', function () {
  QC.ACCURACY_ANCHORS.forEach(function (pair) {
    assert.strictEqual(QC.accuracyPillar(pair[0]), pair[1], 'anchor ' + pair[0]);
  });
});

test('accuracyPillar interpolates between anchors and is monotonic', function () {
  assert.strictEqual(QC.accuracyPillar(1.5), 92.5);
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

var HOUR = 3600000;

test('paceStats reports docs per hour from the mark stream', function () {
  var marks = [0];
  for (var i = 1; i <= 30; i++) marks.push(i * (HOUR / 60));
  var s = QC.paceStats(marks);
  assert.strictEqual(s.decisions, 30);
  assert.strictEqual(Math.round(s.docsPerHour), 60);
  assert.strictEqual(s.elapsedMs, HOUR / 2);
});

test('paceStats splits the batch into thirds', function () {
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
  assert.strictEqual(Math.round(QC.pacePillar(60, 90, 60)), 81);
});

test('pacePillar makes rushing strictly worse than working properly', function () {
  var rushing  = QC.pacePillar(75, 60, 60);
  var careful  = QC.pacePillar(60, 100, 60);
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
  var seeded = QC.seedErrors(docs, { seed: 's', density: 1, allowedTypes: ['INCONSISTENCY'] });
  seeded.forEach(function (e) {
    if (e.seededError) {
      assert.ok(e.doc.familyId, 'inconsistency seeded on a non-family document ' + e.doc.id);
    }
  });
  assert.ok(seeded.filter(function (e) { return e.seededError; }).length > 0, 'nothing seeded');
});

function famEntries(codings) {
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
  assert.strictEqual(s.defects, 7.5);
});

test('post-change compliance is reported as a diagnostic', function () {
  var e = QC.applyProtocolChange(plainEntries(10, CLEAN), CHANGE, 5);
  var d = []; for (var i = 0; i < 10; i++) {
    d.push(i >= 5 && i < 8 ? { action: 'correct', coding: e[i].effectiveAnswer } : { action: 'agree' });
  }
  var s = QC.scoreBatch(e, d, {});
  assert.strictEqual(s.diagnostics.postChangeCompliance, 3 / 5);
});

var MIN = 60000;

test('responsivenessScore gives full credit inside the window', function () {
  assert.strictEqual(QC.responsivenessScore([{ firedAt: 0, ackAt: 1 * MIN }], 2), 100);
});

test('responsivenessScore gives full credit exactly at the window', function () {
  assert.strictEqual(QC.responsivenessScore([{ firedAt: 0, ackAt: 2 * MIN }], 2), 100);
});

test('responsivenessScore decays linearly to zero at three windows', function () {
  assert.strictEqual(QC.responsivenessScore([{ firedAt: 0, ackAt: 4 * MIN }], 2), 50);
  assert.strictEqual(QC.responsivenessScore([{ firedAt: 0, ackAt: 6 * MIN }], 2), 0);
});

test('responsivenessScore scores an unacknowledged interrupt zero', function () {
  assert.strictEqual(QC.responsivenessScore([{ firedAt: 0, ackAt: null }], 2), 0);
});

test('responsivenessScore averages across interrupts', function () {
  var s = QC.responsivenessScore([
    { firedAt: 0, ackAt: 1 * MIN },
    { firedAt: 0, ackAt: 4 * MIN },
    { firedAt: 0, ackAt: null }
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

function att(email, name, type, docs, defects, when, extra) {
  var a = { user_email: email, user_name: name, batch_type: type,
            docs_reviewed: docs, defects: defects, completed_at: when };
  for (var k in (extra || {})) a[k] = extra[k];
  return a;
}

test('rollingPillar averages a field over the certification window', function () {
  var a = [
    att('x@y.z', 'X', 'certification', 250, 0, '2026-08-01', { pace: 80 }),
    att('x@y.z', 'X', 'certification', 250, 0, '2026-08-02', { pace: 100 }),
    att('x@y.z', 'X', 'practice',      50,  9, '2026-08-03', { pace: 10 })
  ];
  assert.strictEqual(QC.rollingPillar(a, 'pace', 1000), 90);
});

test('rollingPillar returns null when the field is never populated', function () {
  var a = [att('x@y.z', 'X', 'certification', 250, 0, '2026-08-01', {})];
  assert.strictEqual(QC.rollingPillar(a, 'responsiveness', 1000), null);
});

test('roster groups attempts by person', function () {
  var rows = QC.roster([
    att('a@x.z', 'Ana', 'certification', 250, 1, '2026-08-02'),
    att('b@x.z', 'Ben', 'certification', 250, 5, '2026-08-02'),
    att('a@x.z', 'Ana', 'certification', 250, 0, '2026-08-03')
  ], 1000);
  assert.strictEqual(rows.length, 2);
  var ana = rows.filter(function (r) { return r.email === 'a@x.z'; })[0];
  assert.strictEqual(ana.batches, 2);
  assert.strictEqual(ana.documents, 500);
  assert.strictEqual(ana.defects, 1);
  assert.strictEqual(ana.defectsPer1000, 2);
});

test('roster falls back to the email local part when no name was recorded', function () {
  var rows = QC.roster([att('simon@x.z', null, 'certification', 250, 0, '2026-08-02')], 1000);
  assert.strictEqual(rows[0].name, 'simon');
});

test('roster prefers the most recently recorded name', function () {
  var rows = QC.roster([
    att('a@x.z', 'Old Name', 'certification', 250, 0, '2026-08-01'),
    att('a@x.z', 'New Name', 'certification', 250, 0, '2026-08-05')
  ], 1000);
  assert.strictEqual(rows[0].name, 'New Name');
});

test('roster accuracy ignores practice batches', function () {
  var rows = QC.roster([
    att('a@x.z', 'Ana', 'practice',      50,  40, '2026-08-01'),
    att('a@x.z', 'Ana', 'certification', 250, 0,  '2026-08-02')
  ], 1000);
  assert.strictEqual(rows[0].documents, 250);
  assert.strictEqual(rows[0].defects, 0);
  assert.strictEqual(rows[0].accuracy, 100);
  assert.strictEqual(rows[0].batches, 2, 'batches counts all work, not just certification');
  assert.strictEqual(rows[0].certifications, 1);
});

test('roster sorts strongest first and puts people with no data last', function () {
  var rows = QC.roster([
    att('mid@x.z',  'Mid',  'certification', 250, 1, '2026-08-02'),
    att('none@x.z', 'None', 'practice',      50,  2, '2026-08-02'),
    att('top@x.z',  'Top',  'certification', 250, 0, '2026-08-02')
  ], 1000);
  assert.deepStrictEqual(rows.map(function (r) { return r.name; }), ['Top', 'Mid', 'None']);
  assert.strictEqual(rows[2].accuracy, null);
});

test('roster reports the most recent activity date', function () {
  var rows = QC.roster([
    att('a@x.z', 'Ana', 'certification', 250, 0, '2026-08-02'),
    att('a@x.z', 'Ana', 'practice',      50,  0, '2026-08-09')
  ], 1000);
  assert.strictEqual(rows[0].lastActive, '2026-08-09');
});

test('roster carries the per-person attempts for drill-down', function () {
  var rows = QC.roster([
    att('a@x.z', 'Ana', 'certification', 250, 0, '2026-08-02'),
    att('a@x.z', 'Ana', 'practice',      50,  1, '2026-08-03')
  ], 1000);
  assert.strictEqual(rows[0].attempts.length, 2);
});

test('roster flags a partial accuracy window', function () {
  var rows = QC.roster([att('a@x.z', 'Ana', 'certification', 250, 0, '2026-08-02')], 1000);
  assert.strictEqual(rows[0].partial, true);
});

test('roster tolerates empty input and rows without an email', function () {
  assert.deepStrictEqual(QC.roster([], 1000), []);
  assert.deepStrictEqual(QC.roster(null, 1000), []);
  assert.strictEqual(QC.roster([{ batch_type: 'certification', docs_reviewed: 10 }], 1000).length, 0);
});
