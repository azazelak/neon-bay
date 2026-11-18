// Neon Bay — HUD: health, cash, rep, clock, wanted stars, objective,
// ammo, tokens, toast lines, live minimap, and the menu screens.

import { CFG } from './config.js';

export class Hud {
  constructor(doc, city) {
    this.doc = doc;
    this.city = city;
    this.el = {};
    for (const id of ['health-fill', 'cash', 'rep', 'clock', 'stars', 'tokens', 'objective', 'ammo', 'toast', 'speed', 'minimap']) {
      this.el[id] = doc.getElementById(id);
    }
    this.map = this.el.minimap ? this.el.minimap.getContext('2d') : null;
    this.toastTimer = 0;
    this.screens = {};
    for (const id of ['start-screen', 'pause-screen', 'busted-screen', 'wasted-screen', 'complete-screen']) {
      this.screens[id] = doc.getElementById(id);
    }
  }

  showScreen(name) {
    for (const [id, el] of Object.entries(this.screens)) {
      if (el) el.style.display = id === name ? 'flex' : 'none';
    }
  }

  hideScreens() {
    for (const el of Object.values(this.screens)) if (el) el.style.display = 'none';
  }

  toast(text, seconds = 5) {
    if (!this.el.toast) return;
    this.el.toast.textContent = text;
    this.el.toast.style.opacity = '1';
    this.toastTimer = seconds;
  }

  update(dt, s) {
    if (this.toastTimer > 0) {
      this.toastTimer -= dt;
      if (this.toastTimer <= 0 && this.el.toast) this.el.toast.style.opacity = '0';
    }
    if (this.el['health-fill']) {
      this.el['health-fill'].style.width = `${Math.max(0, s.health)}%`;
      this.el['health-fill'].style.background = s.health > 50 ? '#3aff8a' : s.health > 25 ? '#ffd42a' : '#ff2a2a';
    }
    if (this.el.cash) this.el.cash.textContent = `$${Math.floor(s.cash).toLocaleString()}`;
    if (this.el.rep) this.el.rep.textContent = `REP ${s.rep}`;
    if (this.el.clock) {
      const h = Math.floor(s.clock) % 24;
      const m = Math.floor((s.clock % 1) * 60);
      this.el.clock.textContent = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    }
    if (this.el.stars) {
      this.el.stars.textContent = '★'.repeat(s.wanted) + '☆'.repeat(5 - s.wanted);
      this.el.stars.style.color = s.wanted >= 3 ? '#ff2a2a' : '#ffd42a';
    }
    if (this.el.tokens) this.el.tokens.textContent = `◆ ${s.tokens} / ${CFG.tokenCount} TOKENS`;
    if (this.el.objective) this.el.objective.innerHTML = `<b>OBJECTIVE</b><br>${s.objective}`;
    if (this.el.ammo) {
      this.el.ammo.textContent = s.hasGun
        ? (s.reloading ? 'RELOADING…' : `AMMO ${s.ammo}/${CFG.pistolMag}`)
        : (s.gunUnlocked ? 'PISTOL — press 1 to draw' : '');
    }
    if (this.el.speed) this.el.speed.textContent = s.inCar ? `${Math.round(s.speed * 3.6)} km/h` : '';
    if (this.map) this.drawMinimap(s);
  }

  drawMinimap(s) {
    const ctx = this.map;
    const W = 180;
    const H = 180;
    const scale = W / 760; // world -380..380 -> 0..180
    const toMap = (x, z) => [(x + 380) * scale, (z + 380) * scale];
    ctx.fillStyle = 'rgba(10, 12, 24, 0.85)';
    ctx.fillRect(0, 0, W, H);
    // Ocean.
    ctx.fillStyle = '#1a4a6a';
    ctx.fillRect(0, (400 + 380) * scale, W, H - (400 + 380) * scale);
    // Sand.
    ctx.fillStyle = '#8a6a42';
    ctx.fillRect(0, (360 + 380) * scale, W, (400 - 360) * scale);
    // Buildings as dark blocks.
    ctx.fillStyle = '#3a3f4a';
    for (const c of this.city.colliders) {
      const [x, z] = toMap(c.minX, c.minZ);
      ctx.fillRect(x, z, (c.maxX - c.minX) * scale, (c.maxZ - c.minZ) * scale);
    }
    // Roads.
    ctx.strokeStyle = '#5a5a66';
    ctx.lineWidth = 2;
    for (let a = -320; a <= 320; a += 80) {
      const [x1, y1] = toMap(a, -340);
      const [x2, y2] = toMap(a, 340);
      ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
      const [x3, y3] = toMap(-340, a);
      const [x4, y4] = toMap(340, a);
      ctx.beginPath(); ctx.moveTo(x3, y3); ctx.lineTo(x4, y4); ctx.stroke();
    }
    // Tokens.
    ctx.fillStyle = '#2ad4ff';
    for (const t of s.tokenList || []) {
      if (t.taken) continue;
      const [x, y] = toMap(t.x, t.z);
      ctx.fillRect(x - 1.5, y - 1.5, 3, 3);
    }
    // Mission beacon.
    if (s.beacon) {
      const [x, y] = toMap(s.beacon.x, s.beacon.z);
      ctx.fillStyle = '#ffd42a';
      ctx.beginPath();
      ctx.arc(x, y, 5, 0, Math.PI * 2);
      ctx.fill();
    }
    // Traffic.
    ctx.fillStyle = '#9a9aa8';
    for (const c of s.trafficCars || []) {
      const [x, y] = toMap(c.x, c.z);
      ctx.fillRect(x - 1, y - 1, 2, 2);
    }
    // Cruisers.
    ctx.fillStyle = '#ff2a2a';
    for (const c of s.cruisers || []) {
      const [x, y] = toMap(c.x, c.z);
      ctx.beginPath();
      ctx.arc(x, y, 2.5, 0, Math.PI * 2);
      ctx.fill();
    }
    // Player arrow.
    const [px, py] = toMap(s.playerX, s.playerZ);
    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(-s.playerHeading);
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(0, -6);
    ctx.lineTo(4, 5);
    ctx.lineTo(-4, 5);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    // North marker.
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 11px Arial';
    ctx.fillText('N', W - 12, 12);
  }
}
