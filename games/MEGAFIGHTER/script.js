'use strict';

/* =========================================================================
   FIST CLUB — a single-file idle brawler
   ========================================================================= */

/* ---------------------------------------------------------------------
   CONSTANTS / DATA TABLES
--------------------------------------------------------------------- */

const VENUES = [
  { name: 'Back Alley',          opponents: ['Thug', 'Mugger', 'Bruiser', 'Enforcer', 'Alley King'] },
  { name: 'Boxing Gym',          opponents: ['Sparring Bot', 'Rookie', 'Contender', 'Trainer', 'Gym Champion'] },
  { name: 'Docks',               opponents: ['Dockhand', 'Smuggler', 'Brute', 'Foreman', 'Dock Boss'] },
  { name: 'Warehouse',           opponents: ['Guard', 'Wrecker', 'Hitman', 'Lieutenant', 'Warehouse Boss'] },
  { name: 'Underground Ring',    opponents: ['Fighter', 'Veteran', 'Killer', 'Champion', 'Ring Master'] },
  { name: 'Rooftop',             opponents: ['Ninja', 'Assassin', 'Shadow', 'Blade', 'Rooftop King'] },
  { name: 'Championship Arena',  opponents: ['Challenger', 'Contender', 'Elite', 'Legend', 'GRAND CHAMPION'] },
];
const STAGES_PER_VENUE = 5;

const GEAR_DEFS = {
  head:       { label: 'HEAD',       icon: '🪖', stat: 'def', per: 2,   baseCost: 40  },
  gloves:     { label: 'GLOVES',     icon: '🥊', stat: 'atk', per: 2,   baseCost: 45  },
  wrist:      { label: 'WRIST',      icon: '⌚', stat: 'crt', per: 0.4, baseCost: 50  },
  mouth:      { label: 'MOUTH',      icon: '🦷', stat: 'sta', per: 0.5, baseCost: 35  },
  shorts:     { label: 'SHORTS',     icon: '🩳', stat: 'dge', per: 0.3, baseCost: 50  },
  boots:      { label: 'BOOTS',      icon: '👟', stat: 'spd', per: 1.5, baseCost: 45  },
  belt:       { label: 'BELT',       icon: '🥋', stat: 'cmb', per: 0.4, baseCost: 55  },
  robe:       { label: 'ROBE',       icon: '🥼', stat: 'hp',  per: 5,   baseCost: 40  },
  girlfriend: { label: 'GIRLFRIEND', icon: '💃', stat: 'atk', per: 1,   baseCost: 60,  bonus2: 'hp', per2: 2 },
};
const GEAR_ORDER = ['head', 'gloves', 'wrist', 'mouth', 'shorts', 'boots', 'belt', 'robe', 'girlfriend'];

const SKILL_DEFS = [
  { key: 'ironFist',   name: 'Iron Fist',      desc: '+3% ATK per level',                 max: 5, stat: 'atkPct', per: 3 },
  { key: 'stoneSkin',  name: 'Stone Skin',     desc: '+3% DEF per level',                 max: 5, stat: 'defPct', per: 3 },
  { key: 'sprinter',   name: 'Sprinter',       desc: '+3% SPD per level',                 max: 5, stat: 'spdPct', per: 3 },
  { key: 'luckyHits',  name: 'Lucky Strikes',  desc: '+2% CRT chance per level',          max: 5, stat: 'crt',    per: 2 },
  { key: 'comboMast',  name: 'Combo Master',   desc: '+2% Combo chance per level',        max: 5, stat: 'cmb',    per: 2 },
  { key: 'ironJaw',    name: 'Iron Jaw',       desc: '+2% Dodge chance per level',        max: 5, stat: 'dge',    per: 2 },
  { key: 'secondWind', name: 'Second Wind',    desc: 'Heal 5% max HP per level on victory', max: 5, stat: 'secondWind', per: 5 },
  { key: 'vampiric',   name: 'Vampiric Strike',desc: '1% lifesteal per level',            max: 5, stat: 'lifesteal', per: 1 },
];

const GYM_DEFS = [
  { key: 'hp',  label: 'Train HP',  desc: '+10 Max HP per session',  gain: 10, baseCost: 60, cooldown: 4000 },
  { key: 'atk', label: 'Train ATK', desc: '+2 Attack per session',   gain: 2,  baseCost: 70, cooldown: 4000 },
  { key: 'def', label: 'Train DEF', desc: '+2 Defense per session',  gain: 2,  baseCost: 65, cooldown: 4000 },
  { key: 'spd', label: 'Train SPD', desc: '+2 Speed per session',    gain: 2,  baseCost: 75, cooldown: 4000 },
];

const ACHIEVEMENTS = [
  { key: 'firstBlood', name: 'First Blood',    desc: 'Win your first fight',           check: s => s.stats.wins >= 1 },
  { key: 'tenWins',    name: 'Brawler',         desc: 'Win 10 fights',                  check: s => s.stats.wins >= 10 },
  { key: 'fiftyWins',  name: 'Veteran',         desc: 'Win 50 fights',                  check: s => s.stats.wins >= 50 },
  { key: 'level10',    name: 'Rising Star',     desc: 'Reach player level 10',          check: s => s.player.level >= 10 },
  { key: 'level25',    name: 'Champion Material', desc: 'Reach player level 25',        check: s => s.player.level >= 25 },
  { key: 'fullyGeared',name: 'Fully Geared',    desc: 'Every gear slot at level 5+',    check: s => GEAR_ORDER.every(g => s.gear[g] >= 5) },
  { key: 'arena10',    name: 'Arena Star',      desc: 'Hit a 10-win arena streak',      check: s => s.arena.best >= 10 },
  { key: 'venue2',     name: 'Moving Up',       desc: 'Clear the Back Alley venue',     check: s => s.progress.venue >= 1 },
];

