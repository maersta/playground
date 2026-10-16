/* =========================================================
   terrain.js - heightmap terrain storage, queries and rendering.
   Terrain is a list of columns (COL_W px wide), each with a height,
   a surface type and a biome. Old columns are culled as we move on.
   ========================================================= */
'use strict';

// Surface types. e = bounce multiplier, fric = friction multiplier.
const SURF = { GRASS: 0, STONE: 1, MUD: 2, ICE: 3, SAND: 4, LAVA: 5, PIT: 6 };
const SURF_PROPS = [
  { name: 'grass', e: 1.0, fric: 1.0 },
  { name: 'stone', e: 1.25, fric: 0.8 },
  { name: 'mud', e: 0.35, fric: 4.0 },
  { name: 'ice', e: 0.85, fric: 0.12 },
  { name: 'sand', e: 0.6, fric: 2.0 },
  { name: 'lava', e: 1.0, fric: 1.0 },
  { name: 'pit', e: 0.2, fric: 5.0 }
];

// Biomes change the look of the world as you travel further.
const BIOMES = [
  { name: 'MEADOW', top: '#7cc456', top2: '#4a8c3a', blade: '#b6ec8c', dirt: '#a0643c', dirt2: '#8a5232', deep: '#6b3d2e', speck: '#c48a50',
    sky: ['#3b7dd8', '#5fa8e8', '#8fd0f6', '#c8ecff'], mount: '#8fa8d8', mount2: '#b0c4e8', hill: '#5a9a48', hill2: '#3f7a3a', tree: '#2d5a27', cloud: '#ffffff', sun: '#fff6b0', trees: 'round' },
  { name: 'HILLS', top: '#5aa848', top2: '#2d5a27', blade: '#7cc456', dirt: '#8a5232', dirt2: '#6b3d2e', deep: '#4f2c24', speck: '#a0643c',
    sky: ['#4a6ad0', '#7aa0e8', '#f0c8a0', '#ffe0b0'], mount: '#a08ab8', mount2: '#c8b0d0', hill: '#4a7a3a', hill2: '#2d5a27', tree: '#1f4a24', cloud: '#fff0e0', sun: '#ffe066', trees: 'round' },
  { name: 'CANYON', top: '#e6c27a', top2: '#c49a52', blade: '#f4dca0', dirt: '#c46a3a', dirt2: '#a04a2e', deep: '#7a2f24', speck: '#e08a5a',
    sky: ['#5d275d', '#c4506a', '#f08a50', '#ffd08a'], mount: '#a0505a', mount2: '#c8705a', hill: '#c46a3a', hill2: '#8a3a2a', tree: '#4a8c3a', cloud: '#ffc8a0', sun: '#ffd04a', trees: 'cactus' },
  { name: 'VOLCANO', top: '#6a6a7a', top2: '#4a4458', blade: '#8a8a9a', dirt: '#3b2b32', dirt2: '#2e2028', deep: '#1f161c', speck: '#c4302b',
    sky: ['#120e1a', '#29366f', '#5d275d', '#a8302b'], mount: '#2e2440', mount2: '#5d275d', hill: '#3b2027', hill2: '#2a1820', tree: '#1a1423', cloud: '#6a5a7a', sun: '#f4f4f4', trees: 'dead', stars: true, crescent: true, cap: '#ff7b1a' },
  // ---- World 2: Frozen Peaks ----
  { name: 'TUNDRA', top: '#e8f4ff', top2: '#b8d8ee', blade: '#ffffff', dirt: '#7a8aa0', dirt2: '#5f6e88', deep: '#44506a', speck: '#a8b8d0',
    sky: ['#4a78c0', '#7aa8e0', '#b8d8f0', '#e8f4ff'], mount: '#a8c0e0', mount2: '#e0eefc', hill: '#8aa8c8', hill2: '#6a88a8', tree: '#2d5a4a', cloud: '#ffffff', sun: '#fffbe0', trees: 'pine' },
  { name: 'GLACIER', top: '#c8f0ff', top2: '#8ad0f0', blade: '#ffffff', dirt: '#5a8ab8', dirt2: '#3f6aa0', deep: '#2a4a80', speck: '#9ad8f8',
    sky: ['#1f4a8a', '#3a80c0', '#7ac0e8', '#c8f0ff'], mount: '#7ab0e0', mount2: '#c0e4ff', hill: '#6a9ac8', hill2: '#4a7aa8', tree: '#1f6a6a', cloud: '#e8f8ff', sun: '#e8ffff', trees: 'pine' },
  { name: 'AURORA', top: '#a8c8e8', top2: '#6a88c0', blade: '#e8f8ff', dirt: '#3a4a80', dirt2: '#2a3868', deep: '#1a2450', speck: '#7a98d8',
    sky: ['#0a0e28', '#142a5a', '#1a6a6a', '#40c890'], mount: '#1a2a5a', mount2: '#3a5a9a', hill: '#243a70', hill2: '#1a2a58', tree: '#1a4a5a', cloud: '#2a4a7a', sun: '#e8ffe8', trees: 'pine', stars: true, crescent: true, cap: '#a8ffe0' },
  // ---- World 3: Dune Sea ----
  { name: 'DUNES', top: '#f0d890', top2: '#d8b868', blade: '#fff0b8', dirt: '#d89850', dirt2: '#b87838', deep: '#8a5428', speck: '#f0b868',
    sky: ['#2a7ad0', '#68b0e8', '#f8d890', '#ffe8b0'], mount: '#d8a870', mount2: '#f0c890', hill: '#d8b068', hill2: '#b88848', tree: '#4a8c3a', cloud: '#fff4e0', sun: '#fff0a0', trees: 'cactus' },
  { name: 'OASIS', top: '#68c860', top2: '#3a9a48', blade: '#a8f080', dirt: '#d8a860', dirt2: '#b88848', deep: '#8a6030', speck: '#f0d088',
    sky: ['#18a0d8', '#50c8f0', '#a0e8f8', '#e0fff0'], mount: '#d8b880', mount2: '#f0d8a0', hill: '#58b858', hill2: '#388838', tree: '#2a8a3a', cloud: '#ffffff', sun: '#fffbc0', trees: 'palm' },
  { name: 'RUINS', top: '#d8a868', top2: '#a87840', blade: '#f0c888', dirt: '#a05838', dirt2: '#803c28', deep: '#5a2820', speck: '#c87848',
    sky: ['#3a1a5a', '#a03868', '#f07848', '#ffc068'], mount: '#803858', mount2: '#b85868', hill: '#a85838', hill2: '#7a3a28', tree: '#3a7a38', cloud: '#ffb890', sun: '#ffd84a', trees: 'cactus' },
  // ---- World 4: Candy Kingdom ----
  { name: 'SUGAR HILLS', top: '#ff9ccc', top2: '#e870a8', blade: '#ffd0e8', dirt: '#b87850', dirt2: '#8a5638', deep: '#603828', speck: '#ffe0a0',
    sky: ['#7a5ad8', '#b890f0', '#f8b8e8', '#ffe8f8'], mount: '#d8a0e8', mount2: '#f0c8f8', hill: '#f090c0', hill2: '#d070a0', tree: '#58c8a0', cloud: '#fff0fa', sun: '#fff8b0', trees: 'lolly' },
  { name: 'CHOCO RIVER', top: '#9a6a48', top2: '#7a4a30', blade: '#c89870', dirt: '#5a3420', dirt2: '#43261a', deep: '#2e1a12', speck: '#e8c898',
    sky: ['#4a2a6a', '#a05a98', '#f09aa8', '#ffd8c0'], mount: '#8a5a6a', mount2: '#b88a90', hill: '#7a4a3a', hill2: '#5a3228', tree: '#e85a98', cloud: '#ffe0e8', sun: '#fff0c0', trees: 'lolly' },
  { name: 'GUMDROP SKY', top: '#a0f0d8', top2: '#60d0b0', blade: '#e0fff4', dirt: '#4a98c8', dirt2: '#3a78a8', deep: '#285888', speck: '#fff0a0',
    sky: ['#2a4ab8', '#6a80e8', '#a8b8ff', '#f8c8ff'], mount: '#7a90e0', mount2: '#b0c0ff', hill: '#58c8c8', hill2: '#38a0a8', tree: '#f0689a', cloud: '#fff0ff', sun: '#fff8c0', trees: 'lolly' },
  // ---- World 5: Moon Base ----
  { name: 'CRATERS', top: '#a8a8b8', top2: '#80809a', blade: '#d0d0e0', dirt: '#68687e', dirt2: '#505066', deep: '#383848', speck: '#9898b0',
    sky: ['#05050f', '#0a0a22', '#10102e', '#1a1a40'], mount: '#30304a', mount2: '#58587a', hill: '#444460', hill2: '#33334c', tree: '#444460', cloud: '#10102e', sun: '#78b8f0', trees: 'none', stars: true, noClouds: true, cap: '#d0d0e0' },
  { name: 'STATION', top: '#8898b8', top2: '#5868a0', blade: '#b8c8e8', dirt: '#3a4468', dirt2: '#2a3254', deep: '#1a203c', speck: '#60e8f0',
    sky: ['#080c20', '#101a3a', '#182860', '#203a80'], mount: '#202a58', mount2: '#3a4a88', hill: '#2a3868', hill2: '#1e2850', tree: '#60e8f0', cloud: '#182860', sun: '#a8e0ff', trees: 'antenna', stars: true, noClouds: true, cap: '#60e8f0' },
  { name: 'DEEP SPACE', top: '#b080e8', top2: '#7a50c0', blade: '#e0c0ff', dirt: '#40286a', dirt2: '#2e1c50', deep: '#1c1238', speck: '#ff90e0',
    sky: ['#05020f', '#1a0a3a', '#3a1a6a', '#6a2a8a'], mount: '#2a1a5a', mount2: '#5a3a9a', hill: '#3a2a6a', hill2: '#281c50', tree: '#ff90e0', cloud: '#3a1a6a', sun: '#ffb0f0', trees: 'none', stars: true, noClouds: true, crescent: true, cap: '#ff90e0' },
];

