/* ============================================================
   UI - HUD, upgrade/prestige/milestone panels, dialogs, toasts.
   Cards are built once and updated in place (text is only written
   when it changes) so per-frame updates stay cheap.
   ============================================================ */
(function () {
  'use strict';
  const TB = (window.TB = window.TB || {});
  const U = TB.util, C = TB.CONFIG;
  const fmt = U.fmt;
  const $ = (id) => document.getElementById(id);

  function setText(el, txt) { if (el._t !== txt) { el._t = txt; el.textContent = txt; } }
  function setTitle(el, txt) { if (el._ti !== txt) { el._ti = txt; el.title = txt; } }
  function setCls(el, cls, on) { el.classList.toggle(cls, !!on); }

  const UI = {
    el: {}, cards: { run: {}, prestige: {} }, ms: {},
    toastQueue: [], toastShown: 0,
    wasPausedBeforeSettings: false,
    lastCredits: 0, targetTick: 0,

    init() {
      const e = this.el;
      ['vRun', 'vScore', 'vCredits', 'vBalls', 'vBallsMax', 'vDestroyed', 'vTotal', 'vPct', 'vCores', 'worldFill', 'hCredits',
        'capBalls', 'pCores', 'pInfo', 'btnPrestigeTab', 'lifeStats', 'runList', 'prestigeList', 'msList', 'stCredits',
        'btnPause', 'btnSound', 'btnSettings', 'pauseOverlay', 'btnResume', 'victory', 'vicReward', 'vicStats', 'btnPrestige',
        'btnKeep', 'escapeBanner', 'bannerReward', 'toasts', 'modalSettings', 'modalConfirm', 'panel', 'panelHandle', 'icoPause', 'icoWave',
        'setSound', 'setVolume', 'setParticles', 'setReduced', 'setShake', 'btnSetResume', 'btnSetBack', 'btnReset', 'btnConfirmNo', 'btnConfirmYes']
        .forEach((id) => { e[id] = $(id); });

      this.buildCards('run'); this.buildCards('prestige'); this.buildMilestones();

      // tabs
      document.querySelectorAll('#tabs button').forEach((b) => b.addEventListener('click', () => this.setTab(b.dataset.tab)));
      e.panelHandle.addEventListener('click', () => {
        const open = !e.panel.classList.contains('open');
        e.panel.classList.toggle('open', open);
        e.panelHandle.setAttribute('aria-expanded', open);
        TB.Audio.play('click');
      });

      // top buttons
      e.btnPause.addEventListener('click', () => TB.game.setPaused(!TB.game.paused));
      e.btnResume.addEventListener('click', () => TB.game.setPaused(false));
      e.btnSound.addEventListener('click', () => { TB.game.settings.sound = !TB.game.settings.sound; TB.game.applySettings(); TB.game.saveNow(); });
      e.btnSettings.addEventListener('click', () => this.openSettings());

      // victory
      e.btnPrestige.addEventListener('click', () => TB.Progression.prestige());
      e.btnPrestigeTab.addEventListener('click', () => TB.Progression.prestige());
      e.btnKeep.addEventListener('click', () => this.hideVictory());
      e.escapeBanner.addEventListener('click', () => this.showVictory());

      // settings
      const s = () => TB.game.settings;
      e.setSound.addEventListener('change', () => { s().sound = e.setSound.checked; TB.game.applySettings(); TB.game.saveNow(); });
      e.setVolume.addEventListener('input', () => { s().volume = e.setVolume.value / 100; TB.game.applySettings(); });
      e.setVolume.addEventListener('change', () => TB.game.saveNow());
      e.setParticles.addEventListener('change', () => { s().particles = +e.setParticles.value; TB.game.applySettings(); TB.game.saveNow(); });
      e.setReduced.addEventListener('change', () => { s().reduced = e.setReduced.checked; TB.game.applySettings(); TB.game.saveNow(); });
      e.setShake.addEventListener('change', () => { s().shake = e.setShake.checked; TB.game.applySettings(); TB.game.saveNow(); });
      e.btnSetResume.addEventListener('click', () => { this.closeSettings(); TB.game.setPaused(false); });
      e.btnSetBack.addEventListener('click', () => this.closeSettings());
      e.btnReset.addEventListener('click', () => e.modalConfirm.classList.remove('hidden'));
      e.btnConfirmNo.addEventListener('click', () => e.modalConfirm.classList.add('hidden'));
      e.btnConfirmYes.addEventListener('click', () => {
        e.modalConfirm.classList.add('hidden');
        this.closeSettings(true);
        TB.game.hardReset();
      });

      document.addEventListener('keydown', (ev) => {
        if (ev.code === 'Escape') {
          if (!e.modalConfirm.classList.contains('hidden')) e.modalConfirm.classList.add('hidden');
          else if (!e.modalSettings.classList.contains('hidden')) this.closeSettings();
        } else if ((ev.code === 'Space' || ev.code === 'KeyP') && !/INPUT|SELECT|BUTTON/.test((ev.target.tagName || ''))) {
          ev.preventDefault();
          if (e.modalSettings.classList.contains('hidden')) TB.game.setPaused(!TB.game.paused);
        }
      });
      // block pinch / double-tap zoom and context menu on the playfield
      ['gesturestart', 'gesturechange', 'gestureend'].forEach((n) => document.addEventListener(n, (ev) => ev.preventDefault()));
      document.addEventListener('contextmenu', (ev) => { if (ev.target.id === 'game') ev.preventDefault(); });
      document.addEventListener('dblclick', (ev) => ev.preventDefault());
    },

    setTab(name) {
      document.querySelectorAll('#tabs button').forEach((b) => setCls(b, 'active', b.dataset.tab === name));
      document.querySelectorAll('.tab').forEach((t) => setCls(t, 'active', t.id === 'tab' + name[0].toUpperCase() + name.slice(1)));
      TB.Audio.play('click');
      this.update(true);
    },

    // ---------- upgrade cards ----------
    buildCards(kind) {
      const host = kind === 'run' ? this.el.runList : this.el.prestigeList;
      const defs = TB.Upgrades[kind];
      for (const def of defs) {
        const d = document.createElement('div');
        d.className = 'card';
        d.innerHTML =
          '<div class="card-head"><span class="ico">' + def.icon + '</span><span class="name">' + def.name + '</span><span class="lvl"></span></div>' +
          '<p class="desc">' + def.desc + '</p>' +
          '<div class="effect"><span class="cur"></span><span class="arrow">→</span><span class="next"></span></div>' +
          '<div class="card-actions"><button class="btn buy1"></button><button class="btn buyMax"></button></div>';
        host.appendChild(d);
        const c = {
          root: d, lvl: d.querySelector('.lvl'), cur: d.querySelector('.cur'), next: d.querySelector('.next'), arrow: d.querySelector('.arrow'),
          b1: d.querySelector('.buy1'), bm: d.querySelector('.buyMax')
        };
        c.b1.addEventListener('click', () => this.buy(kind, def.id, 1));
        c.bm.addEventListener('click', () => this.buy(kind, def.id, 'max'));
        this.cards[kind][def.id] = c;
      }
    },

    buy(kind, id, count) {
      TB.Upgrades.buy(kind, id, count);
      this.update(true);
    },

    updateCards(kind) {
      const Up = TB.Upgrades;
      const money = Up.currency(kind), sym = kind === 'prestige' ? ' Cores' : '';
      for (const def of Up[kind]) {
        const c = this.cards[kind][def.id];
        const level = Up.level(kind, def), max = Up.maxLevel(def);
        const maxed = level >= max;
        const cost = Up.cost(def, level);
        const can = !maxed && money >= cost;
        setText(c.lvl, maxed ? 'MAX' : 'LV ' + level + (max < 1000 ? ' / ' + max : ''));
        setText(c.cur, def.effect(level));
        setText(c.next, maxed ? '' : def.effect(level + 1));
        c.arrow.style.display = maxed ? 'none' : '';
        setCls(c.root, 'affordable', can);
        setCls(c.root, 'maxed', maxed);
        setText(c.b1, maxed ? (max <= 0 ? 'Unavailable' : 'Maxed') : 'Buy · ' + fmt(cost) + sym);
        c.b1.disabled = !can;
        const n = maxed ? 0 : Up.affordable(kind, def);
        setText(c.bm, n > 0 ? 'Max ×' + n : 'Max');
        c.bm.disabled = n === 0;
        setTitle(c.b1, 'Cost: ' + U.fmtFull(cost));
      }
    },

    // ---------- milestones ----------
    buildMilestones() {
      const host = this.el.msList;
      const groups = [['run', 'This run (credit rewards)'], ['life', 'Lifetime (Escape Core rewards)']];
      for (const [scope, label] of groups) {
        const h = document.createElement('div'); h.className = 'ms-sep'; h.textContent = label; host.appendChild(h);
        for (const m of TB.Progression.milestones.filter((x) => x.scope === scope)) {
          const d = document.createElement('div');
          d.className = 'ms';
          const rw = m.reward.credits ? '+' + fmt(m.reward.credits) + ' credits' : '+' + m.reward.cores + ' Core' + (m.reward.cores > 1 ? 's' : '');
          d.innerHTML = '<div class="ms-top"><span>' + m.name + '</span><span class="rw">' + rw + '</span></div><div class="bar"><i></i></div><div class="pt"></div>';
          host.appendChild(d);
          this.ms[m.id] = { root: d, bar: d.querySelector('i'), pt: d.querySelector('.pt'), rw: d.querySelector('.rw'), rwText: rw };
        }
      }
    },

    updateMilestones() {
      const P = TB.Progression;
      for (const m of P.milestones) {
        const r = this.ms[m.id];
        const done = P.claimed(m);
        const p = P.progress(m);
        setCls(r.root, 'done', done);
        r.bar.style.width = (done ? 100 : p.ratio * 100).toFixed(1) + '%';
        setText(r.pt, done ? 'Claimed' : (m.unit === '%' ? U.fmtDec(p.cur, 1) + '% / ' + m.target + '%' : fmt(p.cur) + ' / ' + fmt(p.target)));
        setText(r.rw, done ? '✓ ' + r.rwText : r.rwText);
      }
    },

    // ---------- HUD + periodic refresh ----------
    update(force) {
      const g = TB.game, e = this.el;
      if (!g.run || !g.world) return;
      const run = g.run, w = g.world;
      const credits = Math.floor(run.credits);

      setText(e.vRun, 'RUN ' + run.number);
      setText(e.vScore, fmt(run.score)); setTitle(e.vScore.parentElement, 'Score: ' + U.fmtFull(run.score));
      setText(e.vCredits, fmt(credits)); setTitle(e.stCredits, 'Credits: ' + U.fmtFull(credits));
      setText(e.hCredits, '◆ ' + fmt(credits));
      setText(e.vBalls, String(g.balls.length));
      const mb = TB.Stats.maxBalls();
      setText(e.vBallsMax, '/' + mb);
      setText(e.vDestroyed, fmt(w.destroyedCount));
      setText(e.vTotal, '/' + fmt(w.total));
      setTitle(e.vDestroyed.parentElement.parentElement, 'Destroyed ' + U.fmtFull(w.destroyedCount) + ' of ' + U.fmtFull(w.total) + ' triangles');
      const pct = w.destroyedPercent();
      setText(e.vPct, U.fmtDec(pct, 1) + '%');
      setTitle(e.vPct.parentElement, 'World destruction (informational - escape the boundary to win)');
      setText(e.vCores, fmt(g.meta.cores)); setTitle(e.vCores.parentElement, 'Escape Cores: ' + U.fmtFull(g.meta.cores));
      e.worldFill.style.width = pct.toFixed(2) + '%';
      if (credits > this.lastCredits + 0 && force !== 'nopulse') { /* credits pulse handled by coins */ }
      this.lastCredits = credits;

      // cards / panels (throttled by caller, immediate when forced)
      if (force) {
        this.updateCards('run'); this.updateCards('prestige');
        setText(e.capBalls, g.balls.length + ' / ' + mb);
        setText(e.pCores, fmt(g.meta.cores));
        this.updatePrestigeBox();
        this.updateMilestones();
        if (++this.targetTick % 4 === 0) this.updateCoinTarget();
      }
    },

    updatePrestigeBox() {
      const g = TB.game, e = this.el, esc = g.run.escape;
      if (esc && !esc.claimed) {
        setText(e.pInfo, 'You escaped! Prestige to bank ' + esc.reward + ' Escape Cores and start a stronger run.');
        setText(e.btnPrestigeTab, 'Prestige  (+' + esc.reward + ' Cores)');
        e.btnPrestigeTab.classList.remove('hidden');
      } else {
        setText(e.pInfo, 'Escape the world to unlock prestige. Cores buy permanent upgrades.');
        e.btnPrestigeTab.classList.add('hidden');
      }
      const L = g.meta.life;
      const rows = [['Prestiges', g.meta.prestigeCount], ['Escapes', L.escapes], ['Lifetime score', fmt(L.score)], ['Triangles destroyed', fmt(L.destroyed)],
        ['Collisions', fmt(L.collisions)], ['Total damage', fmt(L.damage)]];
      const html = rows.map((r) => '<span>' + r[0] + '</span><b>' + r[1] + '</b>').join('');
      if (e.lifeStats._h !== html) { e.lifeStats._h = html; e.lifeStats.innerHTML = html; }
    },

    updateCoinTarget() {
      const el = this.el.vCredits, cv = TB.Renderer.canvas;
      if (!el || !cv) return;
      const r = el.getBoundingClientRect(), cr = cv.getBoundingClientRect();
      const p = TB.Renderer.screenToWorld(r.left + r.width / 2 - cr.left, r.top + r.height / 2 - cr.top);
      TB.Fx.target.x = p.x; TB.Fx.target.y = p.y; TB.Fx.target.on = true;
    },

    // ---------- state sync ----------
    syncPause() {
      const g = TB.game, e = this.el;
      const show = g.paused && e.modalSettings.classList.contains('hidden') && g.mode === 'play';
      setCls(e.pauseOverlay, 'hidden', !show);
      e.icoPause.setAttribute('d', g.paused ? 'M8 5v14l11-7z' : 'M7 5h3.5v14H7zM13.5 5H17v14h-3.5z');
    },

    syncSound() {
      const on = TB.game.settings.sound;
      this.el.btnSound.classList.toggle('off', !on);
      this.el.icoWave.style.display = on ? '' : 'none';
    },

    syncSettingsControls() {
      const s = TB.game.settings, e = this.el;
      e.setSound.checked = s.sound; e.setVolume.value = Math.round(s.volume * 100);
      e.setParticles.value = String(s.particles); e.setReduced.checked = s.reduced; e.setShake.checked = s.shake;
    },

    openSettings() {
      const g = TB.game;
      this.syncSettingsControls();
      this.wasPausedBeforeSettings = g.paused;
      g.setPaused(true);
      this.el.modalSettings.classList.remove('hidden');
      this.syncPause();
    },

    closeSettings(skipRestore) {
      this.el.modalSettings.classList.add('hidden');
      if (!skipRestore) TB.game.setPaused(this.wasPausedBeforeSettings);
      this.syncPause();
    },

    // ---------- victory ----------
    showVictory() {
      const g = TB.game, e = this.el;
      if (!g.run.escape) return;
      setText(e.vicReward, '+' + g.run.escape.reward);
      e.vicStats.innerHTML = TB.Progression.summary().map((r) => '<span>' + r[0] + '</span><b>' + r[1] + '</b>').join('');
      e.victory.classList.remove('hidden');
      e.escapeBanner.classList.add('hidden');
      this.syncPause();
    },

    hideVictory() {
      const g = TB.game, e = this.el;
      e.victory.classList.add('hidden');
      const pending = g.run && g.run.escape && !g.run.escape.claimed && g.mode === 'escaped';
      e.escapeBanner.classList.toggle('hidden', !pending);
      if (pending) setText(e.bannerReward, '+' + g.run.escape.reward + ' Cores');
    },

    // ---------- toasts (queued so events never flood the screen) ----------
    toast(o) {
      if (this.toastQueue.length > 12) this.toastQueue.shift();
      this.toastQueue.push(o);
      this.pumpToasts();
    },

    pumpToasts() {
      while (this.toastShown < 3 && this.toastQueue.length) {
        const o = this.toastQueue.shift();
        const d = document.createElement('div');
        d.className = 'toast ' + (o.kind || '');
        d.innerHTML = '<span class="t"></span><span class="m"></span><span class="r"></span>';
        d.children[0].textContent = o.title || '';
        d.children[1].textContent = o.text || '';
        d.children[2].textContent = o.reward || '';
        this.el.toasts.appendChild(d);
        this.toastShown++;
        setTimeout(() => {
          d.classList.add('out');
          setTimeout(() => { d.remove(); this.toastShown--; this.pumpToasts(); }, 300);
        }, 3400);
      }
    }
  };

  TB.UI = UI;
})();
