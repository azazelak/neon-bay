// Neon Bay — wanted level and police: BFS road routing, chase, ram,
// PIT and roadblocks at 3+ stars, foot arrest, vault-hold standoff ring.

import * as THREE from 'three';
import { CFG, AVENUES, nearestAvenue, nearestIntersection, clamp, angleDiff } from './config.js';
import { Car } from './vehicles.js';

// Cruiser top speed by wanted level: 29.6 at 1 star up to 44 at 5.
export function cruiserTopSpeed(level) {
  return Math.min(44, 26 + level * 3.6);
}

export class Police {
  constructor(scene, city, effects) {
    this.scene = scene;
    this.city = city;
    this.effects = effects;
    this.wanted = 0;
    this.cruisers = []; // { car, path, pathIdx, replan, pitCooldown, state }
    this.blockers = []; // { car, timer }
    this.cleanTimer = 0;
    this.roadblockTimer = 0;
    this.arrestTimer = 0;
    this.standoff = null; // { x, z } vault hold point, or null
    this.rng = Math.random;
  }

  setWanted(n) {
    this.wanted = clamp(Math.round(n), 0, 5);
    this.cleanTimer = 0;
  }

  addWanted(n) {
    this.setWanted(this.wanted + n);
  }

  // BFS over the intersection graph; returns waypoints from start to goal.
  route(fromX, fromZ, toX, toZ) {
    const start = nearestIntersection(fromX, fromZ);
    const goal = nearestIntersection(toX, toZ);
    const si = AVENUES.indexOf(start.x);
    const sj = AVENUES.indexOf(start.z);
    const gi = AVENUES.indexOf(goal.x);
    const gj = AVENUES.indexOf(goal.z);
    const key = (i, j) => `${i},${j}`;
    const prev = new Map();
    const queue = [[si, sj]];
    prev.set(key(si, sj), null);
    while (queue.length) {
      const [i, j] = queue.shift();
      if (i === gi && j === gj) break;
      for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const ni = i + di;
        const nj = j + dj;
        if (ni < 0 || ni > 8 || nj < 0 || nj > 8) continue;
        if (prev.has(key(ni, nj))) continue;
        prev.set(key(ni, nj), [i, j]);
        queue.push([ni, nj]);
      }
    }
    if (!prev.has(key(gi, gj))) return [{ x: toX, z: toZ }];
    const path = [];
    let cur = [gi, gj];
    while (cur) {
      path.unshift({ x: AVENUES[cur[0]], z: AVENUES[cur[1]] });
      cur = prev.get(key(cur[0], cur[1]));
    }
    path.push({ x: toX, z: toZ });
    return path;
  }

  spawnCruiser(px, pz) {
    // Spawn on a road 40-70 m from the player.
    for (let tries = 0; tries < 12; tries++) {
      const a = Math.random() * Math.PI * 2;
      const d = 40 + Math.random() * 30;
      const x = px + Math.cos(a) * d;
      const z = pz + Math.sin(a) * d;
      if (Math.abs(x) > 330 || Math.abs(z) > 330) continue;
      const ix = nearestAvenue(x);
      const iz = nearestAvenue(z);
      const sx = Math.abs(x - ix) < Math.abs(z - iz) ? ix : x;
      const sz = Math.abs(x - ix) < Math.abs(z - iz) ? z : iz;
      const car = new Car(this.scene, 'police', 0x1a1a1a, sx, sz, Math.random() * Math.PI * 2);
      this.cruisers.push({
        car, path: [], pathIdx: 0, replan: 0,
        pitCooldown: 0, state: 'chase', smokeTimer: 0,
      });
      return;
    }
  }

  removeCruiser(c) {
    c.car.remove(this.scene);
    const i = this.cruisers.indexOf(c);
    if (i >= 0) this.cruisers.splice(i, 1);
  }

  // A cruiser is hit by a bullet: 3 hits disables it.
  hitCruiser(car) {
    const c = this.cruisers.find((k) => k.car === car);
    if (!c) return false;
    c.car.hits++;
    if (c.car.hits >= CFG.cruiserHitsToDisable) {
      c.car.disabled = true;
      c.state = 'disabled';
      return true;
    }
    return false;
  }

  update(dt, time, ctx) {
    const { playerX, playerZ, playerCar, onFoot, onBusted } = ctx;
    // Keep cruiser count in step with the wanted level.
    const wantCount = Math.min(this.wanted, CFG.maxCruisers);
    while (this.cruisers.length < wantCount) this.spawnCruiser(playerX, playerZ);
    while (this.cruisers.length > wantCount) this.removeCruiser(this.cruisers[this.cruisers.length - 1]);

    // Heat decays after 45 s of clean driving with no cruiser near.
    let nearest = 1e9;
    for (const c of this.cruisers) nearest = Math.min(nearest, Math.hypot(c.car.x - playerX, c.car.z - playerZ));
    if (this.wanted > 0 && nearest > 60) {
      this.cleanTimer += dt;
      if (this.cleanTimer >= CFG.wantedDecaySeconds) {
        this.setWanted(this.wanted - 1);
      }
    } else {
      this.cleanTimer = 0;
    }

    // Roadblock at 3+ stars, every 22 s, ahead of the player's car.
    this.roadblockTimer -= dt;
    if (this.wanted >= 3 && playerCar && this.roadblockTimer <= 0) {
      this.roadblockTimer = CFG.roadblockCooldown;
      this.layRoadblock(playerCar);
    }

    // Foot arrest: a cruiser parked on the player for 2 s busts them.
    if (onFoot && this.wanted > 0 && nearest < 3.5) {
      this.arrestTimer += dt;
      if (this.arrestTimer > 2 && onBusted) onBusted();
    } else {
      this.arrestTimer = 0;
    }

    const top = cruiserTopSpeed(this.wanted);
    for (const c of this.cruisers) {
      const car = c.car;
      car.flashLights(time);
      if (car.disabled) {
        car.speed *= Math.max(0, 1 - dt * 2);
        car.group.position.set(car.x, 0, car.z);
        c.smokeTimer -= dt;
        if (c.smokeTimer <= 0) {
          c.smokeTimer = 0.4;
          if (this.effects) this.effects.smoke(car.x, 1.2, car.z);
        }
        continue;
      }
      c.pitCooldown -= dt;
      const dx = playerX - car.x;
      const dz = playerZ - car.z;
      const dist = Math.hypot(dx, dz);
      // Vault hold: ring the hold point at ~11 m, never ram.
      if (this.standoff) {
        const hx = this.standoff.x - car.x;
        const hz = this.standoff.z - car.z;
        const hd = Math.hypot(hx, hz);
        const ringR = 11;
        const wantHeading = Math.atan2(-hx, -hz);
        const turn = clamp(angleDiff(car.heading, wantHeading), -1, 1) * 3.6 * dt;
        car.heading += turn;
        const targetSpeed = hd > ringR + 2 ? top * 0.7 : hd < ringR - 2 ? -6 : 0;
        car.speed += clamp(targetSpeed - car.speed, -20 * dt, 12 * dt);
        car.x += -Math.sin(car.heading) * car.speed * dt;
        car.z += -Math.cos(car.heading) * car.speed * dt;
        car.group.position.set(car.x, 0, car.z);
        car.group.rotation.y = car.heading;
        continue;
      }
      // Direct chase when there is line of sight and the player is close.
      const los = dist < 70 && this.city.hasLineOfSight(car.x, car.z, playerX, playerZ);
      let targetX, targetZ;
      if (los) {
        targetX = playerX;
        targetZ = playerZ;
      } else {
        c.replan -= dt;
        if (c.replan <= 0 || c.pathIdx >= c.path.length) {
          c.replan = 0.5 + Math.random() * 0.3;
          c.path = this.route(car.x, car.z, playerX, playerZ);
          c.pathIdx = 0;
        }
        const wp = c.path[Math.min(c.pathIdx, c.path.length - 1)];
        targetX = wp.x;
        targetZ = wp.z;
        if (Math.hypot(wp.x - car.x, wp.z - car.z) < 12) c.pathIdx++;
      }
      const wantHeading = Math.atan2(-(targetX - car.x), -(targetZ - car.z));
      const turn = clamp(angleDiff(car.heading, wantHeading), -1, 1) * 3.6 * dt;
      car.heading += turn;
      // Cap speed on sharp turns so cruisers stop overshooting waypoints.
      const sharp = Math.abs(angleDiff(car.heading, wantHeading)) > 0.9;
      const cap = sharp ? 20 : top;
      const targetSpeed = dist < 4 && los ? top * 0.55 : cap;
      car.speed += clamp(targetSpeed - car.speed, -24 * dt, 14 * dt);
      car.x += -Math.sin(car.heading) * car.speed * dt;
      car.z += -Math.cos(car.heading) * car.speed * dt;
      // Don't drive through buildings: slide along them.
      const hit = this.city.resolveCollision(car.x, car.z, 1.6);
      car.x = hit.x;
      car.z = hit.z;
      car.group.position.set(car.x, 0, car.z);
      car.group.rotation.y = car.heading;
      // Ram: shove the player's car and shake it when touching.
      if (playerCar && dist < 4.5) {
        playerCar.speed *= Math.max(0.7, 1 - dt * 1.2);
        const push = 2.2;
        playerCar.x += (dx / (dist || 1)) * -push * dt * -1;
        playerCar.z += (dz / (dist || 1)) * -push * dt * -1;
      }
      // PIT at 3+ stars: alongside the player, spin them down.
      if (this.wanted >= 3 && playerCar && dist < 5.5 && dist > 2 && c.pitCooldown <= 0) {
        c.pitCooldown = 3;
        playerCar.speed *= 0.88;
        const side = Math.sign((playerCar.x - car.x) * -Math.cos(car.heading) - (playerCar.z - car.z) * -Math.sin(car.heading)) || 1;
        playerCar.x += Math.cos(car.heading) * side * 1.1;
        playerCar.z += -Math.sin(car.heading) * side * 1.1;
        if (this.effects) this.effects.burst(playerCar.x, 1, playerCar.z, 0xffd42a, 8);
      }
    }

    // Roadblock blockers: parked across the road, grind the player down.
    for (let i = this.blockers.length - 1; i >= 0; i--) {
      const b = this.blockers[i];
      b.timer -= dt;
      b.car.flashLights(time);
      if (playerCar) {
        const d = Math.hypot(b.car.x - playerCar.x, b.car.z - playerCar.z);
        if (d < 3.4) {
          playerCar.speed = Math.min(playerCar.speed, 5);
        }
      }
      if (b.timer <= 0) {
        b.car.remove(this.scene);
        this.blockers.splice(i, 1);
      }
    }
  }

  layRoadblock(playerCar) {
    const fx = -Math.sin(playerCar.heading);
    const fz = -Math.cos(playerCar.heading);
    const cx = playerCar.x + fx * CFG.roadblockRange;
    const cz = playerCar.z + fz * CFG.roadblockRange;
    if (Math.abs(cx) > 330 || Math.abs(cz) > 330) return;
    // Two cruisers across the road, overlapping so the gap is unusable.
    const px = -fz;
    const pz = fx;
    for (const side of [-1.8, 1.8]) {
      const car = new Car(this.scene, 'police', 0x1a1a1a, cx + px * side, cz + pz * side, playerCar.heading + Math.PI);
      car.speed = 0;
      this.blockers.push({ car, timer: 12 });
    }
  }

  clearAll() {
    for (const c of [...this.cruisers]) this.removeCruiser(c);
    for (const b of this.blockers) b.car.remove(this.scene);
    this.blockers = [];
    this.standoff = null;
  }
}
