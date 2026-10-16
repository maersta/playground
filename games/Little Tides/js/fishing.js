// Fishing: encounter tables, catch generation and the fishing state machine.
import { CONFIG, RARITY, RARITY_IDS } from './config.js';
import { SPECIES, JUNK, TREASURES } from './fish-data.js';
import { ZONE_INDEX } from './zone-data.js';
import { getEffects } from './upgrades.js';
import { fishValue } from './economy.js';
import * as inventory from './inventory.js';

export const FS = { READY: 'ready', CASTING: 'casting', DESCEND: 'descending', WAIT: 'waiting', BITE: 'bite', RETRIEVE: 'retrieving', PRESENT: 'presenting', FULL: 'cargoFull' };

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const rand = (a, b) => a + Math.random() * (b - a);

export const layerOf = f => { const b = CONFIG.fishing.layerBounds; return f < b[0] ? 0 : f < b[1] ? 1 : 2; };

/** Day clock helpers. clock in [0,1): 0.25 = noon, 0.75 = midnight. */
export const sunHeight = c => Math.sin(c * Math.PI * 2) + 0.3;
export const nightness = c => clamp(0.5 - 2.2 * sunHeight(c), 0, 1);
export const isNight = c => nightness(c) > 0.6;

function reqOK(sp, fx, night) {
  const r = sp.req;
  if (!r) return true;
  if (r.time === 'night' && !night) return false;
  if (r.bait && fx.bait.id !== r.bait) return false;
  if (r.minRod != null && fx.rodIdx < r.minRod) return false;
  return true;
}

/** Build the eligible encounter table [{sp, p}] with probabilities summing to 1. */
export function buildTable(state, zoneId, depthFrac, clock) {
  const fx = getEffects(state);
  const night = isNight(clock);
  const layer = layerOf(depthFrac);
  const zoneSp = SPECIES.filter(s => s.zone === zoneId && s.size <= fx.hookCap && reqOK(s, fx, night));
  const withLayers = layers => zoneSp.filter(s => s.depths.some(d => layers.includes(d)));
  const hasBase = list => list.some(s => s.rarity === 'common');
  let cands = withLayers([layer]);
  if (!hasBase(cands)) {
    // widen towards shallower, then deeper layers so that something ordinary is always possible
    const order = [layer - 1, layer + 1, layer - 2, layer + 2].filter(l => l >= 0 && l <= 2);
    const layers = [layer];
    for (const l of order) { layers.push(l); cands = withLayers(layers); if (hasBase(cands)) break; }
  }
  if (!hasBase(cands)) cands = zoneSp.length ? zoneSp : SPECIES.filter(s => s.zone === zoneId && s.size <= 3 && !s.req);
  if (!cands.length) cands = SPECIES.filter(s => s.zone === zoneId).slice(0, 4);

  const spawnSum = {};
  for (const s of cands) spawnSum[s.rarity] = (spawnSum[s.rarity] || 0) + s.spawn;
  const rareFactor = [0, 0, 1, 1, 0.7, 0.4];
  const entries = cands.map(sp => {
    const R = RARITY[sp.rarity];
    let w = R.prob * (sp.spawn / spawnSum[sp.rarity]);
    if (sp.bait.includes(fx.bait.cat)) w *= CONFIG.fishing.baitBoost;
    w *= 1 + fx.rareBonus * rareFactor[R.index];
    return { sp, p: w };
  });
  normalize(entries);
  // Caps so stacked bonuses can never make top rarities ordinary
  for (let pass = 0; pass < 2; pass++) {
    for (const rid of ['mythic', 'legendary']) {
      const cap = CONFIG.rarityCaps[rid];
      const s = entries.filter(e => e.sp.rarity === rid).reduce((a, e) => a + e.p, 0);
      const others = 1 - s;
      if (s > cap && others > 0) {
        for (const e of entries) e.p = e.sp.rarity === rid ? e.p * (cap / s) : e.p * ((1 - cap) / others);
      }
    }
  }
  normalize(entries);
  return entries;
}
function normalize(entries) {
  const t = entries.reduce((a, e) => a + e.p, 0) || 1;
  for (const e of entries) e.p /= t;
}
export function pickFromTable(entries) {
  let r = Math.random();
  for (const e of entries) { r -= e.p; if (r <= 0) return e.sp; }
  return entries[entries.length - 1].sp;
}

function pickWeighted(list) {
  const t = list.reduce((a, x) => a + x.weight, 0);
  let r = Math.random() * t;
  for (const x of list) { r -= x.weight; if (r <= 0) return x; }
  return list[list.length - 1];
}

