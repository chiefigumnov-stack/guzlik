// moba.js
// Простая MOBA-система: команды, волны крипов, башни, базы, поиск целей

import * as THREE from "https://unpkg.com/three@0.160.1/build/three.module.js";
import { GLTFLoader } from "https://unpkg.com/three@0.160.1/examples/jsm/loaders/GLTFLoader.js";
import { Neutral } from "./moba_neutral.js";

export const Teams = { Radiant: 0, Dire: 1 };
export const TeamNeutral = 2;

export class MobaWorld {
  constructor({ scene, ui, arenaSize }) {
    this.scene = scene;
    this.ui = ui;
    this.arenaSize = arenaSize;
    this.loader = new GLTFLoader();

    this.units = []; // все боевые сущности (игрок, крипы, башни)
    this.creeps = [];
    this.towers = [];
    this.heroes = [];

    // Параметры баз
    this.baseHp = { [Teams.Radiant]: 1000, [Teams.Dire]: 1000 };
    this.basePositions = {
      [Teams.Radiant]: new THREE.Vector3(-22, 0, -22),
      [Teams.Dire]: new THREE.Vector3(22, 0, 22),
    };

    // Три линии: top, mid, bot (упрощённые точки)
    this.lanes = {
      mid: [
        new THREE.Vector3(-22, 0, -22),
        new THREE.Vector3(-10, 0, -10),
        new THREE.Vector3(0, 0, 0),
        new THREE.Vector3(10, 0, 10),
        new THREE.Vector3(22, 0, 22),
      ],
      top: [
        new THREE.Vector3(-22, 0, 22),
        new THREE.Vector3(-10, 0, 14),
        new THREE.Vector3(0, 0, 10),
        new THREE.Vector3(10, 0, 6),
        new THREE.Vector3(22, 0, 2),
      ],
      bot: [
        new THREE.Vector3(22, 0, -22),
        new THREE.Vector3(10, 0, -14),
        new THREE.Vector3(0, 0, -10),
        new THREE.Vector3(-10, 0, -6),
        new THREE.Vector3(-22, 0, -2),
      ],
    };

    // Волногенератор крипов
    this.waveTimer = 0;
    this.waveInterval = 15; // сек между волнами
    this.creepsPerWave = 4;

    // Создаём башни
    this.createTowers();
    this.createForest();
    this.spawnNeutralCamps();

    // Обновляем UI баз
    this.ui?.setBases?.(this.baseHp[Teams.Radiant], this.baseHp[Teams.Dire]);

    // Награды
    this.creepGold = 35;
    this.creepXP = 48;

    // Глобальная остановка времени (для ульты Антуана)
    this.globalStopTimer = 0;
  }

  registerUnit(unit) {
    this.units.push(unit);
    if (unit.unitType === 'hero') this.heroes.push(unit);
  }

  unregisterUnit(unit) {
    const idx = this.units.indexOf(unit);
    if (idx >= 0) this.units.splice(idx, 1);
    if (unit.unitType === 'hero') {
      const hi = this.heroes.indexOf(unit);
      if (hi >= 0) this.heroes.splice(hi, 1);
    }
  }

  getEnemiesAround(position, myTeam, radius) {
    const enemies = [];
    for (const u of this.units) {
      if (u.team === myTeam) continue;
      if (u.isDead?.()) continue;
      const d = position.distanceTo(u.position);
      if (d <= radius) enemies.push(u);
    }
    return enemies;
  }

  applyDamageToBase(team, dmg) {
    this.baseHp[team] = Math.max(0, this.baseHp[team] - dmg);
    this.ui?.setBases?.(this.baseHp[Teams.Radiant], this.baseHp[Teams.Dire]);
  }

  isBaseDestroyed(team) {
    return this.baseHp[team] <= 0;
  }

