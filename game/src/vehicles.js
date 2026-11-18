// Neon Bay v5c — car meshes and driving physics.
// Fixes built in from the start: yaw wrapped to [-pi, pi] in step();
// brakes clamp at 0 and never overshoot into reverse; a wall scrape keeps
// x0.85 speed, a head-on hit keeps x0.4; step() returns 0/1/2 severity.
import * as THREE from '../vendor/three.module.min.js';
import { CFG } from './config.js';

export function makeCarMesh(kind, color, police = false) {
  const g = new THREE.Group();
  const def = CFG.carKinds[kind] || CFG.carKinds.sedan;
  const bodyCol = police ? 0x14181f : (color ?? def.color);
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(2.1, 0.75, 4.4),
    new THREE.MeshStandardMaterial({ color: bodyCol, metalness: 0.45, roughness: 0.35 }),
  );
  body.position.y = 0.65; g.add(body);
  const cabin = new THREE.Mesh(
    new THREE.BoxGeometry(1.8, 0.65, 2.2),
    new THREE.MeshStandardMaterial({ color: police ? 0xdddddd : 0x1a2028, metalness: 0.3, roughness: 0.2 }),
  );
  cabin.position.set(0, 1.3, -0.2); g.add(cabin);
  if (kind === 'muscle') {
    const scoop = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.25, 1.2),
      new THREE.MeshStandardMaterial({ color: 0x111111 }));
    scoop.position.set(0, 1.1, 1.2); g.add(scoop);
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.02, 4.4),
      new THREE.MeshBasicMaterial({ color: 0xffffff }));
    stripe.position.set(0, 1.04, 0); g.add(stripe);
  }
  if (kind === 'pickup') {
    const bed = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.4, 1.6),
      new THREE.MeshStandardMaterial({ color: bodyCol, metalness: 0.4, roughness: 0.4 }));
    bed.position.set(0, 0.9, -1.3); g.add(bed);
  }
  if (kind === 'taxi') {
    const sign = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.25, 0.4),
      new THREE.MeshBasicMaterial({ color: 0xffe23e }));
    sign.position.set(0, 1.75, -0.2); g.add(sign);
  }
  if (police) {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.22, 0.5),
      new THREE.MeshBasicMaterial({ color: 0xff2233 }));
    bar.position.set(0, 1.72, -0.2); g.add(bar);
    const bar2 = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.22, 0.5),
      new THREE.MeshBasicMaterial({ color: 0x2244ff }));
    bar2.position.set(0.4, 1.72, -0.2); g.add(bar2);
    const door = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 0.5),
      new THREE.MeshBasicMaterial({ color: 0xffffff }));
    door.position.set(1.06, 0.7, 0); door.rotation.y = Math.PI / 2; g.add(door);
  }
  const wheelGeo = new THREE.CylinderGeometry(0.38, 0.38, 0.3, 10);
  const wheelMat = new THREE.MeshStandardMaterial({ color: 0x0a0a0a, roughness: 0.9 });
  for (const [wx, wz] of [[-1.0, 1.4], [1.0, 1.4], [-1.0, -1.4], [1.0, -1.4]]) {
    const w = new THREE.Mesh(wheelGeo, wheelMat);
    w.rotation.z = Math.PI / 2;
    w.position.set(wx, 0.38, wz);
    g.add(w);
  }
  const head = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.2, 0.15),
    new THREE.MeshBasicMaterial({ color: 0xfff6c8 }));
  head.position.set(0, 0.7, 2.22); g.add(head);
  const tail = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.2, 0.15),
    new THREE.MeshBasicMaterial({ color: 0xff2222 }));
  tail.position.set(0, 0.7, -2.22); g.add(tail);
  return g;
}

const wrap = (a) => {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
};

export class Car {
  constructor(game, kind, x, z, yaw, color, police = false) {
    this.game = game;
    this.kind = kind;
    this.def = CFG.carKinds[kind] || CFG.carKinds.sedan;
    this.police = police;
    this.isTraffic = false;
    this.pos = new THREE.Vector3(x, 0, z);
    this.yaw = wrap(yaw);
    this.speed = 0;
    this.hp = 100;
    this.airY = 0;
    this.airV = 0;
    this.disabled = false;
    this.mesh = makeCarMesh(kind, color, police);
    this.mesh.position.copy(this.pos);
    game.scene.add(this.mesh);
  }

  forward() { return { x: Math.sin(this.yaw), z: Math.cos(this.yaw) }; }

  // ctrl: {fwd -1..1, steer -1..1, brake bool}. Returns 0 none / 1 scrape / 2 head-on.
  step(dt, ctrl, colliders) {
    let severity = 0;
    if (this.disabled) {
      this.speed *= (1 - 2 * dt);
    } else if (ctrl) {
      const top = this.police
        ? CFG.policeTop(this.game.police?.level || 1)
        : this.def.top;
      if (ctrl.fwd > 0) this.speed += this.def.acc * ctrl.fwd * dt;
      else if (ctrl.fwd < 0) this.speed -= this.def.acc * 0.7 * dt;
      if (ctrl.brake) {
        // brake clamps at 0 — it must never overshoot into reverse
        this.speed -= Math.sign(this.speed) * 26 * dt;
        if (Math.abs(this.speed) < 0.4) this.speed = 0;
      }
      this.speed -= this.speed * 0.55 * dt; // drag
      if (this.speed > top) this.speed = top;
      if (this.speed < -9) this.speed = -9;
      if (Math.abs(this.speed) < 0.15 && !ctrl.fwd) this.speed = 0;
      const grip = this.police ? 4.5 : 1;
      if (Math.abs(this.speed) > 0.5) {
        const tf = 0.45 + 0.55 * Math.min(1, Math.abs(this.speed) / 10);
        this.yaw += ctrl.steer * this.def.turn * grip * 0.45 * tf * Math.sign(this.speed) * dt;
      }
    } else {
      this.speed -= this.speed * 0.55 * dt;
      if (Math.abs(this.speed) < 0.15) this.speed = 0;
    }
    this.yaw = wrap(this.yaw);

    const f = this.forward();
    const nx = this.pos.x + f.x * this.speed * dt;
    const nz = this.pos.z + f.z * this.speed * dt;
    // Move axis by axis so a wall only blocks one direction.
    const hit = (x, z) => {
      for (const c of colliders) {
        if (Math.abs(x - c.x) < c.hw + 1.1 && Math.abs(z - c.z) < c.hd + 1.1) return c;
      }
      return null;
    };
    let blockedX = false, blockedZ = false;
    if (!hit(nx, this.pos.z)) this.pos.x = nx;
    else { blockedX = true; severity = 1; }
    if (!hit(this.pos.x, nz)) this.pos.z = nz;
    else { blockedZ = true; severity = 1; }
    if (blockedX && blockedZ) {
      severity = 2;
      this.speed *= 0.4; // head-on: kill most of the speed
    } else if (severity === 1) {
      this.speed *= 0.85; // scrape: glance off, keep most of the speed
    }
    // Stunt jumps: ramps launch the car into the air.
    if (this.airY > 0 || this.airV !== 0) {
      this.airV -= 22 * dt;
      this.airY += this.airV * dt;
      if (this.airY <= 0) { this.airY = 0; this.airV = 0; }
    }
    this.mesh.position.set(this.pos.x, this.airY, this.pos.z);
    this.mesh.rotation.y = this.yaw;
    return severity;
  }
}