/** Size: mostly average specimens, with the occasional exceptional one. */
export function makeFish(state, sp, zoneId) {
  const fx = getEffects(state);
  const f = CONFIG.fishing;
  const variant = Math.random() < f.variantChance;
  let frac = Math.random() < f.exceptionalChance ? 0.85 + 0.15 * Math.random() : (Math.random() + Math.random() + Math.random()) / 3;
  let w = lerp(sp.wMin, sp.wMax, frac) * (1 + fx.sizeBonus);
  w = clamp(w, sp.wMin, variant ? sp.wMax * 1.08 : sp.wMax);
  const wf = sp.wMax > sp.wMin ? clamp((w - sp.wMin) / (sp.wMax - sp.wMin), 0, 1) : 0.5;
  const lf = clamp(wf + (Math.random() - 0.5) * 0.16, 0, 1);
  let l = lerp(sp.lMin, sp.lMax, lf);
  if (variant) l *= 1.04;
  w = Math.round(w * 1000) / 1000;
  l = Math.round(l * 10) / 10;
  return { kind: 'fish', id: sp.id, w, l, variant, value: fishValue(sp, w, variant), fav: false, zone: zoneId, t: Date.now() };
}

const FRAGMENT_ZONES = { coral: 'frag_coral', twilight: 'frag_twilight', frost: 'frag_frost' };

/** Roll one complete encounter. Returns {kind, sp?, item?, fragment?}. */
export function rollEncounter(state, zoneId, depthFrac, clock) {
  const fx = getEffects(state);
  const ti = ZONE_INDEX[zoneId];
  const tChance = CONFIG.fishing.treasureChance * fx.treasureMult;
  const jChance = CONFIG.fishing.junkChance * fx.junkMult;
  const fid = FRAGMENT_ZONES[zoneId];
  // Map fragments: a small independent chance per cast until each one is found
  if (fid && !state.secrets.found[fid] && Math.random() < CONFIG.fishing.fragmentChance * (1 + (fx.treasureMult - 1) * 0.5)) return { kind: 'fragment', fragment: fid };
  const r = Math.random();
  if (r < tChance) {
    const def = pickWeighted(TREASURES);
    const value = Math.round(def.value * CONFIG.treasureZoneMult[ti] * rand(0.85, 1.15));
    return { kind: 'treasure', item: { kind: 'treasure', id: def.id, value, fav: false, zone: zoneId, t: Date.now() } };
  }
  if (r < tChance + jChance) {
    const def = pickWeighted(JUNK);
    const value = Math.max(1, Math.round(def.value * CONFIG.junkZoneMult[ti] * rand(0.8, 1.2)));
    return { kind: 'junk', item: { kind: 'junk', id: def.id, value, fav: false, zone: zoneId, t: Date.now() } };
  }
  const table = buildTable(state, zoneId, depthFrac, clock);
  const sp = pickFromTable(table);
  return { kind: 'fish', sp, item: makeFish(state, sp, zoneId) };
}

const ease = t => t * t * (3 - 2 * t);

export class Fishing {
  constructor(game) {
    this.g = game;
    this.depth = CONFIG.fishing.defaultDepth;
    this.reset();
  }

  reset() {
    this.state = FS.READY;
    this.t = 0;
    this.hookFrac = 0;
    this.target = 0;
    this.pending = null;
    this.biteDelay = 0;
    this.retrieveDur = 0;
    this.presentDur = 0;
    this.last = null;
    this.flash = 0; // short "can't do that" feedback
  }

  get maxDepth() { return getEffects(this.g.state).maxDepth; }
  get busy() { return this.state !== FS.READY && this.state !== FS.FULL; }

  setDepth(f) {
    this.depth = clamp(Math.round(f / CONFIG.fishing.depthStep) * CONFIG.fishing.depthStep, CONFIG.fishing.minDepth, this.maxDepth);
    this.g.bus.emit('depth');
  }
  adjustDepth(dir) {
    if (this.busy) return;
    this.setDepth(this.depth + dir * CONFIG.fishing.depthStep);
  }
  clampDepth() { if (this.depth > this.maxDepth) this.setDepth(this.maxDepth); }

  canCast() {
    const s = this.g.state;
    if (this.g.state.mode !== 'fish') return { ok: false, reason: 'You are in the harbor.' };
    if (inventory.isFull(s)) return { ok: false, reason: 'Cargo is full! Return to the harbor to sell your catch.' };
    if (this.state !== FS.READY) return { ok: false, reason: '' };
    return { ok: true };
  }

