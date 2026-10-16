// Versioned localStorage saving, validation, migration, import/export.
import { CONFIG, RARITY_IDS } from './config.js';
import { SPECIES_BY_ID, LOOT_BY_ID } from './fish-data.js';
import { ZONE_BY_ID } from './zone-data.js';
import { RODS, LINES, HOOKS, BOATS, BAIT_BY_ID, BOOST_BY_ID } from './upgrades.js';
import { PET_BY_ID } from './pets.js';
import { SECRET_BY_ID } from './secrets.js';
import { DECO_BY_ID, ALL_TITLES } from './fish-book.js';

const TIERS = { rod: RODS.length, line: LINES.length, hook: HOOKS.length, boat: BOATS.length };

/** State that a prestige resets. */
export function freshProgress() {
  return {
    coins: 25,
    zone: 'pebble',
    owned: { rod: [0], line: [0], hook: [0], boat: [0], bait: ['worm'] },
    equipped: { rod: 0, line: 0, hook: 0, boat: 0, bait: 'worm' },
    cargo: [],
    nextUid: 1,
    zonesUnlocked: ['pebble'],
    quests: { active: [], board: [], seq: 1 },
    boosts: {},
  };
}

export function defaultState() {
  return {
    v: CONFIG.version,
    createdAt: Date.now(),
    ...freshProgress(),
    mode: 'fish',
    book: {},
    stats: {
      fishCaught: 0, fishSold: 0, itemsSold: 0, coinsEarned: 0, coinsSpent: 0, treasures: 0, junk: 0, requests: 0,
      rarity: Object.fromEntries(RARITY_IDS.map(r => [r, 0])), bestW: null, bestL: null, bestV: null, playSeconds: 0,
    },
    pets: { owned: ['cat'], active: 'cat' },
    milestones: {},
    secrets: { found: {}, clues: [], counters: {} },
    cosmetics: { owned: [], active: null, titles: [], title: null },
    prestige: { stars: 0, spentStars: 0, count: 0, runEarned: 0, perks: {} },
    settings: { music: 0.5, ambient: 0.6, sfx: 0.7, muteMusic: false, muteAmbient: false, muteSfx: false, muteAll: false, guide: true, lowFx: false },
    hints: { fish: false, sell: false, buy: false, harbor: false },
    introDone: false,
    clock: 0.15,
  };
}

const isObj = v => v && typeof v === 'object' && !Array.isArray(v);
const num = (v, d, min = 0, max = Infinity) => (typeof v === 'number' && Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : d);
const bool = (v, d) => (typeof v === 'boolean' ? v : d);

