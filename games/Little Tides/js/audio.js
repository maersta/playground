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

export class AudioEngine {
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
