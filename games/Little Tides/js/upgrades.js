// Equipment tiers, baits, boats and boosts (data) and the effect aggregator.
import { CONFIG } from './config.js';
import { PET_BY_ID } from './pets.js';

export const RODS = [
  { id: 'rod0', name: 'Driftwood Rod', price: 0, biteRed: 0, color: '#a87a4a', desc: 'A trusty old rod. It has seen things.', special: 'None' },
  { id: 'rod1', name: 'Bamboo Rod', price: 120, biteRed: 0.08, color: '#c8b45a', desc: 'Light and springy.', special: 'Reels in 10% faster', fx: { retrieve: 0.9 } },
  { id: 'rod2', name: 'Fiberglass Rod', price: 450, biteRed: 0.15, color: '#5fa8c8', desc: 'Sturdy and smooth.', special: '30% less junk', fx: { junk: 0.7 } },
  { id: 'rod3', name: 'Steel-Tip Rod', price: 1500, biteRed: 0.22, color: '#9aa8b8', desc: 'A sensitive tip that feels every nibble.', special: '+25% treasure chance', fx: { treasure: 1.25 } },
  { id: 'rod4', name: 'Carbon Rod', price: 5000, biteRed: 0.30, color: '#3a4256', desc: 'Strong, light and precise.', special: '+5% fish size', fx: { size: 0.05 } },
  { id: 'rod5', name: 'Moonsilver Rod', price: 16000, biteRed: 0.38, color: '#c8d4f0', desc: 'Forged under a full moon.', special: '+6% rare catch focus', fx: { rare: 0.06 } },
  { id: 'rod6', name: 'Tidecaller Rod', price: 50000, biteRed: 0.46, color: '#e8b84a', desc: 'The sea itself seems to answer it.', special: 'Faster reel, more rare focus & treasure', fx: { retrieve: 0.85, rare: 0.08, treasure: 1.2 } },
];
export const LINES = [
  { id: 'line0', name: 'Cotton Line', price: 0, maxDepth: 0.40, color: '#e8dcc0', desc: 'Fine for the shallows.' },
  { id: 'line1', name: 'Braided Line', price: 150, maxDepth: 0.55, color: '#d0a060', desc: 'Reaches into the midwater.' },
  { id: 'line2', name: 'Silk-Weave Line', price: 600, maxDepth: 0.70, color: '#c8e0d0', desc: 'Strong and thin. Dives deeper.' },
  { id: 'line3', name: 'Deepwater Cable', price: 2200, maxDepth: 0.82, color: '#8aa0c0', desc: 'Built for the dark below.' },
  { id: 'line4', name: 'Abyss Cord', price: 7500, maxDepth: 0.92, color: '#6a5aa0', desc: 'Almost to the bottom.' },
  { id: 'line5', name: 'Starthread', price: 26000, maxDepth: 1.0, color: '#f0d870', desc: 'Spun from something that falls from the sky.' },
];
export const HOOKS = [
  { id: 'hook0', name: 'Bent Pin Hook', price: 0, cap: 2, sizeBonus: 0, color: '#aab4bc', desc: 'Catches small fish only.' },
  { id: 'hook1', name: 'Steel Hook', price: 100, cap: 3, sizeBonus: 0.02, color: '#c0c8d0', desc: 'Handles medium-sized fish.' },
  { id: 'hook2', name: 'Barbed Hook', price: 400, cap: 4, sizeBonus: 0.04, color: '#9aa4ae', desc: 'Holds on to big fish.' },
  { id: 'hook3', name: 'Wide-Gap Hook', price: 1600, cap: 5, sizeBonus: 0.06, color: '#8a96a4', desc: 'For truly large fish.' },
  { id: 'hook4', name: 'Titan Hook', price: 6000, cap: 6, sizeBonus: 0.08, color: '#6a7a8c', desc: 'Giants of the deep can be hooked.' },
  { id: 'hook5', name: 'Leviathan Hook', price: 22000, cap: 7, sizeBonus: 0.12, color: '#e0c060', desc: 'Nothing in the sea is too big.' },
];
export const BOATS = [
  { id: 'boat0', name: 'Little Wooden Boat', price: 0, cap: 10, speed: 1.0, desc: 'Your trusty little rowboat with a patched sail.' },
  { id: 'boat1', name: 'Coastal Skiff', price: 400, cap: 15, speed: 1.12, desc: 'A sturdy skiff with a small sail. Ready for open bays.' },
  { id: 'boat2', name: 'Harbor Runner', price: 1800, cap: 20, speed: 1.25, desc: 'A little motor boat with a cosy cabin.' },
  { id: 'boat3', name: 'Explorer', price: 6000, cap: 26, speed: 1.4, desc: 'A proper sailing explorer with a big white sail.' },
  { id: 'boat4', name: 'Deepwater Cruiser', price: 16000, cap: 32, speed: 1.55, desc: 'Steel hull, radar and plenty of room for fish.' },
  { id: 'boat5', name: 'Arctic Vessel', price: 38000, cap: 36, speed: 1.7, desc: 'An ice-capable boat with a reinforced bow.' },
  { id: 'boat6', name: 'Abyssal Voyager', price: 95000, cap: 40, speed: 1.9, desc: 'A glowing, brass-domed vessel built for the deepest trenches.' },
];

