// ============================================================================
// RENDERER
// ----------------------------------------------------------------------------
// Layered canvas rendering. Static/expensive content (asphalt grain, target
// guide lines) is rendered once to offscreen canvases and cached; only paint
// and characters are redrawn every frame. See buildJobVisualCache() for the
// per-job cache and Renderer for the main per-frame composite.
// ============================================================================

import { PAINT_THRESHOLD } from './painting.js';

function rand(min, max) { return min + Math.random() * (max - min); }

// ---------------------------------------------------------------------------
// Geometry tracing shared by the guide layer and job-select preview thumbs.
// ---------------------------------------------------------------------------
export function traceGeometryPath(ctx, geometry) {
  ctx.beginPath();
  switch (geometry.type) {
    case 'line':
      ctx.moveTo(geometry.x1, geometry.y1);
      ctx.lineTo(geometry.x2, geometry.y2);
      break;
    case 'rectangle':
      ctx.rect(geometry.x, geometry.y, geometry.w, geometry.h);
      break;
    case 'circle':
      ctx.arc(geometry.cx, geometry.cy, geometry.radius, 0, Math.PI * 2);
      break;
    case 'arc':
      ctx.arc(geometry.cx, geometry.cy, geometry.radius, geometry.startAngle, geometry.endAngle);
      break;
    case 'polygon': {
      const pts = geometry.points;
      ctx.moveTo(pts[0][0], pts[0][1]);
      for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
      if (geometry.closed !== false) ctx.closePath();
      break;
    }
  }
}

