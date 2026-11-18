// Neon Bay v4 — traffic: cars driving Manhattan routes on the road graph,
// pedestrians wandering the sidewalks, parked cars. Traffic obeys the
// traffic-light cycle at intersections. Pedestrians fall when run over and
// respawn elsewhere. The road-graph BFS here is shared with police.js.
import { Car } from './vehicles.js';
import { makePedFigure } from './player.js';
import { PITCH, GRID_K, clamp, dist2 } from './config.js';
import { Rng } from './rng.js';

export function nodeKey(i, j) { return i + ',' + j; }

// BFS over intersection nodes (i, j in -4..4); returns a list of {x, z}
// waypoints in world coordinates, or null when unreachable.
export function findPath(from, to) {
  const key = (n) => n.i + ',' + n.j;
  const prev = new Map();
  const seen = new Set([key(from)]);
  const queue = [from];
  while (queue.length) {
    const cur = queue.shift();
    if (cur.i === to.i && cur.j === to.j) {
      const path = [];
      let n = cur;
      while (n) { path.unshift({ x: n.i * PITCH, z: n.j * PITCH }); n = prev.get(key(n)); }
      return path;
    }
    for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const ni = cur.i + di, nj = cur.j + dj;
      if (ni < -GRID_K || ni > GRID_K || nj < -GRID_K || nj > GRID_K) continue;
      const nk = ni + ',' + nj;
      if (seen.has(nk)) continue;
      seen.add(nk); prev.set(nk, cur);
      queue.push({ i: ni, j: nj });
    }
  }
  return null;
}

const TRAFFIC_KINDS = ['sedan', 'sedan', 'taxi', 'van', 'muscle', 'pickup', 'sedan'];

