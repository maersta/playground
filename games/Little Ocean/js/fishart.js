/* Little Ocean - procedural fish illustration.
   draw(ctx, species, size, opts) paints one fish facing +x at opts.x/opts.y rotated by opts.ang.
   opts: x y ang flip phase sw t eat alpha flat col seed alert face */
window.LO = window.LO || {};
LO.FishArt = (function () {
  const U = LO.U, TAU = Math.PI * 2;
  const N = 16, M = 2 * N + 2;
  const PX = new Float32Array(M), PY = new Float32Array(M);

  // half-height multiplier along the body (u: 0 = tail, 1 = nose)
  function prof(u, sh) {
    const pk = sh.peak, p = sh.p;
    if (u < pk) {
      const q = (pk - u) / pk;
      return sh.base + (1 - sh.base) * Math.pow(Math.max(0, 1 - Math.pow(q, p)), 1 / p);
    }
    const q = (u - pk) / (1 - pk);
    return Math.pow(Math.max(0, 1 - Math.pow(q, p)), 1 / p);
  }
  function off(u, ph, amp) { return Math.sin(ph - u * 2.8) * amp * Math.pow(1 - u, 1.5); }

  function bodyPath(ctx) {
    ctx.beginPath();
    ctx.moveTo((PX[M - 1] + PX[0]) / 2, (PY[M - 1] + PY[0]) / 2);
    for (let i = 0; i < M; i++) {
      const j = (i + 1) % M;
      ctx.quadraticCurveTo(PX[i], PY[i], (PX[i] + PX[j]) / 2, (PY[i] + PY[j]) / 2);
    }
    ctx.closePath();
  }

  function tailShape(ctx, type, Lt, Ht, ph) {
    ctx.beginPath();
    switch (type) {
      case 'lunate':
        ctx.moveTo(0, -Ht * 0.1); ctx.quadraticCurveTo(-Lt * 0.5, -Ht * 0.5, -Lt, -Ht * 1.3);
        ctx.quadraticCurveTo(-Lt * 0.5, -Ht * 0.12, -Lt * 0.45, 0); ctx.quadraticCurveTo(-Lt * 0.5, Ht * 0.12, -Lt, Ht * 1.3);
        ctx.quadraticCurveTo(-Lt * 0.5, Ht * 0.5, 0, Ht * 0.1); break;
      case 'round':
        ctx.moveTo(0, -Ht * 0.08); ctx.bezierCurveTo(-Lt * 0.35, -Ht, -Lt, -Ht * 0.75, -Lt, 0);
        ctx.bezierCurveTo(-Lt, Ht * 0.75, -Lt * 0.35, Ht, 0, Ht * 0.08); break;
      case 'fan': case 'long':
        ctx.moveTo(0, -Ht * 0.08); ctx.bezierCurveTo(-Lt * 0.4, -Ht * 1.05, -Lt * 0.9, -Ht * 1.05, -Lt, -Ht * 0.62);
        ctx.quadraticCurveTo(-Lt * 1.1, -Ht * 0.4, -Lt * 0.96, -Ht * 0.2); ctx.quadraticCurveTo(-Lt * 1.1, 0, -Lt * 0.96, Ht * 0.2);
        ctx.quadraticCurveTo(-Lt * 1.1, Ht * 0.4, -Lt, Ht * 0.62); ctx.bezierCurveTo(-Lt * 0.9, Ht * 1.05, -Lt * 0.4, Ht * 1.05, 0, Ht * 0.08); break;
      case 'point':
        ctx.moveTo(0, -Ht * 0.14); ctx.quadraticCurveTo(-Lt * 0.6, -Ht * 0.12, -Lt * 1.3, 0); ctx.quadraticCurveTo(-Lt * 0.6, Ht * 0.12, 0, Ht * 0.14); break;
      default: // fork
        ctx.moveTo(0, -Ht * 0.1); ctx.quadraticCurveTo(-Lt * 0.6, -Ht * 0.5, -Lt, -Ht);
        ctx.quadraticCurveTo(-Lt * 0.62, -Ht * 0.05, -Lt * 0.72, 0); ctx.quadraticCurveTo(-Lt * 0.62, Ht * 0.05, -Lt, Ht);
        ctx.quadraticCurveTo(-Lt * 0.6, Ht * 0.5, 0, Ht * 0.1);
    }
    ctx.closePath();
  }

  function pattern(ctx, sp, L, H, ph, amp, acc, line, seed) {
    const sh = sp.shape;
    switch (sp.pattern) {
      case 'stripes': case 'band': {
        const n = sp.patN, band = sp.pattern === 'band';
        const w = L * (band ? 0.08 : 0.035);
        for (let k = 0; k < n; k++) {
          const u = 0.25 + 0.5 * (k + 0.5) / n, x = (u - 0.5) * L, c = off(u, ph, amp);
          if (band) {
            ctx.fillStyle = acc;
            ctx.fillRect(x - w / 2, -H * 2 + c, w, H * 4);
            ctx.strokeStyle = line; ctx.globalAlpha *= 0.55; ctx.lineWidth = Math.max(0.8, H * 0.05);
            ctx.beginPath(); ctx.moveTo(x - w / 2, -H * 2 + c); ctx.lineTo(x - w / 2, H * 2 + c); ctx.moveTo(x + w / 2, -H * 2 + c); ctx.lineTo(x + w / 2, H * 2 + c); ctx.stroke();
            ctx.globalAlpha /= 0.55;
          } else {
            ctx.fillStyle = acc; ctx.globalAlpha *= 0.55;
            ctx.beginPath(); ctx.moveTo(x - w / 2, -H * 2 + c); ctx.lineTo(x + w / 2 + w * 0.6, -H * 2 + c); ctx.lineTo(x + w / 2, H * 2 + c); ctx.lineTo(x - w / 2 - w * 0.6, H * 2 + c); ctx.fill();
            ctx.globalAlpha /= 0.55;
          }
        }
        break;
      }
      case 'lateral':
        ctx.strokeStyle = acc; ctx.globalAlpha *= 0.7; ctx.lineWidth = H * 0.3; ctx.lineCap = 'round';
        ctx.beginPath();
        for (let i = 0; i <= 6; i++) { const u = 0.08 + i * 0.13, x = (u - 0.5) * L, y = off(u, ph, amp) - H * 0.02; if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y); }
        ctx.stroke(); ctx.globalAlpha /= 0.7; break;
      case 'spots': case 'blotch': case 'speckles': {
        const n = sp.pattern === 'speckles' ? 16 : sp.pattern === 'blotch' ? 6 : 7;
        ctx.fillStyle = sp.pattern === 'spots' ? acc : line;
        ctx.globalAlpha *= sp.pattern === 'blotch' ? 0.32 : sp.pattern === 'speckles' ? 0.45 : 0.7;
        for (let k = 0; k < n; k++) {
          const u = 0.2 + 0.65 * U.hash(k * 3.1 + seed), y = (U.hash(k * 5.7 + seed) - 0.5) * H * 1.5 + off(u, ph, amp);
          const r = H * (sp.pattern === 'speckles' ? 0.07 : sp.pattern === 'blotch' ? 0.28 + 0.14 * U.hash(k) : 0.13 + 0.09 * U.hash(k));
          ctx.beginPath(); ctx.arc((u - 0.5) * L, y, r, 0, TAU); ctx.fill();
        }
        ctx.globalAlpha /= sp.pattern === 'blotch' ? 0.32 : sp.pattern === 'speckles' ? 0.45 : 0.7;
        break;
      }
      case 'scales':
        ctx.strokeStyle = line; ctx.globalAlpha *= 0.22; ctx.lineWidth = Math.max(0.7, H * 0.05);
        ctx.beginPath();
        for (let row = -1; row <= 1; row++) for (let col = 0; col < 8; col++) {
          const u = 0.2 + col * 0.095 + (row & 1 ? 0.045 : 0), x = (u - 0.5) * L;
          ctx.moveTo(x + H * 0.2, row * H * 0.5 + off(u, ph, amp) - H * 0.25);
          ctx.arc(x, row * H * 0.5 + off(u, ph, amp), H * 0.28, -1.0, 1.0);
        }
        ctx.stroke(); ctx.globalAlpha /= 0.22; break;
      case 'photo':
        ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = sp.glow || acc;
        for (let k = 0; k < 8; k++) {
          const u = 0.22 + k * 0.075;
          ctx.globalAlpha *= 0.85;
          ctx.beginPath(); ctx.arc((u - 0.5) * L, off(u, ph, amp) + prof(u, sh) * H * 0.55, Math.max(0.9, H * 0.09), 0, TAU); ctx.fill();
          ctx.globalAlpha /= 0.85;
        }
        ctx.globalCompositeOperation = 'source-over'; break;
      case 'koi':
        ctx.globalAlpha *= 0.8;
        ctx.fillStyle = acc; ctx.beginPath(); ctx.ellipse(-L * 0.08, -H * 0.2, L * 0.13, H * 0.55, 0.2, 0, TAU); ctx.fill();
        ctx.fillStyle = '#9cc4ff'; ctx.beginPath(); ctx.ellipse(L * 0.12, H * 0.25, L * 0.09, H * 0.4, -0.3, 0, TAU); ctx.fill();
        ctx.fillStyle = acc; ctx.beginPath(); ctx.ellipse(-L * 0.3, H * 0.15, L * 0.07, H * 0.35, 0, 0, TAU); ctx.fill();
        ctx.globalAlpha /= 0.8; break;
    }
  }

  function draw(ctx, sp, size, o) {
    if (sp.special === 'seahorse') return seahorse(ctx, sp, size, o);
    if (sp.special === 'ray') return ray(ctx, sp, size, o);
    const sh = sp.shape, flat = o.flat, col = o.col || sp.color;
    const L = size * 3.2 * sh.len, H = L * sh.hgt * 0.5;
    const ph = o.phase || 0, sw = o.sw === undefined ? 0.7 : o.sw, seed = o.seed || 0, t = o.t || 0;
    const body = flat || col.body, belly = flat || col.belly, finC = flat || col.fin, acc = flat || col.accent;
    const line = flat || col.outline || U.shade(col.body, -0.5);
    const lw = Math.max(1, size * 0.07), amp = sw * L * 0.07 * sp.wave;

    ctx.save();
    ctx.translate(o.x, o.y); ctx.rotate(o.ang || 0);
    if (o.flip !== undefined && o.flip !== 1) ctx.scale(1, o.flip);
    if (o.eat > 0) ctx.scale(1 + 0.1 * o.eat, 1 - 0.07 * o.eat);
    let ga = o.alpha === undefined ? 1 : o.alpha;
    if (sp.alpha) ga *= sp.alpha;
    ctx.globalAlpha = ga;
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';

    // body outline points
    for (let i = 0; i <= N; i++) {
      const u = i / N, x = (u - 0.5) * L, hh = prof(u, sh) * H, c = off(u, ph, amp);
      const jit = flat ? 0 : Math.sin(i * 2.7 + seed) * H * 0.025;
      PX[i] = x; PY[i] = c - hh + jit; PX[M - 1 - i] = x; PY[M - 1 - i] = c + hh - jit;
    }
    const yTop = (u) => off(u, ph, amp) - prof(u, sh) * H;
    const yBot = (u) => off(u, ph, amp) + prof(u, sh) * H;

    // ---- glow halo (behind) ----
    if (!flat && sp.glow) {
      ctx.globalCompositeOperation = 'lighter';
      const R = L * (sp.halo ? 1.1 : 0.7), g = ctx.createRadialGradient(0, 0, 0, 0, 0, R);
      const pulse = 0.8 + 0.2 * Math.sin(t * 2.4 + seed);
      g.addColorStop(0, U.alpha(sp.glow, (sp.halo ? 0.34 : 0.26) * pulse)); g.addColorStop(1, U.alpha(sp.glow, 0));
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, R, 0, TAU); ctx.fill();
      ctx.globalCompositeOperation = 'source-over';
    }

    // ---- tail ----
    ctx.save();
    ctx.translate(-L * 0.5 + L * 0.03, off(0, ph, amp)); ctx.rotate(Math.sin(ph - 0.9) * 0.45 * sw);
    const Lt = L * 0.26 * sp.tailLen * (sp.tail === 'long' ? 1.35 : 1), Ht = H * (sp.tail === 'point' ? 0.5 : 1.2) * (sp.tail === 'lunate' ? 1 : 1);
    tailShape(ctx, sp.tail, Lt, Ht, ph);
    ctx.fillStyle = finC; ctx.globalAlpha = ga * 0.92; ctx.fill();
    ctx.globalAlpha = ga; ctx.strokeStyle = line; ctx.lineWidth = lw * 0.8; ctx.stroke();
    if (!flat && sp.tail !== 'point') {
      ctx.globalAlpha = ga * 0.25; ctx.beginPath();
      for (let k = -1; k <= 1; k++) { ctx.moveTo(0, 0); ctx.lineTo(-Lt * 0.9, k * Ht * 0.6); }
      ctx.stroke(); ctx.globalAlpha = ga;
    }
    if (sp.tail === 'long') {
      ctx.strokeStyle = finC; ctx.lineWidth = Math.max(1, lw * 0.9); ctx.globalAlpha = ga * 0.75;
      for (let k = -1; k <= 1; k++) {
        ctx.beginPath(); ctx.moveTo(-Lt * 0.6, k * Ht * 0.4);
        ctx.quadraticCurveTo(-Lt * 1.1, k * Ht * 0.9 + Math.sin(ph + k) * Ht * 0.4, -Lt * 1.6, k * Ht * 0.7 + Math.sin(ph * 1.2 + k) * Ht * 0.6); ctx.stroke();
      }
      ctx.globalAlpha = ga;
    }
    ctx.restore();

    // ---- dorsal fin ----
    const fl = Math.sin(ph * 1.3) * H * 0.12;
    ctx.fillStyle = finC; ctx.strokeStyle = line; ctx.lineWidth = lw * 0.8;
    if (sp.dorsal !== 'none') {
      ctx.beginPath();
      if (sp.dorsal === 'sail' || sp.dorsal === 'soft') {
        const u0 = sp.dorsal === 'sail' ? 0.28 : 0.3, u1 = sp.dorsal === 'sail' ? 0.74 : 0.7;
        const x0 = (u0 - 0.5) * L, x1 = (u1 - 0.5) * L, y0 = yTop(u0) + H * 0.1, y1 = yTop(u1) + H * 0.1;
        const hd = H * (sp.dorsal === 'sail' ? 0.95 : 0.5) * sp.dorsalH;
        if (sp.dorsal === 'sail') {
          ctx.moveTo(x0, y0); ctx.quadraticCurveTo(x0 + (x1 - x0) * 0.05, y0 - hd * 0.9, x0 + (x1 - x0) * 0.2 - fl, Math.min(y0, y1) - hd);
          ctx.quadraticCurveTo(x1 - (x1 - x0) * 0.15, y1 - hd * 0.4, x1, y1);
        } else { ctx.moveTo(x0, y0); ctx.bezierCurveTo(x0, y0 - hd * 1.3 - fl, x1, y1 - hd * 1.3 - fl, x1, y1); }
        ctx.closePath();
      } else if (sp.dorsal === 'long') {
        const u0 = 0.14, u1 = 0.82, hd = H * 0.38 * sp.dorsalH;
        for (let i = 0; i <= 8; i++) { const u = u0 + (u1 - u0) * i / 8; const x = (u - 0.5) * L, y = yTop(u) + H * 0.12 - hd * Math.sin(Math.PI * i / 8) * (1 + 0.15 * Math.sin(ph * 2 + i)); if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y); }
        for (let i = 8; i >= 0; i--) { const u = u0 + (u1 - u0) * i / 8; ctx.lineTo((u - 0.5) * L, yTop(u) + H * 0.2); }
        ctx.closePath();
      } else { // spike
        const hd = H * 0.55 * sp.dorsalH;
        for (let k = 0; k < 4; k++) {
          const ua = 0.3 + k * 0.1, ub = ua + 0.1, xa = (ua - 0.5) * L, xb = (ub - 0.5) * L;
          ctx.moveTo(xa, yTop(ua) + H * 0.15); ctx.lineTo(xa + (xb - xa) * 0.2 - fl * 0.4, yTop(ua + 0.05) - hd); ctx.lineTo(xb, yTop(ub) + H * 0.15);
        }
      }
      ctx.globalAlpha = ga * 0.9; ctx.fill(); ctx.globalAlpha = ga; ctx.stroke();
    }
    // pelvic / anal fin
    {
      const ua = 0.38, ub = 0.55, xa = (ua - 0.5) * L, xb = (ub - 0.5) * L, ya = yBot(ua) - H * 0.1, yb = yBot(ub) - H * 0.1;
      ctx.beginPath(); ctx.moveTo(xb, yb); ctx.quadraticCurveTo((xa + xb) / 2, yb + H * 0.5 + fl, xa - L * 0.04, ya + H * 0.55); ctx.lineTo(xa, ya); ctx.closePath();
      ctx.globalAlpha = ga * 0.85; ctx.fill(); ctx.globalAlpha = ga; ctx.stroke();
    }

    // ---- extras behind body ----
    if (sp.leaf && !flat) {
      ctx.fillStyle = finC;
      for (let k = 0; k < 5; k++) {
        const u = 0.28 + k * 0.1, s = k & 1 ? 1 : -1, y = s < 0 ? yTop(u) : yBot(u);
        ctx.save(); ctx.translate((u - 0.5) * L, y); ctx.rotate(s * (0.9 + 0.2 * Math.sin(ph + k)) - Math.PI / 2 * 0);
        ctx.beginPath(); ctx.ellipse(0, s * H * 0.35, H * 0.2, H * 0.55, 0, 0, TAU); ctx.fill(); ctx.stroke(); ctx.restore();
      }
    }

    // ---- body ----
    bodyPath(ctx);
    if (flat) ctx.fillStyle = flat;
    else {
      const g = ctx.createLinearGradient(0, -H, 0, H);
      g.addColorStop(0, body); g.addColorStop(0.55, body); g.addColorStop(1, belly);
      ctx.fillStyle = g;
    }
    ctx.fill();
    if (!flat) {
      ctx.save(); bodyPath(ctx); ctx.clip();
      if (sp.pattern !== 'none') pattern(ctx, sp, L, H, ph, amp, acc, line, seed);
      ctx.strokeStyle = 'rgba(255,255,255,0.3)'; ctx.lineWidth = H * 0.22;
      ctx.beginPath(); ctx.moveTo(-L * 0.2, yTop(0.3) + H * 0.28); ctx.quadraticCurveTo(L * 0.05, yTop(0.55) + H * 0.2, L * 0.3, yTop(0.8) + H * 0.3); ctx.stroke();
      ctx.restore();
    }
    bodyPath(ctx); ctx.strokeStyle = line; ctx.lineWidth = lw; ctx.stroke();

    if (!flat) {
      // gill line
      const xg = (0.7 - 0.5) * L, cg = off(0.7, ph, amp);
      ctx.globalAlpha = ga * 0.4; ctx.lineWidth = lw * 0.8;
      ctx.beginPath(); ctx.moveTo(xg, cg - H * 0.5); ctx.quadraticCurveTo(xg - H * 0.35, cg, xg, cg + H * 0.5); ctx.stroke(); ctx.globalAlpha = ga;
    }

    // pectoral fin
    {
      const pl = L * 0.17 * sp.pect, px = (0.64 - 0.5) * L, py = off(0.64, ph, amp) + H * 0.15;
      ctx.save(); ctx.translate(px, py); ctx.rotate(-0.45 + Math.sin(ph * 1.4) * 0.38 * (0.4 + sw));
      ctx.beginPath(); ctx.ellipse(-pl * 0.5, 0, pl * 0.5, pl * 0.24, 0, 0, TAU);
      ctx.fillStyle = finC; ctx.globalAlpha = ga * 0.85; ctx.fill(); ctx.globalAlpha = ga; ctx.lineWidth = lw * 0.7; ctx.stroke(); ctx.restore();
    }

    // ---- lure / pearl ----
    if (sp.lure && !flat) {
      const bx = L * 0.5 + Math.sin(ph * 0.7) * H * 0.25, by = -H * 2.1, sx = L * 0.2, sy = yTop(0.7);
      ctx.strokeStyle = line; ctx.lineWidth = lw * 0.8; ctx.beginPath(); ctx.moveTo(sx, sy); ctx.quadraticCurveTo(L * 0.34, by - H * 0.7, bx, by); ctx.stroke();
      ctx.globalCompositeOperation = 'lighter';
      const g = ctx.createRadialGradient(bx, by, 0, bx, by, H * 1.6);
      g.addColorStop(0, 'rgba(255,230,130,0.85)'); g.addColorStop(1, 'rgba(255,230,130,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(bx, by, H * 1.6, 0, TAU); ctx.fill();
      ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = '#fff3b8'; ctx.beginPath(); ctx.arc(bx, by, Math.max(2, H * 0.24), 0, TAU); ctx.fill();
    }
    if (sp.pearl && !flat) {
      const bx = L * 0.28, by = yTop(0.75) - H * 0.55, pu = 0.85 + 0.15 * Math.sin(t * 3);
      ctx.globalCompositeOperation = 'lighter';
      const g = ctx.createRadialGradient(bx, by, 0, bx, by, H * 1.2 * pu);
      g.addColorStop(0, 'rgba(255,245,200,0.8)'); g.addColorStop(1, 'rgba(255,245,200,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(bx, by, H * 1.2, 0, TAU); ctx.fill();
      ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = '#fffdf2'; ctx.strokeStyle = '#d8c690'; ctx.lineWidth = lw * 0.6;
      ctx.beginPath(); ctx.arc(bx, by, H * 0.26, 0, TAU); ctx.fill(); ctx.stroke();
    }

    // ---- eye ----
    if (!flat) {
      const ue = 0.8, ex = (ue - 0.5) * L, ey = off(ue, ph, amp) - H * 0.15;
      const er = Math.max(1.3, Math.min(L * 0.09, H * 0.34 * sp.eye));
      if (sp.eye < 0.5) { ctx.fillStyle = line; ctx.beginPath(); ctx.arc(ex, ey, er * 0.9, 0, TAU); ctx.fill(); }
      else {
        ctx.fillStyle = '#fffef6'; ctx.beginPath(); ctx.arc(ex, ey, er, 0, TAU); ctx.fill();
        ctx.lineWidth = lw * 0.6; ctx.strokeStyle = line; ctx.stroke();
        ctx.fillStyle = o.alert ? '#c4263d' : '#1b2430'; ctx.beginPath(); ctx.arc(ex + er * 0.14, ey, er * 0.6, 0, TAU); ctx.fill();
        ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(ex + er * 0.02, ey - er * 0.26, er * 0.2, 0, TAU); ctx.fill();
      }
      // mouth
      const mx = L * 0.5, my = off(1, ph, amp) + H * 0.12;
      if (o.eat > 0) {
        ctx.fillStyle = 'rgba(40,10,20,0.85)'; ctx.beginPath(); ctx.ellipse(mx - L * 0.02, my, H * 0.3 * o.eat + 1, H * 0.22 * o.eat + 1, 0, 0, TAU); ctx.fill();
      } else {
        ctx.globalAlpha = ga * 0.7; ctx.lineWidth = lw * 0.7; ctx.strokeStyle = line;
        ctx.beginPath(); ctx.moveTo(mx - L * 0.02, my - H * 0.05); ctx.quadraticCurveTo(mx - L * 0.07, my + H * 0.14, mx - L * 0.13, my + H * 0.02); ctx.stroke(); ctx.globalAlpha = ga;
      }
      if (sp.teeth) {
        ctx.fillStyle = '#fffdf0';
        for (let k = 0; k < 4; k++) {
          const tx = mx - L * (0.03 + k * 0.03);
          ctx.beginPath(); ctx.moveTo(tx, my + H * 0.02); ctx.lineTo(tx - L * 0.012, my + H * 0.02); ctx.lineTo(tx - L * 0.006, my + H * 0.2); ctx.fill();
        }
      }
    }
    ctx.restore();
  }

  // ---------- seahorse (custom upright silhouette) ----------
  function seahorse(ctx, sp, size, o) {
    const S = size * 1.15, col = o.col || sp.color, flat = o.flat, t = o.t || 0, ph = o.phase || 0;
    const body = flat || col.body, belly = flat || col.belly, fin = flat || col.fin, acc = flat || col.accent;
    const line = flat || U.shade(col.body, -0.5);
    const lw = Math.max(1, S * 0.07);
    ctx.save();
    ctx.translate(o.x, o.y + Math.sin(t * 1.6 + ph) * S * 0.08);
    ctx.scale(o.face < 0 ? -1 : 1, 1); ctx.rotate(Math.sin(t * 1.1) * 0.05);
    ctx.globalAlpha = o.alpha === undefined ? 1 : o.alpha;
    const pts = [];
    const P0 = [0, -1.5 * S], P1 = [0.95 * S, -0.7 * S], P2 = [0.9 * S, 0.7 * S], P3 = [0.15 * S, 1.35 * S];
    for (let i = 0; i <= 14; i++) {
      const s = i / 14, a = 1 - s;
      const x = a * a * a * P0[0] + 3 * a * a * s * P1[0] + 3 * a * s * s * P2[0] + s * s * s * P3[0];
      const y = a * a * a * P0[1] + 3 * a * a * s * P1[1] + 3 * a * s * s * P2[1] + s * s * s * P3[1];
      pts.push([x, y, S * (0.3 + 0.3 * Math.sin(Math.PI * Math.min(1, s * 1.15 + 0.05)) - 0.18 * s)]);
    }
    const C = [0.55 * S, 1.65 * S], a0 = Math.atan2(P3[1] - C[1], P3[0] - C[0]), r0 = Math.hypot(P3[0] - C[0], P3[1] - C[1]);
    for (let i = 1; i <= 10; i++) { const s = i / 10, ang = a0 - s * 4.6, rr = r0 * (1 - 0.7 * s); pts.push([C[0] + Math.cos(ang) * rr, C[1] + Math.sin(ang) * rr, S * 0.17 * (1 - s * 0.7) + S * 0.03]); }
    if (!flat && sp.glow) {
      ctx.globalCompositeOperation = 'lighter';
      const g = ctx.createRadialGradient(0, 0, 0, 0, 0, S * 2.6);
      g.addColorStop(0, U.alpha(sp.glow, 0.35 + 0.1 * Math.sin(t * 2.4))); g.addColorStop(1, U.alpha(sp.glow, 0));
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, S * 2.6, 0, TAU); ctx.fill(); ctx.globalCompositeOperation = 'source-over';
    }
    // dorsal fin (behind)
    const d = pts[8];
    ctx.save(); ctx.translate(d[0] - d[2] * 0.8, d[1]); ctx.rotate(Math.sin(t * 12) * 0.2 - 0.3);
    ctx.fillStyle = fin; ctx.globalAlpha *= 0.8; ctx.beginPath(); ctx.ellipse(-S * 0.25, 0, S * 0.3, S * 0.13, 0, 0, TAU); ctx.fill(); ctx.restore();
    ctx.fillStyle = line; for (let i = 0; i < pts.length; i++) { ctx.beginPath(); ctx.arc(pts[i][0], pts[i][1], pts[i][2] + lw, 0, TAU); ctx.fill(); }
    ctx.fillStyle = body; for (let i = 0; i < pts.length; i++) { ctx.beginPath(); ctx.arc(pts[i][0], pts[i][1], pts[i][2], 0, TAU); ctx.fill(); }
    if (!flat) {
      ctx.fillStyle = belly; ctx.globalAlpha *= 0.85;
      for (let i = 1; i <= 13; i++) { ctx.beginPath(); ctx.ellipse(pts[i][0] + pts[i][2] * 0.35, pts[i][1], pts[i][2] * 0.5, pts[i][2] * 0.4, 0, 0, TAU); ctx.fill(); }
      ctx.fillStyle = acc; ctx.globalAlpha = (o.alpha === undefined ? 1 : o.alpha) * 0.8;
      for (let i = 2; i <= 12; i += 2) { ctx.beginPath(); ctx.arc(pts[i][0] - pts[i][2] * 0.65, pts[i][1], S * 0.05, 0, TAU); ctx.fill(); }
    }
    ctx.globalAlpha = o.alpha === undefined ? 1 : o.alpha;
    const h = pts[0];
    ctx.fillStyle = line; ctx.beginPath(); ctx.ellipse(h[0] + 0.5 * S, h[1] + 0.02 * S, 0.5 * S + lw, 0.13 * S + lw, 0.15, 0, TAU); ctx.fill();
    ctx.fillStyle = body; ctx.beginPath(); ctx.ellipse(h[0] + 0.5 * S, h[1] + 0.02 * S, 0.5 * S, 0.13 * S, 0.15, 0, TAU); ctx.fill();
    ctx.fillStyle = acc;
    for (let k = -1; k <= 1; k++) {
      ctx.beginPath(); ctx.moveTo(h[0] + k * 0.15 * S - 0.07 * S, h[1] - 0.25 * S); ctx.lineTo(h[0] + k * 0.2 * S, h[1] - (0.62 - Math.abs(k) * 0.14) * S); ctx.lineTo(h[0] + k * 0.15 * S + 0.07 * S, h[1] - 0.25 * S); ctx.fill();
    }
    if (!flat) {
      ctx.fillStyle = '#fffef6'; ctx.beginPath(); ctx.arc(h[0] + 0.12 * S, h[1] - 0.05 * S, 0.12 * S, 0, TAU); ctx.fill();
      ctx.fillStyle = '#1b2430'; ctx.beginPath(); ctx.arc(h[0] + 0.15 * S, h[1] - 0.05 * S, 0.07 * S, 0, TAU); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(h[0] + 0.13 * S, h[1] - 0.08 * S, 0.025 * S, 0, TAU); ctx.fill();
    }
    ctx.restore();
  }

  // ---------- ray (wings + ribbon tail) ----------
  function ray(ctx, sp, size, o) {
    const L = size * 3.2 * sp.shape.len, W = L * 0.7, ph = o.phase || 0, t = o.t || 0, flat = o.flat, col = o.col || sp.color;
    ctx.save();
    ctx.translate(o.x, o.y); ctx.rotate(o.ang || 0);
    if (o.flip !== undefined && o.flip !== 1) ctx.scale(1, o.flip);
    ctx.globalAlpha = o.alpha === undefined ? 1 : o.alpha;
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    const flap = Math.sin(ph * 0.9) * W * 0.22, lw = Math.max(1.2, size * 0.06);
    if (!flat && sp.glow) {
      ctx.globalCompositeOperation = 'lighter';
      const g = ctx.createRadialGradient(0, 0, 0, 0, 0, L * 1.1);
      g.addColorStop(0, U.alpha(sp.glow, 0.28)); g.addColorStop(1, U.alpha(sp.glow, 0));
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, L * 1.1, 0, TAU); ctx.fill(); ctx.globalCompositeOperation = 'source-over';
    }
    // tail ribbon
    ctx.strokeStyle = flat || col.fin; ctx.lineWidth = Math.max(1.5, size * 0.12);
    ctx.beginPath(); ctx.moveTo(-L * 0.4, 0);
    for (let i = 1; i <= 10; i++) { const u = i / 10; ctx.lineTo(-L * 0.4 - u * L * 0.8, Math.sin(ph - u * 4) * L * 0.07 * u); }
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(L * 0.5, 0);
    ctx.bezierCurveTo(L * 0.3, -W * 0.12, L * 0.1, -W * 0.45 - flap, -L * 0.12, -W * 0.5 - flap * 1.3);
    ctx.bezierCurveTo(-L * 0.2, -W * 0.3 - flap * 0.5, -L * 0.3, -W * 0.12, -L * 0.42, 0);
    ctx.bezierCurveTo(-L * 0.3, W * 0.12, -L * 0.2, W * 0.3 + flap * 0.5, -L * 0.12, W * 0.5 + flap * 1.3);
    ctx.bezierCurveTo(L * 0.1, W * 0.45 + flap, L * 0.3, W * 0.12, L * 0.5, 0);
    ctx.closePath();
    if (flat) ctx.fillStyle = flat;
    else {
      const g = ctx.createLinearGradient(-L * 0.5, 0, L * 0.5, 0), sh = (Math.sin(t * 0.8) + 1) * 0.15;
      g.addColorStop(0, col.fin); g.addColorStop(0.35 + sh, col.body); g.addColorStop(0.75, col.accent); g.addColorStop(1, col.belly);
      ctx.fillStyle = g;
    }
    ctx.fill(); ctx.strokeStyle = flat || U.shade(col.fin, -0.45); ctx.lineWidth = lw; ctx.stroke();
    if (!flat) {
      ctx.globalAlpha *= 0.28; ctx.lineWidth = lw * 0.7;
      ctx.beginPath(); ctx.moveTo(L * 0.4, 0); ctx.quadraticCurveTo(0, -W * 0.25 - flap * 0.4, -L * 0.3, -W * 0.08); ctx.moveTo(L * 0.4, 0); ctx.quadraticCurveTo(0, W * 0.25 + flap * 0.4, -L * 0.3, W * 0.08); ctx.stroke();
      ctx.globalAlpha /= 0.28;
      ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = '#e8fffb';
      for (let k = 0; k < 7; k++) {
        const u = k / 6, s = k & 1 ? 1 : -1;
        ctx.globalAlpha = 0.5 + 0.4 * Math.sin(t * 3 + k);
        ctx.beginPath(); ctx.arc(L * 0.25 - u * L * 0.5, s * W * 0.12 * (0.5 + u) * (1 + flap / W), Math.max(1, size * 0.08), 0, TAU); ctx.fill();
      }
      ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = '#1b2430';
      ctx.beginPath(); ctx.arc(L * 0.36, -W * 0.06, Math.max(1.2, size * 0.1), 0, TAU); ctx.arc(L * 0.36, W * 0.06, Math.max(1.2, size * 0.1), 0, TAU); ctx.fill();
    }
    ctx.restore();
  }

  // static portrait for the journal / icons
  function portrait(canvas, sp, flat) {
    const c = canvas.getContext('2d'), w = canvas.width, h = canvas.height;
    c.clearRect(0, 0, w, h);
    const len = sp.special === 'seahorse' ? 3.2 : sp.shape.len * (sp.special === 'ray' ? 1.7 : 1);
    const target = sp.special === 'seahorse' ? h * 0.62 : Math.min(w * 0.72, h * 1.5);
    const size = sp.special === 'seahorse' ? target / 3.6 : target / (3.2 * len * (sp.tail === 'long' ? 1.15 : 1));
    draw(c, sp, size, { x: w / 2 + (sp.special === 'seahorse' ? 0 : 0), y: h / 2 + (sp.special === 'seahorse' ? 0 : 0), ang: 0, flip: 1, phase: 1.0, sw: 0.5, t: 1, flat: flat || null, seed: 3, face: 1 });
  }

  return { draw, portrait };
})();