const MAX_ENERGY = 10;
const ENERGY_REGEN_MS = 90 * 1000;
const XP_BASE = 100;
const MATCH_TIME_MS = 60 * 1000;
const SAVE_KEY = 'fistclub_save_v1';

/* ---------------------------------------------------------------------
   STATE
--------------------------------------------------------------------- */

function freshState() {
  return {
    player: { name: 'CHAMP', level: 1, xp: 0 },
    base: { hp: 240, atk: 50, def: 30, spd: 110, crt: 1, cmb: 1, sta: 1, dge: 1 },
    gymBonus: { hp: 0, atk: 0, def: 0, spd: 0 },
    gear: { head: 0, gloves: 0, wrist: 0, mouth: 0, shorts: 0, boots: 0, belt: 0, robe: 0, girlfriend: 0 },
    skills: { ironFist: 0, stoneSkin: 0, sprinter: 0, luckyHits: 0, comboMast: 0, ironJaw: 0, secondWind: 0, vampiric: 0 },
    skillPoints: 0,
    coins: 0,
    progress: { venue: 0, stage: 0 },
    energy: MAX_ENERGY,
    energyRegenAt: 0,
    arena: { streak: 0, best: 0, points: 0 },
    cheats: { godMode: false, oneHit: false, infEnergy: false, doubleRewards: false },
    achievementsUnlocked: {},
    stats: { wins: 0, losses: 0 },
    soundOn: true,
    battleSpeed: 1,
  };
}

let S = freshState();

/* ---------------------------------------------------------------------
   DERIVED STATS
--------------------------------------------------------------------- */

function computeEffectiveStats() {
  const b = S.base;
  const gym = S.gymBonus;
  let hp = b.hp + gym.hp, atk = b.atk + gym.atk, def = b.def + gym.def, spd = b.spd + gym.spd;
  let crt = b.crt, cmb = b.cmb, sta = b.sta, dge = b.dge;

  for (const key of GEAR_ORDER) {
    const def_ = GEAR_DEFS[key];
    const lvl = S.gear[key];
    if (!lvl) continue;
    const val = lvl * def_.per;
    applyStat(def_.stat, val);
    if (def_.bonus2) applyStat(def_.bonus2, lvl * def_.per2);
  }
  function applyStat(stat, val) {
    if (stat === 'hp') hp += val;
    else if (stat === 'atk') atk += val;
    else if (stat === 'def') def += val;
    else if (stat === 'spd') spd += val;
    else if (stat === 'crt') crt += val;
    else if (stat === 'cmb') cmb += val;
    else if (stat === 'sta') sta += val;
    else if (stat === 'dge') dge += val;
  }

  const sk = SKILL_DEFS.reduce((acc, d) => { acc[d.key] = S.skills[d.key] || 0; return acc; }, {});
  atk *= 1 + (sk.ironFist * 3) / 100;
  def *= 1 + (sk.stoneSkin * 3) / 100;
  spd *= 1 + (sk.sprinter * 3) / 100;
  crt += sk.luckyHits * 2;
  cmb += sk.comboMast * 2;
  dge += sk.ironJaw * 2;
  const lifesteal = sk.vampiric * 1;
  const secondWindPct = sk.secondWind * 5;

  return {
    hp: Math.round(hp), atk: Math.round(atk), def: Math.round(def), spd: Math.round(spd),
    crt: Math.min(75, +crt.toFixed(1)), cmb: Math.min(75, +cmb.toFixed(1)),
    sta: +sta.toFixed(1), dge: Math.min(60, +dge.toFixed(1)),
    lifesteal, secondWindPct,
  };
}

function globalStageIndex() { return S.progress.venue * STAGES_PER_VENUE + S.progress.stage; }

function generateOpponent() {
  const g = globalStageIndex();
  const venue = VENUES[S.progress.venue];
  const name = venue.opponents[S.progress.stage];
  const stars = S.progress.stage + 1;
  const diffMult = 1 + g * 0.16;
  const hp = Math.round((90 + g * 30) * (1 + (stars - 1) * 0.12));
  const atk = Math.round((14 + g * 3.4) * diffMult / (1 + g * 0.05));
  const def = Math.round(5 + g * 2.6);
  const spd = Math.round(58 + g * 2.4);
  const crt = Math.min(40, 4 + g * 0.6);
  const cmb = Math.min(40, 4 + g * 0.5);
  const dge = Math.min(35, 3 + g * 0.5);
  return { name, stars, hp, maxHp: hp, atk, def, spd, crt, cmb, dge };
}

function generateArenaOpponent() {
  const n = S.arena.streak;
  const pool = ['Iron Fist', 'Bone Crusher', 'Night Terror', 'The Wall', 'Razor', 'Widowmaker', 'Grim', 'Tank'];
  const name = pool[n % pool.length];
  const mult = 1 + n * 0.22;
  const hp = Math.round(160 * mult);
  const atk = Math.round(28 * mult);
  const def = Math.round(14 * mult);
  const spd = Math.round(80 + n * 4);
  const crt = Math.min(45, 8 + n * 1.2);
  const cmb = Math.min(45, 6 + n * 1);
  const dge = Math.min(40, 5 + n * 1);
  return { name, stars: Math.min(5, 1 + Math.floor(n / 3)), hp, maxHp: hp, atk, def, spd, crt, cmb, dge };
}

