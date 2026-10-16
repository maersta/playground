// ============================================================================
// GAME
// Top-level state machine + main loop. Owns the current play session (job,
// crew of characters/AI, and the ONE shared paint job they all work on
// together) and wires UI callbacks to state transitions.
// ============================================================================

import { Camera } from './camera.js';
import { InputManager } from './input.js';
import { Renderer, buildJobVisualCache, createPaintCanvas, paintDab, drawTargetProgress } from './renderer.js';
import { Character, ROLLER_RADIUS } from './character.js';
import { AIController } from './ai.js';
import { PaintGrid } from './painting.js';
import { computeScore } from './scoring.js';
import { ParticleSystem } from './particles.js';
import { UI } from './ui.js';
import { COWORKERS, getCoworker } from './data/coworkers.js';
import { JOBS, getJob } from './data/jobs.js';
import { preloadFaces } from './faces.js';

const COLOR_NAMES = {
  '#f2f0e6': 'White',
  '#3f7fd1': 'Blue',
  '#f5c518': 'Yellow',
};

const START_SPACING = 28; // px between crew members' starting positions
const PLAYER_MOVE_THRESHOLD = 20;
const REFERENCE_VIEW_HEIGHT = 780; // world px shown vertically at zoom=1 fit - tunes how "zoomed in" gameplay feels
const END_COMPLETION_THRESHOLD = 0.999; // job isn't "done" until essentially every required cell is painted
const END_DELAY_SECONDS = 0.9;

export class Game {
  constructor() {
    this.canvas = document.getElementById('game-canvas');
    this.renderer = new Renderer(this.canvas);
    this.input = new InputManager(
      this.canvas,
      document.getElementById('touch-joystick-zone'),
      document.getElementById('touch-joystick-nub'),
    );

    this.ui = new UI({
      'goto-coworker-select': () => this.gotoCoworkerSelect(),
      'goto-jobs-info': () => this.gotoCoworkerSelect(),
      'goto-settings': () => this.ui.toast('Settings are coming soon - tune scoring weights in js/scoring.js for now.'),
      'back-to-menu': () => this.gotoMenu(),
      'goto-job-select': () => this.gotoJobSelect(),
      'back-to-coworker': () => this.gotoCoworkerSelect(),
      'start-game': () => this.startCountdown(),
      'restart-job': () => this.startCountdown(),
      'toggle-fullscreen': () => this.toggleFullscreen(),
      selectCoworker: (id) => this.selectCoworker(id),
      selectJob: (id) => this.selectJob(id),
    });

    this.state = 'menu';
    this.selectedCoworkerId = null;
    this.selectedJobId = null;
    this.session = null;

    this._rafId = null;
    this._lastTs = 0;
    this._statsClock = 0;
    this._countdownTimeout = null;
    this._endTimeout = null;
    this._loop = this._loop.bind(this);

    window.addEventListener('resize', () => this._handleResize());
    this._handleResize();

    this._fullscreenBtn = document.getElementById('btn-fullscreen');
    document.addEventListener('fullscreenchange', () => this._onFullscreenChange());
    document.addEventListener('webkitfullscreenchange', () => this._onFullscreenChange());

    preloadFaces(COWORKERS);
    this.ui.setTouchControlsVisible(false);
    this.ui.showScreen('menu');
  }

  // -------------------------------------------------------------- screens
  gotoMenu() {
    this._teardownSession();
    this.state = 'menu';
    this.ui.showScreen('menu');
    this.ui.setHudVisible(false);
    this.ui.setTouchControlsVisible(false);
  }

  gotoCoworkerSelect() {
    this._teardownSession();
    this.state = 'coworker';
    this.ui.showScreen('coworker');
    this.ui.setHudVisible(false);
    this.ui.setTouchControlsVisible(false);
    this.ui.renderCoworkerGrid(COWORKERS, this.selectedCoworkerId);
    this.ui.renderCoworkerDetail(this.selectedCoworkerId ? getCoworker(this.selectedCoworkerId) : null);
    this.ui.setConfirmCoworkerEnabled(!!this.selectedCoworkerId);
  }

  selectCoworker(id) {
    this.selectedCoworkerId = id;
    this.ui.renderCoworkerGrid(COWORKERS, this.selectedCoworkerId);
    this.ui.renderCoworkerDetail(getCoworker(id));
    this.ui.setConfirmCoworkerEnabled(true);
  }

