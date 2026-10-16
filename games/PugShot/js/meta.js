/* =========================================================
   meta.js - meta progression: shop, boosts, ascension (prestige),
   perks, missions, achievements and the daily gift.
   ========================================================= */
'use strict';

const ACHIEVEMENTS = [
  { id: 'a_first', name: 'FIRST FLIGHT', desc: 'Finish a run', target: 1, val: d => d.runs, reward: { coins: 25 } },
  { id: 'a_100', name: 'PUPPY PACE', desc: 'Reach 100m', target: 100, val: d => d.best, reward: { coins: 50 } },
  { id: 'a_500', name: 'ROAMER', desc: 'Reach 500m', target: 500, val: d => d.best, reward: { coins: 150 } },
  { id: 'a_1000', name: 'KILOMETER KING', desc: 'Reach 1000m', target: 1000, val: d => d.best, reward: { coins: 400 } },
  { id: 'a_3000', name: 'LONG HAULER', desc: 'Reach 3000m', target: 3000, val: d => d.best, reward: { stars: 5 } },
  { id: 'a_5000', name: 'MARATHON PUG', desc: 'Reach 5000m', target: 5000, val: d => d.best, reward: { item: ['skin', 'zombie'] } },
  { id: 'a_10000', name: 'LEGEND', desc: 'Reach 10,000m', target: 10000, val: d => d.best, reward: { item: ['hat', 'crown'], stars: 20 } },
  { id: 'a_combo10', name: 'COMBO KID', desc: 'Hit a x10 combo', target: 10, val: d => d.maxCombo, reward: { coins: 100 } },
  { id: 'a_combo30', name: 'COMBO MASTER', desc: 'Hit a x30 combo', target: 30, val: d => d.maxCombo, reward: { item: ['hat', 'shades'] } },
  { id: 'a_smash100', name: 'SMASHER', desc: 'Smash 100 objects', target: 100, val: d => d.broken, reward: { coins: 200 } },
  { id: 'a_smash1000', name: 'WRECKING PUG', desc: 'Smash 1000 objects', target: 1000, val: d => d.broken, reward: { stars: 5 } },
  { id: 'a_bounce500', name: 'BOUNCY BOY', desc: 'Bounce 500 times', target: 500, val: d => d.bounces, reward: { coins: 300 } },
  { id: 'a_runs50', name: 'DEDICATED', desc: 'Play 50 runs', target: 50, val: d => d.runs, reward: { coins: 500 } },
  { id: 'a_coins50k', name: 'TYCOON', desc: 'Earn 50,000 lifetime coins', target: 50000, val: d => d.totalCoins, reward: { item: ['skin', 'golden'] } },
  { id: 'a_asc1', name: 'REBORN', desc: 'Ascend for the first time', target: 1, val: d => d.ascensions, reward: { stars: 5 } },
  { id: 'a_asc3', name: 'TRANSCENDENT', desc: 'Ascend 3 times', target: 3, val: d => d.ascensions, reward: { item: ['hat', 'halo'] } },
  { id: 'a_w1', name: 'FROST EXPLORER', desc: 'Reach 1000m in Frozen Peaks', target: 1000, val: d => d.worldBest[1], reward: { stars: 3 } },
  { id: 'a_w2', name: 'DUNE RUNNER', desc: 'Reach 1000m in Dune Sea', target: 1000, val: d => d.worldBest[2], reward: { stars: 3 } },
  { id: 'a_w3', name: 'SWEET TOOTH', desc: 'Reach 1000m in Candy Kingdom', target: 1000, val: d => d.worldBest[3], reward: { stars: 5 } },
  { id: 'a_w4', name: 'MOON WALKER', desc: 'Reach 1000m on the Moon', target: 1000, val: d => d.worldBest[4], reward: { item: ['hat', 'helmet'] } }
];

const MISSION_TYPES = {
  dist:   { text: n => `Reach ${n}m in one run`, cumulative: false },
  combo:  { text: n => `Hit a x${n} combo`, cumulative: false },
  coins:  { text: n => `Collect ${n} coins`, cumulative: true },
  smash:  { text: n => `Smash ${n} objects`, cumulative: true },
  bounce: { text: n => `Bounce ${n} times`, cumulative: true }
};

