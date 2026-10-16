/* Little Ocean - world layout, collision, zones, hidden places and deterministic scenery placement.
   The ocean is 6000 x 3300:
      row 0 (surface):  Shallow Reef | Kelp Forest | Open Blue
      row 1 (below):    Hidden Grottos | Deep Sea        (reached from the Open Blue via the Dropoff)
*/
window.LO = window.LO || {};
LO.World = (function () {
  const CFG = LO.CFG, U = LO.U, TAU = Math.PI * 2;
  const W = CFG.world.w, H = CFG.world.h;
  const solids = [], gates = [], places = [], decor = [], vents = [], hideC = [], hideR = [];
  const CS = 200, COLS = Math.ceil(W / CS), ROWS = Math.ceil(H / CS);
  const cells = [];
  for (let i = 0; i < COLS * ROWS; i++) cells.push([]);
  let stamp = 0;
  const noDecor = [];   // x ranges on row 0 occupied by buildings (nooks etc)
  const GAP0 = { x0: 4800, x1: 5100 };   // the Dropoff

  /* ---------- seabed ---------- */
  function floorProfile(x, row) {
    let v = 45 + 30 * Math.sin(x * 0.0031 + row * 1.7) + 22 * Math.sin(x * 0.0097 + 1.3 + row) + 12 * Math.sin(x * 0.021 + row * 3);
    v = U.clamp(v, 6, 110);
    if (row === 0) v *= U.smooth((Math.abs(x - 4950) - 150) / 120);
    return v;
  }
  function floorAt(x, row) { return (row ? CFG.world.floor1 : CFG.world.floor0) - floorProfile(x, row); }
  function rowOf(y) { return y < CFG.world.rowSplit ? 0 : 1; }

  function zoneAt(x, y) {
    if (y < CFG.world.rowSplit) return x < 2000 ? 'reef' : x < 4000 ? 'kelp' : 'blue';
    return x < 3000 ? 'grotto' : 'deep';
  }

  /* ---------- solids ---------- */
  function poly(x, y, w, h, seed) {
    const pts = [], st = 34, a = Math.min(9, Math.min(w, h) * 0.18);
    let k = 0;
    const j = () => (U.hash(seed * 13.7 + (k++) * 1.91) - 0.5) * 2 * a;
    for (let px = x; px < x + w; px += st) pts.push(px, y + j());
    for (let py = y; py < y + h; py += st) pts.push(x + w + j(), py);
    for (let px = x + w; px > x; px -= st) pts.push(px, y + h + j());
    for (let py = y + h; py > y; py -= st) pts.push(x + j(), py);
    return pts;
  }
  function addRect(x, y, w, h, kind, gate) {
    if (w <= 0 || h <= 0) return null;
    const s = { t: 'r', x, y, w, h, kind: kind || 'rock', gate: gate || null, q: 0, poly: null };
    if (kind !== 'gate') s.poly = poly(x, y, w, h, solids.length + 1);
    solids.push(s); return s;
  }
  function addCircle(x, y, r, kind) { const s = { t: 'c', x, y, r, kind: kind || 'rock', q: 0, seed: solids.length * 1.7 }; solids.push(s); return s; }

  function indexSolids() {
    solids.forEach((s) => {
      const x0 = s.t === 'r' ? s.x : s.x - s.r, x1 = s.t === 'r' ? s.x + s.w : s.x + s.r;
      const y0 = s.t === 'r' ? s.y : s.y - s.r, y1 = s.t === 'r' ? s.y + s.h : s.y + s.r;
      const c0 = U.clamp((x0 / CS) | 0, 0, COLS - 1), c1 = U.clamp((x1 / CS) | 0, 0, COLS - 1);
      const r0 = U.clamp((y0 / CS) | 0, 0, ROWS - 1), r1 = U.clamp((y1 / CS) | 0, 0, ROWS - 1);
      for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) cells[r * COLS + c].push(s);
    });
  }

  // Enclosed rocky chamber with one opening. interior = ix,iy,iw,ih
  function makeNook(n) {
    const th = n.th || 44, ix = n.ix, iy = n.iy, iw = n.iw, ih = n.ih, off = n.off || 0;
    const R = (x, y, w, h) => addRect(x, y, w, h, 'rock');
    ['top', 'bottom', 'left', 'right'].forEach((side) => {
      if (side === 'top' || side === 'bottom') {
        const y = side === 'top' ? iy - th : iy + ih, x0 = ix - th, w = iw + 2 * th;
        if (n.side !== side) R(x0, y, w, th);
        else { const c = ix + iw / 2 + off, g0 = c - n.gap / 2, g1 = c + n.gap / 2; R(x0, y, g0 - x0, th); R(g1, y, x0 + w - g1, th); }
      } else {
        const x = side === 'left' ? ix - th : ix + iw;
        if (n.side !== side) R(x, iy, th, ih);
        else { const c = iy + ih / 2 + off, g0 = c - n.gap / 2, g1 = c + n.gap / 2; R(x, iy, th, g0 - iy); R(x, g1, th, iy + ih - g1); }
      }
    });
    hideR.push({ x: ix, y: iy, w: iw, h: ih });
    return n;
  }

  /* ---------- decor ---------- */
  const EXT = { coral_b: 190, coral_fan: 150, coral_dome: 110, coral_tube: 130, anemone: 110, seaweed: 150, kelp: 1, rock: 90, shell: 40, star: 40, urchin: 50, glow: 150, crystal: 160, stalac: 220, bones: 260, anchor: 140, vent: 160, lintel: 220 };
  const rng = U.rng(7741);
  const rr = (a, b) => a + rng() * (b - a);
  const pickc = (arr) => arr[(rng() * arr.length) | 0];
  function put(t, x, y, s, col, extra) {
    const d = { t, x, y, s, col, seed: rng() * 100, layer: 0, ext: (EXT[t] || 150) * s, flip: 1 };
    if (extra) Object.assign(d, extra);
    decor.push(d); return d;
  }
  const blocked = (x) => { for (let i = 0; i < noDecor.length; i++) if (x > noDecor[i][0] && x < noDecor[i][1]) return true; return false; };

  function build() {
    const Z = CFG.zones;
    /* walls between zones, each with one gap */
    addRect(1960, 0, 80, 820, 'wall'); addRect(1960, 1060, 80, 640, 'wall');
    addRect(3960, 0, 80, 700, 'wall'); addRect(3960, 1000, 80, 700, 'wall');
    addRect(0, 1700, 4800, 90, 'wall'); addRect(5100, 1700, 900, 90, 'wall');
    addRect(2960, 1790, 80, 560, 'wall'); addRect(2960, 2650, 80, 650, 'wall');
    CFG.gates.forEach((g) => {
      const o = Object.assign({}, g, { x: g.rect[0], y: g.rect[1], w: g.rect[2], h: g.rect[3], vertical: g.rect[3] >= g.rect[2] });
      o.cx = o.x + o.w / 2; o.cy = o.y + o.h / 2;
      addRect(o.x, o.y, o.w, o.h, 'gate', o);
      gates.push(o);
    });

    /* hidden chambers */
    const nooks = [
      { id: 'pearl_crevice', name: 'Pearl Crevice', zone: 'reef', ix: 700, iy: 1480, iw: 260, ih: 160, side: 'left', gap: 40, desc: 'A snug chamber behind a crack only small fish can squeeze through. Something golden glimmers within.' },
      { id: 'hollow_log_den', name: 'Hollow Log Den', zone: 'kelp', ix: 3050, iy: 1400, iw: 300, ih: 240, side: 'top', gap: 70, off: -40, desc: 'A hollow in the kelp-bed rock, entered from above. Shy leaf-fish rest here.' },
      { id: 'abyssal_vault', name: 'Abyssal Vault', zone: 'deep', ix: 4350, iy: 2450, iw: 760, ih: 520, side: 'left', gap: 300, th: 50, desc: 'A vast stone chamber in the deep. Faint light spills from its mouth.' },
      { id: 'moon_pool', name: 'Moon Pool', zone: 'grotto', ix: 550, iy: 2450, iw: 520, ih: 360, side: 'right', gap: 150, desc: 'A still silver pool deep inside the grottos, lit from within.' },
      { id: 'whisper_nook', name: 'Whisper Nook', zone: 'grotto', ix: 1650, iy: 2950, iw: 280, ih: 200, side: 'top', gap: 150, desc: 'The deepest, quietest corner of the world. A pearl-light shines here.' }
    ];
    nooks.forEach((n) => {
      makeNook(n);
      places.push({ id: n.id, name: n.name, type: 'hidden', zone: n.zone, x: n.ix + n.iw / 2, y: n.iy + n.ih / 2, rect: [n.ix - 14, n.iy - 14, n.iw + 28, n.ih + 28], desc: n.desc });
    });
    noDecor.push([650, 1010], [2990, 3410]);

    // Moonlit Clearing: a ring of stone pillars in the open water
    const cc = { x: 5250, y: 520 };
    for (let i = 0; i < 7; i++) { const a = i / 7 * TAU + 0.3; addCircle(cc.x + Math.cos(a) * 250, cc.y + Math.sin(a) * 250, 56, 'pillar'); }
    places.push({ id: 'moonlit_clearing', name: 'Moonlit Clearing', type: 'hidden', zone: 'blue', x: cc.x, y: cc.y, r: 190, desc: 'A quiet ring of standing stones high in the open blue. Light falls here like a spotlight.' });
    hideC.push({ x: cc.x, y: cc.y, r: 120 });

    // small fish-houses: gaps narrower than the local predators
    [[1250, 'left', 34, 'reef'], [330, 'right', 34, 'reef'], [2300, 'left', 28, 'kelp'], [3700, 'right', 28, 'kelp'], [4130, 'left', 40, 'blue'], [5780, 'right', 40, 'blue']].forEach((s) => {
      makeNook({ ix: s[0], iy: 1540, iw: 130, ih: 100, side: s[1], gap: s[2], th: 36 });
      noDecor.push([s[0] - 50, s[0] + 180]);
    });

    /* landmarks (discoverable places with scenery) */
    const lm = (id, name, zone, x, y, desc) => places.push({ id, name, type: 'landmark', zone, x, y, r: 290, desc });
    lm('coral_spire', 'Coral Spire', 'reef', 1500, 1500, 'A tower of branching coral that rises like a cathedral of candy.');
    lm('anemone_garden', 'Anemone Garden', 'reef', 400, 1580, 'A meadow of waving anemones where little fish play hide-and-seek.');
    lm('kelp_cathedral', 'Kelp Cathedral', 'kelp', 3000, 1300, 'A ring of giant kelp so tall their tops vanish into the green light.');
    lm('sunken_anchor', 'Sunken Anchor', 'kelp', 3650, 1600, 'A great old anchor, long forgotten, wearing a coat of weed.');
    lm('windrose_arch', 'Windrose Arch', 'blue', 4560, 1520, 'A natural stone arch where the current always seems to sing.');
    lm('whale_bones', 'Whale Bones', 'blue', 5450, 1580, 'The ribs of something enormous, resting on the sand.');
    lm('glow_vents', 'Glow Vent Garden', 'deep', 3900, 3180, 'Warm vents breathe bubbles up through glowing sea-flowers.');
    lm('lantern_forest', 'Lantern Forest', 'deep', 5500, 3120, 'Tall stalks hold up lamps of cyan and rose in the dark.');
    lm('crystal_cavern', 'Crystal Cavern', 'grotto', 2300, 3100, 'Crystals as big as whales\' heads glow in every colour.');

    /* ---------- scenery ---------- */
    const REEFC = ['#ff8fa3', '#ffb27a', '#f7d56b', '#c49bff', '#7ee0c8', '#ff6f91'];
    // Shallow Reef
    for (let x = 50; x < 1950; x += rr(34, 60)) {
      if (blocked(x)) continue;
      if (rng() > 0.25 + U.noise(x * 0.0042) * 0.9) continue;
      const r = rng() * 100;
      const t = r < 22 ? 'coral_b' : r < 36 ? 'coral_fan' : r < 50 ? 'coral_dome' : r < 62 ? 'coral_tube' : r < 72 ? 'anemone' : r < 86 ? 'seaweed' : r < 90 ? 'shell' : r < 94 ? 'star' : r < 97 ? 'urchin' : 'rock';
      const col = t === 'seaweed' ? pickc(['#4fb98f', '#2f9d7a', '#7ad39a']) : t === 'rock' ? null : pickc(REEFC);
      put(t, x, floorAt(x, 0) + rr(2, 10), rr(0.7, 1.5), col, { layer: (t === 'seaweed' || t === 'coral_b') && rng() < 0.2 ? 1 : 0 });
    }
    [[1500, 2.7, '#ff8fa3'], [1440, 2.0, '#f7d56b'], [1570, 2.3, '#c49bff'], [1380, 1.5, '#ffb27a'], [1650, 1.6, '#ff6f91']].forEach((c) => put('coral_b', c[0], floorAt(c[0], 0) + 6, c[1], c[2]));
    put('coral_fan', 1340, floorAt(1340, 0) + 6, 1.8, '#ff6f91'); put('coral_fan', 1700, floorAt(1700, 0) + 6, 1.7, '#c49bff');
    for (let x = 230; x < 620; x += rr(28, 48)) if (!blocked(x)) put('anemone', x, floorAt(x, 0) + 6, rr(1.1, 1.8), pickc(['#ff8fa3', '#ffb27a', '#c49bff']));
    hideC.push({ x: 400, y: 1570, r: 140 }, { x: 1500, y: 1560, r: 100 });

    // Kelp Forest
    const KC = ['#4fa860', '#3f9a5a', '#6dbb6a', '#2f8a58'];
    for (let x = 2070; x < 3930; x += rr(40, 80)) {
      if (blocked(x)) continue;
      const r = rng();
      if (r < 0.55) { const h = rr(380, 720); put('kelp', x, floorAt(x, 0) + 8, rr(0.8, 1.3), pickc(KC), { h, ext: h + 80, layer: rng() < 0.25 ? 1 : 0 }); }
      else if (r < 0.8) put('seaweed', x, floorAt(x, 0) + 6, rr(0.9, 1.6), pickc(['#5fbf7a', '#3f9f6a']));
      else if (r < 0.92) put('rock', x, floorAt(x, 0) + 12, rr(0.8, 1.6), null);
      else put('shell', x, floorAt(x, 0) + 4, rr(0.8, 1.2), '#f2d6c0');
    }
    for (let i = 0; i < 9; i++) { const x = 2850 + i * 38 + rr(-8, 8); put('kelp', x, floorAt(x, 0) + 8, rr(1.2, 1.6), pickc(KC), { h: rr(780, 920), ext: 1000, layer: i % 2 }); }
    put('anchor', 3650, floorAt(3650, 0) + 6, 1.4);
    [[2300, 1470], [2650, 1450], [3000, 1450], [3780, 1470]].forEach((h) => {
      hideC.push({ x: h[0], y: h[1], r: 150 });
      for (let k = 0; k < 4; k++) { const x = h[0] + rr(-110, 110); if (!blocked(x)) put('kelp', x, floorAt(x, 0) + 8, rr(1.0, 1.4), pickc(KC), { h: rr(480, 760), ext: 840, layer: k & 1 }); }
    });

    // Open Blue
    for (let x = 4060; x < 5940; x += rr(60, 120)) {
      if (blocked(x) || (x > GAP0.x0 - 40 && x < GAP0.x1 + 40)) continue;
      const r = rng() * 100;
      const t = r < 25 ? 'rock' : r < 55 ? 'seaweed' : r < 70 ? 'shell' : r < 80 ? 'coral_dome' : r < 90 ? 'star' : 'coral_fan';
      const col = t === 'seaweed' ? '#8fd0a0' : t === 'rock' ? null : t === 'shell' ? '#f2e0d0' : pickc(['#b9d7ff', '#e8d7ff', '#9fd0ff']);
      put(t, x, floorAt(x, 0) + rr(2, 10), rr(0.8, 1.5), col);
    }
    { const ay = floorAt(4560, 0);
      addCircle(4440, ay - 45, 54, 'pillar'); addCircle(4680, ay - 45, 54, 'pillar');
      put('lintel', 4560, ay - 100, 1.2, null, { w: 240 });
      put('bones', 5450, floorAt(5450, 0) + 6, 1.7, '#efe6d2'); }

    // Deep Sea
    const GL = ['#7af7ff', '#ff7ae0', '#9affc1'];
    for (let x = 3070; x < 5940; x += rr(40, 80)) {
      const r = rng() * 100, y = floorAt(x, 1) + rr(2, 8);
      const t = r < 38 ? 'glow' : r < 52 ? 'coral_tube' : r < 78 ? 'rock' : r < 90 ? 'anemone' : 'seaweed';
      const col = t === 'glow' ? pickc(GL) : t === 'coral_tube' ? '#5a4a9c' : t === 'anemone' ? '#6a5acd' : t === 'seaweed' ? '#3a4a8f' : null;
      put(t, x, y, rr(0.8, 1.6), col);
    }
    [3800, 3900, 4030].forEach((x) => { put('vent', x, floorAt(x, 1) + 8, rr(1.0, 1.4), '#4a4672'); vents.push({ x: x, y: floorAt(x, 1) - 60 }); });
    for (let i = 0; i < 9; i++) { const x = 5360 + i * 44 + rr(-10, 10); put('glow', x, floorAt(x, 1) + 6, rr(2.0, 3.0), pickc(GL), { tall: true }); }
    for (let x = 3060; x < 5940; x += rr(50, 90)) { if (x > GAP0.x0 - 60 && x < GAP0.x1 + 60) continue; put('stalac', x, 1790, rr(0.8, 1.7), null, { flip: -1 }); }

    // Hidden Grottos
    const CR = ['#7ff0e0', '#ff9ad6', '#b79cff', '#8cffd6'];
    for (let x = 60; x < 2940; x += rr(35, 70)) {
      const r = rng() * 100, y = floorAt(x, 1) + rr(2, 8);
      const t = r < 30 ? 'crystal' : r < 55 ? 'glow' : r < 75 ? 'rock' : r < 85 ? 'anemone' : r < 95 ? 'seaweed' : 'shell';
      const col = t === 'crystal' ? pickc(CR) : t === 'glow' ? pickc(['#8cffc1', '#7ff0e0']) : t === 'anemone' ? '#8cffc1' : t === 'seaweed' ? '#4a8f7a' : t === 'shell' ? '#e0c8f0' : null;
      put(t, x, y, rr(0.8, 1.7), col);
    }
    for (let i = 0; i < 8; i++) { const x = 2180 + i * 34 + rr(-10, 10); put('crystal', x, floorAt(x, 1) + 8, rr(2.2, 3.4), pickc(CR)); }
    for (let x = 60; x < 2940; x += rr(45, 90)) {
      if (rng() < 0.35) put('crystal', x, 1790, rr(0.9, 1.7), pickc(CR), { flip: -1 });
      else put('stalac', x, 1790, rr(0.8, 1.7), null, { flip: -1 });
    }

    indexSolids();
  }

  /* ---------- queries ---------- */
  function solidAt(x, y) {
    const c = (x / CS) | 0, r = (y / CS) | 0;
    if (c < 0 || r < 0 || c >= COLS || r >= ROWS) return true;
    const a = cells[r * COLS + c];
    for (let i = 0; i < a.length; i++) {
      const s = a[i];
      if (s.t === 'r') { if (x > s.x && x < s.x + s.w && y > s.y && y < s.y + s.h) return true; }
      else { const dx = x - s.x, dy = y - s.y; if (dx * dx + dy * dy < s.r * s.r) return true; }
    }
    return y > floorAt(x, rowOf(y)) + 4 && !(rowOf(y) === 0 && x > GAP0.x0 && x < GAP0.x1) || y < 10;
  }

  let lastGate = null;
  // push a circular body out of walls, floor and world edges
  function resolve(e, isPlayer, psize) {
    const r = e.r;
    lastGate = null;
    for (let pass = 0; pass < 2; pass++) {
      const c0 = U.clamp(((e.x - r) / CS) | 0, 0, COLS - 1), c1 = U.clamp(((e.x + r) / CS) | 0, 0, COLS - 1);
      const r0 = U.clamp(((e.y - r) / CS) | 0, 0, ROWS - 1), r1 = U.clamp(((e.y + r) / CS) | 0, 0, ROWS - 1);
      stamp++;
      for (let cy = r0; cy <= r1; cy++) for (let cx = c0; cx <= c1; cx++) {
        const a = cells[cy * COLS + cx];
        for (let i = 0; i < a.length; i++) {
          const s = a[i];
          if (s.q === stamp) continue;
          s.q = stamp;
          if (s.gate && isPlayer && psize >= s.gate.min) continue;
          let nx, ny, pen = 0;
          if (s.t === 'r') {
            const px = e.x < s.x ? s.x : e.x > s.x + s.w ? s.x + s.w : e.x, py = e.y < s.y ? s.y : e.y > s.y + s.h ? s.y + s.h : e.y;
            const dx = e.x - px, dy = e.y - py, d2 = dx * dx + dy * dy;
            if (d2 >= r * r) continue;
            if (d2 > 1e-6) { const d = Math.sqrt(d2); nx = dx / d; ny = dy / d; pen = r - d; }
            else {
              const l = e.x - s.x, rt = s.x + s.w - e.x, t = e.y - s.y, b = s.y + s.h - e.y, m = Math.min(l, rt, t, b);
              if (m === l) { nx = -1; ny = 0; } else if (m === rt) { nx = 1; ny = 0; } else if (m === t) { nx = 0; ny = -1; } else { nx = 0; ny = 1; }
              pen = m + r;
            }
          } else {
            const dx = e.x - s.x, dy = e.y - s.y, rad = s.r + r, d2 = dx * dx + dy * dy;
            if (d2 >= rad * rad) continue;
            const d = Math.sqrt(d2) || 0.001; nx = dx / d; ny = dy / d; pen = rad - d;
          }
          if (s.gate) lastGate = s.gate;
          e.x += nx * pen; e.y += ny * pen;
          const vn = e.vx * nx + e.vy * ny;
          if (vn < 0) { e.vx -= vn * nx; e.vy -= vn * ny; }
        }
      }
    }
    // seabed (not through the Dropoff opening)
    const row = rowOf(e.y);
    if (!(row === 0 && e.x > GAP0.x0 && e.x < GAP0.x1)) {
      const f = floorAt(e.x, row);
      if (e.y + r > f) { e.y = f - r; if (e.vy > 0) e.vy = 0; }
    }
    if (e.y + r > H) { e.y = H - r; if (e.vy > 0) e.vy = 0; }
    const top = r + 26; if (e.y < top) { e.y = top; if (e.vy < 0) e.vy *= -0.2; }
    if (e.x < r + 6) { e.x = r + 6; if (e.vx < 0) e.vx = 0; }
    if (e.x > W - r - 6) { e.x = W - r - 6; if (e.vx > 0) e.vx = 0; }
  }

  function isHidden(x, y) {
    for (let i = 0; i < hideC.length; i++) { const h = hideC[i], dx = x - h.x, dy = y - h.y; if (dx * dx + dy * dy < h.r * h.r) return true; }
    for (let i = 0; i < hideR.length; i++) { const h = hideR[i]; if (x > h.x && x < h.x + h.w && y > h.y && y < h.y + h.h) return true; }
    return false;
  }

  function placeAt(x, y) {
    for (let i = 0; i < places.length; i++) {
      const p = places[i];
      if (p.rect) { if (x > p.rect[0] && x < p.rect[0] + p.rect[2] && y > p.rect[1] && y < p.rect[1] + p.rect[3]) return p; }
      else { const dx = x - p.x, dy = y - p.y; if (dx * dx + dy * dy < p.r * p.r) return p; }
    }
    return null;
  }

  function nearGate(x, y, rad) {
    for (let i = 0; i < gates.length; i++) { const g = gates[i], dx = x - g.cx, dy = y - g.cy; if (dx * dx + dy * dy < rad * rad) return g; }
    return null;
  }

  build();

  return {
    W, H, solids, gates, places, decor, vents, hideC, hideR,
    floorAt, rowOf, zoneAt, solidAt, resolve, isHidden, placeAt, nearGate,
    get lastGate() { return lastGate; },
    placeById: (id) => places.find((p) => p.id === id)
  };
})();
