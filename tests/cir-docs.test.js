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
