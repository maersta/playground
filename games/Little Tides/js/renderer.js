// Canvas 2D renderer: fishing scene, harbor scene, particles and all procedural scenery.
import { INK, TAU, clamp, lerp, hash, mix, rgba, shade, smoothPath, organic, paint, glow, sparkle, bubble, cloud, gull, island, drawBoat, drawFisherman, drawPet, BOAT_META } from './draw.js';
import { drawFish, fishPixels, drawLoot } from './fish-art.js';
import { SPECIES, SPECIES_BY_ID } from './fish-data.js';
import { ZONE_BY_ID } from './zone-data.js';
import { RODS, getEffects } from './upgrades.js';
import { DECO_BY_ID } from './fish-book.js';
import { FS, layerOf, nightness } from './fishing.js';
import { CONFIG, RARITY } from './config.js';

const rnd = (a, b) => a + Math.random() * (b - a);

function makeGrain() {
  const c = document.createElement('canvas'); c.width = c.height = 160;
  const g = c.getContext('2d'), d = g.createImageData(160, 160);
  for (let i = 0; i < d.data.length; i += 4) { const v = 110 + Math.random() * 100 | 0; d.data[i] = v; d.data[i + 1] = v - 6; d.data[i + 2] = v - 14; d.data[i + 3] = Math.random() * 40; }
  g.putImageData(d, 0, 0);
  return c;
}

export class Renderer {
  constructor(canvas, game) {
    this.cv = canvas; this.ctx = canvas.getContext('2d'); this.g = game;
    this.t = 0; this.parts = []; this.W = 800; this.H = 600; this.dpr = 1;
    this.grain = makeGrain(); this.grainPat = null;
    this.hookX = 0.5; this.hookY = 0; this.ds = 1; this.petHappy = 0; this.flash = null; this.shake = 0;
    this.biteFish = null; this.world = null; this.hot = []; this.hover = null; this.spawnAcc = 0;
    this.lastState = FS.READY; this.splashDone = false; this.tipW = { x: 0, y: 0 };
    this.mouse = { x: -1, y: -1 };
    this.resize = this.resize.bind(this);
    window.addEventListener('resize', this.resize);
    this.resize();
    this.offs = [
      game.bus.on('zone', () => this.initWorld()),
      game.bus.on('fx', e => this.onFx(e)),
      game.bus.on('catch', e => this.onCatch(e)),
      game.bus.on('cast', () => { this.splashDone = false; }),
    ];
    this.initWorld();
  }

  destroy() { window.removeEventListener('resize', this.resize); this.offs.forEach(o => o()); }

  resize() {
    const r = this.cv.getBoundingClientRect();
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.W = Math.max(320, r.width); this.H = Math.max(240, r.height);
    this.cv.width = Math.round(this.W * this.dpr); this.cv.height = Math.round(this.H * this.dpr);
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.grainPat = this.ctx.createPattern(this.grain, 'repeat');
  }

  // ---------- world setup ----------
  initWorld() {
    const zone = ZONE_BY_ID[this.g.state.zone], th = zone.theme;
    const sp = SPECIES.filter(s => s.zone === zone.id && s.size <= 5 && s.body !== 'leviathan');
    const w = {
      zone, th, seed: zone.tier * 17,
      clouds: Array.from({ length: 6 }, (_, i) => ({ x: Math.random(), y: 0.03 + Math.random() * 0.17, s: rnd(0.6, 1.3), v: rnd(0.004, 0.012), seed: i * 3 + zone.tier })),
      birds: Array.from({ length: th.dark > 0.3 ? 0 : 4 }, () => ({ x: Math.random(), y: 0.08 + Math.random() * 0.14, v: rnd(0.012, 0.03), ph: Math.random() * 6 })),
      stars: Array.from({ length: 70 }, () => ({ x: Math.random(), y: Math.random() * 0.3, r: rnd(0.5, 1.6), ph: Math.random() * 6 })),
      fish: Array.from({ length: 11 }, () => this.newAmbient(sp, true)),
      schools: Array.from({ length: 2 }, (_, i) => ({ x: Math.random(), d: 0.2 + i * 0.3 + Math.random() * 0.1, v: (i % 2 ? -1 : 1) * rnd(0.03, 0.05), n: 9, ph: Math.random() * 6, col: i ? th.water[0] : '#ffffff' })),
      deco: this.makeDeco(zone),
      sp,
    };
    this.world = w;
    this.parts.length = 0;
    this.biteFish = null;
  }

  newAmbient(list, anywhere) {
    const tot = list.reduce((a, s) => a + s.spawn, 0); let r = Math.random() * tot, sp = list[0];
    for (const s of list) { r -= s.spawn; if (r <= 0) { sp = s; break; } }
    const layer = sp.depths[Math.floor(Math.random() * sp.depths.length)];
    const d = clamp(layer * 0.33 + 0.1 + Math.random() * 0.28, 0.08, 0.93);
    const dir = Math.random() < 0.5 ? 1 : -1;
    return { sp, x: anywhere ? Math.random() * 1.2 - 0.1 : (dir > 0 ? -0.15 : 1.15), d, dir, v: rnd(0.02, 0.06), ph: Math.random() * 10, size: rnd(0.8, 1.15), bobA: rnd(0.005, 0.02), len: lerp(sp.lMin, sp.lMax, Math.random() * 0.8) };
  }

  makeDeco(zone) {
    const out = [], n = 26, id = zone.theme.deco;
    const pools = {
      pebble: ['pebbles', 'rock', 'grass', 'shell', 'grass', 'pebbles'], sunlit: ['coral_fan', 'coral_brain', 'grass', 'shell', 'coral_branch', 'rock'],
      kelp: ['kelp', 'kelp', 'kelp', 'rock', 'grass', 'kelp'], coral: ['coral_branch', 'coral_brain', 'coral_fan', 'anemone', 'coral_branch', 'rock'],
      twilight: ['rock', 'shroom', 'tubeworm', 'crystal', 'shroom', 'rock'], frost: ['ice_wall', 'crystal', 'rock', 'ice_wall', 'crystal', 'rock'],
      trench: ['pillar', 'rock', 'crystal', 'arch', 'glyph', 'rock'],
    }[id];
    for (let i = 0; i < n; i++) {
      const u = i / n;
      out.push({ type: pools[Math.floor(hash(i * 3 + zone.tier) * pools.length)], x: u + hash(i + zone.tier * 9) * (0.6 / n), s: 0.6 + hash(i * 7 + zone.tier) * 0.9, seed: i * 5 + zone.tier * 100, front: hash(i * 11) > 0.55 });
    }
    if (id === 'kelp') out.push({ type: 'wreck', x: 0.8, s: 1.6, seed: 5, front: false });
    if (id === 'trench') { out.push({ type: 'pillar', x: 0.2, s: 1.8, seed: 2, front: false }); out.push({ type: 'arch', x: 0.62, s: 1.9, seed: 3, front: false }); }
    return out.sort((a, b) => (a.front === b.front ? 0 : a.front ? 1 : -1));
  }

  // ---------- events ----------
  onFx(e) {
    if (e.type === 'splash') this.splash(this.hookWorld().x, this.layout().wl, e.small ? 0.6 : 1.4);
  }
  onCatch(info) {
    this.petHappy = 1.3;
    const L = this.layout(), b = this.boatPos();
    const ri = info.sp ? RARITY[info.sp.rarity].index : (info.kind === 'treasure' ? 2 : 0);
    const col = RARITY[info.rarity || 'common'].color;
    const n = [8, 14, 24, 40, 80, 140][ri] * (this.g.state.settings.lowFx ? 0.5 : 1);
    for (let i = 0; i < n; i++) this.parts.push({ type: 'spark', x: b.x + rnd(-40, 40) * L.u, y: b.y - rnd(40, 100) * L.u, vx: rnd(-90, 90) * (1 + ri * 0.2), vy: rnd(-220, -40) * (1 + ri * 0.15), g: 260, life: 0, max: rnd(0.8, 1.6), size: rnd(2, 5 + ri), color: Math.random() < 0.5 ? col : (ri >= 5 ? '#ffd0f0' : '#fff6c8') });
    if (ri >= 4) this.flash = { color: ri >= 5 ? '#ff9ad0' : '#ffd870', t: 0, max: ri >= 5 ? 1.8 : 1.2 };
    this.splash(b.x + 70 * L.u * this.ds, L.wl, 1);
  }
  splash(x, y, k = 1) {
    const n = Math.round(10 * k * (this.g.state.settings.lowFx ? 0.5 : 1));
    for (let i = 0; i < n; i++) this.parts.push({ type: 'drop', x: x + rnd(-8, 8), y, vx: rnd(-50, 50), vy: rnd(-180, -60) * k, g: 420, life: 0, max: rnd(0.5, 0.9), size: rnd(1.5, 3.5) });
    this.parts.push({ type: 'ring', x, y, life: 0, max: 0.9, size: 8 * k });
  }

  // ---------- layout ----------
  layout() {
    const W = this.W, H = this.H;
    const u = clamp(Math.min(W / 1280, H / 720), 0.55, 1.35);
    const wl = H * 0.36, sb = H * 0.93;
    return { W, H, u, wl, sb };
  }
  yOfDepth(f) { const L = this.layout(); return L.wl + 10 * L.u + f * (L.sb - L.wl - 50 * L.u); }
  boatPos() {
    const L = this.layout(), g = this.g;
    const bob = Math.sin(this.t * 1.4) * 3 * L.u + Math.sin(this.t * 0.7 + 2) * 1.5 * L.u;
    return { x: g.boatX * L.W, y: L.wl + bob, tilt: Math.sin(this.t * 1.1 + 1) * 0.022 + clamp(g.boatVel * 0.5, -0.05, 0.05) };
  }
  toWorld(lx, ly) {
    const L = this.layout(), b = this.boatPos(), c = Math.cos(b.tilt), s = Math.sin(b.tilt);
    const x1 = lx * L.u * this.ds, y1 = ly * L.u;
    return { x: b.x + x1 * c - y1 * s, y: b.y + x1 * s + y1 * c };
  }
  hookWorld() { return { x: this.hookX * this.layout().W, y: this.hookY }; }

