/* =========================================================
   pug.js - Pug (physics body + expressive sprite) and Slingshot
   ========================================================= */
'use strict';

const wrapAngle = a => Math.atan2(Math.sin(a), Math.cos(a));

class Pug {
  constructor() {
    this.r = 9;        // collision radius (px)
    this.reset({ maxHp: 3 }, SLING_X, START_GROUND_Y - 46);
  }

  reset(stats, x, y) {
    this.x = x; this.y = y; this.vx = 0; this.vy = 0;
    this.prevX = x;
    this.angle = 0; this.angVel = 0;
    this.sq = 0; this.sqV = 0; this.sqAng = -Math.PI / 2;   // squash spring
    this.maxHp = stats.maxHp; this.hp = stats.maxHp;
    this.invuln = 0;
    this.grounded = false;
    this.airTime = 0;
    this.expr = 'idle'; this.exprTimer = 0;
    this.blinkTimer = 2; this.blinking = 0;
    this.earUp = 0; this.earTimer = 0;
    this.dead = false;
    this.frozen = false;
    this.facing = 1;
    this.time = 0;
  }

  get speed() { return Math.hypot(this.vx, this.vy); }

  /** Force an expression for a short time (hurt, happy, scared...). */
  react(expr, dur) { this.expr = expr; this.exprTimer = dur; }

  /** Kick the squash spring. Positive amount = flattened along normal (nx, ny). */
  squash(amount, nx = 0, ny = -1) {
    this.sq = Math.max(this.sq, amount);
    this.sqV = 0;
    this.sqAng = Math.atan2(ny, nx);
  }

  /* ------------------------------------------------------------
     Fixed-step physics. Substeps prevent tunnelling at high speed.
     ------------------------------------------------------------ */
  step(dt, world, game, stats, steerDir) {
    // Air control (upgrade): small horizontal acceleration while airborne
    if (!this.grounded && stats.airAccel > 0 && steerDir) {
      this.vx += steerDir * stats.airAccel * dt;
      this.vy += -Math.abs(steerDir) * stats.airAccel * 0.15 * dt; // tiny "glide" lift
    }
    // Gravity
    this.vy += stats.gravity * dt;
    // Air resistance (linear drag, reduced by the Speed upgrade)
    const drag = 0.03 * (1 - 0.07 * stats.speedLvl);
    this.vx -= this.vx * drag * dt;
    this.vy -= this.vy * drag * 0.6 * dt;
    // Terminal velocity guard
    this.vx = clamp(this.vx, -1600, 2400);
    this.vy = clamp(this.vy, -1800, 1400);

    const sub = Math.max(1, Math.ceil(Math.max(Math.abs(this.vx), Math.abs(this.vy)) * dt / 3));
    const h = dt / sub;
    const wasGrounded = this.grounded;
    this.grounded = false;
    for (let i = 0; i < sub && !this.frozen; i++) {
      this.prevX = this.x;
      this.x += this.vx * h;
      this.y += this.vy * h;
      this.collideTerrain(world.terrain, h, game, stats);
      if (this.frozen) break;
      world.collidePug(this, game);
    }

    // Rotation: roll along the ground when fast, settle upright when slow
    if (this.grounded) {
      const slopeAng = Math.atan(world.terrain.slopeAt(this.x));
      if (this.speed > 140) {
        const tx = Math.cos(slopeAng), ty = Math.sin(slopeAng);
        const vt = this.vx * tx + this.vy * ty;
        this.angVel = lerp(this.angVel, vt / this.r * 0.7, 0.2);
      } else {
        this.angVel *= 0.8;
        this.angle = lerp(wrapAngle(this.angle - slopeAng) + slopeAng, slopeAng, 1 - Math.exp(-8 * dt));
      }
      this.airTime = 0;
    } else {
      this.angVel *= Math.exp(-0.25 * dt);
      this.airTime += dt;
    }
    this.angle = wrapAngle(this.angle + this.angVel * dt);
    this.justLanded = !wasGrounded && this.grounded;
  }

