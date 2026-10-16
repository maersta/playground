/* =========================================================
   effects.js - Camera, pooled Particles and floating texts
   ========================================================= */
'use strict';

/* ---------------- Camera ---------------- */
class Camera {
  constructor() {
    this.x = 0; this.y = 0;
    this.shakeAmt = 0; this.shakeX = 0; this.shakeY = 0;
    this.zoomKick = 0;
  }
  /** Smoothly follow a target point. Higher rate = snappier. */
  follow(tx, ty, dt, rateX = 10, rateY = 5) {
    this.x = lerp(this.x, tx, 1 - Math.exp(-rateX * dt));
    this.y = lerp(this.y, ty, 1 - Math.exp(-rateY * dt));
  }
  snap(tx, ty) { this.x = tx; this.y = ty; }
  shake(amount) { this.shakeAmt = Math.min(10, Math.max(this.shakeAmt, amount)); }
  update(dt) {
    if (this.shakeAmt > 0.05) {
      this.shakeX = (Math.random() * 2 - 1) * this.shakeAmt;
      this.shakeY = (Math.random() * 2 - 1) * this.shakeAmt;
      this.shakeAmt *= Math.exp(-12 * dt);
    } else { this.shakeAmt = 0; this.shakeX = 0; this.shakeY = 0; }
  }
  /** Integer camera position for crisp pixel rendering. */
  get rx() { return Math.round(this.x + this.shakeX); }
  get ry() { return Math.round(this.y + this.shakeY); }
}

/* ---------------- Particles (object pool) ---------------- */
class ParticleSystem {
  constructor(max = 500) {
    this.pool = [];
    for (let i = 0; i < max; i++) this.pool.push({ alive: false });
    this.cursor = 0;
  }
  /** Grab a dead particle (or recycle the oldest slot). */
  spawn(x, y, vx, vy, life, color, size = 1, grav = 300, drag = 1, shape = 'square') {
    let p = null;
    for (let i = 0; i < this.pool.length; i++) {
      const idx = (this.cursor + i) % this.pool.length;
      if (!this.pool[idx].alive) { p = this.pool[idx]; this.cursor = idx + 1; break; }
    }
    if (!p) { p = this.pool[this.cursor % this.pool.length]; this.cursor++; }
    p.alive = true; p.x = x; p.y = y; p.vx = vx; p.vy = vy;
    p.life = life; p.max = life; p.color = color; p.size = size; p.grav = grav; p.drag = drag; p.shape = shape;
    return p;
  }
  burst(x, y, n, colors, speed = 80, life = 0.5, size = 1, grav = 300, spread = Math.PI * 2, dir = -Math.PI / 2) {
    for (let i = 0; i < n; i++) {
      const a = dir + (Math.random() - 0.5) * spread;
      const s = speed * (0.4 + Math.random() * 0.8);
      this.spawn(x, y, Math.cos(a) * s, Math.sin(a) * s, life * (0.6 + Math.random() * 0.6),
        Array.isArray(colors) ? pick(colors) : colors, size + (Math.random() < 0.3 ? 1 : 0), grav);
    }
  }
  dust(x, y, strength, colors) {
    const n = Math.min(14, 3 + Math.floor(strength * 12));
    for (let i = 0; i < n; i++) {
      const side = i % 2 ? 1 : -1;
      this.spawn(x + rand(-3, 3), y - 1, side * rand(15, 60) * (0.5 + strength), -rand(5, 40) * (0.5 + strength),
        rand(0.3, 0.7), pick(colors), Math.random() < 0.4 ? 2 : 1, 60, 3);
    }
  }
  stars(x, y, n = 6) {
    this.burst(x, y, n, [PAL.white, PAL.gold, PAL.yellow], 120, 0.45, 1, 120);
  }
  update(dt) {
    for (const p of this.pool) {
      if (!p.alive) continue;
      p.life -= dt;
      if (p.life <= 0) { p.alive = false; continue; }
      p.vy += p.grav * dt;
      const d = Math.exp(-p.drag * dt);
      p.vx *= d; p.vy *= d;
      p.x += p.vx * dt; p.y += p.vy * dt;
    }
  }
  draw(ctx, cx, cy) {
    for (const p of this.pool) {
      if (!p.alive) continue;
      const t = p.life / p.max;
      const s = p.size + (p.shape === 'grow' ? Math.floor((1 - t) * 3) : 0);
      if (p.shape === 'smoke' && t < 0.5 && ((p.x | 0) + (p.y | 0)) % 2) continue; // dithered fade
      ctx.fillStyle = p.color;
      ctx.fillRect(Math.round(p.x - cx - s / 2), Math.round(p.y - cy - s / 2), s, s);
    }
  }
  clear() { for (const p of this.pool) p.alive = false; }
}

/* ---------------- Floating score texts (pooled) ---------------- */
class FloatingTexts {
  constructor(max = 40) {
    this.pool = [];
    for (let i = 0; i < max; i++) this.pool.push({ alive: false });
  }
  add(x, y, text, color = PAL.white, scale = 1, life = 1.0) {
    let t = this.pool.find(p => !p.alive);
    if (!t) t = this.pool.reduce((a, b) => (a.life < b.life ? a : b));
    t.alive = true; t.x = x; t.y = y; t.text = text; t.color = color; t.scale = scale;
    t.life = life; t.max = life; t.vy = -40;
  }
  update(dt) {
    for (const t of this.pool) {
      if (!t.alive) continue;
      t.life -= dt;
      t.y += t.vy * dt;
      t.vy *= Math.exp(-3 * dt);
      if (t.life <= 0) t.alive = false;
    }
  }
  draw(ctx, cx, cy) {
    for (const t of this.pool) {
      if (!t.alive) continue;
      const age = t.max - t.life;
      // pop-in: scale up briefly, blink before vanishing
      const sc = age < 0.08 ? t.scale + 1 : t.scale;
      if (t.life < 0.25 && Math.floor(t.life * 20) % 2) continue;
      PixelFont.draw(ctx, t.text, t.x - cx, t.y - cy, sc, t.color, PAL.ink, 'center');
    }
  }
  clear() { for (const t of this.pool) t.alive = false; }
}
