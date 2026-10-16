// Encyclopedia: discoveries, personal records, completion and collection milestones.
import { SPECIES, SPECIES_BY_ID, ZONE_ORDER } from './fish-data.js';
import { ZONES, ZONE_BY_ID } from './zone-data.js';
import { BAIT_BY_ID } from './upgrades.js';
import { earn } from './economy.js';

export const MILESTONE_PCTS = [25, 50, 75, 100];

export const ZONE_BAIT_REWARD = { pebble: 'shiny', sunlit: 'reef', kelp: 'kelp', coral: 'moon', twilight: 'glow', frost: 'arctic', trench: 'ancient' };
export const ZONE_TITLES = {
  pebble: 'Cove Keeper', sunlit: 'Bay Beachcomber', kelp: 'Kelp Whisperer', coral: 'Reef Ranger',
  twilight: 'Deep Dreamer', frost: 'Frost Wanderer', trench: 'Trench Legend',
};
export const DECOS = ZONES.map(z => ({
  id: 'deco_' + z.id, name: `${z.name.replace(/^The /, '')} Pennant`, zone: z.id, color: z.map.color,
}));
export const DECO_BY_ID = Object.fromEntries(DECOS.map(d => [d.id, d]));
export const ALL_TITLES = { ...Object.fromEntries(ZONE_ORDER.map(z => ['title_' + z, ZONE_TITLES[z]])), title_master: 'Tide Master', title_half: 'Seasoned Angler' };

export function zoneProgress(state, zoneId) {
  const list = SPECIES.filter(s => s.zone === zoneId);
  const have = list.filter(s => state.book[s.id]).length;
  return { have, total: list.length, pct: list.length ? (have / list.length) * 100 : 0 };
}
export function totalProgress(state) {
  const have = SPECIES.filter(s => state.book[s.id]).length;
  return { have, total: SPECIES.length, pct: (have / SPECIES.length) * 100 };
}
export const discoveredCount = state => SPECIES.filter(s => state.book[s.id]).length;

/** Update records. Returns what changed so the UI can celebrate. */
export function recordCatch(state, sp, item) {
  let b = state.book[sp.id];
  const isNew = !b;
  if (!b) b = state.book[sp.id] = { caught: 0, recW: 0, recL: 0, recV: 0, first: Date.now() };
  const newW = !isNew && item.w > b.recW;
  const newL = !isNew && item.l > b.recL;
  const newV = !isNew && item.value > b.recV;
  b.caught++;
  b.recW = Math.max(b.recW, item.w);
  b.recL = Math.max(b.recL, item.l);
  b.recV = Math.max(b.recV, item.value);
  const st = state.stats;
  st.fishCaught++;
  st.rarity[sp.rarity] = (st.rarity[sp.rarity] || 0) + 1;
  if (!st.bestW || item.w > st.bestW.v) st.bestW = { id: sp.id, v: item.w };
  if (!st.bestL || item.l > st.bestL.v) st.bestL = { id: sp.id, v: item.l };
  if (!st.bestV || item.value > st.bestV.v) st.bestV = { id: sp.id, v: item.value };
  return { isNew, newW, newL, newV };
}

// ---------- Milestones ----------
export function allMilestones(state) {
  const out = [];
  for (const z of ZONES) {
    const p = zoneProgress(state, z.id);
    for (const pct of MILESTONE_PCTS) {
      const id = `${z.id}_${pct}`;
      out.push({ id, scope: z.id, pct, label: `${z.name} ${pct}%`, reward: rewardFor(z.id, pct, state), ready: p.pct >= pct, claimed: !!state.milestones[id] });
    }
  }
  const t = totalProgress(state);
  for (const pct of MILESTONE_PCTS) {
    const id = `all_${pct}`;
    out.push({ id, scope: 'all', pct, label: `Whole Fish Book ${pct}%`, reward: rewardFor('all', pct, state), ready: t.pct >= pct, claimed: !!state.milestones[id] });
  }
  return out;
}

export function rewardFor(scope, pct, state) {
  if (scope === 'all') {
    const coins = { 25: 1500, 50: 8000, 75: 30000, 100: 100000 }[pct];
    if (pct === 50) return { kind: 'coins+title', coins, title: 'title_half', text: `${coins.toLocaleString()} coins & title "Seasoned Angler"` };
    if (pct === 100) return { kind: 'coins+title', coins, title: 'title_master', text: `${coins.toLocaleString()} coins & title "Tide Master"` };
    return { kind: 'coins', coins, text: `${coins.toLocaleString()} coins` };
  }
  const z = ZONE_BY_ID[scope];
  const tier = z.tier;
  if (pct === 25) { const c = Math.round(120 * Math.pow(tier, 1.9) / 5) * 5; return { kind: 'coins', coins: c, text: `${c.toLocaleString()} coins` }; }
  if (pct === 50) {
    const id = ZONE_BAIT_REWARD[scope];
    const owned = state && state.owned.bait.includes(id);
    const c = Math.round(300 * tier);
    return owned ? { kind: 'coins', coins: c, text: `${c} coins (you already own ${BAIT_BY_ID[id].name})` }
      : { kind: 'bait', bait: id, text: `Special bait: ${BAIT_BY_ID[id].name}` };
  }
  if (pct === 75) {
    const d = DECO_BY_ID['deco_' + scope];
    return { kind: 'deco', deco: d.id, text: `Boat decoration: ${d.name}` };
  }
  const c = Math.round(400 * Math.pow(tier, 1.9) / 5) * 5;
  return { kind: 'coins+title', coins: c, title: 'title_' + scope, text: `${c.toLocaleString()} coins & title "${ZONE_TITLES[scope]}"` };
}

/** Claim exactly once. The claimed flag is written before any reward is granted. */
export function claimMilestone(state, id) {
  const m = allMilestones(state).find(x => x.id === id);
  if (!m) return { ok: false, msg: 'Unknown milestone.' };
  if (state.milestones[id]) return { ok: false, msg: 'Already claimed.' };
  if (!m.ready) return { ok: false, msg: 'Not reached yet.' };
  state.milestones[id] = true;
  const r = m.reward;
  if (r.coins) earn(state, r.coins);
  if (r.kind === 'bait' && !state.owned.bait.includes(r.bait)) state.owned.bait.push(r.bait);
  if (r.kind === 'deco' && !state.cosmetics.owned.includes(r.deco)) {
    state.cosmetics.owned.push(r.deco);
    if (!state.cosmetics.active) state.cosmetics.active = r.deco;
  }
  if (r.title && !state.cosmetics.titles.includes(r.title)) {
    state.cosmetics.titles.push(r.title);
    if (!state.cosmetics.title) state.cosmetics.title = r.title;
  }
  return { ok: true, msg: `Reward claimed: ${r.text}`, reward: r };
}

export const claimableCount = state => allMilestones(state).filter(m => m.ready && !m.claimed).length;

export function describeReq(sp) {
  if (!sp.req) return null;
  const r = sp.req;
  if (r.time) return `appears only at ${r.time}`;
  if (r.bait) return `is drawn to ${BAIT_BY_ID[r.bait].name}`;
  if (r.minRod != null) return 'only takes the strongest rods';
  return null;
}
export { SPECIES_BY_ID };
