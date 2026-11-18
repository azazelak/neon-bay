// Neon Bay — 12 collectible neon tokens, $50 each, spinning above the
// streets. The HUD counts them; the save file remembers them.

import * as THREE from 'three';
import { CFG } from './config.js';
import { Rng } from './rng.js';

export class Tokens {
  constructor(scene) {
    this.scene = scene;
    this.rng = new Rng(4242);
    this.items = [];
    this.collected = 0;
    this.group = new THREE.Group();
    scene.add(this.group);
    this.build();
  }

  build() {
    const rng = this.rng;
    const geo = new THREE.TorusGeometry(0.9, 0.22, 10, 20);
    const mat = new THREE.MeshBasicMaterial({ color: 0x2ad4ff });
    const placed = [];
    for (let i = 0; i < CFG.tokenCount; i++) {
      // Spread across the city, on roads where the player actually goes.
      let x, z, tries = 0;
      do {
        const a = rng.pick([-320, -240, -160, -80, 0, 80, 160, 240, 320]);
        const along = rng.float(-300, 300);
        if (rng.chance(0.5)) { x = along; z = a; } else { x = a; z = along; }
        tries++;
      } while (tries < 20 && placed.some((p) => Math.hypot(p.x - x, p.z - z) < 60));
      placed.push({ x, z });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(x, 1.6, z);
      this.group.add(mesh);
      // A soft glow ring under each token.
      const ring = new THREE.Mesh(
        new THREE.RingGeometry(0.9, 1.3, 24),
        new THREE.MeshBasicMaterial({ color: 0x2ad4ff, transparent: true, opacity: 0.4, side: THREE.DoubleSide }),
      );
      ring.rotation.x = -Math.PI / 2;
      ring.position.set(x, 0.12, z);
      this.group.add(ring);
      this.items.push({ mesh, ring, x, z, taken: false, phase: rng.float(0, Math.PI * 2) });
    }
  }

  update(dt, time, px, pz, onCollect) {
    for (const t of this.items) {
      if (t.taken) continue;
      t.mesh.rotation.y += dt * 1.8;
      t.mesh.position.y = 1.6 + Math.sin(time * 2 + t.phase) * 0.25;
      if (Math.hypot(t.x - px, t.z - pz) < 2.4) {
        t.taken = true;
        t.mesh.visible = false;
        t.ring.visible = false;
        this.collected++;
        if (onCollect) onCollect(t);
      }
    }
  }

  // Restore collected state from a save (indices of taken tokens).
  setCollected(indices) {
    for (const i of indices) {
      if (this.items[i] && !this.items[i].taken) {
        this.items[i].taken = true;
        this.items[i].mesh.visible = false;
        this.items[i].ring.visible = false;
        this.collected++;
      }
    }
  }

  takenIndices() {
    return this.items.map((t, i) => (t.taken ? i : -1)).filter((i) => i >= 0);
  }
}
