/* =========================================================
   sprites.js - procedural pixel-art sprite builder.
   Every sprite is built pixel-by-pixel into a PixelSprite, auto-outlined
   and baked into an offscreen canvas once at startup.
   ========================================================= */
'use strict';

class PixelSprite {
  constructor(w, h) {
    this.w = w; this.h = h;
    this.px = new Array(w * h).fill(null);
  }
  set(x, y, c) {
    x = Math.floor(x); y = Math.floor(y);
    if (x >= 0 && y >= 0 && x < this.w && y < this.h) this.px[y * this.w + x] = c;
  }
  get(x, y) {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return null;
    return this.px[y * this.w + x];
  }
  rect(x, y, w, h, c) {
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.set(x + i, y + j, c);
  }
  ellipse(cx, cy, rx, ry, c) {
    for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
      for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
        const dx = (x + 0.5 - cx) / rx, dy = (y + 0.5 - cy) / ry;
        if (dx * dx + dy * dy <= 1) this.set(x, y, c);
      }
    }
  }
  /** Recolor already-filled pixels inside an ellipse (for shading). */
  shadeEllipse(cx, cy, rx, ry, c) {
    for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
      for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
        const dx = (x + 0.5 - cx) / rx, dy = (y + 0.5 - cy) / ry;
        if (dx * dx + dy * dy <= 1 && this.get(x, y)) this.set(x, y, c);
      }
    }
  }
  line(x0, y0, x1, y1, c, thick = 1) {
    const steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)) * 2 + 1;
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const x = lerp(x0, x1, t), y = lerp(y0, y1, t);
      if (thick === 1) this.set(x, y, c);
      else this.rect(Math.round(x - thick / 2), Math.round(y - thick / 2), thick, thick, c);
    }
  }
  /** Draw the dark outline around all filled pixels (4-neighbourhood). */
  outline(c = PAL.ink) {
    const add = [];
    for (let y = 0; y < this.h; y++) {
      for (let x = 0; x < this.w; x++) {
        if (this.get(x, y)) continue;
        if (this.get(x - 1, y) || this.get(x + 1, y) || this.get(x, y - 1) || this.get(x, y + 1)) add.push(x, y);
      }
    }
    for (let i = 0; i < add.length; i += 2) this.set(add[i], add[i + 1], c);
    return this;
  }
  toCanvas(scale = 1) {
    const c = document.createElement('canvas');
    c.width = this.w * scale; c.height = this.h * scale;
    const ctx = c.getContext('2d');
    for (let y = 0; y < this.h; y++) {
      for (let x = 0; x < this.w; x++) {
        const col = this.px[y * this.w + x];
        if (col) { ctx.fillStyle = col; ctx.fillRect(x * scale, y * scale, scale, scale); }
      }
    }
    return c;
  }
}

