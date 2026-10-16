// Zone definitions: themes, unlock requirements, map positions.
// Equipment requirements are tier indices (0-based): boat:1 means "Coastal Skiff or better".
export const ZONES = [
  {
    id: 'pebble', name: 'Pebble Cove', tier: 1, depthM: 24,
    blurb: 'A peaceful starting cove with gentle waves, grassy islands and sandy shallows.',
    req: {}, hint: 'Where every fisher begins.',
    suggested: 'Starter rod, worm or minnow bait', baits: ['worm', 'minnow', 'crab'],
    map: { x: 0.14, y: 0.68, r: 0.1, color: '#8fd3b4', shape: 'grass' },
    theme: {
      skyDay: ['#a9dcee', '#fbf0d6'], skyNight: ['#1d2b55', '#58628f'],
      water: ['#86d6cc', '#47aaae', '#23738c'], fog: '#1f6f86', seabed: '#e8d7a9', seabed2: '#cdb887',
      foam: '#f5fbf4', island: 'grass', deco: 'pebble', particles: 'bubble', dark: 0.0, rays: 0.5,
    },
  },
  {
    id: 'sunlit', name: 'Sunlit Bay', tier: 2, depthM: 32,
    blurb: 'A warm tropical bay: turquoise water, bright palm islands and colourful reef fish.',
    req: { boat: 1, prev: { zone: 'pebble', count: 8 } }, hint: 'Needs a sturdier boat to reach the bay.',
    suggested: 'Coastal Skiff, Reef Bait', baits: ['reef', 'shiny', 'minnow'],
    map: { x: 0.33, y: 0.4, r: 0.1, color: '#6fe0d6', shape: 'palm' },
    theme: {
      skyDay: ['#7fd4f2', '#ffeac0'], skyNight: ['#23306a', '#7a5f98'],
      water: ['#79ecdd', '#36c3c9', '#1d86a8'], fog: '#18809c', seabed: '#fbe8b8', seabed2: '#e8cf94',
      foam: '#ffffff', island: 'palm', deco: 'sunlit', particles: 'bubble', dark: 0.0, rays: 0.85,
    },
  },
  {
    id: 'kelp', name: 'Whispering Kelp', tier: 3, depthM: 40,
    blurb: 'A mysterious green kelp forest. Filtered sunlight, swaying fronds and the odd shipwreck.',
    req: { line: 1, prev: { zone: 'sunlit', count: 9 } }, hint: 'The kelp grows deep. A better line will help.',
    suggested: 'Braided line, Kelp Paste', baits: ['kelp', 'worm', 'crab'],
    map: { x: 0.52, y: 0.7, r: 0.1, color: '#6bbf8a', shape: 'kelp' },
    theme: {
      skyDay: ['#b5dcc8', '#f1ecd0'], skyNight: ['#1c2e48', '#4a6a7a'],
      water: ['#7fcf9c', '#3f9a78', '#1d5e60'], fog: '#17525a', seabed: '#b9a878', seabed2: '#8d8460',
      foam: '#eef8ea', island: 'cliff', deco: 'kelp', particles: 'mote', dark: 0.12, rays: 1.0,
    },
  },
  {
    id: 'coral', name: 'Coral Garden', tier: 4, depthM: 52,
    blurb: 'A riot of coral, anemones and shimmering schools drifting through bright water.',
    req: { boat: 2, prev: { zone: 'kelp', count: 9 } }, hint: 'The reef is far offshore. Needs a proper boat.',
    suggested: 'Harbor Runner, Reef Bait, Barbed Hook', baits: ['reef', 'moon', 'crab'],
    map: { x: 0.72, y: 0.36, r: 0.1, color: '#f29ab0', shape: 'reef' },
    theme: {
      skyDay: ['#8fd8f0', '#fff1d8'], skyNight: ['#2a2a66', '#8a5a8a'],
      water: ['#6fdce4', '#2fa8d0', '#1c68a8'], fog: '#184f86', seabed: '#f2dcc0', seabed2: '#d8b896',
      foam: '#ffffff', island: 'reef', deco: 'coral', particles: 'bubble', dark: 0.0, rays: 0.9,
    },
  },
  {
    id: 'twilight', name: 'Twilight Deep', tier: 5, depthM: 140,
    blurb: 'An indigo deep, lit only by bioluminescent creatures and drifting glowing motes.',
    req: { line: 3, prev: { zone: 'coral', count: 8 } }, hint: 'Only a deepwater line can reach these depths.',
    suggested: 'Deepwater Cable line, Deep Glow Bait', baits: ['glow', 'moon', 'minnow'],
    map: { x: 0.86, y: 0.72, r: 0.1, color: '#6a6cc0', shape: 'rocks' },
    theme: {
      skyDay: ['#3e4a8a', '#8a7ab0'], skyNight: ['#0f1236', '#2a2f66'],
      water: ['#3d4a9a', '#252c70', '#10133c'], fog: '#0a0c2c', seabed: '#4a4670', seabed2: '#332f55',
      foam: '#b8c4ff', island: 'rocks', deco: 'twilight', particles: 'glow', dark: 0.5, rays: 0.25,
    },
  },
  {
    id: 'frost', name: 'Frostfall Sea', tier: 6, depthM: 110,
    blurb: 'A northern sea of icebergs, drifting snow and shimmering aurora.',
    req: { boat: 5, prev: { zone: 'twilight', count: 9 } }, hint: 'Only an ice-capable vessel can break through the floes.',
    suggested: 'Arctic Vessel, Arctic Bait', baits: ['arctic', 'minnow', 'worm'],
    map: { x: 0.62, y: 0.12, r: 0.1, color: '#cfe8f8', shape: 'ice' },
    theme: {
      skyDay: ['#b4d4ec', '#f4f8fc'], skyNight: ['#0e2448', '#2a6a7a'],
      water: ['#a4d8ee', '#4f94c4', '#1e4a84'], fog: '#173a74', seabed: '#dbe8f4', seabed2: '#b0c4dc',
      foam: '#ffffff', island: 'ice', deco: 'frost', particles: 'snow', dark: 0.1, rays: 0.6,
    },
  },
  {
    id: 'trench', name: 'The Forgotten Trench', tier: 7, depthM: 320,
    blurb: 'Ancient ruins, glowing glyphs and impossible creatures in deep violet water.',
    req: { boat: 6, rod: 4, line: 5, hook: 4, secret: 'trench_chart' },
    hint: 'Needs the best gear and an ancient chart to find the way.',
    suggested: 'Abyssal Voyager, Starthread line, Ancient Bait', baits: ['ancient', 'glow', 'moon'],
    map: { x: 0.9, y: 0.34, r: 0.09, color: '#8a5ac8', shape: 'ruins' },
    theme: {
      skyDay: ['#4a3a7a', '#a070b8'], skyNight: ['#150a30', '#3a1e68'],
      water: ['#7a4ac0', '#4a2a90', '#1c0e52'], fog: '#0f0630', seabed: '#4a3a78', seabed2: '#2e2250',
      foam: '#d0b8ff', island: 'ruins', deco: 'trench', particles: 'rune', dark: 0.45, rays: 0.3,
    },
  },
];
export const ZONE_BY_ID = Object.fromEntries(ZONES.map(z => [z.id, z]));
export const ZONE_INDEX = Object.fromEntries(ZONES.map((z, i) => [z.id, i]));
