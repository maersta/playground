/* =========================================================
   world.js - World: endless procedural generation of terrain,
   obstacles and coin formations, plus parallax background.
   ========================================================= */
'use strict';

class World {
  constructor() {
    this.terrain = new Terrain();
    this.obstacles = [];
    this.coins = new CoinManager();
    this.skyCache = {};
    this.skyW = 0; this.skyH = 0;
  }

  /** Start a fresh world for a new run. */
  reset(luck, worldId = 0) {
    this.wd = WORLDS[worldId] || WORLDS[0];
    this.rng = new RNG((Math.random() * 1e9) | 0);
    this.luck = luck || 0;
    this.terrain.reset();
    this.obstacles.length = 0;
    this.coins.clear();
    this.curY = START_GROUND_Y;
    const startX = -480;
    this.terrain.setStart(startX);
    this.genX = startX;
    // Safe flat launch area around the slingshot
    this.flat(SLING_X + 260 - startX);
    this.lastSection = 'flat';
  }

  get meters() { return Math.max(0, (this.genX - SLING_X) / PX_PER_M); }
  /** Difficulty distance: later worlds start harder and ramp faster. */
  get diffD() { return this.meters * this.wd.diff + this.wd.off; }

  /** Push one terrain column at the current generation x. */
  col(h, type = SURF.GRASS) {
    this.terrain.push(h, type, biomeForMeters(this.meters, this.wd));
    this.genX += COL_W;
  }
  /** Keep the terrain inside a sensible vertical band. */
  clampY() { this.curY = clamp(this.curY, 90, 270); }

  /* ---------------- Terrain section builders ---------------- */
  flat(len, type = SURF.GRASS) {
    const n = Math.ceil(len / COL_W);
    for (let i = 0; i < n; i++) this.col(this.curY, type);
  }
  hills(len, amp, wl, type = SURF.GRASS) {
    const n = Math.ceil(len / COL_W), wlc = wl / COL_W;
    for (let i = 0; i < n; i++) this.col(this.curY - amp * (1 - Math.cos(i / wlc * Math.PI * 2)) / 2, type);
  }
  bumpy(len, amp) {
    const n = Math.ceil(len / COL_W);
    let off = 0;
    for (let i = 0; i < n; i++) {
      if (i % 3 === 0) off = clamp(off + this.rng.range(-amp, amp), -amp * 1.5, amp * 1.5);
      this.col(this.curY + off + Math.sin(i * 0.7) * 1.5);
    }
    this.flat(16);
  }
  bigHill(len, height, type = SURF.GRASS) {
    const n = Math.ceil(len / COL_W);
    for (let i = 0; i <= n; i++) this.col(this.curY - height * Math.sin(i / n * Math.PI), type);
  }
  /** Launch ramp: curved rise, then a sharp drop back down. */
  ramp(len, height) {
    const n = Math.ceil(len / COL_W);
    const start = this.genX;
    for (let i = 0; i < n; i++) {
      const t = i / n;
      this.col(this.curY - height * t * t, i > n * 0.4 ? SURF.STONE : SURF.GRASS);
    }
    this.col(this.curY - height * 0.5);
    return start;
  }
  slope(len, delta) {
    const n = Math.ceil(len / COL_W), y0 = this.curY;
    for (let i = 0; i <= n; i++) this.col(y0 + delta * smoothstep(i / n));
    this.curY = y0 + delta; this.clampY();
  }
  gap(width) {
    this.flat(12);
    const gx = this.genX;
    const n = Math.ceil(width / COL_W);
    for (let i = 0; i < n; i++) this.col(this.curY + 70, SURF.PIT);
    this.curY += this.rng.range(-14, 26); this.clampY();
    this.flat(16);
    return { x0: gx, x1: gx + n * COL_W };
  }
  lavaPool(width) {
    this.flat(10);
    const lx = this.genX;
    const n = Math.ceil(width / COL_W);
    this.col(this.curY + 4, SURF.STONE);
    for (let i = 0; i < n; i++) this.col(this.curY + 9, SURF.LAVA);
    this.col(this.curY + 4, SURF.STONE);
    this.flat(12);
    return { x0: lx, x1: lx + n * COL_W };
  }
  plateau(len, height) {
    const up = Math.ceil(height * 1.2 / COL_W), y0 = this.curY;
    for (let i = 0; i <= up; i++) this.col(y0 - height * smoothstep(i / up));
    const top = this.genX;
    this.flat(len, this.rng.chance(0.3) ? SURF.STONE : SURF.GRASS);
    // sharp drop back down
    this.curY = y0 + this.rng.range(-10, 20); this.clampY();
    this.col(lerp(y0 - height, this.curY, 0.5));
    return top;
  }

