// Neon Bay — the wanted system and the police. Crimes add heat; heat is
// stars (1 star per 20 heat, up to 5). The police answer with cars that
// chase and ram, and foot cops who run the player down and make the arrest.
// Heat cools off when the player stays clean and out of sight.
import * as THREE from 'three';
import { CFG } from './config.js';
import { Car } from './vehicles.js';

export class WantedSystem {
  constructor() {
    this.heat = 0;
    this.level = 0;
    this._cleanT = 0;
  }

  addHeat(amount) {
    this.heat = Math.min(CFG.maxWanted * CFG.heatPerStar, this.heat + amount);
    this._cleanT = 0;
    this._recalc();
  }

  _recalc() {
    this.level = Math.min(CFG.maxWanted, Math.floor(this.heat / CFG.heatPerStar));
  }

  clear() {
    this.heat = 0;
    this.level = 0;
  }

  update(dt, policeNear) {
    if (this.level === 0) return;
    if (policeNear) {
      this._cleanT = 0;
      return;
    }
    this._cleanT += dt;
    if (this._cleanT > 6) {
      this.heat = Math.max(0, this.heat - CFG.heatDecay * dt);
      this._recalc();
    }
  }
}

export class PoliceManager {
  constructor(scene, city) {
    this.scene = scene;
    this.city = city;
    this.cars = []; // police Car instances
    this.cops = []; // { mesh, x, z, heading, bustT, shootT, health }
    this._copMeshes = [];
    this._spawnT = 0;
    this._roadblock = null; // { cars, until } — two cruisers parked across the road
    this._roadblockT = 0;
  }

  _spawnCarNear(player) {
    const angle = Math.random() * Math.PI * 2;
    const r = 55; // close enough to engage, far enough to feel like a response
    let x = player.x + Math.cos(angle) * r;
    let z = player.z + Math.sin(angle) * r;
    x = Math.max(-CFG.worldHalf + 10, Math.min(CFG.worldHalf - 10, x));
    z = Math.max(-CFG.worldHalf + 10, Math.min(CFG.beachZ - 10, z));
    const car = new Car('police', 0xf2f2f2, x, z, Math.atan2(player.x - x, player.z - z));
    this.scene.add(car.mesh);
    this.cars.push(car);
    return car;
  }

  _spawnCopNear(player) {
    const mesh = makeCopMesh();
    const angle = Math.random() * Math.PI * 2;
    const x = player.x + Math.cos(angle) * 14;
    const z = player.z + Math.sin(angle) * 14;
    mesh.position.set(x, 0, z);
    this.scene.add(mesh);
    const cop = { mesh, x, z, heading: 0, bustT: 0, shootT: 0, health: 50, dead: false };
    this.cops.push(cop);
    return cop;
  }

