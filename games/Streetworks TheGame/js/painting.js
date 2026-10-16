// ============================================================================
// PAINT GRID
// ----------------------------------------------------------------------------
// Owns the ground-truth "who painted what" data for a job. This is kept
// completely separate from the visual paint canvas (see renderer.js) so that
// scoring never needs to read pixels back off the GPU/canvas - it's a cheap
// logical grid of cells instead.
//
// The whole crew paints onto ONE shared grid (one job, painted together) -
// there is no per-person copy of the world. Each cell knows: how much paint
// coverage it has (alpha), what color it was last painted, which crew member
// last painted it (for individual contribution/accuracy credit), and
// (precomputed once at job load) which target's tolerance/core band it falls
// inside, if any.
// ============================================================================

import { distToSegment, distToPolyline, pointInPolygon, rectCorners, angleInArc } from './geometry.js';

export const PAINT_THRESHOLD = 55; // out of 255 - minimum coverage to "count" as painted
const FILL_DILATION = 5; // px of forgiveness around filled-shape edges

function targetBounds(geometry, strokeWidth) {
  const pad = (strokeWidth || 0) / 2 + FILL_DILATION + 4;
  switch (geometry.type) {
    case 'line':
      return {
        minX: Math.min(geometry.x1, geometry.x2) - pad, maxX: Math.max(geometry.x1, geometry.x2) + pad,
        minY: Math.min(geometry.y1, geometry.y2) - pad, maxY: Math.max(geometry.y1, geometry.y2) + pad,
      };
    case 'rectangle':
      return {
        minX: geometry.x - pad, maxX: geometry.x + geometry.w + pad,
        minY: geometry.y - pad, maxY: geometry.y + geometry.h + pad,
      };
    case 'circle':
    case 'arc':
      return {
        minX: geometry.cx - geometry.radius - pad, maxX: geometry.cx + geometry.radius + pad,
        minY: geometry.cy - geometry.radius - pad, maxY: geometry.cy + geometry.radius + pad,
      };
    case 'polygon': {
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      for (const [px, py] of geometry.points) {
        minX = Math.min(minX, px); maxX = Math.max(maxX, px);
        minY = Math.min(minY, py); maxY = Math.max(maxY, py);
      }
      return { minX: minX - pad, maxX: maxX + pad, minY: minY - pad, maxY: maxY + pad };
    }
    default:
      return { minX: 0, maxX: 0, minY: 0, maxY: 0 };
  }
}

// Returns { tolerance: bool, core: bool } for a point against one target's geometry.
function testTarget(geometry, strokeWidth, px, py) {
  const tolHalf = strokeWidth / 2;
  const coreHalf = strokeWidth * 0.28;

  switch (geometry.type) {
    case 'line': {
      const d = distToSegment(px, py, geometry.x1, geometry.y1, geometry.x2, geometry.y2);
      return { tolerance: d <= tolHalf, core: d <= coreHalf };
    }
    case 'rectangle': {
      const corners = rectCorners(geometry.x, geometry.y, geometry.w, geometry.h);
      if (geometry.filled) {
        const inside = pointInPolygon(px, py, corners);
        const d = distToPolyline(px, py, corners, true);
        return { tolerance: inside || d <= FILL_DILATION, core: inside };
      }
      const d = distToPolyline(px, py, corners, true);
      return { tolerance: d <= tolHalf, core: d <= coreHalf };
    }
    case 'circle': {
      const d = Math.hypot(px - geometry.cx, py - geometry.cy);
      if (geometry.filled) {
        return { tolerance: d <= geometry.radius + FILL_DILATION, core: d <= geometry.radius };
      }
      const band = Math.abs(d - geometry.radius);
      return { tolerance: band <= tolHalf, core: band <= coreHalf };
    }
    case 'arc': {
      const d = Math.hypot(px - geometry.cx, py - geometry.cy);
      const band = Math.abs(d - geometry.radius);
      const angle = Math.atan2(py - geometry.cy, px - geometry.cx);
      const inSpan = angleInArc(angle, geometry.startAngle, geometry.endAngle);
      return { tolerance: inSpan && band <= tolHalf, core: inSpan && band <= coreHalf };
    }
    case 'polygon': {
      const closed = geometry.closed !== false;
      if (geometry.filled) {
        const inside = pointInPolygon(px, py, geometry.points);
        const d = distToPolyline(px, py, geometry.points, closed);
        return { tolerance: inside || d <= FILL_DILATION, core: inside };
      }
      const d = distToPolyline(px, py, geometry.points, closed);
      return { tolerance: d <= tolHalf, core: d <= coreHalf };
    }
    default:
      return { tolerance: false, core: false };
  }
}

