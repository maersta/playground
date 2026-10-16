/* =========================================================
   game.js - Game: main loop, state machine, input, scoring,
   combo system, run results and rendering orchestration.
   ========================================================= */
'use strict';

const MAX_PULL = 40;         // max drag distance in internal pixels
const MIN_PULL = 5;          // below this the shot is cancelled
const MIN_POWER_FRAC = 0.25; // minimum launch power as fraction of max

class Game {
  constructor() {
    this.canvas = document.getElementById('game');
    this.ctx = this.canvas.getContext('2d');
    this.world = new World();
    this.pug = new Pug();
    this.sling = new Slingshot();
    this.camera = new Camera();
    this.particles = new ParticleSystem(500);
    this.texts = new FloatingTexts(40);
    this.state = 'menu';
    this.paused = false;
    this.time = 0;
    this.acc = 0;
    this.hitStopTimer = 0;
    this.hurtFlash = 0;
    this.steerDir = 0;
    this.keys = {};
    this.aim = { active: false, sx: 0, sy: 0, cx: 0, cy: 0, pullX: 0, pullY: 0, power: 0, pull: 0 };
    this.banner = null;
    this.combo = { count: 0, timer: 0, maxTimer: 2.6, pulse: 0 };
    this.biome = 0; this.prevBiome = 0; this.biomeBlend = 1;

    SaveSystem.load();
    AudioSystem.setMuted(SaveSystem.data.muted);
    Sprites.build();
    this.stats = UpgradeSystem.stats();

    this.resize();
    window.addEventListener('resize', () => this.resize());
    window.addEventListener('orientationchange', () => setTimeout(() => this.resize(), 200));
    this.bindInput();
    UI.init(this);

    this.setupScene();
    UI.showMenu();
    this.last = performance.now();
    requestAnimationFrame(t => this.loop(t));
  }

  /* ---------------- Canvas sizing: low internal res, nearest-neighbour upscale ---------------- */
  resize() {
    const cw = window.innerWidth, ch = window.innerHeight;
    let scale = Math.max(1, Math.round(Math.sqrt(cw * ch / (440 * 250))));
    if (ch / scale < 190) scale = Math.max(1, Math.floor(ch / 190));
    this.scale = scale;
    this.W = Math.ceil(cw / scale);
    this.H = Math.ceil(ch / scale);
    this.canvas.width = this.W;
    this.canvas.height = this.H;
    this.ctx.imageSmoothingEnabled = false;
    document.getElementById('rotate-hint').classList.toggle('hidden', !(ch > cw * 1.1 && cw < 700));
  }

