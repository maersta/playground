/* =========================================================
   obstacles.js - Obstacle types (data-driven) and Coins.
   Each obstacle type defines its collision shape plus hit/update/draw.
   ========================================================= */
'use strict';

/** Push the pug out of a solid surface and reflect its velocity.
 *  n = contact normal pointing from obstacle to pug, pen = penetration depth,
 *  e = restitution (bounciness), fric = tangential friction on impact. */
function solidResolve(pug, nx, ny, pen, e, fric = 0.12) {
  pug.x += nx * pen; pug.y += ny * pen;
  const vn = pug.vx * nx + pug.vy * ny;
  if (vn < 0) {
    // remove (1+e) of the normal velocity -> bounce with restitution e
    pug.vx -= (1 + e) * vn * nx;
    pug.vy -= (1 + e) * vn * ny;
    // tangential friction
    const tx = -ny, ty = nx;
    const vt = pug.vx * tx + pug.vy * ty;
    pug.vx -= vt * fric * tx; pug.vy -= vt * fric * ty;
  }
  if (ny < -0.6) pug.grounded = true;
  return Math.max(0, -vn);
}

const pugSpeed = pug => Math.hypot(pug.vx, pug.vy);

function breakObstacle(o, pug, game, def) {
  o.alive = false;
  pug.vx *= def.slow; pug.vy *= def.slow;
  game.particles.burst(o.x, o.y, 16, def.colors, 140, 0.8, 2, 400);
  game.particles.burst(o.x, o.y, 6, [PAL.cream, PAL.white], 60, 0.4, 1, 0, Math.PI * 2);
  AudioSystem.breakObj();
  game.camera.shake(2.5);
  game.hitStop(0.03);
  game.onBreak(o, def.score, def.label || 'SMASH!');
}

