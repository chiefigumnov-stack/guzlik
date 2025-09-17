export class InputManager {
  constructor(canvas) {
    this.canvas = canvas;
    this.keysDown = new Set();
    this.mouseScreenX = 0;
    this.mouseScreenY = 0;
    this.leftDown = false;
    this.rightDown = false;
    this.leftClicked = false;
    this.rightClicked = false;
    this.scrollDelta = 0;
    this.lastMouseX = 0;
    this.lastMouseY = 0;
    this.mouseDeltaX = 0;
    this.mouseDeltaY = 0;

    this._boundContextMenu = (e) => e.preventDefault();
    this._boundKeyDown = (e) => this.onKeyDown(e);
    this._boundKeyUp = (e) => this.onKeyUp(e);
    this._boundMouseMove = (e) => this.onMouseMove(e);
    this._boundMouseDown = (e) => this.onMouseDown(e);
    this._boundMouseUp = (e) => this.onMouseUp(e);
    this._boundWheel = (e) => this.onWheel(e);

    canvas.addEventListener('contextmenu', this._boundContextMenu);
    window.addEventListener('keydown', this._boundKeyDown);
    window.addEventListener('keyup', this._boundKeyUp);
    canvas.addEventListener('mousemove', this._boundMouseMove);
    canvas.addEventListener('mousedown', this._boundMouseDown);
    window.addEventListener('mouseup', this._boundMouseUp);
    canvas.addEventListener('wheel', this._boundWheel, { passive: true });

    canvas.setAttribute('tabindex', '0');
    canvas.focus();
  }

  dispose() {
    const c = this.canvas;
    c.removeEventListener('contextmenu', this._boundContextMenu);
    window.removeEventListener('keydown', this._boundKeyDown);
    window.removeEventListener('keyup', this._boundKeyUp);
    c.removeEventListener('mousemove', this._boundMouseMove);
    c.removeEventListener('mousedown', this._boundMouseDown);
    window.removeEventListener('mouseup', this._boundMouseUp);
    c.removeEventListener('wheel', this._boundWheel);
  }

  onKeyDown(e) {
    this.keysDown.add(e.key.toLowerCase());
  }

  onKeyUp(e) {
    this.keysDown.delete(e.key.toLowerCase());
  }

  onMouseMove(e) {
    const rect = this.canvas.getBoundingClientRect();
    const newX = (e.clientX - rect.left) * (this.canvas.width / rect.width);
    const newY = (e.clientY - rect.top) * (this.canvas.height / rect.height);
    this.mouseDeltaX += newX - this.mouseScreenX;
    this.mouseDeltaY += newY - this.mouseScreenY;
    this.mouseScreenX = newX;
    this.mouseScreenY = newY;
  }

  onMouseDown(e) {
    if (e.button === 0) {
      this.leftDown = true;
      this.leftClicked = true;
    } else if (e.button === 2) {
      this.rightDown = true;
      this.rightClicked = true;
    }
    // Focus canvas to ensure key presses are captured
    if (document.activeElement !== this.canvas) this.canvas.focus();
  }

  onMouseUp(e) {
    if (e.button === 0) this.leftDown = false;
    if (e.button === 2) this.rightDown = false;
  }

  onWheel(e) {
    this.scrollDelta += e.deltaY;
  }

  consumeClicks() {
    const clicks = { left: this.leftClicked, right: this.rightClicked };
    this.leftClicked = false;
    this.rightClicked = false;
    return clicks;
  }

  isKeyDown(code) {
    return this.keysDown.has(code.toLowerCase());
  }

  consumeMouseDelta() {
    const dx = this.mouseDeltaX; const dy = this.mouseDeltaY;
    this.mouseDeltaX = 0; this.mouseDeltaY = 0;
    return { dx, dy };
  }
}

