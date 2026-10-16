// Discoverable secrets. A secret is only marked found when its real requirements are met in play.
import { earn } from './economy.js';
import { BAITS } from './upgrades.js';

export const SECRETS = [
  { id: 'prismatic', name: 'Prismatic Shimmer', reward: { coins: 500 },
    hint: 'Some fish wear colours no book has recorded. They are very rare.',
    clue: 'About 1 in 80 fish is a prismatic variant. Keep fishing, and keep looking.' },
  { id: 'wreck_secret', name: 'The Hidden Hold', reward: { coins: 800 },
    hint: 'Something is tangled in the wreckage of Whispering Kelp.',
    clue: 'Haul up 3 pieces of junk in Whispering Kelp to free the wreck\'s hidden hold.' },
  { id: 'frost_cave', name: 'Glacier Cave', reward: { coins: 3000 },
    hint: 'A shimmering cave mouth glitters in the cliffs of Frostfall Sea.',
    clue: 'Park your boat at the far left of Frostfall Sea, near the glittering cave, and catch 3 fish.' },
  { id: 'frag_coral', name: 'Map Fragment I', reward: {}, fragment: true,
    hint: 'Treasure hunters in the Coral Garden sometimes find torn parchment.',
    clue: 'A map fragment can turn up when you fish up treasure in Coral Garden.' },
  { id: 'frag_twilight', name: 'Map Fragment II', reward: {}, fragment: true,
    hint: 'Torn parchment drifts in the dark of Twilight Deep.',
    clue: 'A map fragment can turn up when you fish up treasure in Twilight Deep.' },
  { id: 'frag_frost', name: 'Map Fragment III', reward: {}, fragment: true,
    hint: 'Torn parchment is frozen into the Frostfall ice.',
    clue: 'A map fragment can turn up when you fish up treasure in Frostfall Sea.' },
  { id: 'trench_chart', name: 'The Trench Chart', reward: { coins: 2500 },
    hint: 'Three torn fragments from three seas make a map to a forgotten place.',
    clue: 'Collect all three Map Fragments to complete the chart and find the Forgotten Trench.' },
  { id: 'moonlit_catch', name: 'Moonlit Friend', reward: {},
    hint: 'Rare things stir when the moon is out.',
    clue: 'Catch a Rare (or better) fish at night. Something small and glowing will notice.' },
  { id: 'collector', name: 'Collector of Curiosities', reward: { coins: 1500 },
    hint: 'A true beachcomber has seen every kind of treasure.',
    clue: 'Find 4 different kinds of treasure.' },
  { id: 'bottle_reader', name: 'Message Reader', reward: { coins: 600 },
    hint: 'Sealed bottles hold secrets. Someone should read them.',
    clue: 'Open 3 sealed bottles from your cargo.' },
];
export const SECRET_BY_ID = Object.fromEntries(SECRETS.map(s => [s.id, s]));

export const isFound = (state, id) => !!state.secrets.found[id];

export function findSecret(state, id) {
  const def = SECRET_BY_ID[id];
  if (!def || state.secrets.found[id]) return null;
  state.secrets.found[id] = Date.now();
  if (def.reward.coins) earn(state, def.reward.coins);
  return def;
}

/** Process a gameplay event, return array of newly found secret defs. */
export function onEvent(state, ev) {
  const found = [];
  const push = id => { const d = findSecret(state, id); if (d) found.push(d); };
  const c = state.secrets.counters;
  if (ev.type === 'catch') {
    if (ev.variant) push('prismatic');
    if (ev.kind === 'junk' && ev.zone === 'kelp') { c.kelpJunk = (c.kelpJunk || 0) + 1; if (c.kelpJunk >= 3) push('wreck_secret'); }
    if (ev.zone === 'frost' && ev.boatX < 0.17) { c.caveCatches = (c.caveCatches || 0) + 1; if (c.caveCatches >= 3) push('frost_cave'); }
    if (ev.kind === 'fish' && ev.night && ev.rarityIndex >= 2) push('moonlit_catch');
    if (ev.kind === 'treasure') {
      if (!c.kinds) c.kinds = [];
      if (!c.kinds.includes(ev.id)) c.kinds.push(ev.id);
      if (c.kinds.length >= 4) push('collector');
    }
  } else if (ev.type === 'fragment') {
    push(ev.id);
  } else if (ev.type === 'bottle') {
    c.bottles = (c.bottles || 0) + 1;
    if (c.bottles >= 3) push('bottle_reader');
  }
  if (isFound(state, 'frag_coral') && isFound(state, 'frag_twilight') && isFound(state, 'frag_frost')) push('trench_chart');
  return found;
}

/** Open a sealed bottle item. Returns {ok, text}. Item is removed first so it cannot be opened twice. */
export function openBottle(state, uid, tier) {
  const idx = state.cargo.findIndex(i => i.uid === uid && i.id === 'message_bottle');
  if (idx < 0) return { ok: false, text: 'Nothing to open.' };
  state.cargo.splice(idx, 1);
  const r = Math.random();
  const cluable = SECRETS.filter(s => !state.secrets.found[s.id] && !state.secrets.clues.includes(s.id));
  let text;
  if (r < 0.3 && cluable.length) {
    const s = cluable[Math.floor(Math.random() * cluable.length)];
    state.secrets.clues.push(s.id);
    text = `A faded note reads: "${s.clue}"`;
  } else if (r < 0.5) {
    const cand = BAITS.filter(b => !state.owned.bait.includes(b.id) && b.price <= 900 * tier);
    if (cand.length) {
      const b = cand[Math.floor(Math.random() * cand.length)];
      state.owned.bait.push(b.id);
      text = `Inside is a little pouch of ${b.name}!`;
    }
  }
  if (!text) {
    const coins = Math.round((30 + Math.random() * 60) * Math.pow(tier, 1.4));
    earn(state, coins);
    text = `A tiny purse tumbles out with ${coins} coins!`;
  }
  return { ok: true, text, bottle: true };
}
