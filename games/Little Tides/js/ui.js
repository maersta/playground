// HTML/CSS user interface: HUD, modals (shop, cargo, book, pets, quests, stats, settings, map...), toasts, catch card.
import { CONFIG, RARITY, RARITY_IDS } from './config.js';
import { SPECIES, SPECIES_BY_ID, LOOT_BY_ID, LAYER_NAMES } from './fish-data.js';
import { ZONES, ZONE_BY_ID } from './zone-data.js';
import { RODS, LINES, HOOKS, BOATS, BAITS, BOOSTS, BAIT_BY_ID, CATS, maxOwned } from './upgrades.js';
import { PETS, PET_BY_ID } from './pets.js';
import * as book from './fish-book.js';
import * as inventory from './inventory.js';
import * as prestige from './prestige.js';
import { SECRETS } from './secrets.js';
import { boostPrice, saleValue } from './economy.js';
import { zoneRequirements } from './game.js';
import { drawFish, drawLoot, drawGear } from './fish-art.js';
import { drawBoat, drawPet, BOAT_META, island, organic, paint, glow, sparkle, INK, TAU, mix, hash } from './draw.js';
import { isNight, FS } from './fishing.js';

// ---------- helpers ----------
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmt = n => Math.round(n).toLocaleString('en-US');
const fmtW = w => (w < 1 ? `${Math.round(w * 1000)} g` : `${w.toFixed(w < 10 ? 2 : 1)} kg`);
const fmtL = l => (l >= 100 ? `${(l / 100).toFixed(2)} m` : `${l.toFixed(1)} cm`);
const fmtT = s => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
const $ = (sel, root = document) => root.querySelector(sel);
const cap = s => s.charAt(0).toUpperCase() + s.slice(1);

const ICONS = {
  anchor: '<circle cx="12" cy="5" r="2.5"/><path d="M12 7.5V21M7 11h10M4 15c0 3.5 3.5 6 8 6s8-2.5 8-6"/>',
  map: '<path d="M3 6l6-2 6 2 6-2v14l-6 2-6-2-6 2z"/><path d="M9 4v14M15 6v14"/>',
  book: '<path d="M4 5c3-1 6-1 8 1 2-2 5-2 8-1v14c-3-1-6-1-8 1-2-2-5-2-8-1z"/><path d="M12 6v14"/>',
  cargo: '<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M3 11h18M9 7V4h6v3"/>',
  shop: '<path d="M4 9l1.5-5h13L20 9"/><path d="M4 9c0 1.7 1.3 3 3 3s3-1.3 3-3c0 1.7 1.3 3 3 3s3-1.3 3-3c0 1.7 1 3 3 3"/><path d="M5 12v8h14v-8M10 20v-5h4v5"/>',
  scroll: '<path d="M6 4h11a2 2 0 012 2v11a3 3 0 01-3 3H8a3 3 0 01-3-3V6a2 2 0 011-2z"/><path d="M9 9h7M9 13h7"/>',
  paw: '<circle cx="7" cy="10" r="2"/><circle cx="12" cy="7" r="2"/><circle cx="17" cy="10" r="2"/><path d="M12 12c-3 0-5 3-5 5 0 2 2 2.5 5 2.5s5-.5 5-2.5c0-2-2-5-5-5z"/>',
  chart: '<path d="M4 20V10M10 20V4M16 20v-8M22 20H2"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M19 5l-2 2M7 17l-2 2"/>',
  coin: '<circle cx="12" cy="12" r="9"/><path d="M12 7v10M9.5 9.5c0-1 1.1-1.5 2.5-1.5s2.5.6 2.5 1.7-1.2 1.5-2.5 1.8-2.5.7-2.5 1.8 1.1 1.7 2.5 1.7 2.5-.5 2.5-1.5"/>',
};
const iconSvg = n => `<svg viewBox="0 0 24 24" aria-hidden="true">${ICONS[n] || ''}</svg>`;

function canvasHTML(kind, id, w, h, extra = {}) {
  const attrs = Object.entries(extra).map(([k, v]) => ` data-${k}="${esc(v)}"`).join('');
  return `<canvas class="ic" data-k="${kind}" data-id="${esc(id)}" data-w="${w}" data-h="${h}"${attrs}></canvas>`;
}
const iconBox = (kind, id, w, h, extra, cls = '') => `<div class="ic-wrap ${cls}" style="width:${w + 8}px;height:${h + 8}px">${canvasHTML(kind, id, w, h, extra)}</div>`;

export class UI {
  constructor(game, renderer) {
    this.g = game; this.r = renderer;
    this.modal = null; this.params = {}; this.tabs = {};
    this.confirm = null;
    this.sel = new Set(); this.inspect = null;
    this.bf = { zone: 'all', rar: 'all', stat: 'all', sort: 'default' };
    this.bookSel = null; this.bookView = 'species';
    this.mapHover = null; this.mapTimer = null; this.catchVisible = false; this.catchInfo = null; this.catchT = 0;
    this.cache = {};
    this.root = $('#modal-root'); this.confirmRoot = $('#confirm-root');
  }

  get modalOpen() { return !!this.modal || !!this.confirm; }

  init() {
    const g = this.g;
    document.querySelectorAll('[data-icon]').forEach(el => { el.innerHTML = iconSvg(el.dataset.icon); });
    document.addEventListener('click', e => this.onClick(e));
    document.addEventListener('change', e => this.onChange(e));
    document.addEventListener('input', e => this.onInput(e));
    g.bus.on('toast', t => this.toast(t.msg, t.kind, t.long));
    g.bus.on('state', () => this.onState());
    g.bus.on('mode', () => this.onMode());
    g.bus.on('zone', () => this.onMode());
    g.bus.on('depth', () => this.updateDepth());
    g.bus.on('catch', info => this.showCatch(info));
    g.bus.on('presentationEnd', () => this.hideCatch());
    g.bus.on('fishingState', () => this.updateStatus(true));
    const cv = $('#stage');
    cv.addEventListener('mousemove', e => { const r = cv.getBoundingClientRect(); this.mouse = { x: e.clientX - r.left, y: e.clientY - r.top }; cv.style.cursor = this.g.inHarbor && this.r.hitTest(this.mouse.x, this.mouse.y) ? 'pointer' : 'default'; });
    cv.addEventListener('mouseleave', () => { this.mouse = { x: -1, y: -1 }; });
    cv.addEventListener('click', e => {
      if (this.modalOpen) return;
      this.g.audio.unlock();
      if (this.g.inHarbor) { const r = cv.getBoundingClientRect(); const h = this.r.hitTest(e.clientX - r.left, e.clientY - r.top); if (h) this.hotspot(h.id); }
    });
    this.mouse = { x: -1, y: -1 };
    this.onMode(); this.updateHUD(true);
    if (g.loadStatus === 'recovered') setTimeout(() => this.toast('Your save file could not be read, so a fresh game was started. A backup of the old data was kept.', 'warn', true), 600);
    if (!g.state.introDone && !/[?&]nointro/.test(location.search)) this.open('intro', { page: 0 });
  }

  hotspot(id) {
    const map = { tackle: ['shop', { tab: 'rod' }], market: ['cargo'], yard: ['shop', { tab: 'boat' }], board: ['quests'], lighthouse: ['prestige'], pets: ['pets'], boat: ['map'] };
    const m = map[id]; if (!m) return;
    if (m[1] && m[1].tab) this.tabs.shop = m[1].tab;
    this.open(m[0]);
  }