const OBS = {
  crate: {
    shape: 'box', w: 14, h: 14, breakSpeed: 120, slow: 0.9, score: 30, label: 'CRUNCH!',
    colors: [PAL.ltbrown, PAL.tan, PAL.brown, PAL.dkbrown],
    hit(o, pug, nx, ny, pen, game) {
      if (pugSpeed(pug) > this.breakSpeed) breakObstacle(o, pug, game, this);
      else solidResolve(pug, nx, ny, pen, 0.3);
    },
    draw(o, ctx, cx, cy) { ctx.drawImage(Sprites.crate, Math.round(o.x - 8 - cx), Math.round(o.y - 8 - cy)); }
  },
  barrel: {
    shape: 'box', w: 12, h: 14, breakSpeed: 200, slow: 0.82, score: 40, label: 'KA-THUNK!',
    colors: [PAL.ltbrown, PAL.brown, PAL.dkstone, PAL.tan],
    hit(o, pug, nx, ny, pen, game) {
      if (pugSpeed(pug) > this.breakSpeed) breakObstacle(o, pug, game, this);
      else solidResolve(pug, nx, ny, pen, 0.4);
    },
    draw(o, ctx, cx, cy) { ctx.drawImage(Sprites.barrel, Math.round(o.x - 7 - cx), Math.round(o.y - 8 - cy)); }
  },
  tnt: {
    shape: 'box', w: 12, h: 14,
    hit(o, pug, nx, ny, pen, game) {
      o.alive = false;
      // Explosion launches the pug up and forward
      pug.vx = Math.max(pug.vx, 0) * 0.7 + 280;
      pug.vy = Math.min(pug.vy * 0.3, 0) - 520;
      pug.angVel += rand(-20, 20);
      game.explosion(o.x, o.y);
    },
    update(o, dt) { o.t += dt; },
    draw(o, ctx, cx, cy) {
      ctx.drawImage(Sprites.tnt, Math.round(o.x - 7 - cx), Math.round(o.y - 8 - cy));
      if (Math.floor(o.t * 10) % 2) { ctx.fillStyle = PAL.lava2; ctx.fillRect(Math.round(o.x + 1 - cx), Math.round(o.y - 11 - cy), 1, 1); }
    }
  },
  rock: {
    shape: 'circle', r: 8,
    hit(o, pug, nx, ny, pen, game) {
      const imp = solidResolve(pug, nx, ny, pen, 0.72, 0.05);
      if (imp > 120) {
        AudioSystem.collision();
        game.particles.burst(pug.x - nx * pug.r, pug.y - ny * pug.r, 6, [PAL.stone, PAL.ltstone, PAL.dkstone], 90, 0.5, 1);
        game.camera.shake(Math.min(4, imp / 120));
        pug.angVel += rand(-15, 15);
        if (imp > 260) game.onBounceBonus(o.x, o.y - 12, 'ROCK BOUNCE');
      }
    },
    draw(o, ctx, cx, cy) { ctx.drawImage(Sprites.rock, Math.round(o.x - 10 - cx), Math.round(o.y - 8 - cy)); }
  },
  wall: {
    shape: 'box', w: 10, h: 40, breakSpeed: 480, slow: 0.62, score: 150, label: 'WALL SMASH!',
    colors: [PAL.stone, PAL.ltstone, PAL.dkstone, PAL.grey],
    hit(o, pug, nx, ny, pen, game) {
      if (pugSpeed(pug) > this.breakSpeed && Math.abs(nx) > 0.5) {
        breakObstacle(o, pug, game, this);
        game.camera.shake(6); game.hitStop(0.08);
        return;
      }
      const imp = solidResolve(pug, nx, ny, pen, 0.35, 0.2);
      if (imp > 140) {
        AudioSystem.collision();
        game.camera.shake(Math.min(6, imp / 80));
        game.particles.stars(pug.x - nx * pug.r, pug.y - ny * pug.r, 8);
        pug.react('hurt', 0.6);
        pug.squash(Math.min(0.5, imp / 600), nx, ny);
        game.texts.add(pug.x, pug.y - 20, 'BONK!', PAL.red2, 1);
      }
    },
    draw(o, ctx, cx, cy) {
      const x0 = Math.round(o.x - o.w / 2 - cx), y0 = Math.round(o.y - o.h / 2 - cy);
      ctx.fillStyle = PAL.ink; ctx.fillRect(x0 - 1, y0 - 1, o.w + 2, o.h + 2);
      ctx.fillStyle = PAL.stone; ctx.fillRect(x0, y0, o.w, o.h);
      for (let row = 0; row * 5 < o.h; row++) {
        const y = y0 + row * 5;
        ctx.fillStyle = PAL.ltstone; ctx.fillRect(x0, y, o.w, 1);
        ctx.fillStyle = PAL.dkstone; ctx.fillRect(x0, Math.min(y + 4, y0 + o.h - 1), o.w, 1);
        const off = row % 2 ? 3 : 7;
        ctx.fillRect(x0 + off, y, 1, Math.min(5, y0 + o.h - y));
      }
      ctx.fillStyle = PAL.ltstone; ctx.fillRect(x0, y0, o.w, 2);
    }
  },
  spikes: {
    shape: 'box', w: 16, h: 6,
    hit(o, pug, nx, ny, pen, game) {
      if (pug.invuln > 0) { solidResolve(pug, nx, ny, pen, 0.6); return; }
      pug.y = Math.min(pug.y, o.y - o.h / 2 - pug.r);
      pug.vy = -Math.max(260, Math.abs(pug.vy) * 0.5);
      pug.vx *= 0.7;
      game.damagePug(2, 'SPIKED!', o.x, o.y);
    },
    draw(o, ctx, cx, cy) {
      const n = Math.round(o.w / 8);
      for (let i = 0; i < n; i++) ctx.drawImage(Sprites.spike, Math.round(o.x - o.w / 2 + i * 8 - cx), Math.round(o.y + o.h / 2 - 9 - cy));
    }
  },
  spring: {
    shape: 'box', w: 14, h: 9,
    hit(o, pug, nx, ny, pen, game) {
      if (ny > -0.3 && pug.vy < 50) { solidResolve(pug, nx, ny, pen, 0.4); return; }
      pug.y = o.y - o.h / 2 - pug.r - 1;
      pug.vy = -(640 + Math.min(200, Math.abs(pug.vy) * 0.3));
      pug.vx = Math.max(pug.vx, 160) * 1.06;
      pug.angVel = rand(10, 18);
      pug.react('happy', 0.8);
      pug.squash(0.4, 0, -1);
      o.anim = 0.35;
      AudioSystem.spring();
      game.particles.burst(o.x, o.y - 5, 8, [PAL.white, PAL.red2], 80, 0.4, 1, 100);
      game.onSpecial(o.x, o.y - 18, 'BOING!', 25, PAL.lime);
    },
    update(o, dt) { if (o.anim > 0) o.anim -= dt; },
    draw(o, ctx, cx, cy) {
      ctx.drawImage(Sprites.spring[o.anim > 0 ? 1 : 0], Math.round(o.x - 8 - cx), Math.round(o.y + o.h / 2 - 16 - cy));
    }
  },
  booster: {
    shape: 'box', w: 24, h: 5, sensor: true,
    hit(o, pug, nx, ny, pen, game) {
      if (o.cool > 0) return;
      o.cool = 0.6;
      pug.vx = Math.max(pug.vx, 0) + 300;
      pug.vy = Math.min(pug.vy, 0) - 60;
      AudioSystem.boost();
      game.camera.shake(2);
      game.particles.burst(pug.x, pug.y, 12, [PAL.yellow, PAL.orange, PAL.white], 140, 0.4, 1, 0, 0.8, Math.PI);
      game.onSpecial(o.x, o.y - 16, 'BOOST!', 20, PAL.yellow);
    },
    update(o, dt) { if (o.cool > 0) o.cool -= dt; o.t += dt; },
    draw(o, ctx, cx, cy) {
      const x0 = Math.round(o.x - o.w / 2 - cx), y0 = Math.round(o.y - o.h / 2 - cy);
      ctx.fillStyle = PAL.ink; ctx.fillRect(x0 - 1, y0 - 1, o.w + 2, o.h + 1);
      ctx.fillStyle = PAL.dkstone; ctx.fillRect(x0, y0, o.w, o.h);
      const shift = Math.floor(o.t * 12) % 6;
      for (let i = 0; i < 4; i++) {
        const ax = x0 + 2 + ((i * 6 + shift) % 22);
        ctx.fillStyle = (i + Math.floor(o.t * 6)) % 2 ? PAL.yellow : PAL.orange;
        ctx.fillRect(ax, y0 + 1, 1, 1); ctx.fillRect(ax + 1, y0 + 2, 1, 1); ctx.fillRect(ax, y0 + 3, 1, 1);
      }
    }
  },
  hay: {
    shape: 'box', w: 20, h: 14, sensor: true,
    hit(o, pug, nx, ny, pen, game) {
      o.alive = false;
      // Soft haystack absorbs a lot of energy
      pug.vx *= 0.55; pug.vy *= 0.4;
      game.particles.burst(o.x, o.y, 22, [PAL.yellow, PAL.gold, PAL.sand2], 120, 0.9, 1, 200);
      AudioSystem.noise(0.3, 0.25, 1800, 'bandpass');
      game.texts.add(o.x, o.y - 18, 'FLUMPH', PAL.gold, 1);
      pug.react('scared', 0.5);
    },
    draw(o, ctx, cx, cy) { ctx.drawImage(Sprites.hay, Math.round(o.x - 11 - cx), Math.round(o.y + o.h / 2 - 15 - cy)); }
  },
  saw: {
    shape: 'circle', r: 8,
    hit(o, pug, nx, ny, pen, game) {
      if (pug.invuln > 0) { solidResolve(pug, nx, ny, pen, 0.8); return; }
      pug.x += nx * pen; pug.y += ny * pen;
      pug.vx = nx * 260 + Math.max(0, pug.vx) * 0.4;
      pug.vy = ny * 260 - 120;
      game.particles.burst(pug.x, pug.y, 10, [PAL.white, PAL.yellow, PAL.orange], 160, 0.3, 1, 100);
      game.damagePug(3, 'SAWED!', o.x, o.y);
    },
    update(o, dt) {
      o.t += dt;
      o.y = o.baseY + Math.sin(o.t * o.speed + o.phase) * o.amp;
      o.rot += dt * 14;
    },
    draw(o, ctx, cx, cy) {
      // rail
      ctx.fillStyle = PAL.dkstone;
      const rx = Math.round(o.x - cx);
      for (let y = o.baseY - o.amp; y <= o.baseY + o.amp; y += 3) ctx.fillRect(rx, Math.round(y - cy), 1, 2);
      ctx.save();
      ctx.translate(rx, Math.round(o.y - cy));
      ctx.rotate(Math.round(o.rot * 4) / 4);
      ctx.drawImage(Sprites.saw, -10, -10);
      ctx.restore();
    }
  },
  bird: {
    shape: 'circle', r: 7,
    hit(o, pug, nx, ny, pen, game) {
      o.alive = false;
      pug.vy = Math.min(pug.vy, 0) - 380;
      pug.vx += 40;
      pug.angVel += rand(-10, 10);
      game.particles.burst(o.x, o.y, 12, [PAL.blue, PAL.ltsky, PAL.white, PAL.navy], 100, 1.0, 1, 60);
      AudioSystem.pop();
      game.onSpecial(o.x, o.y - 14, 'BIRD BONK!', 50, PAL.ltsky);
    },
    update(o, dt) {
      o.t += dt;
      o.x += o.vx * dt;
      o.y = o.baseY + Math.sin(o.t * 3 + o.phase) * 6;
    },
    draw(o, ctx, cx, cy) {
      ctx.drawImage(Sprites.bird[Math.floor(o.t * 8) % 2], Math.round(o.x - 8 - cx), Math.round(o.y - 6 - cy));
    }
  },
  balloon: {
    shape: 'circle', r: 7,
    hit(o, pug, nx, ny, pen, game) {
      o.alive = false;
      pug.vy = Math.min(pug.vy, 0) - 430;
      game.particles.burst(o.x, o.y, 14, [PAL.pink, PAL.dkpink, PAL.white], 130, 0.5, 1, 100);
      AudioSystem.pop();
      game.onSpecial(o.x, o.y - 14, 'POP!', 40, PAL.pink);
    },
    update(o, dt) { o.t += dt; o.y = o.baseY + Math.sin(o.t * 2 + o.phase) * 3; },
    draw(o, ctx, cx, cy) { ctx.drawImage(Sprites.balloon, Math.round(o.x - 6 - cx), Math.round(o.y - 7 - cy)); }
  }
};

