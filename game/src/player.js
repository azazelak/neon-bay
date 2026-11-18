// Neon Bay v5c — the player: on foot and in a car.
// Steering fixed from the start: KeyA steers +1 (yaw grows toward the left
// of facing (sin yaw, cos yaw)), KeyD steers -1; on-foot strafe matches.
import * as THREE from '../vendor/three.module.min.js';
import { Car } from './vehicles.js';

export class Player {
  constructor(game) {
    this.game = game;
    this.pos = new THREE.Vector3(0, 0, 0);
    this.yaw = 0;
    this.speed = 0;
    this.hp = 100;
    this.inCar = false;
    this.car = null;
    this.weapon = 'pistol';
    this.ammo = 12;
    this.reserve = 48;
    this.lastDamageAt = 0;
    this.mesh = this.buildMesh();
    game.scene.add(this.mesh);
  }

  buildMesh() {
    const g = new THREE.Group();
    const jacket = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.7, 0.32),
      new THREE.MeshStandardMaterial({ color: 0xff6a1a }));
    jacket.position.y = 1.15; g.add(jacket);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 8),
      new THREE.MeshStandardMaterial({ color: 0xc98a5a }));
    head.position.y = 1.7; g.add(head);
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.1, 10),
      new THREE.MeshStandardMaterial({ color: 0x111111 }));
    cap.position.y = 1.88; g.add(cap);
    const legs = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.75, 0.28),
      new THREE.MeshStandardMaterial({ color: 0x222244 }));
    legs.position.y = 0.4; g.add(legs);
    return g;
  }

  reset(x, z) {
    this.pos.set(x, 0, z);
    this.yaw = 0;
    this.hp = 100;
    this.inCar = false;
    this.car = null;
    this.mesh.visible = true;
  }

  damage(n, _kind) {
    const now = this.game.time;
    if (now - this.lastDamageAt < 0.25) return;
    this.lastDamageAt = now;
    this.hp -= n;
    if (this.hp <= 0) {
      this.hp = 0;
      this.game.onWasted();
    }
  }

  nearestCar(maxD = 5) {
    let best = null, bestD = maxD;
    for (const c of this.game.traffic.cars) {
      const d = Math.hypot(c.pos.x - this.pos.x, c.pos.z - this.pos.z);
      if (d < bestD) { bestD = d; best = c; }
    }
    for (const c of this.game.police.cruisers) {
      const d = Math.hypot(c.pos.x - this.pos.x, c.pos.z - this.pos.z);
      if (d < bestD) { bestD = d; best = c; }
    }
    return best;
  }

  enterCar() {
    const car = this.nearestCar(5);
    if (!car) return false;
    this.car = car;
    this.inCar = true;
    car.isTraffic = false;
    this.mesh.visible = false;
    this.game.police.addHeat(8);
    return true;
  }

  exitCar() {
    if (!this.inCar || !this.car) return;
    const f = this.car.forward();
    this.pos.set(this.car.pos.x - f.x * 3, 0, this.car.pos.z - f.z * 3);
    this.yaw = this.car.yaw;
    this.car = null;
    this.inCar = false;
    this.mesh.visible = true;
  }

  update(dt, input) {
    if (this.game.screen !== 'play') return;
    if (this.inCar && this.car) {
      const steer = (input.keys.has('KeyA') ? 1 : 0) + (input.keys.has('KeyD') ? -1 : 0);
      const fwd = (input.keys.has('KeyW') ? 1 : 0) + (input.keys.has('KeyS') ? -1 : 0);
      const brake = input.keys.has('Space');
      const sev = this.car.step(dt, { fwd, steer, brake }, this.game.city.colliders);
      if (sev === 2 && this.car.speed > 12) {
        // hard head-on hit: one damage event per 0.5 s max (handled in main)
        this.game.onHardHit(this.car.speed);
        this.car.speed *= 0.5;
      }
      this.pos.copy(this.car.pos);
      this.yaw = this.car.yaw;
      this.speed = this.car.speed;
      if (this.car.hp <= 0) {
        this.game.onWasted();
        return;
      }
    } else {
      // on foot: WASD relative to facing; A = strafe left, D = strafe right
      const f = { x: Math.sin(this.yaw), z: Math.cos(this.yaw) };
      const r = { x: f.z, z: -f.x };
      let mx = 0, mz = 0;
      if (input.keys.has('KeyW')) { mx += f.x; mz += f.z; }
      if (input.keys.has('KeyS')) { mx -= f.x; mz -= f.z; }
      if (input.keys.has('KeyA')) { mx -= r.x; mz -= r.z; }
      if (input.keys.has('KeyD')) { mx += r.x; mz += r.z; }
      const len = Math.hypot(mx, mz);
      const spd = input.keys.has('ShiftLeft') ? 9 : 5.5;
      if (len > 0) {
        mx /= len; mz /= len;
        let nx = this.pos.x + mx * spd * dt;
        let nz = this.pos.z + mz * spd * dt;
        const hit = this.game.city.colliders.some((c) =>
          Math.abs(nx - c.x) < c.hw + 0.4 && Math.abs(nz - c.z) < c.hd + 0.4);
        if (!hit) { this.pos.x = nx; this.pos.z = nz; }
        this.speed = spd;
        this.yaw = Math.atan2(mx, mz);
      } else {
        this.speed = 0;
      }
      this.mesh.position.copy(this.pos);
      this.mesh.rotation.y = this.yaw;
      this.mesh.position.y = Math.abs(Math.sin(this.game.time * 8)) * 0.05 * (len > 0 ? 1 : 0);
    }
    // mouse look rotates the facing yaw
    if (input.lookDX) {
      this.yaw += input.lookDX * 0.0035;
      input.lookDX = 0;
    }
  }
}
