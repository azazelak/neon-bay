// Neon Bay v4 — input: keyboard + mouse drag orbit + click to shoot, with
// edge detection (pressed) and test hooks (testDown/testUp) so a headless
// harness can drive the game exactly like a player.
export function createInput(canvas) {
  const keys = {};
  const pressedSet = new Set();
  const testKeys = {};
  let orbitDX = 0, orbitDY = 0;
  let dragging = false, lastX = 0, lastY = 0, dragDist = 0;
  let clickQueued = false;

  function down(e) {
    if (e.repeat) return;
    keys[e.code] = true;
    pressedSet.add(e.code);
  }
  function up(e) { keys[e.code] = false; }
  window.addEventListener('keydown', down);
  window.addEventListener('keyup', up);

  canvas.addEventListener('pointerdown', (e) => {
    dragging = true; lastX = e.clientX; lastY = e.clientY; dragDist = 0;
  });
  window.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    const dx = e.clientX - lastX, dy = e.clientY - lastY;
    lastX = e.clientX; lastY = e.clientY;
    dragDist += Math.abs(dx) + Math.abs(dy);
    orbitDX += dx; orbitDY += dy;
  });
  window.addEventListener('pointerup', () => {
    if (dragging && dragDist < 6) clickQueued = true;
    dragging = false;
  });

  function is(code) { return !!keys[code] || !!testKeys[code]; }
  function pressed(code) {
    if (pressedSet.has(code)) { pressedSet.delete(code); return true; }
    if (testKeys[code] && testKeys[code + ':edge']) { testKeys[code + ':edge'] = false; return true; }
    return false;
  }

  return {
    get forward() { return is('KeyW') || is('ArrowUp'); },
    get back() { return is('KeyS') || is('ArrowDown'); },
    get left() { return is('KeyA') || is('ArrowLeft'); },
    get right() { return is('KeyD') || is('ArrowRight'); },
    get run() { return is('ShiftLeft') || is('ShiftRight'); },
    get jump() { return is('Space'); },
    get brake() { return is('Space'); },
    get shoot() { return clickQueued || is('KeyF'); },
    consumeShoot() { clickQueued = false; },
    get orbitDX() { const v = orbitDX; orbitDX = 0; return v; },
    get orbitDY() { const v = orbitDY; orbitDY = 0; return v; },
    pressed,
    testDown(code) { testKeys[code] = true; testKeys[code + ':edge'] = true; },
    testUp(code) { testKeys[code] = false; },
    update() { /* edges clear on read via pressed() */ },
  };
}
