/* ============================================================
   FX - pooled particles, rings, floating text and magnet coins.
   One fixed pool, never grows. Quality setting scales spawn
   counts and the live-particle cap.
   ============================================================ */
(function () {
  'use strict';
  const TB = (window.TB = window.TB || {});

  const MAX = 800;
  const KIND = { SPARK: 0, RING: 1, COIN: 2, TEXT: 3 };
  const pool = [];
  for (let i = 0; i < MAX; i++) {
    pool.push({ on: false, kind: 0, x: 0, y: 0, vx: 0, vy: 0, life: 0, max: 1, size: 1, hue: 0, r: 0, text: '', color: '#fff' });
  }
  let cursor = 0, live = 0, texts = 0;
  const CAPS = [0, 160, 380, MAX];
  const MULT = [0, 0.35, 0.7, 1];

  const Fx = {
    KIND, pool,
    quality: 3,          // 0 off, 1 low, 2 medium, 3 high
    reduced: false,      // reduced visual effects
    target: { x: 0, y: 0, on: false },   // world-space point coins fly toward

    setQuality(q) { this.quality = q; if (q === 0) this.clear(); },

    _q() { return this.reduced ? Math.min(this.quality, 1) : this.quality; },

    _alloc() {
      if (live >= CAPS[this._q()]) return null;
      for (let i = 0; i < MAX; i++) {
        const p = pool[cursor];
        cursor = (cursor + 1) % MAX;
        if (!p.on) { p.on = true; live++; return p; }
      }
      return null;
    },

    sparks(x, y, hue, count, speed, life) {
      count = Math.round(count * MULT[this._q()]);
      for (let i = 0; i < count; i++) {
        const p = this._alloc(); if (!p) return;
        const a = Math.random() * 6.2832, v = speed * (0.35 + Math.random() * 0.8);
        p.kind = KIND.SPARK; p.x = x; p.y = y; p.vx = Math.cos(a) * v; p.vy = Math.sin(a) * v;
        p.life = p.max = life * (0.6 + Math.random() * 0.6); p.size = 1 + Math.random() * 1.4; p.hue = hue;
      }
    },

    ring(x, y, radius, hue, life) {
      if (this._q() === 0) return;
      const p = this._alloc(); if (!p) return;
      p.kind = KIND.RING; p.x = x; p.y = y; p.r = radius; p.life = p.max = life; p.hue = hue; p.vx = p.vy = 0;
    },

    text(x, y, str, color, size) {
      if (this._q() === 0 || texts >= 40) return;
      const p = this._alloc(); if (!p) return;
      texts++;
      p.kind = KIND.TEXT; p.x = x + (Math.random() - 0.5) * 8; p.y = y; p.vx = 0; p.vy = -26;
      p.text = str; p.color = color; p.size = size; p.life = p.max = 0.9;
    },

    coin(x, y) {
      if (this._q() < 2 || !this.target.on) return;
      const p = this._alloc(); if (!p) return;
      const a = Math.random() * 6.2832;
      p.kind = KIND.COIN; p.x = x; p.y = y; p.vx = Math.cos(a) * 60; p.vy = Math.sin(a) * 60;
      p.life = p.max = 1.6; p.size = 2;
    },

    update(dt) {
      if (live === 0) return;
      const drag = Math.pow(0.04, dt), tg = this.target;
      for (let i = 0; i < MAX; i++) {
        const p = pool[i];
        if (!p.on) continue;
        p.life -= dt;
        let dead = p.life <= 0;
        switch (p.kind) {
          case KIND.SPARK:
            p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= drag; p.vy *= drag;
            break;
          case KIND.TEXT:
            p.y += p.vy * dt; p.vy *= Math.pow(0.3, dt);
            break;
          case KIND.COIN: {
            const age = p.max - p.life;
            if (age < 0.18) { p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= drag; p.vy *= drag; break; }
            const dx = tg.x - p.x, dy = tg.y - p.y, d = Math.hypot(dx, dy) || 1;
            const sp = 380 + (age - 0.18) * 1800;
            p.x += (dx / d) * sp * dt; p.y += (dy / d) * sp * dt;
            if (d < 14) dead = true;
            break;
          }
          default: break;
        }
        if (dead) {
          p.on = false; live--;
          if (p.kind === KIND.TEXT) texts--;
        }
      }
    },

    clear() {
      for (let i = 0; i < MAX; i++) pool[i].on = false;
      live = 0; texts = 0;
    }
  };

  TB.Fx = Fx;
})();
