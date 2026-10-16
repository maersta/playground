// Central balance configuration. Tweak numbers here to rebalance the whole game.
export const CONFIG = {
  version: 1,
  saveKey: 'little-tides-save',
  autosaveSeconds: 15,
  dayLength: 300, // seconds for a full day/night cycle

  // Rarity: baseline encounter probability (conceptual), sale multiplier, colours.
  rarities: [
    { id: 'common', name: 'Common', prob: 0.60, mult: 1.0, color: '#8b95a1', soft: '#e9ecef' },
    { id: 'uncommon', name: 'Uncommon', prob: 0.25, mult: 1.5, color: '#4f9a5f', soft: '#e1f1e3' },
    { id: 'rare', name: 'Rare', prob: 0.10, mult: 2.5, color: '#3b82c4', soft: '#dcebf8' },
    { id: 'epic', name: 'Epic', prob: 0.04, mult: 5, color: '#8a5bc4', soft: '#ece3f7' },
    { id: 'legendary', name: 'Legendary', prob: 0.009, mult: 12, color: '#d9a21b', soft: '#fbefc7' },
    { id: 'mythic', name: 'Mythic', prob: 0.001, mult: 30, color: '#e0609a', soft: '#fbdfeb' },
  ],
  // Hard caps on the share of the final table that Legendary / Mythic may reach
  // (stops stacked bonuses from making them ordinary).
  rarityCaps: { legendary: 0.04, mythic: 0.004 },

  fishing: {
    biteMin: 6, biteMax: 14,       // seconds, before bonuses
    biteFloor: 2.8,                // never shorter than this (needs time for the fish to swim in)
    biteNibble: 1.0,               // "bite detected" animation
    retrieveMin: 2.0, retrieveMax: 3.0,
    castTime: 0.6,
    descendSpeed: 0.34,            // depth fraction per second
    defaultDepth: 0.35,            // base casting depth
    minDepth: 0.12,
    depthStep: 0.05,
    layerBounds: [0.3, 0.6],       // surface < 0.3 <= midwater < 0.6 <= deep
    junkChance: 0.08,
    treasureChance: 0.035,
    fragmentChance: 0.03,          // per cast, in zones that hide a map fragment
    variantChance: 0.012,          // prismatic colour variant
    variantMult: 1.6,
    exceptionalChance: 0.04,       // chance of an unusually big specimen
    weightMultMin: 0.7, weightMultMax: 1.8,
    baitBoost: 2.4,                // weight multiplier for species matching the bait
    presentTime: { common: 1.7, uncommon: 2.1, rare: 3, epic: 4, legendary: 5.5, mythic: 6.5 },
  },

  // Base value of a typical fish in each zone (species have a factor on top)
  zoneBase: [8, 18, 38, 80, 170, 360, 760],
  treasureZoneMult: [1, 2, 3.5, 6, 10, 16, 26],
  junkZoneMult: [1, 1.6, 2.4, 3.6, 5, 7, 10],

  hookSizeClassWeights: [1.5, 5, 20, 60, 200, 600], // avg-weight thresholds for size class 1..7

  quests: { maxActive: 3, boardSize: 4, rerollCost: 40 },

  prestige: {
    minDiscovered: 45,
    needZone: 'twilight',
    runEarnedDivisor: 6000,
    saleBonusPerStar: 0.02,
    perks: [
      { id: 'sale', name: 'Seasoned Trader', desc: '+6% sale value per level', max: 8, per: 0.06 },
      { id: 'bite', name: 'Quick Hands', desc: '-2.5% bite time per level', max: 8, per: 0.025 },
      { id: 'cargo', name: 'Deep Pockets', desc: '+1 cargo slot per level', max: 6, per: 1 },
      { id: 'luck', name: 'Tide Luck', desc: '+3% rare catch focus per level', max: 5, per: 0.03 },
    ],
  },
};

export const RARITY = Object.fromEntries(CONFIG.rarities.map((r, i) => [r.id, { ...r, index: i }]));
export const RARITY_IDS = CONFIG.rarities.map(r => r.id);
