/* Little Ocean - game loop, input, camera, run lifecycle (start / death / evolve), rendering orchestration. */
window.LO = window.LO || {};
LO.Game = (function () {
  const CFG = LO.CFG, U = LO.U, World = LO.World, TAU = Math.PI * 2;
  const Fishes = LO.Fishes, Player = LO.Player, Prog = LO.Progression, UI = LO.UI, Audio = LO.Audio, Particles = LO.Particles, Scenery = LO.Scenery;
  const canvas = document.getElementById('game'), ctx = canvas.getContext('2d');
  const cam = { x: CFG.start.x, y: CFG.start.y, zoom: 1.4, shake: 0 };
  const input = { active: false, sx: 0, sy: 0, wx: 0, wy: 0, burst: false, mouse: false, key: false, touch: false };
  const view = { l: 0, t: 0, r: 0, b: 0, cx: 0, cy: 0, zoom: 1 };
  let vw = 800, vh = 600, dpr = 1;
  let state = 'menu';            // menu | playing | dying | dead
  let zone = 'reef', danger = 0, threatFish = null, hasRun = false;
  let animT = 0, dyingT = 0, slowT = 0, lastGateMsg = -99, menuT = 0, tutStep = 0, bubT = 0;
  let last = 0;

  const save = () => LO.Save.data;
  const rich = () => save().settings.fx;

  /* ---------- sizing & input ---------- */
  function resize() {
    vw = window.innerWidth; vh = window.innerHeight;
    dpr = Math.min(window.devicePixelRatio || 1, rich() ? 1.75 : 1.25);
    canvas.width = Math.floor(vw * dpr); canvas.height = Math.floor(vh * dpr);
  }
  function viewScale() { return U.clamp(Math.min(vw, vh * 1.7) / 1280, 0.62, 1.3); }
  function targetZoom() {
    const z = U.clamp(CFG.view.baseZoom * Math.pow(CFG.player.startSize / Math.max(Player.size, 5), CFG.view.zoomPow), CFG.view.minZoom, CFG.view.maxZoom);
    return z * viewScale() * (Player.bursting ? 0.95 : 1);
  }
  function pointerWorld() {
    input.wx = cam.x + (input.sx - vw / 2) / cam.zoom;
    input.wy = cam.y + (input.sy - vh / 2) / cam.zoom;
  }
  function setPointer(x, y) { input.sx = x; input.sy = y; input.active = true; }

  function bindInput() {
    document.addEventListener('mousemove', (e) => { setPointer(e.clientX, e.clientY); input.touch = false; });
    document.addEventListener('mouseout', (e) => { if (!e.relatedTarget) input.active = false; });
    document.addEventListener('mousedown', (e) => {
      Audio.init();
      if (e.button === 0 && !e.target.closest('button,input,label,.panel,.screen')) input.mouse = true;
    });
    window.addEventListener('mouseup', (e) => { if (e.button === 0) input.mouse = false; });
    window.addEventListener('blur', () => { input.mouse = false; input.key = false; });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    canvas.addEventListener('touchstart', (e) => { Audio.init(); const t = e.touches[0]; setPointer(t.clientX, t.clientY); input.touch = true; e.preventDefault(); }, { passive: false });
    canvas.addEventListener('touchmove', (e) => { const t = e.touches[0]; setPointer(t.clientX, t.clientY); e.preventDefault(); }, { passive: false });
    const tb = document.getElementById('touchBurst');
    tb.addEventListener('touchstart', (e) => { input.touch = true; e.preventDefault(); input.mouse = true; }, { passive: false });
    tb.addEventListener('touchend', (e) => { input.mouse = false; e.preventDefault(); }, { passive: false });
    tb.addEventListener('touchcancel', () => { input.mouse = false; });
    if (window.matchMedia && window.matchMedia('(pointer:coarse)').matches) tb.classList.remove('hidden');

    document.addEventListener('keydown', (e) => {
      Audio.init();
      const k = e.key;
      if (k === ' ' || k === 'Spacebar') { if (!e.target.closest('button,input')) { input.key = true; e.preventDefault(); } return; }
      if (k === 'Escape' || k === 'p' || k === 'P') {
        if (UI.blocking()) { UI.back(); } else if (state === 'playing') UI.open('pause');
        return;
      }
      if (k >= '1' && k <= '3') { UI.evoChoiceKey(+k - 1); return; }
      if (state !== 'playing') return;
      const toggle = (name) => { if (UI.topScreen() === name) UI.back(); else if (!UI.blocking()) UI.open(name); };
      if (k === 'm' || k === 'M') toggle('map');
      else if (k === 'j' || k === 'J') toggle('journal');
      else if (k === 'e' || k === 'E') toggle('evo');
    });
    document.addEventListener('keyup', (e) => { if (e.key === ' ' || e.key === 'Spacebar') input.key = false; });
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) { input.mouse = input.key = false; if (state === 'playing' && !UI.blocking()) UI.open('pause'); Audio.suspend(); }
      else { Audio.resume(); last = performance.now(); }
    });
    window.addEventListener('resize', resize);
  }

  /* ---------- run lifecycle ---------- */
  function startRun() {
    Audio.init(); Audio.click();
    UI.closeAll(); UI.fade(false);
    Prog.newRun();
    Player.reset(); Player.applyStats();
    Fishes.reset(); Fishes.populate(); Particles.clear();
    cam.x = Player.x; cam.y = Player.y; cam.zoom = targetZoom(); cam.shake = 0;
    state = 'playing'; hasRun = true; zone = 'reef'; danger = 0; tutStep = 0; slowT = 0; lastGateMsg = -99;
    Scenery.snap('reef'); Audio.setZone('reef');
    UI.setMenu(false); UI.resetHudCache(); UI.toast('A new run begins', 'Small fish are food. Big fish are danger.', 'zone');
    UI.banner('The Shallow Reef', 'Little Ocean');
    input.mouse = input.key = false;
  }
  function continueRun() { if (!hasRun || !Player.alive) return; Audio.init(); UI.closeAll(); UI.setMenu(false); state = 'playing'; Audio.click(); }
  function toMenu() {
    if (state === 'dead' || state === 'dying') { hasRun = false; }
    state = 'menu'; UI.fade(false); UI.setMenu(true); UI.tip('');
    const d = save();
    document.getElementById('btnContinue').classList.toggle('hidden', !(hasRun && Player.alive));
    document.getElementById('menuStats').textContent = 'Species found ' + Object.keys(d.species).length + '/' + LO.SPECIES.length + '  ·  Best size ' + d.stats.bestSize.toFixed(1) + '  ·  Runs ' + d.stats.runs;
    Scenery.snap('reef');
  }
  function resetSave() {
    LO.Save.reset(); Player.refreshLook(); hasRun = false; Player.alive = false;
    Fishes.reset(); Fishes.populate();
    Particles.setRich(save().settings.fx); Scenery.setFx(save().settings.fx); Audio.applySettings(); resize();
    UI.closeAll(); toMenu(); UI.toast('Save data erased', 'Starting fresh.', 'warn');
  }

  function playerBitten(pred) {
    if (state !== 'playing' || !Player.alive || Player.invuln > 0) return;
    const run = Prog.run;
    if (Player.stats.extraLife && !run.luckyUsed) {
      run.luckyUsed = true; Player.invuln = 3; Player.energy = Player.maxEnergy;
      pred.stun = 2.5; pred.target = null; pred.chaseCool = 6;
      Player.knock(Player.x - pred.x, Player.y - pred.y, 520);
      pred.vx -= (Player.x - pred.x) * 0.5; pred.vy -= (Player.y - pred.y) * 0.5;
      Audio.lucky(); Audio.hurt(); cam.shake = 14;
      Particles.ring(Player.x, Player.y, 70, '#ffe29a'); for (let i = 0; i < 10; i++) Particles.spark(Player.x, Player.y, '#ffe29a', 2.5, 1);
      UI.toast('Lucky Escape!', 'Your charm shook the predator loose.', 'legend');
      return;
    }
    run.cause = pred.sp.name; pred.eatT = 0.35; pred.sated = CFG.ai.satedTime; pred.target = null;
    Player.alive = false; state = 'dying'; dyingT = 0; cam.shake = 16;
    Audio.hurt(); Audio.death(); UI.fade(true); UI.tip('');
    for (let i = 0; i < 14; i++) Particles.bubble(Player.x + U.rand(-10, 10), Player.y + U.rand(-10, 10), U.rand(2, 5));
  }

  function finishDeath() {
    state = 'dead';
    Prog.recordDeath();
    UI.showDeath(Prog.run);
  }

  function chooseEvo(id) {
    const run = Prog.run;
    if (!LO.Evolution.BY_ID[id] || run.evo.includes(id)) return;
    run.evo.push(id);
    Player.applyStats();
    Audio.evoPick();
    UI.closeEvoChoice();
    Particles.ring(Player.x, Player.y, 60, '#ffffff');
    for (let i = 0; i < 12; i++) Particles.spark(Player.x + U.rand(-30, 30), Player.y + U.rand(-30, 30), '#fff4b8', 2.5, 1.2);
    UI.toast('Evolved: ' + LO.Evolution.BY_ID[id].name, LO.Evolution.BY_ID[id].benefit, 'evo');
  }

  /* ---------- simulation ---------- */
  function onEat(f) {
    Player.eatT = 0.3;
    const run = Prog.run, before = run.size, lvl = run.level;
    Prog.onEat(f, Player.size);
    let gain = run.size - before;
    if (run.level > lvl) gain = Math.max(gain, 0) + 0.01;
    Particles.text(f.x, f.y, '+' + Math.max(0.01, gain).toFixed(2) + ' size');
    Particles.eatFx(f.x, f.y, f.sz, '#fff4b8');
    Audio.eat(f.sz);
  }

  function periodic() {
    const run = Prog.run;
    const z = World.zoneAt(Player.x, Player.y);
    if (z !== zone) {
      zone = z; Audio.setZone(z);
      const fresh = Prog.discoverZone(z);
      UI.banner(CFG.zones[z].name, fresh ? 'New area discovered' : '');
    }
    const g = World.nearGate(Player.x, Player.y, 330); if (g) Prog.discoverPassage(g);
    const p = World.placeAt(Player.x, Player.y); if (p) Prog.discoverPlace(p);
    Fishes.scanDiscover(Player);
    const th = Fishes.nearestThreat(Player);
    threatFish = th && th.d < 470 ? th.fish : null;
    const nd = threatFish ? 1 : 0;
    if (nd && !danger) Audio.danger();
    danger = nd;
    Player.pursuing = Player.stats.pursuit > 0 && Fishes.preyNear(Player, 280);
    // gentle first-run guidance
    if (!save().flags.tutorial) {
      if (tutStep === 0) { UI.tip('Move your mouse to swim', 6000); tutStep = 1; slowT = 0; }
      else if (tutStep === 1 && run.time > 7) { UI.tip('Hold left click (or Space) to burst. It uses energy.', 6500); tutStep = 2; }
      else if (tutStep === 2 && run.eaten > 0) { UI.tip('Fish smaller than you are food. Bigger fish will eat you.', 7000); tutStep = 3; }
      else if (tutStep === 3 && run.eaten >= 4) { UI.tip('Grow to reach new waters. Press M for the map.', 7000); tutStep = 4; save().flags.tutorial = true; LO.Save.save(); }
    }
  }

  function ambient(dt) {
    bubT -= dt;
    if (bubT > 0) return;
    bubT = rich() ? 0.12 : 0.3;
    for (let i = 0; i < World.vents.length; i++) {
      const v = World.vents[i];
      if (Math.abs(v.x - cam.x) < 1100 && Math.abs(v.y - cam.y) < 900) Particles.bubble(v.x + U.rand(-8, 8), v.y, U.rand(2, 5));
    }
    const x = cam.x + U.rand(-500, 500), row = World.rowOf(cam.y), fy = World.floorAt(x, row);
    if (x > 0 && x < World.W && fy > view.t && fy < view.b && Math.random() < 0.5) Particles.bubble(x, fy - 4, U.rand(1.2, 3));
  }

  function updateCamera(dt, snap) {
    const k = snap ? 1 : 1 - Math.exp(-CFG.view.camSmooth * dt);
    const lx = U.clamp(Player.vx * CFG.view.lookAhead, -90, 90), ly = U.clamp(Player.vy * CFG.view.lookAhead, -90, 90);
    cam.x += (Player.x + lx - cam.x) * k; cam.y += (Player.y + ly - cam.y) * k;
    cam.zoom += (targetZoom() - cam.zoom) * (snap ? 1 : 1 - Math.exp(-3 * dt));
    clampCamera();
  }
  function clampCamera() {
    const hw = vw / (2 * cam.zoom), hh = vh / (2 * cam.zoom), m = 140;
    cam.x = World.W < 2 * (hw - m) ? World.W / 2 : U.clamp(cam.x, hw - m, World.W - hw + m);
    cam.y = World.H < 2 * (hh - m) ? World.H / 2 : U.clamp(cam.y, hh - m, World.H - hh + m);
  }

  function simulate(dt) {
    animT += dt;
    const run = Prog.run;
    if (state === 'playing') {
      run.time += dt;
      pointerWorld();
      input.burst = input.mouse || input.key;
      Player.update(dt, input);
      const gh = World.lastGate;
      if (gh && animT - lastGateMsg > 8) { lastGateMsg = animT; UI.toast('A strong current pushes you back', 'Grow to size ' + gh.min + ' to pass through.', 'warn'); }
      slowT -= dt;
      if (slowT <= 0) { slowT = 0.25; periodic(); }
      if (Player.justBurst) cam.shake = Math.max(cam.shake, 2);
    } else if (state === 'dying') {
      dyingT += dt; Player.fade = Math.max(0, 1 - dyingT / 1.3);
      if (dyingT > 1.8) finishDeath();
    }
    Fishes.update(dt, Player.x, Player.y);
    if (state === 'playing') {
      Fishes.playerEat(Player, onEat);
      if (Player.alive && run.pending.length && !UI.blocking()) {
        const m = run.pending.shift(), opts = LO.Evolution.offer(run, m.maxTier);
        if (opts.length) UI.showEvoChoice(opts, m.level);
        else UI.toast('Evolution milestone reached', 'Nothing available yet. Explore to unlock more options!', 'warn');
      }
    }
    Particles.update(dt); ambient(dt);
    updateCamera(dt, false);
    cam.shake = Math.max(0, cam.shake - dt * 30);
    Scenery.updatePalette(dt, zone);
    Audio.update(state === 'playing' ? Player.speedFrac : 0, Player.bursting);
  }

  function menuStep(dt) {
    animT += dt; menuT += dt;
    cam.zoom = 1.05 * viewScale();
    cam.x = 1000 + Math.sin(menuT * 0.07) * 700; cam.y = 760 + Math.sin(menuT * 0.11 + 1) * 260;
    clampCamera();
    Fishes.update(dt, cam.x, cam.y);
    Particles.update(dt); ambient(dt);
    Scenery.updatePalette(dt, 'reef');
    Audio.update(0, false);
  }

  /* ---------- rendering ---------- */
  function updateView() {
    const hw = vw / (2 * cam.zoom), hh = vh / (2 * cam.zoom);
    view.l = cam.x - hw; view.r = cam.x + hw; view.t = cam.y - hh; view.b = cam.y + hh; view.cx = cam.x; view.cy = cam.y; view.zoom = cam.zoom;
  }

  function render() {
    updateView();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
    Scenery.drawWater(ctx, vw, vh, view);
    Scenery.drawRays(ctx, vw, vh, animT, view);
    Scenery.drawParallax(ctx, vw, vh, animT, view);
    const sh = save().settings.shake && cam.shake > 0 ? cam.shake : 0;
    const ox = sh ? (Math.random() - 0.5) * sh : 0, oy = sh ? (Math.random() - 0.5) * sh : 0;
    const psize = state === 'menu' ? 0 : Player.size;

    ctx.save();
    ctx.translate(vw / 2 + ox, vh / 2 + oy); ctx.scale(cam.zoom, cam.zoom); ctx.translate(-cam.x, -cam.y);
    Scenery.drawBounds(ctx, view); Scenery.drawSurface(ctx, view, animT);
    Scenery.drawSeabed(ctx, view); Scenery.drawNookInteriors(ctx, view);
    Scenery.drawDecor(ctx, view, animT, 0);
    Scenery.drawSolids(ctx, view, animT); Scenery.drawGates(ctx, view, animT, psize);
    Fishes.draw(ctx, view, animT);
    if (state !== 'menu') Player.draw(ctx, animT);
    Particles.draw(ctx, view);
    if (state === 'playing' && threatFish && Player.alive) drawDangerArrow();
    Scenery.drawDecor(ctx, view, animT, 1);
    ctx.restore();

    const dark = Scenery.dark;
    if (dark > 0.03) {
      const px = state === 'menu' ? vw / 2 : (Player.x - cam.x) * cam.zoom + vw / 2, py = state === 'menu' ? vh / 2 : (Player.y - cam.y) * cam.zoom + vh / 2;
      Scenery.drawDarkness(ctx, vw, vh, px, py, cam.zoom);
      if (dark > 0.25) drawLights();
    }
    Scenery.drawMotes(ctx, vw, vh, animT, view);
    if (danger && state === 'playing') {
      const a = 0.16 + 0.1 * Math.sin(animT * 9), g = ctx.createRadialGradient(vw / 2, vh / 2, Math.min(vw, vh) * 0.35, vw / 2, vh / 2, Math.max(vw, vh) * 0.75);
      g.addColorStop(0, 'rgba(200,40,80,0)'); g.addColorStop(1, 'rgba(200,40,80,' + a + ')');
      ctx.fillStyle = g; ctx.fillRect(0, 0, vw, vh);
    }
  }

  function drawLights() {
    ctx.save();
    ctx.translate(vw / 2, vh / 2); ctx.scale(cam.zoom, cam.zoom); ctx.translate(-cam.x, -cam.y);
    Scenery.drawGlows(ctx, view, animT);
    ctx.globalCompositeOperation = 'lighter';
    const L = Fishes.list;
    for (let i = 0; i < L.length; i++) {
      const f = L[i];
      if (f.dead || !f.sp.glow || f.x < view.l - 200 || f.x > view.r + 200 || f.y < view.t - 200 || f.y > view.b + 200) continue;
      const R = f.sz * (f.sp.legend ? 7 : 3.6), g = ctx.createRadialGradient(f.x, f.y, 0, f.x, f.y, R);
      g.addColorStop(0, U.alpha(f.sp.glow, f.sp.legend ? 0.4 : 0.3)); g.addColorStop(1, U.alpha(f.sp.glow, 0));
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(f.x, f.y, R, 0, TAU); ctx.fill();
    }
    if (Player.alive) {
      const R = 240, g = ctx.createRadialGradient(Player.x, Player.y, 0, Player.x, Player.y, R);
      g.addColorStop(0, 'rgba(255,236,170,0.22)'); g.addColorStop(1, 'rgba(255,236,170,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(Player.x, Player.y, R, 0, TAU); ctx.fill();
    }
    ctx.restore();
  }

  function drawDangerArrow() {
    const a = Math.atan2(threatFish.y - Player.y, threatFish.x - Player.x), d = Player.r * 2 + 34 / cam.zoom, s = 11 / cam.zoom;
    ctx.save(); ctx.translate(Player.x + Math.cos(a) * d, Player.y + Math.sin(a) * d); ctx.rotate(a);
    ctx.globalAlpha = 0.6 + 0.35 * Math.sin(animT * 10);
    ctx.fillStyle = '#ff5a6e'; ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.6 / cam.zoom; ctx.lineJoin = 'round';
    ctx.beginPath(); ctx.moveTo(s, 0); ctx.lineTo(-s * 0.7, -s * 0.8); ctx.lineTo(-s * 0.7, s * 0.8); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.restore();
  }

  /* ---------- loop ---------- */
  function frame(now) {
    requestAnimationFrame(frame);
    let dt = (now - last) / 1000; last = now;
    if (!(dt > 0)) return;
    if (dt > 0.1) dt = 0.1;
    const steps = dt > 1 / 30 ? 2 : 1, h = dt / steps;
    for (let i = 0; i < steps; i++) {
      if (state === 'menu') menuStep(h);
      else if ((state === 'playing' || state === 'dying') && !UI.blocking()) simulate(h);
      else Audio.update(0, false);
    }
    render();
    if (state === 'playing' || state === 'dying') UI.updateHUD(api);
    if (UI.mapOpen) UI.drawMap();
  }

  function init() {
    resize(); bindInput();
    Particles.setRich(rich()); Scenery.setFx(rich());
    Fishes.populate();
    toMenu();
    const msg = LO.Save.takeMessage(); if (msg) UI.toast('Save data notice', msg, 'warn');
    last = performance.now();
    requestAnimationFrame(frame);
  }

  const api = {
    init, startRun, continueRun, toMenu, resetSave, playerBitten, chooseEvo,
    get zone() { return zone; }, get danger() { return danger; }, get state() { return state; }
  };
  return api;
})();
