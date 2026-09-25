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
