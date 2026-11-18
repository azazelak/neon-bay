// Neon Bay v4 — Car: a box-built car with arcade physics. Steering, throttle
// and brake are -1..1 inputs; the car accelerates toward its kind's top speed,
// grips through turns, and slides a little when handbraking. Collides with
// building AABBs as a circle and with other cars by soft separation.
import * as THREE from 'three';
import { CAR_KINDS, clamp } from './config.js';

const bodyGeo = new THREE.BoxGeometry(1, 1, 1);
const wheelGeo = new THREE.CylinderGeometry(0.42, 0.42, 0.34, 12);

export class Car {
  constructor(scene, kind, x, z, yaw) {
    this.kind = CAR_KINDS[kind] || CAR_KINDS.sedan;
    this.x = x; this.z = z; this.yaw = yaw || 0;
    this.speed = 0; this.hp = 100; this.dead = false;
    this.smoke = 0; // seconds of smoke emission left
    this.group = new THREE.Group();
    const bodyMat = new THREE.MeshLambertMaterial({ color: this.kind.color });
    const darkMat = new THREE.MeshLambertMaterial({ color: 0x14161c });
    const glassMat = new THREE.MeshLambertMaterial({ color: 0x2c3e55 });
    const L = this.kind.len, W = this.kind.wid;
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    body.scale.set(W, 0.75, L); body.position.y = 0.62; this.group.add(body);
    const cabin = new THREE.Mesh(bodyGeo, glassMat);
    cabin.scale.set(W * 0.82, 0.62, L * 0.48); cabin.position.set(0, 1.28, -L * 0.06); this.group.add(cabin);
    const hood = new THREE.Mesh(bodyGeo, bodyMat);
    hood.scale.set(W * 0.9, 0.16, L * 0.2); hood.position.set(0, 1.02, L * 0.36); this.group.add(hood);
    // Headlights + taillights.
    const lightMat = new THREE.MeshBasicMaterial({ color: 0xfff2b0 });
    const tailMat = new THREE.MeshBasicMaterial({ color: 0xff2222 });
    for (const s of [-1, 1]) {
      const hl = new THREE.Mesh(bodyGeo, lightMat);
      hl.scale.set(0.4, 0.22, 0.1); hl.position.set(s * W * 0.32, 0.66, L / 2 + 0.02); this.group.add(hl);
      const tl = new THREE.Mesh(bodyGeo, tailMat);
      tl.scale.set(0.4, 0.22, 0.1); tl.position.set(s * W * 0.32, 0.66, -L / 2 - 0.02); this.group.add(tl);
    }
    // Police light bar on cruisers.
    if (kind === 'cruiser') {
      const bar = new THREE.Mesh(bodyGeo, new THREE.MeshLambertMaterial({ color: 0xffffff }));
      bar.scale.set(W * 0.7, 0.18, 0.5); bar.position.set(0, 1.66, -L * 0.06); this.group.add(bar);
      this.barL = new THREE.Mesh(bodyGeo, new THREE.MeshBasicMaterial({ color: 0xff2222 }));
      this.barL.scale.set(W * 0.32, 0.22, 0.54); this.barL.position.set(-W * 0.18, 1.66, -L * 0.06);
      this.group.add(this.barL);
      this.barR = new THREE.Mesh(bodyGeo, new THREE.MeshBasicMaterial({ color: 0x2244ff }));
      this.barR.scale.set(W * 0.32, 0.22, 0.54); this.barR.position.set(W * 0.18, 1.66, -L * 0.06);
      this.group.add(this.barR);
      const door = new THREE.Mesh(bodyGeo, new THREE.MeshLambertMaterial({ color: 0xf0f0f0 }));
      door.scale.set(0.06, 0.6, L * 0.4); door.position.set(W / 2 + 0.01, 0.7, 0); this.group.add(door);
      const door2 = door.clone(); door2.position.x = -W / 2 - 0.01; this.group.add(door2);
    }
    if (kind === 'taxi') {
      const sign = new THREE.Mesh(bodyGeo, new THREE.MeshBasicMaterial({ color: 0xffe94a }));
      sign.scale.set(0.9, 0.3, 0.5); sign.position.set(0, 1.72, -L * 0.06); this.group.add(sign);
    }
    if (kind === 'muscle') {
      const scoop = new THREE.Mesh(bodyGeo, darkMat);
      scoop.scale.set(0.8, 0.22, 1.1); scoop.position.set(0, 1.08, L * 0.22); this.group.add(scoop);
    }
    this.wheels = [];
    for (const [wx, wz] of [[-W / 2, L * 0.32], [W / 2, L * 0.32], [-W / 2, -L * 0.32], [W / 2, -L * 0.32]]) {
      const wheel = new THREE.Mesh(wheelGeo, darkMat);
      wheel.rotation.z = Math.PI / 2;
      wheel.position.set(wx, 0.42, wz);
      this.group.add(wheel); this.wheels.push(wheel);
    }
    this.group.position.set(x, 0, z);
    this.group.rotation.y = yaw;
    scene.add(this.group);
    this.scene = scene;
  }

