/* ============================================================
   TRIANGLE BREAKOUT - central configuration
   Every balance / geometry / economy number lives here so the
   game can be re-tuned without touching logic.
   ============================================================ */
(function () {
  'use strict';
  const TB = (window.TB = window.TB || {});

  TB.CONFIG = {
    save: { key: 'triangleBreakout.save', version: 1, autosaveSeconds: 5 },

    // Hexagonal world made of equilateral triangles.
    // rings  : hexagon side length measured in triangles (6 * rings^2 triangles)
    // side   : triangle edge length in world units
    // pocketRings : size of the empty starting pocket at the centre
    world: { rings: 24, side: 28, pocketRings: 2, baseSeed: 20260607, drawInset: 1.3 },

    physics: {
      step: 1 / 120,          // fixed simulation step (seconds)
      maxFrame: 0.1,          // max real time consumed per rendered frame (no catch-up spirals / offline gains)
      ballRadius: 5,
      substepFraction: 0.7,   // a substep never moves a ball further than radius * this
      maxSubsteps: 12,
      stuckSeconds: 4,        // no hit for this long -> tiny deterministic nudge
      trailLength: 10
    },

    balls: { baseSpeed: 200, minSpeed: 110, maxSpeed: 700, baseMax: 6, globalCap: 40 },

    // Triangle durability tiers
    tiers: [
      { id: 'light',   name: 'Light',   hp: 3,  credits: 3,  score: 12,  hue: 190 },
      { id: 'normal',  name: 'Normal',  hp: 8,  credits: 8,  score: 30,  hue: 218 },
      { id: 'heavy',   name: 'Heavy',   hp: 20, credits: 20, score: 90,  hue: 272 },
      { id: 'extreme', name: 'Extreme', hp: 50, credits: 50, score: 260, hue: 322 }
    ],

    // Tier weights as a function of normalised distance from the centre (0..1).
    // Further out -> tougher on average.
    tierWeights: function (t) {
      return [
        Math.pow(1 - t, 2.2) + 0.04,
        Math.max(0.08, 0.9 * (1 - Math.abs(t - 0.38) / 0.7)),
        0.9 * Math.pow(t, 1.3) + 0.02,
        1.1 * Math.pow(t, 3)
      ];
    },

    economy: {
      hitCredit: 1,            // credits per valid collision
      hitScorePerDamage: 2     // score per point of damage dealt
    },

    crit: { base: 0.05, perLevel: 0.02, max: 0.5, multiplier: 2 },

    explosion: {
      baseChance: 0.04, chancePerLevel: 0.016, maxChance: 0.4,
      baseRadius: 52, radiusPerLevel: 7, maxRadius: 150,
      damageFromBall: 0.6, damagePerLevel: 1.5,
      maxQueue: 64
    },

    magnet: { creditBonusPerLevel: 0.35 },

    prestige: {
      improvedCoreDamage: 1,        // +damage per level
      velocityMemorySpeed: 0.06,    // +speed multiplier per level
      startingCapital: 40,          // credits per level
      efficientMining: 0.10,        // +credit income per level
      extraCapacityBalls: 2,        // +max balls per level
      volatileDamage: 0.20,         // +explosion damage per level
      volatileRadius: 0.06          // +explosion radius per level
    },

    escape: {
      minCores: 3,
      // Escape Core reward for a successful escape
      reward: function (info) {
        const v = 3 + info.destroyedPct / 25 + Math.log10(info.score + 10) + info.run * 0.4;
        return Math.max(TB.CONFIG.escape.minCores, Math.floor(v));
      }
    },

    fx: { maxShake: 7 }
  };
})();
