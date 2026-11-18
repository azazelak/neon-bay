// Keyboard + mouse input. The game reads keys through isDown(); one-shot
// actions (enter car, reload, punch) go through pressed(), which is true
// for exactly one step after the key goes down. testDown/testUp exist so a
// headless harness can drive the game without a real keyboard.
export class Input {
  constructor(canvas, rig) {
    this.canvas = canvas;
    this.rig = rig;
    this.down = new Set();
    this.pressedSet = new Set();
    this.mouseDown = false;
    this.clicked = false;
    this.dragging = false;
    this.lastX = 0;
    this.lastY = 0;

    window.addEventListener('keydown', (e) => {
      if (e.repeat) return;
      this.down.add(e.code);
      this.pressedSet.add(e.code);
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
    });
    window.addEventListener('keyup', (e) => this.down.delete(e.code));
    window.addEventListener('blur', () => this.down.clear());

    canvas.addEventListener('mousedown', (e) => {
      this.mouseDown = true;
      this.clicked = true;
      this.dragging = true;
      this.lastX = e.clientX;
      this.lastY = e.clientY;
    });
    window.addEventListener('mouseup', () => {
      this.mouseDown = false;
      this.dragging = false;
    });
    window.addEventListener('mousemove', (e) => {
      if (!this.dragging) return;
      const dx = e.clientX - this.lastX;
      const dy = e.clientY - this.lastY;
      this.lastX = e.clientX;
      this.lastY = e.clientY;
      if (this.rig) {
        this.rig.yaw += dx * 0.004;
        this.rig.pitch = Math.max(0.08, Math.min(1.1, this.rig.pitch + dy * 0.003));
        this.rig.lastDragT = performance.now() / 1000;
      }
    });
  }

  isDown(code) {
    return this.down.has(code);
  }

  // True once per key press; cleared by endStep() at the end of each step.
  pressed(code) {
    return this.pressedSet.has(code);
  }

  // Test hooks: pretend a key is held, exactly like a real keydown.
  testDown(code) {
    this.down.add(code);
    this.pressedSet.add(code);
  }
  testUp(code) {
    this.down.delete(code);
  }

  // Camera-relative movement intent, as a unit-ish {x, z} in world space.
  moveVector(forward) {
    let fx = 0;
    let fz = 0;
    if (this.isDown('KeyW') || this.isDown('ArrowUp')) { fx += forward.x; fz += forward.z; }
    if (this.isDown('KeyS') || this.isDown('ArrowDown')) { fx -= forward.x; fz -= forward.z; }
    const rx = -forward.z;
    const rz = forward.x;
    if (this.isDown('KeyD') || this.isDown('ArrowRight')) { fx += rx; fz += rz; }
    if (this.isDown('KeyA') || this.isDown('ArrowLeft')) { fx -= rx; fz -= rz; }
    const len = Math.hypot(fx, fz);
    if (len > 1) { fx /= len; fz /= len; }
    return { x: fx, z: fz };
  }

  get sprint() {
    return this.isDown('ShiftLeft') || this.isDown('ShiftRight');
  }

  endStep() {
    this.pressedSet.clear();
    this.clicked = false;
  }
}