  // ---------- main frame ----------
  frame(dt, mouse) {
    dt = Math.min(dt, 0.05);
    this.t += dt;
    if (mouse) this.mouse = mouse;
    const ctx = this.ctx, g = this.g, L = this.layout();
    ctx.save();
    ctx.clearRect(0, 0, L.W, L.H);
    this.petHappy = Math.max(0, this.petHappy - dt);
    if (this.shake > 0) { this.shake -= dt; ctx.translate(Math.sin(this.t * 60) * 3 * this.shake, 0); }
    const target = g.boatDir; this.ds += (target - this.ds) * Math.min(1, dt * 9);
    if (g.state.mode === 'harbor') this.drawHarbor(ctx, L, dt);
    else this.drawSea(ctx, L, dt);
    this.updateParts(dt);
    this.drawParts(ctx, L);
    // storybook finishing: paper grain + soft vignette
    ctx.globalAlpha = 0.5; ctx.fillStyle = this.grainPat; ctx.fillRect(0, 0, L.W, L.H); ctx.globalAlpha = 1;
    const v = ctx.createRadialGradient(L.W / 2, L.H / 2, Math.min(L.W, L.H) * 0.45, L.W / 2, L.H / 2, Math.max(L.W, L.H) * 0.75);
    v.addColorStop(0, 'rgba(40,30,20,0)'); v.addColorStop(1, 'rgba(40,30,20,0.22)');
    ctx.fillStyle = v; ctx.fillRect(0, 0, L.W, L.H);
    if (this.flash) {
      this.flash.t += dt; const k = 1 - this.flash.t / this.flash.max;
      if (k <= 0) this.flash = null; else { ctx.fillStyle = rgba(this.flash.color, 0.28 * k); ctx.fillRect(0, 0, L.W, L.H); }
    }
    ctx.restore();
  }

  // ---------- sky ----------
  drawSky(ctx, L, th, night, dt, wlY) {
    const top = mix(th.skyDay[0], th.skyNight[0], night), bot = mix(th.skyDay[1], th.skyNight[1], night);
    const g = ctx.createLinearGradient(0, 0, 0, wlY); g.addColorStop(0, top); g.addColorStop(1, bot);
    ctx.fillStyle = g; ctx.fillRect(0, 0, L.W, wlY + 2);
    const w = this.world, clock = this.g.state.clock;
    // stars
    if (night > 0.1) for (const s of w.stars) { ctx.globalAlpha = night * (0.5 + 0.5 * Math.sin(this.t * 1.5 + s.ph)); ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(s.x * L.W, s.y * wlY * 1.4, s.r * L.u, 0, TAU); ctx.fill(); }
    ctx.globalAlpha = 1;
    // aurora
    if (th.island === 'ice') {
      const a = 0.3 + night * 0.6;
      for (let i = 0; i < 4; i++) {
        ctx.beginPath(); ctx.moveTo(0, wlY * 0.5);
        for (let x = 0; x <= L.W; x += 24) ctx.lineTo(x, wlY * (0.18 + i * 0.06) + Math.sin(x * 0.006 + this.t * 0.5 + i) * 22 * L.u + Math.sin(x * 0.013 - this.t * 0.8) * 8);
        ctx.lineTo(L.W, wlY * 0.7); ctx.lineTo(0, wlY * 0.7); ctx.closePath();
        const gg = ctx.createLinearGradient(0, wlY * 0.1, 0, wlY * 0.7); const c = ['#7af0c8', '#9ab8ff', '#c8a0ff', '#7ae0ff'][i];
        gg.addColorStop(0, rgba(c, 0.5 * a)); gg.addColorStop(1, rgba(c, 0));
        ctx.fillStyle = gg; ctx.fill();
      }
    }
    // sun & moon on arcs
    const sunA = clock * TAU - Math.PI / 2 + Math.PI / 2; // 0.25 = noon
    const ang = (clock - 0.0) * TAU;
    const sx = L.W * (0.5 - Math.cos(ang) * 0.42), sy = wlY * 0.95 - Math.sin(ang) * wlY * 0.85;
    const mx = L.W * (0.5 + Math.cos(ang) * 0.42), my = wlY * 0.95 + Math.sin(ang) * wlY * 0.85;
    if (sy < wlY) { glow(ctx, sx, sy, 90 * L.u, '#fff1b0', 0.55 * (1 - night)); ctx.beginPath(); ctx.arc(sx, sy, 24 * L.u, 0, TAU); paint(ctx, '#ffe9a0', 2, '#d9a550'); }
    if (my < wlY && night > 0.2) { ctx.globalAlpha = night; glow(ctx, mx, my, 70 * L.u, '#dfe8ff', 0.4); ctx.beginPath(); ctx.arc(mx, my, 18 * L.u, 0, TAU); paint(ctx, '#f4f0dc', 1.6, '#8a98b8'); ctx.fillStyle = 'rgba(160,170,200,.35)'; ctx.beginPath(); ctx.arc(mx - 5 * L.u, my - 3 * L.u, 4 * L.u, 0, TAU); ctx.arc(mx + 6 * L.u, my + 5 * L.u, 3 * L.u, 0, TAU); ctx.fill(); ctx.globalAlpha = 1; }
    // clouds
    for (const c of w.clouds) {
      c.x += c.v * dt * 0.5; if (c.x > 1.2) c.x = -0.2;
      cloud(ctx, c.x * L.W, wlY * (0.1 + c.y * 2), c.s * L.u * 0.9, c.seed, mix('#ffffff', th.skyNight[1], night * 0.7), 0.9 - night * 0.3);
    }
    // birds
    for (const b of w.birds) { b.x += b.v * dt; if (b.x > 1.1) b.x = -0.1; gull(ctx, b.x * L.W, wlY * (b.y * 2.2) + Math.sin(this.t + b.ph) * 4, 1.1 * L.u, this.t + b.ph, mix('#ffffff', '#5a6a88', night)); }
  }

  drawIslands(ctx, L, th, night, wlY) {
    const seed = this.world.zone.tier;
    const specs = [[0.12, 0.2, 0.22], [0.55, 0.11, 0.18], [0.86, 0.16, 0.2]];
    specs.forEach((s, i) => {
      if (th.island === 'ice' && i === 0) return; // left side has the glacier cave
      island(ctx, L.W * s[0], wlY + 2, L.W * s[2], L.H * s[1], th.island, seed * 10 + i * 3, 0.35, night);
    });
  }

  waveBand(ctx, L, y, amp, len, speed, ph, color, bottom, alpha = 1) {
    ctx.beginPath(); ctx.moveTo(0, bottom);
    for (let x = 0; x <= L.W + 12; x += 12) ctx.lineTo(x, y + Math.sin(x / len + this.t * speed + ph) * amp + Math.sin(x / (len * 0.43) - this.t * speed * 1.3 + ph) * amp * 0.4);
    ctx.lineTo(L.W, bottom); ctx.closePath(); ctx.globalAlpha = alpha; ctx.fillStyle = color; ctx.fill(); ctx.globalAlpha = 1;
  }
  waveFoam(ctx, L, y, amp, len, speed, ph, color) {
    ctx.strokeStyle = color; ctx.lineWidth = 2.2 * L.u; ctx.lineCap = 'round'; ctx.beginPath();
    for (let x = 0; x <= L.W + 12; x += 10) { const yy = y + Math.sin(x / len + this.t * speed + ph) * amp + Math.sin(x / (len * 0.43) - this.t * speed * 1.3 + ph) * amp * 0.4; x ? ctx.lineTo(x, yy) : ctx.moveTo(x, yy); }
    ctx.setLineDash([14 * L.u, 22 * L.u]); ctx.lineDashOffset = -this.t * 18; ctx.stroke(); ctx.setLineDash([]);
  }