  createTowers() {
    const positions = {
      mid: { r: new THREE.Vector3(-12, 0, -12), d: new THREE.Vector3(12, 0, 12) },
      top: { r: new THREE.Vector3(-16, 0, 10), d: new THREE.Vector3(16, 0, 4) },
      bot: { r: new THREE.Vector3(-4, 0, -16), d: new THREE.Vector3(4, 0, -10) },
    };
    for (const lane of Object.keys(positions)) {
      const rPos = positions[lane].r;
      const dPos = positions[lane].d;
      const rTower = new Tower({ scene: this.scene, world: this, loader: this.loader, team: Teams.Radiant, position: rPos, lane });
      const dTower = new Tower({ scene: this.scene, world: this, loader: this.loader, team: Teams.Dire, position: dPos, lane });
      this.towers.push(rTower, dTower);
      this.registerUnit(rTower);
      this.registerUnit(dTower);
    }
  }

  spawnWave(team) {
    const start = this.basePositions[team];
    const lanesOrder = ["mid", "top", "bot"];
    for (const lane of lanesOrder) {
      const laneWps = this.lanes[lane];
      const wp = team === Teams.Radiant ? laneWps.slice(1) : laneWps.slice(0, -1).reverse();
      for (let i = 0; i < this.creepsPerWave; i++) {
        const offset = (i - (this.creepsPerWave - 1) / 2) * 0.8;
        const spawn = new THREE.Vector3(start.x + offset, 0, start.z + offset);
        const creep = new Creep({ scene: this.scene, world: this, loader: this.loader, team, position: spawn, waypoints: wp });
        creep.unitType = "creep";
        this.creeps.push(creep);
        this.registerUnit(creep);
      }
    }
  }

