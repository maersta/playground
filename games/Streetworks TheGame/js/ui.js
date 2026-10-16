// ============================================================================
// UI
// DOM wiring for menu/select/HUD/results screens. Pure presentation - game.js
// owns state and passes data in; UI never mutates game state directly, it
// only forwards user actions via the callbacks object passed to init().
// ============================================================================

import { traceGeometryPath } from './renderer.js';

const el = (id) => document.getElementById(id);

export class UI {
  constructor(callbacks) {
    this.cb = callbacks;
    this.screens = {
      menu: el('screen-menu'),
      coworker: el('screen-coworker'),
      job: el('screen-job'),
      countdown: el('screen-countdown'),
      results: el('screen-results'),
    };
    this.hud = el('hud');
    this.touchControls = el('touch-controls');

    document.body.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-action]');
      if (!btn) return;
      const action = btn.dataset.action;
      if (this.cb[action]) this.cb[action]();
    });
  }

  // name === null means "no menu screen" (used during gameplay, where only
  // the canvas + HUD are visible).
  showScreen(name) {
    for (const key of Object.keys(this.screens)) {
      this.screens[key].classList.toggle('hidden', key !== name);
    }
  }

  toast(message) {
    let node = el('toast');
    if (!node) {
      node = document.createElement('div');
      node.id = 'toast';
      node.className = 'toast';
      document.getElementById('app').appendChild(node);
    }
    node.textContent = message;
    node.classList.add('visible');
    clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(() => node.classList.remove('visible'), 2400);
  }

  setHudVisible(visible) {
    this.hud.classList.toggle('hidden', !visible);
  }

  setTouchControlsVisible(visible) {
    this.touchControls.classList.toggle('hidden', !visible);
  }

  // -------------------------------------------------------------- coworker
  renderCoworkerGrid(coworkers, selectedId) {
    const grid = el('coworker-grid');
    grid.innerHTML = '';
    for (const c of coworkers) {
      const card = document.createElement('div');
      card.className = 'coworker-card' + (c.id === selectedId ? ' selected' : '');
      card.innerHTML = `
        <div class="coworker-face"><img src="${c.face}" alt="${c.name}"></div>
        <div class="coworker-name">${c.name}</div>
        <div class="coworker-tag">${c.tag}</div>
      `;
      card.addEventListener('click', () => this.cb.selectCoworker(c.id));
      grid.appendChild(card);
    }
  }

  renderCoworkerDetail(c) {
    const detail = el('coworker-detail');
    if (!c) {
      detail.innerHTML = '<p class="hint">Select a coworker to see their profile.</p>';
      return;
    }
    const traits = [
      ['Speed', c.personality.movementSpeed / 1.4],
      ['Paint Speed', c.personality.paintingSpeed / 1.4],
      ['Accuracy', c.personality.accuracy],
      ['Patience', c.personality.patience],
      ['Perfectionism', c.personality.perfectionism],
      ['Risk-Taking', c.personality.riskTaking],
      ['Laziness', c.personality.laziness],
      ['Competitiveness', c.personality.competitiveness],
    ];
    detail.innerHTML = `
      <div class="detail-header">
        <div class="detail-face"><img src="${c.face}" alt="${c.name}"></div>
        <div>
          <div class="detail-name">${c.name} <span style="color:var(--accent); font-size:1rem;">${c.tag}</span></div>
          <p class="detail-blurb">${c.blurb}</p>
        </div>
      </div>
      <div class="trait-bars">
        ${traits.map(([label, v]) => `
          <div class="trait-row">
            <div class="trait-row-label"><span>${label}</span></div>
            <div class="trait-bar"><div class="trait-bar-fill" style="width:${Math.round(clamp01(v) * 100)}%"></div></div>
          </div>
        `).join('')}
      </div>
    `;
  }

  setConfirmCoworkerEnabled(enabled) {
    el('btn-confirm-coworker').disabled = !enabled;
  }

  // -------------------------------------------------------------- job
  renderJobGrid(jobs, selectedId) {
    const grid = el('job-grid');
    grid.innerHTML = '';
    for (const job of jobs) {
      const card = document.createElement('div');
      card.className = 'job-card' + (job.id === selectedId ? ' selected' : '');
      const areaSqM = Math.round((job.world.width * job.world.height) / (11.8 * 11.8));
      card.innerHTML = `
        <div class="job-card-preview"><canvas width="220" height="110"></canvas></div>
        <div class="job-card-name">${job.name}</div>
        <div class="job-card-meta"><span>${job.difficulty}</span><span>~${areaSqM} m&sup2;</span></div>
        <div class="job-card-desc">${job.description}</div>
      `;
      card.addEventListener('click', () => this.cb.selectJob(job.id));
      grid.appendChild(card);
      this._drawJobPreview(card.querySelector('canvas'), job);
    }
  }

  _drawJobPreview(canvas, job) {
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#33352c';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    const pad = 10;
    const scale = Math.min((canvas.width - pad * 2) / job.world.width, (canvas.height - pad * 2) / job.world.height);
    ctx.save();
    ctx.translate(
      (canvas.width - job.world.width * scale) / 2,
      (canvas.height - job.world.height * scale) / 2,
    );
    ctx.scale(scale, scale);
    for (const target of job.targets) {
      ctx.save();
      if (target.geometry.filled) {
        traceGeometryPath(ctx, target.geometry);
        ctx.fillStyle = target.color + '33';
        ctx.fill();
      }
      traceGeometryPath(ctx, target.geometry);
      ctx.strokeStyle = target.color;
      ctx.lineWidth = (target.strokeWidth || 8) * 0.7;
      ctx.stroke();
      ctx.restore();
    }
    ctx.restore();
  }

  setConfirmJobEnabled(enabled) {
    el('btn-confirm-job').disabled = !enabled;
  }

  // -------------------------------------------------------------- countdown
  setCountdown(text) {
    el('countdown-number').textContent = text;
  }

  // -------------------------------------------------------------- HUD
  setHudJobName(name) { el('hud-job-name').textContent = name; }

  setHudTimer(seconds) {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = Math.floor(seconds % 60).toString().padStart(2, '0');
    el('hud-timer').textContent = `${m}:${s}`;
  }

  setHudProgress(fraction) {
    el('hud-progress-fill').style.width = `${Math.round(clamp01(fraction) * 100)}%`;
  }

  setHudColor(hex, name) {
    el('hud-color-swatch').style.background = hex;
    el('hud-color-name').textContent = name;
  }

  setHudColorPickerVisible(visible) {
    el('hud-color').style.opacity = visible ? '1' : '0.35';
  }

  renderCompetitorPanel(entries) {
    const panel = el('hud-competitors');
    panel.innerHTML = entries.map((e) => `
      <div class="hud-competitor ${e.isPlayer ? 'is-player' : ''}">
        <div class="hud-competitor-face"><img src="${e.face}" alt=""></div>
        <div class="hud-competitor-bar"><div class="hud-competitor-fill" style="width:${Math.round(clamp01(e.progress) * 100)}%"></div></div>
      </div>
    `).join('');
  }

  // -------------------------------------------------------------- results
  renderResults(playerResult, standings) {
    const body = el('results-body');
    const rows = [
      ['COMPLETION', playerResult.completion],
      ['ACCURACY', playerResult.accuracy],
      ['CLEANLINESS', playerResult.cleanliness],
      ['TIME', playerResult.time],
    ];
    body.innerHTML = `
      <div class="score-block">
        ${rows.map(([label, v]) => `
          <div class="score-row">
            <div class="score-label">${label}</div>
            <div class="score-bar"><div class="score-bar-fill" style="width:${Math.round(clamp01(v) * 100)}%"></div></div>
            <div class="score-value">${Math.round(clamp01(v) * 100)}%</div>
          </div>
        `).join('')}
        <div class="score-row score-total">
          <div class="score-label">TOTAL</div>
          <div class="score-bar"><div class="score-bar-fill" style="width:${Math.round(clamp01(playerResult.total) * 100)}%"></div></div>
          <div class="score-value">${Math.round(clamp01(playerResult.total) * 100)}%</div>
        </div>
      </div>
      <div class="standings">
        ${standings.map((s, i) => `
          <div class="standing-row ${s.isPlayer ? 'is-player' : ''}">
            <div class="standing-rank">#${i + 1}</div>
            <div class="standing-face"><img src="${s.face}" alt=""></div>
            <div class="standing-name">${s.name}${s.isPlayer ? ' (You)' : ''}</div>
            <div class="standing-score">${Math.round(s.total * 100)}%</div>
          </div>
        `).join('')}
      </div>
    `;
  }
}

function clamp01(v) { return Math.max(0, Math.min(1, v)); }
