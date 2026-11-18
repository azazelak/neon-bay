// Neon Bay v4 — effects: a pooled particle system (gun hits, pickups,
// stunt sparks, tire skids) plus damage smoke from wrecked cars and short
// gun tracers. Everything is reused, nothing allocates per frame.
import * as THREE from 'three';

export function createEffects(scene) {
  const COUNT = 90;
  const geo = new THREE.BoxGeometry(0.28, 0.28, 0.28);
  const parts = [];
  for (let i = 0; i < COUNT; i++) {
    const mat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true });
    const m = new THREE.Mesh(geo, mat);
    m.visible = false;
    scene.add(m);
    parts.push({ mesh: m, vx: 0, vy: 0, vz: 0, life: 0, max: 1 });
  }
  let next = 0;
  const tracers = [];
  const tGeo = new THREE.BoxGeometry(0.12, 0.12, 1);

  function burst(x, y, z, color, n, speed) {
    for (let i = 0; i < n; i++) {
      const p = parts[next]; next = (next + 1) % COUNT;
      p.mesh.visible = true;
      p.mesh.material.color.setHex(color);
      p.mesh.position.set(x, y, z);
      const a = Math.random() * Math.PI * 2, b = Math.random() * Math.PI - Math.PI / 2;
      const s = speed * (0.5 + Math.random());
      p.vx = Math.cos(a) * Math.cos(b) * s;
      p.vy = Math.abs(Math.sin(b)) * s + 2;
      p.vz = Math.sin(a) * Math.cos(b) * s;
      p.max = p.life = 0.5 + Math.random() * 0.5;
      p.mesh.material.opacity = 1;
      p.mesh.scale.setScalar(0.6 + Math.random() * 0.9);
    }
  }

  function tracer(x1, y1, z1, x2, y2, z2) {
    const mat = new THREE.MeshBasicMaterial({ color: 0xffe9a8, transparent: true });
    const m = new THREE.Mesh(tGeo, mat);
    const dx = x2 - x1, dy = y2 - y1, dz = z2 - z1;
    const len = Math.hypot(dx, dy, dz) || 1;
    m.scale.set(1, 1, len);
    m.position.set((x1 + x2) / 2, (y1 + y2) / 2, (z1 + z2) / 2);
    m.lookAt(x2, y2, z2);
    scene.add(m);
    tracers.push({ mesh: m, life: 0.09 });
  }

  function smoke(x, y, z) {
    const p = parts[next]; next = (next + 1) % COUNT;
    p.mesh.visible = true;
    p.mesh.material.color.setHex(0x555560);
    p.mesh.position.set(x, y, z);
    p.vx = (Math.random() - 0.5) * 1.2; p.vy = 2.5 + Math.random(); p.vz = (Math.random() - 0.5) * 1.2;
    p.max = p.life = 0.9;
    p.mesh.material.opacity = 0.7;
    p.mesh.scale.setScalar(1.6);
  }

  function update(dt) {
    for (const p of parts) {
      if (p.life <= 0) continue;
      p.life -= dt;
      if (p.life <= 0) { p.mesh.visible = false; continue; }
      p.vy -= 6 * dt;
      p.mesh.position.x += p.vx * dt;
      p.mesh.position.y += p.vy * dt;
      p.mesh.position.z += p.vz * dt;
      p.mesh.material.opacity = p.life / p.max;
    }
    for (let i = tracers.length - 1; i >= 0; i--) {
      const tr = tracers[i];
      tr.life -= dt;
      if (tr.life <= 0) {
        scene.remove(tr.mesh);
        tr.mesh.material.dispose();
        tracers.splice(i, 1);
      }
    }
  }

  return { burst, tracer, smoke, update };
}