export class PaintGrid {
  constructor(job, cellSize = 6) {
    this.job = job;
    this.cellSize = cellSize;
    this.cols = Math.ceil(job.world.width / cellSize);
    this.rows = Math.ceil(job.world.height / cellSize);
    this.numCells = this.cols * this.rows;

    this.alpha = new Uint8Array(this.numCells);
    this.colorPaletteIdx = new Int16Array(this.numCells).fill(-1);
    this.cellOwner = new Int8Array(this.numCells).fill(-1); // crew-member index who last painted this cell
    this.palette = [];
    this.paletteMap = new Map();

    this.targetTolerance = new Int16Array(this.numCells).fill(-1);
    this.targetCore = new Int16Array(this.numCells).fill(-1);

    this.targets = job.targets;
    this.targetMeta = this.targets.map(() => ({ toleranceCells: [], coreCells: [] }));

    this._buildMembership();
  }

  _buildMembership() {
    const { cellSize, cols, rows } = this;
    for (let ti = 0; ti < this.targets.length; ti++) {
      const target = this.targets[ti];
      const bounds = targetBounds(target.geometry, target.strokeWidth || 10);
      const cx0 = Math.max(0, Math.floor(bounds.minX / cellSize));
      const cx1 = Math.min(cols - 1, Math.ceil(bounds.maxX / cellSize));
      const cy0 = Math.max(0, Math.floor(bounds.minY / cellSize));
      const cy1 = Math.min(rows - 1, Math.ceil(bounds.maxY / cellSize));
      const meta = this.targetMeta[ti];

      for (let cy = cy0; cy <= cy1; cy++) {
        for (let cx = cx0; cx <= cx1; cx++) {
          const px = cx * cellSize + cellSize / 2;
          const py = cy * cellSize + cellSize / 2;
          const res = testTarget(target.geometry, target.strokeWidth || 10, px, py);
          if (!res.tolerance) continue;
          const idx = cy * cols + cx;
          if (this.targetTolerance[idx] !== -1) continue; // first target claims the cell
          this.targetTolerance[idx] = ti;
          meta.toleranceCells.push(idx);
          if (res.core) {
            this.targetCore[idx] = ti;
            meta.coreCells.push(idx);
          }
        }
      }
    }
  }

  _paletteIndex(hex) {
    if (this.paletteMap.has(hex)) return this.paletteMap.get(hex);
    const i = this.palette.length;
    this.palette.push(hex);
    this.paletteMap.set(hex, i);
    return i;
  }

  // Stamp a filled circle of paint at world (x,y). `coverageAmount` (0-255)
  // controls how much alpha is deposited per stamp - callers reduce this when
  // moving fast to simulate incomplete coverage. `ownerIndex` credits this
  // paint to a specific crew member (index into the session's crew array) for
  // individual contribution/accuracy scoring - pass -1/omit for unattributed.
  stamp(x, y, radius, colorHex, coverageAmount = 70, ownerIndex = -1) {
    const { cellSize, cols, rows } = this;
    const cx0 = Math.max(0, Math.floor((x - radius) / cellSize));
    const cx1 = Math.min(cols - 1, Math.floor((x + radius) / cellSize));
    const cy0 = Math.max(0, Math.floor((y - radius) / cellSize));
    const cy1 = Math.min(rows - 1, Math.floor((y + radius) / cellSize));
    const pIdx = this._paletteIndex(colorHex);
    const r2 = radius * radius;
    const touched = [];

    for (let cy = cy0; cy <= cy1; cy++) {
      for (let cx = cx0; cx <= cx1; cx++) {
        const px = cx * cellSize + cellSize / 2;
        const py = cy * cellSize + cellSize / 2;
        const dx = px - x, dy = py - y;
        if (dx * dx + dy * dy > r2) continue;
        const idx = cy * cols + cx;
        this.colorPaletteIdx[idx] = pIdx;
        this.cellOwner[idx] = ownerIndex;
        this.alpha[idx] = Math.min(255, this.alpha[idx] + coverageAmount);
        touched.push(idx);
      }
    }
    return touched;
  }

  cellWorldCenter(idx) {
    const cx = idx % this.cols;
    const cy = Math.floor(idx / this.cols);
    return [cx * this.cellSize + this.cellSize / 2, cy * this.cellSize + this.cellSize / 2];
  }