  gotoJobSelect() {
    if (!this.selectedCoworkerId) return;
    this.state = 'job';
    this.ui.showScreen('job');
    this.ui.renderJobGrid(JOBS, this.selectedJobId);
    this.ui.setConfirmJobEnabled(!!this.selectedJobId);
  }

  selectJob(id) {
    this.selectedJobId = id;
    this.ui.renderJobGrid(JOBS, this.selectedJobId);
    this.ui.setConfirmJobEnabled(true);
  }

  startCountdown() {
    if (!this.selectedCoworkerId || !this.selectedJobId) return;
    this._teardownSession();
    this._buildSession(this.selectedJobId, this.selectedCoworkerId);
    this.renderer.clear();

    this.state = 'countdown';
    this.ui.showScreen('countdown');
    this.ui.setHudVisible(false);

    let count = 3;
    this.ui.setCountdown(String(count));
    const tick = () => {
      count -= 1;
      if (count > 0) {
        this.ui.setCountdown(String(count));
        this._countdownTimeout = setTimeout(tick, 800);
      } else {
        this.ui.setCountdown('GO!');
        this._countdownTimeout = setTimeout(() => this._beginPlaying(), 650);
      }
    };
    this._countdownTimeout = setTimeout(tick, 800);
  }

  _beginPlaying() {
    this.state = 'playing';
    this.ui.showScreen(null);
    this.ui.setHudVisible(true);
    this.ui.setTouchControlsVisible(InputManager.isTouchDevice());
    this.ui.setHudJobName(this.session.job.name);
    this.ui.setHudColorPickerVisible(this.session.job.colors.length > 1);
    this._lastTs = performance.now();
    this._rafId = requestAnimationFrame(this._loop);
  }

  // -------------------------------------------------------------- session
  // The whole crew paints one shared job site together - everyone moves and
  // works in the same job.world coordinate space, on the same PaintGrid and
  // the same visible paint layer. Individual scoring comes from *who* last
  // painted each cell (PaintGrid.cellOwner), not from separate copies.
  _buildSession(jobId, coworkerId) {
    const job = getJob(jobId);
    const visualCache = buildJobVisualCache(job);
    const paintGrid = new PaintGrid(job);
    const paintCanvas = createPaintCanvas(job);
    const paintCtx = paintCanvas.getContext('2d');

    const crew = COWORKERS.map((cw, ownerIndex) => {
      const start = scatterStart(job, ownerIndex, COWORKERS.length);
      const isPlayer = cw.id === coworkerId;
      const character = new Character(cw, start.x, start.y, isPlayer);
      character.currentColor = job.colors[0];
      const ai = isPlayer ? null : new AIController(character, job, paintGrid, ownerIndex);
      return { coworker: cw, character, ai, isPlayer, ownerIndex };
    });

    const player = crew.find((m) => m.isPlayer);
    const camera = new Camera(job.world.width, job.world.height);
    camera.setViewport(this._viewW, this._viewH);
    // Gameplay zoom is sized off the viewport alone (not the job's bounding
    // box) so characters/roller stay a comfortable, consistent on-screen size
    // no matter the job's shape - a narrow job on a wide monitor shouldn't
    // shrink to fit its own width, it should just show less width around the
    // player as they walk (camera follows them - see spec: world can be
    // bigger than the screen).
    const fitZoom = Math.max(camera.minZoom, Math.min(camera.maxZoom, this._viewH / REFERENCE_VIEW_HEIGHT));
    camera.zoom = fitZoom;
    camera.targetZoom = fitZoom;
    camera.x = player.character.x; camera.y = player.character.y;
    camera.follow(player.character.x, player.character.y);

    this.session = {
      job, visualCache, paintGrid, paintCanvas, paintCtx, crew, player, camera,
      particles: new ParticleSystem(),
      elapsed: 0,
      playerColorIndex: 0,
      ended: false,
      lastStats: null,
    };
  }

  _teardownSession() {
    if (this._rafId) { cancelAnimationFrame(this._rafId); this._rafId = null; }
    if (this._countdownTimeout) { clearTimeout(this._countdownTimeout); this._countdownTimeout = null; }
    if (this._endTimeout) { clearTimeout(this._endTimeout); this._endTimeout = null; }
  }

