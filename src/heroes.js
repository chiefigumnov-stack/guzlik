import { Hero } from './entities.js';

export const HERO_DEFS = {
  mage: {
    key: 'mage',
    title: 'Маг',
    color: '#93c5fd',
    base: { maxHp: 480, maxMana: 380, manaRegen: 8, hpRegen: 1.6, speed: 118, attackRange: 80, attackCooldown: 0.9, attackDamage: 18, radius: 12 },
    abilities: {
      q: { name: 'Огненный шар', damageBase: 90, damagePerLevel: 40, cooldownBase: 6.0, cooldownGain: -0.4, cost: 60 },
      e: { name: 'Лечение', healBase: 110, healPerLevel: 35, cooldownBase: 8.0, cooldownGain: -0.5, cost: 50 }
    }
  },
  knight: {
    key: 'knight',
    title: 'Рыцарь',
    color: '#fca5a5',
    base: { maxHp: 620, maxMana: 260, manaRegen: 4, hpRegen: 2.6, speed: 112, attackRange: 65, attackCooldown: 0.7, attackDamage: 26, radius: 13 },
    abilities: {
      q: { name: 'Удар щитом', damageBase: 110, damagePerLevel: 35, cooldownBase: 7.0, cooldownGain: -0.4, cost: 55 },
      e: { name: 'Рывок-исцеление', healBase: 90, healPerLevel: 30, cooldownBase: 7.0, cooldownGain: -0.3, cost: 45 }
    }
  },
  ranger: {
    key: 'ranger',
    title: 'Стрелок',
    color: '#86efac',
    base: { maxHp: 520, maxMana: 300, manaRegen: 6, hpRegen: 1.8, speed: 126, attackRange: 100, attackCooldown: 0.85, attackDamage: 20, radius: 11 },
    abilities: {
      q: { name: 'Пронзающая стрела', damageBase: 80, damagePerLevel: 45, cooldownBase: 5.5, cooldownGain: -0.5, cost: 55 },
      e: { name: 'Самоисцеление', healBase: 100, healPerLevel: 28, cooldownBase: 7.5, cooldownGain: -0.4, cost: 45 }
    }
  }
};

export function createHeroFromDef(defKey, team, x, y) {
  const def = HERO_DEFS[defKey];
  if (!def) throw new Error(`Unknown hero def: ${defKey}`);
  const hero = new Hero({ team, x, y, ...def.base });
  hero.heroKey = def.key;
  hero.heroTitle = def.title;
  hero.themeColor = def.color;
  hero.abilityMeta = def.abilities;
  // Start at level 1 with 1 skill point, abilities locked (0)
  hero.level = 1; hero.xp = 0; hero.skillPoints = 1;
  hero.abilityLevelQ = 0; hero.abilityLevelE = 0; hero.maxAbilityLevel = 4;
  hero.updateAbilityTuning();
  return hero;
}

export function listHeroDefs() {
  return Object.values(HERO_DEFS).map((d) => ({ key: d.key, title: d.title, color: d.color }));
}

