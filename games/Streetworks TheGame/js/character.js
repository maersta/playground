// ============================================================================
// CHARACTER
// Shared procedural character used for both the player and AI coworkers:
// movement/physics, walk-cycle animation, and Canvas-primitive rendering
// (head photo + stylized body + roller-on-a-stick). No sprites, ever.
// ============================================================================

import { getFace } from './faces.js';

const BODY_RADIUS = 15;
export const ROLLER_REACH = 34;
export const ROLLER_MIN_REACH = 22;
export const ROLLER_MAX_REACH = 88;
export const ROLLER_RADIUS = 11; // effective paint stamp radius

export class Character {
  constructor(coworker, x, y, isPlayer) {
    this.coworker = coworker;
    this.isPlayer = isPlayer;
    this.x = x;
    this.y = y;
    this.vx = 0;
    this.vy = 0;
    this.facing = 0;
    this.walkPhase = 0;
    this.isMoving = false;
    this.isPainting = false;
    this.baseSpeed = 128; // px/sec
    this.currentColor = null;
    this.bob = 0;
    this._faceClipCache = null;
    this.aimDistance = ROLLER_REACH;
  }

  get speedMultiplier() {
    return this.coworker.personality ? this.coworker.personality.movementSpeed : 1;
  }

  // moveVec: {x,y} normalized-ish direction. speedScale: extra runtime multiplier (e.g. AI stress boost).
  // aimFacing: optional angle (radians) that overrides movement-direction facing - used by the
  // player so the roller can be aimed with the mouse independently of which way they're walking.
  // aimDistance: optional px distance to the aim point (clamped to the roller's physical reach) so
  // the roller actually lands under the cursor instead of always sitting a fixed distance away.
  update(dt, moveVec, worldW, worldH, speedScale = 1, aimFacing = null, aimDistance = null) {
    const maxSpeed = this.baseSpeed * this.speedMultiplier * speedScale;
    const targetVx = moveVec.x * maxSpeed;
    const targetVy = moveVec.y * maxSpeed;
    const accel = 1 - Math.pow(0.0005, dt);
    this.vx += (targetVx - this.vx) * accel;
    this.vy += (targetVy - this.vy) * accel;

    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.x = Math.max(BODY_RADIUS, Math.min(worldW - BODY_RADIUS, this.x));
    this.y = Math.max(BODY_RADIUS, Math.min(worldH - BODY_RADIUS, this.y));

    const speed = Math.hypot(this.vx, this.vy);
    this.isMoving = speed > 6;
    if (aimFacing !== null) {
      this.facing = aimFacing;
    } else if (this.isMoving) {
      this.facing = Math.atan2(this.vy, this.vx);
    }
    this.aimDistance = aimDistance !== null
      ? Math.max(ROLLER_MIN_REACH, Math.min(ROLLER_MAX_REACH, aimDistance))
      : ROLLER_REACH;
    if (this.isMoving) {
      this.walkPhase += dt * Math.min(speed / 40, 6.5);
    }
    this.bob = Math.sin(this.walkPhase * 2) * (this.isMoving ? 1.4 : 0.3);
    return speed;
  }

  getRollerContactPoint() {
    const side = 9;
    const reach = this.aimDistance;
    const px = Math.cos(this.facing) * reach - Math.sin(this.facing) * side;
    const py = Math.sin(this.facing) * reach + Math.cos(this.facing) * side;
    return { x: this.x + px, y: this.y + py };
  }

  draw(ctx) {
    const { x, y } = this;
    const facing = this.facing;
    const walk = this.walkPhase;
    const legSwing = this.isMoving ? Math.sin(walk) * 9 : 0;
    const legSwing2 = this.isMoving ? Math.sin(walk + Math.PI) * 9 : 0;
    const armSwing = this.isMoving ? Math.sin(walk + Math.PI) * 6 : 0;

    ctx.save();
    ctx.translate(x, y + this.bob);

    // ---- shadow ----
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.28)';
    ctx.beginPath();
    ctx.ellipse(2, 16, 16, 8, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // ---- roller (drawn first so hand/arm overlaps handle near body) ----
    this._drawRoller(ctx, facing);

    // ---- legs ----
    ctx.fillStyle = this.coworker.pantsColor || '#26262a';
    this._drawLimb(ctx, facing, -6, legSwing, 6, 15, 5);
    this._drawLimb(ctx, facing, 6, legSwing2, 6, 15, 5);

    // ---- torso ----
    ctx.save();
    ctx.rotate(facing * 0.06);
    ctx.fillStyle = this.coworker.shirtColor || '#3f6fb0';
    roundRect(ctx, -13, -16, 26, 26, 8);
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.25)';
    ctx.lineWidth = 1.5;
    roundRect(ctx, -13, -16, 26, 26, 8);
    ctx.stroke();
    // hi-vis stripe
    ctx.fillStyle = 'rgba(255,209,84,0.85)';
    ctx.fillRect(-13, -3, 26, 4);
    ctx.restore();

