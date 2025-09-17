export const SHOP_RADIUS = 180;

export const ITEMS = {
  clarity: { key: 'clarity', name: 'Зелье маны', cost: 50, desc: '+120 маны (5с)', use: (hero) => { hero.mana = Math.min(hero.maxMana, hero.mana + 120); } },
  salve: { key: 'salve', name: 'Лечебное', cost: 60, desc: '+200 HP (5с)', use: (hero) => { hero.hp = Math.min(hero.maxHp, hero.hp + 200); } },
  boots: { key: 'boots', name: 'Сапоги', cost: 300, desc: '+20 скорость (пассивно)', passive: (hero) => { hero.speedBonus = (hero.speedBonus || 0) + 20; } },
  wand: { key: 'wand', name: 'Жезл', cost: 450, desc: '+8 урон (пассивно)', passive: (hero) => { hero.attackDamage = (hero.attackDamage || 0) + 8; } },
  lifesteal_mask: { key: 'lifesteal_mask', name: 'Маска вампира', cost: 900, desc: '+15% вампиризм', passive: (hero) => { hero.lifestealPercent = (hero.lifestealPercent || 0) + 0.15; } },
  claymore: { key: 'claymore', name: 'Клеймор', cost: 1400, desc: '+24 урон', passive: (hero) => { hero.attackDamage = (hero.attackDamage || 0) + 24; } },
  magic_cloak: { key: 'magic_cloak', name: 'Маг. плащ', cost: 500, desc: '+15% сопр. магии', passive: (hero) => { hero.magicResist = Math.min(0.75, (hero.magicResist || 0) + 0.15); } },
  tp_scroll: { key: 'tp_scroll', name: 'Свиток ТП', cost: 50, desc: 'Телепорт на базу', use: (hero, game) => { if (!hero.alive) return; const base = hero.team === 0 ? game.map.radiantBase : game.map.direBase; hero.x = base.x + (hero.team === 0 ? 60 : -60); hero.y = base.y + (hero.team === 0 ? -60 : 60); } }
};

export function canUseShop(game) {
  const hero = game.hero;
  const base = game.map.radiantBase;
  const d = Math.hypot(hero.x - base.x, hero.y - base.y);
  return d <= SHOP_RADIUS;
}

export function buyItem(game, key) {
  const def = ITEMS[key];
  if (!def) return false;
  if (!canUseShop(game)) return false;
  if (game.gold < def.cost) return false;
  const slot = game.hero.inventory.findIndex((s) => s == null);
  if (slot === -1) return false;
  game.gold -= def.cost;
  game.hero.inventory[slot] = { key: def.key, charges: 1 };
  if (def.passive) def.passive(game.hero);
  return true;
}

export function useItem(game, slotIndex) {
  const slot = game.hero.inventory[slotIndex];
  if (!slot) return false;
  const def = ITEMS[slot.key];
  if (def && def.use) {
    def.use(game.hero, game);
    slot.charges -= 1;
    if (slot.charges <= 0) game.hero.inventory[slotIndex] = null;
    return true;
  }
  return false;
}