/** Biome index for a distance, using the given world's biome steps. */
function biomeForMeters(m, world) {
  const w = world || WORLDS[0];
  if (m >= 3000 && w.cycle) return w.cycle[Math.floor(m / 1000) % w.cycle.length];
  let b = w.bio[0][1];
  for (const step of w.bio) if (m >= step[0]) b = step[1];
  return b;
}

class Terrain {
  constructor() {
    this.reset();
    this._n = { x: 0, y: -1 };
  }
  reset() {
    this.base = 0;      // world column index of hs[0]
    this.hs = [];       // heights (world y of surface)
    this.ts = [];       // surface type
    this.bs = [];       // biome index
    this.startCol = 0;
  }
  setStart(x) { this.base = Math.floor(x / COL_W); }
  get endX() { return (this.base + this.hs.length) * COL_W; }

  push(h, type = SURF.GRASS, biome = 0) {
    this.hs.push(h); this.ts.push(type); this.bs.push(biome);
  }

  /** Interpolated surface height at world x. */
  heightAt(x) {
    const f = x / COL_W - this.base;
    const n = this.hs.length;
    if (n === 0) return START_GROUND_Y;
    if (f <= 0) return this.hs[0];
    const i = Math.floor(f);
    if (i >= n - 1) return this.hs[n - 1];
    return lerp(this.hs[i], this.hs[i + 1], f - i);
  }

