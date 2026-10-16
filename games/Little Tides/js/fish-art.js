// Procedural fish, junk, treasure and gear illustrations. Every species has its own body type,
// palette, pattern and features; animation comes from the time parameter.
import { INK, TAU, clamp, lerp, hash, hexRgb, smoothPath, organic, glow, sparkle, shade, mix, rgba } from './draw.js';

const SIL = '#1d2c48';
const LW = 0.026;

function ell(ctx, cx, cy, rx, ry, rot = 0) { ctx.beginPath(); ctx.ellipse(cx, cy, Math.max(0.0001, rx), Math.max(0.0001, ry), rot, 0, TAU); }
function P(ctx, fill, sil, lw = LW) {
  ctx.fillStyle = sil ? SIL : fill; ctx.fill();
  ctx.lineWidth = lw; ctx.strokeStyle = sil ? SIL : INK; ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.stroke();
}
function ribbon(ctx, pts, widths) {
  const n = pts.length, top = [], bot = [];
  for (let i = 0; i < n; i++) {
    const p = pts[i], q = pts[Math.min(i + 1, n - 1)], r = pts[Math.max(i - 1, 0)];
    const dx = q[0] - r[0], dy = q[1] - r[1], L = Math.hypot(dx, dy) || 1, nx = -dy / L, ny = dx / L;
    top.push([p[0] + nx * widths[i], p[1] + ny * widths[i]]);
    bot.push([p[0] - nx * widths[i], p[1] - ny * widths[i]]);
  }
  smoothPath(ctx, [...top, ...bot.reverse()], true);
}
function eye(ctx, x, y, r, sil, glowEye) {
  if (sil) return;
  ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fillStyle = glowEye || '#fff'; ctx.fill(); ctx.lineWidth = LW * 0.7; ctx.strokeStyle = INK; ctx.stroke();
  ctx.beginPath(); ctx.arc(x + r * 0.25, y, r * 0.55, 0, TAU); ctx.fillStyle = INK; ctx.fill();
  ctx.beginPath(); ctx.arc(x + r * 0.05, y - r * 0.3, r * 0.2, 0, TAU); ctx.fillStyle = '#fff'; ctx.fill();
}
function rotateColor(c) { const [r, g, b] = hexRgb(c); return '#' + [b, r, g].map(v => Math.round(v * 0.82 + 40).toString(16).padStart(2, '0')).join(''); }

/** Pattern layer, expects the body path to be clipped already. */
function pattern(ctx, sp, c, h, t, sil) {
  if (sil) return;
  const p = sp.pattern, seed = sp.zoneIndex * 31 + sp.order * 7;
  ctx.save();
  switch (p) {
    case 'vstripes': ctx.fillStyle = rgba(c[2], 0.75); for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.moveTo(0.3 - i * 0.14, -h); ctx.quadraticCurveTo(0.34 - i * 0.14, 0, 0.28 - i * 0.14, h); ctx.lineTo(0.22 - i * 0.14, h); ctx.quadraticCurveTo(0.27 - i * 0.14, 0, 0.24 - i * 0.14, -h); ctx.fill(); } break;
    case 'hstripe': ctx.strokeStyle = rgba(c[2], 0.85); ctx.lineWidth = h * 0.22; ctx.beginPath(); ctx.moveTo(0.5, -h * 0.02); ctx.quadraticCurveTo(0, h * 0.05, -0.4, 0); ctx.stroke(); break;
    case 'dorsal': ctx.fillStyle = rgba(c[2], 0.85); ctx.beginPath(); ctx.moveTo(0.5, -h * 0.5); for (let i = 0; i <= 8; i++) ctx.lineTo(0.5 - i * 0.11, -h * (0.12 + 0.07 * Math.sin(i * 1.9))); ctx.lineTo(-0.5, -h); ctx.closePath(); ctx.fill(); break;
    case 'spots': ctx.fillStyle = rgba(c[2], 0.8); for (let i = 0; i < 11; i++) { ctx.beginPath(); ctx.arc(0.34 - hash(seed + i) * 0.7, (hash(seed + i * 3) - 0.5) * h * 0.9, 0.012 + hash(seed + i * 5) * 0.02, 0, TAU); ctx.fill(); } break;
    case 'speckle': ctx.fillStyle = rgba(c[2], 0.55); for (let i = 0; i < 26; i++) { ctx.beginPath(); ctx.arc(0.4 - hash(seed + i) * 0.8, (hash(seed + i * 2) - 0.5) * h * 1.1, 0.007 + hash(seed + i * 4) * 0.007, 0, TAU); ctx.fill(); } break;
    case 'mottled': ctx.fillStyle = rgba(c[2], 0.4); for (let i = 0; i < 9; i++) { organic(ctx, 0.38 - hash(seed + i) * 0.76, (hash(seed + i * 3) - 0.5) * h * 0.9, 0.05 + hash(seed + i) * 0.05, 0.03 + hash(seed + i * 2) * 0.03, seed + i, 7, 0.2); ctx.fill(); } break;
    case 'bands': for (let i = 0; i < 3; i++) { const x = 0.26 - i * 0.2; ctx.fillStyle = c[1]; ctx.fillRect(x - 0.045, -h, 0.09, h * 2); ctx.fillStyle = c[2]; ctx.fillRect(x - 0.055, -h, 0.012, h * 2); ctx.fillRect(x + 0.043, -h, 0.012, h * 2); } break;
    case 'patch': for (let i = 0; i < 4; i++) { ctx.fillStyle = i % 2 ? c[1] : c[2]; organic(ctx, 0.3 - i * 0.18, (hash(seed + i) - 0.5) * h * 0.5, 0.08 + hash(seed + i) * 0.04, 0.09, seed + i, 8, 0.18); ctx.fill(); } break;
    case 'glowspots': for (let i = 0; i < 9; i++) { const x = 0.32 - i * 0.075, y = h * 0.22 + Math.sin(i) * 0.02, a = 0.55 + 0.4 * Math.sin(t * 2 + i); glow(ctx, x, y, 0.045, c[1], a); ctx.fillStyle = c[1]; ctx.beginPath(); ctx.arc(x, y, 0.011, 0, TAU); ctx.fill(); } break;
    case 'rays': ctx.strokeStyle = rgba(c[2], 0.7); ctx.lineWidth = 0.015; for (let i = 0; i < 9; i++) { const a = -1.3 + i * 0.32; ctx.beginPath(); ctx.moveTo(0.05, 0); ctx.lineTo(0.05 + Math.cos(a + Math.PI) * 0.5 * -1, Math.sin(a) * 0.5); ctx.stroke(); } break;
    case 'scales': ctx.strokeStyle = rgba(c[2], 0.35); ctx.lineWidth = 0.01; for (let r = 0; r < 4; r++) for (let i = 0; i < 8; i++) { ctx.beginPath(); ctx.arc(0.34 - i * 0.1 + (r % 2) * 0.05, -h * 0.33 + r * h * 0.22, 0.05, 0.3, 2.8); ctx.stroke(); } break;
    case 'swirl': ctx.strokeStyle = c[2]; ctx.lineWidth = 0.022; for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.moveTo(0.3 - i * 0.14, -h * 0.35); ctx.bezierCurveTo(0.34 - i * 0.14, -h * 0.1, 0.22 - i * 0.14, h * 0.1, 0.28 - i * 0.14, h * 0.35); ctx.stroke(); } break;
    case 'sheen': { const g = ctx.createLinearGradient(0, -h * 0.5, 0, h * 0.5); g.addColorStop(0, 'rgba(255,255,255,0.0)'); g.addColorStop(0.35, 'rgba(255,255,255,0.55)'); g.addColorStop(0.5, 'rgba(255,255,255,0.05)'); g.addColorStop(1, 'rgba(255,255,255,0.35)'); ctx.fillStyle = g; ctx.fillRect(-0.5, -h, 1.1, h * 2); sparkle(ctx, 0.1 + Math.sin(t) * 0.2, -h * 0.1, 0.03, '#fff', t); break; }
    case 'crown': ctx.fillStyle = c[1]; for (let i = 0; i < 6; i++) { ctx.beginPath(); ctx.arc(0.3 - i * 0.12, -h * 0.1 + (i % 2) * h * 0.18, 0.045, 0, TAU); ctx.fill(); } break;
  }
  ctx.restore();
}

