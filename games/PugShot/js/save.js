/* =========================================================
   save.js - SaveSystem (localStorage) + UpgradeSystem
   ========================================================= */
'use strict';

const SAVE_KEY = 'mops_pugshot_save_v1';

const SaveSystem = {
  data: null,

  defaults() {
    return {
      coins: 0,
      best: 0,              // best distance (m)
      bestScore: 0,
      totalDistance: 0,
      totalCoins: 0,        // lifetime coins earned
      runs: 0,
      bounces: 0,
      broken: 0,
      maxSpeed: 0,
      maxCombo: 0,
      muted: false,
      upgrades: { power: 0, bounce: 0, speed: 0, air: 0, durability: 0, magnet: 0, luck: 0 },
      // ---- meta progression ----
      world: 0,                                 // selected world
      sling: 'wood', skin: 'fawn', hat: 'none', // equipped items
      owned: { sling: ['wood'], skin: ['fawn'], hat: ['none'] },
      boosts: { heart: 0, power: 0, coins: 0 },
      stars: 0, totalStars: 0, ascensions: 0, ascScore: 0,
      perks: { coin: 0, power: 0, heart: 0, fund: 0, luck: 0 },
      worldBest: [0, 0, 0, 0, 0],
      missions: [],
      achieved: {},
      daily: { last: '', streak: 0 }
    };
  },

  load() {
    const d = this.defaults();
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        Object.assign(d, parsed);
        const base = this.defaults();
        for (const k of ['upgrades', 'boosts', 'perks', 'daily']) d[k] = Object.assign(base[k], parsed[k] || {});
        d.owned = Object.assign(base.owned, parsed.owned || {});
        d.worldBest = base.worldBest.map((v, i) => (parsed.worldBest && parsed.worldBest[i]) || 0);
        if (!Array.isArray(d.missions)) d.missions = [];
        if (!d.worldBest[0] && d.best > 0) d.worldBest[0] = d.best;   // migrate old saves
      }
    } catch (e) { /* storage blocked or corrupt - use defaults */ }
    this.data = d;
    return d;
  },

  save() {
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(this.data)); } catch (e) { /* ignore */ }
  },

  reset() {
    const muted = this.data ? this.data.muted : false;
    this.data = this.defaults();
    this.data.muted = muted;
    this.save();
  }
};

/* ---------------------------------------------------------
   UpgradeSystem - definitions, values and costs.
   value(l) returns the gameplay value used by physics,
   fmt(l) returns the human readable stat for the cards.
   --------------------------------------------------------- */
const UPGRADE_DEFS = [
  {
    id: 'power', name: 'LAUNCH POWER', icon: 'power', base: 20, growth: 1.52,
    desc: 'Max slingshot power',
    value: l => 640 + l * 72,                       // max launch speed (px/s)
    fmt: l => `${Math.round((640 + l * 72) / 6.4)}% power`
  },
  {
    id: 'bounce', name: 'BOUNCE', icon: 'bounce', base: 25, growth: 1.52,
    desc: 'Keep more energy on impact',
    value: l => 0.42 + l * 0.04,                    // restitution
    fmt: l => `${Math.round((0.42 + l * 0.04) * 100)}% bounce retention`
  },
  {
    id: 'speed', name: 'SPEED', icon: 'speed', base: 30, growth: 1.52,
    desc: 'Less friction & drag',
    value: l => l,
    fmt: l => `+${l * 9}% momentum`
  },
  {
    id: 'air', name: 'AIR CONTROL', icon: 'air', base: 35, growth: 1.55,
    desc: 'Steer while airborne',
    value: l => l * 26,                             // air acceleration (px/s^2)
    fmt: l => (l === 0 ? 'no steering' : `${l * 10}% steering`)
  },
  {
    id: 'durability', name: 'DURABILITY', icon: 'durability', base: 35, growth: 1.58,
    desc: 'Survive more hazards',
    value: l => 3 + l,                              // health in half-hearts
    fmt: l => `${(3 + l) / 2} hearts`
  },
  {
    id: 'magnet', name: 'COIN MAGNET', icon: 'magnet', base: 20, growth: 1.5,
    desc: 'Bigger coin pickup range',
    value: l => 12 + l * 9,                         // pickup radius px
    fmt: l => `${((12 + l * 9) / PX_PER_M).toFixed(1)}m range`
  },
  {
    id: 'luck', name: 'LUCKY PUG', icon: 'luck', base: 30, growth: 1.55,
    desc: 'Golden coins & bonus rewards',
    value: l => l * 0.045,                          // luck probability
    fmt: l => `${Math.round(l * 4.5)}% luck`
  }
];

const MAX_UPGRADE_LEVEL = 10;

const UpgradeSystem = {
  defs: UPGRADE_DEFS,

  def(id) { return UPGRADE_DEFS.find(d => d.id === id); },
  level(id) { return SaveSystem.data.upgrades[id] || 0; },
  value(id) { return this.def(id).value(this.level(id)); },

  cost(id) {
    const d = this.def(id), l = this.level(id);
    if (l >= MAX_UPGRADE_LEVEL) return Infinity;
    return Math.round(d.base * Math.pow(d.growth, l) / 5) * 5;
  },

  canBuy(id) {
    return this.level(id) < MAX_UPGRADE_LEVEL && SaveSystem.data.coins >= this.cost(id);
  },

  buy(id) {
    if (!this.canBuy(id)) return false;
    SaveSystem.data.coins -= this.cost(id);
    SaveSystem.data.upgrades[id] = this.level(id) + 1;
    SaveSystem.save();
    return true;
  },

  /** Snapshot of all gameplay stats for the current run. */
  stats() {
    const d = SaveSystem.data;
    const sl = Meta.item('sling', d.sling), w = WORLDS[d.world], pk = d.perks;
    return {
      maxPower: this.value('power') * sl.power * (1 + 0.04 * pk.power) * (d.boosts.power > 0 ? 1.2 : 1),
      bounce: this.value('bounce') + (sl.bounce || 0),
      speedLvl: this.value('speed'),
      airAccel: this.value('air') + (sl.air || 0),
      maxHp: this.value('durability') + (sl.hp || 0) + pk.heart + (d.boosts.heart > 0 ? 2 : 0),
      magnet: this.value('magnet') + (sl.magnet || 0),
      luck: this.value('luck') + (sl.luck || 0) + pk.luck * 0.015,
      coinMult: (1 + 0.1 * pk.coin) * (sl.coin || 1) * w.coin * (d.boosts.coins > 0 ? 2 : 1),
      gravity: GRAVITY * w.gravity,
      aimLen: sl.aim || 70
    };
  }
};
