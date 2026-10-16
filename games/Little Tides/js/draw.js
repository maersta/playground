// Reusable hand-drawn style helpers: organic shapes, clouds, islands, birds, boats, fisherman, pets.
export const INK = '#34455c';
export const TAU = Math.PI * 2;
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const hash = n => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };

export function hexRgb(h) {
  const n = parseInt(h.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
export function rgba(h, a) { const [r, g, b] = hexRgb(h); return `rgba(${r},${g},${b},${a})`; }
export function mix(a, b, t) {
  const A = hexRgb(a), B = hexRgb(b);
  return `rgb(${Math.round(lerp(A[0], B[0], t))},${Math.round(lerp(A[1], B[1], t))},${Math.round(lerp(A[2], B[2], t))})`;
}
export const shade = (h, f) => (f >= 0 ? mix(h, '#ffffff', f) : mix(h, '#000000', -f));

/** Smooth closed/open curve through points using quadratic midpoints. */
export function smoothPath(ctx, p, closed = true) {
  const n = p.length;
  ctx.beginPath();
  if (closed) {
    ctx.moveTo((p[n - 1][0] + p[0][0]) / 2, (p[n - 1][1] + p[0][1]) / 2);
    for (let i = 0; i < n; i++) {
      const a = p[i], b = p[(i + 1) % n];
      ctx.quadraticCurveTo(a[0], a[1], (a[0] + b[0]) / 2, (a[1] + b[1]) / 2);
    }
    ctx.closePath();
  } else {
    ctx.moveTo(p[0][0], p[0][1]);
    for (let i = 1; i < n - 1; i++) {
      const a = p[i], b = p[i + 1];
      ctx.quadraticCurveTo(a[0], a[1], (a[0] + b[0]) / 2, (a[1] + b[1]) / 2);
    }
    ctx.lineTo(p[n - 1][0], p[n - 1][1]);
  }
}

/** Slightly irregular ellipse so nothing looks perfectly geometric. */
export function organic(ctx, cx, cy, rx, ry, seed = 1, n = 9, j = 0.08) {
  const pts = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU, k = 1 + (hash(seed * 7.3 + i * 1.7) - 0.5) * 2 * j;
    pts.push([cx + Math.cos(a) * rx * k, cy + Math.sin(a) * ry * k]);
  }
  smoothPath(ctx, pts, true);
}

/** Fill then outline the current path. */
export function paint(ctx, fill, lw = 2, ink = INK) {
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  if (lw) { ctx.lineWidth = lw; ctx.strokeStyle = ink; ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.stroke(); }
}

export function glow(ctx, x, y, r, color, a = 0.6) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, rgba(color, a)); g.addColorStop(1, rgba(color, 0));
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
}

export function sparkle(ctx, x, y, r, color = '#fff6c8', rot = 0) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot);
  ctx.fillStyle = color; ctx.beginPath();
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * TAU;
    ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    ctx.lineTo(Math.cos(a + TAU / 8) * r * 0.28, Math.sin(a + TAU / 8) * r * 0.28);
  }
  ctx.closePath(); ctx.fill(); ctx.restore();
}

export function bubble(ctx, x, y, r, a = 0.6) {
  ctx.beginPath(); ctx.arc(x, y, r, 0, TAU);
  ctx.fillStyle = `rgba(255,255,255,${a * 0.18})`; ctx.fill();
  ctx.strokeStyle = `rgba(255,255,255,${a})`; ctx.lineWidth = Math.max(1, r * 0.18); ctx.stroke();
  ctx.beginPath(); ctx.arc(x - r * 0.35, y - r * 0.35, r * 0.22, 0, TAU);
  ctx.fillStyle = `rgba(255,255,255,${a})`; ctx.fill();
}

export function cloud(ctx, x, y, s, seed, color = '#ffffff', alpha = 0.9) {
  ctx.save(); ctx.globalAlpha = alpha; ctx.translate(x, y); ctx.scale(s, s);
  const puffs = [[-46, 6, 30, 20], [-14, -8, 38, 28], [24, -2, 34, 24], [52, 8, 26, 17], [4, 10, 52, 16]];
  ctx.fillStyle = color;
  puffs.forEach((p, i) => { organic(ctx, p[0], p[1], p[2], p[3], seed + i, 8, 0.07); ctx.fill(); });
  ctx.globalAlpha = alpha * 0.35; ctx.fillStyle = '#9fb6d6';
  organic(ctx, 2, 18, 56, 8, seed, 8, 0.05); ctx.fill();
  ctx.restore();
}

