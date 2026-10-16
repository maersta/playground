// ============================================================================
// INPUT
// Keyboard (WASD/arrows) for movement, mouse for roller aim + left-click to
// paint, mouse wheel for zoom, and a touch joystick for mobile (which auto-
// paints while moving, since there's no mouse to hold there).
// Exposes a simple polled interface: getMoveVector(), getAimPoint(), etc.
// ============================================================================

export class InputManager {
  constructor(canvas, joystickZoneEl, joystickNubEl) {
    this.keys = new Set();
    this.colorCycleQueue = 0;
    this.zoomDelta = 0;
    this.canvas = canvas;

    this.mouse = { x: 0, y: 0 };
    this.mouseDown = false;
    this.hasMouse = false;

    this.touchActive = false;
    this.touchVec = { x: 0, y: 0 };
    this.joystickZone = joystickZoneEl;
    this.joystickNub = joystickNubEl;
    this.joystickCenter = { x: 0, y: 0 };
    this.joystickTouchId = null;
    this.joystickMaxRadius = 46;

    window.addEventListener('keydown', (e) => this._onKeyDown(e));
    window.addEventListener('keyup', (e) => this._onKeyUp(e));
    canvas.addEventListener('wheel', (e) => this._onWheel(e), { passive: false });

    canvas.addEventListener('mousemove', (e) => this._onMouseMove(e));
    canvas.addEventListener('mousedown', (e) => this._onMouseDown(e));
    window.addEventListener('mouseup', (e) => this._onMouseUp(e));
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    window.addEventListener('blur', () => { this.mouseDown = false; this.keys.clear(); });

    if (joystickZoneEl) {
      joystickZoneEl.addEventListener('touchstart', (e) => this._onJoyStart(e), { passive: false });
      joystickZoneEl.addEventListener('touchmove', (e) => this._onJoyMove(e), { passive: false });
      joystickZoneEl.addEventListener('touchend', (e) => this._onJoyEnd(e), { passive: false });
      joystickZoneEl.addEventListener('touchcancel', (e) => this._onJoyEnd(e), { passive: false });
    }
  }

  _onKeyDown(e) {
    const code = e.code;
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(code)) e.preventDefault();
    this.keys.add(code);
    if (code === 'KeyQ') this.colorCycleQueue -= 1;
    if (code === 'KeyE') this.colorCycleQueue += 1;
  }

  _onKeyUp(e) {
    this.keys.delete(e.code);
  }

  _onWheel(e) {
    e.preventDefault();
    this.zoomDelta += e.deltaY > 0 ? -0.08 : 0.08;
  }

  _onMouseMove(e) {
    const rect = this.canvas.getBoundingClientRect();
    this.mouse.x = e.clientX - rect.left;
    this.mouse.y = e.clientY - rect.top;
    this.hasMouse = true;
  }

  _onMouseDown(e) {
    if (e.button !== 0) return;
    this.mouseDown = true;
    const rect = this.canvas.getBoundingClientRect();
    this.mouse.x = e.clientX - rect.left;
    this.mouse.y = e.clientY - rect.top;
    this.hasMouse = true;
  }

  _onMouseUp(e) {
    if (e.button !== 0) return;
    this.mouseDown = false;
  }

  _onJoyStart(e) {
    e.preventDefault();
    const touch = e.changedTouches[0];
    const rect = this.joystickZone.getBoundingClientRect();
    this.joystickCenter = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
    this.joystickTouchId = touch.identifier;
    this.touchActive = true;
    this._updateJoystick(touch.clientX, touch.clientY);
  }

  _onJoyMove(e) {
    e.preventDefault();
    for (const touch of e.changedTouches) {
      if (touch.identifier === this.joystickTouchId) {
        this._updateJoystick(touch.clientX, touch.clientY);
      }
    }
  }

  _onJoyEnd(e) {
    e.preventDefault();
    for (const touch of e.changedTouches) {
      if (touch.identifier === this.joystickTouchId) {
        this.joystickTouchId = null;
        this.touchActive = false;
        this.touchVec = { x: 0, y: 0 };
        if (this.joystickNub) this.joystickNub.style.transform = 'translate(-50%, -50%)';
      }
    }
  }

  _updateJoystick(clientX, clientY) {
    let dx = clientX - this.joystickCenter.x;
    let dy = clientY - this.joystickCenter.y;
    const dist = Math.hypot(dx, dy);
    const clamped = Math.min(dist, this.joystickMaxRadius);
    const angle = Math.atan2(dy, dx);
    const nx = Math.cos(angle) * clamped;
    const ny = Math.sin(angle) * clamped;
    if (this.joystickNub) {
      this.joystickNub.style.transform = `translate(${nx - 28}px, ${ny - 28}px)`;
    }
    this.touchVec = { x: nx / this.joystickMaxRadius, y: ny / this.joystickMaxRadius };
  }

  getMoveVector() {
    if (this.touchActive) {
      const len = Math.hypot(this.touchVec.x, this.touchVec.y);
      if (len < 0.12) return { x: 0, y: 0 };
      return { ...this.touchVec };
    }
    let x = 0, y = 0;
    if (this.keys.has('KeyW') || this.keys.has('ArrowUp')) y -= 1;
    if (this.keys.has('KeyS') || this.keys.has('ArrowDown')) y += 1;
    if (this.keys.has('KeyA') || this.keys.has('ArrowLeft')) x -= 1;
    if (this.keys.has('KeyD') || this.keys.has('ArrowRight')) x += 1;
    const len = Math.hypot(x, y);
    if (len > 0) { x /= len; y /= len; }
    return { x, y };
  }

  // Desktop: painting requires holding the left mouse button (roller follows
  // the cursor for aiming). Touch: no spare button for it, so moving the
  // joystick paints (same behavior as before) to keep it usable.
  isPaintHeld() {
    return this.touchActive || this.mouseDown;
  }

  // Canvas-relative (CSS px) cursor position, ready for camera.screenToWorld().
  getMousePos() {
    return { x: this.mouse.x, y: this.mouse.y };
  }

  consumeColorCycle() {
    const v = this.colorCycleQueue;
    this.colorCycleQueue = 0;
    return v;
  }

  consumeZoomDelta() {
    const v = this.zoomDelta;
    this.zoomDelta = 0;
    return v;
  }

  static isTouchDevice() {
    return ('ontouchstart' in window) || navigator.maxTouchPoints > 0;
  }
}
