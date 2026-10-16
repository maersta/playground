/* Little Ocean - procedural Web Audio: ambience, generative music bed, and sound effects.
   Created lazily after the first user gesture (browser autoplay rules). */
window.LO = window.LO || {};
LO.Audio = (function () {
  let ctx = null, master, musicG, sfxG, noiseBuf, swimGain, swimFilter, delay, musicTimer = 0, bubbleTimer = 0;
  let zoneRoot = 220, started = false, lastDanger = 0;
  const SCALE = [0, 2, 4, 7, 9, 12, 14];
  const ZONE_ROOT = { reef: 220, kelp: 196, blue: 246.9, deep: 164.8, grotto: 185 };

  function settings() { return LO.Save.data.settings; }

  function init() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    try { ctx = new AC(); } catch (e) { ctx = null; return; }
    master = ctx.createGain(); master.gain.value = 0.9;
    const comp = ctx.createDynamicsCompressor();
    master.connect(comp); comp.connect(ctx.destination);
    musicG = ctx.createGain(); sfxG = ctx.createGain();
    musicG.connect(master); sfxG.connect(master);

    // soft echo bus for the music
    delay = ctx.createDelay(1.5); delay.delayTime.value = 0.55;
    const fb = ctx.createGain(); fb.gain.value = 0.42;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1400;
    delay.connect(lp); lp.connect(fb); fb.connect(delay); lp.connect(musicG);

    // brown-ish noise for swimming whoosh
    const len = ctx.sampleRate * 2;
    noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
    const ch = noiseBuf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) { const w = Math.random() * 2 - 1; last = (last + 0.04 * w) / 1.04; ch[i] = last * 6; }
    const src = ctx.createBufferSource(); src.buffer = noiseBuf; src.loop = true;
    swimFilter = ctx.createBiquadFilter(); swimFilter.type = 'bandpass'; swimFilter.frequency.value = 420; swimFilter.Q.value = 0.8;
    swimGain = ctx.createGain(); swimGain.gain.value = 0;
    src.connect(swimFilter); swimFilter.connect(swimGain); swimGain.connect(sfxG); src.start();

    // low underwater drone
    [55, 82.4, 110.3].forEach((f, i) => {
      const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = f;
      const g = ctx.createGain(); g.gain.value = 0.05 / (i + 1);
      const lfo = ctx.createOscillator(); lfo.frequency.value = 0.05 + i * 0.03;
      const lg = ctx.createGain(); lg.gain.value = 0.02 / (i + 1);
      lfo.connect(lg); lg.connect(g.gain);
      o.connect(g); g.connect(musicG); o.start(); lfo.start();
    });

    started = true;
    applySettings();
    scheduleMusic(); scheduleBubble();
  }

  function applySettings() {
    if (!ctx) return;
    const s = settings();
    const t = ctx.currentTime;
    musicG.gain.setTargetAtTime(s.muted ? 0 : s.music * 0.9, t, 0.1);
    sfxG.gain.setTargetAtTime(s.muted ? 0 : s.sfx, t, 0.05);
  }

  function setZone(id) { if (ZONE_ROOT[id]) zoneRoot = ZONE_ROOT[id]; }

  function tone(freq, dur, type, vol, slideTo, delaySec, bus) {
    if (!ctx) return;
    const t0 = ctx.currentTime + (delaySec || 0);
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type || 'sine';
    o.frequency.setValueAtTime(freq, t0);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol, t0 + Math.min(0.02, dur * 0.3));
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g); g.connect(bus || sfxG);
    o.start(t0); o.stop(t0 + dur + 0.05);
  }

  function whoosh(dur, f0, f1, vol) {
    if (!ctx) return;
    const t0 = ctx.currentTime;
    const s = ctx.createBufferSource(); s.buffer = noiseBuf;
    const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = 1.2;
    f.frequency.setValueAtTime(f0, t0); f.frequency.exponentialRampToValueAtTime(f1, t0 + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(vol, t0 + dur * 0.3); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    s.connect(f); f.connect(g); g.connect(sfxG);
    s.start(t0, Math.random() * 1.5); s.stop(t0 + dur + 0.05);
  }

  function scheduleMusic() {
    clearTimeout(musicTimer);
    musicTimer = setTimeout(() => {
      if (ctx && ctx.state === 'running' && !settings().muted && settings().music > 0) {
        const n = SCALE[(Math.random() * 5) | 0];
        const f = zoneRoot * Math.pow(2, n / 12) * (Math.random() < 0.25 ? 2 : 1);
        padNote(f, 4 + Math.random() * 2);
        if (Math.random() < 0.3) padNote(f * 1.5, 5, 0.6);
      }
      scheduleMusic();
    }, 2400 + Math.random() * 3600);
  }

  function padNote(f, dur, delaySec) {
    const t0 = ctx.currentTime + (delaySec || 0);
    const o = ctx.createOscillator(), o2 = ctx.createOscillator(), g = ctx.createGain();
    o.type = 'sine'; o2.type = 'triangle'; o.frequency.value = f; o2.frequency.value = f * 1.003;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 900;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(0.09, t0 + 1.6);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(lp); o2.connect(lp); lp.connect(g); g.connect(musicG); g.connect(delay);
    o.start(t0); o2.start(t0); o.stop(t0 + dur + 0.1); o2.stop(t0 + dur + 0.1);
  }

  function scheduleBubble() {
    clearTimeout(bubbleTimer);
    bubbleTimer = setTimeout(() => {
      if (ctx && ctx.state === 'running') bubble(0.05);
      scheduleBubble();
    }, 1800 + Math.random() * 3800);
  }

  function bubble(v) {
    const f = 380 + Math.random() * 500;
    tone(f, 0.12, 'sine', v || 0.06, f * 1.7);
  }

  function suspend() { if (ctx && ctx.state === 'running') ctx.suspend(); }
  function resume() { if (ctx && ctx.state === 'suspended') ctx.resume(); }

  // called every frame with how fast the player is moving (0..1+)
  function update(speedFrac, bursting) {
    if (!ctx) return;
    const t = ctx.currentTime;
    const v = Math.min(1.4, speedFrac) * (bursting ? 0.14 : 0.055);
    swimGain.gain.setTargetAtTime(v, t, 0.12);
    swimFilter.frequency.setTargetAtTime(300 + speedFrac * 500, t, 0.15);
  }

  const api = {
    init, applySettings, setZone, suspend, resume, update,
    get ready() { return !!ctx; },
    click() { tone(520, 0.07, 'triangle', 0.08, 700); },
    back() { tone(420, 0.08, 'triangle', 0.07, 300); },
    eat(size) { const f = 520 - Math.min(size, 60) * 4; tone(f, 0.09, 'sine', 0.16, f * 1.8); tone(f * 0.6, 0.12, 'sine', 0.08, f * 1.1, 0.04); },
    burst() { whoosh(0.4, 300, 1800, 0.22); },
    levelUp() { [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.35, 'sine', 0.1, null, i * 0.08)); },
    evoOpen() { [392, 494, 587].forEach((f, i) => tone(f, 0.5, 'triangle', 0.09, null, i * 0.1)); },
    evoPick() { [523, 784, 1047, 1568].forEach((f, i) => tone(f, 0.45, 'sine', 0.12, null, i * 0.07)); },
    discover() { tone(784, 0.5, 'sine', 0.12); tone(1175, 0.7, 'sine', 0.1, null, 0.14); },
    zone() { [392, 523, 659, 784].forEach((f, i) => tone(f, 0.8, 'sine', 0.1, null, i * 0.16)); },
    legendary() {
      [523, 659, 784, 988, 1175, 1568].forEach((f, i) => { tone(f, 1.6, 'sine', 0.1, null, i * 0.13); tone(f * 2, 1.2, 'triangle', 0.035, null, i * 0.13 + 0.05); });
    },
    hurt() { tone(220, 0.35, 'sawtooth', 0.07, 110); whoosh(0.3, 900, 200, 0.2); },
    lucky() { [330, 440, 660, 880].forEach((f, i) => tone(f, 0.4, 'triangle', 0.1, null, i * 0.06)); },
    death() { [392, 330, 262, 196].forEach((f, i) => tone(f, 1.1, 'sine', 0.12, f * 0.9, i * 0.22)); },
    danger() {
      const now = performance.now();
      if (now - lastDanger < 2500) return;
      lastDanger = now; tone(110, 0.5, 'sine', 0.12, 90); tone(115, 0.5, 'sine', 0.08, 95, 0.25);
    },
    bubble
  };
  return api;
})();
