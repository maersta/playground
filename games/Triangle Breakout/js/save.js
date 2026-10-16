/* ============================================================
   SAVE SYSTEM (localStorage)
   Compact, versioned and defensive: every field is validated on
   load; anything unusable falls back to defaults / a fresh game.
   Destroyed triangles are stored as a base64 bitset, damaged ones
   as [id, hp] pairs.
   ============================================================ */
(function () {
  'use strict';
  const TB = (window.TB = window.TB || {});
  const C = TB.CONFIG, U = TB.util;
  const r2 = (v) => Math.round(v * 100) / 100;

  function defaultSettings() {
    return { sound: true, volume: 0.6, particles: 3, reduced: false, shake: true };
  }

  function defaultMeta() {
    return {
      cores: 0, prestigeCount: 0, prestigeUpgrades: {}, lifeMilestones: {},
      life: { score: 0, destroyed: 0, collisions: 0, damage: 0, escapes: 0 }
    };
  }

  // Copy only known integer levels (bounded) from an untrusted object.
  function levels(obj, defs, maxFallback) {
    const out = {};
    if (!obj || typeof obj !== 'object') return out;
    for (const d of defs) {
      const v = U.num(obj[d.id], 0, 0, typeof d.max === 'number' ? d.max : maxFallback);
      if (v > 0) out[d.id] = Math.floor(v);
    }
    return out;
  }

  function flags(obj, ids) {
    const out = {};
    if (!obj || typeof obj !== 'object') return out;
    for (const id of ids) if (obj[id] === true) out[id] = true;
    return out;
  }

  // Upgrade older save layouts. Only schema 1 exists so far.
  function migrate(d) {
    if (!d || typeof d !== 'object') return null;
    if (typeof d.v !== 'number') d.v = 1;
    // future: if (d.v < 2) { ...transform...; d.v = 2; }
    return d.v <= C.save.version ? d : null;
  }

  const Save = {
    load() {
      let raw = null;
      try { raw = localStorage.getItem(C.save.key); } catch (e) { return null; }
      if (!raw) return null;
      try {
        const d = migrate(JSON.parse(raw));
        if (!d || !d.run) return null;
        return this.sanitize(d);
      } catch (e) { return null; }
    },

    sanitize(d) {
      const ds = defaultSettings(), dm = defaultMeta();
      const s = d.settings || {};
      const settings = {
        sound: s.sound !== false,
        volume: U.num(s.volume, ds.volume, 0, 1),
        particles: Math.floor(U.num(s.particles, ds.particles, 0, 3)),
        reduced: s.reduced === true,
        shake: s.shake !== false
      };
      const m = d.meta || {}, lf = m.life || {};
      const meta = {
        cores: Math.floor(U.num(m.cores, 0, 0, 1e12)),
        prestigeCount: Math.floor(U.num(m.prestigeCount, 0, 0, 1e9)),
        prestigeUpgrades: levels(m.prestigeUpgrades, TB.Upgrades.prestige, 100),
        lifeMilestones: flags(m.lifeMilestones, TB.Progression.milestones.filter((x) => x.scope === 'life').map((x) => x.id)),
        life: {
          score: U.num(lf.score, 0, 0, 1e18), destroyed: U.num(lf.destroyed, 0, 0, 1e12),
          collisions: U.num(lf.collisions, 0, 0, 1e15), damage: U.num(lf.damage, 0, 0, 1e18),
          escapes: Math.floor(U.num(lf.escapes, 0, 0, 1e9))
        }
      };
      const r = d.run, st = r.stats || {}, w = r.world || {};
      const world = {
        rings: Math.floor(U.num(w.rings, C.world.rings, 4, 60)),
        side: U.num(w.side, C.world.side, 10, 80),
        pocketRings: Math.floor(U.num(w.pocketRings, C.world.pocketRings, 0, 6))
      };
      if (world.pocketRings >= world.rings - 1) world.pocketRings = C.world.pocketRings;
      const esc = r.escape && typeof r.escape === 'object' ? { reward: Math.floor(U.num(r.escape.reward, C.escape.minCores, 0, 1e9)), claimed: false } : null;
      const run = {
        number: Math.floor(U.num(r.number, 1, 1, 1e9)),
        seed: U.num(r.seed, C.world.baseSeed, 0, 4294967295) >>> 0,
        score: U.num(r.score, 0, 0, 1e18),
        credits: U.num(r.credits, 0, 0, 1e18),
        upgrades: levels(r.upgrades, TB.Upgrades.run, 200),
        milestones: flags(r.milestones, TB.Progression.milestones.filter((x) => x.scope === 'run').map((x) => x.id)),
        stats: {
          collisions: U.num(st.collisions, 0, 0, 1e15), damage: U.num(st.damage, 0, 0, 1e18),
          destroyed: U.num(st.destroyed, 0, 0, 1e9), explosions: U.num(st.explosions, 0, 0, 1e12),
          upgradesBought: U.num(st.upgradesBought, 0, 0, 1e9), time: U.num(st.time, 0, 0, 1e9)
        },
        escape: esc
      };
      const balls = [];
      if (Array.isArray(r.balls)) {
        for (const b of r.balls.slice(0, C.balls.globalCap)) {
          if (!Array.isArray(b) || b.length < 4) continue;
          const [x, y, vx, vy] = b.map(Number);
          if ([x, y, vx, vy].every(isFinite)) balls.push([x, y, vx, vy]);
        }
      }
      return {
        settings, meta, run, world, balls,
        destroyed: typeof r.destroyed === 'string' ? r.destroyed : '',
        damaged: Array.isArray(r.damaged) ? r.damaged : []
      };
    },

    serialize(g) {
      const r = g.run;
      return {
        v: C.save.version,
        savedAt: Date.now(),
        settings: g.settings,
        meta: g.meta,
        run: {
          number: r.number, seed: r.seed,
          world: g.world.params,
          score: r.score, credits: r.credits,
          upgrades: r.upgrades, milestones: r.milestones, stats: r.stats,
          escape: r.escape,
          destroyed: g.world.encodeDestroyed(),
          damaged: g.world.damagedList(),
          balls: g.balls.map((b) => [r2(b.x), r2(b.y), r2(b.vx), r2(b.vy)])
        }
      };
    },

    save(g) {
      try { localStorage.setItem(C.save.key, JSON.stringify(this.serialize(g))); return true; }
      catch (e) { return false; }
    },

    wipe() {
      try { localStorage.removeItem(C.save.key); } catch (e) { /* ignore */ }
    },

    defaultSettings, defaultMeta
  };

  TB.Save = Save;
})();