  createForest() {
    // Простая генерация деревьев в зонах между линиями
    const trees = new THREE.Group();
    const makeTree = (x,z) => {
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.2, 1.2, 8), new THREE.MeshStandardMaterial({ color: 0x6d4c41 }));
      trunk.position.set(x, 0.6, z);
      trunk.castShadow = true; trunk.receiveShadow = true;
      const crown = new THREE.Mesh(new THREE.ConeGeometry(0.9, 1.2, 8), new THREE.MeshStandardMaterial({ color: 0x2e7d32 }));
      crown.position.set(x, 1.6, z);
      crown.castShadow = true; crown.receiveShadow = true;
      trees.add(trunk); trees.add(crown);
    };
    const half = this.arenaSize/2 - 2;
    for (let x=-half+2; x<=half-2; x+=4) {
      for (let z=-half+2; z<=half-2; z+=6) {
        // избегаем полос вокруг линий
        if (Math.abs(x - z) < 3 || Math.abs(x + z) < 3) continue;
        if (Math.random() < 0.35) makeTree(x,z);
      }
    }
    trees.name = 'Forest';
    this.scene.add(trees);
  }

  spawnNeutralCamps() {
    // Несколько точек лагерей
    this.neutrals = [];
    const camps = [ new THREE.Vector3(-10,0,14), new THREE.Vector3(12,0,-12) ];
    for (const p of camps) {
      const n = new Neutral({ scene: this.scene, world: this, loader: this.loader, position: p });
      this.neutrals.push(n); this.registerUnit(n);
    }
  }

  update(dt, player) {
    // Глобальная пауза: когда активна — только рендер/таймер
    if (this.globalStopTimer > 0) {
      this.globalStopTimer = Math.max(0, this.globalStopTimer - dt);
      return;
    }
    // Волны
    this.waveTimer -= dt;
    if (this.waveTimer <= 0) {
      this.waveTimer = this.waveInterval;
      this.spawnWave(Teams.Radiant);
      this.spawnWave(Teams.Dire);
      this.ui?.announce?.("Новая волна!");
    }

    // Обновление башен
    for (const t of this.towers) t.update(dt);
    // Обновление крипов
    for (let i = this.creeps.length - 1; i >= 0; i--) {
      const c = this.creeps[i];
      c.update(dt);
      if (c.isDead()) {
        c.dispose();
        this.creeps.splice(i, 1);
        this.unregisterUnit(c);
      }
    }

    // Обновление нейтралов
    if (this.neutrals) {
      for (let i = this.neutrals.length - 1; i >= 0; i--) {
        const n = this.neutrals[i];
        n.update(dt);
        if (n.isDead()) {
          n.dispose();
          this.neutrals.splice(i, 1);
          this.unregisterUnit(n);
        }
      }
    }

    // Проверка победы
    if (this.isBaseDestroyed(Teams.Radiant)) {
      this.ui?.announce?.("Поражение: разрушена база Radiant");
    } else if (this.isBaseDestroyed(Teams.Dire)) {
      this.ui?.announce?.("Победа: разрушена база Dire");
    }
    // Простая ИИ логика героя Dire: следовать на мид и атаковать ближайшее
    this.ensureEnemyHero();
    if (this.enemyHero) this.updateEnemyHero(dt);
  }

  onCreepKilled(attacker, creep) {
    if (!attacker) return;
    if (attacker.unitType === 'hero') {
      attacker.grantGold?.(this.creepGold);
      attacker.grantXP?.(this.creepXP);
      this.ui?.announce?.(`+${this.creepGold} золота, +${this.creepXP} XP`);
    }
  }

  onNeutralKilled(attacker, neutral) {
    if (!attacker) return;
    if (attacker.unitType === 'hero') {
      attacker.addHaste?.(6);
      attacker.addRegen?.(6);
      this.ui?.announce?.(`Бафф леса: скорость и реген (6с)`);
    }
  }

  ensureEnemyHero() {
    if (this.enemyHero) return;
    // заспаунить примитивного героя Dire в базе
    const h = new AIHero({ scene: this.scene, world: this, team: Teams.Dire, position: this.basePositions[Teams.Dire].clone() });
    this.enemyHero = h;
    this.registerUnit(h);
  }

  updateEnemyHero(dt) {
    this.enemyHero.update(dt);
  }

  spawnDemons(caster, count, life, ability) {
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2;
      const pos = caster.group.position.clone().add(new THREE.Vector3(Math.cos(angle) * 2, 0, Math.sin(angle) * 2));
      const d = new Creep({ scene: this.scene, world: this, loader: this.loader, team: caster.team, position: pos, waypoints: [] });
      d.unitType = 'creep';
      d.speed = 4.5; d.damage = 22; d.hp = d.maxHp = 240; d.aggroRadius = 8.0; d.range = 2.0; d.attackCooldown = 1.0;
      d._lifeTimer = life;
      const oldUpdate = d.update.bind(d);
      d.update = (dt2) => { d._lifeTimer -= dt2; if (d._lifeTimer <= 0) { d.hp = 0; } oldUpdate(dt2); };
      this.creeps.push(d);
      this.registerUnit(d);
    }
  }
}

class Creep {
  constructor({ scene, world, loader, team, position, waypoints }) {
    this.scene = scene;
    this.world = world;
    this.loader = loader;
    this.team = team;
    this.position = position.clone();
    this.waypoints = waypoints.map(p => p.clone());
    this.currentWpIndex = 0;

    this.speed = 3.2;
    this.hp = 220;
    this.maxHp = 220;
    this.damage = 18;
    this.range = 2.2;
    this.aggroRadius = 6.0;
    this.attackCooldown = 1.0;
    this.attackTimer = 0;

    this.group = new THREE.Group();
    this.group.position.copy(this.position);
    this.root = new THREE.Group();
    this.group.add(this.root);
    this.loadModel();
    this.healthBar = this.createHealthBar(1.2, 0.12);
    this.healthBar.position.set(0, 1.6, 0);
    this.group.add(this.healthBar);
    this.scene.add(this.group);
  }

  loadModel() {
    const url = "https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/master/2.0/Box/glTF/Box.gltf";
    this.loader.load(url, (gltf) => {
      const model = gltf.scene || gltf.scenes?.[0];
      if (model) {
        model.traverse(o=>{ if (o.isMesh){ o.castShadow=true; o.receiveShadow=true; }});
        const box = new THREE.Box3().setFromObject(model); const size = new THREE.Vector3(); box.getSize(size);
        const scale = 1.0 / Math.max(size.x, size.y, size.z);
        model.scale.setScalar(scale);
        this.root.add(model);
      }
    });
  }

