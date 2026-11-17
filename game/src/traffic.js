// Neon Bay — traffic and pedestrians. Traffic cars follow the road grid
// from intersection to intersection (straight, left or right, never a
// U-turn), brake for the car ahead, and respawn far from the player so the
// streets always feel alive. Pedestrians stroll the sidewalks and run when
// there is gunfire or a chase nearby. A few parked cars wait to be stolen.
import * as THREE from 'three';
import { CFG, PALETTE } from './config.js';
import { Car } from './vehicles.js';
import { makeRng } from './rng.js';

const PED_COLORS = [0xd23b3b, 0x2b6fd6, 0xe8b93a, 0x37c978, 0xe8e8e8, 0x8a4fd0, 0xff7a1a, 0x0e7d7b];

function makePedMesh(color) {
  const group = new THREE.Group();
  const jacket = new THREE.MeshLambertMaterial({ color });
  const skin = new THREE.MeshLambertMaterial({ color: 0xc98d64 });
  const pants = new THREE.MeshLambertMaterial({ color: 0x22222e });
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.78, 0.36), jacket);
  torso.position.y = 1.1;
  group.add(torso);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.24, 10, 8), skin);
  head.position.y = 1.72;
  group.add(head);
  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.7, 0.26), pants);
  legL.position.set(-0.16, 0.35, 0);
  group.add(legL);
  const legR = legL.clone();
  legR.position.x = 0.16;
  group.add(legR);
  group.userData = { legL, legR };
  return group;
}

export class TrafficManager {
  constructor(scene, city, seed = CFG.seed + 7) {
    this.scene = scene;
    this.city = city;
    this.rng = makeRng(seed);
    this.cars = []; // { car, waypoint: {x,z}, speed }
    this.peds = []; // { mesh, x, z, heading, speed, state, target, health, dead, fallT }
    this.parked = [];
    this._spawnTraffic();
    this._spawnParked();
    this._spawnPeds();
  }

  _randomRoadPoint() {
    const line = this.rng.pick(this.city.roadLines);
    const along = this.rng.range(-CFG.worldHalf + 20, CFG.worldHalf - 20);
    if (this.rng.chance(0.5)) return { x: line, z: along, axis: 'z' };
    return { x: along, z: line, axis: 'x' };
  }

  _nextWaypoint(from, axis, dir) {
    // Pick the next intersection along the current road, then turn.
    const lines = this.city.roadLines;
    const pos = axis === 'x' ? from.x : from.z;
    const next = lines.filter((c) => (dir > 0 ? c > pos + 4 : c < pos - 4));
    if (next.length === 0) return null;
    const cross = dir > 0 ? Math.min(...next) : Math.max(...next);
    const target = axis === 'x' ? { x: cross, z: from.z } : { x: from.x, z: cross };
    return target;
  }

  _spawnTraffic() {
    const kinds = ['sedan', 'sedan', 'taxi', 'van', 'truck', 'sedan', 'sports'];
    for (let i = 0; i < CFG.trafficCount; i++) {
      const p = this._randomRoadPoint();
      const dir = this.rng.chance(0.5) ? 1 : -1;
      const kind = this.rng.pick(kinds);
      const color = this.rng.pick(PALETTE.carColors);
      const car = new Car(kind, color, p.x, p.z, p.axis === 'x' ? (dir > 0 ? Math.PI / 2 : -Math.PI / 2) : dir > 0 ? 0 : Math.PI);
      car.speed = this.rng.range(6, CFG.trafficSpeed);
      this.scene.add(car.mesh);
      const wp = this._nextWaypoint(p, p.axis, dir);
      this.cars.push({ car, axis: p.axis, dir, waypoint: wp, speed: car.speed });
    }
  }

  _spawnParked() {
    for (let i = 0; i < 7; i++) {
      const p = this._randomRoadPoint();
      const kind = this.rng.pick(['sedan', 'sports', 'taxi', 'van']);
      const color = this.rng.pick(PALETTE.carColors);
      const side = this.rng.chance(0.5) ? 1 : -1;
      const x = p.axis === 'z' ? p.x + side * 4.4 : p.x;
      const z = p.axis === 'x' ? p.z + side * 4.4 : p.z;
      const heading = p.axis === 'x' ? (side > 0 ? Math.PI / 2 : -Math.PI / 2) : side > 0 ? 0 : Math.PI;
      const car = new Car(kind, color, x, z, heading);
      this.scene.add(car.mesh);
      this.parked.push(car);
    }
  }

  _spawnPeds() {
    for (let i = 0; i < CFG.pedCount; i++) {
      const p = this._randomRoadPoint();
      const mesh = makePedMesh(this.rng.pick(PED_COLORS));
      const side = this.rng.chance(0.5) ? 1 : -1;
      const x = p.axis === 'z' ? p.x + side * 8.5 : p.x + this.rng.range(-8, 8);
      const z = p.axis === 'x' ? p.z + side * 8.5 : p.z + this.rng.range(-8, 8);
      mesh.position.set(x, 0, z);
      this.scene.add(mesh);
      this.peds.push({
        mesh,
        x,
        z,
        heading: this.rng.range(0, Math.PI * 2),
        speed: this.rng.range(1.1, CFG.pedSpeed),
        state: 'walk',
        target: this._randomRoadPoint(),
        health: 30,
        dead: false,
        fallT: 0,
        phase: this.rng.range(0, 6),
      });
    }
  }

