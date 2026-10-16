/* Little Ocean - environment rendering: water, light rays, parallax, seabed, rocks, gates and procedural decor. */
window.LO = window.LO || {};
LO.Scenery = (function () {
  const CFG = LO.CFG, U = LO.U, TAU = Math.PI * 2, World = LO.World;
  const W = CFG.world.w;
  const KEYS = ['top', 'bot', 'rock', 'rockHi', 'sand', 'sandHi', 'far', 'accent'];
  const cur = {}, tgt = {}, ps = {};
  let fx = true;

  function loadTarget(id) {
    const z = CFG.zones[id], p = z.pal;
    KEYS.forEach((k) => { tgt[k] = U.rgb(p[k]); });
    tgt.y0 = z.rect[1]; tgt.y1 = z.rect[1] + z.rect[3]; tgt.light = p.light; tgt.dark = p.dark;
  }
  function stringify() { KEYS.forEach((k) => { ps[k] = U.rgbStr(cur[k]); }); }
  function snap(id) {
    loadTarget(id);
    KEYS.forEach((k) => { cur[k] = tgt[k].slice(); });
    cur.y0 = tgt.y0; cur.y1 = tgt.y1; cur.light = tgt.light; cur.dark = tgt.dark; stringify();
  }
  function updatePalette(dt, id) {
    loadTarget(id);
    const k = 1 - Math.exp(-1.7 * dt);
    KEYS.forEach((key) => { cur[key] = U.lerpRgb(cur[key], tgt[key], k); });
    ['y0', 'y1', 'light', 'dark'].forEach((key) => { cur[key] += (tgt[key] - cur[key]) * k; });
    stringify();
  }
  snap('reef');

  const pmod = (a, n) => ((a % n) + n) % n;

  /* ---------- screen-space backdrop ---------- */
  function drawWater(ctx, vw, vh, view) {
    const span = Math.max(1, cur.y1 - cur.y0);
    const c = (y) => U.rgbStr(U.lerpRgb(cur.top, cur.bot, U.clamp((y - cur.y0) / span, 0, 1)));
    const g = ctx.createLinearGradient(0, 0, 0, vh);
    g.addColorStop(0, c(view.t)); g.addColorStop(0.5, c((view.t + view.b) / 2)); g.addColorStop(1, c(view.b));
    ctx.fillStyle = g; ctx.fillRect(0, 0, vw, vh);
  }

  function drawRays(ctx, vw, vh, t, view) {
    if (!fx) return;
    const a = cur.light * (1 - U.clamp(view.cy / 2100, 0, 1));
    if (a < 0.03) return;
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 6; i++) {
      const x0 = (i * 0.19 + 0.04 + Math.sin(t * 0.13 + i * 1.7) * 0.05) * vw, w = (50 + 38 * Math.sin(i * 2.3 + 1)) * (0.7 + view.zoom * 0.3);
      const slant = vh * 0.35 + Math.sin(t * 0.1 + i) * 40;
      const g = ctx.createLinearGradient(x0, 0, x0 - slant, vh);
      const al = a * (0.1 + 0.05 * Math.sin(t * 0.5 + i * 2));
      g.addColorStop(0, 'rgba(255,255,230,' + al + ')'); g.addColorStop(0.7, 'rgba(255,255,230,' + al * 0.25 + ')'); g.addColorStop(1, 'rgba(255,255,230,0)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.moveTo(x0, 0); ctx.lineTo(x0 + w, 0); ctx.lineTo(x0 + w * 2.4 - slant, vh); ctx.lineTo(x0 - slant - w * 0.4, vh); ctx.closePath(); ctx.fill();
    }
    ctx.restore();
  }

  const BG_SP = { shape: { len: 1, hgt: 0.3, peak: 0.55, p: 2.1, base: 0.1 }, tail: 'fork', tailLen: 1, dorsal: 'soft', dorsalH: 1, pattern: 'none', eye: 1, pect: 1, wave: 1, color: { body: '#fff', belly: '#fff', fin: '#fff', accent: '#fff' } };
  const bgFish = [];
  for (let i = 0; i < 12; i++) bgFish.push({ x: U.hash(i * 3.3) * 1600, y: 0.12 + U.hash(i * 7.7) * 0.6, s: 5 + U.hash(i * 1.9) * 8, v: (20 + U.hash(i * 5.1) * 30) * (i & 1 ? 1 : -1), k: 0.2 + U.hash(i * 9.1) * 0.25 });
  const motes = [];
  for (let i = 0; i < 90; i++) motes.push({ x: U.hash(i * 2.1), y: U.hash(i * 4.7), s: 0.6 + U.hash(i * 6.3) * 1.8, v: 3 + U.hash(i * 8.8) * 9, k: 0.25 + U.hash(i * 1.3) * 0.5 });

  function drawParallax(ctx, vw, vh, t, view) {
    const zoom = view.zoom;
    const by = U.lerp(1700, 3300, U.smooth((view.cy - 1450) / 500));
    // distant drifting fish
    ctx.save();
    const fc = U.rgbStr(U.lerpRgb(cur.far, cur.top, 0.25));
    const dim = U.clamp(1 - cur.dark * 0.8, 0.15, 1);
    for (let i = 0; i < bgFish.length; i++) {
      const f = bgFish[i];
      const sx = pmod(f.x + f.v * t - view.cx * zoom * f.k, vw + 400) - 200;
      const sy = f.y * vh + Math.sin(t * 0.4 + i) * 10 - (view.cy - 800) * 0.02 * zoom;
      LO.FishArt.draw(ctx, BG_SP, f.s * zoom * 0.8, { x: sx, y: sy, ang: f.v > 0 ? 0 : Math.PI, flip: f.v > 0 ? 1 : -1, phase: t * 3 + i, sw: 0.6, flat: fc, alpha: 0.22 * dim });
    }
    ctx.restore();
    // hills and kelp silhouettes
    const ks = [0.18, 0.32, 0.5], mixes = [0.15, 0.32, 0.5], al = [0.5, 0.62, 0.78];
    for (let li = 0; li < 3; li++) {
      const k = ks[li], baseY = vh * 0.8 + (by - view.cy) * k * zoom;
      if (baseY > vh * 3 || baseY < -50) continue;
      const col = U.rgbStr(U.lerpRgb(cur.far, cur.bot, mixes[li]));
      const sc = zoom * (0.55 + li * 0.25), x0 = view.cx * k - vw / (2 * zoom) - 40, x1 = x0 + vw / zoom + 80;
      ctx.fillStyle = col; ctx.globalAlpha = al[li];
      ctx.beginPath(); ctx.moveTo(0, vh + 20);
      for (let X = x0; X <= x1; X += 30) {
        const hgt = (70 + 170 * U.noise(X * 0.0034 + li * 17) + 45 * U.noise(X * 0.011 + li * 5)) * sc;
        ctx.lineTo(vw / 2 + (X - view.cx * k) * zoom, baseY - hgt);
      }
      ctx.lineTo(vw, vh + 20); ctx.closePath(); ctx.fill();
      if (li > 0) {
        ctx.strokeStyle = col; ctx.lineWidth = (8 + li * 3) * zoom; ctx.lineCap = 'round';
        const step = 150 + li * 40;
        for (let X = Math.floor(x0 / step) * step; X < x1; X += step) {
          if (U.hash(X * 0.31 + li) < 0.4) continue;
          const hgt = (70 + 170 * U.noise(X * 0.0034 + li * 17) + 45 * U.noise(X * 0.011 + li * 5)) * sc;
          const sx = vw / 2 + (X - view.cx * k) * zoom, bl = (110 + U.hash(X) * 150) * sc, sw = Math.sin(t * 0.8 + X * 0.01) * 14 * sc;
          ctx.beginPath(); ctx.moveTo(sx, baseY - hgt + 6); ctx.quadraticCurveTo(sx + sw * 0.4, baseY - hgt - bl * 0.5, sx + sw, baseY - hgt - bl); ctx.stroke();
        }
      }
    }
    ctx.globalAlpha = 1;
  }

  function drawMotes(ctx, vw, vh, t, view) {
    ctx.save(); ctx.fillStyle = cur.dark > 0.4 ? 'rgba(180,200,255,0.5)' : 'rgba(255,255,255,0.5)';
    const n = fx ? motes.length : 35;
    for (let i = 0; i < n; i++) {
      const m = motes[i];
      const sx = pmod(m.x * vw + Math.sin(t * 0.3 + i) * 12 - view.cx * view.zoom * m.k, vw);
      const sy = pmod(m.y * vh + t * m.v - view.cy * view.zoom * m.k * 0.6, vh);
      ctx.globalAlpha = 0.18 + m.s * 0.12; ctx.beginPath(); ctx.arc(sx, sy, m.s * view.zoom * 0.9, 0, TAU); ctx.fill();
    }
    ctx.restore();
  }

  function drawDarkness(ctx, vw, vh, px, py, zoom) {
    const d = cur.dark;
    if (d < 0.03) return;
    const R = Math.max(vw, vh) * 0.85, clear = 190 * zoom;
    const g = ctx.createRadialGradient(px, py, clear * 0.2, px, py, R);
    g.addColorStop(0, 'rgba(3,5,22,' + d * 0.08 + ')'); g.addColorStop(clear / R, 'rgba(3,5,22,' + d * 0.35 + ')'); g.addColorStop(1, 'rgba(3,5,22,' + Math.min(0.96, d * 1.12) + ')');
    ctx.fillStyle = g; ctx.fillRect(0, 0, vw, vh);
  }

  /* ---------- world-space ---------- */
  function smoothPoly(ctx, p) {
    const n = p.length / 2;
    ctx.beginPath();
    ctx.moveTo((p[0] + p[n * 2 - 2]) / 2, (p[1] + p[n * 2 - 1]) / 2);
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      ctx.quadraticCurveTo(p[i * 2], p[i * 2 + 1], (p[i * 2] + p[j * 2]) / 2, (p[i * 2 + 1] + p[j * 2 + 1]) / 2);
    }
    ctx.closePath();
  }

  const zoneOfSolid = (s) => s.zp || (s.zp = CFG.zones[World.zoneAt(s.t === 'r' ? s.x + s.w / 2 : s.x, s.t === 'r' ? s.y + s.h / 2 : s.y)].pal);

  function drawBounds(ctx, view) {
    ctx.fillStyle = '#0b1a26';
    if (view.l < 0) ctx.fillRect(view.l - 40, view.t - 40, -view.l + 40, view.b - view.t + 80);
    if (view.r > W) ctx.fillRect(W, view.t - 40, view.r - W + 40, view.b - view.t + 80);
    if (view.b > CFG.world.h) ctx.fillRect(view.l - 40, CFG.world.h, view.r - view.l + 80, view.b - CFG.world.h + 40);
  }

  function drawSurface(ctx, view, t) {
    if (view.t > 140) return;
    const x0 = view.l - 20, x1 = view.r + 20;
    const g = ctx.createLinearGradient(0, -260, 0, 0);
    g.addColorStop(0, '#fff7e0'); g.addColorStop(1, '#d8f6ff');
    ctx.fillStyle = g; ctx.fillRect(x0, -260, x1 - x0, 260);
    const g2 = ctx.createLinearGradient(0, 0, 0, 120);
    g2.addColorStop(0, 'rgba(255,255,255,0.55)'); g2.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g2; ctx.fillRect(x0, 0, x1 - x0, 120);
    ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.lineWidth = 4; ctx.beginPath();
    for (let x = x0; x <= x1; x += 24) { const y = Math.sin(x * 0.02 + t * 1.2) * 5 + Math.sin(x * 0.007 - t * 0.7) * 6; if (x === x0) ctx.moveTo(x, y); else ctx.lineTo(x, y); }
    ctx.stroke();
  }

  function drawSeabed(ctx, view) {
    const segs = [[0, 0, 2000, 'reef'], [0, 2000, 4000, 'kelp'], [0, 4000, 6000, 'blue'], [1, 0, 3000, 'grotto'], [1, 3000, 6000, 'deep']];
    for (let i = 0; i < segs.length; i++) {
      const sg = segs[i], row = sg[0];
      if (row === 0 && view.b < 1380) continue;
      if (row === 1 && view.b < 2950) continue;
      const xa = Math.max(sg[1], Math.floor((view.l - 60) / 40) * 40), xb = Math.min(sg[2], view.r + 60);
      if (xb <= xa) continue;
      const pal = CFG.zones[sg[3]].pal, bottom = row ? CFG.world.h + 90 : 1706, yTop = row ? 3120 : 1520;
      const g = ctx.createLinearGradient(0, yTop, 0, bottom);
      g.addColorStop(0, pal.sandHi); g.addColorStop(1, pal.sand);
      ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(xa, bottom);
      for (let x = xa; x <= xb; x += 40) ctx.lineTo(x, World.floorAt(x, row));
      ctx.lineTo(xb, World.floorAt(xb, row)); ctx.lineTo(xb, bottom); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = U.shade(pal.sandHi, 0.35); ctx.lineWidth = 3.5; ctx.lineJoin = 'round'; ctx.beginPath();
      for (let x = xa; x <= xb; x += 40) { const y = World.floorAt(x, row) + 1; if (x === xa) ctx.moveTo(x, y); else ctx.lineTo(x, y); }
      ctx.stroke();
      ctx.fillStyle = U.alpha(pal.rock, 0.22);
      for (let x = Math.ceil(xa / 64) * 64; x < xb; x += 64) {
        const y = World.floorAt(x, row) + 16 + U.hash(x * 0.1) * 40;
        ctx.beginPath(); ctx.ellipse(x + U.hash(x) * 20, y, 3 + U.hash(x * 3) * 6, 2 + U.hash(x * 2) * 3, 0, 0, TAU); ctx.fill();
      }
    }
  }

  function drawNookInteriors(ctx, view) {
    for (let i = 0; i < World.hideR.length; i++) {
      const h = World.hideR[i];
      if (h.x > view.r || h.x + h.w < view.l || h.y > view.b || h.y + h.h < view.t) continue;
      ctx.fillStyle = 'rgba(10,14,40,0.3)'; ctx.fillRect(h.x, h.y, h.w, h.h);
    }
  }

  function boulder(ctx, s, pal, t) {
    const n = 12, r = s.r;
    ctx.beginPath();
    const pts = [];
    for (let i = 0; i < n; i++) { const a = i / n * TAU, rad = r * (0.93 + 0.1 * U.hash(s.seed + i * 1.3)); pts.push(s.x + Math.cos(a) * rad, s.y + Math.sin(a) * rad); }
    smoothPoly(ctx, pts);
    ctx.fillStyle = pal.rock; ctx.fill();
    ctx.save(); ctx.clip();
    ctx.fillStyle = U.alpha(pal.rockHi, 0.28); ctx.beginPath(); ctx.ellipse(s.x - r * 0.3, s.y - r * 0.35, r * 0.6, r * 0.45, -0.5, 0, TAU); ctx.fill();
    ctx.strokeStyle = U.alpha('#000000', 0.12); ctx.lineWidth = 2;
    for (let i = 0; i < 4; i++) { const y = s.y - r * 0.6 + i * r * 0.4; ctx.beginPath(); ctx.moveTo(s.x - r, y + U.hash(s.seed + i) * 10); ctx.quadraticCurveTo(s.x, y + 12, s.x + r, y - 6); ctx.stroke(); }
    ctx.restore();
    smoothPoly(ctx, pts); ctx.strokeStyle = U.shade(pal.rock, -0.5); ctx.lineWidth = 4; ctx.stroke();
  }

  function rockRect(ctx, s, pal) {
    smoothPoly(ctx, s.poly);
    ctx.fillStyle = pal.rock; ctx.fill();
    ctx.save(); ctx.clip();
    ctx.fillStyle = U.alpha(pal.rockHi, 0.24); ctx.fillRect(s.x - 10, s.y - 10, s.w + 20, Math.min(22, s.h * 0.3 + 10));
    ctx.fillStyle = U.alpha('#000000', 0.1); ctx.fillRect(s.x - 10, s.y + s.h - Math.min(18, s.h * 0.25), s.w + 20, 30);
    ctx.strokeStyle = U.alpha('#000000', 0.12); ctx.lineWidth = 2; ctx.lineCap = 'round';
    const cnt = Math.min(24, (s.w * s.h) / 7000 | 0), seed = s.x * 0.013 + s.y * 0.007;
    ctx.beginPath();
    for (let i = 0; i < cnt; i++) {
      const x = s.x + U.hash(seed + i * 1.7) * s.w, y = s.y + U.hash(seed + i * 2.9) * s.h, a = U.hash(seed + i) * 0.8 - 0.4, l = 10 + U.hash(i + seed) * 22;
      ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l);
    }
    ctx.stroke(); ctx.restore();
    smoothPoly(ctx, s.poly); ctx.strokeStyle = U.shade(pal.rock, -0.5); ctx.lineWidth = 4; ctx.lineJoin = 'round'; ctx.stroke();
  }

  function drawSolids(ctx, view, t) {
    const S = World.solids;
    for (let i = 0; i < S.length; i++) {
      const s = S[i];
      if (s.gate) continue;
      if (s.t === 'r') {
        if (s.x > view.r + 12 || s.x + s.w < view.l - 12 || s.y > view.b + 12 || s.y + s.h < view.t - 12) continue;
        rockRect(ctx, s, zoneOfSolid(s));
      } else {
        if (s.x - s.r > view.r || s.x + s.r < view.l || s.y - s.r > view.b || s.y + s.r < view.t) continue;
        boulder(ctx, s, zoneOfSolid(s), t);
      }
    }
  }

  function drawGates(ctx, view, t, psize) {
    const G = World.gates;
    for (let i = 0; i < G.length; i++) {
      const g = G[i];
      if (g.x > view.r + 20 || g.x + g.w < view.l - 20 || g.y > view.b + 20 || g.y + g.h < view.t - 20) continue;
      const open = psize >= g.min;
      ctx.save(); ctx.beginPath(); ctx.rect(g.x - 4, g.y - 4, g.w + 8, g.h + 8); ctx.clip();
      ctx.fillStyle = open ? 'rgba(210,255,245,0.1)' : 'rgba(210,255,245,0.3)'; ctx.fillRect(g.x, g.y, g.w, g.h);
      ctx.strokeStyle = open ? 'rgba(235,255,250,0.35)' : 'rgba(235,255,250,0.8)'; ctx.lineWidth = 2.5; ctx.lineCap = 'round';
      ctx.setLineDash([16, 14]); ctx.lineDashOffset = -t * 70;
      const n = 6;
      for (let k = 0; k < n; k++) {
        ctx.beginPath();
        if (g.vertical) { const yy = g.y + g.h * (k + 0.5) / n; for (let x = g.x; x <= g.x + g.w; x += 8) { const y = yy + Math.sin(t * 3 + k + x * 0.09) * 6; if (x === g.x) ctx.moveTo(x, y); else ctx.lineTo(x, y); } }
        else { const xx = g.x + g.w * (k + 0.5) / n; for (let y = g.y; y <= g.y + g.h; y += 8) { const x = xx + Math.sin(t * 3 + k + y * 0.09) * 6; if (y === g.y) ctx.moveTo(x, y); else ctx.lineTo(x, y); } }
        ctx.stroke();
      }
      ctx.setLineDash([]); ctx.restore();
      if (!open) {
        const label = 'Size ' + g.min, fs = 17;
        ctx.font = 'bold ' + fs + 'px "Trebuchet MS",sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        const w = ctx.measureText(label).width + 20;
        ctx.fillStyle = 'rgba(8,40,58,0.82)'; ctx.strokeStyle = 'rgba(220,255,245,0.7)'; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.roundRect ? ctx.roundRect(g.cx - w / 2, g.cy - 15, w, 30, 15) : ctx.rect(g.cx - w / 2, g.cy - 15, w, 30); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#e9fffb'; ctx.fillText(label, g.cx, g.cy + 1);
      }
    }
  }

  /* ---------- decor ---------- */
  const D = {};
  const rockCol = (d) => d.rc || (d.rc = CFG.zones[World.zoneAt(d.x, d.y + (d.flip < 0 ? 40 : -20))].pal);
  function blade(ctx, bx, h, w, sw) {
    ctx.beginPath(); ctx.moveTo(bx - w, 0);
    ctx.bezierCurveTo(bx - w + sw * 0.2, -h * 0.35, bx - w * 0.4 + sw * 0.7, -h * 0.7, bx + sw, -h);
    ctx.bezierCurveTo(bx + w * 0.4 + sw * 0.7, -h * 0.7, bx + w + sw * 0.2, -h * 0.35, bx + w, 0); ctx.closePath();
  }
  D.seaweed = function (ctx, d, t) {
    const s = d.s, n = 3 + (((d.seed * 7) | 0) % 3);
    ctx.fillStyle = d.col; ctx.strokeStyle = U.shade(d.col, -0.4); ctx.lineWidth = 1.4;
    for (let i = 0; i < n; i++) {
      blade(ctx, (i - (n - 1) / 2) * 11 * s, (55 + U.hash(d.seed + i) * 70) * s, 6 * s, Math.sin(t * 1.3 + d.seed * 9 + i * 1.3) * 10 * s);
      ctx.fill(); ctx.stroke();
    }
  };
  D.kelp = function (ctx, d, t) {
    const s = d.s, h = d.h, n = 10;
    const xAt = (f) => Math.sin(t * 0.9 + d.seed * 20 - f * 2.2) * 26 * s * f * f + Math.sin(f * 3 + d.seed * 9) * 14 * s * f;
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.strokeStyle = U.shade(d.col, -0.45); ctx.lineWidth = 9 * s + 2;
    ctx.beginPath(); for (let i = 0; i <= n; i++) { const f = i / n; if (i) ctx.lineTo(xAt(f), -h * f); else ctx.moveTo(0, 0); } ctx.stroke();
    ctx.strokeStyle = d.col; ctx.lineWidth = 7 * s;
    ctx.beginPath(); for (let i = 0; i <= n; i++) { const f = i / n; if (i) ctx.lineTo(xAt(f), -h * f); else ctx.moveTo(0, 0); } ctx.stroke();
    ctx.fillStyle = U.shade(d.col, 0.12); ctx.strokeStyle = U.shade(d.col, -0.4); ctx.lineWidth = 1.5;
    for (let i = 2; i <= n; i++) {
      const f = i / n, side = i & 1 ? 1 : -1;
      ctx.save(); ctx.translate(xAt(f), -h * f); ctx.rotate(side * (0.55 + Math.sin(t * 1.4 + i + d.seed) * 0.18) - Math.PI / 2 * 0);
      ctx.beginPath(); ctx.ellipse(side * 26 * s, 0, 28 * s, 8 * s, 0, 0, TAU); ctx.fill(); ctx.stroke(); ctx.restore();
    }
  };
  function branch(ctx, len, w, depth, seed, t, col, pass) {
    ctx.lineWidth = pass ? w + 3 : w; ctx.lineCap = 'round'; ctx.strokeStyle = pass ? U.shade(col, -0.5) : col;
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -len); ctx.stroke();
    ctx.translate(0, -len);
    if (depth <= 0) {
      ctx.fillStyle = pass ? U.shade(col, -0.5) : U.shade(col, 0.4); ctx.beginPath(); ctx.arc(0, 0, w * (pass ? 0.9 : 0.65), 0, TAU); ctx.fill(); return;
    }
    const n = 2 + (U.hash(seed + depth) > 0.6 ? 1 : 0);
    for (let k = 0; k < n; k++) {
      const a = (k - (n - 1) / 2) * 0.75 + (U.hash(seed * 3 + k + depth) - 0.5) * 0.4 + Math.sin(t * 0.9 + seed + depth) * 0.04;
      ctx.save(); ctx.rotate(a); branch(ctx, len * 0.72, w * 0.72, depth - 1, seed * 1.7 + k, t, col, pass); ctx.restore();
    }
  }
  D.coral_b = function (ctx, d, t) {
    for (let pass = 1; pass >= 0; pass--) { ctx.save(); branch(ctx, 36 * d.s, 11 * d.s, 3, d.seed, t, d.col, pass); ctx.restore(); }
  };
  D.coral_fan = function (ctx, d, t) {
    const s = d.s, n = 11;
    ctx.strokeStyle = U.shade(d.col, -0.4); ctx.lineWidth = 7 * s; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -18 * s); ctx.stroke();
    ctx.translate(0, -18 * s);
    const tips = [];
    for (let k = 0; k < n; k++) { const a = (k / (n - 1) - 0.5) * 2.1 + Math.sin(t * 0.8 + d.seed) * 0.05, l = 72 * s * (0.8 + 0.2 * U.hash(d.seed + k)); tips.push(Math.sin(a) * l, -Math.cos(a) * l); }
    ctx.fillStyle = U.alpha(d.col, 0.4); ctx.beginPath(); ctx.moveTo(0, 0); for (let k = 0; k < n; k++) ctx.lineTo(tips[k * 2], tips[k * 2 + 1]); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = d.col; ctx.lineWidth = 2.6 * s; ctx.beginPath(); for (let k = 0; k < n; k++) { ctx.moveTo(0, 0); ctx.lineTo(tips[k * 2], tips[k * 2 + 1]); } ctx.stroke();
    ctx.strokeStyle = U.shade(d.col, 0.35); ctx.lineWidth = 3 * s; ctx.beginPath(); for (let k = 0; k < n; k++) { if (k) ctx.lineTo(tips[k * 2], tips[k * 2 + 1]); else ctx.moveTo(tips[0], tips[1]); } ctx.stroke();
  };
  D.coral_dome = function (ctx, d) {
    const s = d.s;
    ctx.beginPath(); ctx.ellipse(0, 0, 46 * s, 38 * s, 0, Math.PI, 0); ctx.closePath();
    ctx.fillStyle = d.col; ctx.fill();
    ctx.save(); ctx.clip(); ctx.strokeStyle = U.shade(d.col, -0.35); ctx.lineWidth = 2.2 * s; ctx.globalAlpha = 0.55;
    for (let i = 0; i < 5; i++) { ctx.beginPath(); ctx.ellipse(0, 0, (10 + i * 8) * s, (8 + i * 7) * s, 0, Math.PI, 0); ctx.stroke(); }
    ctx.restore();
    ctx.strokeStyle = U.shade(d.col, -0.5); ctx.lineWidth = 3; ctx.beginPath(); ctx.ellipse(0, 0, 46 * s, 38 * s, 0, Math.PI, 0); ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.3)'; ctx.beginPath(); ctx.ellipse(-14 * s, -22 * s, 12 * s, 6 * s, -0.6, 0, TAU); ctx.fill();
  };
  D.coral_tube = function (ctx, d) {
    const s = d.s;
    for (let i = 0; i < 4; i++) {
      const x = (i - 1.5) * 14 * s, h = (38 + U.hash(d.seed + i) * 45) * s, w = 11 * s;
      ctx.fillStyle = d.col; ctx.strokeStyle = U.shade(d.col, -0.5); ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(x - w / 2, 0); ctx.lineTo(x - w / 2, -h); ctx.ellipse(x, -h, w / 2, w * 0.3, 0, Math.PI, 0, true); ctx.lineTo(x + w / 2, 0); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle = U.shade(d.col, -0.55); ctx.beginPath(); ctx.ellipse(x, -h, w * 0.38, w * 0.2, 0, 0, TAU); ctx.fill();
    }
  };
  D.anemone = function (ctx, d, t) {
    const s = d.s, n = 14;
    ctx.fillStyle = U.shade(d.col, -0.4); ctx.beginPath(); ctx.ellipse(0, -2 * s, 22 * s, 9 * s, 0, 0, TAU); ctx.fill();
    ctx.lineCap = 'round'; ctx.lineWidth = 4 * s; ctx.strokeStyle = d.col;
    for (let i = 0; i < n; i++) {
      const a = -Math.PI + Math.PI * (i + 0.5) / n, bx = Math.cos(a) * 15 * s, L = (28 + 10 * U.hash(d.seed + i)) * s, sway = Math.sin(t * 1.5 + i * 0.8 + d.seed) * 8 * s;
      const tx = bx + Math.cos(a) * 22 * s + sway, ty = -L - Math.sin(a) * 4;
      ctx.beginPath(); ctx.moveTo(bx, -4 * s); ctx.quadraticCurveTo(bx + sway * 0.4, -L * 0.6, tx, ty); ctx.stroke();
      ctx.fillStyle = U.shade(d.col, 0.45); ctx.beginPath(); ctx.arc(tx, ty, 3 * s, 0, TAU); ctx.fill();
    }
  };
  D.rock = function (ctx, d) {
    const pal = rockCol(d), r = 36 * d.s, n = 9, pts = [];
    for (let i = 0; i < n; i++) { const a = i / n * TAU, rad = r * (0.8 + 0.3 * U.hash(d.seed + i)); pts.push(Math.cos(a) * rad, Math.sin(a) * rad * 0.7 - r * 0.25); }
    smoothPoly(ctx, pts); ctx.fillStyle = pal.rock; ctx.fill();
    ctx.fillStyle = U.alpha(pal.rockHi, 0.3); ctx.beginPath(); ctx.ellipse(-r * 0.25, -r * 0.55, r * 0.4, r * 0.18, -0.4, 0, TAU); ctx.fill();
    smoothPoly(ctx, pts); ctx.strokeStyle = U.shade(pal.rock, -0.5); ctx.lineWidth = 3; ctx.stroke();
  };
  D.shell = function (ctx, d) {
    const s = d.s * 16;
    ctx.fillStyle = d.col; ctx.strokeStyle = U.shade(d.col, -0.4); ctx.lineWidth = 1.6;
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, s, Math.PI * 1.1, Math.PI * 1.9); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.beginPath(); for (let i = 1; i < 5; i++) { const a = Math.PI * (1.1 + i * 0.16); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(a) * s, Math.sin(a) * s); } ctx.stroke();
  };
  D.star = function (ctx, d) {
    const R = 17 * d.s, r = 7 * d.s;
    ctx.beginPath(); for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, rad = i & 1 ? r : R; ctx.lineTo(Math.cos(a) * rad, Math.sin(a) * rad * 0.8 - 6 * d.s); } ctx.closePath();
    ctx.fillStyle = d.col || '#ff9e7a'; ctx.fill(); ctx.strokeStyle = U.shade(d.col || '#ff9e7a', -0.45); ctx.lineWidth = 2; ctx.lineJoin = 'round'; ctx.stroke();
  };
  D.urchin = function (ctx, d) {
    const r = 11 * d.s; ctx.strokeStyle = U.shade(d.col, -0.5); ctx.lineWidth = 2; ctx.lineCap = 'round';
    ctx.beginPath(); for (let i = 0; i < 16; i++) { const a = -Math.PI + i * Math.PI / 15; ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r - r); ctx.lineTo(Math.cos(a) * r * 2, Math.sin(a) * r * 2 - r); } ctx.stroke();
    ctx.fillStyle = U.shade(d.col, -0.2); ctx.beginPath(); ctx.arc(0, -r, r, 0, TAU); ctx.fill();
  };
  D.glow = function (ctx, d, t) {
    const s = d.s, h = (d.tall ? 150 : 80) * s, sw = Math.sin(t * 1.1 + d.seed) * 10 * s;
    ctx.strokeStyle = U.shade(d.col, -0.5); ctx.lineWidth = 4 * s; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(sw * 0.3, -h * 0.5, sw, -h); ctx.stroke();
    ctx.fillStyle = d.col;
    for (let i = 0; i < 3; i++) {
      const f = 0.5 + i * 0.25, x = sw * f * f + (i - 1) * 9 * s, y = -h * f, r = (5 - i) * s * 1.4;
      ctx.globalAlpha = 0.7 + 0.3 * Math.sin(t * 2 + i + d.seed);
      ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.globalAlpha *= 0.7; ctx.beginPath(); ctx.arc(x - r * 0.25, y - r * 0.25, r * 0.35, 0, TAU); ctx.fill(); ctx.fillStyle = d.col;
    }
    ctx.globalAlpha = 1;
  };
  D.crystal = function (ctx, d, t) {
    const s = d.s;
    for (let i = 0; i < 4; i++) {
      const a = (i - 1.5) * 0.4, len = (45 + U.hash(d.seed + i) * 55) * s, w = 11 * s;
      ctx.save(); ctx.rotate(a);
      ctx.beginPath(); ctx.moveTo(-w / 2, 0); ctx.lineTo(w / 2, 0); ctx.lineTo(w / 2, -len * 0.75); ctx.lineTo(0, -len); ctx.lineTo(-w / 2, -len * 0.75); ctx.closePath();
      ctx.fillStyle = U.alpha(d.col, 0.82); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.28)'; ctx.beginPath(); ctx.moveTo(-w / 2, 0); ctx.lineTo(-w * 0.05, 0); ctx.lineTo(-w * 0.05, -len * 0.9); ctx.lineTo(-w / 2, -len * 0.75); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = U.shade(d.col, -0.45); ctx.lineWidth = 1.8; ctx.lineJoin = 'round'; ctx.beginPath(); ctx.moveTo(-w / 2, 0); ctx.lineTo(-w / 2, -len * 0.75); ctx.lineTo(0, -len); ctx.lineTo(w / 2, -len * 0.75); ctx.lineTo(w / 2, 0); ctx.stroke();
      ctx.restore();
    }
  };
  D.stalac = function (ctx, d) {
    const pal = rockCol(d), s = d.s, w = 24 * s, h = (80 + U.hash(d.seed) * 70) * s;
    ctx.beginPath(); ctx.moveTo(-w, 0); ctx.quadraticCurveTo(-w * 0.5, -h * 0.5, 2 * s * (U.hash(d.seed + 2) - 0.5) * 6, -h); ctx.quadraticCurveTo(w * 0.5, -h * 0.5, w, 0); ctx.closePath();
    ctx.fillStyle = pal.rock; ctx.fill(); ctx.strokeStyle = U.shade(pal.rock, -0.5); ctx.lineWidth = 3; ctx.stroke();
    ctx.strokeStyle = U.alpha(pal.rockHi, 0.3); ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(-w * 0.35, -h * 0.1); ctx.quadraticCurveTo(-w * 0.2, -h * 0.5, 0, -h * 0.8); ctx.stroke();
  };
  D.bones = function (ctx, d) {
    const s = d.s;
    ctx.lineCap = 'round';
    for (let pass = 1; pass >= 0; pass--) {
      ctx.strokeStyle = pass ? '#8c8470' : d.col; ctx.lineWidth = (pass ? 15 : 10) * s;
      ctx.beginPath(); ctx.moveTo(-170 * s, -6 * s); ctx.quadraticCurveTo(0, -22 * s, 170 * s, -6 * s); ctx.stroke();
      for (let i = 0; i < 6; i++) { const x = (i - 2.5) * 56 * s; ctx.lineWidth = (pass ? 12 : 8) * s * (1 - Math.abs(i - 2.5) * 0.08); ctx.beginPath(); ctx.moveTo(x, -14 * s); ctx.bezierCurveTo(x + 40 * s, -110 * s, x + 70 * s, -120 * s, x + 76 * s, -40 * s); ctx.stroke(); }
    }
  };
  D.anchor = function (ctx, d) {
    const s = d.s; ctx.save(); ctx.rotate(-0.25); ctx.lineCap = 'round';
    for (let pass = 1; pass >= 0; pass--) {
      ctx.strokeStyle = pass ? '#4a3d30' : '#9a8670'; ctx.lineWidth = (pass ? 15 : 10) * s;
      ctx.beginPath(); ctx.moveTo(0, -105 * s); ctx.lineTo(0, -4 * s); ctx.moveTo(-34 * s, -80 * s); ctx.lineTo(34 * s, -80 * s);
      ctx.moveTo(-52 * s, -34 * s); ctx.quadraticCurveTo(-40 * s, 0, 0, -2 * s); ctx.quadraticCurveTo(40 * s, 0, 52 * s, -34 * s); ctx.stroke();
      ctx.beginPath(); ctx.arc(0, -118 * s, 14 * s, 0, TAU); ctx.stroke();
    }
    ctx.strokeStyle = '#4fa860'; ctx.lineWidth = 4 * s; ctx.beginPath(); ctx.moveTo(-6 * s, -70 * s); ctx.quadraticCurveTo(14 * s, -40 * s, 0, -10 * s); ctx.stroke();
    ctx.restore();
  };
  D.vent = function (ctx, d, t) {
    const pal = rockCol(d), s = d.s;
    ctx.beginPath(); ctx.moveTo(-40 * s, 0); ctx.lineTo(-18 * s, -90 * s); ctx.lineTo(18 * s, -90 * s); ctx.lineTo(40 * s, 0); ctx.closePath();
    ctx.fillStyle = pal.rock; ctx.fill(); ctx.strokeStyle = U.shade(pal.rock, -0.5); ctx.lineWidth = 3; ctx.stroke();
    ctx.fillStyle = 'rgba(255,140,90,' + (0.55 + 0.25 * Math.sin(t * 3 + d.seed)) + ')'; ctx.beginPath(); ctx.ellipse(0, -90 * s, 18 * s, 6 * s, 0, 0, TAU); ctx.fill();
  };
  D.lintel = function (ctx, d) {
    const pal = rockCol(d), w = d.w || 240;
    for (let pass = 1; pass >= 0; pass--) {
      ctx.strokeStyle = pass ? U.shade(pal.rock, -0.5) : pal.rock; ctx.lineWidth = pass ? 48 : 40; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(-w / 2, 8); ctx.quadraticCurveTo(0, -78, w / 2, 8); ctx.stroke();
    }
    ctx.strokeStyle = U.alpha(pal.rockHi, 0.35); ctx.lineWidth = 8; ctx.beginPath(); ctx.moveTo(-w / 2 + 8, -2); ctx.quadraticCurveTo(0, -80, w / 2 - 8, -2); ctx.stroke();
  };

  const GLOWTYPES = { glow: 1, crystal: 1 };
  function drawDecor(ctx, view, t, layer) {
    const A = World.decor;
    for (let i = 0; i < A.length; i++) {
      const d = A[i];
      if (d.layer !== layer) continue;
      if (d.x + d.ext < view.l || d.x - d.ext > view.r || d.y - d.ext > view.b || d.y + d.ext < view.t) continue;
      ctx.save(); ctx.translate(d.x, d.y);
      if (d.flip < 0) ctx.scale(1, -1);
      if (layer === 1) ctx.globalAlpha = 0.9;
      const f = D[d.t]; if (f) f(ctx, d, t);
      ctx.restore();
    }
  }

  function drawGlows(ctx, view, t) {
    const A = World.decor;
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < A.length; i++) {
      const d = A[i];
      if (!GLOWTYPES[d.t] && !(d.t === 'anemone' && d.col === '#8cffc1')) continue;
      if (d.x + 120 < view.l || d.x - 120 > view.r || d.y - 220 > view.b || d.y + 220 < view.t) continue;
      const R = (d.t === 'crystal' ? 90 : 70) * d.s, cy = d.y + (d.flip < 0 ? 1 : -1) * (d.t === 'glow' ? (d.tall ? 120 : 60) : 40) * d.s;
      const g = ctx.createRadialGradient(d.x, cy, 0, d.x, cy, R);
      g.addColorStop(0, U.alpha(d.col, 0.32 + 0.08 * Math.sin(t * 2 + d.seed))); g.addColorStop(1, U.alpha(d.col, 0));
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(d.x, cy, R, 0, TAU); ctx.fill();
    }
    ctx.restore();
  }

  return {
    snap, updatePalette, drawWater, drawRays, drawParallax, drawMotes, drawDarkness,
    drawBounds, drawSurface, drawSeabed, drawNookInteriors, drawSolids, drawGates, drawDecor, drawGlows,
    get pal() { return ps; }, get dark() { return cur.dark; },
    setFx(v) { fx = !!v; }
  };
})();