  /* ---------------- Section selection (difficulty scaling) ---------------- */
  generateUntil(x) {
    let guard = 0;
    while (this.genX < x && guard++ < 50) this.genSection();
  }

  genSection() {
    const D = this.diffD, wd = this.wd;
    const r = this.rng;
    const ramp = clamp(D / 2000, 0, 1);            // 0..1 over the first 2km
    const kind = r.weighted([
      { v: 'flat', w: D < 300 ? 3 : 1.2 },
      { v: 'hills', w: 3 },
      { v: 'bumpy', w: D > 150 ? 1.5 : 0.4 },
      { v: 'bigHill', w: D > 120 ? 2 : 0.6 },
      { v: 'ramp', w: 2.2 },
      { v: 'gap', w: D > 100 ? (1 + ramp * 2) * wd.gap : 0 },
      { v: 'down', w: this.curY < 200 ? 2 : 0.6 },
      { v: 'up', w: this.curY > 150 ? 1.2 : 0.3 },
      { v: 'plateau', w: D > 300 ? 1 + ramp : 0 },
      { v: 'lava', w: D > 650 ? (0.8 + ramp * 1.5) * wd.lava : 0 },
      { v: 'surface', w: D > 80 ? 1.6 : 0 },
      { v: 'gauntlet', w: D > 1000 ? 0.5 + ramp : 0 }
    ]);
    const x0 = this.genX;
    const amp = 10 + ramp * 30;
    let info = null;

    switch (kind) {
      case 'flat': this.flat(r.range(80, 200)); break;
      case 'hills': { const wl = r.range(90, 180); this.hills(wl * r.int(1, 3), r.range(6, amp + 10), wl); break; }
      case 'bumpy': this.bumpy(r.range(100, 200), 2 + ramp * 5); break;
      case 'bigHill': this.bigHill(r.range(160, 300), r.range(30, 50 + ramp * 50)); break;
      case 'ramp': this.flat(r.range(40, 90)); info = { rampEnd: this.genX, h: 0 }; info.h = r.range(18, 30 + ramp * 30); this.ramp(r.range(60, 100), info.h); info.rampEnd = this.genX; this.flat(r.range(60, 120)); break;
      case 'gap': info = this.gap(r.range(28, 46 + ramp * 70)); break;
      case 'down': this.slope(r.range(100, 220), r.range(25, 50 + ramp * 30)); break;
      case 'up': this.slope(r.range(120, 220), -r.range(15, 40)); break;
      case 'plateau': info = { top: this.plateau(r.range(80, 160), r.range(18, 30 + ramp * 20)) }; break;
      case 'lava': info = this.lavaPool(r.range(30, 50 + ramp * 60)); break;
      case 'surface': {
        const sw = wd.surf;
        const st = r.weighted([{ v: SURF.MUD, w: sw.mud }, { v: SURF.ICE, w: sw.ice }, { v: SURF.STONE, w: sw.stone }, { v: SURF.SAND, w: sw.sand }]);
        const wl = r.range(120, 200);
        if (r.chance(0.5)) this.flat(r.range(100, 220), st); else this.hills(wl, r.range(6, 20), wl, st);
        info = { surf: st };
        break;
      }
      case 'gauntlet': {
        // Chaotic combo: booster -> ramp -> gap
        this.flat(60);
        this.addObstacle('booster', this.genX - 30);
        this.ramp(70, 30);
        info = this.gap(r.range(60, 120));
        break;
      }
    }
    this.flat(r.range(10, 40));
    this.decorate(kind, x0, this.genX, D, info);
    this.lastSection = kind;
  }

