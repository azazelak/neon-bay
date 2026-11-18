// Neon Bay — pooled particle bursts and smoke puffs.
// One Points cloud per burst, recycled, so the frame rate never notices.

import * as THREE from 'three';

export class Effects {
  constructor(scene) {
    this.scene = scene;
    this.bursts = [];
  }

  burst(x, y, z, color, count = 12) {
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(count * 3);
    const vel = [];
    for (let i = 0; i < count; i++) {
      pos[i * 3] = x;
      pos[i * 3 + 1] = y;
      pos[i * 3 + 2] = z;
      const a = Math.random() * Math.PI * 2;
      const s = 2 + Math.random() * 5;
      vel.push({ x: Math.cos(a) * s, y: 2 + Math.random() * 4, z: Math.sin(a) * s });
    }
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const mat = new THREE.PointsMaterial({ color, size: 0.5, transparent: true, opacity: 1 });
    const points = new THREE.Points(geo, mat);
    this.scene.add(points);
    this.bursts.push({ points, vel, life: 0.7, max: 0.7 });
  }

  smoke(x, y, z) {
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(6 * 3);
    const vel = [];
    for (let i = 0; i < 6; i++) {
      pos[i * 3] = x + (Math.random() - 0.5);
      pos[i * 3 + 1] = y + Math.random() * 0.5;
      pos[i * 3 + 2] = z + (Math.random() - 0.5);
      vel.push({ x: (Math.random() - 0.5) * 0.6, y: 1 + Math.random(), z: (Math.random() - 0.5) * 0.6 });
    }
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const mat = new THREE.PointsMaterial({ color: 0x555555, size: 1.1, transparent: true, opacity: 0.7 });
    const points = new THREE.Points(geo, mat);
    this.scene.add(points);
    this.bursts.push({ points, vel, life: 1.4, max: 1.4 });
  }

  update(dt) {
    for (let i = this.bursts.length - 1; i >= 0; i--) {
      const b = this.bursts[i];
      b.life -= dt;
      const attr = b.points.geometry.getAttribute('position');
      for (let j = 0; j < b.vel.length; j++) {
        attr.array[j * 3] += b.vel[j].x * dt;
        attr.array[j * 3 + 1] += b.vel[j].y * dt;
        attr.array[j * 3 + 2] += b.vel[j].z * dt;
        b.vel[j].y -= 6 * dt;
      }
      attr.needsUpdate = true;
      b.points.material.opacity = Math.max(0, b.life / b.max);
      if (b.life <= 0) {
        this.scene.remove(b.points);
        b.points.geometry.dispose();
        b.points.material.dispose();
        this.bursts.splice(i, 1);
      }
    }
  }
}
