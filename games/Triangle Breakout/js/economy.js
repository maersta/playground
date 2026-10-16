/* ============================================================
   ECONOMY / COMBAT RESOLUTION
   Turns physics hits into damage, score, credits, destruction,
   crits and explosions. Explosions go through a queue that is
   drained once per tick; they never queue further explosions, so
   chain recursion is impossible.
   ============================================================ */
(function () {
  'use strict';
  const TB = (window.TB = window.TB || {});
  const C = TB.CONFIG;

  const queue = [];
  const nearby = [];
  const hpLevel = (t) => { const f = t.hp / t.maxHp; return f > 0.75 ? 3 : f > 0.5 ? 2 : f > 0.25 ? 1 : 0; };

  const Economy = {
    // Called by physics for every valid collision.
    onHit(ball, tri, px, py) {
      const g = TB.game, run = g.run, life = g.meta.life, S = TB.Stats, Fx = TB.Fx;
      if (!tri.active) return;
      ball.idle = 0;

      let dmg = S.damage();
      let crit = false;
      if (Math.random() < S.critChance()) { crit = true; dmg = Math.ceil(dmg * S.critMult()); }

      run.stats.collisions++; life.collisions++;
      run.credits += S.hitCredit();

      const hue = C.tiers[tri.tier].hue;
      const applied = this.damageTriangle(tri, dmg, px, py);

      Fx.sparks(px, py, crit ? 48 : hue, crit ? 12 : 5, crit ? 150 : 95, 0.4);
      if (crit) {
        Fx.ring(px, py, 26, 48, 0.4);
        Fx.text(px, py - 6, dmg + '!', '#ffd34a', 17);
        TB.Audio.play('crit');
      } else {
        if (Fx.quality >= 3 && Math.random() < 0.35) Fx.text(px, py - 4, String(applied), 'rgba(220,240,255,0.85)', 11);
        TB.Audio.play('hit', tri.tier);
      }
      // Credit Magnet visual: gold coins fly toward the credits counter
      if (run.upgrades.magnet > 0 && Math.random() < 0.5) Fx.coin(px, py);

      // explosion roll (only when the explosive upgrade is owned)
      const ex = S.explosion();
      if (ex.chance > 0 && queue.length < C.explosion.maxQueue && Math.random() < ex.chance) {
        queue.push({ x: px, y: py, radius: ex.radius, damage: ex.damage });
      }
      g.hudDirty = true;
    },

    // Apply damage; handles destruction exactly once. Returns damage actually applied.
    damageTriangle(tri, dmg, x, y) {
      if (!tri.active) return 0;
      const g = TB.game, run = g.run, life = g.meta.life;
      const applied = Math.min(dmg, tri.hp);
      const lvBefore = hpLevel(tri);
      tri.hp -= dmg;
      if (tri.hp > 0 && hpLevel(tri) !== lvBefore) g.worldDirty = true;   // colour bucket changed -> redraw cached layer
      run.stats.damage += applied; life.damage += applied;
      run.score += applied * C.economy.hitScorePerDamage; life.score += applied * C.economy.hitScorePerDamage;
      if (tri.flash <= 0) g.flashList.push(tri);
      tri.flash = 1;
      if (tri.hp <= 0) this.destroyTriangle(tri, x, y);
      return applied;
    },

    destroyTriangle(tri, x, y) {
      const g = TB.game, run = g.run, life = g.meta.life, Fx = TB.Fx;
      if (!g.world.destroy(tri)) return;            // already destroyed -> no double reward
      g.worldDirty = true;
      const tier = C.tiers[tri.tier];
      const bonus = tier.credits * TB.Stats.incomeMult();
      run.credits += bonus;
      run.score += tier.score; life.score += tier.score;
      run.stats.destroyed++; life.destroyed++;
      Fx.sparks(tri.cx, tri.cy, tier.hue, 9, 120, 0.55);
      Fx.text(tri.cx, tri.cy, '+' + TB.util.fmt(bonus), '#ffc94a', 12);
      TB.Audio.play('destroy');
      g.hudDirty = true;
      g.milestoneDirty = true;
      g.saveDirty = true;
    },

    // Drain queued explosions (called once per physics tick).
    processExplosions() {
      if (!queue.length) return;
      const g = TB.game, Fx = TB.Fx, run = g.run;
      for (let q = 0; q < queue.length; q++) {
        const e = queue[q];
        run.stats.explosions++;
        g.world.queryCircle(e.x, e.y, e.radius + g.world.side, nearby);
        for (let i = 0; i < nearby.length; i++) {
          const t = nearby[i];
          if (!t.active) continue;
          if (Math.hypot(t.cx - e.x, t.cy - e.y) <= e.radius) this.damageTriangle(t, e.damage, t.cx, t.cy);
        }
        Fx.ring(e.x, e.y, e.radius, 30, 0.5);
        Fx.ring(e.x, e.y, e.radius * 0.6, 48, 0.35);
        Fx.sparks(e.x, e.y, 30, 16, 190, 0.6);
        TB.Renderer.shake(Math.min(1, e.radius / 120));
        TB.Audio.play('explosion');
      }
      queue.length = 0;
      g.hudDirty = true;
    },

    clearQueue() { queue.length = 0; }
  };

  TB.Economy = Economy;
})();
