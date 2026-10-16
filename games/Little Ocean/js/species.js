/* Little Ocean - centralised species definitions.
   Add a fish by adding one sp({...}) call; AI, art, journal and spawning pick it up automatically.
   c = [body, belly, fin, accent] */
window.LO = window.LO || {};
(function () {
  const list = [];

  function sp(o) {
    o.color = { body: o.c[0], belly: o.c[1], fin: o.c[2], accent: o.c[3] };
    o.shape = Object.assign({ len: 1, hgt: 0.36, peak: 0.55, p: 2.1, base: 0.1 }, o.shape || {});
    const d = {
      tail: 'fork', tailLen: 1, dorsal: 'soft', dorsalH: 1, pattern: 'none', patN: 3, eye: 1, pect: 1,
      behavior: 'wander', rarity: 'common', weight: 1, school: null, hunter: false, detect: 0, chase: 1.3,
      glow: null, legend: false, max: 99, wave: 1, eatRatio: 0, biteRatio: 0, alert: 0.6, teeth: false
    };
    for (const k in d) if (o[k] === undefined) o[k] = d[k];
    // predators are only slightly harder to eat than they are to fear: the player needs to be just a bit bigger
    if (o.hunter && !o.eatRatio) o.eatRatio = 1.08;
    if (o.growth === undefined) o.growth = Math.round(Math.pow(o.size, 1.3) * LO.CFG.eat.reward * 100) / 100;
    list.push(o);
    return o;
  }

  /* ================= SHALLOW REEF ================= */
  sp({ id: 'sunny_minnow', name: 'Sunny Minnow', zone: 'reef', size: 4, speed: 125, behavior: 'school', school: [8, 13], weight: 5,
    c: ['#ffd36b', '#fff1c2', '#ffb347', '#f08a3c'], shape: { hgt: 0.3 }, dorsal: 'none', pattern: 'lateral', eye: 1.3,
    desc: 'Tiny golden fish that dart about in cheerful clouds. Everybody\'s first meal.' });
  sp({ id: 'pebble_goby', name: 'Pebble Goby', zone: 'reef', size: 5, speed: 70, weight: 3,
    c: ['#c9a77c', '#eadbc0', '#a88457', '#7a5a3a'], shape: { len: 1.05, hgt: 0.26, peak: 0.45 }, tail: 'round', dorsal: 'long', pattern: 'speckles', eye: 1.4,
    desc: 'A sleepy, sand-coloured fish that mostly pretends to be a pebble.' });
  sp({ id: 'rosy_damsel', name: 'Rosy Damsel', zone: 'reef', size: 7, speed: 105, weight: 3,
    c: ['#ff8fab', '#ffd6e0', '#ff6b94', '#ffffff'], shape: { hgt: 0.46, peak: 0.5 }, dorsal: 'sail', pattern: 'band', patN: 1, eye: 1.2,
    desc: 'A blushing little fish with one bright stripe, always busy and a bit bossy.' });
  sp({ id: 'dart_blenny', name: 'Dart Blenny', zone: 'reef', size: 6, speed: 150, behavior: 'nervous', weight: 2,
    c: ['#4ecdc4', '#c8f5f0', '#2ba39c', '#e8fff9'], shape: { len: 1.15, hgt: 0.2 }, dorsal: 'long', pattern: 'lateral', eye: 1.3,
    desc: 'Jumpy and very quick. It flits away at the faintest shadow.' });
  sp({ id: 'marmalade_anemonefish', name: 'Marmalade Anemonefish', zone: 'reef', size: 9, speed: 100, weight: 2,
    c: ['#ff8c42', '#ffb27a', '#ff7a2a', '#fffaf0'], shape: { hgt: 0.42 }, tail: 'round', pattern: 'band', patN: 2, eye: 1.2,
    desc: 'Orange as breakfast jam, with two white sashes. Loves a swaying anemone.' });
  sp({ id: 'puff_pudding', name: 'Puff Pudding', zone: 'reef', size: 11, speed: 55, weight: 1.6, eatRatio: 1.45,
    c: ['#cdb4f6', '#f0e6ff', '#a98de0', '#7c5cc4'], shape: { len: 0.78, hgt: 0.7, peak: 0.5, p: 2 }, tail: 'fan', tailLen: 0.6, dorsal: 'none', pattern: 'spots', eye: 1.5, pect: 1.3,
    desc: 'Round, slow and wobbly. A little tricky to swallow, so you must be properly bigger.' });
  sp({ id: 'coral_tang', name: 'Coral Tang', zone: 'reef', size: 14, speed: 115, weight: 1.4,
    c: ['#4aa3df', '#a5d8f5', '#ffd23f', '#1b5e8c'], shape: { len: 0.85, hgt: 0.62 }, dorsal: 'sail', pattern: 'lateral',
    desc: 'A disc of electric blue with a flash of yellow. Graceful and unbothered.' });
  sp({ id: 'mossback_grouper', name: 'Mossback Grouper', zone: 'reef', size: 24, speed: 95, hunter: true, detect: 360, chase: 1.75, max: 3, weight: 0.5, teeth: true,
    c: ['#7a9a5b', '#cbd6a4', '#5d7a43', '#3e5530'], shape: { len: 1.1, hgt: 0.44, peak: 0.6 }, tail: 'round', dorsal: 'spike', pattern: 'blotch', eye: 0.9,
    desc: 'A broad, mossy ambusher lurking by the reef. Its big mouth can swallow small fish whole.' });

  /* ================= KELP FOREST ================= */
  sp({ id: 'silver_sprat', name: 'Silver Sprat', zone: 'kelp', size: 4, speed: 125, behavior: 'school', school: [10, 16], weight: 5,
    c: ['#cfe3ee', '#f4fbff', '#a5c4d4', '#6f8fa3'], shape: { hgt: 0.27 }, dorsal: 'none', pattern: 'lateral', eye: 1.3,
    desc: 'Shimmering schools that flash like falling coins between the fronds.' });
  sp({ id: 'kelp_perch', name: 'Kelp Perch', zone: 'kelp', size: 12, speed: 100, weight: 2.5,
    c: ['#9bb85a', '#e1ecb0', '#7a9440', '#4f6a2a'], shape: { hgt: 0.4 }, dorsal: 'spike', pattern: 'stripes', patN: 4,
    desc: 'Striped olive fish that hover among the stalks, chewing on whatever drifts by.' });
  sp({ id: 'gilded_carp', name: 'Gilded Carp', zone: 'kelp', size: 17, speed: 70, weight: 1.4,
    c: ['#f2c14e', '#fff0c8', '#e89f2a', '#c9822a'], shape: { len: 1.05, hgt: 0.42 }, tail: 'fan', dorsal: 'long', pattern: 'scales',
    desc: 'A slow, golden giant of the forest. Each scale catches the light like a coin.' });
  sp({ id: 'leafling', name: 'Leafling', zone: 'kelp', size: 8, speed: 45, weight: 0.3, rarity: 'rare',
    c: ['#8fd18a', '#cdeec0', '#5fb36a', '#3f8d52'], shape: { len: 1.1, hgt: 0.22 }, tail: 'fan', dorsal: 'long', pattern: 'none', leaf: true, eye: 1.2,
    desc: 'A shy, leaf-draped drifter so well camouflaged you will mostly find it by accident.' });
  sp({ id: 'amber_darter', name: 'Amber Darter', zone: 'kelp', size: 7, speed: 150, behavior: 'nervous', weight: 2,
    c: ['#f4a259', '#fde2b8', '#bc6c25', '#5f370e'], shape: { hgt: 0.28 }, pattern: 'stripes', patN: 2, eye: 1.2,
    desc: 'Honey-coloured and twitchy. It bolts in zigzags when startled.' });
  sp({ id: 'kelp_pike', name: 'Kelp Pike', zone: 'kelp', size: 29, speed: 110, hunter: true, detect: 420, chase: 1.6, max: 3, weight: 0.5, teeth: true,
    c: ['#6f8f7a', '#d8e6d3', '#4c6b58', '#2e463a'], shape: { len: 1.4, hgt: 0.2, peak: 0.62, p: 2.4 }, dorsal: 'spike', pattern: 'stripes', patN: 6, eye: 0.9,
    desc: 'A long, patient hunter that waits motionless among the stalks, then strikes.' });

  /* ================= OPEN BLUE ================= */
  sp({ id: 'azure_anchovy', name: 'Azure Anchovy', zone: 'blue', size: 5, speed: 140, behavior: 'school', school: [14, 22], weight: 6,
    c: ['#5aa9e6', '#d6ecff', '#3f88c5', '#1d4e89'], shape: { hgt: 0.24 }, dorsal: 'none', pattern: 'lateral', eye: 1.2,
    desc: 'Huge ribbons of blue that turn all at once, like one great creature.' });
  sp({ id: 'pearl_flyer', name: 'Pearl Flyer', zone: 'blue', size: 11, speed: 150, behavior: 'nervous', weight: 1.6,
    c: ['#9ad1d4', '#f0fbfb', '#d9f2ff', '#4a8fa0'], shape: { hgt: 0.26 }, pect: 2.5,
    desc: 'Wing-like fins let it glide and skip away from trouble in long, elegant arcs.' });
  sp({ id: 'bluefin_runner', name: 'Bluefin Runner', zone: 'blue', size: 21, speed: 185, weight: 1.2,
    c: ['#2c6fbb', '#cfe8ff', '#ffd166', '#103a6b'], shape: { len: 1.25, hgt: 0.28 }, tail: 'lunate', dorsal: 'sail', pattern: 'lateral',
    desc: 'A streak of ocean-blue speed. Peaceful, but almost impossible to catch without a burst.' });
  sp({ id: 'moonfish', name: 'Moonfish', zone: 'blue', size: 33, speed: 75, weight: 0.8,
    c: ['#dfe8f2', '#f7fbff', '#b8c9dc', '#8aa4c0'], shape: { len: 0.8, hgt: 0.68 }, tail: 'fan', tailLen: 0.6, dorsal: 'sail', dorsalH: 1.1, eye: 1.3,
    desc: 'A great, silver disc drifting like a second moon. Gentle and rich in nourishment.' });
  sp({ id: 'needle_barracuda', name: 'Needle Barracuda', zone: 'blue', size: 42, speed: 125, hunter: true, detect: 520, chase: 1.6, max: 3, weight: 0.5, teeth: true,
    c: ['#8aa1b4', '#e6eef4', '#5f7a91', '#34495e'], shape: { len: 1.55, hgt: 0.15, peak: 0.6, p: 2.4 }, dorsal: 'spike', pattern: 'stripes', patN: 7, eye: 0.85,
    desc: 'A silver spear with a long, toothy grin. It is very fast, and it has seen you.' });
  sp({ id: 'greyfin_shark', name: 'Greyfin Shark', zone: 'blue', size: 66, speed: 118, hunter: true, detect: 620, chase: 1.55, max: 2, weight: 0.25, rarity: 'uncommon', teeth: true,
    c: ['#7f8fa3', '#e8eef5', '#5f6f84', '#3b4a5e'], shape: { len: 1.45, hgt: 0.27 }, tail: 'lunate', tailLen: 1.2, dorsal: 'sail', dorsalH: 1.1, eye: 0.7,
    desc: 'The big grey monarch of open water. Stay out of its sight, or run.' });

  /* ================= DEEP SEA ================= */
  sp({ id: 'glimmer_smelt', name: 'Glimmer Smelt', zone: 'deep', size: 5, speed: 105, behavior: 'school', school: [8, 14], weight: 5, glow: '#7af7ff',
    c: ['#2a3f8f', '#5c7be0', '#3a5cc0', '#7af7ff'], shape: { hgt: 0.25 }, dorsal: 'none', pattern: 'photo', eye: 1.4,
    desc: 'Little fish with rows of lanterns along their bellies, swimming in glittering constellations.' });
  sp({ id: 'abyssal_hatchet', name: 'Abyssal Hatchetfish', zone: 'deep', size: 10, speed: 90, weight: 2.5, glow: '#c8f0ff',
    c: ['#8fa8d8', '#e8efff', '#6a82bc', '#c8f0ff'], shape: { len: 0.75, hgt: 0.66, peak: 0.45, p: 2.5 }, pattern: 'photo', eye: 1.7,
    desc: 'Thin as a blade, with huge eyes for gathering every scrap of light.' });
  sp({ id: 'pale_ghostfish', name: 'Pale Ghostfish', zone: 'deep', size: 16, speed: 60, weight: 1.5, glow: '#d8c8ff',
    c: ['#e8dff5', '#ffffff', '#c9b8e8', '#a690d8'], shape: { len: 1.15, hgt: 0.3 }, tail: 'long', dorsal: 'long', alpha: 0.78, eye: 1.2,
    desc: 'Translucent and silent. You can almost see the dark through it.' });
  sp({ id: 'cobalt_lanternfin', name: 'Cobalt Lanternfin', zone: 'deep', size: 12, speed: 100, weight: 0.8, rarity: 'rare', glow: '#60f0c8',
    c: ['#1c4e80', '#2f78b8', '#60f0c8', '#60f0c8'], shape: { hgt: 0.32 }, dorsal: 'sail', pattern: 'lateral', eye: 1.3,
    desc: 'Deep-blue velvet with fins that burn minty green. A rare, restless glow.' });
  sp({ id: 'lantern_angler', name: 'Lantern Angler', zone: 'deep', size: 36, speed: 52, behavior: 'ambush', hunter: true, detect: 300, chase: 3.2, max: 3, weight: 0.6, teeth: true, lure: true, alert: 0.5,
    c: ['#3b2f5c', '#5a4a85', '#2a2040', '#ffe27a'], shape: { len: 0.95, hgt: 0.62, peak: 0.5 }, dorsal: 'none', pattern: 'speckles', eye: 1.1,
    desc: 'It dangles a warm little light, then opens wide. Do not follow the lantern.' });
  sp({ id: 'gulper', name: 'Gulper', zone: 'deep', size: 58, speed: 90, hunter: true, detect: 520, chase: 1.7, max: 2, weight: 0.35, teeth: true, glow: '#b9a7ff',
    c: ['#2c2748', '#463d73', '#6d5fb0', '#b9a7ff'], shape: { len: 1.8, hgt: 0.2, peak: 0.7, p: 2.2 }, tail: 'long', dorsal: 'long', pattern: 'photo', eye: 0.7, wave: 1.4,
    desc: 'All mouth and shadow, with a tail that ends in a purple spark.' });

  /* ================= HIDDEN GROTTOS ================= */
  sp({ id: 'ember_tetra', name: 'Ember Tetra', zone: 'grotto', size: 5, speed: 115, behavior: 'school', school: [8, 12], weight: 5, glow: '#ff9a56',
    c: ['#ff7b3a', '#ffc08a', '#e8552a', '#ffe3a0'], shape: { hgt: 0.27 }, dorsal: 'none', pattern: 'lateral', eye: 1.3,
    desc: 'Glowing orange sparks that swirl through the cave like drifting embers.' });
  sp({ id: 'crystal_cavefish', name: 'Crystal Cavefish', zone: 'grotto', size: 10, speed: 55, weight: 3, blind: true,
    c: ['#f7d9e6', '#ffffff', '#f0b8d0', '#d68fb0'], shape: { len: 1.1, hgt: 0.3 }, alpha: 0.88, eye: 0.35,
    desc: 'Pale and nearly blind, it finds its way by tiny ripples in the water.' });
  sp({ id: 'glowcap_goby', name: 'Glowcap Goby', zone: 'grotto', size: 7, speed: 60, weight: 2.5, glow: '#8cffc1',
    c: ['#3f7f6b', '#7fbf9f', '#8cffc1', '#8cffc1'], shape: { hgt: 0.3 }, tail: 'round', pattern: 'spots', eye: 1.4,
    desc: 'Wears a cap of luminous moss. It drifts from mushroom to mushroom.' });
  sp({ id: 'veil_betta', name: 'Veil Betta', zone: 'grotto', size: 14, speed: 85, weight: 0.5, rarity: 'rare',
    c: ['#7b2ff7', '#c49bff', '#ff4fa3', '#ffd6f0'], shape: { len: 0.85, hgt: 0.36 }, tail: 'long', dorsal: 'sail', dorsalH: 1.5, pect: 1.6, pattern: 'scales',
    desc: 'Fins like silk veils in violet and rose. It dances alone in quiet pools.' });
  sp({ id: 'grotto_moray', name: 'Grotto Moray', zone: 'grotto', size: 40, speed: 100, hunter: true, detect: 440, chase: 1.8, max: 3, weight: 0.5, teeth: true, wave: 1.8,
    c: ['#5a7d6b', '#b8d4a8', '#8fb894', '#2e4a3c'], shape: { len: 2.2, hgt: 0.13, peak: 0.8, p: 2.2 }, tail: 'point', dorsal: 'long', pattern: 'blotch', eye: 0.8,
    desc: 'A long green ribbon that slides out of crevices faster than you would believe.' });

  /* ================= EXTRA PREY (fills the size gaps) ================= */
  sp({ id: 'banded_wrasse', name: 'Banded Wrasse', zone: 'reef', size: 18, speed: 110, weight: 1.2,
    c: ['#3fb6a8', '#d6f5ee', '#ffb347', '#ff6b6b'], shape: { len: 1.15, hgt: 0.3 }, dorsal: 'long', pattern: 'stripes', patN: 3,
    desc: 'A lively, banded fish that picks at coral. A fine meal for a growing swimmer.' });
  sp({ id: 'mossy_bream', name: 'Mossy Bream', zone: 'kelp', size: 22, speed: 80, weight: 1,
    c: ['#8aa66a', '#e3edc4', '#6a8650', '#44602f'], shape: { len: 1, hgt: 0.5 }, tail: 'round', dorsal: 'spike', pattern: 'scales',
    desc: 'A broad, mossy fish that grazes the kelp stalks.' });
  sp({ id: 'sky_mackerel', name: 'Sky Mackerel', zone: 'blue', size: 8, speed: 145, behavior: 'nervous', weight: 2,
    c: ['#4f9bd9', '#e3f2ff', '#2f6fb0', '#12396b'], shape: { len: 1.2, hgt: 0.22 }, tail: 'lunate', dorsal: 'spike', pattern: 'stripes', patN: 5,
    desc: 'A quick, striped little speedster of the open blue.' });
  sp({ id: 'silver_pompano', name: 'Silver Pompano', zone: 'blue', size: 28, speed: 120, weight: 0.9,
    c: ['#cfd9e6', '#ffffff', '#9fb2c8', '#6f86a3'], shape: { len: 0.95, hgt: 0.5 }, tail: 'lunate', dorsal: 'sail', dorsalH: 0.8,
    desc: 'A deep-bodied silver fish that cruises the sunlit channels.' });
  sp({ id: 'velvet_whalefish', name: 'Velvet Whalefish', zone: 'deep', size: 26, speed: 65, weight: 0.9, glow: '#9a8cff',
    c: ['#3a2f66', '#54488a', '#7d6fd0', '#b8abff'], shape: { len: 1.05, hgt: 0.48 }, tail: 'fan', dorsal: 'none', pattern: 'photo', eye: 0.8,
    desc: 'A soft, dark drifter with a faint violet shimmer.' });
  sp({ id: 'cave_loach', name: 'Pink Cave Loach', zone: 'grotto', size: 20, speed: 70, weight: 1, alpha: 0.9,
    c: ['#f2b5c8', '#fff0f5', '#e58fae', '#b5557a'], shape: { len: 1.5, hgt: 0.2 }, tail: 'round', dorsal: 'long', pattern: 'speckles', eye: 0.5,
    desc: 'A long, pale-pink fish that noses along the cave floors.' });

  /* ================= LEGENDARY ================= */
  sp({ id: 'crown_seahorse', name: 'Crown Seahorse', zone: 'reef', legend: true, behavior: 'legend', rarity: 'legendary', size: 9, speed: 30, weight: 0, special: 'seahorse', glow: '#ffe29a', halo: '#ffe29a',
    c: ['#ffcf5a', '#fff2c0', '#ffe9a8', '#ff9e5a'], discoverR: 190, spawn: { x: 840, y: 1560, leash: 80, place: 'pearl_crevice' },
    reward: { evo: 'r4', text: 'Unlocked the Lucky Escape evolution' },
    desc: 'A tiny golden seahorse that wears a crown of light. It guards the Pearl Crevice, a gap only small fish can squeeze through.' });
  sp({ id: 'aurora_ray', name: 'Aurora Ray', zone: 'blue', legend: true, behavior: 'legend', rarity: 'legendary', size: 48, speed: 40, weight: 0, special: 'ray', glow: '#a8fff0', halo: '#a8fff0',
    c: ['#7de0d0', '#e8fff9', '#c79bff', '#ff9ed8'], shape: { len: 1.3, hgt: 0.2 }, discoverR: 360, spawn: { x: 5250, y: 520, leash: 140, place: 'moonlit_clearing' },
    reward: { evo: 's4', cosmetic: 'aurora', text: 'Unlocked Current Rider and the Aurora Shimmer cosmetic' },
    desc: 'A great ray whose wings ripple with northern-light colours. It glides in a hidden clearing ringed by stone pillars.' });
  sp({ id: 'lumen_leviathan', name: 'Lumen Leviathan', zone: 'deep', legend: true, behavior: 'legend', rarity: 'legendary', size: 80, speed: 35, weight: 0, glow: '#6ff3ff', halo: '#6ff3ff',
    c: ['#16396b', '#2e6fa8', '#6ff3ff', '#b6ffff'], shape: { len: 1.7, hgt: 0.3 }, tail: 'lunate', tailLen: 1.1, dorsal: 'none', pattern: 'photo', pect: 1.6, eye: 0.6, wave: 0.7,
    discoverR: 420, spawn: { x: 4730, y: 2710, leash: 150, place: 'abyssal_vault' },
    reward: { cosmetic: 'lumen', text: 'Unlocked the Lumen Glow cosmetic' },
    desc: 'An ancient, whale-sized fish that glows like a slow underwater sunrise. It sleeps in the Abyssal Vault.' });
  sp({ id: 'moonveil_koi', name: 'Moonveil Koi', zone: 'grotto', legend: true, behavior: 'legend', rarity: 'legendary', size: 26, speed: 45, weight: 0, glow: '#bfe0ff', halo: '#bfe0ff',
    c: ['#f4f7ff', '#ffffff', '#bcd8ff', '#ffcf8a'], shape: { len: 1.3, hgt: 0.28 }, tail: 'long', dorsal: 'sail', dorsalH: 1.4, pattern: 'koi', pect: 1.5,
    discoverR: 300, spawn: { x: 810, y: 2630, leash: 130, place: 'moon_pool' },
    reward: { cosmetic: 'moonveil', text: 'Unlocked the Moonveil Pearl cosmetic' },
    desc: 'A pale koi trailing veils of moonlight. It circles the still Moon Pool, where the water glows silver.' });
  sp({ id: 'pearl_oracle', name: 'Pearl Oracle', zone: 'grotto', legend: true, behavior: 'legend', rarity: 'legendary', size: 18, speed: 38, weight: 0, glow: '#ffe9a8', halo: '#ffe9a8',
    c: ['#e6d5ff', '#ffffff', '#b9a0f0', '#ffe9a8'], shape: { len: 0.9, hgt: 0.5 }, tail: 'long', dorsal: 'long', pearl: true, pect: 1.4,
    discoverR: 220, spawn: { x: 1790, y: 3050, leash: 70, place: 'whisper_nook' },
    reward: { evo: 'b4', text: 'Unlocked the Torpedo Form evolution' },
    desc: 'A serene fish with a glowing pearl on its brow. It rests in the Whisper Nook, far below the world.' });

  LO.SPECIES = list;
  LO.SPECIES_BY_ID = {};
  list.forEach((s) => { LO.SPECIES_BY_ID[s.id] = s; });
})();
