// ============================================================================
// FACE IMAGE LOADING SYSTEM
// Loads and caches the coworker photographs referenced by data/coworkers.js.
// Nothing else in the renderer touches <img> paths directly - everyone asks
// this module for an Image via getFace(coworker).
// ============================================================================

const cache = new Map();

function loadImage(src) {
  if (cache.has(src)) return cache.get(src);
  const img = new Image();
  const entry = { img, loaded: false, failed: false };
  img.onload = () => { entry.loaded = true; };
  img.onerror = () => { entry.failed = true; };
  img.src = src;
  cache.set(src, entry);
  return entry;
}

export function preloadFaces(coworkers) {
  return Promise.all(coworkers.map((c) => new Promise((resolve) => {
    const entry = loadImage(c.face);
    if (entry.loaded || entry.failed) return resolve();
    entry.img.addEventListener('load', resolve, { once: true });
    entry.img.addEventListener('error', resolve, { once: true });
  })));
}

// Returns an HTMLImageElement ready to draw, or null if not yet loaded/failed
// (callers should fall back to a procedural placeholder in that case).
export function getFace(coworker) {
  const entry = loadImage(coworker.face);
  if (entry.loaded) return entry.img;
  return null;
}