// ---------------------------------------------------------------------------
// Procedural asphalt texture - generated once per job and cached.
// ---------------------------------------------------------------------------
export function generateAsphaltTexture(width, height) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');

  const grad = ctx.createLinearGradient(0, 0, width, height);
  grad.addColorStop(0, '#4a4a47');
  grad.addColorStop(0.5, '#434340');
  grad.addColorStop(1, '#3c3c39');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, width, height);

  // grain speckles
  const speckleCount = Math.min(9000, Math.floor((width * height) / 220));
  for (let i = 0; i < speckleCount; i++) {
    const x = Math.random() * width;
    const y = Math.random() * height;
    const shade = Math.random();
    const c = shade < 0.5
      ? `rgba(${20 + shade * 30},${20 + shade * 30},${18 + shade * 30},${0.15 + shade * 0.2})`
      : `rgba(${170 + shade * 50},${168 + shade * 50},${160 + shade * 50},${0.08 + (shade - 0.5) * 0.25})`;
    ctx.fillStyle = c;
    const s = Math.random() * 1.6 + 0.3;
    ctx.fillRect(x, y, s, s);
  }

  // patches - slightly different shade rectangles (resurfacing patches)
  const patchCount = Math.max(2, Math.floor((width * height) / 260000));
  for (let i = 0; i < patchCount; i++) {
    const pw = rand(80, 260), ph = rand(60, 200);
    const x = rand(0, width - pw), y = rand(0, height - ph);
    ctx.save();
    ctx.globalAlpha = rand(0.05, 0.12);
    ctx.fillStyle = Math.random() < 0.5 ? '#5a5a56' : '#383835';
    ctx.fillRect(x, y, pw, ph);
    ctx.restore();
  }

  // stains
  const stainCount = Math.max(3, Math.floor((width * height) / 180000));
  for (let i = 0; i < stainCount; i++) {
    const x = rand(0, width), y = rand(0, height);
    const r = rand(30, 90);
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    const dark = Math.random() < 0.6;
    g.addColorStop(0, dark ? 'rgba(15,14,12,0.22)' : 'rgba(90,80,60,0.12)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  // cracks - jagged random-walk lines
  const crackCount = Math.max(2, Math.floor((width * height) / 220000));
  for (let i = 0; i < crackCount; i++) {
    let x = rand(0, width), y = rand(0, height);
    ctx.save();
    ctx.strokeStyle = 'rgba(10,10,8,0.35)';
    ctx.lineWidth = rand(0.6, 1.4);
    ctx.beginPath();
    ctx.moveTo(x, y);
    const segs = Math.floor(rand(6, 14));
    let angle = rand(0, Math.PI * 2);
    for (let s = 0; s < segs; s++) {
      angle += rand(-0.7, 0.7);
      x += Math.cos(angle) * rand(8, 22);
      y += Math.sin(angle) * rand(8, 22);
      ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.restore();
  }

  // faded old markings + tire streaks
  const markingCount = Math.max(1, Math.floor((width * height) / 400000));
  for (let i = 0; i < markingCount; i++) {
    ctx.save();
    ctx.translate(rand(0, width), rand(0, height));
    ctx.rotate(rand(0, Math.PI * 2));
    ctx.strokeStyle = 'rgba(210,205,190,0.06)';
    ctx.lineWidth = rand(4, 8);
    ctx.setLineDash([rand(14, 26), rand(10, 20)]);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(rand(80, 200), 0);
    ctx.stroke();
    ctx.restore();
  }

  const tireCount = Math.max(2, Math.floor((width * height) / 300000));
  for (let i = 0; i < tireCount; i++) {
    ctx.save();
    ctx.translate(rand(0, width), rand(0, height));
    const ang = rand(0, Math.PI * 2);
    ctx.rotate(ang);
    ctx.strokeStyle = 'rgba(5,5,5,0.18)';
    ctx.lineWidth = 6;
    for (const off of [-9, 9]) {
      ctx.beginPath();
      ctx.moveTo(0, off);
      ctx.quadraticCurveTo(rand(40, 100), off + rand(-10, 10), rand(120, 220), off + rand(-20, 20));
      ctx.stroke();
    }
    ctx.restore();
  }

  return canvas;
}

// ---------------------------------------------------------------------------
// Target guide layer - the "design already laid out on the asphalt" that the
// player and AI are meant to paint over. Rendered once per job.
// ---------------------------------------------------------------------------
export function generateGuideLayer(job) {
  const canvas = document.createElement('canvas');
  canvas.width = job.world.width;
  canvas.height = job.world.height;
  const ctx = canvas.getContext('2d');

  for (const target of job.targets) {
    ctx.save();
    if (target.geometry.filled) {
      traceGeometryPath(ctx, target.geometry);
      ctx.fillStyle = hexToRgba(target.color, 0.07);
      ctx.fill();
    }
    traceGeometryPath(ctx, target.geometry);
    ctx.strokeStyle = hexToRgba(target.color, 0.55);
    ctx.lineWidth = 2;
    ctx.setLineDash([8, 7]);
    ctx.stroke();
    ctx.restore();
  }

  return canvas;
}

function hexToRgba(hex, alpha) {
  const v = hex.replace('#', '');
  const r = parseInt(v.substring(0, 2), 16);
  const g = parseInt(v.substring(2, 4), 16);
  const b = parseInt(v.substring(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

// ---------------------------------------------------------------------------
// Unpainted-cell highlight - instead of pulsing a whole target's outline
// until some overall completion threshold, every individual unpainted cell
// (the same ~6px grid the scoring uses) is drawn in solid warning red. As
// the player/AI paints over a spot it disappears immediately, cell by cell,
// so "what's left" always reads as exactly what's left - not a coarse
// per-target toggle.
// ---------------------------------------------------------------------------
const PROGRESS_COLOR = '255,70,55';

export function drawTargetProgress(ctx, grid, elapsedSeconds) {
  if (!grid) return;
  const pulse = 0.6 + 0.35 * Math.sin(elapsedSeconds * 3.5);
  const cellSize = grid.cellSize;
  const half = cellSize / 2 + 0.6; // slight overdraw so adjacent cells tile without hairline gaps

  ctx.save();
  ctx.fillStyle = `rgba(${PROGRESS_COLOR},${pulse.toFixed(3)})`;
  for (let ti = 0; ti < grid.targets.length; ti++) {
    const cells = grid.targetMeta[ti].toleranceCells;
    for (const idx of cells) {
      if (grid.alpha[idx] > PAINT_THRESHOLD) continue;
      const cx = (idx % grid.cols) * cellSize + cellSize / 2;
      const cy = Math.floor(idx / grid.cols) * cellSize + cellSize / 2;
      ctx.fillRect(cx - half, cy - half, half * 2, half * 2);
    }
  }
  ctx.restore();
}

// ---------------------------------------------------------------------------
// Paint dab - drawn onto the shared paint canvas whenever PaintGrid.stamp()
// is called. Kept visually independent of the logical grid resolution.
// ---------------------------------------------------------------------------
export function paintDab(ctx, x, y, radius, colorHex, intensity = 1) {
  const jitterX = rand(-1.2, 1.2);
  const jitterY = rand(-1.2, 1.2);
  const r = radius * rand(0.92, 1.12);
  const cx = x + jitterX, cy = y + jitterY;

  const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
  const alpha = Math.min(0.85, 0.42 * intensity);
  grad.addColorStop(0, hexToRgba(colorHex, alpha));
  grad.addColorStop(0.75, hexToRgba(colorHex, alpha * 0.85));
  grad.addColorStop(1, hexToRgba(colorHex, 0));

  ctx.save();
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();

  if (Math.random() < 0.3) {
    ctx.globalAlpha = alpha * 0.5;
    ctx.fillStyle = colorHex;
    for (let i = 0; i < 2; i++) {
      const fx = cx + rand(-r, r) * 0.9;
      const fy = cy + rand(-r, r) * 0.9;
      ctx.beginPath();
      ctx.arc(fx, fy, rand(0.6, 1.6), 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
}

export function createPaintCanvas(job) {
  const canvas = document.createElement('canvas');
  canvas.width = job.world.width;
  canvas.height = job.world.height;
  return canvas;
}

// ---------------------------------------------------------------------------
// Cached per-job visuals: one asphalt texture + one guide layer for the
// single shared job site the whole crew paints together.
// ---------------------------------------------------------------------------
export function buildJobVisualCache(job) {
  return {
    asphalt: generateAsphaltTexture(job.world.width, job.world.height),
    guide: generateGuideLayer(job),
  };
}

// ---------------------------------------------------------------------------
// Main renderer: composites the job site + characters + particles for one frame.
// ---------------------------------------------------------------------------
export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
  }

  resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = window.innerWidth, h = window.innerHeight;
    this.canvas.width = Math.floor(w * dpr);
    this.canvas.height = Math.floor(h * dpr);
    this.canvas.style.width = w + 'px';
    this.canvas.style.height = h + 'px';
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { w, h };
  }

  clear(w, h) {
    this.ctx.save();
    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.ctx.fillStyle = '#141412';
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    this.ctx.restore();
  }

  drawSite(visualCache, paintCanvas, job) {
    const ctx = this.ctx;
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.5)';
    ctx.shadowBlur = 24;
    ctx.fillStyle = '#000';
    ctx.fillRect(-4, -4, job.world.width + 8, job.world.height + 8);
    ctx.restore();

    ctx.drawImage(visualCache.asphalt, 0, 0);
    ctx.drawImage(visualCache.guide, 0, 0);
    ctx.drawImage(paintCanvas, 0, 0);
  }

  drawEntities(characters) {
    const sorted = [...characters].sort((a, b) => a.y - b.y);
    for (const character of sorted) character.draw(this.ctx);
  }
}
