import * as THREE from "https://unpkg.com/three@0.160.1/build/three.module.js";
import { Teams, TeamNeutral } from "./moba.js"; // only for constants

export class Neutral {
  constructor({ scene, world, loader, position, healthBarFactory }) {
    this.scene = scene; this.world = world; this.loader = loader;
    this.position = position.clone();
    this.team = TeamNeutral; this.unitType = 'neutral';
    this.speed = 0; this.damage = 0; this.range = 0;
    this.hp = 420; this.maxHp = 420;
    this.group = new THREE.Group(); this.group.position.copy(this.position);
    this.root = new THREE.Group(); this.group.add(this.root);
    this.loadModel();
    this.healthBar = healthBarFactory(1.2, 0.12);
    this.healthBar.position.set(0,1.6,0); this.group.add(this.healthBar);
    scene.add(this.group);
  }
  loadModel() {
    const url = "https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/master/2.0/Monster/glTF/Monster.gltf";
    this.loader.load(url, (gltf)=>{
      const model = gltf.scene || gltf.scenes?.[0]; if (!model) return;
      model.traverse(o=>{ if (o.isMesh){ o.castShadow=true; o.receiveShadow=true; }});
      const box = new THREE.Box3().setFromObject(model); const size = new THREE.Vector3(); box.getSize(size);
      const scale = 1.2 / Math.max(size.x, size.y, size.z); model.scale.setScalar(scale);
      this.root.add(model);
    });
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

