// Neon Bay — neon tokens, the side activity. Twelve glowing tokens sit at
// fixed spots around the city (rooftop corners, the pier, the promenade,
// the marina). Drive or walk through one and it pays cash: a reason to
// explore every district between jobs.
import * as THREE from 'three';
import { CFG } from './config.js';
import { makeRng } from './rng.js';

export class TokenManager {
  constructor(scene, city, seed = CFG.seed + 21) {
    this.scene = scene;
    this.tokens = []; // { mesh, ring, x, z, taken }
    this.collected = 0;
    this.total = CFG.tokenCount;
    const rng = makeRng(seed);
    const lines = city.roadLines;
    const spots = [];
    // Tokens hug the roads and the sights: corners, the beach, the pier.
    while (spots.length < CFG.tokenCount) {
      const line = rng.pick(lines);
      const along = rng.range(-CFG.worldHalf + 24, CFG.worldHalf - 24);
      const x = rng.chance(0.5) ? line + rng.pick([-9, 9]) : along;
      const z = rng.chance(0.5) ? along : line + rng.pick([-9, 9]);
      if (spots.some((s) => Math.hypot(s.x - x, s.z - z) < 40)) continue;
      spots.push({ x, z });
    }
    // One token always waits at the end of the pier.
    spots[0] = { x: 20, z: CFG.worldHalf + 34 };
    const geo = new THREE.OctahedronGeometry(0.9);
    const ringGeo = new THREE.TorusGeometry(1.5, 0.08, 8, 24);
    for (const s of spots) {
      const mat = new THREE.MeshBasicMaterial({ color: 0xffe600 });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(s.x, 1.6, s.z);
      scene.add(mesh);
      const ring = new THREE.Mesh(
        ringGeo,
        new THREE.MeshBasicMaterial({ color: 0x00e5ff, transparent: true, opacity: 0.7 }),
      );
      ring.rotation.x = Math.PI / 2;
      ring.position.set(s.x, 0.3, s.z);
      scene.add(ring);
      this.tokens.push({ mesh, ring, x: s.x, z: s.z, taken: false, phase: rng.range(0, 6) });
    }
  }

  update(dt, time, player, onCollect) {
    for (const t of this.tokens) {
      if (t.taken) continue;
      t.mesh.rotation.y += dt * 2.2;
      t.mesh.position.y = 1.6 + Math.sin(time * 2 + t.phase) * 0.35;
      const d = Math.hypot(player.x - t.x, player.z - t.z);
      if (d < 2.4) {
        t.taken = true;
        this.scene.remove(t.mesh);
        this.scene.remove(t.ring);
        this.collected++;
        onCollect(CFG.tokenReward);
      }
    }
  }
}
