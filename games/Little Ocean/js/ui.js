/* Little Ocean - DOM interface: screens, HUD, journal, evolution tree, settings, map, toasts. */
window.LO = window.LO || {};
LO.UI = (function () {
  const CFG = LO.CFG, U = LO.U, TAU = Math.PI * 2;
  const $ = (id) => document.getElementById(id);
  const stack = [];                       // open modal screens, topmost last
  const LOCKED = { evochoice: 1, death: 1 };   // cannot be dismissed with Back/Esc
  let journalTab = 'fish', hudCache = {}, tipTimer = 0, bannerTimer = 0, confirmCb = null, mapCtx = null;
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const save = () => LO.Save.data;

  /* ---------- screens ---------- */
  function open(name) {
    const el = $('screen-' + name);
    if (!el || stack.includes(name)) return;
    if (name === 'journal') renderJournal();
    if (name === 'evo') renderEvoTree();
    if (name === 'settings') syncSettings();
    if (name === 'map') { const c = $('mapCanvas'); mapCtx = c.getContext('2d'); }
    stack.push(name); el.classList.add('open');
    LO.Audio.click();
    const first = el.querySelector('.btn.big, .evo-card, .btn');
    if (first && name !== 'map') setTimeout(() => first.focus({ preventScroll: true }), 60);
  }
  function close(name) {
    const i = stack.indexOf(name);
    if (i < 0) return;
    stack.splice(i, 1); $('screen-' + name).classList.remove('open');
  }
  function back() {
    if (!stack.length) return false;
    const top = stack[stack.length - 1];
    if (LOCKED[top]) return false;
    close(top); LO.Audio.back();
    return true;
  }
  function closeAll() { while (stack.length) close(stack[stack.length - 1]); }
  const blocking = () => stack.length > 0;
  const topScreen = () => stack[stack.length - 1] || null;
  function setMenu(v) { $('screen-menu').classList.toggle('open', v); $('hud').classList.toggle('hidden', v); }

  /* ---------- toasts / banner / tip ---------- */
  function toast(title, sub, kind) {
    const box = $('toasts'), d = document.createElement('div');
    d.className = 'toast ' + (kind || '');
    d.innerHTML = '<b>' + esc(title) + '</b>' + (sub ? '<small>' + esc(sub) + '</small>' : '');
    box.appendChild(d);
    while (box.children.length > 4) box.removeChild(box.firstChild);
    setTimeout(() => d.remove(), kind === 'legend' ? 6800 : 5000);
  }
  function banner(title, sub) {
    const b = $('banner');
    b.innerHTML = esc(title) + (sub ? '<small>' + esc(sub) + '</small>' : '');
    b.classList.add('show'); clearTimeout(bannerTimer);
    bannerTimer = setTimeout(() => b.classList.remove('show'), 3000);
  }
  function tip(text, ms) {
    const t = $('hudTip'); t.textContent = text || ''; t.classList.toggle('show', !!text);
    clearTimeout(tipTimer);
    if (text && ms) tipTimer = setTimeout(() => t.classList.remove('show'), ms);
  }
  function fade(on) { $('fade').classList.toggle('on', !!on); }

  /* ---------- HUD ---------- */
  function setText(id, v) { if (hudCache[id] !== v) { hudCache[id] = v; $(id).textContent = v; } }
  function setW(id, pct) { const v = Math.round(pct * 10) / 10; if (hudCache[id] !== v) { hudCache[id] = v; $(id).style.width = v + '%'; } }
  function toggleHide(id, show) { if (hudCache[id] !== show) { hudCache[id] = show; $(id).classList.toggle('hidden', !show); } }

  function updateHUD(g) {
    const P = LO.Player, run = LO.Progression.run;
    if (!run) return;
    const G = CFG.growth;
    setText('hudSize', P.size.toFixed(1));
    setText('hudLevel', 'Lv ' + run.level);
    setW('hudGrowth', run.level >= LO.Progression.MAXLV ? 100 : run.xp / G.xpToNext[run.level - 1] * 100);
    const nm = LO.Progression.nextMilestone();
    setText('hudNext', nm ? 'Next evolution at Lv ' + nm : 'All evolutions unlocked');
    setW('hudEnergy', P.energy / P.maxEnergy * 100);
    setText('hudEnergyNum', Math.round(P.energy) + ' / ' + Math.round(P.maxEnergy));
    const low = P.burstLocked || (!P.bursting && P.energy < CFG.burst.minActivate);
    if (hudCache.low !== low) { hudCache.low = low; $('hudEnergy').parentNode.classList.toggle('low', low); }
    const mp = CFG.burst.minActivate / P.maxEnergy * 100;
    if (hudCache.mp !== Math.round(mp)) { hudCache.mp = Math.round(mp); $('hudEnergyMin').style.left = mp + '%'; }
    setText('hudZone', CFG.zones[g.zone].name);
    toggleHide('hudDanger', g.danger > 0);
    toggleHide('hudHidden', P.hidden && P.alive);
    const evoKey = run.evo.join(',');
    if (hudCache.evoKey !== evoKey) {
      hudCache.evoKey = evoKey;
      const box = $('hudEvoChips'); box.innerHTML = '';
      run.evo.forEach((id) => {
        const u = LO.Evolution.BY_ID[id], c = document.createElement('canvas');
        c.width = c.height = 72; c.title = u.name + ': ' + u.benefit; LO.Evolution.drawIcon(c, u); box.appendChild(c);
      });
    }
  }
  function resetHudCache() { hudCache = {}; }

  /* ---------- journal ---------- */
  function card(canvasFn, title, meta, text, cls, badge) {
    const d = document.createElement('div');
    d.className = 'card ' + (cls || '');
    d.innerHTML = '<canvas width="240" height="120"></canvas>' + (badge ? '<span class="badge ' + badge + '">' + badge.toUpperCase() + '</span>' : '') +
      '<h4>' + esc(title) + '</h4>' + (meta ? '<p class="meta">' + esc(meta) + '</p>' : '') + '<p>' + esc(text) + '</p>';
    canvasFn(d.querySelector('canvas'));
    return d;
  }
  function zoneCanvas(zid, known, label) {
    return (cv) => {
      const c = cv.getContext('2d'), p = CFG.zones[zid].pal, g = c.createLinearGradient(0, 0, 0, cv.height);
      if (known) { g.addColorStop(0, p.top); g.addColorStop(1, p.bot); } else { g.addColorStop(0, '#1a3b4d'); g.addColorStop(1, '#0d2230'); }
      c.fillStyle = g; c.fillRect(0, 0, cv.width, cv.height);
      c.fillStyle = known ? p.sand : '#27495a'; c.beginPath(); c.moveTo(0, 100);
      for (let x = 0; x <= cv.width; x += 20) c.lineTo(x, 98 + Math.sin(x * 0.04) * 8); c.lineTo(cv.width, 120); c.lineTo(0, 120); c.fill();
      c.fillStyle = known ? 'rgba(255,255,255,0.85)' : 'rgba(255,255,255,0.35)'; c.font = 'bold 44px Georgia,serif'; c.textAlign = 'center';
      c.fillText(known ? (label || '') : '?', cv.width / 2, 68);
    };
  }

  function renderJournal() {
    const body = $('journalBody'), d = save();
    body.innerHTML = '';
    const SP = LO.SPECIES, fish = SP.filter((s) => !s.legend), leg = SP.filter((s) => s.legend);
    const seen = (id) => !!d.species[id];
    $('journalSummary').textContent = 'Species ' + fish.filter((s) => seen(s.id)).length + '/' + fish.length + '  ·  Legendary ' + leg.filter((s) => seen(s.id)).length + '/' + leg.length +
      '  ·  Zones ' + Object.keys(d.zones).length + '/5  ·  Places ' + LO.World.places.filter((p) => d.places[p.id]).length + '/' + LO.World.places.length;
    document.querySelectorAll('#journalTabs .tab').forEach((t) => t.classList.toggle('active', t.dataset.tab === journalTab));
    const order = (s) => CFG.zoneOrder.indexOf(s.zone) * 1000 + s.size;
    if (journalTab === 'fish' || journalTab === 'legend') {
      (journalTab === 'fish' ? fish : leg).slice().sort((a, b) => order(a) - order(b)).forEach((sp) => {
        const k = seen(sp.id);
        const pf = (cv) => LO.FishArt.portrait(cv, sp, k ? null : '#0b2230');
        if (k) {
          const eaten = d.species[sp.id].eaten || 0;
          body.appendChild(card(pf, sp.name, CFG.zones[sp.zone].name + '  ·  size ' + sp.size, sp.desc + (sp.legend ? '  Reward: ' + sp.reward.text + '.' : (eaten ? '  Eaten: ' + eaten + '.' : '')), sp.legend ? 'legendary' : '', sp.rarity !== 'common' ? sp.rarity : ''));
        } else {
          body.appendChild(card(pf, '???', sp.legend ? 'Legendary' : 'Undiscovered', sp.legend ? 'Whispers say it hides near ' + (sp.zone === 'reef' ? 'the shallows' : sp.zone === 'blue' ? 'open water' : sp.zone === 'deep' ? 'the dark' : 'the grottos') + '.' : 'Swim close to one to record it in your journal.', 'unk ' + (sp.legend ? 'legendary' : ''), ''));
        }
      });
    } else if (journalTab === 'zones') {
      CFG.zoneOrder.forEach((zid) => {
        const z = CFG.zones[zid], k = !!d.zones[zid];
        body.appendChild(card(zoneCanvas(zid, k, z.name.replace('The ', '')), k ? z.name : '???', k ? (z.min ? 'Passage needs size ' + z.min : 'Starting waters') : 'Unknown waters', k ? z.desc : 'Find the passage and grow big enough to enter.', k ? '' : 'unk'));
      });
      CFG.gates.forEach((g) => {
        const k = !!d.passages[g.id];
        body.appendChild(card(zoneCanvas(g.to, k, 'Passage'), k ? g.name : '???', k ? 'Needs size ' + g.min : 'Unfound passage', k ? g.desc : 'A way through lies hidden somewhere.', k ? '' : 'unk'));
      });
    } else {
      LO.World.places.forEach((p) => {
        const k = !!d.places[p.id];
        body.appendChild(card(zoneCanvas(p.zone, k, p.type === 'hidden' ? '★' : '◆'), k ? p.name : '???', k ? (p.type === 'hidden' ? 'Hidden place' : 'Landmark') + '  ·  ' + CFG.zones[p.zone].name : 'Undiscovered', k ? p.desc : 'Explore to find it.', k ? '' : 'unk'));
      });
    }
  }

  /* ---------- evolution tree ---------- */
  function renderEvoTree() {
    const tree = $('evoTree'), run = LO.Progression.run, E = LO.Evolution;
    tree.innerHTML = '';
    Object.keys(E.BRANCHES).forEach((b) => {
      const br = E.BRANCHES[b], col = document.createElement('div');
      col.className = 'branch'; col.style.borderColor = br.color;
      col.innerHTML = '<h4 style="color:' + br.color + '">' + br.name + '</h4><p class="hint" style="text-align:center;margin:-4px 0 8px">' + br.blurb + '</p>';
      E.UPGRADES.filter((u) => u.branch === b).sort((a, c) => a.tier - c.tier).forEach((u) => {
        const unl = E.isUnlocked(u), sel = run && run.evo.includes(u.id);
        const n = document.createElement('div');
        n.className = 'node ' + (sel ? 'sel' : '') + (unl ? '' : ' locked');
        n.title = u.desc;
        n.innerHTML = '<canvas width="88" height="88"></canvas><div><b>' + esc(unl ? u.name : '???') + '</b><span>' + esc(unl ? u.benefit : E.unlockText(u)) + '</span><em>Tier ' + u.tier + (sel ? ' · chosen this run' : unl ? '' : ' · locked') + '</em></div>';
        E.drawIcon(n.querySelector('canvas'), u, !unl);
        col.appendChild(n);
      });
      tree.appendChild(col);
    });
    const cos = $('cosmetics'); cos.innerHTML = '';
    Object.keys(CFG.cosmetics).forEach((id) => {
      const c = CFG.cosmetics[id], has = !!save().cosmetics[id], b = document.createElement('button');
      b.className = 'cos' + (save().settings.cosmetic === id ? ' sel' : '') + (has ? '' : ' locked');
      b.disabled = !has; b.title = has ? c.name : (c.hint || 'Locked');
      b.innerHTML = '<i style="background:' + c.swatch + '"></i>' + esc(has ? c.name : '???') + (has ? '' : ' <small>(' + esc(c.hint) + ')</small>');
      b.addEventListener('click', () => { save().settings.cosmetic = id; LO.Save.save(); LO.Player.refreshLook(); LO.Audio.click(); renderEvoTree(); });
      cos.appendChild(b);
    });
    $('evoRunInfo').textContent = run && run.level ? 'Milestones this run: ' + CFG.growth.milestones.map((m) => 'Lv ' + m.level).join(', ') + '. Chosen so far: ' + (run.evo.length ? run.evo.map((id) => E.BY_ID[id].name).join(', ') : 'none') + '.' : '';
  }

  function showEvoChoice(options, level) {
    const box = $('evoChoices'), E = LO.Evolution;
    box.innerHTML = '';
    $('evoChoiceTitle').textContent = 'Evolve!  ·  Size level ' + level;
    options.forEach((u, i) => {
      const b = document.createElement('button');
      b.className = 'evo-card'; b.dataset.id = u.id; b.style.borderColor = E.BRANCHES[u.branch].color;
      b.innerHTML = '<span class="tag" style="color:' + E.BRANCHES[u.branch].color + '">' + E.BRANCHES[u.branch].name.toUpperCase() + ' · ' + (i + 1) + '</span><canvas width="144" height="144"></canvas><h4>' + esc(u.name) + '</h4><p>' + esc(u.desc) + '</p><p class="benefit">' + esc(u.benefit) + '</p><span class="btn small pick">Choose</span>';
      E.drawIcon(b.querySelector('canvas'), u);
      b.addEventListener('click', () => LO.Game.chooseEvo(u.id));
      box.appendChild(b);
    });
    open('evochoice'); LO.Audio.evoOpen();
  }
  const evoChoiceKey = (n) => { const cards = $('evoChoices').children; if (topScreen() === 'evochoice' && cards[n]) cards[n].click(); };
  function closeEvoChoice() { close('evochoice'); }

  /* ---------- death ---------- */
  function showDeath(run) {
    $('deathCause').textContent = run.cause ? 'Eaten by a ' + run.cause + '. The little ocean remembers what you found.' : 'The little ocean remembers what you found.';
    const li = (a, b) => '<li><span>' + a + '</span><b>' + b + '</b></li>';
    const names = (ids) => ids.map((id) => LO.SPECIES_BY_ID[id].name).join(', ');
    const secs = Math.floor(run.time), t = Math.floor(secs / 60) + ':' + String(secs % 60).padStart(2, '0');
    $('deathSummary').innerHTML = li('Largest size reached', run.maxSize.toFixed(1)) + li('Fish eaten', run.eaten) + li('Time swum', t) +
      li('New species', run.newSpecies.length ? esc(names(run.newSpecies)) : 'None') +
      li('New areas', run.newZones.length || run.newPlaces.length || run.newPassages.length ? esc([].concat(run.newZones.map((z) => CFG.zones[z].name), run.newPassages.map((g) => LO.World.gates.find((x) => x.id === g).name), run.newPlaces.map((p) => LO.World.placeById(p).name)).join(', ')) : 'None') +
      li('Permanent unlocks', run.newUnlocks.length ? esc(run.newUnlocks.join(', ')) : 'None this time');
    open('death');
  }

  /* ---------- settings / confirm ---------- */
  function syncSettings() {
    const s = save().settings;
    $('setMusic').value = Math.round(s.music * 100); $('setSfx').value = Math.round(s.sfx * 100);
    $('setMute').checked = s.muted; $('setFx').checked = s.fx; $('setShake').checked = s.shake;
  }
  function bindSettings() {
    const s = () => save().settings, apply = () => { LO.Audio.applySettings(); LO.Save.save(); };
    $('setMusic').addEventListener('input', (e) => { s().music = e.target.value / 100; apply(); });
    $('setSfx').addEventListener('input', (e) => { s().sfx = e.target.value / 100; apply(); });
    $('setSfx').addEventListener('change', () => LO.Audio.click());
    $('setMute').addEventListener('change', (e) => { s().muted = e.target.checked; apply(); });
    $('setFx').addEventListener('change', (e) => { s().fx = e.target.checked; LO.Particles.setRich(e.target.checked); LO.Scenery.setFx(e.target.checked); apply(); });
    $('setShake').addEventListener('change', (e) => { s().shake = e.target.checked; apply(); });
  }
  function confirmBox(title, text, yes, cb) {
    $('confirmTitle').textContent = title; $('confirmText').textContent = text; $('confirmYes').textContent = yes || 'Confirm';
    confirmCb = cb; open('confirm');
  }

  /* ---------- map ---------- */
  function drawMap() {
    const c = mapCtx, cv = $('mapCanvas'), W = LO.World.W, H = LO.World.H, d = save(), P = LO.Player, g = LO.Game;
    const sc = Math.min((cv.width - 40) / W, (cv.height - 40) / H), ox = (cv.width - W * sc) / 2, oy = (cv.height - H * sc) / 2;
    const mx = (x) => ox + x * sc, my = (y) => oy + y * sc;
    const bg = c.createLinearGradient(0, 0, 0, cv.height); bg.addColorStop(0, '#12526a'); bg.addColorStop(1, '#0a2a3e');
    c.fillStyle = bg; c.fillRect(0, 0, cv.width, cv.height);
    CFG.zoneOrder.forEach((zid) => {
      const z = CFG.zones[zid], r = z.rect, known = !!d.zones[zid];
      const gr = c.createLinearGradient(0, my(r[1]), 0, my(r[1] + r[3]));
      if (known) { gr.addColorStop(0, z.pal.top); gr.addColorStop(1, z.pal.bot); } else { gr.addColorStop(0, '#1d4457'); gr.addColorStop(1, '#10303f'); }
      c.fillStyle = gr; c.fillRect(mx(r[0]), my(r[1]), r[2] * sc, r[3] * sc);
      if (!known) {
        c.save(); c.beginPath(); c.rect(mx(r[0]), my(r[1]), r[2] * sc, r[3] * sc); c.clip();
        c.strokeStyle = 'rgba(255,255,255,0.07)'; c.lineWidth = 2;
        for (let i = -200; i < 600; i += 16) { c.beginPath(); c.moveTo(mx(r[0]) + i, my(r[1])); c.lineTo(mx(r[0]) + i + 200, my(r[1] + r[3])); c.stroke(); }
        c.restore();
      }
      c.fillStyle = known ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.4)';
      c.font = (known ? 'bold 19px' : 'bold 40px') + ' Georgia,serif'; c.textAlign = 'center';
      c.fillText(known ? z.name : '?', mx(r[0] + r[2] / 2), my(r[1] + r[3] / 2) - (known ? 40 : -10));
    });
    // walls
    LO.World.solids.forEach((s) => {
      if (s.t !== 'r' || s.kind !== 'wall') return;
      c.fillStyle = '#233a48'; c.fillRect(mx(s.x), my(s.y), Math.max(3, s.w * sc), Math.max(3, s.h * sc));
    });
    // passages
    LO.World.gates.forEach((gt) => {
      const k = !!d.passages[gt.id];
      if (!k) return;
      const open = P.size >= gt.min;
      c.fillStyle = open ? 'rgba(160,255,220,0.9)' : 'rgba(255,200,120,0.95)';
      c.fillRect(mx(gt.x) - 1, my(gt.y), Math.max(5, gt.w * sc) + 2, Math.max(5, gt.h * sc));
      c.fillStyle = '#fff'; c.font = 'bold 13px Trebuchet MS,sans-serif'; c.textAlign = 'center';
      c.fillText('size ' + gt.min, mx(gt.cx), my(gt.cy) - (gt.vertical ? gt.h * sc / 2 + 6 : 12));
    });
    // places and legends
    LO.World.places.forEach((p) => {
      if (!d.places[p.id]) return;
      c.fillStyle = p.type === 'hidden' ? '#ffe29a' : '#fff';
      c.beginPath();
      const x = mx(p.x), y = my(p.y);
      if (p.type === 'hidden') { for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, r = i & 1 ? 3 : 7; c.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r); } c.closePath(); }
      else { c.moveTo(x, y - 6); c.lineTo(x + 5, y); c.lineTo(x, y + 6); c.lineTo(x - 5, y); c.closePath(); }
      c.fill();
    });
    // player
    const px = mx(P.x), py = my(P.y), pulse = 1 + 0.25 * Math.sin(performance.now() / 250);
    c.strokeStyle = 'rgba(255,225,140,0.7)'; c.lineWidth = 2; c.beginPath(); c.arc(px, py, 12 * pulse, 0, TAU); c.stroke();
    c.save(); c.translate(px, py); c.rotate(P.ang); c.fillStyle = '#ffd25a'; c.strokeStyle = '#7a4a10'; c.lineWidth = 2;
    c.beginPath(); c.moveTo(10, 0); c.lineTo(-7, -7); c.lineTo(-3, 0); c.lineTo(-7, 7); c.closePath(); c.fill(); c.stroke(); c.restore();
    c.strokeStyle = 'rgba(255,255,255,0.3)'; c.lineWidth = 2; c.strokeRect(ox, oy, W * sc, H * sc);
  }

  /* ---------- init ---------- */
  function init() {
    document.addEventListener('click', (e) => {
      const t = e.target.closest('[data-open],[data-back],.tab');
      if (!t) return;
      if (t.dataset.open) open(t.dataset.open);
      else if (t.hasAttribute('data-back')) back();
      else if (t.classList.contains('tab')) { journalTab = t.dataset.tab; renderJournal(); LO.Audio.click(); }
    });
    $('btnNew').addEventListener('click', () => LO.Game.startRun());
    $('btnContinue').addEventListener('click', () => LO.Game.continueRun());
    $('btnAgain').addEventListener('click', () => { close('death'); LO.Game.startRun(); });
    $('btnDeathMenu').addEventListener('click', () => { close('death'); LO.Game.toMenu(); });
    $('btnToMenu').addEventListener('click', () => { closeAll(); LO.Game.toMenu(); });
    const doReset = () => confirmBox('Reset all save data?', 'This permanently erases discovered species, zones, evolution unlocks, cosmetics and settings. It cannot be undone.', 'Erase everything', () => LO.Game.resetSave());
    $('btnReset').addEventListener('click', doReset);
    $('btnReset2').addEventListener('click', doReset);
    $('confirmNo').addEventListener('click', () => { close('confirm'); LO.Audio.back(); });
    $('confirmYes').addEventListener('click', () => { close('confirm'); const cb = confirmCb; confirmCb = null; if (cb) cb(); });
    bindSettings();
  }

  return { init, open, close, back, closeAll, blocking, topScreen, setMenu, toast, banner, tip, fade, updateHUD, resetHudCache, showEvoChoice, evoChoiceKey, closeEvoChoice, showDeath, drawMap, renderEvoTree, syncSettings, confirmBox, renderJournal, get mapOpen() { return stack.includes('map'); } };
})();
