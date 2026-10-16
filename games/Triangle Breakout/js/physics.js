/* ============================================================
   PHYSICS
   Circle-vs-triangle collision, reflection and ball stepping.
   Triangles are static polygons until destroyed. Balls move with
   adaptive substeps so they cannot skip through geometry.

   A "valid hit" happens only when the ball is overlapping a triangle
   AND moving into it (velocity . normal < 0). A ball that is merely
   resting/sliding against an edge gets pushed out but deals no damage,
   so no cooldown is needed to avoid jitter hits.
   ============================================================ */
(function () {
  'use strict';
  const TB = (window.TB = window.TB || {});
  const P = TB.CONFIG.physics;

  const contact = { nx: 0, ny: 0, depth: 0, cx: 0, cy: 0 };
  const best = { nx: 0, ny: 0, depth: 0, cx: 0, cy: 0 };
  const cand = [];
  const APPROACH_EPS = 1e-3;

  // Returns true and fills `out` (normal pointing out of the triangle, penetration
  // depth, contact point) when the circle overlaps the triangle.
  function circleTri(t, px, py, r, out) {
    const dx = px - t.cx, dy = py - t.cy;
    const reach = t.rad + r;
    if (dx * dx + dy * dy > reach * reach) return false;

    const d0 = (px - t.x0) * t.nx0 + (py - t.y0) * t.ny0;
    const d1 = (px - t.x1) * t.nx1 + (py - t.y1) * t.ny1;
    const d2 = (px - t.x2) * t.nx2 + (py - t.y2) * t.ny2;

    // Circle centre is inside the triangle (deep tunnelling safety): leave through the nearest edge.
    if (d0 <= 0 && d1 <= 0 && d2 <= 0) {
      let m = d0, nx = t.nx0, ny = t.ny0;
      if (d1 > m) { m = d1; nx = t.nx1; ny = t.ny1; }
      if (d2 > m) { m = d2; nx = t.nx2; ny = t.ny2; }
      out.nx = nx; out.ny = ny; out.depth = r - m;
      out.cx = px - nx * m; out.cy = py - ny * m;
      return true;
    }
    // Separated from one of the edge half-planes by more than r -> no contact.
    if (d0 > r || d1 > r || d2 > r) return false;

    // Closest point on the triangle boundary
    let bd = Infinity, bx = 0, by = 0;
    for (let e = 0; e < 3; e++) {
      let ax, ay, ex, ey;
      if (e === 0) { ax = t.x0; ay = t.y0; ex = t.x1 - ax; ey = t.y1 - ay; }
      else if (e === 1) { ax = t.x1; ay = t.y1; ex = t.x2 - ax; ey = t.y2 - ay; }
      else { ax = t.x2; ay = t.y2; ex = t.x0 - ax; ey = t.y0 - ay; }
      let u = ((px - ax) * ex + (py - ay) * ey) / (ex * ex + ey * ey);
      u = u < 0 ? 0 : u > 1 ? 1 : u;
      const qx = ax + u * ex, qy = ay + u * ey;
      const ddx = px - qx, ddy = py - qy;
      const dd = ddx * ddx + ddy * ddy;
      if (dd < bd) { bd = dd; bx = qx; by = qy; }
    }
    if (bd >= r * r) return false;
    const dist = Math.sqrt(bd);
    if (dist < 1e-9) {
      let m = d0, nx = t.nx0, ny = t.ny0;
      if (d1 > m) { m = d1; nx = t.nx1; ny = t.ny1; }
      if (d2 > m) { m = d2; nx = t.nx2; ny = t.ny2; }
      out.nx = nx; out.ny = ny;
    } else {
      out.nx = (px - bx) / dist; out.ny = (py - by) / dist;
    }
    out.depth = r - dist; out.cx = bx; out.cy = by;
    return true;
  }

  // Resolve every overlap for a ball (deepest first), reflecting and reporting hits.
  function resolve(ball, world, ev) {
    const r = ball.r;
    world.queryCircle(ball.x, ball.y, r + 1, cand);
    for (let iter = 0; iter < 4; iter++) {
      let found = null, bestDepth = 0;
      for (let i = 0; i < cand.length; i++) {
        const t = cand[i];
        if (!t.active) continue;
        if (circleTri(t, ball.x, ball.y, r, contact) && contact.depth > bestDepth) {
          bestDepth = contact.depth; found = t;
          best.nx = contact.nx; best.ny = contact.ny; best.cx = contact.cx; best.cy = contact.cy;
        }
      }
      if (!found) break;
      // positional correction so the ball never sits inside geometry
      ball.x += best.nx * (bestDepth + 0.01);
      ball.y += best.ny * (bestDepth + 0.01);
      const vn = ball.vx * best.nx + ball.vy * best.ny;
      if (vn < -APPROACH_EPS) {
        ball.vx -= 2 * vn * best.nx;
        ball.vy -= 2 * vn * best.ny;
        ev.onHit(ball, found, best.cx, best.cy, best.nx, best.ny);
      }
    }
  }

  function stepBall(ball, dt, world, ev) {
    ball.px = ball.x; ball.py = ball.y;
    const r = ball.r;
    const speed = Math.hypot(ball.vx, ball.vy);
    let n = Math.ceil((speed * dt) / (r * P.substepFraction));
    if (n < 1) n = 1; else if (n > P.maxSubsteps) n = P.maxSubsteps;
    const h = dt / n;
    const probe = world.inradius - 3 * r;
    const probe2 = probe > 0 ? probe * probe : 0;

    for (let i = 0; i < n; i++) {
      ball.x += ball.vx * h;
      ball.y += ball.vy * h;
      resolve(ball, world, ev);
      // Escape = the whole circle has crossed the real world boundary
      if (ball.x * ball.x + ball.y * ball.y > probe2 && world.outsideDistance(ball.x, ball.y) > r) {
        ev.onEscape(ball);
        return;
      }
    }

    // keep speed locked to the upgrade-defined value (direction preserved)
    const sp = Math.hypot(ball.vx, ball.vy);
    if (sp > 1e-6 && Math.abs(sp - ev.speed) > ev.speed * 0.002) {
      const k = ev.speed / sp; ball.vx *= k; ball.vy *= k;
    }

    // deterministic nudge if a ball has gone a long time without any hit
    ball.idle += dt;
    if (ball.idle > P.stuckSeconds) {
      const c = Math.cos(0.045), s = Math.sin(0.045);
      const vx = ball.vx * c - ball.vy * s, vy = ball.vx * s + ball.vy * c;
      ball.vx = vx; ball.vy = vy;
      ball.idle = P.stuckSeconds * 0.5;
    }

    if ((ball.trailTick++ & 1) === 0) pushTrail(ball);
  }

  function pushTrail(ball) {
    const L = P.trailLength;
    ball.trailHead = (ball.trailHead + 1) % L;
    ball.trail[ball.trailHead * 2] = ball.x;
    ball.trail[ball.trailHead * 2 + 1] = ball.y;
    if (ball.trailCount < L) ball.trailCount++;
  }

  function makeBall(id, x, y, angle, speed) {
    const b = {
      id, x, y, px: x, py: y,
      vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
      r: P.ballRadius, active: true, idle: 0,
      trail: new Float32Array(P.trailLength * 2), trailHead: 0, trailCount: 0, trailTick: 0
    };
    b.trail[0] = x; b.trail[1] = y; b.trailCount = 1;
    return b;
  }

  // Is a circle completely free of intact triangles?
  function isFree(world, x, y, r) {
    const list = [];
    world.queryCircle(x, y, r + 1, list);
    for (const t of list) if (t.active && circleTri(t, x, y, r, contact)) return false;
    return true;
  }

  // Safe open spot for new balls: scan outward from the centre.
  function findFreeSpot(world, r, salt) {
    const limit = world.inradius - 20;
    for (let rad = 0; rad < limit; rad += 6) {
      const steps = rad === 0 ? 1 : 12;
      for (let k = 0; k < steps; k++) {
        const a = salt * 0.7 + (k / steps) * Math.PI * 2;
        const x = Math.cos(a) * rad, y = Math.sin(a) * rad;
        if (isFree(world, x, y, r + 2)) return { x, y };
      }
    }
    return { x: 0, y: 0 };
  }

  TB.Physics = { circleTri, stepBall, makeBall, isFree, findFreeSpot };
})();