  // Drive one step. Returns nothing; callers read this.speed / position.
  step(throttle, steer, brake, dt, colliders, others) {
    if (this.dead) { this.speed *= 1 - 3 * dt; }
    else {
      const top = this.kind.top;
      if (throttle > 0) this.speed += this.kind.accel * throttle * dt;
      else if (throttle < 0) this.speed += this.kind.accel * 0.7 * throttle * dt; // reverse
      if (brake) this.speed -= Math.sign(this.speed) * 26 * dt;
      // Drag + rolling resistance.
      this.speed -= this.speed * 0.35 * dt;
      if (Math.abs(this.speed) < 0.05 && throttle === 0) this.speed = 0;
      this.speed = clamp(this.speed, -12, top);
      const grip = brake ? this.kind.grip * 0.55 : this.kind.grip;
      this.yaw += steer * grip * 0.55 * dt * clamp(Math.abs(this.speed) / 8, 0, 1) * Math.sign(this.speed || 1);
    }
    const nx = this.x + Math.sin(this.yaw) * this.speed * dt;
    const nz = this.z + Math.cos(this.yaw) * this.speed * dt;
    // Building AABB collision, circle radius ~ half length.
    const r = this.kind.len * 0.42;
    let cx = nx, cz = nz, hit = false;
    for (const c of colliders) {
      const qx = clamp(cx, c.x - c.hw, c.x + c.hw);
      const qz = clamp(cz, c.z - c.hd, c.z + c.hd);
      const dx = cx - qx, dz = cz - qz;
      const d2 = dx * dx + dz * dz;
      if (d2 < r * r) {
        const d = Math.sqrt(d2) || 0.001;
        cx = qx + (dx / d) * r; cz = qz + (dz / d) * r;
        hit = true;
      }
    }
    if (hit) this.speed *= 0.55;
    this.x = cx; this.z = cz;
    // Soft separation from other cars.
    if (others) {
      for (const o of others) {
        if (o === this || o.dead) continue;
        const dx = this.x - o.x, dz = this.z - o.z;
        const d2 = dx * dx + dz * dz;
        const min = 3.4;
        if (d2 < min * min && d2 > 0.001) {
          const d = Math.sqrt(d2);
          const push = (min - d) / 2;
          this.x += (dx / d) * push; this.z += (dz / d) * push;
          o.x -= (dx / d) * push; o.z -= (dz / d) * push;
          this.speed *= 0.92; o.speed *= 0.92;
        }
      }
    }
    // Keep inside the world.
    this.x = clamp(this.x, -430, 640);
    this.z = clamp(this.z, -430, 430);
    this.group.position.set(this.x, this.airY || 0, this.z);
    this.group.rotation.y = this.yaw;
    for (const w of this.wheels) w.rotation.x += this.speed * dt * 2.4;
    if (this.barL) {
      const on = Math.floor(performance.now() / 280) % 2 === 0;
      this.barL.material.color.setHex(on ? 0xff2222 : 0x551111);
      this.barR.material.color.setHex(on ? 0x111155 : 0x2244ff);
    }
  }

  damage(amount) {
    this.hp -= amount;
    if (this.hp <= 0) { this.hp = 0; this.dead = true; this.smoke = 6; }
    else if (this.hp < 40) this.smoke = 2;
  }

  remove() { this.scene.remove(this.group); }
}
