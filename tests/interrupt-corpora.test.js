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
  joba: 'REL_DOCS',
  p3:   'P3_DOCS',
  p4:   'P4_DOCS',
  ptbr: 'PTBR_DOCS'
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

// FA_DOCS is 15 hand-authored entries plus ~485 pushed by a generator at load time,
// so static analysis can only see the hand-authored portion. The bar here is scaled to
// that portion; the full-corpus proof is the browser check in Task 2 Step 6, which
// counts documents the change actually amended in a live batch.
test('the firstam protocol change matches the hand-authored FA documents', function () {
  var block = SRC.slice(SRC.indexOf('var FA_DOCS'), SRC.indexOf('// FA-DATA-END'));
  var authored = (block.match(/id:"FA-/g) || []).length;
  assert.ok(authored >= 10, 'expected the hand-authored block, found ' + authored + ' entries');

  var change = QC.INTERRUPTS.firstam.filter(function (m) { return m.type === 'change'; })[0].change;
  var field = Object.keys(change.when)[0];
  var hits = (block.match(new RegExp(field + ':"' + change.when[field] + '"', 'g')) || []).length;
  var pct = 100 * hits / authored;
  assert.ok(hits >= 5, 'firstam matched only ' + hits + ' of ' + authored + ' authored documents');
  assert.ok(pct >= 5, 'firstam matched ' + pct.toFixed(1) + '% - below the 5% floor');
});
