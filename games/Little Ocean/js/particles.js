/* Little Ocean - pooled particle system (bubbles, sparkles, rings, streaks). No per-frame allocation. */
window.LO = window.LO || {};
LO.Particles = (function () {
  const U = LO.U, TAU = Math.PI * 2;
  const MAX = LO.CFG.fx.maxParticles;
  const P = [];
  for (let i = 0; i < MAX; i++) P.push({ a: false, type: 0, x: 0, y: 0, vx: 0, vy: 0, life: 0, max: 1, size: 1, col: '#fff', ph: 0 });
  let idx = 0, rich = true;
  const BUB = 0, SPK = 1, RING = 2, STREAK = 3;

  function spawn(type, x, y, vx, vy, life, size, col) {
    // when effects are reduced, skip most decorative particles
    if (!rich && type !== RING && Math.random() < 0.55) return null;
    let p = null;
    for (let k = 0; k < 24; k++) { idx = (idx + 1) % MAX; if (!P[idx].a) { p = P[idx]; break; } }
    if (!p) { idx = (idx + 1) % MAX; p = P[idx]; }
    p.a = true; p.type = type; p.x = x; p.y = y; p.vx = vx; p.vy = vy; p.life = life; p.max = life; p.size = size; p.col = col || '#fff'; p.ph = Math.random() * TAU;
    return p;
  }

  function bubble(x, y, size) { spawn(BUB, x, y, U.rand(-8, 8), U.rand(-40, -18), U.rand(1.6, 3.2), size || U.rand(1.5, 4)); }
  function spark(x, y, col, size, life) { spawn(SPK, x, y, U.rand(-14, 14), U.rand(-22, 6), life || U.rand(0.8, 1.6), size || U.rand(1.2, 2.6), col); }
  function ring(x, y, r, col) { spawn(RING, x, y, 0, 0, 0.5, r, col); }
  function streak(x, y, ang, len) { const p = spawn(STREAK, x, y, 0, 0, 0.25, len, '#ffffff'); if (p) p.ph = ang; }
  function eatFx(x, y, size, col) {
    ring(x, y, size * 0.9, col || '#ffffff');
    const n = Math.min(9, 3 + (size / 6) | 0);
    for (let i = 0; i < n; i++) { const a = Math.random() * TAU, s = U.rand(25, 70); spawn(BUB, x, y, Math.cos(a) * s, Math.sin(a) * s - 20, U.rand(0.7, 1.4), U.rand(1.5, 3.5)); }
    for (let i = 0; i < 3; i++) spark(x, y, col || '#ffe9a8', 2, 0.6);
  }

  // floating text such as "+0.4 size"
  const floaters = [];
  function text(x, y, str, col) { if (floaters.length < 20) floaters.push({ x, y, str, col: col || '#fff4b8', life: 1.3, max: 1.3 }); }
  function drawText(ctx, v) {
    for (let i = floaters.length - 1; i >= 0; i--) {
      const f = floaters[i], k = f.life / f.max;
      if (f.life <= 0) { floaters.splice(i, 1); continue; }
      const s = 1 / v.zoom, rise = (1 - k) * 46 * s;
      ctx.save(); ctx.translate(f.x, f.y - 14 * s - rise); ctx.scale(s, s);
      ctx.globalAlpha = Math.min(1, k * 2.2);
      ctx.font = 'bold ' + (16 + (1 - k) * 2) + 'px "Trebuchet MS",sans-serif'; ctx.textAlign = 'center';
      ctx.lineWidth = 4; ctx.lineJoin = 'round'; ctx.strokeStyle = 'rgba(8,40,58,0.85)'; ctx.strokeText(f.str, 0, 0);
      ctx.fillStyle = f.col; ctx.fillText(f.str, 0, 0);
      ctx.restore();
    }
  }
  function setRich(v) { rich = !!v; }
  function clear() { for (let i = 0; i < MAX; i++) P[i].a = false; floaters.length = 0; }

  function update(dt) {
    for (let i = 0; i < floaters.length; i++) floaters[i].life -= dt;
    for (let i = 0; i < MAX; i++) {
      const p = P[i];
      if (!p.a) continue;
      p.life -= dt;
      if (p.life <= 0) { p.a = false; continue; }
      if (p.type === BUB) {
        p.vy += (-34 - p.vy) * Math.min(1, 1.2 * dt);
        p.vx += (Math.sin(p.ph + p.life * 5) * 12 - p.vx) * Math.min(1, 2 * dt);
        p.x += p.vx * dt; p.y += p.vy * dt;
        if (p.y < 20) p.a = false;
      } else if (p.type === SPK) {
        p.vx *= 1 - 0.8 * dt; p.vy *= 1 - 0.8 * dt;
        p.x += p.vx * dt; p.y += p.vy * dt;
      }
    }
  }

  function draw(ctx, v) {
    for (let i = 0; i < MAX; i++) {
      const p = P[i];
      if (!p.a || p.x < v.l - 30 || p.x > v.r + 30 || p.y < v.t - 30 || p.y > v.b + 30) continue;
      const k = p.life / p.max;
      if (p.type === BUB) {
        ctx.globalAlpha = Math.min(1, k * 2) * 0.75;
        ctx.strokeStyle = 'rgba(235,255,255,0.9)'; ctx.lineWidth = Math.max(0.7, p.size * 0.22);
        ctx.fillStyle = 'rgba(200,245,255,0.14)';
        ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, TAU); ctx.fill(); ctx.stroke();
        ctx.fillStyle = 'rgba(255,255,255,0.9)';
        ctx.beginPath(); ctx.arc(p.x - p.size * 0.35, p.y - p.size * 0.35, Math.max(0.5, p.size * 0.22), 0, TAU); ctx.fill();
      } else if (p.type === SPK) {
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = Math.sin(k * Math.PI) * 0.9;
        ctx.fillStyle = p.col;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.size * (0.6 + k * 0.6), 0, TAU); ctx.fill();
        ctx.globalAlpha *= 0.4;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.size * 2.6, 0, TAU); ctx.fill();
        ctx.globalCompositeOperation = 'source-over';
      } else if (p.type === RING) {
        ctx.globalAlpha = k * 0.8;
        ctx.strokeStyle = p.col; ctx.lineWidth = 2 * k + 0.5;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.size * (1.6 - k), 0, TAU); ctx.stroke();
      } else {
        ctx.globalAlpha = k * 0.5;
        ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.6; ctx.lineCap = 'round';
        const dx = Math.cos(p.ph), dy = Math.sin(p.ph);
        ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x - dx * p.size * (2 - k), p.y - dy * p.size * (2 - k)); ctx.stroke();
      }
    }
    ctx.globalAlpha = 1;
    drawText(ctx, v);
  }

  return { bubble, spark, ring, streak, eatFx, text, update, draw, setRich, clear };
})();
