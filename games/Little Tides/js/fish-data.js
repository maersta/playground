// All species, junk and treasure definitions. Pure data + tiny helpers.
import { CONFIG } from './config.js';

const RC = { c: 'common', u: 'uncommon', r: 'rare', e: 'epic', l: 'legendary', m: 'mythic' };
const LAYER = { S: 0, M: 1, D: 2 };
export const LAYER_NAMES = ['Surface', 'Midwater', 'Deep water'];

// Row: name, rarity, wMin, wMax, lMin, lMax, depths, body, bodyHeight, [c1,c2,c3], pattern, baitCats, spawn, valueFactor, feature
const ZONE_ROWS = {
  pebble: [
    ['Perch', 'c', .2, 1.4, 15, 38, 'SM', 'fish', .34, ['#8fae5a', '#ecdc92', '#c9552f'], 'vstripes', 'worm', 30, 1],
    ['Small Cod', 'c', .3, 2.2, 20, 50, 'MD', 'fish', .32, ['#a98f6b', '#e9dcbc', '#6e5a3a'], 'speckle', 'worm minnow', 26, 1.1],
    ['Herring', 'c', .1, .5, 18, 32, 'S', 'torp', .24, ['#7fa3c0', '#e4eef5', '#3d5f80'], 'hstripe', 'minnow', 34, .8],
    ['Mackerel', 'c', .3, 1.6, 25, 45, 'SMD', 'torp', .26, ['#4d86a6', '#e6efe6', '#1f4663'], 'dorsal', 'minnow shiny', 28, 1],
    ['Flounder', 'u', .4, 3, 25, 55, 'MD', 'flat', .5, ['#b79b6f', '#e8d9ae', '#7a6038'], 'mottled', 'worm crab', 20, 1.3],
    ['Goby', 'u', .01, .1, 6, 12, 'S', 'fish', .3, ['#c2a36c', '#f1e3b4', '#7b6a3f'], 'spots', 'worm', 18, 1.2],
    ['Sand Goby', 'u', .01, .08, 5, 11, 'SM', 'fish', .26, ['#e3cc92', '#f8eecb', '#a98d52'], 'speckle', 'worm', 18, 1.2],
    ['Cuckoo Wrasse', 'r', .2, 1.2, 18, 40, 'MD', 'fish', .3, ['#e08a3a', '#3d88c7', '#f2d36a'], 'bands', 'worm crab', 12, 1.6],
    ['Shore Crab', 'r', .1, .9, 6, 14, 'S', 'crab', .4, ['#d96a54', '#f0a487', '#8a3b30'], 'spots', 'crab', 12, 1.5],
    ['Starfish', 'e', .05, .5, 8, 26, 'SM', 'star', .4, ['#f08a5a', '#f7c9a0', '#c9533a'], 'spots', 'crab', 8, 1.4],
    ['Pipefish', 'l', .01, .08, 20, 45, 'MD', 'slim', .1, ['#6fae8e', '#d7efc0', '#2f6e58'], 'bands', 'minnow', 4, 2.5],
    ['Silverglint', 'm', .8, 6, 40, 90, 'MD', 'fish', .32, ['#d8e6f2', '#ffffff', '#9fb6ff'], 'sheen', 'shiny', 2, 2.5],
  ],
  sunlit: [
    ['Clownfish', 'c', .05, .25, 6, 11, 'S', 'fish', .4, ['#ff8a2a', '#fff6e6', '#22304a'], 'bands', 'reef', 30, 1],
    ['Parrotfish', 'c', .8, 4, 30, 60, 'SMD', 'fish', .42, ['#3fc0b0', '#e36aa0', '#8fe0c8'], 'scales', 'reef', 26, 1.1, 'beak'],
    ['Butterflyfish', 'c', .1, .4, 10, 20, 'SM', 'round', .6, ['#ffe066', '#fff7d0', '#2b2b3a'], 'vstripes', 'reef', 26, 1],
    ['Surgeonfish', 'c', .4, 1.5, 18, 35, 'MD', 'round', .5, ['#7aa7d8', '#f2e36a', '#2b3d6a'], 'hstripe', 'reef minnow', 24, 1],
    ['Yellowtail Mackerel', 'u', 1, 6, 40, 80, 'MD', 'torp', .26, ['#5f9fcf', '#f3f0e6', '#f2c93a'], 'hstripe', 'minnow shiny', 18, 1.2],
    ['Flying Fish', 'u', .2, .9, 20, 35, 'S', 'torp', .22, ['#5aa0c8', '#e6f3fa', '#9fd0e8'], 'sheen', 'minnow', 16, 1.2, 'wings'],
    ['Blue Tang', 'u', .3, 1.2, 15, 30, 'SM', 'round', .58, ['#2d6fe0', '#ffe14a', '#12214a'], 'hstripe', 'reef', 16, 1.3],
    ['Seahorse', 'r', .01, .06, 8, 16, 'SM', 'seahorse', .4, ['#f0b25a', '#f7dca0', '#c47a2a'], 'spots', 'reef', 12, 2],
    ['Mandarin Fish', 'r', .02, .1, 5, 9, 'S', 'fish', .34, ['#2f8fd0', '#ff8a2a', '#7be0c8'], 'swirl', 'reef', 12, 2.5],
    ['Reef Eel', 'e', .8, 6, 60, 140, 'MD', 'eel', .12, ['#7a8a4a', '#dad27a', '#3b4020'], 'spots', 'crab reef', 8, 1.2],
    ['Sunray Fish', 'l', 2, 12, 50, 110, 'MD', 'fish', .44, ['#ffb347', '#fff0a0', '#ff7a2a'], 'rays', 'shiny', 4, 1, 'crest'],
    ['Pearlfin', 'm', 3, 20, 60, 120, 'D', 'fish', .38, ['#f8f2ff', '#cfe0ff', '#ffc8e6'], 'sheen', 'shiny moon', 2, 1.2, 'longfins'],
  ],
  kelp: [
    ['Sea Bass', 'c', 1, 8, 35, 80, 'MD', 'fish', .34, ['#7f9a86', '#d8e2cc', '#44594a'], 'dorsal', 'minnow worm', 28, 1],
    ['Rock Gunnel', 'c', .02, .15, 10, 25, 'SM', 'slim', .12, ['#a67c52', '#e8d2a0', '#5c3d22'], 'spots', 'worm', 26, .9],
    ['Kelp Blenny', 'c', .02, .12, 6, 14, 'S', 'fish', .26, ['#78a448', '#dfe8a0', '#3f5e24'], 'mottled', 'kelp', 26, .9],
    ['Lumpfish', 'c', .8, 5, 25, 50, 'MD', 'round', .66, ['#6d8aa8', '#cfd9e0', '#3c4f66'], 'spots', 'kelp crab', 22, 1],
    ['Longfin Kelpfish', 'u', .1, .6, 15, 30, 'SM', 'slim', .16, ['#9b6bb0', '#ead2f0', '#5b3a70'], 'hstripe', 'kelp', 16, 1.3, 'longfins'],
    ['Sea Robin', 'u', .3, 1.5, 20, 40, 'MD', 'fish', .3, ['#c96a50', '#f2c19a', '#7a3a28'], 'spots', 'crab worm', 16, 1.3, 'wings'],
    ['Conger Eel', 'u', 3, 20, 100, 200, 'MD', 'eel', .14, ['#5d6a78', '#b5bfc9', '#2a323c'], 'none', 'minnow', 14, 1],
    ['Green Ray', 'r', 2, 12, 50, 110, 'MD', 'ray', .5, ['#6aa87a', '#d4ecc4', '#35603f'], 'spots', 'crab kelp', 12, 1.3],
    ['Glass Eel', 'r', .01, .05, 6, 12, 'SM', 'eel', .05, ['#d6efe8', '#ffffff', '#7ab6a8'], 'none', 'minnow', 12, 3, 'glass'],
    ['Moon Jelly', 'e', .1, 1, 8, 25, 'SM', 'jelly', .5, ['#d7c8ff', '#f6f0ff', '#9a86d8'], 'none', 'moon', 8, 2.5],
    ['Shadow Mackerel', 'l', 2, 8, 50, 90, 'MD', 'torp', .26, ['#3b4b66', '#8a9ab4', '#1a2336'], 'dorsal', 'glow minnow', 4, 2],
    ['Mossback', 'm', 12, 60, 120, 260, 'D', 'fish', .46, ['#5e7d4a', '#c3d49a', '#364a28'], 'mottled', 'kelp', 2, 1, 'moss'],
  ],
  coral: [
    ['Pufferfish', 'c', .3, 2, 15, 40, 'SM', 'puffer', .7, ['#e0c060', '#faf0c8', '#8a6a2a'], 'spots', 'reef crab', 28, 1],
    ['Lionfish', 'c', .4, 1.4, 20, 40, 'SM', 'lion', .4, ['#d9533a', '#f6e3d0', '#6b2118'], 'vstripes', 'reef minnow', 26, 1.1],
    ['King Mackerel', 'c', 3, 14, 70, 140, 'SMD', 'torp', .26, ['#5a8fa8', '#e2ece8', '#2d4f63'], 'hstripe', 'minnow shiny', 24, 1.1],
    ['Coral Grouper', 'c', 2, 12, 40, 90, 'MD', 'fish', .46, ['#d9603e', '#f3b095', '#7b2c1a'], 'spots', 'reef crab', 24, 1.1],
    ['Redbelly Surgeonfish', 'u', .5, 2, 20, 38, 'SM', 'round', .52, ['#4a7bd0', '#e0603a', '#1c2b55'], 'belly', 'reef', 16, 1.2],
    ['Rainbow Wrasse', 'u', .2, 1.5, 15, 35, 'SM', 'fish', .3, ['#4fd0b0', '#f06ea8', '#f8d34a'], 'bands', 'reef', 16, 1.3],
    ['Lanternfish', 'u', .02, .2, 6, 14, 'MD', 'fish', .3, ['#3a5a8a', '#a9d8e8', '#1a2a4a'], 'glowspots', 'glow', 16, 1.4],
    ['Octopus', 'r', 2, 12, 40, 100, 'MD', 'octopus', .5, ['#d05a6a', '#f3b8b0', '#7a2a3a'], 'spots', 'crab', 12, 1.3],
    ['Pearl Ray', 'r', 3, 18, 60, 140, 'MD', 'ray', .5, ['#e8e2f0', '#ffffff', '#9aa8d0'], 'spots', 'shiny', 12, 1.3],
    ['Coral Shark', 'e', 10, 60, 120, 220, 'MD', 'shark', .3, ['#7a98a8', '#e8f0f2', '#3e5866'], 'none', 'minnow', 8, 1],
    ['Yellow-Eyed Moray', 'l', 5, 25, 100, 200, 'MD', 'eel', .14, ['#8a9a4a', '#f0e48a', '#3e4a22'], 'spots', 'crab', 4, 1, 'jaw'],
    ['Jewel Koi', 'm', 2, 10, 40, 80, 'SM', 'fish', .4, ['#ffffff', '#ff7a4a', '#2a2a3a'], 'patch', 'shiny reef', 2, 1.5, 'jewel'],
  ],
  twilight: [
    ['Blue Lanternfish', 'c', .02, .2, 6, 14, 'SM', 'fish', .3, ['#2a4a8a', '#8ad0ff', '#101c3a'], 'glowspots', 'glow', 28, .9],
    ['Viperfish', 'c', .1, .6, 20, 35, 'MD', 'fish', .3, ['#2e3a5a', '#8aa0c0', '#141a2c'], 'glowspots', 'glow minnow', 26, 1, 'fangs'],
    ['Pelican Eel', 'c', .5, 3, 50, 100, 'D', 'eel', .12, ['#3a3050', '#7a6aa0', '#1a1428'], 'none', 'glow', 24, 1, 'pelican'],
    ['Glass Squid', 'c', .1, 1, 15, 40, 'SM', 'squid', .3, ['#c8e8ff', '#ffffff', '#7ab0d0'], 'glowspots', 'glow', 24, 1, 'glass'],
    ['Anglerfish', 'u', 1, 8, 25, 70, 'MD', 'angler', .6, ['#4a3a5a', '#9a7ab0', '#1c1426'], 'spots', 'glow', 16, 1.3],
    ['Star Ray', 'u', 2, 10, 50, 100, 'MD', 'ray', .5, ['#3a4a8a', '#c8d4ff', '#1a2250'], 'glowspots', 'glow shiny', 16, 1.3],
    ['Ghost Jelly', 'u', .1, 2, 10, 35, 'SM', 'jelly', .55, ['#c8f0ff', '#ffffff', '#7ac8e8'], 'none', 'moon glow', 16, 1.3],
    ['Deep Dragonfish', 'r', .5, 5, 40, 90, 'MD', 'dragon', .14, ['#5a3a8a', '#c8a0ff', '#24123e'], 'glowspots', 'glow', 12, 1.4],
    ['Abyss Eel', 'r', 3, 18, 120, 220, 'D', 'eel', .14, ['#2a2a40', '#6a6a98', '#12121e'], 'glowspots', 'glow', 12, 1.2],
    ['Silver Shark', 'e', 20, 90, 150, 280, 'MD', 'shark', .3, ['#b8c4d4', '#f2f6fa', '#6a7890'], 'none', 'minnow shiny', 8, 1],
    ['Night Pearl', 'l', 2, 12, 30, 70, 'MD', 'fish', .4, ['#2a2f66', '#fff3c8', '#9fb4ff'], 'glowspots', 'glow shiny', 4, 2, 'pearl'],
    ['Keeper of the Deep', 'm', 40, 200, 200, 400, 'D', 'leviathan', .4, ['#3a2a66', '#a070ff', '#140c2a'], 'glowspots', 'glow', 2, 1.2],
  ],
  frost: [
    ['Arctic Char', 'c', .5, 4, 30, 70, 'SM', 'fish', .3, ['#7aa8c8', '#f4a47a', '#3a5a7a'], 'spots', 'arctic minnow', 28, 1],
    ['Halibut', 'c', 3, 25, 60, 150, 'MD', 'flat', .5, ['#8a8a78', '#e8e4d4', '#4a4a3a'], 'mottled', 'arctic worm', 26, 1],
    ['Polar Cod', 'c', .1, .8, 15, 35, 'SMD', 'fish', .28, ['#9ab8d0', '#e6f0f6', '#4a6a88'], 'speckle', 'arctic minnow', 28, .9],
    ['Glacier Herring', 'c', .1, .6, 18, 32, 'S', 'torp', .24, ['#a8d8f0', '#f4fbff', '#5a90b8'], 'hstripe', 'arctic minnow', 26, .9],
    ['Snow Sculpin', 'u', .1, .9, 10, 25, 'MD', 'fish', .34, ['#d8e4ec', '#ffffff', '#8a9eae'], 'mottled', 'arctic', 16, 1.3],
    ['Frostfin', 'u', .5, 3, 20, 45, 'SM', 'fish', .34, ['#88c8f0', '#e0f4ff', '#3a78b0'], 'sheen', 'arctic shiny', 16, 1.3, 'longfins'],
    ['Crystal Perch', 'u', .3, 2, 18, 38, 'SMD', 'fish', .34, ['#b8f0ff', '#ffffff', '#68b8d8'], 'sheen', 'arctic', 16, 1.4, 'crystal'],
    ['Ice Ray', 'r', 3, 20, 60, 150, 'MD', 'ray', .5, ['#a8d0ec', '#f4fbff', '#5088b0'], 'spots', 'arctic', 12, 1.3],
    ['Ice Squid', 'r', 2, 15, 40, 120, 'MD', 'squid', .3, ['#b8d4f4', '#f0f8ff', '#6a8ec0'], 'spots', 'arctic', 12, 1.3],
    ['Arctic Shark', 'e', 40, 300, 200, 450, 'MD', 'shark', .3, ['#6a7e94', '#e4ecf2', '#38485a'], 'none', 'arctic', 8, 1],
    ['Aurora Jelly', 'l', 1, 10, 20, 60, 'SM', 'jelly', .55, ['#7af0c8', '#c8a8ff', '#3a98a8'], 'none', 'arctic moon', 4, 1.5],
    ['Winter Star', 'm', .5, 4, 20, 45, 'MD', 'star', .4, ['#e8f8ff', '#ffffff', '#7ac8f0'], 'glowspots', 'arctic', 2, 2],
  ],
  trench: [
    ['Ruin Catfish', 'c', 2, 15, 50, 120, 'MD', 'fish', .36, ['#8a7a9a', '#d8cce0', '#463a58'], 'mottled', 'ancient worm', 28, 1, 'whiskers'],
    ['Ancient Angler', 'c', 1, 10, 30, 80, 'MD', 'angler', .6, ['#5a4a7a', '#b8a0e0', '#2a1e44'], 'spots', 'ancient glow', 26, 1],
    ['Phantom Ray', 'c', 3, 20, 60, 150, 'SMD', 'ray', .5, ['#7a6aa8', '#d8ccff', '#3a2e66'], 'glowspots', 'ancient moon', 26, 1],
    ['Crystal Eel', 'c', 1, 8, 80, 160, 'SMD', 'eel', .12, ['#a8e0ff', '#ffffff', '#5a98c8'], 'sheen', 'ancient glow', 24, 1, 'crystal'],
    ['Moonlit Squid', 'u', 2, 15, 40, 120, 'MD', 'squid', .3, ['#c8c0ff', '#ffffff', '#6a60c0'], 'glowspots', 'moon ancient', 16, 1.3],
    ['Dream Jelly', 'u', .2, 3, 10, 40, 'SM', 'jelly', .55, ['#f0a8ff', '#ffe8ff', '#a058c8'], 'none', 'moon', 16, 1.3],
    ['Voidfish', 'u', 1, 8, 25, 60, 'MD', 'fish', .4, ['#1a1030', '#6a3aa8', '#0a0618'], 'glowspots', 'ancient glow', 16, 1.4, 'void'],
    ['Star Eater', 'r', 5, 40, 60, 160, 'MD', 'fish', .5, ['#3a2a6a', '#ffd870', '#140c2c'], 'glowspots', 'ancient glow', 12, 1.3, 'jaw'],
    ['Abyssal Shark', 'r', 30, 200, 200, 400, 'MD', 'shark', .3, ['#3a3a58', '#a8a8c8', '#181828'], 'glowspots', 'ancient', 12, 1.2],
    ['Deepsea Dragon', 'e', 20, 120, 200, 500, 'MD', 'dragon', .16, ['#6a3ab0', '#ffd870', '#26104a'], 'glowspots', 'ancient glow', 8, 1.1],
    ['Primordial Leviathan', 'l', 200, 900, 500, 1200, 'D', 'leviathan', .4, ['#2a3a68', '#8ab0ff', '#0e1430'], 'glowspots', 'ancient', 4, 1],
    ['Tide King', 'm', 50, 300, 200, 420, 'D', 'fish', .46, ['#2a8aa8', '#ffd870', '#0e2a3a'], 'crown', 'ancient', 2, 1.3, 'crown'],
  ],
};
export const ZONE_ORDER = ['pebble', 'sunlit', 'kelp', 'coral', 'twilight', 'frost', 'trench'];

