// Neon Bay — keyboard + mouse, with edge detection and test hooks.
// Headless tests drive the game through testDown/testUp/pressed().

export class Input {
  constructor(canvas) {
    this.keys = new Set();
    this.pressedKeys = new Set(); // edge-triggered, consumed by pressed()
    this.mouseDown = false;
    this.dragging = false;
    this.dragDX = 0;
    this.dragDY = 0;
    this.lastX = 0;
    this.lastY = 0;
    this.testKeys = new Set();
    this.testPressed = new Set();

    window.addEventListener('keydown', (e) => {
      if (e.repeat) return;
      this.keys.add(e.code);
      this.pressedKeys.add(e.code);
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => { this.keys.clear(); this.mouseDown = false; this.dragging = false; });

    canvas.addEventListener('mousedown', (e) => {
      this.mouseDown = true;
      this.dragging = true;
      this.lastX = e.clientX;
      this.lastY = e.clientY;
    });
    window.addEventListener('mouseup', () => { this.mouseDown = false; this.dragging = false; });
    window.addEventListener('mousemove', (e) => {
      if (!this.dragging) return;
      this.dragDX += e.clientX - this.lastX;
      this.dragDY += e.clientY - this.lastY;
      this.lastX = e.clientX;
      this.lastY = e.clientY;
    });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  down(code) { return this.keys.has(code) || this.testKeys.has(code); }
  // True once per key press; call once a frame.
  pressed(code) {
    if (this.pressedKeys.has(code) || this.testPressed.has(code)) {
      this.pressedKeys.delete(code);
      this.testPressed.delete(code);
      return true;
    }
    return false;
  }
  // Consume the accumulated mouse drag for this frame.
  takeDrag() {
    const d = { dx: this.dragDX, dy: this.dragDY };
    this.dragDX = 0;
    this.dragDY = 0;
    return d;
  }
  // Headless test hooks.
  testDown(code) { this.testKeys.add(code); this.testPressed.add(code); }
  testUp(code) { this.testKeys.delete(code); }
  testClick() { this.testPressed.add('MouseClick'); }
  clicked() { return this.pressed('MouseClick'); }
  endFrame() { this.pressedKeys.clear(); }
}