  cast() {
    const c = this.canCast();
    if (!c.ok) {
      if (c.reason) { this.flash = 0.6; this.g.bus.emit('toast', { msg: c.reason, kind: 'warn' }); this.g.audio.sfx('error'); }
      return false;
    }
    this.clampDepth();
    this.target = clamp(this.depth, CONFIG.fishing.minDepth, this.maxDepth);
    this.state = FS.CASTING;
    this.t = 0;
    this.hookFrac = 0;
    this.g.audio.sfx('cast');
    this.g.bus.emit('cast');
    return true;
  }

  /** Abort any active line without awarding anything (used when leaving the zone or going to harbor). */
  cancel() {
    if (this.state === FS.PRESENT) this.finishPresentation();
    this.pending = null;
    this.reset();
    this.syncFull();
    this.g.bus.emit('fishingState');
  }

  syncFull() {
    if (this.state === FS.READY && inventory.isFull(this.g.state)) this.state = FS.FULL;
    else if (this.state === FS.FULL && !inventory.isFull(this.g.state)) this.state = FS.READY;
  }

  approach() {
    if (this.state === FS.WAIT) return clamp(this.t / Math.max(0.1, this.biteDelay - 0.8), 0, 1);
    if (this.state === FS.BITE) return 1;
    return 0;
  }

  set(state) { this.state = state; this.t = 0; this.g.bus.emit('fishingState', state); }

  update(dt) {
    const g = this.g, fx = getEffects(g.state), F = CONFIG.fishing;
    this.t += dt;
    this.flash = Math.max(0, this.flash - dt);
    switch (this.state) {
      case FS.READY: case FS.FULL: this.syncFull(); break;
      case FS.CASTING:
        if (this.t >= F.castTime * fx.castMult) {
          this.set(FS.DESCEND);
          this.hookFrac = 0;
          g.audio.sfx('splash', 0.5);
          g.audio.sfx('hook');
          g.bus.emit('fx', { type: 'splash', small: true });
        }
        break;
      case FS.DESCEND:
        this.hookFrac = Math.min(this.target, this.hookFrac + F.descendSpeed * dt);
        if (this.hookFrac >= this.target) {
          this.pending = rollEncounter(g.state, g.state.zone, this.target, g.state.clock);
          const floor = fx.castMult < 1 ? F.biteFloor * 0.6 : F.biteFloor;
          this.biteDelay = Math.max(floor, rand(F.biteMin, F.biteMax) * fx.biteMult);
          this.set(FS.WAIT);
        }
        break;
      case FS.WAIT:
        if (this.t >= this.biteDelay) { this.set(FS.BITE); g.audio.sfx('bite'); }
        break;
      case FS.BITE:
        if (this.t >= F.biteNibble) {
          this.retrieveDur = rand(F.retrieveMin, F.retrieveMax) * fx.retrieveMult;
          this.set(FS.RETRIEVE);
          g.audio.sfx('retrieve', this.retrieveDur);
        }
        break;
      case FS.RETRIEVE: {
        const p = Math.min(1, this.t / this.retrieveDur);
        this.hookFrac = this.target * (1 - ease(p));
        if (p >= 1) {
          this.hookFrac = 0;
          const pending = this.pending;
          this.pending = null; // consume first: a catch can only resolve once
          this.last = g.completeCatch(pending);
          const rid = this.last && this.last.rarity ? this.last.rarity : 'common';
          let d = F.presentTime[rid] || 1.8;
          if (this.last && this.last.isNew) d += 1.2;
          if (this.last && (this.last.newW || this.last.newL || this.last.newV)) d += 0.8;
          this.presentDur = d;
          this.set(FS.PRESENT);
        }
        break;
      }
      case FS.PRESENT:
        if (this.t >= this.presentDur) this.finishPresentation();
        break;
    }
  }

  finishPresentation() {
    if (this.state !== FS.PRESENT) return;
    this.last = null;
    this.state = inventory.isFull(this.g.state) ? FS.FULL : FS.READY;
    this.t = 0;
    this.g.bus.emit('presentationEnd');
    this.g.bus.emit('fishingState', this.state);
    if (this.state === FS.FULL) this.g.bus.emit('toast', { msg: 'Cargo is full! Head back to the harbor to sell your catch.', kind: 'warn' });
  }

  statusText() {
    if (this.g.state.mode === 'harbor') return 'Docked at the harbor';
    switch (this.state) {
      case FS.READY: return 'Ready. Press SPACE to cast';
      case FS.CASTING: return 'Casting...';
      case FS.DESCEND: return 'Lowering the hook...';
      case FS.WAIT: return 'Waiting for a bite...';
      case FS.BITE: return 'Something is nibbling!';
      case FS.RETRIEVE: return 'Reeling in...';
      case FS.PRESENT: return 'Nice catch!';
      case FS.FULL: return 'Cargo full. Return to the harbor';
    }
    return '';
  }
}
export { RARITY_IDS };
