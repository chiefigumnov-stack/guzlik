import * as THREE from "https://unpkg.com/three@0.160.1/build/three.module.js";

const TEAM_NEUTRAL = 2;

export class Neutral {
  constructor({ scene, world, loader, position }) {
    this.scene = scene; this.world = world; this.loader = loader;
    this.position = position.clone();
    this.team = TEAM_NEUTRAL; this.unitType = 'neutral';
    this.speed = 0; this.damage = 0; this.range = 0;
    this.hp = 420; this.maxHp = 420;
    this.group = new THREE.Group(); this.group.position.copy(this.position);
    this.root = new THREE.Group(); this.group.add(this.root);
    this.loadModel();
    this.healthBar = this.createHealthBar(1.2, 0.12);
    this.healthBar.position.set(0,1.6,0); this.group.add(this.healthBar);
    scene.add(this.group);
  }

  loadModel() {
    // Используем доступную модель "Duck"
    const url = "https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/master/2.0/Duck/glTF/Duck.gltf";
    this.loader.load(url, (gltf)=>{
      const model = gltf.scene || gltf.scenes?.[0]; if (!model) return;
      model.traverse(o=>{ if (o.isMesh){ o.castShadow=true; o.receiveShadow=true; }});
      const box = new THREE.Box3().setFromObject(model); const size = new THREE.Vector3(); box.getSize(size);
      const scale = 0.02 / Math.max(size.x, size.y, size.z); // утка большая, уменьшаем
      model.scale.setScalar(scale);
      this.root.add(model);
    });
  }

  createHealthBar(width, height) {
    const group = new THREE.Group();
    const bg = new THREE.Mesh(new THREE.PlaneGeometry(width, height), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.5, depthWrite: false }));
    const fg = new THREE.Mesh(new THREE.PlaneGeometry(width, height), new THREE.MeshBasicMaterial({ color: 0x66bb6a, transparent: true, opacity: 0.9, depthWrite: false }));
    fg.position.z = 0.001;
    group.add(bg); group.add(fg);
    group.userData = { fg, width };
    group.renderOrder = 999;
    return group;
  }

  update(dt) { /* стоит на месте */ }
  isDead() { return this.hp <= 0; }
  applyDamage(v, attacker) { this.hp = Math.max(0, this.hp - v); this.updateHpBar(); if (this.hp<=0) this.world.onNeutralKilled(attacker, this); }
  updateHpBar() {
    const ratio = Math.max(0, this.hp/this.maxHp);
    const fg = this.healthBar.userData.fg; const full = this.healthBar.userData.width;
    fg.scale.x = Math.max(0.0001, ratio); fg.position.x = -full*(1-ratio)/2;
  }
  dispose() { this.scene.remove(this.group); }
}