  /* ---------------- Obstacles ---------------- */
  /** Place an obstacle standing on the ground at x (or at an absolute y if given). */
  addObstacle(type, x, y = null, opts = {}) {
    const def = OBS[type];
    const h = opts.h || def.h || def.r * 2;
    const gy = this.terrain.heightAt(x);
    const oy = y !== null ? y : (def.shape === 'circle' ? gy - def.r + 1 : gy - h / 2 + 1);
    const o = new Obstacle(type, x, oy, opts);
    this.obstacles.push(o);
    return o;
  }

  /** Is x on safe solid ground with gentle slope (for placing objects)? */
  solidAt(x, w = 12) {
    for (let dx = -w / 2; dx <= w / 2; dx += 4) {
      const t = this.terrain.typeAt(x + dx);
      if (t === SURF.PIT || t === SURF.LAVA) return false;
    }
    return Math.abs(this.terrain.slopeAt(x)) < 0.35 && Math.abs(this.terrain.heightAt(x - w / 2) - this.terrain.heightAt(x + w / 2)) < 6;
  }

  decorate(kind, x0, x1, D, info) {
    const r = this.rng, wd = this.wd;
    const len = x1 - x0;
    const ramp = clamp(D / 2000, 0, 1);
    const speedMul = 1 + Math.min(D / 2500, 1.5);

    // Section-specific hazards & helpers
    if (info && info.x0 !== undefined && info.x1 !== undefined) {
      const mid = (info.x0 + info.x1) / 2, gw = info.x1 - info.x0;
      const edgeY = this.terrain.heightAt(info.x0 - 6);
      // risky coin arc over the hole
      this.coinArc(info.x0 - 10, info.x1 + 10, edgeY - 26 - gw * 0.3, 6 + Math.floor(gw / 14), true);
      if (r.chance(0.35)) this.addObstacle('spring', info.x0 - 30);
      if (D > 900 && r.chance(0.3 + ramp * 0.3)) {
        const s = this.addObstacle('saw', mid, edgeY - 40, { amp: 22, speed: 2.2 * speedMul });
        s.baseY = edgeY - 40;
      }
      if (r.chance(0.3)) this.addObstacle('balloon', mid, edgeY - 55 - r.range(0, 30));
      return;
    }
    if (kind === 'ramp' && info) {
      // coins trail up the ramp and arc beyond
      this.coinArc(info.rampEnd - 10, info.rampEnd + 120 + info.h * 2, this.terrain.heightAt(info.rampEnd) - 40 - info.h, 9, false);
      if (r.chance(0.4)) this.addObstacle('booster', info.rampEnd - 90);
      if (D > 400 && r.chance(0.5)) this.spikeStrip(info.rampEnd + 40, r.int(2, 3 + Math.floor(ramp * 3)));
      return;
    }
    if (kind === 'plateau' && info) {
      if (r.chance(0.6)) this.crateStack(info.top + 40, r.int(1, 3));
      this.coinLine(info.top + 10, info.top + 120, 18);
    }

    // Generic obstacle groups, density grows with distance
    const spacing = 220 - Math.min(110, D / 18);
    const groups = Math.max(0, Math.floor(len / spacing + r.range(-0.3, 0.7)));
    for (let g = 0; g < groups; g++) {
      const x = x0 + (g + 0.5) * (len / Math.max(1, groups)) + r.range(-20, 20);
      if (!this.solidAt(x, 20)) continue;
      const choice = r.weighted([
        { v: 'crate', w: 3 },
        { v: 'stack', w: D > 150 ? 1.5 : 0.5 },
        { v: 'barrel', w: D > 100 ? 2 : 0.3 },
        { v: 'rock', w: 2 },
        { v: 'hay', w: D > 200 ? 1 : 0.4 },
        { v: 'spring', w: 1.6 },
        { v: 'booster', w: 1.2 },
        { v: 'tnt', w: D > 150 ? 1.2 : 0.3 },
        { v: 'spikes', w: D > 70 ? 1 + ramp * 2 : 0 },
        { v: 'wall', w: D > 350 ? 0.6 + ramp : 0 },
        { v: 'saw', w: D > 600 ? 0.8 + ramp * 1.5 : 0 },
        { v: 'birds', w: (D > 220 ? 1.2 : 0.2) * wd.birds },
        { v: 'balloons', w: 0.8 },
        { v: 'springSpikes', w: D > 500 ? 1 + ramp : 0 },
        { v: 'wallSpring', w: D > 800 ? 0.8 + ramp : 0 },
        { v: 'tntRow', w: D > 1200 ? 0.8 : 0 }
      ]);
      const gy = this.terrain.heightAt(x);
      switch (choice) {
        case 'crate': this.addObstacle('crate', x); if (r.chance(0.5)) this.coinCluster(x, gy - 30, 4); break;
        case 'stack': this.crateStack(x, r.int(2, 3)); break;
        case 'barrel': this.addObstacle('barrel', x); if (r.chance(0.4)) this.addObstacle('barrel', x + 14); break;
        case 'rock': this.addObstacle('rock', x); break;
        case 'hay': this.addObstacle('hay', x); break;
        case 'spring': this.addObstacle('spring', x); this.coinColumn(x, gy - 40, 5); break;
        case 'booster': this.addObstacle('booster', x); this.coinLine(x + 20, x + 120, 10); break;
        case 'tnt': this.addObstacle('tnt', x); this.coinArc(x, x + 160, gy - 80, 7, false); break;
        case 'spikes': {
          const n = r.int(2, 3 + Math.floor(ramp * 4));
          this.spikeStrip(x, n);
          if (r.chance(0.6)) this.coinLine(x - 6, x + n * 8 + 6, gy - 16, true); // risky low coins
          break;
        }
        case 'wall': {
          const h = r.range(26, 40 + ramp * 30);
          this.addObstacle('wall', x, null, { h });
          this.coinArc(x - 40, x + 40, gy - h - 20, 5, false);
          break;
        }
        case 'saw': {
          const o = this.addObstacle('saw', x, gy - 22, { amp: 14 + ramp * 10, speed: 2 * speedMul });
          o.baseY = gy - 22;
          this.coinArc(x - 30, x + 30, gy - 55, 4, true);
          break;
        }
        case 'birds': {
          const n = r.int(1, 2 + Math.floor(ramp * 3));
          const by = gy - r.range(40, 100);
          for (let i = 0; i < n; i++) this.addObstacle('bird', x + i * 22, by - i * 8, { vx: -r.range(15, 40) * speedMul });
          break;
        }
        case 'balloons': {
          const n = r.int(1, 3);
          for (let i = 0; i < n; i++) this.addObstacle('balloon', x + i * 40, gy - r.range(40, 90) - i * 15);
          break;
        }
        case 'springSpikes':
          this.addObstacle('spring', x - 30);
          this.spikeStrip(x + 10, r.int(3, 5));
          this.coinArc(x - 30, x + 90, gy - 70, 7, false);
          break;
        case 'wallSpring':
          this.addObstacle('spring', x - 40);
          this.addObstacle('wall', x, null, { h: r.range(45, 70) });
          break;
        case 'tntRow':
          for (let i = 0; i < 3; i++) if (this.solidAt(x + i * 16)) this.addObstacle('tnt', x + i * 16);
          break;
      }
    }

    // Free-floating coin formations
    if (r.chance(0.55)) {
      const cx = x0 + r.range(0.2, 0.8) * len;
      const gy = this.terrain.heightAt(cx);
      const f = r.weighted([{ v: 0, w: 2 }, { v: 1, w: 2 }, { v: 2, w: 1 }, { v: 3, w: 1 }]);
      if (f === 0) this.coinLine(cx - 40, cx + 40, gy - 14);
      else if (f === 1) this.coinArc(cx - 60, cx + 60, gy - 50 - r.range(0, 40), 8, false);
      else if (f === 2) this.coinCluster(cx, gy - 60 - r.range(0, 60), 6);
      else this.coinLine(cx - 50, cx + 50, gy - 90 - r.range(0, 60)); // high air line
    }
  }