  // -------------------------------------------------------------- loop
  _loop(ts) {
    if (this.state !== 'playing') return;
    let dt = (ts - this._lastTs) / 1000;
    this._lastTs = ts;
    dt = Math.min(dt, 0.05);

    this.session.elapsed += dt;
    this._update(dt);
    this._render();

    this._rafId = requestAnimationFrame(this._loop);
  }

  _update(dt) {
    const s = this.session;
    const job = s.job;
    const player = s.player;

    const zoomDelta = this.input.consumeZoomDelta();
    if (zoomDelta) s.camera.zoomBy(zoomDelta);

    const colorCycle = this.input.consumeColorCycle();
    if (colorCycle && job.colors.length > 1) {
      s.playerColorIndex = (s.playerColorIndex + colorCycle + job.colors.length) % job.colors.length;
    }
    const playerColor = job.colors[s.playerColorIndex];
    player.character.currentColor = playerColor;

    const moveVec = this.input.getMoveVector();
    const aim = this.input.hasMouse ? this._computeAim(player.character) : null;
    const aimFacing = aim ? aim.angle : null;
    const aimDistance = aim ? aim.distance : null;
    const speed = player.character.update(dt, moveVec, job.world.width, job.world.height, 1, aimFacing, aimDistance);
    const paintHeld = this.input.isPaintHeld();
    player.character.isPainting = speed > PLAYER_MOVE_THRESHOLD && paintHeld;

    if (player.character.isPainting) {
      const speedRatio = speed / (player.character.baseSpeed * player.character.speedMultiplier);
      const coverage = Math.max(25, 85 - Math.max(0, speedRatio - 1) * 60);
      const contact = player.character.getRollerContactPoint();
      const amount = coverage * dt * 12;
      this._applyPaint(contact, playerColor, amount, player.ownerIndex);
    } else if (moveVec.x === 0 && moveVec.y === 0 && Math.random() < 0.02) {
      s.particles.spawnDust(player.character.x, player.character.y + 14);
    }

    for (const member of s.crew) {
      if (!member.ai) continue;
      const speedScale = this._competitiveScale(member);
      const evt = member.ai.update(dt, job.world.width, job.world.height, speedScale);
      if (evt) this._paintVisual(evt.contact, evt.color, evt.amount);
    }

    s.camera.follow(player.character.x, player.character.y);
    s.camera.setViewport(this._viewW, this._viewH);
    s.camera.update(dt);

    s.particles.update(dt);

    this.ui.setHudTimer(s.elapsed);

    this._statsClock += dt;
    if (this._statsClock > 0.2) {
      this._statsClock = 0;
      this._refreshStatsAndHud();
    }
  }

  _applyPaint(contact, color, amount, ownerIndex) {
    this.session.paintGrid.stamp(contact.x, contact.y, ROLLER_RADIUS, color, amount, ownerIndex);
    this._paintVisual(contact, color, amount);
  }

  _paintVisual(contact, color, amount) {
    paintDab(this.session.paintCtx, contact.x, contact.y, ROLLER_RADIUS, color, Math.min(1, amount / 70));
    if (Math.random() < 0.35) {
      this.session.particles.spawnPaintFleck(contact.x, contact.y, color);
    }
  }

  _computeAim(character) {
    const s = this.session;
    const mouse = this.input.getMousePos();
    const world = s.camera.screenToWorld(mouse.x, mouse.y);
    const dx = world.x - character.x;
    const dy = world.y - character.y;
    return { angle: Math.atan2(dy, dx), distance: Math.hypot(dx, dy) };
  }

  _competitiveScale(member) {
    const s = this.session;
    if (!s.lastStats) return 1;
    const byOwner = s.lastStats.byOwner;
    const progresses = s.crew.map((m) => byOwner[m.ownerIndex].completion);
    const avg = progresses.reduce((a, b) => a + b, 0) / progresses.length;
    const mine = byOwner[member.ownerIndex].completion;
    const behind = Math.max(0, avg - mine);
    const boost = 1 + behind * member.character.coworker.personality.competitiveness * 1.2;
    return Math.min(1.5, boost);
  }

