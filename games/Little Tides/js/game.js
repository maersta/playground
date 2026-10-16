// The central game object: owns the single state tree and coordinates all systems.
import { CONFIG, RARITY } from './config.js';
import { Bus } from './events.js';
import { loadState, saveState, resetSave, exportString, importString, defaultState } from './save.js';
import { ZONES, ZONE_BY_ID } from './zone-data.js';
import { SPECIES_BY_ID, LOOT_BY_ID } from './fish-data.js';
import { getEffects, maxOwned, BAIT_BY_ID, RODS, LINES, HOOKS, BOATS } from './upgrades.js';
import * as economy from './economy.js';
import * as inventory from './inventory.js';
import * as book from './fish-book.js';
import * as pets from './pets.js';
import * as quests from './quests.js';
import * as secrets from './secrets.js';
import * as prestige from './prestige.js';
import { Fishing, FS, isNight } from './fishing.js';
import { AudioEngine } from './audio.js';

export function zoneRequirements(state, zone) {
  const r = zone.req, out = [];
  const have = cat => maxOwned(state, cat);
  const names = { boat: 'Boat', rod: 'Rod', line: 'Line', hook: 'Hook' };
  for (const cat of ['boat', 'rod', 'line', 'hook']) {
    if (r[cat] != null) out.push({ kind: cat, text: `${names[cat]}: ${TIER_NAMES[cat][r[cat]]} or better`, ok: have(cat) >= r[cat] });
  }
  if (r.prev) {
    const z = ZONE_BY_ID[r.prev.zone];
    const n = book.zoneProgress(state, r.prev.zone).have;
    out.push({ kind: 'species', text: `Discover ${r.prev.count} species in ${z.name} (${Math.min(n, r.prev.count)}/${r.prev.count})`, ok: n >= r.prev.count });
  }
  if (r.secret) out.push({ kind: 'secret', text: 'Find the ancient Trench Chart (a special discovery)', ok: !!state.secrets.found[r.secret] });
  return out;
}
const TIER_NAMES = { rod: RODS.map(x => x.name), line: LINES.map(x => x.name), hook: HOOKS.map(x => x.name), boat: BOATS.map(x => x.name) };

export class Game {
  constructor() {
    this.bus = new Bus();
    const { state, status } = loadState();
    this.state = state;
    this.loadStatus = status;
    this.audio = new AudioEngine(this);
    this.fishing = new Fishing(this);
    this.paused = false;
    this.modalOpen = false;
    this.boatX = 0.5;
    this.boatVel = 0;
    this.boatDir = 1;
    this.axis = 0;
    this.saveTimer = 0;
    this.hudTimer = 0;
    this.lastSaveOk = true;
    this.moving = 0;
  }

  init() {
    const s = this.state;
    pets.checkPetUnlocks(s);
    quests.refillBoard(s);
    this.checkZoneUnlocks(true);
    this.fishing.clampDepth();
    this.fishing.syncFull();
    this.save();
  }

  get simPaused() { return this.paused || this.modalOpen; }
  get fx() { return getEffects(this.state); }
  get zone() { return ZONE_BY_ID[this.state.zone]; }
  get inHarbor() { return this.state.mode === 'harbor'; }

  // ---------- update ----------
  update(dt) {
    const s = this.state;
    if (this.paused) return;
    s.clock = (s.clock + dt / CONFIG.dayLength) % 1;
    s.stats.playSeconds += dt;
    // Boat movement
    const maxSpeed = 0.14 * this.fx.speed;
    // The boat is anchored from the cast until the catch has been reeled in
    const f = this.fishing.state;
    const anchored = f === FS.CASTING || f === FS.DESCEND || f === FS.WAIT || f === FS.BITE || f === FS.RETRIEVE;
    const target = this.modalOpen || this.inHarbor || anchored ? 0 : this.axis * maxSpeed;
    const k = target === 0 ? 3.2 : 4.5; // gentle deceleration, smooth acceleration
    this.boatVel += (target - this.boatVel) * Math.min(1, dt * k);
    if (Math.abs(this.boatVel) < 0.0008 && target === 0) this.boatVel = 0;
    this.boatX += this.boatVel * dt;
    if (this.boatX < 0.1) { this.boatX = 0.1; this.boatVel = Math.max(0, this.boatVel); }
    if (this.boatX > 0.9) { this.boatX = 0.9; this.boatVel = Math.min(0, this.boatVel); }
    if (this.boatVel > 0.01) this.boatDir = 1; else if (this.boatVel < -0.01) this.boatDir = -1;
    // Boost timers (only run while actually playing)
    if (!this.modalOpen) {
      for (const id of Object.keys(s.boosts)) {
        s.boosts[id] -= dt;
        if (s.boosts[id] <= 0) { delete s.boosts[id]; this.bus.emit('toast', { msg: `${id === 'rush' ? 'Fishing Rush' : 'A boost'} has run out.`, kind: 'info' }); this.bus.emit('state'); }
      }
    }
    if (!this.modalOpen && !this.inHarbor) this.fishing.update(dt);
    this.saveTimer += dt;
    if (this.saveTimer >= CONFIG.autosaveSeconds) { this.saveTimer = 0; this.save(); }
  }

