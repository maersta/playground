// Cargo hold: capacity, adding, favouriting and selling.
import { getEffects } from './upgrades.js';
import { earn, saleValue } from './economy.js';

export const capacity = state => getEffects(state).cargoCap;
export const count = state => state.cargo.length;
export const isFull = state => state.cargo.length >= capacity(state);

export function add(state, item) {
  if (isFull(state)) return false;
  item.uid = state.nextUid++;
  state.cargo.push(item);
  return true;
}

export const find = (state, uid) => state.cargo.find(i => i.uid === uid) || null;

export function toggleFav(state, uid) {
  const it = find(state, uid);
  if (!it) return false;
  it.fav = !it.fav;
  return it.fav;
}

/** Sell the given items. Favourites are protected and skipped. Items are removed before paying out (no double sales). */
export function sell(state, uids) {
  const set = new Set(uids);
  const sold = [], kept = [];
  for (const it of state.cargo) {
    if (!set.has(it.uid)) { kept.push(it); continue; }
    if (it.fav) { kept.push(it); continue; }
    sold.push(it);
  }
  if (!sold.length) return { coins: 0, count: 0, skippedFav: uids.length > 0 && state.cargo.some(i => set.has(i.uid) && i.fav) };
  state.cargo = kept;
  let total = 0, fish = 0;
  for (const it of sold) {
    total += saleValue(state, it);
    if (it.kind === 'fish') fish++;
  }
  earn(state, total);
  state.stats.fishSold += fish;
  state.stats.itemsSold += sold.length;
  return { coins: total, count: sold.length, fish, skippedFav: state.cargo.some(i => set.has(i.uid) && i.fav) };
}

export function sellKind(state, kinds) {
  const ids = state.cargo.filter(i => !i.fav && kinds.includes(i.kind)).map(i => i.uid);
  return sell(state, ids);
}

export function expectedValue(state, uids) {
  const set = uids ? new Set(uids) : null;
  let t = 0;
  for (const it of state.cargo) if ((!set || set.has(it.uid)) && !it.fav) t += saleValue(state, it);
  return t;
}
