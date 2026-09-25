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
    var t = clean(s).toLowerCase().replace(/['']/g, '').replace(/[.,\-]/g, ' ');
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
  // an empty starter row can still be submitted as "No PII/PHI".
  function validateEntry(entry) {
    var problems = [];
    var rows = ((entry && entry.rows) || []).filter(function (r) { return !isBlankRow(r); });
    var noPii = !!(entry && entry.noPii);
    if (noPii && rows.length) {
      problems.push({ code: 'CONTRADICTION', text: 'Rows are entered and "No PII/PHI" is ticked: pick one.' });
    }
    if (!noPii && !rows.length) {
      problems.push({ code: 'INCOMPLETE', text: 'Add at least one person, or tick "No PII/PHI".' });
    }
    rows.forEach(function (r, i) {
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
    validateEntry: validateEntry
  };
});