export function gull(ctx, x, y, s, t, color = '#ffffff') {
  const flap = Math.sin(t * 6 + x) * 0.55;
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
  ctx.strokeStyle = color === '#ffffff' ? '#6a7d96' : color; ctx.lineWidth = 2 / s * 1.4; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(-9, -3 * flap * 3); ctx.quadraticCurveTo(-4, -6 - flap * 4, 0, 0); ctx.quadraticCurveTo(4, -6 - flap * 4, 9, -3 * flap * 3); ctx.stroke();
  ctx.restore();
}

/** Distant island silhouette with vegetation / snow / ruins etc. Origin at the island's base centre. */
export function island(ctx, x, y, w, h, kind, seed, tint = 0, night = 0) {
  ctx.save(); ctx.translate(x, y);
  const dim = c => mix(c, '#1c2650', clamp(night * 0.6 + tint, 0, 1));
  const base = { grass: '#8fc58a', palm: '#9bd69a', cliff: '#6f9a7a', reef: '#b8d8a0', rocks: '#5a5c8a', ice: '#e6f2fc', ruins: '#7a6aa8' }[kind] || '#8fc58a';
  const pts = [[-w / 2, 0]];
  const n = 7;
  for (let i = 1; i < n; i++) {
    const u = i / n, hh = Math.sin(u * Math.PI) * h * (0.75 + hash(seed + i) * 0.5);
    pts.push([-w / 2 + u * w, -hh]);
  }
  pts.push([w / 2, 0]);
  smoothPath(ctx, pts, false); ctx.lineTo(w / 2, 6); ctx.lineTo(-w / 2, 6); ctx.closePath();
  paint(ctx, dim(base), 2, dim('#4a6a6a'));
  // sandy shore
  ctx.fillStyle = dim(kind === 'ice' ? '#ffffff' : '#ecdcae');
  organic(ctx, 0, 3, w * 0.52, 6, seed, 8, 0.1); ctx.fill();
  const tree = (tx, ty, sc) => {
    if (kind === 'palm') {
      ctx.strokeStyle = dim('#7a5a3a'); ctx.lineWidth = 3 * sc; ctx.beginPath(); ctx.moveTo(tx, ty); ctx.quadraticCurveTo(tx + 4 * sc, ty - 14 * sc, tx + 2 * sc, ty - 26 * sc); ctx.stroke();
      ctx.fillStyle = dim('#4fa86a');
      for (let k = 0; k < 5; k++) { const a = -Math.PI / 2 + (k - 2) * 0.7; ctx.beginPath(); ctx.ellipse(tx + 2 * sc + Math.cos(a) * 10 * sc, ty - 26 * sc + Math.sin(a) * 6 * sc, 11 * sc, 3.5 * sc, a, 0, TAU); ctx.fill(); }
    } else if (kind === 'ice') {
      ctx.fillStyle = dim('#cfe6f6'); ctx.beginPath(); ctx.moveTo(tx - 8 * sc, ty); ctx.lineTo(tx, ty - 22 * sc); ctx.lineTo(tx + 8 * sc, ty); ctx.closePath(); ctx.fill();
    } else if (kind === 'rocks' || kind === 'ruins') {
      ctx.fillStyle = dim('#3e3e66'); ctx.fillRect(tx - 3 * sc, ty - 18 * sc, 6 * sc, 18 * sc);
      if (kind === 'ruins') { ctx.fillStyle = dim('#a98aff'); ctx.fillRect(tx - 1 * sc, ty - 12 * sc, 2 * sc, 4 * sc); }
    } else {
      ctx.fillStyle = dim('#4a8a58'); organic(ctx, tx, ty - 10 * sc, 9 * sc, 11 * sc, seed + tx, 7, 0.1); ctx.fill();
      ctx.fillStyle = dim('#6a4a32'); ctx.fillRect(tx - 1.2 * sc, ty - 2 * sc, 2.4 * sc, 4 * sc);
    }
  };
  const cnt = kind === 'ice' ? 2 : 3;
  for (let i = 0; i < cnt; i++) tree(-w * 0.28 + i * w * 0.27 + hash(seed + i) * 10, -h * 0.35 - hash(seed + i * 3) * h * 0.2, 0.9 + hash(seed + i * 5) * 0.5);
  ctx.restore();
}

// ---------- Boats ----------
export const BOAT_META = [
  { w: 190, h: 30, deck: 0.20 }, { w: 212, h: 32, deck: 0.22 }, { w: 236, h: 34, deck: 0.22 }, { w: 262, h: 36, deck: 0.25 },
  { w: 292, h: 38, deck: 0.27 }, { w: 316, h: 40, deck: 0.29 }, { w: 340, h: 42, deck: 0.30 },
];

