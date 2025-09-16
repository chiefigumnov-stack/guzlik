import { distance, distanceSquared, normalize, generateId, angle } from './utils.js';

export const TEAM_RADIANT = 0;
export const TEAM_DIRE = 1;

export class Entity {
  constructor(params) {
    this.id = generateId();
    this.type = params.type || 'entity';
    this.team = params.team ?? TEAM_RADIANT;
    this.x = params.x || 0;
    this.y = params.y || 0;
    this.radius = params.radius || 10;
    this.maxHp = params.maxHp || 100;
    this.hp = this.maxHp;
    this.alive = true;
    this.speed = params.speed || 0;
    this.attackRange = params.attackRange || 40;
    this.attackDamage = params.attackDamage || 10;
    this.attackCooldown = params.attackCooldown || 1.0;
    this.attackCooldownRemaining = 0;
    this.targetId = null;
    this.blocking = !!params.blocking; // for buildings
    this.onDeath = params.onDeath || null;
  }

  isEnemy(other) { return other && other.team !== this.team; }

  takeDamage(amount, source) {
    if (!this.alive) return;
    this.hp -= amount;
    if (this.hp <= 0) {
      this.alive = false;
      if (this.onDeath) this.onDeath(this, source);
    }
  }

  update(dt, world) {
    if (!this.alive) return;
    if (this.attackCooldownRemaining > 0) this.attackCooldownRemaining -= dt;
  }

  tryAcquireTarget(world, maxDist = this.attackRange + 10) {
    let best = null;
    let bestDist2 = Infinity;
    for (const e of world.entities) {
      if (!e.alive || !this.isEnemy(e)) continue;
      const d2 = distanceSquared(this.x, this.y, e.x, e.y);
      if (d2 < bestDist2 && d2 <= maxDist * maxDist) {
        bestDist2 = d2; best = e;
      }
    }
    this.targetId = best ? best.id : null;
    return best;
  }

  getTarget(world) {
    return world.entities.find((e) => e.id === this.targetId);
  }
}

export class Projectile extends Entity {
  constructor(params) {
    super({ ...params, type: 'projectile', radius: 3, maxHp: 1 });
    this.speed = params.speed || 300;
    this.damage = params.damage || 10;
    this.lifetime = params.lifetime || 3;
    this.vx = params.vx || 0;
    this.vy = params.vy || 0;
    this.sourceId = params.sourceId || null;
    this.homingTargetId = params.homingTargetId || null;
  }

  update(dt, world) {
    this.lifetime -= dt; if (this.lifetime <= 0) { this.alive = false; return; }
    if (this.homingTargetId) {
      const t = world.entities.find((e) => e.id === this.homingTargetId && e.alive);
      if (t) {
        const dir = normalize(t.x - this.x, t.y - this.y);
        this.vx = dir.x * this.speed; this.vy = dir.y * this.speed;
      }
    }
    this.x += this.vx * dt; this.y += this.vy * dt;
    // Collision
    for (const e of world.entities) {
      if (!e.alive || e.type === 'projectile' || e.id === this.sourceId) continue;
      if (!this.isEnemy(e)) continue;
      const d = distance(this.x, this.y, e.x, e.y);
      if (d <= (this.radius + e.radius)) {
        e.takeDamage(this.damage, this);
        // mark last hit attribution
        const src = world.entities.find((x) => x.id === this.sourceId);
        if (src) e._lastHitBy = src;
        this.alive = false; break;
      }
    }
  }
}

export class Unit extends Entity {
  constructor(params) {
    super({ ...params, type: 'unit' });
    this.moveTargetX = this.x;
    this.moveTargetY = this.y;
    this.moveTolerance = params.moveTolerance || 8;
  }

  setMoveTarget(x, y) { this.moveTargetX = x; this.moveTargetY = y; }

