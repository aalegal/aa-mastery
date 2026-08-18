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

  return {
    hashSeed: hashSeed,
    makeRng: makeRng
  };
});
