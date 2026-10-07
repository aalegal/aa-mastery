/*
 * Extraction engine — grading for the Cyber Incident Response matter. Pure logic
 * only: no DOM, no network, no globals beyond the single export below. Loaded as
 * a classic script in index.html (window.EX) and as a CommonJS module by the
 * Node test runner (require).
 *
 * Must not use import/export syntax: it is loaded both ways at once.
 */
(function (factory) {
  'use strict';
  var EX = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = EX;
  if (typeof window !== 'undefined') window.EX = EX;
})(function () {
  'use strict';

  var ELEMENTS = ['ssn', 'dl', 'passport', 'fin', 'card', 'login', 'bio', 'mrn', 'plan', 'med'];
  var FIELDS = ['first', 'last', 'dob', 'street', 'city', 'state', 'zip'];

  function clean(s) { return String(s === null || s === undefined ? '' : s).trim(); }

  // "Ana M." and "ana" are the same name; so are "O'Neil" and "ONeil".
  function normalizeName(s) {
    var t = clean(s).toLowerCase().replace(/['’]/g, '').replace(/[.,\-]/g, ' ');
    var parts = t.split(/\s+/).filter(Boolean);
    var long = parts.filter(function (p) { return p.length > 1; });
    return (long.length ? long : parts).join(' ');
  }

  function pad2(n) { return (n < 10 ? '0' : '') + n; }

  function validDate(y, m, d) {
    if (y < 1900 || y > 2100 || m < 1 || m > 12 || d < 1) return false;
    var dt = new Date(Date.UTC(y, m - 1, d));
    return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
  }

  // '' when blank, 'YYYY-MM-DD' when valid, null when present but unusable --
  // including any two-digit year, which entry refuses before grading can.
  function normalizeDob(s) {
    var v = clean(s), m;
    if (!v) return '';
    m = v.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
    if (m) return validDate(+m[1], +m[2], +m[3]) ? m[1] + '-' + pad2(+m[2]) + '-' + pad2(+m[3]) : null;
    m = v.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
    if (m) return validDate(+m[3], +m[1], +m[2]) ? m[3] + '-' + pad2(+m[1]) + '-' + pad2(+m[2]) : null;
    return null;
  }

  var STREET_WORDS = {
    street: 'st', avenue: 'ave', court: 'ct', lane: 'ln', road: 'rd', drive: 'dr',
    boulevard: 'blvd', apartment: 'apt', suite: 'ste', place: 'pl', terrace: 'ter',
    circle: 'cir', highway: 'hwy', parkway: 'pkwy', way: 'way',
    north: 'n', south: 's', east: 'e', west: 'w',
    northeast: 'ne', northwest: 'nw', southeast: 'se', southwest: 'sw'
  };

  function normalizeStreet(s) {
    var words = clean(s).toLowerCase().replace(/#/g, ' apt ').replace(/[.,]/g, ' ')
      .split(/\s+/).filter(Boolean)
      .map(function (w) { return STREET_WORDS[w] || w; });
    var out = [];
    words.forEach(function (w) { if (!(w === 'apt' && out[out.length - 1] === 'apt')) out.push(w); });
    return out.join(' ');
  }

  function normalizeCity(s) { return clean(s).toLowerCase().replace(/\s+/g, ' '); }

  var STATES = {
    alabama: 'AL', alaska: 'AK', arizona: 'AZ', arkansas: 'AR', california: 'CA',
    colorado: 'CO', connecticut: 'CT', delaware: 'DE', 'district of columbia': 'DC',
    florida: 'FL', georgia: 'GA', hawaii: 'HI', idaho: 'ID', illinois: 'IL',
    indiana: 'IN', iowa: 'IA', kansas: 'KS', kentucky: 'KY', louisiana: 'LA',
    maine: 'ME', maryland: 'MD', massachusetts: 'MA', michigan: 'MI', minnesota: 'MN',
    mississippi: 'MS', missouri: 'MO', montana: 'MT', nebraska: 'NE', nevada: 'NV',
    'new hampshire': 'NH', 'new jersey': 'NJ', 'new mexico': 'NM', 'new york': 'NY',
    'north carolina': 'NC', 'north dakota': 'ND', ohio: 'OH', oklahoma: 'OK',
    oregon: 'OR', pennsylvania: 'PA', 'rhode island': 'RI', 'south carolina': 'SC',
    'south dakota': 'SD', tennessee: 'TN', texas: 'TX', utah: 'UT', vermont: 'VT',
    virginia: 'VA', washington: 'WA', 'west virginia': 'WV', wisconsin: 'WI', wyoming: 'WY'
  };

  function normalizeState(s) {
    var v = clean(s).toLowerCase().replace(/\./g, '').replace(/\s+/g, ' ');
    if (!v) return '';
    return STATES[v] || v.toUpperCase();
  }

  function normalizeZip(s) { return clean(s).replace(/\D/g, '').slice(0, 5); }

  function editDistance(a, b) {
    if (a === b) return 0;
    var prev = [], cur, i, j;
    for (j = 0; j <= b.length; j++) prev[j] = j;
    for (i = 1; i <= a.length; i++) {
      cur = [i];
      for (j = 1; j <= b.length; j++) {
        cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1,
                          prev[j - 1] + (a.charAt(i - 1) === b.charAt(j - 1) ? 0 : 1));
      }
      prev = cur;
    }
    return prev[b.length];
  }

  function hasElement(el) { return ELEMENTS.some(function (k) { return !!(el && el[k]); }); }

  function isBlankRow(r) {
    return FIELDS.every(function (f) { return !clean(r && r[f]); }) && !hasElement(r && r.el);
  }

  // Problems block Submit. Wholly blank rows are ignored, so a fresh grid with
  // an empty starter row can still be submitted as "No PII/PHI". Row numbers in
  // the messages count every grid row, blank ones included, so "Row 3" is the
  // third row on screen.
  function validateEntry(entry) {
    var problems = [];
    var all = (entry && entry.rows) || [];
    var rows = all.filter(function (r) { return !isBlankRow(r); });
    var noPii = !!(entry && entry.noPii);
    if (noPii && rows.length) {
      problems.push({ code: 'CONTRADICTION', text: 'Rows are entered and "No PII/PHI" is ticked: pick one.' });
    }
    if (!noPii && !rows.length) {
      problems.push({ code: 'INCOMPLETE', text: 'Add at least one person, or tick "No PII/PHI".' });
    }
    all.forEach(function (r, i) {
      if (isBlankRow(r)) return;
      var n = i + 1;
      if (!clean(r.first) || !clean(r.last)) {
        problems.push({ code: 'NAME', row: i, text: 'Row ' + n + ': first and last name are both required.' });
      }
      if (!hasElement(r.el)) {
        problems.push({ code: 'NO_ELEMENT', row: i, text: 'Row ' + n + ': tick at least one data element, or delete the row.' });
      }
      if (normalizeDob(r.dob) === null) {
        problems.push({ code: 'DOB', row: i, text: 'Row ' + n + ': date of birth must be a real date, month first, with a four-digit year.' });
      }
    });
    return { ok: problems.length === 0, problems: problems, rows: rows };
  }

  var DEFECT_WEIGHTS = { MISSED_INDIVIDUAL: 5, MISSED_ELEMENT: 3, EXTRA_INDIVIDUAL: 2, EXTRA_ELEMENT: 1, FIELD_ERROR: 1 };

  var NORMALIZE = {
    first: normalizeName,
    last: normalizeName,
    dob: function (s) { var d = normalizeDob(s); return d === null ? '#invalid:' + clean(s) : d; },
    street: normalizeStreet,
    city: normalizeCity,
    state: normalizeState,
    zip: normalizeZip
  };

  function fullName(p) { return (normalizeName(p.first) + ' ' + normalizeName(p.last)).trim(); }
  function nameOf(p) { return (clean(p.first) + ' ' + clean(p.last)).trim(); }
  function sameDob(a, b) { var x = normalizeDob(a.dob), y = normalizeDob(b.dob); return !!x && x === y; }
  function sameStreet(a, b) { var x = normalizeStreet(a.street); return x !== '' && x === normalizeStreet(b.street); }

  // Among keys the row could be, prefer the one whose date of birth matches, then
  // the one whose street matches, then the first in document order.
  function bestKey(row, candidates) {
    var byDob = candidates.filter(function (c) { return sameDob(c.p, row); });
    if (byDob.length) return byDob[0];
    var byStreet = candidates.filter(function (c) { return sameStreet(c.p, row); });
    if (byStreet.length) return byStreet[0];
    return candidates[0];
  }

  // Exact names first; then a name within two edits of a remaining key is the
  // same person with a typo, so one slip is not scored as a missed person plus
  // an extra one.
  function matchPeople(keyPeople, rows) {
    var keys = (keyPeople || []).map(function (p) { return { p: p, name: fullName(p), used: false }; });
    var pairs = [], extra = [], pending = [];
    (rows || []).forEach(function (row) {
      var name = fullName(row);
      var exact = keys.filter(function (k) { return !k.used && name !== '' && k.name === name; });
      if (!exact.length) { pending.push(row); return; }
      var k = bestKey(row, exact);
      k.used = true;
      pairs.push({ key: k.p, row: row, nameTypo: false });
    });
    pending.forEach(function (row) {
      var name = fullName(row);
      // A second row for someone already matched is a duplicate, never a typo
      // for another person: otherwise a doubled entry could hide a missed one.
      if (name && keys.some(function (k) { return k.used && k.name === name; })) { extra.push(row); return; }
      // First and last typed the wrong way round still identify the person.
      var swapped = (normalizeName(row.last) + ' ' + normalizeName(row.first)).trim();
      var near = [];
      keys.forEach(function (k) {
        if (k.used || !name) return;
        var d = (swapped === k.name) ? 0 : editDistance(name, k.name);
        if (d <= 2) near.push({ k: k, d: d });
      });
      if (!near.length) { extra.push(row); return; }
      var best = Math.min.apply(null, near.map(function (n) { return n.d; }));
      var closest = near.filter(function (n) { return n.d === best; }).map(function (n) { return n.k; });
      var k = bestKey(row, closest);
      k.used = true;
      pairs.push({ key: k.p, row: row, nameTypo: true });
    });
    var missed = keys.filter(function (k) { return !k.used; }).map(function (k) { return k.p; });
    return { pairs: pairs, missed: missed, extra: extra };
  }

  // The best explanation for a row that should not exist. A name that matches an
  // expected person means that person already has a row; otherwise a notPeople
  // entry whose name holds every word the reviewer typed; else the document's
  // own reason.
  function extraReason(answer, row) {
    var name = fullName(row);
    var twice = ((answer && answer.people) || []).some(function (p) {
      return name !== '' && editDistance(fullName(p), name) <= 2;
    });
    if (twice) return 'This person already has a row: one row per person per document.';
    var words = name.split(' ').filter(Boolean);
    var hits = ((answer && answer.notPeople) || []).filter(function (np) {
      var n = ' ' + normalizeName(np.name) + ' ';
      return words.length && words.every(function (w) { return n.indexOf(' ' + w + ' ') !== -1; });
    });
    if (hits.length) return hits[0].why;
    if (answer && answer.why) return answer.why;
    return 'Not an affected individual in this document.';
  }

  function gradeDocument(answer, entry) {
    var defects = [], lines = [];
    var keyPeople = (answer && !answer.noPii) ? (answer.people || []) : [];
    var rows = (entry && !entry.noPii)
      ? (entry.rows || []).filter(function (r) { return !isBlankRow(r); })
      : [];
    var m = matchPeople(keyPeople, rows);
    function add(d) { d.weight = DEFECT_WEIGHTS[d.type]; defects.push(d); }

    m.pairs.forEach(function (pr) {
      var who = nameOf(pr.key), why = pr.key.why || {}, whyNot = pr.key.whyNot || {};
      var line = { kind: 'matched', row: pr.row, key: pr.key, fieldErrors: {}, missedElements: [], extraElements: [] };
      FIELDS.forEach(function (f) {
        if ((f === 'first' || f === 'last') && !pr.nameTypo) return;
        if (NORMALIZE[f](pr.row[f]) !== NORMALIZE[f](pr.key[f])) {
          line.fieldErrors[f] = clean(pr.key[f]);
          add({ type: 'FIELD_ERROR', person: who, field: f, expected: clean(pr.key[f]), got: clean(pr.row[f]) });
        }
      });
      ELEMENTS.forEach(function (e) {
        var want = !!(pr.key.el && pr.key.el[e]), got = !!(pr.row.el && pr.row.el[e]);
        if (want && !got) { line.missedElements.push(e); add({ type: 'MISSED_ELEMENT', person: who, field: e, why: why[e] || '' }); }
        if (!want && got) { line.extraElements.push(e); add({ type: 'EXTRA_ELEMENT', person: who, field: e, why: whyNot[e] || '' }); }
      });
      lines.push(line);
    });
    m.extra.forEach(function (r) {
      var reason = extraReason(answer, r);
      lines.push({ kind: 'extra', row: r, why: reason });
      add({ type: 'EXTRA_INDIVIDUAL', person: nameOf(r), why: reason });
    });
    m.missed.forEach(function (k) {
      var reason = (k.why && k.why.person) || '';
      lines.push({ kind: 'missed', key: k, why: reason });
      add({ type: 'MISSED_INDIVIDUAL', person: nameOf(k), why: reason });
    });
    var weight = defects.reduce(function (s, d) { return s + d.weight; }, 0);
    return { defects: defects, weight: weight, perfect: defects.length === 0, lines: lines };
  }

  function summarize(results) {
    var breakdown = {};
    Object.keys(DEFECT_WEIGHTS).forEach(function (t) { breakdown[t] = 0; });
    var perfect = 0;
    (results || []).forEach(function (r) {
      if (r.perfect) perfect++;
      (r.defects || []).forEach(function (d) { if (breakdown[d.type] !== undefined) breakdown[d.type]++; });
    });
    var n = (results || []).length;
    return { submitted: n, perfect: perfect, accuracy: n ? perfect / n : null, breakdown: breakdown };
  }

  // The submission times of the latest working session. A gap longer than gapMs
  // starts a new session, so an overnight break does not drag pace toward zero.
  function currentSession(marks, gapMs) {
    var t = (marks || []).slice().sort(function (a, b) { return a - b; });
    if (!t.length) return [];
    var start = t.length - 1;
    while (start > 0 && t[start] - t[start - 1] <= gapMs) start--;
    return t.slice(start);
  }

  function entryFromAnswer(answer) {
    return {
      noPii: !!(answer && answer.noPii),
      rows: ((answer && answer.people) || []).map(function (p) {
        var el = {};
        ELEMENTS.forEach(function (e) { el[e] = !!(p.el && p.el[e]); });
        return { first: p.first, last: p.last, dob: p.dob, street: p.street,
                 city: p.city, state: p.state, zip: p.zip, el: el };
      })
    };
  }

  function resultStatus(result) {
    if (!result) return 'none';
    if (result.perfect) return 'correct';
    return (result.defects || []).some(function (d) { return d.type === 'MISSED_INDIVIDUAL'; }) ? 'wrong' : 'partial';
  }

  return {
    ELEMENTS: ELEMENTS,
    FIELDS: FIELDS,
    normalizeName: normalizeName,
    normalizeDob: normalizeDob,
    normalizeStreet: normalizeStreet,
    normalizeCity: normalizeCity,
    normalizeState: normalizeState,
    normalizeZip: normalizeZip,
    editDistance: editDistance,
    hasElement: hasElement,
    isBlankRow: isBlankRow,
    validateEntry: validateEntry,
    DEFECT_WEIGHTS: DEFECT_WEIGHTS,
    matchPeople: matchPeople,
    gradeDocument: gradeDocument,
    summarize: summarize,
    currentSession: currentSession,
    entryFromAnswer: entryFromAnswer,
    resultStatus: resultStatus
  };
});
