// Wanted level and police. Heat buys stars; stars buy cruisers that hunt
// the player over the road graph (BFS between intersections), ram and PIT
// at 3+ stars, set roadblocks ahead of a fleeing car, and send foot cops
// who arrest Rico on foot. During the vault hold they ring the hold point
// instead of ramming, so the hold is tense but survivable.
import * as THREE from 'three';
import { CONFIG, avenue, nearestIntersection, resolveBuildings } from './config.js';
import { Car } from './vehicles.js';

const GRID = CONFIG.gridHalf;

export class Police {
  constructor(scene, city, rng) {
    this.scene = scene;
    this.city = city;
    this.rng = rng;
    this.heat = 0;
    this.stars = 0;
    this.time = 0;
    this.lastCrimeT = -100;
    this.cars = []; // {car, path, pathI, state, blockT, ramT, pitT, repathT, ringA}
    this.footCops = []; // {group, x, z, nearT, shootT}
    this.holdPos = null; // {x, z} during the vault hold, else null
    this.roadblockT = 0;
    this.spawnT = 0;
  }

  starsFor(heat) {
    let s = 0;
    for (const t of CONFIG.starAt) if (heat >= t) s++;
    return s;
  }

  addHeat(n) {
    this.heat = Math.min(100, this.heat + n);
    this.lastCrimeT = this.time;
    this.stars = this.starsFor(this.heat);
  }

  setHeat(n) {
    this.heat = Math.max(0, Math.min(100, n));
    this.lastCrimeT = this.time;
    this.stars = this.starsFor(this.heat);
  }

  // BFS over the 9x9 intersection grid; returns waypoints from the
  // intersection nearest (x, z) to the one nearest (tx, tz), inclusive.
  findPath(x, z, tx, tz) {
    const start = nearestIntersection(x, z);
    const goal = nearestIntersection(tx, tz);
    const key = (p) => `${p.x},${p.z}`;
    const prev = new Map();
    const queue = [start];
    prev.set(key(start), null);
    while (queue.length) {
      const cur = queue.shift();
      if (cur.x === goal.x && cur.z === goal.z) break;
      for (const [ox, oz] of [[74, 0], [-74, 0], [0, 74], [0, -74]]) {
        const nx = cur.x + ox;
        const nz = cur.z + oz;
        if (Math.abs(nx) > 296 || Math.abs(nz) > 296) continue;
        const k = `${nx},${nz}`;
        if (prev.has(k)) continue;
        prev.set(k, cur);
        queue.push({ x: nx, z: nz });
      }
    }
    const path = [];
    let cur = goal;
    let guard = 0;
    while (cur && guard++ < 40) {
      path.unshift({ x: cur.x, z: cur.z });
      cur = prev.get(key(cur));
    }
    if (!path.length) path.push({ x: start.x, z: start.z });
    return path;
  }

  spawnCruiser(x, z, heading = 0) {
    const car = new Car(this.scene, 'police', x, z, heading);
    car.driver = 'police';
    const entry = {
      car, path: [], pathI: 0, state: 'chase', blockT: 0,
      ramT: 0, pitT: 0, repathT: 0, ringA: this.rng.range(0, Math.PI * 2),
    };
    this.cars.push(entry);
    return entry;
  }

  // Put a cruiser somewhere on a road 40-70 m from the player.
  spawnNearPlayer(game) {
    for (let tries = 0; tries < 12; tries++) {
      const a = this.rng.range(0, Math.PI * 2);
      const d = this.rng.range(40, 70);
      const x = game.player.x + Math.cos(a) * d;
      const z = game.player.z + Math.sin(a) * d;
      if (Math.abs(x) > 320 || Math.abs(z) > 320) continue;
      const near = nearestIntersection(x, z);
      return this.spawnCruiser(near.x, near.z, this.rng.range(0, Math.PI * 2));
    }
    return null;
  }

  removeCruiser(entry) {
    entry.car.remove();
    const i = this.cars.indexOf(entry);
    if (i >= 0) this.cars.splice(i, 1);
  }

  desiredCruisers() {
    if (this.stars === 0) return 0;
    return Math.min(6, this.stars + 1);
  }