// ---------- Body drawers ----------
function bodyFish(ctx, sp, c, t, sil, torp) {
  const h = sp.h, f = sp.feature, sway = Math.sin(t * 4 + sp.order) * 0.07;
  const big = sp.body === 'leviathan';
  // tail
  ctx.save(); ctx.translate(-0.36, 0); ctx.rotate(sway);
  const th = torp ? h * 0.95 : h * 0.72;
  ctx.beginPath(); ctx.moveTo(0.02, 0);
  if (torp || big) { ctx.quadraticCurveTo(-0.08, -th * 0.5, -0.2, -th); ctx.quadraticCurveTo(-0.12, 0, -0.2, th); ctx.quadraticCurveTo(-0.08, th * 0.5, 0.02, 0); }
  else { ctx.quadraticCurveTo(-0.1, -th, -0.22, -th * 0.8); ctx.quadraticCurveTo(-0.17, 0, -0.22, th * 0.8); ctx.quadraticCurveTo(-0.1, th, 0.02, 0); }
  ctx.closePath(); P(ctx, f === 'crown' ? c[1] : c[2], sil);
  if (!sil) { ctx.strokeStyle = rgba(INK, 0.35); ctx.lineWidth = 0.01; for (let i = -1; i <= 1; i++) { ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(-0.17, i * th * 0.55); ctx.stroke(); } }
  ctx.restore();
  // dorsal fin
  const dh = f === 'crest' ? h * 1.1 : h * 0.55;
  ctx.beginPath(); ctx.moveTo(0.22, -h * 0.46); ctx.quadraticCurveTo(0.05, -h * 0.46 - dh, -0.24, -h * 0.4 - (f === 'longfins' ? 0.12 : 0)); ctx.lineTo(-0.16, -h * 0.32); ctx.closePath(); P(ctx, c[2], sil);
  // anal fin
  ctx.beginPath(); ctx.moveTo(-0.02, h * 0.44); ctx.quadraticCurveTo(-0.14, h * 0.44 + h * 0.4 + (f === 'longfins' ? 0.1 : 0), -0.26, h * 0.3); ctx.lineTo(-0.14, h * 0.36); ctx.closePath(); P(ctx, c[2], sil);
  // body
  const nose = f === 'beak' ? 0.52 : 0.5;
  const bp = () => { ctx.beginPath(); ctx.moveTo(nose, 0.02);
  ctx.bezierCurveTo(0.42, -h * 0.62, 0.1, -h * 0.64, -0.18, -h * 0.4); ctx.bezierCurveTo(-0.3, -h * 0.28, -0.36, -h * 0.12, -0.38, 0);
  ctx.bezierCurveTo(-0.36, h * 0.12, -0.3, h * 0.28, -0.18, h * 0.42); ctx.bezierCurveTo(0.1, h * 0.62, 0.42, h * 0.56, nose, 0.02); ctx.closePath(); };
  bp();
  const gradFill = sil ? SIL : (() => { const g = ctx.createLinearGradient(0, -h * 0.6, 0, h * 0.6); g.addColorStop(0, c[0]); g.addColorStop(0.62, shade(c[0], 0.12)); g.addColorStop(1, c[1]); return g; })();
  ctx.fillStyle = gradFill; ctx.fill();
  ctx.save(); ctx.clip();
  if (!sil) {
    if (f === 'glass') { ctx.fillStyle = 'rgba(255,255,255,.25)'; ctx.fillRect(-0.5, -h, 1.1, h * 2); }
    pattern(ctx, sp, c, h, t, sil);
    if (f === 'moss') { ctx.fillStyle = 'rgba(70,120,50,.7)'; for (let i = 0; i < 7; i++) { organic(ctx, 0.3 - i * 0.1, -h * 0.4 + hash(i) * 0.04, 0.07, 0.05, i, 7, 0.25); ctx.fill(); } }
    if (f === 'crystal') { ctx.fillStyle = 'rgba(255,255,255,.35)'; for (let i = 0; i < 5; i++) { ctx.beginPath(); ctx.moveTo(0.3 - i * 0.14, -h * 0.5); ctx.lineTo(0.22 - i * 0.14, 0); ctx.lineTo(0.3 - i * 0.14, h * 0.5); ctx.lineTo(0.38 - i * 0.14, 0); ctx.closePath(); ctx.fill(); } }
    if (f === 'void') { ctx.fillStyle = '#fff'; for (let i = 0; i < 14; i++) { ctx.globalAlpha = 0.4 + 0.5 * Math.sin(t * 2 + i); ctx.beginPath(); ctx.arc(0.4 - hash(i) * 0.8, (hash(i * 3) - 0.5) * h, 0.008, 0, TAU); ctx.fill(); } ctx.globalAlpha = 1; }
    // belly shadow + highlight
    ctx.fillStyle = 'rgba(255,255,255,.22)'; ell(ctx, 0.12, -h * 0.28, 0.3, h * 0.13, -0.05); ctx.fill();
  }
  ctx.restore();
  bp(); ctx.lineWidth = LW; ctx.strokeStyle = sil ? SIL : INK; ctx.lineJoin = 'round'; ctx.stroke();
  if (f === 'glass' && !sil) { ctx.strokeStyle = 'rgba(80,100,120,.6)'; ctx.lineWidth = 0.012; ctx.beginPath(); ctx.moveTo(0.4, 0); ctx.lineTo(-0.3, 0); ctx.stroke(); for (let i = 0; i < 8; i++) { ctx.beginPath(); ctx.moveTo(0.3 - i * 0.08, 0); ctx.lineTo(0.28 - i * 0.08, h * 0.2); ctx.stroke(); } }
  // gill + pectoral
  if (!sil) { ctx.strokeStyle = rgba(INK, 0.45); ctx.lineWidth = 0.014; ctx.beginPath(); ctx.arc(0.24, 0, h * 0.5, 1.9, 4.4); ctx.stroke(); }
  ctx.save(); ctx.translate(0.2, h * 0.12); ctx.rotate(0.35 + Math.sin(t * 5) * 0.25);
  if (f === 'wings') {
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(-0.12, -h * 1.5, -0.36, -h * 1.2); ctx.quadraticCurveTo(-0.22, -h * 0.4, -0.04, h * 0.1); ctx.closePath();
    ctx.fillStyle = sil ? SIL : 'rgba(210,240,250,.8)'; ctx.fill(); ctx.lineWidth = LW * 0.8; ctx.strokeStyle = sil ? SIL : INK; ctx.stroke();
  } else { ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(-0.1, h * 0.35, -0.2, h * 0.28); ctx.quadraticCurveTo(-0.12, 0, 0, 0); ctx.closePath(); P(ctx, c[2], sil, LW * 0.8); }
  ctx.restore();
  // features: head decor
  if (f === 'beak') { ctx.beginPath(); ctx.moveTo(0.46, -h * 0.05); ctx.quadraticCurveTo(0.54, 0, 0.46, h * 0.12); ctx.closePath(); P(ctx, '#f8f0d0', sil, LW * 0.8); }
  if (f === 'fangs' && !sil) { ctx.fillStyle = '#fff'; for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.moveTo(0.44 - i * 0.025, h * 0.1); ctx.lineTo(0.43 - i * 0.025, h * 0.3); ctx.lineTo(0.41 - i * 0.025, h * 0.1); ctx.fill(); } }
  if (f === 'whiskers') { ctx.strokeStyle = INK; ctx.lineWidth = 0.014; for (const k of [-1, 1]) { ctx.beginPath(); ctx.moveTo(0.46, h * 0.1); ctx.quadraticCurveTo(0.56, h * 0.1 + k * 0.08, 0.62 + Math.sin(t * 3) * 0.02, h * 0.1 + k * 0.17); ctx.stroke(); } }
  if (f === 'jaw' && !sil) { ctx.strokeStyle = INK; ctx.lineWidth = 0.016; ctx.beginPath(); ctx.moveTo(0.5, 0.01); ctx.lineTo(0.3, h * 0.16); ctx.stroke(); ctx.fillStyle = '#fff'; for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.moveTo(0.46 - i * 0.04, 0.02 + i * 0.006); ctx.lineTo(0.45 - i * 0.04, 0.07 + i * 0.006); ctx.lineTo(0.43 - i * 0.04, 0.025 + i * 0.006); ctx.fill(); } }
  if (f === 'crown') { ctx.fillStyle = sil ? SIL : '#ffd870'; ctx.beginPath(); ctx.moveTo(0.16, -h * 0.58); for (let i = 0; i < 5; i++) { ctx.lineTo(0.16 - i * 0.06 - 0.02, -h * 0.95); ctx.lineTo(0.16 - i * 0.06 - 0.05, -h * 0.58); } ctx.fill(); ctx.stroke(); glow(ctx, 0.04, -h * 0.8, 0.12, '#ffd870', 0.4); }
  if (f === 'pearl' && !sil) { glow(ctx, 0.05, 0, 0.18, '#fff3c8', 0.8); ctx.beginPath(); ctx.arc(0.05, 0, 0.07, 0, TAU); ctx.fillStyle = '#fffbe8'; ctx.fill(); ctx.lineWidth = LW * 0.7; ctx.stroke(); }
  if (f === 'jewel' && !sil) for (let i = 0; i < 3; i++) sparkle(ctx, 0.25 - i * 0.18 + Math.sin(t * 2 + i) * 0.02, -h * 0.2 + i * 0.03, 0.035, '#fff', t + i);
  if (big) {
    ctx.fillStyle = sil ? SIL : c[2];
    for (let i = 0; i < 7; i++) { ctx.beginPath(); ctx.moveTo(0.3 - i * 0.1, -h * 0.58); ctx.lineTo(0.26 - i * 0.1, -h * 0.58 - 0.09 - hash(i) * 0.05); ctx.lineTo(0.2 - i * 0.1, -h * 0.55); ctx.closePath(); ctx.fill(); ctx.stroke(); }
  }
  // eye
  const ey = f === 'moss' ? -h * 0.1 : -h * 0.12;
  eye(ctx, 0.33, ey, h * (big ? 0.12 : 0.2), sil, big || f === 'void' ? '#ffe08a' : null);
}

function bodyRound(ctx, sp, c, t, sil) {
  const h = sp.h, sway = Math.sin(t * 5 + sp.order) * 0.08;
  ctx.save(); ctx.translate(-0.34, 0); ctx.rotate(sway); ctx.beginPath(); ctx.moveTo(0.04, 0); ctx.quadraticCurveTo(-0.1, -h * 0.4, -0.16, -h * 0.34); ctx.quadraticCurveTo(-0.12, 0, -0.16, h * 0.34); ctx.quadraticCurveTo(-0.1, h * 0.4, 0.04, 0); ctx.closePath(); P(ctx, c[1], sil); ctx.restore();
  // long dorsal & anal fins
  ctx.beginPath(); ctx.moveTo(0.28, -h * 0.4); ctx.quadraticCurveTo(0.05, -h * 0.95 - Math.sin(t * 4) * 0.01, -0.3, -h * 0.25); ctx.lineTo(-0.2, -h * 0.3); ctx.closePath(); P(ctx, c[2], sil);
  ctx.beginPath(); ctx.moveTo(0.22, h * 0.42); ctx.quadraticCurveTo(0, h * 0.95, -0.3, h * 0.25); ctx.lineTo(-0.18, h * 0.3); ctx.closePath(); P(ctx, c[2], sil);
  // body disc with snout
  const bp = () => { ctx.beginPath(); ctx.moveTo(0.52, 0.02);
  ctx.bezierCurveTo(0.42, -h * 0.12, 0.38, -h * 0.5, 0.1, -h * 0.5); ctx.bezierCurveTo(-0.2, -h * 0.5, -0.38, -h * 0.25, -0.38, 0);
  ctx.bezierCurveTo(-0.38, h * 0.25, -0.2, h * 0.5, 0.1, h * 0.5); ctx.bezierCurveTo(0.38, h * 0.5, 0.42, h * 0.14, 0.52, 0.02); ctx.closePath(); };
  bp();
  const fill = sil ? SIL : (() => { const g = ctx.createRadialGradient(0.05, -h * 0.2, 0.02, 0, 0, 0.42); g.addColorStop(0, shade(c[0], 0.2)); g.addColorStop(1, c[0]); return g; })();
  ctx.fillStyle = fill; ctx.fill();
  ctx.save(); ctx.clip(); pattern(ctx, sp, c, h, t, sil);
  if (!sil && sp.pattern === 'belly') { ctx.fillStyle = c[1]; ell(ctx, 0.0, h * 0.5, 0.45, h * 0.3); ctx.fill(); }
  if (!sil && sp.pattern === 'vstripes') { ctx.fillStyle = c[1]; ctx.fillRect(0.28, -h, 0.05, h * 2); }
  ctx.restore();
  bp(); ctx.lineWidth = LW; ctx.strokeStyle = sil ? SIL : INK; ctx.stroke();
  ctx.save(); ctx.translate(0.14, h * 0.1); ctx.rotate(0.3 + Math.sin(t * 5) * 0.25); ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(-0.08, h * 0.3, -0.18, h * 0.24); ctx.quadraticCurveTo(-0.1, 0, 0, 0); P(ctx, c[2], sil, LW * 0.8); ctx.restore();
  eye(ctx, 0.3, -h * 0.1, h * 0.13, sil);
}

