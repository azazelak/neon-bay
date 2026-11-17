// Neon Bay — cars. One arcade car model shared by the player, traffic and
// the police: a box-built body with spinning wheels, glowing headlights and
// (for police) a flashing light bar. Physics are arcade, not simulation:
// throttle, brake, steering that bites harder the faster you go, and simple
// circle collisions against buildings and other cars.
import * as THREE from 'three';
import { CFG, PALETTE } from './config.js';
import { collideCircle } from './city.js';

const BODY_MATS = new Map();
function bodyMat(color) {
  if (!BODY_MATS.has(color)) {
    BODY_MATS.set(color, new THREE.MeshLambertMaterial({ color }));
  }
  return BODY_MATS.get(color);
}
const glassMat = new THREE.MeshLambertMaterial({ color: 0x0e1420, emissive: 0x1a2a44, emissiveIntensity: 0.6 });
const tireMat = new THREE.MeshLambertMaterial({ color: 0x0c0c0e });
const hubMat = new THREE.MeshLambertMaterial({ color: 0x9aa0aa });
const headMat = new THREE.MeshBasicMaterial({ color: 0xfff2c0 });
const tailMat = new THREE.MeshBasicMaterial({ color: 0xff2a2a });

export function makeCarMesh(kind, color) {
  const group = new THREE.Group();
  const dims = {
    sedan: { l: 4.4, w: 1.9, h: 0.75, cabL: 2.2, cabH: 0.65 },
    taxi: { l: 4.4, w: 1.9, h: 0.75, cabL: 2.2, cabH: 0.65 },
    sports: { l: 4.6, w: 2.0, h: 0.6, cabL: 1.9, cabH: 0.55 },
    truck: { l: 5.6, w: 2.1, h: 1.1, cabL: 1.6, cabH: 0.9 },
    van: { l: 5.0, w: 2.0, h: 1.3, cabL: 3.4, cabH: 0.7 },
    police: { l: 4.5, w: 1.95, h: 0.78, cabL: 2.2, cabH: 0.68 },
  }[kind] || { l: 4.4, w: 1.9, h: 0.75, cabL: 2.2, cabH: 0.65 };

  const body = new THREE.Mesh(new THREE.BoxGeometry(dims.w, dims.h, dims.l), bodyMat(color));
  body.position.y = 0.55;
  group.add(body);
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(dims.w * 0.86, dims.cabH, dims.cabL), glassMat);
  cabin.position.set(0, 0.55 + dims.h / 2 + dims.cabH / 2 - 0.08, kind === 'truck' ? dims.l / 2 - 1.1 : -0.2);
  group.add(cabin);
  if (kind === 'taxi') {
    const sign = new THREE.Mesh(
      new THREE.BoxGeometry(0.7, 0.28, 0.4),
      new THREE.MeshBasicMaterial({ color: 0xffe600 }),
    );
    sign.position.set(0, 0.55 + dims.h / 2 + dims.cabH + 0.1, -0.2);
    group.add(sign);
  }
  if (kind === 'police') {
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(dims.w + 0.02, 0.22, dims.l * 0.9), bodyMat(PALETTE.policeBlack));
    stripe.position.y = 0.55;
    group.add(stripe);
    const bar = new THREE.Group();
    const red = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.18, 0.3), new THREE.MeshBasicMaterial({ color: 0xff2020 }));
    red.position.x = -0.35;
    const blue = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.18, 0.3), new THREE.MeshBasicMaterial({ color: 0x2040ff }));
    blue.position.x = 0.35;
    bar.add(red, blue);
    bar.position.set(0, 0.55 + dims.h / 2 + dims.cabH + 0.05, -0.2);
    group.add(bar);
    group.userData.lightBar = { red, blue };
  }
  // Headlights + taillights.
  for (const sx of [-1, 1]) {
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.16, 0.08), headMat);
    head.position.set(sx * (dims.w / 2 - 0.32), 0.62, dims.l / 2 + 0.01);
    group.add(head);
    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.14, 0.08), tailMat);
    tail.position.set(sx * (dims.w / 2 - 0.32), 0.62, -dims.l / 2 - 0.01);
    group.add(tail);
  }
  // Wheels.
  const wheels = [];
  const wheelGeo = new THREE.CylinderGeometry(0.36, 0.36, 0.28, 12);
  wheelGeo.rotateZ(Math.PI / 2);
  for (const [wx, wz] of [[-1, 1], [1, 1], [-1, -1], [1, -1]]) {
    const wheel = new THREE.Mesh(wheelGeo, tireMat);
    wheel.position.set(wx * (dims.w / 2 - 0.05), 0.36, wz * (dims.l / 2 - 0.75));
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.3, 8), hubMat);
    hub.rotation.z = Math.PI / 2;
    wheel.add(hub);
    group.add(wheel);
    wheels.push({ mesh: wheel, front: wz > 0 });
  }
  group.userData.wheels = wheels;
  group.userData.dims = dims;
  return group;
}

