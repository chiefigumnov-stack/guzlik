export const SHOP_RADIUS = 180;

export const ITEMS = {
  clarity: { key: 'clarity', name: 'Зелье маны', cost: 50, desc: '+120 маны (5с)', use: (hero) => { hero.mana = Math.min(hero.maxMana, hero.mana + 120); } },
  salve: { key: 'salve', name: 'Лечебное', cost: 60, desc: '+200 HP (5с)', use: (hero) => { hero.hp = Math.min(hero.maxHp, hero.hp + 200); } },
  boots: { key: 'boots', name: 'Сапоги', cost: 300, desc: '+20 скорость (пассивно)', passive: (hero) => { hero.speedBonus = (hero.speedBonus || 0) + 20; } },
  wand: { key: 'wand', name: 'Жезл', cost: 450, desc: '+8 урон (пассивно)', passive: (hero) => { hero.attackDamage = (hero.attackDamage || 0) + 8; } }
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
    def.use(game.hero);
    slot.charges -= 1;
    if (slot.charges <= 0) game.hero.inventory[slotIndex] = null;
    return true;
  }
  return false;
}

