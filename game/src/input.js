// Neon Bay — keyboard and mouse input. WASD moves, mouse drag orbits the
// camera, E enters/exits cars, F punches, click (or G) shoots, Space jumps,
// Shift sprints, H honks, Esc pauses. Also exposes a test hook so the
// headless playthrough can press keys without a real keyboard.
export class Input {
  constructor(canvas) {
    this.keys = new Set();
    this.dragDX = 0;
    this.dragDY = 0;
    this.mouseDown = false;
    this.clicked = false; // one-shot: a click this frame
    this._dragging = false;
    this._lastX = 0;
    this._lastY = 0;
    this._pressed = new Set(); // keys pressed since last poll

    window.addEventListener('keydown', (e) => {
      if (e.repeat) return;
      this.keys.add(e.code);
      this._pressed.add(e.code);
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => this.keys.clear());

    canvas.addEventListener('mousedown', (e) => {
      this._dragging = true;
      this.mouseDown = true;
      this.clicked = true;
      this._lastX = e.clientX;
      this._lastY = e.clientY;
    });
    window.addEventListener('mouseup', () => {
      this._dragging = false;
      this.mouseDown = false;
    });
    window.addEventListener('mousemove', (e) => {
      if (!this._dragging) return;
      this.dragDX += e.clientX - this._lastX;
      this.dragDY += e.clientY - this._lastY;
      this._lastX = e.clientX;
      this._lastY = e.clientY;
    });
  }

  down(code) {
    return this.keys.has(code);
  }

  // True once per physical press; callers should consume it each frame.
  pressed(code) {
    return this._pressed.has(code);
  }

  // Movement axes in camera space: x = strafe right, y = forward.
  moveAxes() {
    let x = 0;
    let y = 0;
    if (this.down('KeyW') || this.down('ArrowUp')) y += 1;
    if (this.down('KeyS') || this.down('ArrowDown')) y -= 1;
    if (this.down('KeyD') || this.down('ArrowRight')) x += 1;
    if (this.down('KeyA') || this.down('ArrowLeft')) x -= 1;
    return { x, y };
  }

  get sprint() {
    return this.down('ShiftLeft') || this.down('ShiftRight');
  }

  // Test hook: pretend a key is held or pressed (used by headless tests).
  testDown(code) {
    this.keys.add(code);
  }
  testUp(code) {
    this.keys.delete(code);
  }
  testPress(code) {
    this.keys.add(code);
    this._pressed.add(code);
  }

  endFrame() {
    this.dragDX = 0;
    this.dragDY = 0;
    this.clicked = false;
    this._pressed.clear();
  }
}
