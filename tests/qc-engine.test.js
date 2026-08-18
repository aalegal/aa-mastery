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