function bodyEel(ctx, sp, c, t, sil) {
  const n = 22, amp = 0.07, pts = [], ws = [], f = sp.feature;
  const th = Math.max(0.03, sp.h * 0.5);
  for (let i = 0; i < n; i++) {
    const u = i / (n - 1), x = 0.48 - u * 0.96;
    pts.push([x, Math.sin(u * 7 - t * 3.2) * amp * (0.3 + u)]);
    ws.push(th * (u < 0.12 ? 0.55 + u * 3.5 : 1) * (1 - Math.pow(u, 2.6) * 0.92));
  }
  // dorsal fin line
  ctx.strokeStyle = sil ? SIL : c[2]; ctx.lineWidth = th * 0.7; ctx.beginPath(); pts.forEach((p, i) => { const q = [p[0], p[1] - ws[i] * 1.2]; i ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1]); }); ctx.stroke();
  const bp = () => ribbon(ctx, pts, ws);
  bp();
  const fill = sil ? SIL : (() => { const g = ctx.createLinearGradient(0, -th, 0, th); g.addColorStop(0, c[0]); g.addColorStop(1, c[1]); return g; })();
  ctx.fillStyle = fill; ctx.fill();
  ctx.save(); ctx.clip();
  if (!sil) {
    const seed = sp.order * 13;
    if (sp.pattern === 'spots') { ctx.fillStyle = rgba(c[2], 0.85); pts.forEach((p, i) => { if (i % 2 === 0) { ctx.beginPath(); ctx.arc(p[0], p[1] + (hash(seed + i) - 0.5) * ws[i], ws[i] * 0.3, 0, TAU); ctx.fill(); } }); }
    else if (sp.pattern === 'glowspots') pts.forEach((p, i) => { if (i % 2 === 1) { glow(ctx, p[0], p[1] + ws[i] * 0.3, 0.04, c[1], 0.5 + 0.4 * Math.sin(t * 2 + i)); ctx.fillStyle = c[1]; ctx.beginPath(); ctx.arc(p[0], p[1] + ws[i] * 0.3, 0.008, 0, TAU); ctx.fill(); } });
    else if (sp.pattern === 'sheen') { ctx.fillStyle = 'rgba(255,255,255,.45)'; pts.forEach((p, i) => { ctx.fillRect(p[0] - 0.01, p[1] - ws[i], 0.02, ws[i] * 0.8); }); }
    if (f === 'glass') { ctx.fillStyle = 'rgba(255,255,255,.35)'; ctx.fillRect(-0.5, -0.2, 1, 0.4); }
  }
  ctx.restore();
  bp(); ctx.lineWidth = LW; ctx.strokeStyle = sil ? SIL : INK; ctx.stroke();
  const hx = pts[0][0], hy = pts[0][1];
  if (f === 'jaw' || f === 'pelican') {
    const open = f === 'pelican' ? 0.1 : 0.04;
    ctx.beginPath(); ctx.moveTo(hx + 0.01, hy); ctx.lineTo(hx + 0.07, hy - open); ctx.lineTo(hx + 0.07, hy + open + 0.03); ctx.closePath(); P(ctx, sil ? SIL : '#3a1a2a', sil, LW * 0.8);
    if (!sil) { ctx.fillStyle = '#fff'; for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.moveTo(hx + 0.02 + i * 0.015, hy - 0.005); ctx.lineTo(hx + 0.03 + i * 0.015, hy + 0.025); ctx.lineTo(hx + 0.04 + i * 0.015, hy - 0.005); ctx.fill(); } }
  }
  eye(ctx, hx - 0.03, hy - th * 0.35, Math.max(0.014, th * 0.35), sil);
}

function bodySlim(ctx, sp, c, t, sil) {
  const n = 14, pts = [], ws = [], th = Math.max(0.035, sp.h * 0.7), pipe = sp.id === 'pipefish';
  for (let i = 0; i < n; i++) { const u = i / (n - 1); pts.push([0.46 - u * 0.86, Math.sin(u * 5 - t * 3) * 0.015 * u]); ws.push(th * (u < 0.15 ? (pipe ? 0.35 : 0.8 + u * 1.3) : 1) * (1 - Math.pow(u, 2) * 0.55)); }
  ctx.save(); ctx.translate(-0.4, pts[n - 1][1]); ctx.rotate(Math.sin(t * 5) * 0.1);
  ctx.beginPath(); ctx.moveTo(0.03, 0); ctx.quadraticCurveTo(-0.08, -th * 1.3, -0.14, -th * 0.9); ctx.quadraticCurveTo(-0.1, 0, -0.14, th * 0.9); ctx.quadraticCurveTo(-0.08, th * 1.3, 0.03, 0); ctx.closePath(); P(ctx, sp.colors[2], sil); ctx.restore();
  const bp = () => ribbon(ctx, pts, ws); bp(); ctx.fillStyle = sil ? SIL : sp.colors[0]; ctx.fill();
  ctx.save(); ctx.clip();
  if (!sil) {
    if (sp.pattern === 'bands') { ctx.fillStyle = sp.colors[1]; for (let i = 0; i < 7; i++) ctx.fillRect(0.3 - i * 0.11, -th * 1.2, 0.04, th * 2.4); }
    else if (sp.pattern === 'hstripe') { ctx.fillStyle = sp.colors[2]; ctx.fillRect(-0.4, -th * 0.15, 0.9, th * 0.3); }
    else if (sp.pattern === 'spots') { ctx.fillStyle = rgba(sp.colors[2], 0.8); for (let i = 0; i < 9; i++) { ctx.beginPath(); ctx.arc(0.3 - i * 0.08, (hash(i) - 0.5) * th, th * 0.18, 0, TAU); ctx.fill(); } }
    ctx.fillStyle = 'rgba(255,255,255,.25)'; ctx.fillRect(-0.5, -th, 1, th * 0.5);
  }
  ctx.restore();
  bp(); ctx.lineWidth = LW; ctx.strokeStyle = sil ? SIL : INK; ctx.stroke();
  if (sp.feature === 'longfins') { ctx.strokeStyle = sil ? SIL : sp.colors[2]; ctx.lineWidth = 0.02; ctx.beginPath(); ctx.moveTo(0.3, -th); ctx.quadraticCurveTo(0, -th * 3.5, -0.3, -th); ctx.stroke(); }
  if (pipe) { ctx.beginPath(); ctx.arc(0.52, 0, 0.012, 0, TAU); }
  eye(ctx, 0.36, -th * 0.2, th * 0.28, sil);
}

function bodyFlat(ctx, sp, c, t, sil) {
  const h = sp.h * 0.7;
  ctx.save(); ctx.translate(-0.4, 0); ctx.rotate(Math.sin(t * 4) * 0.06); ctx.beginPath(); ctx.moveTo(0.04, 0); ctx.quadraticCurveTo(-0.08, -h * 0.5, -0.14, -h * 0.4); ctx.quadraticCurveTo(-0.1, 0, -0.14, h * 0.4); ctx.quadraticCurveTo(-0.08, h * 0.5, 0.04, 0); P(ctx, c[2], sil); ctx.restore();
  // frilled fins
  ctx.strokeStyle = sil ? SIL : c[2]; ctx.lineWidth = h * 0.18;
  for (const s of [-1, 1]) { ctx.beginPath(); for (let i = 0; i <= 14; i++) { const x = 0.36 - i * 0.052, y = s * (h * 0.62 + Math.sin(i * 2 + t * 6 * s) * h * 0.04) * Math.sqrt(Math.max(0.15, 1 - Math.pow(x / 0.5, 2))); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); } ctx.stroke(); }
  const bp = () => organic(ctx, 0, 0, 0.44, h * 0.6, sp.order + 2, 12, 0.03);
  bp();
  ctx.fillStyle = sil ? SIL : c[0]; ctx.fill();
  ctx.save(); ctx.clip(); if (!sil) pattern(ctx, sp, c, h, t, sil); ctx.restore();
  bp(); ctx.lineWidth = LW; ctx.strokeStyle = sil ? SIL : INK; ctx.stroke();
  eye(ctx, 0.34, -h * 0.22, h * 0.13, sil); eye(ctx, 0.27, -h * 0.34, h * 0.11, sil);
}

