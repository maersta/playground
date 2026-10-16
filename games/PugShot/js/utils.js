/* =========================================================
   utils.js - constants, palette, math helpers, RNG, pixel font
   ========================================================= */
'use strict';

// ---- World / physics constants (world units are internal pixels) ----
const PX_PER_M = 10;          // 10 world pixels = 1 meter
const GRAVITY = 520;          // px/s^2 - stronger than real life for snappy arcs
const PHYS_DT = 1 / 120;      // fixed physics timestep
const COL_W = 4;              // terrain column width in px
const SLING_X = 80;           // slingshot world x
const START_GROUND_Y = 180;   // ground height at the start

// ---- Limited retro palette ----
const PAL = {
  ink: '#1a1423', ink2: '#2e2440', dkbrown: '#3b2027', brown: '#6b3d2e', ltbrown: '#a0643c',
  tan: '#d9a066', fawn: '#eec39a', cream: '#f7e2c0', white: '#fff8ec',
  red: '#c4302b', red2: '#e8604c', orange: '#e8742c', yellow: '#f4c430', gold: '#ffe066', gold2: '#c4892b',
  dkgreen: '#2d5a27', green: '#4a8c3a', ltgreen: '#7cc456', lime: '#b6ec8c',
  navy: '#29366f', blue: '#3b5dc9', sky: '#41a6f6', ltsky: '#a8e4ff',
  grey: '#94a3b8', dkgrey: '#566c86', stone: '#7a7484', ltstone: '#a9a3b5', dkstone: '#4a4458',
  pink: '#f08ca0', dkpink: '#c45a78', purple: '#5d275d', lava: '#ff7b1a', lava2: '#ffd04a',
  ice: '#bdeeff', ice2: '#7cc8e8', mud: '#5a3a24', mud2: '#7a5232', sand: '#e6c27a', sand2: '#c49a52'
};

// ---- Math helpers ----
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const sign = v => (v < 0 ? -1 : 1);
const dist2 = (ax, ay, bx, by) => (ax - bx) * (ax - bx) + (ay - by) * (ay - by);
const smoothstep = t => t * t * (3 - 2 * t);
const rand = (a, b) => a + Math.random() * (b - a);
const randInt = (a, b) => Math.floor(rand(a, b + 1));
const chance = p => Math.random() < p;
const pick = arr => arr[Math.floor(Math.random() * arr.length)];

/** Deterministic hash -> [0,1) used for terrain speckles & decoration. */
function hash1(n) {
  n = (n << 13) ^ n;
  n = (n * (n * n * 15731 + 789221) + 1376312589) & 0x7fffffff;
  return n / 0x7fffffff;
}
function hash2(x, y) { return hash1((x | 0) * 73856093 ^ (y | 0) * 19349663); }

/** Smooth 1D value noise for background hills. */
function noise1(x) {
  const i = Math.floor(x), f = x - i;
  return lerp(hash1(i), hash1(i + 1), smoothstep(f));
}