  // ---------- fishing scene ----------
  drawSea(ctx, L, dt) {
    const g = this.g, st = g.state, w = this.world, th = w.th, fs = g.fishing, fx = getEffects(st);
    const night = nightness(st.clock) * (th.dark > 0.3 ? 0.85 : 1);
    const { wl, sb, u, W, H } = L;
    this.drawSky(ctx, L, th, night, dt, wl);
    this.drawIslands(ctx, L, th, night, wl);
    this.drawSeaFeatures(ctx, L, th, night);
    // underwater gradient
    const wg = ctx.createLinearGradient(0, wl, 0, H);
    const dk = (c, k) => mix(c, '#0a1030', clamp(k + night * 0.38 * (1 - th.dark), 0, 0.92));
    wg.addColorStop(0, dk(th.water[0], 0)); wg.addColorStop(0.45, dk(th.water[1], 0.04 + th.dark * 0.3)); wg.addColorStop(1, dk(th.water[2], 0.1 + th.dark * 0.4));
    ctx.fillStyle = wg; ctx.fillRect(0, wl, W, H - wl);
    // light rays
    const rayK = th.rays * (1 - night * 0.8);
    if (rayK > 0.05) for (let i = 0; i < 6; i++) {
      const x0 = ((i * 0.19 + 0.05 + Math.sin(this.t * 0.15 + i) * 0.03) % 1.1) * W, wd = (60 + hash(i + 9) * 70) * u;
      const rg = ctx.createLinearGradient(0, wl, 0, wl + (sb - wl) * 0.8); rg.addColorStop(0, `rgba(255,255,230,${0.2 * rayK})`); rg.addColorStop(1, 'rgba(255,255,230,0)');
      ctx.fillStyle = rg; ctx.beginPath(); ctx.moveTo(x0, wl); ctx.lineTo(x0 + wd, wl); ctx.lineTo(x0 + wd * 1.8 - 120 * u, wl + (sb - wl) * 0.8); ctx.lineTo(x0 - wd * 0.6 - 120 * u, wl + (sb - wl) * 0.8); ctx.closePath(); ctx.fill();
    }
    // seabed + back deco
    ctx.save(); ctx.beginPath(); ctx.rect(0, wl, W, H - wl); ctx.clip();
    this.drawSeabed(ctx, L, th, w, false);
    // fish
    this.updateFish(dt, L);
    for (const s of w.schools) this.drawSchool(ctx, L, s, dt);
    for (const f of w.fish) this.drawAmbientFish(ctx, L, f);
    // bite fish
    this.drawBiteFish(ctx, L, fs, st, dt);
    this.drawSeabed(ctx, L, th, w, true);
    // depth fog
    const fog = ctx.createLinearGradient(0, wl, 0, H); fog.addColorStop(0, rgba(th.fog, 0)); fog.addColorStop(1, rgba(th.fog, 0.5 + th.dark * 0.3));
    ctx.fillStyle = fog; ctx.fillRect(0, wl, W, H - wl);
    if (night > 0 && th.dark < 0.3) { ctx.fillStyle = `rgba(10,16,50,${night * 0.28})`; ctx.fillRect(0, wl, W, H - wl); }
    this.drawDepthGuide(ctx, L, fs, fx);
    ctx.restore();
    // surface back waves
    this.waveBand(ctx, L, wl + 2 * u, 3 * u, 70 * u, 1.1, 0, mix(th.water[0], '#ffffff', 0.18 - night * 0.1), wl + 40 * u, 0.9);
    this.waveFoam(ctx, L, wl + 1 * u, 3 * u, 70 * u, 1.1, 0, rgba(th.foam, 0.7));
    // boat + fisherman
    this.drawBoatScene(ctx, L, fs, st, fx, night, dt);
    // front waves
    const bp = this.boatPos();
    this.waveBand(ctx, L, wl + 10 * u, 3.4 * u, 90 * u, 1.4, 1.5, mix(th.water[0], th.water[1], 0.25), wl + 90 * u, 0.78);
    this.waveFoam(ctx, L, wl + 10 * u, 3.4 * u, 90 * u, 1.4, 1.5, rgba(th.foam, 0.55));
    // line + hook after wave so it is always visible
    this.drawLine(ctx, L, fs, st, fx, dt);
    // ambient particles
    this.spawnAmbient(dt, L, th);
    if (st.mode === 'fish' && fs.flash > 0) { ctx.fillStyle = `rgba(200,80,60,${fs.flash * 0.15})`; ctx.fillRect(0, 0, W, H); }
  }

  drawSeaFeatures(ctx, L, th, night) {
    const { W, wl, u } = L;
    if (th.island === 'ice') {
      // glacier cliff on the left with a glittering cave (secret)
      const found = this.g.state.secrets.found.frost_cave;
      ctx.save(); ctx.translate(0, wl);
      ctx.beginPath(); ctx.moveTo(-10, 6); ctx.lineTo(-10, -L.H * 0.2); ctx.lineTo(W * 0.04, -L.H * 0.24); ctx.lineTo(W * 0.09, -L.H * 0.14); ctx.lineTo(W * 0.135, -L.H * 0.04); ctx.lineTo(W * 0.15, 6); ctx.closePath();
      paint(ctx, mix('#e4f2fc', '#2a3a6a', night * 0.5), 2, '#6a8aaa');
      ctx.beginPath(); ctx.moveTo(W * 0.035, 4); ctx.quadraticCurveTo(W * 0.04, -L.H * 0.1, W * 0.07, -L.H * 0.1); ctx.quadraticCurveTo(W * 0.1, -L.H * 0.1, W * 0.1, 4); ctx.closePath(); paint(ctx, '#16284a', 2, '#4a6a8a');
      for (let i = 0; i < 5; i++) sparkle(ctx, W * (0.045 + i * 0.012), -L.H * (0.04 + hash(i) * 0.05), (3 + hash(i + 4) * 3) * u, '#e8ffff', this.t * (1 + i * 0.2) + i);
      if (found) glow(ctx, W * 0.07, -L.H * 0.05, 60 * u, '#9ff0ff', 0.5);
      ctx.restore();
      // icebergs
      for (let i = 0; i < 3; i++) {
        const x = W * (0.3 + i * 0.27), s = (0.7 + hash(i + 3) * 0.6) * u;
        ctx.save(); ctx.translate(x, wl + 2); ctx.beginPath(); ctx.moveTo(-50 * s, 0); ctx.lineTo(-30 * s, -34 * s); ctx.lineTo(-8 * s, -26 * s); ctx.lineTo(14 * s, -58 * s); ctx.lineTo(40 * s, -20 * s); ctx.lineTo(56 * s, 0); ctx.closePath(); paint(ctx, mix('#f4fbff', '#2a3a6a', night * 0.5), 2, '#7a9ab8');
        ctx.beginPath(); ctx.moveTo(14 * s, -58 * s); ctx.lineTo(40 * s, -20 * s); ctx.lineTo(10 * s, -14 * s); ctx.closePath(); ctx.fillStyle = 'rgba(150,190,220,.5)'; ctx.fill(); ctx.restore();
      }
    }
    if (th.deco === 'kelp') { // floating kelp mats on the surface
      for (let i = 0; i < 5; i++) { ctx.fillStyle = mix('#4a8a52', '#1a2a3a', night * 0.5); organic(ctx, W * (0.1 + i * 0.2) + Math.sin(this.t * 0.4 + i) * 6, wl + 4 * u, 34 * u, 5 * u, i, 8, 0.2); ctx.fill(); }
    }
    if (th.deco === 'trench') { // glowing surface runes
      for (let i = 0; i < 4; i++) { ctx.save(); ctx.translate(W * (0.15 + i * 0.22), wl - 8 * u + Math.sin(this.t + i) * 3); ctx.globalAlpha = 0.5 + 0.4 * Math.sin(this.t * 1.5 + i); this.rune(ctx, 0, 0, 14 * u, '#c8a8ff'); ctx.restore(); }
    }
  }