  /* ---------------- Input (mouse + touch via Pointer Events, keyboard) ---------------- */
  bindInput() {
    const c = this.canvas;
    const toLocal = e => ({ x: e.clientX / this.scale, y: e.clientY / this.scale });
    c.addEventListener('pointerdown', e => {
      e.preventDefault();
      AudioSystem.unlock();
      const p = toLocal(e);
      if (this.paused) return;
      if (this.state === 'aim') {
        this.aim.active = true;
        this.aim.sx = p.x; this.aim.sy = p.y; this.aim.cx = p.x; this.aim.cy = p.y;
        this.aim.pointerId = e.pointerId;
        try { c.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
        c.classList.add('grabbing');
      } else if (this.state === 'fly') {
        this.pointerSteer = p.x < this.W / 2 ? -1 : 1;
        this.steerPointer = e.pointerId;
      }
    });
    c.addEventListener('pointermove', e => {
      if (this.aim.active && e.pointerId === this.aim.pointerId) {
        const p = toLocal(e);
        this.aim.cx = p.x; this.aim.cy = p.y;
      } else if (this.state === 'fly' && this.steerPointer === e.pointerId && e.buttons) {
        this.pointerSteer = toLocal(e).x < this.W / 2 ? -1 : 1;
      }
    });
    const up = e => {
      if (this.aim.active && e.pointerId === this.aim.pointerId) {
        this.aim.active = false;
        c.classList.remove('grabbing');
        this.tryLaunch();
      }
      if (e.pointerId === this.steerPointer) { this.pointerSteer = 0; this.steerPointer = null; }
    };
    c.addEventListener('pointerup', up);
    c.addEventListener('pointercancel', up);
    c.addEventListener('contextmenu', e => e.preventDefault());

    window.addEventListener('keydown', e => {
      this.keys[e.code] = true;
      if ((e.code === 'Escape' || e.code === 'KeyP') && (this.state === 'fly' || this.state === 'aim')) {
        this.paused ? this.resume() : this.pause();
      }
      if (e.code === 'Space' && UI.current === 'results') this.startRun();
      if (e.code === 'KeyR' && (this.state === 'fly' || this.state === 'aim') && !e.repeat) this.startRun();
    });
    window.addEventListener('keyup', e => { this.keys[e.code] = false; });
    document.addEventListener('visibilitychange', () => {
      if (document.hidden && (this.state === 'fly' || this.state === 'aim') && !this.paused) this.pause();
    });
  }

  get keySteer() {
    let d = 0;
    if (this.keys.ArrowLeft || this.keys.KeyA) d -= 1;
    if (this.keys.ArrowRight || this.keys.KeyD) d += 1;
    return d;
  }

  /* ---------------- Scene / run lifecycle ---------------- */
  setupScene() {
    this.stats = UpgradeSystem.stats();
    this.sling.def = Meta.item('sling', SaveSystem.data.sling);
    this.world.reset(this.stats.luck, SaveSystem.data.world);
    this.world.generateUntil(SLING_X + 1400);
    this.sling.place(this.world.terrain.heightAt(SLING_X));
    this.pug.reset(this.stats, this.sling.restX, this.sling.restY);
    this.particles.clear();
    this.texts.clear();
    this.biome = this.prevBiome = this.world.wd.bio[0][1]; this.biomeBlend = 1;
    this.camera.snap(this.sling.x - this.W * (this.W < 300 ? 0.2 : 0.28), this.sling.gy - this.H * 0.68);
    this.run = {
      distance: 0, score: 0, coins: 0, bounces: 0, broken: 0, time: 0,
      maxSpeed: 0, maxCombo: 0, progressX: SLING_X, stuckTimer: 0, slowTimer: 0,
      airTime: 0, airChunk: 0, speedChunk: 0, coinStreak: 0, coinStreakTimer: 0, lastMilestone: 0
    };
    this.combo.count = 0; this.combo.timer = 0;
    this.banner = null;
  }

  startRun() {
    AudioSystem.unlock();
    for (const t of UI.resultTimers) clearTimeout(t);
    this.setupScene();
    this.state = 'aim';
    this.paused = false;
    UI.hideAll();
    UI.setHudVisible(true);
    const w = Meta.world();
    this.showBanner(w.id ? w.name : 'DRAG BACK TO AIM!', w.id ? 'WORLD ' + (w.id + 1) + ' - DRAG BACK TO AIM' : 'RELEASE TO LAUNCH', 2.4, PAL.white);
  }

  toMenu() {
    this.state = 'menu';
    this.paused = false;
    this.setupScene();
    UI.setHudVisible(false);
    UI.showMenu();
  }

  pause() {
    if (this.state !== 'fly' && this.state !== 'aim') return;
    this.paused = true;
    this.aim.active = false;
    UI.show('pause');
  }
  resume() {
    this.paused = false;
    UI.hideAll();
    this.last = performance.now();
  }

  /* ---------------- Aiming & launch ---------------- */
  updateAim() {
    const a = this.aim;
    if (!a.active) { a.pull = 0; a.power = 0; return; }
    let dx = a.cx - a.sx, dy = a.cy - a.sy;
    dx = Math.min(dx, 6);                     // can't drag far forward
    const len = Math.hypot(dx, dy);
    const k = len > MAX_PULL ? MAX_PULL / len : 1;
    a.pullX = dx * k; a.pullY = dy * k;
    a.pull = Math.min(1, len / MAX_PULL);
    a.power = a.pull;
    if (len > 1) AudioSystem.stretch(a.pull);
  }

  /** Launch velocity from the pull vector (opposite direction, scaled by pull). */
  launchVelocity() {
    const a = this.aim;
    let ang = Math.atan2(-a.pullY, -a.pullX);
    ang = clamp(ang, -1.5, 0.45);              // keep shots aimed forward-ish
    const speed = lerp(this.stats.maxPower * MIN_POWER_FRAC, this.stats.maxPower, a.pull);
    return { vx: Math.cos(ang) * speed, vy: Math.sin(ang) * speed };
  }

  tryLaunch() {
    const a = this.aim;
    if (Math.hypot(a.pullX, a.pullY) < MIN_PULL) { a.pull = 0; return; }
    const v = this.launchVelocity();
    const p = this.pug;
    Meta.consumeBoosts();
    p.x = this.sling.restX + a.pullX; p.y = this.sling.restY + a.pullY;
    p.vx = v.vx; p.vy = v.vy;
    p.angVel = 6 + a.pull * 14;
    p.react('happy', 0.6);
    p.squash(0.3, -Math.cos(Math.atan2(v.vy, v.vx)), -Math.sin(Math.atan2(v.vy, v.vx)));
    this.sling.release(a.pullX, a.pullY);
    this.state = 'fly';
    this.run.time = 0;
    AudioSystem.launch(a.pull);
    AudioSystem.bark();
    this.camera.shake(2 + a.pull * 3);
    this.particles.burst(p.x, p.y, 10, [PAL.white, PAL.cream, PAL.ltgreen], 100, 0.5, 1, 100);
    a.pull = 0; a.pullX = 0; a.pullY = 0;
    this.banner = null;
  }

  /* ---------------- Scoring & combo ---------------- */
  comboMult() { return 1 + Math.min(this.combo.count, 40) * 0.1; }

  addCombo(n) {
    if (this.state !== 'fly') return;
    const before = Math.floor(this.combo.count / 5);
    this.combo.count += n;
    this.combo.timer = this.combo.maxTimer;
    this.combo.pulse = 0.12;
    this.run.maxCombo = Math.max(this.run.maxCombo, this.combo.count);
    AudioSystem.combo(this.combo.count);
    if (Math.floor(this.combo.count / 5) > before) {
      this.texts.add(this.pug.x, this.pug.y - 30, 'COMBO x' + this.comboMult().toFixed(1) + '!', PAL.orange, 2, 1.2);
    }
  }
  resetCombo() {
    if (this.combo.count >= 5) this.texts.add(this.pug.x, this.pug.y - 24, 'COMBO END', PAL.grey, 1);
    this.combo.count = 0; this.combo.timer = 0;
  }

  addScore(points, x, y, label, color = PAL.gold) {
    if (this.state !== 'fly') return 0;
    const pts = Math.round(points * this.comboMult());
    this.run.score += pts;
    if (label) this.texts.add(x, y, label, color, 1, 1.0);
    this.texts.add(x, y + (label ? 8 : 0), '+' + pts, PAL.white, 1, 0.8);
    return pts;
  }

  hitStop(t) { this.hitStopTimer = Math.max(this.hitStopTimer, t); }

  showBanner(text, sub, dur, color) { this.banner = { text, sub, t: dur, max: dur, color }; }

  /* ---------------- Callbacks from physics / obstacles ---------------- */
  onPugBounce(impact, x, y, type) {
    if (this.state !== 'fly' && this.state !== 'dying') return;
    const strength = clamp(impact / 700, 0, 1);
    const B = BIOMES[this.world.terrain.biomeAt(x)];
    const dustCols = {
      [SURF.GRASS]: [B.top, B.dirt, B.blade], [SURF.STONE]: [PAL.ltstone, PAL.stone, PAL.white],
      [SURF.MUD]: [PAL.mud, PAL.mud2, '#4a2e1c'], [SURF.ICE]: [PAL.white, PAL.ice, PAL.ice2],
      [SURF.SAND]: [PAL.sand, PAL.sand2, PAL.cream]
    }[type] || [PAL.cream, PAL.tan];
    this.particles.dust(x, y, strength, dustCols);
    AudioSystem.bounce(strength);
    if (impact > 420) { this.camera.shake(impact / 220); this.particles.stars(x, y - 2, 5); }
    if (impact > 750) { this.hitStop(0.045); this.pug.react('hurt', 0.4); }
    if (type === SURF.MUD && impact > 150) this.texts.add(x, y - 16, 'SPLAT', PAL.mud2, 1);
    if (this.state !== 'fly') return;
    if (impact > 150) {
      this.run.bounces++;
      this.addCombo(1);
      this.addScore(15, x, y - 18, impact > 500 ? 'BIG BOUNCE!' : null, PAL.lime);
    }
    this.checkBigAir(x, y);
  }

  checkBigAir(x, y) {
    if (this.run.airTime > 1.6) {
      const secs = this.run.airTime;
      this.addScore(Math.round(40 * secs), x, y - 30, secs > 3 ? 'HUGE AIR!' : 'BIG AIR!', PAL.ltsky);
      this.addCombo(2);
    }
    this.run.airTime = 0;
  }

  onPugWallHit(imp, x, y) {
    AudioSystem.collision();
    this.camera.shake(Math.min(6, imp / 90));
    this.particles.stars(x, y, 8);
    this.pug.react('hurt', 0.6);
    this.pug.squash(Math.min(0.5, imp / 500), -sign(this.pug.vx), 0);
    this.texts.add(x, y - 16, 'BONK!', PAL.red2, 1);
    if (imp > 300) this.hitStop(0.05);
  }

  onBreak(o, score, label) {
    this.run.broken++;
    this.addCombo(1);
    this.addScore(score, o.x, o.y - 12, label, PAL.orange);
  }

  onSpecial(x, y, label, score, color) {
    this.addCombo(1);
    this.addScore(score, x, y, label, color);
  }
  onBounceBonus(x, y, label) {
    this.addCombo(1);
    this.addScore(20, x, y, label, PAL.ltstone);
  }

  explosion(x, y, chained) {
    AudioSystem.explosion();
    this.camera.shake(7);
    this.hitStop(0.06);
    this.particles.burst(x, y, 26, [PAL.lava2, PAL.lava, PAL.red, PAL.yellow, PAL.white], 220, 0.6, 2, 150);
    for (let i = 0; i < 12; i++) {
      this.particles.spawn(x + rand(-8, 8), y + rand(-8, 4), rand(-30, 30), rand(-70, -20), rand(0.6, 1.2),
        pick([PAL.dkstone, PAL.grey, PAL.stone]), 3, -20, 1.5, 'smoke');
    }
    this.pug.react('scared', 0.8);
    this.world.blastBreakables(x, y, 46, this);
    if (this.state === 'fly') {
      this.addCombo(2);
      this.addScore(chained ? 40 : 60, x, y - 18, 'KABOOM!', PAL.lava);
    }
  }

  collectCoin(c) {
    if (this.state !== 'fly' && this.state !== 'dying') return;
    const value = COIN_VALUES[c.kind];
    this.run.coins += value;
    this.run.coinStreak++;
    this.run.coinStreakTimer = 0.6;
    HUD.coinBump = 0.12;
    if (c.kind === 'gem') {
      AudioSystem.gem();
      this.texts.add(c.x, c.y - 10, 'GEM +' + value, PAL.ltsky, 1);
      this.particles.burst(c.x, c.y, 12, [PAL.ltsky, PAL.white, PAL.blue], 90, 0.5, 1, 0);
    } else {
      AudioSystem.coin(this.run.coinStreak);
      this.particles.burst(c.x, c.y, c.kind === 'gold' ? 10 : 5, [PAL.gold, PAL.yellow, PAL.white], 60, 0.35, 1, 0);
      if (c.kind === 'gold') this.texts.add(c.x, c.y - 10, '+' + value, PAL.lava2, 1);
    }
    if (this.state === 'fly') {
      this.run.score += Math.round(10 * value * this.comboMult());
      if (this.run.coinStreak % 5 === 0) this.addCombo(1);
    }
  }

  damagePug(amount, reason, x, y) {
    const p = this.pug;
    if (this.state !== 'fly' || p.invuln > 0) return;
    p.hp = Math.max(0, p.hp - amount);
    p.invuln = 1.1;
    p.react('hurt', 0.8);
    this.hurtFlash = 0.35;
    this.camera.shake(5);
    this.hitStop(0.07);
    AudioSystem.hurt();
    this.particles.burst(p.x, p.y, 10, [PAL.red2, PAL.white, PAL.pink], 120, 0.5, 1, 200);
    this.texts.add(p.x, p.y - 22, reason, PAL.red2, 1, 1.1);
    this.resetCombo();
    if (p.hp <= 0) {
      p.dead = true;
      this.endRun('KNOCKED OUT - ' + reason.replace('!', ''));
    }
  }

  pugTouchedLava() {
    const p = this.pug;
    p.vy = -560;
    p.vx = Math.max(p.vx, 140);
    p.angVel = rand(-20, 20);
    this.particles.burst(p.x, p.y + 6, 16, [PAL.lava, PAL.lava2, PAL.red], 140, 0.6, 1, 200);
    AudioSystem.noise(0.3, 0.3, 3000, 'highpass');
    if (p.invuln <= 0) this.damagePug(3, 'HOT PAWS!', p.x, p.y);
  }

  pugFellInPit() {
    const p = this.pug;
    if (p.frozen) return;
    p.frozen = true; p.dead = true;
    p.vx = 0; p.vy = 0;
    p.y = this.world.terrain.heightAt(p.x) - p.r;
    this.camera.shake(4);
    AudioSystem.collision();
    if (this.state === 'fly') this.endRun('FELL INTO A PIT!');
  }

  /* ---------------- Run end & rewards ---------------- */
  endRun(reason) {
    if (this.state !== 'fly' && this.state !== 'aim') return;
    if (this.state === 'aim') { this.toMenu(); return; }
    this.state = 'dying';
    this.dyingTimer = 1.6;
    this.endReason = reason;
    this.pug.react('dizzy', 3);
    AudioSystem.gameOver();
    this.showBanner(reason, Math.floor(this.run.distance) + 'M', 1.6, PAL.red2);

    const d = SaveSystem.data, r = this.run;
    const distance = Math.floor(r.distance);
    const wid = d.world;
    const prevBest = d.worldBest[wid];
    const newRecord = distance > prevBest;
    const coinsCollected = r.coins;
    const distanceBonus = Math.floor(distance / 5);
    const scoreBonus = Math.floor(r.score / 400);
    const recordBonus = newRecord && prevBest > 0 ? 10 + Math.floor((distance - prevBest) / 2) : 0;
    let luckyBonus = 0;
    if (Math.random() < Math.min(0.8, 0.08 + this.stats.luck * 1.5)) {
      luckyBonus = 5 + Math.floor((coinsCollected + distanceBonus) * rand(0.3, 0.8));
    }
    const subtotal = coinsCollected + distanceBonus + scoreBonus + recordBonus + luckyBonus;
    const multBonus = Math.round(subtotal * (this.stats.coinMult - 1));
    const totalCoins = subtotal + multBonus;

    d.coins += totalCoins;
    d.totalCoins += totalCoins;
    d.best = Math.max(d.best, distance);
    d.worldBest[wid] = Math.max(prevBest, distance);
    d.ascScore = Math.max(d.ascScore, Math.floor(distance * (1 + 0.25 * wid)));
    d.bestScore = Math.max(d.bestScore, Math.floor(r.score));
    d.totalDistance += distance;
    d.runs++;
    d.bounces += r.bounces;
    d.broken += r.broken;
    d.maxSpeed = Math.max(d.maxSpeed, r.maxSpeed / PX_PER_M);
    d.maxCombo = Math.max(d.maxCombo, r.maxCombo);
    const events = [];
    Meta.afterRun(r, events);
    SaveSystem.save();

    this.results = {
      reason, distance, best: d.worldBest[wid], score: Math.floor(r.score), maxCombo: r.maxCombo,
      coinsCollected, distanceBonus, scoreBonus, recordBonus, luckyBonus, multBonus,
      multLabel: 'x' + this.stats.coinMult.toFixed(2), totalCoins, newRecord, events,
      ascendReady: Meta.canAscend()
    };
  }

  /* ---------------- Main loop ---------------- */
  loop(now) {
    const dt = Math.min(0.05, (now - this.last) / 1000);
    this.last = now;
    if (!this.paused) this.update(dt);
    this.render();
    requestAnimationFrame(t => this.loop(t));
  }

  update(dt) {
    this.time += dt;
    this.camera.update(dt);
    this.texts.update(dt);
    this.sling.update(dt);
    if (this.hurtFlash > 0) this.hurtFlash -= dt;
    if (this.combo.pulse > 0) this.combo.pulse -= dt;
    if (this.banner) { this.banner.t -= dt; if (this.banner.t <= 0) this.banner = null; }

    if (this.hitStopTimer > 0) { this.hitStopTimer -= dt; return; }   // freeze-frame on big hits
    this.particles.update(dt);

    if (this.state === 'menu' || this.state === 'aim') {
      this.updateAim();
      const p = this.pug;
      p.x = this.sling.restX + this.aim.pullX * (this.aim.active ? 1 : 0);
      p.y = this.sling.restY + this.aim.pullY * (this.aim.active ? 1 : 0);
      p.angle = this.aim.active ? Math.atan2(-this.aim.pullY, -this.aim.pullX) * 0.3 : 0;
      p.animate(dt, 'sling', this.aim.pull);
      // camera eases forward a little while aiming so you see more of the shot
      const lead = this.aim.active ? this.aim.pull * this.W * 0.15 : 0;
      this.camera.follow(this.sling.x - this.W * (this.W < 300 ? 0.2 : 0.28) + lead, this.sling.gy - this.H * 0.68, dt, 4, 4);
      this.world.update(dt, this.camera, this.W);
      this.world.coins.update(dt, this.time, p, 0, this, false);
      return;
    }

    if (this.state === 'fly' || this.state === 'dying') this.updateFlight(dt);
  }

  updateFlight(dt) {
    const p = this.pug, r = this.run;
    const slowmo = this.state === 'dying' ? 0.5 : 1;
    this.steerDir = this.keySteer || this.pointerSteer || 0;

    // fixed timestep physics
    this.acc += dt * slowmo;
    let guard = 0;
    while (this.acc >= PHYS_DT && guard++ < 10) {
      p.step(PHYS_DT, this.world, this, this.stats, this.state === 'fly' ? this.steerDir : 0);
      this.acc -= PHYS_DT;
    }
    if (guard >= 10) this.acc = 0;
    p.animate(dt, 'fly', 0);

    if (p.speed > 600 && Math.random() < 0.6) {
      this.particles.spawn(p.x - p.vx * 0.02 + rand(-3, 3), p.y + rand(-3, 3), -p.vx * 0.05, -p.vy * 0.05, 0.25, PAL.white, 1, 0, 2);
    }

    // camera: lead in the direction of travel, keep ground visible when low
    const lookX = clamp(p.vx * 0.12, -20, this.W * 0.18);
    const groundRef = this.world.terrain.heightAt(p.x + this.W * 0.2);
    const ty = Math.min(groundRef - this.H * 0.72, p.y - this.H * 0.42);
    this.camera.follow(p.x - this.W * 0.32 + lookX, ty, dt, 8, 4);
    if (p.x - this.camera.x > this.W * 0.75) this.camera.x = p.x - this.W * 0.75;
    if (p.x - this.camera.x < this.W * 0.1) this.camera.x = p.x - this.W * 0.1;
    if (p.y - this.camera.y > this.H * 0.85) this.camera.y = p.y - this.H * 0.85;

    this.world.update(dt, this.camera, this.W);
    this.world.coins.update(dt, this.time, p, this.stats.magnet, this, true);

    // biome transitions
    const b = this.world.terrain.biomeAt(p.x);
    if (b !== this.biome) {
      this.prevBiome = this.biome; this.biome = b; this.biomeBlend = 0;
      if (this.state === 'fly') this.showBanner(BIOMES[b].name, Math.floor(r.distance) + 'M', 2.2, PAL.gold);
    }
    if (this.biomeBlend < 1) this.biomeBlend = Math.min(1, this.biomeBlend + dt / 2);

    if (this.state === 'dying') {
      this.dyingTimer -= dt;
      if (this.dyingTimer <= 0) {
        this.state = 'results';
        UI.setHudVisible(false);
        UI.showResults(this.results);
      }
      return;
    }

    // ---- distance & score ----
    r.time += dt;
    const dist = Math.max(0, (p.x - SLING_X) / PX_PER_M);
    if (dist > r.distance) {
      r.score += (dist - r.distance) * 10 * this.comboMult();
      r.distance = dist;
      const milestone = Math.floor(dist / 250);
      if (milestone > r.lastMilestone) {
        r.lastMilestone = milestone;
        this.addScore(100, p.x, p.y - 34, milestone * 250 + 'M!', PAL.gold);
        HUD.distBump = 0.2;
      }
    }
    r.maxSpeed = Math.max(r.maxSpeed, p.speed);

    // ---- style system: air time & speed ----
    if (!p.grounded) {
      r.airTime += dt;
      r.airChunk += dt;
      if (r.airChunk >= 1) { r.airChunk -= 1; this.addCombo(1); }
    } else {
      this.checkBigAir(p.x, p.y);
      r.airChunk = 0;
    }
    if (p.speed > 650) {
      r.speedChunk += dt;
      if (r.speedChunk >= 1) { r.speedChunk -= 1; this.addCombo(1); this.addScore(25, p.x, p.y - 20, 'SPEED!', PAL.red2); }
    } else r.speedChunk = 0;
    if (r.coinStreakTimer > 0) { r.coinStreakTimer -= dt; if (r.coinStreakTimer <= 0) r.coinStreak = 0; }

    // combo decays over time and when momentum is lost
    if (this.combo.count > 0) {
      this.combo.timer -= dt;
      if (this.combo.timer <= 0 || (p.grounded && p.speed < 80)) this.resetCombo();
    }

    // ---- run-over conditions ----
    if (p.grounded && p.speed < 22) {
      r.slowTimer += dt;
      if (r.slowTimer > 0.7) { p.dead = true; this.endRun('OUT OF STEAM'); return; }
    } else r.slowTimer = 0;
    if (p.x > r.progressX + 6) { r.progressX = p.x; r.stuckTimer = 0; }
    else if (p.grounded || p.speed < 100) {
      r.stuckTimer += dt;
      if (r.stuckTimer > 3.5) { p.dead = true; this.endRun('STUCK!'); return; }
    }
    if (p.y > this.world.terrain.heightAt(p.x) + 200) { p.dead = true; this.endRun('LOST IN THE VOID'); }
  }

  /* ---------------- Rendering ---------------- */
  render() {
    const ctx = this.ctx, W = this.W, H = this.H;
    const cam = this.camera;
    const cx = cam.rx, cy = cam.ry;
    ctx.imageSmoothingEnabled = false;

    this.world.drawBackground(ctx, { x: cx, y: cy }, W, H, this.time, this.biome, this.prevBiome, this.biomeBlend);
    this.world.terrain.draw(ctx, cx, cy, W, H, this.time);
    this.drawMarkers(ctx, cx, cy);

    // slingshot (behind the pug)
    const inSling = this.state === 'menu' || this.state === 'aim';
    const pouchX = inSling ? this.pug.x - 8 : this.sling.restX - 8 + this.sling.bandX;
    const pouchY = inSling ? this.pug.y : this.sling.restY + this.sling.bandY;
    if (this.sling.x - cx > -60 && this.sling.x - cx < W + 60) this.sling.drawBack(ctx, cx, cy, pouchX, pouchY);

    for (const o of this.world.obstacles) {
      if (o.x - cx > -40 && o.x - cx < W + 40) o.draw(ctx, cx, cy);
    }
    this.world.coins.draw(ctx, cx, cy, this.time, W);

    // pug shadow
    const p = this.pug;
    const gy = this.world.terrain.heightAt(p.x);
    const alt = gy - p.y;
    if (alt < 140 && this.world.terrain.typeAt(p.x) !== SURF.PIT) {
      const sw = Math.max(2, Math.round(12 - alt / 14));
      ctx.fillStyle = 'rgba(26,20,35,0.35)';
      ctx.fillRect(Math.round(p.x - cx - sw / 2), Math.round(gy - cy - 1), sw, 2);
    }
    p.draw(ctx, cx, cy, inSling ? 'sling' : 'fly');
    if (this.sling.x - cx > -60 && this.sling.x - cx < W + 60) this.sling.drawFront(ctx, cx, cy, pouchX, pouchY);

    this.particles.draw(ctx, cx, cy);
    this.texts.draw(ctx, cx, cy);
    this.drawSpeedLines(ctx);

    if (this.state === 'aim' && this.aim.active && Math.hypot(this.aim.pullX, this.aim.pullY) >= MIN_PULL) {
      const v = this.launchVelocity();
      HUD.drawTrajectory(ctx, this, p.x, p.y, v.vx, v.vy);
      HUD.drawPowerMeter(ctx, this, this.aim.pull);
    } else if (this.state === 'aim') {
      // pulsing hint arrow over the pug
      if (Math.floor(this.time * 3) % 2) {
        const hx = Math.round(p.x - cx), hy = Math.round(p.y - cy - 22);
        ctx.fillStyle = PAL.white;
        ctx.fillRect(hx - 2, hy, 5, 1); ctx.fillRect(hx - 1, hy + 1, 3, 1); ctx.fillRect(hx, hy + 2, 1, 1);
      }
    }

    HUD.draw(ctx, this);
    this.drawBanner(ctx);

    if (this.hurtFlash > 0) {
      ctx.fillStyle = PAL.red;
      const t = 3;
      ctx.fillRect(0, 0, W, t); ctx.fillRect(0, H - t, W, t); ctx.fillRect(0, 0, t, H); ctx.fillRect(W - t, 0, t, H);
    }
  }

  /** 100m signposts + best-distance flag. */
  drawMarkers(ctx, cx, cy) {
    const t = this.world.terrain;
    const first = Math.max(1, Math.floor((cx - SLING_X) / 1000));
    for (let k = first; k <= first + Math.ceil(this.W / 1000) + 1; k++) {
      const wx = SLING_X + k * 1000;
      const sx = Math.round(wx - cx);
      if (sx < -20 || sx > this.W + 20) continue;
      const tp = t.typeAt(wx);
      if (tp === SURF.PIT || tp === SURF.LAVA) continue;
      const gy = Math.round(t.heightAt(wx) - cy);
      ctx.fillStyle = PAL.dkbrown; ctx.fillRect(sx, gy - 14, 2, 14);
      const label = k * 100 + 'M';
      const w = PixelFont.measure(label) + 4;
      ctx.fillStyle = PAL.ink; ctx.fillRect(sx - w / 2, gy - 22, w + 2, 9);
      ctx.fillStyle = PAL.cream; ctx.fillRect(sx - w / 2 + 1, gy - 21, w, 7);
      PixelFont.draw(ctx, label, sx + 1, gy - 20, 1, PAL.dkbrown, null, 'center');
    }
    const best = Meta.bestHere();
    if (best > 5) {
      const wx = SLING_X + best * PX_PER_M;
      const sx = Math.round(wx - cx);
      if (sx > -30 && sx < this.W + 30) {
        const gy = Math.round(t.heightAt(wx) - cy);
        ctx.fillStyle = PAL.ink; ctx.fillRect(sx - 1, gy - 30, 3, 30);
        ctx.fillStyle = PAL.white; ctx.fillRect(sx, gy - 30, 1, 30);
        const wave = Math.floor(this.time * 6) % 2;
        ctx.fillStyle = PAL.ink; ctx.fillRect(sx + 1, gy - 31, 16, 10);
        ctx.fillStyle = PAL.red2; ctx.fillRect(sx + 1, gy - 30, 15 - wave, 8);
        PixelFont.draw(ctx, 'BEST', sx + 9, gy - 28, 1, PAL.white, null, 'center');
      }
    }
  }

  drawSpeedLines(ctx) {
    if (this.state !== 'fly') return;
    const sp = this.pug.speed;
    if (sp < 550) return;
    const n = Math.min(14, Math.floor((sp - 550) / 50) + 2);
    const frame = Math.floor(this.time * 30);
    const ang = Math.atan2(this.pug.vy, this.pug.vx);
    const len = Math.min(50, 10 + sp / 40);
    ctx.globalAlpha = 0.45;
    for (let i = 0; i < n; i++) {
      const x = hash2(i, frame) * this.W, y = hash2(i + 99, frame) * this.H;
      for (let k = 0; k < len; k += 2) {
        ctx.fillStyle = PAL.white;
        ctx.fillRect(Math.round(x - Math.cos(ang) * k), Math.round(y - Math.sin(ang) * k), 1, 1);
      }
    }
    ctx.globalAlpha = 1;
  }

  drawBanner(ctx) {
    const b = this.banner;
    if (!b) return;
    const age = b.max - b.t;
    const scale = this.W < 300 ? 2 : 3;
    const y = Math.round(this.H * 0.3 + (age < 0.15 ? (0.15 - age) * -80 : 0));
    if (b.t < 0.3 && Math.floor(b.t * 20) % 2) return;
    PixelFont.draw(ctx, b.text, this.W / 2, y, b.text.length > 16 ? Math.max(1, scale - 1) : scale, b.color, PAL.ink, 'center');
    if (b.sub) PixelFont.draw(ctx, b.sub, this.W / 2, y + 22, 1, PAL.white, PAL.ink, 'center');
  }
}

window.addEventListener('load', () => { window.game = new Game(); });