  crateStack(x, rows) {
    const gy = this.terrain.heightAt(x);
    for (let row = 0; row < rows; row++) {
      const n = rows - row;
      for (let i = 0; i < n; i++) {
        const cx = x + (i - (n - 1) / 2) * 14;
        this.addObstacle(this.rng.chance(0.15) && row === 0 ? 'barrel' : 'crate', cx, gy - 7 - row * 14 + 1);
      }
    }
  }
  spikeStrip(x, n) {
    if (!this.solidAt(x + n * 4, n * 8)) return;
    this.addObstacle('spikes', x + n * 4, null, { w: n * 8 });
  }

  /* ---------------- Coin formations ---------------- */
  coinKind(risky) {
    const r = this.rng;
    const luck = this.luck;
    if (r.chance(0.008 + luck * 0.12 + (risky ? 0.03 : 0)) && this.meters > 150) return 'gem';
    if (r.chance(0.05 + luck + (risky ? 0.12 : 0))) return 'gold';
    return 'coin';
  }
  coinLine(xa, xb, y = null, risky = false) {
    for (let x = xa; x <= xb; x += 12) {
      const cy = y !== null ? y : this.terrain.heightAt(x) - 14;
      this.coins.add(x, cy, this.coinKind(risky));
    }
  }
  coinArc(xa, xb, peakY, n, risky) {
    const ya = this.terrain.heightAt(xa) - 16, yb = this.terrain.heightAt(xb) - 16;
    for (let i = 0; i < n; i++) {
      const t = n === 1 ? 0.5 : i / (n - 1);
      const base = lerp(ya, yb, t);
      const y = lerp(base, peakY, 1 - (2 * t - 1) * (2 * t - 1));
      this.coins.add(lerp(xa, xb, t), y, this.coinKind(risky));
    }
  }
  coinCluster(cx, cy, n) {
    for (let i = 0; i < n; i++) {
      const a = i / n * Math.PI * 2;
      this.coins.add(cx + Math.cos(a) * 9, cy + Math.sin(a) * 9, this.coinKind(false));
    }
    this.coins.add(cx, cy, this.rng.chance(0.3 + this.luck) ? 'gold' : 'coin');
  }
  coinColumn(x, topY, n) {
    for (let i = 0; i < n; i++) this.coins.add(x, topY - i * 14, this.coinKind(false));
  }

