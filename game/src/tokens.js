// Neon Bay v5c — 20 collectible neon tokens, $50 each.
import * as THREE from '../vendor/three.module.min.js';
import { CFG } from './config.js';

export class Tokens {
  constructor(game, rng) {
    this.game = game;
    this.items = [];
    const spots = [];
    for (let i = 0; i < 20; i++) {
      spots.push([rng.int(-4, 4) * 40 + rng.range(-6, 6), rng.int(-4, 4) * 40 + rng.range(-6, 6)]);
    }
    spots.push([135, 200], [95, 212], [-60, -44], [40, 64]);
    const taken = spots.slice(0, 20);
    for (const [x, z] of taken) {
      const mesh = new THREE.Mesh(
        new THREE.OctahedronGeometry(0.7),
        new THREE.MeshBasicMaterial({ color: 0xff2e88 }),
      );
      mesh.position.set(x, 1.4, z);
      game.scene.add(mesh);
      this.items.push({ x, z, mesh, got: false });
    }
  }

  get count() { return this.items.filter((t) => t.got).length; }

  update(dt, t) {
    const p = this.game.player;
    for (const tok of this.items) {
      if (tok.got) continue;
      tok.mesh.rotation.y = t * 2;
      tok.mesh.position.y = 1.4 + Math.sin(t * 3 + tok.x) * 0.25;
      const d = Math.hypot(p.pos.x - tok.x, p.pos.z - tok.z);
      if (d < 3) {
        tok.got = true;
        tok.mesh.visible = false;
        this.game.cash += CFG.tokenValue;
        this.game.hud?.toast('Neon token', `+$${CFG.tokenValue}  (${this.count}/20)`);
        this.game.audio?.cash();
      }
    }
  }
}
