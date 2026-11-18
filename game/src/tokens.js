// Twelve neon tokens hidden around the city, $50 each. A spinning cyan
// torus that floats above the ground; driving or walking through one
// collects it. Collected tokens persist in the save.
import * as THREE from 'three';
import { CONFIG } from './config.js';

const SPOTS = [
  [74, 74], [-74, 148], [222, -74], [-222, 74],
  [148, -222], [-148, -222], [0, 296], [296, 148],
  [-296, -148], [74, -296], [-222, 296], [222, 296],
];

export class Tokens {
  constructor(scene) {
    this.scene = scene;
    this.list = [];
    this.collected = 0;
    const geo = new THREE.TorusGeometry(1.1, 0.28, 10, 20);
    for (let i = 0; i < CONFIG.tokenCount; i++) {
      const [x, z] = SPOTS[i % SPOTS.length];
      const mat = new THREE.MeshBasicMaterial({ color: 0x2ee6ff });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(x, 1.6, z);
      scene.add(mesh);
      this.list.push({ id: i, x, z, taken: false, mesh, phase: i * 0.7 });
    }
  }

  reset(takenIds = []) {
    this.collected = 0;
    for (const t of this.list) {
      t.taken = takenIds.includes(t.id);
      t.mesh.visible = !t.taken;
      if (t.taken) this.collected++;
    }
  }

  update(dt, game) {
    const p = game.player;
    for (const t of this.list) {
      if (t.taken) continue;
      t.mesh.rotation.y += dt * 1.8;
      t.mesh.position.y = 1.6 + Math.sin(game.time * 2 + t.phase) * 0.25;
      const car = p.inCar;
      const dx = (car ? car.x : p.x) - t.x;
      const dz = (car ? car.z : p.z) - t.z;
      if (Math.hypot(dx, dz) < 3.5) {
        t.taken = true;
        t.mesh.visible = false;
        this.collected++;
        game.cash += CONFIG.tokenValue;
        game.audio.pickup();
        game.effects.burst(t.x, 1.6, t.z, 0x2ee6ff, 14, 4, 3, 0.7);
        game.hud.toast(`Neon token +$${CONFIG.tokenValue}  (${this.collected} / ${CONFIG.tokenCount})`);
      }
    }
  }
}