function bodyRay(ctx, sp, c, t, sil) {
  const flap = 1 + Math.sin(t * 2.6 + sp.order) * 0.16;
  const w = sp.h * 0.62 * flap;
  ctx.strokeStyle = sil ? SIL : INK; ctx.lineWidth = LW * 1.6; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(-0.26, 0); ctx.quadraticCurveTo(-0.42, Math.sin(t * 3) * 0.04, -0.6, Math.sin(t * 3 + 1) * 0.07); ctx.stroke();
  ctx.strokeStyle = sil ? SIL : c[2]; ctx.lineWidth = LW * 0.8; ctx.stroke();
  const bp = () => {
    ctx.beginPath(); ctx.moveTo(0.5, 0);
    ctx.bezierCurveTo(0.36, -w * 0.5, 0.18, -w * 1.1, -0.06, -w * 1.2); ctx.bezierCurveTo(-0.2, -w * 1.0, -0.3, -w * 0.4, -0.3, 0);
    ctx.bezierCurveTo(-0.3, w * 0.4, -0.2, w * 1.0, -0.06, w * 1.2); ctx.bezierCurveTo(0.18, w * 1.1, 0.36, w * 0.5, 0.5, 0); ctx.closePath();
  };
  bp();
  const fill = sil ? SIL : (() => { const g = ctx.createRadialGradient(0.12, 0, 0.02, 0.05, 0, 0.5); g.addColorStop(0, shade(c[0], 0.22)); g.addColorStop(0.75, c[0]); g.addColorStop(1, shade(c[0], -0.1)); return g; })();
  ctx.fillStyle = fill; ctx.fill();
  ctx.save(); ctx.clip();
  if (!sil) {
    if (sp.pattern === 'spots') { ctx.fillStyle = rgba(c[2], 0.65); for (let i = 0; i < 12; i++) { ctx.beginPath(); ctx.arc(0.3 - hash(i + sp.order) * 0.55, (hash(i * 3) - 0.5) * w * 1.8, 0.014 + hash(i) * 0.014, 0, TAU); ctx.fill(); } }
    else if (sp.pattern === 'glowspots') for (let i = 0; i < 10; i++) { const x = 0.3 - hash(i + sp.order) * 0.5, y = (hash(i * 3) - 0.5) * w * 1.7; glow(ctx, x, y, 0.05, c[1], 0.4 + 0.4 * Math.sin(t * 2 + i)); ctx.fillStyle = c[1]; ctx.beginPath(); ctx.arc(x, y, 0.01, 0, TAU); ctx.fill(); }
    bp(); ctx.lineWidth = 0.06; ctx.strokeStyle = rgba(c[1], 0.55); ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,.18)'; ell(ctx, 0.1, -w * 0.4, 0.22, w * 0.3); ctx.fill();
  }
  ctx.restore();
  bp(); ctx.lineWidth = LW; ctx.strokeStyle = sil ? SIL : INK; ctx.stroke();
  eye(ctx, 0.34, -w * 0.2, 0.03, sil); eye(ctx, 0.34, w * 0.2, 0.03, sil);
}

function bodyShark(ctx, sp, c, t, sil) {
  const h = sp.h, sway = Math.sin(t * 3 + sp.order) * 0.08;
  ctx.save(); ctx.translate(-0.36, 0); ctx.rotate(sway);
  ctx.beginPath(); ctx.moveTo(0.04, 0); ctx.quadraticCurveTo(-0.08, -h * 0.5, -0.2, -h * 1.5); ctx.quadraticCurveTo(-0.14, -h * 0.4, -0.18, -h * 0.1); ctx.quadraticCurveTo(-0.14, h * 0.4, -0.12, h * 0.8); ctx.quadraticCurveTo(-0.05, h * 0.4, 0.04, 0); ctx.closePath(); P(ctx, c[0], sil); ctx.restore();
  ctx.beginPath(); ctx.moveTo(0.14, -h * 0.5); ctx.quadraticCurveTo(0.02, -h * 1.9, -0.14, -h * 0.4); ctx.closePath(); P(ctx, c[0], sil);
  ctx.beginPath(); ctx.moveTo(0.08, h * 0.45); ctx.quadraticCurveTo(-0.08, h * 1.5, -0.2, h * 0.8); ctx.lineTo(-0.06, h * 0.4); ctx.closePath(); P(ctx, c[0], sil);
  const bp = () => { ctx.beginPath(); ctx.moveTo(0.52, 0.02); ctx.bezierCurveTo(0.42, -h * 0.55, 0.1, -h * 0.65, -0.16, -h * 0.42); ctx.bezierCurveTo(-0.28, -h * 0.28, -0.36, -h * 0.1, -0.38, 0); ctx.bezierCurveTo(-0.36, h * 0.1, -0.28, h * 0.28, -0.16, h * 0.42); ctx.bezierCurveTo(0.1, h * 0.62, 0.4, h * 0.5, 0.52, 0.04); ctx.closePath(); };
  bp();
  const fill = sil ? SIL : (() => { const g = ctx.createLinearGradient(0, -h * 0.6, 0, h * 0.6); g.addColorStop(0, c[0]); g.addColorStop(0.55, shade(c[0], 0.1)); g.addColorStop(0.62, c[1]); g.addColorStop(1, c[1]); return g; })();
  ctx.fillStyle = fill; ctx.fill(); ctx.save(); ctx.clip(); pattern(ctx, sp, c, h, t, sil); ctx.restore();
  bp(); ctx.lineWidth = LW; ctx.strokeStyle = sil ? SIL : INK; ctx.stroke();
  if (!sil) { ctx.strokeStyle = rgba(INK, 0.5); ctx.lineWidth = 0.013; for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.moveTo(0.22 - i * 0.03, -h * 0.2); ctx.quadraticCurveTo(0.2 - i * 0.03, 0, 0.22 - i * 0.03, h * 0.2); ctx.stroke(); } ctx.beginPath(); ctx.moveTo(0.5, h * 0.12); ctx.quadraticCurveTo(0.38, h * 0.24, 0.3, h * 0.14); ctx.stroke(); }
  ctx.beginPath(); ctx.moveTo(0.1, h * 0.2); ctx.quadraticCurveTo(0.0, h * 1.0, -0.1, h * 0.8); ctx.lineTo(0.0, h * 0.25); ctx.closePath(); P(ctx, c[0], sil, LW * 0.8);
  eye(ctx, 0.4, -h * 0.1, h * 0.1, sil);
}

function bodyJelly(ctx, sp, c, t, sil) {
  const pulse = Math.sin(t * 2.2 + sp.order) * 0.07, aur = sp.feature === 'aurora';
  ctx.save(); ctx.translate(0, -0.05 + Math.sin(t * 1.3) * 0.015);
  for (let i = 0; i < 7; i++) {
    const x = -0.24 + i * 0.08; ctx.beginPath(); ctx.moveTo(x, 0.12);
    for (let k = 1; k <= 6; k++) ctx.lineTo(x + Math.sin(t * 2.4 + i + k * 0.9) * 0.025, 0.12 + k * 0.06 * (1 + (i % 3) * 0.2));
    ctx.lineWidth = 0.022; ctx.strokeStyle = sil ? SIL : rgba(c[0], 0.7); ctx.lineCap = 'round'; ctx.stroke();
  }
  ctx.lineWidth = 0.03; ctx.strokeStyle = sil ? SIL : rgba(c[2], 0.5);
  for (let i = 0; i < 3; i++) { const x = -0.12 + i * 0.12; ctx.beginPath(); ctx.moveTo(x, 0.1); ctx.bezierCurveTo(x + Math.sin(t * 2 + i) * 0.06, 0.25, x - Math.sin(t * 2 + i) * 0.06, 0.35, x, 0.5); ctx.stroke(); }
  ctx.beginPath(); ctx.moveTo(-0.34, 0.1); ctx.bezierCurveTo(-0.38, -0.34 * (1 + pulse), 0.38, -0.34 * (1 + pulse), 0.34, 0.1);
  ctx.quadraticCurveTo(0.2, 0.17, 0.12, 0.11); ctx.quadraticCurveTo(0, 0.18, -0.12, 0.11); ctx.quadraticCurveTo(-0.2, 0.17, -0.34, 0.1); ctx.closePath();
  const fill = sil ? SIL : (() => { const g = ctx.createRadialGradient(0, -0.1, 0.02, 0, 0, 0.4); g.addColorStop(0, rgba(c[1], 0.95)); g.addColorStop(1, rgba(aur ? c[2] : c[0], 0.8)); return g; })();
  ctx.fillStyle = fill; ctx.fill(); ctx.lineWidth = LW; ctx.strokeStyle = sil ? SIL : rgba(c[2], 0.9); ctx.stroke();
  if (!sil) {
    ctx.save(); ctx.clip();
    if (aur) { for (let i = 0; i < 4; i++) { ctx.fillStyle = rgba(['#7af0c8', '#c8a8ff', '#7ac8ff', '#ff9ad0'][i], 0.35); ctx.beginPath(); ctx.moveTo(-0.34, -0.1 + i * 0.05); ctx.quadraticCurveTo(0, -0.3 + Math.sin(t * 2 + i) * 0.08 + i * 0.05, 0.34, -0.1 + i * 0.05); ctx.lineTo(0.34, 0.3); ctx.lineTo(-0.34, 0.3); ctx.fill(); } }
    ctx.restore();
    ctx.strokeStyle = 'rgba(255,255,255,.7)'; ctx.lineWidth = 0.02; ctx.beginPath(); ctx.arc(0, -0.04, 0.24, 3.6, 4.5); ctx.stroke();
    ctx.fillStyle = rgba(c[2], 0.5); for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.arc(Math.cos(i * 1.57 + 0.5) * 0.08, -0.08 + Math.sin(i * 1.57 + 0.5) * 0.06, 0.03, 0, TAU); ctx.fill(); }
    if (sp.pattern === 'glowspots') for (let i = 0; i < 6; i++) glow(ctx, -0.25 + i * 0.1, 0.07, 0.035, c[1], 0.8);
  }
  ctx.restore();
}

