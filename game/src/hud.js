// The HUD: health, cash, reputation, clock, wanted stars, mission
// objective, ammo, token counter, and a live top-down minimap — plus the
// start, pause, busted, wasted and story-complete screens. The DOM lives
// in index.html; this class only binds it and keeps it current.
export class Hud {
  constructor(game) {
    this.game = game;
    const $ = (id) => document.getElementById(id);
    this.el = {
      hud: $('hud'),
      healthFill: $('health-fill'),
      cash: $('cash'),
      rep: $('rep'),
      clock: $('clock'),
      stars: $('stars'),
      tokens: $('tokens'),
      objective: $('objective'),
      ammo: $('ammo'),
      toast: $('toast'),
      menu: $('menu'),
      pause: $('pause'),
      busted: $('busted'),
      wasted: $('wasted'),
      complete: $('complete'),
      completeStats: $('complete-stats'),
      minimap: $('minimap'),
    };
    this.mm = this.el.minimap.getContext('2d');
    this.toastTimer = null;
    $('btn-new').addEventListener('click', () => game.startNewGame());
    const cont = $('btn-continue');
    if (cont) cont.addEventListener('click', () => game.continueGame());
    $('btn-resume').addEventListener('click', () => game.resume());
    $('btn-quit').addEventListener('click', () => game.toMenu());
    $('btn-busted-retry').addEventListener('click', () => game.startNewGame());
    $('btn-wasted-retry').addEventListener('click', () => game.startNewGame());
    $('btn-complete-again').addEventListener('click', () => game.startNewGame());
    $('btn-complete-roam').addEventListener('click', () => game.resumeFreeRoam());
  }

  showOnly(name) {
    for (const k of ['menu', 'pause', 'busted', 'wasted', 'complete']) {
      this.el[k].classList.toggle('hidden', k !== name);
    }
    this.el.hud.classList.toggle('hidden', name !== null);
  }

  hideAll() {
    this.showOnly(null);
  }

  toast(msg) {
    this.el.toast.textContent = msg;
    this.el.toast.classList.remove('hidden');
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => this.el.toast.classList.add('hidden'), 3200);
  }

  update() {
    const g = this.game;
    this.el.healthFill.style.width = `${Math.max(0, g.player.health)}%`;
    this.el.healthFill.style.background = g.player.health > 50 ? '#37d67a' : g.player.health > 25 ? '#ffb13c' : '#ff4040';
    this.el.cash.textContent = `$${g.cash.toLocaleString()}`;
    this.el.rep.textContent = `REP ${g.rep}`;
    const mins = 18 * 60 + 42 + Math.floor(g.time * 0.5);
    const hh = String(Math.floor(mins / 60) % 24).padStart(2, '0');
    const mm = String(mins % 60).padStart(2, '0');
    this.el.clock.textContent = `${hh}:${mm}`;
    const stars = g.police.stars;
    this.el.stars.textContent = '★'.repeat(stars) + '☆'.repeat(5 - stars);
    this.el.stars.style.color = stars >= 3 ? '#ff4040' : '#ffd23e';
    this.el.tokens.textContent = `◆ ${g.tokens.collected} / 12 TOKENS`;
    this.el.objective.textContent = g.missions.objectiveText;
    if (!g.combat.hasGun) this.el.ammo.textContent = '';
    else if (g.combat.reloadT > 0) this.el.ammo.textContent = 'RELOADING…';
    else this.el.ammo.textContent = `AMMO ${g.combat.ammo} / 12`;
    this.drawMinimap();
  }

  drawMinimap() {
    const g = this.game;
    const ctx = this.mm;
    const S = 180;
    const scale = S / 700; // city + ocean margin
    const toX = (x) => (x + 350) * scale;
    const toZ = (z) => (z + 350) * scale;
    ctx.clearRect(0, 0, S, S);
    ctx.fillStyle = '#0a2a4a';
    ctx.fillRect(0, 0, toX(-333), S); // ocean, west
    ctx.fillStyle = '#1c1826';
    ctx.fillRect(toX(-333), 0, S - toX(-333), S);
    ctx.strokeStyle = '#3a3542';
    ctx.lineWidth = 3;
    for (let i = -4; i <= 4; i++) {
      const c = toX(i * 74);
      ctx.beginPath(); ctx.moveTo(c, 0); ctx.lineTo(c, S); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, c); ctx.lineTo(S, c); ctx.stroke();
    }
    // Mission target.
    if (g.missions.state === 'active') {
      const s = g.missions.current.stages[g.missions.stageI];
      if (s && s.x !== undefined) {
        const pulse = 5 + Math.sin(g.time * 5) * 2;
        ctx.fillStyle = '#ffd23e';
        ctx.beginPath();
        ctx.arc(toX(s.x), toZ(s.z), pulse, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    // Tokens.
    ctx.fillStyle = '#2ee6ff';
    for (const t of g.tokens.list) {
      if (t.taken) continue;
      ctx.fillRect(toX(t.x) - 1.5, toZ(t.z) - 1.5, 3, 3);
    }
    // Traffic cars.
    ctx.fillStyle = '#c8c8d8';
    for (const t of g.traffic.cars) ctx.fillRect(toX(t.car.x) - 1, toZ(t.car.z) - 1, 2, 2);
    // Police: flashing red/blue.
    ctx.fillStyle = Math.floor(g.time * 4) % 2 === 0 ? '#ff4040' : '#4080ff';
    for (const e of g.police.cars) {
      ctx.beginPath();
      ctx.arc(toX(e.car.x), toZ(e.car.z), 3, 0, Math.PI * 2);
      ctx.fill();
    }
    // Player arrow.
    const px = toX(g.player.x);
    const pz = toZ(g.player.z);
    const h = g.player.inCar ? g.player.inCar.heading : g.player.heading;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(px + Math.sin(h) * 6, pz + Math.cos(h) * 6);
    ctx.lineTo(px + Math.sin(h + 2.5) * 5, pz + Math.cos(h + 2.5) * 5);
    ctx.lineTo(px + Math.sin(h - 2.5) * 5, pz + Math.cos(h - 2.5) * 5);
    ctx.closePath();
    ctx.fill();
  }
}
