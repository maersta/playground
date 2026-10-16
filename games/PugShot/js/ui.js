/* =========================================================
   ui.js - DOM menus: main menu, upgrades, how-to, stats,
   results, pause and confirm dialogs.
   ========================================================= */
'use strict';

const UI = {
  game: null,
  $: id => document.getElementById(id),
  overlays: ['menu', 'upgrades', 'howto', 'stats', 'results', 'pause', 'confirm', 'shop', 'worlds', 'ascend', 'quests', 'daily'],
  current: null,
  resultTimers: [],

  init(game) {
    this.game = game;
    const $ = this.$;

    // Pixel-font headings
    this.buildTitle();
    $('upgrades-title').appendChild(PixelFont.toCanvas('UPGRADES', 4, PAL.gold, PAL.gold2, PAL.ink));
    $('howto-title').appendChild(PixelFont.toCanvas('HOW TO PLAY', 4, PAL.ltsky, PAL.blue, PAL.ink));
    $('stats-title').appendChild(PixelFont.toCanvas('STATS', 4, PAL.lime, PAL.green, PAL.ink));
    $('results-title').appendChild(PixelFont.toCanvas('RUN OVER', 5, PAL.red2, PAL.red, PAL.ink));
    $('pause-title').appendChild(PixelFont.toCanvas('PAUSED', 4, PAL.white, PAL.grey, PAL.ink));

    const click = (id, fn) => $(id).addEventListener('click', e => {
      e.stopPropagation();
      AudioSystem.unlock();
      AudioSystem.click();
      fn();
    });
    click('btn-play', () => game.startRun());
    click('btn-upgrades', () => this.showUpgrades('menu'));
    click('btn-howto', () => this.show('howto'));
    click('btn-howto-back', () => this.showMenu());
    click('btn-stats', () => this.showStats());
    click('btn-stats-back', () => this.showMenu());
    click('btn-upg-back', () => (this.upgradesFrom === 'results' ? this.show('results') : this.showMenu()));
    click('btn-upg-play', () => game.startRun());
    click('btn-res-again', () => game.startRun());
    click('btn-res-upgrades', () => this.showUpgrades('results'));
    click('btn-res-menu', () => game.toMenu());
    click('btn-mute', () => this.toggleMute());
    click('btn-mute-hud', () => this.toggleMute());
    click('btn-pause', () => game.pause());
    click('btn-resume', () => game.resume());
    click('btn-restart', () => game.startRun());
    click('btn-quit', () => game.toMenu());
    click('btn-end-run', () => { game.resume(); game.endRun('GAVE UP'); });
    click('btn-reset', () => this.confirm('Reset ALL progress?<br>Coins, upgrades and records<br>will be lost forever!', () => {
      SaveSystem.reset();
      Sprites.applyLook();
      game.setupScene();
      this.showMenu();
    }));
    click('btn-confirm-no', () => this.show(this.confirmReturn || 'menu'));
    click('btn-confirm-yes', () => { const fn = this.confirmFn; this.confirmFn = null; if (fn) fn(); });

    this.updateMuteLabels();
    this.initMeta(game);
  },

  buildTitle() {
    const text = PixelFont.toCanvas('MOPS', 12, PAL.gold, PAL.orange, PAL.ink);
    const pugScale = 4;
    const spr = Sprites.pug.happy_1;
    const c = document.createElement('canvas');
    c.width = text.width + spr.width * pugScale + 8;
    c.height = Math.max(text.height, spr.height * pugScale) + 4;
    const ctx = c.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(text, 0, Math.round((c.height - text.height) / 2));
    ctx.drawImage(spr, text.width + 4, c.height - spr.height * pugScale - 2, spr.width * pugScale, spr.height * pugScale);
    c.style.width = Math.min(c.width, 360) + 'px';
    this.$('title-holder').appendChild(c);
    this.titleCanvas = c;
  },

  show(name) {
    for (const o of this.overlays) this.$(o).classList.toggle('hidden', o !== name);
    this.current = name;
  },
  hideAll() { this.show(null); },

  setHudVisible(v) { this.$('hud-buttons').classList.toggle('hidden', !v); },

  showMenu() {
    const d = SaveSystem.data;
    Meta.ensureMissions();
    const w = Meta.world();
    this.$('menu-best').textContent = Math.floor(Meta.bestHere()) + 'm';
    this.$('menu-coins').textContent = d.coins;
    this.$('menu-stars').textContent = d.stars;
    this.$('menu-stars-box').classList.toggle('hidden', d.totalStars === 0 && d.ascensions === 0);
    this.$('menu-world').innerHTML = `<span>WORLD ${w.id + 1}</span> ${w.name}` + (d.ascensions ? ` <span class="asc-tag">&#9733;${d.ascensions}</span>` : '');
    this.$('quest-dot').classList.toggle('hidden', !Meta.dailyReady());
    this.updateMuteLabels();
    this.show('menu');
    if (Meta.dailyReady()) this.showDaily();
  },

  toggleMute() {
    const d = SaveSystem.data;
    d.muted = !d.muted;
    AudioSystem.setMuted(d.muted);
    SaveSystem.save();
    this.updateMuteLabels();
  },
  updateMuteLabels() {
    const m = SaveSystem.data.muted;
    this.$('btn-mute').textContent = 'SOUND: ' + (m ? 'OFF' : 'ON');
    this.$('btn-mute-hud').classList.toggle('off', m);
  },

  confirm(html, fn, yesLabel = 'YES, RESET') {
    this.confirmReturn = this.current;
    this.confirmFn = fn;
    this.$('btn-confirm-yes').textContent = yesLabel;
    this.$('confirm-text').innerHTML = html;
    this.show('confirm');
  },

  /* ---------------- Upgrades ---------------- */
  showUpgrades(from) {
    this.upgradesFrom = from;
    this.renderUpgrades();
    this.show('upgrades');
  },

  renderUpgrades(flashId) {
    const grid = this.$('upgrade-grid');
    this.$('upg-coins').textContent = SaveSystem.data.coins;
    grid.innerHTML = '';
    for (const def of UpgradeSystem.defs) {
      const lvl = UpgradeSystem.level(def.id);
      const maxed = lvl >= MAX_UPGRADE_LEVEL;
      const cost = UpgradeSystem.cost(def.id);
      const card = document.createElement('div');
      card.className = 'upg-card' + (maxed ? ' maxed' : '') + (flashId === def.id ? ' flash' : '');

      const head = document.createElement('div');
      head.className = 'upg-head';
      const icon = document.createElement('canvas');
      icon.className = 'upg-icon';
      icon.width = 30; icon.height = 30;
      icon.getContext('2d').drawImage(Sprites.icons[def.icon], 0, 0);
      head.appendChild(icon);
      const title = document.createElement('div');
      title.innerHTML = `<div class="upg-name">${def.name}</div><div class="upg-level">LEVEL ${lvl} / ${MAX_UPGRADE_LEVEL}</div>`;
      head.appendChild(title);
      card.appendChild(head);

      let bar = '<div class="upg-bar">';
      for (let i = 0; i < MAX_UPGRADE_LEVEL; i++) bar += `<span class="${i < lvl ? 'on' : ''}"></span>`;
      bar += '</div>';
      card.insertAdjacentHTML('beforeend', bar +
        `<div class="upg-desc">${def.desc}</div>` +
        `<div class="upg-row"><span class="k">CURRENT</span><span class="v">${def.fmt(lvl)}</span></div>` +
        `<div class="upg-row"><span class="k">NEXT</span><span class="v next">${maxed ? '-' : def.fmt(lvl + 1)}</span></div>` +
        `<div class="upg-row"><span class="k">COST</span><span class="v" style="color:${maxed ? '#7cc456' : '#ffe066'}">${maxed ? 'MAXED' : cost + ' coins'}</span></div>`);

      const btn = document.createElement('button');
      btn.className = 'pixel-btn ' + (maxed ? '' : UpgradeSystem.canBuy(def.id) ? 'btn-green' : 'btn-red');
      btn.textContent = maxed ? 'MAX LEVEL' : 'UPGRADE';
      btn.disabled = maxed || !UpgradeSystem.canBuy(def.id);
      btn.addEventListener('click', e => {
        e.stopPropagation();
        AudioSystem.unlock();
        if (UpgradeSystem.buy(def.id)) {
          AudioSystem.purchase();
          this.renderUpgrades(def.id);
        } else AudioSystem.denied();
      });
      card.appendChild(btn);
      grid.appendChild(card);
    }
  },

  /* ---------------- Stats ---------------- */
  showStats() {
    const d = SaveSystem.data;
    const rows = [
      ['Best distance', Math.floor(d.best) + ' m'],
      ['Ascensions', d.ascensions],
      ['Stars earned', d.totalStars],
      ['Trophies', Object.keys(d.achieved).length + ' / ' + ACHIEVEMENTS.length],
      ['Best score', Math.floor(d.bestScore)],
      ['Total distance', Math.floor(d.totalDistance) + ' m'],
      ['Runs played', d.runs],
      ['Lifetime coins', d.totalCoins],
      ['Total bounces', d.bounces],
      ['Objects smashed', d.broken],
      ['Top speed', Math.round(d.maxSpeed) + ' m/s'],
      ['Best combo', d.maxCombo]
    ];
    this.$('stats-list').innerHTML = rows.map(r => `<div><span>${r[0]}</span><span>${r[1]}</span></div>`).join('');
    this.show('stats');
  },

  /* ---------------- Results (animated count-up) ---------------- */
  showResults(res) {
    for (const t of this.resultTimers) clearTimeout(t);
    this.resultTimers = [];
    this.$('results-reason').textContent = res.reason;
    this.$('results-record').classList.add('hidden');
    const rowsEl = this.$('results-rows');
    rowsEl.innerHTML = '';
    const coinsEl = this.$('results-coins');
    coinsEl.textContent = '0';

    const rows = [
      { label: 'DISTANCE', value: res.distance, suffix: ' m' },
      { label: 'BEST', value: res.best, suffix: ' m' },
      { label: 'SCORE', value: res.score },
      { label: 'MAX COMBO', value: res.maxCombo, prefix: 'x' },
      { label: 'COINS COLLECTED', value: res.coinsCollected, cls: 'bonus', prefix: '+' },
      { label: 'DISTANCE BONUS', value: res.distanceBonus, cls: 'bonus', prefix: '+' },
      { label: 'SCORE BONUS', value: res.scoreBonus, cls: 'bonus', prefix: '+' }
    ];
    if (res.multBonus) rows.push({ label: 'WORLD & PERK BONUS ' + res.multLabel, value: res.multBonus, cls: 'bonus', prefix: '+' });
    if (res.recordBonus) rows.push({ label: 'NEW RECORD BONUS', value: res.recordBonus, cls: 'bonus', prefix: '+' });
    if (res.luckyBonus) rows.push({ label: '☘ LUCKY PUG BONUS', value: res.luckyBonus, cls: 'lucky', prefix: '+' });

    this.show('results');
    let delay = 250;
    rows.forEach((r) => {
      const el = document.createElement('div');
      el.className = 'res-row ' + (r.cls || '');
      el.innerHTML = `<span>${r.label}</span><span class="rv">${r.prefix || ''}0${r.suffix || ''}</span>`;
      rowsEl.appendChild(el);
      this.resultTimers.push(setTimeout(() => {
        el.classList.add('show');
        this.countUp(el.querySelector('.rv'), r.value, r.prefix || '', r.suffix || '', 350);
        AudioSystem.tick();
      }, delay));
      delay += 170;
    });
    const evEl = this.$('results-events');
    evEl.innerHTML = '';
    this.$('btn-res-ascend').classList.toggle('hidden', !res.ascendReady);
    (res.events || []).forEach(ev => {
      this.resultTimers.push(setTimeout(() => {
        const el = document.createElement('div');
        el.className = 'res-row show ' + (ev.gold ? 'lucky' : 'bonus');
        el.innerHTML = `<span>${ev.text}</span><span class="rv">${ev.value}</span>`;
        evEl.appendChild(el);
        AudioSystem.purchase();
      }, delay));
      delay += 260;
    });
    this.resultTimers.push(setTimeout(() => {
      this.countUp(coinsEl, res.totalCoins, '', '', 700, true);
      if (res.newRecord) {
        this.$('results-record').classList.remove('hidden');
        AudioSystem.record();
      } else AudioSystem.purchase();
    }, delay + 100));
  },

  countUp(el, target, prefix, suffix, ms, coinSound) {
    target = Math.floor(target);
    const start = performance.now();
    const stepFn = now => {
      const t = Math.min(1, (now - start) / ms);
      const v = Math.floor(target * (1 - Math.pow(1 - t, 3)));
      el.textContent = prefix + v + suffix;
      if (coinSound && t < 1) AudioSystem.tick();
      if (t < 1) requestAnimationFrame(stepFn);
    };
    requestAnimationFrame(stepFn);
  }
};
