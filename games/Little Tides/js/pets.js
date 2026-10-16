// Companions: data, unlock rules and selection. Drawing lives in draw.js.
export const PETS = [
  { id: 'cat', name: 'Harbor Cat', blurb: 'A ginger tabby who naps on the dock and judges your catches.',
    unlock: { type: 'start' }, req: 'Starting companion', bonus: { sale: 0.04 }, bonusText: '+4% sale value' },
  { id: 'gull', name: 'Pip the Seagull', blurb: 'A cheeky gull with a sharp eye for shiny fish.',
    unlock: { type: 'catches', n: 25 }, req: 'Catch 25 fish in total', bonus: { bite: 0.05 }, bonusText: '5% faster bites' },
  { id: 'crab', name: 'Blue Crab', blurb: 'A tiny blue crab who clacks happily whenever a fish is caught.',
    unlock: { type: 'species', id: 'shore_crab' }, req: 'Discover the Shore Crab', bonus: { cargo: 1 }, bonusText: '+1 cargo slot' },
  { id: 'otter', name: 'Sea Otter', blurb: 'Floats beside the boat cracking shells and finding odd shiny things.',
    unlock: { type: 'buy', price: 1500 }, req: 'Adopt at the harbor for 1,500 coins', bonus: { treasure: 0.15 }, bonusText: '+15% treasure chance' },
  { id: 'jelly', name: 'Moon Jelly', blurb: 'A glowing little jelly that drifts beside the boat. It only wakes under the moon.',
    unlock: { type: 'secret', id: 'moonlit_catch' }, req: 'Secret: a moonlit surprise...', bonus: { rare: 0.06 }, bonusText: '+6% rare catch focus' },
  { id: 'dragon', name: 'Mini Dragon', blurb: 'A pocket-sized dragon who hatched from a deep-sea legend. Very proud of itself.',
    unlock: { type: 'species', id: 'deep_dragonfish' }, req: 'Discover the Deep Dragonfish', bonus: { sale: 0.03, rare: 0.03 }, bonusText: '+3% sale value, +3% rare focus' },
];
export const PET_BY_ID = Object.fromEntries(PETS.map(p => [p.id, p]));

export function petOwned(state, id) { return state.pets.owned.includes(id); }

function ownPet(state, id) {
  if (!PET_BY_ID[id] || petOwned(state, id)) return false;
  state.pets.owned.push(id);
  return true;
}

// Returns list of newly unlocked pet ids (non-purchase unlocks).
export function checkPetUnlocks(state) {
  const out = [];
  for (const p of PETS) {
    if (petOwned(state, p.id)) continue;
    const u = p.unlock;
    let ok = false;
    if (u.type === 'start') ok = true;
    else if (u.type === 'catches') ok = state.stats.fishCaught >= u.n;
    else if (u.type === 'species') ok = !!state.book[u.id];
    else if (u.type === 'secret') ok = !!state.secrets.found[u.id];
    if (ok && ownPet(state, p.id)) out.push(p.id);
  }
  return out;
}

export function activePetDef(state) { return state.pets.active ? PET_BY_ID[state.pets.active] : null; }

export function selectPet(state, id) {
  if (id !== null && !petOwned(state, id)) return false;
  state.pets.active = id;
  return true;
}

// The only place a purchased pet is added; prevents double buys.
export function buyPet(state, id, spend) {
  const p = PET_BY_ID[id];
  if (!p || p.unlock.type !== 'buy' || petOwned(state, id)) return { ok: false, msg: 'Already adopted.' };
  if (!spend(state, p.unlock.price)) return { ok: false, msg: 'Not enough coins.' };
  ownPet(state, id);
  return { ok: true, msg: `${p.name} joined your crew!` };
}