  // Keep the force matched to the wanted level. Returns true when any
  // police is close enough to see the player (blocks heat decay).
  // holdPos: when the player is holding a vault, the cruisers ring the
  // spot at ~10 m and wait (a standoff) instead of ramming the player
  // out of the circle — the hold has to be winnable.
  update(dt, player, wanted, time, onBusted, onCopShot, holdPos = null) {
    const level = wanted.level;
    const wantCars = level;
    const wantCops = player.inCar ? 0 : Math.min(level, 2);

    this._spawnT -= dt;
    if (this.cars.length < wantCars && this._spawnT <= 0) {
      this._spawnCarNear(player);
      this._spawnT = 2.5;
    }
    if (this.cops.length < wantCops && this._spawnT <= 0) {
      this._spawnCopNear(player);
      this._spawnT = 2.5;
    }
    // Stand down when the heat is gone.
    if (level === 0) {
      for (const car of this.cars) this.scene.remove(car.mesh);
      for (const cop of this.cops) this.scene.remove(cop.mesh);
      this.cars = [];
      this.cops = [];
      this._roadblock = null;
      return false;
    }

    // Roadblock at 3+ stars: two cruisers park across the road ahead of
    // the fleeing player, so a straight-line escape has to go around them.
    this._roadblockT -= dt;
    if (level >= CFG.roadblockMinStars && player.inCar && !this._roadblock && this._roadblockT <= 0) {
      this._spawnRoadblock(player, time);
      this._roadblockT = 22;
    }
    if (this._roadblock && (level < CFG.roadblockMinStars || time - this._roadblock.since > 25)) {
      this._clearRoadblock();
    }

    let near = false;
    // Police cars hunt on the road grid (straight lines get stuck on
    // buildings); up close they ram the player directly. The waypoint is
    // recomputed every frame so a moving player never leaves a stale one.
    for (const car of this.cars) {
      const d = Math.hypot(player.x - car.x, player.z - car.z);
      if (d < 70) near = true;
      // Cruisers are fast enough to catch a fleeing player now: their cap
      // rises with the wanted level (L1 29.6 … L5 44).
      const maxSpeed = Math.min(car.maxSpeed, CFG.policeBaseSpeed + level * CFG.policeSpeedPerStar);
      if (car._roadblock) {
        // Parked across the road: hold position, lights flashing.
        car.flashLightBar(time);
      } else if (holdPos) {
        // Standoff: ring the vault, don't shove the player out of it.
        const hx = holdPos.x - car.x;
        const hz = holdPos.z - car.z;
        const hd = Math.hypot(hx, hz);
        if (hd > 11) {
          car.autopilot(dt, Math.atan2(hx, hz), maxSpeed, this.city);
        } else {
          car.autopilot(dt, car.heading, 0, this.city);
        }
      } else if (d < 18) {
        car.autopilot(dt, Math.atan2(player.x - car.x, player.z - car.z), maxSpeed, this.city);
      } else {
        car._wp = this._nextGridPoint(car, player);
        const wp = car._wp;
        car.autopilot(dt, Math.atan2(wp.x - car.x, wp.z - car.z), maxSpeed, this.city);
      }
      if (!car._roadblock) car.flashLightBar(time);
      // Ram: shove the player's car and hurt the player a little.
      if (player.inCar) {
        const pc = player.currentCar;
        const cd = Math.hypot(pc.x - car.x, pc.z - car.z);
        if (cd < car.radius + pc.radius + 0.4) {
          // PIT at 3+ stars: a faster cruiser alongside shoves the
          // player's rear sideways and scrubs speed hard.
          pc.speed *= level >= 3 ? 0.88 : 0.94;
          car.speed *= 0.9;
          if (level >= 3 && car.speed > Math.abs(pc.speed)) {
            pc.x += Math.cos(car.heading) * 1.1;
            pc.z += -Math.sin(car.heading) * 1.1;
          }
        }
      } else if (d < 2.2) {
        // A police car next to a fleeing player on foot: the cop gets out.
        if (this.cops.length < 3) this._spawnCopNear(player);
      }
    }
    // Foot cops run the player down; hold them to make the arrest.
    for (const cop of this.cops) {
      if (cop.dead) continue;
      const dx = player.x - cop.x;
      const dz = player.z - cop.z;
      const d = Math.hypot(dx, dz);
      if (d < 60) near = true;
      cop.heading = Math.atan2(dx, dz);
      const speed = 7.2;
      if (d > 1.6) {
        cop.x += Math.sin(cop.heading) * speed * dt;
        cop.z += Math.cos(cop.heading) * speed * dt;
      }
      cop.mesh.position.set(cop.x, 0, cop.z);
      cop.mesh.rotation.y = cop.heading;
      if (d < 1.9 && !player.inCar) {
        cop.bustT += dt;
        if (cop.bustT > CFG.bustTime) {
          onBusted();
          return near;
        }
      } else {
        cop.bustT = 0;
      }
      // At 3+ stars the cops open fire (badly).
      if (level >= 3 && d < 26 && d > 4) {
        cop.shootT -= dt;
        if (cop.shootT <= 0) {
          cop.shootT = 1.3;
          if (Math.random() < 0.35) onCopShot(6);
        }
      }
    }
    return near;
  }