    // ---- off arm (swings naturally) ----
    ctx.save();
    ctx.fillStyle = this.coworker.shirtColor || '#3f6fb0';
    const offAngle = facing + Math.PI * 0.85;
    this._drawLimb(ctx, offAngle, 0, armSwing * 0.4, 5, 14, 4.5);
    ctx.restore();

    // ---- painting arm + hand (reaches toward roller) ----
    ctx.save();
    ctx.strokeStyle = this.coworker.shirtColor || '#3f6fb0';
    ctx.lineWidth = 8;
    ctx.lineCap = 'round';
    const handX = Math.cos(facing) * 20 - Math.sin(facing) * 6;
    const handY = Math.sin(facing) * 20 + Math.cos(facing) * 6;
    ctx.beginPath();
    ctx.moveTo(Math.cos(facing) * 4, Math.sin(facing) * 4 - 4);
    ctx.lineTo(handX, handY - 4);
    ctx.stroke();
    ctx.restore();

    // ---- head ----
    this._drawHead(ctx, facing);

    ctx.restore();

    if (this.isPlayer) {
      ctx.save();
      ctx.strokeStyle = 'rgba(255,176,31,0.9)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(x, y + 17, 20, 9, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
  }

  _drawLimb(ctx, angle, perpOffset, alongSwing, width, length, capR) {
    const nx = -Math.sin(angle), ny = Math.cos(angle);
    const fx = Math.cos(angle), fy = Math.sin(angle);
    const baseX = nx * perpOffset - fx * 4;
    const baseY = ny * perpOffset - fy * 4;
    const tipX = baseX + fx * (length * 0.4 + alongSwing);
    const tipY = baseY + fy * (length * 0.4 + alongSwing);
    ctx.beginPath();
    ctx.moveTo(baseX, baseY);
    ctx.lineTo(tipX, tipY);
    ctx.lineWidth = width;
    ctx.lineCap = 'round';
    ctx.strokeStyle = ctx.fillStyle;
    ctx.stroke();
  }

  _drawRoller(ctx, facing) {
    const reach = this.aimDistance;
    const side = 9;
    const handX = Math.cos(facing) * 20 - Math.sin(facing) * 6;
    const handY = Math.sin(facing) * 20 + Math.cos(facing) * 6;
    const rollerX = Math.cos(facing) * reach - Math.sin(facing) * side;
    const rollerY = Math.sin(facing) * reach + Math.cos(facing) * side;

    // handle
    ctx.save();
    ctx.strokeStyle = '#8a7a5a';
    ctx.lineWidth = 3.2;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(handX, handY - 4);
    ctx.lineTo(rollerX, rollerY);
    ctx.stroke();

    // roller head (perpendicular cylinder at contact point)
    const rot = facing + Math.PI / 2;
    ctx.translate(rollerX, rollerY);
    ctx.rotate(rot);
    // dry/lifted look when not actively laying paint, loaded look when painting
    const rollerColor = this.isPainting ? (this.currentColor || '#dddddd') : 'rgba(205,200,188,0.55)';
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath();
    ctx.ellipse(0, 3, 12, this.isPainting ? 4.5 : 3, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = rollerColor;
    roundRect(ctx, -12, -4, 24, 8, 4);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.fillRect(-10, -3.5, 20, 2);
    ctx.strokeStyle = '#4a4436';
    ctx.lineWidth = 1;
    roundRect(ctx, -12, -4, 24, 8, 4);
    ctx.stroke();
    ctx.restore();
  }

  _drawHead(ctx, facing) {
    const r = BODY_RADIUS;
    ctx.save();
    ctx.translate(0, -24);
    ctx.rotate(facing * 0.08);

    ctx.save();
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.closePath();
    ctx.clip();

    const img = getFace(this.coworker);
    if (img) {
      const iw = img.naturalWidth || img.width;
      const ih = img.naturalHeight || img.height;
      const scale = Math.max((r * 2) / iw, (r * 2) / ih);
      const dw = iw * scale, dh = ih * scale;
      ctx.drawImage(img, -dw / 2, -dh / 2, dw, dh);
    } else {
      ctx.fillStyle = '#5a5648';
      ctx.fillRect(-r, -r, r * 2, r * 2);
      ctx.fillStyle = '#c9c4b0';
      ctx.font = 'bold 14px Barlow Condensed, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText((this.coworker.name || '?')[0], 0, 1);
    }
    ctx.restore();

    ctx.lineWidth = 2;
    ctx.strokeStyle = 'rgba(0,0,0,0.35)';
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
