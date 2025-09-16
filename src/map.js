export class GameMap {
  constructor() {
    // Compact single-lane brawl map
    this.width = 1600;
    this.height = 1600;
    this.radiantBase = { x: 280, y: 1320 };
    this.direBase = { x: 1320, y: 280 };
    // Short diagonal lane with midpoint focused for fights
    this.path = [
      { x: 360, y: 1240 },
      { x: 800, y: 800 },
      { x: 1240, y: 360 }
    ];
    // One tower per side near lane
    this.radiantTowers = [ { x: 560, y: 1040 } ];
    this.direTowers = [ { x: 1040, y: 560 } ];
  }

  draw(ctx, camera) {
    ctx.save();
    ctx.resetTransform();
    ctx.fillStyle = '#10161f';
    ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);

    // World to screen transform
    camera.applyWorldTransform(ctx, ctx.canvas.width, ctx.canvas.height);

    // Ground
    ctx.fillStyle = '#0f1b2b';
    ctx.fillRect(0, 0, this.width, this.height);

    // Lane
    ctx.strokeStyle = '#2e7d32';
    ctx.lineWidth = 14;
    ctx.beginPath();
    ctx.moveTo(this.path[0].x, this.path[0].y);
    for (let i = 1; i < this.path.length; i++) ctx.lineTo(this.path[i].x, this.path[i].y);
    ctx.stroke();

    // Bases
    drawBase(ctx, this.radiantBase.x, this.radiantBase.y, '#16a34a');
    drawBase(ctx, this.direBase.x, this.direBase.y, '#dc2626');

    // Trees/obstacles simple grid dots for vibe
    ctx.fillStyle = '#0b1320';
    for (let x = 80; x < this.width; x += 160) {
      for (let y = 80; y < this.height; y += 160) {
        ctx.fillRect(x - 2, y - 2, 4, 4);
      }
    }
    ctx.restore();
  }
}

function drawBase(ctx, x, y, color) {
  ctx.save();
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x, y, 36, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.beginPath();
  ctx.arc(x, y, 28, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

