/* ============================================================
   UPGRADES + derived stats
   All run-upgrade and prestige-upgrade definitions live here.
   cost(level) = ceil(baseCost * growth ^ level)
   ============================================================ */
(function () {
  'use strict';
  const TB = (window.TB = window.TB || {});
  const C = TB.CONFIG;
  const U = TB.util;

  const lvl = (id) => (TB.game.run.upgrades[id] | 0);
  const pl = (id) => (TB.game.meta.prestigeUpgrades[id] | 0);

  // ---------- derived stats (the single source of truth for gameplay values) ----------
  const Stats = {
    damage(l) { return 1 + (l == null ? lvl('damage') : l) + pl('improvedCore') * C.prestige.improvedCoreDamage; },
    speedMult(l) { return 1 + (l == null ? lvl('speed') : l) * 0.08 + pl('velocityMemory') * C.prestige.velocityMemorySpeed; },
    speed(l) { return U.clamp(C.balls.baseSpeed * Stats.speedMult(l), C.balls.minSpeed, C.balls.maxSpeed); },
    maxBalls() { return Math.min(C.balls.globalCap, C.balls.baseMax + pl('extraCapacity') * C.prestige.extraCapacityBalls); },
    critChance(l) { return Math.min(C.crit.max, C.crit.base + (l == null ? lvl('crit') : l) * C.crit.perLevel); },
    critMult() { return C.crit.multiplier; },
    incomeMult() { return 1 + pl('efficientMining') * C.prestige.efficientMining; },
    hitCredit(l) { return C.economy.hitCredit * (1 + (l == null ? lvl('magnet') : l) * C.magnet.creditBonusPerLevel) * Stats.incomeMult(); },
    startCredits() { return pl('startingCapital') * C.prestige.startingCapital; },
    explosion(l) {
      l = l == null ? lvl('explosive') : l;
      if (l <= 0) return { chance: 0, radius: 0, damage: 0 };
      const E = C.explosion, vol = pl('volatileCore');
      return {
        chance: Math.min(E.maxChance, E.baseChance + E.chancePerLevel * l),
        radius: Math.min(E.maxRadius, E.baseRadius + E.radiusPerLevel * l) * (1 + vol * C.prestige.volatileRadius),
        damage: Math.max(1, Math.ceil((Stats.damage() * E.damageFromBall + E.damagePerLevel * l) * (1 + vol * C.prestige.volatileDamage)))
      };
    }
  };

  const pct = (v) => U.fmtDec(v * 100, 1) + '%';

  // ---------- run upgrades (spent with credits) ----------
  const RUN = [
    {
      id: 'damage', name: 'Ball Damage', icon: '✦', baseCost: 10, growth: 1.4, max: 80,
      desc: 'Every collision deals +1 damage.',
      effect: (l) => Stats.damage(l) + ' damage per hit'
    },
    {
      id: 'speed', name: 'Ball Speed', icon: '»', baseCost: 25, growth: 1.33, max: 30,
      desc: 'All balls move about 8% faster per level.',
      effect: (l) => '×' + U.fmtDec(Stats.speedMult(l), 2) + ' speed'
    },
    {
      id: 'extraBall', name: 'Extra Ball', icon: '●', baseCost: 60, growth: 2.0,
      max: () => Math.max(0, Stats.maxBalls() - 1),
      desc: 'Adds another permanent ball for this run.',
      effect: (l) => (1 + l) + ' ball' + (l ? 's' : '') + ' (cap ' + Stats.maxBalls() + ')'
    },
    {
      id: 'crit', name: 'Critical Chance', icon: '★', baseCost: 30, growth: 1.5, max: 22,
      desc: '+2% chance for hits to deal double damage.',
      effect: (l) => pct(Stats.critChance(l)) + ' crit ×' + Stats.critMult()
    },
    {
      id: 'explosive', name: 'Explosive Impact', icon: '✹', baseCost: 120, growth: 1.6, max: 20,
      desc: 'Hits can detonate, damaging every nearby triangle. Never chains.',
      effect: (l) => {
        if (l <= 0) return 'Locked';
        const e = Stats.explosion(l);
        return pct(e.chance) + ' • r' + Math.round(e.radius) + ' • ' + e.damage + ' dmg';
      }
    },
    {
      id: 'magnet', name: 'Credit Magnet', icon: '◆', baseCost: 20, growth: 1.45, max: 25,
      desc: 'Collisions award +35% more credits per level.',
      effect: (l) => U.fmtDec(Stats.hitCredit(l), 2) + ' credits per hit'
    }
  ];

  // ---------- permanent upgrades (spent with Escape Cores) ----------
  const PRESTIGE = [
    {
      id: 'improvedCore', name: 'Improved Core', icon: '✦', baseCost: 1, growth: 1.8, max: 20,
      desc: 'Permanent +1 base damage in every future run.',
      effect: (l) => '+' + l * C.prestige.improvedCoreDamage + ' base damage'
    },
    {
      id: 'velocityMemory', name: 'Velocity Memory', icon: '»', baseCost: 1, growth: 1.9, max: 15,
      desc: 'Balls start every run faster.',
      effect: (l) => '+' + Math.round(l * C.prestige.velocityMemorySpeed * 100) + '% starting speed'
    },
    {
      id: 'startingCapital', name: 'Starting Capital', icon: '◆', baseCost: 1, growth: 1.7, max: 30,
      desc: 'Begin each run with bonus credits.',
      effect: (l) => '+' + l * C.prestige.startingCapital + ' starting credits'
    },
    {
      id: 'efficientMining', name: 'Efficient Mining', icon: '⚒', baseCost: 2, growth: 2.0, max: 15,
      desc: 'Increases all credit income.',
      effect: (l) => '+' + Math.round(l * C.prestige.efficientMining * 100) + '% credit income'
    },
    {
      id: 'extraCapacity', name: 'Extra Capacity', icon: '●', baseCost: 3, growth: 2.4, max: 10,
      desc: 'Raises the maximum number of balls (safety capped).',
      effect: (l) => '+' + l * C.prestige.extraCapacityBalls + ' max balls'
    },
    {
      id: 'volatileCore', name: 'Volatile Core', icon: '✹', baseCost: 3, growth: 2.0, max: 12,
      desc: 'Explosions hit harder and reach further.',
      effect: (l) => '+' + Math.round(l * C.prestige.volatileDamage * 100) + '% blast dmg, +' + Math.round(l * C.prestige.volatileRadius * 100) + '% radius'
    }
  ];

  const Upgrades = {
    run: RUN,
    prestige: PRESTIGE,

    find(kind, id) { return (kind === 'prestige' ? PRESTIGE : RUN).find((d) => d.id === id); },
    store(kind) { return kind === 'prestige' ? TB.game.meta.prestigeUpgrades : TB.game.run.upgrades; },
    currency(kind) { return kind === 'prestige' ? TB.game.meta.cores : TB.game.run.credits; },
    level(kind, def) { return this.store(kind)[def.id] | 0; },
    maxLevel(def) { return typeof def.max === 'function' ? def.max() : def.max; },
    cost(def, level) { return Math.ceil(def.baseCost * Math.pow(def.growth, level)); },

    // How many levels can be bought right now (limited by caps and currency)
    affordable(kind, def) {
      let level = this.level(kind, def), money = this.currency(kind), max = this.maxLevel(def), n = 0;
      while (level < max) {
        const c = this.cost(def, level);
        if (money < c) break;
        money -= c; level++; n++;
      }
      return n;
    },

    // Buy `count` levels (or 'max'); returns number actually bought.
    buy(kind, id, count) {
      const def = this.find(kind, id);
      if (!def) return 0;
      const g = TB.game, st = this.store(kind);
      const want = count === 'max' ? this.affordable(kind, def) : count;
      let bought = 0;
      for (let i = 0; i < want; i++) {
        const level = st[def.id] | 0;
        if (level >= this.maxLevel(def)) break;
        const c = this.cost(def, level);
        if (kind === 'prestige') { if (g.meta.cores < c) break; g.meta.cores -= c; }
        else { if (g.run.credits < c) break; g.run.credits -= c; }
        st[def.id] = level + 1;
        bought++;
        if (kind === 'run') this._applyRun(def.id);
      }
      if (bought > 0) {
        if (kind === 'run') g.run.stats.upgradesBought += bought;
        if (def.id === 'speed' || def.id === 'velocityMemory') g.rescaleBalls();
        TB.Audio.play('buy');
        g.saveNow();
        TB.Progression.check();
      }
      return bought;
    },

    _applyRun(id) {
      if (id === 'extraBall') TB.game.addBall();
    }
  };

  TB.Stats = Stats;
  TB.Upgrades = Upgrades;
})();
