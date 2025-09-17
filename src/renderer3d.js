import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

export class Renderer3D {
  constructor(canvas) {
    this.canvas = canvas;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0b0f14);
    this.camera = new THREE.PerspectiveCamera(60, 1, 0.1, 5000);
    this.camera.position.set(0, 280, 380);
    this.camera.lookAt(0, 0, 0);
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.resize();

    // Lights
    const hemi = new THREE.HemisphereLight(0xffffff, 0x223344, 0.9);
    this.scene.add(hemi);
    const dir = new THREE.DirectionalLight(0xffffff, 0.9);
    dir.position.set(300, 400, 200);
    this.scene.add(dir);
    const amb = new THREE.AmbientLight(0xffffff, 0.25);
    this.scene.add(amb);

    // Ground
    this.ground = new THREE.Mesh(new THREE.PlaneGeometry(4000, 4000), new THREE.MeshStandardMaterial({ color: 0x1a2636 }));
    this.ground.rotation.x = -Math.PI / 2;
    this.scene.add(this.ground);

    this.loader = new GLTFLoader();
    this.models = new Map();
    this.spawned = [];
    this.entityIdToObject = new Map();
    this.tempVec3 = new THREE.Vector3();
    this.mapGroup = null;
    this.mapBuiltKey = '';
    this.modelKeys = { hero: '/assets/hero.glb', creep: '/assets/creep.glb', tower: '/assets/tower.glb', projectile: '/assets/projectile.glb' };
  }

  async loadGLTF(key, url) {
    if (this.models.has(key)) return this.models.get(key);
    const gltf = await this.loader.loadAsync(url);
    const root = gltf.scene;
    root.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; o.material.metalness = 0.1; o.material.roughness = 0.9; } });
    this.models.set(key, root);
    return root;
  }

  async spawnModel(key, url, position = { x: 0, y: 0, z: 0 }, scale = 1) {
    const proto = await this.loadGLTF(key, url);
    const node = proto.clone(true);
    node.position.set(position.x, position.y, position.z);
    node.scale.setScalar(scale);
    this.scene.add(node);
    this.spawned.push({ key, node });
    return node;
  }

  updateCameraFromGame(game) {
    const hero = game.hero || { x: game.camera.x, y: game.camera.y };
    const yaw = game._cameraYaw || -Math.PI / 4;
    const dist = 420, height = 320, lookAhead = 80;
    const fx = Math.cos(yaw), fz = Math.sin(yaw);
    const cx = hero.x - fx * dist;
    const cz = hero.y - fz * dist;
    this.camera.position.set(cx, height, cz);
    this.camera.lookAt(hero.x + fx * lookAhead, 0, hero.y + fz * lookAhead);
    this.camera.updateProjectionMatrix();
  }

  resize() {
    const width = window.innerWidth;
    const height = window.innerHeight;
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
  }

  draw(game) {
    this.updateCameraFromGame(game);
    this.ensureMapBuilt(game);
    this.updateEntities(game);
    this.renderer.render(this.scene, this.camera);
  }

  ensureMapBuilt(game) {
    const key = `${game.map.width}x${game.map.height}:${game.map.path.map(p=>p.x+'_'+p.y).join('|')}`;
    if (key === this.mapBuiltKey) return;
    this.buildMap(game.map);
    this.mapBuiltKey = key;
  }

  buildMap(map) {
    if (this.mapGroup) { this.scene.remove(this.mapGroup); this.mapGroup.traverse(o=>{ if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose && o.material.dispose(); }); }
    const group = new THREE.Group();
    // Resize ground to map size
    this.ground.geometry.dispose();
    this.ground.geometry = new THREE.PlaneGeometry(map.width, map.height);
    // Lane segments
    const laneWidth = 60;
    const laneMat = new THREE.MeshStandardMaterial({ color: 0x3a9e3a, metalness: 0.0, roughness: 1.0 });
    for (let i = 1; i < map.path.length; i++) {
      const a = map.path[i - 1];
      const b = map.path[i];
      const dx = b.x - a.x; const dz = b.y - a.y; // map y -> world z
      const len = Math.hypot(dx, dz);
      if (len < 1) continue;
      const midx = (a.x + b.x) / 2; const midz = (a.y + b.y) / 2;
      const seg = new THREE.Mesh(new THREE.BoxGeometry(len, 2, laneWidth), laneMat);
      seg.position.set(midx, 1, midz);
      const yaw = Math.atan2(dz, dx);
      seg.rotation.y = yaw;
      group.add(seg);
    }
    // Bases markers
    const baseGeo = new THREE.CylinderGeometry(20, 20, 6, 20);
    const baseRadiant = new THREE.Mesh(baseGeo, new THREE.MeshStandardMaterial({ color: 0x16a34a }));
    baseRadiant.position.set(map.radiantBase.x, 3, map.radiantBase.y);
    group.add(baseRadiant);
    const baseDire = new THREE.Mesh(baseGeo, new THREE.MeshStandardMaterial({ color: 0xdc2626 }));
    baseDire.position.set(map.direBase.x, 3, map.direBase.y);
    group.add(baseDire);
    // Sparse trees outside lane
    const treeMat = new THREE.MeshStandardMaterial({ color: 0x14532d });
    const treeGeo = new THREE.ConeGeometry(10, 24, 8);
    for (let x = 80; x < map.width; x += 200) {
      for (let y = 80; y < map.height; y += 200) {
        if (this.isNearLane({ x, y }, map.path, 80)) continue;
        const t = new THREE.Mesh(treeGeo, treeMat);
        t.position.set(x, 12, y);
        group.add(t);
      }
    }
    this.scene.add(group);
    this.mapGroup = group;
  }

  isNearLane(point, path, threshold) {
    for (let i = 1; i < path.length; i++) {
      const a = path[i - 1]; const b = path[i];
      const d = this.pointToSegmentDistance(point.x, point.y, a.x, a.y, b.x, b.y);
      if (d <= threshold) return true;
    }
    return false;
  }

  pointToSegmentDistance(px, py, x1, y1, x2, y2) {
    const vx = x2 - x1, vy = y2 - y1;
    const wx = px - x1, wy = py - y1;
    const c1 = vx * wx + vy * wy;
    if (c1 <= 0) return Math.hypot(px - x1, py - y1);
    const c2 = vx * vx + vy * vy;
    if (c2 <= c1) return Math.hypot(px - x2, py - y2);
    const b = c1 / c2;
    const bx = x1 + b * vx; const by = y1 + b * vy;
    return Math.hypot(px - bx, py - by);
  }

  updateEntities(game) {
    const presentIds = new Set();
    for (const e of game.entities) {
      if (!e.alive) continue;
      presentIds.add(e.id);
      let obj = this.entityIdToObject.get(e.id);
      if (!obj) {
        obj = this.createNodeForEntity(e);
        this.entityIdToObject.set(e.id, obj);
        this.scene.add(obj);
        // Try upgrade to GLTF for heroes asynchronously
        const mk = (e.type === 'hero') ? 'hero' : (e.type === 'creep') ? 'creep' : (e.type === 'tower') ? 'tower' : (e.type === 'projectile') ? 'projectile' : '';
        if (mk && this.modelKeys[mk]) {
          this.loadGLTF(mk, this.modelKeys[mk]).then((root) => {
            const replacement = root.clone(true);
            replacement.scale.setScalar(e.type === 'tower' ? 1.2 : e.type === 'projectile' ? 0.2 : 0.8);
            this.scene.add(replacement);
            this.scene.remove(obj);
            this.entityIdToObject.set(e.id, replacement);
          }).catch(() => {/* ignore if not present */});
        }
      }
      // Update transform: map world (x,y) -> (x, z)
      obj.position.set(e.x, 0, e.y);
      if (e.facing != null) obj.rotation.y = -e.facing;
      if (e.type === 'projectile') {
        // face forward along velocity approximated via target or skip
      }
    }
    // Cleanup removed entities
    for (const [id, obj] of this.entityIdToObject.entries()) {
      if (!presentIds.has(id)) {
        this.scene.remove(obj);
        this.entityIdToObject.delete(id);
      }
    }
  }

  createNodeForEntity(e) {
    const color = e.team === 0 ? 0x2dd4bf : 0xf87171;
    if (e.type === 'hero') {
      const geo = new THREE.CapsuleGeometry(8, 14, 4, 8);
      const mat = new THREE.MeshStandardMaterial({ color });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(e.x, 0, e.y);
      return mesh;
    }
    if (e.type === 'creep') {
      const geo = new THREE.CylinderGeometry(7, 7, 10, 8);
      const mat = new THREE.MeshStandardMaterial({ color });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(e.x, 0, e.y);
      return mesh;
    }
    if (e.type === 'tower') {
      const geo = new THREE.CylinderGeometry(10, 12, 36, 12);
      const mat = new THREE.MeshStandardMaterial({ color });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(e.x, 0, e.y);
      return mesh;
    }
    if (e.type === 'building') {
      const geo = new THREE.CylinderGeometry(18, 24, 40, 16);
      const mat = new THREE.MeshStandardMaterial({ color });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(e.x, 0, e.y);
      return mesh;
    }
    if (e.type === 'projectile') {
      const geo = new THREE.SphereGeometry(3, 8, 8);
      const mat = new THREE.MeshStandardMaterial({ color: e.team === 0 ? 0xf59e0b : 0xa78bfa, emissive: 0x222222 });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(e.x, 0, e.y);
      return mesh;
    }
    const geo = new THREE.BoxGeometry(6, 6, 6);
    const mat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0 });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(e.x, 0, e.y);
    return mesh;
  }
}