function hullPath(ctx, w, h, bow = 1) {
  ctx.beginPath();
  ctx.moveTo(-w * 0.5, -h * 0.8);
  ctx.bezierCurveTo(-w * 0.49, -h * 0.05, -w * 0.36, h * 0.5, -w * 0.1, h * 0.52);
  ctx.bezierCurveTo(w * 0.2, h * 0.54, w * 0.42, h * 0.22, w * 0.55 * bow, -h * 1.0);
  ctx.bezierCurveTo(w * 0.28, -h * 0.74, -w * 0.2, -h * 0.7, -w * 0.5, -h * 0.8);
  ctx.closePath();
}
function planks(ctx, w, h, color, n = 3) {
  ctx.save(); hullPath(ctx, w, h); ctx.clip();
  ctx.strokeStyle = color; ctx.lineWidth = 1.2; ctx.globalAlpha = 0.5;
  for (let k = 1; k <= n; k++) {
    const y = -h * 0.8 + k * h * 0.3;
    ctx.beginPath(); ctx.moveTo(-w * 0.5, y); ctx.quadraticCurveTo(0, y + h * 0.28, w * 0.56, y - h * 0.3); ctx.stroke();
  }
  ctx.restore();
}
function porthole(ctx, x, y, r, glowing) {
  ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); paint(ctx, glowing ? '#9ff0ff' : '#cfe8f2', 1.6);
  ctx.beginPath(); ctx.arc(x - r * 0.3, y - r * 0.3, r * 0.3, 0, TAU); ctx.fillStyle = 'rgba(255,255,255,.8)'; ctx.fill();
}
function sailShape(ctx, x, y, hgt, wid, color, t, patch) {
  const bulge = Math.sin(t * 1.2) * 3;
  ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x + wid * 0.9 + bulge, y - hgt * 0.5, x + wid * 0.1, y - hgt);
  ctx.lineTo(x, y - hgt); ctx.closePath(); paint(ctx, color, 2);
  if (patch) { ctx.beginPath(); ctx.moveTo(x + 6, y - hgt * 0.35); ctx.lineTo(x + 24, y - hgt * 0.4); ctx.lineTo(x + 20, y - hgt * 0.22); ctx.lineTo(x + 5, y - hgt * 0.2); ctx.closePath(); paint(ctx, patch, 1.2); }
}
function pennant(ctx, x, y, color, t, size = 1) {
  ctx.strokeStyle = INK; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y - 14 * size); ctx.stroke();
  const f = Math.sin(t * 4) * 2;
  ctx.beginPath(); ctx.moveTo(x, y - 14 * size); ctx.quadraticCurveTo(x - 9 * size, y - 16 * size + f, x - 17 * size, y - 11 * size + f * 1.5); ctx.quadraticCurveTo(x - 9 * size, y - 9 * size, x, y - 7 * size);
  ctx.closePath(); paint(ctx, color, 1.4);
}

/**
 * Draw a boat in local space: origin at the waterline centre, bow to the right.
 * opts: {t, deco (pennant colour or null), night}
 */
