// Neon Bay v4 — Rico on foot: walk, sprint, jump, enter and exit cars.
// Moves as a circle against building AABBs; the camera and HUD read him
// through main.js. Health 100; getting arrested or killed ends the run.
import * as THREE from 'three';
import { clamp } from './config.js';

const SKINS = [0xc98a6a, 0x8a5a3a, 0xe8b88a, 0x6a4028];
const SHIRTS = [0x2e6b8a, 0x8a2e2e, 0x2e8a4a, 0xc2a23a, 0x5a2e8a, 0xd8d8d8];

export function makePedFigure(scene, opts) {
  const skin = opts.skin ?? SKINS[opts.seed % SKINS.length];
  const shirt = opts.shirt ?? SHIRTS[(opts.seed + 2) % SHIRTS.length];
  const h = opts.height ?? 1.8;
  const g = new THREE.Group();
  const skinMat = new THREE.MeshLambertMaterial({ color: skin });
  const shirtMat = new THREE.MeshLambertMaterial({ color: shirt });
  const pantsMat = new THREE.MeshLambertMaterial({ color: opts.pants ?? 0x2c3242 });
  const box = new THREE.BoxGeometry(1, 1, 1);
  const body = new THREE.Mesh(box, shirtMat);
  body.scale.set(0.55, 0.75, 0.32); body.position.y = 1.05 * h / 1.8; g.add(body);
  const head = new THREE.Mesh(box, skinMat);
  head.scale.set(0.4, 0.4, 0.4); head.position.y = 1.62 * h / 1.8; g.add(head);
  const hair = new THREE.Mesh(box, new THREE.MeshLambertMaterial({ color: opts.hair ?? 0x1a1a1a }));
  hair.scale.set(0.42, 0.16, 0.42); hair.position.y = 1.86 * h / 1.8; g.add(hair);
  for (const s of [-1, 1]) {
    const leg = new THREE.Mesh(box, pantsMat);
    leg.scale.set(0.2, 0.7, 0.24); leg.position.set(s * 0.14, 0.35 * h / 1.8, 0); g.add(leg);
    const arm = new THREE.Mesh(box, shirtMat);
    arm.scale.set(0.16, 0.62, 0.2); arm.position.set(s * 0.36, 1.05 * h / 1.8, 0); g.add(arm);
  }
  if (opts.hat) {
    const hat = new THREE.Mesh(box, new THREE.MeshLambertMaterial({ color: 0xd8c25a }));
    hat.scale.set(0.5, 0.1, 0.5); hat.position.y = 1.96 * h / 1.8; g.add(hat);
  }
  g.scale.setScalar(h / 1.8);
  scene.add(g);
  return g;
}

export class Player {
  constructor(scene) {
    this.x = 0; this.z = 0; this.y = 0; this.yaw = 0;
    this.vy = 0; this.grounded = true;
    this.health = 100; this.onFoot = true; this.car = null;
    this.walkSpeed = 6; this.runSpeed = 10;
    this.group = makePedFigure(scene, { seed: 1, shirt: 0x2e6b8a, height: 1.85 });
    this.group.position.set(0, 0, 0);
    this.scene = scene;
  }

  step(input, dt, colliders) {
    if (!this.onFoot) return;
    const run = input.run ? this.runSpeed : this.walkSpeed;
    let mx = 0, mz = 0;
    if (input.forward) { mx += Math.sin(this.yaw); mz += Math.cos(this.yaw); }
    if (input.back) { mx -= Math.sin(this.yaw); mz -= Math.cos(this.yaw); }
    if (input.left) { mx += Math.cos(this.yaw); mz -= Math.sin(this.yaw); }
    if (input.right) { mx -= Math.cos(this.yaw); mz += Math.sin(this.yaw); }
    const len = Math.hypot(mx, mz);
    if (len > 0) {
      mx /= len; mz /= len;
      this.x += mx * run * dt; this.z += mz * run * dt;
      // Circle vs building AABBs.
      const r = 0.7;
      for (const c of colliders) {
        const qx = clamp(this.x, c.x - c.hw, c.x + c.hw);
        const qz = clamp(this.z - 0, c.z - c.hd, c.z + c.hd);
        const dx = this.x - qx, dz = this.z - qz;
        const d2 = dx * dx + dz * dz;
        if (d2 < r * r) {
          const d = Math.sqrt(d2) || 0.001;
          this.x = qx + (dx / d) * r; this.z = qz + (dz / d) * r;
        }
      }
      this.x = clamp(this.x, -430, 640);
      this.z = clamp(this.z, -430, 430);
    }
    if (input.jump && this.grounded) { this.vy = 7; this.grounded = false; }
    if (!this.grounded) {
      this.vy -= 22 * dt;
      this.y += this.vy * dt;
      if (this.y <= 0) { this.y = 0; this.vy = 0; this.grounded = true; }
    }
    this.group.position.set(this.x, this.y, this.z);
    this.group.rotation.y = this.yaw;
    // Walk bob.
    const bob = len > 0 ? Math.sin(performance.now() / 90) * 0.05 : 0;
    this.group.position.y = this.y + Math.abs(bob);
  }

  place(x, z, yaw) {
    this.x = x; this.z = z; this.yaw = yaw ?? this.yaw;
    this.group.position.set(x, 0, z);
    this.group.rotation.y = this.yaw;
  }

  damage(amount) {
    this.health -= amount;
    if (this.health < 0) this.health = 0;
  }

  hide() { this.group.visible = false; }
  show() { this.group.visible = true; }
}