export function createTraffic(scene, colliders, cityLights) {
  const rng = new Rng(777);
  const cars = [];
  const peds = [];
  const parked = [];

  function randomNode() { return { i: rng.int(-GRID_K, GRID_K), j: rng.int(-GRID_K, GRID_K) }; }

  function newRoute(car) {
    const target = randomNode();
    const from = { i: Math.round(car.x / PITCH), j: Math.round(car.z / PITCH) };
    const path = findPath(from, target);
    car.route = path ? path.slice(1) : [];
    car.routeIdx = 0;
  }

  for (let i = 0; i < 20; i++) {
    const n = randomNode();
    const kind = TRAFFIC_KINDS[i % TRAFFIC_KINDS.length];
    const car = new Car(scene, kind, n.i * PITCH, n.j * PITCH, rng.range(0, Math.PI * 2));
    car.speed = rng.range(8, 14);
    newRoute(car);
    car.cruise = rng.range(9, 15);
    cars.push(car);
  }
  for (let i = 0; i < 16; i++) {
    const n = randomNode();
    const kind = TRAFFIC_KINDS[(i + 3) % TRAFFIC_KINDS.length];
    const side = rng.chance(0.5) ? 1 : -1;
    const along = rng.chance(0.5);
    const x = along ? n.i * PITCH + side * 7 : n.i * PITCH + rng.range(-30, 30);
    const z = along ? n.j * PITCH + rng.range(-30, 30) : n.j * PITCH + side * 7;
    const car = new Car(scene, kind, x, z, along ? 0 : Math.PI / 2);
    car.speed = 0;
    parked.push(car);
  }
  for (let i = 0; i < 36; i++) {
    const ped = spawnPed(i);
    peds.push(ped);
  }

  function spawnPed(i) {
    const n = randomNode();
    const side = rng.chance(0.5) ? 1 : -1;
    const along = rng.chance(0.5);
    const x = along ? n.i * PITCH + side * 12 : n.i * PITCH + rng.range(-40, 40);
    const z = along ? n.j * PITCH + rng.range(-40, 40) : n.j * PITCH + side * 12;
    const height = rng.range(1.65, 1.95);
    const figure = makePedFigure(scene, {
      seed: i * 3 + 1,
      height,
      hat: rng.chance(0.25),
      hair: rng.pick([0x1a1a1a, 0x6a4a2a, 0xd8d8d8, 0x3a2a1a]),
    });
    figure.position.set(x, 0, z);
    return {
      x, z, yaw: rng.range(0, Math.PI * 2), speed: rng.range(1.2, 2.4),
      figure, down: 0, timer: rng.range(4, 12), height,
      target: null,
    };
  }

  function lightStateAt(x, z, t) {
    // 2 = green, 1 = yellow, 0 = red for the intersection nearest (x, z).
    let best = null, bestD = 1e9;
    for (const L of cityLights) {
      const d = dist2(x, z, L.x, L.z);
      if (d < bestD) { bestD = d; best = L; }
    }
    if (!best || bestD > 30 * 30) return 2;
    return (Math.floor(t / 6) % 3 + best.phase) % 3;
  }

  function update(dt, t, playerCar, onPedRunOver) {
    const allCars = playerCar && !playerCar.dead ? cars.concat([playerCar]) : cars;
    for (const car of cars) {
      if (!car.route || car.routeIdx >= car.route.length) newRoute(car);
      const wp = car.route[car.routeIdx];
      if (!wp) continue;
      const dx = wp.x - car.x, dz = wp.z - car.z;
      const d = Math.hypot(dx, dz);
      if (d < 6) { car.routeIdx++; continue; }
      const wantYaw = Math.atan2(dx, dz);
      let dy = wantYaw - car.yaw;
      while (dy > Math.PI) dy -= Math.PI * 2;
      while (dy < -Math.PI) dy += Math.PI * 2;
      const steer = clamp(dy * 1.4, -1, 1);
      // Stop at a red light when the next waypoint is an intersection.
      let throttle = 1;
      const ls = lightStateAt(wp.x, wp.z, t);
      if (ls === 0 && d < 16) throttle = 0;
      else if (ls === 1 && d < 12) throttle = 0.4;
      // Slow for the car ahead — traffic cars and the player's car alike.
      for (const o of allCars) {
        if (o === car) continue;
        const od = Math.hypot(o.x - car.x, o.z - car.z);
        if (od < 9) {
          const ahead = (o.x - car.x) * Math.sin(car.yaw) + (o.z - car.z) * Math.cos(car.yaw);
          if (ahead > 0) { throttle = 0; break; }
        }
      }
      car.step(throttle, steer, false, dt, colliders, allCars);
      if (car.speed > car.cruise) car.speed = car.cruise;
    }
    for (const ped of peds) {
      if (ped.down > 0) {
        ped.down -= dt;
        if (ped.down <= 0) {
          const fresh = spawnPed(Math.floor(rng.next() * 1000));
          ped.x = fresh.x; ped.z = fresh.z; ped.yaw = fresh.yaw;
          ped.figure.position.set(ped.x, 0, ped.z);
          ped.figure.rotation.set(0, ped.yaw, 0);
          ped.figure.visible = true;
          scene.remove(fresh.figure);
        }
        continue;
      }
      ped.timer -= dt;
      if (ped.timer <= 0) {
        ped.yaw = rng.range(0, Math.PI * 2);
        ped.timer = rng.range(4, 12);
      }
      ped.x += Math.sin(ped.yaw) * ped.speed * dt;
      ped.z += Math.cos(ped.yaw) * ped.speed * dt;
      ped.x = clamp(ped.x, -420, 460);
      ped.z = clamp(ped.z, -420, 420);
      ped.figure.position.set(ped.x, 0, ped.z);
      ped.figure.rotation.y = ped.yaw;
      // Run over by the player's car?
      if (playerCar && !playerCar.dead && Math.abs(playerCar.speed) > 5) {
        const d2 = dist2(ped.x, ped.z, playerCar.x, playerCar.z);
        if (d2 < 2.4 * 2.4) {
          ped.down = 8;
          ped.figure.rotation.x = Math.PI / 2;
          ped.figure.position.y = 0.4;
          if (onPedRunOver) onPedRunOver(ped);
        }
      }
    }
  }

  function reset() {
    for (const car of cars) { const n = randomNode(); car.x = n.i * PITCH; car.z = n.j * PITCH; car.speed = 10; newRoute(car); }
    for (const ped of peds) {
      ped.down = 0; ped.figure.rotation.x = 0; ped.figure.visible = true;
      const n = randomNode(); ped.x = n.i * PITCH; ped.z = n.j * PITCH;
      ped.figure.position.set(ped.x, 0, ped.z);
    }
  }

  return { cars, peds, parked, update, reset };
}
