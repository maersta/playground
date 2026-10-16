/* Little Ocean - versioned, validated localStorage persistence.
   Only permanent progression lives here; run state is never saved. */
window.LO = window.LO || {};
LO.Save = (function () {
  const KEY = 'littleocean.save';
  const BACKUP = 'littleocean.save.backup';
  const VERSION = 1;
  let data = null;
  let message = null;   // user-facing recovery message, shown once

  function defaults() {
    return {
      version: VERSION,
      species: {},       // id -> {eaten:n}
      zones: { reef: 1 },
      passages: {},
      places: {},
      evo: { s1: 1, r1: 1, b1: 1 },
      cosmetics: { default: 1 },
      stats: { runs: 0, deaths: 0, bestSize: 10, totalEaten: 0 },
      settings: { music: 0.5, sfx: 0.7, muted: false, fx: true, shake: true, cosmetic: 'default' },
      flags: { tutorial: false }
    };
  }

  const isObj = (o) => o && typeof o === 'object' && !Array.isArray(o);
  const num = (v, d, lo, hi) => (typeof v === 'number' && isFinite(v) ? Math.min(hi, Math.max(lo, v)) : d);

  function boolMap(src, out, valid) {
    if (!isObj(src)) return;
    for (const k in src) {
      if (src[k] && k.length < 48 && (!valid || valid(k))) out[k] = 1;
    }
  }

  // Merge arbitrary (possibly partial or malformed) data onto defaults. Never throws.
  function sanitize(raw) {
    const d = defaults();
    if (!isObj(raw)) return d;
    if (isObj(raw.species)) {
      for (const id in raw.species) {
        if (LO.SPECIES_BY_ID[id]) {
          const e = raw.species[id];
          d.species[id] = { eaten: isObj(e) ? Math.floor(num(e.eaten, 0, 0, 1e9)) : 0 };
        }
      }
    }
    boolMap(raw.zones, d.zones, (k) => !!LO.CFG.zones[k]);
    boolMap(raw.passages, d.passages, (k) => LO.CFG.gates.some((g) => g.id === k));
    boolMap(raw.places, d.places);
    boolMap(raw.evo, d.evo, (k) => /^[a-z]\d{1,2}$/.test(k));
    boolMap(raw.cosmetics, d.cosmetics, (k) => !!LO.CFG.cosmetics[k]);
    d.zones.reef = 1; d.cosmetics.default = 1; d.evo.s1 = d.evo.r1 = d.evo.b1 = 1;
    if (isObj(raw.stats)) {
      const s = raw.stats;
      d.stats.runs = Math.floor(num(s.runs, 0, 0, 1e9));
      d.stats.deaths = Math.floor(num(s.deaths, 0, 0, 1e9));
      d.stats.bestSize = num(s.bestSize, 10, 0, 1000);
      d.stats.totalEaten = Math.floor(num(s.totalEaten, 0, 0, 1e9));
    }
    if (isObj(raw.settings)) {
      const s = raw.settings, o = d.settings;
      o.music = num(s.music, o.music, 0, 1);
      o.sfx = num(s.sfx, o.sfx, 0, 1);
      if (typeof s.muted === 'boolean') o.muted = s.muted;
      if (typeof s.fx === 'boolean') o.fx = s.fx;
      if (typeof s.shake === 'boolean') o.shake = s.shake;
      if (typeof s.cosmetic === 'string' && d.cosmetics[s.cosmetic]) o.cosmetic = s.cosmetic;
    }
    if (isObj(raw.flags) && raw.flags.tutorial === true) d.flags.tutorial = true;
    return d;
  }

  // future schema migrations hook in here
  function migrate(raw) {
    if (isObj(raw) && (raw.version === undefined || raw.version < VERSION)) raw.version = VERSION;
    return raw;
  }

  function tryParse(key) {
    try {
      const txt = localStorage.getItem(key);
      if (txt === null) return { missing: true };
      return { value: JSON.parse(txt), txt: txt };
    } catch (e) { return { error: e }; }
  }

  function load() {
    let res = tryParse(KEY);
    if (res.missing) { data = defaults(); return data; }
    if (res.error || !isObj(res.value)) {
      // keep the damaged text for manual rescue, then try the backup copy
      try { const bad = localStorage.getItem(KEY); if (bad) localStorage.setItem('littleocean.corrupt.' + Date.now(), bad); } catch (e) { /* ignore */ }
      const bk = tryParse(BACKUP);
      if (bk.value && isObj(bk.value)) {
        data = sanitize(migrate(bk.value));
        message = 'Your save data was damaged, so it was restored from the latest backup.';
        save();
      } else {
        data = defaults();
        message = 'Your save data could not be read, so a fresh save was started. The damaged data was kept in browser storage.';
      }
      return data;
    }
    data = sanitize(migrate(res.value));
    return data;
  }

  function save() {
    if (!data) return false;
    try {
      const txt = JSON.stringify(data);
      localStorage.setItem(KEY, txt);
      localStorage.setItem(BACKUP, txt);
      return true;
    } catch (e) { return false; }
  }

  function reset() {
    data = defaults();
    try { localStorage.removeItem(KEY); localStorage.removeItem(BACKUP); } catch (e) { /* ignore */ }
    save();
    return data;
  }

  return {
    load, save, reset,
    get data() { return data; },
    takeMessage() { const m = message; message = null; return m; }
  };
})();
