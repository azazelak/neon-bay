// Neon Bay v5c — HUD: top bar, wanted stars, objective, speedo, minimap, toasts.
export class HUD {
  constructor(game) {
    this.game = game;
    this.el = {
      cash: document.getElementById('cash'),
      rep: document.getElementById('rep'),
      clock: document.getElementById('clock'),
      tokens: document.getElementById('tokens'),
      stars: document.getElementById('stars'),
      objective: document.getElementById('objective'),
      speed: document.getElementById('speed'),
      weapon: document.getElementById('weapon'),
      screen: document.getElementById('screen'),
      screenTitle: document.getElementById('screen-title'),
      screenSub: document.getElementById('screen-sub'),
      toasts: document.getElementById('toasts'),
      map: document.getElementById('minimap'),
    };
    this.mapCtx = this.el.map.getContext('2d');
    this.gameTime = 17 * 60; // 17:00 dusk
  }

  toast(title, sub = '') {
    const d = document.createElement('div');
    d.className = 'toast';
    d.innerHTML = `<b>${title}</b>${sub ? `<span>${sub}</span>` : ''}`;
    this.el.toasts.appendChild(d);
    setTimeout(() => d.remove(), 4200);
    while (this.el.toasts.children.length > 3) this.el.toasts.firstChild.remove();
  }

  showScreen(title, sub, hint = 'Click to continue') {
    this.el.screenTitle.textContent = title;
    this.el.screenSub.textContent = sub;
    this.el.screen.querySelector('.hint').textContent = hint;
    this.el.screen.style.display = 'flex';
  }

  hideScreen() { this.el.screen.style.display = 'none'; }

  drawMinimap() {
    const g = this.mapCtx, S = 180, sc = S / 400;
    g.clearRect(0, 0, S, S);
    g.fillStyle = 'rgba(8,10,16,0.78)';
    g.fillRect(0, 0, S, S);
    const X = (x) => (x + 200) * sc, Z = (z) => (z + 200) * sc;
    // sea
    g.fillStyle = '#0d3a5c';
    g.fillRect(0, Z(180), S, S - Z(180));
    // roads
    g.strokeStyle = '#4a4a55'; g.lineWidth = 5;
    for (let v = -160; v <= 160; v += 40) {
      g.beginPath(); g.moveTo(X(-180), Z(v)); g.lineTo(X(180), Z(v)); g.stroke();
      g.beginPath(); g.moveTo(X(v), Z(-180)); g.lineTo(X(v), Z(180)); g.stroke();
    }
    // pier
    g.strokeStyle = '#7a5a38'; g.lineWidth = 3;
    g.beginPath(); g.moveTo(X(135), Z(165)); g.lineTo(X(135), Z(245)); g.stroke();
    // mission target
    const tgt = this.game.missions?.objectiveTarget();
    if (tgt) {
      g.fillStyle = '#ffd23e';
      g.beginPath(); g.arc(X(tgt.x), Z(tgt.z), 6, 0, 7); g.fill();
      g.strokeStyle = '#ffd23e'; g.lineWidth = 2;
      g.beginPath(); g.arc(X(tgt.x), Z(tgt.z), 10, 0, 7); g.stroke();
    }
    // tokens
    g.fillStyle = '#ff2e88';
    for (const t of this.game.tokens?.items || []) {
      if (!t.got) { g.beginPath(); g.arc(X(t.x), Z(t.z), 2, 0, 7); g.fill(); }
    }
    // traffic + police
    g.fillStyle = '#cccccc';
    for (const c of this.game.traffic?.cars || []) {
      g.fillRect(X(c.pos.x) - 2, Z(c.pos.z) - 2, 4, 4);
    }
    g.fillStyle = '#2244ff';
    for (const c of this.game.police?.cruisers || []) {
      g.beginPath(); g.arc(X(c.pos.x), Z(c.pos.z), 3, 0, 7); g.fill();
    }
    // player
    const p = this.game.player;
    g.fillStyle = '#ff6a1a';
    g.beginPath(); g.arc(X(p.pos.x), Z(p.pos.z), 4, 0, 7); g.fill();
    g.strokeStyle = '#ff6a1a'; g.lineWidth = 2;
    g.beginPath();
    g.moveTo(X(p.pos.x), Z(p.pos.z));
    g.lineTo(X(p.pos.x + Math.sin(p.yaw) * 12), Z(p.pos.z + Math.cos(p.yaw) * 12));
    g.stroke();
  }

  update(dt) {
    this.gameTime += dt * 0.5;
    const hh = Math.floor(this.gameTime / 60) % 24;
    const mm = Math.floor(this.gameTime % 60);
    this.el.cash.textContent = `$${this.game.cash.toLocaleString()}`;
    this.el.rep.textContent = `REP ${this.game.rep}`;
    this.el.clock.textContent = `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
    this.el.tokens.textContent = `◆ ${this.game.tokens.count}/20 TOKENS`;
    const lvl = this.game.police.level;
    this.el.stars.textContent = '★'.repeat(lvl) + '☆'.repeat(5 - lvl);
    this.el.stars.style.color = lvl >= 3 ? '#ff4444' : '#ffd23e';
    this.el.objective.textContent = this.game.missions.objective;
    const p = this.game.player;
    const kmh = Math.round(Math.abs(p.inCar && p.car ? p.car.speed : p.speed) * 3.6);
    this.el.speed.textContent = p.inCar ? `${kmh} km/h` : '';
    this.el.weapon.textContent = p.inCar ? 'E — exit car' : `${p.weapon.toUpperCase()} ${p.ammo}/${p.reserve} — click to ${p.weapon === 'pistol' ? 'shoot' : 'punch'}`;
    this.drawMinimap();
  }
}