export function drawBoat(ctx, tier, o = {}) {
  const t = o.t || 0, m = BOAT_META[tier], w = m.w, h = m.h;
  ctx.save();
  ctx.lineJoin = 'round';
  const hullCols = ['#b98a56', '#8c6a45', '#c8533e', '#7a5a3a', '#3f6f8f', '#c0413a', '#2c2f6a'];
  const trims = ['#f3e7c8', '#4a8fb0', '#f4efe2', '#e8d3a0', '#e9f2f6', '#f4efe2', '#e8c15a'];
  const hc = hullCols[tier], tc = trims[tier];
  // ---- superstructure behind hull ----
  if (tier === 0) {
    ctx.strokeStyle = '#6a4a2a'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(-w * 0.2, -h * 0.9); ctx.lineTo(-w * 0.45, h * 0.2 - 10); ctx.stroke(); // oar
    ctx.beginPath(); ctx.ellipse(-w * 0.46, -6, 3, 9, 0.5, 0, TAU); paint(ctx, '#8a6a42', 1.2);
    ctx.strokeStyle = INK; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(-w * 0.08, -h * 0.8); ctx.lineTo(-w * 0.08, -h * 3.2); ctx.stroke();
    sailShape(ctx, -w * 0.08, -h * 0.8, h * 2.3, 30, '#f5ecd2', t, '#d9b27a');
  } else if (tier === 1) {
    ctx.strokeStyle = INK; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(-w * 0.06, -h * 0.8); ctx.lineTo(-w * 0.06, -h * 4.1); ctx.stroke();
    sailShape(ctx, -w * 0.06, -h * 0.9, h * 3, 44, '#f5ecd2', t, '#e8a090');
  } else if (tier === 2) {
    // cabin
    ctx.beginPath(); ctx.moveTo(-w * 0.34, -h * 0.8); ctx.lineTo(-w * 0.34, -h * 2.3); ctx.lineTo(-w * 0.04, -h * 2.3); ctx.lineTo(-w * 0.0, -h * 0.8); ctx.closePath(); paint(ctx, '#f7efe0', 2);
    ctx.fillStyle = '#cfe8f2'; ctx.fillRect(-w * 0.3, -h * 2.0, w * 0.14, h * 0.75); ctx.strokeStyle = INK; ctx.lineWidth = 1.4; ctx.strokeRect(-w * 0.3, -h * 2.0, w * 0.14, h * 0.75);
    ctx.beginPath(); ctx.rect(-w * 0.37, -h * 2.55, w * 0.4, h * 0.3); paint(ctx, '#c8533e', 2);
    ctx.fillStyle = '#8a8f98'; ctx.fillRect(-w * 0.52, -h * 0.9, 10, h * 0.9); // motor
    ctx.strokeStyle = INK; ctx.lineWidth = 1.4; ctx.strokeRect(-w * 0.52, -h * 0.9, 10, h * 0.9);
  } else if (tier === 3) {
    ctx.strokeStyle = '#5a3c20'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(-w * 0.16, -h * 0.8); ctx.lineTo(-w * 0.16, -h * 5.6); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(w * 0.1, -h * 0.9); ctx.lineTo(w * 0.1, -h * 4.2); ctx.stroke();
    sailShape(ctx, -w * 0.15, -h * 1.0, h * 4.4, 62, '#fbf4e0', t, '#d8785a');
    sailShape(ctx, w * 0.11, -h * 1.0, h * 3.1, 36, '#f3e8cc', t + 1, null);
    pennant(ctx, -w * 0.16, -h * 5.6, '#e86a5a', t);
  } else if (tier === 4) {
    ctx.beginPath(); ctx.moveTo(-w * 0.4, -h * 0.8); ctx.lineTo(-w * 0.4, -h * 2.3); ctx.lineTo(-w * 0.12, -h * 2.3); ctx.lineTo(-w * 0.04, -h * 0.8); ctx.closePath(); paint(ctx, '#f4f6f8', 2);
    ctx.beginPath(); ctx.rect(-w * 0.34, -h * 3.4, w * 0.2, h * 1.1); paint(ctx, '#e6eef2', 2);
    for (let i = 0; i < 3; i++) { ctx.fillStyle = '#9fd0e6'; ctx.fillRect(-w * 0.32 + i * w * 0.062, -h * 3.1, w * 0.045, h * 0.5); }
    ctx.strokeStyle = INK; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-w * 0.24, -h * 3.4); ctx.lineTo(-w * 0.24, -h * 4.3); ctx.stroke();
    ctx.save(); ctx.translate(-w * 0.24, -h * 4.3); ctx.rotate(t * 1.6); ctx.beginPath(); ctx.moveTo(-9, 0); ctx.lineTo(9, 0); ctx.stroke(); ctx.restore();
  } else if (tier === 5) {
    ctx.beginPath(); ctx.moveTo(-w * 0.42, -h * 0.8); ctx.lineTo(-w * 0.42, -h * 2.4); ctx.lineTo(-w * 0.1, -h * 2.4); ctx.lineTo(-w * 0.0, -h * 0.8); ctx.closePath(); paint(ctx, '#f6f8fa', 2);
    ctx.beginPath(); ctx.rect(-w * 0.36, -h * 3.5, w * 0.22, h * 1.1); paint(ctx, '#e1eaf0', 2);
    for (let i = 0; i < 3; i++) { ctx.fillStyle = '#8fc4e0'; ctx.fillRect(-w * 0.34 + i * w * 0.065, -h * 3.2, w * 0.048, h * 0.5); }
    ctx.beginPath(); ctx.rect(-w * 0.3, -h * 3.9, w * 0.1, h * 0.45); paint(ctx, '#c0413a', 1.6);
    ctx.strokeStyle = '#5a6a7a'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(w * 0.02, -h * 0.8); ctx.lineTo(w * 0.02, -h * 3.3); ctx.lineTo(w * 0.22, -h * 2.2); ctx.stroke(); // crane
    ctx.fillStyle = 'rgba(255,255,255,.95)'; organic(ctx, -w * 0.1, -h * 2.45, 26, 5, 3, 7, 0.1); ctx.fill();
  } else if (tier === 6) {
    ctx.beginPath(); ctx.moveTo(-w * 0.44, -h * 0.8); ctx.quadraticCurveTo(-w * 0.44, -h * 2.8, -w * 0.2, -h * 2.9); ctx.quadraticCurveTo(w * 0.04, -h * 2.8, w * 0.04, -h * 0.8); ctx.closePath(); paint(ctx, '#3a3f8a', 2);
    for (let i = 0; i < 3; i++) porthole(ctx, -w * 0.34 + i * w * 0.14, -h * 1.8, 7, true);
    ctx.beginPath(); ctx.arc(-w * 0.2, -h * 2.9, 15, Math.PI, 0); ctx.closePath(); paint(ctx, '#e8c15a', 2);
    ctx.beginPath(); ctx.arc(-w * 0.2, -h * 3.0, 6, 0, TAU); paint(ctx, '#9ff0ff', 1.4);
    glow(ctx, -w * 0.2, -h * 3.0, 40, '#9ff0ff', 0.35 + Math.sin(t * 2) * 0.1);
    ctx.beginPath(); ctx.moveTo(-w * 0.5, -h * 0.6); ctx.lineTo(-w * 0.62, -h * 1.7); ctx.lineTo(-w * 0.36, -h * 0.8); ctx.closePath(); paint(ctx, '#e8c15a', 1.6);
  }
  // ---- hull ----
  const bow = tier === 5 ? 1.08 : 1;
  hullPath(ctx, w, h, bow); paint(ctx, hc, 2.6);
  planks(ctx, w, h, shade(hc, -0.35), tier >= 4 ? 2 : 3);
  // gunwale trim
  ctx.save(); hullPath(ctx, w, h, bow); ctx.clip();
  ctx.fillStyle = tc; ctx.beginPath(); ctx.moveTo(-w * 0.52, -h * 0.9); ctx.bezierCurveTo(-w * 0.2, -h * 0.66, w * 0.28, -h * 0.76, w * 0.6, -h * 1.1); ctx.lineTo(w * 0.6, -h * 0.7); ctx.bezierCurveTo(w * 0.28, -h * 0.44, -w * 0.2, -h * 0.4, -w * 0.52, -h * 0.55); ctx.closePath(); ctx.fill();
  if (tier >= 5) { ctx.fillStyle = tier === 5 ? '#f4efe2' : '#1a1d50'; ctx.fillRect(-w * 0.5, h * 0.05, w * 1.1, h * 0.6); }
  ctx.restore();
  hullPath(ctx, w, h, bow); ctx.lineWidth = 2.6; ctx.strokeStyle = INK; ctx.stroke();
  if (tier === 4 || tier === 6) for (let i = 0; i < 4; i++) porthole(ctx, -w * 0.25 + i * w * 0.18, -h * 0.05, 4.5, tier === 6);
  if (tier === 1 || tier === 2) porthole(ctx, w * 0.12, -h * 0.1, 4, false);
  // railing for bigger boats
  if (tier >= 3) { ctx.strokeStyle = INK; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(w * 0.1, -h * 1.0); ctx.lineTo(w * 0.1, -h * 1.9); ctx.lineTo(w * 0.5, -h * 1.8); ctx.stroke(); }
  if (o.deco) pennant(ctx, w * 0.5, -h * 1.0, o.deco, t, 1.1);
  else if (tier < 3) pennant(ctx, w * 0.54, -h * 1.0, '#ee8a7a', t, 0.9);
  ctx.restore();
}

