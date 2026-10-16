// Entry point: wires the game, renderer, UI and input together and runs the single rAF loop.
import { Game } from './game.js';
import { Renderer } from './renderer.js';
import { UI } from './ui.js';
import { Input } from './input.js';

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
