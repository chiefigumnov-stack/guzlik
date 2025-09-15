// player.js
// Логика игрока: WASD-движение, наведение мышью, ЛКМ — стрельба снарядом
// Модель: GLTF (авокадо как заглушка), простая полоска HP над героем

import * as THREE from "https://unpkg.com/three@0.160.1/build/three.module.js";
import { GLTFLoader } from "https://unpkg.com/three@0.160.1/examples/jsm/loaders/GLTFLoader.js";

const HERO_URL = "https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/master/2.0/Avocado/glTF/Avocado.gltf";

// Простая геометрия для снаряда (можно заменить на модель)
function createBulletMesh() {
  const geometry = new THREE.SphereGeometry(0.2, 12, 12);
  const material = new THREE.MeshStandardMaterial({ color: 0x66ccff, emissive: 0x112233 });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.castShadow = true;
  return mesh;
}

// Небольшой 3D-хелсбар (плашка) над объектом
function createHealthBar(width = 2, height = 0.2) {
  const group = new THREE.Group();

  const bgGeom = new THREE.PlaneGeometry(width, height);
  const bgMat = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.5, depthWrite: false });
  const bg = new THREE.Mesh(bgGeom, bgMat);

  const fgGeom = new THREE.PlaneGeometry(width, height);
  const fgMat = new THREE.MeshBasicMaterial({ color: 0x32cd32, transparent: true, opacity: 0.9, depthWrite: false });
  const fg = new THREE.Mesh(fgGeom, fgMat);
  fg.position.z = 0.001;

  group.add(bg);
  group.add(fg);

  group.userData = { fg, width };
  group.renderOrder = 999; // рисуем поверх предметов

  return group;
}

export class Player {
  constructor({ scene, loader, camera, raycaster, mouse, arenaSize, ui }) {
    this.scene = scene;
    /** @type {GLTFLoader} */ this.loader = loader || new GLTFLoader();
    this.camera = camera;
    this.raycaster = raycaster;
    this.mouse = mouse;
    this.arenaSize = arenaSize;
    this.ui = ui;

    // Параметры игрока
    this.position = new THREE.Vector3(0, 0, 0);
    this.velocity = new THREE.Vector3();
    this.speed = 12; // м/с
    this.hp = 100;
    this.maxHp = 100;
    this.score = 0;

    // Слои
    this.group = new THREE.Group();
    this.group.position.copy(this.position);
    this.group.name = "Player";
    this.group.castShadow = true;
    this.group.receiveShadow = false;
    this.scene.add(this.group);

    // Загрузка модели героя
    this.heroRoot = new THREE.Group();
    this.group.add(this.heroRoot);
    this.loadModel(HERO_URL);

    // Хелсбар над героем
    this.healthBar = createHealthBar(2, 0.2);
    this.healthBar.position.set(0, 3, 0);
    this.healthBar.visible = true;
    this.group.add(this.healthBar);
    this.updateHpBar();

    // Инициализируем HUD значениями HP и Score
    this.ui?.setHP(this.hp);
    this.ui?.setScore(this.score);

    // Управление
    this.keys = { w: false, a: false, s: false, d: false };
    window.addEventListener("keydown", (e) => this.onKey(e, true));
    window.addEventListener("keyup", (e) => this.onKey(e, false));

    // Стрельба
    this.bullets = [];
    this.fireCooldown = 0.2; // сек
    this.fireTimer = 0;
    window.addEventListener("mousedown", (e) => {
      if (e.button === 0) this.tryFire();
    });
  }

  loadModel(url) {
    // Комментарий: менять модель просто — замените HERO_URL на новую ссылку GLTF/GLB
    this.loader.load(url, (gltf) => {
      const model = gltf.scene || gltf.scenes?.[0];
      if (model) {
        model.traverse((obj) => {
          if (obj.isMesh) {
            obj.castShadow = true;
            obj.receiveShadow = true;
          }
        });
        // Масштабируем авокадо до разумного размера ~1.5м
        const box = new THREE.Box3().setFromObject(model);
        const size = new THREE.Vector3();
        box.getSize(size);
        const scale = 1.5 / Math.max(size.x, size.y, size.z);
        model.scale.setScalar(scale);
        model.position.set(0, 0, 0);
        this.heroRoot.add(model);
      }
    });
  }

  onKey(e, down) {
    const k = e.key.toLowerCase();
    if (k === "w" || k === "ц") this.keys.w = down;
    if (k === "a" || k === "ф") this.keys.a = down;
    if (k === "s" || k === "ы") this.keys.s = down;
    if (k === "d" || k === "в") this.keys.d = down;
  }

