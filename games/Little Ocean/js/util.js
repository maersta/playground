/* Little Ocean - shared math / colour helpers */
window.LO = window.LO || {};
LO.U = (function () {
  const U = {};
  U.TAU = Math.PI * 2;
  U.clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  U.lerp = (a, b, t) => a + (b - a) * t;
  U.rand = (a, b) => a + Math.random() * (b - a);
  U.randInt = (a, b) => Math.floor(a + Math.random() * (b - a + 1));
  U.pick = (arr) => arr[(Math.random() * arr.length) | 0];
  U.smooth = (t) => { t = t < 0 ? 0 : t > 1 ? 1 : t; return t * t * (3 - 2 * t); };
  U.angDiff = function (from, to) {
    let d = (to - from) % U.TAU;
    if (d > Math.PI) d -= U.TAU; else if (d < -Math.PI) d += U.TAU;
    return d;
  };
  U.hash = (n) => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };
  U.noise = (x) => {
    const i = Math.floor(x), f = x - i, a = U.hash(i), b = U.hash(i + 1), u = f * f * (3 - 2 * f);
    return a + (b - a) * u;
  };
  U.rng = (seed) => {
    let a = seed >>> 0;
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };

  const hexCache = {};
  U.rgb = (hex) => {
    let c = hexCache[hex];
    if (!c) {
      const h = hex.replace('#', '');
      c = [parseInt(h.substr(0, 2), 16), parseInt(h.substr(2, 2), 16), parseInt(h.substr(4, 2), 16)];
      hexCache[hex] = c;
    }
    return c;
  };
  U.lerpRgb = (A, B, t) => [A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t, A[2] + (B[2] - A[2]) * t];
  U.rgbStr = (c, a) => a === undefined
    ? 'rgb(' + (c[0] | 0) + ',' + (c[1] | 0) + ',' + (c[2] | 0) + ')'
    : 'rgba(' + (c[0] | 0) + ',' + (c[1] | 0) + ',' + (c[2] | 0) + ',' + a + ')';
  U.mix = (a, b, t) => U.rgbStr(U.lerpRgb(U.rgb(a), U.rgb(b), t));
  const shadeCache = {};
  U.shade = (hex, f) => {
    const key = hex + '|' + f;
    let s = shadeCache[key];
    if (!s) {
      const c = U.rgb(hex);
      s = f < 0 ? U.rgbStr([c[0] * (1 + f), c[1] * (1 + f), c[2] * (1 + f)])
        : U.rgbStr([c[0] + (255 - c[0]) * f, c[1] + (255 - c[1]) * f, c[2] + (255 - c[2]) * f]);
      shadeCache[key] = s;
    }
    return s;
  };
  U.alpha = (hex, a) => U.rgbStr(U.rgb(hex), a);
  return U;
})();
