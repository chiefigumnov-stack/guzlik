export class GameMap {
  constructor() {
    // Simple 2-lane like: actually 1 lane diagonal with bases and 3 towers each
    this.width = 2600;
    this.height = 2600;
    this.radiantBase = { x: 300, y: 2300 };
    this.direBase = { x: 2300, y: 300 };
    // Lane points (path)
    this.path = [
      { x: 360, y: 2240 },
      { x: 800, y: 1800 },
      { x: 1200, y: 1400 },
      { x: 1700, y: 900 },
      { x: 2240, y: 360 }
    ];
    // Tower placements near lane
    this.radiantTowers = [
      { x: 520, y: 2080 },
      { x: 840, y: 1760 },
      { x: 1120, y: 1480 }
    ];
    this.direTowers = [
      { x: 2080, y: 520 },
      { x: 1760, y: 840 },
      { x: 1480, y: 1120 }
    ];
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