/* ---------------------------------------------------------------------
   AUDIO (tiny synth beeps, no assets needed)
--------------------------------------------------------------------- */

let audioCtx = null;
function beep(freq, dur, type, vol) {
  if (!S.soundOn) return;
  try {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = type || 'square';
    osc.frequency.value = freq;
    gain.gain.value = vol || 0.06;
    osc.connect(gain); gain.connect(audioCtx.destination);
    osc.start();
    gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + dur);
    osc.stop(audioCtx.currentTime + dur);
  } catch (e) { /* audio unavailable, ignore */ }
}
const sfx = {
  hit: () => beep(150, 0.08, 'square', 0.07),
  crit: () => beep(90, 0.16, 'sawtooth', 0.09),
  miss: () => beep(500, 0.05, 'sine', 0.04),
  win: () => { beep(523, 0.12, 'triangle', 0.08); setTimeout(() => beep(659, 0.14, 'triangle', 0.08), 120); setTimeout(() => beep(784, 0.2, 'triangle', 0.08), 260); },
  lose: () => { beep(300, 0.2, 'sawtooth', 0.07); setTimeout(() => beep(220, 0.3, 'sawtooth', 0.07), 150); },
  levelup: () => { beep(440, 0.1, 'triangle', 0.08); setTimeout(() => beep(660, 0.18, 'triangle', 0.08), 100); },
  click: () => beep(700, 0.04, 'square', 0.03),
  upgrade: () => beep(880, 0.1, 'triangle', 0.06),
};

/* ---------------------------------------------------------------------
   DOM SHORTCUTS
--------------------------------------------------------------------- */

const $ = id => document.getElementById(id);
const els = {};
['playerName','playerHpFill','playerHpText','venueName','stageLabel','playerLevel','enemyName','enemyHpFill','enemyStars',
 'battleStage','playerFighter','enemyFighter','energyBadge','energyText','logToggleBtn','achToggleBtn','settingsToggleBtn',
 'combatLog','logEntries','achPanel','achList','settingsPanel','soundToggle','battleSpeedSelect','hardResetBtn',
 'toastStack','resultModal','resultTitle','resultRewards','resultContinueBtn','levelupModal','levelupBody','levelupCloseBtn',
 'timerPill','fightBtn','statHP','statATK','statDEF','statSPD','statCRT','statCMB','statSTA','statDGE',
 'fistCoins','xpText','skillPoints','tabs','tabContent','gearGrid','skillsList','gymLockedMsg','gymList',
 'arenaLockedMsg','arenaPanel','arenaStreak','arenaBest','arenaPoints','arenaOpponentPreview','arenaFightBtn',
 'gearSheetBackdrop','gearSheet','gearSheetTitle','gearSheetIcon','gearSheetLevel','gearSheetBonus','gearSheetNext','gearSheetUpgradeBtn',
 'dumpsterLeft','trashRight',
 'cheatGodMode','cheatOneHit','cheatInfEnergy','cheatDoubleRewards','cheatAddCoins','cheatAddSkill','cheatAddLevels','cheatRefillEnergy','cheatUnlockAll','cheatResetSave'
].forEach(id => els[id] = $(id));

/* ---------------------------------------------------------------------
   TOASTS / LOG
--------------------------------------------------------------------- */

function toast(msg) {
  const t = document.createElement('div');
  t.className = 'toast';
  t.textContent = msg;
  els.toastStack.appendChild(t);
  setTimeout(() => t.remove(), 2200);
}

function logMsg(msg, cls) {
  const d = document.createElement('div');
  if (cls) d.className = cls;
  d.textContent = msg;
  els.logEntries.prepend(d);
  while (els.logEntries.children.length > 80) els.logEntries.removeChild(els.logEntries.lastChild);
}

/* ---------------------------------------------------------------------
   DAMAGE POPUPS / FIGHTER FX
--------------------------------------------------------------------- */

function popDamage(fighterEl, text, cls) {
  const anchor = fighterEl.querySelector('.dmg-pop-anchor');
  const d = document.createElement('div');
  d.className = 'dmg-pop' + (cls ? ' ' + cls : '');
  d.textContent = text;
  d.style.left = (40 + Math.random() * 20 - 10) + '%';
  anchor.appendChild(d);
  setTimeout(() => d.remove(), 820);
}

function flinch(el) {
  el.classList.add('hit-flinch');
  setTimeout(() => el.classList.remove('hit-flinch'), 150);
}
function lunge(el) {
  el.classList.add('attack-lunge');
  setTimeout(() => el.classList.remove('attack-lunge'), 150);
}
function shakeScreen() {
  els.battleStage.classList.add('screen-shake');
  setTimeout(() => els.battleStage.classList.remove('screen-shake'), 250);
}

/* ---------------------------------------------------------------------
   BATTLE ENGINE
--------------------------------------------------------------------- */

let battle = null; // active battle state
let battleTickHandle = null;

