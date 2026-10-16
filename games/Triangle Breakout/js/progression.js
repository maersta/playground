/* ============================================================
   PROGRESSION
   Run lifecycle, milestones, escape detection handling and
   prestige. Run-scoped milestones reset with each prestige;
   lifetime milestones are permanent and pay Escape Cores.
   ============================================================ */
(function () {
  'use strict';
  const TB = (window.TB = window.TB || {});
  const C = TB.CONFIG;
  const fmt = (n) => TB.util.fmt(n);

  const METRICS = {
    runDestroyed: (g) => g.run.stats.destroyed,
    runDamage: (g) => g.run.stats.damage,
    worldPct: (g) => g.world.destroyedPercent(),
    extraBalls: (g) => g.run.upgrades.extraBall | 0,
    explosions: (g) => g.run.stats.explosions,
    lifeDestroyed: (g) => g.meta.life.destroyed,
    lifeEscapes: (g) => g.meta.life.escapes,
    prestiges: (g) => g.meta.prestigeCount
  };

  const R = (id, name, metric, target, credits, unit) => ({ id, scope: 'run', name, metric, target, reward: { credits }, unit: unit || '' });
  const L = (id, name, metric, target, cores) => ({ id, scope: 'life', name, metric, target, reward: { cores }, unit: '' });

  const MILESTONES = [
    R('d10', 'Destroy 10 triangles', 'runDestroyed', 10, 30),
    R('d100', 'Destroy 100 triangles', 'runDestroyed', 100, 200),
    R('d500', 'Destroy 500 triangles', 'runDestroyed', 500, 900),
    R('d1000', 'Destroy 1,000 triangles', 'runDestroyed', 1000, 3500),
    R('d2000', 'Destroy 2,000 triangles', 'runDestroyed', 2000, 10000),
    R('d3000', 'Destroy 3,000 triangles', 'runDestroyed', 3000, 25000),
    R('dmg1k', 'Deal 1,000 total damage', 'runDamage', 1000, 150),
    R('dmg10k', 'Deal 10,000 total damage', 'runDamage', 10000, 1500),
    R('dmg100k', 'Deal 100,000 total damage', 'runDamage', 100000, 15000),
    R('ball1', 'Buy your first Extra Ball', 'extraBalls', 1, 100),
    R('boom1', 'Trigger your first explosion', 'explosions', 1, 150),
    R('pct25', 'Destroy 25% of the world', 'worldPct', 25, 800, '%'),
    R('pct50', 'Destroy 50% of the world', 'worldPct', 50, 3000, '%'),
    R('pct75', 'Destroy 75% of the world', 'worldPct', 75, 12000, '%'),
    R('pct90', 'Destroy 90% of the world', 'worldPct', 90, 30000, '%'),
    L('escape1', 'Escape the world', 'lifeEscapes', 1, 2),
    L('prestige1', 'Perform your first prestige', 'prestiges', 1, 1),
    L('life10k', 'Destroy 10,000 triangles (lifetime)', 'lifeDestroyed', 10000, 1),
    L('life50k', 'Destroy 50,000 triangles (lifetime)', 'lifeDestroyed', 50000, 3),
    L('escape5', 'Escape 5 times', 'lifeEscapes', 5, 3)
  ];

  const Progression = {
    milestones: MILESTONES,
    busy: false,

    store(m) { return m.scope === 'run' ? TB.game.run.milestones : TB.game.meta.lifeMilestones; },
    claimed(m) { return !!this.store(m)[m.id]; },
    progress(m) {
      const cur = METRICS[m.metric](TB.game);
      return { cur: Math.min(cur, m.target), target: m.target, ratio: Math.min(1, cur / m.target) };
    },

    // Evaluate every unclaimed milestone. Claim flag is set BEFORE the reward is paid,
    // so same-frame triggers or reloads can never double-pay.
    check() {
      const g = TB.game;
      if (!g.run || !g.world) return;
      for (const m of MILESTONES) {
        const st = this.store(m);
        if (st[m.id]) continue;
        if (METRICS[m.metric](g) < m.target) continue;
        st[m.id] = true;
        let rewardText;
        if (m.reward.credits) { g.run.credits += m.reward.credits; rewardText = '+' + fmt(m.reward.credits) + ' credits'; }
        else { g.meta.cores += m.reward.cores; rewardText = '+' + m.reward.cores + ' Escape Core' + (m.reward.cores > 1 ? 's' : ''); }
        TB.UI.toast({ kind: 'milestone', title: 'Milestone', text: m.name, reward: rewardText });
        TB.Audio.play('milestone');
        g.hudDirty = true;
        g.saveNow();
      }
    },

    // Build a brand new run (world, balls, stats) without touching permanent progress.
    newRun(number, seed) {
      const g = TB.game;
      g.run = {
        number, seed: seed >>> 0,
        score: 0, credits: 0,
        upgrades: {}, milestones: {},
        stats: { collisions: 0, damage: 0, destroyed: 0, explosions: 0, upgradesBought: 0, time: 0 },
        escape: null
      };
      g.run.credits = TB.Stats.startCredits();
      g.world = new TB.World(C.world, seed);
      g.balls = [];
      g.flashList.length = 0;
      g.ballSeq = 0;
      g.mode = 'play';
      g.escapeBall = null;
      TB.Economy.clearQueue();
      TB.Fx.clear();
      g.addBall(true);
      g.hudDirty = true;
    },

    newSeed(number) {
      return ((Date.now() ^ Math.imul(number + 1, 2654435761)) >>> 0) || 1;
    },

    // A ball's circle has fully crossed the world boundary.
    onEscape(ball) {
      const g = TB.game, run = g.run;
      if (run.escape || g.mode !== 'play') return;     // exactly once
      g.meta.life.escapes++;
      const reward = C.escape.reward({ score: run.score, destroyedPct: g.world.destroyedPercent(), run: run.number });
      run.escape = { reward, claimed: false };
      g.mode = 'escaping';
      g.escapeTimer = 0;
      g.escapeBall = ball;
      g.escapeX = ball.x; g.escapeY = ball.y;
      const a = Math.atan2(ball.y, ball.x), R = g.world.radius;
      for (let i = 0; i < 4; i++) TB.Fx.ring(ball.x, ball.y, 80 + i * 60, 48, 0.9 + i * 0.25);
      TB.Fx.sparks(ball.x, ball.y, 48, 60, 260, 1.1);
      TB.Renderer.shake(1);
      TB.Audio.play('escape');
      this.check();
      g.saveNow();
    },

    // Convert a completed escape into permanent Escape Cores and start a stronger run.
    prestige() {
      const g = TB.game, run = g.run;
      if (this.busy || !run || !run.escape || run.escape.claimed) return false;
      this.busy = true;
      try {
        run.escape.claimed = true;
        g.meta.cores += run.escape.reward;
        g.meta.prestigeCount++;
        this.newRun(run.number + 1, this.newSeed(run.number + 1));
        this.check();
        TB.Audio.play('prestige');
        TB.UI.hideVictory();
        TB.UI.toast({ kind: 'prestige', title: 'Prestige', text: 'Run ' + g.run.number + ' begins', reward: 'Permanent bonuses kept' });
        g.saveNow();
      } finally { this.busy = false; }
      return true;
    },

    // Summary stats for the victory overlay
    summary() {
      const g = TB.game, r = g.run;
      return [
        ['Total score', fmt(r.score)],
        ['Triangles destroyed', fmt(g.world.destroyedCount) + ' / ' + fmt(g.world.total)],
        ['World destroyed', TB.util.fmtDec(g.world.destroyedPercent(), 1) + '%'],
        ['Total collisions', fmt(r.stats.collisions)],
        ['Total damage', fmt(r.stats.damage)],
        ['Active balls', String(g.balls.length)],
        ['Upgrades purchased', fmt(r.stats.upgradesBought)],
        ['Run duration', TB.util.fmtTime(r.stats.time)]
      ];
    }
  };

  TB.Progression = Progression;
})();