/** Turn arbitrary parsed data into a valid state. Missing/invalid fields fall back to defaults. */
export function sanitize(raw) {
  if (!isObj(raw)) return null;
  const s = defaultState();
  s.createdAt = num(raw.createdAt, s.createdAt);
  s.coins = Math.floor(num(raw.coins, s.coins));
  s.zone = ZONE_BY_ID[raw.zone] ? raw.zone : 'pebble';
  s.mode = raw.mode === 'harbor' ? 'harbor' : 'fish';
  s.clock = num(raw.clock, s.clock, 0, 1);
  s.introDone = bool(raw.introDone, false);

  // Equipment
  const ro = isObj(raw.owned) ? raw.owned : {};
  for (const cat of Object.keys(TIERS)) {
    const arr = Array.isArray(ro[cat]) ? ro[cat].filter(i => Number.isInteger(i) && i >= 0 && i < TIERS[cat]) : [];
    s.owned[cat] = [...new Set([0, ...arr])].sort((a, b) => a - b);
  }
  s.owned.bait = [...new Set(['worm', ...(Array.isArray(ro.bait) ? ro.bait.filter(b => BAIT_BY_ID[b]) : [])])];
  const re = isObj(raw.equipped) ? raw.equipped : {};
  for (const cat of Object.keys(TIERS)) s.equipped[cat] = s.owned[cat].includes(re[cat]) ? re[cat] : Math.max(...s.owned[cat]);
  s.equipped.bait = s.owned.bait.includes(re.bait) ? re.bait : 'worm';

  // Cargo
  const seen = new Set();
  let maxUid = 0;
  if (Array.isArray(raw.cargo)) {
    for (const it of raw.cargo) {
      if (!isObj(it) || !Number.isInteger(it.uid) || seen.has(it.uid)) continue;
      const kind = it.kind;
      if (kind === 'fish') {
        if (!SPECIES_BY_ID[it.id] || !Number.isFinite(it.w) || !Number.isFinite(it.l) || !Number.isFinite(it.value)) continue;
        s.cargo.push({ uid: it.uid, kind, id: it.id, w: it.w, l: it.l, value: Math.max(1, Math.floor(it.value)), variant: !!it.variant, fav: !!it.fav, zone: String(it.zone || ''), t: num(it.t, 0) });
      } else if (kind === 'junk' || kind === 'treasure') {
        if (!LOOT_BY_ID[it.id] || !Number.isFinite(it.value)) continue;
        s.cargo.push({ uid: it.uid, kind, id: it.id, value: Math.max(1, Math.floor(it.value)), fav: !!it.fav, zone: String(it.zone || ''), t: num(it.t, 0) });
      } else continue;
      seen.add(it.uid);
      maxUid = Math.max(maxUid, it.uid);
    }
  }
  s.nextUid = Math.max(num(raw.nextUid, 1, 1), maxUid + 1);

  s.zonesUnlocked = [...new Set(['pebble', ...(Array.isArray(raw.zonesUnlocked) ? raw.zonesUnlocked.filter(z => ZONE_BY_ID[z]) : [])])];
  if (!s.zonesUnlocked.includes(s.zone)) s.zone = 'pebble';

  // Book
  if (isObj(raw.book)) {
    for (const [id, b] of Object.entries(raw.book)) {
      if (!SPECIES_BY_ID[id] || !isObj(b)) continue;
      s.book[id] = { caught: Math.floor(num(b.caught, 1, 0)), recW: num(b.recW, 0), recL: num(b.recL, 0), recV: num(b.recV, 0), first: num(b.first, Date.now()) };
    }
  }
  // Stats
  const rs = isObj(raw.stats) ? raw.stats : {};
  for (const k of ['fishCaught', 'fishSold', 'itemsSold', 'coinsEarned', 'coinsSpent', 'treasures', 'junk', 'requests', 'playSeconds']) s.stats[k] = num(rs[k], 0);
  if (isObj(rs.rarity)) for (const r of RARITY_IDS) s.stats.rarity[r] = num(rs.rarity[r], 0);
  for (const k of ['bestW', 'bestL', 'bestV']) if (isObj(rs[k]) && SPECIES_BY_ID[rs[k].id] && Number.isFinite(rs[k].v)) s.stats[k] = { id: rs[k].id, v: rs[k].v };

  // Pets
  const rp = isObj(raw.pets) ? raw.pets : {};
  s.pets.owned = [...new Set(['cat', ...(Array.isArray(rp.owned) ? rp.owned.filter(p => PET_BY_ID[p]) : [])])];
  s.pets.active = rp.active === null ? null : (s.pets.owned.includes(rp.active) ? rp.active : 'cat');

  // Quests
  const rq = isObj(raw.quests) ? raw.quests : {};
  const okQ = q => isObj(q) && Number.isInteger(q.id) && typeof q.type === 'string' && Number.isFinite(q.goal) && isObj(q.reward) && typeof q.title === 'string';
  const fixQ = q => ({ ...q, progress: num(q.progress, 0, 0, q.goal), done: !!q.done && num(q.progress, 0) >= q.goal || num(q.progress, 0) >= q.goal });
  s.quests.active = Array.isArray(rq.active) ? rq.active.filter(okQ).slice(0, CONFIG.quests.maxActive).map(fixQ) : [];
  s.quests.board = Array.isArray(rq.board) ? rq.board.filter(okQ).slice(0, CONFIG.quests.boardSize).map(fixQ) : [];
  s.quests.seq = Math.max(num(rq.seq, 1, 1), ...[...s.quests.active, ...s.quests.board].map(q => q.id + 1), 1);

  if (isObj(raw.milestones)) for (const [k, v] of Object.entries(raw.milestones)) if (v === true && /^[a-z]+_\d+$/.test(k)) s.milestones[k] = true;

  const rsec = isObj(raw.secrets) ? raw.secrets : {};
  if (isObj(rsec.found)) for (const [k, v] of Object.entries(rsec.found)) if (SECRET_BY_ID[k]) s.secrets.found[k] = num(v, Date.now());
  s.secrets.clues = Array.isArray(rsec.clues) ? [...new Set(rsec.clues.filter(c => SECRET_BY_ID[c]))] : [];
  if (isObj(rsec.counters)) {
    const c = rsec.counters;
    for (const k of ['kelpJunk', 'caveCatches', 'bottles']) if (Number.isFinite(c[k])) s.secrets.counters[k] = c[k];
    if (Array.isArray(c.kinds)) s.secrets.counters.kinds = c.kinds.filter(k => LOOT_BY_ID[k]);
  }

  const rc = isObj(raw.cosmetics) ? raw.cosmetics : {};
  s.cosmetics.owned = Array.isArray(rc.owned) ? [...new Set(rc.owned.filter(d => DECO_BY_ID[d]))] : [];
  s.cosmetics.active = s.cosmetics.owned.includes(rc.active) ? rc.active : null;
  s.cosmetics.titles = Array.isArray(rc.titles) ? [...new Set(rc.titles.filter(t => ALL_TITLES[t]))] : [];
  s.cosmetics.title = s.cosmetics.titles.includes(rc.title) ? rc.title : null;

  if (isObj(raw.boosts)) for (const [k, v] of Object.entries(raw.boosts)) if (BOOST_BY_ID[k] && Number.isFinite(v) && v > 0) s.boosts[k] = Math.min(v, BOOST_BY_ID[k].duration);

  const rpr = isObj(raw.prestige) ? raw.prestige : {};
  const pcfg = CONFIG.prestige.perks;
  s.prestige.stars = Math.floor(num(rpr.stars, 0));
  s.prestige.spentStars = Math.floor(num(rpr.spentStars, 0, 0, s.prestige.stars));
  s.prestige.count = Math.floor(num(rpr.count, 0));
  s.prestige.runEarned = num(rpr.runEarned, 0);
  if (isObj(rpr.perks)) for (const p of pcfg) if (Number.isFinite(rpr.perks[p.id])) s.prestige.perks[p.id] = Math.min(p.max, Math.max(0, Math.floor(rpr.perks[p.id])));

  const st = isObj(raw.settings) ? raw.settings : {};
  for (const k of ['music', 'ambient', 'sfx']) s.settings[k] = num(st[k], s.settings[k], 0, 1);
  for (const k of ['muteMusic', 'muteAmbient', 'muteSfx', 'muteAll', 'guide', 'lowFx']) s.settings[k] = bool(st[k], s.settings[k]);
  const rh = isObj(raw.hints) ? raw.hints : {};
  for (const k of ['fish', 'sell', 'buy', 'harbor']) s.hints[k] = bool(rh[k], false);
  return s;
}

