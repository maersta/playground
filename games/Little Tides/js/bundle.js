(function(){'use strict';
const __mods={},__cache={};
function __req(n){ if(!__cache[n]){ const ex={}; __cache[n]=ex; __mods[n](ex); } return __cache[n]; }
__mods['audio.js']=function(__ex){
// Procedural audio with the Web Audio API: ambience, generative music and sound effects.
// Everything is created lazily after the first user gesture and the game works fine without it.
const SCALES = {
  major: [0, 2, 4, 7, 9], minor: [0, 3, 5, 7, 10], lydian: [0, 2, 4, 6, 7, 9, 11], dorian: [0, 2, 3, 5, 7, 9, 10], whole: [0, 2, 4, 6, 8, 10],
};
const SCENES = {
  harbor: { root: 261.6, scale: 'major', wave: 0.35, wind: 0.2, birds: 0.6, noteEvery: [1.8, 3.6], pad: 0.8, timbre: 'pluck', drone: 0 },
  pebble: { root: 196, scale: 'major', wave: 0.55, wind: 0.22, birds: 0.5, noteEvery: [1.6, 3.4], pad: 1, timbre: 'pluck', drone: 0 },
  sunlit: { root: 220, scale: 'lydian', wave: 0.5, wind: 0.18, birds: 0.7, noteEvery: [1.0, 2.6], pad: 1, timbre: 'marimba', drone: 0 },
  kelp: { root: 174.6, scale: 'dorian', wave: 0.35, wind: 0.12, birds: 0.1, noteEvery: [2.4, 5], pad: 1.2, timbre: 'soft', drone: 0.4 },
  coral: { root: 246.9, scale: 'major', wave: 0.4, wind: 0.14, birds: 0.2, noteEvery: [1.2, 3], pad: 1, timbre: 'marimba', drone: 0, bubbles: 0.7 },
  twilight: { root: 130.8, scale: 'minor', wave: 0.15, wind: 0.08, birds: 0, noteEvery: [3, 6.5], pad: 1.1, timbre: 'bell', drone: 0.8, bubbles: 0.3 },
  frost: { root: 293.7, scale: 'whole', wave: 0.2, wind: 0.75, birds: 0, noteEvery: [2, 4.5], pad: 1, timbre: 'bell', drone: 0.3 },
  trench: { root: 110, scale: 'minor', wave: 0.1, wind: 0.05, birds: 0, noteEvery: [3.5, 7], pad: 1.3, timbre: 'bell', drone: 1, bubbles: 0.2 },
};
const rnd = (a, b) => a + Math.random() * (b - a);
const vol = v => Math.pow(Math.max(0, Math.min(1, v)), 1.7);

class AudioEngine {
  constructor(game) {
    this.g = game;
    this.ctx = null;
    this.ready = false;
    this.scene = 'pebble';
    this.sceneId = 'pebble';
    this.nextNote = 0;
    this.nextPad = 0;
    this.nextBird = 0;
    this.nextBubble = 0;
    this.timer = null;
    this.failed = false;
  }

  /** Call from a user-gesture handler. Safe to call repeatedly. */
  unlock() {
    if (this.failed) return;
    try {
      if (!this.ctx) this.build();
      if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
    } catch (e) { this.failed = true; console.warn('Audio unavailable', e); }
  }

  build() {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) { this.failed = true; return; }
    const ctx = this.ctx = new AC();
    this.master = ctx.createGain(); this.master.gain.value = 0.9;
    const comp = ctx.createDynamicsCompressor();
    this.master.connect(comp); comp.connect(ctx.destination);
    this.musicBus = ctx.createGain(); this.ambBus = ctx.createGain(); this.sfxBus = ctx.createGain();
    for (const b of [this.musicBus, this.ambBus, this.sfxBus]) b.connect(this.master);
    // shimmer echo for special sounds
    this.echo = ctx.createDelay(1); this.echo.delayTime.value = 0.24;
    const fb = ctx.createGain(); fb.gain.value = 0.38;
    const ef = ctx.createBiquadFilter(); ef.type = 'lowpass'; ef.frequency.value = 3500;
    this.echo.connect(ef); ef.connect(fb); fb.connect(this.echo); ef.connect(this.sfxBus);
    // noise buffer
    const len = ctx.sampleRate * 3;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    let b0 = 0;
    for (let i = 0; i < len; i++) { const w = Math.random() * 2 - 1; b0 = 0.97 * b0 + 0.03 * w; d[i] = w * 0.5 + b0 * 3; }
    this.noiseBuf = buf;
    this.buildAmbience();
    this.applySettings();
    this.setScene(this.g.state.mode === 'harbor' ? 'harbor' : this.g.state.zone);
    this.timer = setInterval(() => this.tick(), 300);
    this.ready = true;
    document.addEventListener('visibilitychange', () => {
      if (!this.ctx) return;
      if (document.hidden) this.ctx.suspend().catch(() => {}); else this.ctx.resume().catch(() => {});
    });
  }

  noiseSrc() {
    const s = this.ctx.createBufferSource();
    s.buffer = this.noiseBuf; s.loop = true;
    s.loopStart = Math.random() * 1.5;
    s.start(0, Math.random() * 2);
    return s;
  }

  buildAmbience() {
    const ctx = this.ctx;
    // Waves: low-passed noise with a slow swell
    const wn = this.noiseSrc(), wf = ctx.createBiquadFilter(); wf.type = 'lowpass'; wf.frequency.value = 520;
    this.waveGain = ctx.createGain(); this.waveGain.gain.value = 0;
    const swell = ctx.createGain(); swell.gain.value = 0.5;
    const lfo = ctx.createOscillator(); lfo.frequency.value = 0.11;
    const lfoG = ctx.createGain(); lfoG.gain.value = 0.45;
    lfo.connect(lfoG); lfoG.connect(swell.gain); lfo.start();
    wn.connect(wf); wf.connect(swell); swell.connect(this.waveGain); this.waveGain.connect(this.ambBus);
    // foam hiss
    const fn = this.noiseSrc(), ff = ctx.createBiquadFilter(); ff.type = 'bandpass'; ff.frequency.value = 2400; ff.Q.value = 0.6;
    const fg = ctx.createGain(); fg.gain.value = 0.12;
    const lfo2 = ctx.createOscillator(); lfo2.frequency.value = 0.13;
    const lfo2g = ctx.createGain(); lfo2g.gain.value = 0.1;
    lfo2.connect(lfo2g); lfo2g.connect(fg.gain); lfo2.start();
    fn.connect(ff); ff.connect(fg); fg.connect(this.waveGain);
    // Wind
    const wind = this.noiseSrc(), wif = ctx.createBiquadFilter(); wif.type = 'bandpass'; wif.frequency.value = 420; wif.Q.value = 0.8;
    this.windGain = ctx.createGain(); this.windGain.gain.value = 0;
    const lfo3 = ctx.createOscillator(); lfo3.frequency.value = 0.07;
    const lfo3g = ctx.createGain(); lfo3g.gain.value = 180;
    lfo3.connect(lfo3g); lfo3g.connect(wif.frequency); lfo3.start();
    wind.connect(wif); wif.connect(this.windGain); this.windGain.connect(this.ambBus);
    // Drone for deep scenes
    this.droneOsc = ctx.createOscillator(); this.droneOsc.type = 'sine'; this.droneOsc.frequency.value = 55;
    const d2 = ctx.createOscillator(); d2.type = 'sine'; d2.frequency.value = 55.4;
    this.droneGain = ctx.createGain(); this.droneGain.gain.value = 0;
    this.droneOsc.connect(this.droneGain); d2.connect(this.droneGain); this.droneGain.connect(this.ambBus);
    this.droneOsc.start(); d2.start(); this.drone2 = d2;
  }

  applySettings() {
    if (!this.ctx) return;
    const s = this.g.state.settings, t = this.ctx.currentTime;
    const m = s.muteAll ? 0 : 1;
    this.musicBus.gain.setTargetAtTime(vol(s.music) * (s.muteMusic ? 0 : 1) * m * 0.9, t, 0.05);
    this.ambBus.gain.setTargetAtTime(vol(s.ambient) * (s.muteAmbient ? 0 : 1) * m * 1.0, t, 0.05);
    this.sfxBus.gain.setTargetAtTime(vol(s.sfx) * (s.muteSfx ? 0 : 1) * m * 1.0, t, 0.05);
  }

  setScene(id) {
    this.sceneId = id;
    this.scene = SCENES[id] || SCENES.pebble;
    if (!this.ctx) return;
    const t = this.ctx.currentTime, sc = this.scene;
    this.waveGain.gain.setTargetAtTime(sc.wave * 0.32, t, 1.2);
    this.windGain.gain.setTargetAtTime(sc.wind * 0.2, t, 1.2);
    this.droneGain.gain.setTargetAtTime(sc.drone * 0.05, t, 1.5);
    this.droneOsc.frequency.setTargetAtTime(sc.root / 2, t, 1);
    this.drone2.frequency.setTargetAtTime(sc.root / 2 + 0.45, t, 1);
    this.nextNote = this.ctx.currentTime + 1.5;
    this.nextPad = this.ctx.currentTime + 0.5;
  }

  // ---------- generative layer ----------
  tick() {
    if (!this.ctx || this.ctx.state !== 'running') return;
    const now = this.ctx.currentTime, sc = this.scene;
    const scale = SCALES[sc.scale];
    if (now >= this.nextPad) {
      this.nextPad = now + rnd(9, 14);
      const deg = [0, 2, 4][Math.floor(Math.random() * 3)];
      for (const k of [0, 2, 4]) this.padNote(sc.root * Math.pow(2, scale[(deg + k) % scale.length] / 12) * (deg + k >= scale.length ? 2 : 1) / 2, now, 7, 0.028 * sc.pad);
    }
    if (now >= this.nextNote) {
      this.nextNote = now + rnd(sc.noteEvery[0], sc.noteEvery[1]);
      const n = scale[Math.floor(Math.random() * scale.length)];
      const oct = Math.random() < 0.3 ? 2 : 1;
      this.melodyNote(sc.root * oct * Math.pow(2, n / 12), now + 0.05, sc.timbre);
      if (Math.random() < 0.25) this.melodyNote(sc.root * oct * Math.pow(2, scale[Math.floor(Math.random() * scale.length)] / 12), now + 0.45, sc.timbre);
    }
    if (sc.birds > 0 && now >= this.nextBird) {
      this.nextBird = now + rnd(5, 13);
      if (Math.random() < sc.birds) this.bird(now + 0.05);
    }
    if (sc.bubbles && now >= this.nextBubble) {
      this.nextBubble = now + rnd(1.2, 4);
      if (Math.random() < sc.bubbles) this.bubble(now + 0.02);
    }
  }
  padNote(f, t, dur, v) {
    const ctx = this.ctx, o = ctx.createOscillator(), g = ctx.createGain();
    o.type = 'triangle'; o.frequency.value = f;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(v, t + dur * 0.4);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(this.musicBus); o.start(t); o.stop(t + dur + 0.1);
  }
  melodyNote(f, t, timbre) {
    const ctx = this.ctx;
    const mk = (type, freq, v, dur, atk = 0.01) => {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = type; o.frequency.value = freq;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(v, t + atk);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g); g.connect(this.musicBus); g.connect(this.echo);
      o.start(t); o.stop(t + dur + 0.1);
    };
    if (timbre === 'bell') { mk('sine', f * 2, 0.05, 3.5); mk('sine', f * 2 * 2.76, 0.012, 1.6); mk('sine', f * 2 * 5.4, 0.004, 0.8); }
    else if (timbre === 'marimba') { mk('sine', f, 0.07, 0.9, 0.004); mk('sine', f * 4, 0.012, 0.25, 0.003); }
    else if (timbre === 'soft') { mk('triangle', f, 0.05, 2.6, 0.2); }
    else { mk('triangle', f, 0.06, 1.6, 0.006); mk('sine', f * 2, 0.02, 0.9, 0.006); }
  }
  bird(t) {
    const ctx = this.ctx, n = 2 + Math.floor(Math.random() * 3), base = rnd(2200, 3400);
    for (let i = 0; i < n; i++) {
      const o = ctx.createOscillator(), g = ctx.createGain(), s = t + i * 0.13;
      o.type = 'sine';
      o.frequency.setValueAtTime(base, s);
      o.frequency.exponentialRampToValueAtTime(base * rnd(1.2, 1.5), s + 0.07);
      o.frequency.exponentialRampToValueAtTime(base * 0.9, s + 0.11);
      g.gain.setValueAtTime(0.0001, s); g.gain.exponentialRampToValueAtTime(0.03, s + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, s + 0.12);
      o.connect(g); g.connect(this.ambBus); o.start(s); o.stop(s + 0.15);
    }
  }
  bubble(t) {
    const ctx = this.ctx, o = ctx.createOscillator(), g = ctx.createGain(), f = rnd(500, 1100);
    o.type = 'sine'; o.frequency.setValueAtTime(f, t); o.frequency.exponentialRampToValueAtTime(f * 2, t + 0.08);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.025, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.1);
    o.connect(g); g.connect(this.ambBus); o.start(t); o.stop(t + 0.12);
  }

  // ---------- sfx helpers ----------
  tone(f, dur, o = {}) {
    const ctx = this.ctx, t = ctx.currentTime + (o.delay || 0);
    const osc = ctx.createOscillator(), g = ctx.createGain();
    osc.type = o.type || 'sine';
    osc.frequency.setValueAtTime(f, t);
    if (o.slide) osc.frequency.exponentialRampToValueAtTime(Math.max(30, f * o.slide), t + dur);
    const v = o.vol ?? 0.16;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(v, t + (o.attack || 0.006));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g); g.connect(this.sfxBus);
    if (o.wet) { const w = ctx.createGain(); w.gain.value = o.wet; g.connect(w); w.connect(this.echo); }
    osc.start(t); osc.stop(t + dur + 0.05);
  }
  noise(dur, o = {}) {
    const ctx = this.ctx, t = ctx.currentTime + (o.delay || 0);
    const s = ctx.createBufferSource(); s.buffer = this.noiseBuf; s.loopStart = 0;
    const f = ctx.createBiquadFilter(); f.type = o.type || 'lowpass'; f.Q.value = o.q || 0.8;
    f.frequency.setValueAtTime(o.freq || 800, t);
    if (o.to) f.frequency.exponentialRampToValueAtTime(o.to, t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(o.vol ?? 0.2, t + (o.attack || 0.01)); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(this.sfxBus);
    s.start(t, Math.random() * 2); s.stop(t + dur + 0.05);
  }

  sfx(name, arg) {
    if (!this.ctx) { this.unlock(); if (!this.ctx) return; }
    if (this.ctx.state !== 'running') return;
    try { this.play(name, arg); } catch (e) { /* audio is optional */ }
  }

  play(name, arg) {
    const T = this;
    switch (name) {
      case 'ui': T.tone(680, 0.06, { vol: 0.07, slide: 0.9 }); break;
      case 'error': T.tone(190, 0.16, { vol: 0.09, type: 'triangle', slide: 0.8 }); break;
      case 'cast': T.noise(0.4, { type: 'bandpass', freq: 500, to: 2400, vol: 0.12, q: 1.2, attack: 0.1 }); T.tone(340, 0.18, { vol: 0.05, slide: 0.6, type: 'triangle' }); break;
      case 'splash': { const v = arg || 1; T.noise(0.35, { freq: 2200, to: 500, vol: 0.2 * v }); T.tone(200, 0.12, { vol: 0.08 * v, slide: 2 }); break; }
      case 'hook': T.tone(900, 0.06, { vol: 0.04, type: 'triangle' }); T.tone(1200, 0.05, { vol: 0.03, delay: 0.07, type: 'triangle' }); break;
      case 'bite': T.tone(420, 0.1, { vol: 0.11, slide: 1.6 }); T.tone(560, 0.1, { vol: 0.11, slide: 1.5, delay: 0.12 }); T.tone(760, 0.12, { vol: 0.1, slide: 1.3, delay: 0.24 }); break;
      case 'retrieve': { const n = Math.max(4, Math.floor((arg || 2.4) * 5)); for (let i = 0; i < n; i++) T.noise(0.03, { type: 'highpass', freq: 3000, vol: 0.05, delay: i * ((arg || 2.4) / n) }); break; }
      case 'catch': {
        const ri = arg || 0;
        T.noise(0.4, { freq: 1800, to: 400, vol: 0.18 });
        const notes = [523.25, 659.25, 783.99, 1046.5, 1318.5, 1568];
        if (ri === 0) T.tone(520, 0.14, { vol: 0.1, slide: 1.4 });
        else if (ri === 1) { T.tone(587, 0.18, { vol: 0.1 }); T.tone(784, 0.22, { vol: 0.1, delay: 0.1 }); }
        else if (ri === 2) notes.slice(0, 3).forEach((n, i) => T.tone(n, 0.5, { vol: 0.1, delay: 0.08 * i, wet: 0.4 }));
        else if (ri === 3) notes.slice(0, 4).forEach((n, i) => T.tone(n, 0.6, { vol: 0.1, delay: 0.09 * i, wet: 0.5, type: 'triangle' }));
        else if (ri === 4) { notes.forEach((n, i) => T.tone(n, 1.2, { vol: 0.09, delay: 0.1 * i, wet: 0.7 })); T.tone(261.6, 2.2, { vol: 0.07, attack: 0.3, type: 'triangle' }); T.tone(392, 2.2, { vol: 0.06, attack: 0.3, type: 'triangle' }); }
        else {
          [...notes, 2093].forEach((n, i) => T.tone(n, 1.8, { vol: 0.09, delay: 0.09 * i, wet: 0.8 }));
          [261.6, 329.6, 392, 523.25].forEach(n => T.tone(n, 3.2, { vol: 0.06, attack: 0.4, type: 'triangle', wet: 0.5 }));
          T.noise(1.6, { type: 'highpass', freq: 5000, to: 9000, vol: 0.05, attack: 0.5, delay: 0.5 });
        }
        break;
      }
      case 'coin': { const n = arg || 1; for (let i = 0; i < n; i++) { T.tone(1318, 0.12, { vol: 0.08, delay: i * 0.07, type: 'triangle' }); T.tone(1760, 0.2, { vol: 0.07, delay: i * 0.07 + 0.05, type: 'triangle' }); } break; }
      case 'purchase': T.tone(784, 0.12, { vol: 0.1, type: 'triangle' }); T.tone(1046, 0.12, { vol: 0.1, delay: 0.08, type: 'triangle' }); T.tone(1568, 0.3, { vol: 0.1, delay: 0.16, wet: 0.3 }); break;
      case 'unlock': [523, 659, 784, 1046].forEach((n, i) => T.tone(n, 0.5, { vol: 0.09, delay: i * 0.1, wet: 0.5 })); break;
      case 'rare': [880, 1174, 1568].slice(0, 1 + (arg || 2)).forEach((n, i) => T.tone(n, 0.5, { vol: 0.08, delay: i * 0.09, wet: 0.6 })); break;
      case 'discover': T.tone(988, 0.16, { vol: 0.09, wet: 0.5 }); T.tone(1480, 0.5, { vol: 0.09, delay: 0.12, wet: 0.6 }); break;
      case 'record': T.tone(1175, 0.12, { vol: 0.08, type: 'triangle' }); T.tone(1568, 0.12, { vol: 0.08, delay: 0.1, type: 'triangle' }); T.tone(2093, 0.4, { vol: 0.08, delay: 0.2, wet: 0.5 }); break;
    }
  }

  destroy() {
    if (this.timer) clearInterval(this.timer);
    if (this.ctx) this.ctx.close().catch(() => {});
    this.ctx = null;
  }
}

Object.assign(__ex,{AudioEngine});
};
__mods['config.js']=function(__ex){
// Central balance configuration. Tweak numbers here to rebalance the whole game.
const CONFIG = {
  version: 1,
  saveKey: 'little-tides-save',
  autosaveSeconds: 15,
  dayLength: 300, // seconds for a full day/night cycle

  // Rarity: baseline encounter probability (conceptual), sale multiplier, colours.
  rarities: [
    { id: 'common', name: 'Common', prob: 0.60, mult: 1.0, color: '#8b95a1', soft: '#e9ecef' },
    { id: 'uncommon', name: 'Uncommon', prob: 0.25, mult: 1.5, color: '#4f9a5f', soft: '#e1f1e3' },
    { id: 'rare', name: 'Rare', prob: 0.10, mult: 2.5, color: '#3b82c4', soft: '#dcebf8' },
    { id: 'epic', name: 'Epic', prob: 0.04, mult: 5, color: '#8a5bc4', soft: '#ece3f7' },
    { id: 'legendary', name: 'Legendary', prob: 0.009, mult: 12, color: '#d9a21b', soft: '#fbefc7' },
    { id: 'mythic', name: 'Mythic', prob: 0.001, mult: 30, color: '#e0609a', soft: '#fbdfeb' },
  ],
  // Hard caps on the share of the final table that Legendary / Mythic may reach
  // (stops stacked bonuses from making them ordinary).
  rarityCaps: { legendary: 0.04, mythic: 0.004 },

  fishing: {
    biteMin: 6, biteMax: 14,       // seconds, before bonuses
    biteFloor: 2.8,                // never shorter than this (needs time for the fish to swim in)
    biteNibble: 1.0,               // "bite detected" animation
    retrieveMin: 2.0, retrieveMax: 3.0,
    castTime: 0.6,
    descendSpeed: 0.34,            // depth fraction per second
    defaultDepth: 0.35,            // base casting depth
    minDepth: 0.12,
    depthStep: 0.05,
    layerBounds: [0.3, 0.6],       // surface < 0.3 <= midwater < 0.6 <= deep
    junkChance: 0.08,
    treasureChance: 0.035,
    fragmentChance: 0.03,          // per cast, in zones that hide a map fragment
    variantChance: 0.012,          // prismatic colour variant
    variantMult: 1.6,
    exceptionalChance: 0.04,       // chance of an unusually big specimen
    weightMultMin: 0.7, weightMultMax: 1.8,
    baitBoost: 2.4,                // weight multiplier for species matching the bait
    presentTime: { common: 1.7, uncommon: 2.1, rare: 3, epic: 4, legendary: 5.5, mythic: 6.5 },
  },

  // Base value of a typical fish in each zone (species have a factor on top)
  zoneBase: [8, 18, 38, 80, 170, 360, 760],
  treasureZoneMult: [1, 2, 3.5, 6, 10, 16, 26],
  junkZoneMult: [1, 1.6, 2.4, 3.6, 5, 7, 10],

  hookSizeClassWeights: [1.5, 5, 20, 60, 200, 600], // avg-weight thresholds for size class 1..7

  quests: { maxActive: 3, boardSize: 4, rerollCost: 40 },

  prestige: {
    minDiscovered: 45,
    needZone: 'twilight',
    runEarnedDivisor: 6000,
    saleBonusPerStar: 0.02,
    perks: [
      { id: 'sale', name: 'Seasoned Trader', desc: '+6% sale value per level', max: 8, per: 0.06 },
      { id: 'bite', name: 'Quick Hands', desc: '-2.5% bite time per level', max: 8, per: 0.025 },
      { id: 'cargo', name: 'Deep Pockets', desc: '+1 cargo slot per level', max: 6, per: 1 },
      { id: 'luck', name: 'Tide Luck', desc: '+3% rare catch focus per level', max: 5, per: 0.03 },
    ],
  },
};

const RARITY = Object.fromEntries(CONFIG.rarities.map((r, i) => [r.id, { ...r, index: i }]));
const RARITY_IDS = CONFIG.rarities.map(r => r.id);

Object.assign(__ex,{CONFIG, RARITY, RARITY_IDS});
};
__mods['draw.js']=function(__ex){
// Reusable hand-drawn style helpers: organic shapes, clouds, islands, birds, boats, fisherman, pets.
const INK = '#34455c';
const TAU = Math.PI * 2;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const hash = n => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };

function hexRgb(h) {
  const n = parseInt(h.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function rgba(h, a) { const [r, g, b] = hexRgb(h); return `rgba(${r},${g},${b},${a})`; }
function mix(a, b, t) {
  const A = hexRgb(a), B = hexRgb(b);
  return `rgb(${Math.round(lerp(A[0], B[0], t))},${Math.round(lerp(A[1], B[1], t))},${Math.round(lerp(A[2], B[2], t))})`;
}
const shade = (h, f) => (f >= 0 ? mix(h, '#ffffff', f) : mix(h, '#000000', -f));

/** Smooth closed/open curve through points using quadratic midpoints. */
function smoothPath(ctx, p, closed = true) {
  const n = p.length;
  ctx.beginPath();
  if (closed) {
    ctx.moveTo((p[n - 1][0] + p[0][0]) / 2, (p[n - 1][1] + p[0][1]) / 2);
    for (let i = 0; i < n; i++) {
      const a = p[i], b = p[(i + 1) % n];
      ctx.quadraticCurveTo(a[0], a[1], (a[0] + b[0]) / 2, (a[1] + b[1]) / 2);
    }
    ctx.closePath();
  } else {
    ctx.moveTo(p[0][0], p[0][1]);
    for (let i = 1; i < n - 1; i++) {
      const a = p[i], b = p[i + 1];
      ctx.quadraticCurveTo(a[0], a[1], (a[0] + b[0]) / 2, (a[1] + b[1]) / 2);
    }
    ctx.lineTo(p[n - 1][0], p[n - 1][1]);
  }
}

/** Slightly irregular ellipse so nothing looks perfectly geometric. */
function organic(ctx, cx, cy, rx, ry, seed = 1, n = 9, j = 0.08) {
  const pts = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU, k = 1 + (hash(seed * 7.3 + i * 1.7) - 0.5) * 2 * j;
    pts.push([cx + Math.cos(a) * rx * k, cy + Math.sin(a) * ry * k]);
  }
  smoothPath(ctx, pts, true);
}

/** Fill then outline the current path. */
function paint(ctx, fill, lw = 2, ink = INK) {
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  if (lw) { ctx.lineWidth = lw; ctx.strokeStyle = ink; ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.stroke(); }
}

function glow(ctx, x, y, r, color, a = 0.6) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, rgba(color, a)); g.addColorStop(1, rgba(color, 0));
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
}

function sparkle(ctx, x, y, r, color = '#fff6c8', rot = 0) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot);
  ctx.fillStyle = color; ctx.beginPath();
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * TAU;
    ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    ctx.lineTo(Math.cos(a + TAU / 8) * r * 0.28, Math.sin(a + TAU / 8) * r * 0.28);
  }
  ctx.closePath(); ctx.fill(); ctx.restore();
}

function bubble(ctx, x, y, r, a = 0.6) {
  ctx.beginPath(); ctx.arc(x, y, r, 0, TAU);
  ctx.fillStyle = `rgba(255,255,255,${a * 0.18})`; ctx.fill();
  ctx.strokeStyle = `rgba(255,255,255,${a})`; ctx.lineWidth = Math.max(1, r * 0.18); ctx.stroke();
  ctx.beginPath(); ctx.arc(x - r * 0.35, y - r * 0.35, r * 0.22, 0, TAU);
  ctx.fillStyle = `rgba(255,255,255,${a})`; ctx.fill();
}

function cloud(ctx, x, y, s, seed, color = '#ffffff', alpha = 0.9) {
  ctx.save(); ctx.globalAlpha = alpha; ctx.translate(x, y); ctx.scale(s, s);
  const puffs = [[-46, 6, 30, 20], [-14, -8, 38, 28], [24, -2, 34, 24], [52, 8, 26, 17], [4, 10, 52, 16]];
  ctx.fillStyle = color;
  puffs.forEach((p, i) => { organic(ctx, p[0], p[1], p[2], p[3], seed + i, 8, 0.07); ctx.fill(); });
  ctx.globalAlpha = alpha * 0.35; ctx.fillStyle = '#9fb6d6';
  organic(ctx, 2, 18, 56, 8, seed, 8, 0.05); ctx.fill();
  ctx.restore();
}

function gull(ctx, x, y, s, t, color = '#ffffff') {
  const flap = Math.sin(t * 6 + x) * 0.55;
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
  ctx.strokeStyle = color === '#ffffff' ? '#6a7d96' : color; ctx.lineWidth = 2 / s * 1.4; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(-9, -3 * flap * 3); ctx.quadraticCurveTo(-4, -6 - flap * 4, 0, 0); ctx.quadraticCurveTo(4, -6 - flap * 4, 9, -3 * flap * 3); ctx.stroke();
  ctx.restore();
}

/** Distant island silhouette with vegetation / snow / ruins etc. Origin at the island's base centre. */
function island(ctx, x, y, w, h, kind, seed, tint = 0, night = 0) {
  ctx.save(); ctx.translate(x, y);
  const dim = c => mix(c, '#1c2650', clamp(night * 0.6 + tint, 0, 1));
  const base = { grass: '#8fc58a', palm: '#9bd69a', cliff: '#6f9a7a', reef: '#b8d8a0', rocks: '#5a5c8a', ice: '#e6f2fc', ruins: '#7a6aa8' }[kind] || '#8fc58a';
  const pts = [[-w / 2, 0]];
  const n = 7;
  for (let i = 1; i < n; i++) {
    const u = i / n, hh = Math.sin(u * Math.PI) * h * (0.75 + hash(seed + i) * 0.5);
    pts.push([-w / 2 + u * w, -hh]);
  }
  pts.push([w / 2, 0]);
  smoothPath(ctx, pts, false); ctx.lineTo(w / 2, 6); ctx.lineTo(-w / 2, 6); ctx.closePath();
  paint(ctx, dim(base), 2, dim('#4a6a6a'));
  // sandy shore
  ctx.fillStyle = dim(kind === 'ice' ? '#ffffff' : '#ecdcae');
  organic(ctx, 0, 3, w * 0.52, 6, seed, 8, 0.1); ctx.fill();
  const tree = (tx, ty, sc) => {
    if (kind === 'palm') {
      ctx.strokeStyle = dim('#7a5a3a'); ctx.lineWidth = 3 * sc; ctx.beginPath(); ctx.moveTo(tx, ty); ctx.quadraticCurveTo(tx + 4 * sc, ty - 14 * sc, tx + 2 * sc, ty - 26 * sc); ctx.stroke();
      ctx.fillStyle = dim('#4fa86a');
      for (let k = 0; k < 5; k++) { const a = -Math.PI / 2 + (k - 2) * 0.7; ctx.beginPath(); ctx.ellipse(tx + 2 * sc + Math.cos(a) * 10 * sc, ty - 26 * sc + Math.sin(a) * 6 * sc, 11 * sc, 3.5 * sc, a, 0, TAU); ctx.fill(); }
    } else if (kind === 'ice') {
      ctx.fillStyle = dim('#cfe6f6'); ctx.beginPath(); ctx.moveTo(tx - 8 * sc, ty); ctx.lineTo(tx, ty - 22 * sc); ctx.lineTo(tx + 8 * sc, ty); ctx.closePath(); ctx.fill();
    } else if (kind === 'rocks' || kind === 'ruins') {
      ctx.fillStyle = dim('#3e3e66'); ctx.fillRect(tx - 3 * sc, ty - 18 * sc, 6 * sc, 18 * sc);
      if (kind === 'ruins') { ctx.fillStyle = dim('#a98aff'); ctx.fillRect(tx - 1 * sc, ty - 12 * sc, 2 * sc, 4 * sc); }
    } else {
      ctx.fillStyle = dim('#4a8a58'); organic(ctx, tx, ty - 10 * sc, 9 * sc, 11 * sc, seed + tx, 7, 0.1); ctx.fill();
      ctx.fillStyle = dim('#6a4a32'); ctx.fillRect(tx - 1.2 * sc, ty - 2 * sc, 2.4 * sc, 4 * sc);
    }
  };
  const cnt = kind === 'ice' ? 2 : 3;
  for (let i = 0; i < cnt; i++) tree(-w * 0.28 + i * w * 0.27 + hash(seed + i) * 10, -h * 0.35 - hash(seed + i * 3) * h * 0.2, 0.9 + hash(seed + i * 5) * 0.5);
  ctx.restore();
}

// ---------- Boats ----------
const BOAT_META = [
  { w: 190, h: 30, deck: 0.20 }, { w: 212, h: 32, deck: 0.22 }, { w: 236, h: 34, deck: 0.22 }, { w: 262, h: 36, deck: 0.25 },
  { w: 292, h: 38, deck: 0.27 }, { w: 316, h: 40, deck: 0.29 }, { w: 340, h: 42, deck: 0.30 },
];

function hullPath(ctx, w, h, bow = 1) {
  ctx.beginPath();
  ctx.moveTo(-w * 0.5, -h * 0.8);
  ctx.bezierCurveTo(-w * 0.49, -h * 0.05, -w * 0.36, h * 0.5, -w * 0.1, h * 0.52);
  ctx.bezierCurveTo(w * 0.2, h * 0.54, w * 0.42, h * 0.22, w * 0.55 * bow, -h * 1.0);
  ctx.bezierCurveTo(w * 0.28, -h * 0.74, -w * 0.2, -h * 0.7, -w * 0.5, -h * 0.8);
  ctx.closePath();
}
function planks(ctx, w, h, color, n = 3) {
  ctx.save(); hullPath(ctx, w, h); ctx.clip();
  ctx.strokeStyle = color; ctx.lineWidth = 1.2; ctx.globalAlpha = 0.5;
  for (let k = 1; k <= n; k++) {
    const y = -h * 0.8 + k * h * 0.3;
    ctx.beginPath(); ctx.moveTo(-w * 0.5, y); ctx.quadraticCurveTo(0, y + h * 0.28, w * 0.56, y - h * 0.3); ctx.stroke();
  }
  ctx.restore();
}
function porthole(ctx, x, y, r, glowing) {
  ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); paint(ctx, glowing ? '#9ff0ff' : '#cfe8f2', 1.6);
  ctx.beginPath(); ctx.arc(x - r * 0.3, y - r * 0.3, r * 0.3, 0, TAU); ctx.fillStyle = 'rgba(255,255,255,.8)'; ctx.fill();
}
function sailShape(ctx, x, y, hgt, wid, color, t, patch) {
  const bulge = Math.sin(t * 1.2) * 3;
  ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x + wid * 0.9 + bulge, y - hgt * 0.5, x + wid * 0.1, y - hgt);
  ctx.lineTo(x, y - hgt); ctx.closePath(); paint(ctx, color, 2);
  if (patch) { ctx.beginPath(); ctx.moveTo(x + 6, y - hgt * 0.35); ctx.lineTo(x + 24, y - hgt * 0.4); ctx.lineTo(x + 20, y - hgt * 0.22); ctx.lineTo(x + 5, y - hgt * 0.2); ctx.closePath(); paint(ctx, patch, 1.2); }
}
function pennant(ctx, x, y, color, t, size = 1) {
  ctx.strokeStyle = INK; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y - 14 * size); ctx.stroke();
  const f = Math.sin(t * 4) * 2;
  ctx.beginPath(); ctx.moveTo(x, y - 14 * size); ctx.quadraticCurveTo(x - 9 * size, y - 16 * size + f, x - 17 * size, y - 11 * size + f * 1.5); ctx.quadraticCurveTo(x - 9 * size, y - 9 * size, x, y - 7 * size);
  ctx.closePath(); paint(ctx, color, 1.4);
}

/**
 * Draw a boat in local space: origin at the waterline centre, bow to the right.
 * opts: {t, deco (pennant colour or null), night}
 */
function drawBoat(ctx, tier, o = {}) {
  const t = o.t || 0, m = BOAT_META[tier], w = m.w, h = m.h;
  ctx.save();
  ctx.lineJoin = 'round';
  const hullCols = ['#b98a56', '#8c6a45', '#c8533e', '#7a5a3a', '#3f6f8f', '#c0413a', '#2c2f6a'];
  const trims = ['#f3e7c8', '#4a8fb0', '#f4efe2', '#e8d3a0', '#e9f2f6', '#f4efe2', '#e8c15a'];
  const hc = hullCols[tier], tc = trims[tier];
  // ---- superstructure behind hull ----
  if (tier === 0) {
    ctx.strokeStyle = '#6a4a2a'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(-w * 0.2, -h * 0.9); ctx.lineTo(-w * 0.45, h * 0.2 - 10); ctx.stroke(); // oar
    ctx.beginPath(); ctx.ellipse(-w * 0.46, -6, 3, 9, 0.5, 0, TAU); paint(ctx, '#8a6a42', 1.2);
    ctx.strokeStyle = INK; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(-w * 0.08, -h * 0.8); ctx.lineTo(-w * 0.08, -h * 3.2); ctx.stroke();
    sailShape(ctx, -w * 0.08, -h * 0.8, h * 2.3, 30, '#f5ecd2', t, '#d9b27a');
  } else if (tier === 1) {
    ctx.strokeStyle = INK; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(-w * 0.06, -h * 0.8); ctx.lineTo(-w * 0.06, -h * 4.1); ctx.stroke();
    sailShape(ctx, -w * 0.06, -h * 0.9, h * 3, 44, '#f5ecd2', t, '#e8a090');
  } else if (tier === 2) {
    // cabin
    ctx.beginPath(); ctx.moveTo(-w * 0.34, -h * 0.8); ctx.lineTo(-w * 0.34, -h * 2.3); ctx.lineTo(-w * 0.04, -h * 2.3); ctx.lineTo(-w * 0.0, -h * 0.8); ctx.closePath(); paint(ctx, '#f7efe0', 2);
    ctx.fillStyle = '#cfe8f2'; ctx.fillRect(-w * 0.3, -h * 2.0, w * 0.14, h * 0.75); ctx.strokeStyle = INK; ctx.lineWidth = 1.4; ctx.strokeRect(-w * 0.3, -h * 2.0, w * 0.14, h * 0.75);
    ctx.beginPath(); ctx.rect(-w * 0.37, -h * 2.55, w * 0.4, h * 0.3); paint(ctx, '#c8533e', 2);
    ctx.fillStyle = '#8a8f98'; ctx.fillRect(-w * 0.52, -h * 0.9, 10, h * 0.9); // motor
    ctx.strokeStyle = INK; ctx.lineWidth = 1.4; ctx.strokeRect(-w * 0.52, -h * 0.9, 10, h * 0.9);
  } else if (tier === 3) {
    ctx.strokeStyle = '#5a3c20'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(-w * 0.16, -h * 0.8); ctx.lineTo(-w * 0.16, -h * 5.6); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(w * 0.1, -h * 0.9); ctx.lineTo(w * 0.1, -h * 4.2); ctx.stroke();
    sailShape(ctx, -w * 0.15, -h * 1.0, h * 4.4, 62, '#fbf4e0', t, '#d8785a');
    sailShape(ctx, w * 0.11, -h * 1.0, h * 3.1, 36, '#f3e8cc', t + 1, null);
    pennant(ctx, -w * 0.16, -h * 5.6, '#e86a5a', t);
  } else if (tier === 4) {
    ctx.beginPath(); ctx.moveTo(-w * 0.4, -h * 0.8); ctx.lineTo(-w * 0.4, -h * 2.3); ctx.lineTo(-w * 0.12, -h * 2.3); ctx.lineTo(-w * 0.04, -h * 0.8); ctx.closePath(); paint(ctx, '#f4f6f8', 2);
    ctx.beginPath(); ctx.rect(-w * 0.34, -h * 3.4, w * 0.2, h * 1.1); paint(ctx, '#e6eef2', 2);
    for (let i = 0; i < 3; i++) { ctx.fillStyle = '#9fd0e6'; ctx.fillRect(-w * 0.32 + i * w * 0.062, -h * 3.1, w * 0.045, h * 0.5); }
    ctx.strokeStyle = INK; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-w * 0.24, -h * 3.4); ctx.lineTo(-w * 0.24, -h * 4.3); ctx.stroke();
    ctx.save(); ctx.translate(-w * 0.24, -h * 4.3); ctx.rotate(t * 1.6); ctx.beginPath(); ctx.moveTo(-9, 0); ctx.lineTo(9, 0); ctx.stroke(); ctx.restore();
  } else if (tier === 5) {
    ctx.beginPath(); ctx.moveTo(-w * 0.42, -h * 0.8); ctx.lineTo(-w * 0.42, -h * 2.4); ctx.lineTo(-w * 0.1, -h * 2.4); ctx.lineTo(-w * 0.0, -h * 0.8); ctx.closePath(); paint(ctx, '#f6f8fa', 2);
    ctx.beginPath(); ctx.rect(-w * 0.36, -h * 3.5, w * 0.22, h * 1.1); paint(ctx, '#e1eaf0', 2);
    for (let i = 0; i < 3; i++) { ctx.fillStyle = '#8fc4e0'; ctx.fillRect(-w * 0.34 + i * w * 0.065, -h * 3.2, w * 0.048, h * 0.5); }
    ctx.beginPath(); ctx.rect(-w * 0.3, -h * 3.9, w * 0.1, h * 0.45); paint(ctx, '#c0413a', 1.6);
    ctx.strokeStyle = '#5a6a7a'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(w * 0.02, -h * 0.8); ctx.lineTo(w * 0.02, -h * 3.3); ctx.lineTo(w * 0.22, -h * 2.2); ctx.stroke(); // crane
    ctx.fillStyle = 'rgba(255,255,255,.95)'; organic(ctx, -w * 0.1, -h * 2.45, 26, 5, 3, 7, 0.1); ctx.fill();
  } else if (tier === 6) {
    ctx.beginPath(); ctx.moveTo(-w * 0.44, -h * 0.8); ctx.quadraticCurveTo(-w * 0.44, -h * 2.8, -w * 0.2, -h * 2.9); ctx.quadraticCurveTo(w * 0.04, -h * 2.8, w * 0.04, -h * 0.8); ctx.closePath(); paint(ctx, '#3a3f8a', 2);
    for (let i = 0; i < 3; i++) porthole(ctx, -w * 0.34 + i * w * 0.14, -h * 1.8, 7, true);
    ctx.beginPath(); ctx.arc(-w * 0.2, -h * 2.9, 15, Math.PI, 0); ctx.closePath(); paint(ctx, '#e8c15a', 2);
    ctx.beginPath(); ctx.arc(-w * 0.2, -h * 3.0, 6, 0, TAU); paint(ctx, '#9ff0ff', 1.4);
    glow(ctx, -w * 0.2, -h * 3.0, 40, '#9ff0ff', 0.35 + Math.sin(t * 2) * 0.1);
    ctx.beginPath(); ctx.moveTo(-w * 0.5, -h * 0.6); ctx.lineTo(-w * 0.62, -h * 1.7); ctx.lineTo(-w * 0.36, -h * 0.8); ctx.closePath(); paint(ctx, '#e8c15a', 1.6);
  }
  // ---- hull ----
  const bow = tier === 5 ? 1.08 : 1;
  hullPath(ctx, w, h, bow); paint(ctx, hc, 2.6);
  planks(ctx, w, h, shade(hc, -0.35), tier >= 4 ? 2 : 3);
  // gunwale trim
  ctx.save(); hullPath(ctx, w, h, bow); ctx.clip();
  ctx.fillStyle = tc; ctx.beginPath(); ctx.moveTo(-w * 0.52, -h * 0.9); ctx.bezierCurveTo(-w * 0.2, -h * 0.66, w * 0.28, -h * 0.76, w * 0.6, -h * 1.1); ctx.lineTo(w * 0.6, -h * 0.7); ctx.bezierCurveTo(w * 0.28, -h * 0.44, -w * 0.2, -h * 0.4, -w * 0.52, -h * 0.55); ctx.closePath(); ctx.fill();
  if (tier >= 5) { ctx.fillStyle = tier === 5 ? '#f4efe2' : '#1a1d50'; ctx.fillRect(-w * 0.5, h * 0.05, w * 1.1, h * 0.6); }
  ctx.restore();
  hullPath(ctx, w, h, bow); ctx.lineWidth = 2.6; ctx.strokeStyle = INK; ctx.stroke();
  if (tier === 4 || tier === 6) for (let i = 0; i < 4; i++) porthole(ctx, -w * 0.25 + i * w * 0.18, -h * 0.05, 4.5, tier === 6);
  if (tier === 1 || tier === 2) porthole(ctx, w * 0.12, -h * 0.1, 4, false);
  // railing for bigger boats
  if (tier >= 3) { ctx.strokeStyle = INK; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(w * 0.1, -h * 1.0); ctx.lineTo(w * 0.1, -h * 1.9); ctx.lineTo(w * 0.5, -h * 1.8); ctx.stroke(); }
  if (o.deco) pennant(ctx, w * 0.5, -h * 1.0, o.deco, t, 1.1);
  else if (tier < 3) pennant(ctx, w * 0.54, -h * 1.0, '#ee8a7a', t, 0.9);
  ctx.restore();
}

// ---------- Fisherman & rod ----------
/**
 * Draws the fisherman at local (x, y) (feet). pose: 'idle'|'cast'|'wait'|'bite'|'reel'|'show'
 * p = progress for the pose. Returns rod-tip position in the same local space.
 */
function drawFisherman(ctx, x, y, o) {
  const { pose = 'idle', p = 0, t = 0, rodColor = '#a87a4a', rodTier = 0 } = o;
  ctx.save(); ctx.translate(x, y); ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  const breath = Math.sin(t * 2) * 0.8;
  const lean = pose === 'reel' ? -3 : pose === 'bite' ? -5 : pose === 'cast' ? (p < 0.5 ? 4 : -3) : 0;
  // legs
  ctx.fillStyle = '#3d4c66';
  ctx.beginPath(); ctx.roundRect(-9, -18, 8, 18, 3); paint(ctx, '#3d4c66', 1.6);
  ctx.beginPath(); ctx.roundRect(1, -18, 8, 18, 3); paint(ctx, '#46567a', 1.6);
  // boots
  ctx.beginPath(); ctx.roundRect(-10, -3, 11, 5, 2); paint(ctx, '#5a3e28', 1.2);
  ctx.beginPath(); ctx.roundRect(0, -3, 12, 5, 2); paint(ctx, '#5a3e28', 1.2);
  ctx.translate(lean, 0);
  // body
  ctx.beginPath(); ctx.moveTo(-10, -17); ctx.quadraticCurveTo(-13, -34 + breath, -7, -42 + breath); ctx.lineTo(7, -42 + breath); ctx.quadraticCurveTo(13, -34 + breath, 10, -17); ctx.closePath();
  paint(ctx, '#d86a52', 1.8);
  ctx.fillStyle = '#e8927c'; ctx.fillRect(-9, -26, 18, 3);
  // head
  ctx.beginPath(); ctx.arc(0, -50 + breath, 8.5, 0, TAU); paint(ctx, '#f2c9a0', 1.8);
  ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(4, -51 + breath, 1.3, 0, TAU); ctx.fill();
  ctx.strokeStyle = '#c07a60'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.arc(5, -48 + breath, 2.2, 0.2, 1.5); ctx.stroke();
  // straw hat
  ctx.beginPath(); ctx.ellipse(0, -56 + breath, 15, 4.2, 0, 0, TAU); paint(ctx, '#ecd078', 1.6);
  ctx.beginPath(); ctx.moveTo(-7, -57 + breath); ctx.quadraticCurveTo(0, -69 + breath, 7, -57 + breath); ctx.closePath(); paint(ctx, '#f3dc8c', 1.6);
  ctx.fillStyle = '#d86a52'; ctx.fillRect(-7, -59 + breath, 14, 2.2);
  // rod
  const handX = 9, handY = -33 + breath;
  let ang = -0.95, bend = 0.12, handDy = 0;
  if (pose === 'cast') { const e = p * p * (3 - 2 * p); ang = lerp(-2.5, -0.55, e); bend = lerp(0.5, -0.05, e); }
  else if (pose === 'wait') { ang = -0.75 + Math.sin(t * 1.3) * 0.02; bend = 0.18; }
  else if (pose === 'bite') { ang = -0.7 + Math.sin(t * 28) * 0.05; bend = 0.55 + Math.sin(t * 22) * 0.12; }
  else if (pose === 'reel') { ang = -0.85; bend = 0.45; handDy = Math.sin(t * 14) * 1.5; }
  else if (pose === 'show') { ang = -1.5; bend = 0.1; handDy = -6; }
  const L = 82 + rodTier * 2.5;
  const hy = handY + handDy;
  const mid = [handX + Math.cos(ang) * L * 0.55, hy + Math.sin(ang) * L * 0.55];
  const tip = [handX + Math.cos(ang + bend) * L, hy + Math.sin(ang + bend) * L + bend * 14];
  ctx.strokeStyle = shade(rodColor, -0.35); ctx.lineWidth = 4.4; ctx.beginPath(); ctx.moveTo(handX - 4, hy + 2); ctx.quadraticCurveTo(mid[0], mid[1], tip[0], tip[1]); ctx.stroke();
  ctx.strokeStyle = rodColor; ctx.lineWidth = 2.6; ctx.beginPath(); ctx.moveTo(handX - 4, hy + 2); ctx.quadraticCurveTo(mid[0], mid[1], tip[0], tip[1]); ctx.stroke();
  if (rodTier >= 5) { glow(ctx, tip[0], tip[1], 9, rodTier === 6 ? '#ffe08a' : '#cfe0ff', 0.7); }
  // reel
  ctx.beginPath(); ctx.arc(handX + 3, hy + 3, 3.6, 0, TAU); paint(ctx, '#c8ccd2', 1.4);
  // arms
  ctx.strokeStyle = '#b8503c'; ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(4, -38 + breath); ctx.quadraticCurveTo(12, -34, handX, hy); ctx.stroke();
  ctx.strokeStyle = INK; ctx.lineWidth = 1.2; ctx.stroke();
  ctx.beginPath(); ctx.arc(handX, hy, 3.2, 0, TAU); paint(ctx, '#f2c9a0', 1.2);
  ctx.restore();
  return { x: x + lean + tip[0], y: y + tip[1], hand: [x + lean + handX, y + hy] };
}

// ---------- Pets ----------
/** Origin at the pet's feet / base. size ~ 36px tall. o: {t, dir, happy (0..1 bounce), scale} */
function drawPet(ctx, id, o = {}) {
  const t = o.t || 0, hp = o.happy || 0, s = o.scale || 1;
  ctx.save(); ctx.scale(s * (o.dir || 1), s); ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  const hop = -Math.abs(Math.sin(hp * 9)) * 12 * hp;
  ctx.translate(0, hop);
  switch (id) {
    case 'cat': {
      const wag = Math.sin(t * 2.2) * 6;
      ctx.beginPath(); ctx.moveTo(-12, -4); ctx.bezierCurveTo(-30, -2 + wag, -28, -26 + wag, -20, -24); ctx.lineWidth = 6; ctx.strokeStyle = INK; ctx.stroke();
      ctx.lineWidth = 3.8; ctx.strokeStyle = '#e8944a'; ctx.stroke();
      organic(ctx, 0, -12, 15, 13, 1, 9, 0.05); paint(ctx, '#e8944a', 2);
      ctx.fillStyle = '#f7d9a8'; organic(ctx, 3, -8, 8, 8, 2, 8, 0.05); ctx.fill();
      organic(ctx, 6, -28, 11, 10, 3, 9, 0.04); paint(ctx, '#e8944a', 2);
      for (const sx of [-1, 1]) { ctx.beginPath(); ctx.moveTo(6 + sx * 4, -35); ctx.lineTo(6 + sx * 10, -44); ctx.lineTo(6 + sx * 11, -32); ctx.closePath(); paint(ctx, '#e8944a', 1.8); }
      ctx.strokeStyle = '#b8642a'; ctx.lineWidth = 1.6; for (const k of [-5, 0, 5]) { ctx.beginPath(); ctx.moveTo(4 + k, -37); ctx.lineTo(4 + k, -33); ctx.stroke(); }
      const blink = Math.sin(t * 0.7) > 0.96;
      ctx.fillStyle = INK; if (!blink) { ctx.beginPath(); ctx.ellipse(11, -29, 1.8, 2.4, 0, 0, TAU); ctx.fill(); ctx.beginPath(); ctx.ellipse(3, -29, 1.8, 2.4, 0, 0, TAU); ctx.fill(); }
      else { ctx.fillRect(9, -29, 4, 1); ctx.fillRect(1, -29, 4, 1); }
      ctx.fillStyle = '#e88a9a'; ctx.beginPath(); ctx.arc(8, -25, 1.4, 0, TAU); ctx.fill();
      break;
    }
    case 'gull': {
      const flap = hp > 0 ? Math.sin(t * 20) * 0.8 : Math.sin(t * 0.9) * 0.05;
      ctx.strokeStyle = '#e8a04a'; ctx.lineWidth = 2.2; ctx.beginPath(); ctx.moveTo(-3, -9); ctx.lineTo(-3, 0); ctx.moveTo(4, -9); ctx.lineTo(4, 0); ctx.stroke();
      organic(ctx, 0, -17, 17, 11, 4, 9, 0.05); paint(ctx, '#fbfbfb', 2);
      ctx.save(); ctx.translate(-2, -18); ctx.rotate(-0.4 - flap); ctx.beginPath(); ctx.ellipse(-5, 0, 13, 6, 0, 0, TAU); paint(ctx, '#aab8c8', 1.8); ctx.restore();
      organic(ctx, 11, -28, 8, 8, 5, 8, 0.04); paint(ctx, '#fbfbfb', 2);
      ctx.beginPath(); ctx.moveTo(17, -29); ctx.lineTo(26, -26); ctx.lineTo(17, -25); ctx.closePath(); paint(ctx, '#f0a83a', 1.6);
      ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(13, -30, 1.5, 0, TAU); ctx.fill();
      break;
    }
    case 'crab': {
      const sc = Math.sin(t * 3) * 3;
      ctx.strokeStyle = '#2b6aa8'; ctx.lineWidth = 2.2;
      for (let i = 0; i < 3; i++) for (const sx of [-1, 1]) { ctx.beginPath(); ctx.moveTo(sx * 8, -8); ctx.lineTo(sx * (16 + i * 2), -4 + (i % 2) * 3 + sc * 0.3); ctx.lineTo(sx * (18 + i * 2), 0); ctx.stroke(); }
      for (const sx of [-1, 1]) {
        const w = hp > 0 || Math.sin(t * 1.2) > 0.6 ? Math.sin(t * 12) * 0.4 : 0;
        ctx.beginPath(); ctx.moveTo(sx * 10, -12); ctx.lineTo(sx * 17, -20 + w * 8); ctx.lineWidth = 2.6; ctx.stroke();
        organic(ctx, sx * 19, -24 + w * 8, 6, 5, sx + 3, 7, 0.08); paint(ctx, '#3a82cc', 1.8);
      }
      organic(ctx, 0, -12, 14, 10, 6, 9, 0.05); paint(ctx, '#4a94dc', 2);
      ctx.fillStyle = '#7cb8ec'; organic(ctx, -3, -15, 6, 3, 7, 7, 0.05); ctx.fill();
      for (const sx of [-1, 1]) { ctx.strokeStyle = INK; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(sx * 4, -20); ctx.lineTo(sx * 5, -25); ctx.stroke(); ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(sx * 5, -26, 2.4, 0, TAU); ctx.fill(); ctx.stroke(); ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(sx * 5.4, -26, 1, 0, TAU); ctx.fill(); }
      break;
    }
    case 'otter': {
      const bob = Math.sin(t * 1.8) * 1.5;
      ctx.translate(0, bob);
      ctx.beginPath(); ctx.moveTo(-14, -8); ctx.quadraticCurveTo(-30, -6, -34, -12); ctx.lineWidth = 7; ctx.strokeStyle = INK; ctx.stroke(); ctx.lineWidth = 4.6; ctx.strokeStyle = '#8a6444'; ctx.stroke();
      organic(ctx, 0, -14, 17, 13, 8, 9, 0.05); paint(ctx, '#8a6444', 2);
      ctx.fillStyle = '#e6cfa6'; organic(ctx, 3, -12, 11, 8, 9, 8, 0.05); ctx.fill();
      organic(ctx, 8, -30, 11, 10, 10, 9, 0.04); paint(ctx, '#8a6444', 2);
      ctx.fillStyle = '#e6cfa6'; organic(ctx, 12, -26, 6, 4.5, 11, 8, 0.05); ctx.fill();
      for (const sx of [0, 1]) { ctx.beginPath(); ctx.arc(1 + sx * 14, -38, 3, 0, TAU); paint(ctx, '#8a6444', 1.6); }
      ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(10, -32, 1.5, 0, TAU); ctx.fill(); ctx.beginPath(); ctx.arc(3, -32, 1.5, 0, TAU); ctx.fill();
      ctx.beginPath(); ctx.ellipse(15, -27, 2.4, 1.8, 0, 0, TAU); ctx.fill();
      ctx.beginPath(); ctx.moveTo(8, -12); ctx.quadraticCurveTo(16, -18, 14, -22); ctx.lineWidth = 5; ctx.strokeStyle = '#8a6444'; ctx.stroke();
      ctx.beginPath(); ctx.arc(15, -23, 4, 0, TAU); paint(ctx, '#f0c8d8', 1.4);
      break;
    }
    case 'jelly': {
      const pulse = Math.sin(t * 2.4) * 0.12;
      ctx.translate(0, -26 + Math.sin(t * 1.5) * 4);
      glow(ctx, 0, 0, 34, '#d7c8ff', 0.45);
      ctx.globalAlpha = 0.9;
      for (let i = 0; i < 5; i++) { ctx.strokeStyle = 'rgba(220,200,255,.85)'; ctx.lineWidth = 2.4; ctx.beginPath(); ctx.moveTo(-10 + i * 5, 4); for (let k = 1; k <= 4; k++) ctx.lineTo(-10 + i * 5 + Math.sin(t * 3 + i + k) * 3, 4 + k * 6); ctx.stroke(); }
      ctx.beginPath(); ctx.moveTo(-16, 5); ctx.bezierCurveTo(-18, -20 * (1 + pulse), 18, -20 * (1 + pulse), 16, 5); ctx.quadraticCurveTo(0, 10, -16, 5); ctx.closePath(); paint(ctx, 'rgba(226,212,255,.85)', 1.8, '#8a76c8');
      ctx.fillStyle = 'rgba(255,255,255,.7)'; organic(ctx, -6, -9, 5, 3, 4, 7, 0.05); ctx.fill();
      ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(-5, -2, 1.5, 0, TAU); ctx.arc(5, -2, 1.5, 0, TAU); ctx.fill();
      ctx.globalAlpha = 1;
      break;
    }
    case 'dragon': {
      const fl = Math.sin(t * (hp > 0 ? 16 : 5)) * 0.5;
      ctx.translate(0, -16 + Math.sin(t * 2.4) * 3);
      ctx.beginPath(); ctx.moveTo(-8, 4); ctx.bezierCurveTo(-24, 8, -28, -8, -34, -4 + Math.sin(t * 3) * 4); ctx.lineWidth = 7; ctx.strokeStyle = INK; ctx.stroke(); ctx.lineWidth = 4.6; ctx.strokeStyle = '#4ab8a8'; ctx.stroke();
      ctx.save(); ctx.translate(-2, -6); ctx.rotate(-0.5 - fl); ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(-16, -22, -26, -6); ctx.quadraticCurveTo(-16, -8, -12, 0); ctx.quadraticCurveTo(-8, -4, 0, 2); ctx.closePath(); paint(ctx, '#a07ae0', 1.8); ctx.restore();
      organic(ctx, 0, 0, 13, 11, 12, 9, 0.05); paint(ctx, '#4ab8a8', 2);
      ctx.fillStyle = '#f4e4a0'; organic(ctx, 4, 4, 7, 6, 13, 8, 0.05); ctx.fill();
      organic(ctx, 12, -12, 10, 9, 14, 9, 0.04); paint(ctx, '#4ab8a8', 2);
      for (const sx of [-1, 1]) { ctx.beginPath(); ctx.moveTo(10 + sx * 4, -19); ctx.lineTo(10 + sx * 7, -28); ctx.lineTo(10 + sx * 9, -18); ctx.closePath(); paint(ctx, '#f4c85a', 1.6); }
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(15, -14, 2.8, 0, TAU); ctx.fill(); ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(15.6, -14, 1.5, 0, TAU); ctx.fill();
      ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(20, -9, 1, 0, TAU); ctx.fill();
      if (hp > 0.3) sparkle(ctx, 26, -8, 5, '#ffd870', t * 3);
      break;
    }
  }
  ctx.restore();
}

Object.assign(__ex,{INK, TAU, clamp, lerp, hash, hexRgb, rgba, mix, shade, smoothPath, organic, paint, glow, sparkle, bubble, cloud, gull, island, BOAT_META, drawBoat, drawFisherman, drawPet});
};
__mods['pets.js']=function(__ex){
// Companions: data, unlock rules and selection. Drawing lives in draw.js.
const PETS = [
  { id: 'cat', name: 'Harbor Cat', blurb: 'A ginger tabby who naps on the dock and judges your catches.',
    unlock: { type: 'start' }, req: 'Starting companion', bonus: { sale: 0.04 }, bonusText: '+4% sale value' },
  { id: 'gull', name: 'Pip the Seagull', blurb: 'A cheeky gull with a sharp eye for shiny fish.',
    unlock: { type: 'catches', n: 25 }, req: 'Catch 25 fish in total', bonus: { bite: 0.05 }, bonusText: '5% faster bites' },
  { id: 'crab', name: 'Blue Crab', blurb: 'A tiny blue crab who clacks happily whenever a fish is caught.',
    unlock: { type: 'species', id: 'shore_crab' }, req: 'Discover the Shore Crab', bonus: { cargo: 1 }, bonusText: '+1 cargo slot' },
  { id: 'otter', name: 'Sea Otter', blurb: 'Floats beside the boat cracking shells and finding odd shiny things.',
    unlock: { type: 'buy', price: 1500 }, req: 'Adopt at the harbor for 1,500 coins', bonus: { treasure: 0.15 }, bonusText: '+15% treasure chance' },
  { id: 'jelly', name: 'Moon Jelly', blurb: 'A glowing little jelly that drifts beside the boat. It only wakes under the moon.',
    unlock: { type: 'secret', id: 'moonlit_catch' }, req: 'Secret: a moonlit surprise...', bonus: { rare: 0.06 }, bonusText: '+6% rare catch focus' },
  { id: 'dragon', name: 'Mini Dragon', blurb: 'A pocket-sized dragon who hatched from a deep-sea legend. Very proud of itself.',
    unlock: { type: 'species', id: 'deep_dragonfish' }, req: 'Discover the Deep Dragonfish', bonus: { sale: 0.03, rare: 0.03 }, bonusText: '+3% sale value, +3% rare focus' },
];
const PET_BY_ID = Object.fromEntries(PETS.map(p => [p.id, p]));

function petOwned(state, id) { return state.pets.owned.includes(id); }

function ownPet(state, id) {
  if (!PET_BY_ID[id] || petOwned(state, id)) return false;
  state.pets.owned.push(id);
  return true;
}

// Returns list of newly unlocked pet ids (non-purchase unlocks).
function checkPetUnlocks(state) {
  const out = [];
  for (const p of PETS) {
    if (petOwned(state, p.id)) continue;
    const u = p.unlock;
    let ok = false;
    if (u.type === 'start') ok = true;
    else if (u.type === 'catches') ok = state.stats.fishCaught >= u.n;
    else if (u.type === 'species') ok = !!state.book[u.id];
    else if (u.type === 'secret') ok = !!state.secrets.found[u.id];
    if (ok && ownPet(state, p.id)) out.push(p.id);
  }
  return out;
}

function activePetDef(state) { return state.pets.active ? PET_BY_ID[state.pets.active] : null; }

function selectPet(state, id) {
  if (id !== null && !petOwned(state, id)) return false;
  state.pets.active = id;
  return true;
}

// The only place a purchased pet is added; prevents double buys.
function buyPet(state, id, spend) {
  const p = PET_BY_ID[id];
  if (!p || p.unlock.type !== 'buy' || petOwned(state, id)) return { ok: false, msg: 'Already adopted.' };
  if (!spend(state, p.unlock.price)) return { ok: false, msg: 'Not enough coins.' };
  ownPet(state, id);
  return { ok: true, msg: `${p.name} joined your crew!` };
}

Object.assign(__ex,{PETS, PET_BY_ID, petOwned, checkPetUnlocks, activePetDef, selectPet, buyPet});
};
__mods['upgrades.js']=function(__ex){
// Equipment tiers, baits, boats and boosts (data) and the effect aggregator.
const { CONFIG } = __req('config.js');
const { PET_BY_ID } = __req('pets.js');

const RODS = [
  { id: 'rod0', name: 'Driftwood Rod', price: 0, biteRed: 0, color: '#a87a4a', desc: 'A trusty old rod. It has seen things.', special: 'None' },
  { id: 'rod1', name: 'Bamboo Rod', price: 120, biteRed: 0.08, color: '#c8b45a', desc: 'Light and springy.', special: 'Reels in 10% faster', fx: { retrieve: 0.9 } },
  { id: 'rod2', name: 'Fiberglass Rod', price: 450, biteRed: 0.15, color: '#5fa8c8', desc: 'Sturdy and smooth.', special: '30% less junk', fx: { junk: 0.7 } },
  { id: 'rod3', name: 'Steel-Tip Rod', price: 1500, biteRed: 0.22, color: '#9aa8b8', desc: 'A sensitive tip that feels every nibble.', special: '+25% treasure chance', fx: { treasure: 1.25 } },
  { id: 'rod4', name: 'Carbon Rod', price: 5000, biteRed: 0.30, color: '#3a4256', desc: 'Strong, light and precise.', special: '+5% fish size', fx: { size: 0.05 } },
  { id: 'rod5', name: 'Moonsilver Rod', price: 16000, biteRed: 0.38, color: '#c8d4f0', desc: 'Forged under a full moon.', special: '+6% rare catch focus', fx: { rare: 0.06 } },
  { id: 'rod6', name: 'Tidecaller Rod', price: 50000, biteRed: 0.46, color: '#e8b84a', desc: 'The sea itself seems to answer it.', special: 'Faster reel, more rare focus & treasure', fx: { retrieve: 0.85, rare: 0.08, treasure: 1.2 } },
];
const LINES = [
  { id: 'line0', name: 'Cotton Line', price: 0, maxDepth: 0.40, color: '#e8dcc0', desc: 'Fine for the shallows.' },
  { id: 'line1', name: 'Braided Line', price: 150, maxDepth: 0.55, color: '#d0a060', desc: 'Reaches into the midwater.' },
  { id: 'line2', name: 'Silk-Weave Line', price: 600, maxDepth: 0.70, color: '#c8e0d0', desc: 'Strong and thin. Dives deeper.' },
  { id: 'line3', name: 'Deepwater Cable', price: 2200, maxDepth: 0.82, color: '#8aa0c0', desc: 'Built for the dark below.' },
  { id: 'line4', name: 'Abyss Cord', price: 7500, maxDepth: 0.92, color: '#6a5aa0', desc: 'Almost to the bottom.' },
  { id: 'line5', name: 'Starthread', price: 26000, maxDepth: 1.0, color: '#f0d870', desc: 'Spun from something that falls from the sky.' },
];
const HOOKS = [
  { id: 'hook0', name: 'Bent Pin Hook', price: 0, cap: 2, sizeBonus: 0, color: '#aab4bc', desc: 'Catches small fish only.' },
  { id: 'hook1', name: 'Steel Hook', price: 100, cap: 3, sizeBonus: 0.02, color: '#c0c8d0', desc: 'Handles medium-sized fish.' },
  { id: 'hook2', name: 'Barbed Hook', price: 400, cap: 4, sizeBonus: 0.04, color: '#9aa4ae', desc: 'Holds on to big fish.' },
  { id: 'hook3', name: 'Wide-Gap Hook', price: 1600, cap: 5, sizeBonus: 0.06, color: '#8a96a4', desc: 'For truly large fish.' },
  { id: 'hook4', name: 'Titan Hook', price: 6000, cap: 6, sizeBonus: 0.08, color: '#6a7a8c', desc: 'Giants of the deep can be hooked.' },
  { id: 'hook5', name: 'Leviathan Hook', price: 22000, cap: 7, sizeBonus: 0.12, color: '#e0c060', desc: 'Nothing in the sea is too big.' },
];
const BOATS = [
  { id: 'boat0', name: 'Little Wooden Boat', price: 0, cap: 10, speed: 1.0, desc: 'Your trusty little rowboat with a patched sail.' },
  { id: 'boat1', name: 'Coastal Skiff', price: 400, cap: 15, speed: 1.12, desc: 'A sturdy skiff with a small sail. Ready for open bays.' },
  { id: 'boat2', name: 'Harbor Runner', price: 1800, cap: 20, speed: 1.25, desc: 'A little motor boat with a cosy cabin.' },
  { id: 'boat3', name: 'Explorer', price: 6000, cap: 26, speed: 1.4, desc: 'A proper sailing explorer with a big white sail.' },
  { id: 'boat4', name: 'Deepwater Cruiser', price: 16000, cap: 32, speed: 1.55, desc: 'Steel hull, radar and plenty of room for fish.' },
  { id: 'boat5', name: 'Arctic Vessel', price: 38000, cap: 36, speed: 1.7, desc: 'An ice-capable boat with a reinforced bow.' },
  { id: 'boat6', name: 'Abyssal Voyager', price: 95000, cap: 40, speed: 1.9, desc: 'A glowing, brass-domed vessel built for the deepest trenches.' },
];

// Baits are reusable. Each one boosts species whose "bait" tags match `cat`.
const BAITS = [
  { id: 'worm', name: 'Worm Bait', cat: 'worm', price: 0, color: '#c98a8a', desc: 'Plain old reliable wriggly worms.' },
  { id: 'minnow', name: 'Minnow Bait', cat: 'minnow', price: 60, color: '#9ab8d0', desc: 'Silvery little minnows that torpedo-shaped fish love.' },
  { id: 'shiny', name: 'Shiny Lure', cat: 'shiny', price: 180, color: '#e8d870', desc: 'A glittering spoon that attracts flashy fish.' },
  { id: 'crab', name: 'Crab Chunk', cat: 'crab', price: 350, color: '#d96a54', desc: 'A smelly favorite of bottom feeders.' },
  { id: 'reef', name: 'Reef Bait', cat: 'reef', price: 600, color: '#f08aa8', desc: 'Sweet shrimp paste, irresistible to reef fish.' },
  { id: 'kelp', name: 'Kelp Paste', cat: 'kelp', price: 900, color: '#6aa86a', desc: 'Green mash for the shy fish of the kelp forest.' },
  { id: 'moon', name: 'Moonlight Mix', cat: 'moon', price: 2500, color: '#c8b8f8', desc: 'Faintly glowing. Jellies and dreamy fish drift towards it.' },
  { id: 'glow', name: 'Deep Glow Bait', cat: 'glow', price: 4500, color: '#7ad8ff', desc: 'Bioluminescent goo for deep-sea dwellers.' },
  { id: 'arctic', name: 'Arctic Bait', cat: 'arctic', price: 9000, color: '#d8f0ff', desc: 'Frozen krill. The cold-water fish adore it.' },
  { id: 'ancient', name: 'Ancient Bait', cat: 'ancient', price: 22000, color: '#e8c060', desc: 'Strange old runes glow on this lump of wax.' },
];

const BOOSTS = [
  { id: 'bites', name: 'Faster Bites', price: 150, duration: 300, desc: 'Fish bite 35% sooner.', fx: { bite: 0.35 } },
  { id: 'treasure', name: 'Treasure Luck', price: 180, duration: 300, desc: 'Treasures are 2.5x as likely to appear.', fx: { treasure: 2.5 } },
  { id: 'sale', name: 'Better Sale Prices', price: 300, duration: 300, desc: 'Sell everything for 25% more.', fx: { sale: 0.25 } },
  { id: 'rare', name: 'Rare Catch Focus', price: 260, duration: 300, desc: 'Rare-and-better fish are drawn to your line.', fx: { rare: 0.5 } },
  { id: 'rush', name: 'Fishing Rush', price: 200, duration: 120, desc: 'Bites 60% sooner and reel in 40% faster.', fx: { bite: 0.6, retrieve: 0.6, cast: 0.7 } },
  { id: 'haul', name: 'Heavy Hauls', price: 220, duration: 300, desc: 'Fish are 12% larger on average.', fx: { size: 0.12 } },
];

const CATS = { rod: RODS, line: LINES, hook: HOOKS, boat: BOATS };
const BAIT_BY_ID = Object.fromEntries(BAITS.map(b => [b.id, b]));
const BOOST_BY_ID = Object.fromEntries(BOOSTS.map(b => [b.id, b]));

function maxOwned(state, cat) { return Math.max(...state.owned[cat]); }

/** Aggregate every bonus source into one object. Single source of truth for modifiers. */
function getEffects(state) {
  const rod = RODS[state.equipped.rod], line = LINES[state.equipped.line];
  const hook = HOOKS[state.equipped.hook], boat = BOATS[state.equipped.boat];
  const bait = BAIT_BY_ID[state.equipped.bait] || BAITS[0];
  const pet = state.pets.active ? PET_BY_ID[state.pets.active] : null;
  const pb = pet ? pet.bonus : {};
  const perk = id => (state.prestige.perks[id] || 0);
  const P = Object.fromEntries(CONFIG.prestige.perks.map(p => [p.id, p]));
  const boost = id => (state.boosts[id] > 0 ? BOOST_BY_ID[id].fx : {});
  const b = { bites: boost('bites'), treasure: boost('treasure'), sale: boost('sale'), rare: boost('rare'), rush: boost('rush'), haul: boost('haul') };

  let biteMult = (1 - rod.biteRed) * (1 - (pb.bite || 0)) * (1 - perk('bite') * P.bite.per);
  biteMult *= (1 - (b.bites.bite || 0)) * (1 - (b.rush.bite || 0));
  let retrieveMult = ((rod.fx && rod.fx.retrieve) || 1) * (b.rush.retrieve ? b.rush.retrieve : 1);
  const castMult = b.rush.cast || 1;
  const junkMult = (rod.fx && rod.fx.junk) || 1;
  let treasureMult = ((rod.fx && rod.fx.treasure) || 1) * (1 + (pb.treasure || 0)) * (b.treasure.treasure || 1);
  const sizeBonus = hook.sizeBonus + ((rod.fx && rod.fx.size) || 0) + (b.haul.size || 0);
  const rareBonus = Math.min(1.2, ((rod.fx && rod.fx.rare) || 0) + (pb.rare || 0) + perk('luck') * P.luck.per + (b.rare.rare || 0));
  const saleMult = 1 + (pb.sale || 0) + state.prestige.stars * CONFIG.prestige.saleBonusPerStar
    + perk('sale') * P.sale.per + (b.sale.sale || 0);
  const cargoCap = boat.cap + (pb.cargo || 0) + perk('cargo') * P.cargo.per;
  return {
    biteMult: Math.max(0.2, biteMult), retrieveMult: Math.max(0.4, retrieveMult), castMult,
    junkMult, treasureMult, sizeBonus, rareBonus, saleMult, cargoCap,
    speed: boat.speed, maxDepth: line.maxDepth, hookCap: hook.cap, rodIdx: state.equipped.rod,
    bait, rod, line, hook, boat, pet,
  };
}

Object.assign(__ex,{RODS, LINES, HOOKS, BOATS, BAITS, BOOSTS, CATS, BAIT_BY_ID, BOOST_BY_ID, maxOwned, getEffects});
};
__mods['economy.js']=function(__ex){
// Money: earning, spending, pricing and shop purchases. All coin changes go through here.
const { CONFIG, RARITY } = __req('config.js');
const { CATS, BAIT_BY_ID, BOOST_BY_ID, BOOSTS, getEffects, maxOwned } = __req('upgrades.js');

function earn(state, n) {
  n = Math.max(0, Math.floor(n));
  if (!n) return 0;
  state.coins += n;
  state.stats.coinsEarned += n;
  state.prestige.runEarned += n;
  return n;
}

function spend(state, n) {
  n = Math.floor(n);
  if (!(n >= 0) || state.coins < n) return false;
  state.coins -= n;
  state.stats.coinsSpent += n;
  return true;
}

/** Sale value of a fish before global multipliers. */
function fishValue(sp, weight, variant) {
  const frac = sp.wMax > sp.wMin ? (weight - sp.wMin) / (sp.wMax - sp.wMin) : 0.5;
  const f = CONFIG.fishing;
  const wm = f.weightMultMin + (f.weightMultMax - f.weightMultMin) * Math.min(1, Math.max(0, frac));
  let v = sp.baseValue * wm * RARITY[sp.rarity].mult;
  if (variant) v *= f.variantMult;
  return Math.max(1, Math.round(v));
}

function saleValue(state, item) {
  return Math.max(1, Math.round(item.value * getEffects(state).saleMult));
}

function boostPrice(state, b) {
  return Math.round(b.price * (1 + 0.4 * (state.zonesUnlocked.length - 1)) / 5) * 5;
}

function tierPrice(cat, idx) { return CATS[cat][idx].price; }

/** Buy next tier of rod/line/hook/boat. Tiers are bought in order. */
function buyTier(state, cat, idx) {
  const list = CATS[cat];
  const def = list && list[idx];
  if (!def) return { ok: false, msg: 'That item does not exist.' };
  if (state.owned[cat].includes(idx)) return { ok: false, msg: 'You already own this.' };
  if (idx !== maxOwned(state, cat) + 1) return { ok: false, msg: 'Buy the previous tier first.' };
  if (!spend(state, def.price)) return { ok: false, msg: 'Not enough coins.' };
  state.owned[cat].push(idx);
  state.equipped[cat] = idx;
  return { ok: true, msg: `Bought ${def.name}!`, def };
}

function equipTier(state, cat, idx) {
  if (!CATS[cat] || !state.owned[cat].includes(idx)) return { ok: false, msg: 'You do not own that.' };
  state.equipped[cat] = idx;
  return { ok: true, msg: `Equipped ${CATS[cat][idx].name}.` };
}

function buyBait(state, id) {
  const def = BAIT_BY_ID[id];
  if (!def) return { ok: false, msg: 'Unknown bait.' };
  if (state.owned.bait.includes(id)) return { ok: false, msg: 'You already own this bait.' };
  if (!spend(state, def.price)) return { ok: false, msg: 'Not enough coins.' };
  state.owned.bait.push(id);
  state.equipped.bait = id;
  return { ok: true, msg: `Bought ${def.name}!`, def };
}

function equipBait(state, id) {
  if (!state.owned.bait.includes(id)) return { ok: false, msg: 'You do not own that bait.' };
  state.equipped.bait = id;
  return { ok: true, msg: `Equipped ${BAIT_BY_ID[id].name}.` };
}

/** Boosts: buying activates immediately. Rebuying refreshes (never extends past one full duration), so no stacking. */
function buyBoost(state, id) {
  const def = BOOST_BY_ID[id];
  if (!def) return { ok: false, msg: 'Unknown boost.' };
  if ((state.boosts[id] || 0) > def.duration * 0.5) return { ok: false, msg: 'This boost is still strong. Wait until it is half used.' };
  if (!spend(state, boostPrice(state, def))) return { ok: false, msg: 'Not enough coins.' };
  state.boosts[id] = def.duration;
  return { ok: true, msg: `${def.name} activated!`, def };
}



Object.assign(__ex,{earn, spend, fishValue, saleValue, boostPrice, tierPrice, buyTier, equipTier, buyBait, equipBait, buyBoost, BOOSTS});
};
__mods['events.js']=function(__ex){
// Tiny publish/subscribe bus used to decouple systems (game -> ui/renderer/audio).
class Bus {
  constructor() { this.map = new Map(); }
  on(evt, fn) {
    if (!this.map.has(evt)) this.map.set(evt, new Set());
    this.map.get(evt).add(fn);
    return () => this.map.get(evt).delete(fn);
  }
  emit(evt, data) {
    const set = this.map.get(evt);
    if (!set) return;
    for (const fn of [...set]) {
      try { fn(data); } catch (e) { console.error('[bus]', evt, e); }
    }
  }
  clear() { this.map.clear(); }
}

Object.assign(__ex,{Bus});
};
__mods['fish-art.js']=function(__ex){
// Procedural fish, junk, treasure and gear illustrations. Every species has its own body type,
// palette, pattern and features; animation comes from the time parameter.
const { INK, TAU, clamp, lerp, hash, hexRgb, smoothPath, organic, glow, sparkle, shade, mix, rgba } = __req('draw.js');

const SIL = '#1d2c48';
const LW = 0.026;

function ell(ctx, cx, cy, rx, ry, rot = 0) { ctx.beginPath(); ctx.ellipse(cx, cy, Math.max(0.0001, rx), Math.max(0.0001, ry), rot, 0, TAU); }
function P(ctx, fill, sil, lw = LW) {
  ctx.fillStyle = sil ? SIL : fill; ctx.fill();
  ctx.lineWidth = lw; ctx.strokeStyle = sil ? SIL : INK; ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.stroke();
}
function ribbon(ctx, pts, widths) {
  const n = pts.length, top = [], bot = [];
  for (let i = 0; i < n; i++) {
    const p = pts[i], q = pts[Math.min(i + 1, n - 1)], r = pts[Math.max(i - 1, 0)];
    const dx = q[0] - r[0], dy = q[1] - r[1], L = Math.hypot(dx, dy) || 1, nx = -dy / L, ny = dx / L;
    top.push([p[0] + nx * widths[i], p[1] + ny * widths[i]]);
    bot.push([p[0] - nx * widths[i], p[1] - ny * widths[i]]);
  }
  smoothPath(ctx, [...top, ...bot.reverse()], true);
}
function eye(ctx, x, y, r, sil, glowEye) {
  if (sil) return;
  ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fillStyle = glowEye || '#fff'; ctx.fill(); ctx.lineWidth = LW * 0.7; ctx.strokeStyle = INK; ctx.stroke();
  ctx.beginPath(); ctx.arc(x + r * 0.25, y, r * 0.55, 0, TAU); ctx.fillStyle = INK; ctx.fill();
  ctx.beginPath(); ctx.arc(x + r * 0.05, y - r * 0.3, r * 0.2, 0, TAU); ctx.fillStyle = '#fff'; ctx.fill();
}
function rotateColor(c) { const [r, g, b] = hexRgb(c); return '#' + [b, r, g].map(v => Math.round(v * 0.82 + 40).toString(16).padStart(2, '0')).join(''); }

/** Pattern layer, expects the body path to be clipped already. */
function pattern(ctx, sp, c, h, t, sil) {
  if (sil) return;
  const p = sp.pattern, seed = sp.zoneIndex * 31 + sp.order * 7;
  ctx.save();
  switch (p) {
    case 'vstripes': ctx.fillStyle = rgba(c[2], 0.75); for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.moveTo(0.3 - i * 0.14, -h); ctx.quadraticCurveTo(0.34 - i * 0.14, 0, 0.28 - i * 0.14, h); ctx.lineTo(0.22 - i * 0.14, h); ctx.quadraticCurveTo(0.27 - i * 0.14, 0, 0.24 - i * 0.14, -h); ctx.fill(); } break;
    case 'hstripe': ctx.strokeStyle = rgba(c[2], 0.85); ctx.lineWidth = h * 0.22; ctx.beginPath(); ctx.moveTo(0.5, -h * 0.02); ctx.quadraticCurveTo(0, h * 0.05, -0.4, 0); ctx.stroke(); break;
    case 'dorsal': ctx.fillStyle = rgba(c[2], 0.85); ctx.beginPath(); ctx.moveTo(0.5, -h * 0.5); for (let i = 0; i <= 8; i++) ctx.lineTo(0.5 - i * 0.11, -h * (0.12 + 0.07 * Math.sin(i * 1.9))); ctx.lineTo(-0.5, -h); ctx.closePath(); ctx.fill(); break;
    case 'spots': ctx.fillStyle = rgba(c[2], 0.8); for (let i = 0; i < 11; i++) { ctx.beginPath(); ctx.arc(0.34 - hash(seed + i) * 0.7, (hash(seed + i * 3) - 0.5) * h * 0.9, 0.012 + hash(seed + i * 5) * 0.02, 0, TAU); ctx.fill(); } break;
    case 'speckle': ctx.fillStyle = rgba(c[2], 0.55); for (let i = 0; i < 26; i++) { ctx.beginPath(); ctx.arc(0.4 - hash(seed + i) * 0.8, (hash(seed + i * 2) - 0.5) * h * 1.1, 0.007 + hash(seed + i * 4) * 0.007, 0, TAU); ctx.fill(); } break;
    case 'mottled': ctx.fillStyle = rgba(c[2], 0.4); for (let i = 0; i < 9; i++) { organic(ctx, 0.38 - hash(seed + i) * 0.76, (hash(seed + i * 3) - 0.5) * h * 0.9, 0.05 + hash(seed + i) * 0.05, 0.03 + hash(seed + i * 2) * 0.03, seed + i, 7, 0.2); ctx.fill(); } break;
    case 'bands': for (let i = 0; i < 3; i++) { const x = 0.26 - i * 0.2; ctx.fillStyle = c[1]; ctx.fillRect(x - 0.045, -h, 0.09, h * 2); ctx.fillStyle = c[2]; ctx.fillRect(x - 0.055, -h, 0.012, h * 2); ctx.fillRect(x + 0.043, -h, 0.012, h * 2); } break;
    case 'patch': for (let i = 0; i < 4; i++) { ctx.fillStyle = i % 2 ? c[1] : c[2]; organic(ctx, 0.3 - i * 0.18, (hash(seed + i) - 0.5) * h * 0.5, 0.08 + hash(seed + i) * 0.04, 0.09, seed + i, 8, 0.18); ctx.fill(); } break;
    case 'glowspots': for (let i = 0; i < 9; i++) { const x = 0.32 - i * 0.075, y = h * 0.22 + Math.sin(i) * 0.02, a = 0.55 + 0.4 * Math.sin(t * 2 + i); glow(ctx, x, y, 0.045, c[1], a); ctx.fillStyle = c[1]; ctx.beginPath(); ctx.arc(x, y, 0.011, 0, TAU); ctx.fill(); } break;
    case 'rays': ctx.strokeStyle = rgba(c[2], 0.7); ctx.lineWidth = 0.015; for (let i = 0; i < 9; i++) { const a = -1.3 + i * 0.32; ctx.beginPath(); ctx.moveTo(0.05, 0); ctx.lineTo(0.05 + Math.cos(a + Math.PI) * 0.5 * -1, Math.sin(a) * 0.5); ctx.stroke(); } break;
    case 'scales': ctx.strokeStyle = rgba(c[2], 0.35); ctx.lineWidth = 0.01; for (let r = 0; r < 4; r++) for (let i = 0; i < 8; i++) { ctx.beginPath(); ctx.arc(0.34 - i * 0.1 + (r % 2) * 0.05, -h * 0.33 + r * h * 0.22, 0.05, 0.3, 2.8); ctx.stroke(); } break;
    case 'swirl': ctx.strokeStyle = c[2]; ctx.lineWidth = 0.022; for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.moveTo(0.3 - i * 0.14, -h * 0.35); ctx.bezierCurveTo(0.34 - i * 0.14, -h * 0.1, 0.22 - i * 0.14, h * 0.1, 0.28 - i * 0.14, h * 0.35); ctx.stroke(); } break;
    case 'sheen': { const g = ctx.createLinearGradient(0, -h * 0.5, 0, h * 0.5); g.addColorStop(0, 'rgba(255,255,255,0.0)'); g.addColorStop(0.35, 'rgba(255,255,255,0.55)'); g.addColorStop(0.5, 'rgba(255,255,255,0.05)'); g.addColorStop(1, 'rgba(255,255,255,0.35)'); ctx.fillStyle = g; ctx.fillRect(-0.5, -h, 1.1, h * 2); sparkle(ctx, 0.1 + Math.sin(t) * 0.2, -h * 0.1, 0.03, '#fff', t); break; }
    case 'crown': ctx.fillStyle = c[1]; for (let i = 0; i < 6; i++) { ctx.beginPath(); ctx.arc(0.3 - i * 0.12, -h * 0.1 + (i % 2) * h * 0.18, 0.045, 0, TAU); ctx.fill(); } break;
  }
  ctx.restore();
}

// ---------- Body drawers ----------
function bodyFish(ctx, sp, c, t, sil, torp) {
  const h = sp.h, f = sp.feature, sway = Math.sin(t * 4 + sp.order) * 0.07;
  const big = sp.body === 'leviathan';
  // tail
  ctx.save(); ctx.translate(-0.36, 0); ctx.rotate(sway);
  const th = torp ? h * 0.95 : h * 0.72;
  ctx.beginPath(); ctx.moveTo(0.02, 0);
  if (torp || big) { ctx.quadraticCurveTo(-0.08, -th * 0.5, -0.2, -th); ctx.quadraticCurveTo(-0.12, 0, -0.2, th); ctx.quadraticCurveTo(-0.08, th * 0.5, 0.02, 0); }
  else { ctx.quadraticCurveTo(-0.1, -th, -0.22, -th * 0.8); ctx.quadraticCurveTo(-0.17, 0, -0.22, th * 0.8); ctx.quadraticCurveTo(-0.1, th, 0.02, 0); }
  ctx.closePath(); P(ctx, f === 'crown' ? c[1] : c[2], sil);
  if (!sil) { ctx.strokeStyle = rgba(INK, 0.35); ctx.lineWidth = 0.01; for (let i = -1; i <= 1; i++) { ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(-0.17, i * th * 0.55); ctx.stroke(); } }
  ctx.restore();
  // dorsal fin
  const dh = f === 'crest' ? h * 1.1 : h * 0.55;
  ctx.beginPath(); ctx.moveTo(0.22, -h * 0.46); ctx.quadraticCurveTo(0.05, -h * 0.46 - dh, -0.24, -h * 0.4 - (f === 'longfins' ? 0.12 : 0)); ctx.lineTo(-0.16, -h * 0.32); ctx.closePath(); P(ctx, c[2], sil);
  // anal fin
  ctx.beginPath(); ctx.moveTo(-0.02, h * 0.44); ctx.quadraticCurveTo(-0.14, h * 0.44 + h * 0.4 + (f === 'longfins' ? 0.1 : 0), -0.26, h * 0.3); ctx.lineTo(-0.14, h * 0.36); ctx.closePath(); P(ctx, c[2], sil);
  // body
  const nose = f === 'beak' ? 0.52 : 0.5;
  const bp = () => { ctx.beginPath(); ctx.moveTo(nose, 0.02);
  ctx.bezierCurveTo(0.42, -h * 0.62, 0.1, -h * 0.64, -0.18, -h * 0.4); ctx.bezierCurveTo(-0.3, -h * 0.28, -0.36, -h * 0.12, -0.38, 0);
  ctx.bezierCurveTo(-0.36, h * 0.12, -0.3, h * 0.28, -0.18, h * 0.42); ctx.bezierCurveTo(0.1, h * 0.62, 0.42, h * 0.56, nose, 0.02); ctx.closePath(); };
  bp();
  const gradFill = sil ? SIL : (() => { const g = ctx.createLinearGradient(0, -h * 0.6, 0, h * 0.6); g.addColorStop(0, c[0]); g.addColorStop(0.62, shade(c[0], 0.12)); g.addColorStop(1, c[1]); return g; })();
  ctx.fillStyle = gradFill; ctx.fill();
  ctx.save(); ctx.clip();
  if (!sil) {
    if (f === 'glass') { ctx.fillStyle = 'rgba(255,255,255,.25)'; ctx.fillRect(-0.5, -h, 1.1, h * 2); }
    pattern(ctx, sp, c, h, t, sil);
    if (f === 'moss') { ctx.fillStyle = 'rgba(70,120,50,.7)'; for (let i = 0; i < 7; i++) { organic(ctx, 0.3 - i * 0.1, -h * 0.4 + hash(i) * 0.04, 0.07, 0.05, i, 7, 0.25); ctx.fill(); } }
    if (f === 'crystal') { ctx.fillStyle = 'rgba(255,255,255,.35)'; for (let i = 0; i < 5; i++) { ctx.beginPath(); ctx.moveTo(0.3 - i * 0.14, -h * 0.5); ctx.lineTo(0.22 - i * 0.14, 0); ctx.lineTo(0.3 - i * 0.14, h * 0.5); ctx.lineTo(0.38 - i * 0.14, 0); ctx.closePath(); ctx.fill(); } }
    if (f === 'void') { ctx.fillStyle = '#fff'; for (let i = 0; i < 14; i++) { ctx.globalAlpha = 0.4 + 0.5 * Math.sin(t * 2 + i); ctx.beginPath(); ctx.arc(0.4 - hash(i) * 0.8, (hash(i * 3) - 0.5) * h, 0.008, 0, TAU); ctx.fill(); } ctx.globalAlpha = 1; }
    // belly shadow + highlight
    ctx.fillStyle = 'rgba(255,255,255,.22)'; ell(ctx, 0.12, -h * 0.28, 0.3, h * 0.13, -0.05); ctx.fill();
  }
  ctx.restore();
  bp(); ctx.lineWidth = LW; ctx.strokeStyle = sil ? SIL : INK; ctx.lineJoin = 'round'; ctx.stroke();
  if (f === 'glass' && !sil) { ctx.strokeStyle = 'rgba(80,100,120,.6)'; ctx.lineWidth = 0.012; ctx.beginPath(); ctx.moveTo(0.4, 0); ctx.lineTo(-0.3, 0); ctx.stroke(); for (let i = 0; i < 8; i++) { ctx.beginPath(); ctx.moveTo(0.3 - i * 0.08, 0); ctx.lineTo(0.28 - i * 0.08, h * 0.2); ctx.stroke(); } }
  // gill + pectoral
  if (!sil) { ctx.strokeStyle = rgba(INK, 0.45); ctx.lineWidth = 0.014; ctx.beginPath(); ctx.arc(0.24, 0, h * 0.5, 1.9, 4.4); ctx.stroke(); }
  ctx.save(); ctx.translate(0.2, h * 0.12); ctx.rotate(0.35 + Math.sin(t * 5) * 0.25);
  if (f === 'wings') {
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(-0.12, -h * 1.5, -0.36, -h * 1.2); ctx.quadraticCurveTo(-0.22, -h * 0.4, -0.04, h * 0.1); ctx.closePath();
    ctx.fillStyle = sil ? SIL : 'rgba(210,240,250,.8)'; ctx.fill(); ctx.lineWidth = LW * 0.8; ctx.strokeStyle = sil ? SIL : INK; ctx.stroke();
  } else { ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(-0.1, h * 0.35, -0.2, h * 0.28); ctx.quadraticCurveTo(-0.12, 0, 0, 0); ctx.closePath(); P(ctx, c[2], sil, LW * 0.8); }
  ctx.restore();
  // features: head decor
  if (f === 'beak') { ctx.beginPath(); ctx.moveTo(0.46, -h * 0.05); ctx.quadraticCurveTo(0.54, 0, 0.46, h * 0.12); ctx.closePath(); P(ctx, '#f8f0d0', sil, LW * 0.8); }
  if (f === 'fangs' && !sil) { ctx.fillStyle = '#fff'; for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.moveTo(0.44 - i * 0.025, h * 0.1); ctx.lineTo(0.43 - i * 0.025, h * 0.3); ctx.lineTo(0.41 - i * 0.025, h * 0.1); ctx.fill(); } }
  if (f === 'whiskers') { ctx.strokeStyle = INK; ctx.lineWidth = 0.014; for (const k of [-1, 1]) { ctx.beginPath(); ctx.moveTo(0.46, h * 0.1); ctx.quadraticCurveTo(0.56, h * 0.1 + k * 0.08, 0.62 + Math.sin(t * 3) * 0.02, h * 0.1 + k * 0.17); ctx.stroke(); } }
  if (f === 'jaw' && !sil) { ctx.strokeStyle = INK; ctx.lineWidth = 0.016; ctx.beginPath(); ctx.moveTo(0.5, 0.01); ctx.lineTo(0.3, h * 0.16); ctx.stroke(); ctx.fillStyle = '#fff'; for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.moveTo(0.46 - i * 0.04, 0.02 + i * 0.006); ctx.lineTo(0.45 - i * 0.04, 0.07 + i * 0.006); ctx.lineTo(0.43 - i * 0.04, 0.025 + i * 0.006); ctx.fill(); } }
  if (f === 'crown') { ctx.fillStyle = sil ? SIL : '#ffd870'; ctx.beginPath(); ctx.moveTo(0.16, -h * 0.58); for (let i = 0; i < 5; i++) { ctx.lineTo(0.16 - i * 0.06 - 0.02, -h * 0.95); ctx.lineTo(0.16 - i * 0.06 - 0.05, -h * 0.58); } ctx.fill(); ctx.stroke(); glow(ctx, 0.04, -h * 0.8, 0.12, '#ffd870', 0.4); }
  if (f === 'pearl' && !sil) { glow(ctx, 0.05, 0, 0.18, '#fff3c8', 0.8); ctx.beginPath(); ctx.arc(0.05, 0, 0.07, 0, TAU); ctx.fillStyle = '#fffbe8'; ctx.fill(); ctx.lineWidth = LW * 0.7; ctx.stroke(); }
  if (f === 'jewel' && !sil) for (let i = 0; i < 3; i++) sparkle(ctx, 0.25 - i * 0.18 + Math.sin(t * 2 + i) * 0.02, -h * 0.2 + i * 0.03, 0.035, '#fff', t + i);
  if (big) {
    ctx.fillStyle = sil ? SIL : c[2];
    for (let i = 0; i < 7; i++) { ctx.beginPath(); ctx.moveTo(0.3 - i * 0.1, -h * 0.58); ctx.lineTo(0.26 - i * 0.1, -h * 0.58 - 0.09 - hash(i) * 0.05); ctx.lineTo(0.2 - i * 0.1, -h * 0.55); ctx.closePath(); ctx.fill(); ctx.stroke(); }
  }
  // eye
  const ey = f === 'moss' ? -h * 0.1 : -h * 0.12;
  eye(ctx, 0.33, ey, h * (big ? 0.12 : 0.2), sil, big || f === 'void' ? '#ffe08a' : null);
}

function bodyRound(ctx, sp, c, t, sil) {
  const h = sp.h, sway = Math.sin(t * 5 + sp.order) * 0.08;
  ctx.save(); ctx.translate(-0.34, 0); ctx.rotate(sway); ctx.beginPath(); ctx.moveTo(0.04, 0); ctx.quadraticCurveTo(-0.1, -h * 0.4, -0.16, -h * 0.34); ctx.quadraticCurveTo(-0.12, 0, -0.16, h * 0.34); ctx.quadraticCurveTo(-0.1, h * 0.4, 0.04, 0); ctx.closePath(); P(ctx, c[1], sil); ctx.restore();
  // long dorsal & anal fins
  ctx.beginPath(); ctx.moveTo(0.28, -h * 0.4); ctx.quadraticCurveTo(0.05, -h * 0.95 - Math.sin(t * 4) * 0.01, -0.3, -h * 0.25); ctx.lineTo(-0.2, -h * 0.3); ctx.closePath(); P(ctx, c[2], sil);
  ctx.beginPath(); ctx.moveTo(0.22, h * 0.42); ctx.quadraticCurveTo(0, h * 0.95, -0.3, h * 0.25); ctx.lineTo(-0.18, h * 0.3); ctx.closePath(); P(ctx, c[2], sil);
  // body disc with snout
  const bp = () => { ctx.beginPath(); ctx.moveTo(0.52, 0.02);
  ctx.bezierCurveTo(0.42, -h * 0.12, 0.38, -h * 0.5, 0.1, -h * 0.5); ctx.bezierCurveTo(-0.2, -h * 0.5, -0.38, -h * 0.25, -0.38, 0);
  ctx.bezierCurveTo(-0.38, h * 0.25, -0.2, h * 0.5, 0.1, h * 0.5); ctx.bezierCurveTo(0.38, h * 0.5, 0.42, h * 0.14, 0.52, 0.02); ctx.closePath(); };
  bp();
  const fill = sil ? SIL : (() => { const g = ctx.createRadialGradient(0.05, -h * 0.2, 0.02, 0, 0, 0.42); g.addColorStop(0, shade(c[0], 0.2)); g.addColorStop(1, c[0]); return g; })();
  ctx.fillStyle = fill; ctx.fill();
  ctx.save(); ctx.clip(); pattern(ctx, sp, c, h, t, sil);
  if (!sil && sp.pattern === 'belly') { ctx.fillStyle = c[1]; ell(ctx, 0.0, h * 0.5, 0.45, h * 0.3); ctx.fill(); }
  if (!sil && sp.pattern === 'vstripes') { ctx.fillStyle = c[1]; ctx.fillRect(0.28, -h, 0.05, h * 2); }
  ctx.restore();
  bp(); ctx.lineWidth = LW; ctx.strokeStyle = sil ? SIL : INK; ctx.stroke();
  ctx.save(); ctx.translate(0.14, h * 0.1); ctx.rotate(0.3 + Math.sin(t * 5) * 0.25); ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(-0.08, h * 0.3, -0.18, h * 0.24); ctx.quadraticCurveTo(-0.1, 0, 0, 0); P(ctx, c[2], sil, LW * 0.8); ctx.restore();
  eye(ctx, 0.3, -h * 0.1, h * 0.13, sil);
}

function bodyEel(ctx, sp, c, t, sil) {
  const n = 22, amp = 0.07, pts = [], ws = [], f = sp.feature;
  const th = Math.max(0.03, sp.h * 0.5);
  for (let i = 0; i < n; i++) {
    const u = i / (n - 1), x = 0.48 - u * 0.96;
    pts.push([x, Math.sin(u * 7 - t * 3.2) * amp * (0.3 + u)]);
    ws.push(th * (u < 0.12 ? 0.55 + u * 3.5 : 1) * (1 - Math.pow(u, 2.6) * 0.92));
  }
  // dorsal fin line
  ctx.strokeStyle = sil ? SIL : c[2]; ctx.lineWidth = th * 0.7; ctx.beginPath(); pts.forEach((p, i) => { const q = [p[0], p[1] - ws[i] * 1.2]; i ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1]); }); ctx.stroke();
  const bp = () => ribbon(ctx, pts, ws);
  bp();
  const fill = sil ? SIL : (() => { const g = ctx.createLinearGradient(0, -th, 0, th); g.addColorStop(0, c[0]); g.addColorStop(1, c[1]); return g; })();
  ctx.fillStyle = fill; ctx.fill();
  ctx.save(); ctx.clip();
  if (!sil) {
    const seed = sp.order * 13;
    if (sp.pattern === 'spots') { ctx.fillStyle = rgba(c[2], 0.85); pts.forEach((p, i) => { if (i % 2 === 0) { ctx.beginPath(); ctx.arc(p[0], p[1] + (hash(seed + i) - 0.5) * ws[i], ws[i] * 0.3, 0, TAU); ctx.fill(); } }); }
    else if (sp.pattern === 'glowspots') pts.forEach((p, i) => { if (i % 2 === 1) { glow(ctx, p[0], p[1] + ws[i] * 0.3, 0.04, c[1], 0.5 + 0.4 * Math.sin(t * 2 + i)); ctx.fillStyle = c[1]; ctx.beginPath(); ctx.arc(p[0], p[1] + ws[i] * 0.3, 0.008, 0, TAU); ctx.fill(); } });
    else if (sp.pattern === 'sheen') { ctx.fillStyle = 'rgba(255,255,255,.45)'; pts.forEach((p, i) => { ctx.fillRect(p[0] - 0.01, p[1] - ws[i], 0.02, ws[i] * 0.8); }); }
    if (f === 'glass') { ctx.fillStyle = 'rgba(255,255,255,.35)'; ctx.fillRect(-0.5, -0.2, 1, 0.4); }
  }
  ctx.restore();
  bp(); ctx.lineWidth = LW; ctx.strokeStyle = sil ? SIL : INK; ctx.stroke();
  const hx = pts[0][0], hy = pts[0][1];
  if (f === 'jaw' || f === 'pelican') {
    const open = f === 'pelican' ? 0.1 : 0.04;
    ctx.beginPath(); ctx.moveTo(hx + 0.01, hy); ctx.lineTo(hx + 0.07, hy - open); ctx.lineTo(hx + 0.07, hy + open + 0.03); ctx.closePath(); P(ctx, sil ? SIL : '#3a1a2a', sil, LW * 0.8);
    if (!sil) { ctx.fillStyle = '#fff'; for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.moveTo(hx + 0.02 + i * 0.015, hy - 0.005); ctx.lineTo(hx + 0.03 + i * 0.015, hy + 0.025); ctx.lineTo(hx + 0.04 + i * 0.015, hy - 0.005); ctx.fill(); } }
  }
  eye(ctx, hx - 0.03, hy - th * 0.35, Math.max(0.014, th * 0.35), sil);
}

function bodySlim(ctx, sp, c, t, sil) {
  const n = 14, pts = [], ws = [], th = Math.max(0.035, sp.h * 0.7), pipe = sp.id === 'pipefish';
  for (let i = 0; i < n; i++) { const u = i / (n - 1); pts.push([0.46 - u * 0.86, Math.sin(u * 5 - t * 3) * 0.015 * u]); ws.push(th * (u < 0.15 ? (pipe ? 0.35 : 0.8 + u * 1.3) : 1) * (1 - Math.pow(u, 2) * 0.55)); }
  ctx.save(); ctx.translate(-0.4, pts[n - 1][1]); ctx.rotate(Math.sin(t * 5) * 0.1);
  ctx.beginPath(); ctx.moveTo(0.03, 0); ctx.quadraticCurveTo(-0.08, -th * 1.3, -0.14, -th * 0.9); ctx.quadraticCurveTo(-0.1, 0, -0.14, th * 0.9); ctx.quadraticCurveTo(-0.08, th * 1.3, 0.03, 0); ctx.closePath(); P(ctx, sp.colors[2], sil); ctx.restore();
  const bp = () => ribbon(ctx, pts, ws); bp(); ctx.fillStyle = sil ? SIL : sp.colors[0]; ctx.fill();
  ctx.save(); ctx.clip();
  if (!sil) {
    if (sp.pattern === 'bands') { ctx.fillStyle = sp.colors[1]; for (let i = 0; i < 7; i++) ctx.fillRect(0.3 - i * 0.11, -th * 1.2, 0.04, th * 2.4); }
    else if (sp.pattern === 'hstripe') { ctx.fillStyle = sp.colors[2]; ctx.fillRect(-0.4, -th * 0.15, 0.9, th * 0.3); }
    else if (sp.pattern === 'spots') { ctx.fillStyle = rgba(sp.colors[2], 0.8); for (let i = 0; i < 9; i++) { ctx.beginPath(); ctx.arc(0.3 - i * 0.08, (hash(i) - 0.5) * th, th * 0.18, 0, TAU); ctx.fill(); } }
    ctx.fillStyle = 'rgba(255,255,255,.25)'; ctx.fillRect(-0.5, -th, 1, th * 0.5);
  }
  ctx.restore();
  bp(); ctx.lineWidth = LW; ctx.strokeStyle = sil ? SIL : INK; ctx.stroke();
  if (sp.feature === 'longfins') { ctx.strokeStyle = sil ? SIL : sp.colors[2]; ctx.lineWidth = 0.02; ctx.beginPath(); ctx.moveTo(0.3, -th); ctx.quadraticCurveTo(0, -th * 3.5, -0.3, -th); ctx.stroke(); }
  if (pipe) { ctx.beginPath(); ctx.arc(0.52, 0, 0.012, 0, TAU); }
  eye(ctx, 0.36, -th * 0.2, th * 0.28, sil);
}

function bodyFlat(ctx, sp, c, t, sil) {
  const h = sp.h * 0.7;
  ctx.save(); ctx.translate(-0.4, 0); ctx.rotate(Math.sin(t * 4) * 0.06); ctx.beginPath(); ctx.moveTo(0.04, 0); ctx.quadraticCurveTo(-0.08, -h * 0.5, -0.14, -h * 0.4); ctx.quadraticCurveTo(-0.1, 0, -0.14, h * 0.4); ctx.quadraticCurveTo(-0.08, h * 0.5, 0.04, 0); P(ctx, c[2], sil); ctx.restore();
  // frilled fins
  ctx.strokeStyle = sil ? SIL : c[2]; ctx.lineWidth = h * 0.18;
  for (const s of [-1, 1]) { ctx.beginPath(); for (let i = 0; i <= 14; i++) { const x = 0.36 - i * 0.052, y = s * (h * 0.62 + Math.sin(i * 2 + t * 6 * s) * h * 0.04) * Math.sqrt(Math.max(0.15, 1 - Math.pow(x / 0.5, 2))); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); } ctx.stroke(); }
  const bp = () => organic(ctx, 0, 0, 0.44, h * 0.6, sp.order + 2, 12, 0.03);
  bp();
  ctx.fillStyle = sil ? SIL : c[0]; ctx.fill();
  ctx.save(); ctx.clip(); if (!sil) pattern(ctx, sp, c, h, t, sil); ctx.restore();
  bp(); ctx.lineWidth = LW; ctx.strokeStyle = sil ? SIL : INK; ctx.stroke();
  eye(ctx, 0.34, -h * 0.22, h * 0.13, sil); eye(ctx, 0.27, -h * 0.34, h * 0.11, sil);
}

function bodyRay(ctx, sp, c, t, sil) {
  const flap = 1 + Math.sin(t * 2.6 + sp.order) * 0.16;
  const w = sp.h * 0.62 * flap;
  ctx.strokeStyle = sil ? SIL : INK; ctx.lineWidth = LW * 1.6; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(-0.26, 0); ctx.quadraticCurveTo(-0.42, Math.sin(t * 3) * 0.04, -0.6, Math.sin(t * 3 + 1) * 0.07); ctx.stroke();
  ctx.strokeStyle = sil ? SIL : c[2]; ctx.lineWidth = LW * 0.8; ctx.stroke();
  const bp = () => {
    ctx.beginPath(); ctx.moveTo(0.5, 0);
    ctx.bezierCurveTo(0.36, -w * 0.5, 0.18, -w * 1.1, -0.06, -w * 1.2); ctx.bezierCurveTo(-0.2, -w * 1.0, -0.3, -w * 0.4, -0.3, 0);
    ctx.bezierCurveTo(-0.3, w * 0.4, -0.2, w * 1.0, -0.06, w * 1.2); ctx.bezierCurveTo(0.18, w * 1.1, 0.36, w * 0.5, 0.5, 0); ctx.closePath();
  };
  bp();
  const fill = sil ? SIL : (() => { const g = ctx.createRadialGradient(0.12, 0, 0.02, 0.05, 0, 0.5); g.addColorStop(0, shade(c[0], 0.22)); g.addColorStop(0.75, c[0]); g.addColorStop(1, shade(c[0], -0.1)); return g; })();
  ctx.fillStyle = fill; ctx.fill();
  ctx.save(); ctx.clip();
  if (!sil) {
    if (sp.pattern === 'spots') { ctx.fillStyle = rgba(c[2], 0.65); for (let i = 0; i < 12; i++) { ctx.beginPath(); ctx.arc(0.3 - hash(i + sp.order) * 0.55, (hash(i * 3) - 0.5) * w * 1.8, 0.014 + hash(i) * 0.014, 0, TAU); ctx.fill(); } }
    else if (sp.pattern === 'glowspots') for (let i = 0; i < 10; i++) { const x = 0.3 - hash(i + sp.order) * 0.5, y = (hash(i * 3) - 0.5) * w * 1.7; glow(ctx, x, y, 0.05, c[1], 0.4 + 0.4 * Math.sin(t * 2 + i)); ctx.fillStyle = c[1]; ctx.beginPath(); ctx.arc(x, y, 0.01, 0, TAU); ctx.fill(); }
    bp(); ctx.lineWidth = 0.06; ctx.strokeStyle = rgba(c[1], 0.55); ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,.18)'; ell(ctx, 0.1, -w * 0.4, 0.22, w * 0.3); ctx.fill();
  }
  ctx.restore();
  bp(); ctx.lineWidth = LW; ctx.strokeStyle = sil ? SIL : INK; ctx.stroke();
  eye(ctx, 0.34, -w * 0.2, 0.03, sil); eye(ctx, 0.34, w * 0.2, 0.03, sil);
}

function bodyShark(ctx, sp, c, t, sil) {
  const h = sp.h, sway = Math.sin(t * 3 + sp.order) * 0.08;
  ctx.save(); ctx.translate(-0.36, 0); ctx.rotate(sway);
  ctx.beginPath(); ctx.moveTo(0.04, 0); ctx.quadraticCurveTo(-0.08, -h * 0.5, -0.2, -h * 1.5); ctx.quadraticCurveTo(-0.14, -h * 0.4, -0.18, -h * 0.1); ctx.quadraticCurveTo(-0.14, h * 0.4, -0.12, h * 0.8); ctx.quadraticCurveTo(-0.05, h * 0.4, 0.04, 0); ctx.closePath(); P(ctx, c[0], sil); ctx.restore();
  ctx.beginPath(); ctx.moveTo(0.14, -h * 0.5); ctx.quadraticCurveTo(0.02, -h * 1.9, -0.14, -h * 0.4); ctx.closePath(); P(ctx, c[0], sil);
  ctx.beginPath(); ctx.moveTo(0.08, h * 0.45); ctx.quadraticCurveTo(-0.08, h * 1.5, -0.2, h * 0.8); ctx.lineTo(-0.06, h * 0.4); ctx.closePath(); P(ctx, c[0], sil);
  const bp = () => { ctx.beginPath(); ctx.moveTo(0.52, 0.02); ctx.bezierCurveTo(0.42, -h * 0.55, 0.1, -h * 0.65, -0.16, -h * 0.42); ctx.bezierCurveTo(-0.28, -h * 0.28, -0.36, -h * 0.1, -0.38, 0); ctx.bezierCurveTo(-0.36, h * 0.1, -0.28, h * 0.28, -0.16, h * 0.42); ctx.bezierCurveTo(0.1, h * 0.62, 0.4, h * 0.5, 0.52, 0.04); ctx.closePath(); };
  bp();
  const fill = sil ? SIL : (() => { const g = ctx.createLinearGradient(0, -h * 0.6, 0, h * 0.6); g.addColorStop(0, c[0]); g.addColorStop(0.55, shade(c[0], 0.1)); g.addColorStop(0.62, c[1]); g.addColorStop(1, c[1]); return g; })();
  ctx.fillStyle = fill; ctx.fill(); ctx.save(); ctx.clip(); pattern(ctx, sp, c, h, t, sil); ctx.restore();
  bp(); ctx.lineWidth = LW; ctx.strokeStyle = sil ? SIL : INK; ctx.stroke();
  if (!sil) { ctx.strokeStyle = rgba(INK, 0.5); ctx.lineWidth = 0.013; for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.moveTo(0.22 - i * 0.03, -h * 0.2); ctx.quadraticCurveTo(0.2 - i * 0.03, 0, 0.22 - i * 0.03, h * 0.2); ctx.stroke(); } ctx.beginPath(); ctx.moveTo(0.5, h * 0.12); ctx.quadraticCurveTo(0.38, h * 0.24, 0.3, h * 0.14); ctx.stroke(); }
  ctx.beginPath(); ctx.moveTo(0.1, h * 0.2); ctx.quadraticCurveTo(0.0, h * 1.0, -0.1, h * 0.8); ctx.lineTo(0.0, h * 0.25); ctx.closePath(); P(ctx, c[0], sil, LW * 0.8);
  eye(ctx, 0.4, -h * 0.1, h * 0.1, sil);
}

function bodyJelly(ctx, sp, c, t, sil) {
  const pulse = Math.sin(t * 2.2 + sp.order) * 0.07, aur = sp.feature === 'aurora';
  ctx.save(); ctx.translate(0, -0.05 + Math.sin(t * 1.3) * 0.015);
  for (let i = 0; i < 7; i++) {
    const x = -0.24 + i * 0.08; ctx.beginPath(); ctx.moveTo(x, 0.12);
    for (let k = 1; k <= 6; k++) ctx.lineTo(x + Math.sin(t * 2.4 + i + k * 0.9) * 0.025, 0.12 + k * 0.06 * (1 + (i % 3) * 0.2));
    ctx.lineWidth = 0.022; ctx.strokeStyle = sil ? SIL : rgba(c[0], 0.7); ctx.lineCap = 'round'; ctx.stroke();
  }
  ctx.lineWidth = 0.03; ctx.strokeStyle = sil ? SIL : rgba(c[2], 0.5);
  for (let i = 0; i < 3; i++) { const x = -0.12 + i * 0.12; ctx.beginPath(); ctx.moveTo(x, 0.1); ctx.bezierCurveTo(x + Math.sin(t * 2 + i) * 0.06, 0.25, x - Math.sin(t * 2 + i) * 0.06, 0.35, x, 0.5); ctx.stroke(); }
  ctx.beginPath(); ctx.moveTo(-0.34, 0.1); ctx.bezierCurveTo(-0.38, -0.34 * (1 + pulse), 0.38, -0.34 * (1 + pulse), 0.34, 0.1);
  ctx.quadraticCurveTo(0.2, 0.17, 0.12, 0.11); ctx.quadraticCurveTo(0, 0.18, -0.12, 0.11); ctx.quadraticCurveTo(-0.2, 0.17, -0.34, 0.1); ctx.closePath();
  const fill = sil ? SIL : (() => { const g = ctx.createRadialGradient(0, -0.1, 0.02, 0, 0, 0.4); g.addColorStop(0, rgba(c[1], 0.95)); g.addColorStop(1, rgba(aur ? c[2] : c[0], 0.8)); return g; })();
  ctx.fillStyle = fill; ctx.fill(); ctx.lineWidth = LW; ctx.strokeStyle = sil ? SIL : rgba(c[2], 0.9); ctx.stroke();
  if (!sil) {
    ctx.save(); ctx.clip();
    if (aur) { for (let i = 0; i < 4; i++) { ctx.fillStyle = rgba(['#7af0c8', '#c8a8ff', '#7ac8ff', '#ff9ad0'][i], 0.35); ctx.beginPath(); ctx.moveTo(-0.34, -0.1 + i * 0.05); ctx.quadraticCurveTo(0, -0.3 + Math.sin(t * 2 + i) * 0.08 + i * 0.05, 0.34, -0.1 + i * 0.05); ctx.lineTo(0.34, 0.3); ctx.lineTo(-0.34, 0.3); ctx.fill(); } }
    ctx.restore();
    ctx.strokeStyle = 'rgba(255,255,255,.7)'; ctx.lineWidth = 0.02; ctx.beginPath(); ctx.arc(0, -0.04, 0.24, 3.6, 4.5); ctx.stroke();
    ctx.fillStyle = rgba(c[2], 0.5); for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.arc(Math.cos(i * 1.57 + 0.5) * 0.08, -0.08 + Math.sin(i * 1.57 + 0.5) * 0.06, 0.03, 0, TAU); ctx.fill(); }
    if (sp.pattern === 'glowspots') for (let i = 0; i < 6; i++) glow(ctx, -0.25 + i * 0.1, 0.07, 0.035, c[1], 0.8);
  }
  ctx.restore();
}

function bodySquid(ctx, sp, c, t, sil) {
  const f = sp.feature, glass = f === 'glass', sw = Math.sin(t * 3 + sp.order);
  // tentacles to the right
  for (let i = 0; i < 8; i++) {
    const y0 = (i - 3.5) * 0.02, len = (i === 2 || i === 5 ? 0.36 : 0.26);
    ctx.beginPath(); ctx.moveTo(0.12, y0);
    for (let k = 1; k <= 6; k++) ctx.lineTo(0.12 + len * k / 6, y0 + Math.sin(t * 4 + i + k * 0.8) * 0.02 * k * 0.5 + (i - 3.5) * 0.012 * k * 0.4);
    ctx.lineWidth = 0.022; ctx.strokeStyle = sil ? SIL : rgba(c[0], glass ? 0.8 : 1); ctx.lineCap = 'round'; ctx.stroke();
  }
  // fins
  ctx.save(); ctx.translate(-0.4, 0); ctx.rotate(sw * 0.05); ctx.beginPath(); ctx.moveTo(0.14, 0); ctx.quadraticCurveTo(-0.08, -0.22, -0.12, -0.06); ctx.quadraticCurveTo(-0.14, 0, -0.12, 0.06); ctx.quadraticCurveTo(-0.08, 0.22, 0.14, 0); ctx.closePath(); P(ctx, rgba(c[1], glass ? 0.6 : 1), sil); ctx.restore();
  // mantle
  const bp = () => { ctx.beginPath(); ctx.moveTo(-0.46, 0); ctx.bezierCurveTo(-0.3, -0.18, 0, -0.17, 0.14, -0.09); ctx.quadraticCurveTo(0.2, 0, 0.14, 0.09); ctx.bezierCurveTo(0, 0.17, -0.3, 0.18, -0.46, 0); ctx.closePath(); };
  bp();
  const fill = sil ? SIL : (() => { const g = ctx.createLinearGradient(0, -0.18, 0, 0.18); g.addColorStop(0, rgba(c[0], glass ? 0.7 : 1)); g.addColorStop(1, rgba(c[1], glass ? 0.7 : 1)); return g; })();
  ctx.fillStyle = fill; ctx.fill(); ctx.save(); ctx.clip();
  if (!sil) {
    if (sp.pattern === 'spots') { ctx.fillStyle = rgba(c[2], 0.6); for (let i = 0; i < 14; i++) { ctx.beginPath(); ctx.arc(-0.4 + hash(i + sp.order) * 0.5, (hash(i * 3) - 0.5) * 0.28, 0.012 + hash(i) * 0.012, 0, TAU); ctx.fill(); } }
    if (sp.pattern === 'glowspots') for (let i = 0; i < 7; i++) { const x = -0.38 + i * 0.07; glow(ctx, x, 0.05 + Math.sin(i) * 0.03, 0.045, c[1], 0.5 + 0.4 * Math.sin(t * 2 + i)); ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(x, 0.05 + Math.sin(i) * 0.03, 0.01, 0, TAU); ctx.fill(); }
  }
  ctx.restore(); bp(); ctx.lineWidth = LW; ctx.strokeStyle = sil ? SIL : INK; ctx.stroke();
  ctx.beginPath(); ctx.arc(0.13, 0, 0.09, 0, TAU); P(ctx, rgba(c[0], glass ? 0.8 : 1), sil);
  eye(ctx, 0.15, -0.025, 0.04, sil); eye(ctx, 0.15, 0.04, 0.034, sil);
}

function bodyOctopus(ctx, sp, c, t, sil) {
  for (let i = 0; i < 8; i++) {
    const a0 = Math.PI * (0.18 + i * 0.09), sx = -0.22 + i * 0.062;
    const pts = []; for (let k = 0; k < 8; k++) { const u = k / 7; pts.push([sx + Math.sin(t * 2.2 + i + u * 5) * 0.045 * u + (i - 3.5) * 0.045 * u, 0.04 + u * 0.38 + Math.cos(a0) * 0.0]); }
    ctx.beginPath(); pts.forEach((p, k) => (k ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])));
    ctx.lineCap = 'round'; ctx.lineWidth = 0.07; ctx.strokeStyle = sil ? SIL : INK; ctx.stroke(); ctx.lineWidth = 0.05; ctx.strokeStyle = sil ? SIL : c[0]; ctx.stroke();
    if (!sil) { ctx.fillStyle = c[1]; for (let k = 2; k < 7; k += 2) { ctx.beginPath(); ctx.arc(pts[k][0], pts[k][1], 0.008, 0, TAU); ctx.fill(); } }
  }
  const bp = () => { ctx.beginPath(); ctx.moveTo(-0.26, 0.08); ctx.bezierCurveTo(-0.3, -0.34, 0.3, -0.34, 0.26, 0.08); ctx.quadraticCurveTo(0, 0.14, -0.26, 0.08); ctx.closePath(); };
  bp();
  const fill = sil ? SIL : (() => { const g = ctx.createRadialGradient(-0.05, -0.12, 0.02, 0, 0, 0.35); g.addColorStop(0, shade(c[0], 0.2)); g.addColorStop(1, c[0]); return g; })();
  ctx.fillStyle = fill; ctx.fill(); ctx.save(); ctx.clip();
  if (!sil) { ctx.fillStyle = rgba(c[2], 0.5); for (let i = 0; i < 12; i++) { ctx.beginPath(); ctx.arc((hash(i + 3) - 0.5) * 0.5, -0.2 + hash(i * 3) * 0.28, 0.012 + hash(i) * 0.014, 0, TAU); ctx.fill(); } }
  ctx.restore(); bp(); ctx.lineWidth = LW; ctx.strokeStyle = sil ? SIL : INK; ctx.stroke();
  eye(ctx, 0.1, -0.02, 0.05, sil); eye(ctx, -0.1, -0.02, 0.05, sil);
}

function bodyCrab(ctx, sp, c, t, sil) {
  const sc = Math.sin(t * 6) * 0.015;
  ctx.lineCap = 'round';
  for (const s of [-1, 1]) {
    for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.moveTo(s * 0.18, 0.06 + i * 0.03); ctx.lineTo(s * (0.34 + i * 0.03), 0.1 + i * 0.04 + sc * s); ctx.lineTo(s * (0.38 + i * 0.03), 0.22 + i * 0.03); ctx.lineWidth = 0.034; ctx.strokeStyle = sil ? SIL : INK; ctx.stroke(); ctx.lineWidth = 0.02; ctx.strokeStyle = sil ? SIL : c[0]; ctx.stroke(); }
    ctx.beginPath(); ctx.moveTo(s * 0.2, -0.05); ctx.lineTo(s * 0.34, -0.17 + Math.sin(t * 3 + s) * 0.02); ctx.lineWidth = 0.04; ctx.strokeStyle = sil ? SIL : INK; ctx.stroke(); ctx.lineWidth = 0.026; ctx.strokeStyle = sil ? SIL : c[0]; ctx.stroke();
    ctx.save(); ctx.translate(s * 0.38, -0.23 + Math.sin(t * 3 + s) * 0.02); ctx.rotate(s * -0.3); ctx.beginPath(); ctx.moveTo(0, 0.07); ctx.bezierCurveTo(-0.1, -0.02, -0.06, -0.12, 0, -0.1); ctx.bezierCurveTo(0.06, -0.12, 0.1, -0.02, 0, 0.07); P(ctx, c[0], sil); ctx.beginPath(); ctx.moveTo(0, -0.1); ctx.lineTo(0, 0.0); ctx.strokeStyle = sil ? SIL : INK; ctx.lineWidth = 0.014; ctx.stroke(); ctx.restore();
  }
  const bp = () => { ctx.beginPath(); ctx.ellipse(0, 0.02, 0.26, 0.17, 0, 0, TAU); };
  bp();
  const fill = sil ? SIL : (() => { const g = ctx.createRadialGradient(-0.05, -0.06, 0.02, 0, 0, 0.3); g.addColorStop(0, c[1]); g.addColorStop(1, c[0]); return g; })();
  ctx.fillStyle = fill; ctx.fill(); ctx.save(); ctx.clip();
  if (!sil) { ctx.fillStyle = rgba(c[2], 0.6); for (let i = 0; i < 9; i++) { ctx.beginPath(); ctx.arc((hash(i + 2) - 0.5) * 0.4, (hash(i * 4) - 0.4) * 0.22, 0.015 + hash(i) * 0.012, 0, TAU); ctx.fill(); } }
  ctx.restore(); bp(); ctx.lineWidth = LW; ctx.strokeStyle = sil ? SIL : INK; ctx.stroke();
  for (const s of [-1, 1]) { ctx.beginPath(); ctx.moveTo(s * 0.07, -0.12); ctx.lineTo(s * 0.08, -0.19); ctx.lineWidth = 0.016; ctx.strokeStyle = sil ? SIL : INK; ctx.stroke(); eye(ctx, s * 0.08, -0.2, 0.026, sil); }
}

function bodyStar(ctx, sp, c, t, sil) {
  ctx.save(); ctx.rotate(Math.sin(t * 0.8) * 0.12);
  const pts = []; for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + (i / 10) * TAU, r = i % 2 ? 0.17 : 0.44 * (1 + Math.sin(t * 1.5 + i) * 0.03); pts.push([Math.cos(a) * r, Math.sin(a) * r]); }
  const bp = () => smoothPath(ctx, pts, true);
  bp();
  const fill = sil ? SIL : (() => { const g = ctx.createRadialGradient(0, 0, 0.02, 0, 0, 0.45); g.addColorStop(0, c[1]); g.addColorStop(1, c[0]); return g; })();
  ctx.fillStyle = fill; ctx.fill(); ctx.save(); ctx.clip();
  if (!sil) {
    if (sp.pattern === 'glowspots') for (let i = 0; i < 5; i++) { const a = -Math.PI / 2 + (i / 5) * TAU; for (let k = 1; k <= 3; k++) { const x = Math.cos(a) * k * 0.11, y = Math.sin(a) * k * 0.11; glow(ctx, x, y, 0.05, '#bfe8ff', 0.5 + 0.4 * Math.sin(t * 2 + i + k)); ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(x, y, 0.01, 0, TAU); ctx.fill(); } }
    else { ctx.fillStyle = rgba(c[2], 0.85); for (let i = 0; i < 5; i++) { const a = -Math.PI / 2 + (i / 5) * TAU; for (let k = 1; k <= 3; k++) { ctx.beginPath(); ctx.arc(Math.cos(a) * k * 0.11, Math.sin(a) * k * 0.11, 0.018 - k * 0.002, 0, TAU); ctx.fill(); } } }
  }
  ctx.restore(); bp(); ctx.lineWidth = LW; ctx.strokeStyle = sil ? SIL : INK; ctx.stroke();
  ctx.restore();
}

function bodySeahorse(ctx, sp, c, t, sil) {
  const sw = Math.sin(t * 1.6) * 0.02;
  const pts = [[0.12, -0.36], [0.03, -0.27], [-0.03, -0.12], [-0.05 + sw, 0.04], [-0.02, 0.18], [0.07, 0.3], [0.17, 0.33], [0.2, 0.26], [0.14, 0.22]];
  const ws = [0.055, 0.075, 0.1, 0.1, 0.075, 0.05, 0.035, 0.025, 0.015];
  // dorsal fin fan
  ctx.beginPath(); ctx.moveTo(-0.05, -0.15); ctx.quadraticCurveTo(-0.22 + Math.sin(t * 8) * 0.02, -0.08, -0.08, 0.05); P(ctx, rgba(c[1], 0.85), sil, LW * 0.8);
  const bp = () => ribbon(ctx, pts, ws); bp(); ctx.fillStyle = sil ? SIL : c[0]; ctx.fill(); ctx.save(); ctx.clip();
  if (!sil) { ctx.strokeStyle = rgba(c[2], 0.6); ctx.lineWidth = 0.018; for (let i = 1; i < 7; i++) { ctx.beginPath(); ctx.moveTo(pts[i][0] - 0.1, pts[i][1]); ctx.lineTo(pts[i][0] + 0.1, pts[i][1] + 0.02); ctx.stroke(); } ctx.fillStyle = c[1]; ell(ctx, 0.02, -0.02, 0.05, 0.12); ctx.fill(); }
  ctx.restore(); bp(); ctx.lineWidth = LW; ctx.strokeStyle = sil ? SIL : INK; ctx.stroke();
  ctx.beginPath(); ctx.ellipse(0.2, -0.35, 0.07, 0.022, 0.15, 0, TAU); P(ctx, c[0], sil);
  eye(ctx, 0.1, -0.38, 0.022, sil);
  ctx.beginPath(); ctx.moveTo(0.06, -0.42); ctx.lineTo(0.04, -0.47); ctx.lineTo(0.1, -0.44); ctx.lineTo(0.12, -0.48); ctx.lineWidth = 0.02; ctx.strokeStyle = sil ? SIL : c[2]; ctx.stroke();
}

function bodyPuffer(ctx, sp, c, t, sil) {
  ctx.save(); ctx.translate(-0.28, 0); ctx.rotate(Math.sin(t * 6) * 0.15); ctx.beginPath(); ctx.moveTo(0.06, 0); ctx.quadraticCurveTo(-0.04, -0.14, -0.12, -0.09); ctx.quadraticCurveTo(-0.08, 0, -0.12, 0.09); ctx.quadraticCurveTo(-0.04, 0.14, 0.06, 0); P(ctx, c[2], sil); ctx.restore();
  const bp = () => organic(ctx, 0.04, 0, 0.34, 0.3, sp.order + 5, 11, 0.025);
  bp();
  const fill = sil ? SIL : (() => { const g = ctx.createRadialGradient(0.0, -0.1, 0.02, 0.04, 0, 0.36); g.addColorStop(0, shade(c[0], 0.25)); g.addColorStop(0.7, c[0]); g.addColorStop(1, shade(c[0], -0.1)); return g; })();
  ctx.fillStyle = fill; ctx.fill(); ctx.save(); ctx.clip();
  if (!sil) { ctx.fillStyle = c[1]; ell(ctx, 0.05, 0.22, 0.34, 0.14); ctx.fill(); pattern(ctx, sp, c, 0.6, t, sil); }
  ctx.restore(); bp(); ctx.lineWidth = LW; ctx.strokeStyle = sil ? SIL : INK; ctx.stroke();
  ctx.strokeStyle = sil ? SIL : INK; ctx.lineWidth = 0.014;
  for (let i = 0; i < 14; i++) { const a = -2.6 + i * 0.28, r0 = 0.3, x = 0.04 + Math.cos(a) * 0.335, y = Math.sin(a) * 0.3 * 1.04; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(a) * 0.04, y + Math.sin(a) * 0.04); ctx.stroke(); }
  ctx.save(); ctx.translate(0.08, 0.04); ctx.rotate(Math.sin(t * 9) * 0.4); ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(-0.08, 0.1, -0.14, 0.06); ctx.quadraticCurveTo(-0.06, -0.02, 0, 0); P(ctx, c[2], sil, LW * 0.8); ctx.restore();
  ctx.beginPath(); ctx.arc(0.36, 0.06, 0.03, 0, TAU); P(ctx, '#e8a090', sil, LW * 0.8);
  eye(ctx, 0.22, -0.08, 0.06, sil);
}

function bodyAngler(ctx, sp, c, t, sil) {
  const sw = Math.sin(t * 2.4) * 0.03;
  ctx.save(); ctx.translate(-0.3, 0); ctx.rotate(Math.sin(t * 4) * 0.1); ctx.beginPath(); ctx.moveTo(0.06, 0); ctx.quadraticCurveTo(-0.06, -0.18, -0.16, -0.12); ctx.quadraticCurveTo(-0.1, 0, -0.16, 0.12); ctx.quadraticCurveTo(-0.06, 0.18, 0.06, 0); P(ctx, c[0], sil); ctx.restore();
  // lure
  const lx = 0.4 + sw, ly = -0.5;
  ctx.beginPath(); ctx.moveTo(0.18, -0.2); ctx.quadraticCurveTo(0.22, -0.52, lx, ly); ctx.lineWidth = 0.02; ctx.strokeStyle = sil ? SIL : INK; ctx.stroke();
  if (!sil) { glow(ctx, lx, ly, 0.2, '#bfffee', 0.8); ctx.beginPath(); ctx.arc(lx, ly, 0.035, 0, TAU); ctx.fillStyle = '#eafff8'; ctx.fill(); }
  const bp = () => organic(ctx, 0.02, 0, 0.34, 0.3, sp.order + 9, 11, 0.04);
  bp();
  const fill = sil ? SIL : (() => { const g = ctx.createRadialGradient(-0.05, -0.1, 0.02, 0, 0, 0.36); g.addColorStop(0, shade(c[0], 0.15)); g.addColorStop(1, shade(c[0], -0.2)); return g; })();
  ctx.fillStyle = fill; ctx.fill(); ctx.save(); ctx.clip(); if (!sil) pattern(ctx, sp, c, 0.6, t, sil); ctx.restore(); bp(); ctx.lineWidth = LW; ctx.strokeStyle = sil ? SIL : INK; ctx.stroke();
  // mouth
  ctx.beginPath(); ctx.moveTo(0.34, 0.02); ctx.quadraticCurveTo(0.2, 0.2, -0.02, 0.1); ctx.lineWidth = 0.022; ctx.strokeStyle = sil ? SIL : INK; ctx.stroke();
  ctx.fillStyle = sil ? SIL : '#fff';
  for (let i = 0; i < 6; i++) { const x = 0.32 - i * 0.05, y = 0.03 + i * 0.012 + Math.sin(i * 0.9) * 0.005; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - 0.012, y + 0.065); ctx.lineTo(x - 0.03, y + 0.01); ctx.fill(); }
  eye(ctx, 0.2, -0.1, 0.045, sil, '#ffe9a0');
}

function bodyLion(ctx, sp, c, t, sil) {
  const h = sp.h;
  // fan fins behind
  for (let i = 0; i < 9; i++) {
    const a = -1.9 - i * 0.2 + Math.sin(t * 2 + i) * 0.03;
    ctx.beginPath(); ctx.moveTo(0.1, -h * 0.4); ctx.lineTo(0.1 + Math.cos(a) * 0.42, -h * 0.4 + Math.sin(a) * 0.46); ctx.lineWidth = 0.014; ctx.strokeStyle = sil ? SIL : INK; ctx.stroke();
    if (i) { const a0 = a + 0.2; ctx.beginPath(); ctx.moveTo(0.1, -h * 0.4); ctx.lineTo(0.1 + Math.cos(a0) * 0.42, -h * 0.4 + Math.sin(a0) * 0.46); ctx.lineTo(0.1 + Math.cos(a) * 0.42, -h * 0.4 + Math.sin(a) * 0.46); ctx.closePath(); ctx.fillStyle = sil ? SIL : rgba(i % 2 ? c[0] : c[1], 0.65); ctx.fill(); }
  }
  for (let i = 0; i < 7; i++) {
    const a = 1.2 + i * 0.22 + Math.sin(t * 2.4 + i) * 0.03, a0 = a + 0.22;
    ctx.beginPath(); ctx.moveTo(0.18, h * 0.12); ctx.lineTo(0.18 + Math.cos(a0 + 1.9) * 0.4, h * 0.12 + Math.sin(a0 + 1.9) * 0.36); ctx.lineTo(0.18 + Math.cos(a + 1.9) * 0.4, h * 0.12 + Math.sin(a + 1.9) * 0.36); ctx.closePath(); ctx.fillStyle = sil ? SIL : rgba(i % 2 ? c[0] : c[1], 0.6); ctx.fill(); ctx.lineWidth = 0.012; ctx.strokeStyle = sil ? SIL : INK; ctx.stroke();
  }
  bodyFish(ctx, { ...sp, body: 'fish', feature: null }, c, t, sil, false);
}

function bodyDragon(ctx, sp, c, t, sil) {
  const n = 30, pts = [], ws = [], th = sp.h * 0.55;
  for (let i = 0; i < n; i++) { const u = i / (n - 1); pts.push([0.45 - u * 0.95, Math.sin(u * 8 - t * 2.6) * 0.07 * (0.2 + u)]); ws.push(th * (u < 0.08 ? 0.8 : 1) * (1 - Math.pow(u, 2.2) * 0.9) * (u < 0.15 ? 1.15 : 1)); }
  // mane / dorsal spikes
  ctx.fillStyle = sil ? SIL : c[1];
  for (let i = 3; i < n - 3; i += 2) { const p = pts[i]; ctx.beginPath(); ctx.moveTo(p[0] + 0.02, p[1] - ws[i]); ctx.lineTo(p[0] - 0.005, p[1] - ws[i] - 0.06 * (1 - i / n * 0.6)); ctx.lineTo(p[0] - 0.03, p[1] - ws[i]); ctx.closePath(); ctx.fill(); ctx.lineWidth = 0.01; ctx.strokeStyle = sil ? SIL : INK; ctx.stroke(); }
  ctx.save(); ctx.translate(pts[n - 1][0], pts[n - 1][1]); ctx.rotate(Math.sin(t * 4) * 0.2); ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(-0.06, -0.08, -0.14, -0.06); ctx.quadraticCurveTo(-0.08, 0, -0.14, 0.06); ctx.quadraticCurveTo(-0.06, 0.08, 0, 0); P(ctx, c[1], sil); ctx.restore();
  const bp = () => ribbon(ctx, pts, ws);
  bp();
  const fill = sil ? SIL : (() => { const g = ctx.createLinearGradient(0, -th, 0, th); g.addColorStop(0, c[0]); g.addColorStop(1, shade(c[0], 0.25)); return g; })();
  ctx.fillStyle = fill; ctx.fill(); ctx.save(); ctx.clip();
  if (!sil) { ctx.fillStyle = rgba(c[1], 0.55); pts.forEach((p, i) => { if (i % 2) { ctx.beginPath(); ctx.arc(p[0], p[1] + ws[i] * 0.55, ws[i] * 0.4, 0, Math.PI); ctx.fill(); } }); if (sp.pattern === 'glowspots') pts.forEach((p, i) => { if (i % 3 === 0) { glow(ctx, p[0], p[1] + ws[i] * 0.2, 0.045, c[1], 0.5 + 0.4 * Math.sin(t * 2 + i)); } }); }
  ctx.restore(); bp(); ctx.lineWidth = LW; ctx.strokeStyle = sil ? SIL : INK; ctx.stroke();
  const hx = pts[0][0], hy = pts[0][1];
  // head snout, whiskers, horns
  ctx.beginPath(); ctx.moveTo(hx - 0.02, hy - th * 0.8); ctx.quadraticCurveTo(hx + 0.1, hy - th * 0.6, hx + 0.12, hy); ctx.quadraticCurveTo(hx + 0.08, hy + th * 0.7, hx - 0.02, hy + th * 0.8); P(ctx, c[0], sil);
  ctx.strokeStyle = sil ? SIL : c[1]; ctx.lineWidth = 0.014;
  for (const s of [-1, 1]) { ctx.beginPath(); ctx.moveTo(hx + 0.1, hy + s * 0.01); ctx.bezierCurveTo(hx + 0.18, hy + s * 0.08, hx + 0.2 + Math.sin(t * 3) * 0.03, hy + s * 0.02, hx + 0.26, hy + s * 0.1 + Math.sin(t * 3 + s) * 0.03); ctx.stroke(); }
  ctx.beginPath(); ctx.moveTo(hx - 0.02, hy - th); ctx.lineTo(hx - 0.07, hy - th - 0.07); ctx.lineTo(hx + 0.02, hy - th * 0.8); ctx.closePath(); P(ctx, c[1], sil, LW * 0.8);
  eye(ctx, hx + 0.03, hy - th * 0.25, Math.max(0.016, th * 0.28), sil, '#ffe08a');
}

const BODIES = {
  fish: (ctx, sp, c, t, sil) => bodyFish(ctx, sp, c, t, sil, false),
  torp: (ctx, sp, c, t, sil) => bodyFish(ctx, sp, c, t, sil, true),
  leviathan: (ctx, sp, c, t, sil) => bodyFish(ctx, sp, c, t, sil, true),
  round: bodyRound, eel: bodyEel, slim: bodySlim, flat: bodyFlat, ray: bodyRay, shark: bodyShark, jelly: bodyJelly, squid: bodySquid,
  octopus: bodyOctopus, crab: bodyCrab, star: bodyStar, seahorse: bodySeahorse, puffer: bodyPuffer, angler: bodyAngler, lion: bodyLion, dragon: bodyDragon,
};

/** Draw a species. size = body length in px. o: {x, y, size, dir, t, sil, variant, tilt, alpha} */
function drawFish(ctx, sp, o) {
  const { x = 0, y = 0, size = 60, dir = 1, t = 0, sil = false, variant = false, tilt = 0, alpha = 1 } = o;
  ctx.save(); ctx.translate(x, y); if (tilt) ctx.rotate(tilt); ctx.scale(dir * size, size); ctx.globalAlpha *= alpha;
  const pal = variant ? sp.colors.map(rotateColor) : sp.colors;
  (BODIES[sp.body] || BODIES.fish)(ctx, sp, pal, t, sil);
  ctx.restore();
}

/** Pixel size of a species based on its length in cm. */
function fishPixels(lengthCm, scale = 1) { return clamp(26 + Math.pow(lengthCm, 0.62) * 9, 30, 230) * scale; }

// ---------- Loot ----------
function drawLoot(ctx, id, x, y, s, t = 0) {
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s); ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  const L = 0.03;
  const pp = (fill) => P(ctx, fill, false, L);
  switch (id) {
    case 'old_boot': ctx.beginPath(); ctx.moveTo(-0.18, -0.35); ctx.lineTo(0.06, -0.35); ctx.lineTo(0.08, 0.05); ctx.quadraticCurveTo(0.38, 0.08, 0.38, 0.28); ctx.lineTo(-0.2, 0.28); ctx.closePath(); pp('#8a5a38'); ctx.fillStyle = '#5a3a24'; ctx.fillRect(-0.2, 0.2, 0.58, 0.08); ctx.strokeStyle = '#d8c8a0'; ctx.lineWidth = 0.02; for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.moveTo(-0.15, -0.25 + i * 0.1); ctx.lineTo(0.03, -0.22 + i * 0.1); ctx.stroke(); } ctx.fillStyle = '#6a9a4a'; ctx.beginPath(); ctx.arc(0.2, 0.18, 0.03, 0, TAU); ctx.fill(); break;
    case 'tin_can': ctx.beginPath(); ctx.roundRect(-0.2, -0.25, 0.4, 0.5, 0.04); pp('#aab4bc'); ctx.fillStyle = '#c8603a'; ctx.fillRect(-0.2, -0.1, 0.4, 0.2); ctx.strokeStyle = INK; ctx.lineWidth = L * 0.7; ctx.strokeRect(-0.2, -0.1, 0.4, 0.2); ell(ctx, 0, -0.25, 0.2, 0.05); pp('#d4dade'); break;
    case 'glass_bottle': case 'message_bottle': ctx.beginPath(); ctx.moveTo(-0.08, -0.4); ctx.lineTo(0.08, -0.4); ctx.lineTo(0.08, -0.2); ctx.quadraticCurveTo(0.24, -0.12, 0.22, 0.1); ctx.lineTo(0.22, 0.3); ctx.lineTo(-0.22, 0.3); ctx.lineTo(-0.22, 0.1); ctx.quadraticCurveTo(-0.24, -0.12, -0.08, -0.2); ctx.closePath(); pp(id === 'glass_bottle' ? 'rgba(130,200,150,.85)' : 'rgba(170,215,230,.85)'); ctx.fillStyle = '#c08a5a'; ctx.fillRect(-0.08, -0.46, 0.16, 0.08); if (id === 'message_bottle') { ctx.save(); ctx.rotate(-0.2); ctx.fillStyle = '#f6ead0'; ctx.fillRect(-0.1, -0.02, 0.2, 0.26); ctx.strokeStyle = '#b8a070'; ctx.lineWidth = 0.012; for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.moveTo(-0.07, 0.04 + i * 0.05); ctx.lineTo(0.07, 0.04 + i * 0.05); ctx.stroke(); } ctx.restore(); } ctx.fillStyle = 'rgba(255,255,255,.6)'; ctx.fillRect(-0.17, 0.0, 0.03, 0.22); break;
    case 'torn_net': ctx.strokeStyle = '#a89870'; ctx.lineWidth = 0.025; for (let i = -3; i <= 3; i++) { ctx.beginPath(); ctx.moveTo(i * 0.1, -0.3); ctx.quadraticCurveTo(i * 0.1 + 0.08, 0, i * 0.1 - 0.03, 0.3); ctx.stroke(); } for (let j = -2; j <= 2; j++) { ctx.beginPath(); ctx.moveTo(-0.34, j * 0.12); ctx.quadraticCurveTo(0, j * 0.12 + 0.06, 0.34, j * 0.12 - 0.04); ctx.stroke(); } ctx.fillStyle = '#c85a3a'; ctx.beginPath(); ctx.arc(-0.3, -0.28, 0.04, 0, TAU); ctx.fill(); break;
    case 'driftwood': ctx.beginPath(); ctx.moveTo(-0.38, 0.08); ctx.quadraticCurveTo(-0.1, -0.2, 0.36, -0.06); ctx.lineTo(0.38, 0.06); ctx.quadraticCurveTo(0, 0.0, -0.36, 0.2); ctx.closePath(); pp('#cdb592'); ctx.beginPath(); ctx.moveTo(0.05, -0.1); ctx.lineTo(0.14, -0.28); ctx.lineTo(0.18, -0.1); ctx.closePath(); pp('#cdb592'); ctx.strokeStyle = '#a08a68'; ctx.lineWidth = 0.014; ctx.beginPath(); ctx.moveTo(-0.2, 0.0); ctx.lineTo(0.2, -0.02); ctx.stroke(); break;
    case 'rusty_anchor': ctx.strokeStyle = INK; ctx.lineWidth = 0.1; ctx.beginPath(); ctx.moveTo(0, -0.3); ctx.lineTo(0, 0.25); ctx.moveTo(-0.14, -0.16); ctx.lineTo(0.14, -0.16); ctx.moveTo(-0.3, 0.1); ctx.quadraticCurveTo(0, 0.4, 0.3, 0.1); ctx.stroke(); ctx.strokeStyle = '#b8683a'; ctx.lineWidth = 0.06; ctx.stroke(); ctx.beginPath(); ctx.arc(0, -0.36, 0.06, 0, TAU); ctx.lineWidth = 0.03; ctx.strokeStyle = INK; ctx.stroke(); break;
    case 'seaweed': for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.moveTo(-0.15 + i * 0.1, 0.3); ctx.bezierCurveTo(-0.3 + i * 0.1, 0.1, 0.1 + i * 0.1, -0.1, -0.1 + i * 0.1, -0.32); ctx.lineWidth = 0.08; ctx.strokeStyle = INK; ctx.stroke(); ctx.lineWidth = 0.05; ctx.strokeStyle = ['#4f8a4a', '#6aa85a', '#3f7a4a', '#7ab860'][i]; ctx.stroke(); } break;
    case 'coin_pouch': ctx.beginPath(); ctx.moveTo(-0.1, -0.22); ctx.quadraticCurveTo(-0.34, 0.0, -0.28, 0.2); ctx.quadraticCurveTo(0, 0.34, 0.28, 0.2); ctx.quadraticCurveTo(0.34, 0, 0.1, -0.22); ctx.closePath(); pp('#b88a52'); ctx.strokeStyle = INK; ctx.lineWidth = 0.04; ctx.beginPath(); ctx.moveTo(-0.14, -0.2); ctx.quadraticCurveTo(0, -0.14, 0.14, -0.2); ctx.stroke(); ctx.fillStyle = '#e8c15a'; ctx.beginPath(); ctx.arc(0, 0.06, 0.07, 0, TAU); ctx.fill(); ctx.stroke(); for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.arc(-0.1 + i * 0.1, -0.28 - (i % 2) * 0.03, 0.05, 0, TAU); pp('#f2cf6a'); } break;
    case 'pearl': glow(ctx, 0, 0, 0.45, '#ffffff', 0.5); ctx.beginPath(); ctx.arc(0, 0, 0.22, 0, TAU); { const g = ctx.createRadialGradient(-0.07, -0.08, 0.02, 0, 0, 0.24); g.addColorStop(0, '#fff'); g.addColorStop(0.6, '#f3e8f8'); g.addColorStop(1, '#c8b8e0'); pp(g); } sparkle(ctx, 0.2, -0.2, 0.08, '#fff', t); break;
    case 'rare_shell': ctx.beginPath(); ctx.moveTo(0, 0.28); ctx.bezierCurveTo(-0.4, 0.15, -0.36, -0.28, 0, -0.3); ctx.bezierCurveTo(0.36, -0.28, 0.4, 0.15, 0, 0.28); pp('#f4b8c0'); ctx.strokeStyle = '#c87a88'; ctx.lineWidth = 0.02; for (let i = -3; i <= 3; i++) { ctx.beginPath(); ctx.moveTo(0, 0.26); ctx.quadraticCurveTo(i * 0.08, -0.05, i * 0.1, -0.27); ctx.stroke(); } ctx.fillStyle = '#e8a0ac'; ctx.fillRect(-0.12, 0.26, 0.24, 0.05); break;
    case 'old_compass': ctx.beginPath(); ctx.arc(0, 0, 0.3, 0, TAU); pp('#c9a24a'); ctx.beginPath(); ctx.arc(0, 0, 0.23, 0, TAU); pp('#f6ecd0'); ctx.beginPath(); ctx.moveTo(0, -0.2); ctx.lineTo(0.05, 0); ctx.lineTo(0, 0.2); ctx.lineTo(-0.05, 0); ctx.closePath(); P(ctx, '#c8503a', false, 0.015); ctx.save(); ctx.rotate(Math.sin(t) * 0.3); ctx.beginPath(); ctx.moveTo(0, -0.2); ctx.lineTo(0.05, 0); ctx.lineTo(-0.05, 0); ctx.closePath(); ctx.fillStyle = '#c8503a'; ctx.fill(); ctx.restore(); ctx.fillStyle = '#c9a24a'; ctx.fillRect(-0.04, -0.4, 0.08, 0.1); break;
    case 'antique_reel': ctx.beginPath(); ctx.arc(0, 0, 0.28, 0, TAU); pp('#c9a24a'); ctx.beginPath(); ctx.arc(0, 0, 0.16, 0, TAU); pp('#e8d79a'); ctx.beginPath(); ctx.arc(0, 0, 0.05, 0, TAU); pp('#8a6a2a'); ctx.strokeStyle = INK; ctx.lineWidth = 0.04; ctx.beginPath(); ctx.moveTo(0.28, 0); ctx.lineTo(0.4, 0.1); ctx.stroke(); ctx.beginPath(); ctx.arc(0.4, 0.1, 0.05, 0, TAU); pp('#6a4a2a'); break;
    case 'treasure_chest': ctx.beginPath(); ctx.roundRect(-0.34, -0.02, 0.68, 0.32, 0.04); pp('#8a5a32'); ctx.beginPath(); ctx.moveTo(-0.34, -0.02); ctx.quadraticCurveTo(-0.34, -0.3, 0, -0.3); ctx.quadraticCurveTo(0.34, -0.3, 0.34, -0.02); ctx.closePath(); pp('#a06c3a'); ctx.fillStyle = '#e8c15a'; ctx.fillRect(-0.04, -0.06, 0.08, 0.12); ctx.fillRect(-0.34, 0.06, 0.68, 0.04); ctx.strokeStyle = INK; ctx.lineWidth = 0.02; ctx.strokeRect(-0.04, -0.06, 0.08, 0.12); sparkle(ctx, 0.28, -0.3, 0.07, '#fff6c8', t); sparkle(ctx, -0.26, -0.2, 0.05, '#fff6c8', -t); break;
    case 'gold_idol': glow(ctx, 0, 0, 0.5, '#ffd870', 0.45); ctx.beginPath(); ctx.moveTo(0.3, 0); ctx.bezierCurveTo(0.14, -0.2, -0.14, -0.2, -0.26, -0.02); ctx.lineTo(-0.38, -0.18); ctx.lineTo(-0.38, 0.18); ctx.lineTo(-0.26, 0.02); ctx.bezierCurveTo(-0.14, 0.2, 0.14, 0.2, 0.3, 0); ctx.closePath(); pp('#f0c84a'); eye(ctx, 0.14, -0.04, 0.04, false); break;
    case 'sunken_crown': glow(ctx, 0, 0, 0.5, '#ffd870', 0.5); ctx.beginPath(); ctx.moveTo(-0.3, 0.2); ctx.lineTo(-0.34, -0.2); ctx.lineTo(-0.15, -0.04); ctx.lineTo(0, -0.28); ctx.lineTo(0.15, -0.04); ctx.lineTo(0.34, -0.2); ctx.lineTo(0.3, 0.2); ctx.closePath(); pp('#f0c84a'); for (const [gx, gc] of [[-0.15, '#e05a6a'], [0, '#5a9ae0'], [0.15, '#5ae08a']]) { ctx.beginPath(); ctx.arc(gx, 0.08, 0.045, 0, TAU); pp(gc); } sparkle(ctx, 0.3, -0.26, 0.07, '#fff', t); break;
  }
  ctx.restore();
}

// ---------- Gear icons (shop) ----------
function drawGear(ctx, kind, idx, x, y, s, t = 0, extra = {}) {
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s); ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  const L = 0.03;
  if (kind === 'rod') {
    const col = extra.color || '#a87a4a';
    ctx.strokeStyle = INK; ctx.lineWidth = 0.09; ctx.beginPath(); ctx.moveTo(-0.38, 0.32); ctx.quadraticCurveTo(0.1, 0, 0.38, -0.34); ctx.stroke();
    ctx.strokeStyle = col; ctx.lineWidth = 0.055; ctx.stroke();
    ctx.beginPath(); ctx.arc(-0.2, 0.18, 0.08, 0, TAU); P(ctx, '#c8ccd2', false, L);
    ctx.strokeStyle = '#e8e0c8'; ctx.lineWidth = 0.012; ctx.beginPath(); ctx.moveTo(0.38, -0.34); ctx.lineTo(0.38, 0.1); ctx.stroke();
    if (idx >= 5) glow(ctx, 0.38, -0.34, 0.16, idx === 6 ? '#ffe08a' : '#cfe0ff', 0.7);
    for (let i = 0; i < Math.min(idx, 6); i++) { ctx.fillStyle = '#e8c15a'; ctx.beginPath(); ctx.arc(-0.1 + i * 0.1, 0.1 - i * 0.075 - 0.08, 0.016, 0, TAU); ctx.fill(); }
  } else if (kind === 'line') {
    ctx.beginPath(); ctx.arc(0, 0, 0.3, 0, TAU); P(ctx, extra.color || '#e8dcc0', false, L); ctx.beginPath(); ctx.arc(0, 0, 0.12, 0, TAU); P(ctx, '#8a6a42', false, L);
    ctx.strokeStyle = rgba(INK, 0.4); ctx.lineWidth = 0.014; for (let i = 1; i < 4; i++) { ctx.beginPath(); ctx.arc(0, 0, 0.12 + i * 0.045, 0, TAU); ctx.stroke(); }
    ctx.strokeStyle = extra.color || '#e8dcc0'; ctx.lineWidth = 0.03; ctx.beginPath(); ctx.moveTo(0.28, 0.1); ctx.quadraticCurveTo(0.5, 0.2, 0.42, 0.42); ctx.stroke();
    if (idx >= 5) sparkle(ctx, -0.25, -0.28, 0.08, '#fff6c8', t);
  } else if (kind === 'hook') {
    const sz = 0.7 + idx * 0.07;
    ctx.save(); ctx.scale(sz, sz);
    ctx.beginPath(); ctx.moveTo(-0.1, -0.4); ctx.lineTo(-0.1, 0.1); ctx.bezierCurveTo(-0.1, 0.42, 0.3, 0.42, 0.3, 0.05); ctx.lineWidth = 0.1; ctx.strokeStyle = INK; ctx.stroke(); ctx.lineWidth = 0.06; ctx.strokeStyle = extra.color || '#c0c8d0'; ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0.3, 0.05); ctx.lineTo(0.22, -0.06); ctx.lineTo(0.38, -0.02); ctx.closePath(); P(ctx, extra.color || '#c0c8d0', false, 0.02);
    ctx.beginPath(); ctx.arc(-0.1, -0.42, 0.045, 0, TAU); ctx.lineWidth = 0.025; ctx.strokeStyle = INK; ctx.stroke(); ctx.restore();
  } else if (kind === 'bait') {
    const col = extra.color || '#c98a8a';
    ctx.beginPath(); ctx.roundRect(-0.28, -0.14, 0.56, 0.4, 0.06); P(ctx, '#c8a878', false, L); ctx.beginPath(); ctx.roundRect(-0.3, -0.24, 0.6, 0.12, 0.04); P(ctx, '#a88858', false, L);
    ctx.fillStyle = col; ctx.beginPath(); ctx.ellipse(0, -0.02, 0.15, 0.1, 0, 0, TAU); ctx.fill(); ctx.stroke();
    glow(ctx, 0, -0.3, 0.3, col, 0.4 + Math.sin(t * 2) * 0.1);
    ctx.beginPath(); ctx.ellipse(0, -0.34, 0.12, 0.08, 0, 0, TAU); P(ctx, col, false, L);
  } else if (kind === 'boost') {
    ctx.beginPath(); ctx.moveTo(-0.08, -0.34); ctx.lineTo(0.08, -0.34); ctx.lineTo(0.08, -0.14); ctx.bezierCurveTo(0.34, -0.04, 0.3, 0.3, 0, 0.3); ctx.bezierCurveTo(-0.3, 0.3, -0.34, -0.04, -0.08, -0.14); ctx.closePath();
    P(ctx, extra.color || '#8ad0e8', false, L); ctx.fillStyle = '#c08a5a'; ctx.fillRect(-0.1, -0.42, 0.2, 0.09); sparkle(ctx, 0.0, 0.08, 0.1, '#fff', t);
  }
  ctx.restore();
}

Object.assign(__ex,{drawFish, fishPixels, drawLoot, drawGear});
};
__mods['fish-data.js']=function(__ex){
// All species, junk and treasure definitions. Pure data + tiny helpers.
const { CONFIG } = __req('config.js');

const RC = { c: 'common', u: 'uncommon', r: 'rare', e: 'epic', l: 'legendary', m: 'mythic' };
const LAYER = { S: 0, M: 1, D: 2 };
const LAYER_NAMES = ['Surface', 'Midwater', 'Deep water'];

// Row: name, rarity, wMin, wMax, lMin, lMax, depths, body, bodyHeight, [c1,c2,c3], pattern, baitCats, spawn, valueFactor, feature
const ZONE_ROWS = {
  pebble: [
    ['Perch', 'c', .2, 1.4, 15, 38, 'SM', 'fish', .34, ['#8fae5a', '#ecdc92', '#c9552f'], 'vstripes', 'worm', 30, 1],
    ['Small Cod', 'c', .3, 2.2, 20, 50, 'MD', 'fish', .32, ['#a98f6b', '#e9dcbc', '#6e5a3a'], 'speckle', 'worm minnow', 26, 1.1],
    ['Herring', 'c', .1, .5, 18, 32, 'S', 'torp', .24, ['#7fa3c0', '#e4eef5', '#3d5f80'], 'hstripe', 'minnow', 34, .8],
    ['Mackerel', 'c', .3, 1.6, 25, 45, 'SMD', 'torp', .26, ['#4d86a6', '#e6efe6', '#1f4663'], 'dorsal', 'minnow shiny', 28, 1],
    ['Flounder', 'u', .4, 3, 25, 55, 'MD', 'flat', .5, ['#b79b6f', '#e8d9ae', '#7a6038'], 'mottled', 'worm crab', 20, 1.3],
    ['Goby', 'u', .01, .1, 6, 12, 'S', 'fish', .3, ['#c2a36c', '#f1e3b4', '#7b6a3f'], 'spots', 'worm', 18, 1.2],
    ['Sand Goby', 'u', .01, .08, 5, 11, 'SM', 'fish', .26, ['#e3cc92', '#f8eecb', '#a98d52'], 'speckle', 'worm', 18, 1.2],
    ['Cuckoo Wrasse', 'r', .2, 1.2, 18, 40, 'MD', 'fish', .3, ['#e08a3a', '#3d88c7', '#f2d36a'], 'bands', 'worm crab', 12, 1.6],
    ['Shore Crab', 'r', .1, .9, 6, 14, 'S', 'crab', .4, ['#d96a54', '#f0a487', '#8a3b30'], 'spots', 'crab', 12, 1.5],
    ['Starfish', 'e', .05, .5, 8, 26, 'SM', 'star', .4, ['#f08a5a', '#f7c9a0', '#c9533a'], 'spots', 'crab', 8, 1.4],
    ['Pipefish', 'l', .01, .08, 20, 45, 'MD', 'slim', .1, ['#6fae8e', '#d7efc0', '#2f6e58'], 'bands', 'minnow', 4, 2.5],
    ['Silverglint', 'm', .8, 6, 40, 90, 'MD', 'fish', .32, ['#d8e6f2', '#ffffff', '#9fb6ff'], 'sheen', 'shiny', 2, 2.5],
  ],
  sunlit: [
    ['Clownfish', 'c', .05, .25, 6, 11, 'S', 'fish', .4, ['#ff8a2a', '#fff6e6', '#22304a'], 'bands', 'reef', 30, 1],
    ['Parrotfish', 'c', .8, 4, 30, 60, 'SMD', 'fish', .42, ['#3fc0b0', '#e36aa0', '#8fe0c8'], 'scales', 'reef', 26, 1.1, 'beak'],
    ['Butterflyfish', 'c', .1, .4, 10, 20, 'SM', 'round', .6, ['#ffe066', '#fff7d0', '#2b2b3a'], 'vstripes', 'reef', 26, 1],
    ['Surgeonfish', 'c', .4, 1.5, 18, 35, 'MD', 'round', .5, ['#7aa7d8', '#f2e36a', '#2b3d6a'], 'hstripe', 'reef minnow', 24, 1],
    ['Yellowtail Mackerel', 'u', 1, 6, 40, 80, 'MD', 'torp', .26, ['#5f9fcf', '#f3f0e6', '#f2c93a'], 'hstripe', 'minnow shiny', 18, 1.2],
    ['Flying Fish', 'u', .2, .9, 20, 35, 'S', 'torp', .22, ['#5aa0c8', '#e6f3fa', '#9fd0e8'], 'sheen', 'minnow', 16, 1.2, 'wings'],
    ['Blue Tang', 'u', .3, 1.2, 15, 30, 'SM', 'round', .58, ['#2d6fe0', '#ffe14a', '#12214a'], 'hstripe', 'reef', 16, 1.3],
    ['Seahorse', 'r', .01, .06, 8, 16, 'SM', 'seahorse', .4, ['#f0b25a', '#f7dca0', '#c47a2a'], 'spots', 'reef', 12, 2],
    ['Mandarin Fish', 'r', .02, .1, 5, 9, 'S', 'fish', .34, ['#2f8fd0', '#ff8a2a', '#7be0c8'], 'swirl', 'reef', 12, 2.5],
    ['Reef Eel', 'e', .8, 6, 60, 140, 'MD', 'eel', .12, ['#7a8a4a', '#dad27a', '#3b4020'], 'spots', 'crab reef', 8, 1.2],
    ['Sunray Fish', 'l', 2, 12, 50, 110, 'MD', 'fish', .44, ['#ffb347', '#fff0a0', '#ff7a2a'], 'rays', 'shiny', 4, 1, 'crest'],
    ['Pearlfin', 'm', 3, 20, 60, 120, 'D', 'fish', .38, ['#f8f2ff', '#cfe0ff', '#ffc8e6'], 'sheen', 'shiny moon', 2, 1.2, 'longfins'],
  ],
  kelp: [
    ['Sea Bass', 'c', 1, 8, 35, 80, 'MD', 'fish', .34, ['#7f9a86', '#d8e2cc', '#44594a'], 'dorsal', 'minnow worm', 28, 1],
    ['Rock Gunnel', 'c', .02, .15, 10, 25, 'SM', 'slim', .12, ['#a67c52', '#e8d2a0', '#5c3d22'], 'spots', 'worm', 26, .9],
    ['Kelp Blenny', 'c', .02, .12, 6, 14, 'S', 'fish', .26, ['#78a448', '#dfe8a0', '#3f5e24'], 'mottled', 'kelp', 26, .9],
    ['Lumpfish', 'c', .8, 5, 25, 50, 'MD', 'round', .66, ['#6d8aa8', '#cfd9e0', '#3c4f66'], 'spots', 'kelp crab', 22, 1],
    ['Longfin Kelpfish', 'u', .1, .6, 15, 30, 'SM', 'slim', .16, ['#9b6bb0', '#ead2f0', '#5b3a70'], 'hstripe', 'kelp', 16, 1.3, 'longfins'],
    ['Sea Robin', 'u', .3, 1.5, 20, 40, 'MD', 'fish', .3, ['#c96a50', '#f2c19a', '#7a3a28'], 'spots', 'crab worm', 16, 1.3, 'wings'],
    ['Conger Eel', 'u', 3, 20, 100, 200, 'MD', 'eel', .14, ['#5d6a78', '#b5bfc9', '#2a323c'], 'none', 'minnow', 14, 1],
    ['Green Ray', 'r', 2, 12, 50, 110, 'MD', 'ray', .5, ['#6aa87a', '#d4ecc4', '#35603f'], 'spots', 'crab kelp', 12, 1.3],
    ['Glass Eel', 'r', .01, .05, 6, 12, 'SM', 'eel', .05, ['#d6efe8', '#ffffff', '#7ab6a8'], 'none', 'minnow', 12, 3, 'glass'],
    ['Moon Jelly', 'e', .1, 1, 8, 25, 'SM', 'jelly', .5, ['#d7c8ff', '#f6f0ff', '#9a86d8'], 'none', 'moon', 8, 2.5],
    ['Shadow Mackerel', 'l', 2, 8, 50, 90, 'MD', 'torp', .26, ['#3b4b66', '#8a9ab4', '#1a2336'], 'dorsal', 'glow minnow', 4, 2],
    ['Mossback', 'm', 12, 60, 120, 260, 'D', 'fish', .46, ['#5e7d4a', '#c3d49a', '#364a28'], 'mottled', 'kelp', 2, 1, 'moss'],
  ],
  coral: [
    ['Pufferfish', 'c', .3, 2, 15, 40, 'SM', 'puffer', .7, ['#e0c060', '#faf0c8', '#8a6a2a'], 'spots', 'reef crab', 28, 1],
    ['Lionfish', 'c', .4, 1.4, 20, 40, 'SM', 'lion', .4, ['#d9533a', '#f6e3d0', '#6b2118'], 'vstripes', 'reef minnow', 26, 1.1],
    ['King Mackerel', 'c', 3, 14, 70, 140, 'SMD', 'torp', .26, ['#5a8fa8', '#e2ece8', '#2d4f63'], 'hstripe', 'minnow shiny', 24, 1.1],
    ['Coral Grouper', 'c', 2, 12, 40, 90, 'MD', 'fish', .46, ['#d9603e', '#f3b095', '#7b2c1a'], 'spots', 'reef crab', 24, 1.1],
    ['Redbelly Surgeonfish', 'u', .5, 2, 20, 38, 'SM', 'round', .52, ['#4a7bd0', '#e0603a', '#1c2b55'], 'belly', 'reef', 16, 1.2],
    ['Rainbow Wrasse', 'u', .2, 1.5, 15, 35, 'SM', 'fish', .3, ['#4fd0b0', '#f06ea8', '#f8d34a'], 'bands', 'reef', 16, 1.3],
    ['Lanternfish', 'u', .02, .2, 6, 14, 'MD', 'fish', .3, ['#3a5a8a', '#a9d8e8', '#1a2a4a'], 'glowspots', 'glow', 16, 1.4],
    ['Octopus', 'r', 2, 12, 40, 100, 'MD', 'octopus', .5, ['#d05a6a', '#f3b8b0', '#7a2a3a'], 'spots', 'crab', 12, 1.3],
    ['Pearl Ray', 'r', 3, 18, 60, 140, 'MD', 'ray', .5, ['#e8e2f0', '#ffffff', '#9aa8d0'], 'spots', 'shiny', 12, 1.3],
    ['Coral Shark', 'e', 10, 60, 120, 220, 'MD', 'shark', .3, ['#7a98a8', '#e8f0f2', '#3e5866'], 'none', 'minnow', 8, 1],
    ['Yellow-Eyed Moray', 'l', 5, 25, 100, 200, 'MD', 'eel', .14, ['#8a9a4a', '#f0e48a', '#3e4a22'], 'spots', 'crab', 4, 1, 'jaw'],
    ['Jewel Koi', 'm', 2, 10, 40, 80, 'SM', 'fish', .4, ['#ffffff', '#ff7a4a', '#2a2a3a'], 'patch', 'shiny reef', 2, 1.5, 'jewel'],
  ],
  twilight: [
    ['Blue Lanternfish', 'c', .02, .2, 6, 14, 'SM', 'fish', .3, ['#2a4a8a', '#8ad0ff', '#101c3a'], 'glowspots', 'glow', 28, .9],
    ['Viperfish', 'c', .1, .6, 20, 35, 'MD', 'fish', .3, ['#2e3a5a', '#8aa0c0', '#141a2c'], 'glowspots', 'glow minnow', 26, 1, 'fangs'],
    ['Pelican Eel', 'c', .5, 3, 50, 100, 'D', 'eel', .12, ['#3a3050', '#7a6aa0', '#1a1428'], 'none', 'glow', 24, 1, 'pelican'],
    ['Glass Squid', 'c', .1, 1, 15, 40, 'SM', 'squid', .3, ['#c8e8ff', '#ffffff', '#7ab0d0'], 'glowspots', 'glow', 24, 1, 'glass'],
    ['Anglerfish', 'u', 1, 8, 25, 70, 'MD', 'angler', .6, ['#4a3a5a', '#9a7ab0', '#1c1426'], 'spots', 'glow', 16, 1.3],
    ['Star Ray', 'u', 2, 10, 50, 100, 'MD', 'ray', .5, ['#3a4a8a', '#c8d4ff', '#1a2250'], 'glowspots', 'glow shiny', 16, 1.3],
    ['Ghost Jelly', 'u', .1, 2, 10, 35, 'SM', 'jelly', .55, ['#c8f0ff', '#ffffff', '#7ac8e8'], 'none', 'moon glow', 16, 1.3],
    ['Deep Dragonfish', 'r', .5, 5, 40, 90, 'MD', 'dragon', .14, ['#5a3a8a', '#c8a0ff', '#24123e'], 'glowspots', 'glow', 12, 1.4],
    ['Abyss Eel', 'r', 3, 18, 120, 220, 'D', 'eel', .14, ['#2a2a40', '#6a6a98', '#12121e'], 'glowspots', 'glow', 12, 1.2],
    ['Silver Shark', 'e', 20, 90, 150, 280, 'MD', 'shark', .3, ['#b8c4d4', '#f2f6fa', '#6a7890'], 'none', 'minnow shiny', 8, 1],
    ['Night Pearl', 'l', 2, 12, 30, 70, 'MD', 'fish', .4, ['#2a2f66', '#fff3c8', '#9fb4ff'], 'glowspots', 'glow shiny', 4, 2, 'pearl'],
    ['Keeper of the Deep', 'm', 40, 200, 200, 400, 'D', 'leviathan', .4, ['#3a2a66', '#a070ff', '#140c2a'], 'glowspots', 'glow', 2, 1.2],
  ],
  frost: [
    ['Arctic Char', 'c', .5, 4, 30, 70, 'SM', 'fish', .3, ['#7aa8c8', '#f4a47a', '#3a5a7a'], 'spots', 'arctic minnow', 28, 1],
    ['Halibut', 'c', 3, 25, 60, 150, 'MD', 'flat', .5, ['#8a8a78', '#e8e4d4', '#4a4a3a'], 'mottled', 'arctic worm', 26, 1],
    ['Polar Cod', 'c', .1, .8, 15, 35, 'SMD', 'fish', .28, ['#9ab8d0', '#e6f0f6', '#4a6a88'], 'speckle', 'arctic minnow', 28, .9],
    ['Glacier Herring', 'c', .1, .6, 18, 32, 'S', 'torp', .24, ['#a8d8f0', '#f4fbff', '#5a90b8'], 'hstripe', 'arctic minnow', 26, .9],
    ['Snow Sculpin', 'u', .1, .9, 10, 25, 'MD', 'fish', .34, ['#d8e4ec', '#ffffff', '#8a9eae'], 'mottled', 'arctic', 16, 1.3],
    ['Frostfin', 'u', .5, 3, 20, 45, 'SM', 'fish', .34, ['#88c8f0', '#e0f4ff', '#3a78b0'], 'sheen', 'arctic shiny', 16, 1.3, 'longfins'],
    ['Crystal Perch', 'u', .3, 2, 18, 38, 'SMD', 'fish', .34, ['#b8f0ff', '#ffffff', '#68b8d8'], 'sheen', 'arctic', 16, 1.4, 'crystal'],
    ['Ice Ray', 'r', 3, 20, 60, 150, 'MD', 'ray', .5, ['#a8d0ec', '#f4fbff', '#5088b0'], 'spots', 'arctic', 12, 1.3],
    ['Ice Squid', 'r', 2, 15, 40, 120, 'MD', 'squid', .3, ['#b8d4f4', '#f0f8ff', '#6a8ec0'], 'spots', 'arctic', 12, 1.3],
    ['Arctic Shark', 'e', 40, 300, 200, 450, 'MD', 'shark', .3, ['#6a7e94', '#e4ecf2', '#38485a'], 'none', 'arctic', 8, 1],
    ['Aurora Jelly', 'l', 1, 10, 20, 60, 'SM', 'jelly', .55, ['#7af0c8', '#c8a8ff', '#3a98a8'], 'none', 'arctic moon', 4, 1.5],
    ['Winter Star', 'm', .5, 4, 20, 45, 'MD', 'star', .4, ['#e8f8ff', '#ffffff', '#7ac8f0'], 'glowspots', 'arctic', 2, 2],
  ],
  trench: [
    ['Ruin Catfish', 'c', 2, 15, 50, 120, 'MD', 'fish', .36, ['#8a7a9a', '#d8cce0', '#463a58'], 'mottled', 'ancient worm', 28, 1, 'whiskers'],
    ['Ancient Angler', 'c', 1, 10, 30, 80, 'MD', 'angler', .6, ['#5a4a7a', '#b8a0e0', '#2a1e44'], 'spots', 'ancient glow', 26, 1],
    ['Phantom Ray', 'c', 3, 20, 60, 150, 'SMD', 'ray', .5, ['#7a6aa8', '#d8ccff', '#3a2e66'], 'glowspots', 'ancient moon', 26, 1],
    ['Crystal Eel', 'c', 1, 8, 80, 160, 'SMD', 'eel', .12, ['#a8e0ff', '#ffffff', '#5a98c8'], 'sheen', 'ancient glow', 24, 1, 'crystal'],
    ['Moonlit Squid', 'u', 2, 15, 40, 120, 'MD', 'squid', .3, ['#c8c0ff', '#ffffff', '#6a60c0'], 'glowspots', 'moon ancient', 16, 1.3],
    ['Dream Jelly', 'u', .2, 3, 10, 40, 'SM', 'jelly', .55, ['#f0a8ff', '#ffe8ff', '#a058c8'], 'none', 'moon', 16, 1.3],
    ['Voidfish', 'u', 1, 8, 25, 60, 'MD', 'fish', .4, ['#1a1030', '#6a3aa8', '#0a0618'], 'glowspots', 'ancient glow', 16, 1.4, 'void'],
    ['Star Eater', 'r', 5, 40, 60, 160, 'MD', 'fish', .5, ['#3a2a6a', '#ffd870', '#140c2c'], 'glowspots', 'ancient glow', 12, 1.3, 'jaw'],
    ['Abyssal Shark', 'r', 30, 200, 200, 400, 'MD', 'shark', .3, ['#3a3a58', '#a8a8c8', '#181828'], 'glowspots', 'ancient', 12, 1.2],
    ['Deepsea Dragon', 'e', 20, 120, 200, 500, 'MD', 'dragon', .16, ['#6a3ab0', '#ffd870', '#26104a'], 'glowspots', 'ancient glow', 8, 1.1],
    ['Primordial Leviathan', 'l', 200, 900, 500, 1200, 'D', 'leviathan', .4, ['#2a3a68', '#8ab0ff', '#0e1430'], 'glowspots', 'ancient', 4, 1],
    ['Tide King', 'm', 50, 300, 200, 420, 'D', 'fish', .46, ['#2a8aa8', '#ffd870', '#0e2a3a'], 'crown', 'ancient', 2, 1.3, 'crown'],
  ],
};
const ZONE_ORDER = ['pebble', 'sunlit', 'kelp', 'coral', 'twilight', 'frost', 'trench'];

// Special encounter requirements ("optional discovery conditions"). Keys are species ids.
const SPECIES_REQ = {
  moon_jelly: { time: 'night' },
  mossback: { bait: 'kelp' },
  night_pearl: { time: 'night' },
  winter_star: { time: 'night' },
  moonlit_squid: { time: 'night' },
  tide_king: { bait: 'ancient' },
  keeper_of_the_deep: { bait: 'glow' },
  primordial_leviathan: { minRod: 4 },
};

const slug = s => s.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');

function sizeClass(avg) {
  const t = CONFIG.hookSizeClassWeights;
  let c = 1;
  for (const lim of t) { if (avg >= lim) c++; }
  return c;
}

const SPECIES = [];
ZONE_ORDER.forEach((zone, zi) => {
  ZONE_ROWS[zone].forEach((r, i) => {
    const [name, rar, wMin, wMax, lMin, lMax, depths, body, h, colors, pattern, bait, spawn, f, feature] = r;
    const id = slug(name);
    SPECIES.push({
      id, name, zone, zoneIndex: zi, order: i,
      rarity: RC[rar], wMin, wMax, lMin, lMax,
      depths: [...depths].map(d => LAYER[d]),
      body, h, colors, pattern, bait: bait.split(' '),
      spawn, baseValue: Math.max(1, Math.round(CONFIG.zoneBase[zi] * f)),
      feature: feature || null,
      size: sizeClass((wMin + wMax) / 2),
      req: SPECIES_REQ[id] || null,
    });
  });
});
const SPECIES_BY_ID = Object.fromEntries(SPECIES.map(s => [s.id, s]));
const speciesOfZone = z => SPECIES.filter(s => s.zone === z);

// ---------- Junk & treasure ----------
// value is a base number, scaled by zone multipliers when caught.
const JUNK = [
  { id: 'old_boot', name: 'Old Boot', value: 3, weight: 20, desc: 'Squelchy and sad. Someone loved it once.' },
  { id: 'tin_can', name: 'Tin Can', value: 2, weight: 20, desc: 'Dented, rusty, and surprisingly empty.' },
  { id: 'glass_bottle', name: 'Glass Bottle', value: 4, weight: 14, desc: 'A green bottle, smoothed by the sea.' },
  { id: 'torn_net', name: 'Broken Net', value: 3, weight: 14, desc: 'A tangle of old netting.' },
  { id: 'driftwood', name: 'Driftwood', value: 4, weight: 14, desc: 'A bleached branch with character.' },
  { id: 'rusty_anchor', name: 'Rusty Anchor', value: 9, weight: 6, desc: 'Far too small to be a real anchor... but oh so heavy.' },
  { id: 'seaweed', name: 'Seaweed Knot', value: 1, weight: 16, desc: 'Slimy, but fragrant.' },
  { id: 'message_bottle', name: 'Sealed Bottle', value: 5, weight: 5, openable: true, desc: 'Something rattles inside. You could open it...' },
];
const TREASURES = [
  { id: 'coin_pouch', name: 'Coin Pouch', value: 45, weight: 30, desc: 'Heavy with old coins.' },
  { id: 'pearl', name: 'Pearl', value: 120, weight: 20, desc: 'A lustrous pearl, shimmering softly.' },
  { id: 'rare_shell', name: 'Rare Shell', value: 150, weight: 16, desc: 'Spiralled, pearly and perfect.' },
  { id: 'old_compass', name: 'Old Compass', value: 200, weight: 12, desc: 'Its needle still points somewhere.' },
  { id: 'antique_reel', name: 'Antique Fishing Reel', value: 350, weight: 8, desc: 'Brass and beautifully made.' },
  { id: 'treasure_chest', name: 'Treasure Chest', value: 400, weight: 6, desc: 'A small chest, barnacled and full of glitter.' },
  { id: 'gold_idol', name: 'Golden Idol', value: 700, weight: 3, desc: 'A little golden fish idol, older than the harbor.' },
  { id: 'sunken_crown', name: 'Sunken Crown', value: 1100, weight: 1.5, desc: 'It belonged to someone important. Possibly a crab.' },
];
const LOOT_BY_ID = Object.fromEntries([...JUNK, ...TREASURES].map(x => [x.id, x]));

const BAIT_CATS = ['worm', 'minnow', 'shiny', 'crab', 'reef', 'kelp', 'moon', 'glow', 'arctic', 'ancient'];

Object.assign(__ex,{LAYER_NAMES, ZONE_ORDER, SPECIES_REQ, slug, SPECIES, SPECIES_BY_ID, speciesOfZone, JUNK, TREASURES, LOOT_BY_ID, BAIT_CATS});
};
__mods['zone-data.js']=function(__ex){
// Zone definitions: themes, unlock requirements, map positions.
// Equipment requirements are tier indices (0-based): boat:1 means "Coastal Skiff or better".
const ZONES = [
  {
    id: 'pebble', name: 'Pebble Cove', tier: 1, depthM: 24,
    blurb: 'A peaceful starting cove with gentle waves, grassy islands and sandy shallows.',
    req: {}, hint: 'Where every fisher begins.',
    suggested: 'Starter rod, worm or minnow bait', baits: ['worm', 'minnow', 'crab'],
    map: { x: 0.14, y: 0.68, r: 0.1, color: '#8fd3b4', shape: 'grass' },
    theme: {
      skyDay: ['#a9dcee', '#fbf0d6'], skyNight: ['#1d2b55', '#58628f'],
      water: ['#86d6cc', '#47aaae', '#23738c'], fog: '#1f6f86', seabed: '#e8d7a9', seabed2: '#cdb887',
      foam: '#f5fbf4', island: 'grass', deco: 'pebble', particles: 'bubble', dark: 0.0, rays: 0.5,
    },
  },
  {
    id: 'sunlit', name: 'Sunlit Bay', tier: 2, depthM: 32,
    blurb: 'A warm tropical bay: turquoise water, bright palm islands and colourful reef fish.',
    req: { boat: 1, prev: { zone: 'pebble', count: 8 } }, hint: 'Needs a sturdier boat to reach the bay.',
    suggested: 'Coastal Skiff, Reef Bait', baits: ['reef', 'shiny', 'minnow'],
    map: { x: 0.33, y: 0.4, r: 0.1, color: '#6fe0d6', shape: 'palm' },
    theme: {
      skyDay: ['#7fd4f2', '#ffeac0'], skyNight: ['#23306a', '#7a5f98'],
      water: ['#79ecdd', '#36c3c9', '#1d86a8'], fog: '#18809c', seabed: '#fbe8b8', seabed2: '#e8cf94',
      foam: '#ffffff', island: 'palm', deco: 'sunlit', particles: 'bubble', dark: 0.0, rays: 0.85,
    },
  },
  {
    id: 'kelp', name: 'Whispering Kelp', tier: 3, depthM: 40,
    blurb: 'A mysterious green kelp forest. Filtered sunlight, swaying fronds and the odd shipwreck.',
    req: { line: 1, prev: { zone: 'sunlit', count: 9 } }, hint: 'The kelp grows deep. A better line will help.',
    suggested: 'Braided line, Kelp Paste', baits: ['kelp', 'worm', 'crab'],
    map: { x: 0.52, y: 0.7, r: 0.1, color: '#6bbf8a', shape: 'kelp' },
    theme: {
      skyDay: ['#b5dcc8', '#f1ecd0'], skyNight: ['#1c2e48', '#4a6a7a'],
      water: ['#7fcf9c', '#3f9a78', '#1d5e60'], fog: '#17525a', seabed: '#b9a878', seabed2: '#8d8460',
      foam: '#eef8ea', island: 'cliff', deco: 'kelp', particles: 'mote', dark: 0.12, rays: 1.0,
    },
  },
  {
    id: 'coral', name: 'Coral Garden', tier: 4, depthM: 52,
    blurb: 'A riot of coral, anemones and shimmering schools drifting through bright water.',
    req: { boat: 2, prev: { zone: 'kelp', count: 9 } }, hint: 'The reef is far offshore. Needs a proper boat.',
    suggested: 'Harbor Runner, Reef Bait, Barbed Hook', baits: ['reef', 'moon', 'crab'],
    map: { x: 0.72, y: 0.36, r: 0.1, color: '#f29ab0', shape: 'reef' },
    theme: {
      skyDay: ['#8fd8f0', '#fff1d8'], skyNight: ['#2a2a66', '#8a5a8a'],
      water: ['#6fdce4', '#2fa8d0', '#1c68a8'], fog: '#184f86', seabed: '#f2dcc0', seabed2: '#d8b896',
      foam: '#ffffff', island: 'reef', deco: 'coral', particles: 'bubble', dark: 0.0, rays: 0.9,
    },
  },
  {
    id: 'twilight', name: 'Twilight Deep', tier: 5, depthM: 140,
    blurb: 'An indigo deep, lit only by bioluminescent creatures and drifting glowing motes.',
    req: { line: 3, prev: { zone: 'coral', count: 8 } }, hint: 'Only a deepwater line can reach these depths.',
    suggested: 'Deepwater Cable line, Deep Glow Bait', baits: ['glow', 'moon', 'minnow'],
    map: { x: 0.86, y: 0.72, r: 0.1, color: '#6a6cc0', shape: 'rocks' },
    theme: {
      skyDay: ['#3e4a8a', '#8a7ab0'], skyNight: ['#0f1236', '#2a2f66'],
      water: ['#3d4a9a', '#252c70', '#10133c'], fog: '#0a0c2c', seabed: '#4a4670', seabed2: '#332f55',
      foam: '#b8c4ff', island: 'rocks', deco: 'twilight', particles: 'glow', dark: 0.5, rays: 0.25,
    },
  },
  {
    id: 'frost', name: 'Frostfall Sea', tier: 6, depthM: 110,
    blurb: 'A northern sea of icebergs, drifting snow and shimmering aurora.',
    req: { boat: 5, prev: { zone: 'twilight', count: 9 } }, hint: 'Only an ice-capable vessel can break through the floes.',
    suggested: 'Arctic Vessel, Arctic Bait', baits: ['arctic', 'minnow', 'worm'],
    map: { x: 0.62, y: 0.12, r: 0.1, color: '#cfe8f8', shape: 'ice' },
    theme: {
      skyDay: ['#b4d4ec', '#f4f8fc'], skyNight: ['#0e2448', '#2a6a7a'],
      water: ['#a4d8ee', '#4f94c4', '#1e4a84'], fog: '#173a74', seabed: '#dbe8f4', seabed2: '#b0c4dc',
      foam: '#ffffff', island: 'ice', deco: 'frost', particles: 'snow', dark: 0.1, rays: 0.6,
    },
  },
  {
    id: 'trench', name: 'The Forgotten Trench', tier: 7, depthM: 320,
    blurb: 'Ancient ruins, glowing glyphs and impossible creatures in deep violet water.',
    req: { boat: 6, rod: 4, line: 5, hook: 4, secret: 'trench_chart' },
    hint: 'Needs the best gear and an ancient chart to find the way.',
    suggested: 'Abyssal Voyager, Starthread line, Ancient Bait', baits: ['ancient', 'glow', 'moon'],
    map: { x: 0.9, y: 0.34, r: 0.09, color: '#8a5ac8', shape: 'ruins' },
    theme: {
      skyDay: ['#4a3a7a', '#a070b8'], skyNight: ['#150a30', '#3a1e68'],
      water: ['#7a4ac0', '#4a2a90', '#1c0e52'], fog: '#0f0630', seabed: '#4a3a78', seabed2: '#2e2250',
      foam: '#d0b8ff', island: 'ruins', deco: 'trench', particles: 'rune', dark: 0.45, rays: 0.3,
    },
  },
];
const ZONE_BY_ID = Object.fromEntries(ZONES.map(z => [z.id, z]));
const ZONE_INDEX = Object.fromEntries(ZONES.map((z, i) => [z.id, i]));

Object.assign(__ex,{ZONES, ZONE_BY_ID, ZONE_INDEX});
};
__mods['fish-book.js']=function(__ex){
// Encyclopedia: discoveries, personal records, completion and collection milestones.
const { SPECIES, SPECIES_BY_ID, ZONE_ORDER } = __req('fish-data.js');
const { ZONES, ZONE_BY_ID } = __req('zone-data.js');
const { BAIT_BY_ID } = __req('upgrades.js');
const { earn } = __req('economy.js');

const MILESTONE_PCTS = [25, 50, 75, 100];

const ZONE_BAIT_REWARD = { pebble: 'shiny', sunlit: 'reef', kelp: 'kelp', coral: 'moon', twilight: 'glow', frost: 'arctic', trench: 'ancient' };
const ZONE_TITLES = {
  pebble: 'Cove Keeper', sunlit: 'Bay Beachcomber', kelp: 'Kelp Whisperer', coral: 'Reef Ranger',
  twilight: 'Deep Dreamer', frost: 'Frost Wanderer', trench: 'Trench Legend',
};
const DECOS = ZONES.map(z => ({
  id: 'deco_' + z.id, name: `${z.name.replace(/^The /, '')} Pennant`, zone: z.id, color: z.map.color,
}));
const DECO_BY_ID = Object.fromEntries(DECOS.map(d => [d.id, d]));
const ALL_TITLES = { ...Object.fromEntries(ZONE_ORDER.map(z => ['title_' + z, ZONE_TITLES[z]])), title_master: 'Tide Master', title_half: 'Seasoned Angler' };

function zoneProgress(state, zoneId) {
  const list = SPECIES.filter(s => s.zone === zoneId);
  const have = list.filter(s => state.book[s.id]).length;
  return { have, total: list.length, pct: list.length ? (have / list.length) * 100 : 0 };
}
function totalProgress(state) {
  const have = SPECIES.filter(s => state.book[s.id]).length;
  return { have, total: SPECIES.length, pct: (have / SPECIES.length) * 100 };
}
const discoveredCount = state => SPECIES.filter(s => state.book[s.id]).length;

/** Update records. Returns what changed so the UI can celebrate. */
function recordCatch(state, sp, item) {
  let b = state.book[sp.id];
  const isNew = !b;
  if (!b) b = state.book[sp.id] = { caught: 0, recW: 0, recL: 0, recV: 0, first: Date.now() };
  const newW = !isNew && item.w > b.recW;
  const newL = !isNew && item.l > b.recL;
  const newV = !isNew && item.value > b.recV;
  b.caught++;
  b.recW = Math.max(b.recW, item.w);
  b.recL = Math.max(b.recL, item.l);
  b.recV = Math.max(b.recV, item.value);
  const st = state.stats;
  st.fishCaught++;
  st.rarity[sp.rarity] = (st.rarity[sp.rarity] || 0) + 1;
  if (!st.bestW || item.w > st.bestW.v) st.bestW = { id: sp.id, v: item.w };
  if (!st.bestL || item.l > st.bestL.v) st.bestL = { id: sp.id, v: item.l };
  if (!st.bestV || item.value > st.bestV.v) st.bestV = { id: sp.id, v: item.value };
  return { isNew, newW, newL, newV };
}

// ---------- Milestones ----------
function allMilestones(state) {
  const out = [];
  for (const z of ZONES) {
    const p = zoneProgress(state, z.id);
    for (const pct of MILESTONE_PCTS) {
      const id = `${z.id}_${pct}`;
      out.push({ id, scope: z.id, pct, label: `${z.name} ${pct}%`, reward: rewardFor(z.id, pct, state), ready: p.pct >= pct, claimed: !!state.milestones[id] });
    }
  }
  const t = totalProgress(state);
  for (const pct of MILESTONE_PCTS) {
    const id = `all_${pct}`;
    out.push({ id, scope: 'all', pct, label: `Whole Fish Book ${pct}%`, reward: rewardFor('all', pct, state), ready: t.pct >= pct, claimed: !!state.milestones[id] });
  }
  return out;
}

function rewardFor(scope, pct, state) {
  if (scope === 'all') {
    const coins = { 25: 1500, 50: 8000, 75: 30000, 100: 100000 }[pct];
    if (pct === 50) return { kind: 'coins+title', coins, title: 'title_half', text: `${coins.toLocaleString()} coins & title "Seasoned Angler"` };
    if (pct === 100) return { kind: 'coins+title', coins, title: 'title_master', text: `${coins.toLocaleString()} coins & title "Tide Master"` };
    return { kind: 'coins', coins, text: `${coins.toLocaleString()} coins` };
  }
  const z = ZONE_BY_ID[scope];
  const tier = z.tier;
  if (pct === 25) { const c = Math.round(120 * Math.pow(tier, 1.9) / 5) * 5; return { kind: 'coins', coins: c, text: `${c.toLocaleString()} coins` }; }
  if (pct === 50) {
    const id = ZONE_BAIT_REWARD[scope];
    const owned = state && state.owned.bait.includes(id);
    const c = Math.round(300 * tier);
    return owned ? { kind: 'coins', coins: c, text: `${c} coins (you already own ${BAIT_BY_ID[id].name})` }
      : { kind: 'bait', bait: id, text: `Special bait: ${BAIT_BY_ID[id].name}` };
  }
  if (pct === 75) {
    const d = DECO_BY_ID['deco_' + scope];
    return { kind: 'deco', deco: d.id, text: `Boat decoration: ${d.name}` };
  }
  const c = Math.round(400 * Math.pow(tier, 1.9) / 5) * 5;
  return { kind: 'coins+title', coins: c, title: 'title_' + scope, text: `${c.toLocaleString()} coins & title "${ZONE_TITLES[scope]}"` };
}

/** Claim exactly once. The claimed flag is written before any reward is granted. */
function claimMilestone(state, id) {
  const m = allMilestones(state).find(x => x.id === id);
  if (!m) return { ok: false, msg: 'Unknown milestone.' };
  if (state.milestones[id]) return { ok: false, msg: 'Already claimed.' };
  if (!m.ready) return { ok: false, msg: 'Not reached yet.' };
  state.milestones[id] = true;
  const r = m.reward;
  if (r.coins) earn(state, r.coins);
  if (r.kind === 'bait' && !state.owned.bait.includes(r.bait)) state.owned.bait.push(r.bait);
  if (r.kind === 'deco' && !state.cosmetics.owned.includes(r.deco)) {
    state.cosmetics.owned.push(r.deco);
    if (!state.cosmetics.active) state.cosmetics.active = r.deco;
  }
  if (r.title && !state.cosmetics.titles.includes(r.title)) {
    state.cosmetics.titles.push(r.title);
    if (!state.cosmetics.title) state.cosmetics.title = r.title;
  }
  return { ok: true, msg: `Reward claimed: ${r.text}`, reward: r };
}

const claimableCount = state => allMilestones(state).filter(m => m.ready && !m.claimed).length;

function describeReq(sp) {
  if (!sp.req) return null;
  const r = sp.req;
  if (r.time) return `appears only at ${r.time}`;
  if (r.bait) return `is drawn to ${BAIT_BY_ID[r.bait].name}`;
  if (r.minRod != null) return 'only takes the strongest rods';
  return null;
}


Object.assign(__ex,{MILESTONE_PCTS, ZONE_BAIT_REWARD, ZONE_TITLES, DECOS, DECO_BY_ID, ALL_TITLES, zoneProgress, totalProgress, discoveredCount, recordCatch, allMilestones, rewardFor, claimMilestone, claimableCount, describeReq, SPECIES_BY_ID});
};
__mods['inventory.js']=function(__ex){
// Cargo hold: capacity, adding, favouriting and selling.
const { getEffects } = __req('upgrades.js');
const { earn, saleValue } = __req('economy.js');

const capacity = state => getEffects(state).cargoCap;
const count = state => state.cargo.length;
const isFull = state => state.cargo.length >= capacity(state);

function add(state, item) {
  if (isFull(state)) return false;
  item.uid = state.nextUid++;
  state.cargo.push(item);
  return true;
}

const find = (state, uid) => state.cargo.find(i => i.uid === uid) || null;

function toggleFav(state, uid) {
  const it = find(state, uid);
  if (!it) return false;
  it.fav = !it.fav;
  return it.fav;
}

/** Sell the given items. Favourites are protected and skipped. Items are removed before paying out (no double sales). */
function sell(state, uids) {
  const set = new Set(uids);
  const sold = [], kept = [];
  for (const it of state.cargo) {
    if (!set.has(it.uid)) { kept.push(it); continue; }
    if (it.fav) { kept.push(it); continue; }
    sold.push(it);
  }
  if (!sold.length) return { coins: 0, count: 0, skippedFav: uids.length > 0 && state.cargo.some(i => set.has(i.uid) && i.fav) };
  state.cargo = kept;
  let total = 0, fish = 0;
  for (const it of sold) {
    total += saleValue(state, it);
    if (it.kind === 'fish') fish++;
  }
  earn(state, total);
  state.stats.fishSold += fish;
  state.stats.itemsSold += sold.length;
  return { coins: total, count: sold.length, fish, skippedFav: state.cargo.some(i => set.has(i.uid) && i.fav) };
}

function sellKind(state, kinds) {
  const ids = state.cargo.filter(i => !i.fav && kinds.includes(i.kind)).map(i => i.uid);
  return sell(state, ids);
}

function expectedValue(state, uids) {
  const set = uids ? new Set(uids) : null;
  let t = 0;
  for (const it of state.cargo) if ((!set || set.has(it.uid)) && !it.fav) t += saleValue(state, it);
  return t;
}

Object.assign(__ex,{capacity, count, isFull, add, find, toggleFav, sell, sellKind, expectedValue});
};
__mods['fishing.js']=function(__ex){
// Fishing: encounter tables, catch generation and the fishing state machine.
const { CONFIG, RARITY, RARITY_IDS } = __req('config.js');
const { SPECIES, JUNK, TREASURES } = __req('fish-data.js');
const { ZONE_INDEX } = __req('zone-data.js');
const { getEffects } = __req('upgrades.js');
const { fishValue } = __req('economy.js');
const inventory = __req('inventory.js');

const FS = { READY: 'ready', CASTING: 'casting', DESCEND: 'descending', WAIT: 'waiting', BITE: 'bite', RETRIEVE: 'retrieving', PRESENT: 'presenting', FULL: 'cargoFull' };

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const rand = (a, b) => a + Math.random() * (b - a);

const layerOf = f => { const b = CONFIG.fishing.layerBounds; return f < b[0] ? 0 : f < b[1] ? 1 : 2; };

/** Day clock helpers. clock in [0,1): 0.25 = noon, 0.75 = midnight. */
const sunHeight = c => Math.sin(c * Math.PI * 2) + 0.3;
const nightness = c => clamp(0.5 - 2.2 * sunHeight(c), 0, 1);
const isNight = c => nightness(c) > 0.6;

function reqOK(sp, fx, night) {
  const r = sp.req;
  if (!r) return true;
  if (r.time === 'night' && !night) return false;
  if (r.bait && fx.bait.id !== r.bait) return false;
  if (r.minRod != null && fx.rodIdx < r.minRod) return false;
  return true;
}

/** Build the eligible encounter table [{sp, p}] with probabilities summing to 1. */
function buildTable(state, zoneId, depthFrac, clock) {
  const fx = getEffects(state);
  const night = isNight(clock);
  const layer = layerOf(depthFrac);
  const zoneSp = SPECIES.filter(s => s.zone === zoneId && s.size <= fx.hookCap && reqOK(s, fx, night));
  const withLayers = layers => zoneSp.filter(s => s.depths.some(d => layers.includes(d)));
  const hasBase = list => list.some(s => s.rarity === 'common');
  let cands = withLayers([layer]);
  if (!hasBase(cands)) {
    // widen towards shallower, then deeper layers so that something ordinary is always possible
    const order = [layer - 1, layer + 1, layer - 2, layer + 2].filter(l => l >= 0 && l <= 2);
    const layers = [layer];
    for (const l of order) { layers.push(l); cands = withLayers(layers); if (hasBase(cands)) break; }
  }
  if (!hasBase(cands)) cands = zoneSp.length ? zoneSp : SPECIES.filter(s => s.zone === zoneId && s.size <= 3 && !s.req);
  if (!cands.length) cands = SPECIES.filter(s => s.zone === zoneId).slice(0, 4);

  const spawnSum = {};
  for (const s of cands) spawnSum[s.rarity] = (spawnSum[s.rarity] || 0) + s.spawn;
  const rareFactor = [0, 0, 1, 1, 0.7, 0.4];
  const entries = cands.map(sp => {
    const R = RARITY[sp.rarity];
    let w = R.prob * (sp.spawn / spawnSum[sp.rarity]);
    if (sp.bait.includes(fx.bait.cat)) w *= CONFIG.fishing.baitBoost;
    w *= 1 + fx.rareBonus * rareFactor[R.index];
    return { sp, p: w };
  });
  normalize(entries);
  // Caps so stacked bonuses can never make top rarities ordinary
  for (let pass = 0; pass < 2; pass++) {
    for (const rid of ['mythic', 'legendary']) {
      const cap = CONFIG.rarityCaps[rid];
      const s = entries.filter(e => e.sp.rarity === rid).reduce((a, e) => a + e.p, 0);
      const others = 1 - s;
      if (s > cap && others > 0) {
        for (const e of entries) e.p = e.sp.rarity === rid ? e.p * (cap / s) : e.p * ((1 - cap) / others);
      }
    }
  }
  normalize(entries);
  return entries;
}
function normalize(entries) {
  const t = entries.reduce((a, e) => a + e.p, 0) || 1;
  for (const e of entries) e.p /= t;
}
function pickFromTable(entries) {
  let r = Math.random();
  for (const e of entries) { r -= e.p; if (r <= 0) return e.sp; }
  return entries[entries.length - 1].sp;
}

function pickWeighted(list) {
  const t = list.reduce((a, x) => a + x.weight, 0);
  let r = Math.random() * t;
  for (const x of list) { r -= x.weight; if (r <= 0) return x; }
  return list[list.length - 1];
}

/** Size: mostly average specimens, with the occasional exceptional one. */
function makeFish(state, sp, zoneId) {
  const fx = getEffects(state);
  const f = CONFIG.fishing;
  const variant = Math.random() < f.variantChance;
  let frac = Math.random() < f.exceptionalChance ? 0.85 + 0.15 * Math.random() : (Math.random() + Math.random() + Math.random()) / 3;
  let w = lerp(sp.wMin, sp.wMax, frac) * (1 + fx.sizeBonus);
  w = clamp(w, sp.wMin, variant ? sp.wMax * 1.08 : sp.wMax);
  const wf = sp.wMax > sp.wMin ? clamp((w - sp.wMin) / (sp.wMax - sp.wMin), 0, 1) : 0.5;
  const lf = clamp(wf + (Math.random() - 0.5) * 0.16, 0, 1);
  let l = lerp(sp.lMin, sp.lMax, lf);
  if (variant) l *= 1.04;
  w = Math.round(w * 1000) / 1000;
  l = Math.round(l * 10) / 10;
  return { kind: 'fish', id: sp.id, w, l, variant, value: fishValue(sp, w, variant), fav: false, zone: zoneId, t: Date.now() };
}

const FRAGMENT_ZONES = { coral: 'frag_coral', twilight: 'frag_twilight', frost: 'frag_frost' };

/** Roll one complete encounter. Returns {kind, sp?, item?, fragment?}. */
function rollEncounter(state, zoneId, depthFrac, clock) {
  const fx = getEffects(state);
  const ti = ZONE_INDEX[zoneId];
  const tChance = CONFIG.fishing.treasureChance * fx.treasureMult;
  const jChance = CONFIG.fishing.junkChance * fx.junkMult;
  const fid = FRAGMENT_ZONES[zoneId];
  // Map fragments: a small independent chance per cast until each one is found
  if (fid && !state.secrets.found[fid] && Math.random() < CONFIG.fishing.fragmentChance * (1 + (fx.treasureMult - 1) * 0.5)) return { kind: 'fragment', fragment: fid };
  const r = Math.random();
  if (r < tChance) {
    const def = pickWeighted(TREASURES);
    const value = Math.round(def.value * CONFIG.treasureZoneMult[ti] * rand(0.85, 1.15));
    return { kind: 'treasure', item: { kind: 'treasure', id: def.id, value, fav: false, zone: zoneId, t: Date.now() } };
  }
  if (r < tChance + jChance) {
    const def = pickWeighted(JUNK);
    const value = Math.max(1, Math.round(def.value * CONFIG.junkZoneMult[ti] * rand(0.8, 1.2)));
    return { kind: 'junk', item: { kind: 'junk', id: def.id, value, fav: false, zone: zoneId, t: Date.now() } };
  }
  const table = buildTable(state, zoneId, depthFrac, clock);
  const sp = pickFromTable(table);
  return { kind: 'fish', sp, item: makeFish(state, sp, zoneId) };
}

const ease = t => t * t * (3 - 2 * t);

class Fishing {
  constructor(game) {
    this.g = game;
    this.depth = CONFIG.fishing.defaultDepth;
    this.reset();
  }

  reset() {
    this.state = FS.READY;
    this.t = 0;
    this.hookFrac = 0;
    this.target = 0;
    this.pending = null;
    this.biteDelay = 0;
    this.retrieveDur = 0;
    this.presentDur = 0;
    this.last = null;
    this.flash = 0; // short "can't do that" feedback
  }

  get maxDepth() { return getEffects(this.g.state).maxDepth; }
  get busy() { return this.state !== FS.READY && this.state !== FS.FULL; }

  setDepth(f) {
    this.depth = clamp(Math.round(f / CONFIG.fishing.depthStep) * CONFIG.fishing.depthStep, CONFIG.fishing.minDepth, this.maxDepth);
    this.g.bus.emit('depth');
  }
  adjustDepth(dir) {
    if (this.busy) return;
    this.setDepth(this.depth + dir * CONFIG.fishing.depthStep);
  }
  clampDepth() { if (this.depth > this.maxDepth) this.setDepth(this.maxDepth); }

  canCast() {
    const s = this.g.state;
    if (this.g.state.mode !== 'fish') return { ok: false, reason: 'You are in the harbor.' };
    if (inventory.isFull(s)) return { ok: false, reason: 'Cargo is full! Return to the harbor to sell your catch.' };
    if (this.state !== FS.READY) return { ok: false, reason: '' };
    return { ok: true };
  }

  cast() {
    const c = this.canCast();
    if (!c.ok) {
      if (c.reason) { this.flash = 0.6; this.g.bus.emit('toast', { msg: c.reason, kind: 'warn' }); this.g.audio.sfx('error'); }
      return false;
    }
    this.clampDepth();
    this.target = clamp(this.depth, CONFIG.fishing.minDepth, this.maxDepth);
    this.state = FS.CASTING;
    this.t = 0;
    this.hookFrac = 0;
    this.g.audio.sfx('cast');
    this.g.bus.emit('cast');
    return true;
  }

  /** Abort any active line without awarding anything (used when leaving the zone or going to harbor). */
  cancel() {
    if (this.state === FS.PRESENT) this.finishPresentation();
    this.pending = null;
    this.reset();
    this.syncFull();
    this.g.bus.emit('fishingState');
  }

  syncFull() {
    if (this.state === FS.READY && inventory.isFull(this.g.state)) this.state = FS.FULL;
    else if (this.state === FS.FULL && !inventory.isFull(this.g.state)) this.state = FS.READY;
  }

  approach() {
    if (this.state === FS.WAIT) return clamp(this.t / Math.max(0.1, this.biteDelay - 0.8), 0, 1);
    if (this.state === FS.BITE) return 1;
    return 0;
  }

  set(state) { this.state = state; this.t = 0; this.g.bus.emit('fishingState', state); }

  update(dt) {
    const g = this.g, fx = getEffects(g.state), F = CONFIG.fishing;
    this.t += dt;
    this.flash = Math.max(0, this.flash - dt);
    switch (this.state) {
      case FS.READY: case FS.FULL: this.syncFull(); break;
      case FS.CASTING:
        if (this.t >= F.castTime * fx.castMult) {
          this.set(FS.DESCEND);
          this.hookFrac = 0;
          g.audio.sfx('splash', 0.5);
          g.audio.sfx('hook');
          g.bus.emit('fx', { type: 'splash', small: true });
        }
        break;
      case FS.DESCEND:
        this.hookFrac = Math.min(this.target, this.hookFrac + F.descendSpeed * dt);
        if (this.hookFrac >= this.target) {
          this.pending = rollEncounter(g.state, g.state.zone, this.target, g.state.clock);
          const floor = fx.castMult < 1 ? F.biteFloor * 0.6 : F.biteFloor;
          this.biteDelay = Math.max(floor, rand(F.biteMin, F.biteMax) * fx.biteMult);
          this.set(FS.WAIT);
        }
        break;
      case FS.WAIT:
        if (this.t >= this.biteDelay) { this.set(FS.BITE); g.audio.sfx('bite'); }
        break;
      case FS.BITE:
        if (this.t >= F.biteNibble) {
          this.retrieveDur = rand(F.retrieveMin, F.retrieveMax) * fx.retrieveMult;
          this.set(FS.RETRIEVE);
          g.audio.sfx('retrieve', this.retrieveDur);
        }
        break;
      case FS.RETRIEVE: {
        const p = Math.min(1, this.t / this.retrieveDur);
        this.hookFrac = this.target * (1 - ease(p));
        if (p >= 1) {
          this.hookFrac = 0;
          const pending = this.pending;
          this.pending = null; // consume first: a catch can only resolve once
          this.last = g.completeCatch(pending);
          const rid = this.last && this.last.rarity ? this.last.rarity : 'common';
          let d = F.presentTime[rid] || 1.8;
          if (this.last && this.last.isNew) d += 1.2;
          if (this.last && (this.last.newW || this.last.newL || this.last.newV)) d += 0.8;
          this.presentDur = d;
          this.set(FS.PRESENT);
        }
        break;
      }
      case FS.PRESENT:
        if (this.t >= this.presentDur) this.finishPresentation();
        break;
    }
  }

  finishPresentation() {
    if (this.state !== FS.PRESENT) return;
    this.last = null;
    this.state = inventory.isFull(this.g.state) ? FS.FULL : FS.READY;
    this.t = 0;
    this.g.bus.emit('presentationEnd');
    this.g.bus.emit('fishingState', this.state);
    if (this.state === FS.FULL) this.g.bus.emit('toast', { msg: 'Cargo is full! Head back to the harbor to sell your catch.', kind: 'warn' });
  }

  statusText() {
    if (this.g.state.mode === 'harbor') return 'Docked at the harbor';
    switch (this.state) {
      case FS.READY: return 'Ready. Press SPACE to cast';
      case FS.CASTING: return 'Casting...';
      case FS.DESCEND: return 'Lowering the hook...';
      case FS.WAIT: return 'Waiting for a bite...';
      case FS.BITE: return 'Something is nibbling!';
      case FS.RETRIEVE: return 'Reeling in...';
      case FS.PRESENT: return 'Nice catch!';
      case FS.FULL: return 'Cargo full. Return to the harbor';
    }
    return '';
  }
}


Object.assign(__ex,{FS, layerOf, sunHeight, nightness, isNight, buildTable, pickFromTable, makeFish, rollEncounter, Fishing, RARITY_IDS});
};
__mods['secrets.js']=function(__ex){
// Discoverable secrets. A secret is only marked found when its real requirements are met in play.
const { earn } = __req('economy.js');
const { BAITS } = __req('upgrades.js');

const SECRETS = [
  { id: 'prismatic', name: 'Prismatic Shimmer', reward: { coins: 500 },
    hint: 'Some fish wear colours no book has recorded. They are very rare.',
    clue: 'About 1 in 80 fish is a prismatic variant. Keep fishing, and keep looking.' },
  { id: 'wreck_secret', name: 'The Hidden Hold', reward: { coins: 800 },
    hint: 'Something is tangled in the wreckage of Whispering Kelp.',
    clue: 'Haul up 3 pieces of junk in Whispering Kelp to free the wreck\'s hidden hold.' },
  { id: 'frost_cave', name: 'Glacier Cave', reward: { coins: 3000 },
    hint: 'A shimmering cave mouth glitters in the cliffs of Frostfall Sea.',
    clue: 'Park your boat at the far left of Frostfall Sea, near the glittering cave, and catch 3 fish.' },
  { id: 'frag_coral', name: 'Map Fragment I', reward: {}, fragment: true,
    hint: 'Treasure hunters in the Coral Garden sometimes find torn parchment.',
    clue: 'A map fragment can turn up when you fish up treasure in Coral Garden.' },
  { id: 'frag_twilight', name: 'Map Fragment II', reward: {}, fragment: true,
    hint: 'Torn parchment drifts in the dark of Twilight Deep.',
    clue: 'A map fragment can turn up when you fish up treasure in Twilight Deep.' },
  { id: 'frag_frost', name: 'Map Fragment III', reward: {}, fragment: true,
    hint: 'Torn parchment is frozen into the Frostfall ice.',
    clue: 'A map fragment can turn up when you fish up treasure in Frostfall Sea.' },
  { id: 'trench_chart', name: 'The Trench Chart', reward: { coins: 2500 },
    hint: 'Three torn fragments from three seas make a map to a forgotten place.',
    clue: 'Collect all three Map Fragments to complete the chart and find the Forgotten Trench.' },
  { id: 'moonlit_catch', name: 'Moonlit Friend', reward: {},
    hint: 'Rare things stir when the moon is out.',
    clue: 'Catch a Rare (or better) fish at night. Something small and glowing will notice.' },
  { id: 'collector', name: 'Collector of Curiosities', reward: { coins: 1500 },
    hint: 'A true beachcomber has seen every kind of treasure.',
    clue: 'Find 4 different kinds of treasure.' },
  { id: 'bottle_reader', name: 'Message Reader', reward: { coins: 600 },
    hint: 'Sealed bottles hold secrets. Someone should read them.',
    clue: 'Open 3 sealed bottles from your cargo.' },
];
const SECRET_BY_ID = Object.fromEntries(SECRETS.map(s => [s.id, s]));

const isFound = (state, id) => !!state.secrets.found[id];

function findSecret(state, id) {
  const def = SECRET_BY_ID[id];
  if (!def || state.secrets.found[id]) return null;
  state.secrets.found[id] = Date.now();
  if (def.reward.coins) earn(state, def.reward.coins);
  return def;
}

/** Process a gameplay event, return array of newly found secret defs. */
function onEvent(state, ev) {
  const found = [];
  const push = id => { const d = findSecret(state, id); if (d) found.push(d); };
  const c = state.secrets.counters;
  if (ev.type === 'catch') {
    if (ev.variant) push('prismatic');
    if (ev.kind === 'junk' && ev.zone === 'kelp') { c.kelpJunk = (c.kelpJunk || 0) + 1; if (c.kelpJunk >= 3) push('wreck_secret'); }
    if (ev.zone === 'frost' && ev.boatX < 0.17) { c.caveCatches = (c.caveCatches || 0) + 1; if (c.caveCatches >= 3) push('frost_cave'); }
    if (ev.kind === 'fish' && ev.night && ev.rarityIndex >= 2) push('moonlit_catch');
    if (ev.kind === 'treasure') {
      if (!c.kinds) c.kinds = [];
      if (!c.kinds.includes(ev.id)) c.kinds.push(ev.id);
      if (c.kinds.length >= 4) push('collector');
    }
  } else if (ev.type === 'fragment') {
    push(ev.id);
  } else if (ev.type === 'bottle') {
    c.bottles = (c.bottles || 0) + 1;
    if (c.bottles >= 3) push('bottle_reader');
  }
  if (isFound(state, 'frag_coral') && isFound(state, 'frag_twilight') && isFound(state, 'frag_frost')) push('trench_chart');
  return found;
}

/** Open a sealed bottle item. Returns {ok, text}. Item is removed first so it cannot be opened twice. */
function openBottle(state, uid, tier) {
  const idx = state.cargo.findIndex(i => i.uid === uid && i.id === 'message_bottle');
  if (idx < 0) return { ok: false, text: 'Nothing to open.' };
  state.cargo.splice(idx, 1);
  const r = Math.random();
  const cluable = SECRETS.filter(s => !state.secrets.found[s.id] && !state.secrets.clues.includes(s.id));
  let text;
  if (r < 0.3 && cluable.length) {
    const s = cluable[Math.floor(Math.random() * cluable.length)];
    state.secrets.clues.push(s.id);
    text = `A faded note reads: "${s.clue}"`;
  } else if (r < 0.5) {
    const cand = BAITS.filter(b => !state.owned.bait.includes(b.id) && b.price <= 900 * tier);
    if (cand.length) {
      const b = cand[Math.floor(Math.random() * cand.length)];
      state.owned.bait.push(b.id);
      text = `Inside is a little pouch of ${b.name}!`;
    }
  }
  if (!text) {
    const coins = Math.round((30 + Math.random() * 60) * Math.pow(tier, 1.4));
    earn(state, coins);
    text = `A tiny purse tumbles out with ${coins} coins!`;
  }
  return { ok: true, text, bottle: true };
}

Object.assign(__ex,{SECRETS, SECRET_BY_ID, isFound, findSecret, onEvent, openBottle});
};
__mods['save.js']=function(__ex){
// Versioned localStorage saving, validation, migration, import/export.
const { CONFIG, RARITY_IDS } = __req('config.js');
const { SPECIES_BY_ID, LOOT_BY_ID } = __req('fish-data.js');
const { ZONE_BY_ID } = __req('zone-data.js');
const { RODS, LINES, HOOKS, BOATS, BAIT_BY_ID, BOOST_BY_ID } = __req('upgrades.js');
const { PET_BY_ID } = __req('pets.js');
const { SECRET_BY_ID } = __req('secrets.js');
const { DECO_BY_ID, ALL_TITLES } = __req('fish-book.js');

const TIERS = { rod: RODS.length, line: LINES.length, hook: HOOKS.length, boat: BOATS.length };

/** State that a prestige resets. */
function freshProgress() {
  return {
    coins: 25,
    zone: 'pebble',
    owned: { rod: [0], line: [0], hook: [0], boat: [0], bait: ['worm'] },
    equipped: { rod: 0, line: 0, hook: 0, boat: 0, bait: 'worm' },
    cargo: [],
    nextUid: 1,
    zonesUnlocked: ['pebble'],
    quests: { active: [], board: [], seq: 1 },
    boosts: {},
  };
}

function defaultState() {
  return {
    v: CONFIG.version,
    createdAt: Date.now(),
    ...freshProgress(),
    mode: 'fish',
    book: {},
    stats: {
      fishCaught: 0, fishSold: 0, itemsSold: 0, coinsEarned: 0, coinsSpent: 0, treasures: 0, junk: 0, requests: 0,
      rarity: Object.fromEntries(RARITY_IDS.map(r => [r, 0])), bestW: null, bestL: null, bestV: null, playSeconds: 0,
    },
    pets: { owned: ['cat'], active: 'cat' },
    milestones: {},
    secrets: { found: {}, clues: [], counters: {} },
    cosmetics: { owned: [], active: null, titles: [], title: null },
    prestige: { stars: 0, spentStars: 0, count: 0, runEarned: 0, perks: {} },
    settings: { music: 0.5, ambient: 0.6, sfx: 0.7, muteMusic: false, muteAmbient: false, muteSfx: false, muteAll: false, guide: true, lowFx: false },
    hints: { fish: false, sell: false, buy: false, harbor: false },
    introDone: false,
    clock: 0.15,
  };
}

const isObj = v => v && typeof v === 'object' && !Array.isArray(v);
const num = (v, d, min = 0, max = Infinity) => (typeof v === 'number' && Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : d);
const bool = (v, d) => (typeof v === 'boolean' ? v : d);

/** Turn arbitrary parsed data into a valid state. Missing/invalid fields fall back to defaults. */
function sanitize(raw) {
  if (!isObj(raw)) return null;
  const s = defaultState();
  s.createdAt = num(raw.createdAt, s.createdAt);
  s.coins = Math.floor(num(raw.coins, s.coins));
  s.zone = ZONE_BY_ID[raw.zone] ? raw.zone : 'pebble';
  s.mode = raw.mode === 'harbor' ? 'harbor' : 'fish';
  s.clock = num(raw.clock, s.clock, 0, 1);
  s.introDone = bool(raw.introDone, false);

  // Equipment
  const ro = isObj(raw.owned) ? raw.owned : {};
  for (const cat of Object.keys(TIERS)) {
    const arr = Array.isArray(ro[cat]) ? ro[cat].filter(i => Number.isInteger(i) && i >= 0 && i < TIERS[cat]) : [];
    s.owned[cat] = [...new Set([0, ...arr])].sort((a, b) => a - b);
  }
  s.owned.bait = [...new Set(['worm', ...(Array.isArray(ro.bait) ? ro.bait.filter(b => BAIT_BY_ID[b]) : [])])];
  const re = isObj(raw.equipped) ? raw.equipped : {};
  for (const cat of Object.keys(TIERS)) s.equipped[cat] = s.owned[cat].includes(re[cat]) ? re[cat] : Math.max(...s.owned[cat]);
  s.equipped.bait = s.owned.bait.includes(re.bait) ? re.bait : 'worm';

  // Cargo
  const seen = new Set();
  let maxUid = 0;
  if (Array.isArray(raw.cargo)) {
    for (const it of raw.cargo) {
      if (!isObj(it) || !Number.isInteger(it.uid) || seen.has(it.uid)) continue;
      const kind = it.kind;
      if (kind === 'fish') {
        if (!SPECIES_BY_ID[it.id] || !Number.isFinite(it.w) || !Number.isFinite(it.l) || !Number.isFinite(it.value)) continue;
        s.cargo.push({ uid: it.uid, kind, id: it.id, w: it.w, l: it.l, value: Math.max(1, Math.floor(it.value)), variant: !!it.variant, fav: !!it.fav, zone: String(it.zone || ''), t: num(it.t, 0) });
      } else if (kind === 'junk' || kind === 'treasure') {
        if (!LOOT_BY_ID[it.id] || !Number.isFinite(it.value)) continue;
        s.cargo.push({ uid: it.uid, kind, id: it.id, value: Math.max(1, Math.floor(it.value)), fav: !!it.fav, zone: String(it.zone || ''), t: num(it.t, 0) });
      } else continue;
      seen.add(it.uid);
      maxUid = Math.max(maxUid, it.uid);
    }
  }
  s.nextUid = Math.max(num(raw.nextUid, 1, 1), maxUid + 1);

  s.zonesUnlocked = [...new Set(['pebble', ...(Array.isArray(raw.zonesUnlocked) ? raw.zonesUnlocked.filter(z => ZONE_BY_ID[z]) : [])])];
  if (!s.zonesUnlocked.includes(s.zone)) s.zone = 'pebble';

  // Book
  if (isObj(raw.book)) {
    for (const [id, b] of Object.entries(raw.book)) {
      if (!SPECIES_BY_ID[id] || !isObj(b)) continue;
      s.book[id] = { caught: Math.floor(num(b.caught, 1, 0)), recW: num(b.recW, 0), recL: num(b.recL, 0), recV: num(b.recV, 0), first: num(b.first, Date.now()) };
    }
  }
  // Stats
  const rs = isObj(raw.stats) ? raw.stats : {};
  for (const k of ['fishCaught', 'fishSold', 'itemsSold', 'coinsEarned', 'coinsSpent', 'treasures', 'junk', 'requests', 'playSeconds']) s.stats[k] = num(rs[k], 0);
  if (isObj(rs.rarity)) for (const r of RARITY_IDS) s.stats.rarity[r] = num(rs.rarity[r], 0);
  for (const k of ['bestW', 'bestL', 'bestV']) if (isObj(rs[k]) && SPECIES_BY_ID[rs[k].id] && Number.isFinite(rs[k].v)) s.stats[k] = { id: rs[k].id, v: rs[k].v };

  // Pets
  const rp = isObj(raw.pets) ? raw.pets : {};
  s.pets.owned = [...new Set(['cat', ...(Array.isArray(rp.owned) ? rp.owned.filter(p => PET_BY_ID[p]) : [])])];
  s.pets.active = rp.active === null ? null : (s.pets.owned.includes(rp.active) ? rp.active : 'cat');

  // Quests
  const rq = isObj(raw.quests) ? raw.quests : {};
  const okQ = q => isObj(q) && Number.isInteger(q.id) && typeof q.type === 'string' && Number.isFinite(q.goal) && isObj(q.reward) && typeof q.title === 'string';
  const fixQ = q => ({ ...q, progress: num(q.progress, 0, 0, q.goal), done: !!q.done && num(q.progress, 0) >= q.goal || num(q.progress, 0) >= q.goal });
  s.quests.active = Array.isArray(rq.active) ? rq.active.filter(okQ).slice(0, CONFIG.quests.maxActive).map(fixQ) : [];
  s.quests.board = Array.isArray(rq.board) ? rq.board.filter(okQ).slice(0, CONFIG.quests.boardSize).map(fixQ) : [];
  s.quests.seq = Math.max(num(rq.seq, 1, 1), ...[...s.quests.active, ...s.quests.board].map(q => q.id + 1), 1);

  if (isObj(raw.milestones)) for (const [k, v] of Object.entries(raw.milestones)) if (v === true && /^[a-z]+_\d+$/.test(k)) s.milestones[k] = true;

  const rsec = isObj(raw.secrets) ? raw.secrets : {};
  if (isObj(rsec.found)) for (const [k, v] of Object.entries(rsec.found)) if (SECRET_BY_ID[k]) s.secrets.found[k] = num(v, Date.now());
  s.secrets.clues = Array.isArray(rsec.clues) ? [...new Set(rsec.clues.filter(c => SECRET_BY_ID[c]))] : [];
  if (isObj(rsec.counters)) {
    const c = rsec.counters;
    for (const k of ['kelpJunk', 'caveCatches', 'bottles']) if (Number.isFinite(c[k])) s.secrets.counters[k] = c[k];
    if (Array.isArray(c.kinds)) s.secrets.counters.kinds = c.kinds.filter(k => LOOT_BY_ID[k]);
  }

  const rc = isObj(raw.cosmetics) ? raw.cosmetics : {};
  s.cosmetics.owned = Array.isArray(rc.owned) ? [...new Set(rc.owned.filter(d => DECO_BY_ID[d]))] : [];
  s.cosmetics.active = s.cosmetics.owned.includes(rc.active) ? rc.active : null;
  s.cosmetics.titles = Array.isArray(rc.titles) ? [...new Set(rc.titles.filter(t => ALL_TITLES[t]))] : [];
  s.cosmetics.title = s.cosmetics.titles.includes(rc.title) ? rc.title : null;

  if (isObj(raw.boosts)) for (const [k, v] of Object.entries(raw.boosts)) if (BOOST_BY_ID[k] && Number.isFinite(v) && v > 0) s.boosts[k] = Math.min(v, BOOST_BY_ID[k].duration);

  const rpr = isObj(raw.prestige) ? raw.prestige : {};
  const pcfg = CONFIG.prestige.perks;
  s.prestige.stars = Math.floor(num(rpr.stars, 0));
  s.prestige.spentStars = Math.floor(num(rpr.spentStars, 0, 0, s.prestige.stars));
  s.prestige.count = Math.floor(num(rpr.count, 0));
  s.prestige.runEarned = num(rpr.runEarned, 0);
  if (isObj(rpr.perks)) for (const p of pcfg) if (Number.isFinite(rpr.perks[p.id])) s.prestige.perks[p.id] = Math.min(p.max, Math.max(0, Math.floor(rpr.perks[p.id])));

  const st = isObj(raw.settings) ? raw.settings : {};
  for (const k of ['music', 'ambient', 'sfx']) s.settings[k] = num(st[k], s.settings[k], 0, 1);
  for (const k of ['muteMusic', 'muteAmbient', 'muteSfx', 'muteAll', 'guide', 'lowFx']) s.settings[k] = bool(st[k], s.settings[k]);
  const rh = isObj(raw.hints) ? raw.hints : {};
  for (const k of ['fish', 'sell', 'buy', 'harbor']) s.hints[k] = bool(rh[k], false);
  return s;
}

const MIGRATIONS = {
  // Version 0 saves (unversioned prototypes) are structurally compatible; just stamp them.
  0: raw => { raw.v = 1; return raw; },
};
function migrate(raw) {
  if (!isObj(raw)) return null;
  let v = Number.isInteger(raw.v) ? raw.v : 0;
  while (v < CONFIG.version) {
    if (!MIGRATIONS[v]) break;
    raw = MIGRATIONS[v](raw);
    v = raw.v;
  }
  return raw;
}

// ---------- storage ----------
let memory = null; // fallback if localStorage is unavailable
const store = {
  get(k) { try { return localStorage.getItem(k); } catch (e) { return memory && memory[k] || null; } },
  set(k, v) { try { localStorage.setItem(k, v); return true; } catch (e) { (memory = memory || {})[k] = v; return false; } },
  del(k) { try { localStorage.removeItem(k); } catch (e) { if (memory) delete memory[k]; } },
};

function saveState(state) {
  try {
    state.v = CONFIG.version;
    return store.set(CONFIG.saveKey, JSON.stringify({ game: 'little-tides', v: CONFIG.version, savedAt: Date.now(), data: state }));
  } catch (e) { return false; }
}

/** Returns { state, status: 'new' | 'loaded' | 'recovered' } */
function loadState() {
  const txt = store.get(CONFIG.saveKey);
  if (!txt) return { state: defaultState(), status: 'new' };
  try {
    const parsed = JSON.parse(txt);
    const data = isObj(parsed) && isObj(parsed.data) ? parsed.data : parsed;
    const s = sanitize(migrate(data));
    if (s) return { state: s, status: 'loaded' };
    throw new Error('invalid');
  } catch (e) {
    store.set(CONFIG.saveKey + '-corrupt-backup', txt);
    return { state: defaultState(), status: 'recovered' };
  }
}

function resetSave() { store.del(CONFIG.saveKey); }

function exportString(state) {
  return JSON.stringify({ game: 'little-tides', v: CONFIG.version, exportedAt: Date.now(), data: state }, null, 1);
}
/** Validate and convert an import string. Returns state or null. */
function importString(str) {
  try {
    const parsed = JSON.parse(str);
    const data = isObj(parsed) && isObj(parsed.data) ? parsed.data : parsed;
    if (!isObj(data) || (parsed.game && parsed.game !== 'little-tides')) return null;
    if (data.coins === undefined && data.book === undefined && data.owned === undefined) return null;
    return sanitize(migrate(data));
  } catch (e) { return null; }
}

Object.assign(__ex,{freshProgress, defaultState, sanitize, migrate, saveState, loadState, resetSave, exportString, importString});
};
__mods['quests.js']=function(__ex){
// Harbor requests: generation, progress tracking from real gameplay events, claiming.
const { CONFIG, RARITY, RARITY_IDS } = __req('config.js');
const { SPECIES, SPECIES_BY_ID } = __req('fish-data.js');
const { ZONE_BY_ID } = __req('zone-data.js');
const { BAITS } = __req('upgrades.js');
const { SECRETS } = __req('secrets.js');
const { earn } = __req('economy.js');

const pick = arr => arr[Math.floor(Math.random() * arr.length)];
const r5 = n => Math.max(5, Math.round(n / 5) * 5);

function sig(q) { return `${q.type}:${q.species || ''}:${q.zone || ''}:${q.rarity || ''}`; }

function makeOffer(state, avoid) {
  const zones = state.zonesUnlocked;
  const z = pick(zones);
  const zone = ZONE_BY_ID[z];
  const tier = zone.tier;
  const types = ['species', 'species', 'weight', 'zonecatch', 'treasure', 'discover', 'rarity'];
  const qs = SPECIES.filter(s => s.zone === z && ['common', 'uncommon', 'rare'].includes(s.rarity) && !s.req);
  for (let tries = 0; tries < 12; tries++) {
    const type = pick(types);
    let q = null;
    if (type === 'species') {
      const sp = pick(qs);
      const goal = sp.rarity === 'rare' ? 2 : 2 + Math.floor(Math.random() * 3);
      q = { type, species: sp.id, zone: z, goal, title: `Catch ${goal} ${sp.name}`, desc: `The market wants ${goal} ${sp.name} from ${zone.name}.`,
        coins: r5(sp.baseValue * goal * RARITY[sp.rarity].mult * 2.4) };
    } else if (type === 'weight') {
      const sp = pick(qs.filter(s => s.rarity !== 'rare'));
      if (!sp) continue;
      const target = +(sp.wMin + (sp.wMax - sp.wMin) * 0.7).toFixed(2);
      q = { type, species: sp.id, zone: z, goal: 1, target, title: `A big ${sp.name}`, desc: `Find a ${sp.name} weighing at least ${target} kg.`,
        coins: r5(sp.baseValue * RARITY[sp.rarity].mult * 5) };
    } else if (type === 'zonecatch') {
      const goal = 4 + tier;
      q = { type, zone: z, goal, title: `${zone.name} Haul`, desc: `Catch ${goal} fish in ${zone.name}.`, coins: r5(CONFIG.zoneBase[tier - 1] * goal * 1.8) };
    } else if (type === 'treasure') {
      const goal = tier >= 4 ? 2 : 1;
      q = { type, goal, title: goal > 1 ? `Find ${goal} treasures` : 'Find a treasure', desc: `Fish up ${goal > 1 ? goal + ' treasures' : 'a treasure'} from the sea floor.`,
        coins: r5(CONFIG.treasureZoneMult[tier - 1] * 90 * goal) };
    } else if (type === 'discover') {
      const missing = SPECIES.filter(s => zones.includes(s.zone) && !state.book[s.id] && !s.req).length;
      if (missing < 1) continue;
      const goal = Math.min(missing, Math.random() < 0.4 ? 2 : 1);
      q = { type, goal, title: goal > 1 ? `Discover ${goal} new species` : 'Discover a new species', desc: `Catch ${goal > 1 ? goal + ' fish' : 'a fish'} you have never caught before.`,
        coins: r5(CONFIG.zoneBase[tier - 1] * 7 * goal) };
    } else {
      const ri = tier >= 4 ? 2 + Math.floor(Math.random() * 2) : 1 + Math.floor(Math.random() * 2);
      const rar = RARITY_IDS[ri];
      const goal = ri >= 3 ? 1 : 2;
      q = { type, rarity: rar, goal, title: `Catch ${goal} ${RARITY[rar].name}+ fish`,
        desc: `Catch ${goal} fish of ${RARITY[rar].name} rarity or better.`, coins: r5(CONFIG.zoneBase[tier - 1] * RARITY[rar].mult * goal * 2.2) };
    }
    if (!q) continue;
    if (avoid.has(sig(q))) continue;
    q.reward = { coins: q.coins };
    const x = Math.random();
    if (x < 0.18) {
      const cand = BAITS.filter(b => !state.owned.bait.includes(b.id) && b.price <= 700 * tier);
      if (cand.length) { const b = pick(cand); q.reward.bait = b.id; q.reward.baitName = b.name; }
    } else if (x < 0.3) {
      const cand = SECRETS.filter(s => !state.secrets.found[s.id] && !state.secrets.clues.includes(s.id));
      if (cand.length) q.reward.clue = pick(cand).id;
    }
    delete q.coins;
    q.progress = 0;
    q.done = false;
    q.id = state.quests.seq++;
    q.rarityIdx = q.rarity ? RARITY[q.rarity].index : undefined;
    return q;
  }
  return null;
}

function refillBoard(state) {
  const avoid = new Set([...state.quests.active, ...state.quests.board].map(sig));
  let guard = 0;
  while (state.quests.board.length < CONFIG.quests.boardSize && guard++ < 20) {
    const q = makeOffer(state, avoid);
    if (!q) continue;
    avoid.add(sig(q));
    state.quests.board.push(q);
  }
}

function accept(state, id) {
  if (state.quests.active.length >= CONFIG.quests.maxActive) return { ok: false, msg: 'You can only have 3 active requests.' };
  const i = state.quests.board.findIndex(q => q.id === id);
  if (i < 0) return { ok: false, msg: 'That request is gone.' };
  const [q] = state.quests.board.splice(i, 1);
  state.quests.active.push(q);
  refillBoard(state);
  return { ok: true, msg: `Accepted: ${q.title}` };
}

function abandon(state, id) {
  const i = state.quests.active.findIndex(q => q.id === id);
  if (i < 0) return { ok: false, msg: 'No such request.' };
  state.quests.active.splice(i, 1);
  refillBoard(state);
  return { ok: true, msg: 'Request dropped.' };
}

function reroll(state, spend) {
  if (!spend(state, CONFIG.quests.rerollCost)) return { ok: false, msg: 'Not enough coins.' };
  state.quests.board = [];
  refillBoard(state);
  return { ok: true, msg: 'The board has new requests.' };
}

function claim(state, id) {
  const i = state.quests.active.findIndex(q => q.id === id);
  if (i < 0) return { ok: false, msg: 'No such request.' };
  const q = state.quests.active[i];
  if (!q.done) return { ok: false, msg: 'Not finished yet.' };
  state.quests.active.splice(i, 1); // removed first: cannot be claimed twice
  state.stats.requests++;
  const extra = [];
  earn(state, q.reward.coins || 0);
  if (q.reward.bait && !state.owned.bait.includes(q.reward.bait)) { state.owned.bait.push(q.reward.bait); extra.push(q.reward.baitName); }
  if (q.reward.clue && !state.secrets.clues.includes(q.reward.clue)) {
    state.secrets.clues.push(q.reward.clue);
    extra.push('a clue');
  }
  refillBoard(state);
  return { ok: true, msg: `Request complete! +${(q.reward.coins || 0).toLocaleString()} coins${extra.length ? ' and ' + extra.join(', ') : ''}.`, quest: q };
}

/** Called once per gameplay event. Returns the quests that just became complete. */
function onEvent(state, ev) {
  const done = [];
  if (ev.type !== 'catch') return done;
  for (const q of state.quests.active) {
    if (q.done) continue;
    let inc = 0;
    switch (q.type) {
      case 'species': if (ev.kind === 'fish' && ev.sp.id === q.species) inc = 1; break;
      case 'weight': if (ev.kind === 'fish' && ev.sp.id === q.species && ev.item.w >= q.target) inc = 1; break;
      case 'zonecatch': if (ev.kind === 'fish' && ev.zone === q.zone) inc = 1; break;
      case 'treasure': if (ev.kind === 'treasure') inc = 1; break;
      case 'discover': if (ev.kind === 'fish' && ev.isNew) inc = 1; break;
      case 'rarity': if (ev.kind === 'fish' && RARITY[ev.sp.rarity].index >= q.rarityIdx) inc = 1; break;
    }
    if (inc) {
      q.progress = Math.min(q.goal, q.progress + inc);
      if (q.progress >= q.goal) { q.done = true; done.push(q); }
    }
  }
  return done;
}



Object.assign(__ex,{refillBoard, accept, abandon, reroll, claim, onEvent, SPECIES_BY_ID});
};
__mods['prestige.js']=function(__ex){
// Optional prestige ("Lighthouse"): resets coins and gear, keeps discoveries, records, pets and cosmetics.
const { CONFIG } = __req('config.js');
const { discoveredCount } = __req('fish-book.js');
const { freshProgress } = __req('save.js');

function requirements(state) {
  const c = CONFIG.prestige;
  return [
    { text: `Discover ${c.minDiscovered} species`, ok: discoveredCount(state) >= c.minDiscovered, now: discoveredCount(state), need: c.minDiscovered },
    { text: 'Unlock Twilight Deep', ok: state.zonesUnlocked.includes(c.needZone) },
  ];
}
const canPrestige = state => requirements(state).every(r => r.ok);
const starsGain = state => Math.max(1, Math.floor(Math.sqrt(state.prestige.runEarned / CONFIG.prestige.runEarnedDivisor)));

function perkCost(state, perk) {
  return (state.prestige.perks[perk.id] || 0) + 1;
}
function buyPerk(state, id) {
  const perk = CONFIG.prestige.perks.find(p => p.id === id);
  if (!perk) return { ok: false, msg: 'Unknown perk.' };
  const lvl = state.prestige.perks[id] || 0;
  if (lvl >= perk.max) return { ok: false, msg: 'Already at max level.' };
  const cost = perkCost(state, perk);
  if (state.prestige.stars - state.prestige.spentStars < cost) return { ok: false, msg: 'Not enough Tide Stars.' };
  state.prestige.spentStars += cost;
  state.prestige.perks[id] = lvl + 1;
  return { ok: true, msg: `${perk.name} is now level ${lvl + 1}.` };
}
const starsAvailable = state => state.prestige.stars - state.prestige.spentStars;

/** Perform the reset. Caller must have confirmed with the player. */
function doPrestige(state) {
  if (!canPrestige(state)) return { ok: false, msg: 'Requirements not met.' };
  const gain = starsGain(state);
  state.prestige.stars += gain;
  state.prestige.count++;
  state.prestige.runEarned = 0;
  Object.assign(state, freshProgress());
  return { ok: true, gain };
}

Object.assign(__ex,{requirements, canPrestige, starsGain, perkCost, buyPerk, starsAvailable, doPrestige});
};
__mods['game.js']=function(__ex){
// The central game object: owns the single state tree and coordinates all systems.
const { CONFIG, RARITY } = __req('config.js');
const { Bus } = __req('events.js');
const { loadState, saveState, resetSave, exportString, importString, defaultState } = __req('save.js');
const { ZONES, ZONE_BY_ID } = __req('zone-data.js');
const { SPECIES_BY_ID, LOOT_BY_ID } = __req('fish-data.js');
const { getEffects, maxOwned, BAIT_BY_ID, RODS, LINES, HOOKS, BOATS } = __req('upgrades.js');
const economy = __req('economy.js');
const inventory = __req('inventory.js');
const book = __req('fish-book.js');
const pets = __req('pets.js');
const quests = __req('quests.js');
const secrets = __req('secrets.js');
const prestige = __req('prestige.js');
const { Fishing, FS, isNight } = __req('fishing.js');
const { AudioEngine } = __req('audio.js');

function zoneRequirements(state, zone) {
  const r = zone.req, out = [];
  const have = cat => maxOwned(state, cat);
  const names = { boat: 'Boat', rod: 'Rod', line: 'Line', hook: 'Hook' };
  for (const cat of ['boat', 'rod', 'line', 'hook']) {
    if (r[cat] != null) out.push({ kind: cat, text: `${names[cat]}: ${TIER_NAMES[cat][r[cat]]} or better`, ok: have(cat) >= r[cat] });
  }
  if (r.prev) {
    const z = ZONE_BY_ID[r.prev.zone];
    const n = book.zoneProgress(state, r.prev.zone).have;
    out.push({ kind: 'species', text: `Discover ${r.prev.count} species in ${z.name} (${Math.min(n, r.prev.count)}/${r.prev.count})`, ok: n >= r.prev.count });
  }
  if (r.secret) out.push({ kind: 'secret', text: 'Find the ancient Trench Chart (a special discovery)', ok: !!state.secrets.found[r.secret] });
  return out;
}
const TIER_NAMES = { rod: RODS.map(x => x.name), line: LINES.map(x => x.name), hook: HOOKS.map(x => x.name), boat: BOATS.map(x => x.name) };

class Game {
  constructor() {
    this.bus = new Bus();
    const { state, status } = loadState();
    this.state = state;
    this.loadStatus = status;
    this.audio = new AudioEngine(this);
    this.fishing = new Fishing(this);
    this.paused = false;
    this.modalOpen = false;
    this.boatX = 0.5;
    this.boatVel = 0;
    this.boatDir = 1;
    this.axis = 0;
    this.saveTimer = 0;
    this.hudTimer = 0;
    this.lastSaveOk = true;
    this.moving = 0;
  }

  init() {
    const s = this.state;
    pets.checkPetUnlocks(s);
    quests.refillBoard(s);
    this.checkZoneUnlocks(true);
    this.fishing.clampDepth();
    this.fishing.syncFull();
    this.save();
  }

  get simPaused() { return this.paused || this.modalOpen; }
  get fx() { return getEffects(this.state); }
  get zone() { return ZONE_BY_ID[this.state.zone]; }
  get inHarbor() { return this.state.mode === 'harbor'; }

  // ---------- update ----------
  update(dt) {
    const s = this.state;
    if (this.paused) return;
    s.clock = (s.clock + dt / CONFIG.dayLength) % 1;
    s.stats.playSeconds += dt;
    // Boat movement
    const maxSpeed = 0.14 * this.fx.speed;
    // The boat is anchored from the cast until the catch has been reeled in
    const f = this.fishing.state;
    const anchored = f === FS.CASTING || f === FS.DESCEND || f === FS.WAIT || f === FS.BITE || f === FS.RETRIEVE;
    const target = this.modalOpen || this.inHarbor || anchored ? 0 : this.axis * maxSpeed;
    const k = target === 0 ? 3.2 : 4.5; // gentle deceleration, smooth acceleration
    this.boatVel += (target - this.boatVel) * Math.min(1, dt * k);
    if (Math.abs(this.boatVel) < 0.0008 && target === 0) this.boatVel = 0;
    this.boatX += this.boatVel * dt;
    if (this.boatX < 0.1) { this.boatX = 0.1; this.boatVel = Math.max(0, this.boatVel); }
    if (this.boatX > 0.9) { this.boatX = 0.9; this.boatVel = Math.min(0, this.boatVel); }
    if (this.boatVel > 0.01) this.boatDir = 1; else if (this.boatVel < -0.01) this.boatDir = -1;
    // Boost timers (only run while actually playing)
    if (!this.modalOpen) {
      for (const id of Object.keys(s.boosts)) {
        s.boosts[id] -= dt;
        if (s.boosts[id] <= 0) { delete s.boosts[id]; this.bus.emit('toast', { msg: `${id === 'rush' ? 'Fishing Rush' : 'A boost'} has run out.`, kind: 'info' }); this.bus.emit('state'); }
      }
    }
    if (!this.modalOpen && !this.inHarbor) this.fishing.update(dt);
    this.saveTimer += dt;
    if (this.saveTimer >= CONFIG.autosaveSeconds) { this.saveTimer = 0; this.save(); }
  }

  save() { this.lastSaveOk = saveState(this.state); return this.lastSaveOk; }

  // ---------- movement / modes ----------
  goHarbor() {
    if (this.inHarbor) return;
    this.fishing.cancel();
    this.state.mode = 'harbor';
    this.boatVel = 0;
    this.audio.sfx('ui');
    this.audio.setScene('harbor');
    this.bus.emit('mode');
    this.afterChange();
  }

  travel(zoneId) {
    const z = ZONE_BY_ID[zoneId];
    if (!z) return { ok: false, msg: 'Unknown zone.' };
    if (!this.state.zonesUnlocked.includes(zoneId)) return { ok: false, msg: 'That zone is still locked.' };
    this.fishing.cancel();
    this.state.zone = zoneId;
    this.state.mode = 'fish';
    this.boatX = 0.5;
    this.boatVel = 0;
    this.audio.sfx('unlock', 0.5);
    this.audio.setScene(zoneId);
    this.bus.emit('zone', zoneId);
    this.bus.emit('mode');
    this.afterChange();
    this.bus.emit('toast', { msg: `Sailing to ${z.name}`, kind: 'info' });
    if (!this.state.hints.fish) {
      this.state.hints.fish = true;
      this.bus.emit('toast', { msg: 'Tip: SPACE casts your line. W/S sets the depth. Be patient. The fish will come!', kind: 'hint', long: true });
    }
    return { ok: true };
  }

  // ---------- zone unlocks ----------
  checkZoneUnlocks(silent) {
    const s = this.state;
    for (const z of ZONES) {
      if (s.zonesUnlocked.includes(z.id)) continue;
      if (zoneRequirements(s, z).every(r => r.ok)) {
        s.zonesUnlocked.push(z.id);
        if (!silent) {
          this.bus.emit('toast', { msg: `New zone unlocked: ${z.name}!`, kind: 'unlock', long: true });
          this.audio.sfx('unlock');
        }
      }
    }
  }

  afterChange() {
    const s = this.state;
    for (const id of pets.checkPetUnlocks(s)) {
      this.bus.emit('toast', { msg: `New companion: ${pets.PET_BY_ID[id].name}!`, kind: 'unlock', long: true });
      this.audio.sfx('unlock');
    }
    this.checkZoneUnlocks(false);
    this.fishing.clampDepth();
    this.fishing.syncFull();
    this.save();
    this.bus.emit('state');
  }

  // ---------- catches ----------
  completeCatch(p) {
    const s = this.state;
    if (!p) return null;
    const zone = s.zone;
    const events = [];
    let info;
    if (p.kind === 'fragment') {
      s.stats.treasures++;
      const found = secrets.onEvent(s, { type: 'fragment', id: p.fragment });
      info = { kind: 'fragment', rarity: 'epic', name: secrets.SECRET_BY_ID[p.fragment].name, secret: found[0] };
      this.announceSecrets(found);
      this.audio.sfx('rare', 3);
      this.bus.emit('catch', info);
      this.afterChange();
      return info;
    }
    const item = p.item;
    if (!inventory.add(s, item)) {
      // Should be unreachable (casting is blocked when full) but never destroy value: pay out instead.
      economy.earn(s, economy.saleValue(s, item));
    }
    info = { kind: p.kind, item, sp: p.sp || null, rarity: p.sp ? p.sp.rarity : (p.kind === 'treasure' ? 'rare' : 'common') };
    const night = isNight(s.clock);
    if (p.kind === 'fish') {
      Object.assign(info, book.recordCatch(s, p.sp, item));
    } else if (p.kind === 'treasure') s.stats.treasures++;
    else s.stats.junk++;
    const ev = { type: 'catch', kind: p.kind, sp: p.sp, item, zone, id: item.id, isNew: !!info.isNew, night, boatX: this.boatX, variant: !!item.variant, rarityIndex: p.sp ? RARITY[p.sp.rarity].index : 0 };
    for (const q of quests.onEvent(s, ev)) this.bus.emit('toast', { msg: `Request complete: ${q.title}. Claim it at the harbor!`, kind: 'quest', long: true });
    const found = secrets.onEvent(s, ev);
    // Sound & feel
    if (p.kind === 'fish') {
      const ri = RARITY[p.sp.rarity].index;
      this.audio.sfx('catch', ri);
      if (info.isNew) setTimeout(() => this.audio.sfx('discover'), 350);
      if (info.newW || info.newL || info.newV) setTimeout(() => this.audio.sfx('record'), 600);
    } else this.audio.sfx(p.kind === 'treasure' ? 'rare' : 'catch', p.kind === 'treasure' ? 2 : 0);
    if (info.isNew && p.kind === 'fish') {
      const pct = book.totalProgress(s);
      info.bookPct = pct.pct;
    }
    this.bus.emit('catch', info);
    this.announceSecrets(found);
    if (!s.hints.sell && inventory.count(s) >= 3) {
      s.hints.sell = true;
      this.bus.emit('toast', { msg: 'Tip: when the hold fills up, press H (or the Harbor button) to sell your catch and buy upgrades.', kind: 'hint', long: true });
    }
    this.afterChange();
    return info;
  }

  announceSecrets(list) {
    for (const d of list) {
      this.bus.emit('toast', { msg: `Secret discovered: ${d.name}!${d.reward.coins ? ' +' + d.reward.coins.toLocaleString() + ' coins' : ''}`, kind: 'unlock', long: true });
      this.audio.sfx('unlock');
    }
  }

  // ---------- player actions (each validates, mutates, saves, notifies) ----------
  note(res, silentOk) {
    if (!res.ok) { this.bus.emit('toast', { msg: res.msg, kind: 'warn' }); this.audio.sfx('error'); }
    else if (!silentOk) this.bus.emit('toast', { msg: res.msg, kind: 'good' });
    return res;
  }

  sellItems(uids) {
    if (!this.inHarbor) return this.note({ ok: false, msg: 'Dock at the harbor to sell your catch.' });
    const r = inventory.sell(this.state, uids);
    return this.finishSale(r);
  }
  sellKinds(kinds) {
    if (!this.inHarbor) return this.note({ ok: false, msg: 'Dock at the harbor to sell your catch.' });
    return this.finishSale(inventory.sellKind(this.state, kinds));
  }
  finishSale(r) {
    if (!r.count) {
      this.note({ ok: false, msg: r.skippedFav ? 'Favorites are protected from sale.' : 'Nothing to sell.' });
      return r;
    }
    this.audio.sfx('coin', Math.min(5, r.count));
    this.bus.emit('toast', { msg: `Sold ${r.count} item${r.count > 1 ? 's' : ''} for ${r.coins.toLocaleString()} coins${r.skippedFav ? ' (favorites kept)' : ''}`, kind: 'coin' });
    this.bus.emit('sold', r);
    this.afterChange();
    return r;
  }
  toggleFav(uid) { inventory.toggleFav(this.state, uid); this.audio.sfx('ui'); this.afterChange(); }

  openBottle(uid) {
    const tier = ZONE_BY_ID[this.state.zone].tier;
    const r = secrets.openBottle(this.state, uid, tier);
    if (r.ok) {
      this.announceSecrets(secrets.onEvent(this.state, { type: 'bottle' }));
      this.audio.sfx('rare', 1);
    }
    this.note({ ok: r.ok, msg: r.text }, false);
    this.afterChange();
    return r;
  }

  firstBuyHint() {
    if (!this.state.hints.buy) {
      this.state.hints.buy = true;
      this.bus.emit('toast', { msg: 'Tip: new gear is equipped automatically. You can swap baits and gear any time in the Shop.', kind: 'hint', long: true });
    }
  }
  guard() { if (!this.inHarbor) { this.note({ ok: false, msg: 'Return to the harbor to shop.' }); return false; } return true; }
  buyTier(cat, idx) {
    if (!this.guard()) return { ok: false };
    const r = this.note(economy.buyTier(this.state, cat, idx));
    if (r.ok) { this.audio.sfx('purchase'); this.firstBuyHint(); this.afterChange(); }
    return r;
  }
  equipTier(cat, idx) {
    const r = this.note(economy.equipTier(this.state, cat, idx), true);
    if (r.ok) { this.audio.sfx('ui'); this.afterChange(); }
    return r;
  }
  buyBait(id) {
    if (!this.guard()) return { ok: false };
    const r = this.note(economy.buyBait(this.state, id));
    if (r.ok) { this.audio.sfx('purchase'); this.firstBuyHint(); this.afterChange(); }
    return r;
  }
  equipBait(id) {
    const r = this.note(economy.equipBait(this.state, id), true);
    if (r.ok) { this.audio.sfx('ui'); this.afterChange(); }
    return r;
  }
  buyBoost(id) {
    if (!this.guard()) return { ok: false };
    const r = this.note(economy.buyBoost(this.state, id));
    if (r.ok) { this.audio.sfx('purchase'); this.firstBuyHint(); this.afterChange(); }
    return r;
  }
  buyPet(id) {
    if (!this.guard()) return { ok: false };
    const r = this.note(pets.buyPet(this.state, id, economy.spend));
    if (r.ok) { this.audio.sfx('purchase'); this.state.pets.active = id; this.bus.emit('pet'); this.afterChange(); }
    return r;
  }
  selectPet(id) {
    if (pets.selectPet(this.state, id)) { this.audio.sfx('ui'); this.bus.emit('pet'); this.afterChange(); }
  }
  selectDeco(id) {
    if (id === null || this.state.cosmetics.owned.includes(id)) { this.state.cosmetics.active = id; this.audio.sfx('ui'); this.afterChange(); }
  }
  selectTitle(id) {
    if (id === null || this.state.cosmetics.titles.includes(id)) { this.state.cosmetics.title = id; this.audio.sfx('ui'); this.afterChange(); }
  }

  claimMilestone(id) {
    const r = this.note(book.claimMilestone(this.state, id));
    if (r.ok) { this.audio.sfx('unlock'); this.afterChange(); }
    return r;
  }
  claimAllMilestones() {
    let n = 0;
    for (const m of book.allMilestones(this.state)) if (m.ready && !m.claimed && book.claimMilestone(this.state, m.id).ok) n++;
    if (n) { this.audio.sfx('unlock'); this.bus.emit('toast', { msg: `Claimed ${n} reward${n > 1 ? 's' : ''}!`, kind: 'good' }); this.afterChange(); }
    return n;
  }

  acceptQuest(id) { const r = this.note(quests.accept(this.state, id), true); if (r.ok) { this.audio.sfx('ui'); this.afterChange(); } }
  abandonQuest(id) { const r = this.note(quests.abandon(this.state, id), true); if (r.ok) { this.audio.sfx('ui'); this.afterChange(); } }
  claimQuest(id) { const r = this.note(quests.claim(this.state, id)); if (r.ok) { this.audio.sfx('coin', 3); this.afterChange(); } }
  rerollQuests() { if (!this.guard()) return; const r = this.note(quests.reroll(this.state, economy.spend), true); if (r.ok) { this.audio.sfx('ui'); this.afterChange(); } }

  buyPerk(id) { const r = this.note(prestige.buyPerk(this.state, id)); if (r.ok) { this.audio.sfx('purchase'); this.afterChange(); } }
  doPrestige() {
    const r = prestige.doPrestige(this.state);
    if (!r.ok) return this.note(r);
    this.fishing.cancel();
    this.boatX = 0.5;
    quests.refillBoard(this.state);
    this.audio.sfx('catch', 5);
    this.audio.setScene('harbor');
    this.bus.emit('zone', 'pebble');
    this.bus.emit('mode');
    this.bus.emit('toast', { msg: `The tide turns! You earned ${r.gain} Tide Star${r.gain > 1 ? 's' : ''}.`, kind: 'unlock', long: true });
    this.state.mode = 'harbor';
    this.afterChange();
    return r;
  }

  setSetting(k, v) {
    this.state.settings[k] = v;
    this.audio.applySettings();
    this.bus.emit('state');
  }
  markIntroDone() { this.state.introDone = true; this.state.hints.fish = true; this.save(); }

  // ---------- save management ----------
  exportSave() { return exportString(this.state); }
  importSave(str) {
    const s = importString(str);
    if (!s) return { ok: false, msg: 'That does not look like a valid Little Tides save.' };
    this.replaceState(s);
    return { ok: true, msg: 'Save imported!' };
  }
  resetAll() {
    resetSave();
    const s = defaultState();
    s.introDone = true;
    this.replaceState(s);
  }
  replaceState(s) {
    this.fishing.cancel();
    this.state = s;
    pets.checkPetUnlocks(s);
    quests.refillBoard(s);
    this.checkZoneUnlocks(true);
    this.boatX = 0.5;
    this.boatVel = 0;
    this.audio.applySettings();
    this.audio.setScene(s.mode === 'harbor' ? 'harbor' : s.zone);
    this.fishing.reset();
    this.fishing.clampDepth();
    this.fishing.syncFull();
    this.save();
    this.bus.emit('zone', s.zone);
    this.bus.emit('mode');
    this.bus.emit('state');
  }
}


Object.assign(__ex,{zoneRequirements, Game, FS, SPECIES_BY_ID, LOOT_BY_ID, BAIT_BY_ID});
};
__mods['input.js']=function(__ex){
// Keyboard input. Gameplay keys never fire while typing and never scroll the page.
const GAME_KEYS = new Set(['Space', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'KeyA', 'KeyD', 'KeyW', 'KeyS']);

class Input {
  constructor(game, ui) {
    this.g = game; this.ui = ui; this.keys = new Set();
    this.kd = this.kd.bind(this); this.ku = this.ku.bind(this); this.blur = this.blur.bind(this);
  }
  attach() {
    window.addEventListener('keydown', this.kd);
    window.addEventListener('keyup', this.ku);
    window.addEventListener('blur', this.blur);
    document.addEventListener('visibilitychange', this.blur);
  }
  detach() {
    window.removeEventListener('keydown', this.kd);
    window.removeEventListener('keyup', this.ku);
    window.removeEventListener('blur', this.blur);
    document.removeEventListener('visibilitychange', this.blur);
  }
  blur() { this.keys.clear(); this.g.axis = 0; }

  typing(t) {
    if (!t || !t.tagName) return false;
    const tag = t.tagName;
    if (tag === 'TEXTAREA' || tag === 'SELECT' || t.isContentEditable) return true;
    if (tag === 'INPUT') return !['checkbox', 'button', 'radio'].includes(t.type);
    return false;
  }

  updateAxis() {
    const k = this.keys;
    const l = k.has('ArrowLeft') || k.has('KeyA'), r = k.has('ArrowRight') || k.has('KeyD');
    this.g.axis = (r ? 1 : 0) - (l ? 1 : 0);
  }

  kd(e) {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.code === 'Escape') {
      if (!e.repeat) this.ui.handleEsc();
      e.preventDefault();
      return;
    }
    if (this.typing(e.target)) return;
    const code = e.code, modal = this.ui.modalOpen;
    if (GAME_KEYS.has(code) && (!modal || e.target === document.body)) e.preventDefault();
    if (modal) {
      if (code === 'Enter' && !e.repeat && !(e.target && e.target.tagName === 'BUTTON')) { e.preventDefault(); this.ui.handleEnter(); }
      return;
    }
    this.keys.add(code);
    this.updateAxis();
    if (e.repeat) return;
    switch (code) {
      case 'Space': if (this.ui.catchVisible) this.ui.dismissCatch(); else this.g.fishing.cast(); break;
      case 'Enter': if (this.ui.catchVisible) this.ui.dismissCatch(); break;
      case 'ArrowUp': case 'KeyW': this.g.fishing.adjustDepth(-1); break;
      case 'ArrowDown': case 'KeyS': this.g.fishing.adjustDepth(1); break;
      case 'KeyH': this.ui.toggleHarbor(); break;
      case 'KeyM': this.ui.open('map'); break;
      case 'KeyB': this.ui.open('book'); break;
      case 'KeyC': this.ui.open('cargo'); break;
      case 'KeyP': this.ui.open('pets'); break;
    }
  }
  ku(e) {
    this.keys.delete(e.code);
    this.updateAxis();
    if (e.code === 'Space' && !this.typing(e.target) && !this.ui.modalOpen) e.preventDefault();
  }
}

Object.assign(__ex,{Input});
};
__mods['renderer.js']=function(__ex){
// Canvas 2D renderer: fishing scene, harbor scene, particles and all procedural scenery.
const { INK, TAU, clamp, lerp, hash, mix, rgba, shade, smoothPath, organic, paint, glow, sparkle, bubble, cloud, gull, island, drawBoat, drawFisherman, drawPet, BOAT_META } = __req('draw.js');
const { drawFish, fishPixels, drawLoot } = __req('fish-art.js');
const { SPECIES, SPECIES_BY_ID } = __req('fish-data.js');
const { ZONE_BY_ID } = __req('zone-data.js');
const { RODS, getEffects } = __req('upgrades.js');
const { DECO_BY_ID } = __req('fish-book.js');
const { FS, layerOf, nightness } = __req('fishing.js');
const { CONFIG, RARITY } = __req('config.js');

const rnd = (a, b) => a + Math.random() * (b - a);

function makeGrain() {
  const c = document.createElement('canvas'); c.width = c.height = 160;
  const g = c.getContext('2d'), d = g.createImageData(160, 160);
  for (let i = 0; i < d.data.length; i += 4) { const v = 110 + Math.random() * 100 | 0; d.data[i] = v; d.data[i + 1] = v - 6; d.data[i + 2] = v - 14; d.data[i + 3] = Math.random() * 40; }
  g.putImageData(d, 0, 0);
  return c;
}

class Renderer {
  constructor(canvas, game) {
    this.cv = canvas; this.ctx = canvas.getContext('2d'); this.g = game;
    this.t = 0; this.parts = []; this.W = 800; this.H = 600; this.dpr = 1;
    this.grain = makeGrain(); this.grainPat = null;
    this.hookX = 0.5; this.hookY = 0; this.ds = 1; this.petHappy = 0; this.flash = null; this.shake = 0;
    this.biteFish = null; this.world = null; this.hot = []; this.hover = null; this.spawnAcc = 0;
    this.lastState = FS.READY; this.splashDone = false; this.tipW = { x: 0, y: 0 };
    this.mouse = { x: -1, y: -1 };
    this.resize = this.resize.bind(this);
    window.addEventListener('resize', this.resize);
    this.resize();
    this.offs = [
      game.bus.on('zone', () => this.initWorld()),
      game.bus.on('fx', e => this.onFx(e)),
      game.bus.on('catch', e => this.onCatch(e)),
      game.bus.on('cast', () => { this.splashDone = false; }),
    ];
    this.initWorld();
  }

  destroy() { window.removeEventListener('resize', this.resize); this.offs.forEach(o => o()); }

  resize() {
    const r = this.cv.getBoundingClientRect();
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.W = Math.max(320, r.width); this.H = Math.max(240, r.height);
    this.cv.width = Math.round(this.W * this.dpr); this.cv.height = Math.round(this.H * this.dpr);
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.grainPat = this.ctx.createPattern(this.grain, 'repeat');
  }

  // ---------- world setup ----------
  initWorld() {
    const zone = ZONE_BY_ID[this.g.state.zone], th = zone.theme;
    const sp = SPECIES.filter(s => s.zone === zone.id && s.size <= 5 && s.body !== 'leviathan');
    const w = {
      zone, th, seed: zone.tier * 17,
      clouds: Array.from({ length: 6 }, (_, i) => ({ x: Math.random(), y: 0.03 + Math.random() * 0.17, s: rnd(0.6, 1.3), v: rnd(0.004, 0.012), seed: i * 3 + zone.tier })),
      birds: Array.from({ length: th.dark > 0.3 ? 0 : 4 }, () => ({ x: Math.random(), y: 0.08 + Math.random() * 0.14, v: rnd(0.012, 0.03), ph: Math.random() * 6 })),
      stars: Array.from({ length: 70 }, () => ({ x: Math.random(), y: Math.random() * 0.3, r: rnd(0.5, 1.6), ph: Math.random() * 6 })),
      fish: Array.from({ length: 11 }, () => this.newAmbient(sp, true)),
      schools: Array.from({ length: 2 }, (_, i) => ({ x: Math.random(), d: 0.2 + i * 0.3 + Math.random() * 0.1, v: (i % 2 ? -1 : 1) * rnd(0.03, 0.05), n: 9, ph: Math.random() * 6, col: i ? th.water[0] : '#ffffff' })),
      deco: this.makeDeco(zone),
      sp,
    };
    this.world = w;
    this.parts.length = 0;
    this.biteFish = null;
  }

  newAmbient(list, anywhere) {
    const tot = list.reduce((a, s) => a + s.spawn, 0); let r = Math.random() * tot, sp = list[0];
    for (const s of list) { r -= s.spawn; if (r <= 0) { sp = s; break; } }
    const layer = sp.depths[Math.floor(Math.random() * sp.depths.length)];
    const d = clamp(layer * 0.33 + 0.1 + Math.random() * 0.28, 0.08, 0.93);
    const dir = Math.random() < 0.5 ? 1 : -1;
    return { sp, x: anywhere ? Math.random() * 1.2 - 0.1 : (dir > 0 ? -0.15 : 1.15), d, dir, v: rnd(0.02, 0.06), ph: Math.random() * 10, size: rnd(0.8, 1.15), bobA: rnd(0.005, 0.02), len: lerp(sp.lMin, sp.lMax, Math.random() * 0.8) };
  }

  makeDeco(zone) {
    const out = [], n = 26, id = zone.theme.deco;
    const pools = {
      pebble: ['pebbles', 'rock', 'grass', 'shell', 'grass', 'pebbles'], sunlit: ['coral_fan', 'coral_brain', 'grass', 'shell', 'coral_branch', 'rock'],
      kelp: ['kelp', 'kelp', 'kelp', 'rock', 'grass', 'kelp'], coral: ['coral_branch', 'coral_brain', 'coral_fan', 'anemone', 'coral_branch', 'rock'],
      twilight: ['rock', 'shroom', 'tubeworm', 'crystal', 'shroom', 'rock'], frost: ['ice_wall', 'crystal', 'rock', 'ice_wall', 'crystal', 'rock'],
      trench: ['pillar', 'rock', 'crystal', 'arch', 'glyph', 'rock'],
    }[id];
    for (let i = 0; i < n; i++) {
      const u = i / n;
      out.push({ type: pools[Math.floor(hash(i * 3 + zone.tier) * pools.length)], x: u + hash(i + zone.tier * 9) * (0.6 / n), s: 0.6 + hash(i * 7 + zone.tier) * 0.9, seed: i * 5 + zone.tier * 100, front: hash(i * 11) > 0.55 });
    }
    if (id === 'kelp') out.push({ type: 'wreck', x: 0.8, s: 1.6, seed: 5, front: false });
    if (id === 'trench') { out.push({ type: 'pillar', x: 0.2, s: 1.8, seed: 2, front: false }); out.push({ type: 'arch', x: 0.62, s: 1.9, seed: 3, front: false }); }
    return out.sort((a, b) => (a.front === b.front ? 0 : a.front ? 1 : -1));
  }

  // ---------- events ----------
  onFx(e) {
    if (e.type === 'splash') this.splash(this.hookWorld().x, this.layout().wl, e.small ? 0.6 : 1.4);
  }
  onCatch(info) {
    this.petHappy = 1.3;
    const L = this.layout(), b = this.boatPos();
    const ri = info.sp ? RARITY[info.sp.rarity].index : (info.kind === 'treasure' ? 2 : 0);
    const col = RARITY[info.rarity || 'common'].color;
    const n = [8, 14, 24, 40, 80, 140][ri] * (this.g.state.settings.lowFx ? 0.5 : 1);
    for (let i = 0; i < n; i++) this.parts.push({ type: 'spark', x: b.x + rnd(-40, 40) * L.u, y: b.y - rnd(40, 100) * L.u, vx: rnd(-90, 90) * (1 + ri * 0.2), vy: rnd(-220, -40) * (1 + ri * 0.15), g: 260, life: 0, max: rnd(0.8, 1.6), size: rnd(2, 5 + ri), color: Math.random() < 0.5 ? col : (ri >= 5 ? '#ffd0f0' : '#fff6c8') });
    if (ri >= 4) this.flash = { color: ri >= 5 ? '#ff9ad0' : '#ffd870', t: 0, max: ri >= 5 ? 1.8 : 1.2 };
    this.splash(b.x + 70 * L.u * this.ds, L.wl, 1);
  }
  splash(x, y, k = 1) {
    const n = Math.round(10 * k * (this.g.state.settings.lowFx ? 0.5 : 1));
    for (let i = 0; i < n; i++) this.parts.push({ type: 'drop', x: x + rnd(-8, 8), y, vx: rnd(-50, 50), vy: rnd(-180, -60) * k, g: 420, life: 0, max: rnd(0.5, 0.9), size: rnd(1.5, 3.5) });
    this.parts.push({ type: 'ring', x, y, life: 0, max: 0.9, size: 8 * k });
  }

  // ---------- layout ----------
  layout() {
    const W = this.W, H = this.H;
    const u = clamp(Math.min(W / 1280, H / 720), 0.55, 1.35);
    const wl = H * 0.36, sb = H * 0.93;
    return { W, H, u, wl, sb };
  }
  yOfDepth(f) { const L = this.layout(); return L.wl + 10 * L.u + f * (L.sb - L.wl - 50 * L.u); }
  boatPos() {
    const L = this.layout(), g = this.g;
    const bob = Math.sin(this.t * 1.4) * 3 * L.u + Math.sin(this.t * 0.7 + 2) * 1.5 * L.u;
    return { x: g.boatX * L.W, y: L.wl + bob, tilt: Math.sin(this.t * 1.1 + 1) * 0.022 + clamp(g.boatVel * 0.5, -0.05, 0.05) };
  }
  toWorld(lx, ly) {
    const L = this.layout(), b = this.boatPos(), c = Math.cos(b.tilt), s = Math.sin(b.tilt);
    const x1 = lx * L.u * this.ds, y1 = ly * L.u;
    return { x: b.x + x1 * c - y1 * s, y: b.y + x1 * s + y1 * c };
  }
  hookWorld() { return { x: this.hookX * this.layout().W, y: this.hookY }; }

  // ---------- main frame ----------
  frame(dt, mouse) {
    dt = Math.min(dt, 0.05);
    this.t += dt;
    if (mouse) this.mouse = mouse;
    const ctx = this.ctx, g = this.g, L = this.layout();
    ctx.save();
    ctx.clearRect(0, 0, L.W, L.H);
    this.petHappy = Math.max(0, this.petHappy - dt);
    if (this.shake > 0) { this.shake -= dt; ctx.translate(Math.sin(this.t * 60) * 3 * this.shake, 0); }
    const target = g.boatDir; this.ds += (target - this.ds) * Math.min(1, dt * 9);
    if (g.state.mode === 'harbor') this.drawHarbor(ctx, L, dt);
    else this.drawSea(ctx, L, dt);
    this.updateParts(dt);
    this.drawParts(ctx, L);
    // storybook finishing: paper grain + soft vignette
    ctx.globalAlpha = 0.5; ctx.fillStyle = this.grainPat; ctx.fillRect(0, 0, L.W, L.H); ctx.globalAlpha = 1;
    const v = ctx.createRadialGradient(L.W / 2, L.H / 2, Math.min(L.W, L.H) * 0.45, L.W / 2, L.H / 2, Math.max(L.W, L.H) * 0.75);
    v.addColorStop(0, 'rgba(40,30,20,0)'); v.addColorStop(1, 'rgba(40,30,20,0.22)');
    ctx.fillStyle = v; ctx.fillRect(0, 0, L.W, L.H);
    if (this.flash) {
      this.flash.t += dt; const k = 1 - this.flash.t / this.flash.max;
      if (k <= 0) this.flash = null; else { ctx.fillStyle = rgba(this.flash.color, 0.28 * k); ctx.fillRect(0, 0, L.W, L.H); }
    }
    ctx.restore();
  }

  // ---------- sky ----------
  drawSky(ctx, L, th, night, dt, wlY) {
    const top = mix(th.skyDay[0], th.skyNight[0], night), bot = mix(th.skyDay[1], th.skyNight[1], night);
    const g = ctx.createLinearGradient(0, 0, 0, wlY); g.addColorStop(0, top); g.addColorStop(1, bot);
    ctx.fillStyle = g; ctx.fillRect(0, 0, L.W, wlY + 2);
    const w = this.world, clock = this.g.state.clock;
    // stars
    if (night > 0.1) for (const s of w.stars) { ctx.globalAlpha = night * (0.5 + 0.5 * Math.sin(this.t * 1.5 + s.ph)); ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(s.x * L.W, s.y * wlY * 1.4, s.r * L.u, 0, TAU); ctx.fill(); }
    ctx.globalAlpha = 1;
    // aurora
    if (th.island === 'ice') {
      const a = 0.3 + night * 0.6;
      for (let i = 0; i < 4; i++) {
        ctx.beginPath(); ctx.moveTo(0, wlY * 0.5);
        for (let x = 0; x <= L.W; x += 24) ctx.lineTo(x, wlY * (0.18 + i * 0.06) + Math.sin(x * 0.006 + this.t * 0.5 + i) * 22 * L.u + Math.sin(x * 0.013 - this.t * 0.8) * 8);
        ctx.lineTo(L.W, wlY * 0.7); ctx.lineTo(0, wlY * 0.7); ctx.closePath();
        const gg = ctx.createLinearGradient(0, wlY * 0.1, 0, wlY * 0.7); const c = ['#7af0c8', '#9ab8ff', '#c8a0ff', '#7ae0ff'][i];
        gg.addColorStop(0, rgba(c, 0.5 * a)); gg.addColorStop(1, rgba(c, 0));
        ctx.fillStyle = gg; ctx.fill();
      }
    }
    // sun & moon on arcs
    const sunA = clock * TAU - Math.PI / 2 + Math.PI / 2; // 0.25 = noon
    const ang = (clock - 0.0) * TAU;
    const sx = L.W * (0.5 - Math.cos(ang) * 0.42), sy = wlY * 0.95 - Math.sin(ang) * wlY * 0.85;
    const mx = L.W * (0.5 + Math.cos(ang) * 0.42), my = wlY * 0.95 + Math.sin(ang) * wlY * 0.85;
    if (sy < wlY) { glow(ctx, sx, sy, 90 * L.u, '#fff1b0', 0.55 * (1 - night)); ctx.beginPath(); ctx.arc(sx, sy, 24 * L.u, 0, TAU); paint(ctx, '#ffe9a0', 2, '#d9a550'); }
    if (my < wlY && night > 0.2) { ctx.globalAlpha = night; glow(ctx, mx, my, 70 * L.u, '#dfe8ff', 0.4); ctx.beginPath(); ctx.arc(mx, my, 18 * L.u, 0, TAU); paint(ctx, '#f4f0dc', 1.6, '#8a98b8'); ctx.fillStyle = 'rgba(160,170,200,.35)'; ctx.beginPath(); ctx.arc(mx - 5 * L.u, my - 3 * L.u, 4 * L.u, 0, TAU); ctx.arc(mx + 6 * L.u, my + 5 * L.u, 3 * L.u, 0, TAU); ctx.fill(); ctx.globalAlpha = 1; }
    // clouds
    for (const c of w.clouds) {
      c.x += c.v * dt * 0.5; if (c.x > 1.2) c.x = -0.2;
      cloud(ctx, c.x * L.W, wlY * (0.1 + c.y * 2), c.s * L.u * 0.9, c.seed, mix('#ffffff', th.skyNight[1], night * 0.7), 0.9 - night * 0.3);
    }
    // birds
    for (const b of w.birds) { b.x += b.v * dt; if (b.x > 1.1) b.x = -0.1; gull(ctx, b.x * L.W, wlY * (b.y * 2.2) + Math.sin(this.t + b.ph) * 4, 1.1 * L.u, this.t + b.ph, mix('#ffffff', '#5a6a88', night)); }
  }

  drawIslands(ctx, L, th, night, wlY) {
    const seed = this.world.zone.tier;
    const specs = [[0.12, 0.2, 0.22], [0.55, 0.11, 0.18], [0.86, 0.16, 0.2]];
    specs.forEach((s, i) => {
      if (th.island === 'ice' && i === 0) return; // left side has the glacier cave
      island(ctx, L.W * s[0], wlY + 2, L.W * s[2], L.H * s[1], th.island, seed * 10 + i * 3, 0.35, night);
    });
  }

  waveBand(ctx, L, y, amp, len, speed, ph, color, bottom, alpha = 1) {
    ctx.beginPath(); ctx.moveTo(0, bottom);
    for (let x = 0; x <= L.W + 12; x += 12) ctx.lineTo(x, y + Math.sin(x / len + this.t * speed + ph) * amp + Math.sin(x / (len * 0.43) - this.t * speed * 1.3 + ph) * amp * 0.4);
    ctx.lineTo(L.W, bottom); ctx.closePath(); ctx.globalAlpha = alpha; ctx.fillStyle = color; ctx.fill(); ctx.globalAlpha = 1;
  }
  waveFoam(ctx, L, y, amp, len, speed, ph, color) {
    ctx.strokeStyle = color; ctx.lineWidth = 2.2 * L.u; ctx.lineCap = 'round'; ctx.beginPath();
    for (let x = 0; x <= L.W + 12; x += 10) { const yy = y + Math.sin(x / len + this.t * speed + ph) * amp + Math.sin(x / (len * 0.43) - this.t * speed * 1.3 + ph) * amp * 0.4; x ? ctx.lineTo(x, yy) : ctx.moveTo(x, yy); }
    ctx.setLineDash([14 * L.u, 22 * L.u]); ctx.lineDashOffset = -this.t * 18; ctx.stroke(); ctx.setLineDash([]);
  }

  // ---------- fishing scene ----------
  drawSea(ctx, L, dt) {
    const g = this.g, st = g.state, w = this.world, th = w.th, fs = g.fishing, fx = getEffects(st);
    const night = nightness(st.clock) * (th.dark > 0.3 ? 0.85 : 1);
    const { wl, sb, u, W, H } = L;
    this.drawSky(ctx, L, th, night, dt, wl);
    this.drawIslands(ctx, L, th, night, wl);
    this.drawSeaFeatures(ctx, L, th, night);
    // underwater gradient
    const wg = ctx.createLinearGradient(0, wl, 0, H);
    const dk = (c, k) => mix(c, '#0a1030', clamp(k + night * 0.38 * (1 - th.dark), 0, 0.92));
    wg.addColorStop(0, dk(th.water[0], 0)); wg.addColorStop(0.45, dk(th.water[1], 0.04 + th.dark * 0.3)); wg.addColorStop(1, dk(th.water[2], 0.1 + th.dark * 0.4));
    ctx.fillStyle = wg; ctx.fillRect(0, wl, W, H - wl);
    // light rays
    const rayK = th.rays * (1 - night * 0.8);
    if (rayK > 0.05) for (let i = 0; i < 6; i++) {
      const x0 = ((i * 0.19 + 0.05 + Math.sin(this.t * 0.15 + i) * 0.03) % 1.1) * W, wd = (60 + hash(i + 9) * 70) * u;
      const rg = ctx.createLinearGradient(0, wl, 0, wl + (sb - wl) * 0.8); rg.addColorStop(0, `rgba(255,255,230,${0.2 * rayK})`); rg.addColorStop(1, 'rgba(255,255,230,0)');
      ctx.fillStyle = rg; ctx.beginPath(); ctx.moveTo(x0, wl); ctx.lineTo(x0 + wd, wl); ctx.lineTo(x0 + wd * 1.8 - 120 * u, wl + (sb - wl) * 0.8); ctx.lineTo(x0 - wd * 0.6 - 120 * u, wl + (sb - wl) * 0.8); ctx.closePath(); ctx.fill();
    }
    // seabed + back deco
    ctx.save(); ctx.beginPath(); ctx.rect(0, wl, W, H - wl); ctx.clip();
    this.drawSeabed(ctx, L, th, w, false);
    // fish
    this.updateFish(dt, L);
    for (const s of w.schools) this.drawSchool(ctx, L, s, dt);
    for (const f of w.fish) this.drawAmbientFish(ctx, L, f);
    // bite fish
    this.drawBiteFish(ctx, L, fs, st, dt);
    this.drawSeabed(ctx, L, th, w, true);
    // depth fog
    const fog = ctx.createLinearGradient(0, wl, 0, H); fog.addColorStop(0, rgba(th.fog, 0)); fog.addColorStop(1, rgba(th.fog, 0.5 + th.dark * 0.3));
    ctx.fillStyle = fog; ctx.fillRect(0, wl, W, H - wl);
    if (night > 0 && th.dark < 0.3) { ctx.fillStyle = `rgba(10,16,50,${night * 0.28})`; ctx.fillRect(0, wl, W, H - wl); }
    this.drawDepthGuide(ctx, L, fs, fx);
    ctx.restore();
    // surface back waves
    this.waveBand(ctx, L, wl + 2 * u, 3 * u, 70 * u, 1.1, 0, mix(th.water[0], '#ffffff', 0.18 - night * 0.1), wl + 40 * u, 0.9);
    this.waveFoam(ctx, L, wl + 1 * u, 3 * u, 70 * u, 1.1, 0, rgba(th.foam, 0.7));
    // boat + fisherman
    this.drawBoatScene(ctx, L, fs, st, fx, night, dt);
    // front waves
    const bp = this.boatPos();
    this.waveBand(ctx, L, wl + 10 * u, 3.4 * u, 90 * u, 1.4, 1.5, mix(th.water[0], th.water[1], 0.25), wl + 90 * u, 0.78);
    this.waveFoam(ctx, L, wl + 10 * u, 3.4 * u, 90 * u, 1.4, 1.5, rgba(th.foam, 0.55));
    // line + hook after wave so it is always visible
    this.drawLine(ctx, L, fs, st, fx, dt);
    // ambient particles
    this.spawnAmbient(dt, L, th);
    if (st.mode === 'fish' && fs.flash > 0) { ctx.fillStyle = `rgba(200,80,60,${fs.flash * 0.15})`; ctx.fillRect(0, 0, W, H); }
  }

  drawSeaFeatures(ctx, L, th, night) {
    const { W, wl, u } = L;
    if (th.island === 'ice') {
      // glacier cliff on the left with a glittering cave (secret)
      const found = this.g.state.secrets.found.frost_cave;
      ctx.save(); ctx.translate(0, wl);
      ctx.beginPath(); ctx.moveTo(-10, 6); ctx.lineTo(-10, -L.H * 0.2); ctx.lineTo(W * 0.04, -L.H * 0.24); ctx.lineTo(W * 0.09, -L.H * 0.14); ctx.lineTo(W * 0.135, -L.H * 0.04); ctx.lineTo(W * 0.15, 6); ctx.closePath();
      paint(ctx, mix('#e4f2fc', '#2a3a6a', night * 0.5), 2, '#6a8aaa');
      ctx.beginPath(); ctx.moveTo(W * 0.035, 4); ctx.quadraticCurveTo(W * 0.04, -L.H * 0.1, W * 0.07, -L.H * 0.1); ctx.quadraticCurveTo(W * 0.1, -L.H * 0.1, W * 0.1, 4); ctx.closePath(); paint(ctx, '#16284a', 2, '#4a6a8a');
      for (let i = 0; i < 5; i++) sparkle(ctx, W * (0.045 + i * 0.012), -L.H * (0.04 + hash(i) * 0.05), (3 + hash(i + 4) * 3) * u, '#e8ffff', this.t * (1 + i * 0.2) + i);
      if (found) glow(ctx, W * 0.07, -L.H * 0.05, 60 * u, '#9ff0ff', 0.5);
      ctx.restore();
      // icebergs
      for (let i = 0; i < 3; i++) {
        const x = W * (0.3 + i * 0.27), s = (0.7 + hash(i + 3) * 0.6) * u;
        ctx.save(); ctx.translate(x, wl + 2); ctx.beginPath(); ctx.moveTo(-50 * s, 0); ctx.lineTo(-30 * s, -34 * s); ctx.lineTo(-8 * s, -26 * s); ctx.lineTo(14 * s, -58 * s); ctx.lineTo(40 * s, -20 * s); ctx.lineTo(56 * s, 0); ctx.closePath(); paint(ctx, mix('#f4fbff', '#2a3a6a', night * 0.5), 2, '#7a9ab8');
        ctx.beginPath(); ctx.moveTo(14 * s, -58 * s); ctx.lineTo(40 * s, -20 * s); ctx.lineTo(10 * s, -14 * s); ctx.closePath(); ctx.fillStyle = 'rgba(150,190,220,.5)'; ctx.fill(); ctx.restore();
      }
    }
    if (th.deco === 'kelp') { // floating kelp mats on the surface
      for (let i = 0; i < 5; i++) { ctx.fillStyle = mix('#4a8a52', '#1a2a3a', night * 0.5); organic(ctx, W * (0.1 + i * 0.2) + Math.sin(this.t * 0.4 + i) * 6, wl + 4 * u, 34 * u, 5 * u, i, 8, 0.2); ctx.fill(); }
    }
    if (th.deco === 'trench') { // glowing surface runes
      for (let i = 0; i < 4; i++) { ctx.save(); ctx.translate(W * (0.15 + i * 0.22), wl - 8 * u + Math.sin(this.t + i) * 3); ctx.globalAlpha = 0.5 + 0.4 * Math.sin(this.t * 1.5 + i); this.rune(ctx, 0, 0, 14 * u, '#c8a8ff'); ctx.restore(); }
    }
  }

  rune(ctx, x, y, r, color) {
    ctx.strokeStyle = color; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x, y - r * 0.7); ctx.lineTo(x + r * 0.6, y + r * 0.5); ctx.lineTo(x - r * 0.6, y + r * 0.5); ctx.closePath(); ctx.stroke();
    ctx.beginPath(); ctx.arc(x, y + r * 0.05, r * 0.15, 0, TAU); ctx.stroke(); glow(ctx, x, y, r * 2, color, 0.25);
  }

  // ---------- seabed & decorations ----------
  drawSeabed(ctx, L, th, w, front) {
    const { W, H, sb, u } = L;
    if (!front) {
      ctx.beginPath(); ctx.moveTo(0, H);
      for (let x = 0; x <= W + 20; x += 20) ctx.lineTo(x, sb - 18 * u + Math.sin(x * 0.012 + w.seed) * 9 * u + Math.sin(x * 0.031) * 4 * u);
      ctx.lineTo(W, H); ctx.closePath();
      const g = ctx.createLinearGradient(0, sb - 30 * u, 0, H); g.addColorStop(0, th.seabed); g.addColorStop(1, th.seabed2);
      ctx.fillStyle = g; ctx.fill(); ctx.strokeStyle = rgba(INK, 0.4); ctx.lineWidth = 2; ctx.stroke();
      ctx.fillStyle = rgba(th.seabed2, 0.5); for (let i = 0; i < 40; i++) { ctx.beginPath(); ctx.arc(hash(i) * W, sb + hash(i * 3) * (H - sb), 1.5 * u + hash(i * 7) * 2 * u, 0, TAU); ctx.fill(); }
    }
    for (const d of w.deco) {
      if (d.front !== front) continue;
      const x = d.x * W, y = sb - 14 * u + Math.sin(x * 0.012 + w.seed) * 9 * u + Math.sin(x * 0.031) * 4 * u + (front ? 14 * u : 0);
      this.drawDeco(ctx, d, x, y, d.s * u * (front ? 1.15 : 0.9), th);
    }
  }

  drawDeco(ctx, d, x, y, s, th) {
    const t = this.t, sd = d.seed;
    ctx.save(); ctx.translate(x, y); ctx.scale(s, s); ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    switch (d.type) {
      case 'pebbles': for (let i = 0; i < 4; i++) { organic(ctx, i * 14 - 20, -4 + (i % 2) * 3, 8 + hash(sd + i) * 5, 5 + hash(sd + i * 2) * 3, sd + i, 7, 0.1); paint(ctx, ['#c8c0b0', '#b0a898', '#d8d0c0', '#a8a090'][i], 1.5); } break;
      case 'rock': organic(ctx, 0, -14, 28, 20, sd, 9, 0.15); paint(ctx, mix('#8a8a96', th.seabed2, 0.25), 2); ctx.fillStyle = 'rgba(255,255,255,.2)'; organic(ctx, -8, -22, 12, 6, sd + 1, 7, 0.1); ctx.fill(); if (th.deco === 'kelp' || th.deco === 'pebble') { ctx.fillStyle = 'rgba(70,130,70,.6)'; organic(ctx, 6, -30, 10, 4, sd + 2, 7, 0.2); ctx.fill(); } break;
      case 'shell': ctx.beginPath(); ctx.moveTo(0, 0); ctx.bezierCurveTo(-18, -4, -14, -26, 0, -26); ctx.bezierCurveTo(14, -26, 18, -4, 0, 0); paint(ctx, '#f6c8c0', 1.6); ctx.strokeStyle = '#d89a98'; ctx.lineWidth = 1; for (let i = -2; i <= 2; i++) { ctx.beginPath(); ctx.moveTo(0, -1); ctx.lineTo(i * 5, -23); ctx.stroke(); } break;
      case 'grass': for (let i = 0; i < 6; i++) { const sw = Math.sin(t * 1.4 + sd + i) * 6; ctx.beginPath(); ctx.moveTo(i * 4 - 10, 0); ctx.quadraticCurveTo(i * 4 - 10 + sw * 0.6, -20, i * 4 - 10 + sw, -34 - (i % 3) * 8); ctx.lineWidth = 3; ctx.strokeStyle = ['#5a9a5a', '#6aaa62', '#4a8a56'][i % 3]; ctx.stroke(); } break;
      case 'kelp': { const hgt = 140 + hash(sd) * 120, col = ['#4f8f4a', '#5fa055', '#3f7f4a'][sd % 3]; for (let k = 0; k < 2; k++) { ctx.beginPath(); ctx.moveTo(k * 10, 0); for (let i = 1; i <= 14; i++) ctx.lineTo(k * 10 + Math.sin(t * 0.9 + sd + i * 0.5 + k) * (3 + i * 1.2), -i * hgt / 14); ctx.lineWidth = 5; ctx.strokeStyle = INK; ctx.stroke(); ctx.lineWidth = 3; ctx.strokeStyle = col; ctx.stroke(); } for (let i = 3; i <= 13; i += 2) { const px = Math.sin(t * 0.9 + sd + i * 0.5) * (3 + i * 1.2); ctx.beginPath(); ctx.ellipse(px + 8, -i * hgt / 14, 11, 4, -0.5 + Math.sin(t + i) * 0.2, 0, TAU); ctx.fillStyle = col; ctx.fill(); ctx.lineWidth = 1; ctx.strokeStyle = INK; ctx.stroke(); } break; }
      case 'wreck': ctx.strokeStyle = INK; ctx.fillStyle = '#6a4a30'; for (let i = 0; i < 5; i++) { ctx.beginPath(); ctx.moveTo(-60 + i * 28, 0); ctx.quadraticCurveTo(-64 + i * 28, -60 - i * 6, -40 + i * 26, -92 + i * 8); ctx.lineTo(-33 + i * 26, -88 + i * 8); ctx.quadraticCurveTo(-56 + i * 28, -56 - i * 6, -52 + i * 28, 0); ctx.closePath(); ctx.fill(); ctx.lineWidth = 2; ctx.stroke(); } ctx.fillStyle = '#4a3220'; ctx.fillRect(-70, -10, 150, 12); ctx.strokeRect(-70, -10, 150, 12); ctx.fillStyle = 'rgba(70,130,70,.6)'; organic(ctx, -20, -70, 14, 5, 3, 7, 0.2); ctx.fill(); break;
      case 'coral_branch': { const c = ['#f2788c', '#f2a05a', '#d880c8', '#f0c85a'][sd % 4]; const br = (x, yy, a, len, dp) => { if (dp > 3) return; const x2 = x + Math.cos(a) * len, y2 = yy + Math.sin(a) * len; ctx.beginPath(); ctx.moveTo(x, yy); ctx.lineTo(x2, y2); ctx.lineWidth = 6 - dp * 1.3; ctx.strokeStyle = INK; ctx.stroke(); ctx.lineWidth = 4 - dp * 1.1; ctx.strokeStyle = c; ctx.stroke(); br(x2, y2, a - 0.5 + Math.sin(t + sd) * 0.04, len * 0.7, dp + 1); br(x2, y2, a + 0.5 + Math.sin(t + sd) * 0.04, len * 0.7, dp + 1); }; br(0, 0, -Math.PI / 2, 26, 0); break; }
      case 'coral_brain': organic(ctx, 0, -16, 24, 18, sd, 10, 0.08); paint(ctx, ['#e8a0b8', '#e8c070', '#a8c8e8'][sd % 3], 2); ctx.strokeStyle = 'rgba(80,40,60,.35)'; ctx.lineWidth = 1.4; for (let i = 0; i < 5; i++) { ctx.beginPath(); ctx.moveTo(-18, -8 - i * 5); ctx.bezierCurveTo(-8, -14 - i * 5, 6, -4 - i * 5, 18, -10 - i * 5); ctx.stroke(); } break;
      case 'coral_fan': ctx.beginPath(); ctx.moveTo(0, 0); for (let i = 0; i <= 10; i++) { const a = -Math.PI + (i / 10) * Math.PI; ctx.lineTo(Math.cos(a) * 34 * (i % 2 ? 0.9 : 1), -8 + Math.sin(a) * 40 * (i % 2 ? 0.9 : 1) - 8); } ctx.closePath(); paint(ctx, ['#e86a9a', '#b06ad8', '#f28a5a'][sd % 3], 2); ctx.strokeStyle = 'rgba(255,255,255,.35)'; ctx.lineWidth = 1; for (let i = 1; i < 10; i++) { ctx.beginPath(); ctx.moveTo(0, -2); ctx.lineTo(Math.cos(-Math.PI + i * Math.PI / 10) * 30, -16 + Math.sin(-Math.PI + i * Math.PI / 10) * 34); ctx.stroke(); } break;
      case 'anemone': for (let i = 0; i < 9; i++) { const sw = Math.sin(t * 1.6 + i + sd) * 5; ctx.beginPath(); ctx.moveTo(i * 3 - 12, 0); ctx.quadraticCurveTo(i * 4 - 16 + sw, -22, i * 5 - 20 + sw * 1.5, -38 - (i % 3) * 5); ctx.lineWidth = 3.4; ctx.strokeStyle = ['#f08ab8', '#f2a8d0', '#e870a0'][i % 3]; ctx.stroke(); ctx.beginPath(); ctx.arc(i * 5 - 20 + sw * 1.5, -38 - (i % 3) * 5, 2.4, 0, TAU); ctx.fillStyle = '#fff0f6'; ctx.fill(); } organic(ctx, 0, -2, 18, 7, sd, 7, 0.1); paint(ctx, '#c86a98', 1.6); break;
      case 'shroom': { const ph = 0.6 + 0.4 * Math.sin(t * 1.6 + sd); glow(ctx, 0, -40, 54, '#7ad8ff', 0.3 * ph); ctx.beginPath(); ctx.moveTo(-3, 0); ctx.quadraticCurveTo(-4, -26, 0, -40); ctx.lineTo(4, -40); ctx.quadraticCurveTo(4, -26, 3, 0); ctx.closePath(); paint(ctx, '#5a6aa8', 1.6); ctx.beginPath(); ctx.moveTo(-22, -36); ctx.quadraticCurveTo(0, -66, 22, -36); ctx.quadraticCurveTo(0, -30, -22, -36); ctx.closePath(); paint(ctx, mix('#6a8aff', '#aaf0ff', ph * 0.5), 1.8); ctx.fillStyle = '#e8ffff'; for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.arc(-10 + i * 7, -44 + (i % 2) * 5, 2, 0, TAU); ctx.fill(); } break; }
      case 'tubeworm': for (let i = 0; i < 4; i++) { const sw = Math.sin(t * 1.2 + i + sd) * 4; ctx.beginPath(); ctx.moveTo(i * 8 - 12, 0); ctx.quadraticCurveTo(i * 8 - 12 + sw, -26, i * 8 - 12 + sw * 1.5, -44 - i * 6); ctx.lineWidth = 6; ctx.strokeStyle = INK; ctx.stroke(); ctx.lineWidth = 4; ctx.strokeStyle = '#6a5a98'; ctx.stroke(); const tx = i * 8 - 12 + sw * 1.5, ty = -44 - i * 6; glow(ctx, tx, ty, 16, '#ff7ac8', 0.5 + 0.3 * Math.sin(t * 2 + i)); ctx.beginPath(); ctx.arc(tx, ty, 4, 0, TAU); ctx.fillStyle = '#ff9ad8'; ctx.fill(); } break;
      case 'crystal': { const c = th.deco === 'frost' ? ['#bfe8ff', '#e8f8ff'] : ['#a07aff', '#d8c0ff']; for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.moveTo(i * 16 - 22, 0); ctx.lineTo(i * 16 - 26 + (i === 1 ? 4 : 0), -34 - i % 2 * 18 - 10); ctx.lineTo(i * 16 - 14, -4); ctx.closePath(); paint(ctx, c[i % 2], 1.8); ctx.fillStyle = 'rgba(255,255,255,.4)'; ctx.beginPath(); ctx.moveTo(i * 16 - 26, -40 - i % 2 * 18); ctx.lineTo(i * 16 - 22, -8); ctx.lineTo(i * 16 - 20, -30); ctx.fill(); } glow(ctx, 0, -26, 40, c[0], 0.25 + 0.1 * Math.sin(t + sd)); break; }
      case 'ice_wall': ctx.beginPath(); ctx.moveTo(-40, 0); ctx.lineTo(-34, -52); ctx.lineTo(-14, -70); ctx.lineTo(6, -48); ctx.lineTo(24, -82); ctx.lineTo(44, -30); ctx.lineTo(50, 0); ctx.closePath(); paint(ctx, 'rgba(200,232,250,.9)', 2, '#6a98b8'); ctx.fillStyle = 'rgba(255,255,255,.4)'; ctx.beginPath(); ctx.moveTo(-14, -70); ctx.lineTo(6, -48); ctx.lineTo(-6, -20); ctx.lineTo(-24, -30); ctx.fill(); break;
      case 'pillar': ctx.fillStyle = '#5a4a8a'; ctx.beginPath(); ctx.moveTo(-18, 0); ctx.lineTo(-14, -120); ctx.lineTo(-18, -128); ctx.lineTo(18, -128); ctx.lineTo(14, -90); ctx.lineTo(20, -40); ctx.lineTo(18, 0); ctx.closePath(); paint(ctx, '#5a4a8a', 2); ctx.save(); ctx.globalAlpha = 0.5 + 0.4 * Math.sin(t * 1.5 + sd); this.rune(ctx, 0, -70, 9, '#c8a8ff'); ctx.restore(); break;
      case 'arch': ctx.beginPath(); ctx.moveTo(-70, 0); ctx.lineTo(-70, -110); ctx.quadraticCurveTo(0, -190, 70, -110); ctx.lineTo(70, 0); ctx.lineTo(48, 0); ctx.lineTo(48, -100); ctx.quadraticCurveTo(0, -150, -48, -100); ctx.lineTo(-48, 0); ctx.closePath(); paint(ctx, '#4a3a78', 2.4); ctx.save(); ctx.globalAlpha = 0.5 + 0.4 * Math.sin(t * 1.2 + sd); this.rune(ctx, 0, -150, 12, '#ffd870'); ctx.restore(); break;
      case 'glyph': ctx.save(); ctx.translate(0, -50 + Math.sin(t * 0.9 + sd) * 10); ctx.rotate(Math.sin(t * 0.3 + sd) * 0.2); ctx.globalAlpha = 0.6; this.rune(ctx, 0, 0, 20, '#d8b8ff'); ctx.restore(); break;
    }
    ctx.restore();
  }

  // ---------- ambient life ----------
  updateFish(dt, L) {
    const w = this.world;
    for (const f of w.fish) {
      f.x += f.dir * f.v * dt; f.ph += dt;
      if ((f.dir > 0 && f.x > 1.2) || (f.dir < 0 && f.x < -0.2)) Object.assign(f, this.newAmbient(w.sp, false));
    }
  }
  drawAmbientFish(ctx, L, f) {
    const sz = fishPixels(f.len, L.u * 0.62) * f.size;
    const y = this.yOfDepth(f.d) + Math.sin(f.ph * 1.3) * 10 * L.u;
    const x = f.x * L.W;
    drawFish(ctx, f.sp, { x, y, size: sz, dir: f.dir, t: f.ph, tilt: Math.sin(f.ph * 1.3) * 0.06 * f.dir, sil: true, alpha: 0.42 });
  }
  drawSchool(ctx, L, s, dt) {
    s.x += s.v * dt; if (s.x > 1.2) s.x = -0.2; if (s.x < -0.2) s.x = 1.2;
    ctx.fillStyle = rgba('#173a5a', 0.3);
    for (let i = 0; i < s.n; i++) {
      const a = i * 2.4 + s.ph, px = s.x * L.W + Math.cos(a) * (30 + i * 5) * L.u + Math.sin(this.t * 1.4 + i) * 6 * L.u, py = this.yOfDepth(s.d) + Math.sin(a * 1.7 + this.t * 0.9) * 34 * L.u;
      const dir = s.v > 0 ? 1 : -1, sz = 7 * L.u;
      ctx.save(); ctx.translate(px, py); ctx.scale(dir, 1); ctx.beginPath(); ctx.ellipse(0, 0, sz, sz * 0.4, 0, 0, TAU); ctx.fill(); ctx.beginPath(); ctx.moveTo(-sz * 0.8, 0); ctx.lineTo(-sz * 1.6, -sz * 0.5 + Math.sin(this.t * 14 + i) * 2); ctx.lineTo(-sz * 1.6, sz * 0.5 + Math.sin(this.t * 14 + i) * 2); ctx.closePath(); ctx.fill(); ctx.restore();
    }
  }

  drawBiteFish(ctx, L, fs, st, dt) {
    const pend = fs.pending;
    const hook = this.hookWorld();
    if (!pend) return;
    if ((fs.state === FS.WAIT || fs.state === FS.BITE) && pend.kind === 'fish') {
      const a = fs.approach(), e = a * a * (3 - 2 * a);
      const dir = this.biteDir || (this.biteDir = Math.random() < 0.5 ? 1 : -1);
      const startX = hook.x - dir * L.W * 0.5;
      const x = lerp(startX, hook.x - dir * 22 * L.u, e);
      const sz = fishPixels(pend.item.l, L.u * 0.62);
      const wob = fs.state === FS.BITE ? Math.sin(this.t * 30) * 3 * L.u : 0;
      const sp = pend.sp, ri = RARITY[sp.rarity].index;
      if (ri >= 4) glow(ctx, x, hook.y, sz * 0.9, RARITY[sp.rarity].color, 0.25 + 0.1 * Math.sin(this.t * 3));
      drawFish(ctx, sp, { x, y: hook.y + wob * 0.5 + Math.sin(this.t * 2.6) * 4 * L.u, size: sz, dir, t: this.t, sil: true, alpha: 0.55, tilt: fs.state === FS.BITE ? Math.sin(this.t * 25) * 0.12 : 0 });
    } else if (fs.state === FS.BITE) { // junk/treasure: just bubbles and a tug
      if (Math.random() < 0.3) this.parts.push({ type: 'bubble', x: hook.x + rnd(-8, 8), y: hook.y, vx: 0, vy: -rnd(30, 60), life: 0, max: 1.4, size: rnd(2, 4) });
    }
    if (fs.state === FS.DESCEND || fs.state === FS.CASTING) this.biteDir = 0;
  }

  drawDepthGuide(ctx, L, fs, fx) {
    const g = this.g;
    if (g.state.mode !== 'fish') return;
    const { W, u } = L;
    ctx.save(); ctx.font = `${11 * u}px system-ui, sans-serif`; ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
    const bounds = [0.3, 0.6], names = ['SURFACE', 'MIDWATER', 'DEEP'];
    ctx.strokeStyle = 'rgba(255,255,255,.18)'; ctx.setLineDash([4, 8]); ctx.lineWidth = 1;
    for (const b of bounds) { const y = this.yOfDepth(b - 0.03); ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
    ctx.setLineDash([]); ctx.fillStyle = 'rgba(255,255,255,.35)';
    ctx.fillText(names[0], W - 12, this.yOfDepth(0.15)); ctx.fillText(names[1], W - 12, this.yOfDepth(0.45)); ctx.fillText(names[2], W - 12, this.yOfDepth(0.8));
    // line limit
    const ly = this.yOfDepth(fx.maxDepth);
    if (fx.maxDepth < 0.99) { ctx.strokeStyle = 'rgba(255,200,120,.45)'; ctx.setLineDash([10, 6]); ctx.beginPath(); ctx.moveTo(0, ly); ctx.lineTo(W, ly); ctx.stroke(); ctx.setLineDash([]); ctx.fillStyle = 'rgba(255,214,150,.7)'; ctx.fillText('line limit', W - 12, ly - 9 * u); }
    if (!fs.busy && fs.state !== FS.PRESENT) {
      const y = this.yOfDepth(fs.depth), x = this.tipW.x || g.boatX * W;
      ctx.strokeStyle = 'rgba(255,255,255,.55)'; ctx.setLineDash([3, 6]); ctx.beginPath(); ctx.moveTo(x, L.wl); ctx.lineTo(x, y); ctx.stroke(); ctx.setLineDash([]);
      ctx.beginPath(); ctx.arc(x, y, 5 * u, 0, TAU); ctx.fillStyle = 'rgba(255,255,255,.85)'; ctx.fill(); ctx.strokeStyle = INK; ctx.stroke();
    }
    ctx.restore();
  }

  // ---------- boat ----------
  drawBoatScene(ctx, L, fs, st, fx, night, dt) {
    const bp = this.boatPos(), u = L.u, tier = st.equipped.boat, m = BOAT_META[tier];
    const deco = st.cosmetics.active ? DECO_BY_ID[st.cosmetics.active].color : null;
    ctx.save(); ctx.translate(bp.x, bp.y); ctx.rotate(bp.tilt); ctx.scale(u * this.ds, u);
    // reflection / shadow
    ctx.fillStyle = 'rgba(0,30,50,.18)'; ctx.beginPath(); ctx.ellipse(0, 12, m.w * 0.5, 6, 0, 0, TAU); ctx.fill();
    drawBoat(ctx, tier, { t: this.t, deco });
    // pets on deck
    const pet = st.pets.active;
    if (pet && ['cat', 'gull', 'crab'].includes(pet)) { ctx.save(); ctx.translate(m.w * 0.43, -m.h * 0.9); drawPet(ctx, pet, { t: this.t, happy: this.petHappy / 1.3 }); ctx.restore(); }
    if (pet === 'jelly' || pet === 'dragon') { ctx.save(); ctx.translate(m.w * 0.12 + Math.sin(this.t * 0.8) * 14, -m.h * 5.0 + Math.sin(this.t * 1.4) * 6); drawPet(ctx, pet, { t: this.t, happy: this.petHappy / 1.3, scale: 1.1 }); ctx.restore(); }
    // fisherman pose
    let pose = 'idle', p = 0;
    switch (fs.state) {
      case FS.CASTING: pose = 'cast'; p = clamp(fs.t / (CONFIG.fishing.castTime * fx.castMult), 0, 1); break;
      case FS.DESCEND: case FS.WAIT: pose = 'wait'; break;
      case FS.BITE: pose = 'bite'; break;
      case FS.RETRIEVE: pose = 'reel'; break;
      case FS.PRESENT: pose = 'show'; break;
    }
    const rod = RODS[st.equipped.rod];
    const fy = -m.h * 0.78, fxp = m.w * m.deck;
    const r = drawFisherman(ctx, fxp, fy, { pose, p, t: this.t, rodColor: rod.color, rodTier: st.equipped.rod });
    this.tipLocal = r;
    // exclamation
    if (fs.state === FS.BITE) { ctx.save(); ctx.translate(fxp + 8, fy - 92 + Math.sin(this.t * 18) * 2); ctx.beginPath(); ctx.arc(0, 0, 11, 0, TAU); paint(ctx, '#fff6c8', 2); ctx.fillStyle = '#d8503a'; ctx.font = 'bold 17px system-ui'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.scale(this.ds >= 0 ? 1 : -1, 1); ctx.fillText('!', 0, 1); ctx.restore(); }
    ctx.restore();
    // otter floats in water
    if (pet === 'otter') { ctx.save(); ctx.translate(bp.x - 0.62 * m.w * u * this.ds, bp.y + 12 * u + Math.sin(this.t * 1.6) * 2); drawPet(ctx, 'otter', { t: this.t, happy: this.petHappy / 1.3, dir: this.ds >= 0 ? 1 : -1, scale: u * 1.1 }); ctx.restore(); }
    // night lantern glow for bigger boats
    if (night > 0.4 && tier >= 2) { const w = this.toWorld(-m.w * 0.1, -m.h * 2.2); glow(ctx, w.x, w.y, 60 * u, '#ffd890', 0.3 * night); }
    const tip = this.toWorld(this.tipLocal.x, this.tipLocal.y);
    this.tipW = tip;
  }

  // ---------- line & hook ----------
  drawLine(ctx, L, fs, st, fx, dt) {
    if (st.mode !== 'fish') return;
    const tip = this.tipW, u = L.u, wl = L.wl;
    let hx, hy;
    const state = fs.state;
    if (state === FS.READY || state === FS.FULL || state === FS.PRESENT) {
      // rod rests with a short dangling hook
      hx = tip.x + Math.sin(this.t * 1.7) * 3 * u; hy = tip.y + 34 * u;
      this.hookX = hx / L.W; this.hookY = hy; this._hookInit = false;
    } else if (state === FS.CASTING) {
      const p = clamp(fs.t / (CONFIG.fishing.castTime * fx.castMult), 0, 1);
      const tx = tip.x + this.ds * 100 * u;
      hx = lerp(tip.x, tx, p); hy = lerp(tip.y, wl, p * p) - Math.sin(p * Math.PI) * 60 * u;
      this.hookX = hx / L.W; this.hookY = hy; this._hookInit = false;
    } else {
      // in the water: lands ahead of the bow, then drifts gently after the boat
      const ahead = (tip.x + this.ds * 100 * u) / L.W;
      if (!this._hookInit) { this.hookX = ahead; this._hookInit = true; }
      if (state === FS.RETRIEVE) this.hookX += ((tip.x + this.ds * 14 * u) / L.W - this.hookX) * Math.min(1, dt * 1.2);
      else this.hookX += (ahead - this.hookX) * Math.min(1, dt * 0.7);
      hx = this.hookX * L.W + (state === FS.BITE ? Math.sin(this.t * 40) * 2 : Math.sin(this.t * 1.3) * 2 * u);
      hy = fs.hookFrac <= 0 ? wl : this.yOfDepth(fs.hookFrac);
      this.hookY = hy;
    }
    // line
    ctx.save();
    const rodTier = st.equipped.rod;
    ctx.strokeStyle = 'rgba(250,246,230,.9)'; ctx.lineWidth = 1.3; ctx.lineCap = 'round';
    const inWater = state === FS.DESCEND || state === FS.WAIT || state === FS.BITE || state === FS.RETRIEVE;
    const dip = state === FS.BITE ? 7 * u + Math.sin(this.t * 30) * 3 : 0;
    const bx = hx, by = wl + 8 * u + dip + Math.sin(this.t * 2) * 1.5;
    ctx.beginPath(); ctx.moveTo(tip.x, tip.y);
    if (inWater) {
      // rod tip -> float (slack arc through the air), then the line hangs straight down from the float
      ctx.quadraticCurveTo((tip.x + bx) / 2, Math.max(tip.y, by - 10 * u) + 14 * u, bx, by - 9 * u);
      ctx.stroke();
      if (hy > by) { ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(hx, hy); ctx.stroke(); }
    } else {
      ctx.quadraticCurveTo((tip.x + hx) / 2, (tip.y + Math.min(hy, wl)) / 2 + (state === FS.READY ? 0 : 12 * u), hx, hy);
      ctx.stroke();
    }
    if (inWater) {
      ctx.beginPath(); ctx.arc(bx, by - 4 * u, 5.5 * u, Math.PI, 0); ctx.closePath(); paint(ctx, '#f4f0e0', 1.5);
      ctx.beginPath(); ctx.arc(bx, by - 4 * u, 5.5 * u, 0, Math.PI); ctx.closePath(); paint(ctx, '#e0503e', 1.5);
      ctx.strokeStyle = 'rgba(255,255,255,.5)'; ctx.lineWidth = 1.2; const rr = (this.t * 14) % 18;
      ctx.beginPath(); ctx.ellipse(bx, wl + 9 * u, 8 * u + rr * u, 2.6 * u + rr * 0.3 * u, 0, 0, TAU); ctx.globalAlpha = 1 - rr / 18; ctx.stroke(); ctx.globalAlpha = 1;
    }
    // hook & attached catch
    ctx.translate(hx, hy);
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, 8 * u); ctx.bezierCurveTo(0, 17 * u, 9 * u, 17 * u, 9 * u, 9 * u); ctx.lineWidth = 2.4 * u; ctx.strokeStyle = INK; ctx.stroke(); ctx.lineWidth = 1.4 * u; ctx.strokeStyle = '#d8dee4'; ctx.stroke();
    if (state === FS.WAIT || state === FS.DESCEND) { ctx.beginPath(); ctx.arc(4 * u, 13 * u, 3 * u, 0, TAU); ctx.fillStyle = st.equipped.bait ? this.baitColor(st) : '#c98a8a'; ctx.fill(); }
    if (state === FS.RETRIEVE && fs.pending) {
      const pend = fs.pending;
      ctx.translate(4 * u, 16 * u);
      if (pend.kind === 'fish') { const sz = fishPixels(pend.item.l, u * 0.6); drawFish(ctx, pend.sp, { x: 0, y: sz * 0.42, size: sz, dir: 1, t: this.t * 1.5, tilt: -Math.PI / 2 + Math.sin(this.t * 14) * 0.2, variant: pend.item.variant }); }
      else if (pend.kind === 'fragment') { ctx.fillStyle = '#f6ead0'; ctx.fillRect(-12 * u, 4 * u, 24 * u, 18 * u); sparkle(ctx, 10 * u, 6 * u, 8 * u, '#fff6c8', this.t * 3); }
      else drawLoot(ctx, pend.item.id, 0, 22 * u, 38 * u, this.t);
    }
    ctx.restore();
    // splash as hook leaves the water on retrieval
    if (state === FS.RETRIEVE && fs.hookFrac < 0.02 && !this._rSplash) { this._rSplash = true; this.splash(hx, wl, 1.1); }
    if (state !== FS.RETRIEVE) this._rSplash = false;
  }

  baitColor(st) { const b = { worm: '#c98a8a', minnow: '#9ab8d0', shiny: '#e8d870', crab: '#d96a54', reef: '#f08aa8', kelp: '#6aa86a', moon: '#c8b8f8', glow: '#7ad8ff', arctic: '#d8f0ff', ancient: '#e8c060' }; return b[st.equipped.bait] || '#c98a8a'; }

  // ---------- particles ----------
  spawnAmbient(dt, L, th) {
    const low = this.g.state.settings.lowFx, cap = low ? 90 : 220;
    if (this.parts.length > cap) return;
    this.spawnAcc += dt;
    const rate = low ? 0.28 : 0.12;
    while (this.spawnAcc > rate) {
      this.spawnAcc -= rate;
      const p = th.particles;
      if (p === 'bubble') this.parts.push({ type: 'bubble', x: Math.random() * L.W, y: L.sb, vx: 0, vy: -rnd(20, 50), life: 0, max: (L.sb - L.wl) / 40, size: rnd(1.5, 4.5) * L.u, wob: Math.random() * 6 });
      else if (p === 'mote') this.parts.push({ type: 'mote', x: Math.random() * L.W, y: L.wl + Math.random() * (L.sb - L.wl), vx: rnd(-6, 6), vy: rnd(-6, 4), life: 0, max: rnd(5, 9), size: rnd(1.5, 3) * L.u, color: '#f4ffc8', wob: Math.random() * 6 });
      else if (p === 'glow') this.parts.push({ type: 'mote', x: Math.random() * L.W, y: L.wl + Math.random() * (L.sb - L.wl), vx: rnd(-8, 8), vy: rnd(-12, 4), life: 0, max: rnd(5, 10), size: rnd(2, 4.5) * L.u, color: Math.random() < 0.5 ? '#7ad8ff' : '#c0a0ff', wob: Math.random() * 6 });
      else if (p === 'rune') this.parts.push({ type: 'mote', x: Math.random() * L.W, y: L.wl + Math.random() * (L.sb - L.wl), vx: rnd(-5, 5), vy: -rnd(4, 14), life: 0, max: rnd(5, 10), size: rnd(2, 4) * L.u, color: Math.random() < 0.5 ? '#d8b8ff' : '#ffd870', wob: Math.random() * 6 });
      else if (p === 'snow') this.parts.push({ type: 'snow', x: Math.random() * L.W, y: -5, vx: rnd(-14, -4), vy: rnd(24, 50), life: 0, max: (L.H + 10) / 36, size: rnd(1.2, 3.2) * L.u, wob: Math.random() * 6 });
    }
  }
  updateParts(dt) {
    const a = this.parts;
    for (let i = a.length - 1; i >= 0; i--) {
      const p = a[i]; p.life += dt;
      if (p.life >= p.max) { a.splice(i, 1); continue; }
      if (p.g) p.vy += p.g * dt;
      if (p.wob !== undefined) p.x += Math.sin(this.t * 2 + p.wob) * 8 * dt;
      p.x += (p.vx || 0) * dt; p.y += (p.vy || 0) * dt;
      if (p.type === 'bubble' && p.y < this.layout().wl) a.splice(i, 1);
    }
    if (a.length > 600) a.splice(0, a.length - 600);
  }
  drawParts(ctx, L) {
    for (const p of this.parts) {
      const k = p.life / p.max;
      switch (p.type) {
        case 'bubble': bubble(ctx, p.x, p.y, p.size, 0.55 * (1 - Math.max(0, k - 0.7) / 0.3)); break;
        case 'drop': ctx.globalAlpha = 1 - k; ctx.fillStyle = '#e8f8ff'; ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, TAU); ctx.fill(); ctx.globalAlpha = 1; break;
        case 'ring': ctx.globalAlpha = 1 - k; ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(p.x, p.y, p.size + k * 50 * L.u, (p.size + k * 50 * L.u) * 0.3, 0, 0, TAU); ctx.stroke(); ctx.globalAlpha = 1; break;
        case 'spark': ctx.globalAlpha = 1 - k; sparkle(ctx, p.x, p.y, p.size * (1 - k * 0.4), p.color, p.life * 4); ctx.globalAlpha = 1; break;
        case 'mote': ctx.globalAlpha = Math.sin(k * Math.PI) * 0.8; glow(ctx, p.x, p.y, p.size * 4, p.color, 0.5); ctx.fillStyle = p.color; ctx.beginPath(); ctx.arc(p.x, p.y, p.size * 0.6, 0, TAU); ctx.fill(); ctx.globalAlpha = 1; break;
        case 'snow': ctx.globalAlpha = 0.85; ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, TAU); ctx.fill(); ctx.globalAlpha = 1; break;
        case 'coin': ctx.globalAlpha = 1 - k; ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, TAU); ctx.fillStyle = '#f2cf6a'; ctx.fill(); ctx.strokeStyle = '#a07a2a'; ctx.lineWidth = 1; ctx.stroke(); ctx.globalAlpha = 1; break;
      }
    }
  }

  // ---------- HARBOR ----------
  drawHarbor(ctx, L, dt) {
    const g = this.g, st = g.state, { W, H, u } = L;
    const night = nightness(st.clock);
    const th = { skyDay: ['#9ad8ee', '#fdeccb'], skyNight: ['#1d2b55', '#6a5a8a'], island: 'grass', water: ['#7fd0cc', '#4aa8b4', '#2a7a98'], foam: '#ffffff', dark: 0 };
    const horizon = H * 0.46;
    this.drawSky(ctx, L, th, night, dt, horizon);
    // far islands & lighthouse isle
    island(ctx, W * 0.2, horizon + 2, W * 0.26, H * 0.12, 'grass', 7, 0.3, night);
    island(ctx, W * 0.55, horizon + 2, W * 0.16, H * 0.07, 'palm', 9, 0.3, night);
    // sea
    const wg = ctx.createLinearGradient(0, horizon, 0, H); wg.addColorStop(0, mix('#8adbd2', '#1a2a5a', night * 0.6)); wg.addColorStop(1, mix('#2e86a8', '#0e1a42', night * 0.6));
    ctx.fillStyle = wg; ctx.fillRect(0, horizon, W, H - horizon);
    for (let i = 0; i < 6; i++) this.waveBand(ctx, L, horizon + 24 * u + i * 38 * u, 3 * u, 80 * u + i * 12, 0.9 + i * 0.1, i * 1.3, 'rgba(255,255,255,0.09)', horizon + 30 * u + i * 38 * u + 14 * u);
    this.hot = [];
    // lighthouse on rocky isle (right)
    this.drawLighthouse(ctx, L, W * 0.9, horizon + 8 * u, night);
    this.addHot('lighthouse', W * 0.9 - 40 * u, horizon - 150 * u, 80 * u, 170 * u, 'Lighthouse (Prestige)');
    // pier
    const py = H * 0.68, pierW = W * 0.62;
    // posts
    for (let i = 0; i < 8; i++) { const x = 20 + i * (pierW / 7.4); ctx.fillStyle = '#6a4a30'; ctx.fillRect(x, py, 12 * u, H * 0.2); ctx.strokeStyle = INK; ctx.lineWidth = 1.6; ctx.strokeRect(x, py, 12 * u, H * 0.2); }
    // buildings behind pier
    this.drawShop(ctx, L, W * 0.06, py, 'tackle', night);
    this.drawShop(ctx, L, W * 0.25, py, 'market', night);
    this.drawShop(ctx, L, W * 0.43, py, 'yard', night);
    // pier deck
    ctx.beginPath(); ctx.moveTo(0, py); ctx.lineTo(pierW, py); ctx.lineTo(pierW + 30 * u, py + 40 * u); ctx.lineTo(0, py + 40 * u); ctx.closePath(); paint(ctx, '#c49a68', 2.4);
    ctx.strokeStyle = 'rgba(80,50,30,.5)'; ctx.lineWidth = 1.4;
    for (let x = 18 * u; x < pierW + 20; x += 38 * u) { ctx.beginPath(); ctx.moveTo(x, py); ctx.lineTo(x + 12 * u, py + 40 * u); ctx.stroke(); }
    ctx.beginPath(); ctx.moveTo(0, py + 20 * u); ctx.lineTo(pierW + 14 * u, py + 20 * u); ctx.stroke();
    // props: barrels, crates, net, quest board, lantern
    this.drawBarrel(ctx, W * 0.17, py + 2 * u, u); this.drawCrate(ctx, W * 0.205, py + 2 * u, u); this.drawBarrel(ctx, W * 0.37, py + 2 * u, u);
    this.drawBoard(ctx, L, W * 0.555, py, night); this.addHot('board', W * 0.555 - 36 * u, py - 100 * u, 72 * u, 100 * u, 'Request Board');
    for (const lx of [0.015, 0.34, 0.6]) this.drawLantern(ctx, L, W * lx + 8 * u, py, night);
    // boat docked on the water beside the pier end
    const bx = W * 0.8, by = H * 0.74 + Math.sin(this.t * 1.3) * 3 * u, tier = st.equipped.boat, m = BOAT_META[tier];
    const deco = st.cosmetics.active ? DECO_BY_ID[st.cosmetics.active].color : null;
    ctx.save(); ctx.translate(bx, by); ctx.rotate(Math.sin(this.t * 1.1) * 0.02); ctx.scale(-u * 1.05, u * 1.05);
    drawBoat(ctx, tier, { t: this.t, deco });
    drawFisherman(ctx, m.w * m.deck, -m.h * 0.78, { pose: 'idle', t: this.t, rodColor: RODS[st.equipped.rod].color, rodTier: st.equipped.rod });
    ctx.restore();
    this.addHot('boat', bx - m.w * 0.5 * u, by - m.h * 4 * u, m.w * u, m.h * 5 * u, 'Set sail (World Map)');
    // mooring rope
    ctx.strokeStyle = '#d8c8a0'; ctx.lineWidth = 2.4; ctx.beginPath(); ctx.moveTo(pierW + 10 * u, py + 8 * u); ctx.quadraticCurveTo((pierW + bx) / 2 - 40 * u, py + 40 * u, bx - m.w * 0.4 * u, by - 20 * u); ctx.stroke();
    this.waveBand(ctx, L, by + 6 * u, 3 * u, 90 * u, 1.4, 2, 'rgba(60,150,170,.7)', H, 0.8);
    this.waveFoam(ctx, L, by + 6 * u, 3 * u, 90 * u, 1.4, 2, 'rgba(255,255,255,.6)');
    // pet on pier
    const pet = st.pets.active;
    if (pet) {
      const px = pierW - 70 * u, pyy = py + 4 * u;
      ctx.save(); ctx.translate(px, pet === 'otter' ? pyy + 6 * u : pyy); ctx.scale(u * 1.5, u * 1.5);
      drawPet(ctx, pet, { t: this.t, happy: this.petHappy / 1.3, dir: -1 });
      ctx.restore();
      this.addHot('pets', px - 40 * u, pyy - 80 * u, 80 * u, 90 * u, 'Your companion');
    }
    // sitting gulls
    for (let i = 0; i < 3; i++) { const gx = W * (0.07 + i * 0.4) + 14, gy = py - 3 * u; ctx.save(); ctx.translate(gx, gy); ctx.scale(u * 0.7, u * 0.7); drawPet(ctx, 'gull', { t: this.t + i, dir: i % 2 ? -1 : 1 }); ctx.restore(); }
    // hover label
    this.drawHotLabel(ctx, L);
    if (night > 0.3) { ctx.fillStyle = `rgba(10,16,50,${night * 0.25})`; ctx.fillRect(0, 0, W, H); }
  }

  addHot(id, x, y, w, h, label) { this.hot.push({ id, x, y, w, h, label }); }
  hitTest(x, y) { for (let i = this.hot.length - 1; i >= 0; i--) { const h = this.hot[i]; if (x >= h.x && x <= h.x + h.w && y >= h.y && y <= h.y + h.h) return h; } return null; }
  drawHotLabel(ctx, L) {
    const h = this.hitTest(this.mouse.x, this.mouse.y);
    this.hover = h;
    if (!h) return;
    const u = L.u; ctx.save(); ctx.font = `600 ${13 * u}px system-ui, sans-serif`;
    const tw = ctx.measureText(h.label).width + 22 * u, x = clamp(h.x + h.w / 2 - tw / 2, 6, L.W - tw - 6), y = Math.max(8, h.y - 30 * u);
    ctx.beginPath(); ctx.roundRect(x, y, tw, 26 * u, 10 * u); paint(ctx, '#fbf3e0', 2, '#8a6a44'); ctx.fillStyle = '#2b3a4d'; ctx.textBaseline = 'middle'; ctx.fillText(h.label, x + 11 * u, y + 13.5 * u); ctx.restore();
  }

  drawLighthouse(ctx, L, x, y, night) {
    const u = L.u; ctx.save(); ctx.translate(x, y);
    organic(ctx, 0, 6 * u, 70 * u, 16 * u, 3, 9, 0.1); paint(ctx, '#8a8a94', 2);
    ctx.beginPath(); ctx.moveTo(-22 * u, 0); ctx.lineTo(-14 * u, -120 * u); ctx.lineTo(14 * u, -120 * u); ctx.lineTo(22 * u, 0); ctx.closePath(); paint(ctx, '#f6f0e4', 2);
    ctx.save(); ctx.clip(); ctx.fillStyle = '#d8503a'; for (let i = 0; i < 3; i++) ctx.fillRect(-30 * u, -100 * u + i * 40 * u, 60 * u, 18 * u); ctx.restore();
    ctx.fillStyle = '#2a3a58'; ctx.fillRect(-16 * u, -140 * u, 32 * u, 20 * u); ctx.strokeStyle = INK; ctx.lineWidth = 2; ctx.strokeRect(-16 * u, -140 * u, 32 * u, 20 * u);
    ctx.beginPath(); ctx.moveTo(-20 * u, -140 * u); ctx.lineTo(0, -160 * u); ctx.lineTo(20 * u, -140 * u); ctx.closePath(); paint(ctx, '#d8503a', 2);
    const a = 0.5 + night * 0.5 + Math.sin(this.t * 2) * 0.1; glow(ctx, 0, -130 * u, 70 * u, '#ffe8a0', a * 0.6);
    if (night > 0.3) { ctx.save(); ctx.globalAlpha = night * 0.25; ctx.fillStyle = '#fff0b0'; ctx.beginPath(); ctx.moveTo(0, -130 * u); const r = Math.sin(this.t * 0.6); ctx.lineTo(-400 * u, -150 * u + r * 60 * u); ctx.lineTo(-400 * u, -100 * u + r * 60 * u); ctx.closePath(); ctx.fill(); ctx.restore(); }
    ctx.restore();
  }

  drawShop(ctx, L, x, py, kind, night) {
    const u = L.u, w = 170 * u, h = 140 * u, cols = { tackle: ['#6aa4c8', '#e8f0f4', 'Tackle Shop'], market: ['#e07a62', '#fbeed0', 'Fish Market'], yard: ['#8aa870', '#f0e4c0', 'Boat Yard'] }[kind];
    ctx.save(); ctx.translate(x, py);
    ctx.beginPath(); ctx.rect(0, -h, w, h); paint(ctx, '#e8d4aa', 2.4);
    ctx.strokeStyle = 'rgba(120,80,50,.3)'; ctx.lineWidth = 1.2; for (let i = 1; i < 6; i++) { ctx.beginPath(); ctx.moveTo(0, -h + i * h / 6); ctx.lineTo(w, -h + i * h / 6); ctx.stroke(); }
    // roof
    ctx.beginPath(); ctx.moveTo(-12 * u, -h); ctx.lineTo(w / 2, -h - 46 * u); ctx.lineTo(w + 12 * u, -h); ctx.closePath(); paint(ctx, cols[0], 2.4);
    // awning
    ctx.beginPath(); ctx.moveTo(-6 * u, -h * 0.58); ctx.lineTo(w + 6 * u, -h * 0.58); ctx.lineTo(w + 14 * u, -h * 0.4); ctx.lineTo(-14 * u, -h * 0.4); ctx.closePath(); paint(ctx, cols[0], 2);
    for (let i = 0; i < 6; i += 2) { ctx.beginPath(); ctx.moveTo(i * (w / 6) - 6 * u, -h * 0.58); ctx.lineTo((i + 1) * (w / 6) - 6 * u, -h * 0.58); ctx.lineTo((i + 1) * (w / 6) - 10 * u, -h * 0.4); ctx.lineTo(i * (w / 6) - 14 * u, -h * 0.4); ctx.closePath(); ctx.fillStyle = cols[1]; ctx.fill(); }
    // window & door
    const lit = night > 0.35;
    ctx.beginPath(); ctx.rect(w * 0.1, -h * 0.34, w * 0.3, h * 0.28); paint(ctx, lit ? '#ffe39a' : '#bfe0ec', 2); if (lit) glow(ctx, w * 0.25, -h * 0.2, 50 * u, '#ffd890', 0.4);
    ctx.beginPath(); ctx.roundRect(w * 0.58, -h * 0.34, w * 0.26, h * 0.34, [8 * u, 8 * u, 0, 0]); paint(ctx, '#8a5a38', 2);
    // sign
    ctx.beginPath(); ctx.roundRect(w * 0.12, -h * 0.9, w * 0.76, 22 * u, 6 * u); paint(ctx, '#f6e8c8', 2, '#8a6a44'); ctx.fillStyle = '#3a4a5e'; ctx.font = `700 ${13 * u}px Georgia, serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(cols[2], w / 2, -h * 0.9 + 12 * u);
    // chimney smoke for market
    if (kind === 'market') for (let i = 0; i < 3; i++) { const k = (this.t * 0.4 + i / 3) % 1; ctx.globalAlpha = 0.5 * (1 - k); ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(w * 0.78 + k * 20, -h - 46 * u * 0.5 - k * 70 * u, 5 * u + k * 12 * u, 0, TAU); ctx.fill(); ctx.globalAlpha = 1; }
    ctx.restore();
    const id = kind === 'tackle' ? 'tackle' : kind === 'market' ? 'market' : 'yard';
    this.addHot(id, x - 10 * u, py - h - 46 * u, w + 20 * u, h + 46 * u, kind === 'tackle' ? 'Tackle Shop (Shop)' : kind === 'market' ? 'Fish Market (Sell Catch)' : 'Boat Yard (Boats)');
  }
  drawBarrel(ctx, x, y, u) { ctx.save(); ctx.translate(x, y); ctx.beginPath(); ctx.moveTo(-14 * u, 0); ctx.quadraticCurveTo(-19 * u, -20 * u, -14 * u, -40 * u); ctx.lineTo(14 * u, -40 * u); ctx.quadraticCurveTo(19 * u, -20 * u, 14 * u, 0); ctx.closePath(); paint(ctx, '#a8784a', 2); ctx.strokeStyle = '#5a3c24'; ctx.lineWidth = 2.4; for (const yy of [-30, -10]) { ctx.beginPath(); ctx.moveTo(-17 * u, yy * u); ctx.lineTo(17 * u, yy * u); ctx.stroke(); } ctx.restore(); }
  drawCrate(ctx, x, y, u) { ctx.save(); ctx.translate(x, y); ctx.beginPath(); ctx.rect(-18 * u, -32 * u, 36 * u, 32 * u); paint(ctx, '#c49a68', 2); ctx.strokeStyle = '#7a5a38'; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(-18 * u, -32 * u); ctx.lineTo(18 * u, 0); ctx.moveTo(18 * u, -32 * u); ctx.lineTo(-18 * u, 0); ctx.stroke(); ctx.restore(); }
  drawBoard(ctx, L, x, y, night) {
    const u = L.u; ctx.save(); ctx.translate(x, y);
    ctx.fillStyle = '#6a4a30'; ctx.fillRect(-26 * u, -92 * u, 6 * u, 92 * u); ctx.fillRect(20 * u, -92 * u, 6 * u, 92 * u);
    ctx.beginPath(); ctx.roundRect(-34 * u, -100 * u, 68 * u, 54 * u, 6 * u); paint(ctx, '#d8b884', 2.4);
    const n = this.g.state.quests.active.filter(q => q.done).length;
    for (let i = 0; i < 3; i++) { ctx.save(); ctx.translate(-22 * u + i * 20 * u, -88 * u); ctx.rotate((i - 1) * 0.08); ctx.fillStyle = '#f8f0dc'; ctx.fillRect(0, 0, 16 * u, 22 * u); ctx.strokeStyle = INK; ctx.lineWidth = 1.2; ctx.strokeRect(0, 0, 16 * u, 22 * u); ctx.fillStyle = '#d8503a'; ctx.beginPath(); ctx.arc(8 * u, 2 * u, 2.4 * u, 0, TAU); ctx.fill(); ctx.restore(); }
    if (n > 0) { ctx.beginPath(); ctx.arc(30 * u, -100 * u, 11 * u, 0, TAU); paint(ctx, '#e8a02a', 2); ctx.fillStyle = '#fff'; ctx.font = `700 ${12 * u}px system-ui`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('!', 30 * u, -99 * u); }
    ctx.restore();
  }
  drawLantern(ctx, L, x, y, night) {
    const u = L.u; ctx.save(); ctx.translate(x, y); ctx.fillStyle = '#4a3a2a'; ctx.fillRect(-2 * u, -78 * u, 4 * u, 78 * u);
    if (night > 0.2) glow(ctx, 0, -84 * u, 70 * u, '#ffd890', 0.5 * Math.min(1, night * 1.5));
    ctx.beginPath(); ctx.roundRect(-8 * u, -92 * u, 16 * u, 18 * u, 4 * u); paint(ctx, night > 0.2 ? '#ffe9a0' : '#e8dcc0', 2); ctx.restore();
  }
}

Object.assign(__ex,{Renderer});
};
__mods['ui.js']=function(__ex){
// HTML/CSS user interface: HUD, modals (shop, cargo, book, pets, quests, stats, settings, map...), toasts, catch card.
const { CONFIG, RARITY, RARITY_IDS } = __req('config.js');
const { SPECIES, SPECIES_BY_ID, LOOT_BY_ID, LAYER_NAMES } = __req('fish-data.js');
const { ZONES, ZONE_BY_ID } = __req('zone-data.js');
const { RODS, LINES, HOOKS, BOATS, BAITS, BOOSTS, BAIT_BY_ID, CATS, maxOwned } = __req('upgrades.js');
const { PETS, PET_BY_ID } = __req('pets.js');
const book = __req('fish-book.js');
const inventory = __req('inventory.js');
const prestige = __req('prestige.js');
const { SECRETS } = __req('secrets.js');
const { boostPrice, saleValue } = __req('economy.js');
const { zoneRequirements } = __req('game.js');
const { drawFish, drawLoot, drawGear } = __req('fish-art.js');
const { drawBoat, drawPet, BOAT_META, island, organic, paint, glow, sparkle, INK, TAU, mix, hash } = __req('draw.js');
const { isNight, FS } = __req('fishing.js');

// ---------- helpers ----------
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmt = n => Math.round(n).toLocaleString('en-US');
const fmtW = w => (w < 1 ? `${Math.round(w * 1000)} g` : `${w.toFixed(w < 10 ? 2 : 1)} kg`);
const fmtL = l => (l >= 100 ? `${(l / 100).toFixed(2)} m` : `${l.toFixed(1)} cm`);
const fmtT = s => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
const $ = (sel, root = document) => root.querySelector(sel);
const cap = s => s.charAt(0).toUpperCase() + s.slice(1);

const ICONS = {
  anchor: '<circle cx="12" cy="5" r="2.5"/><path d="M12 7.5V21M7 11h10M4 15c0 3.5 3.5 6 8 6s8-2.5 8-6"/>',
  map: '<path d="M3 6l6-2 6 2 6-2v14l-6 2-6-2-6 2z"/><path d="M9 4v14M15 6v14"/>',
  book: '<path d="M4 5c3-1 6-1 8 1 2-2 5-2 8-1v14c-3-1-6-1-8 1-2-2-5-2-8-1z"/><path d="M12 6v14"/>',
  cargo: '<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M3 11h18M9 7V4h6v3"/>',
  shop: '<path d="M4 9l1.5-5h13L20 9"/><path d="M4 9c0 1.7 1.3 3 3 3s3-1.3 3-3c0 1.7 1.3 3 3 3s3-1.3 3-3c0 1.7 1 3 3 3"/><path d="M5 12v8h14v-8M10 20v-5h4v5"/>',
  scroll: '<path d="M6 4h11a2 2 0 012 2v11a3 3 0 01-3 3H8a3 3 0 01-3-3V6a2 2 0 011-2z"/><path d="M9 9h7M9 13h7"/>',
  paw: '<circle cx="7" cy="10" r="2"/><circle cx="12" cy="7" r="2"/><circle cx="17" cy="10" r="2"/><path d="M12 12c-3 0-5 3-5 5 0 2 2 2.5 5 2.5s5-.5 5-2.5c0-2-2-5-5-5z"/>',
  chart: '<path d="M4 20V10M10 20V4M16 20v-8M22 20H2"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M19 5l-2 2M7 17l-2 2"/>',
  coin: '<circle cx="12" cy="12" r="9"/><path d="M12 7v10M9.5 9.5c0-1 1.1-1.5 2.5-1.5s2.5.6 2.5 1.7-1.2 1.5-2.5 1.8-2.5.7-2.5 1.8 1.1 1.7 2.5 1.7 2.5-.5 2.5-1.5"/>',
};
const iconSvg = n => `<svg viewBox="0 0 24 24" aria-hidden="true">${ICONS[n] || ''}</svg>`;

function canvasHTML(kind, id, w, h, extra = {}) {
  const attrs = Object.entries(extra).map(([k, v]) => ` data-${k}="${esc(v)}"`).join('');
  return `<canvas class="ic" data-k="${kind}" data-id="${esc(id)}" data-w="${w}" data-h="${h}"${attrs}></canvas>`;
}
const iconBox = (kind, id, w, h, extra, cls = '') => `<div class="ic-wrap ${cls}" style="width:${w + 8}px;height:${h + 8}px">${canvasHTML(kind, id, w, h, extra)}</div>`;

class UI {
  constructor(game, renderer) {
    this.g = game; this.r = renderer;
    this.modal = null; this.params = {}; this.tabs = {};
    this.confirm = null;
    this.sel = new Set(); this.inspect = null;
    this.bf = { zone: 'all', rar: 'all', stat: 'all', sort: 'default' };
    this.bookSel = null; this.bookView = 'species';
    this.mapHover = null; this.mapTimer = null; this.catchVisible = false; this.catchInfo = null; this.catchT = 0;
    this.cache = {};
    this.root = $('#modal-root'); this.confirmRoot = $('#confirm-root');
  }

  get modalOpen() { return !!this.modal || !!this.confirm; }

  init() {
    const g = this.g;
    document.querySelectorAll('[data-icon]').forEach(el => { el.innerHTML = iconSvg(el.dataset.icon); });
    document.addEventListener('click', e => this.onClick(e));
    document.addEventListener('change', e => this.onChange(e));
    document.addEventListener('input', e => this.onInput(e));
    g.bus.on('toast', t => this.toast(t.msg, t.kind, t.long));
    g.bus.on('state', () => this.onState());
    g.bus.on('mode', () => this.onMode());
    g.bus.on('zone', () => this.onMode());
    g.bus.on('depth', () => this.updateDepth());
    g.bus.on('catch', info => this.showCatch(info));
    g.bus.on('presentationEnd', () => this.hideCatch());
    g.bus.on('fishingState', () => this.updateStatus(true));
    const cv = $('#stage');
    cv.addEventListener('mousemove', e => { const r = cv.getBoundingClientRect(); this.mouse = { x: e.clientX - r.left, y: e.clientY - r.top }; cv.style.cursor = this.g.inHarbor && this.r.hitTest(this.mouse.x, this.mouse.y) ? 'pointer' : 'default'; });
    cv.addEventListener('mouseleave', () => { this.mouse = { x: -1, y: -1 }; });
    cv.addEventListener('click', e => {
      if (this.modalOpen) return;
      this.g.audio.unlock();
      if (this.g.inHarbor) { const r = cv.getBoundingClientRect(); const h = this.r.hitTest(e.clientX - r.left, e.clientY - r.top); if (h) this.hotspot(h.id); }
    });
    this.mouse = { x: -1, y: -1 };
    this.onMode(); this.updateHUD(true);
    if (g.loadStatus === 'recovered') setTimeout(() => this.toast('Your save file could not be read, so a fresh game was started. A backup of the old data was kept.', 'warn', true), 600);
    if (!g.state.introDone && !/[?&]nointro/.test(location.search)) this.open('intro', { page: 0 });
  }

  hotspot(id) {
    const map = { tackle: ['shop', { tab: 'rod' }], market: ['cargo'], yard: ['shop', { tab: 'boat' }], board: ['quests'], lighthouse: ['prestige'], pets: ['pets'], boat: ['map'] };
    const m = map[id]; if (!m) return;
    if (m[1] && m[1].tab) this.tabs.shop = m[1].tab;
    this.open(m[0]);
  }

  // ---------- toasts ----------
  toast(msg, kind = 'info', long = false) {
    const box = $('#toasts');
    while (box.children.length >= 5) box.firstChild.remove();
    const el = document.createElement('div');
    el.className = `toast ${kind}`; el.textContent = msg;
    box.appendChild(el);
    setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 320); }, long ? 6500 : 3200);
  }

  // ---------- HUD ----------
  setText(id, v, html = false) {
    if (this.cache[id] === v) return;
    this.cache[id] = v;
    const el = document.getElementById(id);
    if (el) (html ? el.innerHTML = v : el.textContent = v);
  }
  onState() {
    this.updateHUD(true);
    if (this.modal && this.modal !== 'settings' && this.modal !== 'map') this.renderModal();
    else if (this.modal === 'map') this.renderModal();
  }
  onMode() {
    const harbor = this.g.inHarbor;
    document.getElementById('depth').classList.toggle('hidden', harbor);
    document.getElementById('guide').classList.toggle('hidden', !this.g.state.settings.guide);
    this.setText('nav-harbor-lbl', harbor ? 'Set Sail' : 'Harbor');
    this.hideCatch();
    this.updateHUD(true); this.updateDepth(); this.updateStatus(true);
  }
  updateHUD() {
    const g = this.g, s = g.state, fx = g.fx, z = g.zone;
    this.setText('hud-zone', g.inHarbor ? 'Little Harbor' : z.name);
    this.setText('hud-boat', `<span class="ico" data-icon="anchor"></span>${esc(fx.boat.name)}`, true);
    this.setText('hud-bait', `Bait: ${esc(fx.bait.name)}`, true);
    this.setText('hud-pet', fx.pet ? `<span class="ico" data-icon="paw"></span>${esc(fx.pet.name)}` : 'No companion', true);
    this.setText('coins-num', fmt(s.coins));
    const n = inventory.count(s), c = inventory.capacity(s);
    this.setText('cargo-text', `${n}/${c}`);
    const bar = document.getElementById('cargo-bar'); if (bar) bar.style.width = `${Math.min(100, (n / c) * 100)}%`;
    document.querySelector('.pill.cargo').classList.toggle('full', n >= c);
    const night = isNight(s.clock);
    this.setText('hud-clock', `<span class="sunmoon ${night ? 'night' : ''}"></span>${night ? 'Night' : 'Day'}`, true);
    // re-inject svg icons for dynamic html
    document.querySelectorAll('#hud [data-icon]').forEach(el => { if (!el.firstChild) el.innerHTML = iconSvg(el.dataset.icon); });
    // badges
    const bb = $('#nav-book .badge'), qb = $('#nav-quests .badge');
    const cl = book.claimableCount(s), qd = s.quests.active.filter(q => q.done).length;
    bb.textContent = cl; bb.classList.toggle('hidden', !cl); qb.textContent = qd; qb.classList.toggle('hidden', !qd);
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.toggle('active', b.dataset.arg === this.modal));
    document.getElementById('guide').classList.toggle('hidden', !s.settings.guide || g.inHarbor);
    this.updateDepth();
    this.updateBoosts();
  }
  updateBoosts() {
    const s = this.g.state, box = document.getElementById('boosts');
    const ids = Object.keys(s.boosts).sort();
    const html = ids.map(id => { const b = BOOSTS.find(x => x.id === id); return `<div class="boost-chip"><b>${esc(b.name)}</b><small>${fmtT(s.boosts[id])}</small></div>`; }).join('');
    if (this.cache.boosts !== html) { this.cache.boosts = html; box.innerHTML = html; }
  }
  updateDepth() {
    const g = this.g, fs = g.fishing, fx = g.fx, z = g.zone;
    if (g.inHarbor) return;
    const mark = document.getElementById('depth-mark'), lim = document.getElementById('depth-limit');
    mark.style.top = `${fs.depth * 100}%`;
    lim.style.height = `${(1 - fx.maxDepth) * 100}%`;
    const layer = ['Surface', 'Midwater', 'Deep'][fs.depth < 0.3 ? 0 : fs.depth < 0.6 ? 1 : 2];
    this.setText('depth-label', `${Math.round(fs.depth * z.depthM)} m<br>${layer}`, true);
  }
  updateStatus(force) {
    const g = this.g, fs = g.fishing, el = document.getElementById('status'), btn = document.getElementById('status-btn');
    let text, warn = false, bt = null, ba = 'harbor';
    if (g.inHarbor) { text = 'Docked at the harbor. Sell, shop, or set sail when ready.'; bt = 'Set Sail'; ba = 'sail'; }
    else { text = fs.statusText(); if (fs.state === FS.FULL) { warn = true; bt = 'Go to Harbor'; } }
    this.setText('status-text', text);
    el.classList.toggle('warn', warn);
    btn.classList.toggle('hidden', !bt);
    if (bt) { btn.textContent = bt; btn.dataset.act = ba; }
  }

  // per-frame
  tick(dt) {
    this.hudT = (this.hudT || 0) + dt;
    if (this.hudT > 0.25) { this.hudT = 0; this.updateStatus(); this.updateBoosts(); this.setText('hud-clock', `<span class="sunmoon ${isNight(this.g.state.clock) ? 'night' : ''}"></span>${isNight(this.g.state.clock) ? 'Night' : 'Day'}`, true); }
    if (this.catchVisible) this.drawCatch(dt);
  }

  // ---------- events ----------
  onClick(e) {
    if (e.target.matches && e.target.matches('input[type=checkbox], input[type=range], select, option')) return;
    const el = e.target.closest('[data-act]');
    if (!el) return;
    if (el.classList.contains('backdrop') && e.target !== el) return;
    if (el.disabled) return;
    this.g.audio.unlock();
    this.act(el.dataset.act, el.dataset.arg, el, e);
    if (document.activeElement && document.activeElement.tagName === 'BUTTON' && !this.modal) document.activeElement.blur();
  }
  onChange(e) {
    const el = e.target;
    if (el.dataset.sel !== undefined) { const uid = +el.dataset.sel; el.checked ? this.sel.add(uid) : this.sel.delete(uid); this.renderModal(); return; }
    if (el.dataset.filter) { this.bf[el.dataset.filter] = el.value; this.renderModal(true); return; }
    if (el.dataset.setting) { const k = el.dataset.setting; const v = el.type === 'checkbox' ? el.checked : +el.value; this.g.setSetting(k, v); if (k === 'guide') this.updateHUD(); if (el.type === 'checkbox') { this.g.audio.sfx('ui'); this.g.save(); this.renderModal(); } else this.g.save(); return; }
    if (el.id === 'import-file') { const f = el.files[0]; if (f) { const r = new FileReader(); r.onload = () => this.doImport(String(r.result)); r.readAsText(f); } }
  }
  onInput(e) {
    const el = e.target;
    if (el.dataset.setting && el.type === 'range') {
      this.g.setSetting(el.dataset.setting, +el.value);
      const out = el.parentElement.querySelector('.val'); if (out) out.textContent = `${Math.round(el.value * 100)}%`;
    }
  }

  act(a, arg, el, e) {
    const g = this.g, s = g.state;
    switch (a) {
      case 'open': this.open(arg); break;
      case 'close': this.close(); break;
      case 'backdrop': this.close(); break;
      case 'harbor': this.toggleHarbor(); break;
      case 'sail': this.close(); g.travel(s.zone); break;
      case 'depth': g.fishing.adjustDepth(+arg); break;
      case 'depth-click': { const r = el.getBoundingClientRect(); g.fishing.setDepth((e.clientY - r.top) / r.height); break; }
      case 'tab': this.tabs[this.modal] = arg; this.renderModal(true); break;
      case 'buy-tier': { const [c, i] = arg.split(':'); g.buyTier(c, +i); break; }
      case 'equip-tier': { const [c, i] = arg.split(':'); g.equipTier(c, +i); break; }
      case 'buy-bait': g.buyBait(arg); break;
      case 'equip-bait': g.equipBait(arg); break;
      case 'buy-boost': g.buyBoost(arg); break;
      case 'inspect': this.inspect = +arg; this.renderModal(); break;
      case 'fav': g.toggleFav(+arg); break;
      case 'open-bottle': g.openBottle(+arg); break;
      case 'sel-all': for (const it of s.cargo) if (!it.fav) this.sel.add(it.uid); this.renderModal(); break;
      case 'sel-none': this.sel.clear(); this.renderModal(); break;
      case 'sell-sel': { const r = g.sellItems([...this.sel]); if (r.count) { this.sel.clear(); this.firstSaleHint(); } break; }
      case 'sell-one': { const r = g.sellItems([+arg]); if (r.count) { this.sel.delete(+arg); this.inspect = null; this.firstSaleHint(); } break; }
      case 'sell-all': { const r = g.sellItems(s.cargo.map(i => i.uid)); if (r.count) { this.sel.clear(); this.firstSaleHint(); } break; }
      case 'sell-junk': { const r = g.sellKinds(['junk']); if (r.count) this.firstSaleHint(); break; }
      case 'book-sel': this.bookSel = arg; this.renderModal(); break;
      case 'book-zone': this.bf.zone = this.bf.zone === arg ? 'all' : arg; this.bookView = 'species'; this.tabs.book = 'species'; this.renderModal(true); break;
      case 'claim-ms': g.claimMilestone(arg); break;
      case 'claim-all': g.claimAllMilestones(); break;
      case 'pet-select': g.selectPet(arg === 'none' ? null : arg); break;
      case 'pet-buy': g.buyPet(arg); break;
      case 'deco-select': g.selectDeco(arg === 'none' ? null : arg); break;
      case 'title-select': g.selectTitle(arg === 'none' ? null : arg); break;
      case 'q-accept': g.acceptQuest(+arg); break;
      case 'q-abandon': g.abandonQuest(+arg); break;
      case 'q-claim': g.claimQuest(+arg); break;
      case 'q-reroll': g.rerollQuests(); break;
      case 'map-go': { const r = g.travel(arg); if (r.ok) this.close(); else g.note(r); break; }
      case 'prestige-open': this.open('prestige'); break;
      case 'prestige-do': this.askConfirm({ title: 'Begin a new voyage?', text: `You will earn ${prestige.starsGain(s)} Tide Star(s), but your coins, gear, boats, cargo, requests and zone access will reset. Your fish book, records, pets, secrets, cosmetics and milestones are kept.`, ok: 'Begin anew', danger: true, onOk: () => { this.close(); g.doPrestige(); } }); break;
      case 'perk': g.buyPerk(arg); break;
      case 'intro-next': this.params.page++; this.renderModal(true); break;
      case 'intro-skip': this.close(); break;
      case 'resume': this.close(); break;
      case 'save-now': g.save(); this.toast(g.lastSaveOk ? 'Game saved.' : 'Could not write to local storage (private mode?).', g.lastSaveOk ? 'good' : 'warn'); break;
      case 'export': this.doExport(); break;
      case 'copy-export': this.copyExport(); break;
      case 'import-text': this.doImport($('#import-text').value); break;
      case 'reset': this.askConfirm({ title: 'Erase all progress?', text: 'This permanently deletes your save: coins, gear, fish book, pets and everything else. This cannot be undone.', ok: 'Erase everything', danger: true, onOk: () => { this.close(); g.resetAll(); this.toast('Save erased. A fresh voyage begins.', 'info'); } }); break;
      case 'confirm-ok': { const c = this.confirm; this.closeConfirm(); if (c && c.onOk) c.onOk(); break; }
      case 'confirm-cancel': this.closeConfirm(); break;
      case 'dismiss-catch': this.dismissCatch(); break;
      case 'mute': g.setSetting('muteAll', !s.settings.muteAll); g.save(); this.renderModal(); break;
    }
  }

  firstSaleHint() { /* the hint toast is triggered by the harbor visit; kept as hook for future use */ }

  toggleHarbor() {
    if (this.g.inHarbor) { this.close(); this.g.travel(this.g.state.zone); } else { this.close(); this.g.goHarbor(); if (!this.g.state.hints.harbor) { this.g.state.hints.harbor = true; this.g.bus.emit('toast', { msg: 'Welcome to the harbor! Click the Fish Market (or open Cargo) to sell catches, and the Tackle Shop to buy gear.', kind: 'hint', long: true }); } }
  }

  // ---------- modal management ----------
  open(name, params = {}) {
    if (this.confirm) this.closeConfirm();
    if (this.modal === name && name !== 'intro') { this.close(); return; }
    this.modal = name; this.params = params;
    this.g.modalOpen = true; this.g.paused = name === 'pause';
    this.g.axis = 0;
    this.g.audio.unlock(); this.g.audio.sfx('ui');
    if (document.activeElement && document.activeElement !== document.body) document.activeElement.blur();
    this.renderModal(true);
    this.updateHUD();
  }
  close() {
    const was = this.modal;
    this.modal = null; this._shown = null; this.root.innerHTML = ''; this.g.modalOpen = false; this.g.paused = false;
    this.stopMap();
    if (was === 'intro') { this.g.markIntroDone(); this.g.bus.emit('toast', { msg: 'Tip: SPACE casts your line. Use A/D to steer, W/S to change depth.', kind: 'hint', long: true }); this.g.state.hints.fish = true; }
    if (document.activeElement && document.activeElement !== document.body) document.activeElement.blur();
    this.updateHUD();
    if (was) this.g.audio.sfx('ui');
  }
  handleEsc() {
    if (this.confirm) { this.closeConfirm(); return; }
    if (this.modal) { this.close(); return; }
    this.open('pause');
  }
  handleEnter() {
    if (this.confirm) { this.act('confirm-ok'); return; }
    const root = this.root;
    const btn = root.querySelector('[data-enter]:not(:disabled)');
    if (btn) btn.click();
  }

  askConfirm(c) {
    this.confirm = c;
    this.confirmRoot.innerHTML = `<div class="backdrop" data-act="confirm-cancel"><div class="modal narrow" role="alertdialog" aria-modal="true"><div class="modal-head"><h2>${esc(c.title)}</h2></div><div class="modal-body"><p>${esc(c.text)}</p></div><div class="modal-foot"><button class="btn" data-act="confirm-cancel">Cancel</button><button class="btn ${c.danger ? 'danger' : 'primary'}" data-act="confirm-ok">${esc(c.ok)}</button></div></div></div>`;
    this.g.modalOpen = true;
  }
  closeConfirm() { this.confirm = null; this.confirmRoot.innerHTML = ''; this.g.modalOpen = !!this.modal; }

  renderModal(resetScroll) {
    const name = this.modal; if (!name) return;
    const fn = this['screen_' + name]; if (!fn) return;
    const old = this.root.querySelector('.modal-body');
    const scroll = old && !resetScroll ? old.scrollTop : 0;
    const sc = fn.call(this);
    const tabs = sc.tabs ? `<div class="tabs" role="tablist">${sc.tabs.map(t => `<button class="tab ${t.id === sc.tab ? 'active' : ''}" role="tab" data-act="tab" data-arg="${t.id}">${esc(t.label)}${t.badge ? `<i class="badge">${t.badge}</i>` : ''}</button>`).join('')}</div>` : '';
    const first = this._shown !== name; this._shown = name;
    this.root.innerHTML = `<div class="backdrop ${first ? 'anim' : ''}" data-act="backdrop"><div class="modal ${first ? 'anim' : ''} ${sc.cls || ''}" role="dialog" aria-modal="true" aria-label="${esc(sc.title)}">
      <div class="modal-head"><h2>${esc(sc.title)}</h2>${sc.sub ? `<span class="sub">${sc.sub}</span>` : ''}${sc.noClose ? '' : '<button class="x-btn" data-act="close" aria-label="Close">&times;</button>'}</div>
      ${tabs}<div class="modal-body">${sc.body}</div>${sc.foot ? `<div class="modal-foot">${sc.foot}</div>` : ''}</div></div>`;
    const nb = this.root.querySelector('.modal-body'); if (nb) nb.scrollTop = scroll;
    this.paintIcons(this.root);
    if (name === 'map') this.startMap();
  }

  paintIcons(root) {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    root.querySelectorAll('canvas[data-k]').forEach(cv => {
      const w = +cv.dataset.w, h = +cv.dataset.h; cv.width = w * dpr; cv.height = h * dpr; cv.style.width = w + 'px'; cv.style.height = h + 'px';
      const ctx = cv.getContext('2d'); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const k = cv.dataset.k, id = cv.dataset.id;
      if (k === 'fish') { const sp = SPECIES_BY_ID[id]; drawFish(ctx, sp, { x: w / 2, y: h / 2, size: Math.min(w * 0.76, h * 0.98), t: 0.6, sil: cv.dataset.sil === '1', variant: cv.dataset.v === '1' }); }
      else if (k === 'loot') drawLoot(ctx, id, w / 2, h / 2, Math.min(w, h) * 0.85, 0.5);
      else if (k === 'gear') drawGear(ctx, cv.dataset.cat, +cv.dataset.idx, w / 2, h / 2, Math.min(w, h) * 0.9, 0.5, { color: cv.dataset.color });
      else if (k === 'boat') { const m = BOAT_META[+id], sc = Math.min(w / (m.w * 1.12), h / (m.h * 6.2)); ctx.translate(w / 2, h * 0.8); ctx.scale(sc, sc); drawBoat(ctx, +id, { t: 0.5 }); }
      else if (k === 'pet') { ctx.translate(w / 2, h * 0.9); const sc = h / 62; ctx.scale(sc, sc); drawPet(ctx, id, { t: 0.7 }); }
    });
  }

  // ---------- shared fragments ----------
  rarTag(rid) { const R = RARITY[rid]; return `<span class="tag" style="color:${R.color};border-color:${R.color}">${R.name}</span>`; }
  harborBanner(text) {
    if (this.g.inHarbor) return '';
    return `<div class="banner"><span>${text}</span><button class="btn small primary" data-act="harbor">Go to Harbor</button></div>`;
  }

  // ---------- SHOP ----------
  screen_shop() {
    const g = this.g, s = g.state, harbor = g.inHarbor;
    const tab = this.tabs.shop || 'rod';
    const tabs = [['rod', 'Rods'], ['line', 'Lines'], ['hook', 'Hooks'], ['bait', 'Baits'], ['boat', 'Boats'], ['boost', 'Boosts']].map(([id, label]) => ({ id, label }));
    let body = this.harborBanner('You can browse the shop anywhere, but you can only buy things at the harbor.');
    if (tab === 'bait') body += `<div class="grid c2">${BAITS.map(b => this.baitCard(b)).join('')}</div>`;
    else if (tab === 'boost') body += `<p class="muted">Boosts are short and optional. Buying one again only refreshes it, so they never stack. Nothing here is required to finish the game.</p><div class="grid c2">${BOOSTS.map(b => this.boostCard(b)).join('')}</div>`;
    else body += `<div class="grid c2">${CATS[tab].map((_, i) => this.tierCard(tab, i)).join('')}</div>`;
    return { title: 'Tackle Shop', sub: `<span class="price">${fmt(s.coins)} coins</span>`, tabs, tab, body };
  }
  tierCard(cat, idx) {
    const g = this.g, s = g.state, def = CATS[cat][idx], owned = s.owned[cat].includes(idx), eq = s.equipped[cat] === idx;
    const next = maxOwned(s, cat) + 1 === idx, cur = CATS[cat][s.equipped[cat]], harbor = g.inHarbor, z = g.zone;
    const sgn = n => (n > 0 ? '+' : '') + n;
    let ben = [];
    if (cat === 'rod') { ben.push(`Bite time <b>-${Math.round(def.biteRed * 100)}%</b>${idx !== s.equipped.rod ? ` <span class="muted">(${sgn(Math.round((def.biteRed - cur.biteRed) * 100))}% vs equipped)</span>` : ''}`); ben.push(`Special: ${esc(def.special)}`); }
    if (cat === 'line') { ben.push(`Reach <b>${Math.round(def.maxDepth * 100)}%</b> of the water depth (${Math.round(def.maxDepth * z.depthM)} m in ${esc(z.name)})`); if (idx !== s.equipped.line) ben.push(`<span class="muted">${sgn(Math.round((def.maxDepth - cur.maxDepth) * 100))}% depth vs equipped</span>`); const zs = ZONES.filter(zz => zz.req.line === idx).map(zz => zz.name); if (zs.length) ben.push(`Helps unlock: ${esc(zs.join(', '))}`); }
    if (cat === 'hook') { const sz = ['', '', '≈5 kg', '≈20 kg', '≈60 kg', '≈200 kg', '≈600 kg', 'any size'][def.cap]; ben.push(`Fish up to size class <b>${def.cap}</b> (${sz} average)`); ben.push(def.sizeBonus ? `Fish are ${Math.round(def.sizeBonus * 100)}% larger on average` : 'No size bonus'); const zs = ZONES.filter(zz => zz.req.hook === idx).map(zz => zz.name); if (zs.length) ben.push(`Helps unlock: ${esc(zs.join(', '))}`); }
    if (cat === 'boat') { ben.push(`Cargo: <b>${def.cap}</b> items${idx !== s.equipped.boat ? ` <span class="muted">(${sgn(def.cap - cur.cap)})</span>` : ''}`); ben.push(`Speed: <b>${Math.round(def.speed * 100)}%</b>`); const zs = ZONES.filter(zz => zz.req.boat === idx).map(zz => zz.name); if (zs.length) ben.push(`Opens the way to: ${esc(zs.join(', '))}`); }
    let btn;
    if (eq) btn = `<button class="btn" disabled>Equipped</button>`;
    else if (owned) btn = `<button class="btn primary" data-act="equip-tier" data-arg="${cat}:${idx}">Equip</button>`;
    else if (next) { const can = s.coins >= def.price && harbor; btn = `<button class="btn ${can ? 'gold' : ''}" data-act="buy-tier" data-arg="${cat}:${idx}" ${can ? '' : 'disabled'}>Buy &middot; ${fmt(def.price)}</button>`; }
    else btn = `<button class="btn" disabled>Locked: buy the previous one first</button>`;
    const art = cat === 'boat' ? iconBox('boat', idx, 120, 76, {}) : iconBox('gear', cat + idx, 76, 76, { cat, idx, color: def.color });
    return `<div class="card ${eq ? 'equipped' : ''} ${!owned && !next ? 'locked' : ''} ${!owned && next ? (s.coins >= def.price ? 'can' : 'poor') : ''}"><div class="row top">${art}<div class="grow col gap4"><h3>${esc(def.name)}</h3><p>${esc(def.desc)}</p>${ben.map(b => `<div class="small">${b}</div>`).join('')}<div class="row spread wrap" style="margin-top:6px"><span class="tag" style="color:${eq ? '#3f8a4f' : owned ? '#3b82c4' : '#8a6a44'}">${eq ? 'Equipped' : owned ? 'Owned' : (def.price ? fmt(def.price) + ' coins' : 'Free')}</span>${btn}</div></div></div></div>`;
  }
  baitCard(b) {
    const g = this.g, s = g.state, owned = s.owned.bait.includes(b.id), eq = s.equipped.bait === b.id;
    const targets = SPECIES.filter(sp => sp.bait.includes(b.cat));
    const zs = [...new Set(targets.map(sp => ZONE_BY_ID[sp.zone].name))];
    const known = targets.filter(sp => s.book[sp.id]).map(sp => sp.name), unk = targets.length - known.length;
    let btn;
    if (eq) btn = `<button class="btn" disabled>Equipped</button>`;
    else if (owned) btn = `<button class="btn primary" data-act="equip-bait" data-arg="${b.id}">Equip</button>`;
    else { const can = s.coins >= b.price && g.inHarbor; btn = `<button class="btn ${can ? 'gold' : ''}" data-act="buy-bait" data-arg="${b.id}" ${can ? '' : 'disabled'}>Buy &middot; ${fmt(b.price)}</button>`; }
    return `<div class="card ${eq ? 'equipped' : ''} ${!owned ? (s.coins >= b.price ? 'can' : 'poor') : ''}"><div class="row top">${iconBox('gear', 'bait' + b.id, 72, 72, { cat: 'bait', idx: 0, color: b.color })}<div class="grow col gap4"><h3>${esc(b.name)}</h3><p>${esc(b.desc)}</p>
      <div class="small"><b>Suited for:</b> ${zs.map(z => `<span class="tag" style="color:#2f7a90">${esc(z)}</span>`).join(' ')}</div>
      <div class="small"><b>Attracts:</b> ${known.length ? esc(known.join(', ')) : 'no known species yet'}${unk ? ` <span class="muted">+ ${unk} not yet discovered</span>` : ''}</div>
      <div class="row spread" style="margin-top:6px"><span class="tag" style="color:${owned ? '#3b82c4' : '#8a6a44'}">${owned ? 'Owned' : (b.price ? fmt(b.price) + ' coins' : 'Free')}</span>${btn}</div></div></div></div>`;
  }
  boostCard(b) {
    const g = this.g, s = g.state, price = boostPrice(s, b), left = s.boosts[b.id] || 0;
    const blocked = left > b.duration * 0.5, can = s.coins >= price && g.inHarbor && !blocked;
    return `<div class="card ${left ? 'equipped' : s.coins >= price ? 'can' : 'poor'}"><div class="row top">${iconBox('gear', 'boost' + b.id, 64, 64, { cat: 'boost', idx: 0, color: ['#8ad0e8', '#e8c15a', '#9ad89a', '#c8a8f0', '#f0a080', '#e8b0c8'][BOOSTS.indexOf(b)] })}<div class="grow col gap4"><h3>${esc(b.name)}</h3><p>${esc(b.desc)}</p><div class="small">Lasts <b>${fmtT(b.duration)}</b> of play time</div>
      <div class="row spread" style="margin-top:6px"><span class="tag" style="color:${left ? '#3f8a4f' : '#8a6a44'}">${left ? 'Active ' + fmtT(left) : fmt(price) + ' coins'}</span><button class="btn ${can ? 'gold' : ''}" data-act="buy-boost" data-arg="${b.id}" ${can ? '' : 'disabled'}>${left ? 'Refresh' : 'Activate'} &middot; ${fmt(price)}</button></div></div></div></div>`;
  }

  // ---------- CARGO ----------
  screen_cargo() {
    const g = this.g, s = g.state, harbor = g.inHarbor;
    const uids = new Set(s.cargo.map(i => i.uid));
    for (const u of [...this.sel]) if (!uids.has(u)) this.sel.delete(u);
    if (this.inspect !== null && !uids.has(this.inspect)) this.inspect = null;
    const items = [...s.cargo].sort((a, b) => this.rank(b) - this.rank(a) || b.value - a.value);
    const n = items.length, c = inventory.capacity(s);
    const selTotal = inventory.expectedValue(s, [...this.sel]), allTotal = inventory.expectedValue(s);
    const rows = items.map(it => this.cargoRow(it)).join('') || `<div class="card"><p>Your cargo hold is empty. Cast a line and see what the sea offers!</p></div>`;
    const full = n >= c;
    const banner = !harbor ? `<div class="banner ${full ? 'bad' : ''}"><span>${full ? '<b>Cargo is full!</b> You cannot cast until you sell.' : 'Fish can only be sold at the harbor.'}</span><button class="btn small primary" data-act="harbor">Go to Harbor</button></div>` : '';
    const body = `${banner}<div class="row spread" style="margin-bottom:8px"><div class="grow"><div class="prog"><i style="width:${(n / c) * 100}%"></i></div></div><b>${n} / ${c} slots</b></div>
      <div class="cargo-layout"><div class="col gap8">${rows}</div><div class="detail">${this.cargoDetail()}</div></div>`;
    const foot = `<button class="btn small ghost" data-act="sel-all">Select all</button><button class="btn small ghost" data-act="sel-none">Clear</button>
      <button class="btn" data-act="sell-junk" ${harbor && s.cargo.some(i => i.kind === 'junk' && !i.fav) ? '' : 'disabled'}>Sell junk</button>
      <button class="btn" data-act="sell-sel" ${harbor && this.sel.size ? '' : 'disabled'}>Sell selected (${this.sel.size}) &middot; ${fmt(selTotal)}</button>
      <button class="btn gold" data-enter data-act="sell-all" ${harbor && allTotal > 0 ? '' : 'disabled'}>Sell all &middot; ${fmt(allTotal)}</button>`;
    return { title: 'Cargo Hold', sub: `${n}/${c} items`, body, foot };
  }
  rank(it) { return it.kind === 'fish' ? RARITY[SPECIES_BY_ID[it.id].rarity].index : it.kind === 'treasure' ? 2 : 0; }
  itemInfo(it) {
    if (it.kind === 'fish') { const sp = SPECIES_BY_ID[it.id]; return { name: sp.name, rar: sp.rarity, sp }; }
    const d = LOOT_BY_ID[it.id]; return { name: d.name, rar: it.kind === 'treasure' ? 'rare' : 'common', def: d };
  }
  cargoRow(it) {
    const inf = this.itemInfo(it), sel = this.sel.has(it.uid);
    const art = it.kind === 'fish' ? canvasHTML('fish', it.id, 64, 42, it.variant ? { v: 1 } : {}) : canvasHTML('loot', it.id, 64, 42);
    const sub = it.kind === 'fish' ? `${fmtW(it.w)} &middot; ${fmtL(it.l)}${it.variant ? ' &middot; <b style="color:#c0508a">Prismatic</b>' : ''}` : (it.kind === 'treasure' ? 'Treasure' : 'Junk');
    return `<div class="item-row ${sel ? 'sel' : ''} ${it.fav ? 'fav' : ''}" data-act="inspect" data-arg="${it.uid}"><input type="checkbox" data-sel="${it.uid}" ${sel ? 'checked' : ''} ${it.fav ? 'disabled' : ''} aria-label="Select ${esc(inf.name)}"><div class="ic-wrap" style="width:72px;height:50px">${art}</div>
      <div class="grow"><b>${esc(inf.name)}</b> ${this.rarTag(inf.rar)}<div class="muted">${sub}</div></div><div class="price">${fmt(saleValue(this.g.state, it))}</div>
      <button class="star-btn ${it.fav ? 'on' : ''}" data-act="fav" data-arg="${it.uid}" title="${it.fav ? 'Protected from sale' : 'Protect from sale'}" aria-label="Toggle favorite">&#9733;</button></div>`;
  }
  cargoDetail() {
    const s = this.g.state, it = s.cargo.find(i => i.uid === this.inspect);
    if (!it) return `<div class="card"><p class="muted">Click an item to inspect it. Use the star to protect special catches from being sold by accident.</p></div>`;
    const inf = this.itemInfo(it), R = RARITY[inf.rar], harbor = this.g.inHarbor;
    let kv = '';
    if (it.kind === 'fish') {
      const b = s.book[it.id] || {};
      kv = `<dt>Weight</dt><dd>${fmtW(it.w)}</dd><dt>Length</dt><dd>${fmtL(it.l)}</dd><dt>Caught in</dt><dd>${esc(ZONE_BY_ID[it.zone] ? ZONE_BY_ID[it.zone].name : '?')}</dd><dt>Record weight</dt><dd>${fmtW(b.recW || it.w)}</dd><dt>Times caught</dt><dd>${b.caught || 1}</dd>`;
    } else kv = `<dt>Found in</dt><dd>${esc(ZONE_BY_ID[it.zone] ? ZONE_BY_ID[it.zone].name : '?')}</dd>`;
    const big = it.kind === 'fish' ? canvasHTML('fish', it.id, 230, 140, it.variant ? { v: 1 } : {}) : canvasHTML('loot', it.id, 230, 140);
    return `<div class="card"><div class="big"><div class="ic-wrap" style="width:238px;height:148px">${big}</div></div><h3 style="text-align:center;color:${R.color}">${esc(inf.name)}</h3><div style="text-align:center">${this.rarTag(inf.rar)}${it.fav ? ' <span class="tag" style="color:#c8962a">Protected</span>' : ''}</div>
      ${inf.def ? `<p>${esc(inf.def.desc)}</p>` : ''}<dl class="kv" style="margin-top:8px">${kv}<dt>Sale value</dt><dd class="price">${fmt(saleValue(s, it))} coins</dd></dl>
      <div class="row wrap" style="margin-top:10px;justify-content:center">${inf.def && inf.def.openable ? `<button class="btn small gold" data-act="open-bottle" data-arg="${it.uid}">Open bottle</button>` : ''}<button class="btn small" data-act="fav" data-arg="${it.uid}">${it.fav ? 'Unprotect' : 'Protect'}</button><button class="btn small primary" data-act="sell-one" data-arg="${it.uid}" ${harbor && !it.fav ? '' : 'disabled'}>Sell this</button></div></div>`;
  }

  // ---------- FISH BOOK ----------
  screen_book() {
    const g = this.g, s = g.state, tab = this.tabs.book || 'species';
    const tp = book.totalProgress(s), cl = book.claimableCount(s);
    const tabs = [{ id: 'species', label: 'Species' }, { id: 'milestones', label: 'Milestones', badge: cl || '' }];
    const head = `<div class="row spread" style="margin-bottom:10px"><div class="grow"><div class="prog gold"><i style="width:${tp.pct}%"></i></div></div><b>${tp.have}/${tp.total} species (${Math.floor(tp.pct)}%)</b></div>`;
    let body = head;
    if (tab === 'milestones') body += this.milestonesHTML();
    else {
      const zbars = `<div class="zone-bars">${ZONES.map(z => { const p = book.zoneProgress(s, z.id); return `<div class="zone-bar ${this.bf.zone === z.id ? 'sel' : ''}" data-act="book-zone" data-arg="${z.id}">${esc(z.name)}<div class="prog" style="margin-top:4px"><i style="width:${p.pct}%"></i></div><span class="muted">${p.have}/${p.total}</span></div>`; }).join('')}</div>`;
      const opt = (id, label, cur) => `<option value="${id}" ${cur === id ? 'selected' : ''}>${label}</option>`;
      const filters = `<div class="filters"><label>Zone <select data-filter="zone">${opt('all', 'All zones', this.bf.zone)}${ZONES.map(z => opt(z.id, z.name, this.bf.zone)).join('')}</select></label>
        <label>Rarity <select data-filter="rar">${opt('all', 'All rarities', this.bf.rar)}${RARITY_IDS.map(r => opt(r, RARITY[r].name, this.bf.rar)).join('')}</select></label>
        <label>Show <select data-filter="stat">${opt('all', 'All', this.bf.stat)}${opt('found', 'Discovered', this.bf.stat)}${opt('unfound', 'Undiscovered', this.bf.stat)}</select></label>
        <label>Sort <select data-filter="sort">${opt('default', 'Zone order', this.bf.sort)}${opt('name', 'Name', this.bf.sort)}${opt('rarity', 'Rarity', this.bf.sort)}${opt('weight', 'Largest weight', this.bf.sort)}${opt('value', 'Highest value', this.bf.sort)}</select></label></div>`;
      let list = SPECIES.filter(sp => (this.bf.zone === 'all' || sp.zone === this.bf.zone) && (this.bf.rar === 'all' || sp.rarity === this.bf.rar) && (this.bf.stat === 'all' || (this.bf.stat === 'found') === !!s.book[sp.id]));
      const rec = (sp, k) => (s.book[sp.id] ? s.book[sp.id][k] : -1);
      const sorters = { name: (a, b) => a.name.localeCompare(b.name), rarity: (a, b) => RARITY[b.rarity].index - RARITY[a.rarity].index, weight: (a, b) => rec(b, 'recW') - rec(a, 'recW'), value: (a, b) => rec(b, 'recV') - rec(a, 'recV') };
      if (sorters[this.bf.sort]) list.sort(sorters[this.bf.sort]);
      if (!this.bookSel || !list.some(sp => sp.id === this.bookSel)) this.bookSel = list.length ? list[0].id : null;
      const cards = list.map(sp => { const d = !!s.book[sp.id]; return `<div class="fish-card ${d ? '' : 'undisc'} ${this.bookSel === sp.id ? 'sel' : ''}" data-act="book-sel" data-arg="${sp.id}"><i class="rar-dot" style="background:${RARITY[sp.rarity].color}"></i><div class="ic-wrap ${d ? '' : 'sil'}" style="width:96px;height:62px">${canvasHTML('fish', sp.id, 90, 56, d ? {} : { sil: 1 })}</div><div class="nm">${d ? esc(sp.name) : '???'}</div></div>`; }).join('');
      body += `${zbars}${filters}<div class="book-layout"><div class="grid c3" style="grid-template-columns:repeat(auto-fill,minmax(112px,1fr))">${cards || '<p class="muted">No species match these filters.</p>'}</div><div class="detail">${this.bookDetail()}</div></div>`;
    }
    return { title: 'Fish Book', sub: `${tp.have}/${tp.total} discovered`, tabs, tab, body, cls: '' };
  }
  bookDetail() {
    const s = this.g.state, sp = SPECIES_BY_ID[this.bookSel];
    if (!sp) return '';
    const b = s.book[sp.id], R = RARITY[sp.rarity], z = ZONE_BY_ID[sp.zone];
    const art = `<div class="big"><div class="ic-wrap ${b ? '' : 'sil'}" style="width:238px;height:156px">${canvasHTML('fish', sp.id, 230, 148, b ? {} : { sil: 1 })}</div></div>`;
    if (!b) {
      const rumor = book.describeReq(sp);
      return `<div class="card">${art}<h3 style="text-align:center">???</h3><div style="text-align:center">${this.rarTag(sp.rarity)}</div><dl class="kv" style="margin-top:8px"><dt>Native zone</dt><dd>${esc(z.name)}</dd><dt>Depth</dt><dd>Unknown</dd><dt>Size</dt><dd>Unknown</dd></dl><p class="muted">You haven't caught this species yet.${rumor ? ` <b>Rumor:</b> it ${esc(rumor)}.` : ''}</p></div>`;
    }
    const baits = BAITS.filter(x => sp.bait.includes(x.cat)).map(x => x.name);
    const req = book.describeReq(sp);
    return `<div class="card">${art}<h3 style="text-align:center;color:${R.color}">${esc(sp.name)}</h3><div style="text-align:center">${this.rarTag(sp.rarity)}</div>
      <dl class="kv" style="margin-top:8px"><dt>Native zone</dt><dd>${esc(z.name)}</dd><dt>Depth</dt><dd>${sp.depths.map(d => LAYER_NAMES[d]).join(', ')}</dd><dt>Weight range</dt><dd>${fmtW(sp.wMin)} &ndash; ${fmtW(sp.wMax)}</dd><dt>Length range</dt><dd>${fmtL(sp.lMin)} &ndash; ${fmtL(sp.lMax)}</dd>
      <dt>Number caught</dt><dd>${b.caught}</dd><dt>Record weight</dt><dd>${fmtW(b.recW)}</dd><dt>Record length</dt><dd>${fmtL(b.recL)}</dd><dt>Best sale value</dt><dd class="price">${fmt(b.recV)}</dd><dt>Base value</dt><dd>${fmt(sp.baseValue)}</dd></dl>
      <p class="small"><b>Likes:</b> ${esc(baits.join(', '))}</p>${req ? `<p class="small"><b>Note:</b> this fish ${esc(req)}.</p>` : ''}<p class="small muted">Hook size class ${sp.size} needed.</p></div>`;
  }
  milestonesHTML() {
    const s = this.g.state, ms = book.allMilestones(s);
    const group = (title, list) => `<h4>${esc(title)}</h4><div class="col gap8">${list.map(m => `<div class="ms ${m.ready && !m.claimed ? 'ready' : ''} ${m.claimed ? 'done' : ''}"><div class="grow"><b>${m.pct}% complete</b><div class="muted">${esc(m.reward.text)}</div></div>${m.claimed ? '<span class="tag" style="color:#3f8a4f">Claimed</span>' : `<button class="btn small ${m.ready ? 'gold' : ''}" data-act="claim-ms" data-arg="${m.id}" ${m.ready ? '' : 'disabled'}>${m.ready ? 'Claim' : 'Locked'}</button>`}</div>`).join('')}</div>`;
    const ready = ms.filter(m => m.ready && !m.claimed).length;
    return `<div class="row spread"><p class="muted">Fill your fish book to earn rewards. Each reward can be claimed once.</p><button class="btn gold" data-act="claim-all" ${ready ? '' : 'disabled'}>Claim all (${ready})</button></div>` +
      group('Whole Fish Book', ms.filter(m => m.scope === 'all')) + ZONES.map(z => { const p = book.zoneProgress(s, z.id); return group(`${z.name} (${p.have}/${p.total})`, ms.filter(m => m.scope === z.id)); }).join('');
  }

  // ---------- PETS ----------
  screen_pets() {
    const g = this.g, s = g.state, tab = this.tabs.pets || 'pets';
    const tabs = [{ id: 'pets', label: 'Companions' }, { id: 'deco', label: 'Boat & Titles' }];
    let body = '';
    if (tab === 'pets') {
      body += `<p class="muted">One companion joins you at a time. Each gives a small passive bonus.</p><div class="grid c2">${PETS.map(p => {
        const own = s.pets.owned.includes(p.id), act = s.pets.active === p.id;
        let btn;
        if (act) btn = `<button class="btn" data-act="pet-select" data-arg="none">Send home</button>`;
        else if (own) btn = `<button class="btn primary" data-act="pet-select" data-arg="${p.id}">Choose</button>`;
        else if (p.unlock.type === 'buy') { const can = s.coins >= p.unlock.price && g.inHarbor; btn = `<button class="btn ${can ? 'gold' : ''}" data-act="pet-buy" data-arg="${p.id}" ${can ? '' : 'disabled'}>Adopt &middot; ${fmt(p.unlock.price)}</button>`; }
        else btn = `<button class="btn" disabled>Locked</button>`;
        return `<div class="card ${act ? 'equipped' : ''} ${own ? '' : (p.unlock.type === 'buy' ? (s.coins >= p.unlock.price ? 'can' : 'poor') : 'locked')}"><div class="row top"><div class="ic-wrap" style="width:92px;height:92px">${canvasHTML('pet', p.id, 84, 84)}</div><div class="grow col gap4"><h3>${esc(p.name)}</h3><p>${esc(p.blurb)}</p><div class="small"><b>Bonus:</b> ${esc(p.bonusText)}</div><div class="small muted">${own ? (act ? 'Currently with you' : 'Unlocked') : esc(p.req)}</div><div style="margin-top:6px">${btn}</div></div></div></div>`;
      }).join('')}</div>`;
    } else {
      const decos = book.DECOS;
      body += `<h4 style="margin-top:0">Boat decorations</h4><p class="muted">Pennants earned from 75% zone completion fly from your boat's bow.</p><div class="grid c3"><div class="card ${!s.cosmetics.active ? 'equipped' : ''}"><b>Default pennant</b><div style="margin-top:8px"><button class="btn small" data-act="deco-select" data-arg="none" ${!s.cosmetics.active ? 'disabled' : ''}>${!s.cosmetics.active ? 'In use' : 'Use'}</button></div></div>${decos.map(d => { const own = s.cosmetics.owned.includes(d.id); return `<div class="card ${s.cosmetics.active === d.id ? 'equipped' : ''} ${own ? '' : 'locked'}"><div class="row"><span style="width:26px;height:18px;background:${d.color};border:2px solid ${INK};border-radius:3px 9px 9px 3px;display:inline-block"></span><b>${esc(d.name)}</b></div><div style="margin-top:8px">${own ? `<button class="btn small" data-act="deco-select" data-arg="${d.id}" ${s.cosmetics.active === d.id ? 'disabled' : ''}>${s.cosmetics.active === d.id ? 'In use' : 'Use'}</button>` : '<span class="muted">75% of ' + esc(ZONE_BY_ID[d.zone].name) + '</span>'}</div></div>`; }).join('')}</div>
        <h4>Titles</h4><div class="grid c3"><div class="card"><b>No title</b><div style="margin-top:8px"><button class="btn small" data-act="title-select" data-arg="none" ${!s.cosmetics.title ? 'disabled' : ''}>Use</button></div></div>${Object.entries(book.ALL_TITLES).map(([id, name]) => { const own = s.cosmetics.titles.includes(id); return `<div class="card ${s.cosmetics.title === id ? 'equipped' : ''} ${own ? '' : 'locked'}"><b>${own ? esc(name) : '???'}</b><div style="margin-top:8px">${own ? `<button class="btn small" data-act="title-select" data-arg="${id}" ${s.cosmetics.title === id ? 'disabled' : ''}>${s.cosmetics.title === id ? 'In use' : 'Use'}</button>` : '<span class="muted">Earn through the Fish Book</span>'}</div></div>`; }).join('')}</div>`;
    }
    return { title: 'Companions', sub: `${s.pets.owned.length}/${PETS.length} found`, tabs, tab, body };
  }

  // ---------- QUESTS ----------
  screen_quests() {
    const g = this.g, s = g.state, harbor = g.inHarbor, Q = s.quests, max = CONFIG.quests.maxActive;
    const card = (q, active) => {
      const pct = Math.min(100, (q.progress / q.goal) * 100), r = q.reward;
      const rew = `<b class="price">${fmt(r.coins || 0)} coins</b>${r.bait ? ` + ${esc(r.baitName)}` : ''}${r.clue ? ' + a secret clue' : ''}`;
      let btns;
      if (active) btns = q.done ? `<button class="btn gold" data-enter data-act="q-claim" data-arg="${q.id}" ${harbor ? '' : 'disabled'}>Claim reward</button>` : `<button class="btn small ghost" data-act="q-abandon" data-arg="${q.id}">Drop</button>`;
      else btns = `<button class="btn primary" data-act="q-accept" data-arg="${q.id}" ${harbor && Q.active.length < max ? '' : 'disabled'}>Accept</button>`;
      return `<div class="card ${q.done ? 'equipped' : ''}"><div class="row top"><div class="grow col gap4"><h3>${esc(q.title)}</h3><p>${esc(q.desc)}</p>${active ? `<div class="prog"><i style="width:${pct}%"></i></div><div class="small muted">${q.progress}/${q.goal}${q.done ? ' &middot; Complete!' : ''}</div>` : ''}<div class="small">Reward: ${rew}</div></div><div>${btns}</div></div></div>`;
    };
    const slots = Array.from({ length: max }, (_, i) => Q.active[i] ? card(Q.active[i], true) : `<div class="card locked"><p class="muted" style="text-align:center;margin:18px 0">Empty slot. Accept a request below.</p></div>`).join('');
    const body = `${this.harborBanner('Visit the harbor to accept or claim requests. Progress counts while you fish.')}<h4 style="margin-top:0">Active requests (${Q.active.length}/${max})</h4><div class="grid c2">${slots}</div>
      <h4>Request board</h4><div class="grid c2">${Q.board.map(q => card(q, false)).join('') || '<p class="muted">No requests right now.</p>'}</div>`;
    const foot = `<span class="muted">Requests never expire.</span><button class="btn" data-act="q-reroll" ${harbor && s.coins >= CONFIG.quests.rerollCost ? '' : 'disabled'}>New board &middot; ${CONFIG.quests.rerollCost} coins</button>`;
    return { title: 'Harbor Requests', sub: `${s.stats.requests} completed`, body, foot };
  }

  // ---------- STATS ----------
  screen_stats() {
    const g = this.g, s = g.state, st = s.stats, tp = book.totalProgress(s);
    const stat = (v, l) => `<div class="stat"><b>${v}</b><span>${l}</span></div>`;
    const bs = (k, fn) => st[k] ? `${fn(st[k].v)} <span class="muted">(${esc(SPECIES_BY_ID[st[k].id].name)})</span>` : 'None yet';
    const mins = Math.floor(st.playSeconds / 60);
    const rarStats = RARITY_IDS.map(r => `<div class="stat"><b style="color:${RARITY[r].color}">${st.rarity[r] || 0}</b><span>${RARITY[r].name} catches</span></div>`).join('');
    const sec = SECRETS.map(d => { const f = s.secrets.found[d.id], cl = s.secrets.clues.includes(d.id); return `<div class="card ${f ? 'equipped' : 'locked'}"><b>${f ? esc(d.name) : '???'}</b><p class="small">${f ? esc(d.clue) : esc(d.hint)}${!f && cl ? `<br><b>Clue:</b> ${esc(d.clue)}` : ''}</p></div>`; }).join('');
    const title = s.cosmetics.title ? book.ALL_TITLES[s.cosmetics.title] : null;
    const body = `${title ? `<p style="font:700 16px Georgia">Title: ${esc(title)}</p>` : ''}<div class="stat-grid">
      ${stat(fmt(st.fishCaught), 'Total fish caught')}${stat(fmt(st.fishSold), 'Total fish sold')}${stat(fmt(st.coinsEarned), 'Total coins earned')}${stat(fmt(st.coinsSpent), 'Total coins spent')}${stat(fmt(s.coins), 'Current coins')}
      ${stat(`${tp.have}/${tp.total}`, 'Species discovered')}${stat(`${Math.floor(tp.pct)}%`, 'Collection complete')}${stat(st.treasures, 'Treasures found')}${stat(st.junk, 'Junk recovered')}${stat(st.requests, 'Requests completed')}${stat(`${s.zonesUnlocked.length}/${ZONES.length}`, 'Zones unlocked')}${stat(`${mins} min`, 'Time at sea')}</div>
      <h4>Personal records</h4><div class="stat-grid">${stat(bs('bestW', fmtW), 'Largest fish (weight)')}${stat(bs('bestL', fmtL), 'Longest fish')}${stat(bs('bestV', v => fmt(v) + ' coins'), 'Highest-value catch')}</div>
      <h4>Catches by rarity</h4><div class="stat-grid">${rarStats}</div>
      <h4>Zone completion</h4><div class="stat-grid">${ZONES.map(z => { const p = book.zoneProgress(s, z.id); return `<div class="stat"><b>${Math.floor(p.pct)}%</b><span>${esc(z.name)} (${p.have}/${p.total})</span></div>`; }).join('')}</div>
      <h4>Secrets (${Object.keys(s.secrets.found).length}/${SECRETS.length})</h4><div class="grid c3">${sec}</div>`;
    const foot = `<span class="muted">Records are kept forever, even after you sell the fish.</span><button class="btn" data-act="prestige-open">Lighthouse (Prestige)</button>`;
    return { title: 'Records & Statistics', sub: `${fmt(st.coinsEarned)} coins earned`, body, foot };
  }

  // ---------- PRESTIGE ----------
  screen_prestige() {
    const s = this.g.state, pr = s.prestige, can = prestige.canPrestige(s), avail = prestige.starsAvailable(s);
    const reqs = prestige.requirements(s).map(r => `<div class="list-line ${r.ok ? 'ok' : 'no'} chk">${esc(r.text)}${r.need ? ` (${Math.min(r.now, r.need)}/${r.need})` : ''}</div>`).join('');
    const perks = CONFIG.prestige.perks.map(p => { const lvl = pr.perks[p.id] || 0, cost = lvl + 1, maxed = lvl >= p.max; return `<div class="card"><h3>${esc(p.name)} <span class="tag" style="color:#8a5bc4">Lv ${lvl}/${p.max}</span></h3><p>${esc(p.desc)}</p><button class="btn small gold" data-act="perk" data-arg="${p.id}" ${!maxed && avail >= cost ? '' : 'disabled'}>${maxed ? 'Maxed' : `Learn &middot; ${cost} star${cost > 1 ? 's' : ''}`}</button></div>`; }).join('');
    const body = `<p>The old lighthouse keeper offers you a fresh start: sail again from Pebble Cove with a little extra luck from the tides. This is entirely <b>optional</b>.</p>
      <div class="banner info"><span><b>Resets:</b> coins, gear, boats, bait, cargo, requests, boosts, unlocked zones.<br><b>Keeps:</b> fish book, records, stats, pets, secrets, decorations, titles, milestones, Tide Stars.</span></div>
      <h4>Requirements</h4>${reqs}<p style="margin-top:10px">Tide Stars you would earn now: <b>${prestige.starsGain(s)}</b> &middot; Total owned: <b>${pr.stars}</b> (${avail} to spend) &middot; Each star gives +${Math.round(CONFIG.prestige.saleBonusPerStar * 100)}% sale value permanently.</p>
      <h4>Tide perks</h4><div class="grid c2">${perks}</div>`;
    const foot = `<button class="btn danger" data-act="prestige-do" ${can ? '' : 'disabled'}>${can ? 'Begin a new voyage' : 'Not available yet'}</button>`;
    return { title: 'The Lighthouse', sub: `Tide Stars ${avail}`, cls: 'mid', body, foot };
  }

  // ---------- SETTINGS ----------
  screen_settings() {
    const st = this.g.state.settings;
    const sl = (k, label, mk) => `<div class="slider-row"><label for="s-${k}">${label}</label><input id="s-${k}" type="range" min="0" max="1" step="0.01" value="${st[k]}" data-setting="${k}"><span class="val">${Math.round(st[k] * 100)}%</span><label class="switch"><input type="checkbox" data-setting="${mk}" ${st[mk] ? 'checked' : ''}>Mute</label></div>`;
    const sw = (k, label) => `<label class="switch"><input type="checkbox" data-setting="${k}" ${st[k] ? 'checked' : ''}>${label}</label>`;
    const body = `<h4 style="margin-top:0">Audio</h4>${sl('music', 'Music', 'muteMusic')}${sl('ambient', 'Ambient', 'muteAmbient')}${sl('sfx', 'Effects', 'muteSfx')}${sw('muteAll', 'Mute everything')}
      <p class="muted">Audio starts after your first click or key press. The game works fine without sound.</p>
      <h4>Display</h4>${sw('guide', 'Show controls guide while fishing')}${sw('lowFx', 'Reduce particle effects (better performance)')}
      <h4>Save data</h4><p class="muted">Your game saves automatically in this browser. Export a backup file or move your save to another browser.</p>
      <div class="row wrap"><button class="btn" data-act="save-now">Save now</button><button class="btn" data-act="export">Download save file</button><button class="btn" data-act="copy-export">Copy save to clipboard</button><label class="btn" for="import-file">Import file...</label><input type="file" id="import-file" accept=".json,application/json,text/plain" class="hidden"></div>
      <div style="margin-top:10px"><textarea id="import-text" placeholder="Paste a save here, then press Import from text" aria-label="Import save text"></textarea><div style="margin-top:6px"><button class="btn small" data-act="import-text">Import from text</button></div></div>
      <h4>Danger zone</h4><button class="btn danger" data-act="reset">Erase all progress...</button>`;
    return { title: 'Settings', cls: 'mid', body };
  }
  doExport() {
    const txt = this.g.exportSave();
    const blob = new Blob([txt], { type: 'application/json' }), a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = 'little-tides-save.json'; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    this.toast('Save file downloaded.', 'good');
  }
  copyExport() {
    const txt = this.g.exportSave();
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(txt).then(() => this.toast('Save copied to clipboard.', 'good'), () => this.toast('Could not copy. Use Download instead.', 'warn'));
    else this.toast('Clipboard unavailable. Use Download instead.', 'warn');
  }
  doImport(text) {
    if (!text || !text.trim()) { this.toast('Paste a save first.', 'warn'); return; }
    this.askConfirm({ title: 'Replace your current game?', text: 'Importing replaces your current progress with the imported save.', ok: 'Import', danger: true, onOk: () => { const r = this.g.importSave(text); this.toast(r.msg, r.ok ? 'good' : 'warn'); if (r.ok) this.close(); } });
  }

  // ---------- PAUSE ----------
  screen_pause() {
    const g = this.g;
    const body = `<div class="col gap8" style="align-items:stretch"><button class="btn primary" data-enter data-act="resume">Resume</button>
      <button class="btn" data-act="open" data-arg="settings">Settings &amp; Audio</button><button class="btn" data-act="open" data-arg="map">World Map</button>
      <button class="btn" data-act="harbor">${g.inHarbor ? 'Set Sail' : 'Return to Harbor'}</button><button class="btn" data-act="save-now">Save game</button></div>
      <h4>Controls</h4><div class="small" style="line-height:2"><kbd>A</kbd>/<kbd>D</kbd> or <kbd>&larr;</kbd>/<kbd>&rarr;</kbd> steer the boat<br><kbd>W</kbd>/<kbd>S</kbd> or <kbd>&uarr;</kbd>/<kbd>&darr;</kbd> choose fishing depth<br><kbd>SPACE</kbd> cast the line (or dismiss a catch)<br><kbd>H</kbd> harbor &middot; <kbd>M</kbd> map &middot; <kbd>B</kbd> fish book &middot; <kbd>C</kbd> cargo &middot; <kbd>P</kbd> pets<br><kbd>ESC</kbd> close menus / pause &middot; <kbd>Enter</kbd> confirm</div>`;
    return { title: 'Paused', cls: 'narrow', body, noClose: false };
  }

  // ---------- INTRO ----------
  screen_intro() {
    const p = this.params.page || 0;
    const pages = [
      { t: 'Welcome to Little Tides', b: `<p>A small boat, a little rod and a big, gentle sea. Catch fish, sell them in the harbor, fill your fish book and sail to seven very different waters.</p><p class="muted">No rushing and no reflex tests. Cast your line, enjoy the view, and wait for the sea to answer.</p><div style="text-align:center;margin:10px 0">${iconBox('boat', 0, 220, 110, {})}</div>` },
      { t: 'How to fish', b: `<div class="small" style="line-height:2.2"><kbd>A</kbd><kbd>D</kbd> or <kbd>&larr;</kbd><kbd>&rarr;</kbd> steer the boat<br><kbd>W</kbd><kbd>S</kbd> or <kbd>&uarr;</kbd><kbd>&darr;</kbd> choose how deep to fish<br><kbd>SPACE</kbd> cast your line, then relax. Fish bite on their own<br><kbd>H</kbd> go to the harbor to sell your catch and shop<br><kbd>ESC</kbd> close menus or pause</div><p class="muted">When your cargo hold is full, head to the harbor, sell your catch and upgrade your gear.</p>` },
      { t: 'Your starter kit', b: `<div class="grid c2" style="margin-bottom:6px"><div class="card row">${iconBox('gear', 'r', 54, 54, { cat: 'rod', idx: 0, color: '#a87a4a' })}<div><b>Driftwood Rod</b><div class="muted small">Your trusty old rod</div></div></div><div class="card row">${iconBox('gear', 'l', 54, 54, { cat: 'line', idx: 0, color: '#e8dcc0' })}<div><b>Cotton Line</b><div class="muted small">Good for the shallows</div></div></div><div class="card row">${iconBox('gear', 'h', 54, 54, { cat: 'hook', idx: 0, color: '#aab4bc' })}<div><b>Bent Pin Hook</b><div class="muted small">Catches small fish</div></div></div><div class="card row">${iconBox('gear', 'b', 54, 54, { cat: 'bait', idx: 0, color: '#c98a8a' })}<div><b>Worm Bait</b><div class="muted small">Reusable. Never runs out</div></div></div></div><p>You also have the <b>Little Wooden Boat</b> and a <b>Harbor Cat</b>. You are starting in <b>Pebble Cove</b>. Good luck!</p>` },
    ];
    const pg = pages[Math.min(p, pages.length - 1)], last = p >= pages.length - 1;
    const foot = `<button class="btn ghost" data-act="intro-skip">Skip</button>${last ? '<button class="btn primary" data-enter data-act="intro-skip">Start fishing</button>' : '<button class="btn primary" data-enter data-act="intro-next">Next</button>'}`;
    return { title: pg.t, sub: `${p + 1} / ${pages.length}`, cls: 'mid', body: pg.b, foot, noClose: false };
  }

  // ---------- MAP ----------
  screen_map() {
    const g = this.g, s = g.state;
    const cards = ZONES.map((z, i) => {
      const un = s.zonesUnlocked.includes(z.id), p = book.zoneProgress(s, z.id), here = s.zone === z.id;
      const reqs = un ? '' : zoneRequirements(s, z).map(r => `<div class="list-line ${r.ok ? 'ok' : 'no'} chk">${esc(r.text)}</div>`).join('');
      return `<div class="card ${here ? 'equipped' : ''} ${un ? '' : 'locked'}" data-zone="${z.id}" id="zc-${z.id}"><div class="row spread"><h3>${esc(z.name)}</h3>${here ? '<span class="tag" style="color:#3f8a4f">You are here</span>' : un ? '' : '<span class="tag" style="color:#8a6a44">Locked</span>'}</div>
        <p>${un ? esc(z.blurb) : esc(z.hint)}</p>${un ? `<div class="small"><b>Discovered:</b> ${p.have}/${p.total} (${Math.floor(p.pct)}%)</div><div class="prog" style="margin:4px 0"><i style="width:${p.pct}%"></i></div><div class="small"><b>Suggested:</b> ${esc(z.suggested)}</div><div style="margin-top:8px"><button class="btn small primary" data-act="map-go" data-arg="${z.id}" ${here && !g.inHarbor ? 'disabled' : ''}>${here && !g.inHarbor ? 'Current zone' : 'Sail here'}</button></div>` : `<div style="margin-top:6px">${reqs}</div>`}</div>`;
    }).join('');
    const body = `<div class="map-layout"><div><canvas id="map-canvas" aria-label="World map. Click an unlocked island to sail there."></canvas><p class="muted small">Click an unlocked island to sail there. Locked islands show what they need.</p></div><div class="col gap8" style="max-height:60vh;overflow:auto;padding-right:4px">${cards}</div></div>`;
    return { title: 'World Map', sub: `${s.zonesUnlocked.length}/${ZONES.length} zones`, body };
  }
  startMap() {
    this.stopMap();
    const cv = document.getElementById('map-canvas'); if (!cv) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2), r = cv.getBoundingClientRect();
    cv.width = Math.round(r.width * dpr); cv.height = Math.round(r.height * dpr);
    this.mapT = 0;
    const pos = e => { const b = cv.getBoundingClientRect(); return { x: (e.clientX - b.left) / b.width, y: (e.clientY - b.top) / b.height }; };
    const hit = p => ZONES.find(z => Math.hypot((p.x - z.map.x) * 1.6, (p.y - z.map.y)) < z.map.r * 0.9);
    cv.onmousemove = e => { const z = hit(pos(e)); this.mapHover = z ? z.id : null; cv.style.cursor = z ? 'pointer' : 'default'; };
    cv.onmouseleave = () => { this.mapHover = null; };
    cv.onclick = e => {
      const z = hit(pos(e)); if (!z) return;
      if (this.g.state.zonesUnlocked.includes(z.id)) { this.act('map-go', z.id); } else {
        this.g.audio.sfx('error'); this.toast(z.hint, 'info', true);
        const card = document.getElementById('zc-' + z.id); if (card) card.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      }
    };
    const draw = () => { this.mapT += 0.06; this.drawMap(cv, dpr); };
    draw(); this.mapTimer = setInterval(draw, 60);
  }
  stopMap() { if (this.mapTimer) { clearInterval(this.mapTimer); this.mapTimer = null; } }
  drawMap(cv, dpr) {
    if (!document.body.contains(cv)) { this.stopMap(); return; }
    const ctx = cv.getContext('2d'), W = cv.width / dpr, H = cv.height / dpr, t = this.mapT, s = this.g.state;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const bg = ctx.createLinearGradient(0, 0, 0, H); bg.addColorStop(0, '#9ad8e2'); bg.addColorStop(1, '#4aa0b8'); ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = 'rgba(255,255,255,.3)'; ctx.lineWidth = 1.5;
    for (let i = 0; i < 18; i++) { const y = (i + 0.5) * H / 18; ctx.beginPath(); for (let x = 0; x <= W; x += 10) { const yy = y + Math.sin(x * 0.03 + t + i) * 3; x ? ctx.lineTo(x, yy) : ctx.moveTo(x, yy); } ctx.stroke(); }
    // dotted route
    ctx.setLineDash([4, 8]); ctx.strokeStyle = 'rgba(255,250,230,.7)'; ctx.lineWidth = 2.4; ctx.beginPath();
    ZONES.forEach((z, i) => { const x = z.map.x * W, y = z.map.y * H; i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }); ctx.stroke(); ctx.setLineDash([]);
    // compass
    ctx.save(); ctx.translate(W * 0.07, H * 0.14); ctx.strokeStyle = '#6a5a3a'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0, 0, 22, 0, TAU); ctx.stroke(); ctx.fillStyle = '#d8503a'; ctx.beginPath(); ctx.moveTo(0, -30); ctx.lineTo(6, 0); ctx.lineTo(-6, 0); ctx.fill(); ctx.fillStyle = '#f6ead0'; ctx.beginPath(); ctx.moveTo(0, 30); ctx.lineTo(6, 0); ctx.lineTo(-6, 0); ctx.fill(); ctx.restore();
    for (const z of ZONES) {
      const un = s.zonesUnlocked.includes(z.id), x = z.map.x * W, y = z.map.y * H, rr = z.map.r * W * 0.62, hov = this.mapHover === z.id, here = s.zone === z.id;
      ctx.save(); ctx.translate(x, y + Math.sin(t * 0.8 + z.tier) * 1.5);
      // sandy ring + island
      if (hov) { ctx.beginPath(); ctx.ellipse(0, rr * 0.2, rr * 1.5, rr * 0.7, 0, 0, TAU); ctx.fillStyle = 'rgba(255,255,255,.35)'; ctx.fill(); }
      if (un) {
        organic(ctx, 0, rr * 0.25, rr * 1.3, rr * 0.5, z.tier * 5, 10, 0.08); paint(ctx, '#f0e2b4', 2, '#8a7a4a');
        island(ctx, 0, rr * 0.3, rr * 2.2, rr * 1.2, z.map.shape === 'kelp' ? 'cliff' : z.map.shape, z.tier * 7, 0, 0);
        const p = book.zoneProgress(s, z.id); ctx.beginPath(); ctx.arc(0, -rr * 0.05, rr * 1.25, -Math.PI / 2, -Math.PI / 2 + TAU * p.pct / 100); ctx.lineWidth = 4; ctx.strokeStyle = '#e0a82a'; ctx.lineCap = 'round'; ctx.stroke();
      } else {
        organic(ctx, 0, rr * 0.25, rr * 1.3, rr * 0.5, z.tier * 5, 10, 0.08); paint(ctx, '#7a8a96', 2, '#3a4a58');
        ctx.beginPath(); ctx.moveTo(-rr, rr * 0.2); ctx.quadraticCurveTo(-rr * 0.2, -rr * 0.9, rr * 0.3, -rr * 0.5); ctx.quadraticCurveTo(rr, -rr * 0.2, rr, rr * 0.2); ctx.closePath(); paint(ctx, '#66757f', 2, '#3a4a58');
        ctx.fillStyle = '#f0f4f6'; ctx.font = `700 ${rr * 0.9}px Georgia`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('?', 0, -rr * 0.1);
        ctx.fillStyle = 'rgba(30,40,60,.65)'; ctx.beginPath(); ctx.roundRect(rr * 0.4, rr * 0.05, rr * 0.7, rr * 0.55, 4); ctx.fill(); ctx.strokeStyle = '#f0e8d0'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(rr * 0.75, rr * 0.05, rr * 0.2, Math.PI, 0); ctx.stroke();
      }
      // label
      ctx.font = `700 ${Math.max(11, W * 0.016)}px Georgia, serif`; const label = un ? z.name : '???'; const tw = ctx.measureText(label).width + 16;
      ctx.beginPath(); ctx.roundRect(-tw / 2, rr * 0.95, tw, Math.max(18, W * 0.026), 8); paint(ctx, hov ? '#fff8e0' : '#fbf3e0', 1.6, '#8a6a44'); ctx.fillStyle = un ? '#2b3a4d' : '#6a7a88'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(label, 0, rr * 0.95 + Math.max(18, W * 0.026) / 2);
      if (here) { ctx.save(); ctx.translate(0, -rr * 1.3 + Math.sin(t * 2) * 3); const sc = 0.22; ctx.scale(sc, sc); drawBoat(ctx, s.equipped.boat, { t }); ctx.restore(); }
      ctx.restore();
    }
  }

  // ---------- CATCH CARD ----------
  showCatch(info) {
    const box = document.getElementById('catch'), s = this.g.state;
    this.catchInfo = info; this.catchT = 0; this.catchVisible = true;
    const rid = info.rarity || 'common', R = RARITY[rid];
    let name, w = '', l = '', value, extra = '', badges = '';
    if (info.kind === 'fish') {
      name = info.sp.name; w = fmtW(info.item.w); l = fmtL(info.item.l); value = saleValue(s, info.item);
      if (info.isNew) badges += '<span class="badge-pill">NEW DISCOVERY!</span>';
      if (info.item.variant) badges += '<span class="badge-pill">PRISMATIC!</span>';
      if (info.newW) badges += '<span class="badge-pill rec">Weight record!</span>';
      if (info.newL) badges += '<span class="badge-pill rec">Length record!</span>';
      if (info.newV) badges += '<span class="badge-pill rec">Value record!</span>';
    } else if (info.kind === 'fragment') { name = info.name; value = 0; extra = '<div class="hintline">A piece of an old chart. It was added to your secrets.</div>'; }
    else { const d = LOOT_BY_ID[info.item.id]; name = d.name; value = saleValue(s, info.item); extra = `<div class="hintline">${esc(d.desc)}</div>`; }
    box.innerHTML = `<div class="catch-card ${rid}" style="--rc:${R.color}" data-act="dismiss-catch"><canvas id="catch-cv"></canvas><div class="badges">${badges}</div><div class="rar">${info.kind === 'fish' ? R.name : info.kind === 'treasure' ? 'Treasure' : info.kind === 'junk' ? 'Junk' : 'Secret'}</div><div class="nm">${esc(name)}</div>
      ${info.kind === 'fish' ? `<div class="meta"><span>${w}<small>Weight</small></span><span>${l}<small>Length</small></span></div>` : ''}${info.kind !== 'fragment' ? `<div class="value">${fmt(value)} coins</div>` : ''}${extra}<div class="hintline">Click or press SPACE to continue</div></div>`;
    box.classList.remove('hidden');
    box.style.animation = 'none'; void box.offsetWidth; box.style.animation = '';
    const cv = document.getElementById('catch-cv'), dpr = Math.min(window.devicePixelRatio || 1, 2);
    cv.width = 220 * dpr; cv.height = 130 * dpr; cv.style.width = '220px'; cv.style.height = '130px';
  }
  drawCatch(dt) {
    const cv = document.getElementById('catch-cv'); if (!cv || !this.catchInfo) return;
    this.catchT += dt;
    const info = this.catchInfo, dpr = Math.min(window.devicePixelRatio || 1, 2), ctx = cv.getContext('2d'), t = this.catchT;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, 220, 130);
    const R = RARITY[info.rarity || 'common'], ri = R.index;
    if (ri >= 2) glow(ctx, 110, 65, 90 + Math.sin(t * 3) * 6, R.color, 0.25 + ri * 0.06);
    const pop = Math.min(1, t * 4), sc = 0.6 + 0.4 * (1 - Math.pow(1 - pop, 3));
    ctx.save(); ctx.translate(110, 65 + Math.sin(t * 2.2) * 3);
    if (info.kind === 'fish') drawFish(ctx, info.sp, { x: 0, y: 0, size: 150 * sc, t, variant: info.item.variant });
    else if (info.kind === 'fragment') { ctx.fillStyle = '#f6ead0'; ctx.strokeStyle = '#a08a5a'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-40, -30); ctx.lineTo(10, -36); ctx.lineTo(40, -10); ctx.lineTo(30, 30); ctx.lineTo(-30, 36); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.strokeStyle = '#a08a5a'; for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.moveTo(-26 + i * 6, -16 + i * 12); ctx.lineTo(10 + i * 4, -18 + i * 12); ctx.stroke(); } }
    else drawLoot(ctx, info.item.id, 0, 0, 110 * sc, t);
    ctx.restore();
    if (ri >= 3) for (let i = 0; i < 6 + ri * 2; i++) { const a = t * (0.8 + hash(i) * 0.6) + i; const r = 60 + hash(i * 3) * 40; sparkle(ctx, 110 + Math.cos(a) * r, 65 + Math.sin(a * 1.3) * r * 0.55, 3 + hash(i) * 4, ri >= 5 ? '#ffd0f0' : '#fff6c8', t * 2 + i); }
  }
  hideCatch() {
    this.catchVisible = false; this.catchInfo = null;
    document.getElementById('catch').classList.add('hidden');
  }
  dismissCatch() { if (this.catchVisible) { this.g.fishing.finishPresentation(); this.hideCatch(); } }
}

Object.assign(__ex,{UI});
};
__mods['main.js']=function(__ex){
// Entry point: wires the game, renderer, UI and input together and runs the single rAF loop.
const { Game } = __req('game.js');
const { Renderer } = __req('renderer.js');
const { UI } = __req('ui.js');
const { Input } = __req('input.js');

function boot() {
  const canvas = document.getElementById('stage');
  const game = new Game();
  game.init();
  const renderer = new Renderer(canvas, game);
  const ui = new UI(game, renderer);
  const input = new Input(game, ui);
  ui.init();
  input.attach();
  game.audio.setScene(game.state.mode === 'harbor' ? 'harbor' : game.state.zone);

  // Audio may only start after a user gesture.
  const unlock = () => game.audio.unlock();
  window.addEventListener('pointerdown', unlock);
  window.addEventListener('keydown', unlock);

  // Saving: periodic (in Game.update), on important events (afterChange) and when the tab is hidden/closed.
  const flush = () => game.save();
  document.addEventListener('visibilitychange', () => { if (document.hidden) flush(); });
  window.addEventListener('pagehide', flush);
  window.addEventListener('beforeunload', flush);

  let last = performance.now();
  function loop(now) {
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    try {
      game.update(dt);
      renderer.frame(game.paused ? 0 : dt, ui.mouse);
      ui.tick(dt);
    } catch (err) {
      console.error('[little-tides] frame error', err);
    }
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);
  window.__littleTides = { game, renderer, ui }; // handy for debugging in the console
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
else boot();


};
__req('main.js');
})();