  rune(ctx, x, y, r, color) {
    ctx.strokeStyle = color; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x, y - r * 0.7); ctx.lineTo(x + r * 0.6, y + r * 0.5); ctx.lineTo(x - r * 0.6, y + r * 0.5); ctx.closePath(); ctx.stroke();
    ctx.beginPath(); ctx.arc(x, y + r * 0.05, r * 0.15, 0, TAU); ctx.stroke(); glow(ctx, x, y, r * 2, color, 0.25);
  }

  // ---------- seabed & decorations ----------
  drawSeabed(ctx, L, th, w, front) {
    const { W, H, sb, u } = L;
    if (!front) {
      ctx.beginPath(); ctx.moveTo(0, H);
      for (let x = 0; x <= W + 20; x += 20) ctx.lineTo(x, sb - 18 * u + Math.sin(x * 0.012 + w.seed) * 9 * u + Math.sin(x * 0.031) * 4 * u);
      ctx.lineTo(W, H); ctx.closePath();
      const g = ctx.createLinearGradient(0, sb - 30 * u, 0, H); g.addColorStop(0, th.seabed); g.addColorStop(1, th.seabed2);
      ctx.fillStyle = g; ctx.fill(); ctx.strokeStyle = rgba(INK, 0.4); ctx.lineWidth = 2; ctx.stroke();
      ctx.fillStyle = rgba(th.seabed2, 0.5); for (let i = 0; i < 40; i++) { ctx.beginPath(); ctx.arc(hash(i) * W, sb + hash(i * 3) * (H - sb), 1.5 * u + hash(i * 7) * 2 * u, 0, TAU); ctx.fill(); }
    }
    for (const d of w.deco) {
      if (d.front !== front) continue;
      const x = d.x * W, y = sb - 14 * u + Math.sin(x * 0.012 + w.seed) * 9 * u + Math.sin(x * 0.031) * 4 * u + (front ? 14 * u : 0);
      this.drawDeco(ctx, d, x, y, d.s * u * (front ? 1.15 : 0.9), th);
    }
  }

  drawDeco(ctx, d, x, y, s, th) {
    const t = this.t, sd = d.seed;
    ctx.save(); ctx.translate(x, y); ctx.scale(s, s); ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    switch (d.type) {
      case 'pebbles': for (let i = 0; i < 4; i++) { organic(ctx, i * 14 - 20, -4 + (i % 2) * 3, 8 + hash(sd + i) * 5, 5 + hash(sd + i * 2) * 3, sd + i, 7, 0.1); paint(ctx, ['#c8c0b0', '#b0a898', '#d8d0c0', '#a8a090'][i], 1.5); } break;
      case 'rock': organic(ctx, 0, -14, 28, 20, sd, 9, 0.15); paint(ctx, mix('#8a8a96', th.seabed2, 0.25), 2); ctx.fillStyle = 'rgba(255,255,255,.2)'; organic(ctx, -8, -22, 12, 6, sd + 1, 7, 0.1); ctx.fill(); if (th.deco === 'kelp' || th.deco === 'pebble') { ctx.fillStyle = 'rgba(70,130,70,.6)'; organic(ctx, 6, -30, 10, 4, sd + 2, 7, 0.2); ctx.fill(); } break;
      case 'shell': ctx.beginPath(); ctx.moveTo(0, 0); ctx.bezierCurveTo(-18, -4, -14, -26, 0, -26); ctx.bezierCurveTo(14, -26, 18, -4, 0, 0); paint(ctx, '#f6c8c0', 1.6); ctx.strokeStyle = '#d89a98'; ctx.lineWidth = 1; for (let i = -2; i <= 2; i++) { ctx.beginPath(); ctx.moveTo(0, -1); ctx.lineTo(i * 5, -23); ctx.stroke(); } break;
      case 'grass': for (let i = 0; i < 6; i++) { const sw = Math.sin(t * 1.4 + sd + i) * 6; ctx.beginPath(); ctx.moveTo(i * 4 - 10, 0); ctx.quadraticCurveTo(i * 4 - 10 + sw * 0.6, -20, i * 4 - 10 + sw, -34 - (i % 3) * 8); ctx.lineWidth = 3; ctx.strokeStyle = ['#5a9a5a', '#6aaa62', '#4a8a56'][i % 3]; ctx.stroke(); } break;
      case 'kelp': { const hgt = 140 + hash(sd) * 120, col = ['#4f8f4a', '#5fa055', '#3f7f4a'][sd % 3]; for (let k = 0; k < 2; k++) { ctx.beginPath(); ctx.moveTo(k * 10, 0); for (let i = 1; i <= 14; i++) ctx.lineTo(k * 10 + Math.sin(t * 0.9 + sd + i * 0.5 + k) * (3 + i * 1.2), -i * hgt / 14); ctx.lineWidth = 5; ctx.strokeStyle = INK; ctx.stroke(); ctx.lineWidth = 3; ctx.strokeStyle = col; ctx.stroke(); } for (let i = 3; i <= 13; i += 2) { const px = Math.sin(t * 0.9 + sd + i * 0.5) * (3 + i * 1.2); ctx.beginPath(); ctx.ellipse(px + 8, -i * hgt / 14, 11, 4, -0.5 + Math.sin(t + i) * 0.2, 0, TAU); ctx.fillStyle = col; ctx.fill(); ctx.lineWidth = 1; ctx.strokeStyle = INK; ctx.stroke(); } break; }
      case 'wreck': ctx.strokeStyle = INK; ctx.fillStyle = '#6a4a30'; for (let i = 0; i < 5; i++) { ctx.beginPath(); ctx.moveTo(-60 + i * 28, 0); ctx.quadraticCurveTo(-64 + i * 28, -60 - i * 6, -40 + i * 26, -92 + i * 8); ctx.lineTo(-33 + i * 26, -88 + i * 8); ctx.quadraticCurveTo(-56 + i * 28, -56 - i * 6, -52 + i * 28, 0); ctx.closePath(); ctx.fill(); ctx.lineWidth = 2; ctx.stroke(); } ctx.fillStyle = '#4a3220'; ctx.fillRect(-70, -10, 150, 12); ctx.strokeRect(-70, -10, 150, 12); ctx.fillStyle = 'rgba(70,130,70,.6)'; organic(ctx, -20, -70, 14, 5, 3, 7, 0.2); ctx.fill(); break;
      case 'coral_branch': { const c = ['#f2788c', '#f2a05a', '#d880c8', '#f0c85a'][sd % 4]; const br = (x, yy, a, len, dp) => { if (dp > 3) return; const x2 = x + Math.cos(a) * len, y2 = yy + Math.sin(a) * len; ctx.beginPath(); ctx.moveTo(x, yy); ctx.lineTo(x2, y2); ctx.lineWidth = 6 - dp * 1.3; ctx.strokeStyle = INK; ctx.stroke(); ctx.lineWidth = 4 - dp * 1.1; ctx.strokeStyle = c; ctx.stroke(); br(x2, y2, a - 0.5 + Math.sin(t + sd) * 0.04, len * 0.7, dp + 1); br(x2, y2, a + 0.5 + Math.sin(t + sd) * 0.04, len * 0.7, dp + 1); }; br(0, 0, -Math.PI / 2, 26, 0); break; }
      case 'coral_brain': organic(ctx, 0, -16, 24, 18, sd, 10, 0.08); paint(ctx, ['#e8a0b8', '#e8c070', '#a8c8e8'][sd % 3], 2); ctx.strokeStyle = 'rgba(80,40,60,.35)'; ctx.lineWidth = 1.4; for (let i = 0; i < 5; i++) { ctx.beginPath(); ctx.moveTo(-18, -8 - i * 5); ctx.bezierCurveTo(-8, -14 - i * 5, 6, -4 - i * 5, 18, -10 - i * 5); ctx.stroke(); } break;
      case 'coral_fan': ctx.beginPath(); ctx.moveTo(0, 0); for (let i = 0; i <= 10; i++) { const a = -Math.PI + (i / 10) * Math.PI; ctx.lineTo(Math.cos(a) * 34 * (i % 2 ? 0.9 : 1), -8 + Math.sin(a) * 40 * (i % 2 ? 0.9 : 1) - 8); } ctx.closePath(); paint(ctx, ['#e86a9a', '#b06ad8', '#f28a5a'][sd % 3], 2); ctx.strokeStyle = 'rgba(255,255,255,.35)'; ctx.lineWidth = 1; for (let i = 1; i < 10; i++) { ctx.beginPath(); ctx.moveTo(0, -2); ctx.lineTo(Math.cos(-Math.PI + i * Math.PI / 10) * 30, -16 + Math.sin(-Math.PI + i * Math.PI / 10) * 34); ctx.stroke(); } break;
      case 'anemone': for (let i = 0; i < 9; i++) { const sw = Math.sin(t * 1.6 + i + sd) * 5; ctx.beginPath(); ctx.moveTo(i * 3 - 12, 0); ctx.quadraticCurveTo(i * 4 - 16 + sw, -22, i * 5 - 20 + sw * 1.5, -38 - (i % 3) * 5); ctx.lineWidth = 3.4; ctx.strokeStyle = ['#f08ab8', '#f2a8d0', '#e870a0'][i % 3]; ctx.stroke(); ctx.beginPath(); ctx.arc(i * 5 - 20 + sw * 1.5, -38 - (i % 3) * 5, 2.4, 0, TAU); ctx.fillStyle = '#fff0f6'; ctx.fill(); } organic(ctx, 0, -2, 18, 7, sd, 7, 0.1); paint(ctx, '#c86a98', 1.6); break;
      case 'shroom': { const ph = 0.6 + 0.4 * Math.sin(t * 1.6 + sd); glow(ctx, 0, -40, 54, '#7ad8ff', 0.3 * ph); ctx.beginPath(); ctx.moveTo(-3, 0); ctx.quadraticCurveTo(-4, -26, 0, -40); ctx.lineTo(4, -40); ctx.quadraticCurveTo(4, -26, 3, 0); ctx.closePath(); paint(ctx, '#5a6aa8', 1.6); ctx.beginPath(); ctx.moveTo(-22, -36); ctx.quadraticCurveTo(0, -66, 22, -36); ctx.quadraticCurveTo(0, -30, -22, -36); ctx.closePath(); paint(ctx, mix('#6a8aff', '#aaf0ff', ph * 0.5), 1.8); ctx.fillStyle = '#e8ffff'; for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.arc(-10 + i * 7, -44 + (i % 2) * 5, 2, 0, TAU); ctx.fill(); } break; }
      case 'tubeworm': for (let i = 0; i < 4; i++) { const sw = Math.sin(t * 1.2 + i + sd) * 4; ctx.beginPath(); ctx.moveTo(i * 8 - 12, 0); ctx.quadraticCurveTo(i * 8 - 12 + sw, -26, i * 8 - 12 + sw * 1.5, -44 - i * 6); ctx.lineWidth = 6; ctx.strokeStyle = INK; ctx.stroke(); ctx.lineWidth = 4; ctx.strokeStyle = '#6a5a98'; ctx.stroke(); const tx = i * 8 - 12 + sw * 1.5, ty = -44 - i * 6; glow(ctx, tx, ty, 16, '#ff7ac8', 0.5 + 0.3 * Math.sin(t * 2 + i)); ctx.beginPath(); ctx.arc(tx, ty, 4, 0, TAU); ctx.fillStyle = '#ff9ad8'; ctx.fill(); } break;
      case 'crystal': { const c = th.deco === 'frost' ? ['#bfe8ff', '#e8f8ff'] : ['#a07aff', '#d8c0ff']; for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.moveTo(i * 16 - 22, 0); ctx.lineTo(i * 16 - 26 + (i === 1 ? 4 : 0), -34 - i % 2 * 18 - 10); ctx.lineTo(i * 16 - 14, -4); ctx.closePath(); paint(ctx, c[i % 2], 1.8); ctx.fillStyle = 'rgba(255,255,255,.4)'; ctx.beginPath(); ctx.moveTo(i * 16 - 26, -40 - i % 2 * 18); ctx.lineTo(i * 16 - 22, -8); ctx.lineTo(i * 16 - 20, -30); ctx.fill(); } glow(ctx, 0, -26, 40, c[0], 0.25 + 0.1 * Math.sin(t + sd)); break; }
      case 'ice_wall': ctx.beginPath(); ctx.moveTo(-40, 0); ctx.lineTo(-34, -52); ctx.lineTo(-14, -70); ctx.lineTo(6, -48); ctx.lineTo(24, -82); ctx.lineTo(44, -30); ctx.lineTo(50, 0); ctx.closePath(); paint(ctx, 'rgba(200,232,250,.9)', 2, '#6a98b8'); ctx.fillStyle = 'rgba(255,255,255,.4)'; ctx.beginPath(); ctx.moveTo(-14, -70); ctx.lineTo(6, -48); ctx.lineTo(-6, -20); ctx.lineTo(-24, -30); ctx.fill(); break;
      case 'pillar': ctx.fillStyle = '#5a4a8a'; ctx.beginPath(); ctx.moveTo(-18, 0); ctx.lineTo(-14, -120); ctx.lineTo(-18, -128); ctx.lineTo(18, -128); ctx.lineTo(14, -90); ctx.lineTo(20, -40); ctx.lineTo(18, 0); ctx.closePath(); paint(ctx, '#5a4a8a', 2); ctx.save(); ctx.globalAlpha = 0.5 + 0.4 * Math.sin(t * 1.5 + sd); this.rune(ctx, 0, -70, 9, '#c8a8ff'); ctx.restore(); break;
      case 'arch': ctx.beginPath(); ctx.moveTo(-70, 0); ctx.lineTo(-70, -110); ctx.quadraticCurveTo(0, -190, 70, -110); ctx.lineTo(70, 0); ctx.lineTo(48, 0); ctx.lineTo(48, -100); ctx.quadraticCurveTo(0, -150, -48, -100); ctx.lineTo(-48, 0); ctx.closePath(); paint(ctx, '#4a3a78', 2.4); ctx.save(); ctx.globalAlpha = 0.5 + 0.4 * Math.sin(t * 1.2 + sd); this.rune(ctx, 0, -150, 12, '#ffd870'); ctx.restore(); break;
      case 'glyph': ctx.save(); ctx.translate(0, -50 + Math.sin(t * 0.9 + sd) * 10); ctx.rotate(Math.sin(t * 0.3 + sd) * 0.2); ctx.globalAlpha = 0.6; this.rune(ctx, 0, 0, 20, '#d8b8ff'); ctx.restore(); break;
    }
    ctx.restore();
  }

  // ---------- ambient life ----------
  updateFish(dt, L) {
    const w = this.world;
    for (const f of w.fish) {
      f.x += f.dir * f.v * dt; f.ph += dt;
      if ((f.dir > 0 && f.x > 1.2) || (f.dir < 0 && f.x < -0.2)) Object.assign(f, this.newAmbient(w.sp, false));
    }
  }
  drawAmbientFish(ctx, L, f) {
    const sz = fishPixels(f.len, L.u * 0.62) * f.size;
    const y = this.yOfDepth(f.d) + Math.sin(f.ph * 1.3) * 10 * L.u;
    const x = f.x * L.W;
    drawFish(ctx, f.sp, { x, y, size: sz, dir: f.dir, t: f.ph, tilt: Math.sin(f.ph * 1.3) * 0.06 * f.dir, sil: true, alpha: 0.42 });
  }
  drawSchool(ctx, L, s, dt) {
    s.x += s.v * dt; if (s.x > 1.2) s.x = -0.2; if (s.x < -0.2) s.x = 1.2;
    ctx.fillStyle = rgba('#173a5a', 0.3);
    for (let i = 0; i < s.n; i++) {
      const a = i * 2.4 + s.ph, px = s.x * L.W + Math.cos(a) * (30 + i * 5) * L.u + Math.sin(this.t * 1.4 + i) * 6 * L.u, py = this.yOfDepth(s.d) + Math.sin(a * 1.7 + this.t * 0.9) * 34 * L.u;
      const dir = s.v > 0 ? 1 : -1, sz = 7 * L.u;
      ctx.save(); ctx.translate(px, py); ctx.scale(dir, 1); ctx.beginPath(); ctx.ellipse(0, 0, sz, sz * 0.4, 0, 0, TAU); ctx.fill(); ctx.beginPath(); ctx.moveTo(-sz * 0.8, 0); ctx.lineTo(-sz * 1.6, -sz * 0.5 + Math.sin(this.t * 14 + i) * 2); ctx.lineTo(-sz * 1.6, sz * 0.5 + Math.sin(this.t * 14 + i) * 2); ctx.closePath(); ctx.fill(); ctx.restore();
    }
  }

  drawBiteFish(ctx, L, fs, st, dt) {
    const pend = fs.pending;
    const hook = this.hookWorld();
    if (!pend) return;
    if ((fs.state === FS.WAIT || fs.state === FS.BITE) && pend.kind === 'fish') {
      const a = fs.approach(), e = a * a * (3 - 2 * a);
      const dir = this.biteDir || (this.biteDir = Math.random() < 0.5 ? 1 : -1);
      const startX = hook.x - dir * L.W * 0.5;
      const x = lerp(startX, hook.x - dir * 22 * L.u, e);
      const sz = fishPixels(pend.item.l, L.u * 0.62);
      const wob = fs.state === FS.BITE ? Math.sin(this.t * 30) * 3 * L.u : 0;
      const sp = pend.sp, ri = RARITY[sp.rarity].index;
      if (ri >= 4) glow(ctx, x, hook.y, sz * 0.9, RARITY[sp.rarity].color, 0.25 + 0.1 * Math.sin(this.t * 3));
      drawFish(ctx, sp, { x, y: hook.y + wob * 0.5 + Math.sin(this.t * 2.6) * 4 * L.u, size: sz, dir, t: this.t, sil: true, alpha: 0.55, tilt: fs.state === FS.BITE ? Math.sin(this.t * 25) * 0.12 : 0 });
    } else if (fs.state === FS.BITE) { // junk/treasure: just bubbles and a tug
      if (Math.random() < 0.3) this.parts.push({ type: 'bubble', x: hook.x + rnd(-8, 8), y: hook.y, vx: 0, vy: -rnd(30, 60), life: 0, max: 1.4, size: rnd(2, 4) });
    }
    if (fs.state === FS.DESCEND || fs.state === FS.CASTING) this.biteDir = 0;
  }

  drawDepthGuide(ctx, L, fs, fx) {
    const g = this.g;
    if (g.state.mode !== 'fish') return;
    const { W, u } = L;
    ctx.save(); ctx.font = `${11 * u}px system-ui, sans-serif`; ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
    const bounds = [0.3, 0.6], names = ['SURFACE', 'MIDWATER', 'DEEP'];
    ctx.strokeStyle = 'rgba(255,255,255,.18)'; ctx.setLineDash([4, 8]); ctx.lineWidth = 1;
    for (const b of bounds) { const y = this.yOfDepth(b - 0.03); ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
    ctx.setLineDash([]); ctx.fillStyle = 'rgba(255,255,255,.35)';
    ctx.fillText(names[0], W - 12, this.yOfDepth(0.15)); ctx.fillText(names[1], W - 12, this.yOfDepth(0.45)); ctx.fillText(names[2], W - 12, this.yOfDepth(0.8));
    // line limit
    const ly = this.yOfDepth(fx.maxDepth);
    if (fx.maxDepth < 0.99) { ctx.strokeStyle = 'rgba(255,200,120,.45)'; ctx.setLineDash([10, 6]); ctx.beginPath(); ctx.moveTo(0, ly); ctx.lineTo(W, ly); ctx.stroke(); ctx.setLineDash([]); ctx.fillStyle = 'rgba(255,214,150,.7)'; ctx.fillText('line limit', W - 12, ly - 9 * u); }
    if (!fs.busy && fs.state !== FS.PRESENT) {
      const y = this.yOfDepth(fs.depth), x = this.tipW.x || g.boatX * W;
      ctx.strokeStyle = 'rgba(255,255,255,.55)'; ctx.setLineDash([3, 6]); ctx.beginPath(); ctx.moveTo(x, L.wl); ctx.lineTo(x, y); ctx.stroke(); ctx.setLineDash([]);
      ctx.beginPath(); ctx.arc(x, y, 5 * u, 0, TAU); ctx.fillStyle = 'rgba(255,255,255,.85)'; ctx.fill(); ctx.strokeStyle = INK; ctx.stroke();
    }
    ctx.restore();
  }

  // ---------- boat ----------
  drawBoatScene(ctx, L, fs, st, fx, night, dt) {
    const bp = this.boatPos(), u = L.u, tier = st.equipped.boat, m = BOAT_META[tier];
    const deco = st.cosmetics.active ? DECO_BY_ID[st.cosmetics.active].color : null;
    ctx.save(); ctx.translate(bp.x, bp.y); ctx.rotate(bp.tilt); ctx.scale(u * this.ds, u);
    // reflection / shadow
    ctx.fillStyle = 'rgba(0,30,50,.18)'; ctx.beginPath(); ctx.ellipse(0, 12, m.w * 0.5, 6, 0, 0, TAU); ctx.fill();
    drawBoat(ctx, tier, { t: this.t, deco });
    // pets on deck
    const pet = st.pets.active;
    if (pet && ['cat', 'gull', 'crab'].includes(pet)) { ctx.save(); ctx.translate(m.w * 0.43, -m.h * 0.9); drawPet(ctx, pet, { t: this.t, happy: this.petHappy / 1.3 }); ctx.restore(); }
    if (pet === 'jelly' || pet === 'dragon') { ctx.save(); ctx.translate(m.w * 0.12 + Math.sin(this.t * 0.8) * 14, -m.h * 5.0 + Math.sin(this.t * 1.4) * 6); drawPet(ctx, pet, { t: this.t, happy: this.petHappy / 1.3, scale: 1.1 }); ctx.restore(); }
    // fisherman pose
    let pose = 'idle', p = 0;
    switch (fs.state) {
      case FS.CASTING: pose = 'cast'; p = clamp(fs.t / (CONFIG.fishing.castTime * fx.castMult), 0, 1); break;
      case FS.DESCEND: case FS.WAIT: pose = 'wait'; break;
      case FS.BITE: pose = 'bite'; break;
      case FS.RETRIEVE: pose = 'reel'; break;
      case FS.PRESENT: pose = 'show'; break;
    }
    const rod = RODS[st.equipped.rod];
    const fy = -m.h * 0.78, fxp = m.w * m.deck;
    const r = drawFisherman(ctx, fxp, fy, { pose, p, t: this.t, rodColor: rod.color, rodTier: st.equipped.rod });
    this.tipLocal = r;
    // exclamation
    if (fs.state === FS.BITE) { ctx.save(); ctx.translate(fxp + 8, fy - 92 + Math.sin(this.t * 18) * 2); ctx.beginPath(); ctx.arc(0, 0, 11, 0, TAU); paint(ctx, '#fff6c8', 2); ctx.fillStyle = '#d8503a'; ctx.font = 'bold 17px system-ui'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.scale(this.ds >= 0 ? 1 : -1, 1); ctx.fillText('!', 0, 1); ctx.restore(); }
    ctx.restore();
    // otter floats in water
    if (pet === 'otter') { ctx.save(); ctx.translate(bp.x - 0.62 * m.w * u * this.ds, bp.y + 12 * u + Math.sin(this.t * 1.6) * 2); drawPet(ctx, 'otter', { t: this.t, happy: this.petHappy / 1.3, dir: this.ds >= 0 ? 1 : -1, scale: u * 1.1 }); ctx.restore(); }
    // night lantern glow for bigger boats
    if (night > 0.4 && tier >= 2) { const w = this.toWorld(-m.w * 0.1, -m.h * 2.2); glow(ctx, w.x, w.y, 60 * u, '#ffd890', 0.3 * night); }
    const tip = this.toWorld(this.tipLocal.x, this.tipLocal.y);
    this.tipW = tip;
  }

  // ---------- line & hook ----------
  drawLine(ctx, L, fs, st, fx, dt) {
    if (st.mode !== 'fish') return;
    const tip = this.tipW, u = L.u, wl = L.wl;
    let hx, hy;
    const state = fs.state;
    if (state === FS.READY || state === FS.FULL || state === FS.PRESENT) {
      // rod rests with a short dangling hook
      hx = tip.x + Math.sin(this.t * 1.7) * 3 * u; hy = tip.y + 34 * u;
      this.hookX = hx / L.W; this.hookY = hy; this._hookInit = false;
    } else if (state === FS.CASTING) {
      const p = clamp(fs.t / (CONFIG.fishing.castTime * fx.castMult), 0, 1);
      const tx = tip.x + this.ds * 100 * u;
      hx = lerp(tip.x, tx, p); hy = lerp(tip.y, wl, p * p) - Math.sin(p * Math.PI) * 60 * u;
      this.hookX = hx / L.W; this.hookY = hy; this._hookInit = false;
    } else {
      // in the water: lands ahead of the bow, then drifts gently after the boat
      const ahead = (tip.x + this.ds * 100 * u) / L.W;
      if (!this._hookInit) { this.hookX = ahead; this._hookInit = true; }
      if (state === FS.RETRIEVE) this.hookX += ((tip.x + this.ds * 14 * u) / L.W - this.hookX) * Math.min(1, dt * 1.2);
      else this.hookX += (ahead - this.hookX) * Math.min(1, dt * 0.7);
      hx = this.hookX * L.W + (state === FS.BITE ? Math.sin(this.t * 40) * 2 : Math.sin(this.t * 1.3) * 2 * u);
      hy = fs.hookFrac <= 0 ? wl : this.yOfDepth(fs.hookFrac);
      this.hookY = hy;
    }
    // line
    ctx.save();
    const rodTier = st.equipped.rod;
    ctx.strokeStyle = 'rgba(250,246,230,.9)'; ctx.lineWidth = 1.3; ctx.lineCap = 'round';
    const inWater = state === FS.DESCEND || state === FS.WAIT || state === FS.BITE || state === FS.RETRIEVE;
    const dip = state === FS.BITE ? 7 * u + Math.sin(this.t * 30) * 3 : 0;
    const bx = hx, by = wl + 8 * u + dip + Math.sin(this.t * 2) * 1.5;
    ctx.beginPath(); ctx.moveTo(tip.x, tip.y);
    if (inWater) {
      // rod tip -> float (slack arc through the air), then the line hangs straight down from the float
      ctx.quadraticCurveTo((tip.x + bx) / 2, Math.max(tip.y, by - 10 * u) + 14 * u, bx, by - 9 * u);
      ctx.stroke();
      if (hy > by) { ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(hx, hy); ctx.stroke(); }
    } else {
      ctx.quadraticCurveTo((tip.x + hx) / 2, (tip.y + Math.min(hy, wl)) / 2 + (state === FS.READY ? 0 : 12 * u), hx, hy);
      ctx.stroke();
    }
    if (inWater) {
      ctx.beginPath(); ctx.arc(bx, by - 4 * u, 5.5 * u, Math.PI, 0); ctx.closePath(); paint(ctx, '#f4f0e0', 1.5);
      ctx.beginPath(); ctx.arc(bx, by - 4 * u, 5.5 * u, 0, Math.PI); ctx.closePath(); paint(ctx, '#e0503e', 1.5);
      ctx.strokeStyle = 'rgba(255,255,255,.5)'; ctx.lineWidth = 1.2; const rr = (this.t * 14) % 18;
      ctx.beginPath(); ctx.ellipse(bx, wl + 9 * u, 8 * u + rr * u, 2.6 * u + rr * 0.3 * u, 0, 0, TAU); ctx.globalAlpha = 1 - rr / 18; ctx.stroke(); ctx.globalAlpha = 1;
    }
    // hook & attached catch
    ctx.translate(hx, hy);
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, 8 * u); ctx.bezierCurveTo(0, 17 * u, 9 * u, 17 * u, 9 * u, 9 * u); ctx.lineWidth = 2.4 * u; ctx.strokeStyle = INK; ctx.stroke(); ctx.lineWidth = 1.4 * u; ctx.strokeStyle = '#d8dee4'; ctx.stroke();
    if (state === FS.WAIT || state === FS.DESCEND) { ctx.beginPath(); ctx.arc(4 * u, 13 * u, 3 * u, 0, TAU); ctx.fillStyle = st.equipped.bait ? this.baitColor(st) : '#c98a8a'; ctx.fill(); }
    if (state === FS.RETRIEVE && fs.pending) {
      const pend = fs.pending;
      ctx.translate(4 * u, 16 * u);
      if (pend.kind === 'fish') { const sz = fishPixels(pend.item.l, u * 0.6); drawFish(ctx, pend.sp, { x: 0, y: sz * 0.42, size: sz, dir: 1, t: this.t * 1.5, tilt: -Math.PI / 2 + Math.sin(this.t * 14) * 0.2, variant: pend.item.variant }); }
      else if (pend.kind === 'fragment') { ctx.fillStyle = '#f6ead0'; ctx.fillRect(-12 * u, 4 * u, 24 * u, 18 * u); sparkle(ctx, 10 * u, 6 * u, 8 * u, '#fff6c8', this.t * 3); }
      else drawLoot(ctx, pend.item.id, 0, 22 * u, 38 * u, this.t);
    }
    ctx.restore();
    // splash as hook leaves the water on retrieval
    if (state === FS.RETRIEVE && fs.hookFrac < 0.02 && !this._rSplash) { this._rSplash = true; this.splash(hx, wl, 1.1); }
    if (state !== FS.RETRIEVE) this._rSplash = false;
  }

  baitColor(st) { const b = { worm: '#c98a8a', minnow: '#9ab8d0', shiny: '#e8d870', crab: '#d96a54', reef: '#f08aa8', kelp: '#6aa86a', moon: '#c8b8f8', glow: '#7ad8ff', arctic: '#d8f0ff', ancient: '#e8c060' }; return b[st.equipped.bait] || '#c98a8a'; }

  // ---------- particles ----------
  spawnAmbient(dt, L, th) {
    const low = this.g.state.settings.lowFx, cap = low ? 90 : 220;
    if (this.parts.length > cap) return;
    this.spawnAcc += dt;
    const rate = low ? 0.28 : 0.12;
    while (this.spawnAcc > rate) {
      this.spawnAcc -= rate;
      const p = th.particles;
      if (p === 'bubble') this.parts.push({ type: 'bubble', x: Math.random() * L.W, y: L.sb, vx: 0, vy: -rnd(20, 50), life: 0, max: (L.sb - L.wl) / 40, size: rnd(1.5, 4.5) * L.u, wob: Math.random() * 6 });
      else if (p === 'mote') this.parts.push({ type: 'mote', x: Math.random() * L.W, y: L.wl + Math.random() * (L.sb - L.wl), vx: rnd(-6, 6), vy: rnd(-6, 4), life: 0, max: rnd(5, 9), size: rnd(1.5, 3) * L.u, color: '#f4ffc8', wob: Math.random() * 6 });
      else if (p === 'glow') this.parts.push({ type: 'mote', x: Math.random() * L.W, y: L.wl + Math.random() * (L.sb - L.wl), vx: rnd(-8, 8), vy: rnd(-12, 4), life: 0, max: rnd(5, 10), size: rnd(2, 4.5) * L.u, color: Math.random() < 0.5 ? '#7ad8ff' : '#c0a0ff', wob: Math.random() * 6 });
      else if (p === 'rune') this.parts.push({ type: 'mote', x: Math.random() * L.W, y: L.wl + Math.random() * (L.sb - L.wl), vx: rnd(-5, 5), vy: -rnd(4, 14), life: 0, max: rnd(5, 10), size: rnd(2, 4) * L.u, color: Math.random() < 0.5 ? '#d8b8ff' : '#ffd870', wob: Math.random() * 6 });
      else if (p === 'snow') this.parts.push({ type: 'snow', x: Math.random() * L.W, y: -5, vx: rnd(-14, -4), vy: rnd(24, 50), life: 0, max: (L.H + 10) / 36, size: rnd(1.2, 3.2) * L.u, wob: Math.random() * 6 });
    }
  }
  updateParts(dt) {
    const a = this.parts;
    for (let i = a.length - 1; i >= 0; i--) {
      const p = a[i]; p.life += dt;
      if (p.life >= p.max) { a.splice(i, 1); continue; }
      if (p.g) p.vy += p.g * dt;
      if (p.wob !== undefined) p.x += Math.sin(this.t * 2 + p.wob) * 8 * dt;
      p.x += (p.vx || 0) * dt; p.y += (p.vy || 0) * dt;
      if (p.type === 'bubble' && p.y < this.layout().wl) a.splice(i, 1);
    }
    if (a.length > 600) a.splice(0, a.length - 600);
  }
  drawParts(ctx, L) {
    for (const p of this.parts) {
      const k = p.life / p.max;
      switch (p.type) {
        case 'bubble': bubble(ctx, p.x, p.y, p.size, 0.55 * (1 - Math.max(0, k - 0.7) / 0.3)); break;
        case 'drop': ctx.globalAlpha = 1 - k; ctx.fillStyle = '#e8f8ff'; ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, TAU); ctx.fill(); ctx.globalAlpha = 1; break;
        case 'ring': ctx.globalAlpha = 1 - k; ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(p.x, p.y, p.size + k * 50 * L.u, (p.size + k * 50 * L.u) * 0.3, 0, 0, TAU); ctx.stroke(); ctx.globalAlpha = 1; break;
        case 'spark': ctx.globalAlpha = 1 - k; sparkle(ctx, p.x, p.y, p.size * (1 - k * 0.4), p.color, p.life * 4); ctx.globalAlpha = 1; break;
        case 'mote': ctx.globalAlpha = Math.sin(k * Math.PI) * 0.8; glow(ctx, p.x, p.y, p.size * 4, p.color, 0.5); ctx.fillStyle = p.color; ctx.beginPath(); ctx.arc(p.x, p.y, p.size * 0.6, 0, TAU); ctx.fill(); ctx.globalAlpha = 1; break;
        case 'snow': ctx.globalAlpha = 0.85; ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, TAU); ctx.fill(); ctx.globalAlpha = 1; break;
        case 'coin': ctx.globalAlpha = 1 - k; ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, TAU); ctx.fillStyle = '#f2cf6a'; ctx.fill(); ctx.strokeStyle = '#a07a2a'; ctx.lineWidth = 1; ctx.stroke(); ctx.globalAlpha = 1; break;
      }
    }
  }

  // ---------- HARBOR ----------
  drawHarbor(ctx, L, dt) {
    const g = this.g, st = g.state, { W, H, u } = L;
    const night = nightness(st.clock);
    const th = { skyDay: ['#9ad8ee', '#fdeccb'], skyNight: ['#1d2b55', '#6a5a8a'], island: 'grass', water: ['#7fd0cc', '#4aa8b4', '#2a7a98'], foam: '#ffffff', dark: 0 };
    const horizon = H * 0.46;
    this.drawSky(ctx, L, th, night, dt, horizon);
    // far islands & lighthouse isle
    island(ctx, W * 0.2, horizon + 2, W * 0.26, H * 0.12, 'grass', 7, 0.3, night);
    island(ctx, W * 0.55, horizon + 2, W * 0.16, H * 0.07, 'palm', 9, 0.3, night);
    // sea
    const wg = ctx.createLinearGradient(0, horizon, 0, H); wg.addColorStop(0, mix('#8adbd2', '#1a2a5a', night * 0.6)); wg.addColorStop(1, mix('#2e86a8', '#0e1a42', night * 0.6));
    ctx.fillStyle = wg; ctx.fillRect(0, horizon, W, H - horizon);
    for (let i = 0; i < 6; i++) this.waveBand(ctx, L, horizon + 24 * u + i * 38 * u, 3 * u, 80 * u + i * 12, 0.9 + i * 0.1, i * 1.3, 'rgba(255,255,255,0.09)', horizon + 30 * u + i * 38 * u + 14 * u);
    this.hot = [];
    // lighthouse on rocky isle (right)
    this.drawLighthouse(ctx, L, W * 0.9, horizon + 8 * u, night);
    this.addHot('lighthouse', W * 0.9 - 40 * u, horizon - 150 * u, 80 * u, 170 * u, 'Lighthouse (Prestige)');
    // pier
    const py = H * 0.68, pierW = W * 0.62;
    // posts
    for (let i = 0; i < 8; i++) { const x = 20 + i * (pierW / 7.4); ctx.fillStyle = '#6a4a30'; ctx.fillRect(x, py, 12 * u, H * 0.2); ctx.strokeStyle = INK; ctx.lineWidth = 1.6; ctx.strokeRect(x, py, 12 * u, H * 0.2); }
    // buildings behind pier
    this.drawShop(ctx, L, W * 0.06, py, 'tackle', night);
    this.drawShop(ctx, L, W * 0.25, py, 'market', night);
    this.drawShop(ctx, L, W * 0.43, py, 'yard', night);
    // pier deck
    ctx.beginPath(); ctx.moveTo(0, py); ctx.lineTo(pierW, py); ctx.lineTo(pierW + 30 * u, py + 40 * u); ctx.lineTo(0, py + 40 * u); ctx.closePath(); paint(ctx, '#c49a68', 2.4);
    ctx.strokeStyle = 'rgba(80,50,30,.5)'; ctx.lineWidth = 1.4;
    for (let x = 18 * u; x < pierW + 20; x += 38 * u) { ctx.beginPath(); ctx.moveTo(x, py); ctx.lineTo(x + 12 * u, py + 40 * u); ctx.stroke(); }
    ctx.beginPath(); ctx.moveTo(0, py + 20 * u); ctx.lineTo(pierW + 14 * u, py + 20 * u); ctx.stroke();
    // props: barrels, crates, net, quest board, lantern
    this.drawBarrel(ctx, W * 0.17, py + 2 * u, u); this.drawCrate(ctx, W * 0.205, py + 2 * u, u); this.drawBarrel(ctx, W * 0.37, py + 2 * u, u);
    this.drawBoard(ctx, L, W * 0.555, py, night); this.addHot('board', W * 0.555 - 36 * u, py - 100 * u, 72 * u, 100 * u, 'Request Board');
    for (const lx of [0.015, 0.34, 0.6]) this.drawLantern(ctx, L, W * lx + 8 * u, py, night);
    // boat docked on the water beside the pier end
    const bx = W * 0.8, by = H * 0.74 + Math.sin(this.t * 1.3) * 3 * u, tier = st.equipped.boat, m = BOAT_META[tier];
    const deco = st.cosmetics.active ? DECO_BY_ID[st.cosmetics.active].color : null;
    ctx.save(); ctx.translate(bx, by); ctx.rotate(Math.sin(this.t * 1.1) * 0.02); ctx.scale(-u * 1.05, u * 1.05);
    drawBoat(ctx, tier, { t: this.t, deco });
    drawFisherman(ctx, m.w * m.deck, -m.h * 0.78, { pose: 'idle', t: this.t, rodColor: RODS[st.equipped.rod].color, rodTier: st.equipped.rod });
    ctx.restore();
    this.addHot('boat', bx - m.w * 0.5 * u, by - m.h * 4 * u, m.w * u, m.h * 5 * u, 'Set sail (World Map)');
    // mooring rope
    ctx.strokeStyle = '#d8c8a0'; ctx.lineWidth = 2.4; ctx.beginPath(); ctx.moveTo(pierW + 10 * u, py + 8 * u); ctx.quadraticCurveTo((pierW + bx) / 2 - 40 * u, py + 40 * u, bx - m.w * 0.4 * u, by - 20 * u); ctx.stroke();
    this.waveBand(ctx, L, by + 6 * u, 3 * u, 90 * u, 1.4, 2, 'rgba(60,150,170,.7)', H, 0.8);
    this.waveFoam(ctx, L, by + 6 * u, 3 * u, 90 * u, 1.4, 2, 'rgba(255,255,255,.6)');
    // pet on pier
    const pet = st.pets.active;
    if (pet) {
      const px = pierW - 70 * u, pyy = py + 4 * u;
      ctx.save(); ctx.translate(px, pet === 'otter' ? pyy + 6 * u : pyy); ctx.scale(u * 1.5, u * 1.5);
      drawPet(ctx, pet, { t: this.t, happy: this.petHappy / 1.3, dir: -1 });
      ctx.restore();
      this.addHot('pets', px - 40 * u, pyy - 80 * u, 80 * u, 90 * u, 'Your companion');
    }
    // sitting gulls
    for (let i = 0; i < 3; i++) { const gx = W * (0.07 + i * 0.4) + 14, gy = py - 3 * u; ctx.save(); ctx.translate(gx, gy); ctx.scale(u * 0.7, u * 0.7); drawPet(ctx, 'gull', { t: this.t + i, dir: i % 2 ? -1 : 1 }); ctx.restore(); }
    // hover label
    this.drawHotLabel(ctx, L);
    if (night > 0.3) { ctx.fillStyle = `rgba(10,16,50,${night * 0.25})`; ctx.fillRect(0, 0, W, H); }
  }

  addHot(id, x, y, w, h, label) { this.hot.push({ id, x, y, w, h, label }); }
  hitTest(x, y) { for (let i = this.hot.length - 1; i >= 0; i--) { const h = this.hot[i]; if (x >= h.x && x <= h.x + h.w && y >= h.y && y <= h.y + h.h) return h; } return null; }
  drawHotLabel(ctx, L) {
    const h = this.hitTest(this.mouse.x, this.mouse.y);
    this.hover = h;
    if (!h) return;
    const u = L.u; ctx.save(); ctx.font = `600 ${13 * u}px system-ui, sans-serif`;
    const tw = ctx.measureText(h.label).width + 22 * u, x = clamp(h.x + h.w / 2 - tw / 2, 6, L.W - tw - 6), y = Math.max(8, h.y - 30 * u);
    ctx.beginPath(); ctx.roundRect(x, y, tw, 26 * u, 10 * u); paint(ctx, '#fbf3e0', 2, '#8a6a44'); ctx.fillStyle = '#2b3a4d'; ctx.textBaseline = 'middle'; ctx.fillText(h.label, x + 11 * u, y + 13.5 * u); ctx.restore();
  }

  drawLighthouse(ctx, L, x, y, night) {
    const u = L.u; ctx.save(); ctx.translate(x, y);
    organic(ctx, 0, 6 * u, 70 * u, 16 * u, 3, 9, 0.1); paint(ctx, '#8a8a94', 2);
    ctx.beginPath(); ctx.moveTo(-22 * u, 0); ctx.lineTo(-14 * u, -120 * u); ctx.lineTo(14 * u, -120 * u); ctx.lineTo(22 * u, 0); ctx.closePath(); paint(ctx, '#f6f0e4', 2);
    ctx.save(); ctx.clip(); ctx.fillStyle = '#d8503a'; for (let i = 0; i < 3; i++) ctx.fillRect(-30 * u, -100 * u + i * 40 * u, 60 * u, 18 * u); ctx.restore();
    ctx.fillStyle = '#2a3a58'; ctx.fillRect(-16 * u, -140 * u, 32 * u, 20 * u); ctx.strokeStyle = INK; ctx.lineWidth = 2; ctx.strokeRect(-16 * u, -140 * u, 32 * u, 20 * u);
    ctx.beginPath(); ctx.moveTo(-20 * u, -140 * u); ctx.lineTo(0, -160 * u); ctx.lineTo(20 * u, -140 * u); ctx.closePath(); paint(ctx, '#d8503a', 2);
    const a = 0.5 + night * 0.5 + Math.sin(this.t * 2) * 0.1; glow(ctx, 0, -130 * u, 70 * u, '#ffe8a0', a * 0.6);
    if (night > 0.3) { ctx.save(); ctx.globalAlpha = night * 0.25; ctx.fillStyle = '#fff0b0'; ctx.beginPath(); ctx.moveTo(0, -130 * u); const r = Math.sin(this.t * 0.6); ctx.lineTo(-400 * u, -150 * u + r * 60 * u); ctx.lineTo(-400 * u, -100 * u + r * 60 * u); ctx.closePath(); ctx.fill(); ctx.restore(); }
    ctx.restore();
  }

  drawShop(ctx, L, x, py, kind, night) {
    const u = L.u, w = 170 * u, h = 140 * u, cols = { tackle: ['#6aa4c8', '#e8f0f4', 'Tackle Shop'], market: ['#e07a62', '#fbeed0', 'Fish Market'], yard: ['#8aa870', '#f0e4c0', 'Boat Yard'] }[kind];
    ctx.save(); ctx.translate(x, py);
    ctx.beginPath(); ctx.rect(0, -h, w, h); paint(ctx, '#e8d4aa', 2.4);
    ctx.strokeStyle = 'rgba(120,80,50,.3)'; ctx.lineWidth = 1.2; for (let i = 1; i < 6; i++) { ctx.beginPath(); ctx.moveTo(0, -h + i * h / 6); ctx.lineTo(w, -h + i * h / 6); ctx.stroke(); }
    // roof
    ctx.beginPath(); ctx.moveTo(-12 * u, -h); ctx.lineTo(w / 2, -h - 46 * u); ctx.lineTo(w + 12 * u, -h); ctx.closePath(); paint(ctx, cols[0], 2.4);
    // awning
    ctx.beginPath(); ctx.moveTo(-6 * u, -h * 0.58); ctx.lineTo(w + 6 * u, -h * 0.58); ctx.lineTo(w + 14 * u, -h * 0.4); ctx.lineTo(-14 * u, -h * 0.4); ctx.closePath(); paint(ctx, cols[0], 2);
    for (let i = 0; i < 6; i += 2) { ctx.beginPath(); ctx.moveTo(i * (w / 6) - 6 * u, -h * 0.58); ctx.lineTo((i + 1) * (w / 6) - 6 * u, -h * 0.58); ctx.lineTo((i + 1) * (w / 6) - 10 * u, -h * 0.4); ctx.lineTo(i * (w / 6) - 14 * u, -h * 0.4); ctx.closePath(); ctx.fillStyle = cols[1]; ctx.fill(); }
    // window & door
    const lit = night > 0.35;
    ctx.beginPath(); ctx.rect(w * 0.1, -h * 0.34, w * 0.3, h * 0.28); paint(ctx, lit ? '#ffe39a' : '#bfe0ec', 2); if (lit) glow(ctx, w * 0.25, -h * 0.2, 50 * u, '#ffd890', 0.4);
    ctx.beginPath(); ctx.roundRect(w * 0.58, -h * 0.34, w * 0.26, h * 0.34, [8 * u, 8 * u, 0, 0]); paint(ctx, '#8a5a38', 2);
    // sign
    ctx.beginPath(); ctx.roundRect(w * 0.12, -h * 0.9, w * 0.76, 22 * u, 6 * u); paint(ctx, '#f6e8c8', 2, '#8a6a44'); ctx.fillStyle = '#3a4a5e'; ctx.font = `700 ${13 * u}px Georgia, serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(cols[2], w / 2, -h * 0.9 + 12 * u);
    // chimney smoke for market
    if (kind === 'market') for (let i = 0; i < 3; i++) { const k = (this.t * 0.4 + i / 3) % 1; ctx.globalAlpha = 0.5 * (1 - k); ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(w * 0.78 + k * 20, -h - 46 * u * 0.5 - k * 70 * u, 5 * u + k * 12 * u, 0, TAU); ctx.fill(); ctx.globalAlpha = 1; }
    ctx.restore();
    const id = kind === 'tackle' ? 'tackle' : kind === 'market' ? 'market' : 'yard';
    this.addHot(id, x - 10 * u, py - h - 46 * u, w + 20 * u, h + 46 * u, kind === 'tackle' ? 'Tackle Shop (Shop)' : kind === 'market' ? 'Fish Market (Sell Catch)' : 'Boat Yard (Boats)');
  }
  drawBarrel(ctx, x, y, u) { ctx.save(); ctx.translate(x, y); ctx.beginPath(); ctx.moveTo(-14 * u, 0); ctx.quadraticCurveTo(-19 * u, -20 * u, -14 * u, -40 * u); ctx.lineTo(14 * u, -40 * u); ctx.quadraticCurveTo(19 * u, -20 * u, 14 * u, 0); ctx.closePath(); paint(ctx, '#a8784a', 2); ctx.strokeStyle = '#5a3c24'; ctx.lineWidth = 2.4; for (const yy of [-30, -10]) { ctx.beginPath(); ctx.moveTo(-17 * u, yy * u); ctx.lineTo(17 * u, yy * u); ctx.stroke(); } ctx.restore(); }
  drawCrate(ctx, x, y, u) { ctx.save(); ctx.translate(x, y); ctx.beginPath(); ctx.rect(-18 * u, -32 * u, 36 * u, 32 * u); paint(ctx, '#c49a68', 2); ctx.strokeStyle = '#7a5a38'; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(-18 * u, -32 * u); ctx.lineTo(18 * u, 0); ctx.moveTo(18 * u, -32 * u); ctx.lineTo(-18 * u, 0); ctx.stroke(); ctx.restore(); }
  drawBoard(ctx, L, x, y, night) {
    const u = L.u; ctx.save(); ctx.translate(x, y);
    ctx.fillStyle = '#6a4a30'; ctx.fillRect(-26 * u, -92 * u, 6 * u, 92 * u); ctx.fillRect(20 * u, -92 * u, 6 * u, 92 * u);
    ctx.beginPath(); ctx.roundRect(-34 * u, -100 * u, 68 * u, 54 * u, 6 * u); paint(ctx, '#d8b884', 2.4);
    const n = this.g.state.quests.active.filter(q => q.done).length;
    for (let i = 0; i < 3; i++) { ctx.save(); ctx.translate(-22 * u + i * 20 * u, -88 * u); ctx.rotate((i - 1) * 0.08); ctx.fillStyle = '#f8f0dc'; ctx.fillRect(0, 0, 16 * u, 22 * u); ctx.strokeStyle = INK; ctx.lineWidth = 1.2; ctx.strokeRect(0, 0, 16 * u, 22 * u); ctx.fillStyle = '#d8503a'; ctx.beginPath(); ctx.arc(8 * u, 2 * u, 2.4 * u, 0, TAU); ctx.fill(); ctx.restore(); }
    if (n > 0) { ctx.beginPath(); ctx.arc(30 * u, -100 * u, 11 * u, 0, TAU); paint(ctx, '#e8a02a', 2); ctx.fillStyle = '#fff'; ctx.font = `700 ${12 * u}px system-ui`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('!', 30 * u, -99 * u); }
    ctx.restore();
  }
  drawLantern(ctx, L, x, y, night) {
    const u = L.u; ctx.save(); ctx.translate(x, y); ctx.fillStyle = '#4a3a2a'; ctx.fillRect(-2 * u, -78 * u, 4 * u, 78 * u);
    if (night > 0.2) glow(ctx, 0, -84 * u, 70 * u, '#ffd890', 0.5 * Math.min(1, night * 1.5));
    ctx.beginPath(); ctx.roundRect(-8 * u, -92 * u, 16 * u, 18 * u, 4 * u); paint(ctx, night > 0.2 ? '#ffe9a0' : '#e8dcc0', 2); ctx.restore();
  }
}
