// game.js
// Главный модуль игры: инициализация сцены, камеры, рендера, цикла игры
// Подключает Player, EnemyManager, UI и Network заглушку

import * as THREE from "https://unpkg.com/three@0.160.1/build/three.module.js";
import { OrbitControls } from "https://unpkg.com/three@0.160.1/examples/jsm/controls/OrbitControls.js";
import { GLTFLoader } from "https://unpkg.com/three@0.160.1/examples/jsm/loaders/GLTFLoader.js";

import { createUI } from "./ui.js";
import { Player } from "./player.js";
import { EnemyManager } from "./enemy.js";
import { MobaWorld, Teams } from "./moba.js";
import { ProjectileManager } from "./projectiles.js";
import { AbilitySystem, createDefaultAbilities, createAbilitiesForHero } from "./abilities.js";
import { Network } from "./network.js";

// Глобальные константы сцены
const ARENA_SIZE = 50; // 50x50 метров

// Вспомогательная функция для загрузки текстуры с кросс-доменом
function loadTexture(url) {
  const textureLoader = new THREE.TextureLoader();
  const texture = textureLoader.load(url);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.minFilter = THREE.LinearMipMapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  return texture;
}

// Основной класс Game для явной структуры
export class Game {
  constructor() {
    /** @type {THREE.Scene} */
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0c0f14);

    /** @type {THREE.WebGLRenderer} */
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.shadowMap.enabled = true;
    document.body.appendChild(this.renderer.domElement);

    // Камера сверху: псевдо-изометрия (угол ~60°)
    const aspect = window.innerWidth / window.innerHeight;
    this.camera = new THREE.PerspectiveCamera(60, aspect, 0.1, 500);

    // Располагаем камеру выше сцены и смотрим на центр арены
    // Псевдо-изометрия: угол возвышения 60° над плоскостью (Y / горизонтальное расстояние = tan(60°))
    const desiredElevationDeg = 60;
    const cameraHeight = 45; // высота камеры над ареной
    const cameraDistance = cameraHeight / Math.tan(THREE.MathUtils.degToRad(desiredElevationDeg));
    this.camera.position.set(0, cameraHeight, cameraDistance);
    this.camera.lookAt(new THREE.Vector3(0, 0, 0));

    // Не даем пользователю управлять камерой мышью (MOBA стиль), но оставляем OrbitControls для отладки (выкл. вращение)
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableRotate = false;
    this.controls.enablePan = false;
    this.controls.enableZoom = false;
    this.controls.target.set(0, 0, 0);
    this.controls.update();

    this.loader = new GLTFLoader();

    // Освещение: Солнце + амбиент
    this.setupLights();

    // Земля 50x50 с текстурой
    this.ground = this.createGround();
    this.scene.add(this.ground);

    // Луч-кастер для наведения по мыши на землю
    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2();

    // Инициализация UI
    this.ui = createUI();

    // Сетевой слой (заглушка)
    this.network = new Network();

    // MOBA-мир и игрок как герой Radiant
    this.world = new MobaWorld({ scene: this.scene, ui: this.ui, arenaSize: ARENA_SIZE });
    // Снаряды + способности
    this.projectiles = new ProjectileManager({ scene: this.scene, world: this.world });
    this.abilitySystem = new AbilitySystem({ projectiles: this.projectiles });
    // выбрать героя из глобального выбора (по умолчанию CM-01)
    const chosen = window.__chosenHeroKey || "CM-01";
    this.player = new Player({
      scene: this.scene,
      loader: this.loader,
      camera: this.camera,
      raycaster: this.raycaster,
      mouse: this.mouse,
      arenaSize: ARENA_SIZE,
      ui: this.ui,
      world: this.world,
      team: Teams.Radiant,
      abilitySystem: this.abilitySystem,
      defaultAbilitiesFactory: (heroKey) => createAbilitiesForHero(heroKey),
      heroKey: chosen,
    });
    this.world.registerUnit(this.player);

    // Время
    this.clock = new THREE.Clock();

    // События
    window.addEventListener("resize", () => this.onResize());
    window.addEventListener("mousemove", (e) => this.onMouseMove(e));

    // Старт цикла
    this.animate = this.animate.bind(this);
    requestAnimationFrame(this.animate);
  }

  setupLights() {
    // AmbientLight для мягкого базового освещения
    const ambient = new THREE.AmbientLight(0xffffff, 0.6);
    this.scene.add(ambient);

    // DirectionalLight (солнце), тени включены
    const sun = new THREE.DirectionalLight(0xffffff, 1.0);
    sun.position.set(20, 40, 20);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    const s = ARENA_SIZE;
    sun.shadow.camera.left = -s;
    sun.shadow.camera.right = s;
    sun.shadow.camera.top = s;
    sun.shadow.camera.bottom = -s;
    sun.shadow.camera.near = 1;
    sun.shadow.camera.far = 150;
    this.scene.add(sun);
  }

  createGround() {
    // Простая текстура травы/земли с повтором
    const texture = loadTexture("https://raw.githubusercontent.com/mrdoob/three.js/dev/examples/textures/terrain/grasslight-big.jpg");
    texture.repeat.set(ARENA_SIZE / 5, ARENA_SIZE / 5);
    const material = new THREE.MeshStandardMaterial({ map: texture });
    const geometry = new THREE.PlaneGeometry(ARENA_SIZE, ARENA_SIZE, 1, 1);
    const mesh = new THREE.Mesh(geometry, material);
    mesh.rotation.x = -Math.PI / 2;
    mesh.receiveShadow = true;
    mesh.name = "Ground";
    return mesh;
  }

  onResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }

  onMouseMove(event) {
    // Нормализуем координаты мыши для Raycaster
    this.mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    this.mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
  }

  animate() {
    const dt = Math.min(0.05, this.clock.getDelta());

    // Обновляем игрока и MOBA-мир
    this.player.update(dt, this.scene, null);
    this.world.update(dt, this.player);
    this.projectiles.update(dt);

    // Рендер сцены
    this.renderer.render(this.scene, this.camera);

    requestAnimationFrame(this.animate);
  }
}

export function startGame() {
  const game = new Game();
  window.__game = game;
}

