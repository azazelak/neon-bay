// Neon Bay — particles and tracers. One pooled THREE.Points cloud for
// bursts (muzzle smoke, blood, crash sparks, pickup glints) and a fading
// line for each gunshot tracer. Cheap, allocation-free after boot.
import * as THREE from 'three';

const MAX = 400;

export class Effects {
  constructor(scene) {
    this.scene = scene;
    this.positions = new Float32Array(MAX * 3);
    this.colors = new Float32Array(MAX * 3);
    this.parts = [];
    for (let i = 0; i < MAX; i++) {
      this.parts.push({ life: 0, max: 1, vx: 0, vy: 0, vz: 0 });
      this.positions[i * 3 + 1] = -100; // park unused particles below the world
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(this.colors, 3));
    const mat = new THREE.PointsMaterial({ size: 0.35, vertexColors: true, transparent: true, opacity: 0.95, depthWrite: false });
    this.points = new THREE.Points(geo, mat);
    this.points.frustumCulled = false;
    scene.add(this.points);
    this.tracers = [];
    this._cursor = 0;
  }

  burst(pos, colorHex, count = 10, speed = 5) {
    const color = new THREE.Color(colorHex);
    for (let n = 0; n < count; n++) {
      const i = this._cursor;
      this._cursor = (this._cursor + 1) % MAX;
      const p = this.parts[i];
      p.life = p.max = 0.5 + Math.random() * 0.5;
      const a = Math.random() * Math.PI * 2;
      const up = Math.random() * speed * 0.8;
      p.vx = Math.cos(a) * speed * (0.4 + Math.random() * 0.6);
      p.vy = up;
      p.vz = Math.sin(a) * speed * (0.4 + Math.random() * 0.6);
      this.positions[i * 3] = pos.x;
      this.positions[i * 3 + 1] = pos.y ?? 1;
      this.positions[i * 3 + 2] = pos.z;
      this.colors[i * 3] = color.r;
      this.colors[i * 3 + 1] = color.g;
      this.colors[i * 3 + 2] = color.b;
    }
    this.points.geometry.attributes.position.needsUpdate = true;
    this.points.geometry.attributes.color.needsUpdate = true;
  }

  smoke(pos, count = 12) {
    this.burst({ x: pos.x, y: (pos.y ?? 0) + 0.8, z: pos.z }, 0x666677, count, 2);
  }

  tracer(from, to) {
    const geo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(from.x, from.y, from.z),
      new THREE.Vector3(to.x, to.y, to.z),
    ]);
    const mat = new THREE.LineBasicMaterial({ color: 0xffe9a8, transparent: true, opacity: 0.9 });
    const line = new THREE.Line(geo, mat);
    this.scene.add(line);
    this.tracers.push({ line, life: 0.12 });
  }

  update(dt) {
    let dirty = false;
    for (let i = 0; i < MAX; i++) {
      const p = this.parts[i];
      if (p.life <= 0) continue;
      dirty = true;
      p.life -= dt;
      if (p.life <= 0) {
        this.positions[i * 3 + 1] = -100;
        continue;
      }
      p.vy -= 6 * dt;
      this.positions[i * 3] += p.vx * dt;
      this.positions[i * 3 + 1] += p.vy * dt;
      this.positions[i * 3 + 2] += p.vz * dt;
    }
    if (dirty) this.points.geometry.attributes.position.needsUpdate = true;
    for (let i = this.tracers.length - 1; i >= 0; i--) {
      const t = this.tracers[i];
      t.life -= dt;
      t.line.material.opacity = Math.max(0, t.life / 0.12) * 0.9;
      if (t.life <= 0) {
        this.scene.remove(t.line);
        t.line.geometry.dispose();
        t.line.material.dispose();
        this.tracers.splice(i, 1);
      }
    }
  }
}
