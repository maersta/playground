/* Little Ocean - fish ecosystem: spatial grid, steering AI (wander / school / flee / hunt), spawning and drawing. */
window.LO = window.LO || {};
LO.Fishes = (function () {
  const CFG = LO.CFG, U = LO.U, World = LO.World, TAU = Math.PI * 2;
  const SP = LO.SPECIES, ratio = CFG.eat.ratio;
  const list = [];
  const CS = 180, COLS = Math.ceil(CFG.world.w / CS) + 1, ROWS = Math.ceil(CFG.world.h / CS) + 1;
  const cells = [], used = [], QB = [], QB2 = [];
  for (let i = 0; i < COLS * ROWS; i++) cells.push([]);
  let focusX = 0, focusY = 0, spawnT = 0;
  const P = () => LO.Player;

  /* ---------- spatial grid ---------- */
  function gClear() { for (let i = 0; i < used.length; i++) used[i].length = 0; used.length = 0; }
  function gAdd(f) {
    const c = Math.min(COLS - 1, Math.max(0, (f.x / CS) | 0)), r = Math.min(ROWS - 1, Math.max(0, (f.y / CS) | 0));
    const a = cells[r * COLS + c];
    if (a.length === 0) used.push(a);
    a.push(f);
  }
  function gQuery(out, x, y, rad) {
    out.length = 0;
    const c0 = Math.max(0, ((x - rad) / CS) | 0), c1 = Math.min(COLS - 1, ((x + rad) / CS) | 0);
    const r0 = Math.max(0, ((y - rad) / CS) | 0), r1 = Math.min(ROWS - 1, ((y + rad) / CS) | 0);
    for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) {
      const a = cells[r * COLS + c];
      for (let i = 0; i < a.length; i++) out.push(a[i]);
    }
    return out;
  }

  /* ---------- the fish ---------- */
  class Fish {
    constructor(sp, x, y, o) {
      o = o || {};
      this.sp = sp;
      this.size = sp.size * (sp.legend ? 1 : U.rand(0.72, 1.32));
      this.sizeMul = 1; this.updateR();
      this.x = x; this.y = y; this.homeX = x; this.homeY = y;
      this.leash = o.leash || (sp.hunter ? 850 : sp.school ? 700 : 520);
      this.zone = sp.zone; this.zr = CFG.zones[sp.zone].rect;
      this.ang = Math.random() * TAU;
      this.vx = Math.cos(this.ang) * sp.speed * 0.3; this.vy = Math.sin(this.ang) * sp.speed * 0.3;
      this.phase = Math.random() * TAU; this.flip = Math.cos(this.ang) < 0 ? -1 : 1; this.sw = 0.5; this.face = 1;
      this.wanderAng = this.ang; this.wanderT = Math.random() * 2;
      this.dead = false; this.active = true; this.seed = Math.random() * 100;
      this.senseT = Math.random() * 0.2; this.turnSign = Math.random() < 0.5 ? 1 : -1;
      this.threat = null; this.target = null; this.schN = 0; this.schX = 0; this.schY = 0; this.schAx = 0; this.schAy = 0; this.schSx = 0; this.schSy = 0;
      this.sated = 0; this.chaseCool = Math.random() * 2; this.alertT = 0; this.chaseT = 0; this.chaseMax = 9; this.stun = 0; this.eatT = 0; this.sparkT = Math.random();
      this.accel = sp.speed * (sp.hunter ? 2.0 : 3.0) + 30;
      this.age = 0; this.bobSeed = Math.random() * 10;
    }
    updateR() {
      this.sz = this.size * this.sizeMul;
      this.r = this.sz * 0.62 * U.clamp(this.sp.shape.hgt / 0.3, 0.8, 1.2);
    }

    sense() {
      const sp = this.sp, pl = P(), myz = this.sz;
      const fearR = (sp.behavior === 'nervous' ? 340 : 260) + myz * 1.5;
      const rad = Math.max(sp.hunter ? sp.detect * 1.1 : 0, fearR * 1.15, 200);
      gQuery(QB, this.x, this.y, rad);
      let threat = null, threatD = 1e12, prey = null, preyD = 1e12;
      let cx = 0, cy = 0, ax = 0, ay = 0, sx = 0, sy = 0, n = 0;
      const school = sp.school, detect2 = sp.detect * sp.detect;
      for (let i = 0; i < QB.length; i++) {
        const f = QB[i];
        if (f === this || f.dead) continue;
        const dx = f.x - this.x, dy = f.y - this.y, d2 = dx * dx + dy * dy;
        if (school && f.sp === sp && d2 < 28900) {
          cx += f.x; cy += f.y; ax += f.vx; ay += f.vy; n++;
          if (d2 < 1156 && d2 > 1) { const d = Math.sqrt(d2), k = (34 - d) / 34; sx -= dx / d * k; sy -= dy / d * k; }
        }
        if (sp.legend) continue;
        if (f.sp.hunter && f.sated <= 0 && f.stun <= 0 && f.sz >= myz * (f.sp.biteRatio || ratio) && d2 < fearR * fearR && d2 < threatD) { threat = f; threatD = d2; }
        if (sp.hunter && !f.sp.legend && f.sp !== sp && myz >= f.sz * ratio && d2 < preyD && d2 < detect2) { prey = f; preyD = d2; }
      }
      if (!sp.legend && pl && pl.alive) {
        const dx = pl.x - this.x, dy = pl.y - this.y, d2 = dx * dx + dy * dy;
        const pr = pl.size >= myz * (sp.eatRatio || ratio), fr = fearR * (pl.bursting ? 1.25 : 1);
        if (pr && d2 < fr * fr && d2 < threatD) { threat = pl; threatD = d2; }
        if (sp.hunter && !pr && !pl.invuln && myz >= pl.size * ((sp.biteRatio || ratio) + pl.stats.ratioMod)) {
          const eff = sp.detect * pl.stats.stealth * (pl.hidden ? 0.25 : 1) * (pl.bursting ? 1.25 : 1);
          if (d2 < eff * eff && d2 < preyD) { prey = pl; preyD = d2; }
        }
      }
      this.threat = threat;
      if (n > 0) { this.schN = n; this.schX = cx / n; this.schY = cy / n; this.schAx = ax / n; this.schAy = ay / n; this.schSx = sx; this.schSy = sy; } else this.schN = 0;

      if (sp.hunter) {
        if (this.target) {
          const t = this.target, dx = t.x - this.x, dy = t.y - this.y;
          const gone = t.dead || (t === pl && (!pl.alive || pl.invuln > 0));
          if (gone || dx * dx + dy * dy > sp.detect * sp.detect * CFG.ai.giveUp * CFG.ai.giveUp || this.chaseT > this.chaseMax) {
            this.target = null; this.chaseCool = sp.behavior === 'ambush' ? 5 : 3.5;
          }
        }
        if (!this.target && prey && this.sated <= 0 && this.chaseCool <= 0 && this.stun <= 0) {
          this.target = prey; this.chaseT = 0;
          this.alertT = prey === pl ? sp.alert : 0.15;
          this.chaseMax = sp.behavior === 'ambush' ? 2.2 : 9;
        }
      }
    }

    update(dt) {
      const sp = this.sp, pl = P();
      this.age += dt;
      if (this.sated > 0) this.sated -= dt;
      if (this.chaseCool > 0) this.chaseCool -= dt;
      if (this.stun > 0) this.stun -= dt;
      if (this.eatT > 0) this.eatT -= dt;
      this.senseT -= dt;
      if (this.senseT <= 0) { this.sense(); this.senseT = CFG.ai.senseInterval * (0.8 + Math.random() * 0.5); }
      if (this.target) { this.chaseT += dt; if (this.alertT > 0) this.alertT -= dt; }

      // ----- desired direction & speed -----
      let dx = 0, dy = 0, spd = 0;
      this.wanderT -= dt;
      if (this.wanderT <= 0) {
        this.wanderAng += U.rand(-1.1, 1.1); this.wanderT = U.rand(1.5, 3.5);
        if (Math.random() < 0.3) this.turnSign = -this.turnSign;
      }
      const cruise = sp.speed * (sp.behavior === 'ambush' ? 0.18 : sp.behavior === 'legend' ? 1 : 0.55);

      if (this.stun > 0) { spd = 0; }
      else if (this.threat && !sp.legend && !this.threat.dead) {
        const t = this.threat;
        let ax = this.x - t.x, ay = this.y - t.y; const d = Math.hypot(ax, ay) || 1;
        dx = ax / d; dy = ay / d;
        if (this.schN > 0) { dx += (this.schAx / (sp.speed || 1)) * 0.5; dy += (this.schAy / (sp.speed || 1)) * 0.5; }
        spd = sp.speed * (sp.behavior === 'nervous' ? CFG.ai.nervousFleeMul : CFG.ai.fleeMul);
        this.wanderAng = Math.atan2(dy, dx);
      } else if (this.target) {
        const t = this.target;
        const ax = t.x + (t.vx || 0) * 0.3 - this.x, ay = t.y + (t.vy || 0) * 0.3 - this.y, d = Math.hypot(ax, ay) || 1;
        dx = ax / d; dy = ay / d;
        spd = sp.speed * sp.chase * (t === pl ? 1 - pl.stats.predSlow : 1);
        if (this.alertT > 0) spd *= 0.2;
        this.wanderAng = Math.atan2(dy, dx);
      } else {
        // wander + school + keep to home / zone
        dx = Math.cos(this.wanderAng); dy = Math.sin(this.wanderAng);
        if (this.schN > 0) {
          const cdx = this.schX - this.x, cdy = this.schY - this.y, dc = Math.hypot(cdx, cdy) || 1, k = Math.min(1, dc / 90);
          dx += cdx / dc * 0.8 * k + this.schAx / sp.speed * 0.7 + this.schSx * 1.6;
          dy += cdy / dc * 0.8 * k + this.schAy / sp.speed * 0.7 + this.schSy * 1.6;
        }
        const hx = this.homeX - this.x, hy = this.homeY - this.y, hd = Math.hypot(hx, hy);
        if (hd > this.leash * 0.6) { const k = Math.min(2, (hd - this.leash * 0.6) / (this.leash * 0.4)) * 1.4; dx += hx / hd * k; dy += hy / hd * k; }
        spd = cruise;
        if (sp.behavior === 'nervous') spd = sp.speed * (0.25 + 1.0 * Math.max(0, Math.sin(this.age * 2.7 + this.seed)));
        if (sp.behavior === 'legend') spd = sp.speed;
      }
      // zone walls, surface and floor
      {
        const z = this.zr, m = 140;
        let bx = 0, by = 0;
        if (this.x < z[0] + m) bx += (z[0] + m - this.x) / m; else if (this.x > z[0] + z[2] - m) bx -= (this.x - (z[0] + z[2] - m)) / m;
        if (this.y < z[1] + 110) by += (z[1] + 110 - this.y) / 110;
        const fl = World.floorAt(this.x, World.rowOf(this.y)) - 100;
        if (this.y > fl) by -= (this.y - fl) / 100;
        if (!this.threat) { dx += bx * 1.6; dy += by * 1.6; } else { dx += bx * 0.8; dy += by * 0.8; }
      }
      let dl = Math.hypot(dx, dy);
      if (dl > 0.001) {
        dx /= dl; dy /= dl;
        // obstacle feelers
        const look = this.r + 50 + spd * 0.25;
        if (World.solidAt(this.x + dx * look, this.y + dy * look)) {
          for (let k = 1; k <= 3; k++) {
            const a = 0.9 * k * this.turnSign, c = Math.cos(a), s = Math.sin(a), nx = dx * c - dy * s, ny = dx * s + dy * c;
            if (!World.solidAt(this.x + nx * look, this.y + ny * look)) { dx = nx; dy = ny; this.wanderAng = Math.atan2(ny, nx); break; }
            const a2 = -a, c2 = Math.cos(a2), s2 = Math.sin(a2), mx = dx * c2 - dy * s2, my = dx * s2 + dy * c2;
            if (!World.solidAt(this.x + mx * look, this.y + my * look)) { dx = mx; dy = my; this.wanderAng = Math.atan2(my, mx); this.turnSign = -this.turnSign; break; }
          }
        }
      } else { dx = 0; dy = 0; }

      // ----- integrate with limited acceleration (so turns take time) -----
      let ax = dx * spd - this.vx, ay = dy * spd - this.vy;
      const m = Math.hypot(ax, ay), maxd = this.accel * dt;
      if (m > maxd) { ax *= maxd / m; ay *= maxd / m; }
      this.vx += ax; this.vy += ay;
      this.x += this.vx * dt; this.y += this.vy * dt;
      World.resolve(this, false);

      const sp2 = Math.hypot(this.vx, this.vy);
      if (sp2 > 6) {
        const ta = Math.atan2(this.vy, this.vx);
        this.ang += U.angDiff(this.ang, ta) * Math.min(1, (sp.hunter ? 5 : 8) * dt);
        this.face = this.vx < -2 ? -1 : this.vx > 2 ? 1 : this.face;
      }
      const ft = Math.cos(this.ang) < 0 ? -1 : 1;
      this.flip += U.clamp(ft - this.flip, -8 * dt, 8 * dt);
      const rel = sp2 / (sp.speed || 1);
      this.sw += (U.clamp(0.3 + rel * 0.6, 0.3, 1.25) - this.sw) * Math.min(1, 4 * dt);
      this.phase += dt * (3 + rel * 5);

      // ----- catching prey -----
      if (this.target && this.alertT <= 0 && this.stun <= 0) {
        const t = this.target, ddx = t.x - this.x, ddy = t.y - this.y, reach = this.r + t.r * 0.75 + 2;
        if (ddx * ddx + ddy * ddy < reach * reach) {
          if (t === pl) { if (LO.Game) LO.Game.playerBitten(this); }
          else if (!t.dead) eatFish(this, t);
        }
      }
      if (sp.legend) {
        this.sparkT -= dt;
        if (this.sparkT <= 0) { this.sparkT = U.rand(0.12, 0.3); LO.Particles.spark(this.x + U.rand(-this.sz, this.sz) * 1.6, this.y + U.rand(-this.sz, this.sz) * 0.8, sp.glow, U.rand(1.4, 3), U.rand(0.8, 1.6)); }
      }
    }
  }

  function eatFish(pred, prey) {
    prey.dead = true;
    pred.sated = CFG.ai.satedTime; pred.eatT = 0.35; pred.target = null; pred.chaseCool = 2;
    pred.sizeMul = Math.min(1.25, pred.sizeMul + 0.015); pred.updateR();
    LO.Particles.eatFx(prey.x, prey.y, prey.sz, '#ffffff');
  }

  /* ---------- spawning ---------- */
  const byZone = {};
  CFG.zoneOrder.forEach((z) => { byZone[z] = SP.filter((s) => s.zone === z && !s.legend); });

  function pickSpecies(zone, counts) {
    const t = byZone[zone];
    let total = 0;
    for (let i = 0; i < t.length; i++) if (!(t[i].hunter && (counts[t[i].id] || 0) >= t[i].max)) total += t[i].weight;
    let r = Math.random() * total;
    for (let i = 0; i < t.length; i++) {
      if (t[i].hunter && (counts[t[i].id] || 0) >= t[i].max) continue;
      r -= t[i].weight; if (r <= 0) return t[i];
    }
    return t[0];
  }

  function validSpot(zone, avoid, avoidD, focusD) {
    const z = CFG.zones[zone].rect, row = (zone === 'deep' || zone === 'grotto') ? 1 : 0;
    for (let k = 0; k < 30; k++) {
      const x = z[0] + 130 + Math.random() * (z[2] - 260), yTop = z[1] + (row ? 140 : 100), yBot = World.floorAt(x, row) - 90;
      if (yBot <= yTop) continue;
      const y = yTop + Math.random() * (yBot - yTop);
      if (World.solidAt(x, y) || World.solidAt(x + 50, y) || World.solidAt(x - 50, y) || World.solidAt(x, y + 50) || World.solidAt(x, y - 50) || World.isHidden(x, y)) continue;
      if (avoid && Math.hypot(x - avoid.x, y - avoid.y) < avoidD) continue;
      if (focusD && Math.hypot(x - focusX, y - focusY) < focusD) continue;
      return { x, y };
    }
    return null;
  }

  function spawnGroup(sp, x, y, limit) {
    const n = sp.school ? Math.min(limit || 99, U.randInt(sp.school[0], sp.school[1])) : 1;
    let made = 0;
    for (let i = 0; i < n; i++) {
      const fx = x + (n > 1 ? U.rand(-60, 60) : 0), fy = y + (n > 1 ? U.rand(-45, 45) : 0);
      if (n > 1 && World.solidAt(fx, fy)) continue;
      const f = new Fish(sp, fx, fy); f.homeX = x; f.homeY = y; list.push(f); made++;
    }
    return made;
  }

  function counts() {
    const zc = {}, sc = {};
    for (let i = 0; i < list.length; i++) { const f = list[i]; if (f.dead || f.sp.legend) continue; zc[f.zone] = (zc[f.zone] || 0) + 1; sc[f.sp.id] = (sc[f.sp.id] || 0) + 1; }
    return { zc, sc };
  }

  function populate() {
    const c = counts(), start = CFG.start;
    CFG.zoneOrder.forEach((zone) => {
      let guard = 0;
      while ((c.zc[zone] || 0) < CFG.pop[zone] && guard++ < 400) {
        const sp = pickSpecies(zone, c.sc);
        const spot = validSpot(zone, start, sp.hunter ? 1100 : 0, 0);
        if (!spot) continue;
        const n = spawnGroup(sp, spot.x, spot.y, CFG.pop[zone] - (c.zc[zone] || 0));
        c.zc[zone] = (c.zc[zone] || 0) + n; c.sc[sp.id] = (c.sc[sp.id] || 0) + n;
      }
    });
    // a friendly starter meadow of tiny fish around the start point
    const mini = LO.SPECIES_BY_ID.sunny_minnow, goby = LO.SPECIES_BY_ID.pebble_goby, dam = LO.SPECIES_BY_ID.rosy_damsel;
    [[760, 560], [380, 840], [640, 1000], [930, 760]].forEach((p, i) => { if (!World.solidAt(p[0], p[1])) spawnGroup(mini, p[0], p[1]); if (i < 2 && !World.solidAt(p[0] + 90, p[1] + 60)) spawnGroup(i ? dam : goby, p[0] + 90, p[1] + 60); });
    // legends and rare den dwellers
    SP.forEach((sp) => { if (sp.legend) { const f = new Fish(sp, sp.spawn.x, sp.spawn.y, { leash: sp.spawn.leash }); list.push(f); } });
    const leaf = LO.SPECIES_BY_ID.leafling;
    spawnGroup(leaf, 3150, 1520); spawnGroup(leaf, 3250, 1500);
  }

  function respawnTick() {
    const c = counts();
    CFG.zoneOrder.forEach((zone) => {
      if ((c.zc[zone] || 0) >= CFG.pop[zone] * 0.96) return;
      const sp = pickSpecies(zone, c.sc);
      const spot = validSpot(zone, { x: focusX, y: focusY }, 950, 0);
      if (spot) spawnGroup(sp, spot.x, spot.y, CFG.pop[zone] - (c.zc[zone] || 0));
    });
  }

  function reset() { list.length = 0; gClear(); }

  /* ---------- per-frame ---------- */
  function update(dt, fx, fy) {
    focusX = fx; focusY = fy;
    gClear();
    const R2 = CFG.ai.activeRadius * CFG.ai.activeRadius;
    for (let i = 0; i < list.length; i++) {
      const f = list[i], dx = f.x - fx, dy = f.y - fy;
      f.active = !f.dead && dx * dx + dy * dy < R2;
      if (f.active) gAdd(f);
    }
    for (let i = 0; i < list.length; i++) { const f = list[i]; if (f.active && !f.dead) f.update(dt); }
    let w = 0;
    for (let i = 0; i < list.length; i++) if (!list[i].dead) list[w++] = list[i];
    list.length = w;
    spawnT -= dt;
    if (spawnT <= 0) { spawnT = 0.4; respawnTick(); }
  }

  // the player eats anything small enough that touches their mouth
  function playerEat(pl, onEat) {
    gQuery(QB2, pl.x, pl.y, pl.r + 90);
    let eaten = 0;
    for (let i = 0; i < QB2.length; i++) {
      const f = QB2[i];
      if (f.dead) continue;
      const dx = f.x - pl.x, dy = f.y - pl.y, reach = pl.r + f.r * 0.8 + 4;
      if (dx * dx + dy * dy >= reach * reach) continue;
      if (f.sp.legend || pl.size < f.sz * (f.sp.eatRatio || ratio)) {
        // touching something too big: tell the player why nothing happened
        const now = performance.now();
        if (!f.blockAt || now - f.blockAt > 1800) {
          f.blockAt = now;
          LO.Particles.text(f.x, f.y - f.sz, f.sp.legend ? 'Too majestic to eat' : 'Too big to eat yet', '#ffb3b8');
        }
        continue;
      }
      f.dead = true; onEat(f); if (++eaten >= 3) break;
    }
    return eaten;
  }

  function nearestThreat(pl) {
    gQuery(QB2, pl.x, pl.y, 600);
    let best = null, bd = 1e12;
    for (let i = 0; i < QB2.length; i++) {
      const f = QB2[i];
      if (f.dead || !f.sp.hunter || f.sated > 0 || f.stun > 0) continue;
      if (f.sz < pl.size * ((f.sp.biteRatio || ratio) + pl.stats.ratioMod)) continue;
      const d = (f.x - pl.x) * (f.x - pl.x) + (f.y - pl.y) * (f.y - pl.y);
      if (d < bd) { bd = d; best = f; }
    }
    return best ? { fish: best, d: Math.sqrt(bd) } : null;
  }

  function preyNear(pl, rad) {
    gQuery(QB2, pl.x, pl.y, rad);
    for (let i = 0; i < QB2.length; i++) {
      const f = QB2[i];
      if (f.dead || f.sp.legend || pl.size < f.sz * (f.sp.eatRatio || ratio)) continue;
      const dx = f.x - pl.x, dy = f.y - pl.y;
      if (dx * dx + dy * dy < rad * rad) return true;
    }
    return false;
  }

  function scanDiscover(pl) {
    gQuery(QB2, pl.x, pl.y, 480);
    const d = LO.Save.data.species;
    for (let i = 0; i < QB2.length; i++) {
      const f = QB2[i];
      if (f.dead || d[f.sp.id]) continue;
      const dx = f.x - pl.x, dy = f.y - pl.y, r = f.sp.legend ? f.sp.discoverR : 250 + pl.size * 2.2;
      if (dx * dx + dy * dy < r * r) LO.Progression.seeSpecies(f.sp.id);
    }
  }

  /* ---------- drawing ---------- */
  const O = { x: 0, y: 0, ang: 0, flip: 1, phase: 0, sw: 0.7, t: 0, eat: 0, alpha: 1, seed: 0, alert: false, face: 1 };
  function draw(ctx, view, t) {
    const pl = P();
    for (let i = 0; i < list.length; i++) {
      const f = list[i];
      if (f.dead) continue;
      const m = f.sz * 3.5 * f.sp.shape.len + 90;
      if (f.x + m < view.l || f.x - m > view.r || f.y + m < view.t || f.y - m > view.b) continue;
      O.x = f.x; O.y = f.y; O.ang = f.ang; O.flip = f.flip; O.phase = f.phase; O.sw = f.sw; O.t = t + f.seed;
      O.eat = f.eatT > 0 ? f.eatT / 0.35 : 0; O.seed = f.seed; O.face = f.face;
      O.alert = !!(f.target && f.target === pl);
      O.alpha = 1;
      LO.FishArt.draw(ctx, f.sp, f.sz, O);
      if (f.target === pl && f.alertT > 0) {
        const s = Math.max(1, 1.1 / view.zoom), ox = f.x, oy = f.y - f.sz * 1.9 - 22 * s;
        ctx.save(); ctx.translate(ox, oy); ctx.scale(s, s);
        ctx.fillStyle = '#ff5a6e'; ctx.strokeStyle = '#fff'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(-4, -14); ctx.lineTo(4, -14); ctx.lineTo(2.5, 2); ctx.lineTo(-2.5, 2); ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.beginPath(); ctx.arc(0, 8, 3.2, 0, TAU); ctx.fill(); ctx.stroke();
        ctx.restore();
      }
    }
  }

  return {
    list, update, draw, populate, reset, playerEat, nearestThreat, preyNear, scanDiscover, eatFish,
    get count() { return list.length; }
  };
})();