function bodySquid(ctx, sp, c, t, sil) {
  const f = sp.feature, glass = f === 'glass', sw = Math.sin(t * 3 + sp.order);
  // tentacles to the right
  for (let i = 0; i < 8; i++) {
    const y0 = (i - 3.5) * 0.02, len = (i === 2 || i === 5 ? 0.36 : 0.26);
    ctx.beginPath(); ctx.moveTo(0.12, y0);
    for (let k = 1; k <= 6; k++) ctx.lineTo(0.12 + len * k / 6, y0 + Math.sin(t * 4 + i + k * 0.8) * 0.02 * k * 0.5 + (i - 3.5) * 0.012 * k * 0.4);
    ctx.lineWidth = 0.022; ctx.strokeStyle = sil ? SIL : rgba(c[0], glass ? 0.8 : 1); ctx.lineCap = 'round'; ctx.stroke();
  }
  // fins
  ctx.save(); ctx.translate(-0.4, 0); ctx.rotate(sw * 0.05); ctx.beginPath(); ctx.moveTo(0.14, 0); ctx.quadraticCurveTo(-0.08, -0.22, -0.12, -0.06); ctx.quadraticCurveTo(-0.14, 0, -0.12, 0.06); ctx.quadraticCurveTo(-0.08, 0.22, 0.14, 0); ctx.closePath(); P(ctx, rgba(c[1], glass ? 0.6 : 1), sil); ctx.restore();
  // mantle
  const bp = () => { ctx.beginPath(); ctx.moveTo(-0.46, 0); ctx.bezierCurveTo(-0.3, -0.18, 0, -0.17, 0.14, -0.09); ctx.quadraticCurveTo(0.2, 0, 0.14, 0.09); ctx.bezierCurveTo(0, 0.17, -0.3, 0.18, -0.46, 0); ctx.closePath(); };
  bp();
  const fill = sil ? SIL : (() => { const g = ctx.createLinearGradient(0, -0.18, 0, 0.18); g.addColorStop(0, rgba(c[0], glass ? 0.7 : 1)); g.addColorStop(1, rgba(c[1], glass ? 0.7 : 1)); return g; })();
  ctx.fillStyle = fill; ctx.fill(); ctx.save(); ctx.clip();
  if (!sil) {
    if (sp.pattern === 'spots') { ctx.fillStyle = rgba(c[2], 0.6); for (let i = 0; i < 14; i++) { ctx.beginPath(); ctx.arc(-0.4 + hash(i + sp.order) * 0.5, (hash(i * 3) - 0.5) * 0.28, 0.012 + hash(i) * 0.012, 0, TAU); ctx.fill(); } }
    if (sp.pattern === 'glowspots') for (let i = 0; i < 7; i++) { const x = -0.38 + i * 0.07; glow(ctx, x, 0.05 + Math.sin(i) * 0.03, 0.045, c[1], 0.5 + 0.4 * Math.sin(t * 2 + i)); ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(x, 0.05 + Math.sin(i) * 0.03, 0.01, 0, TAU); ctx.fill(); }
  }
  ctx.restore(); bp(); ctx.lineWidth = LW; ctx.strokeStyle = sil ? SIL : INK; ctx.stroke();
  ctx.beginPath(); ctx.arc(0.13, 0, 0.09, 0, TAU); P(ctx, rgba(c[0], glass ? 0.8 : 1), sil);
  eye(ctx, 0.15, -0.025, 0.04, sil); eye(ctx, 0.15, 0.04, 0.034, sil);
}

function bodyOctopus(ctx, sp, c, t, sil) {
  for (let i = 0; i < 8; i++) {
    const a0 = Math.PI * (0.18 + i * 0.09), sx = -0.22 + i * 0.062;
    const pts = []; for (let k = 0; k < 8; k++) { const u = k / 7; pts.push([sx + Math.sin(t * 2.2 + i + u * 5) * 0.045 * u + (i - 3.5) * 0.045 * u, 0.04 + u * 0.38 + Math.cos(a0) * 0.0]); }
    ctx.beginPath(); pts.forEach((p, k) => (k ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])));
    ctx.lineCap = 'round'; ctx.lineWidth = 0.07; ctx.strokeStyle = sil ? SIL : INK; ctx.stroke(); ctx.lineWidth = 0.05; ctx.strokeStyle = sil ? SIL : c[0]; ctx.stroke();
    if (!sil) { ctx.fillStyle = c[1]; for (let k = 2; k < 7; k += 2) { ctx.beginPath(); ctx.arc(pts[k][0], pts[k][1], 0.008, 0, TAU); ctx.fill(); } }
  }
  const bp = () => { ctx.beginPath(); ctx.moveTo(-0.26, 0.08); ctx.bezierCurveTo(-0.3, -0.34, 0.3, -0.34, 0.26, 0.08); ctx.quadraticCurveTo(0, 0.14, -0.26, 0.08); ctx.closePath(); };
  bp();
  const fill = sil ? SIL : (() => { const g = ctx.createRadialGradient(-0.05, -0.12, 0.02, 0, 0, 0.35); g.addColorStop(0, shade(c[0], 0.2)); g.addColorStop(1, c[0]); return g; })();
  ctx.fillStyle = fill; ctx.fill(); ctx.save(); ctx.clip();
  if (!sil) { ctx.fillStyle = rgba(c[2], 0.5); for (let i = 0; i < 12; i++) { ctx.beginPath(); ctx.arc((hash(i + 3) - 0.5) * 0.5, -0.2 + hash(i * 3) * 0.28, 0.012 + hash(i) * 0.014, 0, TAU); ctx.fill(); } }
  ctx.restore(); bp(); ctx.lineWidth = LW; ctx.strokeStyle = sil ? SIL : INK; ctx.stroke();
  eye(ctx, 0.1, -0.02, 0.05, sil); eye(ctx, -0.1, -0.02, 0.05, sil);
}

function bodyCrab(ctx, sp, c, t, sil) {
  const sc = Math.sin(t * 6) * 0.015;
  ctx.lineCap = 'round';
  for (const s of [-1, 1]) {
    for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.moveTo(s * 0.18, 0.06 + i * 0.03); ctx.lineTo(s * (0.34 + i * 0.03), 0.1 + i * 0.04 + sc * s); ctx.lineTo(s * (0.38 + i * 0.03), 0.22 + i * 0.03); ctx.lineWidth = 0.034; ctx.strokeStyle = sil ? SIL : INK; ctx.stroke(); ctx.lineWidth = 0.02; ctx.strokeStyle = sil ? SIL : c[0]; ctx.stroke(); }
    ctx.beginPath(); ctx.moveTo(s * 0.2, -0.05); ctx.lineTo(s * 0.34, -0.17 + Math.sin(t * 3 + s) * 0.02); ctx.lineWidth = 0.04; ctx.strokeStyle = sil ? SIL : INK; ctx.stroke(); ctx.lineWidth = 0.026; ctx.strokeStyle = sil ? SIL : c[0]; ctx.stroke();
    ctx.save(); ctx.translate(s * 0.38, -0.23 + Math.sin(t * 3 + s) * 0.02); ctx.rotate(s * -0.3); ctx.beginPath(); ctx.moveTo(0, 0.07); ctx.bezierCurveTo(-0.1, -0.02, -0.06, -0.12, 0, -0.1); ctx.bezierCurveTo(0.06, -0.12, 0.1, -0.02, 0, 0.07); P(ctx, c[0], sil); ctx.beginPath(); ctx.moveTo(0, -0.1); ctx.lineTo(0, 0.0); ctx.strokeStyle = sil ? SIL : INK; ctx.lineWidth = 0.014; ctx.stroke(); ctx.restore();
  }
  const bp = () => { ctx.beginPath(); ctx.ellipse(0, 0.02, 0.26, 0.17, 0, 0, TAU); };
  bp();
  const fill = sil ? SIL : (() => { const g = ctx.createRadialGradient(-0.05, -0.06, 0.02, 0, 0, 0.3); g.addColorStop(0, c[1]); g.addColorStop(1, c[0]); return g; })();
  ctx.fillStyle = fill; ctx.fill(); ctx.save(); ctx.clip();
  if (!sil) { ctx.fillStyle = rgba(c[2], 0.6); for (let i = 0; i < 9; i++) { ctx.beginPath(); ctx.arc((hash(i + 2) - 0.5) * 0.4, (hash(i * 4) - 0.4) * 0.22, 0.015 + hash(i) * 0.012, 0, TAU); ctx.fill(); } }
  ctx.restore(); bp(); ctx.lineWidth = LW; ctx.strokeStyle = sil ? SIL : INK; ctx.stroke();
  for (const s of [-1, 1]) { ctx.beginPath(); ctx.moveTo(s * 0.07, -0.12); ctx.lineTo(s * 0.08, -0.19); ctx.lineWidth = 0.016; ctx.strokeStyle = sil ? SIL : INK; ctx.stroke(); eye(ctx, s * 0.08, -0.2, 0.026, sil); }
}

function bodyStar(ctx, sp, c, t, sil) {
  ctx.save(); ctx.rotate(Math.sin(t * 0.8) * 0.12);
  const pts = []; for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + (i / 10) * TAU, r = i % 2 ? 0.17 : 0.44 * (1 + Math.sin(t * 1.5 + i) * 0.03); pts.push([Math.cos(a) * r, Math.sin(a) * r]); }
  const bp = () => smoothPath(ctx, pts, true);
  bp();
  const fill = sil ? SIL : (() => { const g = ctx.createRadialGradient(0, 0, 0.02, 0, 0, 0.45); g.addColorStop(0, c[1]); g.addColorStop(1, c[0]); return g; })();
  ctx.fillStyle = fill; ctx.fill(); ctx.save(); ctx.clip();
  if (!sil) {
    if (sp.pattern === 'glowspots') for (let i = 0; i < 5; i++) { const a = -Math.PI / 2 + (i / 5) * TAU; for (let k = 1; k <= 3; k++) { const x = Math.cos(a) * k * 0.11, y = Math.sin(a) * k * 0.11; glow(ctx, x, y, 0.05, '#bfe8ff', 0.5 + 0.4 * Math.sin(t * 2 + i + k)); ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(x, y, 0.01, 0, TAU); ctx.fill(); } }
    else { ctx.fillStyle = rgba(c[2], 0.85); for (let i = 0; i < 5; i++) { const a = -Math.PI / 2 + (i / 5) * TAU; for (let k = 1; k <= 3; k++) { ctx.beginPath(); ctx.arc(Math.cos(a) * k * 0.11, Math.sin(a) * k * 0.11, 0.018 - k * 0.002, 0, TAU); ctx.fill(); } } }
  }
  ctx.restore(); bp(); ctx.lineWidth = LW; ctx.strokeStyle = sil ? SIL : INK; ctx.stroke();
  ctx.restore();
}

