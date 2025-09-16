// abilities.js
// Система способностей: регистрация, каста, проверка маны/кд, эффекты

import * as THREE from "https://unpkg.com/three@0.160.1/build/three.module.js";

// Типы: Skillshot, Targeted, AoE, Passive

export class AbilitySystem {
  constructor({ projectiles }) {
    this.projectiles = projectiles;
  }

  canCast(caster, ability) {
    if (!ability) return false;
    if (ability.timer && ability.timer > 0) return false;
    if (ability.manaCost && (caster.mana ?? 0) < ability.manaCost) return false;
    return true;
  }

  spendResources(caster, ability) {
    if (ability.manaCost) {
      caster.mana = Math.max(0, (caster.mana ?? 0) - ability.manaCost);
      caster.ui?.setMana?.(caster.mana, caster.maxMana ?? 0);
    }
    ability.timer = ability.cooldown || 0;
  }

  cast(caster, key, abilityMap, world) {
    const ability = abilityMap[key];
    if (!this.canCast(caster, ability)) return false;

    const type = ability.type;
    // Специализированные типы Антуана
    if (type === 'GlobalStop') {
      // Останавливаем всё на карте на duration секунд
      world.globalStopTimer = Math.max(world.globalStopTimer || 0, ability.duration || 2.5);
      caster.ui?.announce?.(`${ability.name}`);
      this.spendResources(caster, ability);
      return true;
    }

    if (type === 'Slash') {
      // Конусовидный удар перед героем
      const forward = new THREE.Vector3(0,0,1).applyEuler(new THREE.Euler(0, caster.group.rotation.y, 0));
      const center = caster.group.position.clone().addScaledVector(forward, ability.range || 2.0);
      const radius = ability.radius || 2.0;
      const coneDot = Math.cos((ability.angleDeg || 80) * Math.PI/180);
      for (const u of world.units) {
        if (u.team === caster.team) continue;
        if (!u.position) continue;
        const toU = new THREE.Vector3().subVectors(u.position, caster.group.position); toU.y = 0;
        const dist = toU.length();
        if (dist <= (ability.range || 2.5) + radius) {
          toU.normalize();
          const dot = forward.dot(toU);
          if (dot >= coneDot) {
            u.applyDamage?.(ability.damage || 90, caster);
          }
        }
      }
      caster.ui?.announce?.(`${ability.name}`);
      this.spendResources(caster, ability);
      return true;
    }

    if (type === 'Dash') {
      const dir = new THREE.Vector3(0,0,1).applyEuler(new THREE.Euler(0, caster.group.rotation.y, 0));
      const distance = ability.distance || 5;
      caster.group.position.addScaledVector(dir, distance);
      // Кламп в арену, если есть
      if (caster.clampToArena) {
        const p = caster.group.position.clone();
        caster.clampToArena(p);
        caster.group.position.copy(p);
      }
      caster.ui?.announce?.(`${ability.name}`);
      this.spendResources(caster, ability);
      return true;
    }

    if (type === 'Summon') {
      const count = ability.count || 3;
      const life = ability.life || 12;
      world.spawnDemons?.(caster, count, life, ability);
      caster.ui?.announce?.(`${ability.name}`);
      this.spendResources(caster, ability);
      return true;
    }
    if (type === 'Skillshot') {
      // Стандартный фаерболл
      const dir = new THREE.Vector3(0,0,1).applyEuler(new THREE.Euler(0, caster.group.rotation.y, 0));
      const pos = caster.group.position.clone().add(new THREE.Vector3(0, 1.2, 0)).addScaledVector(dir, 1.0);
      const radius = ability.radius ?? 0.5;
      const speed = ability.speed ?? 18;
      this.projectiles.spawn({
        position: pos,
        velocity: dir.multiplyScalar(speed),
        radius,
        life: ability.life ?? 2.5,
        team: caster.team,
        onHit: (unit) => {
          if (unit && unit.applyDamage) {
            const dmg = ability.damage ?? 100;
            unit.applyDamage(dmg, caster);
          }
        }
      });
      caster.ui?.announce?.(`${ability.name}`);
      this.spendResources(caster, ability);
      return true;
    }

    if (type === 'Targeted') {
      // Само-таргет или по текущей цели
      const target = caster.attackTarget ?? caster;
      const dmg = ability.damage ?? 0;
      const heal = ability.heal ?? 0;
      if (heal && target) {
        target.hp = Math.min(target.maxHp || target.hp + heal, (target.maxHp ?? target.hp + heal));
        target.updateHpBar?.();
        caster.ui?.setHP?.(caster.hp);
      }
      if (dmg && target?.applyDamage) target.applyDamage(dmg, caster);
      caster.ui?.announce?.(`${ability.name}`);
      this.spendResources(caster, ability);
      return true;
    }

    if (type === 'AoE') {
      // Простейший AoE вокруг героя
      const center = caster.group.position;
      const radius = ability.radius ?? 3.0;
      const damage = ability.damage ?? 60;
      for (const u of world.units) {
        if (u.team === caster.team) continue;
        if (!u.position) continue;
        if (u.position.distanceTo(center) <= radius) {
          u.applyDamage?.(damage, caster);
        }
      }
      caster.ui?.announce?.(`${ability.name}`);
      this.spendResources(caster, ability);
      return true;
    }

    if (type === 'Passive') {
      // Пассивки вешаются при создании героя — здесь ничего
      return false;
    }

    return false;
  }
}

// Наборы способностей
export function createDefaultAbilities() {
  return {
    Q: { key: 'Q', name: 'Fireball', type: 'Skillshot', damage: 120, range: 8, radius: 0.6, cooldown: 6, manaCost: 60, effects: ['particle: flame', 'sound: firecast'], speed: 20, life: 3.0, timer: 0 },
    W: { key: 'W', name: 'Heal', type: 'Targeted', heal: 120, cooldown: 10, manaCost: 70, effects: ['particle: heal', 'sound: heal'], timer: 0 },
    E: { key: 'E', name: 'Shout (AoE)', type: 'AoE', damage: 60, radius: 3.5, cooldown: 8, manaCost: 50, effects: ['particle: shock'], timer: 0 },
    R: { key: 'R', name: 'Blink', type: 'Targeted', cooldown: 18, manaCost: 90, effects: ['teleport'], timer: 0 },
  };
}

export function createAbilitiesForHero(heroKey) {
  if (heroKey === 'CM-01') {
    return {
      Q: { key: 'Q', name: 'Взмах шпаги', type: 'Slash', damage: 110, range: 2.2, radius: 2.0, angleDeg: 100, cooldown: 5, manaCost: 40, effects: ['particle: slash'], timer: 0 },
      W: { key: 'W', name: 'Рывок', type: 'Dash', distance: 5.5, cooldown: 8, manaCost: 50, effects: ['trail: dash'], timer: 0 },
      E: { key: 'E', name: 'Призыв демонов', type: 'Summon', count: 3, life: 14, cooldown: 20, manaCost: 90, effects: ['summon: demon'], timer: 0 },
      R: { key: 'R', name: 'Стоп времени', type: 'GlobalStop', duration: 2.5, cooldown: 60, manaCost: 120, effects: ['screen: freeze'], timer: 0 },
    };
  }
  return createDefaultAbilities();
}

