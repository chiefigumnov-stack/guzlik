// player.js
// Логика игрока (MOBA): клик-передвижение, ПКМ — move/attack по цели
// Модель: GLTF (авокадо как заглушка), простая полоска HP над героем

import * as THREE from "https://unpkg.com/three@0.160.1/build/three.module.js";
import { GLTFLoader } from "https://unpkg.com/three@0.160.1/examples/jsm/loaders/GLTFLoader.js";
import { HERO_DEFS } from "./heroData.js";

const HERO_URL = "https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/master/2.0/Avocado/glTF/Avocado.gltf";

// Базовая атакующая геометрия (удар ближнего боя)
function createMeleeSwingMesh() {
  const geometry = new THREE.CapsuleGeometry(0.15, 0.6, 4, 8);
  const material = new THREE.MeshStandardMaterial({ color: 0xffd180, emissive: 0x332200 });
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
  constructor({ scene, loader, camera, raycaster, mouse, arenaSize, ui, world, team, abilitySystem, defaultAbilitiesFactory, heroKey }) {
    this.scene = scene;
    /** @type {GLTFLoader} */ this.loader = loader || new GLTFLoader();
    this.camera = camera;
    this.raycaster = raycaster;
    this.mouse = mouse;
    this.arenaSize = arenaSize;
    this.ui = ui;
    this.world = world;
    this.team = team ?? 0;
    this.abilitySystem = abilitySystem;
    this.defaultAbilitiesFactory = defaultAbilitiesFactory;

    // Параметры игрока
    this.position = new THREE.Vector3(0, 0, 0);
    this.velocity = new THREE.Vector3();
    // Герой и статы
    this.heroKey = heroKey || "CM-01"; // по умолчанию — ваш герой
    const def = HERO_DEFS[this.heroKey];
    this.speed = def.base.moveSpeed;
    this.maxHp = def.base.maxHp;
    this.hp = this.maxHp;
    this.attackDamage = def.base.attackDamage;
    this.range = def.base.attackRange;
    this.attackCooldown = def.base.attackCooldown;
    this.unitType = "hero";

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

    // Инициализируем HUD значениями HP
    this.ui?.setHP(this.hp);
    this.ui?.setHeroCard?.({ name: def.name, role: def.role, portrait: def.portrait });
    this.ui?.setGold?.(this.gold);
    this.ui?.setLevelXP?.(this.level, this.xp, this.xpToNextLevel());
    this.initAbilities();

    // Управление: клики + WASD
    this.moveTarget = null; // точка назначения
    this.attackTarget = null; // выбранная цель
    window.addEventListener("contextmenu", (e) => e.preventDefault());
    window.addEventListener("mousedown", (e) => this.onMouseDown(e));
    this.keys = { w:false,a:false,s:false,d:false };
    window.addEventListener('keydown', (e)=>{ const k=e.key.toLowerCase(); if(k==='w'||k==='ц') this.keys.w=true; if(k==='a'||k==='ф') this.keys.a=true; if(k==='s'||k==='ы') this.keys.s=true; if(k==='d'||k==='в') this.keys.d=true; });
    window.addEventListener('keyup', (e)=>{ const k=e.key.toLowerCase(); if(k==='w'||k==='ц') this.keys.w=false; if(k==='a'||k==='ф') this.keys.a=false; if(k==='s'||k==='ы') this.keys.s=false; if(k==='d'||k==='в') this.keys.d=false; });

    // Бой
    this.attackTimer = 0;
    this.baseAttackCooldown = 0.8;
    this.attackSpeed = 1.0;
    this.basicType = def.basicType || 'melee';
    window.addEventListener('mousedown', (e) => { if (e.button === 0) this.onPrimaryAttack(); });

    // Прогресс героя
    this.level = 1;
    this.xp = 0;
    this.gold = 0;
  }

  loadModel(url) {
    // Если флаг usePortraitBillboard — показываем 2D-портрет в 3D как временную заглушку герою
    const def = HERO_DEFS[this.heroKey];
    if (def?.usePortraitBillboard && def?.portrait) {
      const loader = new THREE.TextureLoader();
      loader.load(def.portrait, (tex) => {
        const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, side: THREE.DoubleSide });
        const aspect = tex.image ? tex.image.width / tex.image.height : 1;
        const h = 2.2, w = h * aspect;
        const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
        mesh.position.set(0, h * 0.5, 0);
        this.heroRoot.add(mesh);
      });
      return;
    }

    // Иначе грузим GLTF
    this.loader.load(url, (gltf) => {
      const model = gltf.scene || gltf.scenes?.[0];
      if (!model) return;
      model.traverse((obj) => {
        if (obj.isMesh) { obj.castShadow = true; obj.receiveShadow = true; }
      });
      const box = new THREE.Box3().setFromObject(model);
      const size = new THREE.Vector3();
      box.getSize(size);
      const scale = 1.5 / Math.max(size.x, size.y, size.z);
      model.scale.setScalar(scale);
      model.position.set(0, 0, 0);
      this.heroRoot.add(model);
    });
  }

  onMouseDown(e) {
    if (e.button !== 2) return; // ПКМ
    // Луч в мир
    this.raycaster.setFromCamera(this.mouse, this.camera);
    // Сначала ищем юнитов под курсором (простая проверка через пересечение с их группой)
    let clickedUnit = null;
    for (const u of this.world?.units || []) {
      if (u === this) continue;
      if (!u.group) continue;
      const box = new THREE.Box3().setFromObject(u.group);
      // Проверяем пересечение луча с AABB юнита (глобальные координаты)
      const intersect = this.raycaster.ray.intersectsBox(box);
      if (intersect) { clickedUnit = u; break; }
    }

    if (clickedUnit && clickedUnit.team !== this.team) {
      // Атаковать цель
      this.attackTarget = clickedUnit;
      this.moveTarget = null;
      return;
    }

    // Иначе — двигаемся к точке на земле
    const groundIntersect = this.pickGroundPoint();
    if (groundIntersect) {
      this.moveTarget = groundIntersect;
      this.attackTarget = null;
    }
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

  xpToNextLevel() {
    return 100 + (this.level - 1) * 50;
  }

  grantXP(amount) {
    this.xp += amount;
    const next = this.xpToNextLevel();
    while (this.xp >= next) {
      this.level++;
      // Рост статов по определению героя
      const def = HERO_DEFS[this.heroKey];
      if (def?.growth) {
        this.maxHp += def.growth.maxHp;
        this.attackDamage += def.growth.attackDamage;
        this.attackCooldown = Math.max(0.2, this.attackCooldown + (def.growth.attackCooldown || 0));
        this.speed += def.growth.moveSpeed;
        this.hp = this.maxHp;
        this.updateHpBar();
        this.ui?.setHP(this.hp);
      }
      // Обновить next после апа
    }
    this.ui?.setLevelXP?.(this.level, this.xp, this.xpToNextLevel());
  }

  grantGold(amount) {
    this.gold += amount;
    this.ui?.setGold?.(this.gold);
  }

  initAbilities() {
    // Настоящий набор способностей через фабрику
    // Если фабрика поддерживает heroKey — используем её расширенный набор
    this.abilities = (this.defaultAbilitiesFactory ? this.defaultAbilitiesFactory(this.heroKey) : {});
    // Базовая мана
    this.maxMana = 300; this.mana = 300;
    this.ui?.setMana?.(this.mana, this.maxMana);
    this.ui?.setAbilities?.(this.abilities);
    window.addEventListener('keydown', (e) => this.onKeyAbility(e));
    // Клики по кнопкам
    const clickInvoke = (key) => { this.onKeyAbility({ key }); };
    const byId = (id) => document.getElementById(id);
    byId('ab-Q-btn')?.addEventListener('click', () => clickInvoke('Q'));
    byId('ab-W-btn')?.addEventListener('click', () => clickInvoke('W'));
    byId('ab-E-btn')?.addEventListener('click', () => clickInvoke('E'));
    byId('ab-R-btn')?.addEventListener('click', () => clickInvoke('R'));
  }

  onKeyAbility(e) {
    const k = (e.code ? e.code.replace('Key','') : e.key).toUpperCase();
    const ab = this.abilities?.[k];
    if (!ab) return;
    if (ab.timer > 0) return;
    // Каст через AbilitySystem
    const casted = this.abilitySystem?.cast(this, k, this.abilities, this.world);
    if (casted) return;
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

  aimAt(pos) {
    const dir = new THREE.Vector3().subVectors(pos, this.group.position);
    dir.y = 0;
    if (dir.lengthSq() > 0.0001) {
      dir.normalize();
      const targetYaw = Math.atan2(dir.x, dir.z);
      this.group.rotation.y = targetYaw;
    }
  }

  pickGroundPoint() {
    const ray = this.raycaster.ray;
    const t = (0 - ray.origin.y) / ray.direction.y;
    if (t > 0) return new THREE.Vector3().copy(ray.origin).addScaledVector(ray.direction, t);
    return null;
  }

  tryAttackTarget() {
    if (!this.attackTarget || this.attackTarget.isDead?.()) return;
    const dist = this.group.position.distanceTo(this.attackTarget.position);
    if (dist <= this.range) {
      if (this.attackTimer <= 0) {
        this.attackTimer = this.attackCooldown;
        this.aimAt(this.attackTarget.position);
        this.attackTarget.applyDamage?.(this.attackDamage, this);
      }
    } else {
      // Идём к цели
      this.moveTowards(this.attackTarget.position);
    }
  }

  onPrimaryAttack() {
    if (this.attackTimer > 0) return;
    this.attackTimer = Math.max(0.1, this.baseAttackCooldown / this.attackSpeed);
    if (this.basicType === 'melee') {
      // Короткая дуга перед героем и урон ближайшей цели
      const forward = new THREE.Vector3(0,0,1).applyEuler(new THREE.Euler(0, this.group.rotation.y, 0));
      const coneDot = Math.cos(70 * Math.PI/180);
      const range = 2.0;
      let didHit = false;
      for (const u of this.world.units) {
        if (u.team === this.team) continue;
        if (!u.position) continue;
        const toU = new THREE.Vector3().subVectors(u.position, this.group.position); toU.y = 0;
        const dist = toU.length();
        if (dist <= range) {
          toU.normalize();
          if (forward.dot(toU) >= coneDot) {
            u.applyDamage?.(this.attackDamage, this); didHit = true; break;
          }
        }
      }
      // Визуал-свинг (кратковременный)
      const swing = createMeleeSwingMesh();
      swing.position.copy(this.group.position).add(new THREE.Vector3(0,1.0,0));
      swing.rotation.y = this.group.rotation.y;
      this.scene.add(swing);
      setTimeout(() => this.scene.remove(swing), 120);
    }
    // Ranged вариант можно добавить позже
  }

  moveTowards(targetPos, dtOverride) {
    const dt = dtOverride ?? 0.016;
    const dir = new THREE.Vector3().subVectors(targetPos, this.group.position);
    dir.y = 0;
    if (dir.lengthSq() < 0.01) return;
    dir.normalize();
    this.group.position.addScaledVector(dir, this.speed * dt);
    this.group.rotation.y = Math.atan2(dir.x, dir.z);
  }

  update(dt) {
    this.attackTimer = Math.max(0, this.attackTimer - dt);
    // кулдауны способностей
    if (this.abilities) {
      const remains = {};
      for (const k of Object.keys(this.abilities)) {
        const a = this.abilities[k];
        if (a.timer > 0) a.timer = Math.max(0, a.timer - dt);
        remains[k] = a.timer;
      }
      this.ui?.updateAbilityCooldowns?.(remains);
    }
    // Обновляем луч от мыши (для кликов)
    this.raycaster.setFromCamera(this.mouse, this.camera);

    // Передвижение к выбранной точке
    if (this.moveTarget) {
      const dist = this.group.position.distanceTo(this.moveTarget);
      if (dist < 0.2) this.moveTarget = null;
      else this.moveTowards(this.moveTarget, dt);
    }

    // WASD движение
    const input = new THREE.Vector3((this.keys?.d?1:0)-(this.keys?.a?1:0), 0, (this.keys?.s?1:0)-(this.keys?.w?1:0));
    if (input.lengthSq() > 0) {
      input.normalize();
      this.group.position.addScaledVector(input, this.speed * dt);
      // Поворот к мыши
      const ground = this.pickGroundPoint();
      if (ground) this.aimAt(ground);
    }

    // Атака выбранной цели
    if (this.attackTarget) {
      this.tryAttackTarget();
      if (this.attackTarget?.isDead?.()) this.attackTarget = null;
    }

    // Позиция и бар
    this.position.copy(this.group.position);
    this.position.y = 0;
    this.clampToArena(this.position);
    this.group.position.copy(this.position);
    this.healthBar.quaternion.copy(this.camera.quaternion);
  }
}