  /* ---------------- Per-frame update ---------------- */
  update(dt, cam, W) {
    this.generateUntil(cam.x + W + 500);
    this.terrain.cull(cam.x - 600);
    // update nearby obstacles, drop the dead / far-behind ones
    let write = 0;
    for (let i = 0; i < this.obstacles.length; i++) {
      const o = this.obstacles[i];
      if (!o.alive || o.x < cam.x - 200) continue;
      if (o.x < cam.x + W + 150) o.update(dt);
      this.obstacles[write++] = o;
    }
    this.obstacles.length = write;
  }

  collidePug(pug, game) {
    for (const o of this.obstacles) {
      if (!o.alive) continue;
      if (Math.abs(o.x - pug.x) > 40 + (o.w || 0) / 2) continue;
      o.collide(pug, game);
    }
  }

  /** Big explosion helper also smashes breakables nearby. */
  blastBreakables(x, y, radius, game) {
    for (const o of this.obstacles) {
      if (!o.alive || !(o.type === 'crate' || o.type === 'barrel' || o.type === 'hay')) continue;
      if (dist2(o.x, o.y, x, y) < radius * radius) {
        o.alive = false;
        game.particles.burst(o.x, o.y, 10, OBS.crate.colors, 160, 0.8, 2, 400);
        game.addScore(20, o.x, o.y - 10, null);
      }
    }
    for (const o of this.obstacles) {
      if (o.alive && o.type === 'tnt' && dist2(o.x, o.y, x, y) < radius * radius * 0.5) {
        o.alive = false;
        setTimeout(() => game.explosion(o.x, o.y, true), 120);
      }
    }
  }