  /** Circle vs heightmap collision with surface-dependent bounce & friction. */
  collideTerrain(t, h, game, stats) {
    const gy = t.heightAt(this.x);
    if (this.y + this.r <= gy) return;
    const type = t.typeAt(this.x);
    if (type === SURF.PIT) { game.pugFellInPit(); return; }

    const n = t.normalAt(this.x);
    if (n.y > -0.5) {
      // Steep cliff face: undo the horizontal move and bounce off it like a wall
      const movingInto = this.vx * n.x < 0;
      this.x = this.prevX;
      const gy2 = t.heightAt(this.x);
      if (this.y + this.r > gy2) this.y = gy2 - this.r;
      if (movingInto) {
        const imp = Math.abs(this.vx);
        this.vx = -this.vx * 0.3;
        if (imp > 120) game.onPugWallHit(imp, this.x + sign(-n.x) * this.r, this.y);
      }
      return;
    }

    // Push the pug back on top of the surface
    this.y = gy - this.r;
    const surf = SURF_PROPS[type];
    if (type === SURF.LAVA) { game.pugTouchedLava(); return; }

    // Split velocity into normal (vn) and tangential (vt) components
    const vn = this.vx * n.x + this.vy * n.y;
    if (vn >= 0) { this.grounded = true; return; }
    const tx = -n.y, ty = n.x;   // tangent pointing "forward" along the slope
    let vt = this.vx * tx + this.vy * ty;
    const impact = -vn;
    let newVn = 0;

    if (impact > 70) {
      // Bounce: restitution = upgrade value x surface multiplier
      const e = Math.min(0.93, stats.bounce * surf.e);
      newVn = impact * e;
      if (newVn < 45) newVn = 0;
      // Impact friction steals some forward speed (less with Speed upgrade)
      vt *= 1 - clamp(0.1 * surf.fric * (1 - stats.speedLvl * 0.06), 0, 0.85);
      if (vt > 0) vt += stats.speedLvl * 4;   // Speed upgrade: forward kick on every bounce
      this.angVel = vt / this.r * 0.6 + rand(-4, 4);
      this.squash(Math.min(0.42, impact / 1300), n.x, n.y);
      game.onPugBounce(impact, this.x, gy, type);
    } else {
      // Rolling / sliding contact: kinetic friction decelerates along the tangent
      const rollFric = 55 * surf.fric * (1 - stats.speedLvl * 0.065);
      const dec = rollFric * h;
      vt = Math.abs(vt) <= dec ? 0 : vt - sign(vt) * dec;
      this.grounded = true;
    }
    this.vx = vt * tx + newVn * n.x;
    this.vy = vt * ty + newVn * n.y;
  }

  /** Animation & expression logic (runs every frame). */
  animate(dt, mode, pull) {
    this.time += dt;
    if (this.invuln > 0) this.invuln -= dt;

    // squash spring (damped oscillator -> jelly wobble)
    this.sqV += (-260 * this.sq - 14 * this.sqV) * dt;
    this.sq += this.sqV * dt;
    if (Math.abs(this.sq) < 0.002 && Math.abs(this.sqV) < 0.01) { this.sq = 0; this.sqV = 0; }

    // blinking
    this.blinkTimer -= dt;
    if (this.blinkTimer <= 0) { this.blinking = 0.12; this.blinkTimer = rand(1.8, 4.5); }
    if (this.blinking > 0) this.blinking -= dt;

    // ears: flap in the wind when fast, small twitches when idle
    const spd = this.speed;
    this.earTimer -= dt;
    if (mode === 'fly' && spd > 220) {
      if (this.earTimer <= 0) { this.earUp = 1 - this.earUp; this.earTimer = clamp(0.25 - spd / 4000, 0.04, 0.2); }
    } else if (this.earTimer <= 0) {
      this.earUp = this.earUp ? 0 : (Math.random() < 0.25 ? 1 : 0);
      this.earTimer = this.earUp ? 0.12 : rand(0.8, 2.5);
    }

    if (this.vx < -60 && !this.grounded) this.facing = -1;
    else if (this.vx > 30) this.facing = 1;

    // expression choice
    if (this.exprTimer > 0) { this.exprTimer -= dt; return; }
    if (this.dead) { this.expr = 'dizzy'; return; }
    if (mode === 'sling') {
      this.expr = pull > 0.75 ? 'scared' : pull > 0.05 ? 'look' : (this.blinking > 0 ? 'blink' : 'idle');
    } else if (mode === 'fly') {
      if (spd > 550) this.expr = 'happy';
      else if (!this.grounded && this.vy > 260) this.expr = 'scared';
      else this.expr = this.blinking > 0 ? 'blink' : 'idle';
    } else this.expr = this.blinking > 0 ? 'blink' : 'idle';
  }