// ---------- Fisherman & rod ----------
/**
 * Draws the fisherman at local (x, y) (feet). pose: 'idle'|'cast'|'wait'|'bite'|'reel'|'show'
 * p = progress for the pose. Returns rod-tip position in the same local space.
 */
export function drawFisherman(ctx, x, y, o) {
  const { pose = 'idle', p = 0, t = 0, rodColor = '#a87a4a', rodTier = 0 } = o;
  ctx.save(); ctx.translate(x, y); ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  const breath = Math.sin(t * 2) * 0.8;
  const lean = pose === 'reel' ? -3 : pose === 'bite' ? -5 : pose === 'cast' ? (p < 0.5 ? 4 : -3) : 0;
  // legs
  ctx.fillStyle = '#3d4c66';
  ctx.beginPath(); ctx.roundRect(-9, -18, 8, 18, 3); paint(ctx, '#3d4c66', 1.6);
  ctx.beginPath(); ctx.roundRect(1, -18, 8, 18, 3); paint(ctx, '#46567a', 1.6);
  // boots
  ctx.beginPath(); ctx.roundRect(-10, -3, 11, 5, 2); paint(ctx, '#5a3e28', 1.2);
  ctx.beginPath(); ctx.roundRect(0, -3, 12, 5, 2); paint(ctx, '#5a3e28', 1.2);
  ctx.translate(lean, 0);
  // body
  ctx.beginPath(); ctx.moveTo(-10, -17); ctx.quadraticCurveTo(-13, -34 + breath, -7, -42 + breath); ctx.lineTo(7, -42 + breath); ctx.quadraticCurveTo(13, -34 + breath, 10, -17); ctx.closePath();
  paint(ctx, '#d86a52', 1.8);
  ctx.fillStyle = '#e8927c'; ctx.fillRect(-9, -26, 18, 3);
  // head
  ctx.beginPath(); ctx.arc(0, -50 + breath, 8.5, 0, TAU); paint(ctx, '#f2c9a0', 1.8);
  ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(4, -51 + breath, 1.3, 0, TAU); ctx.fill();
  ctx.strokeStyle = '#c07a60'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.arc(5, -48 + breath, 2.2, 0.2, 1.5); ctx.stroke();
  // straw hat
  ctx.beginPath(); ctx.ellipse(0, -56 + breath, 15, 4.2, 0, 0, TAU); paint(ctx, '#ecd078', 1.6);
  ctx.beginPath(); ctx.moveTo(-7, -57 + breath); ctx.quadraticCurveTo(0, -69 + breath, 7, -57 + breath); ctx.closePath(); paint(ctx, '#f3dc8c', 1.6);
  ctx.fillStyle = '#d86a52'; ctx.fillRect(-7, -59 + breath, 14, 2.2);
  // rod
  const handX = 9, handY = -33 + breath;
  let ang = -0.95, bend = 0.12, handDy = 0;
  if (pose === 'cast') { const e = p * p * (3 - 2 * p); ang = lerp(-2.5, -0.55, e); bend = lerp(0.5, -0.05, e); }
  else if (pose === 'wait') { ang = -0.75 + Math.sin(t * 1.3) * 0.02; bend = 0.18; }
  else if (pose === 'bite') { ang = -0.7 + Math.sin(t * 28) * 0.05; bend = 0.55 + Math.sin(t * 22) * 0.12; }
  else if (pose === 'reel') { ang = -0.85; bend = 0.45; handDy = Math.sin(t * 14) * 1.5; }
  else if (pose === 'show') { ang = -1.5; bend = 0.1; handDy = -6; }
  const L = 82 + rodTier * 2.5;
  const hy = handY + handDy;
  const mid = [handX + Math.cos(ang) * L * 0.55, hy + Math.sin(ang) * L * 0.55];
  const tip = [handX + Math.cos(ang + bend) * L, hy + Math.sin(ang + bend) * L + bend * 14];
  ctx.strokeStyle = shade(rodColor, -0.35); ctx.lineWidth = 4.4; ctx.beginPath(); ctx.moveTo(handX - 4, hy + 2); ctx.quadraticCurveTo(mid[0], mid[1], tip[0], tip[1]); ctx.stroke();
  ctx.strokeStyle = rodColor; ctx.lineWidth = 2.6; ctx.beginPath(); ctx.moveTo(handX - 4, hy + 2); ctx.quadraticCurveTo(mid[0], mid[1], tip[0], tip[1]); ctx.stroke();
  if (rodTier >= 5) { glow(ctx, tip[0], tip[1], 9, rodTier === 6 ? '#ffe08a' : '#cfe0ff', 0.7); }
  // reel
  ctx.beginPath(); ctx.arc(handX + 3, hy + 3, 3.6, 0, TAU); paint(ctx, '#c8ccd2', 1.4);
  // arms
  ctx.strokeStyle = '#b8503c'; ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(4, -38 + breath); ctx.quadraticCurveTo(12, -34, handX, hy); ctx.stroke();
  ctx.strokeStyle = INK; ctx.lineWidth = 1.2; ctx.stroke();
  ctx.beginPath(); ctx.arc(handX, hy, 3.2, 0, TAU); paint(ctx, '#f2c9a0', 1.2);
  ctx.restore();
  return { x: x + lean + tip[0], y: y + tip[1], hand: [x + lean + handX, y + hy] };
}

