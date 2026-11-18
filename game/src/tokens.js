// Neon Bay v4 — 20 collectible neon tokens, $50 each. They float and spin
// over roads, sidewalks, the plaza and the pier, and are picked up on foot
// or by car within 3 m.
import * as THREE from 'three';
import { TOKEN_COUNT } from './config.js';

const SPOTS = [
  [-288, -288], [-96, -192], [96, -288], [288, -192], [-192, -96], [0, -96],
  [192, -288], [-288, 0], [96, 0], [288, 0], [-96, 96], [192, 96], [-288, 192],
  [0, 192], [288, 288], [-192, 288], [48, 48], [384, -96], [384, 288], [452, 0],
];

export function createTokens(scene) {
  const tokens = [];
  const geo = new THREE.OctahedronGeometry(0.9);
  for (let i = 0; i < TOKEN_COUNT; i++) {
    const [x, z] = SPOTS[i];
    const mat = new THREE.MeshBasicMaterial({ color: 0xff2e88 });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(x, 2.2, z);
    scene.add(mesh);
    tokens.push({ x, z, mesh, taken: false, phase: i * 0.7 });
  }
  let collected = 0;

  function update(dt, t, px, pz, onCollect) {
    for (const tk of tokens) {
      if (tk.taken) continue;
      tk.mesh.rotation.y += dt * 2.2;
      tk.mesh.position.y = 2.2 + Math.sin(t * 2 + tk.phase) * 0.4;
      const dx = px - tk.x, dz = pz - tk.z;
      if (dx * dx + dz * dz < 9) {
        tk.taken = true;
        tk.mesh.visible = false;
        collected++;
        if (onCollect) onCollect(tk);
      }
    }
  }

  function reset() {
    collected = 0;
    for (const tk of tokens) { tk.taken = false; tk.mesh.visible = true; }
  }

  function setCollected(n) {
    collected = 0;
    for (const tk of tokens) {
      if (collected < n) { tk.taken = true; tk.mesh.visible = false; collected++; }
      else { tk.taken = false; tk.mesh.visible = true; }
    }
  }

  return { tokens, get collected() { return collected; }, update, reset, setCollected };
}