function bodySeahorse(ctx, sp, c, t, sil) {
  const sw = Math.sin(t * 1.6) * 0.02;
  const pts = [[0.12, -0.36], [0.03, -0.27], [-0.03, -0.12], [-0.05 + sw, 0.04], [-0.02, 0.18], [0.07, 0.3], [0.17, 0.33], [0.2, 0.26], [0.14, 0.22]];
  const ws = [0.055, 0.075, 0.1, 0.1, 0.075, 0.05, 0.035, 0.025, 0.015];
  // dorsal fin fan
  ctx.beginPath(); ctx.moveTo(-0.05, -0.15); ctx.quadraticCurveTo(-0.22 + Math.sin(t * 8) * 0.02, -0.08, -0.08, 0.05); P(ctx, rgba(c[1], 0.85), sil, LW * 0.8);
  const bp = () => ribbon(ctx, pts, ws); bp(); ctx.fillStyle = sil ? SIL : c[0]; ctx.fill(); ctx.save(); ctx.clip();
  if (!sil) { ctx.strokeStyle = rgba(c[2], 0.6); ctx.lineWidth = 0.018; for (let i = 1; i < 7; i++) { ctx.beginPath(); ctx.moveTo(pts[i][0] - 0.1, pts[i][1]); ctx.lineTo(pts[i][0] + 0.1, pts[i][1] + 0.02); ctx.stroke(); } ctx.fillStyle = c[1]; ell(ctx, 0.02, -0.02, 0.05, 0.12); ctx.fill(); }
  ctx.restore(); bp(); ctx.lineWidth = LW; ctx.strokeStyle = sil ? SIL : INK; ctx.stroke();
  ctx.beginPath(); ctx.ellipse(0.2, -0.35, 0.07, 0.022, 0.15, 0, TAU); P(ctx, c[0], sil);
  eye(ctx, 0.1, -0.38, 0.022, sil);
  ctx.beginPath(); ctx.moveTo(0.06, -0.42); ctx.lineTo(0.04, -0.47); ctx.lineTo(0.1, -0.44); ctx.lineTo(0.12, -0.48); ctx.lineWidth = 0.02; ctx.strokeStyle = sil ? SIL : c[2]; ctx.stroke();
}

function bodyPuffer(ctx, sp, c, t, sil) {
  ctx.save(); ctx.translate(-0.28, 0); ctx.rotate(Math.sin(t * 6) * 0.15); ctx.beginPath(); ctx.moveTo(0.06, 0); ctx.quadraticCurveTo(-0.04, -0.14, -0.12, -0.09); ctx.quadraticCurveTo(-0.08, 0, -0.12, 0.09); ctx.quadraticCurveTo(-0.04, 0.14, 0.06, 0); P(ctx, c[2], sil); ctx.restore();
  const bp = () => organic(ctx, 0.04, 0, 0.34, 0.3, sp.order + 5, 11, 0.025);
  bp();
  const fill = sil ? SIL : (() => { const g = ctx.createRadialGradient(0.0, -0.1, 0.02, 0.04, 0, 0.36); g.addColorStop(0, shade(c[0], 0.25)); g.addColorStop(0.7, c[0]); g.addColorStop(1, shade(c[0], -0.1)); return g; })();
  ctx.fillStyle = fill; ctx.fill(); ctx.save(); ctx.clip();
  if (!sil) { ctx.fillStyle = c[1]; ell(ctx, 0.05, 0.22, 0.34, 0.14); ctx.fill(); pattern(ctx, sp, c, 0.6, t, sil); }
  ctx.restore(); bp(); ctx.lineWidth = LW; ctx.strokeStyle = sil ? SIL : INK; ctx.stroke();
  ctx.strokeStyle = sil ? SIL : INK; ctx.lineWidth = 0.014;
  for (let i = 0; i < 14; i++) { const a = -2.6 + i * 0.28, r0 = 0.3, x = 0.04 + Math.cos(a) * 0.335, y = Math.sin(a) * 0.3 * 1.04; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(a) * 0.04, y + Math.sin(a) * 0.04); ctx.stroke(); }
  ctx.save(); ctx.translate(0.08, 0.04); ctx.rotate(Math.sin(t * 9) * 0.4); ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(-0.08, 0.1, -0.14, 0.06); ctx.quadraticCurveTo(-0.06, -0.02, 0, 0); P(ctx, c[2], sil, LW * 0.8); ctx.restore();
  ctx.beginPath(); ctx.arc(0.36, 0.06, 0.03, 0, TAU); P(ctx, '#e8a090', sil, LW * 0.8);
  eye(ctx, 0.22, -0.08, 0.06, sil);
}

function bodyAngler(ctx, sp, c, t, sil) {
  const sw = Math.sin(t * 2.4) * 0.03;
  ctx.save(); ctx.translate(-0.3, 0); ctx.rotate(Math.sin(t * 4) * 0.1); ctx.beginPath(); ctx.moveTo(0.06, 0); ctx.quadraticCurveTo(-0.06, -0.18, -0.16, -0.12); ctx.quadraticCurveTo(-0.1, 0, -0.16, 0.12); ctx.quadraticCurveTo(-0.06, 0.18, 0.06, 0); P(ctx, c[0], sil); ctx.restore();
  // lure
  const lx = 0.4 + sw, ly = -0.5;
  ctx.beginPath(); ctx.moveTo(0.18, -0.2); ctx.quadraticCurveTo(0.22, -0.52, lx, ly); ctx.lineWidth = 0.02; ctx.strokeStyle = sil ? SIL : INK; ctx.stroke();
  if (!sil) { glow(ctx, lx, ly, 0.2, '#bfffee', 0.8); ctx.beginPath(); ctx.arc(lx, ly, 0.035, 0, TAU); ctx.fillStyle = '#eafff8'; ctx.fill(); }
  const bp = () => organic(ctx, 0.02, 0, 0.34, 0.3, sp.order + 9, 11, 0.04);
  bp();
  const fill = sil ? SIL : (() => { const g = ctx.createRadialGradient(-0.05, -0.1, 0.02, 0, 0, 0.36); g.addColorStop(0, shade(c[0], 0.15)); g.addColorStop(1, shade(c[0], -0.2)); return g; })();
  ctx.fillStyle = fill; ctx.fill(); ctx.save(); ctx.clip(); if (!sil) pattern(ctx, sp, c, 0.6, t, sil); ctx.restore(); bp(); ctx.lineWidth = LW; ctx.strokeStyle = sil ? SIL : INK; ctx.stroke();
  // mouth
  ctx.beginPath(); ctx.moveTo(0.34, 0.02); ctx.quadraticCurveTo(0.2, 0.2, -0.02, 0.1); ctx.lineWidth = 0.022; ctx.strokeStyle = sil ? SIL : INK; ctx.stroke();
  ctx.fillStyle = sil ? SIL : '#fff';
  for (let i = 0; i < 6; i++) { const x = 0.32 - i * 0.05, y = 0.03 + i * 0.012 + Math.sin(i * 0.9) * 0.005; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - 0.012, y + 0.065); ctx.lineTo(x - 0.03, y + 0.01); ctx.fill(); }
  eye(ctx, 0.2, -0.1, 0.045, sil, '#ffe9a0');
}

function bodyLion(ctx, sp, c, t, sil) {
  const h = sp.h;
  // fan fins behind
  for (let i = 0; i < 9; i++) {
    const a = -1.9 - i * 0.2 + Math.sin(t * 2 + i) * 0.03;
    ctx.beginPath(); ctx.moveTo(0.1, -h * 0.4); ctx.lineTo(0.1 + Math.cos(a) * 0.42, -h * 0.4 + Math.sin(a) * 0.46); ctx.lineWidth = 0.014; ctx.strokeStyle = sil ? SIL : INK; ctx.stroke();
    if (i) { const a0 = a + 0.2; ctx.beginPath(); ctx.moveTo(0.1, -h * 0.4); ctx.lineTo(0.1 + Math.cos(a0) * 0.42, -h * 0.4 + Math.sin(a0) * 0.46); ctx.lineTo(0.1 + Math.cos(a) * 0.42, -h * 0.4 + Math.sin(a) * 0.46); ctx.closePath(); ctx.fillStyle = sil ? SIL : rgba(i % 2 ? c[0] : c[1], 0.65); ctx.fill(); }
  }
  for (let i = 0; i < 7; i++) {
    const a = 1.2 + i * 0.22 + Math.sin(t * 2.4 + i) * 0.03, a0 = a + 0.22;
    ctx.beginPath(); ctx.moveTo(0.18, h * 0.12); ctx.lineTo(0.18 + Math.cos(a0 + 1.9) * 0.4, h * 0.12 + Math.sin(a0 + 1.9) * 0.36); ctx.lineTo(0.18 + Math.cos(a + 1.9) * 0.4, h * 0.12 + Math.sin(a + 1.9) * 0.36); ctx.closePath(); ctx.fillStyle = sil ? SIL : rgba(i % 2 ? c[0] : c[1], 0.6); ctx.fill(); ctx.lineWidth = 0.012; ctx.strokeStyle = sil ? SIL : INK; ctx.stroke();
  }
  bodyFish(ctx, { ...sp, body: 'fish', feature: null }, c, t, sil, false);
}

function bodyDragon(ctx, sp, c, t, sil) {
  const n = 30, pts = [], ws = [], th = sp.h * 0.55;
  for (let i = 0; i < n; i++) { const u = i / (n - 1); pts.push([0.45 - u * 0.95, Math.sin(u * 8 - t * 2.6) * 0.07 * (0.2 + u)]); ws.push(th * (u < 0.08 ? 0.8 : 1) * (1 - Math.pow(u, 2.2) * 0.9) * (u < 0.15 ? 1.15 : 1)); }
  // mane / dorsal spikes
  ctx.fillStyle = sil ? SIL : c[1];
  for (let i = 3; i < n - 3; i += 2) { const p = pts[i]; ctx.beginPath(); ctx.moveTo(p[0] + 0.02, p[1] - ws[i]); ctx.lineTo(p[0] - 0.005, p[1] - ws[i] - 0.06 * (1 - i / n * 0.6)); ctx.lineTo(p[0] - 0.03, p[1] - ws[i]); ctx.closePath(); ctx.fill(); ctx.lineWidth = 0.01; ctx.strokeStyle = sil ? SIL : INK; ctx.stroke(); }
  ctx.save(); ctx.translate(pts[n - 1][0], pts[n - 1][1]); ctx.rotate(Math.sin(t * 4) * 0.2); ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(-0.06, -0.08, -0.14, -0.06); ctx.quadraticCurveTo(-0.08, 0, -0.14, 0.06); ctx.quadraticCurveTo(-0.06, 0.08, 0, 0); P(ctx, c[1], sil); ctx.restore();
  const bp = () => ribbon(ctx, pts, ws);
  bp();
  const fill = sil ? SIL : (() => { const g = ctx.createLinearGradient(0, -th, 0, th); g.addColorStop(0, c[0]); g.addColorStop(1, shade(c[0], 0.25)); return g; })();
  ctx.fillStyle = fill; ctx.fill(); ctx.save(); ctx.clip();
  if (!sil) { ctx.fillStyle = rgba(c[1], 0.55); pts.forEach((p, i) => { if (i % 2) { ctx.beginPath(); ctx.arc(p[0], p[1] + ws[i] * 0.55, ws[i] * 0.4, 0, Math.PI); ctx.fill(); } }); if (sp.pattern === 'glowspots') pts.forEach((p, i) => { if (i % 3 === 0) { glow(ctx, p[0], p[1] + ws[i] * 0.2, 0.045, c[1], 0.5 + 0.4 * Math.sin(t * 2 + i)); } }); }
  ctx.restore(); bp(); ctx.lineWidth = LW; ctx.strokeStyle = sil ? SIL : INK; ctx.stroke();
  const hx = pts[0][0], hy = pts[0][1];
  // head snout, whiskers, horns
  ctx.beginPath(); ctx.moveTo(hx - 0.02, hy - th * 0.8); ctx.quadraticCurveTo(hx + 0.1, hy - th * 0.6, hx + 0.12, hy); ctx.quadraticCurveTo(hx + 0.08, hy + th * 0.7, hx - 0.02, hy + th * 0.8); P(ctx, c[0], sil);
  ctx.strokeStyle = sil ? SIL : c[1]; ctx.lineWidth = 0.014;
  for (const s of [-1, 1]) { ctx.beginPath(); ctx.moveTo(hx + 0.1, hy + s * 0.01); ctx.bezierCurveTo(hx + 0.18, hy + s * 0.08, hx + 0.2 + Math.sin(t * 3) * 0.03, hy + s * 0.02, hx + 0.26, hy + s * 0.1 + Math.sin(t * 3 + s) * 0.03); ctx.stroke(); }
  ctx.beginPath(); ctx.moveTo(hx - 0.02, hy - th); ctx.lineTo(hx - 0.07, hy - th - 0.07); ctx.lineTo(hx + 0.02, hy - th * 0.8); ctx.closePath(); P(ctx, c[1], sil, LW * 0.8);
  eye(ctx, hx + 0.03, hy - th * 0.25, Math.max(0.016, th * 0.28), sil, '#ffe08a');
}

