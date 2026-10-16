/* ============================================================
   Small shared helpers: number formatting, seeded RNG, math
   ============================================================ */
(function () {
  'use strict';
  const TB = (window.TB = window.TB || {});

  const SUFFIX = ['K', 'M', 'B', 'T', 'Qa', 'Qi', 'Sx', 'Sp', 'Oc', 'No', 'Dc'];

  // Abbreviate large numbers: 12.5K, 3.2M, 1.4B ...
  function fmt(n) {
    if (!isFinite(n)) return n > 0 ? '∞' : '-∞';
    const sign = n < 0 ? '-' : '';
    let a = Math.abs(n);
    if (a < 1000) return sign + Math.floor(a);
    let i = -1;
    while (a >= 1000 && i < SUFFIX.length - 1) { a /= 1000; i++; }
    let s = a >= 100 ? a.toFixed(0) : a >= 10 ? a.toFixed(1) : a.toFixed(2);
    if (parseFloat(s) >= 1000 && i < SUFFIX.length - 1) { a /= 1000; i++; s = a.toFixed(2); }
    return sign + parseFloat(s) + SUFFIX[i];
  }

  function fmtFull(n) {
    if (!isFinite(n)) return String(n);
    return Math.floor(n).toLocaleString('en-US');
  }

  function fmtDec(n, d) {
    return parseFloat(Number(n).toFixed(d == null ? 1 : d)).toString();
  }

  function fmtTime(sec) {
    sec = Math.max(0, Math.floor(sec));
    const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
    const pad = (x) => (x < 10 ? '0' + x : '' + x);
    return h > 0 ? h + ':' + pad(m) + ':' + pad(s) : m + ':' + pad(s);
  }

  function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }

  // Deterministic PRNG (mulberry32)
  function mulberry32(seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // Safe numeric coercion for validating saved data
  function num(v, def, lo, hi) {
    v = typeof v === 'number' && isFinite(v) ? v : def;
    if (lo != null && v < lo) v = lo;
    if (hi != null && v > hi) v = hi;
    return v;
  }

  TB.util = { fmt, fmtFull, fmtDec, fmtTime, clamp, mulberry32, num };
})();