  update(dt, world) {
    super.update(dt, world);
    if (!this.alive) return;
    // Movement
    const dx = this.moveTargetX - this.x;
    const dy = this.moveTargetY - this.y;
    const dist = Math.hypot(dx, dy);
    if (dist > this.moveTolerance && this.speed > 0) {
      const dir = { x: dx / dist, y: dy / dist };
      const step = this.speed * dt;
      if (step < dist) { this.x += dir.x * step; this.y += dir.y * step; } else { this.x = this.moveTargetX; this.y = this.moveTargetY; }
    }
    // Auto attack
    let target = this.getTarget(world);
    if (!target || !target.alive || distance(this.x, this.y, target.x, target.y) > this.attackRange + 2) {
      target = this.tryAcquireTarget(world, this.attackRange + 2);
    }
    if (target && this.attackCooldownRemaining <= 0) {
      this.performAttack(target, world);
    }
  }

  performAttack(target, world) {
    this.attackCooldownRemaining = this.attackCooldown;
    const ang = angle(this.x, this.y, target.x, target.y);
    const vx = Math.cos(ang) * 400; const vy = Math.sin(ang) * 400;
    world.spawn(new Projectile({ team: this.team, x: this.x, y: this.y, vx, vy, speed: 400, damage: this.attackDamage, sourceId: this.id, lifetime: 2 }));
  }
}

export class Hero extends Unit {
  constructor(params) {
    super({ ...params, type: 'hero' });
    this.maxHp = params.maxHp || 500; this.hp = this.maxHp;
    this.maxMana = params.maxMana || 300; this.mana = this.maxMana;
    this.manaRegen = params.manaRegen || 6; // per sec
    this.hpRegen = params.hpRegen || 2; // per sec
    this.speed = params.speed || 120;
    this.attackRange = params.attackRange || 70;
    this.attackCooldown = params.attackCooldown || 0.8;
    this.attackDamage = params.attackDamage || 22;
    this.radius = params.radius || 12;
    // Abilities (default; can be overridden by hero def)
    this.abilityQCost = 60; this.abilityQCooldown = 6; this.abilityQCooldownRemaining = 0; // fireball
    this.abilityECost = 50; this.abilityECooldown = 8; this.abilityECooldownRemaining = 0; // heal
    // Progression
    this.level = 1; this.xp = 0; this.skillPoints = 0;
    this.abilityLevelQ = 1; this.abilityLevelE = 1; this.maxAbilityLevel = 4;
    this.abilityMeta = null; // from hero def
    this.heroKey = 'default'; this.heroTitle = 'Герой'; this.themeColor = '#93c5fd';
  }

  update(dt, world) {
    super.update(dt, world);
    if (!this.alive) return;
    this.mana = Math.min(this.maxMana, this.mana + this.manaRegen * dt);
    this.hp = Math.min(this.maxHp, this.hp + this.hpRegen * dt);
    if (this.abilityQCooldownRemaining > 0) this.abilityQCooldownRemaining -= dt;
    if (this.abilityECooldownRemaining > 0) this.abilityECooldownRemaining -= dt;
  }

  castQ(world, targetX, targetY) {
    if (this.abilityQCooldownRemaining > 0 || this.mana < this.abilityQCost) return false;
    this.mana -= this.abilityQCost; this.abilityQCooldownRemaining = this.abilityQCooldown;
    const dir = normalize(targetX - this.x, targetY - this.y);
    const meta = this.abilityMeta ? this.abilityMeta.q : null;
    const damage = meta ? meta.damageBase + (this.abilityLevelQ - 1) * meta.damagePerLevel : 120;
    world.spawn(new Projectile({ team: this.team, x: this.x, y: this.y, vx: dir.x * 520, vy: dir.y * 520, speed: 520, damage, sourceId: this.id, lifetime: 2.2 }));
    return true;
  }

