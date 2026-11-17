// Neon Bay — the HUD: health bar, cash, wanted stars, mission objective,
// clock, ammo, and a live minimap drawn on a 2D canvas (roads, beach,
// player arrow, traffic, police and the mission marker). Plus the center
// banner for mission briefings and the red damage flash.
import { CFG } from './config.js';

export class HUD {
  constructor() {
    this.el = {
      health: document.getElementById('hud-health-fill'),
      healthText: document.getElementById('hud-health-text'),
      cash: document.getElementById('hud-cash'),
      rep: document.getElementById('hud-rep'),
      tokens: document.getElementById('hud-tokens'),
      stars: document.getElementById('hud-stars'),
      objective: document.getElementById('hud-objective'),
      clock: document.getElementById('hud-clock'),
      ammo: document.getElementById('hud-ammo'),
      banner: document.getElementById('hud-banner'),
      bannerTitle: document.getElementById('hud-banner-title'),
      bannerSub: document.getElementById('hud-banner-sub'),
      damage: document.getElementById('hud-damage'),
      hint: document.getElementById('hud-hint'),
      minimap: document.getElementById('minimap'),
    };
    this.mapCtx = this.el.minimap.getContext('2d');
    this._bannerT = 0;
    this._flashT = 0;
    this._hintT = 14; // controls hint fades after a while
  }

  banner(title, sub, dur = 5) {
    this.el.bannerTitle.textContent = title;
    this.el.bannerSub.textContent = sub;
    this.el.banner.classList.add('show');
    this._bannerT = dur;
  }

  damageFlash() {
    this._flashT = 0.55;
  }

  update(dt, state) {
    // Health / cash / stars / objective / clock / ammo.
    const hp = Math.max(0, Math.round(state.health));
    this.el.health.style.width = `${hp}%`;
    this.el.healthText.textContent = `${hp}`;
    this.el.health.style.background = hp > 50 ? '#37c978' : hp > 25 ? '#e8b93a' : '#d23b3b';
    this.el.cash.textContent = `$${state.cash.toLocaleString('en-US')}`;
    this.el.rep.textContent = `REP ${state.rep}`;
    this.el.tokens.textContent = `◆ ${state.tokens} / ${state.tokenTotal} TOKENS`;
    this.el.stars.textContent = '★'.repeat(state.wanted) + '☆'.repeat(5 - state.wanted);
    this.el.stars.style.color = state.wanted > 0 ? '#ff2d55' : '#ffffff';
    this.el.objective.textContent = state.objective;
    const hh = Math.floor(state.timeMin / 60) % 24;
    const mm = Math.floor(state.timeMin % 60);
    this.el.clock.textContent = `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
    this.el.ammo.textContent = state.hasGun ? `AMMO ${state.ammo} / ${CFG.gunMagazine}` : 'NO GUN — F TO PUNCH';
    if (this._bannerT > 0) {
      this._bannerT -= dt;
      if (this._bannerT <= 0) this.el.banner.classList.remove('show');
    }
    if (this._flashT > 0) {
      this._flashT -= dt;
      this.el.damage.style.opacity = String(Math.max(0, this._flashT / 0.55) * 0.55);
    }
    if (this._hintT > 0) {
      this._hintT -= dt;
      if (this._hintT <= 0) this.el.hint.style.opacity = '0';
    }
    this._drawMinimap(state);
  }

  _drawMinimap(state) {
    const ctx = this.mapCtx;
    const S = CFG.minimapSize;
    const half = CFG.worldHalf;
    const toMap = (v) => ((v + half) / (half * 2)) * S;
    ctx.clearRect(0, 0, S, S);
    ctx.fillStyle = '#101018';
    ctx.fillRect(0, 0, S, S);
    // Beach + ocean strip.
    ctx.fillStyle = '#c9a86a';
    ctx.fillRect(0, toMap(CFG.beachZ), S, S - toMap(CFG.beachZ));
    ctx.fillStyle = '#1d4e6b';
    ctx.fillRect(0, toMap(CFG.worldHalf - 4), S, 6);
    // Roads.
    ctx.strokeStyle = '#4a4a58';
    ctx.lineWidth = 4;
    for (const c of state.city.roadLines) {
      ctx.beginPath(); ctx.moveTo(toMap(c), 0); ctx.lineTo(toMap(c), S); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, toMap(c)); ctx.lineTo(S, toMap(c)); ctx.stroke();
    }
    // Mission marker.
    if (state.marker) {
      const pulse = 5 + Math.sin(state.time * 5) * 2;
      ctx.fillStyle = '#ffe600';
      ctx.beginPath();
      ctx.arc(toMap(state.marker.x), toMap(state.marker.z), pulse, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
    // Traffic dots.
    ctx.fillStyle = '#e8b93a';
    for (const car of state.trafficCars) {
      ctx.fillRect(toMap(car.x) - 1.5, toMap(car.z) - 1.5, 3, 3);
    }
    // Police blips (flashing).
    const flash = Math.floor(state.time * 4) % 2 === 0;
    ctx.fillStyle = flash ? '#ff2020' : '#2040ff';
    for (const car of state.policeCars) {
      ctx.beginPath();
      ctx.arc(toMap(car.x), toMap(car.z), 3, 0, Math.PI * 2);
      ctx.fill();
    }
    // Player arrow.
    const px = toMap(state.player.x);
    const py = toMap(state.player.z);
    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(state.player.heading);
    ctx.fillStyle = '#00e5ff';
    ctx.beginPath();
    ctx.moveTo(0, -6);
    ctx.lineTo(4.5, 5);
    ctx.lineTo(-4.5, 5);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    // North tick.
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 11px system-ui, sans-serif';
    ctx.fillText('N', S - 12, 12);
  }
}
