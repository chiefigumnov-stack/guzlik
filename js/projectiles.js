// projectiles.js
// Менеджер снарядов и коллизий для skillshot-способностей и атак дальнего боя

import * as THREE from "https://unpkg.com/three@0.160.1/build/three.module.js";

export class ProjectileManager {
  constructor({ scene, world }) {
    this.scene = scene;
    this.world = world;
    this.projectiles = [];
  }

  spawn({ position, velocity, radius = 0.3, life = 2.0, team, onHit }) {
    const mesh = new THREE.Mesh(
      new THREE.SphereGeometry(radius, 12, 12),
      new THREE.MeshStandardMaterial({ color: 0xffaa44, emissive: 0x331100 })
    );
    mesh.position.copy(position);
    mesh.castShadow = true;
    this.scene.add(mesh);
    this.projectiles.push({ mesh, position: position.clone(), velocity: velocity.clone(), radius, team, life, onHit });
  }

  update(dt) {
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];
      p.life -= dt;
      if (p.life <= 0) {
        this.scene.remove(p.mesh);
        this.projectiles.splice(i, 1);
        continue;
      }
      p.position.addScaledVector(p.velocity, dt);
      p.mesh.position.copy(p.position);

      // Проверка коллизии с юнитами
      for (const u of this.world.units) {
        if (u.team === p.team) continue;
        const d = (u.position ? u.position.distanceTo(p.position) : u.group?.position.distanceTo(p.position));
        if (d !== undefined && d <= (p.radius + (u.radius || 0.9))) {
          p.onHit?.(u);
          this.scene.remove(p.mesh);
          this.projectiles.splice(i, 1);
          break;
        }
      }
    }
  }
}