class Obstacle {
  constructor(type, x, y, opts = {}) {
    const def = OBS[type];
    this.type = type; this.def = def;
    this.x = x; this.y = y; this.baseY = y;
    this.w = opts.w || def.w || 0; this.h = opts.h || def.h || 0; this.r = def.r || 0;
    this.alive = true;
    this.t = 0; this.rot = 0; this.anim = 0; this.cool = 0;
    this.phase = opts.phase !== undefined ? opts.phase : Math.random() * 6;
    this.amp = opts.amp || 0; this.speed = opts.speed || 2;
    this.vx = opts.vx || 0;
  }
  update(dt) { if (this.def.update) this.def.update(this, dt); }
  draw(ctx, cx, cy) { this.def.draw(this, ctx, cx, cy); }

  /** Circle (pug) vs this obstacle. Returns true on contact and calls hit(). */
  collide(pug, game) {
    let nx, ny, pen;
    if (this.def.shape === 'circle') {
      const dx = pug.x - this.x, dy = pug.y - this.y;
      const rr = pug.r + this.r;
      const d2 = dx * dx + dy * dy;
      if (d2 >= rr * rr) return false;
      const d = Math.sqrt(d2) || 0.001;
      nx = dx / d; ny = dy / d; pen = rr - d;
    } else {
      const hw = this.w / 2, hh = this.h / 2;
      const cx = clamp(pug.x, this.x - hw, this.x + hw);
      const cy = clamp(pug.y, this.y - hh, this.y + hh);
      const dx = pug.x - cx, dy = pug.y - cy;
      const d2 = dx * dx + dy * dy;
      if (d2 >= pug.r * pug.r) return false;
      if (d2 > 0.0001) {
        const d = Math.sqrt(d2);
        nx = dx / d; ny = dy / d; pen = pug.r - d;
      } else {
        // centre inside the box: push out along the axis of least penetration
        const px = hw + pug.r - Math.abs(pug.x - this.x);
        const py = hh + pug.r - Math.abs(pug.y - this.y);
        if (px < py) { nx = sign(pug.x - this.x); ny = 0; pen = px; }
        else { nx = 0; ny = sign(pug.y - this.y); pen = py; }
      }
    }
    this.def.hit(this, pug, nx, ny, pen, game);
    return true;
  }
}

