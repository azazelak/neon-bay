// Traffic and pedestrians. 20 cars drive Manhattan routes between
// intersections and stop at red lights; 36 pedestrians walk the sidewalks
// in varied clothes and fall (then respawn) when run over; 16 cars sit
// parked at the curb, ready to be stolen.
import * as THREE from 'three';
import { CONFIG, avenue, nearestIntersection } from './config.js';
import { Car } from './vehicles.js';

const SKINS = [0xc98a5e, 0x8a5a3a, 0xe8b88a, 0x6a4230];
const HAIRS = [0x1a1210, 0x3a2a1a, 0x6a6a6a, 0xd8b13c];
const SHIRTS = [0xc0392b, 0x3a6fd8, 0x2e8a5a, 0xe8e0d0, 0x8a4a9a, 0xd8a03c];
const PANTS = [0x2e2e38, 0x3a4a6a, 0x5a3a2e, 0x222226];

export class Traffic {
  constructor(scene, city, rng) {
    this.scene = scene;
    this.city = city;
    this.rng = rng;
    this.cars = []; // moving traffic: {car, tx, tz, px, pz, speed, cruise}
    this.peds = [];
    this.parked = [];
    this.buildParked();
    this.buildTraffic();
    this.buildPeds();
  }

  // A fresh world: remove every traffic mesh and pedestrian, then build
  // them again from the seed. Used by New Game so a stolen parked car
  // comes back and the streets reset.
  dispose() {
    for (const t of this.cars) t.car.remove();
    for (const c of this.parked) c.remove();
    for (const p of this.peds) this.scene.remove(p.group);
    this.cars = [];
    this.peds = [];
    this.parked = [];
  }

  rebuild() {
    this.dispose();
    this.buildParked();
    this.buildTraffic();
    this.buildPeds();
  }

  randomIntersection() {
    const i = this.rng.int(-CONFIG.gridHalf, CONFIG.gridHalf);
    const j = this.rng.int(-CONFIG.gridHalf, CONFIG.gridHalf);
    return { x: avenue(i), z: avenue(j) };
  }

  buildParked() {
    // Parked[0] is always a sedan near the spawn corner, so a headless
    // test can always find one to steal.
    const first = new Car(this.scene, 'sedan', 9.5, 40, Math.PI, 0x3a6fd8);
    first.driver = null;
    this.parked.push(first);
    const kinds = ['sedan', 'taxi', 'van', 'muscle', 'pickup', 'sedan'];
    for (let i = 1; i < CONFIG.parkedCars; i++) {
      const kind = this.rng.pick(kinds);
      const along = this.rng.pick([-296, -222, -148, -74, 0, 74, 148, 222, 296]);
      const cross = this.rng.pick([-296, -222, -148, -74, 0, 74, 148, 222]);
      const ns = this.rng.chance(0.5);
      const x = ns ? along + this.rng.pick([-9.5, 9.5]) : cross + this.rng.range(-260, 260);
      const z = ns ? cross + this.rng.range(-260, 260) : along + this.rng.pick([-9.5, 9.5]);
      const heading = ns ? (this.rng.chance(0.5) ? 0 : Math.PI) : (this.rng.chance(0.5) ? Math.PI / 2 : -Math.PI / 2);
      const car = new Car(this.scene, kind, x, z, heading);
      car.driver = null;
      this.parked.push(car);
    }
  }

  buildTraffic() {
    const kinds = ['sedan', 'taxi', 'van', 'muscle', 'pickup', 'sedan', 'sedan'];
    for (let i = 0; i < CONFIG.trafficCars; i++) {
      const start = this.randomIntersection();
      const target = this.randomIntersection();
      const car = new Car(this.scene, this.rng.pick(kinds), start.x, start.z, 0);
      car.driver = 'traffic';
      car.speed = 0;
      this.cars.push({
        car,
        tx: target.x,
        tz: target.z,
        px: start.x,
        pz: start.z,
        speed: this.rng.range(10, 14),
        cruise: this.rng.range(10, 14),
      });
      this.aimAtTarget(this.cars[i]);
    }
  }

