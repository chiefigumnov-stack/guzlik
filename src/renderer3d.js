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
    const hemi = new THREE.HemisphereLight(0xffffff, 0x223344, 0.7);
    this.scene.add(hemi);
    const dir = new THREE.DirectionalLight(0xffffff, 0.8);
    dir.position.set(300, 400, 200);
    this.scene.add(dir);

    // Ground
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(4000, 4000), new THREE.MeshStandardMaterial({ color: 0x0f1b2b }));
    ground.rotation.x = -Math.PI / 2;
    this.scene.add(ground);

    this.loader = new GLTFLoader();
    this.models = new Map();
    this.spawned = [];
    this.entityIdToObject = new Map();
    this.tempVec3 = new THREE.Vector3();
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
    const focus = { x: game.camera.x, z: game.camera.y };
    const yaw = game._cameraYaw || -Math.PI / 4;
    const dist = 420; const height = 360;
    this.camera.position.x = focus.x + Math.cos(yaw) * dist;
    this.camera.position.z = focus.z + Math.sin(yaw) * dist;
    this.camera.position.y = height;
    this.camera.lookAt(focus.x, 0, focus.z);
    this.camera.updateProjectionMatrix();
  }

  resize() {
    const width = this.canvas.clientWidth || window.innerWidth;
    const height = this.canvas.clientHeight || window.innerHeight;
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
  }

  draw(game) {
    this.updateCameraFromGame(game);
    this.updateEntities(game);
    this.renderer.render(this.scene, this.camera);
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
        if (e.type === 'hero') {
          this.loadGLTF('hero', '/assets/hero.glb').then((root) => {
            const replacement = root.clone(true);
            replacement.scale.setScalar(0.8);
            this.scene.add(replacement);
            this.scene.remove(obj);
            this.entityIdToObject.set(e.id, replacement);
          }).catch(() => {/* ignore if not present */});
        }
      }
      // Update transform: map world (x,y) -> (x, z)
      obj.position.set(e.x, 0, e.y);
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

