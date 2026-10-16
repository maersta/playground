/* =========================================================
   hud.js - in-canvas pixel HUD (distance, score, coins, hearts,
   combo, speed, power meter, trajectory, off-screen indicator)
   ========================================================= */
'use strict';

const HUD = {
  coinBump: 0,
  distBump: 0,

  draw(ctx, g) {
    const W = g.W, H = g.H;
    const pug = g.pug;
    if (g.state !== 'aim' && g.state !== 'fly' && g.state !== 'dying') return;

    // ---- Top-left: distance + score ----
    const m = Math.floor(g.run.distance);
    const ds = this.distBump > 0 ? 4 : 3;
    PixelFont.draw(ctx, m + 'M', 6, 6, ds, PAL.white, PAL.ink);
    PixelFont.draw(ctx, 'SCORE ' + Math.floor(g.run.score), 6, 26, 1, PAL.gold, PAL.ink);
    const bestHere = Meta.bestHere();
    if (bestHere > 0) {
      const beat = g.run.distance > bestHere;
      PixelFont.draw(ctx, beat ? 'NEW BEST!' : 'BEST ' + Math.floor(bestHere) + 'M', 6, 34, 1,
        beat ? (Math.floor(g.time * 6) % 2 ? PAL.lime : PAL.gold) : PAL.cream, PAL.ink);
    }
    if (g.state !== 'aim') {
      const mps = Math.round(pug.speed / PX_PER_M);
      PixelFont.draw(ctx, 'SPD ' + mps + 'M/S', 6, 42, 1, mps > 60 ? PAL.red2 : mps > 35 ? PAL.yellow : PAL.ltsky, PAL.ink);
    }

    // ---- Top-right: coins + hearts ----
    const coinStr = String(g.run.coins);
    const cs = this.coinBump > 0 ? 3 : 2;
    const cw = PixelFont.measure(coinStr, cs);
    PixelFont.draw(ctx, coinStr, W - 6, 7, cs, PAL.gold, PAL.ink, 'right');
    const cf = Sprites.coin[Math.floor(g.time * 8) % 6];
    ctx.drawImage(cf, W - 6 - cw - 12, 7);
    const hearts = Math.ceil(pug.maxHp / 2);
    for (let i = 0; i < hearts; i++) {
      const v = pug.hp - i * 2;
      const spr = v >= 2 ? Sprites.heart.full : v === 1 ? Sprites.heart.half : Sprites.heart.empty;
      const hx = W - 6 - (hearts - i) * 9;
      const shake = g.hurtFlash > 0 && i === Math.floor(pug.hp / 2) ? Math.round(rand(-1, 1)) : 0;
      ctx.drawImage(spr, hx + shake, 22);
    }

    // ---- Combo multiplier ----
    const c = g.combo;
    if (c.count > 0 && g.state === 'fly') {
      const mult = g.comboMult().toFixed(1);
      const cx = Math.round(W / 2), cy = 26;
      const pulse = c.pulse > 0 ? 1 : 0;
      const col = c.count >= 20 ? PAL.red2 : c.count >= 10 ? PAL.orange : PAL.yellow;
      PixelFont.draw(ctx, 'x' + mult, cx, cy, 2 + pulse, col, PAL.ink, 'center');
      PixelFont.draw(ctx, 'COMBO ' + c.count, cx, cy + 13 + pulse * 2, 1, PAL.white, PAL.ink, 'center');
      const bw = 40, bx = cx - bw / 2, by = cy + 21 + pulse * 2;
      ctx.fillStyle = PAL.ink; ctx.fillRect(bx - 1, by - 1, bw + 2, 4);
      ctx.fillStyle = col; ctx.fillRect(bx, by, Math.round(bw * clamp(c.timer / c.maxTimer, 0, 1)), 2);
    }

    // ---- Off-screen (too high) indicator ----
    const sy = pug.y - g.camera.y;
    if (sy < -6 && g.state === 'fly') {
      const sx = Math.round(clamp(pug.x - g.camera.x, 10, W - 10));
      ctx.fillStyle = PAL.ink; ctx.fillRect(sx - 4, 50, 9, 5);
      ctx.fillStyle = PAL.white;
      ctx.fillRect(sx, 48, 1, 1); ctx.fillRect(sx - 1, 49, 3, 1); ctx.fillRect(sx - 2, 50, 5, 1); ctx.fillRect(sx, 51, 1, 3);
      const alt = Math.round((g.world.terrain.heightAt(pug.x) - pug.y) / PX_PER_M);
      PixelFont.draw(ctx, alt + 'M', sx, 57, 1, PAL.white, PAL.ink, 'center');
    }

    // ---- Air control hint ----
    if (g.state === 'fly' && g.stats.airAccel > 0 && g.run.time < 3 && g.steerDir === 0) {
      PixelFont.draw(ctx, '< HOLD TO STEER >', W / 2, H - 14, 1, PAL.cream, PAL.ink, 'center');
    }

    if (this.coinBump > 0) this.coinBump -= 1 / 60;
    if (this.distBump > 0) this.distBump -= 1 / 60;
  },

  /** Power meter next to the slingshot while aiming. */
  drawPowerMeter(ctx, g, power) {
    const cx = g.camera.rx, cy = g.camera.ry;
    const x = Math.round(g.sling.x - 34 - cx), y = Math.round(g.sling.gy - 58 - cy);
    const h = 44;
    ctx.fillStyle = PAL.ink; ctx.fillRect(x - 1, y - 1, 8, h + 2);
    ctx.fillStyle = PAL.ink2; ctx.fillRect(x, y, 6, h);
    const fh = Math.round(h * power);
    for (let i = 0; i < fh; i++) {
      const t = i / h;
      ctx.fillStyle = t < 0.5 ? PAL.ltgreen : t < 0.8 ? PAL.yellow : PAL.red2;
      ctx.fillRect(x, y + h - 1 - i, 6, 1);
    }
    for (let i = 1; i < 4; i++) { ctx.fillStyle = PAL.ink; ctx.fillRect(x, y + Math.round(h * i / 4), 2, 1); }
    PixelFont.draw(ctx, Math.round(power * 100) + '%', x + 3, y - 9, 1, power > 0.95 ? PAL.red2 : PAL.white, PAL.ink, 'center');
    if (power > 0.97) PixelFont.draw(ctx, 'MAX!', x + 3, y + h + 4, 1, Math.floor(g.time * 8) % 2 ? PAL.gold : PAL.red2, PAL.ink, 'center');
  },

  /** Dotted predicted trajectory using the same gravity & drag as the pug. */
  drawTrajectory(ctx, g, x, y, vx, vy) {
    const cx = g.camera.rx, cy = g.camera.ry;
    const drag = 0.03 * (1 - 0.07 * g.stats.speedLvl);
    const dt = 1 / 60;
    let px = x, py = y;
    const n = g.stats.aimLen;
    for (let i = 0; i < n; i++) {
      for (let k = 0; k < 2; k++) {
        vy += g.stats.gravity * dt;
        vx -= vx * drag * dt; vy -= vy * drag * 0.6 * dt;
        px += vx * dt; py += vy * dt;
      }
      if (py + 4 > g.world.terrain.heightAt(px)) {
        // landing marker
        const lx = Math.round(px - cx), ly = Math.round(g.world.terrain.heightAt(px) - cy);
        ctx.fillStyle = PAL.ink; ctx.fillRect(lx - 3, ly - 2, 7, 3);
        ctx.fillStyle = PAL.red2; ctx.fillRect(lx - 2, ly - 1, 5, 1);
        break;
      }
      if (i % 2) continue;
      const fade = 1 - i / n;
      const s = fade > 0.6 ? 2 : 1;
      const sx = Math.round(px - cx), sy = Math.round(py - cy);
      ctx.fillStyle = PAL.ink; ctx.fillRect(sx - 1, sy - 1, s + 2, s + 2);
      ctx.fillStyle = (Math.floor(g.time * 10) + i / 2) % 4 < 1 ? PAL.gold : PAL.white;
      ctx.fillRect(sx, sy, s, s);
    }
  }
};