const BODIES = {
  fish: (ctx, sp, c, t, sil) => bodyFish(ctx, sp, c, t, sil, false),
  torp: (ctx, sp, c, t, sil) => bodyFish(ctx, sp, c, t, sil, true),
  leviathan: (ctx, sp, c, t, sil) => bodyFish(ctx, sp, c, t, sil, true),
  round: bodyRound, eel: bodyEel, slim: bodySlim, flat: bodyFlat, ray: bodyRay, shark: bodyShark, jelly: bodyJelly, squid: bodySquid,
  octopus: bodyOctopus, crab: bodyCrab, star: bodyStar, seahorse: bodySeahorse, puffer: bodyPuffer, angler: bodyAngler, lion: bodyLion, dragon: bodyDragon,
};

/** Draw a species. size = body length in px. o: {x, y, size, dir, t, sil, variant, tilt, alpha} */
export function drawFish(ctx, sp, o) {
  const { x = 0, y = 0, size = 60, dir = 1, t = 0, sil = false, variant = false, tilt = 0, alpha = 1 } = o;
  ctx.save(); ctx.translate(x, y); if (tilt) ctx.rotate(tilt); ctx.scale(dir * size, size); ctx.globalAlpha *= alpha;
  const pal = variant ? sp.colors.map(rotateColor) : sp.colors;
  (BODIES[sp.body] || BODIES.fish)(ctx, sp, pal, t, sil);
  ctx.restore();
}

/** Pixel size of a species based on its length in cm. */
export function fishPixels(lengthCm, scale = 1) { return clamp(26 + Math.pow(lengthCm, 0.62) * 9, 30, 230) * scale; }

// ---------- Loot ----------
export function drawLoot(ctx, id, x, y, s, t = 0) {
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s); ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  const L = 0.03;
  const pp = (fill) => P(ctx, fill, false, L);
  switch (id) {
    case 'old_boot': ctx.beginPath(); ctx.moveTo(-0.18, -0.35); ctx.lineTo(0.06, -0.35); ctx.lineTo(0.08, 0.05); ctx.quadraticCurveTo(0.38, 0.08, 0.38, 0.28); ctx.lineTo(-0.2, 0.28); ctx.closePath(); pp('#8a5a38'); ctx.fillStyle = '#5a3a24'; ctx.fillRect(-0.2, 0.2, 0.58, 0.08); ctx.strokeStyle = '#d8c8a0'; ctx.lineWidth = 0.02; for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.moveTo(-0.15, -0.25 + i * 0.1); ctx.lineTo(0.03, -0.22 + i * 0.1); ctx.stroke(); } ctx.fillStyle = '#6a9a4a'; ctx.beginPath(); ctx.arc(0.2, 0.18, 0.03, 0, TAU); ctx.fill(); break;
    case 'tin_can': ctx.beginPath(); ctx.roundRect(-0.2, -0.25, 0.4, 0.5, 0.04); pp('#aab4bc'); ctx.fillStyle = '#c8603a'; ctx.fillRect(-0.2, -0.1, 0.4, 0.2); ctx.strokeStyle = INK; ctx.lineWidth = L * 0.7; ctx.strokeRect(-0.2, -0.1, 0.4, 0.2); ell(ctx, 0, -0.25, 0.2, 0.05); pp('#d4dade'); break;
    case 'glass_bottle': case 'message_bottle': ctx.beginPath(); ctx.moveTo(-0.08, -0.4); ctx.lineTo(0.08, -0.4); ctx.lineTo(0.08, -0.2); ctx.quadraticCurveTo(0.24, -0.12, 0.22, 0.1); ctx.lineTo(0.22, 0.3); ctx.lineTo(-0.22, 0.3); ctx.lineTo(-0.22, 0.1); ctx.quadraticCurveTo(-0.24, -0.12, -0.08, -0.2); ctx.closePath(); pp(id === 'glass_bottle' ? 'rgba(130,200,150,.85)' : 'rgba(170,215,230,.85)'); ctx.fillStyle = '#c08a5a'; ctx.fillRect(-0.08, -0.46, 0.16, 0.08); if (id === 'message_bottle') { ctx.save(); ctx.rotate(-0.2); ctx.fillStyle = '#f6ead0'; ctx.fillRect(-0.1, -0.02, 0.2, 0.26); ctx.strokeStyle = '#b8a070'; ctx.lineWidth = 0.012; for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.moveTo(-0.07, 0.04 + i * 0.05); ctx.lineTo(0.07, 0.04 + i * 0.05); ctx.stroke(); } ctx.restore(); } ctx.fillStyle = 'rgba(255,255,255,.6)'; ctx.fillRect(-0.17, 0.0, 0.03, 0.22); break;
    case 'torn_net': ctx.strokeStyle = '#a89870'; ctx.lineWidth = 0.025; for (let i = -3; i <= 3; i++) { ctx.beginPath(); ctx.moveTo(i * 0.1, -0.3); ctx.quadraticCurveTo(i * 0.1 + 0.08, 0, i * 0.1 - 0.03, 0.3); ctx.stroke(); } for (let j = -2; j <= 2; j++) { ctx.beginPath(); ctx.moveTo(-0.34, j * 0.12); ctx.quadraticCurveTo(0, j * 0.12 + 0.06, 0.34, j * 0.12 - 0.04); ctx.stroke(); } ctx.fillStyle = '#c85a3a'; ctx.beginPath(); ctx.arc(-0.3, -0.28, 0.04, 0, TAU); ctx.fill(); break;
    case 'driftwood': ctx.beginPath(); ctx.moveTo(-0.38, 0.08); ctx.quadraticCurveTo(-0.1, -0.2, 0.36, -0.06); ctx.lineTo(0.38, 0.06); ctx.quadraticCurveTo(0, 0.0, -0.36, 0.2); ctx.closePath(); pp('#cdb592'); ctx.beginPath(); ctx.moveTo(0.05, -0.1); ctx.lineTo(0.14, -0.28); ctx.lineTo(0.18, -0.1); ctx.closePath(); pp('#cdb592'); ctx.strokeStyle = '#a08a68'; ctx.lineWidth = 0.014; ctx.beginPath(); ctx.moveTo(-0.2, 0.0); ctx.lineTo(0.2, -0.02); ctx.stroke(); break;
    case 'rusty_anchor': ctx.strokeStyle = INK; ctx.lineWidth = 0.1; ctx.beginPath(); ctx.moveTo(0, -0.3); ctx.lineTo(0, 0.25); ctx.moveTo(-0.14, -0.16); ctx.lineTo(0.14, -0.16); ctx.moveTo(-0.3, 0.1); ctx.quadraticCurveTo(0, 0.4, 0.3, 0.1); ctx.stroke(); ctx.strokeStyle = '#b8683a'; ctx.lineWidth = 0.06; ctx.stroke(); ctx.beginPath(); ctx.arc(0, -0.36, 0.06, 0, TAU); ctx.lineWidth = 0.03; ctx.strokeStyle = INK; ctx.stroke(); break;
    case 'seaweed': for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.moveTo(-0.15 + i * 0.1, 0.3); ctx.bezierCurveTo(-0.3 + i * 0.1, 0.1, 0.1 + i * 0.1, -0.1, -0.1 + i * 0.1, -0.32); ctx.lineWidth = 0.08; ctx.strokeStyle = INK; ctx.stroke(); ctx.lineWidth = 0.05; ctx.strokeStyle = ['#4f8a4a', '#6aa85a', '#3f7a4a', '#7ab860'][i]; ctx.stroke(); } break;
    case 'coin_pouch': ctx.beginPath(); ctx.moveTo(-0.1, -0.22); ctx.quadraticCurveTo(-0.34, 0.0, -0.28, 0.2); ctx.quadraticCurveTo(0, 0.34, 0.28, 0.2); ctx.quadraticCurveTo(0.34, 0, 0.1, -0.22); ctx.closePath(); pp('#b88a52'); ctx.strokeStyle = INK; ctx.lineWidth = 0.04; ctx.beginPath(); ctx.moveTo(-0.14, -0.2); ctx.quadraticCurveTo(0, -0.14, 0.14, -0.2); ctx.stroke(); ctx.fillStyle = '#e8c15a'; ctx.beginPath(); ctx.arc(0, 0.06, 0.07, 0, TAU); ctx.fill(); ctx.stroke(); for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.arc(-0.1 + i * 0.1, -0.28 - (i % 2) * 0.03, 0.05, 0, TAU); pp('#f2cf6a'); } break;
    case 'pearl': glow(ctx, 0, 0, 0.45, '#ffffff', 0.5); ctx.beginPath(); ctx.arc(0, 0, 0.22, 0, TAU); { const g = ctx.createRadialGradient(-0.07, -0.08, 0.02, 0, 0, 0.24); g.addColorStop(0, '#fff'); g.addColorStop(0.6, '#f3e8f8'); g.addColorStop(1, '#c8b8e0'); pp(g); } sparkle(ctx, 0.2, -0.2, 0.08, '#fff', t); break;
    case 'rare_shell': ctx.beginPath(); ctx.moveTo(0, 0.28); ctx.bezierCurveTo(-0.4, 0.15, -0.36, -0.28, 0, -0.3); ctx.bezierCurveTo(0.36, -0.28, 0.4, 0.15, 0, 0.28); pp('#f4b8c0'); ctx.strokeStyle = '#c87a88'; ctx.lineWidth = 0.02; for (let i = -3; i <= 3; i++) { ctx.beginPath(); ctx.moveTo(0, 0.26); ctx.quadraticCurveTo(i * 0.08, -0.05, i * 0.1, -0.27); ctx.stroke(); } ctx.fillStyle = '#e8a0ac'; ctx.fillRect(-0.12, 0.26, 0.24, 0.05); break;
    case 'old_compass': ctx.beginPath(); ctx.arc(0, 0, 0.3, 0, TAU); pp('#c9a24a'); ctx.beginPath(); ctx.arc(0, 0, 0.23, 0, TAU); pp('#f6ecd0'); ctx.beginPath(); ctx.moveTo(0, -0.2); ctx.lineTo(0.05, 0); ctx.lineTo(0, 0.2); ctx.lineTo(-0.05, 0); ctx.closePath(); P(ctx, '#c8503a', false, 0.015); ctx.save(); ctx.rotate(Math.sin(t) * 0.3); ctx.beginPath(); ctx.moveTo(0, -0.2); ctx.lineTo(0.05, 0); ctx.lineTo(-0.05, 0); ctx.closePath(); ctx.fillStyle = '#c8503a'; ctx.fill(); ctx.restore(); ctx.fillStyle = '#c9a24a'; ctx.fillRect(-0.04, -0.4, 0.08, 0.1); break;
    case 'antique_reel': ctx.beginPath(); ctx.arc(0, 0, 0.28, 0, TAU); pp('#c9a24a'); ctx.beginPath(); ctx.arc(0, 0, 0.16, 0, TAU); pp('#e8d79a'); ctx.beginPath(); ctx.arc(0, 0, 0.05, 0, TAU); pp('#8a6a2a'); ctx.strokeStyle = INK; ctx.lineWidth = 0.04; ctx.beginPath(); ctx.moveTo(0.28, 0); ctx.lineTo(0.4, 0.1); ctx.stroke(); ctx.beginPath(); ctx.arc(0.4, 0.1, 0.05, 0, TAU); pp('#6a4a2a'); break;
    case 'treasure_chest': ctx.beginPath(); ctx.roundRect(-0.34, -0.02, 0.68, 0.32, 0.04); pp('#8a5a32'); ctx.beginPath(); ctx.moveTo(-0.34, -0.02); ctx.quadraticCurveTo(-0.34, -0.3, 0, -0.3); ctx.quadraticCurveTo(0.34, -0.3, 0.34, -0.02); ctx.closePath(); pp('#a06c3a'); ctx.fillStyle = '#e8c15a'; ctx.fillRect(-0.04, -0.06, 0.08, 0.12); ctx.fillRect(-0.34, 0.06, 0.68, 0.04); ctx.strokeStyle = INK; ctx.lineWidth = 0.02; ctx.strokeRect(-0.04, -0.06, 0.08, 0.12); sparkle(ctx, 0.28, -0.3, 0.07, '#fff6c8', t); sparkle(ctx, -0.26, -0.2, 0.05, '#fff6c8', -t); break;
    case 'gold_idol': glow(ctx, 0, 0, 0.5, '#ffd870', 0.45); ctx.beginPath(); ctx.moveTo(0.3, 0); ctx.bezierCurveTo(0.14, -0.2, -0.14, -0.2, -0.26, -0.02); ctx.lineTo(-0.38, -0.18); ctx.lineTo(-0.38, 0.18); ctx.lineTo(-0.26, 0.02); ctx.bezierCurveTo(-0.14, 0.2, 0.14, 0.2, 0.3, 0); ctx.closePath(); pp('#f0c84a'); eye(ctx, 0.14, -0.04, 0.04, false); break;
    case 'sunken_crown': glow(ctx, 0, 0, 0.5, '#ffd870', 0.5); ctx.beginPath(); ctx.moveTo(-0.3, 0.2); ctx.lineTo(-0.34, -0.2); ctx.lineTo(-0.15, -0.04); ctx.lineTo(0, -0.28); ctx.lineTo(0.15, -0.04); ctx.lineTo(0.34, -0.2); ctx.lineTo(0.3, 0.2); ctx.closePath(); pp('#f0c84a'); for (const [gx, gc] of [[-0.15, '#e05a6a'], [0, '#5a9ae0'], [0.15, '#5ae08a']]) { ctx.beginPath(); ctx.arc(gx, 0.08, 0.045, 0, TAU); pp(gc); } sparkle(ctx, 0.3, -0.26, 0.07, '#fff', t); break;
  }
  ctx.restore();
}

