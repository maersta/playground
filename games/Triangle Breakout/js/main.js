/* ============================================================
   MAIN - game state, fixed-timestep loop, boot sequence
   ============================================================ */
(function () {
  'use strict';
  const TB = (window.TB = window.TB || {});
  const C = TB.CONFIG, P = C.physics;

  // callbacks handed to the physics step
  const ev = {
    speed: 200,
    onHit: (ball, tri, x, y, nx, ny) => TB.Economy.onHit(ball, tri, x, y, nx, ny),
    onEscape: (ball) => TB.Progression.onEscape(ball)
  };

  const Game = (TB.game = {
    settings: TB.Save.defaultSettings(),
    meta: TB.Save.defaultMeta(),
    run: null, world: null,
    balls: [], flashList: [], ballSeq: 0,
    paused: false,
    mode: 'play',            // 'play' | 'escaping' (celebration) | 'escaped' (frozen, awaiting prestige)
    escapeTimer: 0, escapeBall: null,
    acc: 0, lastTs: 0,
    saveTimer: 0, uiTimer: 0, msTimer: 0,
    hudDirty: true, saveDirty: false, milestoneDirty: false,

    // ---------- balls ----------
    addBall(first) {
      const id = ++this.ballSeq, speed = TB.Stats.speed();
      let x = 0, y = 0, ang;
      if (first) {
        ang = this.world.startVector().angle;       // deterministic: toward the nearest triangle
      } else {
        const spot = TB.Physics.findFreeSpot(this.world, P.ballRadius, id);
        x = spot.x; y = spot.y;
        ang = id * 2.39996 + 0.4;                   // golden-angle spread -> independent paths
        TB.Fx.ring(x, y, 40, 190, 0.5);
      }
      this.balls.push(TB.Physics.makeBall(id, x, y, ang, speed));
      this.hudDirty = true;
    },

    rescaleBalls() {
      const sp = TB.Stats.speed();
      for (const b of this.balls) {
        const cur = Math.hypot(b.vx, b.vy) || 1;
        b.vx *= sp / cur; b.vy *= sp / cur;
      }
    },

    // ---------- settings / pause ----------
    applySettings() {
      const s = this.settings;
      TB.Audio.setEnabled(s.sound);
      TB.Audio.setVolume(s.volume);
      TB.Fx.setQuality(s.particles);
      TB.Fx.reduced = s.reduced;
      TB.Renderer.reduced = s.reduced;
      TB.Renderer.shakeOn = s.shake;
      TB.UI.syncSound();
    },

    setPaused(p) {
      this.paused = !!p;
      this.acc = 0; this.lastTs = 0;
      TB.UI.syncPause();
    },

    // ---------- persistence ----------
    saveNow() {
      if (!this.run || !this.world) return;
      TB.Save.save(this);
      this.saveTimer = 0; this.saveDirty = false;
    },

    loadFromSave(d) {
      this.settings = d.settings;
      this.meta = d.meta;
      this.run = d.run;
      this.world = new TB.World(d.world, d.run.seed);
      this.world.applyDestroyed(d.destroyed);
      this.world.applyDamaged(d.damaged);
      this.balls = []; this.flashList.length = 0; this.ballSeq = 0;
      const sp = TB.Stats.speed();
      for (const s of d.balls) {
        const b = TB.Physics.makeBall(++this.ballSeq, s[0], s[1], 0, sp);
        const cur = Math.hypot(s[2], s[3]);
        if (cur > 1e-3) { b.vx = (s[2] / cur) * sp; b.vy = (s[3] / cur) * sp; }
        else { b.vx = sp; b.vy = 0; }
        this.balls.push(b);
      }
      if (!this.balls.length) this.addBall(true);
      const want = Math.min(TB.Stats.maxBalls(), 1 + (this.run.upgrades.extraBall | 0));
      while (this.balls.length < want) this.addBall(false);
      this.mode = this.run.escape ? 'escaped' : 'play';
    },

    hardReset() {
      TB.Save.wipe();
      this.settings = TB.Save.defaultSettings();
      this.meta = TB.Save.defaultMeta();
      TB.Progression.busy = false;
      TB.Progression.newRun(1, C.world.baseSeed);
      this.paused = false; this.acc = 0;
      TB.UI.hideVictory();
      this.applySettings();
      TB.UI.syncPause();
      TB.UI.update(true);
      this.saveNow();
    },

    // ---------- simulation ----------
    stepFixed(dt) {
      ev.speed = TB.Stats.speed();
      const balls = this.balls, world = this.world;
      for (let i = 0; i < balls.length; i++) {
        TB.Physics.stepBall(balls[i], dt, world, ev);
        if (this.mode !== 'play') return;         // a ball escaped: freeze everything
      }
      this.run.stats.time += dt;
      TB.Economy.processExplosions();
    },

    decayFlashes(dt) {
      const l = this.flashList;
      for (let i = l.length - 1; i >= 0; i--) {
        const t = l[i];
        t.flash -= dt * 6;
        if (t.flash <= 0) { t.flash = 0; l[i] = l[l.length - 1]; l.pop(); }
      }
    },

    frame(ts) {
      requestAnimationFrame(Game.frame);
      const g = Game;
      if (!g.lastTs) g.lastTs = ts;
      let dt = (ts - g.lastTs) / 1000;
      g.lastTs = ts;
      // clamp: returning to a tab / stalls never fast-forward the game (no offline progress)
      if (dt > P.maxFrame) dt = P.maxFrame; else if (dt < 0) dt = 0;

      if (!g.paused) {
        if (g.mode === 'play') {
          g.acc += dt;
          while (g.acc >= P.step) {
            g.stepFixed(P.step);
            g.acc -= P.step;
            if (g.mode !== 'play') { g.acc = 0; break; }
          }
        } else if (g.mode === 'escaping') {
          g.escapeTimer += dt;
          const b = g.escapeBall;
          if (b) { b.px = b.x; b.py = b.y; b.x += b.vx * dt; b.y += b.vy * dt; }   // cosmetic drift only
          if (g.escapeTimer > 1.7) {
            g.mode = 'escaped';
            TB.UI.showVictory();
          }
        }
        TB.Fx.update(dt);
        g.decayFlashes(dt);

        g.saveTimer += dt;
        if (g.saveTimer >= (C.save.autosaveSeconds * (g.saveDirty ? 0.6 : 1))) g.saveNow();
        g.msTimer += dt;
        if (g.milestoneDirty || g.msTimer > 0.4) { g.msTimer = 0; g.milestoneDirty = false; TB.Progression.check(); }
      }

      g.uiTimer += dt;
      const slow = g.uiTimer >= 0.25;
      if (slow) g.uiTimer = 0;
      if (slow || g.hudDirty) { TB.UI.update(slow); g.hudDirty = false; }

      const alpha = g.mode === 'play' ? Math.min(1, g.acc / P.step) : 1;
      TB.Renderer.draw(g, alpha, dt);
    },

    boot() {
      const canvas = document.getElementById('game');
      TB.Audio.init();
      TB.Renderer.init(canvas);
      TB.UI.init();

      const data = TB.Save.load();
      let loaded = false;
      if (data) {
        try { this.loadFromSave(data); loaded = true; }
        catch (e) { console.warn('Save could not be restored, starting fresh', e); }
      }
      if (!loaded) {
        this.settings = TB.Save.defaultSettings();
        this.meta = TB.Save.defaultMeta();
        TB.Progression.newRun(1, C.world.baseSeed);
      }

      // canvas follows its container (window resize, orientation, mobile drawer)
      const arena = document.getElementById('arena');
      const fit = () => {
        const r = arena.getBoundingClientRect();
        TB.Renderer.resize(r.width, r.height);
        TB.UI.updateCoinTarget();
      };
      if (window.ResizeObserver) new ResizeObserver(fit).observe(arena);
      window.addEventListener('resize', fit);
      window.addEventListener('orientationchange', () => setTimeout(fit, 200));
      fit();

      this.applySettings();
      TB.UI.syncPause();
      TB.UI.update(true);
      if (this.mode === 'escaped') TB.UI.showVictory();

      // persistence safety nets + hidden-tab handling (rendering stops; the simulation never catches up)
      const flush = () => this.saveNow();
      window.addEventListener('pagehide', flush);
      window.addEventListener('beforeunload', flush);
      document.addEventListener('visibilitychange', () => {
        if (document.hidden) flush();
        this.lastTs = 0; this.acc = 0;
      });

      requestAnimationFrame(Game.frame);
    }
  });

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => Game.boot());
  else Game.boot();
})();