  save() { this.lastSaveOk = saveState(this.state); return this.lastSaveOk; }

  // ---------- movement / modes ----------
  goHarbor() {
    if (this.inHarbor) return;
    this.fishing.cancel();
    this.state.mode = 'harbor';
    this.boatVel = 0;
    this.audio.sfx('ui');
    this.audio.setScene('harbor');
    this.bus.emit('mode');
    this.afterChange();
  }

  travel(zoneId) {
    const z = ZONE_BY_ID[zoneId];
    if (!z) return { ok: false, msg: 'Unknown zone.' };
    if (!this.state.zonesUnlocked.includes(zoneId)) return { ok: false, msg: 'That zone is still locked.' };
    this.fishing.cancel();
    this.state.zone = zoneId;
    this.state.mode = 'fish';
    this.boatX = 0.5;
    this.boatVel = 0;
    this.audio.sfx('unlock', 0.5);
    this.audio.setScene(zoneId);
    this.bus.emit('zone', zoneId);
    this.bus.emit('mode');
    this.afterChange();
    this.bus.emit('toast', { msg: `Sailing to ${z.name}`, kind: 'info' });
    if (!this.state.hints.fish) {
      this.state.hints.fish = true;
      this.bus.emit('toast', { msg: 'Tip: SPACE casts your line. W/S sets the depth. Be patient. The fish will come!', kind: 'hint', long: true });
    }
    return { ok: true };
  }

  // ---------- zone unlocks ----------
  checkZoneUnlocks(silent) {
    const s = this.state;
    for (const z of ZONES) {
      if (s.zonesUnlocked.includes(z.id)) continue;
      if (zoneRequirements(s, z).every(r => r.ok)) {
        s.zonesUnlocked.push(z.id);
        if (!silent) {
          this.bus.emit('toast', { msg: `New zone unlocked: ${z.name}!`, kind: 'unlock', long: true });
          this.audio.sfx('unlock');
        }
      }
    }
  }

  afterChange() {
    const s = this.state;
    for (const id of pets.checkPetUnlocks(s)) {
      this.bus.emit('toast', { msg: `New companion: ${pets.PET_BY_ID[id].name}!`, kind: 'unlock', long: true });
      this.audio.sfx('unlock');
    }
    this.checkZoneUnlocks(false);
    this.fishing.clampDepth();
    this.fishing.syncFull();
    this.save();
    this.bus.emit('state');
  }

  // ---------- catches ----------
  completeCatch(p) {
    const s = this.state;
    if (!p) return null;
    const zone = s.zone;
    const events = [];
    let info;
    if (p.kind === 'fragment') {
      s.stats.treasures++;
      const found = secrets.onEvent(s, { type: 'fragment', id: p.fragment });
      info = { kind: 'fragment', rarity: 'epic', name: secrets.SECRET_BY_ID[p.fragment].name, secret: found[0] };
      this.announceSecrets(found);
      this.audio.sfx('rare', 3);
      this.bus.emit('catch', info);
      this.afterChange();
      return info;
    }
    const item = p.item;
    if (!inventory.add(s, item)) {
      // Should be unreachable (casting is blocked when full) but never destroy value: pay out instead.
      economy.earn(s, economy.saleValue(s, item));
    }
    info = { kind: p.kind, item, sp: p.sp || null, rarity: p.sp ? p.sp.rarity : (p.kind === 'treasure' ? 'rare' : 'common') };
    const night = isNight(s.clock);
    if (p.kind === 'fish') {
      Object.assign(info, book.recordCatch(s, p.sp, item));
    } else if (p.kind === 'treasure') s.stats.treasures++;
    else s.stats.junk++;
    const ev = { type: 'catch', kind: p.kind, sp: p.sp, item, zone, id: item.id, isNew: !!info.isNew, night, boatX: this.boatX, variant: !!item.variant, rarityIndex: p.sp ? RARITY[p.sp.rarity].index : 0 };
    for (const q of quests.onEvent(s, ev)) this.bus.emit('toast', { msg: `Request complete: ${q.title}. Claim it at the harbor!`, kind: 'quest', long: true });
    const found = secrets.onEvent(s, ev);
    // Sound & feel
    if (p.kind === 'fish') {
      const ri = RARITY[p.sp.rarity].index;
      this.audio.sfx('catch', ri);
      if (info.isNew) setTimeout(() => this.audio.sfx('discover'), 350);
      if (info.newW || info.newL || info.newV) setTimeout(() => this.audio.sfx('record'), 600);
    } else this.audio.sfx(p.kind === 'treasure' ? 'rare' : 'catch', p.kind === 'treasure' ? 2 : 0);
    if (info.isNew && p.kind === 'fish') {
      const pct = book.totalProgress(s);
      info.bookPct = pct.pct;
    }
    this.bus.emit('catch', info);
    this.announceSecrets(found);
    if (!s.hints.sell && inventory.count(s) >= 3) {
      s.hints.sell = true;
      this.bus.emit('toast', { msg: 'Tip: when the hold fills up, press H (or the Harbor button) to sell your catch and buy upgrades.', kind: 'hint', long: true });
    }
    this.afterChange();
    return info;
  }