  createMesh() {
    const g = new THREE.BoxGeometry(0.8, 1.2, 0.8);
    const color = this.team === Teams.Radiant ? 0x4caf50 : 0xe53935;
    const m = new THREE.MeshStandardMaterial({ color, metalness: 0.1, roughness: 0.9 });
    const mesh = new THREE.Mesh(g, m);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    return mesh;
  }

  createHealthBar(width, height) {
    const group = new THREE.Group();
    const bg = new THREE.Mesh(new THREE.PlaneGeometry(width, height), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.5, depthWrite: false }));
    const fg = new THREE.Mesh(new THREE.PlaneGeometry(width, height), new THREE.MeshBasicMaterial({ color: 0xff6666, transparent: true, opacity: 0.9, depthWrite: false }));
    fg.position.z = 0.001;
    group.add(bg);
    group.add(fg);
    group.userData = { fg, width };
    group.renderOrder = 999;
    return group;
  }

  updateHpBar() {
    const ratio = Math.max(0, this.hp / this.maxHp);
    const fg = this.healthBar.userData.fg;
    const fullWidth = this.healthBar.userData.width;
    fg.scale.x = Math.max(0.0001, ratio);
    fg.position.x = -fullWidth * (1 - ratio) / 2;
  }

  isDead() { return this.hp <= 0; }

  applyDamage(v, attacker) {
    this.hp = Math.max(0, this.hp - v);
    this.updateHpBar();
    if (this.hp <= 0) {
      this.world?.onCreepKilled?.(attacker, this);
    }
  }

  acquireTarget() {
    const enemies = this.world.getEnemiesAround(this.group.position, this.team, this.aggroRadius);
    if (enemies.length === 0) return null;
    // Ближайший
    enemies.sort((a, b) => this.group.position.distanceTo(a.position) - this.group.position.distanceTo(b.position));
    return enemies[0];
  }

  moveTowards(targetPos, dt) {
    const dir = new THREE.Vector3().subVectors(targetPos, this.group.position);
    dir.y = 0;
    const dist = dir.length();
    if (dist < 0.01) return;
    dir.normalize();
    this.group.position.addScaledVector(dir, this.speed * dt);
    this.group.rotation.y = Math.atan2(dir.x, dir.z);
  }

  update(dt) {
    this.attackTimer = Math.max(0, this.attackTimer - dt);
    // Билбординг
    // Примем, что камера сверху, поэтому повернем бар к (0,0,1)
    // В простоте: оставить как есть

    const target = this.acquireTarget();
    if (target) {
      const dist = this.group.position.distanceTo(target.position);
      if (dist <= this.range) {
        if (this.attackTimer <= 0) {
          this.attackTimer = this.attackCooldown;
          target.applyDamage?.(this.damage, this);
        }
      } else {
        this.moveTowards(target.position, dt);
      }
      return;
    }

    // Нет врага — идём по вейпоинтам к вражеской базе
    if (this.currentWpIndex < this.waypoints.length) {
      const wp = this.waypoints[this.currentWpIndex];
      const dist = this.group.position.distanceTo(wp);
      if (dist < 0.5) this.currentWpIndex++;
      else this.moveTowards(wp, dt);
    } else {
      // Бьем базу противника
      const enemyTeam = this.team === Teams.Radiant ? Teams.Dire : Teams.Radiant;
      const basePos = this.world.basePositions[enemyTeam];
      const dist = this.group.position.distanceTo(basePos);
      if (dist <= this.range + 0.5) {
        if (this.attackTimer <= 0) {
          this.attackTimer = this.attackCooldown;
          this.world.applyDamageToBase(enemyTeam, this.damage);
        }
      } else {
        this.moveTowards(basePos, dt);
      }
    }
  }

  dispose() {
    this.scene.remove(this.group);
  }
}

