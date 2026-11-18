// Neon Bay v5c — keyboard + mouse.
// The mousedown handler is bound to WINDOW, not the canvas: the start
// overlay covers the canvas and would swallow a canvas-bound click.
export class Input {
  constructor(game) {
    this.game = game;
    this.keys = new Set();
    this.lookDX = 0;
    this.dragging = false;
    this.lastX = 0;

    window.addEventListener('keydown', (e) => {
      if (['Space', 'ArrowUp', 'ArrowDown'].includes(e.code)) e.preventDefault();
      if (!e.repeat) this.game.onKey(e.code);
      this.keys.add(e.code);
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('mousedown', (e) => {
      this.game.onClick(e.clientX, e.clientY);
      this.dragging = true;
      this.lastX = e.clientX;
    });
    window.addEventListener('mouseup', () => { this.dragging = false; });
    window.addEventListener('mousemove', (e) => {
      if (!this.dragging) return;
      this.lookDX += e.clientX - this.lastX;
      this.lastX = e.clientX;
    });
    window.addEventListener('blur', () => this.keys.clear());
  }
}
