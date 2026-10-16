/* ============================================================
   RENDERER (Canvas 2D)
   Triangles are bucketed by (tier, hp-level) so each bucket is
   drawn as ONE path with ONE fill + stroke. Balls use a cached
   glow sprite instead of per-ball shadowBlur.
   ============================================================ */
(function () {
  'use strict';
  const TB = (window.TB = window.TB || {});
  const C = TB.CONFIG;
  const TAU = Math.PI * 2;
  const FONT = '"Segoe UI", system-ui, -apple-system, Roboto, sans-serif';

  // cached colour strings (avoids per-particle string allocation every frame)
  const sparkCache = {}, ringCache = {};
  const sparkColor = (h) => sparkCache[h] || (sparkCache[h] = 'hsl(' + h + ',100%,72%)');
  const ringColor = (h) => ringCache[h] || (ringCache[h] = 'hsl(' + h + ',100%,70%)');

  const Renderer = {
    canvas: null, ctx: null, w: 0, h: 0, dpr: 1,
    scale: 1, offX: 0, offY: 0,
    shakeMag: 0, shakeX: 0, shakeY: 0, shakeOn: true,
    reduced: false,
    bg: null, stars: [],
    glow: null,
    buckets: null, counts: new Int32Array(16),
    fills: [], strokes: [],
    time: 0,

    init(canvas) {
      this.canvas = canvas;
      this.ctx = canvas.getContext('2d', { alpha: false });
      // colour tables: index = tier*4 + hpLevel(0 low .. 3 full)
      for (let t = 0; t < C.tiers.length; t++) {
        const hue = C.tiers[t].hue;
        for (let q = 0; q < 4; q++) {
          this.fills[t * 4 + q] = 'hsla(' + hue + ',85%,' + (7 + q * 3.2) + '%,0.94)';
          this.strokes[t * 4 + q] = 'hsla(' + hue + ',100%,' + (40 + q * 7) + '%,' + (0.42 + q * 0.18) + ')';
        }
      }
      // glow sprite for balls
      const g = document.createElement('canvas');
      g.width = g.height = 64;
      const gc = g.getContext('2d');
      const grad = gc.createRadialGradient(32, 32, 0, 32, 32, 32);
      grad.addColorStop(0, 'rgba(255,255,255,0.95)');
      grad.addColorStop(0.25, 'rgba(120,230,255,0.45)');
      grad.addColorStop(1, 'rgba(60,160,255,0)');
      gc.fillStyle = grad; gc.fillRect(0, 0, 64, 64);
      this.glow = g;
      // deterministic faint star dust
      const rng = TB.util.mulberry32(99);
      for (let i = 0; i < 70; i++) this.stars.push([rng(), rng(), 0.4 + rng() * 1.1, 0.15 + rng() * 0.3]);
    },

    resize(w, h) {
      this.dpr = Math.min(window.devicePixelRatio || 1, 2);
      this.w = Math.max(1, Math.floor(w)); this.h = Math.max(1, Math.floor(h));
      this.canvas.width = Math.floor(this.w * this.dpr);
      this.canvas.height = Math.floor(this.h * this.dpr);
      this.canvas.style.width = this.w + 'px';
      this.canvas.style.height = this.h + 'px';
      const c = this.ctx;
      const bg = c.createRadialGradient(this.w / 2, this.h / 2, 0, this.w / 2, this.h / 2, Math.hypot(this.w, this.h) / 2);
      bg.addColorStop(0, '#0b1438'); bg.addColorStop(0.6, '#060b22'); bg.addColorStop(1, '#02040d');
      this.bg = bg;
      // offscreen cache for the static world layer
      this.layer = document.createElement('canvas');
      this.layer.width = this.canvas.width; this.layer.height = this.canvas.height;
      this.layerCtx = this.layer.getContext('2d', { alpha: false });
      this.layerDirty = true;
    },

    shake(mag) {
      if (this.shakeOn && !this.reduced) this.shakeMag = Math.min(C.fx.maxShake, this.shakeMag + mag * C.fx.maxShake);
    },

    // screen px -> world coords (used for the coin target)
    screenToWorld(sx, sy) { return { x: (sx - this.offX) / this.scale, y: (sy - this.offY) / this.scale }; },

    draw(g, alpha, dt) {
      const ctx = this.ctx, world = g.world;
      if (!world) return;
      this.time += dt;

      // camera: fit the whole hexagon with a margin
      const pad = 1.08;
      this.scale = Math.min(this.w / (2 * world.radius * pad), this.h / (2 * world.inradius * pad));
      if (this.shakeMag > 0.05) {
        this.shakeX = (Math.random() - 0.5) * this.shakeMag; this.shakeY = (Math.random() - 0.5) * this.shakeMag;
        this.shakeMag *= Math.pow(0.002, dt);
      } else { this.shakeMag = 0; this.shakeX = this.shakeY = 0; }
      this.offX = this.w / 2 + this.shakeX; this.offY = this.h / 2 + this.shakeY;
      const sc = this.scale;

      // Static layer (background + hex + all triangles) is cached offscreen and only
      // re-rendered when a triangle changes colour bucket / is destroyed, or on resize.
      const lm = g.mode === 'play' ? 0 : 1;
      if (this.layerDirty || g.worldDirty || this.layerWorld !== world || this.layerMode !== lm) {
        this._renderLayer(g, world, sc);
        this.layerDirty = false; g.worldDirty = false; this.layerWorld = world; this.layerMode = lm;
      }
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.globalAlpha = 1;
      if (this.shakeX || this.shakeY) { ctx.fillStyle = '#02040d'; ctx.fillRect(0, 0, this.canvas.width, this.canvas.height); }
      ctx.drawImage(this.layer, Math.round(this.shakeX * this.dpr), Math.round(this.shakeY * this.dpr));

      // world space
      ctx.setTransform(this.dpr * sc, 0, 0, this.dpr * sc, this.dpr * this.offX, this.dpr * this.offY);
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';

      this._flashes(ctx, g, sc);
      this._balls(ctx, g, alpha, sc);
      this._fx(ctx, sc);
      if (g.mode !== 'play') this._escapeGlow(ctx, world, g, sc);
    },

    _renderLayer(g, world, sc) {
      const lc = this.layerCtx;
      lc.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
      lc.globalAlpha = 1;
      lc.fillStyle = this.bg;
      lc.fillRect(0, 0, this.w, this.h);
      lc.fillStyle = '#9fc4ff';
      for (let i = 0; i < this.stars.length; i++) {
        const s = this.stars[i];
        lc.globalAlpha = s[3];
        lc.fillRect(s[0] * this.w, s[1] * this.h, s[2], s[2]);
      }
      lc.globalAlpha = 1;
      lc.setTransform(this.dpr * sc, 0, 0, this.dpr * sc, this.dpr * this.w / 2, this.dpr * this.h / 2);
      lc.lineJoin = 'round'; lc.lineCap = 'round';
      this._hexFloor(lc, world, sc, g);
      this._triangles(lc, world, sc);
    },

    _hexPath(ctx, world, k) {
      const hx = world.hex;
      ctx.beginPath();
      ctx.moveTo(hx[0].x * k, hx[0].y * k);
      for (let i = 1; i < 6; i++) ctx.lineTo(hx[i].x * k, hx[i].y * k);
      ctx.closePath();
    },

    _hexFloor(ctx, world, sc, g) {
      // dark interior shows through destroyed areas
      this._hexPath(ctx, world, 1);
      ctx.fillStyle = 'rgba(2,5,16,0.92)';
      ctx.fill();
      // outer rim
      const escaped = g.mode !== 'play';
      ctx.lineWidth = 2.2 / sc;
      ctx.strokeStyle = escaped ? 'rgba(255,201,74,0.85)' : 'rgba(90,200,255,0.5)';
      if (!this.reduced) { ctx.shadowColor = escaped ? '#ffc94a' : '#2ad4ff'; ctx.shadowBlur = 14; }
      this._hexPath(ctx, world, 1);
      ctx.stroke();
      ctx.shadowBlur = 0;
    },

    _triangles(ctx, world, sc) {
      const tris = world.tris, n = tris.length;
      if (!this.buckets || this.buckets[0].length < n) {
        this.buckets = [];
        for (let i = 0; i < 16; i++) this.buckets.push(new Int32Array(n));
      }
      const counts = this.counts; counts.fill(0);
      for (let i = 0; i < n; i++) {
        const t = tris[i];
        if (!t.active) continue;
        const f = t.hp / t.maxHp;
        const q = f > 0.75 ? 3 : f > 0.5 ? 2 : f > 0.25 ? 1 : 0;
        const b = t.tier * 4 + q;
        this.buckets[b][counts[b]++] = i;
      }
      ctx.lineWidth = 1.1 / sc;
      for (let b = 0; b < 16; b++) {
        const cnt = counts[b];
        if (!cnt) continue;
        const list = this.buckets[b];
        ctx.beginPath();
        for (let k = 0; k < cnt; k++) {
          const d = tris[list[k]].d;
          ctx.moveTo(d[0], d[1]); ctx.lineTo(d[2], d[3]); ctx.lineTo(d[4], d[5]); ctx.closePath();
        }
        ctx.fillStyle = this.fills[b]; ctx.fill();
        ctx.strokeStyle = this.strokes[b]; ctx.stroke();
      }
    },

    _flashes(ctx, g, sc) {
      const list = g.flashList;
      if (!list.length || this.reduced) return;
      ctx.fillStyle = '#fff';
      for (let i = 0; i < list.length; i++) {
        const t = list[i];
        if (!t.active) continue;
        const d = t.d;
        ctx.globalAlpha = t.flash * 0.55;
        ctx.beginPath();
        ctx.moveTo(d[0], d[1]); ctx.lineTo(d[2], d[3]); ctx.lineTo(d[4], d[5]); ctx.closePath();
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    },

    _balls(ctx, g, alpha, sc) {
      const balls = g.balls, minR = 2.3 / sc;
      const L = C.physics.trailLength, trailLen = this.reduced ? 4 : L;
      for (let bi = 0; bi < balls.length; bi++) {
        const b = balls[bi];
        const x = b.px + (b.x - b.px) * alpha, y = b.py + (b.y - b.py) * alpha;
        const r = Math.max(b.r, minR);

        // trail (newest -> oldest)
        const cnt = Math.min(b.trailCount, trailLen);
        if (cnt > 1) {
          let prevX = x, prevY = y;
          for (let k = 0; k < cnt; k++) {
            const idx = (b.trailHead - k + L) % L;
            const tx = b.trail[idx * 2], ty = b.trail[idx * 2 + 1];
            const f = 1 - k / cnt;
            ctx.globalAlpha = f * 0.45;
            ctx.strokeStyle = '#7fe7ff';
            ctx.lineWidth = r * 1.5 * f;
            ctx.beginPath(); ctx.moveTo(prevX, prevY); ctx.lineTo(tx, ty); ctx.stroke();
            prevX = tx; prevY = ty;
          }
          ctx.globalAlpha = 1;
        }
        const gs = r * 7;
        ctx.globalAlpha = 0.9;
        ctx.drawImage(this.glow, x - gs / 2, y - gs / 2, gs, gs);
        ctx.globalAlpha = 1;
        ctx.fillStyle = '#ffffff';
        ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
      }
    },

    _fx(ctx, sc) {
      const Fx = TB.Fx, pool = Fx.pool, K = Fx.KIND;
      // keep coin target in world space
      const tg = Fx.target;
      let lastFont = 0;
      for (let i = 0; i < pool.length; i++) {
        const p = pool[i];
        if (!p.on) continue;
        const f = p.life / p.max;
        switch (p.kind) {
          case K.SPARK:
            ctx.globalAlpha = Math.min(1, f * 1.4);
            ctx.fillStyle = sparkColor(p.hue);
            ctx.fillRect(p.x - p.size * 0.5, p.y - p.size * 0.5, p.size, p.size);
            break;
          case K.RING: {
            const e = 1 - f, rad = p.r * (0.15 + 0.85 * (1 - (1 - e) * (1 - e)));
            ctx.globalAlpha = f * 0.8;
            ctx.strokeStyle = ringColor(p.hue);
            ctx.lineWidth = (2.2 + f * 2) / sc;
            ctx.beginPath(); ctx.arc(p.x, p.y, rad, 0, TAU); ctx.stroke();
            break;
          }
          case K.COIN:
            ctx.globalAlpha = 1;
            ctx.fillStyle = '#ffc94a';
            ctx.beginPath(); ctx.arc(p.x, p.y, Math.max(1.8, 2.6 / sc), 0, TAU); ctx.fill();
            break;
          case K.TEXT:
            if (lastFont !== p.size) { ctx.font = '700 ' + (p.size / sc) + 'px ' + FONT; ctx.textAlign = 'center'; lastFont = p.size; }
            ctx.globalAlpha = Math.min(1, f * 2);
            ctx.fillStyle = p.color;
            ctx.fillText(p.text, p.x, p.y);
            break;
          default: break;
        }
      }
      ctx.globalAlpha = 1;
    },

    // pulsing gold rim while the world is escaped
    _escapeGlow(ctx, world, g, sc) {
      const pulse = 0.5 + 0.5 * Math.sin(this.time * 3);
      ctx.globalAlpha = 0.25 + pulse * 0.35;
      ctx.lineWidth = 4 / sc;
      ctx.strokeStyle = '#ffd86b';
      this._hexPath(ctx, world, 1.015 + pulse * 0.012);
      ctx.stroke();
      ctx.globalAlpha = 1;
      // the escaping ball keeps drifting outward (cosmetic only)
      if (g.escapeBall && g.mode === 'escaping') {
        const b = g.escapeBall;
        ctx.fillStyle = '#fff';
        ctx.beginPath(); ctx.arc(b.x, b.y, Math.max(b.r, 2.3 / sc), 0, TAU); ctx.fill();
      }
    }
  };

  TB.Renderer = Renderer;
})();