class Tower {
  constructor({ scene, world, loader, team, position }) {
    this.scene = scene;
    this.world = world;
    this.loader = loader;
    this.team = team;
    this.position = position.clone();
    this.range = 12;
    this.damage = 40;
    this.attackCooldown = 1.4;
    this.attackTimer = 0;
    this.hp = 1000;
    this.maxHp = 1000;

    this.group = new THREE.Group();
    this.group.position.copy(this.position);
    this.loadModel();
    scene.add(this.group);
  }

  loadModel() {
    const url = "https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/master/2.0/CesiumMan/glTF/CesiumMan.gltf";
    this.loader.load(url, (gltf) => {
      const model = gltf.scene || gltf.scenes?.[0];
      if (model) {
        model.traverse(o=>{ if (o.isMesh){ o.castShadow=true; o.receiveShadow=true; }});
        const box = new THREE.Box3().setFromObject(model); const size = new THREE.Vector3(); box.getSize(size);
        const scale = 1.8 / Math.max(size.x, size.y, size.z);
        model.scale.setScalar(scale);
        this.group.add(model);
      }
    });
  }

  isDead() { return this.hp <= 0; }

  applyDamage(v) {
    this.hp = Math.max(0, this.hp - v);
  }

  acquireTarget() {
    const enemies = this.world.getEnemiesAround(this.group.position, this.team, this.range);
    if (enemies.length === 0) return null;
    // Приоритет: крипы, затем герои/башни
    enemies.sort((a, b) => (this.typePriority(a) - this.typePriority(b)) || (this.group.position.distanceTo(a.position) - this.group.position.distanceTo(b.position)));
    return enemies[0];
  }

  typePriority(u) {
    // Крип (0) < герой (1) < башня (2)
    const t = u.unitType || "unknown";
    if (t === "creep") return 0;
    if (t === "hero") return 1;
    if (t === "tower") return 2;
    return 3;
  }

  update(dt) {
    this.attackTimer = Math.max(0, this.attackTimer - dt);
    const target = this.acquireTarget();
    if (target && this.attackTimer <= 0) {
      this.attackTimer = this.attackCooldown;
      target.applyDamage?.(this.damage, this);
    }
  }
}

class AIHero {
  constructor({ scene, world, team, position }) {
    this.scene = scene; this.world = world; this.team = team;
    this.position = position.clone();
    this.unitType = 'hero';
    this.range = 3.5; this.damage = 24; this.speed = 8;
    this.hp = 700; this.maxHp = 700;
    this.group = new THREE.Group(); this.group.position.copy(this.position);
    const mesh = new THREE.Mesh(new THREE.CapsuleGeometry(0.5, 1.2, 4, 12), new THREE.MeshStandardMaterial({ color: 0x3949ab }));
    mesh.castShadow = true; mesh.receiveShadow = true; this.group.add(mesh);
    this.scene.add(this.group);
  }

  isDead() { return this.hp <= 0; }
  applyDamage(v) { this.hp = Math.max(0, this.hp - v); }

  acquireTarget() {
    const enemies = this.world.getEnemiesAround(this.group.position, this.team, 8);
    if (enemies.length === 0) return null;
    enemies.sort((a,b) => this.group.position.distanceTo(a.position) - this.group.position.distanceTo(b.position));
    return enemies[0];
  }

  moveTowards(pos, dt) {
    const dir = new THREE.Vector3().subVectors(pos, this.group.position); dir.y = 0;
    const d = dir.length(); if (d < 0.05) return; dir.normalize();
    this.group.position.addScaledVector(dir, this.speed * dt);
    this.group.rotation.y = Math.atan2(dir.x, dir.z);
  }

  update(dt) {
    // идём к центру, если нет цели
    const target = this.acquireTarget();
    if (target) {
      const dist = this.group.position.distanceTo(target.position);
      if (dist <= this.range) target.applyDamage?.(this.damage, this); else this.moveTowards(target.position, dt);
    } else {
      this.moveTowards(new THREE.Vector3(0,0,0), dt);
    }
  }
}

