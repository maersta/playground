// ============================================================================
// AI CONTROLLER
// ----------------------------------------------------------------------------
// Drives an AI coworker's Character through a job: pick a target (order
// determined by personality.taskPreference), walk its geometry, paint as it
// goes, occasionally idle/wobble/mess up depending on personality, and
// optionally revisit a target for a "correction pass" if a perfectionist
// judges their own work too sloppy. Paints directly onto the session's one
// shared PaintGrid, tagging each stamp with its owner index for scoring.
// ============================================================================

import { sampleArc, sampleCircle, rectCorners, boustrophedonRect, boustrophedonPolygon } from './geometry.js';
import { ROLLER_RADIUS } from './character.js';

const ARRIVAL_RADIUS = 10;
// Dense enough that consecutive sweep rows/waypoints overlap well inside the
// roller's own diameter - completion now requires the whole job to actually
// be finished, so gappy coverage isn't an option.
const SWEEP_SPACING = ROLLER_RADIUS * 1.1;

// Filled shapes: sweep the interior, then explicitly visit every corner so a
// tight-spaced boustrophedon pass can't leave a corner pocket unpainted.
function withCornerPass(sweepPoints, corners) {
  return [...sweepPoints, ...corners, ...corners.slice().reverse()];
}

function buildPathForTarget(target) {
  const g = target.geometry;
  switch (g.type) {
    case 'line':
      return [{ x: g.x1, y: g.y1 }, { x: g.x2, y: g.y2 }];
    case 'rectangle': {
      if (g.filled) {
        const sweep = boustrophedonRect(g.x + 2, g.y + 2, g.w - 4, g.h - 4, SWEEP_SPACING).map(([x, y]) => ({ x, y }));
        const corners = rectCorners(g.x, g.y, g.w, g.h).map(([x, y]) => ({ x, y }));
        return withCornerPass(sweep, corners);
      }
      const corners = rectCorners(g.x, g.y, g.w, g.h);
      return [...corners, corners[0]].map(([x, y]) => ({ x, y }));
    }
    case 'circle': {
      const segments = Math.max(28, Math.ceil((2 * Math.PI * g.radius) / SWEEP_SPACING));
      return sampleCircle(g.cx, g.cy, g.radius, segments).map(([x, y]) => ({ x, y }));
    }
    case 'arc': {
      const span = g.endAngle - g.startAngle;
      const segments = Math.max(24, Math.ceil((g.radius * span) / SWEEP_SPACING));
      return sampleArc(g.cx, g.cy, g.radius, g.startAngle, g.endAngle, segments).map(([x, y]) => ({ x, y }));
    }
    case 'polygon': {
      if (g.filled) {
        const sweep = boustrophedonPolygon(g.points, SWEEP_SPACING).map(([x, y]) => ({ x, y }));
        const vertices = g.points.map(([x, y]) => ({ x, y }));
        return withCornerPass(sweep, vertices);
      }
      const pts = g.closed !== false ? [...g.points, g.points[0]] : g.points;
      return pts.map(([x, y]) => ({ x, y }));
    }
    default:
      return [];
  }
}

function orderTargets(targets, meta, taskPreference) {
  const items = targets.map((t, i) => ({ target: t, size: meta[i].toleranceCells.length }));
  switch (taskPreference) {
    case 'hardest_first':
      return items.sort((a, b) => b.size - a.size).map((i) => i.target);
    case 'easiest_first':
      return items.sort((a, b) => a.size - b.size).map((i) => i.target);
    case 'random': {
      const arr = items.map((i) => i.target);
      for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
      }
      return arr;
    }
    case 'sequential':
    default:
      return items.map((i) => i.target);
  }
}

export class AIController {
  constructor(character, job, paintGrid, ownerIndex) {
    this.character = character;
    this.job = job;
    this.paintGrid = paintGrid;
    this.ownerIndex = ownerIndex;
    this.personality = character.coworker.personality;

    this.queue = orderTargets(job.targets, paintGrid.targetMeta, this.personality.taskPreference)
      .map((target) => ({ target, path: buildPathForTarget(target), pathIdx: 0, corrections: 0 }));
    this.queuePos = 0;
    this.current = null;
    this.idleTimer = 0.4 + Math.random() * 0.6;
    this.wobble = { x: 0, y: 0 };
    this.speedScale = 1;
    this.finished = false;
    this._wrongColorPass = false;
  }

