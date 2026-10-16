/* =========================================================
   audio.js - AudioSystem: procedural retro sounds via Web Audio
   Everything is wrapped in try/catch so the game works without audio.
   ========================================================= */
'use strict';

const AudioSystem = {
  ctx: null,
  master: null,
  muted: false,
  noiseBuffer: null,
  lastPlay: {},

  /** Create the AudioContext lazily on the first user gesture. */
  unlock() {
    try {
      if (!this.ctx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        this.ctx = new AC();
        this.master = this.ctx.createGain();
        this.master.gain.value = this.muted ? 0 : 0.35;
        this.master.connect(this.ctx.destination);
        // One second of white noise reused by all noisy sounds
        const len = this.ctx.sampleRate;
        this.noiseBuffer = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
        const d = this.noiseBuffer.getChannelData(0);
        for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      }
      if (this.ctx.state === 'suspended') this.ctx.resume();
    } catch (e) { this.ctx = null; }
  },

  setMuted(m) {
    this.muted = m;
    try { if (this.master) this.master.gain.value = m ? 0 : 0.35; } catch (e) { /* ignore */ }
  },

  ready() { return this.ctx && !this.muted && this.ctx.state === 'running'; },

  /** Prevent the same sound from stacking dozens of times per frame. */
  throttle(name, ms) {
    const now = performance.now();
    if (this.lastPlay[name] && now - this.lastPlay[name] < ms) return false;
    this.lastPlay[name] = now;
    return true;
  },

  /** Basic oscillator blip with optional pitch slide. */
  tone(freq, dur, type = 'square', vol = 0.3, slideTo = null, delay = 0) {
    if (!this.ready()) return;
    try {
      const t = this.ctx.currentTime + delay;
      const o = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      o.type = type;
      o.frequency.setValueAtTime(freq, t);
      if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t + dur);
      g.gain.setValueAtTime(vol, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + dur);
      o.connect(g); g.connect(this.master);
      o.start(t); o.stop(t + dur + 0.02);
    } catch (e) { /* ignore */ }
  },

  /** Filtered noise burst - impacts, crashes, explosions. */
  noise(dur, vol = 0.3, freq = 1200, type = 'lowpass', delay = 0) {
    if (!this.ready()) return;
    try {
      const t = this.ctx.currentTime + delay;
      const src = this.ctx.createBufferSource();
      src.buffer = this.noiseBuffer;
      const f = this.ctx.createBiquadFilter();
      f.type = type;
      f.frequency.setValueAtTime(freq, t);
      f.frequency.exponentialRampToValueAtTime(Math.max(40, freq * 0.3), t + dur);
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(vol, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + dur);
      src.connect(f); f.connect(g); g.connect(this.master);
      src.start(t, Math.random() * 0.5); src.stop(t + dur + 0.02);
    } catch (e) { /* ignore */ }
  },

  // ---- Game sounds ----
  stretch(power) {
    if (!this.throttle('stretch', 60)) return;
    this.tone(120 + power * 260, 0.06, 'triangle', 0.08);
  },
  launch(power) {
    this.tone(180, 0.35, 'square', 0.18, 700 + power * 500);
    this.noise(0.25, 0.25, 3000, 'bandpass');
  },
  bounce(strength) {
    if (!this.throttle('bounce', 50)) return;
    const s = clamp(strength, 0, 1);
    this.tone(260 + s * 140, 0.12, 'square', 0.12 + s * 0.1, 110);
    this.noise(0.08, 0.1 + s * 0.15, 900);
  },
  coin(pitchStep = 0) {
    if (!this.throttle('coin', 30)) return;
    const base = 880 * Math.pow(1.06, Math.min(pitchStep, 12));
    this.tone(base, 0.06, 'square', 0.12);
    this.tone(base * 1.5, 0.12, 'square', 0.12, null, 0.05);
  },
  gem() {
    this.tone(1046, 0.08, 'square', 0.12);
    this.tone(1318, 0.08, 'square', 0.12, null, 0.06);
    this.tone(1568, 0.2, 'square', 0.12, null, 0.12);
  },
  collision() {
    if (!this.throttle('collision', 80)) return;
    this.noise(0.18, 0.4, 600);
    this.tone(90, 0.15, 'sawtooth', 0.18, 40);
  },
  breakObj() {
    if (!this.throttle('break', 40)) return;
    this.noise(0.25, 0.4, 2500, 'bandpass');
    this.tone(200, 0.1, 'square', 0.1, 80);
  },
  hurt() {
    this.tone(400, 0.25, 'sawtooth', 0.2, 120);
    this.noise(0.15, 0.25, 1500);
  },
  spring() {
    this.tone(200, 0.3, 'triangle', 0.25, 1200);
    this.tone(300, 0.25, 'square', 0.08, 1400, 0.03);
  },
  boost() {
    this.tone(300, 0.25, 'sawtooth', 0.12, 1200);
    this.noise(0.25, 0.15, 4000, 'highpass');
  },
  explosion() {
    this.noise(0.6, 0.6, 900);
    this.tone(80, 0.5, 'sawtooth', 0.25, 30);
  },
  pop() {
    this.tone(700, 0.08, 'square', 0.15, 1500);
    this.noise(0.06, 0.2, 5000, 'highpass');
  },
  bark() {
    // A tiny 2-tone "woof"
    this.tone(320, 0.08, 'sawtooth', 0.12, 200);
    this.tone(280, 0.1, 'sawtooth', 0.1, 160, 0.1);
  },
  combo(level) {
    if (!this.throttle('combo', 120)) return;
    this.tone(500 + level * 40, 0.08, 'square', 0.08);
  },
  click() { this.tone(660, 0.05, 'square', 0.1, 880); },
  purchase() {
    [523, 659, 784, 1046].forEach((f, i) => this.tone(f, 0.1, 'square', 0.12, null, i * 0.07));
  },
  denied() { this.tone(160, 0.2, 'square', 0.12, 110); },
  gameOver() {
    [392, 330, 262, 196].forEach((f, i) => this.tone(f, 0.22, 'triangle', 0.18, null, i * 0.16));
  },
  record() {
    [523, 659, 784, 1046, 784, 1046].forEach((f, i) => this.tone(f, 0.12, 'square', 0.13, null, i * 0.09));
  },
  tick() { if (this.throttle('tick', 45)) this.tone(1200, 0.025, 'square', 0.05); }
};
