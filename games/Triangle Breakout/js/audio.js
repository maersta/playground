/* ============================================================
   AUDIO - tiny Web Audio synthesizer, no asset files.
   Context is created/resumed on the first user gesture. Every
   voice cleans itself up on `ended`; concurrency is capped.
   ============================================================ */
(function () {
  'use strict';
  const TB = (window.TB = window.TB || {});

  const MIN_GAP = { hit: 0.04, destroy: 0.05, crit: 0.06, explosion: 0.12, buy: 0.03 };
  const MAX_VOICES = 14;

  const Audio = {
    ctx: null, master: null, noiseBuf: null, enabled: true, volume: 0.6, voices: 0, last: {},

    init() {
      const unlock = () => { this.ensure(); };
      ['pointerdown', 'keydown', 'touchstart'].forEach((ev) => window.addEventListener(ev, unlock, { passive: true }));
    },

    ensure() {
      if (!this.ctx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return false;
        try {
          this.ctx = new AC();
          this.master = this.ctx.createGain();
          this.master.gain.value = this.enabled ? this.volume : 0;
          const comp = this.ctx.createDynamicsCompressor();
          this.master.connect(comp); comp.connect(this.ctx.destination);
          const len = Math.floor(this.ctx.sampleRate * 0.6);
          this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
          const d = this.noiseBuf.getChannelData(0);
          for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
        } catch (e) { this.ctx = null; return false; }
      }
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return true;
    },

    setEnabled(on) {
      this.enabled = !!on;
      if (this.master) this.master.gain.value = this.enabled ? this.volume : 0;
    },

    setVolume(v) {
      this.volume = Math.max(0, Math.min(1, v));
      if (this.master && this.enabled) this.master.gain.value = this.volume;
    },

    _tone(freq, dur, type, vol, slideTo, delay) {
      if (this.voices >= MAX_VOICES) return;
      const ctx = this.ctx, t0 = ctx.currentTime + (delay || 0);
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = type; o.frequency.setValueAtTime(freq, t0);
      if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(vol, t0 + 0.006);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      o.connect(g); g.connect(this.master);
      this.voices++;
      o.onended = () => { this.voices--; o.disconnect(); g.disconnect(); };
      o.start(t0); o.stop(t0 + dur + 0.02);
    },

    _noise(dur, f0, f1, vol) {
      if (this.voices >= MAX_VOICES) return;
      const ctx = this.ctx, t0 = ctx.currentTime;
      const s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
      s.buffer = this.noiseBuf; f.type = 'lowpass';
      f.frequency.setValueAtTime(f0, t0); f.frequency.exponentialRampToValueAtTime(f1, t0 + dur);
      g.gain.setValueAtTime(vol, t0); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      s.connect(f); f.connect(g); g.connect(this.master);
      this.voices++;
      s.onended = () => { this.voices--; s.disconnect(); f.disconnect(); g.disconnect(); };
      s.start(t0); s.stop(t0 + dur + 0.02);
    },

    play(name, arg) {
      if (!this.enabled || !this.ctx || this.ctx.state !== 'running') return;
      const now = this.ctx.currentTime, gap = MIN_GAP[name];
      if (gap) {
        if (now - (this.last[name] || 0) < gap) return;
        this.last[name] = now;
      }
      switch (name) {
        case 'hit': this._tone(360 + (arg | 0) * 95 + Math.random() * 30, 0.05, 'triangle', 0.09, 260 + (arg | 0) * 60); break;
        case 'destroy': this._tone(280, 0.12, 'square', 0.05, 90); this._tone(560, 0.06, 'triangle', 0.05); break;
        case 'crit': this._tone(880, 0.08, 'square', 0.05); this._tone(1320, 0.12, 'triangle', 0.07, 0, 0.05); break;
        case 'explosion': this._noise(0.35, 1400, 110, 0.32); this._tone(95, 0.3, 'sine', 0.25, 40); break;
        case 'buy': this._tone(600, 0.06, 'triangle', 0.08); this._tone(900, 0.09, 'triangle', 0.08, 0, 0.05); break;
        case 'click': this._tone(520, 0.03, 'triangle', 0.06); break;
        case 'milestone': [523, 659, 784, 1047].forEach((f, i) => this._tone(f, 0.14, 'triangle', 0.09, 0, i * 0.07)); break;
        case 'escape':
          [262, 330, 392, 523, 659, 784, 1047, 1319].forEach((f, i) => this._tone(f, 0.35, 'triangle', 0.1, 0, i * 0.09));
          this._tone(120, 1.2, 'sine', 0.16, 480);
          break;
        case 'prestige':
          this._tone(180, 0.9, 'sine', 0.14, 1700);
          [1568, 1976, 2349].forEach((f, i) => this._tone(f, 0.25, 'triangle', 0.05, 0, 0.5 + i * 0.1));
          break;
        default: break;
      }
    }
  };

  TB.Audio = Audio;
})();
