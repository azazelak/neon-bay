// Neon Bay — traffic: 20 AI cars on the avenue grid, 36 pedestrians,
// 16 parked cars. Peds fall when run over, then get back up and respawn.

import * as THREE from 'three';
import { CFG, AVENUES, BLOCKS, nearestAvenue, clamp } from './config.js';
import { Rng } from './rng.js';
import { Car } from './vehicles.js';

const PED_SKINS = [0xc08a5a, 0x8a5a3a, 0xe0b08a, 0x5a3a2a];
const PED_SHIRTS = [0xc02a2a, 0x2a6ab0, 0x3a8a3a, 0xd8a02a, 0x8a2a8a, 0x2a8a8a, 0xd8d8d8, 0x2a2a2a];
const PED_HAIR = [0x1a1a1a, 0x5a3a1a, 0xd8c86a, 0x8a8a8a];

export class Traffic {
  constructor(scene, city) {
    this.scene = scene;
    this.city = city;
    this.rng = new Rng(777);
    this.cars = [];    // { car, avenue, along, dir, speed, targetSpeed, waiting }
    this.peds = [];    // { group, x, z, heading, speed, state, timer, height }
    this.parked = [];
    this.buildParked();
    this.buildCars();
    this.buildPeds();
  }

  buildParked() {
    const rng = this.rng;
    const kinds = ['sedan', 'van', 'pickup', 'muscle'];
    for (let i = 0; i < CFG.parkedCars; i++) {
      const a = rng.pick(AVENUES);
      const along = rng.float(-300, 300);
      const horiz = rng.chance(0.5);
      const side = rng.chance(0.5) ? 1 : -1;
      const x = horiz ? along : a + side * 5.2;
      const z = horiz ? a + side * 5.2 : along;
      const kind = rng.pick(kinds);
      const car = new Car(this.scene, kind, rng.pick([0x8a9ab0, 0xb03030, 0x3a6ab0, 0x2a2a2a, 0x7a5a3a]), x, z, horiz ? Math.PI / 2 : 0);
      car.speed = 0;
      this.parked.push(car);
    }
  }

  buildCars() {
    const rng = this.rng;
    const kinds = ['sedan', 'taxi', 'van', 'sedan', 'pickup', 'muscle'];
    for (let i = 0; i < CFG.trafficCars; i++) {
      const horiz = rng.chance(0.5);
      const avenue = rng.pick(AVENUES);
      const along = rng.float(-320, 320);
      const dir = rng.chance(0.5) ? 1 : -1;
      const kind = rng.pick(kinds);
      const color = kind === 'taxi' ? 0xffc42a : rng.pick([0x8a9ab0, 0xb03030, 0x3a6ab0, 0xd8d8d8, 0x2a2a2a, 0x3a5a2a]);
      const x = horiz ? along : avenue;
      const z = horiz ? avenue : along;
      const heading = horiz ? (dir > 0 ? -Math.PI / 2 : Math.PI / 2) : (dir > 0 ? Math.PI : 0);
      const car = new Car(this.scene, kind, color, x, z, heading);
      this.cars.push({
        car, horiz, avenue, dir,
        speed: rng.float(7, 11),
        targetSpeed: rng.float(8, 12),
        waiting: 0,
      });
    }
  }