  announceSecrets(list) {
    for (const d of list) {
      this.bus.emit('toast', { msg: `Secret discovered: ${d.name}!${d.reward.coins ? ' +' + d.reward.coins.toLocaleString() + ' coins' : ''}`, kind: 'unlock', long: true });
      this.audio.sfx('unlock');
    }
  }

  // ---------- player actions (each validates, mutates, saves, notifies) ----------
  note(res, silentOk) {
    if (!res.ok) { this.bus.emit('toast', { msg: res.msg, kind: 'warn' }); this.audio.sfx('error'); }
    else if (!silentOk) this.bus.emit('toast', { msg: res.msg, kind: 'good' });
    return res;
  }

  sellItems(uids) {
    if (!this.inHarbor) return this.note({ ok: false, msg: 'Dock at the harbor to sell your catch.' });
    const r = inventory.sell(this.state, uids);
    return this.finishSale(r);
  }
  sellKinds(kinds) {
    if (!this.inHarbor) return this.note({ ok: false, msg: 'Dock at the harbor to sell your catch.' });
    return this.finishSale(inventory.sellKind(this.state, kinds));
  }
  finishSale(r) {
    if (!r.count) {
      this.note({ ok: false, msg: r.skippedFav ? 'Favorites are protected from sale.' : 'Nothing to sell.' });
      return r;
    }
    this.audio.sfx('coin', Math.min(5, r.count));
    this.bus.emit('toast', { msg: `Sold ${r.count} item${r.count > 1 ? 's' : ''} for ${r.coins.toLocaleString()} coins${r.skippedFav ? ' (favorites kept)' : ''}`, kind: 'coin' });
    this.bus.emit('sold', r);
    this.afterChange();
    return r;
  }
  toggleFav(uid) { inventory.toggleFav(this.state, uid); this.audio.sfx('ui'); this.afterChange(); }

  openBottle(uid) {
    const tier = ZONE_BY_ID[this.state.zone].tier;
    const r = secrets.openBottle(this.state, uid, tier);
    if (r.ok) {
      this.announceSecrets(secrets.onEvent(this.state, { type: 'bottle' }));
      this.audio.sfx('rare', 1);
    }
    this.note({ ok: r.ok, msg: r.text }, false);
    this.afterChange();
    return r;
  }

  firstBuyHint() {
    if (!this.state.hints.buy) {
      this.state.hints.buy = true;
      this.bus.emit('toast', { msg: 'Tip: new gear is equipped automatically. You can swap baits and gear any time in the Shop.', kind: 'hint', long: true });
    }
  }
  guard() { if (!this.inHarbor) { this.note({ ok: false, msg: 'Return to the harbor to shop.' }); return false; } return true; }
  buyTier(cat, idx) {
    if (!this.guard()) return { ok: false };
    const r = this.note(economy.buyTier(this.state, cat, idx));
    if (r.ok) { this.audio.sfx('purchase'); this.firstBuyHint(); this.afterChange(); }
    return r;
  }
  equipTier(cat, idx) {
    const r = this.note(economy.equipTier(this.state, cat, idx), true);
    if (r.ok) { this.audio.sfx('ui'); this.afterChange(); }
    return r;
  }
  buyBait(id) {
    if (!this.guard()) return { ok: false };
    const r = this.note(economy.buyBait(this.state, id));
    if (r.ok) { this.audio.sfx('purchase'); this.firstBuyHint(); this.afterChange(); }
    return r;
  }
  equipBait(id) {
    const r = this.note(economy.equipBait(this.state, id), true);
    if (r.ok) { this.audio.sfx('ui'); this.afterChange(); }
    return r;
  }
  buyBoost(id) {
    if (!this.guard()) return { ok: false };
    const r = this.note(economy.buyBoost(this.state, id));
    if (r.ok) { this.audio.sfx('purchase'); this.firstBuyHint(); this.afterChange(); }
    return r;
  }
  buyPet(id) {
    if (!this.guard()) return { ok: false };
    const r = this.note(pets.buyPet(this.state, id, economy.spend));
    if (r.ok) { this.audio.sfx('purchase'); this.state.pets.active = id; this.bus.emit('pet'); this.afterChange(); }
    return r;
  }
  selectPet(id) {
    if (pets.selectPet(this.state, id)) { this.audio.sfx('ui'); this.bus.emit('pet'); this.afterChange(); }
  }
  selectDeco(id) {
    if (id === null || this.state.cosmetics.owned.includes(id)) { this.state.cosmetics.active = id; this.audio.sfx('ui'); this.afterChange(); }
  }
  selectTitle(id) {
    if (id === null || this.state.cosmetics.titles.includes(id)) { this.state.cosmetics.title = id; this.audio.sfx('ui'); this.afterChange(); }
  }