  // Two cruisers park across the road ahead of the player's car.
  setRoadblock(game) {
    const pc = game.player.inCar;
    if (!pc) return;
    const f = pc.forward();
    const aheadX = pc.x + f.x * CONFIG.roadblockAhead;
    const aheadZ = pc.z + f.z * CONFIG.roadblockAhead;
    // Two cruisers park across the player's lane ahead of the car,
    // overlapping so the car cannot slip between them.
    const side = { x: -f.z, z: f.x };
    let placed = 0;
    for (const entry of this.cars) {
      if (placed >= 2) break;
      if (entry.state !== 'chase') continue;
      entry.state = 'block';
      entry.blockT = 4;
      const off = placed === 0 ? -2 : 2;
      entry.car.x = aheadX + side.x * off;
      entry.car.z = aheadZ + side.z * off;
      entry.car.heading = Math.atan2(side.x, side.z);
      entry.car.speed = 0;
      entry.car.syncMesh();
      placed++;
    }
    while (placed < 2) {
      const off = placed === 0 ? -2 : 2;
      const e = this.spawnCruiser(aheadX + side.x * off, aheadZ + side.z * off, Math.atan2(side.x, side.z));
      e.state = 'block';
      e.blockT = 4;
      placed++;
    }
    this.roadblockT = CONFIG.roadblockCooldown;
  }