  /* ---------------- Background (parallax) ---------------- */
  getSky(biome, W, H) {
    if (this.skyW !== W || this.skyH !== H) { this.skyCache = {}; this.skyW = W; this.skyH = H; }
    if (this.skyCache[biome]) return this.skyCache[biome];
    // Pre-render a banded, dithered sky gradient
    const c = document.createElement('canvas');
    c.width = W; c.height = H;
    const ctx = c.getContext('2d');
    const cols = BIOMES[biome].sky.map(hex => [1, 3, 5].map(o => parseInt(hex.substr(o, 2), 16)));
    const bands = cols.length;
    const img = ctx.createImageData(W, H);
    const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
    for (let y = 0; y < H; y++) {
      const t = y / H * (bands - 1);
      const i = Math.min(bands - 2, Math.floor(t));
      const f = t - i;
      for (let x = 0; x < W; x++) {
        // 4x4 ordered (Bayer) dither between neighbouring bands
        const useNext = f > 0.35 && (f - 0.35) / 0.65 > BAYER[(y & 3) * 4 + (x & 3)] / 16;
        const c3 = useNext ? cols[i + 1] : cols[i];
        const p = (y * W + x) * 4;
        img.data[p] = c3[0]; img.data[p + 1] = c3[1]; img.data[p + 2] = c3[2]; img.data[p + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    if (BIOMES[biome].stars) {
      for (let i = 0; i < 70; i++) {
        ctx.fillStyle = i % 5 ? '#8a8aa8' : PAL.white;
        ctx.fillRect(Math.floor(hash1(i * 7) * W), Math.floor(hash1(i * 13) * H * 0.55), 1, 1);
      }
    }
    this.skyCache[biome] = c;
    return c;
  }

  drawBackground(ctx, cam, W, H, time, biome, prevBiome, blend) {
    // sky (cross-fade between biomes)
    ctx.drawImage(this.getSky(prevBiome, W, H), 0, 0);
    if (blend < 1) {
      ctx.globalAlpha = Math.round(blend * 4) / 4;
      ctx.drawImage(this.getSky(biome, W, H), 0, 0);
      ctx.globalAlpha = 1;
    } else ctx.drawImage(this.getSky(biome, W, H), 0, 0);
    const B = BIOMES[blend > 0.5 ? biome : prevBiome];

    // sun / moon
    const sunX = Math.round(W * 0.78), sunY = Math.round(H * 0.18 - (cam.y - 40) * 0.02);
    ctx.fillStyle = B.sun;
    ctx.fillRect(sunX - 6, sunY - 9, 12, 18); ctx.fillRect(sunX - 9, sunY - 6, 18, 12); ctx.fillRect(sunX - 8, sunY - 8, 16, 16);
    if (BIOMES[biome].crescent) { ctx.fillStyle = BIOMES[biome].sky[1]; ctx.fillRect(sunX - 2, sunY - 9, 10, 14); }

    const vy = cam.y - 40; // vertical parallax reference

    // clouds
    for (let i = -1; i < (B.noClouds ? -1 : 6); i++) {
      const span = W + 120;
      const cxw = ((i * 137 + 40 - cam.x * 0.08 - time * 4) % span + span) % span - 60;
      const cy = Math.round(20 + hash1(i + 3) * H * 0.3 - vy * 0.05);
      this.drawCloud(ctx, Math.round(cxw), cy, 1 + Math.floor(hash1(i + 9) * 2), B.cloud);
    }

    // far mountains
    const mBase = Math.round(H * 0.62 - vy * 0.12);
    for (let sx = 0; sx < W; sx++) {
      const wx = sx + cam.x * 0.12;
      const h = noise1(wx / 55) * 46 + noise1(wx / 19) * 10;
      const top = Math.round(mBase - h);
      ctx.fillStyle = B.mount; ctx.fillRect(sx, top, 1, H - top);
      if (h > 44) { ctx.fillStyle = B.cap || PAL.white; ctx.fillRect(sx, top, 1, Math.min(3, h - 44)); }
      else { ctx.fillStyle = B.mount2; ctx.fillRect(sx, top, 1, 1); }
    }
    // near hills with trees
    const hBase = Math.round(H * 0.74 - vy * 0.3);
    for (let sx = 0; sx < W; sx++) {
      const wx = sx + cam.x * 0.35;
      const h = noise1(wx / 40) * 26 + noise1(wx / 13) * 5;
      const top = Math.round(hBase - h);
      ctx.fillStyle = B.hill; ctx.fillRect(sx, top, 1, H - top);
      ctx.fillStyle = B.hill2; ctx.fillRect(sx, top + 6, 1, H - top - 6);
    }
    const treeStart = Math.floor(cam.x * 0.35 / 18) - 1;
    for (let k = treeStart; k < treeStart + W / 18 + 3; k++) {
      if (hash1(k * 31) > 0.45) continue;
      const wx = k * 18 + Math.floor(hash1(k) * 10);
      const sx = Math.round(wx - cam.x * 0.35);
      const h = noise1(wx / 40) * 26 + noise1(wx / 13) * 5;
      const top = Math.round(hBase - h);
      this.drawTree(ctx, sx, top, B);
    }
  }

  drawCloud(ctx, x, y, size, color) {
    const s = size;
    ctx.fillStyle = color;
    ctx.fillRect(x, y + 4 * s, 26 * s, 5 * s);
    ctx.fillRect(x + 4 * s, y + 1 * s, 10 * s, 5 * s);
    ctx.fillRect(x + 12 * s, y - 1 * s, 9 * s, 6 * s);
    ctx.globalAlpha = 0.5;
    ctx.fillStyle = PAL.ltsky;
    ctx.fillRect(x + 2 * s, y + 8 * s, 22 * s, 1 * s);
    ctx.globalAlpha = 1;
  }

  drawTree(ctx, x, groundY, B) {
    const kind = B.trees || 'round';
    ctx.fillStyle = B.tree;
    switch (kind) {
      case 'none': return;
      case 'cactus':
        ctx.fillRect(x, groundY - 14, 3, 14); ctx.fillRect(x - 3, groundY - 10, 3, 2); ctx.fillRect(x - 3, groundY - 13, 2, 4);
        ctx.fillRect(x + 3, groundY - 8, 3, 2); ctx.fillRect(x + 4, groundY - 11, 2, 4);
        return;
      case 'dead':
        ctx.fillRect(x, groundY - 14, 2, 14); ctx.fillRect(x - 3, groundY - 11, 3, 1); ctx.fillRect(x + 2, groundY - 9, 3, 1);
        ctx.fillRect(x - 3, groundY - 13, 1, 2); ctx.fillRect(x + 4, groundY - 11, 1, 2);
        return;
      case 'pine':
        ctx.fillRect(x, groundY - 4, 2, 4);
        ctx.fillRect(x - 5, groundY - 8, 12, 4); ctx.fillRect(x - 4, groundY - 12, 10, 4);
        ctx.fillRect(x - 2, groundY - 16, 6, 4); ctx.fillRect(x, groundY - 19, 2, 3);
        ctx.fillStyle = '#ffffff'; ctx.fillRect(x - 5, groundY - 8, 3, 1); ctx.fillRect(x - 4, groundY - 12, 3, 1); ctx.fillRect(x - 2, groundY - 16, 3, 1);
        return;
      case 'palm':
        ctx.fillStyle = PAL.ltbrown; ctx.fillRect(x, groundY - 14, 2, 14); ctx.fillRect(x + 1, groundY - 16, 2, 3);
        ctx.fillStyle = B.tree;
        ctx.fillRect(x - 6, groundY - 17, 6, 2); ctx.fillRect(x + 3, groundY - 17, 6, 2);
        ctx.fillRect(x - 4, groundY - 19, 4, 2); ctx.fillRect(x + 3, groundY - 19, 4, 2); ctx.fillRect(x - 1, groundY - 20, 4, 2);
        return;
      case 'lolly':
        ctx.fillStyle = PAL.cream; ctx.fillRect(x, groundY - 12, 2, 12);
        ctx.fillStyle = B.tree; ctx.fillRect(x - 4, groundY - 20, 10, 8); ctx.fillRect(x - 2, groundY - 22, 6, 12); ctx.fillRect(x - 3, groundY - 21, 8, 10);
        ctx.fillStyle = PAL.white; ctx.fillRect(x - 1, groundY - 18, 4, 1); ctx.fillRect(x - 2, groundY - 16, 1, 3); ctx.fillRect(x + 2, groundY - 15, 1, 2);
        return;
      case 'antenna':
        ctx.fillRect(x, groundY - 18, 1, 18); ctx.fillRect(x - 3, groundY - 14, 7, 1); ctx.fillRect(x - 2, groundY - 18, 5, 1);
        ctx.fillStyle = PAL.red2; ctx.fillRect(x, groundY - 20, 1, 2);
        return;
      default:
        ctx.fillStyle = PAL.dkbrown; ctx.fillRect(x, groundY - 6, 2, 6);
        ctx.fillStyle = B.tree;
        ctx.fillRect(x - 4, groundY - 14, 10, 8); ctx.fillRect(x - 2, groundY - 18, 6, 4); ctx.fillRect(x - 5, groundY - 11, 12, 4);
        ctx.fillStyle = B.hill; ctx.fillRect(x - 2, groundY - 16, 2, 2);
    }
  }
}
