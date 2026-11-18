// Pooled particles and gun tracers. One THREE.Points cloud (400 slots)
// handles every burst — sparks, smoke, muzzle flashes, token sparkles —
// so effects never allocate during play.
import * as THREE from 'three';

const MAX = 400;

export class Effects {
  constructor(scene) {
    this.scene = scene;
    this.pos = new Float32Array(MAX * 3);
    this.col = new Float32Array(MAX * 3);
    this.vel = new Float32Array(MAX * 3);
    this.life = new Float32Array(MAX);
    this.maxLife = new Float32Array(MAX);
    this.grav = new Float32Array(MAX);
    this.cursor = 0;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(this.col, 3));
    this.points = new THREE.Points(
      geo,
      new THREE.PointsMaterial({ size: 0.55, vertexColors: true, transparent: true, opacity: 0.95, depthWrite: false }),
    );
    this.points.frustumCulled = false;
    scene.add(this.points);
    // Tracer pool: thin stretched boxes, one per shot.
    this.tracers = [];
    for (let i = 0; i < 8; i++) {
      const m = new THREE.Mesh(
        new THREE.BoxGeometry(0.07, 0.07, 1),
        new THREE.MeshBasicMaterial({ color: 0xffe9a0, transparent: true, opacity: 0 }),
      );
      m.visible = false;
      scene.add(m);
      this.tracers.push({ mesh: m, life: 0 });
    }
    this.tracerI = 0;
  }

  burst(x, y, z, color, n, speed, up = 2, life = 0.7, gravity = 6) {
    const c = new THREE.Color(color);
    for (let k = 0; k < n; k++) {
      const i = this.cursor;
      this.cursor = (this.cursor + 1) % MAX;
      this.pos[i * 3] = x;
      this.pos[i * 3 + 1] = y;
      this.pos[i * 3 + 2] = z;
      const a = Math.random() * Math.PI * 2;
      const s = speed * (0.4 + Math.random() * 0.8);
      this.vel[i * 3] = Math.cos(a) * s;
      this.vel[i * 3 + 1] = up * (0.5 + Math.random());
      this.vel[i * 3 + 2] = Math.sin(a) * s;
      this.col[i * 3] = c.r;
      this.col[i * 3 + 1] = c.g;
      this.col[i * 3 + 2] = c.b;
      this.life[i] = this.maxLife[i] = life * (0.6 + Math.random() * 0.7);
      this.grav[i] = gravity;
    }
  }

  smoke(x, y, z) {
    this.burst(x, y, z, 0x555560, 3, 0.8, 1.2, 1.4, -0.5);
  }

  tracer(from, to) {
    const t = this.tracers[this.tracerI];
    this.tracerI = (this.tracerI + 1) % this.tracers.length;
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const dz = to.z - from.z;
    const len = Math.hypot(dx, dy, dz);
    t.mesh.position.set((from.x + to.x) / 2, (from.y + to.y) / 2, (from.z + to.z) / 2);
    t.mesh.scale.set(1, 1, len);
    t.mesh.lookAt(to.x, to.y, to.z);
    t.mesh.visible = true;
    t.mesh.material.opacity = 0.9;
    t.life = 0.09;
  }

  update(dt) {
    for (let i = 0; i < MAX; i++) {
      if (this.life[i] <= 0) {
        this.pos[i * 3 + 1] = -100; // park dead particles underground
        continue;
      }
      this.life[i] -= dt;
      this.vel[i * 3 + 1] -= this.grav[i] * dt;
      this.pos[i * 3] += this.vel[i * 3] * dt;
      this.pos[i * 3 + 1] += this.vel[i * 3 + 1] * dt;
      this.pos[i * 3 + 2] += this.vel[i * 3 + 2] * dt;
    }
    this.points.geometry.attributes.position.needsUpdate = true;
    this.points.geometry.attributes.color.needsUpdate = true;
    for (const t of this.tracers) {
      if (t.life > 0) {
        t.life -= dt;
        t.mesh.material.opacity = Math.max(0, t.life / 0.09) * 0.9;
        if (t.life <= 0) t.mesh.visible = false;
      }
    }
  }
}
