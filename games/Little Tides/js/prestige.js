// Optional prestige ("Lighthouse"): resets coins and gear, keeps discoveries, records, pets and cosmetics.
import { CONFIG } from './config.js';
import { discoveredCount } from './fish-book.js';
import { freshProgress } from './save.js';

export function requirements(state) {
  const c = CONFIG.prestige;
  return [
    { text: `Discover ${c.minDiscovered} species`, ok: discoveredCount(state) >= c.minDiscovered, now: discoveredCount(state), need: c.minDiscovered },
    { text: 'Unlock Twilight Deep', ok: state.zonesUnlocked.includes(c.needZone) },
  ];
}
export const canPrestige = state => requirements(state).every(r => r.ok);
export const starsGain = state => Math.max(1, Math.floor(Math.sqrt(state.prestige.runEarned / CONFIG.prestige.runEarnedDivisor)));

export function perkCost(state, perk) {
  return (state.prestige.perks[perk.id] || 0) + 1;
}
export function buyPerk(state, id) {
  const perk = CONFIG.prestige.perks.find(p => p.id === id);
  if (!perk) return { ok: false, msg: 'Unknown perk.' };
  const lvl = state.prestige.perks[id] || 0;
  if (lvl >= perk.max) return { ok: false, msg: 'Already at max level.' };
  const cost = perkCost(state, perk);
  if (state.prestige.stars - state.prestige.spentStars < cost) return { ok: false, msg: 'Not enough Tide Stars.' };
  state.prestige.spentStars += cost;
  state.prestige.perks[id] = lvl + 1;
  return { ok: true, msg: `${perk.name} is now level ${lvl + 1}.` };
}
export const starsAvailable = state => state.prestige.stars - state.prestige.spentStars;

/** Perform the reset. Caller must have confirmed with the player. */
export function doPrestige(state) {
  if (!canPrestige(state)) return { ok: false, msg: 'Requirements not met.' };
  const gain = starsGain(state);
  state.prestige.stars += gain;
  state.prestige.count++;
  state.prestige.runEarned = 0;
  Object.assign(state, freshProgress());
  return { ok: true, gain };
}
