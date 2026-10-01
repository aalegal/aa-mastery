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
  assert.strictEqual(EX.normalizeName('O’Neil'), 'oneil');
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

test('validateEntry numbers rows as they appear on screen, blank rows included', function () {
  var v = EX.validateEntry({ noPii: false, rows: [row({}), row({ first: 'Ana', el: ['ssn'] })] });
  assert.strictEqual(v.problems[0].code, 'NAME');
  assert.strictEqual(v.problems[0].row, 1);
  assert.match(v.problems[0].text, /^Row 2:/);
});

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

test('matchPeople: a doubled row never stands in for a missed household member', function () {
  var dara = person({ first: 'Dara', last: 'Joyner', el: ['plan'] });
  var yara = person({ first: 'Yara', last: 'Joyner', el: ['plan'] });
  var r = EX.gradeDocument({ noPii: false, people: [dara, yara] }, { noPii: false, rows: [typed(yara), typed(yara)] });
  assert.deepStrictEqual(r.defects.map(function (d) { return d.type; }).sort(), ['EXTRA_INDIVIDUAL', 'MISSED_INDIVIDUAL']);
  assert.strictEqual(r.weight, 7);
});

test('matchPeople: first and last typed the wrong way round is two field errors', function () {
  var t = typed(ANA); t.first = 'Rivera'; t.last = 'Ana';
  var r = EX.gradeDocument({ noPii: false, people: [ANA] }, { noPii: false, rows: [t] });
  assert.deepStrictEqual(r.defects.map(function (d) { return d.type + ':' + d.field; }), ['FIELD_ERROR:first', 'FIELD_ERROR:last']);
  assert.strictEqual(r.weight, 2);
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