  typeAt(x) {
    const i = clamp(Math.round(x / COL_W - this.base), 0, this.ts.length - 1);
    return this.ts[i];
  }
  biomeAt(x) {
    const i = clamp(Math.round(x / COL_W - this.base), 0, this.bs.length - 1);
    return this.bs[i] || 0;
  }

  /** Surface normal (pointing up/out of the ground). Reuses one object. */
  normalAt(x) {
    const s = (this.heightAt(x + 2) - this.heightAt(x - 2)) / 4; // dy/dx slope
    const len = Math.sqrt(s * s + 1);
    this._n.x = s / len; this._n.y = -1 / len;
    return this._n;
  }
  slopeAt(x) { return (this.heightAt(x + 3) - this.heightAt(x - 3)) / 6; }

  /** Drop columns far behind the camera to keep memory flat. */
  cull(minX) {
    const n = Math.floor(minX / COL_W) - this.base;
    if (n > 128) {
      this.hs.splice(0, n); this.ts.splice(0, n); this.bs.splice(0, n);
      this.base += n;
    }
  }

  /* ---------------- Rendering ---------------- */
  draw(ctx, camX, camY, W, H, time) {
    for (let sx = 0; sx < W; sx++) {
      const wx = sx + camX;
      const h = this.heightAt(wx);
      let top = Math.round(h - camY);
      const type = this.typeAt(wx);
      const B = BIOMES[this.biomeAt(wx)];
      const wxi = Math.floor(wx);

      if (type === SURF.PIT) {
        // dark shaft with spikes at the bottom
        const shaftTop = Math.max(0, top - 70);
        if (shaftTop < H) {
          ctx.fillStyle = PAL.ink; ctx.fillRect(sx, shaftTop, 1, H - shaftTop);
          ctx.fillStyle = '#2a1e36'; ctx.fillRect(sx, shaftTop, 1, Math.min(14, top - shaftTop));
          const sp = 4 - Math.abs((wxi % 8) - 4);
          ctx.fillStyle = PAL.grey; ctx.fillRect(sx, top - sp - 1, 1, sp + 1);
          if (sp === 4) { ctx.fillStyle = PAL.white; ctx.fillRect(sx, top - 5, 1, 1); }
        }
        continue;
      }
      if (top >= H) continue;

      if (type === SURF.LAVA) {
        const wave = Math.round(Math.sin(wx * 0.15 + time * 3) * 1.2);
        const lt = top + wave;
        ctx.fillStyle = '#a8301b'; ctx.fillRect(sx, lt, 1, H - lt);
        ctx.fillStyle = PAL.lava; ctx.fillRect(sx, lt, 1, 6);
        ctx.fillStyle = PAL.lava2; ctx.fillRect(sx, lt, 1, 2);
        if (hash2(wxi, Math.floor(time * 4)) < 0.03) { ctx.fillStyle = PAL.lava2; ctx.fillRect(sx, lt + 3, 1, 1); }
        continue;
      }

      let c1, c2, d1, d2, d3;
      switch (type) {
        case SURF.STONE: c1 = PAL.ltstone; c2 = PAL.stone; d1 = PAL.stone; d2 = PAL.dkstone; d3 = '#3a3446'; break;
        case SURF.MUD: c1 = PAL.mud2; c2 = PAL.mud; d1 = PAL.mud; d2 = '#4a2e1c'; d3 = '#3a2416'; break;
        case SURF.ICE: c1 = PAL.white; c2 = PAL.ice; d1 = PAL.ice2; d2 = '#5aa0c8'; d3 = '#3a78a8'; break;
        case SURF.SAND: c1 = PAL.sand; c2 = PAL.sand2; d1 = '#d4aa62'; d2 = PAL.sand2; d3 = '#a07a3a'; break;
        default: c1 = B.top; c2 = B.top2; d1 = B.dirt; d2 = B.dirt2; d3 = B.deep;
      }
      // dirt body, layered deeper colors
      ctx.fillStyle = d1; ctx.fillRect(sx, top, 1, H - top);
      const layer = top + 14 + Math.floor(hash1(Math.floor(wxi / 6)) * 4);
      if (layer < H) { ctx.fillStyle = d2; ctx.fillRect(sx, layer, 1, H - layer); }
      const layer2 = top + 38 + Math.floor(hash1(Math.floor(wxi / 9) + 77) * 6);
      if (layer2 < H) { ctx.fillStyle = d3; ctx.fillRect(sx, layer2, 1, H - layer2); }
      // specks / pebbles
      for (let k = 0; k < 3; k++) {
        if (hash2(wxi, k) < 0.12) {
          const py = top + 7 + Math.floor(hash2(wxi, k + 11) * 50);
          if (py < H) { ctx.fillStyle = type === SURF.GRASS ? B.speck : d2; ctx.fillRect(sx, py, 1, 1); }
        }
      }
      // surface band
      ctx.fillStyle = c1; ctx.fillRect(sx, top, 1, 3);
      ctx.fillStyle = c2; ctx.fillRect(sx, top + 3, 1, 2);
      if (hash1(wxi * 3) < 0.25) { ctx.fillStyle = c2; ctx.fillRect(sx, top + 5, 1, 1); }

      // surface details
      if (type === SURF.GRASS) {
        const r = hash1(wxi);
        if (r < 0.32) { ctx.fillStyle = B.blade; ctx.fillRect(sx, top - 1, 1, 1); }
        if (r < 0.08) { ctx.fillStyle = B.top; ctx.fillRect(sx, top - 2, 1, 1); }
        if (B.name === 'MEADOW' && hash1(wxi + 999) < 0.015) {
          ctx.fillStyle = hash1(wxi + 5) < 0.5 ? PAL.white : PAL.pink;
          ctx.fillRect(sx, top - 3, 1, 1);
        }
      } else if (type === SURF.ICE) {
        if (hash1(wxi + Math.floor(time * 2)) < 0.02) { ctx.fillStyle = PAL.white; ctx.fillRect(sx, top + 1, 1, 1); }
      } else if (type === SURF.MUD) {
        if (hash1(wxi) < 0.1) { ctx.fillStyle = '#9a7a5a'; ctx.fillRect(sx, top, 1, 1); }
      } else if (type === SURF.STONE) {
        if (wxi % 12 === 0) { ctx.fillStyle = d2; ctx.fillRect(sx, top + 1, 1, 12); }
      }
    }
  }
}
