/* Little Ocean - centralised balance & world configuration.
   Tweak numbers here; nothing else needs to change. */
window.LO = window.LO || {};
LO.CFG = {
  world: { w: 6000, h: 3300, rowSplit: 1745, floor0: 1700, floor1: 3300 },
  start: { x: 520, y: 640 },

  view: { baseZoom: 1.75, zoomPow: 0.55, minZoom: 0.55, maxZoom: 1.6, camSmooth: 5, lookAhead: 0.3 },

  player: {
    startSize: 10, baseSpeed: 175, speedPerSize: 0.6, speedSizeCap: 60,
    accel: 3.6,        // how quickly speed approaches target (1/s)
    turn: 6.5,         // max turn rate (rad/s)
    drift: 6,          // how quickly velocity follows heading (lower = more inertia)
    deadzone: 10, slowRadius: 140, radiusPerSize: 0.7
  },

  burst: {
    maxEnergy: 100, drain: 40, regen: 25, mult: 2.0, minActivate: 15,
    startCost: 4, regenDelay: 0.45, turnMul: 0.5, accelMul: 2.2
  },

  eat: { ratio: 1.2, reward: 0.15 },

  // level n has size levelSizes[n-1]; xpToNext[n-1] growth needed to reach n+1
  growth: {
    levelSizes: [10, 13, 16, 20, 25, 31, 38, 46, 55, 65, 76, 88, 100],
    xpToNext: [6, 10, 16, 24, 36, 52, 75, 105, 145, 200, 270, 360],
    milestones: [
      { level: 3, maxTier: 1 }, { level: 5, maxTier: 2 }, { level: 7, maxTier: 2 },
      { level: 9, maxTier: 3 }, { level: 11, maxTier: 3 }
    ]
  },

  ai: { activeRadius: 2300, senseInterval: 0.2, fleeMul: 1.3, nervousFleeMul: 1.65, satedTime: 7, giveUp: 1.7 },
  pop: { reef: 80, kelp: 62, blue: 56, deep: 42, grotto: 38 },
  fx: { maxParticles: 480 },

  zoneOrder: ['reef', 'kelp', 'blue', 'deep', 'grotto'],
  zones: {
    reef: {
      id: 'reef', name: 'The Shallow Reef', rect: [0, 0, 2000, 1700], min: 0,
      desc: 'Warm, sunlit shallows crowded with coral and curious little fish. A gentle place to learn the tides.',
      pal: { top: '#7fe3d6', bot: '#2096aa', rock: '#a39a94', rockHi: '#d9cbb8', sand: '#efd8a4', sandHi: '#fff0c8', far: '#2b97a8', accent: '#ff8fa3', light: 0.95, dark: 0 }
    },
    kelp: {
      id: 'kelp', name: 'The Kelp Forest', rect: [2000, 0, 2000, 1700], min: 16,
      desc: 'Towering green fronds sway in slow green light. Stands of kelp hide small fish from hungry eyes.',
      pal: { top: '#77d6a6', bot: '#14605f', rock: '#6f8369', rockHi: '#aebc92', sand: '#cdbf8a', sandHi: '#e8dcae', far: '#1f6b63', accent: '#a6e86f', light: 0.7, dark: 0.08 }
    },
    blue: {
      id: 'blue', name: 'The Open Blue', rect: [4000, 0, 2000, 1700], min: 25,
      desc: 'Wide, bright, endless water. Fast hunters patrol here, and there is little to hide behind.',
      pal: { top: '#62b8f2', bot: '#143685', rock: '#7b88a9', rockHi: '#b6c1da', sand: '#d6d2c0', sandHi: '#efeadb', far: '#18419a', accent: '#8ad8ff', light: 0.85, dark: 0.04 }
    },
    deep: {
      id: 'deep', name: 'The Deep Sea', rect: [3000, 1790, 3000, 1510], min: 38,
      desc: 'Cold and dark. Lights drift in the black, and some of them have teeth.',
      pal: { top: '#243584', bot: '#080b26', rock: '#3b3961', rockHi: '#6d69a4', sand: '#4b4773', sandHi: '#7b77b3', far: '#0f1544', accent: '#7af7ff', light: 0.05, dark: 0.72 }
    },
    grotto: {
      id: 'grotto', name: 'The Hidden Grottos', rect: [0, 1790, 3000, 1510], min: 55,
      desc: 'A secret maze of crystal caves, glowing moss and quiet pools beyond the deep.',
      pal: { top: '#6a4aa8', bot: '#1d1346', rock: '#4d3b72', rockHi: '#8d76bb', sand: '#6d5b98', sandHi: '#ab97d6', far: '#2c1e5a', accent: '#8cffd6', light: 0.1, dark: 0.55 }
    }
  },

  // size-gated passages (a strong current blocks anyone smaller than `min`)
  gates: [
    { id: 'kelp_gate', name: 'The Whispering Current', from: 'reef', to: 'kelp', min: 16, rect: [1960, 820, 80, 240], desc: 'A green current streams through a gap in the reef wall.' },
    { id: 'blue_gate', name: 'The Bluewater Channel', from: 'kelp', to: 'blue', min: 25, rect: [3960, 700, 80, 300], desc: 'A channel of fast, bright water leading out of the kelp.' },
    { id: 'deep_gate', name: 'The Dropoff', from: 'blue', to: 'deep', min: 38, rect: [4800, 1700, 300, 90], desc: 'The seabed simply ends here. Cold water pours into the dark.' },
    { id: 'grotto_gate', name: 'The Lantern Tunnel', from: 'deep', to: 'grotto', min: 55, rect: [2960, 2350, 80, 300], desc: 'A tunnel in the deep wall, faintly lit from far inside.' }
  ],

  cosmetics: {
    default: { name: 'Sunny Gold', body: '#ffb44c', belly: '#fff0c8', fin: '#ff7e6b', accent: '#3fc1c9', glow: null, swatch: '#ffb44c' },
    aurora: { name: 'Aurora Shimmer', body: '#7de0d0', belly: '#f0fff9', fin: '#c79bff', accent: '#ff9ed8', glow: '#a8fff0', swatch: '#7de0d0', hint: 'Find the Aurora Ray' },
    lumen: { name: 'Lumen Glow', body: '#3fa7d6', belly: '#c9f6ff', fin: '#6ff3ff', accent: '#e8ffff', glow: '#6ff3ff', swatch: '#3fa7d6', hint: 'Find the Lumen Leviathan' },
    moonveil: { name: 'Moonveil Pearl', body: '#e6eeff', belly: '#ffffff', fin: '#b6c8ff', accent: '#ffd6a0', glow: '#cfe0ff', swatch: '#dfe9ff', hint: 'Find the Moonveil Koi' }
  }
};
