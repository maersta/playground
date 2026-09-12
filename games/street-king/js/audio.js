/* =========================================================
   AUDIO
   Synthesized sound effects via the Web Audio API. No audio
   files, no dependencies. Same pattern as the Wild Reels game.
========================================================= */

Game.audio = (function () {
    let ctx = null;

    function ensureCtx() {
        if (!Game.state.settings.soundEnabled) return null;
        if (!ctx) {
            const AudioCtor = window.AudioContext || window.webkitAudioContext;
            if (!AudioCtor) return null;
            ctx = new AudioCtor();
        }
        if (ctx.state === "suspended") ctx.resume();
        return ctx;
    }

    function tone({ freq, duration = 0.15, type = "sine", volume = 0.18, startTime = 0, slideTo = null }) {
        const audioCtx = ensureCtx();
        if (!audioCtx) return;

        const t0 = audioCtx.currentTime + startTime;
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();

        osc.type = type;
        osc.frequency.setValueAtTime(freq, t0);
        if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t0 + duration);

        gain.gain.setValueAtTime(0.0001, t0);
        gain.gain.linearRampToValueAtTime(volume, t0 + 0.008);
        gain.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);

        osc.connect(gain).connect(audioCtx.destination);
        osc.start(t0);
        osc.stop(t0 + duration + 0.03);
    }

    return {
        click() {
            tone({ freq: 260, duration: 0.04, type: "square", volume: 0.1 });
        },
        money() {
            tone({ freq: 700, duration: 0.09, type: "triangle", volume: 0.14 });
            tone({ freq: 900, duration: 0.09, type: "triangle", volume: 0.12, startTime: 0.05 });
        },
        purchase() {
            tone({ freq: 500, duration: 0.12, type: "square", volume: 0.14 });
            tone({ freq: 650, duration: 0.12, type: "square", volume: 0.12, startTime: 0.06 });
        },
        hit() {
            tone({ freq: 150, duration: 0.08, type: "sawtooth", volume: 0.18 });
        },
        crit() {
            tone({ freq: 220, slideTo: 90, duration: 0.18, type: "sawtooth", volume: 0.22 });
        },
        fightStart() {
            tone({ freq: 180, duration: 0.2, type: "square", volume: 0.16 });
            tone({ freq: 140, duration: 0.25, type: "square", volume: 0.16, startTime: 0.1 });
        },
        victory() {
            [523.25, 659.25, 783.99].forEach((freq, i) => {
                tone({ freq, duration: 0.2, type: "triangle", volume: 0.2, startTime: i * 0.09 });
            });
        },
        defeat() {
            [300, 220, 160].forEach((freq, i) => {
                tone({ freq, duration: 0.28, type: "sawtooth", volume: 0.16, startTime: i * 0.12 });
            });
        },
        bossDefeat() {
            [392, 523.25, 659.25, 783.99, 1046.5, 1318.5].forEach((freq, i) => {
                tone({ freq, duration: 0.26, type: "triangle", volume: 0.24, startTime: i * 0.08 });
            });
        },
        achievement() {
            tone({ freq: 660, duration: 0.14, type: "triangle", volume: 0.18 });
            tone({ freq: 990, duration: 0.18, type: "triangle", volume: 0.18, startTime: 0.1 });
        },
        levelUp() {
            [440, 554.37, 659.25, 880].forEach((freq, i) => {
                tone({ freq, duration: 0.2, type: "triangle", volume: 0.2, startTime: i * 0.07 });
            });
        }
    };
})();
