// Harbor requests: generation, progress tracking from real gameplay events, claiming.
import { CONFIG, RARITY, RARITY_IDS } from './config.js';
import { SPECIES, SPECIES_BY_ID } from './fish-data.js';
import { ZONE_BY_ID } from './zone-data.js';
import { BAITS } from './upgrades.js';
import { SECRETS } from './secrets.js';
import { earn } from './economy.js';

const pick = arr => arr[Math.floor(Math.random() * arr.length)];
const r5 = n => Math.max(5, Math.round(n / 5) * 5);

function sig(q) { return `${q.type}:${q.species || ''}:${q.zone || ''}:${q.rarity || ''}`; }

function makeOffer(state, avoid) {
  const zones = state.zonesUnlocked;
  const z = pick(zones);
  const zone = ZONE_BY_ID[z];
  const tier = zone.tier;
  const types = ['species', 'species', 'weight', 'zonecatch', 'treasure', 'discover', 'rarity'];
  const qs = SPECIES.filter(s => s.zone === z && ['common', 'uncommon', 'rare'].includes(s.rarity) && !s.req);
  for (let tries = 0; tries < 12; tries++) {
    const type = pick(types);
    let q = null;
    if (type === 'species') {
      const sp = pick(qs);
      const goal = sp.rarity === 'rare' ? 2 : 2 + Math.floor(Math.random() * 3);
      q = { type, species: sp.id, zone: z, goal, title: `Catch ${goal} ${sp.name}`, desc: `The market wants ${goal} ${sp.name} from ${zone.name}.`,
        coins: r5(sp.baseValue * goal * RARITY[sp.rarity].mult * 2.4) };
    } else if (type === 'weight') {
      const sp = pick(qs.filter(s => s.rarity !== 'rare'));
      if (!sp) continue;
      const target = +(sp.wMin + (sp.wMax - sp.wMin) * 0.7).toFixed(2);
      q = { type, species: sp.id, zone: z, goal: 1, target, title: `A big ${sp.name}`, desc: `Find a ${sp.name} weighing at least ${target} kg.`,
        coins: r5(sp.baseValue * RARITY[sp.rarity].mult * 5) };
    } else if (type === 'zonecatch') {
      const goal = 4 + tier;
      q = { type, zone: z, goal, title: `${zone.name} Haul`, desc: `Catch ${goal} fish in ${zone.name}.`, coins: r5(CONFIG.zoneBase[tier - 1] * goal * 1.8) };
    } else if (type === 'treasure') {
      const goal = tier >= 4 ? 2 : 1;
      q = { type, goal, title: goal > 1 ? `Find ${goal} treasures` : 'Find a treasure', desc: `Fish up ${goal > 1 ? goal + ' treasures' : 'a treasure'} from the sea floor.`,
        coins: r5(CONFIG.treasureZoneMult[tier - 1] * 90 * goal) };
    } else if (type === 'discover') {
      const missing = SPECIES.filter(s => zones.includes(s.zone) && !state.book[s.id] && !s.req).length;
      if (missing < 1) continue;
      const goal = Math.min(missing, Math.random() < 0.4 ? 2 : 1);
      q = { type, goal, title: goal > 1 ? `Discover ${goal} new species` : 'Discover a new species', desc: `Catch ${goal > 1 ? goal + ' fish' : 'a fish'} you have never caught before.`,
        coins: r5(CONFIG.zoneBase[tier - 1] * 7 * goal) };
    } else {
      const ri = tier >= 4 ? 2 + Math.floor(Math.random() * 2) : 1 + Math.floor(Math.random() * 2);
      const rar = RARITY_IDS[ri];
      const goal = ri >= 3 ? 1 : 2;
      q = { type, rarity: rar, goal, title: `Catch ${goal} ${RARITY[rar].name}+ fish`,
        desc: `Catch ${goal} fish of ${RARITY[rar].name} rarity or better.`, coins: r5(CONFIG.zoneBase[tier - 1] * RARITY[rar].mult * goal * 2.2) };
    }
    if (!q) continue;
    if (avoid.has(sig(q))) continue;
    q.reward = { coins: q.coins };
    const x = Math.random();
    if (x < 0.18) {
      const cand = BAITS.filter(b => !state.owned.bait.includes(b.id) && b.price <= 700 * tier);
      if (cand.length) { const b = pick(cand); q.reward.bait = b.id; q.reward.baitName = b.name; }
    } else if (x < 0.3) {
      const cand = SECRETS.filter(s => !state.secrets.found[s.id] && !state.secrets.clues.includes(s.id));
      if (cand.length) q.reward.clue = pick(cand).id;
    }
    delete q.coins;
    q.progress = 0;
    q.done = false;
    q.id = state.quests.seq++;
    q.rarityIdx = q.rarity ? RARITY[q.rarity].index : undefined;
    return q;
  }
  return null;
}

