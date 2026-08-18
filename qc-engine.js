/*
 * QC Track engine — pure logic only. No DOM, no network, no globals beyond the
 * single export below. Loaded as a classic script in index.html (window.QC) and
 * as a CommonJS module by the Node test runner (require).
 *
 * Must not use import/export syntax: it is loaded both ways at once.
 */
(function (factory) {
  'use strict';
  var QC = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = QC;
  if (typeof window !== 'undefined') window.QC = QC;
})(function () {
  'use strict';

  // FNV-1a. Turns a batch identity string into a uint32 seed.
  function hashSeed(str) {
    var h = 2166136261;
    for (var i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  // mulberry32. Small, fast, and good enough for seeding a document batch.
  function makeRng(seed) {
    var s = seed >>> 0;
    if (s === 0) s = 0x9e3779b9;
    return function () {
      s = (s + 0x6d2b79f5) >>> 0;
      var t = s;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  var CODING_FIELDS = ['responsive', 'privilege', 'action', 'conf'];

  function isPrivileged(v) {
    return typeof v === 'string' && v !== 'not-privileged';
  }

  // Each case set codes with its own vocabulary — FA_DOCS uses confidential /
  // hc-aeo / fa-flag where the JSON sets use standard / aeo / acp-wpp. Learn the
  // vocabulary from the documents rather than hardcoding either one.
  function buildVocabulary(docs) {
    var vocab = { responsive: [], privilege: [], action: [], conf: [], issues: [] };
    var seen = { responsive: {}, privilege: {}, action: {}, conf: {}, issues: {} };
    for (var i = 0; i < docs.length; i++) {
      var a = docs[i] && docs[i].answer;
      if (!a) continue;
      for (var f = 0; f < CODING_FIELDS.length; f++) {
        var field = CODING_FIELDS[f];
        var val = a[field];
        if (typeof val === 'string' && val && !seen[field][val]) {
          seen[field][val] = 1;
          vocab[field].push(val);
        }
      }
      if (Object.prototype.toString.call(a.issues) === '[object Array]') {
        for (var j = 0; j < a.issues.length; j++) {
          var iss = a.issues[j];
          if (!seen.issues[iss]) { seen.issues[iss] = 1; vocab.issues.push(iss); }
        }
      }
    }
    vocab.responsive.sort(); vocab.privilege.sort(); vocab.action.sort();
    vocab.conf.sort(); vocab.issues.sort();
    return vocab;
  }

  function pickFrom(list, rng) {
    return list[Math.floor(rng() * list.length)];
  }

  // freq values are relative real-world frequencies, not probabilities: over-
  // designation is the commonest finding in live QC, missed privilege the rarest
  // and most severe. They are normalised at selection time.
  var ERROR_TYPES = {
    MISSED_PRIVILEGE: {
      key: 'MISSED_PRIVILEGE', weight: 5, freq: 3,
      label: 'Missed privilege',
      blurb: 'A privileged document coded as not privileged. The most serious defect in review: protected material lands in a production, and recovering it means a clawback, an explanation to the client, and a re-review of everything around it.',
      spot: 'Read the participants before you read the text. Counsel on the From, To or CC line changes the analysis of everything below it.',
      applies: function (a) { return isPrivileged(a.privilege); },
      apply: function () { return { privilege: 'not-privileged', action: 'produce' }; }
    },
    OVER_PRIVILEGE: {
      key: 'OVER_PRIVILEGE', weight: 3, freq: 6,
      label: 'Over-privilege',
      blurb: 'A clean document withheld as privileged. It delays the production, inflates the privilege log, and invites a challenge that costs the client money to defend.',
      spot: 'A lawyer in the thread does not make a document privileged. Ask what legal advice is actually being sought or given.',
      applies: function (a, v) {
        if (isPrivileged(a.privilege)) return false;
        for (var i = 0; i < v.privilege.length; i++) if (isPrivileged(v.privilege[i])) return true;
        return false;
      },
      apply: function (a, v, rng) {
        var opts = [];
        for (var i = 0; i < v.privilege.length; i++) if (isPrivileged(v.privilege[i])) opts.push(v.privilege[i]);
        return { privilege: pickFrom(opts, rng), action: 'withhold' };
      }
    },
    UNDER_DESIGNATION: {
      key: 'UNDER_DESIGNATION', weight: 3, freq: 10,
      label: 'Under-designation',
      blurb: 'Responsive material coded non-responsive. The document is never produced and never surfaces again, so nobody downstream is in a position to catch the mistake.',
      spot: 'Check the document against every issue in the protocol, not only the one you are already pattern-matching on.',
      applies: function (a, v) {
        return a.responsive === 'responsive' && v.responsive.indexOf('non-responsive') !== -1;
      },
      apply: function () { return { responsive: 'non-responsive', issues: [] }; }
    },
    OVER_DESIGNATION: {
      key: 'OVER_DESIGNATION', weight: 2, freq: 30,
      label: 'Over-designation',
      blurb: 'Non-responsive material coded responsive. The commonest finding in real QC. It inflates the production, raises the client’s cost per document, and buries the material that actually matters.',
      spot: 'Responsiveness needs a link to a specific issue. "It mentions the company" is not a link.',
      applies: function (a, v) {
        return a.responsive === 'non-responsive' && v.responsive.indexOf('responsive') !== -1;
      },
      apply: function (a, v, rng) {
        return { responsive: 'responsive', issues: v.issues.length ? [pickFrom(v.issues, rng)] : [] };
      }
    },
    CONFIDENTIALITY: {
      key: 'CONFIDENTIALITY', weight: 2, freq: 12,
      label: 'Confidentiality mis-designation',
      blurb: 'The wrong confidentiality tier. Under-designating exposes client material to people who should not see it; over-designating triggers a challenge and a re-review of the whole set.',
      spot: 'The tier follows the content, not the sender. A routine scheduling email from an executive is still routine.',
      applies: function (a, v) { return !!a.conf && v.conf.length > 1; },
      apply: function (a, v, rng) {
        var opts = [];
        for (var i = 0; i < v.conf.length; i++) if (v.conf[i] !== a.conf) opts.push(v.conf[i]);
        return { conf: pickFrom(opts, rng) };
      }
    },
    WRONG_ISSUES: {
      key: 'WRONG_ISSUES', weight: 1, freq: 25,
      label: 'Wrong issue tags',
      blurb: 'The right responsiveness call with the wrong issue codes. Low severity on its own, but it silently corrupts every issue-based search, report and privilege cut built on top of the set.',
      spot: 'Re-read the issue definitions in the protocol. Tagging by topic rather than by the protocol’s definition is the usual cause.',
      applies: function (a, v) {
        return Object.prototype.toString.call(a.issues) === '[object Array]' &&
               a.issues.length > 0 && v.issues.length > 1;
      },
      apply: function (a, v, rng) {
        var others = [];
        for (var i = 0; i < v.issues.length; i++) {
          if (a.issues.indexOf(v.issues[i]) === -1) others.push(v.issues[i]);
        }
        if (!others.length) return { issues: a.issues.slice(0, a.issues.length - 1) };
        return { issues: [pickFrom(others, rng)] };
      }
    }
  };

  var PHASE1_TYPES = [
    'MISSED_PRIVILEGE', 'OVER_PRIVILEGE', 'UNDER_DESIGNATION',
    'OVER_DESIGNATION', 'CONFIDENTIALITY', 'WRONG_ISSUES'
  ];

  return {
    hashSeed: hashSeed,
    makeRng: makeRng,
    isPrivileged: isPrivileged,
    buildVocabulary: buildVocabulary,
    ERROR_TYPES: ERROR_TYPES,
    PHASE1_TYPES: PHASE1_TYPES
  };
});