const Sprites = {
  pug: {},        // pug[expression + '_' + earState]
  coin: [], goldCoin: [], gem: null,
  heart: {}, icons: {},

  build() {
    const exprs = ['idle', 'blink', 'scared', 'happy', 'hurt', 'dizzy', 'look'];
    this.applyLook();
    this.buildCoins();
    this.buildObstacles();
    this.buildHearts();
    this.buildIcons();
  },

  /** Equip the saved skin + hat: builds (and caches) the pug sprite set. */
  applyLook() {
    const d = SaveSystem.data;
    this.pug = this.pugSet(d.skin, d.hat);
  },
  pugSet(skinId, hatId) {
    const key = skinId + '|' + hatId;
    if (!this._looks) this._looks = {};
    if (!this._looks[key]) {
      const set = {};
      for (const e of ['idle', 'blink', 'scared', 'happy', 'hurt', 'dizzy', 'look']) {
        for (const ear of [0, 1]) set[e + '_' + ear] = this.makePug(e, ear, skinId, hatId).toCanvas();
      }
      this._looks[key] = set;
    }
    return this._looks[key];
  },
  slingshotFor(id) {
    if (!this._slings) this._slings = {};
    if (!this._slings[id]) this._slings[id] = this.makeSlingshot(Meta.item('sling', id)).toCanvas();
    return this._slings[id];
  },

  /* ------------------- THE PUG (star of the show) ------------------- */
  makePug(expr, earUp, skinId = 'fawn', hatId = 'none') {
    const s = new PixelSprite(28, 24);
    const sk = Meta.item('skin', skinId).c;
    const F = sk.F, S = sk.S, D = sk.D, M = sk.M, K = PAL.ink, W = PAL.white;
    const ox = 1, oy = 1; // 1px margin for the outline

    // curly tail (behind body)
    s.ellipse(ox + 3.5, oy + 8.5, 2.6, 2.6, F);
    s.set(ox + 3, oy + 8, D); s.set(ox + 4, oy + 8, S); s.set(ox + 3, oy + 9, S);
    // legs
    s.rect(ox + 3, oy + 16, 3, 4, S); s.rect(ox + 7, oy + 17, 3, 3, S);
    s.rect(ox + 13, oy + 17, 3, 3, S); s.rect(ox + 16, oy + 16, 2, 4, S);
    for (const lx of [3, 7, 13, 16]) s.rect(ox + lx, oy + 19, lx === 16 ? 2 : 3, 1, D);
    // chubby body
    s.ellipse(ox + 10, oy + 12.5, 8, 5.5, F);
    s.shadeEllipse(ox + 10, oy + 16.5, 7, 2.2, S);        // belly shade
    s.shadeEllipse(ox + 8, oy + 9.2, 4.5, 1.4, sk.hi); // back highlight
    // head
    s.ellipse(ox + 18, oy + 9.5, 6.6, 6.2, F);
    s.shadeEllipse(ox + 16.5, oy + 5.5, 3, 1.2, sk.hi);
    // collar + tag
    for (let y = 8; y <= 16; y++) { s.set(ox + 11, oy + y, sk.collar); s.set(ox + 12, oy + y, sk.collar); }
    s.set(ox + 12, oy + 16, PAL.gold); s.set(ox + 13, oy + 16, PAL.gold); s.set(ox + 12, oy + 17, PAL.yellow);
    // ears (folded down, or flapping up in the wind)
    if (!earUp) {
      s.rect(ox + 12, oy + 3, 3, 2, M); s.set(ox + 12, oy + 5, M); s.set(ox + 13, oy + 5, M); s.set(ox + 11, oy + 5, M);
      s.rect(ox + 21, oy + 3, 3, 2, M); s.set(ox + 23, oy + 5, M); s.set(ox + 24, oy + 5, M);
    } else {
      s.rect(ox + 12, oy + 1, 2, 3, M); s.set(ox + 11, oy + 0, M); s.set(ox + 10, oy + 0, M); s.set(ox + 14, oy + 3, M);
      s.rect(ox + 22, oy + 1, 2, 3, M); s.set(ox + 24, oy + 0, M); s.set(ox + 25, oy + 0, M); s.set(ox + 21, oy + 3, M);
    }
    // forehead wrinkles
    s.set(ox + 16, oy + 6, D); s.set(ox + 17, oy + 5, D); s.set(ox + 18, oy + 6, D); s.set(ox + 19, oy + 5, D); s.set(ox + 20, oy + 6, D);
    // dark muzzle mask
    s.ellipse(ox + 20.5, oy + 11.8, 3.9, 3, M);
    s.set(ox + 18, oy + 10, D); s.set(ox + 22, oy + 10, D);       // muzzle wrinkles
    // nose
    s.rect(ox + 23, oy + 10, 2, 1, K); s.set(ox + 24, oy + 11, K);
    // cheek blush
    s.set(ox + 15, oy + 12, PAL.pink); s.set(ox + 14, oy + 12, PAL.pink);

    // ---- eyes & mouth per expression ----
    const L = ox + 15, R = ox + 20, EY = oy + 8;
    const eye = (x) => { s.rect(x, EY, 2, 2, K); s.set(x, EY, W); };
    switch (expr) {
      case 'idle':
        eye(L); eye(R);
        s.set(ox + 21, oy + 14, K); s.set(ox + 22, oy + 14, K);
        break;
      case 'look': // looking back at the slingshot band (pupils left)
        s.rect(L, EY, 2, 2, W); s.set(L, EY, K); s.set(L, EY + 1, K);
        s.rect(R, EY, 2, 2, W); s.set(R, EY, K); s.set(R, EY + 1, K);
        s.set(ox + 21, oy + 14, K);
        break;
      case 'blink':
        s.rect(L, EY + 1, 2, 1, K); s.rect(R, EY + 1, 2, 1, K);
        s.set(ox + 21, oy + 14, K); s.set(ox + 22, oy + 14, K);
        break;
      case 'scared':
        s.rect(L - 1, EY - 1, 3, 3, W); s.set(L, EY, K);
        s.rect(R, EY - 1, 3, 3, W); s.set(R + 1, EY, K);
        s.rect(ox + 20, oy + 13, 2, 2, K); s.set(ox + 20, oy + 13, PAL.dkpink);
        break;
      case 'happy':
        s.set(L, EY + 1, K); s.set(L + 1, EY, K); s.set(L + 2, EY + 1, K);
        s.set(R, EY + 1, K); s.set(R + 1, EY, K); s.set(R + 2, EY + 1, K);
        s.rect(ox + 20, oy + 14, 2, 3, PAL.pink); s.set(ox + 21, oy + 16, PAL.dkpink); s.set(ox + 20, oy + 14, PAL.dkpink);
        break;
      case 'hurt':
        s.set(L, EY - 1, K); s.set(L + 1, EY, K); s.set(L, EY + 1, K);
        s.set(R + 1, EY - 1, K); s.set(R, EY, K); s.set(R + 1, EY + 1, K);
        s.set(ox + 19, oy + 14, K); s.set(ox + 20, oy + 13, K); s.set(ox + 21, oy + 14, K); s.set(ox + 22, oy + 13, K);
        break;
      case 'dizzy':
        for (const x of [L - 1, R]) {
          s.set(x, EY - 1, K); s.set(x + 2, EY - 1, K); s.set(x + 1, EY, K); s.set(x, EY + 1, K); s.set(x + 2, EY + 1, K);
        }
        s.rect(ox + 22, oy + 14, 2, 3, PAL.pink); s.set(ox + 22, oy + 16, PAL.dkpink);
        break;
    }
    this.drawHat(s, hatId, ox, oy, L, R, EY);
    return s.outline(K);
  },

  /** Hats are drawn last so they sit on top of the head / eyes / collar. */
  drawHat(s, hat, ox, oy, L, R, EY) {
    switch (hat) {
      case 'party':
        s.rect(ox + 16, oy + 3, 6, 1, PAL.blue); s.rect(ox + 17, oy + 2, 4, 1, PAL.pink);
        s.rect(ox + 18, oy + 1, 2, 1, PAL.blue); s.rect(ox + 18, oy, 2, 1, PAL.yellow);
        s.set(ox + 17, oy + 3, PAL.yellow); s.set(ox + 20, oy + 3, PAL.yellow);
        break;
      case 'crown':
        s.rect(ox + 16, oy + 2, 6, 2, PAL.gold);
        s.set(ox + 16, oy + 1, PAL.gold); s.set(ox + 18, oy + 1, PAL.gold); s.set(ox + 19, oy + 1, PAL.gold); s.set(ox + 21, oy + 1, PAL.gold);
        s.set(ox + 17, oy + 3, PAL.red2); s.set(ox + 20, oy + 3, PAL.sky); s.set(ox + 16, oy + 2, PAL.white);
        break;
      case 'tophat':
        s.rect(ox + 15, oy + 3, 8, 1, PAL.ink2);
        s.rect(ox + 16, oy, 6, 3, PAL.ink2); s.rect(ox + 16, oy + 2, 6, 1, PAL.red);
        s.set(ox + 17, oy, PAL.stone);
        break;
      case 'halo':
        s.rect(ox + 16, oy, 6, 1, PAL.gold); s.set(ox + 15, oy + 1, PAL.gold2); s.set(ox + 22, oy + 1, PAL.gold2);
        s.rect(ox + 16, oy + 2, 6, 1, PAL.gold2);
        break;
      case 'shades':
        s.rect(L - 1, EY, 4, 2, PAL.ink); s.rect(R - 1, EY, 4, 2, PAL.ink); s.set(L + 3, EY, PAL.ink);
        s.set(L, EY, PAL.ltsky); s.set(R, EY, PAL.ltsky);
        break;
      case 'bandana':
        s.rect(ox + 10, oy + 8, 4, 2, PAL.blue); s.rect(ox + 11, oy + 10, 3, 2, PAL.blue); s.set(ox + 12, oy + 12, PAL.blue);
        s.set(ox + 10, oy + 8, PAL.white); s.set(ox + 13, oy + 11, PAL.white);
        break;
      case 'helmet':
        s.ellipse(ox + 18, oy + 4.5, 5, 3.2, PAL.white);
        s.shadeEllipse(ox + 19, oy + 5.5, 4, 1.6, PAL.ltsky);
        s.set(ox + 16, oy + 3, PAL.ltstone); s.set(ox + 18, oy, PAL.red2); s.set(ox + 18, oy + 1, PAL.ltstone);
        break;
    }
  },

  /* ------------------- COINS ------------------- */
  buildCoins() {
    const widths = [7, 5, 3, 1, 3, 5];
    for (const big of [false, true]) {
      const arr = big ? this.goldCoin : this.coin;
      const size = big ? 9 : 7;
      for (const w0 of widths) {
        const w = big ? Math.round(w0 * 9 / 7) | 1 : w0;
        const s = new PixelSprite(size + 2, size + 2);
        const cx = (size + 2) / 2;
        const body = big ? PAL.lava2 : PAL.yellow;
        s.ellipse(cx, cx, w / 2 + 0.01, size / 2, body);
        if (w >= 3) {
          s.shadeEllipse(cx + 0.6, cx + 0.6, w / 2 - 0.5, size / 2 - 0.5, PAL.gold2);
          s.shadeEllipse(cx, cx, w / 2 - 0.6, size / 2 - 0.9, body);
          s.set(Math.floor(cx - w / 2 + 1), Math.floor(cx - size / 2 + 1.5), PAL.white);
          if (w >= 5) { for (let y = -1; y <= 1; y++) s.set(Math.floor(cx), Math.floor(cx + y), big ? PAL.orange : PAL.gold2); }
        }
        if (big && w0 === 7) { s.set(1, 1, PAL.white); }
        arr.push(s.outline(PAL.dkbrown).toCanvas());
      }
    }
    // gem
    const g = new PixelSprite(11, 11);
    for (let y = 0; y < 9; y++) {
      const half = y < 3 ? y + 2 : 8 - y;
      for (let x = -half; x <= half; x++) g.set(5 + x, 1 + y, y < 3 ? PAL.ltsky : (x < 0 ? PAL.sky : PAL.blue));
    }
    g.set(4, 2, PAL.white); g.set(3, 3, PAL.white);
    this.gem = g.outline(PAL.navy).toCanvas();
  },

  /* ------------------- OBSTACLES ------------------- */
  buildObstacles() {
    // Wooden crate
    let s = new PixelSprite(16, 16);
    s.rect(1, 1, 14, 14, PAL.ltbrown);
    s.rect(1, 1, 14, 2, PAL.tan); s.rect(1, 13, 14, 2, PAL.brown);
    s.rect(1, 1, 2, 14, PAL.brown); s.rect(13, 1, 2, 14, PAL.brown);
    s.line(3, 3, 12, 12, PAL.brown, 2); s.line(12, 3, 3, 12, PAL.tan);
    s.set(4, 4, PAL.gold2); s.set(11, 4, PAL.gold2); s.set(4, 11, PAL.gold2); s.set(11, 11, PAL.gold2);
    this.crate = s.outline().toCanvas();

    // Barrel
    s = new PixelSprite(14, 16);
    s.ellipse(7, 8, 6, 7.4, PAL.ltbrown);
    s.shadeEllipse(9, 8, 3, 7, PAL.brown); s.shadeEllipse(5, 8, 1.5, 6, PAL.tan);
    s.rect(1, 3, 12, 1, PAL.dkstone); s.rect(1, 12, 12, 1, PAL.dkstone);
    s.rect(1, 3, 3, 1, PAL.ltstone); s.rect(1, 12, 3, 1, PAL.ltstone);
    this.barrel = s.outline().toCanvas();

    // TNT barrel
    s = new PixelSprite(14, 16);
    s.ellipse(7, 8, 6, 7.4, PAL.red);
    s.shadeEllipse(9.5, 8, 2.5, 7, '#9a2020'); s.shadeEllipse(4.5, 8, 1.2, 6, PAL.red2);
    s.rect(1, 5, 12, 6, PAL.yellow);
    s.rect(1, 2, 12, 1, PAL.ink); s.rect(1, 13, 12, 1, PAL.ink);
    s.line(7, 0, 8, -2, PAL.cream);
    const tntC = s.outline().toCanvas();
    PixelFont.draw(tntC.getContext('2d'), 'TNT', 7, 6, 1, PAL.ink, null, 'center');
    this.tnt = tntC;

    // Rock
    s = new PixelSprite(20, 15);
    s.ellipse(10, 8.5, 9, 6.5, PAL.stone);
    s.shadeEllipse(12, 11, 7, 3.5, PAL.dkstone);
    s.shadeEllipse(8, 6, 4, 2, PAL.ltstone);
    s.set(6, 5, PAL.white); s.set(14, 9, PAL.dkstone); s.set(13, 8, PAL.dkstone);
    this.rock = s.outline().toCanvas();

    // Haystack
    s = new PixelSprite(22, 16);
    s.ellipse(11, 11, 10, 9, PAL.yellow);
    s.rect(0, 14, 22, 2, null);
    s.shadeEllipse(14, 12, 6, 6, PAL.sand2);
    for (let i = 0; i < 9; i++) { const x = 3 + i * 2; s.line(x, 6 + (i % 3), x + 1, 13, i % 2 ? PAL.sand2 : PAL.gold); }
    s.set(6, 4, PAL.gold); s.set(9, 3, PAL.gold);
    this.hay = s.outline().toCanvas();

    // Spring (2 frames: rest, extended)
    this.spring = [0, 1].map(ext => {
      const sp = new PixelSprite(16, 16);
      const top = ext ? 1 : 6;
      sp.rect(1, 13, 14, 3, PAL.dkstone); sp.rect(1, 13, 14, 1, PAL.stone);
      for (let y = top + 3; y < 13; y += 2) sp.rect(4, y, 8, 1, ((y / 2) | 0) % 2 ? PAL.ltstone : PAL.grey);
      sp.rect(1, top, 14, 3, PAL.red); sp.rect(1, top, 14, 1, PAL.red2);
      return sp.outline().toCanvas();
    });

    // Saw blade
    s = new PixelSprite(20, 20);
    for (let i = 0; i < 10; i++) {
      const a = i / 10 * Math.PI * 2;
      s.line(10 + Math.cos(a) * 6, 10 + Math.sin(a) * 6, 10 + Math.cos(a + 0.25) * 9, 10 + Math.sin(a + 0.25) * 9, PAL.ltstone);
      s.set(10 + Math.cos(a + 0.2) * 8, 10 + Math.sin(a + 0.2) * 8, PAL.ltstone);
    }
    s.ellipse(10, 10, 7, 7, PAL.grey);
    s.shadeEllipse(11, 11, 5, 5, PAL.dkgrey);
    s.ellipse(10, 10, 2, 2, PAL.ink); s.set(9, 9, PAL.grey);
    s.set(7, 6, PAL.white); s.set(6, 7, PAL.white);
    this.saw = s.outline().toCanvas();

    // Bird (2 frames)
    this.bird = [0, 1].map(f => {
      const b = new PixelSprite(16, 13);
      b.ellipse(8, 7, 5, 3.6, PAL.blue);
      b.shadeEllipse(8, 9, 4, 1.6, PAL.ltsky);
      b.ellipse(3.5, 5.5, 2.8, 2.6, PAL.blue);
      b.set(1, 5, PAL.yellow); b.set(0, 6, PAL.orange); b.set(1, 6, PAL.orange);
      b.set(3, 5, PAL.white); b.set(3, 4, PAL.ink);
      b.set(13, 6, PAL.navy); b.set(14, 5, PAL.navy); b.set(14, 7, PAL.navy);
      if (f === 0) { b.rect(7, 2, 4, 3, PAL.navy); b.set(8, 1, PAL.navy); }
      else { b.rect(7, 8, 4, 3, PAL.navy); b.set(8, 11, PAL.navy); }
      return b.outline().toCanvas();
    });

    // Balloon
    s = new PixelSprite(12, 22);
    s.ellipse(6, 6.5, 5, 6, PAL.pink);
    s.shadeEllipse(7.5, 8, 3, 4, PAL.dkpink);
    s.set(4, 3, PAL.white); s.set(3, 4, PAL.white);
    s.set(6, 13, PAL.dkpink);
    for (let y = 14; y < 22; y++) s.set(6 + (y % 3 === 0 ? 1 : 0), y, PAL.cream);
    this.balloon = s.outline().toCanvas();

    // Spike tile (one spike, 6x8)
    s = new PixelSprite(8, 9);
    for (let y = 0; y < 7; y++) {
      const half = y / 2.3;
      for (let x = -half; x <= half; x++) s.set(4 + x, 1 + y, x < 0 ? PAL.ltstone : PAL.grey);
    }
    s.set(4, 1, PAL.white);
    this.spike = s.outline().toCanvas();

    // Cactus-like warning sign for lava (decoration)
    s = new PixelSprite(12, 18);
    s.rect(5, 8, 2, 10, PAL.brown);
    for (let y = 0; y < 8; y++) { const half = y * 0.7; for (let x = -half; x <= half; x++) s.set(6 + x, y, PAL.yellow); }
    s.rect(6, 2, 1, 3, PAL.ink); s.set(6, 6, PAL.ink);
    this.sign = s.outline().toCanvas();
  },

  buildHearts() {
    const make = (fill) => {
      const s = new PixelSprite(9, 8);
      const shape = ['.##.##.', '#######', '#######', '.#####.', '..###..', '...#...'];
      shape.forEach((row, y) => row.split('').forEach((ch, x) => {
        if (ch === '#') s.set(x + 1, y + 1, fill === 'empty' ? PAL.ink2 : (fill === 'half' && x > 3 ? PAL.ink2 : PAL.red2));
      }));
      if (fill !== 'empty') s.set(2, 2, PAL.white);
      return s.outline().toCanvas();
    };
    this.heart.full = make('full'); this.heart.half = make('half'); this.heart.empty = make('empty');
  },

  /* ------------------- UPGRADE ICONS ------------------- */
  buildIcons() {
    const I = {};
    let s = new PixelSprite(15, 15); // power: slingshot
    s.line(7, 14, 7, 8, PAL.ltbrown, 2); s.line(7, 8, 2, 2, PAL.ltbrown, 2); s.line(7, 8, 12, 2, PAL.ltbrown, 2);
    s.line(2, 2, 7, 6, PAL.red); s.line(12, 2, 7, 6, PAL.red);
    I.power = s.outline();
    s = new PixelSprite(15, 15); // bounce: ball + arc
    s.ellipse(10, 10, 3.5, 3.5, PAL.ltgreen); s.set(9, 8, PAL.white);
    s.line(1, 13, 3, 4, PAL.cream); s.line(3, 4, 6, 2, PAL.cream); s.line(6, 2, 8, 6, PAL.cream);
    I.bounce = s.outline();
    s = new PixelSprite(15, 15); // speed: lightning
    [[8, 1], [7, 2], [6, 3], [5, 4], [4, 5], [4, 6], [5, 6], [6, 6], [7, 6], [8, 6], [9, 6], [8, 7], [7, 8], [6, 9], [5, 10], [4, 11], [3, 12]].forEach(([x, y]) => s.rect(x, y, 2, 2, PAL.yellow));
    I.speed = s.outline();
    s = new PixelSprite(15, 15); // air: wing
    for (let i = 0; i < 5; i++) s.line(2 + i, 3 + i * 2, 12 - i, 3 + i * 2 - (4 - i), i % 2 ? PAL.white : PAL.ltsky, 2);
    I.air = s.outline();
    s = new PixelSprite(15, 15); // durability: shield
    s.rect(2, 2, 11, 6, PAL.grey); for (let y = 8; y < 14; y++) s.rect(2 + (y - 7), y, 11 - (y - 7) * 2, 1, PAL.grey);
    s.rect(6, 4, 3, 7, PAL.red2); s.rect(4, 6, 7, 3, PAL.red2); s.rect(2, 2, 11, 1, PAL.white);
    I.durability = s.outline();
    s = new PixelSprite(15, 15); // magnet
    s.rect(2, 2, 4, 8, PAL.red); s.rect(9, 2, 4, 8, PAL.red); s.ellipse(7.5, 10, 5.5, 4, PAL.red); s.ellipse(7.5, 9.5, 1.5, 2.5, null);
    s.rect(6, 2, 3, 9, null); s.rect(2, 2, 4, 2, PAL.white); s.rect(9, 2, 4, 2, PAL.white);
    I.magnet = s.outline();
    s = new PixelSprite(15, 15); // luck: clover
    s.ellipse(5, 5, 3, 3, PAL.ltgreen); s.ellipse(10, 5, 3, 3, PAL.ltgreen); s.ellipse(5, 10, 3, 3, PAL.ltgreen); s.ellipse(10, 10, 3, 3, PAL.ltgreen);
    s.set(7, 7, PAL.green); s.line(8, 9, 11, 14, PAL.green); s.set(4, 4, PAL.lime);
    I.luck = s.outline();
    for (const k in I) this.icons[k] = I[k].toCanvas(2);
  },

  /* ------------------- SLINGSHOT ------------------- */
  makeSlingshot(def) {
    const s = new PixelSprite(34, 58);
    const [W1, W2, W3] = def.wood;
    s.rect(14, 28, 6, 30, W1); s.rect(17, 28, 3, 30, W2); s.rect(14, 28, 1, 30, W3);
    s.line(17, 31, 6, 4, W1, 5); s.line(17, 31, 28, 4, W1, 5);
    s.line(19, 32, 30, 5, W2, 2); s.line(15, 30, 4, 4, W3, 1);
    // leather wraps at the tips & middle
    s.rect(3, 4, 6, 4, PAL.dkbrown); s.rect(25, 4, 6, 4, PAL.dkbrown);
    s.rect(14, 38, 6, 3, PAL.dkbrown); s.rect(14, 44, 6, 2, PAL.dkbrown);
    s.set(4, 5, PAL.mud2); s.set(26, 5, PAL.mud2);
    if (def.gem) {   // glowing gems on the fork tips and base
      s.rect(5, 3, 2, 2, def.gem); s.rect(27, 3, 2, 2, def.gem); s.set(16, 33, def.gem); s.set(17, 33, def.gem);
    }
    // knot hole
    s.set(16, 50, PAL.dkbrown); s.set(16, 51, PAL.dkbrown);
    return s.outline();
  }
};