const Meta = {
  /* ---------------- catalog access ---------------- */
  items(kind) { return kind === 'sling' ? SLINGS : kind === 'skin' ? SKINS : HATS; },
  item(kind, id) { return this.items(kind).find(i => i.id === id) || this.items(kind)[0]; },
  world(id) { return WORLDS[id === undefined ? SaveSystem.data.world : id]; },
  owns(kind, id) { return SaveSystem.data.owned[kind].includes(id); },
  bestHere() { return SaveSystem.data.worldBest[SaveSystem.data.world] || 0; },
  worldUnlocked(id) { return id <= SaveSystem.data.ascensions; },

  /* ---------------- shop ---------------- */
  canAfford(price) {
    const d = SaveSystem.data;
    return price.stars ? d.stars >= price.stars : d.coins >= price.coins;
  },
  priceText(price) { return price.stars ? '★' + price.stars : price.coins + ' coins'; },

  buy(kind, id) {
    const it = this.item(kind, id), d = SaveSystem.data;
    if (this.owns(kind, id) || !it.price || !this.canAfford(it.price)) return false;
    if (it.price.stars) d.stars -= it.price.stars; else d.coins -= it.price.coins;
    d.owned[kind].push(id);
    SaveSystem.save();
    return true;
  },
  equip(kind, id) {
    if (!this.owns(kind, id)) return false;
    SaveSystem.data[kind] = id;
    SaveSystem.save();
    if (kind !== 'sling') Sprites.applyLook();
    return true;
  },
  grant(kind, id) {
    if (!this.owns(kind, id)) SaveSystem.data.owned[kind].push(id);
  },

  buyBoost(id) {
    const b = BOOSTS.find(x => x.id === id), d = SaveSystem.data;
    if (d.boosts[id] >= b.max || d.coins < b.price) return false;
    d.coins -= b.price;
    d.boosts[id]++;
    SaveSystem.save();
    return true;
  },
  /** Called when the pug is launched: one of each owned boost is used up. */
  consumeBoosts() {
    const d = SaveSystem.data;
    for (const b of BOOSTS) if (d.boosts[b.id] > 0) d.boosts[b.id]--;
    SaveSystem.save();
  },

  /* ---------------- ascension (prestige) ---------------- */
  ascendGain() { return Math.floor(SaveSystem.data.ascScore / ASCEND_DIVISOR); },
  canAscend() { return this.ascendGain() >= ASCEND_MIN_STARS; },

  ascend() {
    if (!this.canAscend()) return 0;
    const d = SaveSystem.data, gain = this.ascendGain();
    d.stars += gain; d.totalStars += gain;
    d.ascensions++;
    d.ascScore = 0;
    d.coins = d.perks.fund * 150;
    d.upgrades = SaveSystem.defaults().upgrades;
    d.boosts = SaveSystem.defaults().boosts;
    d.world = Math.min(d.ascensions, WORLDS.length - 1);   // jump to the newest world
    d.missions = [];
    this.ensureMissions();
    this.checkAchievements([]);
    SaveSystem.save();
    return gain;
  },

  perkLevel(id) { return SaveSystem.data.perks[id] || 0; },
  perkCost(id) {
    const p = PERKS.find(x => x.id === id), l = this.perkLevel(id);
    return l >= MAX_PERK_LEVEL ? Infinity : Math.max(1, Math.round(p.base * Math.pow(p.growth, l)));
  },
  buyPerk(id) {
    const d = SaveSystem.data, c = this.perkCost(id);
    if (d.stars < c) return false;
    d.stars -= c;
    d.perks[id]++;
    SaveSystem.save();
    return true;
  },

  /* ---------------- missions ---------------- */
  makeMission(avoid) {
    const d = SaveSystem.data;
    const types = Object.keys(MISSION_TYPES).filter(t => !avoid.includes(t));
    const type = pick(types);
    const best = Math.max(100, d.best), lv = 1 + d.ascensions * 0.35;
    let target, reward;
    switch (type) {
      case 'dist': target = clamp(Math.round(best * rand(0.4, 0.8) / 50) * 50, 100, 6000); reward = target * 0.5 + 25; break;
      case 'combo': target = Math.round(clamp(6 + best / 120, 6, 40) * rand(0.8, 1.2)); reward = target * 9; break;
      case 'coins': target = Math.round((40 + best * 0.2) * rand(0.8, 1.3) / 10) * 10; reward = target * 1.2; break;
      case 'smash': target = Math.round(8 + best / 40); reward = target * 8; break;
      default: target = Math.round((12 + best / 25) * rand(0.8, 1.2)); reward = target * 2.5;
    }
    return { type, target, prog: 0, reward: Math.round(reward * lv / 5) * 5 };
  },
  ensureMissions() {
    const ms = SaveSystem.data.missions;
    while (ms.length < 3) ms.push(this.makeMission(ms.map(m => m.type)));
  },
  missionText(m) { return MISSION_TYPES[m.type].text(m.target); },

  updateMissions(run, events) {
    const d = SaveSystem.data;
    this.ensureMissions();
    const vals = { dist: Math.floor(run.distance), combo: run.maxCombo, coins: run.coins, smash: run.broken, bounce: run.bounces };
    d.missions.forEach((m, i) => {
      m.prog = MISSION_TYPES[m.type].cumulative ? m.prog + vals[m.type] : Math.max(m.prog, vals[m.type]);
      if (m.prog >= m.target) {
        d.coins += m.reward; d.totalCoins += m.reward;
        events.push({ text: 'MISSION: ' + this.missionText(m), value: '+' + m.reward });
        d.missions[i] = this.makeMission(d.missions.filter((_, j) => j !== i).map(x => x.type));
      }
    });
  },

  /* ---------------- achievements ---------------- */
  rewardText(r) {
    const parts = [];
    if (r.coins) parts.push('+' + r.coins + ' coins');
    if (r.stars) parts.push('+★' + r.stars);
    if (r.item) parts.push(this.item(r.item[0], r.item[1]).name);
    return parts.join(' & ');
  },
  checkAchievements(events) {
    const d = SaveSystem.data;
    for (const a of ACHIEVEMENTS) {
      if (d.achieved[a.id] || a.val(d) < a.target) continue;
      d.achieved[a.id] = true;
      const r = a.reward;
      if (r.coins) { d.coins += r.coins; d.totalCoins += r.coins; }
      if (r.stars) { d.stars += r.stars; d.totalStars += r.stars; }
      if (r.item) this.grant(r.item[0], r.item[1]);
      events.push({ text: 'TROPHY: ' + a.name, value: this.rewardText(r), gold: true });
    }
  },

  /** Everything that happens after a run ends (called from Game.endRun). */
  afterRun(run, events) {
    this.updateMissions(run, events);
    this.checkAchievements(events);
  },

  /* ---------------- daily gift ---------------- */
  dateKey(offsetDays = 0) {
    const t = new Date(Date.now() + offsetDays * 86400000);
    return t.getFullYear() + '-' + (t.getMonth() + 1) + '-' + t.getDate();
  },
  dailyReady() { return SaveSystem.data.daily.last !== this.dateKey(); },
  dailyPreview() {
    const dl = SaveSystem.data.daily;
    const streak = dl.last === this.dateKey(-1) ? dl.streak + 1 : 1;
    const day = ((streak - 1) % 7) + 1;
    return { streak, day, coins: 60 * day * (1 + SaveSystem.data.ascensions), stars: day === 7 ? 2 : 0 };
  },
  claimDaily() {
    if (!this.dailyReady()) return null;
    const pv = this.dailyPreview(), d = SaveSystem.data;
    d.daily.last = this.dateKey();
    d.daily.streak = pv.streak;
    d.coins += pv.coins; d.totalCoins += pv.coins;
    d.stars += pv.stars; d.totalStars += pv.stars;
    SaveSystem.save();
    return pv;
  }
};