  buildPeds() {
    const rng = this.rng;
    for (let i = 0; i < CFG.pedestrians; i++) {
      const g = new THREE.Group();
      const shirt = new THREE.MeshLambertMaterial({ color: rng.pick(PED_SHIRTS) });
      const skin = new THREE.MeshLambertMaterial({ color: rng.pick(PED_SKINS) });
      const pants = new THREE.MeshLambertMaterial({ color: rng.pick([0x2a2a3a, 0x3a4a6a, 0x5a3a2a]) });
      const h = rng.float(0.92, 1.08);
      const torso = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.62, 0.28), shirt);
      torso.position.y = 0.95 * h;
      g.add(torso);
      const head = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.3, 0.28), skin);
      head.position.y = 1.42 * h;
      g.add(head);
      const hair = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.12, 0.32), new THREE.MeshLambertMaterial({ color: rng.pick(PED_HAIR) }));
      hair.position.y = 1.6 * h;
      g.add(hair);
      if (rng.chance(0.3)) {
        const hat = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.24, 0.1, 8), new THREE.MeshLambertMaterial({ color: rng.pick(PED_SHIRTS) }));
        hat.position.y = 1.68 * h;
        g.add(hat);
      }
      const legL = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.6, 0.2), pants);
      legL.position.set(-0.13, 0.32 * h, 0);
      g.add(legL);
      const legR = legL.clone();
      legR.position.x = 0.13;
      g.add(legR);
      // Start on a sidewalk beside a random avenue.
      const a = rng.pick(AVENUES);
      const along = rng.float(-320, 320);
      const side = rng.chance(0.5) ? 1 : -1;
      const horiz = rng.chance(0.5);
      const x = horiz ? along : a + side * 10.5;
      const z = horiz ? a + side * 10.5 : along;
      g.position.set(x, 0, z);
      g.scale.setScalar(h);
      this.scene.add(g);
      this.peds.push({
        group: g, x, z, h,
        heading: rng.float(0, Math.PI * 2),
        speed: rng.float(1.2, 2.2),
        state: 'walk', timer: rng.float(0, 6),
        legL, legR, phase: rng.float(0, 6),
      });
    }
  }

  // Manhattan route: drive along one avenue, turn at a random intersection.
  update(dt, playerCar, onRunOver) {
    // --- traffic cars ---
    for (const t of this.cars) {
      const c = t.car;
      // Car ahead? Slow down instead of rear-ending it.
      let ahead = false;
      for (const o of this.cars) {
        if (o === t) continue;
        const dx = o.car.x - c.x;
        const dz = o.car.z - c.z;
        const fwd = t.horiz ? dx * t.dir : dz * t.dir;
        const side = t.horiz ? Math.abs(dz) : Math.abs(dx);
        if (fwd > 0 && fwd < 12 && side < 3) { ahead = true; break; }
      }
      // Red light ahead at the next intersection?
      let redAhead = false;
      const next = t.horiz ? nearestAvenue(c.x + t.dir * 14) : nearestAvenue(c.z + t.dir * 14);
      const crossing = t.horiz ? (Math.abs(c.x - next) < 14) : (Math.abs(c.z - next) < 14);
      if (crossing) {
        const lx = t.horiz ? next : c.x;
        const lz = t.horiz ? c.z : next;
        if (this.city.lightAt(lx, lz) === 'red') redAhead = true;
      }
      const want = ahead || redAhead ? 0 : t.targetSpeed;
      t.speed += clamp(want - t.speed, -8 * dt, 5 * dt);
      // Advance along the avenue; turn at a random intersection.
      const step = t.speed * t.dir * dt;
      if (t.horiz) c.x += step; else c.z += step;
      const atCross = t.horiz
        ? Math.abs(c.x - nearestAvenue(c.x)) < 1.5
        : Math.abs(c.z - nearestAvenue(c.z)) < 1.5;
      if (atCross && this.rng.chance(0.02)) {
        // Turn onto the crossing avenue.
        t.horiz = !t.horiz;
        t.avenue = t.horiz ? c.z : c.x;
        t.dir = this.rng.chance(0.5) ? 1 : -1;
        c.heading = t.horiz ? (t.dir > 0 ? -Math.PI / 2 : Math.PI / 2) : (t.dir > 0 ? Math.PI : 0);
      }
      // Wrap around the city edge.
      if (c.x > 340) c.x = -340;
      if (c.x < -340) c.x = 340;
      if (c.z > 340) c.z = -340;
      if (c.z < -340) c.z = 340;
      c.group.position.set(c.x, 0, c.z);
      c.group.rotation.y = c.heading;
      for (const w of c.wheels) w.rotation.x += t.speed * dt * 2.4;
      // Player's car shoves traffic aside (soft).
      if (playerCar) {
        const d = Math.hypot(c.x - playerCar.x, c.z - playerCar.z);
        if (d < 4 && d > 0.01) {
          const push = (4 - d) * 0.5;
          c.x += ((c.x - playerCar.x) / d) * push;
          c.z += ((c.z - playerCar.z) / d) * push;
        }
      }
    }
    // --- pedestrians ---
    for (const p of this.peds) {
      if (p.state === 'down') {
        p.timer -= dt;
        p.group.rotation.x = -Math.PI / 2 * 0.9;
        if (p.timer <= 0) {
          // Get up and respawn on a fresh sidewalk.
          const a = this.rng.pick(AVENUES);
          const along = this.rng.float(-320, 320);
          const side = this.rng.chance(0.5) ? 1 : -1;
          const horiz = this.rng.chance(0.5);
          p.x = horiz ? along : a + side * 10.5;
          p.z = horiz ? a + side * 10.5 : along;
          p.group.rotation.x = 0;
          p.state = 'walk';
          p.timer = this.rng.float(2, 8);
        }
        continue;
      }
      p.timer -= dt;
      if (p.timer <= 0) {
        p.heading = this.rng.float(0, Math.PI * 2);
        p.timer = this.rng.float(3, 9);
      }
      p.x += -Math.sin(p.heading) * p.speed * dt;
      p.z += -Math.cos(p.heading) * p.speed * dt;
      // Stay near the city; bounce off the edges.
      if (Math.abs(p.x) > 340 || Math.abs(p.z) > 340) p.heading += Math.PI;
      p.phase += dt * p.speed * 4;
      p.legL.rotation.x = Math.sin(p.phase) * 0.5;
      p.legR.rotation.x = -Math.sin(p.phase) * 0.5;
      p.group.position.set(p.x, 0, p.z);
      p.group.rotation.y = p.heading;
      // Run over by the player's car?
      if (playerCar && Math.abs(playerCar.speed) > 3) {
        const d = Math.hypot(p.x - playerCar.x, p.z - playerCar.z);
        if (d < 2.2) {
          p.state = 'down';
          p.timer = 5;
          if (onRunOver) onRunOver(p);
        }
      }
    }
  }

  // Nearest drivable car to a point (traffic or parked), within range.
  nearestCar(x, z, range) {
    let best = null;
    let bd = range;
    for (const t of this.cars) {
      const d = Math.hypot(t.car.x - x, t.car.z - z);
      if (d < bd) { bd = d; best = t.car; }
    }
    for (const c of this.parked) {
      const d = Math.hypot(c.x - x, c.z - z);
      if (d < bd) { bd = d; best = c; }
    }
    return best;
  }

  removeCar(car) {
    const i = this.cars.findIndex((t) => t.car === car);
    if (i >= 0) this.cars.splice(i, 1);
    const j = this.parked.indexOf(car);
    if (j >= 0) this.parked.splice(j, 1);
  }
}