/* ---------------- Coins ---------------- */
const COIN_VALUES = { coin: 1, gold: 5, gem: 15 };

class CoinManager {
  constructor(max = 260) {
    this.pool = [];
    for (let i = 0; i < max; i++) this.pool.push({ alive: false });
  }
  clear() { for (const c of this.pool) c.alive = false; }

  add(x, y, kind = 'coin') {
    const c = this.pool.find(p => !p.alive);
    if (!c) return null;
    c.alive = true; c.x = x; c.y = y; c.baseY = y; c.kind = kind;
    c.phase = (x * 0.05) % 6; c.pulled = false; c.vx = 0; c.vy = 0;
    return c;
  }

  update(dt, time, pug, magnetR, game, active) {
    for (const c of this.pool) {
      if (!c.alive) continue;
      if (c.x < game.camera.x - 60) { c.alive = false; continue; }
      if (!c.pulled) c.y = c.baseY + Math.sin(time * 3 + c.phase) * 2;
      if (!active) continue;
      const dx = pug.x - c.x, dy = pug.y - c.y;
      const d2 = dx * dx + dy * dy;
      if (d2 < magnetR * magnetR * 4 + 400 && d2 < (magnetR + pug.r) * (magnetR + pug.r)) c.pulled = true;
      if (c.pulled) {
        // magnet: accelerate the coin toward the pug
        const d = Math.sqrt(d2) || 1;
        const sp = 260 + Math.hypot(pug.vx, pug.vy) * 1.1;
        c.x += dx / d * sp * dt; c.y += dy / d * sp * dt;
      }
      if (d2 < (pug.r + 4) * (pug.r + 4)) {
        c.alive = false;
        game.collectCoin(c);
      }
    }
  }

  draw(ctx, cx, cy, time, W) {
    for (const c of this.pool) {
      if (!c.alive) continue;
      const sx = Math.round(c.x - cx), sy = Math.round(c.y - cy);
      if (sx < -12 || sx > W + 12) continue;
      if (c.kind === 'gem') {
        ctx.drawImage(Sprites.gem, sx - 5, sy - 5 + (Math.floor(time * 4) % 2));
        if (Math.floor(time * 6 + c.phase) % 5 === 0) { ctx.fillStyle = PAL.white; ctx.fillRect(sx + 4, sy - 6, 1, 1); }
      } else {
        const frames = c.kind === 'gold' ? Sprites.goldCoin : Sprites.coin;
        const f = frames[Math.floor(time * 10 + c.phase) % frames.length];
        ctx.drawImage(f, sx - (f.width >> 1), sy - (f.height >> 1));
      }
    }
  }
}