  addScore(v) {
    this.score += v;
    this.ui?.setScore(this.score);
  }

  applyDamage(v) {
    this.hp = Math.max(0, this.hp - v);
    this.updateHpBar();
    this.ui?.setHP(this.hp);
  }

  updateHpBar() {
    const ratio = Math.max(0, this.hp / this.maxHp);
    const fg = this.healthBar.userData.fg;
    const fullWidth = this.healthBar.userData.width;
    fg.scale.x = Math.max(0.0001, ratio);
    fg.position.x = -fullWidth * (1 - ratio) / 2;
    // Цвет при низком HP
    fg.material.color.set(ratio < 0.3 ? 0xff4444 : 0x32cd32);
  }

  clampToArena(pos) {
    const half = this.arenaSize / 2 - 1;
    pos.x = Math.min(half, Math.max(-half, pos.x));
    pos.z = Math.min(half, Math.max(-half, pos.z));
  }

  screenRayToGroundPoint() {
    // Проецируем луч из камеры в мир и пересекаем с плоскостью Y=0
    const ray = this.raycaster.ray;
    const planeY = 0;
    const t = (planeY - ray.origin.y) / ray.direction.y;
    if (t > 0) {
      const p = new THREE.Vector3().copy(ray.origin).addScaledVector(ray.direction, t);
      return p;
    }
    return null;
  }

  aimAtMouse() {
    // Обновляем лучкастер по мыши и наводим героя на точку на земле
    this.raycaster.setFromCamera(this.mouse, this.camera);
    const p = this.screenRayToGroundPoint();
    if (!p) return;
    const dir = new THREE.Vector3().subVectors(p, this.group.position);
    dir.y = 0;
    if (dir.lengthSq() > 0.0001) {
      dir.normalize();
      const targetYaw = Math.atan2(dir.x, dir.z);
      this.group.rotation.y = targetYaw;
    }
  }

  tryFire() {
    if (this.fireTimer > 0) return;
    this.fireTimer = this.fireCooldown;

    const bullet = createBulletMesh();
    const muzzleOffset = new THREE.Vector3(0, 1.0, 1.0);
    const dir = new THREE.Vector3(0, 0, 1).applyEuler(new THREE.Euler(0, this.group.rotation.y, 0));
    const spawnPos = new THREE.Vector3().copy(this.group.position).addScaledVector(dir, muzzleOffset.z);
    spawnPos.y += muzzleOffset.y;

    bullet.position.copy(spawnPos);
    this.scene.add(bullet);

    const projectile = {
      mesh: bullet,
      position: bullet.position.clone(),
      direction: dir.clone(),
      speed: 28,
      life: 2.0, // секунды жизни
      radius: 0.25,
      damage: 34,
    };
    this.bullets.push(projectile);
  }

  updateBullets(dt, enemyManager) {
    for (let i = this.bullets.length - 1; i >= 0; i--) {
      const b = this.bullets[i];
      b.life -= dt;
      if (b.life <= 0) {
        this.scene.remove(b.mesh);
        this.bullets.splice(i, 1);
        continue;
      }
      // Перемещение
      b.position.addScaledVector(b.direction, b.speed * dt);
      b.mesh.position.copy(b.position);

      // Коллизия с врагами (сферическая проверка)
      const hit = enemyManager.tryHitEnemy(b.position, b.radius, b.damage);
      if (hit) {
        this.scene.remove(b.mesh);
        this.bullets.splice(i, 1);
      }
    }
  }

  update(dt, scene, enemyManager) {
    // Кулдаун выстрела
    if (this.fireTimer > 0) this.fireTimer -= dt;

    // Наведение на мышь
    this.aimAtMouse();

    // Движение WASD в плоскости XZ
    const input = new THREE.Vector3(
      (this.keys.d ? 1 : 0) - (this.keys.a ? 1 : 0),
      0,
      (this.keys.s ? 1 : 0) - (this.keys.w ? 1 : 0)
    );
    if (input.lengthSq() > 0) input.normalize();
    this.velocity.copy(input).multiplyScalar(this.speed);
    this.position.addScaledVector(this.velocity, dt);
    this.position.y = 0;
    this.clampToArena(this.position);
    this.group.position.copy(this.position);

    // Хелсбар повернуть к камере (билбординг)
    this.healthBar.quaternion.copy(this.camera.quaternion);

    // Обновить пули
    this.updateBullets(dt, enemyManager);
  }
}