  claimMilestone(id) {
    const r = this.note(book.claimMilestone(this.state, id));
    if (r.ok) { this.audio.sfx('unlock'); this.afterChange(); }
    return r;
  }
  claimAllMilestones() {
    let n = 0;
    for (const m of book.allMilestones(this.state)) if (m.ready && !m.claimed && book.claimMilestone(this.state, m.id).ok) n++;
    if (n) { this.audio.sfx('unlock'); this.bus.emit('toast', { msg: `Claimed ${n} reward${n > 1 ? 's' : ''}!`, kind: 'good' }); this.afterChange(); }
    return n;
  }

  acceptQuest(id) { const r = this.note(quests.accept(this.state, id), true); if (r.ok) { this.audio.sfx('ui'); this.afterChange(); } }
  abandonQuest(id) { const r = this.note(quests.abandon(this.state, id), true); if (r.ok) { this.audio.sfx('ui'); this.afterChange(); } }
  claimQuest(id) { const r = this.note(quests.claim(this.state, id)); if (r.ok) { this.audio.sfx('coin', 3); this.afterChange(); } }
  rerollQuests() { if (!this.guard()) return; const r = this.note(quests.reroll(this.state, economy.spend), true); if (r.ok) { this.audio.sfx('ui'); this.afterChange(); } }

  buyPerk(id) { const r = this.note(prestige.buyPerk(this.state, id)); if (r.ok) { this.audio.sfx('purchase'); this.afterChange(); } }
  doPrestige() {
    const r = prestige.doPrestige(this.state);
    if (!r.ok) return this.note(r);
    this.fishing.cancel();
    this.boatX = 0.5;
    quests.refillBoard(this.state);
    this.audio.sfx('catch', 5);
    this.audio.setScene('harbor');
    this.bus.emit('zone', 'pebble');
    this.bus.emit('mode');
    this.bus.emit('toast', { msg: `The tide turns! You earned ${r.gain} Tide Star${r.gain > 1 ? 's' : ''}.`, kind: 'unlock', long: true });
    this.state.mode = 'harbor';
    this.afterChange();
    return r;
  }

  setSetting(k, v) {
    this.state.settings[k] = v;
    this.audio.applySettings();
    this.bus.emit('state');
  }
  markIntroDone() { this.state.introDone = true; this.state.hints.fish = true; this.save(); }

  // ---------- save management ----------
  exportSave() { return exportString(this.state); }
  importSave(str) {
    const s = importString(str);
    if (!s) return { ok: false, msg: 'That does not look like a valid Little Tides save.' };
    this.replaceState(s);
    return { ok: true, msg: 'Save imported!' };
  }
  resetAll() {
    resetSave();
    const s = defaultState();
    s.introDone = true;
    this.replaceState(s);
  }
  replaceState(s) {
    this.fishing.cancel();
    this.state = s;
    pets.checkPetUnlocks(s);
    quests.refillBoard(s);
    this.checkZoneUnlocks(true);
    this.boatX = 0.5;
    this.boatVel = 0;
    this.audio.applySettings();
    this.audio.setScene(s.mode === 'harbor' ? 'harbor' : s.zone);
    this.fishing.reset();
    this.fishing.clampDepth();
    this.fishing.syncFull();
    this.save();
    this.bus.emit('zone', s.zone);
    this.bus.emit('mode');
    this.bus.emit('state');
  }
}
export { FS, SPECIES_BY_ID, LOOT_BY_ID, BAIT_BY_ID };