/** Seeded RNG (mulberry32) so each run's world is generated consistently. */
class RNG {
  constructor(seed) { this.s = seed >>> 0; }
  next() {
    let t = (this.s += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  range(a, b) { return a + this.next() * (b - a); }
  int(a, b) { return Math.floor(this.range(a, b + 1)); }
  chance(p) { return this.next() < p; }
  pick(arr) { return arr[Math.floor(this.next() * arr.length)]; }
  /** Weighted pick: items = [{w, v}] */
  weighted(items) {
    let total = 0;
    for (const it of items) total += Math.max(0, it.w);
    let r = this.next() * total;
    for (const it of items) {
      r -= Math.max(0, it.w);
      if (r <= 0) return it.v;
    }
    return items[items.length - 1].v;
  }
}

/** Draw a 1px pixel line (Bresenham) - keeps rubber bands crisp. */
function pixelLine(ctx, x0, y0, x1, y1, color) {
  x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
  ctx.fillStyle = color;
  const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
  let err = dx + dy, guard = 0;
  while (guard++ < 2000) {
    ctx.fillRect(x0, y0, 1, 1);
    if (x0 === x1 && y0 === y1) break;
    const e2 = 2 * err;
    if (e2 >= dy) { err += dy; x0 += sx; }
    if (e2 <= dx) { err += dx; y0 += sy; }
  }
}

/* =========================================================
   PixelFont - tiny 3x5 bitmap font drawn with fillRect
   ========================================================= */
const PixelFont = (() => {
  const G = {
    '0': '111101101101111', '1': '010110010010111', '2': '111001111100111', '3': '111001111001111',
    '4': '101101111001001', '5': '111100111001111', '6': '111100111101111', '7': '111001010010010',
    '8': '111101111101111', '9': '111101111001111',
    'A': '010101111101101', 'B': '110101110101110', 'C': '011100100100011', 'D': '110101101101110',
    'E': '111100110100111', 'F': '111100110100100', 'G': '011100101101011', 'H': '101101111101101',
    'I': '111010010010111', 'J': '001001001101010', 'K': '101101110101101', 'L': '100100100100111',
    'M': '101111111101101', 'N': '110101101101101', 'O': '010101101101010', 'P': '110101110100100',
    'Q': '010101101110011', 'R': '110101110101101', 'S': '011100010001110', 'T': '111010010010010',
    'U': '101101101101111', 'V': '101101101101010', 'W': '101101111111101', 'X': '101101010101101',
    'Y': '101101010010010', 'Z': '111001010100111',
    '!': '010010010000010', '.': '000000000000010', ',': '000000000010100', ':': '000010000010000',
    '-': '000000111000000', '+': '000010111010000', '%': '101001010100101', '/': '001001010100100',
    '?': '110001010000010', 'x': '000101010101000', "'": '010010000000000', '<': '001010100010001',
    '>': '100010001010100', '(': '010100100100010', ')': '010001001001010', '=': '000111000111000',
    '*': '000101010101000', ' ': '000000000000000'
  };
  const glyphs = {};
  for (const k in G) glyphs[k] = G[k].split('').map(c => c === '1');

  function measure(text, scale = 1) {
    return text.length ? (text.length * 4 - 1) * scale : 0;
  }

  /** Draw text. align: 'left' | 'center' | 'right'. shadow draws a 1-scale drop outline. */
  function draw(ctx, text, x, y, scale = 1, color = PAL.white, shadow = PAL.ink, align = 'left') {
    text = String(text).toUpperCase().replace(/X(?=\d)/g, 'x');
    const w = measure(text, scale);
    let sx = Math.round(align === 'center' ? x - w / 2 : align === 'right' ? x - w : x);
    y = Math.round(y);
    if (shadow) {
      drawRaw(ctx, text, sx + scale, y + scale, scale, shadow);
      drawRaw(ctx, text, sx - Math.max(1, scale >> 1), y, scale, shadow);
      drawRaw(ctx, text, sx, y - Math.max(1, scale >> 1), scale, shadow);
    }
    drawRaw(ctx, text, sx, y, scale, color);
    return w;
  }

  function drawRaw(ctx, text, x, y, s, color) {
    ctx.fillStyle = color;
    for (let i = 0; i < text.length; i++) {
      const g = glyphs[text[i]] || glyphs['?'];
      const gx = x + i * 4 * s;
      for (let p = 0; p < 15; p++) {
        if (g[p]) ctx.fillRect(gx + (p % 3) * s, y + ((p / 3) | 0) * s, s, s);
      }
    }
  }

  /** Render text into its own canvas (used for DOM menu headings). */
  function toCanvas(text, scale, color, shadow, outline) {
    text = String(text).toUpperCase();
    const pad = scale * 2;
    const c = document.createElement('canvas');
    c.width = measure(text, scale) + pad * 2;
    c.height = 5 * scale + pad * 2;
    const ctx = c.getContext('2d');
    if (outline) {
      for (const [ox, oy] of [[-1, 0], [1, 0], [0, -1], [0, 1], [1, 1], [-1, 1], [1, -1], [-1, -1]]) {
        drawRaw(ctx, text, pad + ox * (scale >> 1 || 1), pad + oy * (scale >> 1 || 1), scale, outline);
      }
    }
    if (shadow) drawRaw(ctx, text, pad, pad + Math.max(1, scale >> 1), scale, shadow);
    drawRaw(ctx, text, pad, pad, scale, color);
    return c;
  }

  return { draw, measure, toCanvas };
})();
