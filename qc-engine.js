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
    },
    INCONSISTENCY: {
      key: 'INCONSISTENCY', weight: 2, freq: 10,
      label: 'Inconsistency',
      blurb: 'One member of a near-duplicate family coded differently from its siblings. Threads, re-sends and forwarded copies must land on the same call, or the production contradicts itself and every downstream report inherits the contradiction.',
      spot: 'Read the subject line for RE: and FW: prefixes, then check what you did with the rest of the family before you decide this one.',
      applies: function (a, v, doc) { return !!(doc && doc.familyId) && v.conf.length > 1; },
      apply: function (a, v, rng) {
        var opts = [];
        for (var i = 0; i < v.conf.length; i++) if (v.conf[i] !== a.conf) opts.push(v.conf[i]);
        return { conf: pickFrom(opts, rng) };
      }
    }
  };

  var PHASE1_TYPES = [
    'MISSED_PRIVILEGE', 'OVER_PRIVILEGE', 'UNDER_DESIGNATION',
    'OVER_DESIGNATION', 'CONFIDENTIALITY', 'WRONG_ISSUES'
  ];

  var PHASE2_TYPES = PHASE1_TYPES.concat(['INCONSISTENCY']);

  function copyAnswer(a) {
    var out = {};
    for (var k in a) {
      if (!Object.prototype.hasOwnProperty.call(a, k)) continue;
      out[k] = Object.prototype.toString.call(a[k]) === '[object Array]' ? a[k].slice() : a[k];
    }
    return out;
  }

  function pickWeighted(candidates, rng) {
    var total = 0, i;
    for (i = 0; i < candidates.length; i++) total += candidates[i].freq;
    var roll = rng() * total;
    for (i = 0; i < candidates.length; i++) {
      roll -= candidates[i].freq;
      if (roll <= 0) return candidates[i];
    }
    return candidates[candidates.length - 1];
  }

  // Produces the coding a prior reviewer "submitted": either the correct answer,
  // or the answer mutated into a plausible mistake. Source documents are never
  // modified — priorCoding is always a fresh object.
  function seedErrors(docs, opts) {
    opts = opts || {};
    var density = opts.density == null ? 0.15 : opts.density;
    var vocab = opts.vocabulary || buildVocabulary(docs);
    var allowed = opts.allowedTypes || PHASE1_TYPES;
    var rng = opts.rng || makeRng(hashSeed(opts.seed || 'default'));
    var out = [];

    for (var i = 0; i < docs.length; i++) {
      var doc = docs[i];
      var answer = doc.answer || {};
      var prior = copyAnswer(answer);
      var seeded = null;

      // Draw for every document, error or not, so the stream stays aligned and
      // the batch remains reproducible from the seed alone.
      var roll = rng();
      if (roll < density) {
        var candidates = [];
        for (var t = 0; t < allowed.length; t++) {
          var type = ERROR_TYPES[allowed[t]];
          if (type && type.applies(answer, vocab, doc)) candidates.push(type);
        }
        if (candidates.length) {
          var picked = pickWeighted(candidates, rng);
          var patch = picked.apply(answer, vocab, rng);
          for (var f in patch) {
            if (Object.prototype.hasOwnProperty.call(patch, f)) prior[f] = patch[f];
          }
          seeded = { type: picked.key, weight: picked.weight, patch: patch };
        }
      }
      out.push({ doc: doc, priorCoding: prior, seededError: seeded });
    }
    return out;
  }

  function sameIssues(a, b) {
    var x = (a || []).slice().sort();
    var y = (b || []).slice().sort();
    if (x.length !== y.length) return false;
    for (var i = 0; i < x.length; i++) if (x[i] !== y[i]) return false;
    return true;
  }

  function codingMatches(a, b) {
    a = a || {}; b = b || {};
    for (var i = 0; i < CODING_FIELDS.length; i++) {
      var f = CODING_FIELDS[i];
      if ((a[f] || null) !== (b[f] || null)) return false;
    }
    return sameIssues(a.issues, b.issues);
  }

  // What coding the document actually ends up with once the reviewer is done.
  // Escalated documents have no resolved coding: they went up instead.
  function resultingCoding(entry, decision) {
    if (!decision) return null;
    if (decision.action === 'correct') return decision.coding;
    if (decision.action === 'agree') return entry.priorCoding;
    return null;
  }

  function familyAgreement(entries, decisions) {
    var byFam = {}, i;
    for (i = 0; i < entries.length; i++) {
      var fid = entries[i].doc.familyId;
      if (!fid) continue;
      if (!byFam[fid]) byFam[fid] = [];
      var c = resultingCoding(entries[i], (decisions || [])[i]);
      if (c) byFam[fid].push(c);
    }
    var total = 0, agreed = 0;
    for (var f in byFam) {
      if (!Object.prototype.hasOwnProperty.call(byFam, f)) continue;
      var list = byFam[f];
      if (list.length < 2) continue;
      total++;
      var same = true;
      for (i = 1; i < list.length; i++) {
        if (!codingMatches(list[0], list[i])) { same = false; break; }
      }
      if (same) agreed++;
    }
    return total ? (agreed / total) : null;
  }

  var DEFECT_WEIGHTS = { FALSE_CORRECTION: 2, MISSED_ESCALATION: 2, OVER_ESCALATION: 1, INSTRUCTION_DRIFT: 3 };

  function ok() { return { correct: true, defect: null, weight: 0 }; }
  function bad(defect, weight) { return { correct: false, defect: defect, weight: weight }; }

  // Two-sided by design. Rubber-stamping (MISS) and over-correcting
  // (FALSE_CORRECTION) are both real ways people lose a QC seat, so both cost.
  function classifyDecision(entry, decision, isAmbiguous) {
    var action = decision && decision.action;
    var truth = entry.effectiveAnswer || entry.doc.answer || {};

    if (isAmbiguous) {
      return action === 'escalate' ? ok() : bad('MISSED_ESCALATION', DEFECT_WEIGHTS.MISSED_ESCALATION);
    }
    if (action === 'escalate') {
      return bad('OVER_ESCALATION', DEFECT_WEIGHTS.OVER_ESCALATION);
    }

    var seeded = entry.seededError;
    if (action === 'correct') {
      if (codingMatches(decision.coding, truth)) return ok();
      if (seeded) return bad('BAD_FIX', seeded.weight / 2);
      // Tried to apply the change and got it wrong: a real attempt, half the
      // cost of not trying at all.
      if (entry.instructionChanged) return bad('BAD_FIX', DEFECT_WEIGHTS.INSTRUCTION_DRIFT / 2);
      return bad('FALSE_CORRECTION', DEFECT_WEIGHTS.FALSE_CORRECTION);
    }
    if (seeded) return bad('MISS', seeded.weight);
    if (entry.instructionChanged && !codingMatches(entry.priorCoding, truth)) {
      return bad('INSTRUCTION_DRIFT', DEFECT_WEIGHTS.INSTRUCTION_DRIFT);
    }
    return ok();
  }

  function scoreBatch(entries, decisions, opts) {
    opts = opts || {};
    var ambiguous = {};
    (opts.ambiguousIds || []).forEach(function (id) { ambiguous[id] = 1; });

    var counts = { MISS: 0, BAD_FIX: 0, FALSE_CORRECTION: 0, MISSED_ESCALATION: 0, OVER_ESCALATION: 0, INSTRUCTION_DRIFT: 0, CORRECT: 0 };
    var weighted = 0, cleanDocs = 0, falseCorrections = 0;
    var changedDocs = 0, changedRight = 0;
    var seededWeight = 0, caughtWeight = 0;

    for (var i = 0; i < entries.length; i++) {
      var e = entries[i];
      var isAmb = !!ambiguous[e.doc.id];
      var r = classifyDecision(e, decisions[i] || { action: 'agree' }, isAmb);

      if (r.defect) { counts[r.defect]++; weighted += r.weight; } else { counts.CORRECT++; }

      if (!isAmb) {
        if (e.seededError) {
          seededWeight += e.seededError.weight;
          if (r.correct) caughtWeight += e.seededError.weight;
          else if (r.defect === 'BAD_FIX') caughtWeight += e.seededError.weight * 0.5;
        } else {
          cleanDocs++;
          if (r.defect === 'FALSE_CORRECTION') falseCorrections++;
        }
      }
      if (e.instructionChanged) { changedDocs++; if (r.correct) changedRight++; }
    }

    var defects = weighted / 2;
    return {
      docsReviewed: entries.length,
      defects: defects,
      defectsPer1000: entries.length ? (1000 * defects / entries.length) : 0,
      counts: counts,
      diagnostics: {
        catchRate: seededWeight ? (caughtWeight / seededWeight) : null,
        falseCorrectionRate: cleanDocs ? (falseCorrections / cleanDocs) : null,
        familyAgreement: familyAgreement(entries, decisions),
        postChangeCompliance: changedDocs ? (changedRight / changedDocs) : null
      }
    };
  }

  // Calibration, not a derived law. Held in one table so it can be retuned once
  // real QC-Recognized outcomes accumulate. 2 defects/1,000 == pillar 90 is the
  // QC-Ready floor and matches the stated 1-in-1,000 tolerance plus headroom for
  // a single low-severity slip.
  var ACCURACY_ANCHORS = [
    [0, 100], [1, 95], [2, 90], [5, 78], [10, 60], [20, 35], [40, 10], [60, 0]
  ];

  function accuracyPillar(defectsPer1000) {
    var x = defectsPer1000;
    if (!(x > 0)) return 100;
    var last = ACCURACY_ANCHORS[ACCURACY_ANCHORS.length - 1];
    if (x >= last[0]) return 0;
    for (var i = 1; i < ACCURACY_ANCHORS.length; i++) {
      if (x <= ACCURACY_ANCHORS[i][0]) {
        var x0 = ACCURACY_ANCHORS[i - 1][0], y0 = ACCURACY_ANCHORS[i - 1][1];
        var x1 = ACCURACY_ANCHORS[i][0], y1 = ACCURACY_ANCHORS[i][1];
        return y0 + (y1 - y0) * (x - x0) / (x1 - x0);
      }
    }
    return 0;
  }

  // The denominator is literally 1,000 documents: the pillar IS the client's
  // metric, with no rescaling. Practice batches never contribute.
  function rollingAccuracy(attempts, windowSize) {
    var limit = windowSize || 1000;
    var certs = [];
    for (var i = 0; i < (attempts || []).length; i++) {
      if (attempts[i] && attempts[i].batch_type === 'certification') certs.push(attempts[i]);
    }
    certs.sort(function (a, b) {
      return String(b.completed_at || '').localeCompare(String(a.completed_at || ''));
    });

    var documents = 0, defects = 0;
    for (var j = 0; j < certs.length && documents < limit; j++) {
      documents += certs[j].docs_reviewed || 0;
      defects += certs[j].defects || 0;
    }

    var rate = documents ? (1000 * defects / documents) : 0;
    return {
      documents: documents,
      defects: defects,
      defectsPer1000: rate,
      pillar: documents ? accuracyPillar(rate) : null,
      partial: documents < limit
    };
  }

  // marks[0] is the batch start; every later mark is one recorded decision.
  function paceStats(marks) {
    var empty = { docsPerHour: 0, thirds: [0, 0, 0], fade: null, elapsedMs: 0, decisions: 0 };
    if (!marks || marks.length < 2) return empty;

    var n = marks.length - 1;
    var elapsed = marks[n] - marks[0];
    var dph = elapsed > 0 ? (n / (elapsed / 3600000)) : 0;

    var size = Math.floor(n / 3);
    var thirds = [0, 0, 0];
    if (size > 0) {
      for (var t = 0; t < 3; t++) {
        var lo = 1 + t * size;
        var hi = (t === 2) ? n : (t + 1) * size;
        var span = marks[hi] - marks[lo - 1];
        var cnt = hi - lo + 1;
        thirds[t] = span > 0 ? (cnt / (span / 3600000)) : 0;
      }
    }

    return {
      docsPerHour: dph,
      thirds: thirds,
      fade: thirds[0] > 0 ? (thirds[2] / thirds[0]) : null,
      elapsedMs: elapsed,
      decisions: n
    };
  }

  // Pace is never scored alone. Throughput is discounted by the square of the
  // quality it was bought at, so 75 docs/hr at a collapsed accuracy scores below
  // 60 docs/hr done properly. That is the whole point.
  function pacePillar(docsPerHour, accuracyPillarValue, targetPace) {
    var target = targetPace || 60;
    var q = Math.max(0, Math.min(1, (accuracyPillarValue || 0) / 100));
    var effective = (docsPerHour || 0) * q * q;
    if (target <= 0) return 0;
    return 100 * Math.min(1.25, effective / target);
  }

  var FAMILY_VARIANTS = [
    { suffix: '-A', prefix: 'RE: ' },
    { suffix: '-B', prefix: 'FW: ' },
    { suffix: '-C', prefix: 'RE: RE: ' },
    { suffix: '-D', prefix: 'FW: FW: ' }
  ];

  function familyMember(base, famId, k) {
    var copy = {};
    for (var key in base) {
      if (Object.prototype.hasOwnProperty.call(base, key)) copy[key] = base[key];
    }
    copy.answer = copyAnswer(base.answer || {});
    copy.familyId = famId;
    if (k > 0) {
      var v = FAMILY_VARIANTS[(k - 1) % FAMILY_VARIANTS.length];
      copy.id = base.id + v.suffix;
      copy.subject = v.prefix + (base.subject || base.id);
    }
    return copy;
  }

  // Threads, re-sends and forwarded copies are how real productions look, and
  // coding them differently is a standard QC finding. The corpus has almost no
  // natural near-duplicates, so they are generated: siblings share ground truth
  // and differ only in id and subject.
  function makeFamilies(docs, opts) {
    opts = opts || {};
    var rng = opts.rng || makeRng(hashSeed(opts.seed || 'families'));
    var familySize = opts.familySize || 3;
    var familyCount = opts.familyCount == null
      ? Math.max(1, Math.round(docs.length * 0.06))
      : opts.familyCount;

    var out = docs.slice();
    var used = {};
    var familyIds = [];

    function freeSlot() {
      for (var t = 0; t < 200; t++) {
        var c = Math.floor(rng() * out.length);
        if (!used[c]) return c;
      }
      for (var i = 0; i < out.length; i++) if (!used[i]) return i;
      return -1;
    }

    for (var f = 0; f < familyCount; f++) {
      var seedIdx = freeSlot();
      if (seedIdx < 0) break;
      used[seedIdx] = 1;
      var base = out[seedIdx];
      var famId = 'FAM-' + (f + 1);
      out[seedIdx] = familyMember(base, famId, 0);

      var placed = 1;
      for (var k = 1; k < familySize; k++) {
        var slot = freeSlot();
        if (slot < 0) break;
        used[slot] = 1;
        out[slot] = familyMember(base, famId, k);
        placed++;
      }
      // A one-member "family" cannot be inconsistent -- drop it.
      if (placed < 2) { out[seedIdx] = base; break; }
      familyIds.push(famId);
    }

    return { docs: out, familyIds: familyIds };
  }

  // A mid-batch instruction change does not create a "mistake" by the prior
  // reviewer: it changes what correct means from this point on. Documents after
  // the change point are scored against the amended rule, so agreeing with
  // coding that predates it is instruction drift.
  function applyProtocolChange(entries, change, fromIndex) {
    for (var i = fromIndex; i < entries.length; i++) {
      var a = entries[i].doc.answer || {};
      var hit = true, k;
      for (k in change.when) {
        if (!Object.prototype.hasOwnProperty.call(change.when, k)) continue;
        if (a[k] !== change.when[k]) { hit = false; break; }
      }
      if (!hit) continue;
      var eff = copyAnswer(a);
      for (k in change.then) {
        if (Object.prototype.hasOwnProperty.call(change.then, k)) eff[k] = change.then[k];
      }
      entries[i].effectiveAnswer = eff;
      entries[i].instructionChanged = true;
    }
    return entries;
  }

  return {
    hashSeed: hashSeed,
    makeRng: makeRng,
    isPrivileged: isPrivileged,
    buildVocabulary: buildVocabulary,
    ERROR_TYPES: ERROR_TYPES,
    PHASE1_TYPES: PHASE1_TYPES,
    seedErrors: seedErrors,
    codingMatches: codingMatches,
    classifyDecision: classifyDecision,
    scoreBatch: scoreBatch,
    ACCURACY_ANCHORS: ACCURACY_ANCHORS,
    accuracyPillar: accuracyPillar,
    rollingAccuracy: rollingAccuracy,
    paceStats: paceStats,
    pacePillar: pacePillar,
    makeFamilies: makeFamilies,
    PHASE2_TYPES: PHASE2_TYPES,
    familyAgreement: familyAgreement,
    applyProtocolChange: applyProtocolChange
  };
});