export function refillBoard(state) {
  const avoid = new Set([...state.quests.active, ...state.quests.board].map(sig));
  let guard = 0;
  while (state.quests.board.length < CONFIG.quests.boardSize && guard++ < 20) {
    const q = makeOffer(state, avoid);
    if (!q) continue;
    avoid.add(sig(q));
    state.quests.board.push(q);
  }
}

export function accept(state, id) {
  if (state.quests.active.length >= CONFIG.quests.maxActive) return { ok: false, msg: 'You can only have 3 active requests.' };
  const i = state.quests.board.findIndex(q => q.id === id);
  if (i < 0) return { ok: false, msg: 'That request is gone.' };
  const [q] = state.quests.board.splice(i, 1);
  state.quests.active.push(q);
  refillBoard(state);
  return { ok: true, msg: `Accepted: ${q.title}` };
}

export function abandon(state, id) {
  const i = state.quests.active.findIndex(q => q.id === id);
  if (i < 0) return { ok: false, msg: 'No such request.' };
  state.quests.active.splice(i, 1);
  refillBoard(state);
  return { ok: true, msg: 'Request dropped.' };
}

export function reroll(state, spend) {
  if (!spend(state, CONFIG.quests.rerollCost)) return { ok: false, msg: 'Not enough coins.' };
  state.quests.board = [];
  refillBoard(state);
  return { ok: true, msg: 'The board has new requests.' };
}

export function claim(state, id) {
  const i = state.quests.active.findIndex(q => q.id === id);
  if (i < 0) return { ok: false, msg: 'No such request.' };
  const q = state.quests.active[i];
  if (!q.done) return { ok: false, msg: 'Not finished yet.' };
  state.quests.active.splice(i, 1); // removed first: cannot be claimed twice
  state.stats.requests++;
  const extra = [];
  earn(state, q.reward.coins || 0);
  if (q.reward.bait && !state.owned.bait.includes(q.reward.bait)) { state.owned.bait.push(q.reward.bait); extra.push(q.reward.baitName); }
  if (q.reward.clue && !state.secrets.clues.includes(q.reward.clue)) {
    state.secrets.clues.push(q.reward.clue);
    extra.push('a clue');
  }
  refillBoard(state);
  return { ok: true, msg: `Request complete! +${(q.reward.coins || 0).toLocaleString()} coins${extra.length ? ' and ' + extra.join(', ') : ''}.`, quest: q };
}

/** Called once per gameplay event. Returns the quests that just became complete. */
export function onEvent(state, ev) {
  const done = [];
  if (ev.type !== 'catch') return done;
  for (const q of state.quests.active) {
    if (q.done) continue;
    let inc = 0;
    switch (q.type) {
      case 'species': if (ev.kind === 'fish' && ev.sp.id === q.species) inc = 1; break;
      case 'weight': if (ev.kind === 'fish' && ev.sp.id === q.species && ev.item.w >= q.target) inc = 1; break;
      case 'zonecatch': if (ev.kind === 'fish' && ev.zone === q.zone) inc = 1; break;
      case 'treasure': if (ev.kind === 'treasure') inc = 1; break;
      case 'discover': if (ev.kind === 'fish' && ev.isNew) inc = 1; break;
      case 'rarity': if (ev.kind === 'fish' && RARITY[ev.sp.rarity].index >= q.rarityIdx) inc = 1; break;
    }
    if (inc) {
      q.progress = Math.min(q.goal, q.progress + inc);
      if (q.progress >= q.goal) { q.done = true; done.push(q); }
    }
  }
  return done;
}

export { SPECIES_BY_ID };
