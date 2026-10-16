// Money: earning, spending, pricing and shop purchases. All coin changes go through here.
import { CONFIG, RARITY } from './config.js';
import { CATS, BAIT_BY_ID, BOOST_BY_ID, BOOSTS, getEffects, maxOwned } from './upgrades.js';

export function earn(state, n) {
  n = Math.max(0, Math.floor(n));
  if (!n) return 0;
  state.coins += n;
  state.stats.coinsEarned += n;
  state.prestige.runEarned += n;
  return n;
}

export function spend(state, n) {
  n = Math.floor(n);
  if (!(n >= 0) || state.coins < n) return false;
  state.coins -= n;
  state.stats.coinsSpent += n;
  return true;
}

/** Sale value of a fish before global multipliers. */
export function fishValue(sp, weight, variant) {
  const frac = sp.wMax > sp.wMin ? (weight - sp.wMin) / (sp.wMax - sp.wMin) : 0.5;
  const f = CONFIG.fishing;
  const wm = f.weightMultMin + (f.weightMultMax - f.weightMultMin) * Math.min(1, Math.max(0, frac));
  let v = sp.baseValue * wm * RARITY[sp.rarity].mult;
  if (variant) v *= f.variantMult;
  return Math.max(1, Math.round(v));
}

export function saleValue(state, item) {
  return Math.max(1, Math.round(item.value * getEffects(state).saleMult));
}

export function boostPrice(state, b) {
  return Math.round(b.price * (1 + 0.4 * (state.zonesUnlocked.length - 1)) / 5) * 5;
}

export function tierPrice(cat, idx) { return CATS[cat][idx].price; }

/** Buy next tier of rod/line/hook/boat. Tiers are bought in order. */
export function buyTier(state, cat, idx) {
  const list = CATS[cat];
  const def = list && list[idx];
  if (!def) return { ok: false, msg: 'That item does not exist.' };
  if (state.owned[cat].includes(idx)) return { ok: false, msg: 'You already own this.' };
  if (idx !== maxOwned(state, cat) + 1) return { ok: false, msg: 'Buy the previous tier first.' };
  if (!spend(state, def.price)) return { ok: false, msg: 'Not enough coins.' };
  state.owned[cat].push(idx);
  state.equipped[cat] = idx;
  return { ok: true, msg: `Bought ${def.name}!`, def };
}

export function equipTier(state, cat, idx) {
  if (!CATS[cat] || !state.owned[cat].includes(idx)) return { ok: false, msg: 'You do not own that.' };
  state.equipped[cat] = idx;
  return { ok: true, msg: `Equipped ${CATS[cat][idx].name}.` };
}

export function buyBait(state, id) {
  const def = BAIT_BY_ID[id];
  if (!def) return { ok: false, msg: 'Unknown bait.' };
  if (state.owned.bait.includes(id)) return { ok: false, msg: 'You already own this bait.' };
  if (!spend(state, def.price)) return { ok: false, msg: 'Not enough coins.' };
  state.owned.bait.push(id);
  state.equipped.bait = id;
  return { ok: true, msg: `Bought ${def.name}!`, def };
}

export function equipBait(state, id) {
  if (!state.owned.bait.includes(id)) return { ok: false, msg: 'You do not own that bait.' };
  state.equipped.bait = id;
  return { ok: true, msg: `Equipped ${BAIT_BY_ID[id].name}.` };
}

/** Boosts: buying activates immediately. Rebuying refreshes (never extends past one full duration), so no stacking. */
export function buyBoost(state, id) {
  const def = BOOST_BY_ID[id];
  if (!def) return { ok: false, msg: 'Unknown boost.' };
  if ((state.boosts[id] || 0) > def.duration * 0.5) return { ok: false, msg: 'This boost is still strong. Wait until it is half used.' };
  if (!spend(state, boostPrice(state, def))) return { ok: false, msg: 'Not enough coins.' };
  state.boosts[id] = def.duration;
  return { ok: true, msg: `${def.name} activated!`, def };
}

export { BOOSTS };