// Baits are reusable. Each one boosts species whose "bait" tags match `cat`.
export const BAITS = [
  { id: 'worm', name: 'Worm Bait', cat: 'worm', price: 0, color: '#c98a8a', desc: 'Plain old reliable wriggly worms.' },
  { id: 'minnow', name: 'Minnow Bait', cat: 'minnow', price: 60, color: '#9ab8d0', desc: 'Silvery little minnows that torpedo-shaped fish love.' },
  { id: 'shiny', name: 'Shiny Lure', cat: 'shiny', price: 180, color: '#e8d870', desc: 'A glittering spoon that attracts flashy fish.' },
  { id: 'crab', name: 'Crab Chunk', cat: 'crab', price: 350, color: '#d96a54', desc: 'A smelly favorite of bottom feeders.' },
  { id: 'reef', name: 'Reef Bait', cat: 'reef', price: 600, color: '#f08aa8', desc: 'Sweet shrimp paste, irresistible to reef fish.' },
  { id: 'kelp', name: 'Kelp Paste', cat: 'kelp', price: 900, color: '#6aa86a', desc: 'Green mash for the shy fish of the kelp forest.' },
  { id: 'moon', name: 'Moonlight Mix', cat: 'moon', price: 2500, color: '#c8b8f8', desc: 'Faintly glowing. Jellies and dreamy fish drift towards it.' },
  { id: 'glow', name: 'Deep Glow Bait', cat: 'glow', price: 4500, color: '#7ad8ff', desc: 'Bioluminescent goo for deep-sea dwellers.' },
  { id: 'arctic', name: 'Arctic Bait', cat: 'arctic', price: 9000, color: '#d8f0ff', desc: 'Frozen krill. The cold-water fish adore it.' },
  { id: 'ancient', name: 'Ancient Bait', cat: 'ancient', price: 22000, color: '#e8c060', desc: 'Strange old runes glow on this lump of wax.' },
];

export const BOOSTS = [
  { id: 'bites', name: 'Faster Bites', price: 150, duration: 300, desc: 'Fish bite 35% sooner.', fx: { bite: 0.35 } },
  { id: 'treasure', name: 'Treasure Luck', price: 180, duration: 300, desc: 'Treasures are 2.5x as likely to appear.', fx: { treasure: 2.5 } },
  { id: 'sale', name: 'Better Sale Prices', price: 300, duration: 300, desc: 'Sell everything for 25% more.', fx: { sale: 0.25 } },
  { id: 'rare', name: 'Rare Catch Focus', price: 260, duration: 300, desc: 'Rare-and-better fish are drawn to your line.', fx: { rare: 0.5 } },
  { id: 'rush', name: 'Fishing Rush', price: 200, duration: 120, desc: 'Bites 60% sooner and reel in 40% faster.', fx: { bite: 0.6, retrieve: 0.6, cast: 0.7 } },
  { id: 'haul', name: 'Heavy Hauls', price: 220, duration: 300, desc: 'Fish are 12% larger on average.', fx: { size: 0.12 } },
];

export const CATS = { rod: RODS, line: LINES, hook: HOOKS, boat: BOATS };
export const BAIT_BY_ID = Object.fromEntries(BAITS.map(b => [b.id, b]));
export const BOOST_BY_ID = Object.fromEntries(BOOSTS.map(b => [b.id, b]));

export function maxOwned(state, cat) { return Math.max(...state.owned[cat]); }

/** Aggregate every bonus source into one object. Single source of truth for modifiers. */
export function getEffects(state) {
  const rod = RODS[state.equipped.rod], line = LINES[state.equipped.line];
  const hook = HOOKS[state.equipped.hook], boat = BOATS[state.equipped.boat];
  const bait = BAIT_BY_ID[state.equipped.bait] || BAITS[0];
  const pet = state.pets.active ? PET_BY_ID[state.pets.active] : null;
  const pb = pet ? pet.bonus : {};
  const perk = id => (state.prestige.perks[id] || 0);
  const P = Object.fromEntries(CONFIG.prestige.perks.map(p => [p.id, p]));
  const boost = id => (state.boosts[id] > 0 ? BOOST_BY_ID[id].fx : {});
  const b = { bites: boost('bites'), treasure: boost('treasure'), sale: boost('sale'), rare: boost('rare'), rush: boost('rush'), haul: boost('haul') };

  let biteMult = (1 - rod.biteRed) * (1 - (pb.bite || 0)) * (1 - perk('bite') * P.bite.per);
  biteMult *= (1 - (b.bites.bite || 0)) * (1 - (b.rush.bite || 0));
  let retrieveMult = ((rod.fx && rod.fx.retrieve) || 1) * (b.rush.retrieve ? b.rush.retrieve : 1);
  const castMult = b.rush.cast || 1;
  const junkMult = (rod.fx && rod.fx.junk) || 1;
  let treasureMult = ((rod.fx && rod.fx.treasure) || 1) * (1 + (pb.treasure || 0)) * (b.treasure.treasure || 1);
  const sizeBonus = hook.sizeBonus + ((rod.fx && rod.fx.size) || 0) + (b.haul.size || 0);
  const rareBonus = Math.min(1.2, ((rod.fx && rod.fx.rare) || 0) + (pb.rare || 0) + perk('luck') * P.luck.per + (b.rare.rare || 0));
  const saleMult = 1 + (pb.sale || 0) + state.prestige.stars * CONFIG.prestige.saleBonusPerStar
    + perk('sale') * P.sale.per + (b.sale.sale || 0);
  const cargoCap = boat.cap + (pb.cargo || 0) + perk('cargo') * P.cargo.per;
  return {
    biteMult: Math.max(0.2, biteMult), retrieveMult: Math.max(0.4, retrieveMult), castMult,
    junkMult, treasureMult, sizeBonus, rareBonus, saleMult, cargoCap,
    speed: boat.speed, maxDepth: line.maxDepth, hookCap: hook.cap, rodIdx: state.equipped.rod,
    bait, rod, line, hook, boat, pet,
  };
}
