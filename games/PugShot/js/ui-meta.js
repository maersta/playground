/* =========================================================
   ui-meta.js - DOM screens for the meta game: shop, worlds,
   ascension / perks, quests & trophies and the daily gift.
   Extends the UI object from ui.js.
   ========================================================= */
'use strict';

Object.assign(UI, {
  shopTab: 'sling',
  shopFrom: 'menu',

  initMeta(game) {
    const $ = this.$;
    $('shop-title').appendChild(PixelFont.toCanvas('SHOP', 4, PAL.pink, PAL.dkpink, PAL.ink));
    $('worlds-title').appendChild(PixelFont.toCanvas('WORLDS', 4, PAL.ltsky, PAL.blue, PAL.ink));
    $('ascend-title').appendChild(PixelFont.toCanvas('ASCEND', 4, PAL.gold, PAL.orange, PAL.ink));
    $('quests-title').appendChild(PixelFont.toCanvas('QUESTS', 4, '#c8a0ff', PAL.purple, PAL.ink));
    $('daily-title').appendChild(PixelFont.toCanvas('DAILY GIFT', 3, PAL.lime, PAL.green, PAL.ink));

    const click = (id, fn) => $(id).addEventListener('click', e => {
      e.stopPropagation();
      AudioSystem.unlock();
      AudioSystem.click();
      fn();
    });
    click('btn-shop', () => this.showShop('menu'));
    click('btn-shop-back', () => this.showMenu());
    click('btn-worlds', () => this.showWorlds());
    click('btn-worlds-back', () => this.showMenu());
    click('btn-worlds-play', () => game.startRun());
    click('btn-worlds-ascend', () => this.showAscend('worlds'));
    click('btn-ascend-back', () => (this.ascendFrom === 'results' ? this.show('results') : this.showWorlds()));
    click('btn-quests', () => this.showQuests());
    click('btn-quests-back', () => this.showMenu());
    click('btn-res-ascend', () => this.showAscend('results'));
    click('btn-daily-claim', () => { Meta.claimDaily(); AudioSystem.record(); this.showMenu(); });
  },

  /* ---------------- shared helpers ---------------- */
  canvasFrom(src, cls) {
    const c = document.createElement('canvas');
    c.width = src.width; c.height = src.height;
    c.className = cls;
    c.getContext('2d').drawImage(src, 0, 0);
    return c;
  },

  /** Build a card; opts: {preview, name, level, desc, rows, btn, cls, flash}. */
  makeCard(o) {
    const card = document.createElement('div');
    card.className = 'upg-card ' + (o.cls || '') + (o.flash ? ' flash' : '');
    const head = document.createElement('div');
    head.className = 'upg-head';
    if (o.preview) head.appendChild(o.preview);
    const title = document.createElement('div');
    title.innerHTML = `<div class="upg-name">${o.name}</div>` + (o.level ? `<div class="upg-level">${o.level}</div>` : '');
    head.appendChild(title);
    card.appendChild(head);
    if (o.bar !== undefined) {
      let bar = '<div class="upg-bar">';
      for (let i = 0; i < o.barMax; i++) bar += `<span class="${i < o.bar ? 'on' : ''}"></span>`;
      card.insertAdjacentHTML('beforeend', bar + '</div>');
    }
    card.insertAdjacentHTML('beforeend', `<div class="upg-desc">${o.desc || ''}</div>`);
    for (const r of o.rows || []) {
      card.insertAdjacentHTML('beforeend',
        `<div class="upg-row"><span class="k">${r[0]}</span><span class="v ${r[2] || ''}">${r[1]}</span></div>`);
    }
    if (o.btn) {
      const b = document.createElement('button');
      b.className = 'pixel-btn ' + (o.btn.cls || '');
      b.textContent = o.btn.text;
      b.disabled = !!o.btn.disabled;
      b.addEventListener('click', e => {
        e.stopPropagation();
        AudioSystem.unlock();
        o.btn.onclick();
      });
      card.appendChild(b);
    }
    return card;
  },

  /* ---------------- Shop ---------------- */
  showShop(from, tab) {
    this.shopFrom = from;
    if (tab) this.shopTab = tab;
    this.renderShop();
    this.show('shop');
  },

  renderShop(flashId) {
    const d = SaveSystem.data, $ = this.$;
    $('shop-coins').textContent = d.coins;
    $('shop-stars').textContent = d.stars;
    const tabs = $('shop-tabs');
    tabs.innerHTML = '';
    for (const [id, label] of [['sling', 'SLINGSHOTS'], ['skin', 'SKINS'], ['hat', 'HATS'], ['boost', 'BOOSTS']]) {
      const b = document.createElement('button');
      b.className = 'tab' + (this.shopTab === id ? ' on' : '');
      b.textContent = label;
      b.addEventListener('click', e => { e.stopPropagation(); AudioSystem.click(); this.shopTab = id; this.renderShop(); });
      tabs.appendChild(b);
    }
    const grid = $('shop-grid');
    grid.innerHTML = '';
    if (this.shopTab === 'boost') {
      for (const b of BOOSTS) grid.appendChild(this.boostCard(b, flashId === b.id));
      return;
    }
    const kind = this.shopTab;
    for (const it of Meta.items(kind)) grid.appendChild(this.itemCard(kind, it, flashId === it.id));
  },

  itemPreview(kind, it) {
    if (kind === 'sling') return this.canvasFrom(Sprites.slingshotFor(it.id), 'prev prev-sling');
    if (kind === 'skin') return this.canvasFrom(Sprites.makePug('happy', 0, it.id, 'none').toCanvas(), 'prev');
    const skin = SaveSystem.data.skin;
    return this.canvasFrom(Sprites.makePug('idle', 0, skin, it.id).toCanvas(), 'prev');
  },

  itemCard(kind, it, flash) {
    const d = SaveSystem.data;
    const owned = Meta.owns(kind, it.id), equipped = d[kind] === it.id;
    let btn;
    if (equipped) btn = { text: 'EQUIPPED', disabled: true, onclick() {} };
    else if (owned) btn = { text: 'EQUIP', cls: 'btn-blue', onclick: () => { AudioSystem.click(); Meta.equip(kind, it.id); this.renderShop(it.id); } };
    else if (!it.price) btn = { text: 'LOCKED', disabled: true, cls: 'btn-red', onclick() {} };
    else {
      const ok = Meta.canAfford(it.price);
      btn = {
        text: 'BUY  ' + Meta.priceText(it.price), cls: ok ? 'btn-green' : 'btn-red', disabled: !ok,
        onclick: () => {
          if (Meta.buy(kind, it.id)) { AudioSystem.purchase(); Meta.equip(kind, it.id); this.renderShop(it.id); } else AudioSystem.denied();
        }
      };
    }
    return this.makeCard({
      preview: this.itemPreview(kind, it), name: it.name, desc: it.desc, btn, flash,
      level: equipped ? 'EQUIPPED' : owned ? 'OWNED' : it.price ? Meta.priceText(it.price) : 'TROPHY REWARD',
      cls: equipped ? 'maxed' : owned ? '' : 'locked'
    });
  },

  boostCard(b, flash) {
    const d = SaveSystem.data, have = d.boosts[b.id];
    const icon = b.icon === 'heart' ? Sprites.heart.full : b.icon === 'coin' ? Sprites.coin[0] : Sprites.icons[b.icon];
    const full = have >= b.max, ok = d.coins >= b.price;
    return this.makeCard({
      preview: this.canvasFrom(icon, 'upg-icon'), name: b.name, level: `OWNED ${have} / ${b.max}`, desc: b.desc, flash,
      rows: [['COST', b.price + ' coins', ''], ['USED', 'automatically at launch', '']],
      btn: {
        text: full ? 'FULL' : 'BUY', cls: full ? '' : ok ? 'btn-green' : 'btn-red', disabled: full || !ok,
        onclick: () => { if (Meta.buyBoost(b.id)) { AudioSystem.purchase(); this.renderShop(b.id); } else AudioSystem.denied(); }
      }
    });
  },

  /* ---------------- Worlds ---------------- */
  showWorlds() {
    this.renderWorlds();
    this.show('worlds');
  },

  renderWorlds() {
    const d = SaveSystem.data, $ = this.$;
    $('worlds-stars').textContent = d.stars;
    const asc = $('btn-worlds-ascend');
    asc.textContent = Meta.canAscend() ? 'ASCEND +★' + Meta.ascendGain() : 'ASCEND ★';
    asc.classList.toggle('pulse', Meta.canAscend());
    const grid = $('worlds-grid');
    grid.innerHTML = '';
    for (const w of WORLDS) {
      const unlocked = Meta.worldUnlocked(w.id), sel = d.world === w.id;
      const sky = BIOMES[w.bio[0][1]].sky;
      const prev = document.createElement('div');
      prev.className = 'world-prev';
      prev.style.background = `linear-gradient(${sky.join(',')})`;
      prev.innerHTML = `<i style="background:${BIOMES[w.bio[0][1]].top}"></i>`;
      const need = w.id - d.ascensions;
      grid.appendChild(this.makeCard({
        preview: prev, name: w.name, level: 'WORLD ' + (w.id + 1), desc: w.desc,
        cls: sel ? 'maxed' : unlocked ? '' : 'locked',
        rows: [
          ['COINS', 'x' + w.coin, w.coin > 1 ? 'next' : ''],
          ['GRAVITY', Math.round(w.gravity * 100) + '%', ''],
          ['DANGER', '★'.repeat(w.id + 1), ''],
          ['BEST', Math.floor(d.worldBest[w.id]) + 'm', '']
        ],
        btn: sel ? { text: 'SELECTED', disabled: true, onclick() {} }
          : unlocked ? { text: 'SELECT', cls: 'btn-blue', onclick: () => { AudioSystem.click(); d.world = w.id; SaveSystem.save(); this.game.setupScene(); this.renderWorlds(); } }
            : { text: `ASCEND ${need}x MORE`, cls: 'btn-red', disabled: true, onclick() {} }
      }));
    }
  },

  /* ---------------- Ascend (prestige) ---------------- */
  showAscend(from) {
    this.ascendFrom = from;
    this.renderAscend();
    this.show('ascend');
  },

  renderAscend(flashId) {
    const d = SaveSystem.data, $ = this.$;
    $('ascend-stars').textContent = d.stars;
    const gain = Meta.ascendGain(), can = Meta.canAscend();
    const need = ASCEND_MIN_STARS * ASCEND_DIVISOR;
    const pct = Math.min(100, Math.round(d.ascScore / need * 100));
    const nextWorld = WORLDS[d.ascensions + 1];
    const box = $('ascend-box');
    box.innerHTML =
      `<div class="asc-line">ASCENSION <b>${d.ascensions}</b>  |  BEST THIS CYCLE <b>${d.ascScore}</b> pts</div>` +
      `<div class="asc-bar"><span style="width:${pct}%"></span></div>` +
      `<div class="asc-line">${can ? `Ascend now for <b class="star-text">★${gain}</b> stars` : `Reach ${need} pts (about 1000m) to ascend`}</div>` +
      `<div class="asc-note">Resets coins &amp; upgrades. Keeps slingshots, skins, hats, perks, trophies &amp; records.` +
      (nextWorld ? `<br>Unlocks: <b>${nextWorld.name}</b> (x${nextWorld.coin} coins)` : '<br>All worlds unlocked - keep ascending for more stars!') +
      `<br>Distance in later worlds scores more points.</div>`;
    const btn = document.createElement('button');
    btn.className = 'pixel-btn btn-yellow' + (can ? ' pulse' : '');
    btn.textContent = can ? 'ASCEND NOW' : 'NOT READY';
    btn.disabled = !can;
    btn.addEventListener('click', e => {
      e.stopPropagation();
      AudioSystem.click();
      this.confirm(`Ascend and gain <b>★${gain}</b>?<br>Coins and upgrades reset!`, () => {
        const g = Meta.ascend();
        AudioSystem.record();
        this.game.setupScene();
        this.ascendFrom = 'worlds';
        this.renderAscend();
        this.show('ascend');
        const el = this.$('ascend-box');
        el.insertAdjacentHTML('afterbegin', `<div class="asc-flash">ASCENDED! +★${g}</div>`);
      }, 'ASCEND');
    });
    box.appendChild(btn);

    const grid = $('ascend-grid');
    grid.innerHTML = '';
    for (const p of PERKS) {
      const lvl = Meta.perkLevel(p.id), maxed = lvl >= MAX_PERK_LEVEL, cost = Meta.perkCost(p.id);
      const ok = !maxed && d.stars >= cost;
      grid.appendChild(this.makeCard({
        preview: this.canvasFrom(Sprites.icons[p.icon], 'upg-icon'), name: p.name, level: `LEVEL ${lvl} / ${MAX_PERK_LEVEL}`,
        bar: lvl, barMax: MAX_PERK_LEVEL, desc: p.desc, cls: maxed ? 'maxed' : '', flash: flashId === p.id,
        rows: [
          ['CURRENT', p.fmt(lvl), ''],
          ['NEXT', maxed ? '-' : p.fmt(lvl + 1), 'next'],
          ['COST', maxed ? 'MAXED' : '★' + cost, '']
        ],
        btn: {
          text: maxed ? 'MAX LEVEL' : 'UPGRADE', cls: maxed ? '' : ok ? 'btn-green' : 'btn-red', disabled: !ok,
          onclick: () => { if (Meta.buyPerk(p.id)) { AudioSystem.purchase(); this.renderAscend(p.id); } else AudioSystem.denied(); }
        }
      }));
    }
  },

  /* ---------------- Quests & trophies ---------------- */
  showQuests() {
    Meta.ensureMissions();
    const d = SaveSystem.data;
    let html = '<div class="q-head">MISSIONS</div>';
    for (const m of d.missions) {
      const pct = Math.min(100, Math.round(m.prog / m.target * 100));
      html += `<div class="q-row"><div class="q-top"><span>${Meta.missionText(m)}</span><span class="q-rew">+${m.reward}</span></div>` +
        `<div class="asc-bar small"><span style="width:${pct}%"></span></div><div class="q-sub">${Math.min(m.prog, m.target)} / ${m.target}</div></div>`;
    }
    const done = ACHIEVEMENTS.filter(a => d.achieved[a.id]).length;
    html += `<div class="q-head">TROPHIES  ${done} / ${ACHIEVEMENTS.length}</div>`;
    for (const a of ACHIEVEMENTS) {
      const got = d.achieved[a.id], v = Math.min(a.val(d), a.target), pct = Math.round(v / a.target * 100);
      html += `<div class="q-row ${got ? 'got' : ''}"><div class="q-top"><span>${got ? '✓ ' : ''}${a.name}</span><span class="q-rew">${Meta.rewardText(a.reward)}</span></div>` +
        `<div class="q-sub">${a.desc}${got ? '' : '  (' + Math.floor(v) + ' / ' + a.target + ')'}</div>` +
        (got ? '' : `<div class="asc-bar small"><span style="width:${pct}%"></span></div>`) + '</div>';
    }
    this.$('quests-body').innerHTML = html;
    this.show('quests');
  },

  /* ---------------- Daily gift ---------------- */
  showDaily() {
    const pv = Meta.dailyPreview();
    let days = '';
    for (let i = 1; i <= 7; i++) days += `<span class="${i < pv.day ? 'past' : i === pv.day ? 'now' : ''}">${i}</span>`;
    this.$('daily-body').innerHTML =
      `<div class="daily-days">${days}</div>` +
      `<div class="daily-rew">DAY ${pv.day} STREAK</div>` +
      `<div class="daily-rew big">+${pv.coins} coins` + (pv.stars ? `<br><span class="star-text">+★${pv.stars} stars</span>` : '') + '</div>';
    this.show('daily');
  }
});
