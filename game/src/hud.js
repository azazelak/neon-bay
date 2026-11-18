// Neon Bay v4 — HUD: DOM overlay (cash, rep, stars, speed, ammo, tokens,
// objective, clock, toasts) plus a live 2D minimap and the menu screens
// (start, pause, busted, wasted, story complete).
export function createHud() {
  const root = document.getElementById('hud');
  const el = (id) => document.getElementById(id);
  const minimap = el('minimap');
  const mctx = minimap.getContext('2d');

  function setText(id, text) { const n = el(id); if (n) n.textContent = text; }
  function setStars(n) {
    setText('stars', '★'.repeat(n) + '☆'.repeat(Math.max(0, 5 - n)));
    const s = el('stars');
    if (s) s.style.color = n >= 3 ? '#ff4444' : '#ffd94a';
  }
  function toast(msg) {
    const t = el('toast');
    if (!t) return;
    t.textContent = msg;
    t.style.opacity = '1';
    clearTimeout(t._timer);
    t._timer = setTimeout(() => { t.style.opacity = '0'; }, 2600);
  }
  function showMenu(name) {
    for (const m of ['menu-start', 'menu-pause', 'menu-busted', 'menu-wasted', 'menu-complete']) {
      const n = el(m);
      if (n) n.style.display = m === 'menu-' + name ? 'flex' : 'none';
    }
  }
  function hideMenus() { showMenu('none'); }

  // Minimap: world x -450..650, z -450..450 mapped to 170 px.
  function drawMinimap(s) {
    const W = 170, H = 170;
    mctx.clearRect(0, 0, W, H);
    mctx.fillStyle = '#101018'; mctx.fillRect(0, 0, W, H);
    const sx = (x) => ((x + 450) / 1100) * W;
    const sz = (z) => ((z + 450) / 900) * H;
    // Ocean.
    mctx.fillStyle = '#1d4f6e'; mctx.fillRect(sx(470), 0, W - sx(470), H);
    mctx.fillStyle = '#d9b380'; mctx.fillRect(sx(432), 0, sx(470) - sx(432), H);
    // Roads.
    mctx.strokeStyle = '#3d4149'; mctx.lineWidth = 3;
    for (let k = -4; k <= 4; k++) {
      mctx.beginPath(); mctx.moveTo(sx(k * 96), 0); mctx.lineTo(sx(k * 96), H); mctx.stroke();
      mctx.beginPath(); mctx.moveTo(0, sz(k * 96)); mctx.lineTo(W, sz(k * 96)); mctx.stroke();
    }
    // Blocks.
    mctx.fillStyle = '#2c2f38';
    for (let i = -4; i < 4; i++) for (let j = -4; j < 4; j++) {
      mctx.fillRect(sx(i * 96 + 48) - 4, sz(j * 96 + 48) - 4, 8, 8);
    }
    // Pier + wheel.
    mctx.fillStyle = '#7a5a38'; mctx.fillRect(sx(440), sz(-12), sx(570) - sx(440), sz(12) - sz(-12));
    mctx.fillStyle = '#ff2e88';
    mctx.beginPath(); mctx.arc(sx(545), sz(0), 4, 0, Math.PI * 2); mctx.fill();
    // Tokens.
    mctx.fillStyle = '#ff2e88';
    for (const tk of s.tokens || []) {
      if (tk.taken) continue;
      mctx.fillRect(sx(tk.x) - 1.5, sz(tk.z) - 1.5, 3, 3);
    }
    // Fare marker.
    if (s.fare) {
      mctx.fillStyle = '#39ff88';
      mctx.beginPath(); mctx.arc(sx(s.fare.x), sz(s.fare.z), 4, 0, Math.PI * 2); mctx.fill();
    }
    // Mission target: pulsing yellow ring.
    if (s.target) {
      const p = 3 + Math.sin(performance.now() / 200) * 1.5;
      mctx.strokeStyle = '#ffd94a'; mctx.lineWidth = 2;
      mctx.beginPath(); mctx.arc(sx(s.target.x), sz(s.target.z), p + 3, 0, Math.PI * 2); mctx.stroke();
    }
    // Police.
    mctx.fillStyle = '#ff3333';
    for (const c of s.police || []) {
      mctx.beginPath(); mctx.arc(sx(c.x), sz(c.z), 2.5, 0, Math.PI * 2); mctx.fill();
    }
    // Player arrow.
    const px = sx(s.x), pz = sz(s.z);
    mctx.save();
    mctx.translate(px, pz); mctx.rotate(Math.PI - s.yaw);
    mctx.fillStyle = '#ffffff';
    mctx.beginPath(); mctx.moveTo(0, -6); mctx.lineTo(4.5, 5); mctx.lineTo(-4.5, 5); mctx.closePath(); mctx.fill();
    mctx.restore();
  }

  return {
    setCash: (v) => setText('cash', '$' + v.toLocaleString('en-US')),
    setRep: (v) => setText('rep', 'REP ' + v),
    setTokens: (n, total) => setText('tokens', '◆ ' + n + ' / ' + total + ' TOKENS'),
    setSpeed: (kmh) => setText('speed', kmh > 0 ? Math.round(kmh) + ' km/h' : ''),
    setAmmo: (a, hasGun) => setText('ammo', hasGun ? 'AMMO ' + a + '/12' : ''),
    setClock: (t) => {
      const mins = Math.floor(t / 60) % 24;
      const hh = String(17 + Math.floor(t / 3600)).padStart(2, '0');
      const mm = String(Math.floor(t / 60) % 60).padStart(2, '0');
      setText('clock', hh + ':' + mm);
    },
    setObjective: (t) => setText('objective-text', t),
    setStars, toast, showMenu, hideMenus, drawMinimap,
  };
}