function startBattle(mode) {
  if (battle && battle.active) return;
  if (mode === 'campaign') {
    if (!S.cheats.infEnergy && S.energy <= 0) { toast('Out of energy! Wait or use a cheat.'); return; }
    if (!S.cheats.infEnergy) { S.energy--; if (!S.energyRegenAt) S.energyRegenAt = Date.now() + ENERGY_REGEN_MS; }
  }
  const eff = computeEffectiveStats();
  const opp = mode === 'arena' ? generateArenaOpponent() : generateOpponent();

  battle = {
    active: true,
    mode,
    playerHp: eff.hp, playerMaxHp: eff.hp,
    enemyHp: opp.hp, enemyMaxHp: opp.maxHp,
    playerGauge: 0, enemyGauge: 0,
    eff, opp,
    timeLeft: MATCH_TIME_MS,
    lastTick: performance.now(),
  };

  els.enemyName.textContent = opp.name.toUpperCase();
  els.enemyStars.textContent = '★'.repeat(opp.stars) + '☆'.repeat(5 - opp.stars);
  renderHpBars();
  els.fightBtn.textContent = 'RUNNING...';
  els.fightBtn.classList.add('stop');
  els.fightBtn.disabled = true;
  updateEnergyBadge();
  logMsg(`— Fight started vs ${opp.name} —`);

  if (battleTickHandle) clearInterval(battleTickHandle);
  battleTickHandle = setInterval(battleTick, 50);
}

function battleTick() {
  if (!battle || !battle.active) return;
  const now = performance.now();
  let dt = (now - battle.lastTick) * S.battleSpeed;
  battle.lastTick = now;
  if (dt > 400) dt = 400;

  battle.timeLeft -= dt;
  if (battle.timeLeft <= 0) { endBattle('timeout'); return; }
  els.timerPill.textContent = formatTime(Math.max(0, battle.timeLeft));

  const eff = battle.eff, opp = battle.opp;

  // stamina regen (small passive heal, gives STA a purpose)
  const regen = (eff.sta / 100) * eff.hp * 0.02 * (dt / 1000) * 5;
  battle.playerHp = Math.min(battle.playerMaxHp, battle.playerHp + regen);

  battle.playerGauge += (eff.spd) * (dt / 1000);
  battle.enemyGauge += (opp.spd) * (dt / 1000);

  if (battle.playerGauge >= 100) {
    battle.playerGauge -= 100;
    performAttack('player');
    if (!battle.active) return;
  }
  if (battle.enemyGauge >= 100) {
    battle.enemyGauge -= 100;
    performAttack('enemy');
    if (!battle.active) return;
  }

  renderHpBars();
}

function performAttack(side) {
  const eff = battle.eff, opp = battle.opp;
  const attackerEl = side === 'player' ? els.playerFighter : els.enemyFighter;
  const defenderEl = side === 'player' ? els.enemyFighter : els.playerFighter;
  lunge(attackerEl);

  const atkStat = side === 'player' ? eff.atk : opp.atk;
  const defStat = side === 'player' ? opp.def : eff.def;
  const crtChance = side === 'player' ? eff.crt : opp.crt;
  const cmbChance = side === 'player' ? eff.cmb : opp.cmb;
  const dgeChance = side === 'player' ? opp.dge : eff.dge;

  // god mode: player takes no damage
  if (side === 'enemy' && S.cheats.godMode) {
    popDamage(defenderEl, 'BLOCKED', 'miss');
    flinch(defenderEl);
    return;
  }

  if (Math.random() * 100 < dgeChance) {
    popDamage(defenderEl, 'MISS', 'miss');
    sfx.miss();
    logMsg(`${side === 'player' ? 'You' : opp.name} missed!`);
    return;
  }

  let hits = 1;
  if (Math.random() * 100 < cmbChance) hits = 2;

  let totalDmg = 0;
  for (let h = 0; h < hits; h++) {
    let dmg = atkStat * (100 / (100 + defStat)) * (h === 0 ? 1 : 0.5);
    let isCrit = Math.random() * 100 < crtChance;
    if (isCrit) dmg *= 1.75;
    if (side === 'player' && S.cheats.oneHit) dmg = 99999;
    dmg = Math.max(1, Math.round(dmg));
    totalDmg += dmg;

    if (side === 'player') {
      battle.enemyHp -= dmg;
      popDamage(defenderEl, '-' + dmg, isCrit ? 'crit' : '');
      if (isCrit) { sfx.crit(); shakeScreen(); logMsg(`CRITICAL! You hit ${opp.name} for ${dmg}`, 'log-crit'); }
      else { sfx.hit(); logMsg(`You hit ${opp.name} for ${dmg}`); }
      if (eff.lifesteal > 0) {
        const heal = dmg * (eff.lifesteal / 100);
        battle.playerHp = Math.min(battle.playerMaxHp, battle.playerHp + heal);
      }
    } else {
      battle.playerHp -= dmg;
      popDamage(defenderEl, '-' + dmg, isCrit ? 'crit' : '');
      if (isCrit) { sfx.crit(); shakeScreen(); logMsg(`CRITICAL! ${opp.name} hit you for ${dmg}`, 'log-crit'); }
      else { sfx.hit(); logMsg(`${opp.name} hit you for ${dmg}`); }
    }
    flinch(defenderEl);
    if (battle.enemyHp <= 0 || battle.playerHp <= 0) break;
  }

  if (battle.enemyHp <= 0) { battle.enemyHp = 0; endBattle('win'); return; }
  if (battle.playerHp <= 0) { battle.playerHp = 0; endBattle('lose'); return; }
}

function endBattle(result) {
  if (!battle || !battle.active) return;
  battle.active = false;
  clearInterval(battleTickHandle);
  battleTickHandle = null;
  els.fightBtn.textContent = 'FIGHT!';
  els.fightBtn.classList.remove('stop');
  els.fightBtn.disabled = false;

  if (result === 'win') {
    sfx.win();
    els.playerFighter.classList.remove('ko');
    els.enemyFighter.classList.add('ko');
    setTimeout(() => els.enemyFighter.classList.remove('ko'), 900);
    handleWin();
  } else {
    sfx.lose();
    els.enemyFighter.classList.remove('ko');
    els.playerFighter.classList.add('ko');
    setTimeout(() => els.playerFighter.classList.remove('ko'), 900);
    handleLoss(result);
  }
  renderAll();
}