  castE(world) {
    if (this.abilityECooldownRemaining > 0 || this.mana < this.abilityECost) return false;
    this.mana -= this.abilityECost; this.abilityECooldownRemaining = this.abilityECooldown;
    const meta = this.abilityMeta ? this.abilityMeta.e : null;
    const heal = meta ? meta.healBase + (this.abilityLevelE - 1) * meta.healPerLevel : 140;
    this.hp = Math.min(this.maxHp, this.hp + heal);
    return true;
  }

  updateAbilityTuning() {
    if (!this.abilityMeta) return;
    const q = this.abilityMeta.q, e = this.abilityMeta.e;
    this.abilityQCooldown = Math.max(2, q.cooldownBase + (this.abilityLevelQ - 1) * (q.cooldownGain || 0));
    this.abilityQCost = q.cost;
    this.abilityECooldown = Math.max(2, e.cooldownBase + (this.abilityLevelE - 1) * (e.cooldownGain || 0));
    this.abilityECost = e.cost;
  }

  grantXP(amount) {
    this.xp += amount;
    while (this.xp >= this.xpToNextLevel()) {
      this.xp -= this.xpToNextLevel();
      this.level++;
      this.skillPoints++;
      this.maxHp += 40; this.hp = Math.min(this.maxHp, this.hp + 40);
      this.attackDamage += 2;
    }
  }

  xpToNextLevel() {
    return 100 + (this.level - 1) * 50;
  }

  tryUpgradeAbility(which) {
    if (this.skillPoints <= 0) return false;
    if (which === 'q' && this.abilityLevelQ < this.maxAbilityLevel) { this.abilityLevelQ++; this.skillPoints--; this.updateAbilityTuning(); return true; }
    if (which === 'e' && this.abilityLevelE < this.maxAbilityLevel) { this.abilityLevelE++; this.skillPoints--; this.updateAbilityTuning(); return true; }
    return false;
  }
}

export class Creep extends Unit {
  constructor(params) {
    super({ ...params, type: 'creep' });
    this.speed = params.speed || 80;
    this.attackRange = params.attackRange || 45;
    this.attackCooldown = params.attackCooldown || 1.2;
    this.attackDamage = params.attackDamage || 12;
    this.radius = params.radius || 10;
    this.path = params.path || [];
    this.pathIndex = 0;
    this.goldBounty = params.goldBounty || 35;
  }

  update(dt, world) {
    super.update(dt, world);
    if (!this.alive) return;
    // Follow path if no move target set by combat
    if (this.path && this.path.length > 0) {
      const target = this.path[this.pathIndex];
      this.setMoveTarget(target.x, target.y);
      if (distance(this.x, this.y, target.x, target.y) < 12) {
        if (this.pathIndex < this.path.length - 1) this.pathIndex++; else this.speed = 0;
      }
    }
  }
}

export class Building extends Entity {
  constructor(params) {
    super({ ...params, type: 'building', blocking: true });
    this.radius = params.radius || 24;
  }
}

export class Tower extends Building {
  constructor(params) {
    super({ ...params, type: 'tower' });
    this.attackRange = params.attackRange || 220;
    this.attackCooldown = params.attackCooldown || 1.0;
    this.attackDamage = params.attackDamage || 24;
  }

  update(dt, world) {
    super.update(dt, world);
    if (!this.alive) return;
    let target = this.getTarget(world);
    if (!target || !target.alive || distance(this.x, this.y, target.x, target.y) > this.attackRange)
      target = this.tryAcquireTarget(world, this.attackRange);
    if (target && this.attackCooldownRemaining <= 0) {
      this.attackCooldownRemaining = this.attackCooldown;
      const ang = angle(this.x, this.y, target.x, target.y);
      const vx = Math.cos(ang) * 520; const vy = Math.sin(ang) * 520;
      world.spawn(new Projectile({ team: this.team, x: this.x, y: this.y, vx, vy, speed: 520, damage: this.attackDamage, sourceId: this.id, lifetime: 2 }));
    }
  }
}

