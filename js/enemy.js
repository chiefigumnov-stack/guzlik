// enemy.js
// Враги: спавнятся каждые 3 секунды на краю карты, идут к игроку, дамажат при касании
// Модель: GLTF BoomBox как заглушка, хелсбар над каждым врагом

import * as THREE from "https://unpkg.com/three@0.160.1/build/three.module.js";
import { GLTFLoader } from "https://unpkg.com/three@0.160.1/examples/jsm/loaders/GLTFLoader.js";

const ENEMY_URL = "https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/master/2.0/BoomBox/glTF/BoomBox.gltf";

function createHealthBar(width = 1.6, height = 0.16) {
  const group = new THREE.Group();
  const bgGeom = new THREE.PlaneGeometry(width, height);
  const bgMat = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.5, depthWrite: false });
  const bg = new THREE.Mesh(bgGeom, bgMat);
  const fgGeom = new THREE.PlaneGeometry(width, height);
  const fgMat = new THREE.MeshBasicMaterial({ color: 0xff5555, transparent: true, opacity: 0.9, depthWrite: false });
  const fg = new THREE.Mesh(fgGeom, fgMat);
  fg.position.z = 0.001;
  group.add(bg);
  group.add(fg);
  group.userData = { fg, width };
  group.renderOrder = 999;
  return group;
}

class Enemy {
  constructor({ scene, loader, position }) {
    this.scene = scene;
    this.loader = loader || new GLTFLoader();
    this.position = position.clone();
    this.speed = 6 + Math.random() * 2;
    this.damage = 12;
    this.radius = 0.8; // радиус коллизии
    this.hp = 80;
    this.maxHp = 80;

    this.group = new THREE.Group();
    this.group.position.copy(this.position);
    this.group.name = "Enemy";
    this.scene.add(this.group);

    // Модель
    this.root = new THREE.Group();
    this.group.add(this.root);
    this.loadModel(ENEMY_URL);

    // Хелсбар
    this.healthBar = createHealthBar(1.6, 0.16);
    this.healthBar.position.set(0, 2.2, 0);
    this.group.add(this.healthBar);
    this.updateHpBar();
  }

  loadModel(url) {
    this.loader.load(url, (gltf) => {
      const model = gltf.scene || gltf.scenes?.[0];
      if (model) {
        model.traverse((obj) => {
          if (obj.isMesh) {
            obj.castShadow = true;
            obj.receiveShadow = true;
          }
        });
        // Поджать размеры
        const box = new THREE.Box3().setFromObject(model);
        const size = new THREE.Vector3();
        box.getSize(size);
        const scale = 1.1 / Math.max(size.x, size.y, size.z);
        model.scale.setScalar(scale);
        model.position.set(0, 0, 0);
        this.root.add(model);
      }
    });
  }

  updateHpBar() {
    const ratio = Math.max(0, this.hp / this.maxHp);
    const fg = this.healthBar.userData.fg;
    const fullWidth = this.healthBar.userData.width;
    fg.scale.x = Math.max(0.0001, ratio);
    fg.position.x = -fullWidth * (1 - ratio) / 2;
  }

  applyDamage(v) {
    this.hp = Math.max(0, this.hp - v);
    this.updateHpBar();
  }

  isDead() { return this.hp <= 0; }

  update(dt, player, camera) {
    // Билбординг хелсбара
    this.healthBar.quaternion.copy(camera.quaternion);

    // Преследование игрока
    const dir = new THREE.Vector3().subVectors(player.position, this.group.position);
    dir.y = 0;
    const dist = dir.length();
    if (dist > 0.0001) {
      dir.normalize();
      this.group.position.addScaledVector(dir, this.speed * dt);
      this.group.rotation.y = Math.atan2(dir.x, dir.z);
    }
  }

  dispose() {
    this.scene.remove(this.group);
  }
}

export class EnemyManager {
  constructor({ scene, loader, targetGetter, arenaSize, onPlayerHit, onEnemyKilled }) {
    this.scene = scene;
    this.loader = loader || new GLTFLoader();
    this.targetGetter = targetGetter; // функция возврата позиции игрока
    this.arenaSize = arenaSize;
    this.onPlayerHit = onPlayerHit;
    this.onEnemyKilled = onEnemyKilled;

    this.enemies = [];
    this.spawnTimer = 0;
    this.spawnInterval = 3.0; // каждые 3 секунды
  }

  spawnEnemy() {
    const half = this.arenaSize / 2 - 2;
    // Случайная точка по краю: выбираем сторону
    const side = Math.floor(Math.random() * 4);
    let x = 0, z = 0;
    if (side === 0) { x = -half; z = (Math.random() * 2 - 1) * half; }
    if (side === 1) { x =  half; z = (Math.random() * 2 - 1) * half; }
    if (side === 2) { z = -half; x = (Math.random() * 2 - 1) * half; }
    if (side === 3) { z =  half; x = (Math.random() * 2 - 1) * half; }

    const enemy = new Enemy({ scene: this.scene, loader: this.loader, position: new THREE.Vector3(x, 0, z) });
    this.enemies.push(enemy);
  }

  update(dt, player) {
    // Спавн
    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0) {
      this.spawnTimer = this.spawnInterval;
      this.spawnEnemy();
    }

    // Обновление врагов
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const e = this.enemies[i];
      e.update(dt, player, player.camera);

      // Контакт с игроком — простой радиусный тест
      const dist = e.group.position.distanceTo(player.position);
      if (dist < e.radius + 0.8) {
        this.onPlayerHit?.(e.damage);
        // Оттолкнем немного врага, чтобы не наносил урон каждый кадр
        const away = new THREE.Vector3().subVectors(e.group.position, player.position).setY(0).normalize();
        e.group.position.addScaledVector(away, 1.0);
      }

      if (e.isDead()) {
        e.dispose();
        this.enemies.splice(i, 1);
        this.onEnemyKilled?.();
      }
    }
  }

  tryHitEnemy(point, radius, damage) {
    // Перебор врагов: если точка пули внутри радиуса врага → урон
    for (let i = 0; i < this.enemies.length; i++) {
      const e = this.enemies[i];
      const dist = e.group.position.distanceTo(point);
      if (dist < e.radius + radius) {
        e.applyDamage(damage);
        return true;
      }
    }
    return false;
  }
}