function handleWin() {
  S.stats.wins++;
  const g = battle.mode === 'arena' ? (10 + S.arena.streak * 4) : (globalStageIndex() + 1);
  let coins = Math.round((20 + g * 6) * (S.cheats.doubleRewards ? 2 : 1));
  let xp = Math.round((15 + g * 3));

  logMsg(`You defeated ${battle.opp.name}!`, 'log-win');

  if (battle.mode === 'arena') {
    S.arena.streak++;
    S.arena.best = Math.max(S.arena.best, S.arena.streak);
    S.arena.points += 5 + S.arena.streak;
    coins = Math.round(coins * 1.4);
  } else {
    // campaign progression
    S.progress.stage++;
    if (S.progress.stage >= STAGES_PER_VENUE) {
      S.progress.stage = 0;
      if (S.progress.venue < VENUES.length - 1) S.progress.venue++;
    }
  }

  const eff = computeEffectiveStats();
  const secondWindHeal = eff.secondWindPct > 0 ? Math.round(eff.hp * (eff.secondWindPct / 100)) : 0;

  S.coins += coins;
  addXp(xp);
  checkAchievements();

  const rewardsHtml = `+${coins} 🪙 Coins<br>+${xp} ⭐ XP` + (secondWindHeal ? `<br>+${secondWindHeal} HP (Second Wind)` : '') +
    (battle.mode === 'arena' ? `<br>Streak: ${S.arena.streak}` : '');
  els.resultTitle.textContent = 'VICTORY!';
  els.resultTitle.className = 'result-title';
  els.resultRewards.innerHTML = rewardsHtml;
  els.resultModal.classList.add('open');
}

function handleLoss(result) {
  S.stats.losses++;
  if (battle.mode === 'arena') {
    S.arena.streak = 0;
  }
  const consolation = Math.round(8 + globalStageIndex() * 1.5);
  S.coins += consolation;
  logMsg(result === 'timeout' ? `Time ran out against ${battle.opp.name}.` : `You were defeated by ${battle.opp.name}.`, 'log-lose');

  els.resultTitle.textContent = result === 'timeout' ? "TIME'S UP" : 'DEFEATED';
  els.resultTitle.className = 'result-title lose';
  els.resultRewards.innerHTML = `+${consolation} 🪙 Coins (consolation)<br>Try upgrading your gear!`;
  els.resultModal.classList.add('open');
}

function addXp(amount) {
  S.player.xp += amount;
  let needed = xpNeeded(S.player.level);
  let leveled = false;
  const gains = { hp: 0, atk: 0, def: 0, spd: 0, sp: 0 };
  while (S.player.xp >= needed) {
    S.player.xp -= needed;
    S.player.level++;
    leveled = true;
    S.base.hp += 12; gains.hp += 12;
    S.base.atk += 3; gains.atk += 3;
    S.base.def += 2; gains.def += 2;
    S.base.spd += 2; gains.spd += 2;
    S.skillPoints += 1; gains.sp += 1;
    needed = xpNeeded(S.player.level);
  }
  if (leveled) {
    sfx.levelup();
    let unlocks = '';
    if (S.player.level >= 5) unlocks += checkUnlockTab('gym') ? '<br>🔓 Gym unlocked!' : '';
    if (S.player.level >= 10) unlocks += checkUnlockTab('arena') ? '<br>🔓 Arena unlocked!' : '';
    els.levelupBody.innerHTML = `Level ${S.player.level}<br>+${gains.hp} HP, +${gains.atk} ATK, +${gains.def} DEF, +${gains.spd} SPD<br>+${gains.sp} Skill Point(s)` + unlocks;
    els.levelupModal.classList.add('open');
  }
}
function xpNeeded(level) { return Math.round(XP_BASE * Math.pow(level, 1.35)); }

const unlockedTabs = { gym: false, arena: false };
function checkUnlockTab(tab) {
  if (unlockedTabs[tab]) return false;
  unlockedTabs[tab] = true;
  return true;
}