  _refreshStatsAndHud() {
    const s = this.session;
    if (!s) return;
    const stats = s.paintGrid.getStats(s.crew.length);
    s.lastStats = stats;

    this.ui.setHudProgress(stats.completion);
    this.ui.setHudColor(s.player.character.currentColor, COLOR_NAMES[s.player.character.currentColor] || s.player.character.currentColor);

    const entries = s.crew.map((member) => ({
      isPlayer: member.isPlayer,
      face: member.coworker.face,
      progress: stats.byOwner[member.ownerIndex].completion,
    }));
    this.ui.renderCompetitorPanel(entries);

    if (!s.ended) {
      // Generous last-resort safety net only - the job is meant to run until it's
      // actually fully painted, this just prevents a stuck/stalled AI from making
      // the session unplayable forever.
      const cap = s.job.parTimeSeconds * 5;
      if (stats.completion >= END_COMPLETION_THRESHOLD || s.elapsed >= cap) {
        s.ended = true;
        this._endTimeout = setTimeout(() => this._finishJob(), END_DELAY_SECONDS * 1000);
      }
    }
  }

  _finishJob() {
    const s = this.session;
    if (!s) return;
    if (this._rafId) { cancelAnimationFrame(this._rafId); this._rafId = null; }

    const stats = s.paintGrid.getStats(s.crew.length);
    const results = s.crew.map((member) => {
      const ownerStats = stats.byOwner[member.ownerIndex];
      const score = computeScore(ownerStats, s.elapsed, s.job);
      return { member, score };
    });
    const playerResult = results.find((r) => r.member.isPlayer);
    const standings = results
      .map((r) => ({ isPlayer: r.member.isPlayer, name: r.member.coworker.name, face: r.member.coworker.face, total: r.score.total }))
      .sort((a, b) => b.total - a.total);

    this.ui.renderResults(playerResult.score, standings);
    this.state = 'results';
    this.ui.showScreen('results');
    this.ui.setHudVisible(false);
    this.ui.setTouchControlsVisible(false);
  }

  // -------------------------------------------------------------- render
  _render() {
    const s = this.session;
    if (!s) return;
    this.renderer.clear();
    const ctx = this.renderer.ctx;
    s.camera.apply(ctx);

    this.renderer.drawSite(s.visualCache, s.paintCanvas, s.job);
    drawTargetProgress(ctx, s.paintGrid, s.elapsed);
    s.particles.draw(ctx);
    this.renderer.drawEntities(s.crew.map((m) => m.character));
  }

  _handleResize() {
    const { w, h } = this.renderer.resize();
    this._viewW = w;
    this._viewH = h;
    if (this.session) this.session.camera.setViewport(w, h);
  }

  // -------------------------------------------------------------- fullscreen
  toggleFullscreen() {
    const isFs = document.fullscreenElement || document.webkitFullscreenElement;
    try {
      if (!isFs) {
        const el = document.documentElement;
        const request = el.requestFullscreen || el.webkitRequestFullscreen;
        if (request) {
          const result = request.call(el);
          if (result && result.catch) result.catch(() => {});
        }
      } else {
        const exit = document.exitFullscreen || document.webkitExitFullscreen;
        if (exit) {
          const result = exit.call(document);
          if (result && result.catch) result.catch(() => {});
        }
      }
    } catch (e) {
      // Fullscreen not permitted in this context (e.g. embedded iframe) - ignore.
    }
  }

  _onFullscreenChange() {
    const isFs = !!(document.fullscreenElement || document.webkitFullscreenElement);
    if (this._fullscreenBtn) {
      this._fullscreenBtn.classList.toggle('is-fullscreen', isFs);
      this._fullscreenBtn.title = isFs ? 'Exit Fullscreen' : 'Enter Fullscreen';
    }
    this._handleResize();
  }
}

// Spreads the crew's starting positions out around the job's designated
// start point so all five don't spawn stacked on top of each other.
function scatterStart(job, index, total) {
  const offset = (index - (total - 1) / 2) * START_SPACING;
  const margin = 24;
  return {
    x: Math.max(margin, Math.min(job.world.width - margin, job.startPoint.x)),
    y: Math.max(margin, Math.min(job.world.height - margin, job.startPoint.y + offset)),
  };
}