// ---------- Pets ----------
/** Origin at the pet's feet / base. size ~ 36px tall. o: {t, dir, happy (0..1 bounce), scale} */
export function drawPet(ctx, id, o = {}) {
  const t = o.t || 0, hp = o.happy || 0, s = o.scale || 1;
  ctx.save(); ctx.scale(s * (o.dir || 1), s); ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  const hop = -Math.abs(Math.sin(hp * 9)) * 12 * hp;
  ctx.translate(0, hop);
  switch (id) {
    case 'cat': {
      const wag = Math.sin(t * 2.2) * 6;
      ctx.beginPath(); ctx.moveTo(-12, -4); ctx.bezierCurveTo(-30, -2 + wag, -28, -26 + wag, -20, -24); ctx.lineWidth = 6; ctx.strokeStyle = INK; ctx.stroke();
      ctx.lineWidth = 3.8; ctx.strokeStyle = '#e8944a'; ctx.stroke();
      organic(ctx, 0, -12, 15, 13, 1, 9, 0.05); paint(ctx, '#e8944a', 2);
      ctx.fillStyle = '#f7d9a8'; organic(ctx, 3, -8, 8, 8, 2, 8, 0.05); ctx.fill();
      organic(ctx, 6, -28, 11, 10, 3, 9, 0.04); paint(ctx, '#e8944a', 2);
      for (const sx of [-1, 1]) { ctx.beginPath(); ctx.moveTo(6 + sx * 4, -35); ctx.lineTo(6 + sx * 10, -44); ctx.lineTo(6 + sx * 11, -32); ctx.closePath(); paint(ctx, '#e8944a', 1.8); }
      ctx.strokeStyle = '#b8642a'; ctx.lineWidth = 1.6; for (const k of [-5, 0, 5]) { ctx.beginPath(); ctx.moveTo(4 + k, -37); ctx.lineTo(4 + k, -33); ctx.stroke(); }
      const blink = Math.sin(t * 0.7) > 0.96;
      ctx.fillStyle = INK; if (!blink) { ctx.beginPath(); ctx.ellipse(11, -29, 1.8, 2.4, 0, 0, TAU); ctx.fill(); ctx.beginPath(); ctx.ellipse(3, -29, 1.8, 2.4, 0, 0, TAU); ctx.fill(); }
      else { ctx.fillRect(9, -29, 4, 1); ctx.fillRect(1, -29, 4, 1); }
      ctx.fillStyle = '#e88a9a'; ctx.beginPath(); ctx.arc(8, -25, 1.4, 0, TAU); ctx.fill();
      break;
    }
    case 'gull': {
      const flap = hp > 0 ? Math.sin(t * 20) * 0.8 : Math.sin(t * 0.9) * 0.05;
      ctx.strokeStyle = '#e8a04a'; ctx.lineWidth = 2.2; ctx.beginPath(); ctx.moveTo(-3, -9); ctx.lineTo(-3, 0); ctx.moveTo(4, -9); ctx.lineTo(4, 0); ctx.stroke();
      organic(ctx, 0, -17, 17, 11, 4, 9, 0.05); paint(ctx, '#fbfbfb', 2);
      ctx.save(); ctx.translate(-2, -18); ctx.rotate(-0.4 - flap); ctx.beginPath(); ctx.ellipse(-5, 0, 13, 6, 0, 0, TAU); paint(ctx, '#aab8c8', 1.8); ctx.restore();
      organic(ctx, 11, -28, 8, 8, 5, 8, 0.04); paint(ctx, '#fbfbfb', 2);
      ctx.beginPath(); ctx.moveTo(17, -29); ctx.lineTo(26, -26); ctx.lineTo(17, -25); ctx.closePath(); paint(ctx, '#f0a83a', 1.6);
      ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(13, -30, 1.5, 0, TAU); ctx.fill();
      break;
    }
    case 'crab': {
      const sc = Math.sin(t * 3) * 3;
      ctx.strokeStyle = '#2b6aa8'; ctx.lineWidth = 2.2;
      for (let i = 0; i < 3; i++) for (const sx of [-1, 1]) { ctx.beginPath(); ctx.moveTo(sx * 8, -8); ctx.lineTo(sx * (16 + i * 2), -4 + (i % 2) * 3 + sc * 0.3); ctx.lineTo(sx * (18 + i * 2), 0); ctx.stroke(); }
      for (const sx of [-1, 1]) {
        const w = hp > 0 || Math.sin(t * 1.2) > 0.6 ? Math.sin(t * 12) * 0.4 : 0;
        ctx.beginPath(); ctx.moveTo(sx * 10, -12); ctx.lineTo(sx * 17, -20 + w * 8); ctx.lineWidth = 2.6; ctx.stroke();
        organic(ctx, sx * 19, -24 + w * 8, 6, 5, sx + 3, 7, 0.08); paint(ctx, '#3a82cc', 1.8);
      }
      organic(ctx, 0, -12, 14, 10, 6, 9, 0.05); paint(ctx, '#4a94dc', 2);
      ctx.fillStyle = '#7cb8ec'; organic(ctx, -3, -15, 6, 3, 7, 7, 0.05); ctx.fill();
      for (const sx of [-1, 1]) { ctx.strokeStyle = INK; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(sx * 4, -20); ctx.lineTo(sx * 5, -25); ctx.stroke(); ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(sx * 5, -26, 2.4, 0, TAU); ctx.fill(); ctx.stroke(); ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(sx * 5.4, -26, 1, 0, TAU); ctx.fill(); }
      break;
    }
    case 'otter': {
      const bob = Math.sin(t * 1.8) * 1.5;
      ctx.translate(0, bob);
      ctx.beginPath(); ctx.moveTo(-14, -8); ctx.quadraticCurveTo(-30, -6, -34, -12); ctx.lineWidth = 7; ctx.strokeStyle = INK; ctx.stroke(); ctx.lineWidth = 4.6; ctx.strokeStyle = '#8a6444'; ctx.stroke();
      organic(ctx, 0, -14, 17, 13, 8, 9, 0.05); paint(ctx, '#8a6444', 2);
      ctx.fillStyle = '#e6cfa6'; organic(ctx, 3, -12, 11, 8, 9, 8, 0.05); ctx.fill();
      organic(ctx, 8, -30, 11, 10, 10, 9, 0.04); paint(ctx, '#8a6444', 2);
      ctx.fillStyle = '#e6cfa6'; organic(ctx, 12, -26, 6, 4.5, 11, 8, 0.05); ctx.fill();
      for (const sx of [0, 1]) { ctx.beginPath(); ctx.arc(1 + sx * 14, -38, 3, 0, TAU); paint(ctx, '#8a6444', 1.6); }
      ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(10, -32, 1.5, 0, TAU); ctx.fill(); ctx.beginPath(); ctx.arc(3, -32, 1.5, 0, TAU); ctx.fill();
      ctx.beginPath(); ctx.ellipse(15, -27, 2.4, 1.8, 0, 0, TAU); ctx.fill();
      ctx.beginPath(); ctx.moveTo(8, -12); ctx.quadraticCurveTo(16, -18, 14, -22); ctx.lineWidth = 5; ctx.strokeStyle = '#8a6444'; ctx.stroke();
      ctx.beginPath(); ctx.arc(15, -23, 4, 0, TAU); paint(ctx, '#f0c8d8', 1.4);
      break;
    }
    case 'jelly': {
      const pulse = Math.sin(t * 2.4) * 0.12;
      ctx.translate(0, -26 + Math.sin(t * 1.5) * 4);
      glow(ctx, 0, 0, 34, '#d7c8ff', 0.45);
      ctx.globalAlpha = 0.9;
      for (let i = 0; i < 5; i++) { ctx.strokeStyle = 'rgba(220,200,255,.85)'; ctx.lineWidth = 2.4; ctx.beginPath(); ctx.moveTo(-10 + i * 5, 4); for (let k = 1; k <= 4; k++) ctx.lineTo(-10 + i * 5 + Math.sin(t * 3 + i + k) * 3, 4 + k * 6); ctx.stroke(); }
      ctx.beginPath(); ctx.moveTo(-16, 5); ctx.bezierCurveTo(-18, -20 * (1 + pulse), 18, -20 * (1 + pulse), 16, 5); ctx.quadraticCurveTo(0, 10, -16, 5); ctx.closePath(); paint(ctx, 'rgba(226,212,255,.85)', 1.8, '#8a76c8');
      ctx.fillStyle = 'rgba(255,255,255,.7)'; organic(ctx, -6, -9, 5, 3, 4, 7, 0.05); ctx.fill();
      ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(-5, -2, 1.5, 0, TAU); ctx.arc(5, -2, 1.5, 0, TAU); ctx.fill();
      ctx.globalAlpha = 1;
      break;
    }
    case 'dragon': {
      const fl = Math.sin(t * (hp > 0 ? 16 : 5)) * 0.5;
      ctx.translate(0, -16 + Math.sin(t * 2.4) * 3);
      ctx.beginPath(); ctx.moveTo(-8, 4); ctx.bezierCurveTo(-24, 8, -28, -8, -34, -4 + Math.sin(t * 3) * 4); ctx.lineWidth = 7; ctx.strokeStyle = INK; ctx.stroke(); ctx.lineWidth = 4.6; ctx.strokeStyle = '#4ab8a8'; ctx.stroke();
      ctx.save(); ctx.translate(-2, -6); ctx.rotate(-0.5 - fl); ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(-16, -22, -26, -6); ctx.quadraticCurveTo(-16, -8, -12, 0); ctx.quadraticCurveTo(-8, -4, 0, 2); ctx.closePath(); paint(ctx, '#a07ae0', 1.8); ctx.restore();
      organic(ctx, 0, 0, 13, 11, 12, 9, 0.05); paint(ctx, '#4ab8a8', 2);
      ctx.fillStyle = '#f4e4a0'; organic(ctx, 4, 4, 7, 6, 13, 8, 0.05); ctx.fill();
      organic(ctx, 12, -12, 10, 9, 14, 9, 0.04); paint(ctx, '#4ab8a8', 2);
      for (const sx of [-1, 1]) { ctx.beginPath(); ctx.moveTo(10 + sx * 4, -19); ctx.lineTo(10 + sx * 7, -28); ctx.lineTo(10 + sx * 9, -18); ctx.closePath(); paint(ctx, '#f4c85a', 1.6); }
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(15, -14, 2.8, 0, TAU); ctx.fill(); ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(15.6, -14, 1.5, 0, TAU); ctx.fill();
      ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(20, -9, 1, 0, TAU); ctx.fill();
      if (hp > 0.3) sparkle(ctx, 26, -8, 5, '#ffd870', t * 3);
      break;
    }
  }
  ctx.restore();
}