export class Car {
  constructor(kind, color, x, z, heading = 0) {
    this.kind = kind;
    this.color = color;
    this.mesh = makeCarMesh(kind, color);
    this.x = x;
    this.z = z;
    this.heading = heading;
    this.speed = 0;
    this.steer = 0;
    this.maxSpeed = kind === 'sports' ? 42 : kind === 'police' ? 38 : kind === 'truck' || kind === 'van' ? 26 : CFG.carMaxSpeed;
    this.isPlayer = false;
    this.isPolice = kind === 'police';
    this.stolen = false;
    this.dead = false;
    this._spin = 0;
    this.syncMesh();
  }

  get radius() {
    return CFG.carRadius;
  }

  forward() {
    return { x: Math.sin(this.heading), z: Math.cos(this.heading) };
  }

  // Drive with arcade input: throttle -1..1, steer -1..1.
  drive(dt, throttle, steer, city) {
    const maxF = this.maxSpeed;
    const maxR = CFG.carReverseMax;
    if (throttle > 0) this.speed += CFG.carAccel * throttle * dt;
    else if (throttle < 0) {
      if (this.speed > 0.5) this.speed -= CFG.carBrake * dt; // brake
      else this.speed -= CFG.carAccel * 0.6 * dt; // reverse
    } else {
      this.speed -= Math.sign(this.speed) * Math.min(Math.abs(this.speed), 8 * dt); // drag
    }
    this.speed = Math.max(-maxR, Math.min(maxF, this.speed));
    const grip = Math.min(1, Math.abs(this.speed) / 8);
    this.heading += steer * CFG.carTurn * grip * Math.sign(this.speed || 1) * dt;
    this.steer = steer;
    const f = this.forward();
    this.x += f.x * this.speed * dt;
    this.z += f.z * this.speed * dt;
    const res = collideCircle(city, this.x, this.z, this.radius);
    if (res.hit && Math.abs(this.speed) > 6) this.speed *= 0.45; // crash scrub
    this.x = res.x;
    this.z = res.z;
    this.syncMesh(dt);
  }

  // Point the car at a heading and hold a target speed (traffic / police).
  autopilot(dt, wantHeading, wantSpeed, city) {
    let dh = wantHeading - this.heading;
    while (dh > Math.PI) dh -= Math.PI * 2;
    while (dh < -Math.PI) dh += Math.PI * 2;
    const steer = Math.max(-1, Math.min(1, dh * 1.6));
    const throttle = this.speed < wantSpeed ? 0.7 : this.speed > wantSpeed + 2 ? -0.4 : 0;
    this.drive(dt, throttle, steer, city);
  }

  syncMesh(dt = 0) {
    this.mesh.position.set(this.x, 0, this.z);
    this.mesh.rotation.y = this.heading;
    if (dt > 0) {
      this._spin += (this.speed / 0.36) * dt;
      for (const w of this.mesh.userData.wheels) {
        w.mesh.rotation.x = this._spin;
        w.mesh.rotation.y = w.front ? this.steer * 0.35 : 0;
      }
    }
  }

  // Flash the police light bar (call every frame while wanted).
  flashLightBar(time) {
    const bar = this.mesh.userData.lightBar;
    if (!bar) return;
    const phase = Math.floor(time * 6) % 2 === 0;
    bar.red.material.color.setHex(phase ? 0xff2020 : 0x550000);
    bar.blue.material.color.setHex(phase ? 0x220066 : 0x2040ff);
  }
}

// Circle-vs-circle push-apart for cars (traffic jams, rams, chases). The
// player's car pushes others aside instead of being dragged to their speed,
// so a ram never kills the player's momentum outright.
export function separateCars(cars) {
  for (let i = 0; i < cars.length; i++) {
    for (let j = i + 1; j < cars.length; j++) {
      const a = cars[i];
      const b = cars[j];
      const dx = b.x - a.x;
      const dz = b.z - a.z;
      const min = a.radius + b.radius;
      const d2 = dx * dx + dz * dz;
      if (d2 < min * min && d2 > 1e-6) {
        const d = Math.sqrt(d2);
        const push = (min - d) / 2;
        const nx = dx / d;
        const nz = dz / d;
        a.x -= nx * push;
        a.z -= nz * push;
        b.x += nx * push;
        b.z += nz * push;
        if (a.isPlayer || b.isPlayer) {
          // The bystander scrubs speed; the player's car keeps its pace.
          if (!a.isPlayer) a.speed *= 0.8;
          if (!b.isPlayer) b.speed *= 0.8;
        } else {
          const avg = (a.speed + b.speed) / 2;
          a.speed = avg * 0.9;
          b.speed = avg * 0.9;
        }
      }
    }
  }
}
