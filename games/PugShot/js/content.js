/* =========================================================
   content.js - static catalogs: worlds, slingshots, pug skins,
   hats, boosts and ascension perks.
   ========================================================= */
'use strict';

/* ---------------- Worlds ----------------
   bio:   [meters, biomeIndex] steps (biomes live in terrain.js)
   cycle: biomes alternated beyond 3000m
   gravity / coin / diff: gameplay modifiers
   lava, gap, birds: section weight multipliers
   surf:  weights for special-surface sections                    */
const WORLDS = [
  {
    id: 0, name: 'MEADOW LANDS', desc: 'Where every pug begins. Gentle hills, rising danger.',
    bio: [[0, 0], [500, 1], [1000, 2], [2000, 3]], cycle: [2, 3],
    gravity: 1, coin: 1, diff: 1, off: 0, lava: 1, gap: 1, birds: 1,
    surf: { mud: 1, ice: 1.2, stone: 1.2, sand: 0.8 }
  },
  {
    id: 1, name: 'FROZEN PEAKS', desc: 'Slippery ice and glaciers. Momentum is everything.',
    bio: [[0, 4], [600, 5], [1500, 6]], cycle: [5, 6],
    gravity: 1, coin: 1.6, diff: 1.1, off: 150, lava: 0, gap: 1.3, birds: 1,
    surf: { mud: 0.3, ice: 3.5, stone: 1, sand: 0 }
  },
  {
    id: 2, name: 'DUNE SEA', desc: 'Sticky sand, scorching lava and ancient ruins.',
    bio: [[0, 7], [600, 8], [1500, 9]], cycle: [8, 9],
    gravity: 1, coin: 2.2, diff: 1.2, off: 300, lava: 1.3, gap: 1, birds: 1,
    surf: { mud: 0.5, ice: 0, stone: 1, sand: 3.5 }
  },
  {
    id: 3, name: 'CANDY KINGDOM', desc: 'Gumdrops are super bouncy. Chocolate is super sticky.',
    bio: [[0, 10], [600, 11], [1500, 12]], cycle: [11, 12],
    gravity: 0.95, coin: 3, diff: 1.3, off: 450, lava: 0, gap: 1.2, birds: 1,
    surf: { mud: 1.5, ice: 0.4, stone: 3.5, sand: 0 }
  },
  {
    id: 4, name: 'MOON BASE', desc: 'Low gravity. Fly for miles. Mind the vents.',
    bio: [[0, 13], [600, 14], [1500, 15]], cycle: [14, 15],
    gravity: 0.55, coin: 4, diff: 1.4, off: 600, lava: 0.8, gap: 1.5, birds: 0,
    surf: { mud: 0, ice: 1.5, stone: 2, sand: 1 }
  }
];

/* ---------------- Slingshots ----------------
   power = launch power multiplier; the rest are additive stats.
   price: {coins} or {stars}; no price = unlocked by an achievement */
const SLINGS = [
  { id: 'wood', name: 'OLD FAITHFUL', desc: 'A trusty wooden Y.', price: { coins: 0 },
    power: 1, wood: ['#a0643c', '#6b3d2e', '#d9a066'], band: '#c4302b', band2: '#8a2020' },
  { id: 'oak', name: 'STURDY OAK', desc: '+8% power, +1 half-heart', price: { coins: 400 },
    power: 1.08, hp: 1, wood: ['#8a5a2e', '#5a3220', '#c08850'], band: '#e8742c', band2: '#a8481c' },
  { id: 'rubber', name: 'RUBBER BANDIT', desc: '+15% power, bouncier landings', price: { coins: 1200 },
    power: 1.15, bounce: 0.05, wood: ['#e8604c', '#a02b2b', '#f6a090'], band: '#f08ca0', band2: '#c45a78' },
  { id: 'steel', name: 'STEEL SLINGER', desc: '+25% power, coin magnet, +1 half-heart', price: { coins: 3500 },
    power: 1.25, magnet: 8, hp: 1, wood: ['#94a3b8', '#566c86', '#bfcad8'], band: '#73b8f6', band2: '#3b5dc9' },
  { id: 'laser', name: 'LASER SIGHT', desc: '+30% power, long aim line, lucky', price: { coins: 9000 },
    power: 1.3, aim: 140, luck: 0.03, wood: ['#4a4458', '#2e2440', '#7a7484'], band: '#ff3030', band2: '#a01818', gem: '#ff3030' },
  { id: 'golden', name: 'GOLDEN SLING', desc: '+40% power, +15% coins', price: { coins: 25000 },
    power: 1.4, coin: 1.15, wood: ['#f4c430', '#c4892b', '#fff2a8'], band: '#fff8ec', band2: '#d9c9a0', gem: '#fff8ec' },
  { id: 'rocket', name: 'ROCKET Y', desc: '+55% power, strong air control', price: { coins: 60000 },
    power: 1.55, air: 40, wood: ['#e8742c', '#a8301b', '#ffd04a'], band: '#ffd04a', band2: '#c4892b', gem: '#ffd04a' },
  { id: 'cosmic', name: 'COSMIC CATAPULT', desc: '+80% power and every perk', price: { stars: 50 },
    power: 1.8, bounce: 0.05, hp: 2, magnet: 10, luck: 0.03, coin: 1.1, aim: 140, air: 20,
    wood: ['#7a5ac8', '#3a2a80', '#b8a0ff'], band: '#ff90e0', band2: '#a8e4ff', gem: '#a8e4ff' }
];