  _pickNext() {
    if (this.queuePos >= this.queue.length) {
      this.current = null;
      this.finished = true;
      return;
    }
    this.current = this.queue[this.queuePos];
    this.current.pathIdx = 0;
    this.queuePos += 1;
    this._wrongColorPass = Math.random() < this.personality.mistakeRate * 0.25;
  }

  _maybeRequeueForCorrection(entry) {
    if (entry.corrections >= 3) return;
    const p = this.personality;
    if (p.correctionBehavior === 'never') return;
    const chance = { always: 0.98, sometimes: 0.7, rarely: 0.4, never: 0 }[p.correctionBehavior] ?? 0.5;
    if (Math.random() > chance * p.perfectionism + chance * 0.3) return;

    const stats = this.paintGrid.getStats();
    const stat = stats.perTarget.find((s) => s.id === entry.target.id);
    // The job only ends once it's genuinely finished, so keep circling back
    // until this target is essentially fully painted, not just "good enough".
    if (stat && stat.completion < 0.985) {
      entry.pathIdx = 0;
      entry.path = entry.path.slice().reverse();
      entry.corrections += 1;
      this.queuePos -= 0; // stays as current, doesn't advance queue
      this.current = entry;
      return true;
    }
    return false;
  }

  update(dt, worldW, worldH, speedScale = 1) {
    const p = this.personality;
    this.speedScale = speedScale;

    if (this.idleTimer > 0) {
      this.idleTimer -= dt;
      this.character.isPainting = false;
      this.character.update(dt, { x: 0, y: 0 }, worldW, worldH, 1);
      return;
    }

    if (!this.current) {
      this._pickNext();
      if (!this.current) {
        // done with the job - idle/wander gently
        this.character.isPainting = false;
        this.character.update(dt, { x: 0, y: 0 }, worldW, worldH, 1);
        return;
      }
    }

    // random laziness break
    if (Math.random() < p.laziness * 0.12 * dt) {
      this.idleTimer = 0.6 + Math.random() * 2.2 * p.laziness;
      return;
    }

    const entry = this.current;
    const waypoint = entry.path[entry.pathIdx];
    if (!waypoint) {
      const requeued = this._maybeRequeueForCorrection(entry);
      if (!requeued) this.current = null;
      return;
    }

    // mistake jitter: aim slightly off from the true waypoint
    if (Math.random() < p.mistakeRate * dt * 1.5) {
      const mag = 6 + p.riskTaking * 10;
      this.wobble = { x: (Math.random() - 0.5) * mag, y: (Math.random() - 0.5) * mag };
    }
    this.wobble.x *= 0.9;
    this.wobble.y *= 0.9;

    const aimX = waypoint.x + this.wobble.x;
    const aimY = waypoint.y + this.wobble.y;
    const dx = aimX - this.character.x;
    const dy = aimY - this.character.y;
    const dist = Math.hypot(dx, dy);

    let moveVec = { x: 0, y: 0 };
    if (dist > 1) moveVec = { x: dx / dist, y: dy / dist };

    const speed = this.character.update(dt, moveVec, worldW, worldH, speedScale);
    this.character.isPainting = dist > 2;

    let paintEvent = null;
    if (this.character.isPainting) {
      const color = this._wrongColorPass ? this._pickWrongColor(entry.target.color) : entry.target.color;
      this.character.currentColor = color;
      const speedRatio = speed / (this.character.baseSpeed * this.character.speedMultiplier);
      const coverage = Math.max(28, 85 - Math.max(0, speedRatio - 1) * 55) * (0.7 + p.accuracy * 0.3);
      const contact = this.character.getRollerContactPoint();
      const amount = coverage * dt * 12;
      this.paintGrid.stamp(contact.x, contact.y, ROLLER_RADIUS, color, amount, this.ownerIndex);
      paintEvent = { contact, color, amount };
    }

    const realDist = Math.hypot(waypoint.x - this.character.x, waypoint.y - this.character.y);
    if (realDist < ARRIVAL_RADIUS) {
      entry.pathIdx += 1;
    }
    return paintEvent;
  }

  _pickWrongColor(correctColor) {
    const palette = this.job.colors.filter((c) => c !== correctColor);
    if (!palette.length) return correctColor;
    return palette[Math.floor(Math.random() * palette.length)];
  }
}
