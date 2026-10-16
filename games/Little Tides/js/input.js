// Keyboard input. Gameplay keys never fire while typing and never scroll the page.
const GAME_KEYS = new Set(['Space', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'KeyA', 'KeyD', 'KeyW', 'KeyS']);

export class Input {
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
