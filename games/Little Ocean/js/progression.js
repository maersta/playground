/* Little Ocean - run state, growth curve, milestones and permanent discoveries/unlocks. */
window.LO = window.LO || {};
LO.Progression = (function () {
  const CFG = LO.CFG, U = LO.U, G = CFG.growth;
  let run = null;
  const save = () => LO.Save.data;
  const toast = (title, sub, kind) => { if (LO.UI) LO.UI.toast(title, sub, kind); };
  const MAXLV = G.levelSizes.length;

  function newRun() {
    run = {
      level: 1, xp: 0, size: CFG.player.startSize, maxSize: CFG.player.startSize, eaten: 0, time: 0,
      newSpecies: [], newZones: [], newPlaces: [], newPassages: [], newUnlocks: [],
      evo: [], pending: [], luckyUsed: false, cause: ''
    };
    save().stats.runs++;
    LO.Save.save();
    return run;
  }

  function sizeFor(level, xp) {
    if (level >= MAXLV) return G.levelSizes[MAXLV - 1];
    return U.lerp(G.levelSizes[level - 1], G.levelSizes[level], xp / G.xpToNext[level - 1]);
  }
  function refreshSize() {
    run.size = sizeFor(run.level, run.xp);
    if (run.size > run.maxSize) run.maxSize = run.size;
  }

  function addGrowth(amount) {
    if (!run) return;
    run.xp += amount;
    while (run.level < MAXLV && run.xp >= G.xpToNext[run.level - 1]) {
      run.xp -= G.xpToNext[run.level - 1];
      run.level++;
      onLevel(run.level);
    }
    if (run.level >= MAXLV) run.xp = 0;
    refreshSize();
  }

  function onLevel(level) {
    LO.Audio.levelUp();
    toast('You grew!', 'Size level ' + level, 'zone');
    G.milestones.forEach((m) => { if (m.level === level) run.pending.push(m); });
  }

  // growth awarded for eating prey: smaller prey are worth less (no farming tiny fish forever)
  function rewardFor(fish, playerSize) {
    const r = fish.sz / playerSize;
    return fish.sp.growth * U.clamp(r / 0.5, 0.2, 1.2);
  }

  function nextMilestone() {
    for (let i = 0; i < G.milestones.length; i++) if (G.milestones[i].level > run.level) return G.milestones[i].level;
    return null;
  }

  /* ---------- permanent discoveries ---------- */
  function checkUnlocks() {
    LO.Evolution.UPGRADES.forEach((u) => {
      if (!u.unlock || save().evo[u.id]) return;
      const ok = u.unlock.zone ? save().zones[u.unlock.zone] : u.unlock.legend ? save().species[u.unlock.legend] : false;
      if (ok) {
        save().evo[u.id] = 1;
        if (run) run.newUnlocks.push(u.name);
        toast('Evolution unlocked', u.name, 'evo');
      }
    });
  }

  function seeSpecies(id) {
    const sp = LO.SPECIES_BY_ID[id], d = save();
    if (!sp || d.species[id]) return false;
    d.species[id] = { eaten: 0 };
    if (run) run.newSpecies.push(id);
    if (sp.legend) {
      toast('Legendary discovery: ' + sp.name, sp.reward.text, 'legend');
      LO.Audio.legendary();
      if (sp.reward.cosmetic) { d.cosmetics[sp.reward.cosmetic] = 1; d.settings.cosmetic = sp.reward.cosmetic; if (LO.Player) LO.Player.refreshLook(); }
      LO.Particles.ring(LO.Player ? LO.Player.x : 0, LO.Player ? LO.Player.y : 0, 80, '#ffe29a');
    } else {
      toast('New species: ' + sp.name, CFG.zones[sp.zone].name, 'species');
      LO.Audio.discover();
    }
    checkUnlocks();
    LO.Save.save();
    return true;
  }

  function onEat(fish, playerSize) {
    const d = save(), id = fish.sp.id;
    if (!d.species[id]) seeSpecies(id);
    if (d.species[id]) d.species[id].eaten++;
    run.eaten++;
    addGrowth(rewardFor(fish, playerSize));
  }

  function discoverZone(id) {
    const d = save();
    if (d.zones[id]) return false;
    d.zones[id] = 1;
    if (run) run.newZones.push(id);
    toast('Discovered: ' + CFG.zones[id].name, 'A new part of the ocean opens up', 'zone');
    LO.Audio.zone();
    checkUnlocks();
    LO.Save.save();
    return true;
  }
  function discoverPassage(g) {
    const d = save();
    if (d.passages[g.id]) return false;
    d.passages[g.id] = 1;
    if (run) run.newPassages.push(g.id);
    toast('Passage found: ' + g.name, 'Needs size ' + g.min + ' to pass', 'zone');
    LO.Audio.discover();
    LO.Save.save();
    return true;
  }
  function discoverPlace(p) {
    const d = save();
    if (d.places[p.id]) return false;
    d.places[p.id] = 1;
    if (run) run.newPlaces.push(p.id);
    toast((p.type === 'hidden' ? 'Hidden place: ' : 'Landmark: ') + p.name, CFG.zones[p.zone].name, 'zone');
    LO.Audio.discover();
    LO.Save.save();
    return true;
  }

  function recordDeath() {
    const d = save();
    d.stats.deaths++;
    d.stats.bestSize = Math.max(d.stats.bestSize, run.maxSize);
    d.stats.totalEaten += run.eaten;
    LO.Save.save();
  }

  return {
    newRun, addGrowth, rewardFor, onEat, seeSpecies, discoverZone, discoverPassage, discoverPlace, checkUnlocks, recordDeath, nextMilestone, refreshSize,
    get run() { return run; },
    MAXLV
  };
})();
