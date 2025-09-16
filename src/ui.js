export class UIOverlay {
  constructor(game) {
    this.game = game;
  }

  drawHUD(ctx) {
    const { hero, elapsedTimeSec, gold } = this.game;
    ctx.save();
    ctx.resetTransform();
    const pad = 10;
    ctx.globalAlpha = 0.9;
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.fillRect(pad, pad, 260, 72);
    ctx.fillStyle = '#e2e8f0';
    ctx.font = '14px system-ui, sans-serif';
    ctx.fillText(`Время: ${formatTime(elapsedTimeSec)}`, pad + 10, pad + 22);
    ctx.fillText(`Золото: ${Math.floor(gold)}`, pad + 10, pad + 42);
    ctx.fillText(`Герой HP ${Math.ceil(hero.hp)}/${hero.maxHp} | MP ${Math.ceil(hero.mana)}/${hero.maxMana}`, pad + 10, pad + 62);

    // Abilities box (Q/E)
    const baseX = ctx.canvas.width / 2 - 100;
    const baseY = ctx.canvas.height - 90;
    const size = 64;
    drawAbilityBox(ctx, baseX, baseY, size, 'Q', 'Огненный шар', hero.abilityQCooldownRemaining, hero.abilityQCooldown);
    drawAbilityBox(ctx, baseX + 80, baseY, size, 'E', 'Лечение', hero.abilityECooldownRemaining, hero.abilityECooldown);
    ctx.restore();
  }

  drawWorldBars(ctx, camera) {
    const drawBar = (x, y, w, h, ratio, color) => {
      ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(x, y, w, h);
      ctx.fillStyle = color; ctx.fillRect(x, y, w * Math.max(0, Math.min(1, ratio)), h);
      ctx.strokeStyle = 'rgba(255,255,255,0.2)'; ctx.strokeRect(x, y, w, h);
    };

    for (const entity of this.game.entities) {
      if (!entity.alive) continue;
      if (!entity.maxHp || entity.maxHp <= 0) continue;
      const screenX = (entity.x - camera.x) * camera.scale + ctx.canvas.width / 2;
      const screenY = (entity.y - camera.y) * camera.scale + ctx.canvas.height / 2;
      const width = Math.max(24, entity.radius * 2 * camera.scale);
      drawBar(screenX - width / 2, screenY - entity.radius * camera.scale - 14, width, 6, entity.hp / entity.maxHp, entity.team === 0 ? '#22c55e' : '#ef4444');
    }
  }
}

function drawAbilityBox(ctx, x, y, size, keyLabel, title, remaining, total) {
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.4)';
  ctx.fillRect(x, y, size, size);
  ctx.strokeStyle = 'rgba(255,255,255,0.2)';
  ctx.strokeRect(x, y, size, size);
  ctx.fillStyle = '#e2e8f0';
  ctx.font = '12px system-ui, sans-serif';
  ctx.fillText(`${keyLabel}`, x + 6, y + 16);
  ctx.globalAlpha = 0.8;
  ctx.fillText(title, x + 6, y + size - 8);
  ctx.globalAlpha = 1;

  if (remaining > 0 && total > 0) {
    const ratio = Math.max(0, Math.min(1, remaining / total));
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(x, y, size, size * ratio);
    ctx.fillStyle = '#f87171';
    ctx.font = 'bold 14px system-ui, sans-serif';
    ctx.fillText(`${remaining.toFixed(1)}s`, x + 6, y + 32);
  }
  ctx.restore();
}

function formatTime(totalSec) {
  const m = Math.floor(totalSec / 60);
  const s = Math.floor(totalSec % 60);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

