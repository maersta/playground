// ============================================================================
// CAMERA
// Smooth top-down follow camera with zoom. World -> screen transform helpers.
// ============================================================================

export class Camera {
  constructor(worldW, worldH) {
    this.worldW = worldW;
    this.worldH = worldH;
    this.x = worldW / 2;
    this.y = worldH / 2;
    this.targetX = this.x;
    this.targetY = this.y;
    this.zoom = 1;
    this.targetZoom = 1;
    this.minZoom = 0.45;
    this.maxZoom = 1.6;
    this.viewW = 800;
    this.viewH = 600;
  }

  setViewport(w, h) {
    this.viewW = w;
    this.viewH = h;
  }

  follow(x, y) {
    this.targetX = x;
    this.targetY = y;
  }

  zoomBy(delta) {
    this.targetZoom = Math.max(this.minZoom, Math.min(this.maxZoom, this.targetZoom + delta));
  }

  update(dt) {
    const followRate = 1 - Math.pow(0.001, dt);
    this.x += (this.targetX - this.x) * followRate;
    this.y += (this.targetY - this.y) * followRate;
    this.zoom += (this.targetZoom - this.zoom) * followRate;
  }

  // Apply the world->screen transform to a canvas context.
  apply(ctx) {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.translate(this.viewW / 2, this.viewH / 2);
    ctx.scale(this.zoom, this.zoom);
    ctx.translate(-this.x, -this.y);
  }

  screenToWorld(sx, sy) {
    return {
      x: (sx - this.viewW / 2) / this.zoom + this.x,
      y: (sy - this.viewH / 2) / this.zoom + this.y,
    };
  }

  getViewBounds() {
    const halfW = this.viewW / 2 / this.zoom;
    const halfH = this.viewH / 2 / this.zoom;
    return {
      minX: this.x - halfW, maxX: this.x + halfW,
      minY: this.y - halfH, maxY: this.y + halfH,
    };
  }
}
