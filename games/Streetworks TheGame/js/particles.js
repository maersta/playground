// ============================================================================
// PARTICLES
// Lightweight pooled particle system for paint flecks and dust. Everything
// lives in world space; caller decides when/where to spawn.
// ============================================================================

const MAX_PARTICLES = 260;

export class ParticleSystem {
  constructor() {
    this.pool = new Array(MAX_PARTICLES).fill(null).map(() => ({ active: false }));
  }

  _spawn(x, y, vx, vy, life, size, color, kind) {
    for (const p of this.pool) {
      if (!p.active) {
        p.active = true;
        p.x = x; p.y = y; p.vx = vx; p.vy = vy;
        p.life = life; p.maxLife = life; p.size = size; p.color = color; p.kind = kind;
        return;
      }
    }
  }

  spawnPaintFleck(x, y, color) {
    const n = 1 + Math.floor(Math.random() * 2);
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const speed = 12 + Math.random() * 30;
      this._spawn(x, y, Math.cos(a) * speed, Math.sin(a) * speed, 0.35 + Math.random() * 0.25, 1.2 + Math.random() * 1.8, color, 'paint');
    }
  }

  spawnDust(x, y) {
    if (Math.random() > 0.35) return;
    const a = Math.random() * Math.PI * 2;
    this._spawn(x, y, Math.cos(a) * 8, Math.sin(a) * 8, 0.4, 2 + Math.random() * 2, 'rgba(180,170,150,0.5)', 'dust');
  }

  update(dt) {
    for (const p of this.pool) {
      if (!p.active) continue;
      p.life -= dt;
      if (p.life <= 0) { p.active = false; continue; }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 0.9;
      p.vy *= 0.9;
    }
  }

  draw(ctx) {
    for (const p of this.pool) {
      if (!p.active) continue;
      const t = p.life / p.maxLife;
      ctx.save();
      ctx.globalAlpha = Math.max(0, t);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }
}