  // All drivable cars (traffic + parked), for the player to steal from.
  allCars() {
    return [...this.cars.map((t) => t.car), ...this.parked];
  }

  // Pedestrians panic: run from a danger point (gunshot, crash, chase).
  scare(x, z, radius = 30) {
    for (const ped of this.peds) {
      if (ped.dead) continue;
      const d = Math.hypot(ped.x - x, ped.z - z);
      if (d < radius) {
        ped.state = 'flee';
        ped.fleeFrom = { x, z };
        ped.fleeT = 4;
      }
    }
  }

  update(dt, player, wantedLevel, time) {
    // --- Traffic cars ---
    for (const t of this.cars) {
      const car = t.car;
      if (!t.waypoint) {
        // Reached the edge: respawn on the far side.
        const p = this._randomRoadPoint();
        car.x = p.x;
        car.z = p.z;
        t.axis = p.axis;
        t.dir = this.rng.chance(0.5) ? 1 : -1;
        t.waypoint = this._nextWaypoint(p, p.axis, t.dir);
        car.syncMesh();
        continue;
      }
      const dx = t.waypoint.x - car.x;
      const dz = t.waypoint.z - car.z;
      const dist = Math.hypot(dx, dz);
      if (dist < 3.5) {
        // At the intersection: turn or go straight.
        const roll = this.rng.rand();
        let axis = t.axis;
        let dir = t.dir;
        if (roll < 0.3) {
          axis = t.axis === 'x' ? 'z' : 'x';
          dir = this.rng.chance(0.5) ? 1 : -1;
        }
        t.axis = axis;
        t.dir = dir;
        const from = { x: car.x, z: car.z };
        t.waypoint = this._nextWaypoint(from, axis, dir);
        if (!t.waypoint) {
          const p = this._randomRoadPoint();
          car.x = p.x;
          car.z = p.z;
          t.axis = p.axis;
          t.dir = this.rng.chance(0.5) ? 1 : -1;
          t.waypoint = this._nextWaypoint(p, p.axis, t.dir);
        }
        continue;
      }
      const wantHeading = Math.atan2(dx, dz);
      // Brake for the car ahead.
      let wantSpeed = t.speed;
      const fx = Math.sin(car.heading);
      const fz = Math.cos(car.heading);
      for (const o of this.cars) {
        if (o === t) continue;
        const ox = o.car.x - car.x;
        const oz = o.car.z - car.z;
        const ahead = ox * fx + oz * fz;
        const side = Math.abs(ox * fz - oz * fx);
        if (ahead > 0 && ahead < 11 && side < 2.4) {
          wantSpeed = Math.min(wantSpeed, Math.max(0, o.car.speed - 2));
        }
      }
      // ...and for the player's car.
      if (player.inCar) {
        const pc = player.currentCar;
        const ox = pc.x - car.x;
        const oz = pc.z - car.z;
        const ahead = ox * fx + oz * fz;
        const side = Math.abs(ox * fz - oz * fx);
        if (ahead > 0 && ahead < 11 && side < 2.4) wantSpeed = 0;
      }
      car.autopilot(dt, wantHeading, wantSpeed, this.city);
      // Keep off the beach and inside the world.
      if (car.z > CFG.beachZ - 4) {
        car.z = CFG.beachZ - 4;
        car.heading = Math.PI;
      }
    }

    // --- Pedestrians ---
    for (const ped of this.peds) {
      if (ped.dead) {
        ped.fallT += dt;
        if (ped.fallT > 6) ped.mesh.visible = false;
        continue;
      }
      let speed = ped.speed;
      if (ped.state === 'flee') {
        speed = 4.5;
        ped.fleeT -= dt;
        const dx = ped.x - ped.fleeFrom.x;
        const dz = ped.z - ped.fleeFrom.z;
        ped.heading = Math.atan2(dx, dz);
        if (ped.fleeT <= 0) ped.state = 'walk';
      } else {
        const dx = ped.target.x - ped.x;
        const dz = ped.target.z - ped.z;
        if (Math.hypot(dx, dz) < 3) {
          ped.target = this._randomRoadPoint();
        } else {
          ped.heading = Math.atan2(dx, dz);
        }
      }
      ped.x += Math.sin(ped.heading) * speed * dt;
      ped.z += Math.cos(ped.heading) * speed * dt;
      ped.x = Math.max(-CFG.worldHalf + 2, Math.min(CFG.worldHalf - 2, ped.x));
      ped.z = Math.max(-CFG.worldHalf + 2, Math.min(CFG.beachZ - 1, ped.z));
      ped.phase += dt * speed * 2.2;
      ped.mesh.position.set(ped.x, 0, ped.z);
      ped.mesh.rotation.y = ped.heading;
      const swing = Math.sin(ped.phase) * 0.5;
      ped.mesh.userData.legL.rotation.x = swing;
      ped.mesh.userData.legR.rotation.x = -swing;
    }
  }
}