  // Full stats recompute - cheap (typed-array scans), safe to throttle to a
  // few times per second rather than every frame.
  //
  // `crewSize` (optional): when > 0, also returns a `byOwner` array (one
  // entry per crew-member index) breaking each target down by who painted
  // it - their `completion` is their personal share of that target's total
  // area, their `accuracy` is the precision of just the cells they touched.
  // Without it, only the shared/team-wide numbers are computed.
  getStats(crewSize = 0) {
    const perTarget = [];
    const perTargetByOwner = crewSize ? Array.from({ length: crewSize }, () => []) : null;

    for (let ti = 0; ti < this.targets.length; ti++) {
      const target = this.targets[ti];
      const meta = this.targetMeta[ti];
      const totalTol = meta.toleranceCells.length || 1;
      const totalCore = meta.coreCells.length || 1;

      let painted = 0;
      const ownerPainted = crewSize ? new Array(crewSize).fill(0) : null;
      for (const idx of meta.toleranceCells) {
        if (this.alpha[idx] > PAINT_THRESHOLD) {
          painted++;
          if (crewSize) {
            const o = this.cellOwner[idx];
            if (o >= 0 && o < crewSize) ownerPainted[o]++;
          }
        }
      }

      let coreCorrect = 0, corePainted = 0;
      const ownerCorePainted = crewSize ? new Array(crewSize).fill(0) : null;
      const ownerCoreCorrect = crewSize ? new Array(crewSize).fill(0) : null;
      for (const idx of meta.coreCells) {
        if (this.alpha[idx] > PAINT_THRESHOLD) {
          corePainted++;
          const hex = this.palette[this.colorPaletteIdx[idx]];
          const correct = hex === target.color;
          if (correct) coreCorrect++;
          if (crewSize) {
            const o = this.cellOwner[idx];
            if (o >= 0 && o < crewSize) {
              ownerCorePainted[o]++;
              if (correct) ownerCoreCorrect[o]++;
            }
          }
        }
      }

      perTarget.push({
        id: target.id,
        label: target.label,
        completion: painted / totalTol,
        accuracy: coreCorrect / totalCore,
        totalCells: meta.toleranceCells.length,
      });

      if (crewSize) {
        for (let o = 0; o < crewSize; o++) {
          perTargetByOwner[o].push({
            id: target.id,
            label: target.label,
            completion: ownerPainted[o] / totalTol,
            accuracy: ownerCorePainted[o] ? ownerCoreCorrect[o] / ownerCorePainted[o] : null,
            totalCells: meta.toleranceCells.length,
            attemptedCells: ownerCorePainted[o],
          });
        }
      }
    }

    let totalPainted = 0, offTarget = 0;
    const ownerTotalPainted = crewSize ? new Array(crewSize).fill(0) : null;
    const ownerOffTarget = crewSize ? new Array(crewSize).fill(0) : null;
    for (let i = 0; i < this.numCells; i++) {
      if (this.alpha[i] > PAINT_THRESHOLD) {
        totalPainted++;
        const isOff = this.targetTolerance[i] === -1;
        if (isOff) offTarget++;
        if (crewSize) {
          const o = this.cellOwner[i];
          if (o >= 0 && o < crewSize) {
            ownerTotalPainted[o]++;
            if (isOff) ownerOffTarget[o]++;
          }
        }
      }
    }

    const team = summarize(perTarget, totalPainted, offTarget);
    if (!crewSize) return team;

    const byOwner = perTargetByOwner.map((ownerPerTarget, o) => summarize(
      ownerPerTarget, ownerTotalPainted[o], ownerOffTarget[o],
    ));

    return { ...team, byOwner };
  }
}

function summarize(perTarget, totalPainted, offTarget) {
  const cleanliness = totalPainted ? 1 - offTarget / totalPainted : 1;

  let compSum = 0, compW = 0, accSum = 0, accW = 0;
  for (const t of perTarget) {
    compSum += t.completion * t.totalCells; compW += t.totalCells;
    const accWeight = t.attemptedCells === undefined ? t.totalCells : t.attemptedCells;
    if (t.accuracy !== null && accWeight) { accSum += t.accuracy * accWeight; accW += accWeight; }
  }

  return {
    perTarget,
    completion: compW ? compSum / compW : 1,
    accuracy: accW ? accSum / accW : 1,
    cleanliness,
    totalPainted,
    offTarget,
  };
}