  draw(ctx, cx, cy, mode) {
    if (this.invuln > 0 && Math.floor(this.invuln * 14) % 2 === 0) return; // hurt blink
    const spr = Sprites.pug[this.expr + '_' + this.earUp];
    ctx.save();
    ctx.translate(Math.round(this.x - cx), Math.round(this.y - cy));
    // squash & stretch along the impact normal
    if (Math.abs(this.sq) > 0.003) {
      ctx.rotate(this.sqAng);
      ctx.scale(1 - this.sq, 1 + this.sq * 0.7);
      ctx.rotate(-this.sqAng);
    }
    // idle breathing in the slingshot
    if (mode === 'sling') ctx.scale(1 + Math.sin(this.time * 3) * 0.025, 1 - Math.sin(this.time * 3) * 0.04);
    // rotation snapped to 32 steps keeps the pixel-art feel
    const snap = Math.PI / 16;
    ctx.rotate(Math.round(this.angle / snap) * snap);
    if (this.facing < 0) ctx.scale(-1, 1);
    ctx.drawImage(spr, -14, -13);
    ctx.restore();

    // dizzy stars when knocked out
    if (this.dead) {
      for (let i = 0; i < 3; i++) {
        const a = this.time * 4 + i * 2.1;
        const sx = Math.round(this.x - cx + Math.cos(a) * 10), sy = Math.round(this.y - cy - 14 + Math.sin(a) * 3);
        ctx.fillStyle = PAL.gold;
        ctx.fillRect(sx, sy - 1, 1, 3); ctx.fillRect(sx - 1, sy, 3, 1);
      }
    }
  }
}

/* =========================================================
   Slingshot - the giant wooden Y with a rubber band
   ========================================================= */
class Slingshot {
  constructor() {
    this.def = SLINGS[0];
    this.x = SLING_X;
    this.gy = START_GROUND_Y;
    this.bandX = 0; this.bandY = 0;    // pouch offset after release (wobble)
    this.bandVX = 0; this.bandVY = 0;
  }
  place(groundY) {
    this.gy = groundY;
    this.restX = this.x - 1;
    this.restY = groundY - 46;
    this.tipL = { x: this.x - 11, y: groundY - 51 };
    this.tipR = { x: this.x + 11, y: groundY - 51 };
    this.bandX = 0; this.bandY = 0; this.bandVX = 0; this.bandVY = 0;
  }
  /** After launch the empty band springs back and wobbles. */
  release(dx, dy) { this.bandX = dx; this.bandY = dy; this.bandVX = 0; this.bandVY = 0; }
  update(dt) {
    const k = 900, c = 9;
    this.bandVX += (-k * this.bandX - c * this.bandVX) * dt;
    this.bandVY += (-k * this.bandY - c * this.bandVY) * dt;
    this.bandX += this.bandVX * dt; this.bandY += this.bandVY * dt;
  }
  drawBack(ctx, cx, cy, pouchX, pouchY) {
    ctx.drawImage(Sprites.slingshotFor(this.def.id), Math.round(this.x - 17 - cx), Math.round(this.gy - 56 - cy));
    this.drawBand(ctx, cx, cy, this.tipL, pouchX, pouchY, this.def.band2);
  }
  drawFront(ctx, cx, cy, pouchX, pouchY) {
    // leather pouch
    ctx.fillStyle = PAL.dkbrown;
    ctx.fillRect(Math.round(pouchX - cx) - 2, Math.round(pouchY - cy) - 4, 3, 9);
    this.drawBand(ctx, cx, cy, this.tipR, pouchX, pouchY, this.def.band);
  }
  drawBand(ctx, cx, cy, tip, px, py, color) {
    pixelLine(ctx, tip.x - cx, tip.y - cy, px - cx, py - cy, color);
    pixelLine(ctx, tip.x - cx, tip.y + 1 - cy, px - cx, py + 1 - cy, color);
  }
}