  // ---------- toasts ----------
  toast(msg, kind = 'info', long = false) {
    const box = $('#toasts');
    while (box.children.length >= 5) box.firstChild.remove();
    const el = document.createElement('div');
    el.className = `toast ${kind}`; el.textContent = msg;
    box.appendChild(el);
    setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 320); }, long ? 6500 : 3200);
  }

  // ---------- HUD ----------
  setText(id, v, html = false) {
    if (this.cache[id] === v) return;
    this.cache[id] = v;
    const el = document.getElementById(id);
    if (el) (html ? el.innerHTML = v : el.textContent = v);
  }
  onState() {
    this.updateHUD(true);
    if (this.modal && this.modal !== 'settings' && this.modal !== 'map') this.renderModal();
    else if (this.modal === 'map') this.renderModal();
  }
  onMode() {
    const harbor = this.g.inHarbor;
    document.getElementById('depth').classList.toggle('hidden', harbor);
    document.getElementById('guide').classList.toggle('hidden', !this.g.state.settings.guide);
    this.setText('nav-harbor-lbl', harbor ? 'Set Sail' : 'Harbor');
    this.hideCatch();
    this.updateHUD(true); this.updateDepth(); this.updateStatus(true);
  }
  updateHUD() {
    const g = this.g, s = g.state, fx = g.fx, z = g.zone;
    this.setText('hud-zone', g.inHarbor ? 'Little Harbor' : z.name);
    this.setText('hud-boat', `<span class="ico" data-icon="anchor"></span>${esc(fx.boat.name)}`, true);
    this.setText('hud-bait', `Bait: ${esc(fx.bait.name)}`, true);
    this.setText('hud-pet', fx.pet ? `<span class="ico" data-icon="paw"></span>${esc(fx.pet.name)}` : 'No companion', true);
    this.setText('coins-num', fmt(s.coins));
    const n = inventory.count(s), c = inventory.capacity(s);
    this.setText('cargo-text', `${n}/${c}`);
    const bar = document.getElementById('cargo-bar'); if (bar) bar.style.width = `${Math.min(100, (n / c) * 100)}%`;
    document.querySelector('.pill.cargo').classList.toggle('full', n >= c);
    const night = isNight(s.clock);
    this.setText('hud-clock', `<span class="sunmoon ${night ? 'night' : ''}"></span>${night ? 'Night' : 'Day'}`, true);
    // re-inject svg icons for dynamic html
    document.querySelectorAll('#hud [data-icon]').forEach(el => { if (!el.firstChild) el.innerHTML = iconSvg(el.dataset.icon); });
    // badges
    const bb = $('#nav-book .badge'), qb = $('#nav-quests .badge');
    const cl = book.claimableCount(s), qd = s.quests.active.filter(q => q.done).length;
    bb.textContent = cl; bb.classList.toggle('hidden', !cl); qb.textContent = qd; qb.classList.toggle('hidden', !qd);
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.toggle('active', b.dataset.arg === this.modal));
    document.getElementById('guide').classList.toggle('hidden', !s.settings.guide || g.inHarbor);
    this.updateDepth();
    this.updateBoosts();
  }
  updateBoosts() {
    const s = this.g.state, box = document.getElementById('boosts');
    const ids = Object.keys(s.boosts).sort();
    const html = ids.map(id => { const b = BOOSTS.find(x => x.id === id); return `<div class="boost-chip"><b>${esc(b.name)}</b><small>${fmtT(s.boosts[id])}</small></div>`; }).join('');
    if (this.cache.boosts !== html) { this.cache.boosts = html; box.innerHTML = html; }
  }
  updateDepth() {
    const g = this.g, fs = g.fishing, fx = g.fx, z = g.zone;
    if (g.inHarbor) return;
    const mark = document.getElementById('depth-mark'), lim = document.getElementById('depth-limit');
    mark.style.top = `${fs.depth * 100}%`;
    lim.style.height = `${(1 - fx.maxDepth) * 100}%`;
    const layer = ['Surface', 'Midwater', 'Deep'][fs.depth < 0.3 ? 0 : fs.depth < 0.6 ? 1 : 2];
    this.setText('depth-label', `${Math.round(fs.depth * z.depthM)} m<br>${layer}`, true);
  }
  updateStatus(force) {
    const g = this.g, fs = g.fishing, el = document.getElementById('status'), btn = document.getElementById('status-btn');
    let text, warn = false, bt = null, ba = 'harbor';
    if (g.inHarbor) { text = 'Docked at the harbor. Sell, shop, or set sail when ready.'; bt = 'Set Sail'; ba = 'sail'; }
    else { text = fs.statusText(); if (fs.state === FS.FULL) { warn = true; bt = 'Go to Harbor'; } }
    this.setText('status-text', text);
    el.classList.toggle('warn', warn);
    btn.classList.toggle('hidden', !bt);
    if (bt) { btn.textContent = bt; btn.dataset.act = ba; }
  }

  // per-frame
  tick(dt) {
    this.hudT = (this.hudT || 0) + dt;
    if (this.hudT > 0.25) { this.hudT = 0; this.updateStatus(); this.updateBoosts(); this.setText('hud-clock', `<span class="sunmoon ${isNight(this.g.state.clock) ? 'night' : ''}"></span>${isNight(this.g.state.clock) ? 'Night' : 'Day'}`, true); }
    if (this.catchVisible) this.drawCatch(dt);
  }

  // ---------- events ----------
  onClick(e) {
    if (e.target.matches && e.target.matches('input[type=checkbox], input[type=range], select, option')) return;
    const el = e.target.closest('[data-act]');
    if (!el) return;
    if (el.classList.contains('backdrop') && e.target !== el) return;
    if (el.disabled) return;
    this.g.audio.unlock();
    this.act(el.dataset.act, el.dataset.arg, el, e);
    if (document.activeElement && document.activeElement.tagName === 'BUTTON' && !this.modal) document.activeElement.blur();
  }
  onChange(e) {
    const el = e.target;
    if (el.dataset.sel !== undefined) { const uid = +el.dataset.sel; el.checked ? this.sel.add(uid) : this.sel.delete(uid); this.renderModal(); return; }
    if (el.dataset.filter) { this.bf[el.dataset.filter] = el.value; this.renderModal(true); return; }
    if (el.dataset.setting) { const k = el.dataset.setting; const v = el.type === 'checkbox' ? el.checked : +el.value; this.g.setSetting(k, v); if (k === 'guide') this.updateHUD(); if (el.type === 'checkbox') { this.g.audio.sfx('ui'); this.g.save(); this.renderModal(); } else this.g.save(); return; }
    if (el.id === 'import-file') { const f = el.files[0]; if (f) { const r = new FileReader(); r.onload = () => this.doImport(String(r.result)); r.readAsText(f); } }
  }
  onInput(e) {
    const el = e.target;
    if (el.dataset.setting && el.type === 'range') {
      this.g.setSetting(el.dataset.setting, +el.value);
      const out = el.parentElement.querySelector('.val'); if (out) out.textContent = `${Math.round(el.value * 100)}%`;
    }
  }

  act(a, arg, el, e) {
    const g = this.g, s = g.state;
    switch (a) {
      case 'open': this.open(arg); break;
      case 'close': this.close(); break;
      case 'backdrop': this.close(); break;
      case 'harbor': this.toggleHarbor(); break;
      case 'sail': this.close(); g.travel(s.zone); break;
      case 'depth': g.fishing.adjustDepth(+arg); break;
      case 'depth-click': { const r = el.getBoundingClientRect(); g.fishing.setDepth((e.clientY - r.top) / r.height); break; }
      case 'tab': this.tabs[this.modal] = arg; this.renderModal(true); break;
      case 'buy-tier': { const [c, i] = arg.split(':'); g.buyTier(c, +i); break; }
      case 'equip-tier': { const [c, i] = arg.split(':'); g.equipTier(c, +i); break; }
      case 'buy-bait': g.buyBait(arg); break;
      case 'equip-bait': g.equipBait(arg); break;
      case 'buy-boost': g.buyBoost(arg); break;
      case 'inspect': this.inspect = +arg; this.renderModal(); break;
      case 'fav': g.toggleFav(+arg); break;
      case 'open-bottle': g.openBottle(+arg); break;
      case 'sel-all': for (const it of s.cargo) if (!it.fav) this.sel.add(it.uid); this.renderModal(); break;
      case 'sel-none': this.sel.clear(); this.renderModal(); break;
      case 'sell-sel': { const r = g.sellItems([...this.sel]); if (r.count) { this.sel.clear(); this.firstSaleHint(); } break; }
      case 'sell-one': { const r = g.sellItems([+arg]); if (r.count) { this.sel.delete(+arg); this.inspect = null; this.firstSaleHint(); } break; }
      case 'sell-all': { const r = g.sellItems(s.cargo.map(i => i.uid)); if (r.count) { this.sel.clear(); this.firstSaleHint(); } break; }
      case 'sell-junk': { const r = g.sellKinds(['junk']); if (r.count) this.firstSaleHint(); break; }
      case 'book-sel': this.bookSel = arg; this.renderModal(); break;
      case 'book-zone': this.bf.zone = this.bf.zone === arg ? 'all' : arg; this.bookView = 'species'; this.tabs.book = 'species'; this.renderModal(true); break;
      case 'claim-ms': g.claimMilestone(arg); break;
      case 'claim-all': g.claimAllMilestones(); break;
      case 'pet-select': g.selectPet(arg === 'none' ? null : arg); break;
      case 'pet-buy': g.buyPet(arg); break;
      case 'deco-select': g.selectDeco(arg === 'none' ? null : arg); break;
      case 'title-select': g.selectTitle(arg === 'none' ? null : arg); break;
      case 'q-accept': g.acceptQuest(+arg); break;
      case 'q-abandon': g.abandonQuest(+arg); break;
      case 'q-claim': g.claimQuest(+arg); break;
      case 'q-reroll': g.rerollQuests(); break;
      case 'map-go': { const r = g.travel(arg); if (r.ok) this.close(); else g.note(r); break; }
      case 'prestige-open': this.open('prestige'); break;
      case 'prestige-do': this.askConfirm({ title: 'Begin a new voyage?', text: `You will earn ${prestige.starsGain(s)} Tide Star(s), but your coins, gear, boats, cargo, requests and zone access will reset. Your fish book, records, pets, secrets, cosmetics and milestones are kept.`, ok: 'Begin anew', danger: true, onOk: () => { this.close(); g.doPrestige(); } }); break;
      case 'perk': g.buyPerk(arg); break;
      case 'intro-next': this.params.page++; this.renderModal(true); break;
      case 'intro-skip': this.close(); break;
      case 'resume': this.close(); break;
      case 'save-now': g.save(); this.toast(g.lastSaveOk ? 'Game saved.' : 'Could not write to local storage (private mode?).', g.lastSaveOk ? 'good' : 'warn'); break;
      case 'export': this.doExport(); break;
      case 'copy-export': this.copyExport(); break;
      case 'import-text': this.doImport($('#import-text').value); break;
      case 'reset': this.askConfirm({ title: 'Erase all progress?', text: 'This permanently deletes your save: coins, gear, fish book, pets and everything else. This cannot be undone.', ok: 'Erase everything', danger: true, onOk: () => { this.close(); g.resetAll(); this.toast('Save erased. A fresh voyage begins.', 'info'); } }); break;
      case 'confirm-ok': { const c = this.confirm; this.closeConfirm(); if (c && c.onOk) c.onOk(); break; }
      case 'confirm-cancel': this.closeConfirm(); break;
      case 'dismiss-catch': this.dismissCatch(); break;
      case 'mute': g.setSetting('muteAll', !s.settings.muteAll); g.save(); this.renderModal(); break;
    }
  }

  firstSaleHint() { /* the hint toast is triggered by the harbor visit; kept as hook for future use */ }

  toggleHarbor() {
    if (this.g.inHarbor) { this.close(); this.g.travel(this.g.state.zone); } else { this.close(); this.g.goHarbor(); if (!this.g.state.hints.harbor) { this.g.state.hints.harbor = true; this.g.bus.emit('toast', { msg: 'Welcome to the harbor! Click the Fish Market (or open Cargo) to sell catches, and the Tackle Shop to buy gear.', kind: 'hint', long: true }); } }
  }

  // ---------- modal management ----------
  open(name, params = {}) {
    if (this.confirm) this.closeConfirm();
    if (this.modal === name && name !== 'intro') { this.close(); return; }
    this.modal = name; this.params = params;
    this.g.modalOpen = true; this.g.paused = name === 'pause';
    this.g.axis = 0;
    this.g.audio.unlock(); this.g.audio.sfx('ui');
    if (document.activeElement && document.activeElement !== document.body) document.activeElement.blur();
    this.renderModal(true);
    this.updateHUD();
  }
  close() {
    const was = this.modal;
    this.modal = null; this._shown = null; this.root.innerHTML = ''; this.g.modalOpen = false; this.g.paused = false;
    this.stopMap();
    if (was === 'intro') { this.g.markIntroDone(); this.g.bus.emit('toast', { msg: 'Tip: SPACE casts your line. Use A/D to steer, W/S to change depth.', kind: 'hint', long: true }); this.g.state.hints.fish = true; }
    if (document.activeElement && document.activeElement !== document.body) document.activeElement.blur();
    this.updateHUD();
    if (was) this.g.audio.sfx('ui');
  }
  handleEsc() {
    if (this.confirm) { this.closeConfirm(); return; }
    if (this.modal) { this.close(); return; }
    this.open('pause');
  }
  handleEnter() {
    if (this.confirm) { this.act('confirm-ok'); return; }
    const root = this.root;
    const btn = root.querySelector('[data-enter]:not(:disabled)');
    if (btn) btn.click();
  }

  askConfirm(c) {
    this.confirm = c;
    this.confirmRoot.innerHTML = `<div class="backdrop" data-act="confirm-cancel"><div class="modal narrow" role="alertdialog" aria-modal="true"><div class="modal-head"><h2>${esc(c.title)}</h2></div><div class="modal-body"><p>${esc(c.text)}</p></div><div class="modal-foot"><button class="btn" data-act="confirm-cancel">Cancel</button><button class="btn ${c.danger ? 'danger' : 'primary'}" data-act="confirm-ok">${esc(c.ok)}</button></div></div></div>`;
    this.g.modalOpen = true;
  }
  closeConfirm() { this.confirm = null; this.confirmRoot.innerHTML = ''; this.g.modalOpen = !!this.modal; }

  renderModal(resetScroll) {
    const name = this.modal; if (!name) return;
    const fn = this['screen_' + name]; if (!fn) return;
    const old = this.root.querySelector('.modal-body');
    const scroll = old && !resetScroll ? old.scrollTop : 0;
    const sc = fn.call(this);
    const tabs = sc.tabs ? `<div class="tabs" role="tablist">${sc.tabs.map(t => `<button class="tab ${t.id === sc.tab ? 'active' : ''}" role="tab" data-act="tab" data-arg="${t.id}">${esc(t.label)}${t.badge ? `<i class="badge">${t.badge}</i>` : ''}</button>`).join('')}</div>` : '';
    const first = this._shown !== name; this._shown = name;
    this.root.innerHTML = `<div class="backdrop ${first ? 'anim' : ''}" data-act="backdrop"><div class="modal ${first ? 'anim' : ''} ${sc.cls || ''}" role="dialog" aria-modal="true" aria-label="${esc(sc.title)}">
      <div class="modal-head"><h2>${esc(sc.title)}</h2>${sc.sub ? `<span class="sub">${sc.sub}</span>` : ''}${sc.noClose ? '' : '<button class="x-btn" data-act="close" aria-label="Close">&times;</button>'}</div>
      ${tabs}<div class="modal-body">${sc.body}</div>${sc.foot ? `<div class="modal-foot">${sc.foot}</div>` : ''}</div></div>`;
    const nb = this.root.querySelector('.modal-body'); if (nb) nb.scrollTop = scroll;
    this.paintIcons(this.root);
    if (name === 'map') this.startMap();
  }

  paintIcons(root) {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    root.querySelectorAll('canvas[data-k]').forEach(cv => {
      const w = +cv.dataset.w, h = +cv.dataset.h; cv.width = w * dpr; cv.height = h * dpr; cv.style.width = w + 'px'; cv.style.height = h + 'px';
      const ctx = cv.getContext('2d'); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const k = cv.dataset.k, id = cv.dataset.id;
      if (k === 'fish') { const sp = SPECIES_BY_ID[id]; drawFish(ctx, sp, { x: w / 2, y: h / 2, size: Math.min(w * 0.76, h * 0.98), t: 0.6, sil: cv.dataset.sil === '1', variant: cv.dataset.v === '1' }); }
      else if (k === 'loot') drawLoot(ctx, id, w / 2, h / 2, Math.min(w, h) * 0.85, 0.5);
      else if (k === 'gear') drawGear(ctx, cv.dataset.cat, +cv.dataset.idx, w / 2, h / 2, Math.min(w, h) * 0.9, 0.5, { color: cv.dataset.color });
      else if (k === 'boat') { const m = BOAT_META[+id], sc = Math.min(w / (m.w * 1.12), h / (m.h * 6.2)); ctx.translate(w / 2, h * 0.8); ctx.scale(sc, sc); drawBoat(ctx, +id, { t: 0.5 }); }
      else if (k === 'pet') { ctx.translate(w / 2, h * 0.9); const sc = h / 62; ctx.scale(sc, sc); drawPet(ctx, id, { t: 0.7 }); }
    });
  }

  // ---------- shared fragments ----------
  rarTag(rid) { const R = RARITY[rid]; return `<span class="tag" style="color:${R.color};border-color:${R.color}">${R.name}</span>`; }
  harborBanner(text) {
    if (this.g.inHarbor) return '';
    return `<div class="banner"><span>${text}</span><button class="btn small primary" data-act="harbor">Go to Harbor</button></div>`;
  }

  // ---------- SHOP ----------
  screen_shop() {
    const g = this.g, s = g.state, harbor = g.inHarbor;
    const tab = this.tabs.shop || 'rod';
    const tabs = [['rod', 'Rods'], ['line', 'Lines'], ['hook', 'Hooks'], ['bait', 'Baits'], ['boat', 'Boats'], ['boost', 'Boosts']].map(([id, label]) => ({ id, label }));
    let body = this.harborBanner('You can browse the shop anywhere, but you can only buy things at the harbor.');
    if (tab === 'bait') body += `<div class="grid c2">${BAITS.map(b => this.baitCard(b)).join('')}</div>`;
    else if (tab === 'boost') body += `<p class="muted">Boosts are short and optional. Buying one again only refreshes it, so they never stack. Nothing here is required to finish the game.</p><div class="grid c2">${BOOSTS.map(b => this.boostCard(b)).join('')}</div>`;
    else body += `<div class="grid c2">${CATS[tab].map((_, i) => this.tierCard(tab, i)).join('')}</div>`;
    return { title: 'Tackle Shop', sub: `<span class="price">${fmt(s.coins)} coins</span>`, tabs, tab, body };
  }
  tierCard(cat, idx) {
    const g = this.g, s = g.state, def = CATS[cat][idx], owned = s.owned[cat].includes(idx), eq = s.equipped[cat] === idx;
    const next = maxOwned(s, cat) + 1 === idx, cur = CATS[cat][s.equipped[cat]], harbor = g.inHarbor, z = g.zone;
    const sgn = n => (n > 0 ? '+' : '') + n;
    let ben = [];
    if (cat === 'rod') { ben.push(`Bite time <b>-${Math.round(def.biteRed * 100)}%</b>${idx !== s.equipped.rod ? ` <span class="muted">(${sgn(Math.round((def.biteRed - cur.biteRed) * 100))}% vs equipped)</span>` : ''}`); ben.push(`Special: ${esc(def.special)}`); }
    if (cat === 'line') { ben.push(`Reach <b>${Math.round(def.maxDepth * 100)}%</b> of the water depth (${Math.round(def.maxDepth * z.depthM)} m in ${esc(z.name)})`); if (idx !== s.equipped.line) ben.push(`<span class="muted">${sgn(Math.round((def.maxDepth - cur.maxDepth) * 100))}% depth vs equipped</span>`); const zs = ZONES.filter(zz => zz.req.line === idx).map(zz => zz.name); if (zs.length) ben.push(`Helps unlock: ${esc(zs.join(', '))}`); }
    if (cat === 'hook') { const sz = ['', '', '≈5 kg', '≈20 kg', '≈60 kg', '≈200 kg', '≈600 kg', 'any size'][def.cap]; ben.push(`Fish up to size class <b>${def.cap}</b> (${sz} average)`); ben.push(def.sizeBonus ? `Fish are ${Math.round(def.sizeBonus * 100)}% larger on average` : 'No size bonus'); const zs = ZONES.filter(zz => zz.req.hook === idx).map(zz => zz.name); if (zs.length) ben.push(`Helps unlock: ${esc(zs.join(', '))}`); }
    if (cat === 'boat') { ben.push(`Cargo: <b>${def.cap}</b> items${idx !== s.equipped.boat ? ` <span class="muted">(${sgn(def.cap - cur.cap)})</span>` : ''}`); ben.push(`Speed: <b>${Math.round(def.speed * 100)}%</b>`); const zs = ZONES.filter(zz => zz.req.boat === idx).map(zz => zz.name); if (zs.length) ben.push(`Opens the way to: ${esc(zs.join(', '))}`); }
    let btn;
    if (eq) btn = `<button class="btn" disabled>Equipped</button>`;
    else if (owned) btn = `<button class="btn primary" data-act="equip-tier" data-arg="${cat}:${idx}">Equip</button>`;
    else if (next) { const can = s.coins >= def.price && harbor; btn = `<button class="btn ${can ? 'gold' : ''}" data-act="buy-tier" data-arg="${cat}:${idx}" ${can ? '' : 'disabled'}>Buy &middot; ${fmt(def.price)}</button>`; }
    else btn = `<button class="btn" disabled>Locked: buy the previous one first</button>`;
    const art = cat === 'boat' ? iconBox('boat', idx, 120, 76, {}) : iconBox('gear', cat + idx, 76, 76, { cat, idx, color: def.color });
    return `<div class="card ${eq ? 'equipped' : ''} ${!owned && !next ? 'locked' : ''} ${!owned && next ? (s.coins >= def.price ? 'can' : 'poor') : ''}"><div class="row top">${art}<div class="grow col gap4"><h3>${esc(def.name)}</h3><p>${esc(def.desc)}</p>${ben.map(b => `<div class="small">${b}</div>`).join('')}<div class="row spread wrap" style="margin-top:6px"><span class="tag" style="color:${eq ? '#3f8a4f' : owned ? '#3b82c4' : '#8a6a44'}">${eq ? 'Equipped' : owned ? 'Owned' : (def.price ? fmt(def.price) + ' coins' : 'Free')}</span>${btn}</div></div></div></div>`;
  }
  baitCard(b) {
    const g = this.g, s = g.state, owned = s.owned.bait.includes(b.id), eq = s.equipped.bait === b.id;
    const targets = SPECIES.filter(sp => sp.bait.includes(b.cat));
    const zs = [...new Set(targets.map(sp => ZONE_BY_ID[sp.zone].name))];
    const known = targets.filter(sp => s.book[sp.id]).map(sp => sp.name), unk = targets.length - known.length;
    let btn;
    if (eq) btn = `<button class="btn" disabled>Equipped</button>`;
    else if (owned) btn = `<button class="btn primary" data-act="equip-bait" data-arg="${b.id}">Equip</button>`;
    else { const can = s.coins >= b.price && g.inHarbor; btn = `<button class="btn ${can ? 'gold' : ''}" data-act="buy-bait" data-arg="${b.id}" ${can ? '' : 'disabled'}>Buy &middot; ${fmt(b.price)}</button>`; }
    return `<div class="card ${eq ? 'equipped' : ''} ${!owned ? (s.coins >= b.price ? 'can' : 'poor') : ''}"><div class="row top">${iconBox('gear', 'bait' + b.id, 72, 72, { cat: 'bait', idx: 0, color: b.color })}<div class="grow col gap4"><h3>${esc(b.name)}</h3><p>${esc(b.desc)}</p>
      <div class="small"><b>Suited for:</b> ${zs.map(z => `<span class="tag" style="color:#2f7a90">${esc(z)}</span>`).join(' ')}</div>
      <div class="small"><b>Attracts:</b> ${known.length ? esc(known.join(', ')) : 'no known species yet'}${unk ? ` <span class="muted">+ ${unk} not yet discovered</span>` : ''}</div>
      <div class="row spread" style="margin-top:6px"><span class="tag" style="color:${owned ? '#3b82c4' : '#8a6a44'}">${owned ? 'Owned' : (b.price ? fmt(b.price) + ' coins' : 'Free')}</span>${btn}</div></div></div></div>`;
  }
  boostCard(b) {
    const g = this.g, s = g.state, price = boostPrice(s, b), left = s.boosts[b.id] || 0;
    const blocked = left > b.duration * 0.5, can = s.coins >= price && g.inHarbor && !blocked;
    return `<div class="card ${left ? 'equipped' : s.coins >= price ? 'can' : 'poor'}"><div class="row top">${iconBox('gear', 'boost' + b.id, 64, 64, { cat: 'boost', idx: 0, color: ['#8ad0e8', '#e8c15a', '#9ad89a', '#c8a8f0', '#f0a080', '#e8b0c8'][BOOSTS.indexOf(b)] })}<div class="grow col gap4"><h3>${esc(b.name)}</h3><p>${esc(b.desc)}</p><div class="small">Lasts <b>${fmtT(b.duration)}</b> of play time</div>
      <div class="row spread" style="margin-top:6px"><span class="tag" style="color:${left ? '#3f8a4f' : '#8a6a44'}">${left ? 'Active ' + fmtT(left) : fmt(price) + ' coins'}</span><button class="btn ${can ? 'gold' : ''}" data-act="buy-boost" data-arg="${b.id}" ${can ? '' : 'disabled'}>${left ? 'Refresh' : 'Activate'} &middot; ${fmt(price)}</button></div></div></div></div>`;
  }

  // ---------- CARGO ----------
  screen_cargo() {
    const g = this.g, s = g.state, harbor = g.inHarbor;
    const uids = new Set(s.cargo.map(i => i.uid));
    for (const u of [...this.sel]) if (!uids.has(u)) this.sel.delete(u);
    if (this.inspect !== null && !uids.has(this.inspect)) this.inspect = null;
    const items = [...s.cargo].sort((a, b) => this.rank(b) - this.rank(a) || b.value - a.value);
    const n = items.length, c = inventory.capacity(s);
    const selTotal = inventory.expectedValue(s, [...this.sel]), allTotal = inventory.expectedValue(s);
    const rows = items.map(it => this.cargoRow(it)).join('') || `<div class="card"><p>Your cargo hold is empty. Cast a line and see what the sea offers!</p></div>`;
    const full = n >= c;
    const banner = !harbor ? `<div class="banner ${full ? 'bad' : ''}"><span>${full ? '<b>Cargo is full!</b> You cannot cast until you sell.' : 'Fish can only be sold at the harbor.'}</span><button class="btn small primary" data-act="harbor">Go to Harbor</button></div>` : '';
    const body = `${banner}<div class="row spread" style="margin-bottom:8px"><div class="grow"><div class="prog"><i style="width:${(n / c) * 100}%"></i></div></div><b>${n} / ${c} slots</b></div>
      <div class="cargo-layout"><div class="col gap8">${rows}</div><div class="detail">${this.cargoDetail()}</div></div>`;
    const foot = `<button class="btn small ghost" data-act="sel-all">Select all</button><button class="btn small ghost" data-act="sel-none">Clear</button>
      <button class="btn" data-act="sell-junk" ${harbor && s.cargo.some(i => i.kind === 'junk' && !i.fav) ? '' : 'disabled'}>Sell junk</button>
      <button class="btn" data-act="sell-sel" ${harbor && this.sel.size ? '' : 'disabled'}>Sell selected (${this.sel.size}) &middot; ${fmt(selTotal)}</button>
      <button class="btn gold" data-enter data-act="sell-all" ${harbor && allTotal > 0 ? '' : 'disabled'}>Sell all &middot; ${fmt(allTotal)}</button>`;
    return { title: 'Cargo Hold', sub: `${n}/${c} items`, body, foot };
  }
  rank(it) { return it.kind === 'fish' ? RARITY[SPECIES_BY_ID[it.id].rarity].index : it.kind === 'treasure' ? 2 : 0; }
  itemInfo(it) {
    if (it.kind === 'fish') { const sp = SPECIES_BY_ID[it.id]; return { name: sp.name, rar: sp.rarity, sp }; }
    const d = LOOT_BY_ID[it.id]; return { name: d.name, rar: it.kind === 'treasure' ? 'rare' : 'common', def: d };
  }
  cargoRow(it) {
    const inf = this.itemInfo(it), sel = this.sel.has(it.uid);
    const art = it.kind === 'fish' ? canvasHTML('fish', it.id, 64, 42, it.variant ? { v: 1 } : {}) : canvasHTML('loot', it.id, 64, 42);
    const sub = it.kind === 'fish' ? `${fmtW(it.w)} &middot; ${fmtL(it.l)}${it.variant ? ' &middot; <b style="color:#c0508a">Prismatic</b>' : ''}` : (it.kind === 'treasure' ? 'Treasure' : 'Junk');
    return `<div class="item-row ${sel ? 'sel' : ''} ${it.fav ? 'fav' : ''}" data-act="inspect" data-arg="${it.uid}"><input type="checkbox" data-sel="${it.uid}" ${sel ? 'checked' : ''} ${it.fav ? 'disabled' : ''} aria-label="Select ${esc(inf.name)}"><div class="ic-wrap" style="width:72px;height:50px">${art}</div>
      <div class="grow"><b>${esc(inf.name)}</b> ${this.rarTag(inf.rar)}<div class="muted">${sub}</div></div><div class="price">${fmt(saleValue(this.g.state, it))}</div>
      <button class="star-btn ${it.fav ? 'on' : ''}" data-act="fav" data-arg="${it.uid}" title="${it.fav ? 'Protected from sale' : 'Protect from sale'}" aria-label="Toggle favorite">&#9733;</button></div>`;
  }
  cargoDetail() {
    const s = this.g.state, it = s.cargo.find(i => i.uid === this.inspect);
    if (!it) return `<div class="card"><p class="muted">Click an item to inspect it. Use the star to protect special catches from being sold by accident.</p></div>`;
    const inf = this.itemInfo(it), R = RARITY[inf.rar], harbor = this.g.inHarbor;
    let kv = '';
    if (it.kind === 'fish') {
      const b = s.book[it.id] || {};
      kv = `<dt>Weight</dt><dd>${fmtW(it.w)}</dd><dt>Length</dt><dd>${fmtL(it.l)}</dd><dt>Caught in</dt><dd>${esc(ZONE_BY_ID[it.zone] ? ZONE_BY_ID[it.zone].name : '?')}</dd><dt>Record weight</dt><dd>${fmtW(b.recW || it.w)}</dd><dt>Times caught</dt><dd>${b.caught || 1}</dd>`;
    } else kv = `<dt>Found in</dt><dd>${esc(ZONE_BY_ID[it.zone] ? ZONE_BY_ID[it.zone].name : '?')}</dd>`;
    const big = it.kind === 'fish' ? canvasHTML('fish', it.id, 230, 140, it.variant ? { v: 1 } : {}) : canvasHTML('loot', it.id, 230, 140);
    return `<div class="card"><div class="big"><div class="ic-wrap" style="width:238px;height:148px">${big}</div></div><h3 style="text-align:center;color:${R.color}">${esc(inf.name)}</h3><div style="text-align:center">${this.rarTag(inf.rar)}${it.fav ? ' <span class="tag" style="color:#c8962a">Protected</span>' : ''}</div>
      ${inf.def ? `<p>${esc(inf.def.desc)}</p>` : ''}<dl class="kv" style="margin-top:8px">${kv}<dt>Sale value</dt><dd class="price">${fmt(saleValue(s, it))} coins</dd></dl>
      <div class="row wrap" style="margin-top:10px;justify-content:center">${inf.def && inf.def.openable ? `<button class="btn small gold" data-act="open-bottle" data-arg="${it.uid}">Open bottle</button>` : ''}<button class="btn small" data-act="fav" data-arg="${it.uid}">${it.fav ? 'Unprotect' : 'Protect'}</button><button class="btn small primary" data-act="sell-one" data-arg="${it.uid}" ${harbor && !it.fav ? '' : 'disabled'}>Sell this</button></div></div>`;
  }

  // ---------- FISH BOOK ----------
  screen_book() {
    const g = this.g, s = g.state, tab = this.tabs.book || 'species';
    const tp = book.totalProgress(s), cl = book.claimableCount(s);
    const tabs = [{ id: 'species', label: 'Species' }, { id: 'milestones', label: 'Milestones', badge: cl || '' }];
    const head = `<div class="row spread" style="margin-bottom:10px"><div class="grow"><div class="prog gold"><i style="width:${tp.pct}%"></i></div></div><b>${tp.have}/${tp.total} species (${Math.floor(tp.pct)}%)</b></div>`;
    let body = head;
    if (tab === 'milestones') body += this.milestonesHTML();
    else {
      const zbars = `<div class="zone-bars">${ZONES.map(z => { const p = book.zoneProgress(s, z.id); return `<div class="zone-bar ${this.bf.zone === z.id ? 'sel' : ''}" data-act="book-zone" data-arg="${z.id}">${esc(z.name)}<div class="prog" style="margin-top:4px"><i style="width:${p.pct}%"></i></div><span class="muted">${p.have}/${p.total}</span></div>`; }).join('')}</div>`;
      const opt = (id, label, cur) => `<option value="${id}" ${cur === id ? 'selected' : ''}>${label}</option>`;
      const filters = `<div class="filters"><label>Zone <select data-filter="zone">${opt('all', 'All zones', this.bf.zone)}${ZONES.map(z => opt(z.id, z.name, this.bf.zone)).join('')}</select></label>
        <label>Rarity <select data-filter="rar">${opt('all', 'All rarities', this.bf.rar)}${RARITY_IDS.map(r => opt(r, RARITY[r].name, this.bf.rar)).join('')}</select></label>
        <label>Show <select data-filter="stat">${opt('all', 'All', this.bf.stat)}${opt('found', 'Discovered', this.bf.stat)}${opt('unfound', 'Undiscovered', this.bf.stat)}</select></label>
        <label>Sort <select data-filter="sort">${opt('default', 'Zone order', this.bf.sort)}${opt('name', 'Name', this.bf.sort)}${opt('rarity', 'Rarity', this.bf.sort)}${opt('weight', 'Largest weight', this.bf.sort)}${opt('value', 'Highest value', this.bf.sort)}</select></label></div>`;
      let list = SPECIES.filter(sp => (this.bf.zone === 'all' || sp.zone === this.bf.zone) && (this.bf.rar === 'all' || sp.rarity === this.bf.rar) && (this.bf.stat === 'all' || (this.bf.stat === 'found') === !!s.book[sp.id]));
      const rec = (sp, k) => (s.book[sp.id] ? s.book[sp.id][k] : -1);
      const sorters = { name: (a, b) => a.name.localeCompare(b.name), rarity: (a, b) => RARITY[b.rarity].index - RARITY[a.rarity].index, weight: (a, b) => rec(b, 'recW') - rec(a, 'recW'), value: (a, b) => rec(b, 'recV') - rec(a, 'recV') };
      if (sorters[this.bf.sort]) list.sort(sorters[this.bf.sort]);
      if (!this.bookSel || !list.some(sp => sp.id === this.bookSel)) this.bookSel = list.length ? list[0].id : null;
      const cards = list.map(sp => { const d = !!s.book[sp.id]; return `<div class="fish-card ${d ? '' : 'undisc'} ${this.bookSel === sp.id ? 'sel' : ''}" data-act="book-sel" data-arg="${sp.id}"><i class="rar-dot" style="background:${RARITY[sp.rarity].color}"></i><div class="ic-wrap ${d ? '' : 'sil'}" style="width:96px;height:62px">${canvasHTML('fish', sp.id, 90, 56, d ? {} : { sil: 1 })}</div><div class="nm">${d ? esc(sp.name) : '???'}</div></div>`; }).join('');
      body += `${zbars}${filters}<div class="book-layout"><div class="grid c3" style="grid-template-columns:repeat(auto-fill,minmax(112px,1fr))">${cards || '<p class="muted">No species match these filters.</p>'}</div><div class="detail">${this.bookDetail()}</div></div>`;
    }
    return { title: 'Fish Book', sub: `${tp.have}/${tp.total} discovered`, tabs, tab, body, cls: '' };
  }
  bookDetail() {
    const s = this.g.state, sp = SPECIES_BY_ID[this.bookSel];
    if (!sp) return '';
    const b = s.book[sp.id], R = RARITY[sp.rarity], z = ZONE_BY_ID[sp.zone];
    const art = `<div class="big"><div class="ic-wrap ${b ? '' : 'sil'}" style="width:238px;height:156px">${canvasHTML('fish', sp.id, 230, 148, b ? {} : { sil: 1 })}</div></div>`;
    if (!b) {
      const rumor = book.describeReq(sp);
      return `<div class="card">${art}<h3 style="text-align:center">???</h3><div style="text-align:center">${this.rarTag(sp.rarity)}</div><dl class="kv" style="margin-top:8px"><dt>Native zone</dt><dd>${esc(z.name)}</dd><dt>Depth</dt><dd>Unknown</dd><dt>Size</dt><dd>Unknown</dd></dl><p class="muted">You haven't caught this species yet.${rumor ? ` <b>Rumor:</b> it ${esc(rumor)}.` : ''}</p></div>`;
    }
    const baits = BAITS.filter(x => sp.bait.includes(x.cat)).map(x => x.name);
    const req = book.describeReq(sp);
    return `<div class="card">${art}<h3 style="text-align:center;color:${R.color}">${esc(sp.name)}</h3><div style="text-align:center">${this.rarTag(sp.rarity)}</div>
      <dl class="kv" style="margin-top:8px"><dt>Native zone</dt><dd>${esc(z.name)}</dd><dt>Depth</dt><dd>${sp.depths.map(d => LAYER_NAMES[d]).join(', ')}</dd><dt>Weight range</dt><dd>${fmtW(sp.wMin)} &ndash; ${fmtW(sp.wMax)}</dd><dt>Length range</dt><dd>${fmtL(sp.lMin)} &ndash; ${fmtL(sp.lMax)}</dd>
      <dt>Number caught</dt><dd>${b.caught}</dd><dt>Record weight</dt><dd>${fmtW(b.recW)}</dd><dt>Record length</dt><dd>${fmtL(b.recL)}</dd><dt>Best sale value</dt><dd class="price">${fmt(b.recV)}</dd><dt>Base value</dt><dd>${fmt(sp.baseValue)}</dd></dl>
      <p class="small"><b>Likes:</b> ${esc(baits.join(', '))}</p>${req ? `<p class="small"><b>Note:</b> this fish ${esc(req)}.</p>` : ''}<p class="small muted">Hook size class ${sp.size} needed.</p></div>`;
  }
  milestonesHTML() {
    const s = this.g.state, ms = book.allMilestones(s);
    const group = (title, list) => `<h4>${esc(title)}</h4><div class="col gap8">${list.map(m => `<div class="ms ${m.ready && !m.claimed ? 'ready' : ''} ${m.claimed ? 'done' : ''}"><div class="grow"><b>${m.pct}% complete</b><div class="muted">${esc(m.reward.text)}</div></div>${m.claimed ? '<span class="tag" style="color:#3f8a4f">Claimed</span>' : `<button class="btn small ${m.ready ? 'gold' : ''}" data-act="claim-ms" data-arg="${m.id}" ${m.ready ? '' : 'disabled'}>${m.ready ? 'Claim' : 'Locked'}</button>`}</div>`).join('')}</div>`;
    const ready = ms.filter(m => m.ready && !m.claimed).length;
    return `<div class="row spread"><p class="muted">Fill your fish book to earn rewards. Each reward can be claimed once.</p><button class="btn gold" data-act="claim-all" ${ready ? '' : 'disabled'}>Claim all (${ready})</button></div>` +
      group('Whole Fish Book', ms.filter(m => m.scope === 'all')) + ZONES.map(z => { const p = book.zoneProgress(s, z.id); return group(`${z.name} (${p.have}/${p.total})`, ms.filter(m => m.scope === z.id)); }).join('');
  }

  // ---------- PETS ----------
  screen_pets() {
    const g = this.g, s = g.state, tab = this.tabs.pets || 'pets';
    const tabs = [{ id: 'pets', label: 'Companions' }, { id: 'deco', label: 'Boat & Titles' }];
    let body = '';
    if (tab === 'pets') {
      body += `<p class="muted">One companion joins you at a time. Each gives a small passive bonus.</p><div class="grid c2">${PETS.map(p => {
        const own = s.pets.owned.includes(p.id), act = s.pets.active === p.id;
        let btn;
        if (act) btn = `<button class="btn" data-act="pet-select" data-arg="none">Send home</button>`;
        else if (own) btn = `<button class="btn primary" data-act="pet-select" data-arg="${p.id}">Choose</button>`;
        else if (p.unlock.type === 'buy') { const can = s.coins >= p.unlock.price && g.inHarbor; btn = `<button class="btn ${can ? 'gold' : ''}" data-act="pet-buy" data-arg="${p.id}" ${can ? '' : 'disabled'}>Adopt &middot; ${fmt(p.unlock.price)}</button>`; }
        else btn = `<button class="btn" disabled>Locked</button>`;
        return `<div class="card ${act ? 'equipped' : ''} ${own ? '' : (p.unlock.type === 'buy' ? (s.coins >= p.unlock.price ? 'can' : 'poor') : 'locked')}"><div class="row top"><div class="ic-wrap" style="width:92px;height:92px">${canvasHTML('pet', p.id, 84, 84)}</div><div class="grow col gap4"><h3>${esc(p.name)}</h3><p>${esc(p.blurb)}</p><div class="small"><b>Bonus:</b> ${esc(p.bonusText)}</div><div class="small muted">${own ? (act ? 'Currently with you' : 'Unlocked') : esc(p.req)}</div><div style="margin-top:6px">${btn}</div></div></div></div>`;
      }).join('')}</div>`;
    } else {
      const decos = book.DECOS;
      body += `<h4 style="margin-top:0">Boat decorations</h4><p class="muted">Pennants earned from 75% zone completion fly from your boat's bow.</p><div class="grid c3"><div class="card ${!s.cosmetics.active ? 'equipped' : ''}"><b>Default pennant</b><div style="margin-top:8px"><button class="btn small" data-act="deco-select" data-arg="none" ${!s.cosmetics.active ? 'disabled' : ''}>${!s.cosmetics.active ? 'In use' : 'Use'}</button></div></div>${decos.map(d => { const own = s.cosmetics.owned.includes(d.id); return `<div class="card ${s.cosmetics.active === d.id ? 'equipped' : ''} ${own ? '' : 'locked'}"><div class="row"><span style="width:26px;height:18px;background:${d.color};border:2px solid ${INK};border-radius:3px 9px 9px 3px;display:inline-block"></span><b>${esc(d.name)}</b></div><div style="margin-top:8px">${own ? `<button class="btn small" data-act="deco-select" data-arg="${d.id}" ${s.cosmetics.active === d.id ? 'disabled' : ''}>${s.cosmetics.active === d.id ? 'In use' : 'Use'}</button>` : '<span class="muted">75% of ' + esc(ZONE_BY_ID[d.zone].name) + '</span>'}</div></div>`; }).join('')}</div>
        <h4>Titles</h4><div class="grid c3"><div class="card"><b>No title</b><div style="margin-top:8px"><button class="btn small" data-act="title-select" data-arg="none" ${!s.cosmetics.title ? 'disabled' : ''}>Use</button></div></div>${Object.entries(book.ALL_TITLES).map(([id, name]) => { const own = s.cosmetics.titles.includes(id); return `<div class="card ${s.cosmetics.title === id ? 'equipped' : ''} ${own ? '' : 'locked'}"><b>${own ? esc(name) : '???'}</b><div style="margin-top:8px">${own ? `<button class="btn small" data-act="title-select" data-arg="${id}" ${s.cosmetics.title === id ? 'disabled' : ''}>${s.cosmetics.title === id ? 'In use' : 'Use'}</button>` : '<span class="muted">Earn through the Fish Book</span>'}</div></div>`; }).join('')}</div>`;
    }
    return { title: 'Companions', sub: `${s.pets.owned.length}/${PETS.length} found`, tabs, tab, body };
  }

  // ---------- QUESTS ----------
  screen_quests() {
    const g = this.g, s = g.state, harbor = g.inHarbor, Q = s.quests, max = CONFIG.quests.maxActive;
    const card = (q, active) => {
      const pct = Math.min(100, (q.progress / q.goal) * 100), r = q.reward;
      const rew = `<b class="price">${fmt(r.coins || 0)} coins</b>${r.bait ? ` + ${esc(r.baitName)}` : ''}${r.clue ? ' + a secret clue' : ''}`;
      let btns;
      if (active) btns = q.done ? `<button class="btn gold" data-enter data-act="q-claim" data-arg="${q.id}" ${harbor ? '' : 'disabled'}>Claim reward</button>` : `<button class="btn small ghost" data-act="q-abandon" data-arg="${q.id}">Drop</button>`;
      else btns = `<button class="btn primary" data-act="q-accept" data-arg="${q.id}" ${harbor && Q.active.length < max ? '' : 'disabled'}>Accept</button>`;
      return `<div class="card ${q.done ? 'equipped' : ''}"><div class="row top"><div class="grow col gap4"><h3>${esc(q.title)}</h3><p>${esc(q.desc)}</p>${active ? `<div class="prog"><i style="width:${pct}%"></i></div><div class="small muted">${q.progress}/${q.goal}${q.done ? ' &middot; Complete!' : ''}</div>` : ''}<div class="small">Reward: ${rew}</div></div><div>${btns}</div></div></div>`;
    };
    const slots = Array.from({ length: max }, (_, i) => Q.active[i] ? card(Q.active[i], true) : `<div class="card locked"><p class="muted" style="text-align:center;margin:18px 0">Empty slot. Accept a request below.</p></div>`).join('');
    const body = `${this.harborBanner('Visit the harbor to accept or claim requests. Progress counts while you fish.')}<h4 style="margin-top:0">Active requests (${Q.active.length}/${max})</h4><div class="grid c2">${slots}</div>
      <h4>Request board</h4><div class="grid c2">${Q.board.map(q => card(q, false)).join('') || '<p class="muted">No requests right now.</p>'}</div>`;
    const foot = `<span class="muted">Requests never expire.</span><button class="btn" data-act="q-reroll" ${harbor && s.coins >= CONFIG.quests.rerollCost ? '' : 'disabled'}>New board &middot; ${CONFIG.quests.rerollCost} coins</button>`;
    return { title: 'Harbor Requests', sub: `${s.stats.requests} completed`, body, foot };
  }

  // ---------- STATS ----------
  screen_stats() {
    const g = this.g, s = g.state, st = s.stats, tp = book.totalProgress(s);
    const stat = (v, l) => `<div class="stat"><b>${v}</b><span>${l}</span></div>`;
    const bs = (k, fn) => st[k] ? `${fn(st[k].v)} <span class="muted">(${esc(SPECIES_BY_ID[st[k].id].name)})</span>` : 'None yet';
    const mins = Math.floor(st.playSeconds / 60);
    const rarStats = RARITY_IDS.map(r => `<div class="stat"><b style="color:${RARITY[r].color}">${st.rarity[r] || 0}</b><span>${RARITY[r].name} catches</span></div>`).join('');
    const sec = SECRETS.map(d => { const f = s.secrets.found[d.id], cl = s.secrets.clues.includes(d.id); return `<div class="card ${f ? 'equipped' : 'locked'}"><b>${f ? esc(d.name) : '???'}</b><p class="small">${f ? esc(d.clue) : esc(d.hint)}${!f && cl ? `<br><b>Clue:</b> ${esc(d.clue)}` : ''}</p></div>`; }).join('');
    const title = s.cosmetics.title ? book.ALL_TITLES[s.cosmetics.title] : null;
    const body = `${title ? `<p style="font:700 16px Georgia">Title: ${esc(title)}</p>` : ''}<div class="stat-grid">
      ${stat(fmt(st.fishCaught), 'Total fish caught')}${stat(fmt(st.fishSold), 'Total fish sold')}${stat(fmt(st.coinsEarned), 'Total coins earned')}${stat(fmt(st.coinsSpent), 'Total coins spent')}${stat(fmt(s.coins), 'Current coins')}
      ${stat(`${tp.have}/${tp.total}`, 'Species discovered')}${stat(`${Math.floor(tp.pct)}%`, 'Collection complete')}${stat(st.treasures, 'Treasures found')}${stat(st.junk, 'Junk recovered')}${stat(st.requests, 'Requests completed')}${stat(`${s.zonesUnlocked.length}/${ZONES.length}`, 'Zones unlocked')}${stat(`${mins} min`, 'Time at sea')}</div>
      <h4>Personal records</h4><div class="stat-grid">${stat(bs('bestW', fmtW), 'Largest fish (weight)')}${stat(bs('bestL', fmtL), 'Longest fish')}${stat(bs('bestV', v => fmt(v) + ' coins'), 'Highest-value catch')}</div>
      <h4>Catches by rarity</h4><div class="stat-grid">${rarStats}</div>
      <h4>Zone completion</h4><div class="stat-grid">${ZONES.map(z => { const p = book.zoneProgress(s, z.id); return `<div class="stat"><b>${Math.floor(p.pct)}%</b><span>${esc(z.name)} (${p.have}/${p.total})</span></div>`; }).join('')}</div>
      <h4>Secrets (${Object.keys(s.secrets.found).length}/${SECRETS.length})</h4><div class="grid c3">${sec}</div>`;
    const foot = `<span class="muted">Records are kept forever, even after you sell the fish.</span><button class="btn" data-act="prestige-open">Lighthouse (Prestige)</button>`;
    return { title: 'Records & Statistics', sub: `${fmt(st.coinsEarned)} coins earned`, body, foot };
  }

  // ---------- PRESTIGE ----------
  screen_prestige() {
    const s = this.g.state, pr = s.prestige, can = prestige.canPrestige(s), avail = prestige.starsAvailable(s);
    const reqs = prestige.requirements(s).map(r => `<div class="list-line ${r.ok ? 'ok' : 'no'} chk">${esc(r.text)}${r.need ? ` (${Math.min(r.now, r.need)}/${r.need})` : ''}</div>`).join('');
    const perks = CONFIG.prestige.perks.map(p => { const lvl = pr.perks[p.id] || 0, cost = lvl + 1, maxed = lvl >= p.max; return `<div class="card"><h3>${esc(p.name)} <span class="tag" style="color:#8a5bc4">Lv ${lvl}/${p.max}</span></h3><p>${esc(p.desc)}</p><button class="btn small gold" data-act="perk" data-arg="${p.id}" ${!maxed && avail >= cost ? '' : 'disabled'}>${maxed ? 'Maxed' : `Learn &middot; ${cost} star${cost > 1 ? 's' : ''}`}</button></div>`; }).join('');
    const body = `<p>The old lighthouse keeper offers you a fresh start: sail again from Pebble Cove with a little extra luck from the tides. This is entirely <b>optional</b>.</p>
      <div class="banner info"><span><b>Resets:</b> coins, gear, boats, bait, cargo, requests, boosts, unlocked zones.<br><b>Keeps:</b> fish book, records, stats, pets, secrets, decorations, titles, milestones, Tide Stars.</span></div>
      <h4>Requirements</h4>${reqs}<p style="margin-top:10px">Tide Stars you would earn now: <b>${prestige.starsGain(s)}</b> &middot; Total owned: <b>${pr.stars}</b> (${avail} to spend) &middot; Each star gives +${Math.round(CONFIG.prestige.saleBonusPerStar * 100)}% sale value permanently.</p>
      <h4>Tide perks</h4><div class="grid c2">${perks}</div>`;
    const foot = `<button class="btn danger" data-act="prestige-do" ${can ? '' : 'disabled'}>${can ? 'Begin a new voyage' : 'Not available yet'}</button>`;
    return { title: 'The Lighthouse', sub: `Tide Stars ${avail}`, cls: 'mid', body, foot };
  }

  // ---------- SETTINGS ----------
  screen_settings() {
    const st = this.g.state.settings;
    const sl = (k, label, mk) => `<div class="slider-row"><label for="s-${k}">${label}</label><input id="s-${k}" type="range" min="0" max="1" step="0.01" value="${st[k]}" data-setting="${k}"><span class="val">${Math.round(st[k] * 100)}%</span><label class="switch"><input type="checkbox" data-setting="${mk}" ${st[mk] ? 'checked' : ''}>Mute</label></div>`;
    const sw = (k, label) => `<label class="switch"><input type="checkbox" data-setting="${k}" ${st[k] ? 'checked' : ''}>${label}</label>`;
    const body = `<h4 style="margin-top:0">Audio</h4>${sl('music', 'Music', 'muteMusic')}${sl('ambient', 'Ambient', 'muteAmbient')}${sl('sfx', 'Effects', 'muteSfx')}${sw('muteAll', 'Mute everything')}
      <p class="muted">Audio starts after your first click or key press. The game works fine without sound.</p>
      <h4>Display</h4>${sw('guide', 'Show controls guide while fishing')}${sw('lowFx', 'Reduce particle effects (better performance)')}
      <h4>Save data</h4><p class="muted">Your game saves automatically in this browser. Export a backup file or move your save to another browser.</p>
      <div class="row wrap"><button class="btn" data-act="save-now">Save now</button><button class="btn" data-act="export">Download save file</button><button class="btn" data-act="copy-export">Copy save to clipboard</button><label class="btn" for="import-file">Import file...</label><input type="file" id="import-file" accept=".json,application/json,text/plain" class="hidden"></div>
      <div style="margin-top:10px"><textarea id="import-text" placeholder="Paste a save here, then press Import from text" aria-label="Import save text"></textarea><div style="margin-top:6px"><button class="btn small" data-act="import-text">Import from text</button></div></div>
      <h4>Danger zone</h4><button class="btn danger" data-act="reset">Erase all progress...</button>`;
    return { title: 'Settings', cls: 'mid', body };
  }
  doExport() {
    const txt = this.g.exportSave();
    const blob = new Blob([txt], { type: 'application/json' }), a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = 'little-tides-save.json'; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    this.toast('Save file downloaded.', 'good');
  }
  copyExport() {
    const txt = this.g.exportSave();
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(txt).then(() => this.toast('Save copied to clipboard.', 'good'), () => this.toast('Could not copy. Use Download instead.', 'warn'));
    else this.toast('Clipboard unavailable. Use Download instead.', 'warn');
  }
  doImport(text) {
    if (!text || !text.trim()) { this.toast('Paste a save first.', 'warn'); return; }
    this.askConfirm({ title: 'Replace your current game?', text: 'Importing replaces your current progress with the imported save.', ok: 'Import', danger: true, onOk: () => { const r = this.g.importSave(text); this.toast(r.msg, r.ok ? 'good' : 'warn'); if (r.ok) this.close(); } });
  }

  // ---------- PAUSE ----------
  screen_pause() {
    const g = this.g;
    const body = `<div class="col gap8" style="align-items:stretch"><button class="btn primary" data-enter data-act="resume">Resume</button>
      <button class="btn" data-act="open" data-arg="settings">Settings &amp; Audio</button><button class="btn" data-act="open" data-arg="map">World Map</button>
      <button class="btn" data-act="harbor">${g.inHarbor ? 'Set Sail' : 'Return to Harbor'}</button><button class="btn" data-act="save-now">Save game</button></div>
      <h4>Controls</h4><div class="small" style="line-height:2"><kbd>A</kbd>/<kbd>D</kbd> or <kbd>&larr;</kbd>/<kbd>&rarr;</kbd> steer the boat<br><kbd>W</kbd>/<kbd>S</kbd> or <kbd>&uarr;</kbd>/<kbd>&darr;</kbd> choose fishing depth<br><kbd>SPACE</kbd> cast the line (or dismiss a catch)<br><kbd>H</kbd> harbor &middot; <kbd>M</kbd> map &middot; <kbd>B</kbd> fish book &middot; <kbd>C</kbd> cargo &middot; <kbd>P</kbd> pets<br><kbd>ESC</kbd> close menus / pause &middot; <kbd>Enter</kbd> confirm</div>`;
    return { title: 'Paused', cls: 'narrow', body, noClose: false };
  }

  // ---------- INTRO ----------
  screen_intro() {
    const p = this.params.page || 0;
    const pages = [
      { t: 'Welcome to Little Tides', b: `<p>A small boat, a little rod and a big, gentle sea. Catch fish, sell them in the harbor, fill your fish book and sail to seven very different waters.</p><p class="muted">No rushing and no reflex tests. Cast your line, enjoy the view, and wait for the sea to answer.</p><div style="text-align:center;margin:10px 0">${iconBox('boat', 0, 220, 110, {})}</div>` },
      { t: 'How to fish', b: `<div class="small" style="line-height:2.2"><kbd>A</kbd><kbd>D</kbd> or <kbd>&larr;</kbd><kbd>&rarr;</kbd> steer the boat<br><kbd>W</kbd><kbd>S</kbd> or <kbd>&uarr;</kbd><kbd>&darr;</kbd> choose how deep to fish<br><kbd>SPACE</kbd> cast your line, then relax. Fish bite on their own<br><kbd>H</kbd> go to the harbor to sell your catch and shop<br><kbd>ESC</kbd> close menus or pause</div><p class="muted">When your cargo hold is full, head to the harbor, sell your catch and upgrade your gear.</p>` },
      { t: 'Your starter kit', b: `<div class="grid c2" style="margin-bottom:6px"><div class="card row">${iconBox('gear', 'r', 54, 54, { cat: 'rod', idx: 0, color: '#a87a4a' })}<div><b>Driftwood Rod</b><div class="muted small">Your trusty old rod</div></div></div><div class="card row">${iconBox('gear', 'l', 54, 54, { cat: 'line', idx: 0, color: '#e8dcc0' })}<div><b>Cotton Line</b><div class="muted small">Good for the shallows</div></div></div><div class="card row">${iconBox('gear', 'h', 54, 54, { cat: 'hook', idx: 0, color: '#aab4bc' })}<div><b>Bent Pin Hook</b><div class="muted small">Catches small fish</div></div></div><div class="card row">${iconBox('gear', 'b', 54, 54, { cat: 'bait', idx: 0, color: '#c98a8a' })}<div><b>Worm Bait</b><div class="muted small">Reusable. Never runs out</div></div></div></div><p>You also have the <b>Little Wooden Boat</b> and a <b>Harbor Cat</b>. You are starting in <b>Pebble Cove</b>. Good luck!</p>` },
    ];
    const pg = pages[Math.min(p, pages.length - 1)], last = p >= pages.length - 1;
    const foot = `<button class="btn ghost" data-act="intro-skip">Skip</button>${last ? '<button class="btn primary" data-enter data-act="intro-skip">Start fishing</button>' : '<button class="btn primary" data-enter data-act="intro-next">Next</button>'}`;
    return { title: pg.t, sub: `${p + 1} / ${pages.length}`, cls: 'mid', body: pg.b, foot, noClose: false };
  }

  // ---------- MAP ----------
  screen_map() {
    const g = this.g, s = g.state;
    const cards = ZONES.map((z, i) => {
      const un = s.zonesUnlocked.includes(z.id), p = book.zoneProgress(s, z.id), here = s.zone === z.id;
      const reqs = un ? '' : zoneRequirements(s, z).map(r => `<div class="list-line ${r.ok ? 'ok' : 'no'} chk">${esc(r.text)}</div>`).join('');
      return `<div class="card ${here ? 'equipped' : ''} ${un ? '' : 'locked'}" data-zone="${z.id}" id="zc-${z.id}"><div class="row spread"><h3>${esc(z.name)}</h3>${here ? '<span class="tag" style="color:#3f8a4f">You are here</span>' : un ? '' : '<span class="tag" style="color:#8a6a44">Locked</span>'}</div>
        <p>${un ? esc(z.blurb) : esc(z.hint)}</p>${un ? `<div class="small"><b>Discovered:</b> ${p.have}/${p.total} (${Math.floor(p.pct)}%)</div><div class="prog" style="margin:4px 0"><i style="width:${p.pct}%"></i></div><div class="small"><b>Suggested:</b> ${esc(z.suggested)}</div><div style="margin-top:8px"><button class="btn small primary" data-act="map-go" data-arg="${z.id}" ${here && !g.inHarbor ? 'disabled' : ''}>${here && !g.inHarbor ? 'Current zone' : 'Sail here'}</button></div>` : `<div style="margin-top:6px">${reqs}</div>`}</div>`;
    }).join('');
    const body = `<div class="map-layout"><div><canvas id="map-canvas" aria-label="World map. Click an unlocked island to sail there."></canvas><p class="muted small">Click an unlocked island to sail there. Locked islands show what they need.</p></div><div class="col gap8" style="max-height:60vh;overflow:auto;padding-right:4px">${cards}</div></div>`;
    return { title: 'World Map', sub: `${s.zonesUnlocked.length}/${ZONES.length} zones`, body };
  }
  startMap() {
    this.stopMap();
    const cv = document.getElementById('map-canvas'); if (!cv) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2), r = cv.getBoundingClientRect();
    cv.width = Math.round(r.width * dpr); cv.height = Math.round(r.height * dpr);
    this.mapT = 0;
    const pos = e => { const b = cv.getBoundingClientRect(); return { x: (e.clientX - b.left) / b.width, y: (e.clientY - b.top) / b.height }; };
    const hit = p => ZONES.find(z => Math.hypot((p.x - z.map.x) * 1.6, (p.y - z.map.y)) < z.map.r * 0.9);
    cv.onmousemove = e => { const z = hit(pos(e)); this.mapHover = z ? z.id : null; cv.style.cursor = z ? 'pointer' : 'default'; };
    cv.onmouseleave = () => { this.mapHover = null; };
    cv.onclick = e => {
      const z = hit(pos(e)); if (!z) return;
      if (this.g.state.zonesUnlocked.includes(z.id)) { this.act('map-go', z.id); } else {
        this.g.audio.sfx('error'); this.toast(z.hint, 'info', true);
        const card = document.getElementById('zc-' + z.id); if (card) card.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      }
    };
    const draw = () => { this.mapT += 0.06; this.drawMap(cv, dpr); };
    draw(); this.mapTimer = setInterval(draw, 60);
  }
  stopMap() { if (this.mapTimer) { clearInterval(this.mapTimer); this.mapTimer = null; } }
  drawMap(cv, dpr) {
    if (!document.body.contains(cv)) { this.stopMap(); return; }
    const ctx = cv.getContext('2d'), W = cv.width / dpr, H = cv.height / dpr, t = this.mapT, s = this.g.state;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const bg = ctx.createLinearGradient(0, 0, 0, H); bg.addColorStop(0, '#9ad8e2'); bg.addColorStop(1, '#4aa0b8'); ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = 'rgba(255,255,255,.3)'; ctx.lineWidth = 1.5;
    for (let i = 0; i < 18; i++) { const y = (i + 0.5) * H / 18; ctx.beginPath(); for (let x = 0; x <= W; x += 10) { const yy = y + Math.sin(x * 0.03 + t + i) * 3; x ? ctx.lineTo(x, yy) : ctx.moveTo(x, yy); } ctx.stroke(); }
    // dotted route
    ctx.setLineDash([4, 8]); ctx.strokeStyle = 'rgba(255,250,230,.7)'; ctx.lineWidth = 2.4; ctx.beginPath();
    ZONES.forEach((z, i) => { const x = z.map.x * W, y = z.map.y * H; i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }); ctx.stroke(); ctx.setLineDash([]);
    // compass
    ctx.save(); ctx.translate(W * 0.07, H * 0.14); ctx.strokeStyle = '#6a5a3a'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0, 0, 22, 0, TAU); ctx.stroke(); ctx.fillStyle = '#d8503a'; ctx.beginPath(); ctx.moveTo(0, -30); ctx.lineTo(6, 0); ctx.lineTo(-6, 0); ctx.fill(); ctx.fillStyle = '#f6ead0'; ctx.beginPath(); ctx.moveTo(0, 30); ctx.lineTo(6, 0); ctx.lineTo(-6, 0); ctx.fill(); ctx.restore();
    for (const z of ZONES) {
      const un = s.zonesUnlocked.includes(z.id), x = z.map.x * W, y = z.map.y * H, rr = z.map.r * W * 0.62, hov = this.mapHover === z.id, here = s.zone === z.id;
      ctx.save(); ctx.translate(x, y + Math.sin(t * 0.8 + z.tier) * 1.5);
      // sandy ring + island
      if (hov) { ctx.beginPath(); ctx.ellipse(0, rr * 0.2, rr * 1.5, rr * 0.7, 0, 0, TAU); ctx.fillStyle = 'rgba(255,255,255,.35)'; ctx.fill(); }
      if (un) {
        organic(ctx, 0, rr * 0.25, rr * 1.3, rr * 0.5, z.tier * 5, 10, 0.08); paint(ctx, '#f0e2b4', 2, '#8a7a4a');
        island(ctx, 0, rr * 0.3, rr * 2.2, rr * 1.2, z.map.shape === 'kelp' ? 'cliff' : z.map.shape, z.tier * 7, 0, 0);
        const p = book.zoneProgress(s, z.id); ctx.beginPath(); ctx.arc(0, -rr * 0.05, rr * 1.25, -Math.PI / 2, -Math.PI / 2 + TAU * p.pct / 100); ctx.lineWidth = 4; ctx.strokeStyle = '#e0a82a'; ctx.lineCap = 'round'; ctx.stroke();
      } else {
        organic(ctx, 0, rr * 0.25, rr * 1.3, rr * 0.5, z.tier * 5, 10, 0.08); paint(ctx, '#7a8a96', 2, '#3a4a58');
        ctx.beginPath(); ctx.moveTo(-rr, rr * 0.2); ctx.quadraticCurveTo(-rr * 0.2, -rr * 0.9, rr * 0.3, -rr * 0.5); ctx.quadraticCurveTo(rr, -rr * 0.2, rr, rr * 0.2); ctx.closePath(); paint(ctx, '#66757f', 2, '#3a4a58');
        ctx.fillStyle = '#f0f4f6'; ctx.font = `700 ${rr * 0.9}px Georgia`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('?', 0, -rr * 0.1);
        ctx.fillStyle = 'rgba(30,40,60,.65)'; ctx.beginPath(); ctx.roundRect(rr * 0.4, rr * 0.05, rr * 0.7, rr * 0.55, 4); ctx.fill(); ctx.strokeStyle = '#f0e8d0'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(rr * 0.75, rr * 0.05, rr * 0.2, Math.PI, 0); ctx.stroke();
      }
      // label
      ctx.font = `700 ${Math.max(11, W * 0.016)}px Georgia, serif`; const label = un ? z.name : '???'; const tw = ctx.measureText(label).width + 16;
      ctx.beginPath(); ctx.roundRect(-tw / 2, rr * 0.95, tw, Math.max(18, W * 0.026), 8); paint(ctx, hov ? '#fff8e0' : '#fbf3e0', 1.6, '#8a6a44'); ctx.fillStyle = un ? '#2b3a4d' : '#6a7a88'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(label, 0, rr * 0.95 + Math.max(18, W * 0.026) / 2);
      if (here) { ctx.save(); ctx.translate(0, -rr * 1.3 + Math.sin(t * 2) * 3); const sc = 0.22; ctx.scale(sc, sc); drawBoat(ctx, s.equipped.boat, { t }); ctx.restore(); }
      ctx.restore();
    }
  }

  // ---------- CATCH CARD ----------
  showCatch(info) {
    const box = document.getElementById('catch'), s = this.g.state;
    this.catchInfo = info; this.catchT = 0; this.catchVisible = true;
    const rid = info.rarity || 'common', R = RARITY[rid];
    let name, w = '', l = '', value, extra = '', badges = '';
    if (info.kind === 'fish') {
      name = info.sp.name; w = fmtW(info.item.w); l = fmtL(info.item.l); value = saleValue(s, info.item);
      if (info.isNew) badges += '<span class="badge-pill">NEW DISCOVERY!</span>';
      if (info.item.variant) badges += '<span class="badge-pill">PRISMATIC!</span>';
      if (info.newW) badges += '<span class="badge-pill rec">Weight record!</span>';
      if (info.newL) badges += '<span class="badge-pill rec">Length record!</span>';
      if (info.newV) badges += '<span class="badge-pill rec">Value record!</span>';
    } else if (info.kind === 'fragment') { name = info.name; value = 0; extra = '<div class="hintline">A piece of an old chart. It was added to your secrets.</div>'; }
    else { const d = LOOT_BY_ID[info.item.id]; name = d.name; value = saleValue(s, info.item); extra = `<div class="hintline">${esc(d.desc)}</div>`; }
    box.innerHTML = `<div class="catch-card ${rid}" style="--rc:${R.color}" data-act="dismiss-catch"><canvas id="catch-cv"></canvas><div class="badges">${badges}</div><div class="rar">${info.kind === 'fish' ? R.name : info.kind === 'treasure' ? 'Treasure' : info.kind === 'junk' ? 'Junk' : 'Secret'}</div><div class="nm">${esc(name)}</div>
      ${info.kind === 'fish' ? `<div class="meta"><span>${w}<small>Weight</small></span><span>${l}<small>Length</small></span></div>` : ''}${info.kind !== 'fragment' ? `<div class="value">${fmt(value)} coins</div>` : ''}${extra}<div class="hintline">Click or press SPACE to continue</div></div>`;
    box.classList.remove('hidden');
    box.style.animation = 'none'; void box.offsetWidth; box.style.animation = '';
    const cv = document.getElementById('catch-cv'), dpr = Math.min(window.devicePixelRatio || 1, 2);
    cv.width = 220 * dpr; cv.height = 130 * dpr; cv.style.width = '220px'; cv.style.height = '130px';
  }
  drawCatch(dt) {
    const cv = document.getElementById('catch-cv'); if (!cv || !this.catchInfo) return;
    this.catchT += dt;
    const info = this.catchInfo, dpr = Math.min(window.devicePixelRatio || 1, 2), ctx = cv.getContext('2d'), t = this.catchT;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, 220, 130);
    const R = RARITY[info.rarity || 'common'], ri = R.index;
    if (ri >= 2) glow(ctx, 110, 65, 90 + Math.sin(t * 3) * 6, R.color, 0.25 + ri * 0.06);
    const pop = Math.min(1, t * 4), sc = 0.6 + 0.4 * (1 - Math.pow(1 - pop, 3));
    ctx.save(); ctx.translate(110, 65 + Math.sin(t * 2.2) * 3);
    if (info.kind === 'fish') drawFish(ctx, info.sp, { x: 0, y: 0, size: 150 * sc, t, variant: info.item.variant });
    else if (info.kind === 'fragment') { ctx.fillStyle = '#f6ead0'; ctx.strokeStyle = '#a08a5a'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-40, -30); ctx.lineTo(10, -36); ctx.lineTo(40, -10); ctx.lineTo(30, 30); ctx.lineTo(-30, 36); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.strokeStyle = '#a08a5a'; for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.moveTo(-26 + i * 6, -16 + i * 12); ctx.lineTo(10 + i * 4, -18 + i * 12); ctx.stroke(); } }
    else drawLoot(ctx, info.item.id, 0, 0, 110 * sc, t);
    ctx.restore();
    if (ri >= 3) for (let i = 0; i < 6 + ri * 2; i++) { const a = t * (0.8 + hash(i) * 0.6) + i; const r = 60 + hash(i * 3) * 40; sparkle(ctx, 110 + Math.cos(a) * r, 65 + Math.sin(a * 1.3) * r * 0.55, 3 + hash(i) * 4, ri >= 5 ? '#ffd0f0' : '#fff6c8', t * 2 + i); }
  }
  hideCatch() {
    this.catchVisible = false; this.catchInfo = null;
    document.getElementById('catch').classList.add('hidden');
  }
  dismissCatch() { if (this.catchVisible) { this.g.fishing.finishPresentation(); this.hideCatch(); } }
}