/* ---------------- Pug skins (palette swaps) ---------------- */
const SKINS = [
  { id: 'fawn', name: 'CLASSIC FAWN', desc: 'The original good boy.', price: { coins: 0 },
    c: { F: '#eec39a', S: '#d9a066', D: '#a0643c', M: '#3b2027', hi: '#f7e2c0', collar: '#c4302b' } },
  { id: 'black', name: 'MIDNIGHT', desc: 'The classic black pug.', price: { coins: 150 },
    c: { F: '#4a4458', S: '#34303f', D: '#2a2436', M: '#17101f', hi: '#6a6478', collar: '#c4302b' } },
  { id: 'choco', name: 'CHOCOLATE', desc: 'Sweet and slightly melty.', price: { coins: 150 },
    c: { F: '#8a5a3a', S: '#6b3d2e', D: '#4f2c24', M: '#2e1a14', hi: '#b0805a', collar: '#3b5dc9' } },
  { id: 'snowy', name: 'SNOWY', desc: 'A fluffy white cloud.', price: { coins: 400 },
    c: { F: '#fff8ec', S: '#e0d4c4', D: '#bcae9c', M: '#7a6a5a', hi: '#ffffff', collar: '#41a6f6' } },
  { id: 'panda', name: 'PANDA PUG', desc: 'Black and white and bouncy.', price: { coins: 800 },
    c: { F: '#fff8ec', S: '#d8d0c8', D: '#a8a0a0', M: '#1a1423', hi: '#ffffff', collar: '#4a8c3a' } },
  { id: 'zombie', name: 'ZOMBIE', desc: 'Reach 5000m to unlock.', unlock: 'a_5000',
    c: { F: '#8ab87a', S: '#5a8a52', D: '#3f6a3f', M: '#2d4a2d', hi: '#b6ec8c', collar: '#7a5232' } },
  { id: 'golden', name: 'GOLDEN PUG', desc: 'Earn 50,000 lifetime coins.', unlock: 'a_coins50k',
    c: { F: '#ffe066', S: '#e0a830', D: '#b07a20', M: '#7a4a18', hi: '#fff8c0', collar: '#c4302b' } },
  { id: 'lava', name: 'MAGMA', desc: 'Too hot to handle.', price: { stars: 15 },
    c: { F: '#ff7b1a', S: '#c4302b', D: '#8a1f1f', M: '#3b1010', hi: '#ffd04a', collar: '#ffd04a' } },
  { id: 'cosmic', name: 'COSMIC', desc: 'Made of stardust.', price: { stars: 40 },
    c: { F: '#7a5ac8', S: '#5a3aa0', D: '#3a2a80', M: '#1a1040', hi: '#ff90e0', collar: '#a8e4ff' } }
];

/* ---------------- Hats ---------------- */
const HATS = [
  { id: 'none', name: 'NO HAT', desc: 'Au naturel.', price: { coins: 0 } },
  { id: 'party', name: 'PARTY HAT', desc: 'Every run is a celebration.', price: { coins: 100 } },
  { id: 'bandana', name: 'BANDANA', desc: 'Tough pug energy.', price: { coins: 150 } },
  { id: 'shades', name: 'COOL SHADES', desc: 'Earn a x30 combo.', unlock: 'a_combo30' },
  { id: 'tophat', name: 'TOP HAT', desc: 'Very fancy.', price: { coins: 600 } },
  { id: 'crown', name: 'ROYAL CROWN', desc: 'Reach 10,000m.', unlock: 'a_10000' },
  { id: 'halo', name: 'HALO', desc: 'Ascend 3 times.', unlock: 'a_asc3' },
  { id: 'helmet', name: 'SPACE HELMET', desc: 'Reach 1000m on the Moon.', unlock: 'a_w4' }
];

/* ---------------- One-run boosts (auto-used at launch) ---------------- */
const BOOSTS = [
  { id: 'heart', name: 'EXTRA LIFE', desc: '+1 heart on your next run', price: 150, max: 3, icon: 'heart' },
  { id: 'power', name: 'TURBO START', desc: '+20% launch power next run', price: 200, max: 3, icon: 'power' },
  { id: 'coins', name: 'DOUBLE COINS', desc: 'x2 coin rewards next run', price: 350, max: 3, icon: 'coin' }
];

/* ---------------- Ascension perks (bought with stars, permanent) ---------------- */
const MAX_PERK_LEVEL = 10;
const PERKS = [
  { id: 'coin', name: 'GOLDEN PAWS', desc: 'Permanent coin bonus', base: 2, growth: 1.45, icon: 'magnet',
    fmt: l => `+${l * 10}% coins` },
  { id: 'power', name: 'STRONG START', desc: 'Permanent launch power', base: 3, growth: 1.45, icon: 'power',
    fmt: l => `+${l * 4}% power` },
  { id: 'heart', name: 'THICK FUR', desc: 'Extra half-hearts every run', base: 4, growth: 1.5, icon: 'durability',
    fmt: l => `+${l / 2} hearts` },
  { id: 'fund', name: 'TRUST FUND', desc: 'Start each ascension with coins', base: 2, growth: 1.4, icon: 'speed',
    fmt: l => `${l * 150} start coins` },
  { id: 'luck', name: 'FOUR-LEAF PUG', desc: 'Permanent luck', base: 3, growth: 1.45, icon: 'luck',
    fmt: l => `+${(l * 1.5).toFixed(1)}% luck` }
];

const ASCEND_MIN_STARS = 5;     // minimum stars gain required to ascend
const ASCEND_DIVISOR = 200;     // ascension score per star