function formatTime(ms) {
  const s = Math.ceil(ms / 1000);
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${sec.toString().padStart(2, '0')}`;
}

/* ---------------------------------------------------------------------
   RENDERING
--------------------------------------------------------------------- */

function renderHpBars() {
  if (!battle) return;
  const pPct = Math.max(0, battle.playerHp / battle.playerMaxHp * 100);
  const ePct = Math.max(0, battle.enemyHp / battle.enemyMaxHp * 100);
  els.playerHpFill.style.width = pPct + '%';
  els.enemyHpFill.style.width = ePct + '%';
  els.playerHpText.textContent = `${Math.max(0, Math.round(battle.playerHp))} / ${battle.playerMaxHp}`;
}

function renderTopBar() {
  els.playerName.textContent = S.player.name;
  els.playerLevel.textContent = S.player.level;
  els.venueName.textContent = VENUES[S.progress.venue].name.toUpperCase();
  els.stageLabel.textContent = `STAGE ${S.progress.venue + 1}-${S.progress.stage + 1}`;
  if (!battle || !battle.active) {
    const eff = computeEffectiveStats();
    els.playerHpFill.style.width = '100%';
    els.playerHpText.textContent = `${eff.hp} / ${eff.hp}`;
    els.enemyHpFill.style.width = '100%';
    const preview = generateOpponent();
    els.enemyName.textContent = preview.name.toUpperCase();
    els.enemyStars.textContent = '★'.repeat(preview.stars) + '☆'.repeat(5 - preview.stars);
    els.timerPill.textContent = formatTime(MATCH_TIME_MS);
  }
}

function renderStatsBar() {
  const eff = computeEffectiveStats();
  els.statHP.textContent = eff.hp;
  els.statATK.textContent = eff.atk;
  els.statDEF.textContent = eff.def;
  els.statSPD.textContent = eff.spd;
  els.statCRT.textContent = eff.crt + '%';
  els.statCMB.textContent = eff.cmb + '%';
  els.statSTA.textContent = eff.sta + '%';
  els.statDGE.textContent = eff.dge + '%';
}

function renderCurrency() {
  els.fistCoins.textContent = Math.floor(S.coins).toLocaleString();
  els.xpText.textContent = `${Math.floor(S.player.xp)}/${xpNeeded(S.player.level)}`;
  els.skillPoints.textContent = S.skillPoints;
}

function updateEnergyBadge() {
  els.energyText.textContent = `${S.energy}/${MAX_ENERGY}`;
  if (S.cheats.infEnergy) els.energyText.textContent = '∞/∞';
}

function renderGear() {
  els.gearGrid.innerHTML = '';
  GEAR_ORDER.forEach(key => {
    const def = GEAR_DEFS[key];
    const lvl = S.gear[key];
    const slot = document.createElement('div');
    slot.className = 'gear-slot' + (lvl > 0 ? ' geared' : '');
    slot.innerHTML = `${lvl > 0 ? `<div class="g-badge">${lvl}</div>` : ''}<div class="g-icon">${def.icon}</div><div class="g-label">${def.label}</div>`;
    slot.addEventListener('click', () => openGearSheet(key));
    els.gearGrid.appendChild(slot);
  });
}

function gearCost(key) {
  const def = GEAR_DEFS[key];
  const lvl = S.gear[key];
  return Math.round(def.baseCost * Math.pow(1.16, lvl));
}

let currentGearSheetKey = null;
function openGearSheet(key) {
  currentGearSheetKey = key;
  const def = GEAR_DEFS[key];
  const lvl = S.gear[key];
  els.gearSheetTitle.textContent = def.label;
  els.gearSheetIcon.textContent = def.icon;
  els.gearSheetLevel.textContent = lvl;
  const statName = { atk: 'ATK', def: 'DEF', spd: 'SPD', crt: 'CRT%', cmb: 'CMB%', sta: 'STA%', dge: 'DGE%', hp: 'HP' };
  let bonusText = `+${(lvl * def.per).toFixed(1)} ${statName[def.stat]}`;
  if (def.bonus2) bonusText += `, +${(lvl * def.per2).toFixed(1)} ${statName[def.bonus2]}`;
  els.gearSheetBonus.textContent = lvl > 0 ? `Current bonus: ${bonusText}` : 'No bonus yet — upgrade to activate!';
  const cost = gearCost(key);
  els.gearSheetNext.textContent = `Next level cost: ${cost} 🪙 (+${def.per} ${statName[def.stat]}${def.bonus2 ? `, +${def.per2} ${statName[def.bonus2]}` : ''})`;
  els.gearSheetUpgradeBtn.disabled = S.coins < cost;
  els.gearSheetBackdrop.classList.add('open');
}

function upgradeCurrentGear() {
  const key = currentGearSheetKey;
  if (!key) return;
  const cost = gearCost(key);
  if (S.coins < cost) { toast('Not enough coins!'); return; }
  S.coins -= cost;
  S.gear[key]++;
  sfx.upgrade();
  toast(`${GEAR_DEFS[key].label} upgraded to level ${S.gear[key]}!`);
  openGearSheet(key);
  renderAll();
  checkAchievements();
}

function renderSkills() {
  els.skillsList.innerHTML = '';
  SKILL_DEFS.forEach(def => {
    const lvl = S.skills[def.key];
    const card = document.createElement('div');
    card.className = 'skill-card';
    const maxed = lvl >= def.max;
    card.innerHTML = `
      <div class="skill-top"><span class="skill-name">${def.name}</span><span class="skill-lvl">${lvl}/${def.max}</span></div>
      <div class="skill-desc">${def.desc}</div>
      <button class="skill-btn" ${maxed || S.skillPoints < 1 ? 'disabled' : ''}>${maxed ? 'MAXED' : `UPGRADE (1 🧠)`}</button>
    `;
    card.querySelector('.skill-btn').addEventListener('click', () => {
      if (S.skills[def.key] >= def.max || S.skillPoints < 1) return;
      S.skillPoints--;
      S.skills[def.key]++;
      sfx.upgrade();
      toast(`${def.name} now level ${S.skills[def.key]}!`);
      renderAll();
    });
    els.skillsList.appendChild(card);
  });
}

const gymCooldowns = {};
function renderGym() {
  const unlocked = S.player.level >= 5;
  els.gymLockedMsg.style.display = unlocked ? 'none' : 'block';
  els.gymList.style.display = unlocked ? 'flex' : 'none';
  els.gymList.style.flexDirection = 'column';
  els.gymList.style.gap = '10px';
  if (!unlocked) return;
  els.gymList.innerHTML = '';
  GYM_DEFS.forEach(def => {
    const timesTrained = S.gymTrained ? (S.gymTrained[def.key] || 0) : 0;
    const cost = Math.round(def.baseCost * Math.pow(1.22, timesTrained));
    const onCooldown = gymCooldowns[def.key] && gymCooldowns[def.key] > Date.now();
    const card = document.createElement('div');
    card.className = 'gym-card';
    card.innerHTML = `
      <div class="gym-top"><span>${def.label}</span><span>${cost} 🪙</span></div>
      <div class="gym-desc">${def.desc} • Current bonus: +${S.gymBonus[def.key]}</div>
      <div class="gym-progress ${onCooldown ? 'active' : ''}"><div class="gym-progress-fill" style="width:${onCooldown ? 100 - (gymCooldowns[def.key] - Date.now()) / def.cooldown * 100 : 0}%"></div></div>
      <button class="gym-btn" ${(S.coins < cost || onCooldown) ? 'disabled' : ''}>${onCooldown ? 'TRAINING...' : 'TRAIN'}</button>
    `;
    card.querySelector('.gym-btn').addEventListener('click', () => trainStat(def));
    els.gymList.appendChild(card);
  });
}

function trainStat(def) {
  const timesTrained = S.gymTrained ? (S.gymTrained[def.key] || 0) : 0;
  const cost = Math.round(def.baseCost * Math.pow(1.22, timesTrained));
  if (S.coins < cost) { toast('Not enough coins!'); return; }
  if (gymCooldowns[def.key] && gymCooldowns[def.key] > Date.now()) return;
  S.coins -= cost;
  if (!S.gymTrained) S.gymTrained = {};
  S.gymTrained[def.key] = timesTrained + 1;
  S.gymBonus[def.key] += def.gain;
  sfx.upgrade();
  toast(`Trained ${def.label}! +${def.gain}`);
  gymCooldowns[def.key] = Date.now() + def.cooldown;
  const iv = setInterval(() => {
    renderGym();
    if (!gymCooldowns[def.key] || gymCooldowns[def.key] <= Date.now()) clearInterval(iv);
  }, 150);
  renderAll();
}

function renderArena() {
  const unlocked = S.player.level >= 10;
  els.arenaLockedMsg.style.display = unlocked ? 'none' : 'block';
  els.arenaPanel.style.display = unlocked ? 'block' : 'none';
  if (!unlocked) return;
  els.arenaStreak.textContent = S.arena.streak;
  els.arenaBest.textContent = S.arena.best;
  els.arenaPoints.textContent = S.arena.points;
  const preview = generateArenaOpponent();
  els.arenaOpponentPreview.textContent = `Next opponent: ${preview.name} (${'★'.repeat(preview.stars)})`;
  els.arenaFightBtn.disabled = !!(battle && battle.active);
}

function renderTabsLockState() {
  const gymTab = document.querySelector('.tab-btn[data-tab="gym"]');
  const arenaTab = document.querySelector('.tab-btn[data-tab="arena"]');
  const gymUnlocked = S.player.level >= 5;
  const arenaUnlocked = S.player.level >= 10;
  gymTab.classList.toggle('locked', !gymUnlocked);
  arenaTab.classList.toggle('locked', !arenaUnlocked);
  gymTab.innerHTML = gymUnlocked ? 'Gym' : 'Gym <span class="lock">🔒</span>';
  arenaTab.innerHTML = arenaUnlocked ? 'Arena' : 'Arena <span class="lock">🔒</span>';
}

function renderAchievements() {
  els.achList.innerHTML = '';
  ACHIEVEMENTS.forEach(a => {
    const done = !!S.achievementsUnlocked[a.key];
    const item = document.createElement('div');
    item.className = 'ach-item' + (done ? ' done' : '');
    item.innerHTML = `<div class="ach-name">${done ? '✅ ' : '⬜ '}${a.name}</div><div class="ach-desc">${a.desc}</div>`;
    els.achList.appendChild(item);
  });
}

function checkAchievements() {
  ACHIEVEMENTS.forEach(a => {
    if (!S.achievementsUnlocked[a.key] && a.check(S)) {
      S.achievementsUnlocked[a.key] = true;
      toast(`🏆 Achievement: ${a.name}`);
    }
  });
}

function renderCheats() {
  els.cheatGodMode.checked = S.cheats.godMode;
  els.cheatOneHit.checked = S.cheats.oneHit;
  els.cheatInfEnergy.checked = S.cheats.infEnergy;
  els.cheatDoubleRewards.checked = S.cheats.doubleRewards;
}

function renderAll() {
  renderTopBar();
  renderStatsBar();
  renderCurrency();
  updateEnergyBadge();
  renderGear();
  renderSkills();
  renderGym();
  renderArena();
  renderTabsLockState();
  renderAchievements();
  renderCheats();
}

/* ---------------------------------------------------------------------
   TABS
--------------------------------------------------------------------- */

document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const tab = btn.dataset.tab;
    if (tab === 'gym' && S.player.level < 5) { toast('Reach Level 5 to unlock the Gym!'); return; }
    if (tab === 'arena' && S.player.level < 10) { toast('Reach Level 10 to unlock the Arena!'); return; }
    sfx.click();
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
    btn.classList.add('active');
    $('panel-' + tab).classList.add('active');
  });
});

/* ---------------------------------------------------------------------
   PANEL TOGGLES (log / achievements / settings)
--------------------------------------------------------------------- */

function togglePanel(el) { el.classList.toggle('open'); }
els.logToggleBtn.addEventListener('click', () => togglePanel(els.combatLog));
els.achToggleBtn.addEventListener('click', () => togglePanel(els.achPanel));
els.settingsToggleBtn.addEventListener('click', () => togglePanel(els.settingsPanel));
document.querySelectorAll('[data-close]').forEach(btn => {
  btn.addEventListener('click', () => {
    const target = $(btn.dataset.close);
    target.classList.remove('open');
  });
});

els.soundToggle.addEventListener('change', () => { S.soundOn = els.soundToggle.checked; });
els.battleSpeedSelect.addEventListener('change', () => { S.battleSpeed = parseFloat(els.battleSpeedSelect.value); });
els.hardResetBtn.addEventListener('click', resetSaveConfirm);
els.cheatResetSave.addEventListener('click', resetSaveConfirm);

function resetSaveConfirm() {
  if (confirm('Reset all progress? This cannot be undone.')) {
    localStorage.removeItem(SAVE_KEY);
    S = freshState();
    unlockedTabs.gym = false; unlockedTabs.arena = false;
    location.reload();
  }
}

/* ---------------------------------------------------------------------
   GEAR SHEET
--------------------------------------------------------------------- */

els.gearSheetUpgradeBtn.addEventListener('click', upgradeCurrentGear);

/* ---------------------------------------------------------------------
   RESULT / LEVELUP MODALS
--------------------------------------------------------------------- */

els.resultContinueBtn.addEventListener('click', () => {
  els.resultModal.classList.remove('open');
  renderAll();
});
els.levelupCloseBtn.addEventListener('click', () => {
  els.levelupModal.classList.remove('open');
});

/* ---------------------------------------------------------------------
   FIGHT BUTTONS
--------------------------------------------------------------------- */

els.fightBtn.addEventListener('click', () => {
  sfx.click();
  startBattle('campaign');
});
els.arenaFightBtn.addEventListener('click', () => {
  sfx.click();
  startBattle('arena');
});

/* ---------------------------------------------------------------------
   CHEATS
--------------------------------------------------------------------- */

els.cheatGodMode.addEventListener('change', () => { S.cheats.godMode = els.cheatGodMode.checked; toast('God Mode ' + (S.cheats.godMode ? 'ON' : 'OFF')); });
els.cheatOneHit.addEventListener('change', () => { S.cheats.oneHit = els.cheatOneHit.checked; toast('One-Hit KO ' + (S.cheats.oneHit ? 'ON' : 'OFF')); });
els.cheatInfEnergy.addEventListener('change', () => { S.cheats.infEnergy = els.cheatInfEnergy.checked; updateEnergyBadge(); toast('Infinite Energy ' + (S.cheats.infEnergy ? 'ON' : 'OFF')); });
els.cheatDoubleRewards.addEventListener('change', () => { S.cheats.doubleRewards = els.cheatDoubleRewards.checked; toast('Double Rewards ' + (S.cheats.doubleRewards ? 'ON' : 'OFF')); });

els.cheatAddCoins.addEventListener('click', () => { S.coins += 10000; toast('+10,000 🪙'); renderAll(); });
els.cheatAddSkill.addEventListener('click', () => { S.skillPoints += 25; toast('+25 Skill Points'); renderAll(); });
els.cheatAddLevels.addEventListener('click', () => { for (let i = 0; i < 5; i++) addXp(xpNeeded(S.player.level)); renderAll(); });
els.cheatRefillEnergy.addEventListener('click', () => { S.energy = MAX_ENERGY; S.energyRegenAt = 0; toast('Energy refilled!'); renderAll(); });
els.cheatUnlockAll.addEventListener('click', () => {
  S.progress.venue = VENUES.length - 1;
  S.progress.stage = 0;
  toast('All venues unlocked!');
  renderAll();
});

/* ---------------------------------------------------------------------
   MAIN LOOP (energy regen, timers)
--------------------------------------------------------------------- */

setInterval(() => {
  if (!S.cheats.infEnergy && S.energy < MAX_ENERGY && S.energyRegenAt) {
    if (Date.now() >= S.energyRegenAt) {
      S.energy++;
      S.energyRegenAt = S.energy < MAX_ENERGY ? Date.now() + ENERGY_REGEN_MS : 0;
      updateEnergyBadge();
    }
  }
  if (!S.cheats.infEnergy && S.energyRegenAt && S.energy < MAX_ENERGY) {
    const remain = Math.max(0, S.energyRegenAt - Date.now());
    if (remain > 0 && !(battle && battle.active)) {
      // subtle hint via badge title
    }
  }
}, 1000);

/* ---------------------------------------------------------------------
   SAVE / LOAD
--------------------------------------------------------------------- */

function save() {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(S)); } catch (e) { /* storage unavailable */ }
}
function load() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return;
    const loaded = JSON.parse(raw);
    S = Object.assign(freshState(), loaded);
    // ensure nested objects merged properly
    S.base = Object.assign(freshState().base, loaded.base);
    S.gymBonus = Object.assign(freshState().gymBonus, loaded.gymBonus);
    S.gear = Object.assign(freshState().gear, loaded.gear);
    S.skills = Object.assign(freshState().skills, loaded.skills);
    S.progress = Object.assign(freshState().progress, loaded.progress);
    S.arena = Object.assign(freshState().arena, loaded.arena);
    S.cheats = Object.assign(freshState().cheats, loaded.cheats);
    S.stats = Object.assign(freshState().stats, loaded.stats);
    S.player = Object.assign(freshState().player, loaded.player);
    unlockedTabs.gym = S.player.level >= 5;
    unlockedTabs.arena = S.player.level >= 10;
  } catch (e) { /* ignore corrupted save */ }
}
setInterval(save, 5000);
window.addEventListener('beforeunload', save);

/* ---------------------------------------------------------------------
   INIT
--------------------------------------------------------------------- */

function init() {
  load();
  els.soundToggle.checked = S.soundOn;
  els.battleSpeedSelect.value = String(S.battleSpeed);
  renderAll();
  logMsg('Welcome to Fist Club. Tap FIGHT! to begin.');
}

init();
