/* ============================================================
   WORLD GENERATION
   A hexagon of equilateral triangles on a triangular lattice.
   Lattice vertex (i,j) sits at ((i + j/2) * side, j * h).
   Two triangles per lattice cell:
     A(i,j) = (i,j) (i+1,j) (i,j+1)
     B(i,j) = (i+1,j) (i+1,j+1) (i,j+1)
   Hex distance of a lattice vertex = max(|i|, |j|, |i+j|).
   A triangle belongs to the world when every vertex is within
   `rings` of the origin and it is not part of the central pocket.
   ============================================================ */
(function () {
  'use strict';
  const TB = (window.TB = window.TB || {});
  const SQRT3 = Math.sqrt(3);

  const hexDist = (i, j) => Math.max(Math.abs(i), Math.abs(j), Math.abs(i + j));

  class World {
    constructor(params, seed) {
      const W = TB.CONFIG.world;
      params = params || {};
      this.params = {
        rings: params.rings || W.rings,
        side: params.side || W.side,
        pocketRings: params.pocketRings != null ? params.pocketRings : W.pocketRings
      };
      this.seed = seed >>> 0;
      this.N = this.params.rings;
      this.side = this.params.side;
      this.h = this.side * SQRT3 / 2;
      this.inradius = this.N * this.h;          // distance from centre to the flat hex edges
      this.radius = this.N * this.side;         // distance from centre to the hex corners
      this.tris = [];
      this.destroyedCount = 0;
      this.stamp = 0;
      this._buildBoundary();
      this._buildTriangles();
      this._buildGrid();
    }

    get total() { return this.tris.length; }
    destroyedPercent() { return this.tris.length ? (this.destroyedCount / this.tris.length) * 100 : 0; }

    // ---- outer boundary (the line a ball must fully cross to escape) ----
    _buildBoundary() {
      const N = this.N, s = this.side, h = this.h;
      const pts = [[N * s, 0], [N * s / 2, N * h], [-N * s / 2, N * h], [-N * s, 0], [-N * s / 2, -N * h], [N * s / 2, -N * h]];
      this.hex = [];
      for (let k = 0; k < 6; k++) {
        const a = pts[k], b = pts[(k + 1) % 6];
        const ex = b[0] - a[0], ey = b[1] - a[1], len = Math.hypot(ex, ey);
        let nx = ey / len, ny = -ex / len;
        const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2;
        if (nx * mx + ny * my < 0) { nx = -nx; ny = -ny; }
        this.hex.push({ x: a[0], y: a[1], x2: b[0], y2: b[1], nx, ny });
      }
    }

    // Signed distance from the world hexagon: negative inside, positive outside (exact).
    outsideDistance(x, y) {
      let m = -Infinity;
      const hx = this.hex;
      for (let k = 0; k < 6; k++) {
        const e = hx[k];
        const d = (x - e.x) * e.nx + (y - e.y) * e.ny;
        if (d > m) m = d;
      }
      if (m <= 0) return m;
      let best = Infinity;
      for (let k = 0; k < 6; k++) {
        const e = hx[k];
        const ex = e.x2 - e.x, ey = e.y2 - e.y;
        let t = ((x - e.x) * ex + (y - e.y) * ey) / (ex * ex + ey * ey);
        t = t < 0 ? 0 : t > 1 ? 1 : t;
        const dx = x - (e.x + t * ex), dy = y - (e.y + t * ey);
        const d2 = dx * dx + dy * dy;
        if (d2 < best) best = d2;
      }
      return Math.sqrt(best);
    }

    // ---- triangles ----
    _buildTriangles() {
      const N = this.N, s = this.side, h = this.h, P = this.params.pocketRings;
      const C = TB.CONFIG;
      const rng = TB.util.mulberry32(this.seed);
      const inr = s * SQRT3 / 6;
      const k = 1 - C.world.drawInset / inr;

      for (let j = -N - 1; j <= N; j++) {
        for (let i = -N - 1; i <= N; i++) {
          const cells = [
            [[i, j], [i + 1, j], [i, j + 1]],
            [[i + 1, j], [i + 1, j + 1], [i, j + 1]]
          ];
          for (let c = 0; c < 2; c++) {
            const v = cells[c];
            const md = Math.max(hexDist(v[0][0], v[0][1]), hexDist(v[1][0], v[1][1]), hexDist(v[2][0], v[2][1]));
            if (md > N || md <= P) continue;
            this._addTriangle(v, rng, s, h, k);
          }
        }
      }
    }

    _addTriangle(v, rng, s, h, shrink) {
      const C = TB.CONFIG, N = this.N, P = this.params.pocketRings;
      const X = (p) => (p[0] + p[1] / 2) * s, Y = (p) => p[1] * h;
      const x0 = X(v[0]), y0 = Y(v[0]), x1 = X(v[1]), y1 = Y(v[1]), x2 = X(v[2]), y2 = Y(v[2]);
      const cx = (x0 + x1 + x2) / 3, cy = (y0 + y1 + y2) / 3;

      // Normalised radial distance of the centroid (0 at pocket edge, 1 at world rim)
      const jc = cy / h, ic = cx / s - jc / 2;
      const dist = Math.max(Math.abs(ic), Math.abs(jc), Math.abs(ic + jc));
      const t = TB.util.clamp((dist - P) / (N - P), 0, 1);

      // Pick HP tier deterministically from the world seed
      const tj = TB.util.clamp(t + (rng() - 0.5) * 0.3, 0, 1);
      const w = C.tierWeights(tj);
      let sum = 0; for (let q = 0; q < w.length; q++) sum += w[q];
      let roll = rng() * sum, tier = 0;
      for (let q = 0; q < w.length; q++) { roll -= w[q]; if (roll <= 0) { tier = q; break; } }

      const tri = {
        id: this.tris.length,
        x0, y0, x1, y1, x2, y2, cx, cy,
        rad: s / SQRT3 + 0.01,                   // circumradius, used for quick rejection
        tier, t,
        maxHp: C.tiers[tier].hp, hp: C.tiers[tier].hp,
        active: true,
        flash: 0,
        stamp: 0,
        cells: null,
        d: new Float32Array([
          cx + (x0 - cx) * shrink, cy + (y0 - cy) * shrink,
          cx + (x1 - cx) * shrink, cy + (y1 - cy) * shrink,
          cx + (x2 - cx) * shrink, cy + (y2 - cy) * shrink
        ])
      };
      // Outward unit normals of the three edges (v0v1, v1v2, v2v0)
      const E = [[x0, y0, x1, y1], [x1, y1, x2, y2], [x2, y2, x0, y0]];
      for (let e = 0; e < 3; e++) {
        const a = E[e];
        const ex = a[2] - a[0], ey = a[3] - a[1], len = Math.hypot(ex, ey);
        let nx = ey / len, ny = -ex / len;
        if (nx * (cx - a[0]) + ny * (cy - a[1]) > 0) { nx = -nx; ny = -ny; }
        tri['nx' + e] = nx; tri['ny' + e] = ny;
      }
      this.tris.push(tri);
    }

    // ---- uniform grid spatial index (only active triangles are stored) ----
    _buildGrid() {
      this.cs = this.side;
      this.ext = this.radius + this.side;
      this.gw = Math.ceil((2 * this.ext) / this.cs) + 1;
      this.cells = new Array(this.gw * this.gw);
      for (let i = 0; i < this.cells.length; i++) this.cells[i] = [];
      for (const t of this.tris) {
        const minx = Math.min(t.x0, t.x1, t.x2), maxx = Math.max(t.x0, t.x1, t.x2);
        const miny = Math.min(t.y0, t.y1, t.y2), maxy = Math.max(t.y0, t.y1, t.y2);
        const gx0 = this._cx(minx), gx1 = this._cx(maxx), gy0 = this._cx(miny), gy1 = this._cx(maxy);
        t.cells = [];
        for (let gy = gy0; gy <= gy1; gy++) {
          for (let gx = gx0; gx <= gx1; gx++) {
            const idx = gy * this.gw + gx;
            this.cells[idx].push(t);
            t.cells.push(idx);
          }
        }
      }
    }

    _cx(v) { return TB.util.clamp(Math.floor((v + this.ext) / this.cs), 0, this.gw - 1); }

    // Collect active triangles whose grid cells touch the circle's bounding box.
    queryCircle(x, y, r, out) {
      out.length = 0;
      const stamp = ++this.stamp;
      const gx0 = this._cx(x - r), gx1 = this._cx(x + r), gy0 = this._cx(y - r), gy1 = this._cx(y + r);
      for (let gy = gy0; gy <= gy1; gy++) {
        for (let gx = gx0; gx <= gx1; gx++) {
          const cell = this.cells[gy * this.gw + gx];
          for (let i = 0; i < cell.length; i++) {
            const t = cell[i];
            if (t.stamp !== stamp) { t.stamp = stamp; out.push(t); }
          }
        }
      }
      return out;
    }

    // Permanently remove a triangle from the run (and from collision lookups).
    destroy(tri) {
      if (!tri.active) return false;
      tri.active = false;
      tri.hp = 0;
      for (let i = 0; i < tri.cells.length; i++) {
        const arr = this.cells[tri.cells[i]];
        const idx = arr.indexOf(tri);
        if (idx >= 0) { arr[idx] = arr[arr.length - 1]; arr.pop(); }
      }
      this.destroyedCount++;
      return true;
    }

    // Direction for the very first ball: toward the nearest surrounding triangle.
    startVector() {
      let best = null, bd = Infinity;
      for (const t of this.tris) {
        if (!t.active) continue;
        const d = t.cx * t.cx + t.cy * t.cy;
        if (d < bd - 1e-6) { bd = d; best = t; }
      }
      const base = best ? Math.atan2(best.cy, best.cx) : 0.5;
      return { angle: base + 0.21 };
    }

    // ---- compact persistence helpers ----
    encodeDestroyed() {
      const n = this.tris.length;
      const bytes = new Uint8Array(Math.ceil(n / 8));
      for (let i = 0; i < n; i++) if (!this.tris[i].active) bytes[i >> 3] |= 1 << (i & 7);
      let s = '';
      for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
      return btoa(s);
    }

    applyDestroyed(b64) {
      let s = '';
      try { s = atob(b64 || ''); } catch (e) { return; }
      const n = Math.min(this.tris.length, s.length * 8);
      for (let i = 0; i < n; i++) {
        if (s.charCodeAt(i >> 3) & (1 << (i & 7))) this.destroy(this.tris[i]);
      }
    }

    damagedList() {
      const out = [];
      for (const t of this.tris) if (t.active && t.hp < t.maxHp) out.push([t.id, t.hp]);
      return out;
    }

    applyDamaged(list) {
      if (!Array.isArray(list)) return;
      for (const e of list) {
        if (!Array.isArray(e)) continue;
        const t = this.tris[e[0] | 0];
        const hp = e[1];
        if (t && t.active && typeof hp === 'number' && hp > 0 && hp <= t.maxHp) t.hp = hp;
      }
    }
  }

  TB.World = World;
})();
