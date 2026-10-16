/* Little Ocean - evolution tree: three branches, 12 upgrades, offers, stat recalculation and Canvas-drawn icons. */
window.LO = window.LO || {};
LO.Evolution = (function () {
  const CFG = LO.CFG;

  const BRANCHES = {
    speed: { name: 'Speed', color: '#4fd1c5', blurb: 'Swim faster and turn sharper.' },
    resilience: { name: 'Resilience', color: '#b79cff', blurb: 'Survive predators and slip away.' },
    burst: { name: 'Burst', color: '#ff8f7a', blurb: 'Master the sudden dash.' }
  };

  const UPGRADES = [
    { id: 's1', branch: 'speed', tier: 1, name: 'Streamlined Fins', icon: 'fins', desc: 'Sleeker fins cut through the water with less effort.', benefit: '+12% swim speed', apply: (s) => { s.speedMul *= 1.12; } },
    { id: 's2', branch: 'speed', tier: 2, name: 'Agile Tail', icon: 'turn', desc: 'A flexible tail lets you pivot and accelerate in a flash.', benefit: '+25% acceleration, +35% turning', unlock: { zone: 'kelp' }, apply: (s) => { s.accelMul *= 1.25; s.turnMul *= 1.35; } },
    { id: 's3', branch: 'speed', tier: 2, name: "Hunter's Instinct", icon: 'chase', desc: 'When a meal is close your body surges toward it.', benefit: '+20% speed while prey is nearby', unlock: { zone: 'blue' }, apply: (s) => { s.pursuit += 0.2; } },
    { id: 's4', branch: 'speed', tier: 3, name: 'Current Rider', icon: 'ride', desc: 'You learn to ride the water itself and glide for longer.', benefit: '+10% speed, longer glide', unlock: { legend: 'aurora_ray' }, apply: (s) => { s.speedMul *= 1.1; s.drift *= 0.6; } },

    { id: 'r1', branch: 'resilience', tier: 1, name: 'Tough Scales', icon: 'scales', desc: 'Thicker scales make you a less appealing mouthful.', benefit: 'Predators must be ~10% larger to eat you', apply: (s) => { s.ratioMod += 0.12; } },
    { id: 'r2', branch: 'resilience', tier: 2, name: 'Shadow Sense', icon: 'shadow', desc: 'Dull colours and a quiet wake help you slip past watchful eyes.', benefit: 'Predators notice you 30% less', unlock: { zone: 'kelp' }, apply: (s) => { s.stealth *= 0.7; } },
    { id: 'r3', branch: 'resilience', tier: 2, name: 'Slick Skin', icon: 'slick', desc: 'A slippery coat makes you hard to hold and harder to follow.', benefit: 'Predators chasing you are 10% slower', unlock: { zone: 'blue' }, apply: (s) => { s.predSlow += 0.1; } },
    { id: 'r4', branch: 'resilience', tier: 3, name: 'Lucky Escape', icon: 'heart', desc: 'A golden charm. Once per run, a fatal bite spits you out instead.', benefit: 'Survive one deadly bite each run', unlock: { legend: 'crown_seahorse' }, apply: (s) => { s.extraLife = 1; } },

    { id: 'b1', branch: 'burst', tier: 1, name: 'Strong Lungs', icon: 'lungs', desc: 'A bigger reserve of breath lets every burst last longer.', benefit: '+30 maximum burst energy', apply: (s) => { s.energyAdd += 30; } },
    { id: 'b2', branch: 'burst', tier: 2, name: 'Efficient Burst', icon: 'efficient', desc: 'Smoother technique wastes less energy.', benefit: '-25% burst energy cost', unlock: { zone: 'kelp' }, apply: (s) => { s.drainMul *= 0.75; } },
    { id: 'b3', branch: 'burst', tier: 2, name: 'Quick Recovery', icon: 'recover', desc: 'You catch your breath far faster between dashes.', benefit: '+45% energy regeneration', unlock: { zone: 'blue' }, apply: (s) => { s.regenMul *= 1.45; } },
    { id: 'b4', branch: 'burst', tier: 3, name: 'Torpedo Form', icon: 'torpedo', desc: 'You become a true arrow of the sea.', benefit: 'Burst speed x2.35 and faster launch', unlock: { legend: 'pearl_oracle' }, apply: (s) => { s.burstAdd += 0.35; s.burstAccel *= 1.5; } }
  ];
  const BY_ID = {};
  UPGRADES.forEach((u) => { BY_ID[u.id] = u; });

  function baseStats() {
    return { speedMul: 1, accelMul: 1, turnMul: 1, pursuit: 0, ratioMod: 0, stealth: 1, predSlow: 0, extraLife: 0, energyAdd: 0, drainMul: 1, regenMul: 1, burstAdd: 0, burstAccel: 1, drift: 1 };
  }
  function computeStats(ids) {
    const s = baseStats();
    ids.forEach((id) => { if (BY_ID[id]) BY_ID[id].apply(s); });
    return s;
  }

  const isUnlocked = (u) => !!LO.Save.data.evo[u.id];
  function unlockText(u) {
    if (!u.unlock) return '';
    if (u.unlock.zone) return 'Discover ' + CFG.zones[u.unlock.zone].name;
    if (u.unlock.legend) return 'Find the ' + LO.SPECIES_BY_ID[u.unlock.legend].name;
    return '';
  }

  // choose up to three options for a milestone: one per branch where possible
  function offer(run, maxTier) {
    const taken = run.evo;
    const pool = UPGRADES.filter((u) => !taken.includes(u.id) && isUnlocked(u) && u.tier <= maxTier);
    const out = [];
    Object.keys(BRANCHES).forEach((b) => {
      const c = pool.filter((u) => u.branch === b);
      if (c.length) out.push(c[(Math.random() * c.length) | 0]);
    });
    const rest = pool.filter((u) => !out.includes(u));
    while (out.length < 3 && rest.length) out.push(rest.splice((Math.random() * rest.length) | 0, 1)[0]);
    return out;
  }

  /* ---------- Canvas icons ---------- */
  function drawIcon(canvas, u, locked) {
    const c = canvas.getContext('2d'), w = canvas.width, col = BRANCHES[u.branch].color;
    c.clearRect(0, 0, w, w);
    c.save(); c.scale(w / 64, w / 64);
    const g = c.createRadialGradient(24, 20, 4, 32, 32, 34);
    g.addColorStop(0, locked ? '#5d7f86' : col); g.addColorStop(1, locked ? '#2c4650' : '#0e3a52');
    c.fillStyle = g; c.beginPath(); c.arc(32, 32, 30, 0, Math.PI * 2); c.fill();
    c.strokeStyle = 'rgba(255,255,255,0.45)'; c.lineWidth = 2; c.stroke();
    c.strokeStyle = '#fffdf4'; c.fillStyle = '#fffdf4'; c.lineWidth = 4; c.lineCap = 'round'; c.lineJoin = 'round';
    const arrow = (x, y, a) => { c.beginPath(); c.moveTo(x + Math.cos(a + 2.6) * 9, y + Math.sin(a + 2.6) * 9); c.lineTo(x, y); c.lineTo(x + Math.cos(a - 2.6) * 9, y + Math.sin(a - 2.6) * 9); c.stroke(); };
    switch (u.icon) {
      case 'fins': for (let i = 0; i < 3; i++) { c.beginPath(); c.moveTo(17 + i * 10, 20); c.lineTo(31 + i * 10, 32); c.lineTo(17 + i * 10, 44); c.stroke(); } break;
      case 'turn': c.beginPath(); c.arc(32, 34, 15, Math.PI * 0.95, Math.PI * 2.05); c.stroke(); arrow(47, 34, Math.PI * 0.55); break;
      case 'chase': c.beginPath(); c.moveTo(12, 32); c.lineTo(36, 32); c.stroke(); arrow(36, 32, 0); c.beginPath(); c.arc(48, 32, 5, 0, Math.PI * 2); c.fill(); break;
      case 'ride': c.beginPath(); c.moveTo(10, 40); c.bezierCurveTo(20, 20, 28, 52, 38, 32); c.stroke(); c.beginPath(); c.moveTo(20, 24); c.bezierCurveTo(28, 14, 36, 30, 46, 20); c.stroke(); arrow(52, 30, -0.4); break;
      case 'scales': c.beginPath(); c.moveTo(32, 10); c.lineTo(50, 17); c.quadraticCurveTo(50, 42, 32, 54); c.quadraticCurveTo(14, 42, 14, 17); c.closePath(); c.stroke(); c.lineWidth = 2.5; for (let r = 0; r < 2; r++) for (let k = 0; k < 2 + r; k++) { c.beginPath(); c.arc(32 + (k - (1 + r) / 2) * 11, 26 + r * 11, 5.5, 0, Math.PI); c.stroke(); } break;
      case 'shadow': c.beginPath(); c.arc(32, 32, 17, 0.6, Math.PI * 2 - 0.6); c.arc(40, 29, 14, Math.PI * 2 - 0.9, 0.9, true); c.stroke(); break;
      case 'slick': c.beginPath(); c.moveTo(32, 10); c.bezierCurveTo(44, 26, 48, 34, 48, 40); c.arc(32, 40, 16, 0, Math.PI, false); c.bezierCurveTo(16, 34, 20, 26, 32, 10); c.stroke(); c.lineWidth = 2.5; c.beginPath(); c.arc(32, 40, 9, 2.2, 3.4); c.stroke(); break;
      case 'heart': c.beginPath(); c.moveTo(32, 50); c.bezierCurveTo(8, 34, 14, 14, 26, 18); c.bezierCurveTo(30, 20, 32, 24, 32, 24); c.bezierCurveTo(32, 24, 34, 20, 38, 18); c.bezierCurveTo(50, 14, 56, 34, 32, 50); c.closePath(); c.stroke(); c.lineWidth = 2.5; c.beginPath(); c.arc(24, 24, 4, 3.5, 4.8); c.stroke(); break;
      case 'lungs': [[24, 38, 10], [42, 28, 7], [38, 46, 5], [28, 18, 4]].forEach((b) => { c.beginPath(); c.arc(b[0], b[1], b[2], 0, Math.PI * 2); c.stroke(); }); break;
      case 'efficient': c.beginPath(); c.moveTo(36, 8); c.lineTo(18, 36); c.lineTo(30, 36); c.lineTo(26, 56); c.lineTo(46, 26); c.lineTo(33, 26); c.closePath(); c.stroke(); break;
      case 'recover': c.beginPath(); c.arc(32, 32, 17, -0.4, Math.PI * 1.45); c.stroke(); arrow(32 + Math.cos(-0.4) * 17, 32 + Math.sin(-0.4) * 17, 1.0); c.lineWidth = 3; c.beginPath(); c.moveTo(32, 25); c.lineTo(32, 39); c.moveTo(25, 32); c.lineTo(39, 32); c.stroke(); break;
      case 'torpedo': c.beginPath(); c.moveTo(40, 12); c.lineTo(24, 36); c.lineTo(34, 36); c.lineTo(30, 54); c.lineTo(48, 28); c.lineTo(38, 28); c.closePath(); c.stroke(); c.lineWidth = 2.5; for (let i = 0; i < 3; i++) { c.beginPath(); c.moveTo(8, 24 + i * 9); c.lineTo(18, 24 + i * 9); c.stroke(); } break;
    }
    c.restore();
  }

  return { BRANCHES, UPGRADES, BY_ID, baseStats, computeStats, offer, drawIcon, isUnlocked, unlockText };
})();