const MIGRATIONS = {
  // Version 0 saves (unversioned prototypes) are structurally compatible; just stamp them.
  0: raw => { raw.v = 1; return raw; },
};
export function migrate(raw) {
  if (!isObj(raw)) return null;
  let v = Number.isInteger(raw.v) ? raw.v : 0;
  while (v < CONFIG.version) {
    if (!MIGRATIONS[v]) break;
    raw = MIGRATIONS[v](raw);
    v = raw.v;
  }
  return raw;
}

// ---------- storage ----------
let memory = null; // fallback if localStorage is unavailable
const store = {
  get(k) { try { return localStorage.getItem(k); } catch (e) { return memory && memory[k] || null; } },
  set(k, v) { try { localStorage.setItem(k, v); return true; } catch (e) { (memory = memory || {})[k] = v; return false; } },
  del(k) { try { localStorage.removeItem(k); } catch (e) { if (memory) delete memory[k]; } },
};

export function saveState(state) {
  try {
    state.v = CONFIG.version;
    return store.set(CONFIG.saveKey, JSON.stringify({ game: 'little-tides', v: CONFIG.version, savedAt: Date.now(), data: state }));
  } catch (e) { return false; }
}

/** Returns { state, status: 'new' | 'loaded' | 'recovered' } */
export function loadState() {
  const txt = store.get(CONFIG.saveKey);
  if (!txt) return { state: defaultState(), status: 'new' };
  try {
    const parsed = JSON.parse(txt);
    const data = isObj(parsed) && isObj(parsed.data) ? parsed.data : parsed;
    const s = sanitize(migrate(data));
    if (s) return { state: s, status: 'loaded' };
    throw new Error('invalid');
  } catch (e) {
    store.set(CONFIG.saveKey + '-corrupt-backup', txt);
    return { state: defaultState(), status: 'recovered' };
  }
}

export function resetSave() { store.del(CONFIG.saveKey); }

export function exportString(state) {
  return JSON.stringify({ game: 'little-tides', v: CONFIG.version, exportedAt: Date.now(), data: state }, null, 1);
}
/** Validate and convert an import string. Returns state or null. */
export function importString(str) {
  try {
    const parsed = JSON.parse(str);
    const data = isObj(parsed) && isObj(parsed.data) ? parsed.data : parsed;
    if (!isObj(data) || (parsed.game && parsed.game !== 'little-tides')) return null;
    if (data.coins === undefined && data.book === undefined && data.owned === undefined) return null;
    return sanitize(migrate(data));
  } catch (e) { return null; }
}
