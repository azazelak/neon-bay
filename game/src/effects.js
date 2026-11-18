// Neon Bay v5c — damage smoke, skid particles, sparks, muzzle flashes.
import * as THREE from '../vendor/three.module.min.js';

export class Effects {
  constructor(game) {
    this.game = game;
    this.parts = [];
    this.smokeAt = 0;
  }

  spawn(x, y, z, color, n = 6, spread = 2, up = 2) {
    for (let i = 0; i < n; i++) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.3, 0.3),
        new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9 }));
      m.position.set(x, y, z);
      this.game.scene.add(m);
      this.parts.push({
        mesh: m, life: 0.7,
        vx: (Math.random() - 0.5) * spread, vy: Math.random() * up, vz: (Math.random() - 0.5) * spread,
      });
    }
  }

  spark(x, z) { this.spawn(x, 1, z, 0xffd23e, 8, 4, 3); }
  muzzle(pos) { this.spawn(pos.x, 1.2, pos.z, 0xffe9a8, 3, 1, 1); }

  skid(x, z) { this.spawn(x, 0.2, z, 0x555555, 2, 1, 0.5); }

  update(dt) {
    // damage smoke from a hurt player car
    const p = this.game.player;
    if (p.inCar && p.car && p.car.hp < 55 && this.game.time - this.smokeAt > 0.25) {
      this.smokeAt = this.game.time;
      this.spawn(p.car.pos.x, 1.2, p.car.pos.z, 0x333333, 3, 1, 2);
    }
    // skid puffs while braking hard at speed
    if (p.inCar && p.car && Math.abs(p.car.speed) > 18 && this.game.input.keys.has('Space')) {
      this.skid(p.car.pos.x, p.car.pos.z);
    }
    for (let i = this.parts.length - 1; i >= 0; i--) {
      const pt = this.parts[i];
      pt.life -= dt;
      if (pt.life <= 0) {
        this.game.scene.remove(pt.mesh);
        this.parts.splice(i, 1);
        continue;
      }
      pt.mesh.position.x += pt.vx * dt;
      pt.mesh.position.y += pt.vy * dt;
      pt.mesh.position.z += pt.vz * dt;
      pt.mesh.material.opacity = pt.life;
    }
  }
}
