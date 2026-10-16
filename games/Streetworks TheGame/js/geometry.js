// ============================================================================
// GEOMETRY HELPERS
// Shared math for target shapes: distance tests, angle-in-arc tests,
// point-in-polygon tests, and waypoint sampling used by both the paint-grid
// precompute step (painting.js) and the AI path planner (ai.js).
// ============================================================================

export function distToSegment(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const lenSq = dx * dx + dy * dy;
  let t = lenSq === 0 ? 0 : ((px - x1) * dx + (py - y1) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  const cx = x1 + t * dx;
  const cy = y1 + t * dy;
  return Math.hypot(px - cx, py - cy);
}

export function distToPolyline(px, py, points, closed) {
  let best = Infinity;
  const n = points.length;
  const count = closed ? n : n - 1;
  for (let i = 0; i < count; i++) {
    const a = points[i];
    const b = points[(i + 1) % n];
    const d = distToSegment(px, py, a[0], a[1], b[0], b[1]);
    if (d < best) best = d;
  }
  return best;
}

export function pointInPolygon(px, py, points) {
  let inside = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const xi = points[i][0], yi = points[i][1];
    const xj = points[j][0], yj = points[j][1];
    const intersect = ((yi > py) !== (yj > py)) &&
      (px < (xj - xi) * (py - yi) / (yj - yi) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}

// Rectangle outline as a closed polyline of its 4 corners.
export function rectCorners(x, y, w, h) {
  return [[x, y], [x + w, y], [x + w, y + h], [x, y + h]];
}

// angle (radians) normalized into [start, start+span) test, span = end-start (0..2PI)
export function angleInArc(angle, start, end) {
  const twoPI = Math.PI * 2;
  let a = angle - start;
  a = ((a % twoPI) + twoPI) % twoPI;
  return a <= (end - start) + 1e-6;
}

export function normalizeAngle(a) {
  const twoPI = Math.PI * 2;
  return ((a % twoPI) + twoPI) % twoPI;
}

// Sample N points evenly along an arc for AI pathing / stroke rendering.
export function sampleArc(cx, cy, radius, startAngle, endAngle, segments = 24) {
  const pts = [];
  for (let i = 0; i <= segments; i++) {
    const t = startAngle + (endAngle - startAngle) * (i / segments);
    pts.push([cx + Math.cos(t) * radius, cy + Math.sin(t) * radius]);
  }
  return pts;
}

export function sampleCircle(cx, cy, radius, segments = 32) {
  return sampleArc(cx, cy, radius, 0, Math.PI * 2, segments);
}

// Generate a boustrophedon (back-and-forth) sweep of waypoints covering a
// rectangular area, spaced by `spacing` (roughly the roller's effective width).
export function boustrophedonRect(x, y, w, h, spacing) {
  const pts = [];
  const rows = Math.max(1, Math.round(h / spacing));
  const rowH = h / rows;
  for (let r = 0; r <= rows; r++) {
    const ry = y + r * rowH;
    if (r % 2 === 0) {
      pts.push([x, ry], [x + w, ry]);
    } else {
      pts.push([x + w, ry], [x, ry]);
    }
  }
  return pts;
}

// Same idea but clipped to a polygon (for filled polygon targets): sweep the
// bounding box and keep only the segments whose sample points are inside.
export function boustrophedonPolygon(points, spacing) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const [px, py] of points) {
    if (px < minX) minX = px;
    if (px > maxX) maxX = px;
    if (py < minY) minY = py;
    if (py > maxY) maxY = py;
  }
  const pts = [];
  const rows = Math.max(1, Math.round((maxY - minY) / spacing));
  const rowH = (maxY - minY) / rows;
  for (let r = 0; r <= rows; r++) {
    const ry = minY + r * rowH;
    const xs = [];
    // find x-span inside polygon at this row via sampling
    const samples = 60;
    let inSpan = false;
    let spanStart = null;
    for (let i = 0; i <= samples; i++) {
      const sx = minX + (maxX - minX) * (i / samples);
      const inside = pointInPolygon(sx, ry, points);
      if (inside && !inSpan) { inSpan = true; spanStart = sx; }
      if (!inside && inSpan) { inSpan = false; xs.push([spanStart, sx]); }
    }
    if (inSpan) xs.push([spanStart, maxX]);
    if (xs.length) {
      const [a, b] = xs[0];
      if (r % 2 === 0) pts.push([a, ry], [b, ry]);
      else pts.push([b, ry], [a, ry]);
    }
  }
  return pts;
}