  // Two cruisers parked across the road ahead of a fleeing player.
  _spawnRoadblock(player, time) {
    const pc = player.currentCar;
    const fx = Math.sin(pc.heading);
    const fz = Math.cos(pc.heading);
    const ax = pc.x + fx * 45;
    const az = pc.z + fz * 45;
    const lines = this.city.roadLines;
    const nearest = (v) => lines.reduce((a, b) => (Math.abs(b - v) < Math.abs(a - v) ? b : a));
    const onNS = Math.abs(ax - nearest(ax)) < Math.abs(az - nearest(az));
    const bx = onNS ? nearest(ax) : ax;
    const bz = onNS ? az : nearest(az);
    const across = onNS ? { x: 1, z: 0 } : { x: 0, z: 1 };
    const cars = [];
    for (const side of [-3.2, 3.2]) {
      const car = new Car('police', 0xf2f2f2, bx + across.x * side, bz + across.z * side, onNS ? Math.PI / 2 : 0);
      car._roadblock = true;
      this.scene.add(car.mesh);
      this.cars.push(car);
      cars.push(car);
    }
    this._roadblock = { cars, since: time };
  }

  _clearRoadblock() {
    if (!this._roadblock) return;
    for (const car of this._roadblock.cars) {
      this.scene.remove(car.mesh);
      this.cars = this.cars.filter((c) => c !== car);
    }
    this._roadblock = null;
  }
  // along the road it is nearest to, toward the next intersection; at an
  // intersection it picks the axis with the bigger gap to the player. If the
  // player is on the same road ahead, the waypoint is the player.
  // Recomputed every frame, so it never goes stale.
  _nextGridPoint(car, player) {
    const lines = this.city.roadLines;
    const nearest = (v) => lines.reduce((a, b) => (Math.abs(b - v) < Math.abs(a - v) ? b : a));
    const lx = nearest(car.x);
    const lz = nearest(car.z);
    const onNS = Math.abs(car.x - lx);
    const onEW = Math.abs(car.z - lz);
    const atIntersection = onNS < 4 && onEW < 4;
    const dx = player.x - car.x;
    const dz = player.z - car.z;
    // Same road ahead: go straight at the player.
    if (onNS < 6 && Math.abs(player.x - lx) < 8 && Math.abs(dz) > 4) return { x: player.x, z: player.z };
    if (onEW < 6 && Math.abs(player.z - lz) < 8 && Math.abs(dx) > 4) return { x: player.x, z: player.z };
    const nextLine = (v, dir) => (dir > 0
      ? lines.find((c) => c > v + 2) ?? lines[lines.length - 1]
      : [...lines].reverse().find((c) => c < v - 2) ?? lines[0]);
    if (atIntersection && Math.abs(dx) > Math.abs(dz)) {
      return { x: nextLine(car.x, Math.sign(dx)), z: lz };
    }
    if (onNS <= onEW) {
      return { x: lx, z: nextLine(car.z, Math.sign(dz) || 1) };
    }
    return { x: nextLine(car.x, Math.sign(dx) || 1), z: lz };
  }

  // Remove a dead cop's body after the fight.
  removeCop(cop) {
    this.scene.remove(cop.mesh);
    this.cops = this.cops.filter((c) => c !== cop);
  }

  removeCar(car) {
    this.scene.remove(car.mesh);
    this.cars = this.cars.filter((c) => c !== car);
  }
}

function makeCopMesh() {
  const group = new THREE.Group();
  const navy = new THREE.MeshLambertMaterial({ color: 0x1c2f5e });
  const skin = new THREE.MeshLambertMaterial({ color: 0xc98d64 });
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.85, 0.4), navy);
  torso.position.y = 1.15;
  group.add(torso);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.26, 12, 10), skin);
  head.position.y = 1.82;
  group.add(head);
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.12, 12), navy);
  cap.position.y = 2.0;
  group.add(cap);
  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.75, 0.3), navy);
  legL.position.set(-0.18, 0.38, 0);
  group.add(legL);
  const legR = legL.clone();
  legR.position.x = 0.18;
  group.add(legR);
  return group;
}