// Special encounter requirements ("optional discovery conditions"). Keys are species ids.
export const SPECIES_REQ = {
  moon_jelly: { time: 'night' },
  mossback: { bait: 'kelp' },
  night_pearl: { time: 'night' },
  winter_star: { time: 'night' },
  moonlit_squid: { time: 'night' },
  tide_king: { bait: 'ancient' },
  keeper_of_the_deep: { bait: 'glow' },
  primordial_leviathan: { minRod: 4 },
};

export const slug = s => s.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');

function sizeClass(avg) {
  const t = CONFIG.hookSizeClassWeights;
  let c = 1;
  for (const lim of t) { if (avg >= lim) c++; }
  return c;
}

export const SPECIES = [];
ZONE_ORDER.forEach((zone, zi) => {
  ZONE_ROWS[zone].forEach((r, i) => {
    const [name, rar, wMin, wMax, lMin, lMax, depths, body, h, colors, pattern, bait, spawn, f, feature] = r;
    const id = slug(name);
    SPECIES.push({
      id, name, zone, zoneIndex: zi, order: i,
      rarity: RC[rar], wMin, wMax, lMin, lMax,
      depths: [...depths].map(d => LAYER[d]),
      body, h, colors, pattern, bait: bait.split(' '),
      spawn, baseValue: Math.max(1, Math.round(CONFIG.zoneBase[zi] * f)),
      feature: feature || null,
      size: sizeClass((wMin + wMax) / 2),
      req: SPECIES_REQ[id] || null,
    });
  });
});
export const SPECIES_BY_ID = Object.fromEntries(SPECIES.map(s => [s.id, s]));
export const speciesOfZone = z => SPECIES.filter(s => s.zone === z);