// ---------- Gear icons (shop) ----------
export function drawGear(ctx, kind, idx, x, y, s, t = 0, extra = {}) {
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s); ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  const L = 0.03;
  if (kind === 'rod') {
    const col = extra.color || '#a87a4a';
    ctx.strokeStyle = INK; ctx.lineWidth = 0.09; ctx.beginPath(); ctx.moveTo(-0.38, 0.32); ctx.quadraticCurveTo(0.1, 0, 0.38, -0.34); ctx.stroke();
    ctx.strokeStyle = col; ctx.lineWidth = 0.055; ctx.stroke();
    ctx.beginPath(); ctx.arc(-0.2, 0.18, 0.08, 0, TAU); P(ctx, '#c8ccd2', false, L);
    ctx.strokeStyle = '#e8e0c8'; ctx.lineWidth = 0.012; ctx.beginPath(); ctx.moveTo(0.38, -0.34); ctx.lineTo(0.38, 0.1); ctx.stroke();
    if (idx >= 5) glow(ctx, 0.38, -0.34, 0.16, idx === 6 ? '#ffe08a' : '#cfe0ff', 0.7);
    for (let i = 0; i < Math.min(idx, 6); i++) { ctx.fillStyle = '#e8c15a'; ctx.beginPath(); ctx.arc(-0.1 + i * 0.1, 0.1 - i * 0.075 - 0.08, 0.016, 0, TAU); ctx.fill(); }
  } else if (kind === 'line') {
    ctx.beginPath(); ctx.arc(0, 0, 0.3, 0, TAU); P(ctx, extra.color || '#e8dcc0', false, L); ctx.beginPath(); ctx.arc(0, 0, 0.12, 0, TAU); P(ctx, '#8a6a42', false, L);
    ctx.strokeStyle = rgba(INK, 0.4); ctx.lineWidth = 0.014; for (let i = 1; i < 4; i++) { ctx.beginPath(); ctx.arc(0, 0, 0.12 + i * 0.045, 0, TAU); ctx.stroke(); }
    ctx.strokeStyle = extra.color || '#e8dcc0'; ctx.lineWidth = 0.03; ctx.beginPath(); ctx.moveTo(0.28, 0.1); ctx.quadraticCurveTo(0.5, 0.2, 0.42, 0.42); ctx.stroke();
    if (idx >= 5) sparkle(ctx, -0.25, -0.28, 0.08, '#fff6c8', t);
  } else if (kind === 'hook') {
    const sz = 0.7 + idx * 0.07;
    ctx.save(); ctx.scale(sz, sz);
    ctx.beginPath(); ctx.moveTo(-0.1, -0.4); ctx.lineTo(-0.1, 0.1); ctx.bezierCurveTo(-0.1, 0.42, 0.3, 0.42, 0.3, 0.05); ctx.lineWidth = 0.1; ctx.strokeStyle = INK; ctx.stroke(); ctx.lineWidth = 0.06; ctx.strokeStyle = extra.color || '#c0c8d0'; ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0.3, 0.05); ctx.lineTo(0.22, -0.06); ctx.lineTo(0.38, -0.02); ctx.closePath(); P(ctx, extra.color || '#c0c8d0', false, 0.02);
    ctx.beginPath(); ctx.arc(-0.1, -0.42, 0.045, 0, TAU); ctx.lineWidth = 0.025; ctx.strokeStyle = INK; ctx.stroke(); ctx.restore();
  } else if (kind === 'bait') {
    const col = extra.color || '#c98a8a';
    ctx.beginPath(); ctx.roundRect(-0.28, -0.14, 0.56, 0.4, 0.06); P(ctx, '#c8a878', false, L); ctx.beginPath(); ctx.roundRect(-0.3, -0.24, 0.6, 0.12, 0.04); P(ctx, '#a88858', false, L);
    ctx.fillStyle = col; ctx.beginPath(); ctx.ellipse(0, -0.02, 0.15, 0.1, 0, 0, TAU); ctx.fill(); ctx.stroke();
    glow(ctx, 0, -0.3, 0.3, col, 0.4 + Math.sin(t * 2) * 0.1);
    ctx.beginPath(); ctx.ellipse(0, -0.34, 0.12, 0.08, 0, 0, TAU); P(ctx, col, false, L);
  } else if (kind === 'boost') {
    ctx.beginPath(); ctx.moveTo(-0.08, -0.34); ctx.lineTo(0.08, -0.34); ctx.lineTo(0.08, -0.14); ctx.bezierCurveTo(0.34, -0.04, 0.3, 0.3, 0, 0.3); ctx.bezierCurveTo(-0.3, 0.3, -0.34, -0.04, -0.08, -0.14); ctx.closePath();
    P(ctx, extra.color || '#8ad0e8', false, L); ctx.fillStyle = '#c08a5a'; ctx.fillRect(-0.1, -0.42, 0.2, 0.09); sparkle(ctx, 0.0, 0.08, 0.1, '#fff', t);
  }
  ctx.restore();
}