  buildPeds() {
    for (let i = 0; i < CONFIG.peds; i++) {
      const h = this.rng.range(0.92, 1.08);
      const g = new THREE.Group();
      const skin = new THREE.MeshLambertMaterial({ color: this.rng.pick(SKINS) });
      const shirt = new THREE.MeshLambertMaterial({ color: this.rng.pick(SHIRTS) });
      const pants = new THREE.MeshLambertMaterial({ color: this.rng.pick(PANTS) });
      const hair = new THREE.MeshLambertMaterial({ color: this.rng.pick(HAIRS) });
      const torso = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.65, 0.3), shirt);
      torso.position.y = 1.05 * h;
      g.add(torso);
      const head = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.38, 0.36), skin);
      head.position.y = 1.62 * h;
      g.add(head);
      const hairM = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.14, 0.38), hair);
      hairM.position.y = 1.83 * h;
      g.add(hairM);
      if (this.rng.chance(0.3)) {
        const hat = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.32, 0.1, 8), new THREE.MeshLambertMaterial({ color: this.rng.pick([0xc0392b, 0x2e2e38, 0xd8b13c]) }));
        hat.position.y = 1.92 * h;
        g.add(hat);
      }
      const legL = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.7, 0.22), pants);
      legL.position.set(-0.14, 0.35 * h, 0);
      g.add(legL);
      const legR = legL.clone();
      legR.position.x = 0.14;
      g.add(legR);
      const spot = this.sidewalkPoint();
      g.position.set(spot.x, 0, spot.z);
      this.scene.add(g);
      const dest = this.sidewalkPoint();
      this.peds.push({
        group: g, x: spot.x, z: spot.z, dx: dest.x, dz: dest.z,
        speed: this.rng.range(1.1, 2.1), state: 'walk', fallT: 0, h,
        legL, legR, phase: this.rng.range(0, 6.28),
      });
    }
  }

  sidewalkPoint() {
    // A point on a sidewalk: 10 m off an avenue, anywhere along it.
    const along = this.rng.pick([-296, -222, -148, -74, 0, 74, 148, 222, 296]);
    const cross = this.rng.range(-280, 280);
    const side = this.rng.pick([-10.5, 10.5]);
    return this.rng.chance(0.5)
      ? { x: along + side, z: cross }
      : { x: cross, z: along + side };
  }

  aimAtTarget(t) {
    const dx = t.tx - t.car.x;
    const dz = t.tz - t.car.z;
    t.car.heading = Math.atan2(dx, dz);
  }

  // Nearest parked car within r metres of (x, z), or null.
  stealNear(x, z, r = 4.5) {
    let best = null;
    let bestD = r;
    for (const car of this.parked) {
      const d = Math.hypot(car.x - x, car.z - z);
      if (d < bestD) { bestD = d; best = car; }
    }
    return best;
  }

  removeParked(car) {
    const i = this.parked.indexOf(car);
    if (i >= 0) this.parked.splice(i, 1);
  }

  // A traffic car that the player just stole stops being traffic.
  removeMoving(car) {
    const i = this.cars.findIndex((t) => t.car === car);
    if (i >= 0) this.cars.splice(i, 1);
  }

  // Nearest moving traffic car within r metres, or null.
  movingNear(x, z, r = 4.5) {
    let best = null;
    let bestD = r;
    for (const t of this.cars) {
      const d = Math.hypot(t.car.x - x, t.car.z - z);
      if (d < bestD) { bestD = d; best = t.car; }
    }
    return best;
  }

  fallPed(ped) {
    if (ped.state !== 'walk') return;
    ped.state = 'fallen';
    ped.fallT = 3;
    ped.group.rotation.x = -Math.PI / 2;
    ped.group.position.y = 0.3;
  }

  update(dt, game) {
    const player = game.player;
    const playerCar = player.inCar;
    // --- traffic cars ---
    for (const t of this.cars) {
      const dx = t.tx - t.car.x;
      const dz = t.tz - t.car.z;
      const dist = Math.hypot(dx, dz);
      const ns = Math.abs(dx) < 1; // travelling along z
      let want = t.cruise;
      if (dist < 18 && !this.city.lightIsGreen(t.tx, t.tz, ns)) want = 0;
      // Ease toward the wanted speed.
      t.speed += Math.max(-14 * dt, Math.min(8 * dt, want - t.speed));
      if (dist < 1.5) {
        // Reached the intersection: pick a new neighbour, never straight back.
        const cur = nearestIntersection(t.car.x, t.car.z);
        const options = [];
        for (const [ox, oz] of [[74, 0], [-74, 0], [0, 74], [0, -74]]) {
          const nx = cur.x + ox;
          const nz = cur.z + oz;
          if (Math.abs(nx) > 296 || Math.abs(nz) > 296) continue;
          if (nx === t.px && nz === t.pz && this.rng.chance(0.9)) continue;
          options.push({ x: nx, z: nz });
        }
        const next = options.length ? this.rng.pick(options) : { x: t.px, z: t.pz };
        t.px = cur.x;
        t.pz = cur.z;
        t.tx = next.x;
        t.tz = next.z;
        this.aimAtTarget(t);
      } else {
        t.car.heading = Math.atan2(dx, dz);
      }
      t.car.speed = t.speed;
      const f = t.car.forward();
      t.car.x += f.x * t.speed * dt;
      t.car.z += f.z * t.speed * dt;
      t.car.syncMesh();
    }
    // --- pedestrians ---
    for (const p of this.peds) {
      if (p.state === 'fallen') {
        p.fallT -= dt;
        if (p.fallT <= 0) {
          const spot = this.sidewalkPoint();
          p.x = spot.x;
          p.z = spot.z;
          const dest = this.sidewalkPoint();
          p.dx = dest.x;
          p.dz = dest.z;
          p.state = 'walk';
          p.group.rotation.x = 0;
          p.group.position.y = 0;
        }
        continue;
      }
      const dx = p.dx - p.x;
      const dz = p.dz - p.z;
      const dist = Math.hypot(dx, dz);
      if (dist < 1.5) {
        const dest = this.sidewalkPoint();
        p.dx = dest.x;
        p.dz = dest.z;
        continue;
      }
      p.phase += dt * p.speed * 3.4;
      p.x += (dx / dist) * p.speed * dt;
      p.z += (dz / dist) * p.speed * dt;
      p.group.position.set(p.x, 0, p.z);
      p.group.rotation.y = Math.atan2(dx, dz);
      p.legL.rotation.x = Math.sin(p.phase) * 0.5;
      p.legR.rotation.x = -Math.sin(p.phase) * 0.5;
      // Run over by the player's car: fall down.
      if (playerCar && Math.abs(playerCar.speed) > 5) {
        if (Math.hypot(playerCar.x - p.x, playerCar.z - p.z) < 2.6) {
          this.fallPed(p);
          game.police.addHeat(8);
        }
      }
    }
  }
}
