import { clamp } from './utils.js';

export class Camera {
  constructor() {
    this.x = 0;
    this.y = 0;
    this.scale = 1;
    this.minScale = 0.4;
    this.maxScale = 2.0;
    this.mode = 'iso'; // 'iso' | 'topdown'
    this.isoYScale = 0.6;
  }

  updateFromInput(input, dt) {
    // Zoom with wheel
    if (input.scrollDelta !== 0) {
      const zoom = Math.exp(-input.scrollDelta * 0.0015);
      const oldScale = this.scale;
      this.scale = clamp(this.scale * zoom, this.minScale, this.maxScale);
      input.scrollDelta = 0;
      // Optionally, zoom towards cursor (skip for simplicity)
      const _ = oldScale;
    }
  }

  jumpTo(x, y) {
    this.x = x; this.y = y;
  }

  applyWorldTransform(ctx, canvasWidth, canvasHeight) {
    ctx.resetTransform();
    ctx.translate(Math.floor(canvasWidth / 2), Math.floor(canvasHeight / 2));
    if (this.mode === 'iso') {
      ctx.rotate(-Math.PI / 4);
      ctx.scale(this.scale, this.scale * this.isoYScale);
    } else {
      ctx.scale(this.scale, this.scale);
    }
    ctx.translate(-this.x, -this.y);
  }
}