// ---------- Junk & treasure ----------
// value is a base number, scaled by zone multipliers when caught.
export const JUNK = [
  { id: 'old_boot', name: 'Old Boot', value: 3, weight: 20, desc: 'Squelchy and sad. Someone loved it once.' },
  { id: 'tin_can', name: 'Tin Can', value: 2, weight: 20, desc: 'Dented, rusty, and surprisingly empty.' },
  { id: 'glass_bottle', name: 'Glass Bottle', value: 4, weight: 14, desc: 'A green bottle, smoothed by the sea.' },
  { id: 'torn_net', name: 'Broken Net', value: 3, weight: 14, desc: 'A tangle of old netting.' },
  { id: 'driftwood', name: 'Driftwood', value: 4, weight: 14, desc: 'A bleached branch with character.' },
  { id: 'rusty_anchor', name: 'Rusty Anchor', value: 9, weight: 6, desc: 'Far too small to be a real anchor... but oh so heavy.' },
  { id: 'seaweed', name: 'Seaweed Knot', value: 1, weight: 16, desc: 'Slimy, but fragrant.' },
  { id: 'message_bottle', name: 'Sealed Bottle', value: 5, weight: 5, openable: true, desc: 'Something rattles inside. You could open it...' },
];
export const TREASURES = [
  { id: 'coin_pouch', name: 'Coin Pouch', value: 45, weight: 30, desc: 'Heavy with old coins.' },
  { id: 'pearl', name: 'Pearl', value: 120, weight: 20, desc: 'A lustrous pearl, shimmering softly.' },
  { id: 'rare_shell', name: 'Rare Shell', value: 150, weight: 16, desc: 'Spiralled, pearly and perfect.' },
  { id: 'old_compass', name: 'Old Compass', value: 200, weight: 12, desc: 'Its needle still points somewhere.' },
  { id: 'antique_reel', name: 'Antique Fishing Reel', value: 350, weight: 8, desc: 'Brass and beautifully made.' },
  { id: 'treasure_chest', name: 'Treasure Chest', value: 400, weight: 6, desc: 'A small chest, barnacled and full of glitter.' },
  { id: 'gold_idol', name: 'Golden Idol', value: 700, weight: 3, desc: 'A little golden fish idol, older than the harbor.' },
  { id: 'sunken_crown', name: 'Sunken Crown', value: 1100, weight: 1.5, desc: 'It belonged to someone important. Possibly a crab.' },
];
export const LOOT_BY_ID = Object.fromEntries([...JUNK, ...TREASURES].map(x => [x.id, x]));

export const BAIT_CATS = ['worm', 'minnow', 'shiny', 'crab', 'reef', 'kelp', 'moon', 'glow', 'arctic', 'ancient'];