  makeFootCop(game) {
    const g = new THREE.Group();
    const navy = new THREE.MeshLambertMaterial({ color: 0x1a2a4a });
    const skin = new THREE.MeshLambertMaterial({ color: 0xc98a5e });
    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.72, 0.32), navy);
    torso.position.y = 1.12;
    g.add(torso);
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.4, 0.38), skin);
    head.position.y = 1.72;
    g.add(head);
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.28, 0.12, 8), navy);
    cap.position.y = 1.95;
    g.add(cap);
    const a = this.rng.range(0, Math.PI * 2);
    const x = game.player.x + Math.cos(a) * 26;
    const z = game.player.z + Math.sin(a) * 26;
    g.position.set(x, 0, z);
    this.scene.add(g);
    const cop = { group: g, x, z, nearT: 0, shootT: 0, downT: 0 };
    this.footCops.push(cop);
    return cop;
  }

  update(dt, game) {
    this.time += dt;
    this.roadblockT -= dt;
    this.spawnT -= dt;
    // Heat bleeds off after a clean stretch.
    if (this.time - this.lastCrimeT > CONFIG.heatCleanDelay && this.heat > 0) {
      this.heat = Math.max(0, this.heat - CONFIG.heatDecay * dt);
      this.stars = this.starsFor(this.heat);
    }
    const player = game.player;
    const pc = player.inCar;
    const px = player.x;
    const pz = player.z;

    // Cruiser count follows the wanted level.
    const want = this.desiredCruisers();
    if (this.cars.length < want && this.spawnT <= 0) {
      this.spawnNearPlayer(game);
      this.spawnT = 1.2;
    }
    while (this.cars.length > want) {
      // Shed the farthest cruiser first.
      let far = this.cars[0];
      let farD = -1;
      for (const e of this.cars) {
        const d = Math.hypot(e.car.x - px, e.car.z - pz);
        if (d > farD) { farD = d; far = e; }
      }
      this.removeCruiser(far);
    }

    // Roadblock at 3+ stars against a fleeing driver.
    if (this.stars >= CONFIG.policeRoadblockStars && pc && pc.speed > 8 && this.roadblockT <= 0) {
      this.setRoadblock(game);
    }

    const cap = CONFIG.policeCap(this.stars);
    for (const e of this.cars) {
      const car = e.car;
      e.ramT -= dt;
      e.pitT -= dt;
      if (car.disabled) {
        car.speed *= Math.max(0, 1 - 2 * dt);
        car.syncMesh();
        if (Math.random() < dt * 2) game.effects.smoke(car.x, 1.2, car.z);
        continue;
      }
      if (e.state === 'block') {
        e.blockT -= dt;
        car.speed = 0;
        car.syncMesh();
        // A car that drives into the roadblock grinds to a near-stop
        // against it instead of pushing through.
        if (pc && Math.hypot(car.x - pc.x, car.z - pc.z) < 4.5) {
          pc.speed = Math.min(pc.speed, 5);
        }
        if (e.blockT <= 0) e.state = 'chase';
        continue;
      }
      const distP = Math.hypot(car.x - px, car.z - pz);
      let tx;
      let tz;
      let targetSpeed = cap;
      if (this.holdPos) {
        // Vault hold: ring the hold point at ~11 m, do not ram.
        tx = this.holdPos.x + Math.cos(e.ringA) * 11;
        tz = this.holdPos.z + Math.sin(e.ringA) * 11;
        if (Math.hypot(car.x - tx, car.z - tz) < 2) targetSpeed = 0;
      } else if (distP < CONFIG.policeRamRange && this.city.hasLineOfSight(car.x, car.z, px, pz)) {
        // Close in with a clear line: steer straight at the player.
        tx = px;
        tz = pz;
        if (distP < 10) targetSpeed = Math.min(cap, (pc ? pc.speed : 0) + 3);
      } else {
        // Follow the road graph toward the player's intersection.
        // Replan often: the target moves 34 m/s, a stale path is a lost
        // chase. Slow for corners so the cruiser turns instead of
        // overshooting the intersection and looping around the block.
        e.repathT -= dt;
        if (!e.path.length || e.repathT <= 0 || e.pathI >= e.path.length) {
          e.path = this.findPath(car.x, car.z, px, pz);
          e.pathI = 0;
          e.repathT = distP < 60 ? 0.5 : 0.8;
        }
        const wp = e.path[Math.min(e.pathI, e.path.length - 1)];
        const wpD = Math.hypot(wp.x - car.x, wp.z - car.z);
        if (wpD < 12) e.pathI++;
        if (e.pathI < e.path.length - 1 && wpD < 26) {
          const next = e.path[e.pathI + 1];
          const a1 = Math.atan2(wp.x - car.x, wp.z - car.z);
          const a2 = Math.atan2(next.x - wp.x, next.z - wp.z);
          let turn = a2 - a1;
          while (turn > Math.PI) turn -= Math.PI * 2;
          while (turn < -Math.PI) turn += Math.PI * 2;
          if (Math.abs(turn) > 0.7) targetSpeed = Math.min(targetSpeed, 20);
        }
        tx = wp.x;
        tz = wp.z;
      }
      // Steer toward the target point.
      const wantH = Math.atan2(tx - car.x, tz - car.z);
      let dh = wantH - car.heading;
      while (dh > Math.PI) dh -= Math.PI * 2;
      while (dh < -Math.PI) dh += Math.PI * 2;
      car.heading += Math.max(-3.6 * dt, Math.min(3.6 * dt, dh));
      car.speed += Math.max(-20 * dt, Math.min(16 * dt, targetSpeed - car.speed));
      const f = car.forward();
      car.x += f.x * car.speed * dt;
      car.z += f.z * car.speed * dt;
      resolveBuildings(car, 2.3, this.city.colliders);
      // Ram: shove the player's car and bleed its speed.
      if (pc && distP < 4.5 && e.ramT <= 0 && !this.holdPos) {
        e.ramT = 0.8;
        pc.speed *= 0.6;
        pc.x += f.x * 1.6;
        pc.z += f.z * 1.6;
        pc.syncMesh();
        game.effects.burst(pc.x, 1, pc.z, 0xffc040, 10, 4, 2, 0.5);
        game.audio.punch();
      }
      // PIT at 3+ stars: lateral shove plus a speed cut.
      if (pc && this.stars >= CONFIG.policePitStars && distP < 7 && distP > 3.5 && e.pitT <= 0 && !this.holdPos) {
        e.pitT = 2;
        const side = { x: -f.z, z: f.x };
        const sgn = (pc.x - car.x) * side.x + (pc.z - car.z) * side.z >= 0 ? 1 : -1;
        pc.x += side.x * sgn * 1.1;
        pc.z += side.z * sgn * 1.1;
        pc.speed *= 0.88;
        pc.syncMesh();
        game.effects.burst(pc.x, 1, pc.z, 0xff8040, 8, 3, 2, 0.4);
      }
      car.syncMesh();
    }

    // Foot cops: only a threat while Rico is on foot.
    const wantCops = !pc && this.stars >= 1 ? (this.stars >= 3 ? 2 : 1) : 0;
    while (this.footCops.length < wantCops) this.makeFootCop(game);
    while (this.footCops.length > wantCops) {
      const c = this.footCops.pop();
      this.scene.remove(c.group);
    }
    for (const cop of this.footCops) {
      if (cop.downT > 0) {
        cop.downT -= dt;
        continue;
      }
      const dx = px - cop.x;
      const dz = pz - cop.z;
      const d = Math.hypot(dx, dz);
      cop.group.rotation.y = Math.atan2(dx, dz);
      if (d > 1.8) {
        cop.x += (dx / d) * 7.5 * dt;
        cop.z += (dz / d) * 7.5 * dt;
        cop.nearT = 0;
      } else {
        cop.nearT += dt;
        if (cop.nearT > CONFIG.arrestSeconds) {
          game.busted();
          return;
        }
      }
      // At 3+ stars a foot cop shoots instead of just chasing.
      if (this.stars >= 3 && d < 25 && d > 4) {
        cop.shootT -= dt;
        if (cop.shootT <= 0) {
          cop.shootT = 0.7;
          game.effects.tracer({ x: cop.x, y: 1.4, z: cop.z }, { x: px, y: 1.2, z: pz });
          if (player.takeDamage(5)) game.wasted();
        }
      }
      cop.group.position.set(cop.x, 0, cop.z);
    }
  }
}
