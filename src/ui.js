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
    ctx.fillRect(pad, pad, 420, 100);
    ctx.fillStyle = '#e2e8f0';
    ctx.font = '14px system-ui, sans-serif';
    ctx.fillText(`Время: ${formatTime(elapsedTimeSec)}`, pad + 10, pad + 22);
    ctx.fillText(`Золото: ${Math.floor(gold)}`, pad + 10, pad + 42);
    ctx.fillText(`Ур. ${hero.level}  Опыт: ${Math.floor(hero.xp)}/${hero.xpToNextLevel()}  Очки умений: ${hero.skillPoints}`, pad + 10, pad + 62);
    // XP bar
    const xpRatio = Math.max(0, Math.min(1, hero.xp / hero.xpToNextLevel())) || 0;
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(pad + 10, pad + 68, 220, 6);
    ctx.fillStyle = '#60a5fa';
    ctx.fillRect(pad + 10, pad + 68, 220 * xpRatio, 6);
    ctx.fillText(`HP ${Math.ceil(hero.hp)}/${hero.maxHp} | MP ${Math.ceil(hero.mana)}/${hero.maxMana}`, pad + 10, pad + 82);
    if (!hero.alive) {
      ctx.fillStyle = '#f87171';
      ctx.fillText(`Возрождение через: ${Math.ceil(hero.respawnTimer || 0)}с`, pad + 200, pad + 22);
    }

    // Abilities box (Q/W/E/R)
    const baseX = ctx.canvas.width / 2 - 160;
    const baseY = ctx.canvas.height - 90;
    const size = 64;
    drawAbilityBox(ctx, baseX, baseY, size, 'Q', abilityTitle(this.game.hero, 'q'), hero.abilityQCooldownRemaining, hero.abilityQCooldown, hero.abilityLevelQ, this.game.hero.maxAbilityLevel, hero.skillPoints > 0 ? '1' : '');
    drawAbilityBox(ctx, baseX + 80, baseY, size, 'W', abilityTitle(this.game.hero, 'w'), hero.abilityWCooldownRemaining || 0, hero.abilityWCooldown || 0, hero.abilityLevelW || 1, hero.maxAbilityLevel || 4, hero.skillPoints > 0 ? '1' : '');
    drawAbilityBox(ctx, baseX + 160, baseY, size, 'E', abilityTitle(this.game.hero, 'e'), hero.abilityECooldownRemaining, hero.abilityECooldown, hero.abilityLevelE, hero.maxAbilityLevel, hero.skillPoints > 0 ? '1' : '');
    drawAbilityBox(ctx, baseX + 240, baseY, size, 'R', abilityTitle(this.game.hero, 'r'), hero.abilityRCooldownRemaining || 0, hero.abilityRCooldown || 0, hero.abilityLevelR || 1, hero.maxAbilityLevel || 4, hero.skillPoints > 0 ? '1' : '');
    // Upgrade hint
    if (hero.skillPoints > 0) {
      ctx.fillStyle = '#22c55e';
      ctx.font = '12px system-ui, sans-serif';
      ctx.fillText('Используйте 1/2/9/0 чтобы улучшать Q/E/W/R', baseX - 60, baseY - 10);
    }

    // Inventory (6 slots): keys 3-8 to use
    const invX = ctx.canvas.width - 12 - (6 * 42);
    const invY = ctx.canvas.height - 90;
    for (let i = 0; i < 6; i++) {
      const x = invX + i * 42;
      drawItemSlot(ctx, x, invY, 40, this.game.hero.inventory[i], i);
    }
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.font = '11px system-ui, sans-serif';
    ctx.fillText('3 4 5 6 7 8 — использовать', invX, invY - 6);
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
      // Transform world->screen in iso mode for bar placement
      let wx = entity.x - camera.x;
      let wy = entity.y - camera.y;
      if (camera.mode === 'iso') {
        const cos = Math.cos(-Math.PI / 4), sin = Math.sin(-Math.PI / 4);
        const rx = wx * cos - wy * sin;
        const ry = wx * sin + wy * cos;
        const sx = rx * camera.scale;
        const sy = ry * camera.scale * camera.isoYScale;
        wx = sx; wy = sy;
      } else {
        wx = wx * camera.scale; wy = wy * camera.scale;
      }
      const screenX = wx + ctx.canvas.width / 2;
      const screenY = wy + ctx.canvas.height / 2;
      const width = Math.max(24, entity.radius * 2 * camera.scale);
      drawBar(screenX - width / 2, screenY - entity.radius * camera.scale - 14, width, 6, entity.hp / entity.maxHp, entity.team === 0 ? '#22c55e' : '#ef4444');
    }
  }
}

function drawAbilityBox(ctx, x, y, size, keyLabel, title, remaining, total, level = 1, maxLevel = 4, hint = '') {
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

  // Level pips
  const pipY = y + size - 22;
  for (let i = 0; i < maxLevel; i++) {
    ctx.fillStyle = i < level ? '#fde047' : 'rgba(255,255,255,0.15)';
    ctx.fillRect(x + 6 + i * 10, pipY, 8, 4);
  }

  if (hint) {
    ctx.fillStyle = '#22c55e';
    ctx.font = 'bold 12px system-ui, sans-serif';
    ctx.fillText(`+${hint}`, x + size - 26, y + 16);
  }

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

function abilityTitle(hero, which) {
  if (hero.abilityMeta && hero.abilityMeta[which]) return hero.abilityMeta[which].name;
  return which === 'q' ? 'Огненный шар' : 'Лечение';
}

function drawItemSlot(ctx, x, y, size, slot, index) {
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.4)';
  ctx.fillRect(x, y, size, size);
  ctx.strokeStyle = 'rgba(255,255,255,0.2)';
  ctx.strokeRect(x, y, size, size);
  ctx.fillStyle = '#e2e8f0';
  ctx.font = '10px system-ui, sans-serif';
  ctx.fillText(String(index + 3), x + 4, y + 12);
  if (slot) {
    drawItemIcon(ctx, x + 10, y + 10, size - 20, slot.key);
  }
  ctx.restore();
}

function drawItemIcon(ctx, x, y, size, key) {
  ctx.save();
  // simple generated icons per key
  const colorMap = {
    clarity: '#60a5fa', salve: '#34d399', boots: '#eab308', wand: '#a78bfa',
    lifesteal_mask: '#ef4444', claymore: '#f97316', magic_cloak: '#64748b', tp_scroll: '#22d3ee'
  };
  ctx.fillStyle = colorMap[key] || '#94a3b8';
  ctx.fillRect(x, y, size, size);
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.fillRect(x, y + size - 8, size, 8);
  ctx.restore();
}

function wrapText(ctx, text, maxWidth) {
  const words = text.split(' ');
  const lines = [];
  let line = '';
  for (const w of words) {
    const test = line ? line + ' ' + w : w;
    if (ctx.measureText(test).width <= maxWidth) line = test; else { lines.push(line); line = w; }
    if (lines.length === 1) break; // one line only for compact UI
  }
  if (line) lines.push(line);
  return lines.slice(0, 1);
}

