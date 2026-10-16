/* Little Ocean - the player's fish: mouse steering with inertia, burst energy system, rendering. */
window.LO = window.LO || {};
LO.Player = (function () {
  const CFG = LO.CFG, U = LO.U, World = LO.World, B = CFG.burst, PC = CFG.player;

  const look = {
    shape: { len: 1, hgt: 0.42, peak: 0.52, p: 2.1, base: 0.1 }, tail: 'fan', tailLen: 1.05, dorsal: 'soft', dorsalH: 1,
    pattern: 'spots', patN: 3, eye: 1.4, pect: 1.25, wave: 1, color: { body: '#ffb44c', belly: '#fff0c8', fin: '#ff7e6b', accent: '#3fc1c9' },
    glow: null, teeth: false, special: null, alpha: 0
  };
  const O = { x: 0, y: 0, ang: 0, flip: 1, phase: 0, sw: 0.5, t: 0, eat: 0, alpha: 1, seed: 7, alert: false, face: 1 };

  const P = {
    x: 0, y: 0, vx: 0, vy: 0, ang: 0, spd: 0, size: PC.startSize, r: PC.startSize * PC.radiusPerSize,
    energy: B.maxEnergy, maxEnergy: B.maxEnergy, bursting: false, burstLocked: false, regenT: 0,
    eatT: 0, invuln: 0, alive: false, hidden: false, flip: 1, phase: 0, sw: 0.5, fade: 1, pursuing: false,
    stats: LO.Evolution.baseStats(), t: 0, trailT: 0, speedFrac: 0, justBurst: false,

    refreshLook() {
      const c = CFG.cosmetics[LO.Save.data.settings.cosmetic] || CFG.cosmetics.default;
      look.color.body = c.body; look.color.belly = c.belly; look.color.fin = c.fin; look.color.accent = c.accent;
      look.glow = c.glow;
    },

    applyStats() {
      const run = LO.Progression.run;
      const prev = this.maxEnergy;
      this.stats = LO.Evolution.computeStats(run ? run.evo : []);
      this.maxEnergy = B.maxEnergy + this.stats.energyAdd;
      if (this.maxEnergy > prev) this.energy += this.maxEnergy - prev;
      this.energy = Math.min(this.energy, this.maxEnergy);
    },

    reset() {
      this.x = CFG.start.x; this.y = CFG.start.y; this.vx = this.vy = 0; this.ang = 0; this.spd = 0;
      this.size = PC.startSize; this.r = this.size * PC.radiusPerSize;
      this.stats = LO.Evolution.baseStats(); this.maxEnergy = B.maxEnergy; this.energy = this.maxEnergy;
      this.bursting = false; this.burstLocked = false; this.regenT = 0; this.eatT = 0; this.invuln = 0.8;
      this.alive = true; this.hidden = false; this.fade = 1; this.pursuing = false; this.flip = 1;
      this.refreshLook();
    },

    // input: {active, wx, wy, burst}
    update(dt, input) {
      const st = this.stats;
      this.t += dt;
      const run = LO.Progression.run;
      this.size += (run.size - this.size) * Math.min(1, 3 * dt);
      this.r = this.size * PC.radiusPerSize;
      if (this.invuln > 0) this.invuln -= dt;
      if (this.eatT > 0) this.eatT -= dt;

      /* --- burst energy --- */
      const want = input.burst;
      this.justBurst = false;
      if (!this.bursting && want && !this.burstLocked && this.energy >= B.minActivate) {
        this.bursting = true; this.energy = Math.max(0, this.energy - B.startCost); this.justBurst = true;
        LO.Audio.burst();
      }
      if (this.bursting) {
        this.energy -= B.drain * st.drainMul * dt;
        this.regenT = B.regenDelay;
        if (this.energy <= 0) { this.energy = 0; this.bursting = false; this.burstLocked = true; }
        else if (!want) this.bursting = false;
      }
      if (!want) this.burstLocked = false;
      if (!this.bursting) {
        if (this.regenT > 0) this.regenT -= dt;
        else this.energy = Math.min(this.maxEnergy, this.energy + B.regen * st.regenMul * dt);
      }
      this.energy = U.clamp(this.energy, 0, this.maxEnergy);

      /* --- steering toward the pointer --- */
      const dx = input.wx - this.x, dy = input.wy - this.y, dist = Math.hypot(dx, dy);
      const dead = PC.deadzone + this.size * 0.4, slow = PC.slowRadius + this.size * 3;
      const maxSp = (PC.baseSpeed + Math.min(this.size, PC.speedSizeCap) * PC.speedPerSize) * st.speedMul * (this.pursuing ? 1 + st.pursuit : 1);
      let wantSp = 0, targetAng = this.ang;
      if (input.active && dist > dead) { targetAng = Math.atan2(dy, dx); wantSp = maxSp * U.smooth((dist - dead) / slow); }
      if (this.bursting) {
        wantSp = maxSp * (B.mult + st.burstAdd);
        if (!(input.active && dist > dead * 1.5)) targetAng = this.ang;
      }
      const turnMax = PC.turn * st.turnMul * (this.bursting ? B.turnMul : 1) * (1 - 0.35 * U.clamp(this.size / 100, 0, 1));
      const da = U.angDiff(this.ang, targetAng);
      if (wantSp > 8 || this.spd > 25) this.ang += U.clamp(da * Math.min(1, 9 * dt), -turnMax * dt, turnMax * dt);
      const acc = PC.accel * st.accelMul * (this.bursting ? B.accelMul * st.burstAccel : 1) * (wantSp < this.spd ? 0.75 : 1);
      this.spd += (wantSp - this.spd) * Math.min(1, acc * dt);
      const hx = Math.cos(this.ang) * this.spd, hy = Math.sin(this.ang) * this.spd, dr = Math.min(1, PC.drift * st.drift * dt);
      this.vx += (hx - this.vx) * dr; this.vy += (hy - this.vy) * dr;
      this.x += this.vx * dt; this.y += this.vy * dt;
      World.resolve(this, true, this.size);
      const real = Math.hypot(this.vx, this.vy);
      if (real < this.spd * 0.6) this.spd += (real - this.spd) * Math.min(1, 6 * dt);

      this.hidden = World.isHidden(this.x, this.y);
      this.speedFrac = real / maxSp;
      this.flip += U.clamp((Math.cos(this.ang) < 0 ? -1 : 1) - this.flip, -9 * dt, 9 * dt);
      this.sw += (U.clamp(0.35 + this.speedFrac * 0.7, 0.35, 1.3) - this.sw) * Math.min(1, 5 * dt);
      this.phase += dt * (3.5 + this.speedFrac * 6 + (this.bursting ? 6 : 0));

      /* --- burst trail --- */
      if (this.bursting) {
        this.trailT -= dt;
        if (this.trailT <= 0) {
          this.trailT = 0.035;
          const bx = this.x - Math.cos(this.ang) * this.r * 1.6, by = this.y - Math.sin(this.ang) * this.r * 1.6;
          LO.Particles.bubble(bx + U.rand(-4, 4), by + U.rand(-4, 4), U.rand(1.5, 3.5));
          LO.Particles.streak(bx, by, this.ang, 16 + this.size * 0.6);
        }
      }
    },

    knock(dx, dy, force) { const d = Math.hypot(dx, dy) || 1; this.vx += dx / d * force; this.vy += dy / d * force; this.spd = Math.max(this.spd, force * 0.6); },

    draw(ctx, t) {
      if (this.fade <= 0.01) return;
      const lvl = LO.Progression.run ? LO.Progression.run.level : 1;
      look.dorsal = lvl >= 4 ? 'sail' : 'soft'; look.tail = lvl >= 7 ? 'fork' : 'fan'; look.tailLen = lvl >= 7 ? 1.15 : 1.05;
      look.dorsalH = 1 + Math.min(0.5, lvl * 0.04);
      const L = this.size * 3.2;
      // soft light so the player always stands out from the scenery
      const g = ctx.createRadialGradient(this.x, this.y, 0, this.x, this.y, L * 1.25);
      g.addColorStop(0, 'rgba(255,246,205,' + 0.34 * this.fade + ')'); g.addColorStop(1, 'rgba(255,246,205,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(this.x, this.y, L * 1.25, 0, Math.PI * 2); ctx.fill();
      O.x = this.x; O.y = this.y; O.ang = this.ang; O.flip = this.flip; O.phase = this.phase; O.sw = this.sw; O.t = t;
      O.eat = this.eatT > 0 ? this.eatT / 0.3 : 0;
      let a = this.fade;
      if (this.invuln > 0) a *= 0.5 + 0.3 * Math.sin(t * 28);
      else if (this.hidden) a *= 0.8;
      O.alpha = a;
      LO.FishArt.draw(ctx, look, this.size, O);
    }
  };
  return P;
})();
