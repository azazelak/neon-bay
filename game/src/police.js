// Neon Bay v5c — wanted level and police.
// Fixes built in: spawnCruiser does NOT snap explicit spawn coordinates to
// the nearest road node (only random spawns get snapped); setWanted starts
// 10 heat into the band so a staged shot never loses a star while settling.
import { CFG } from './config.js';
import { Car } from './vehicles.js';

const nearestNode = (x, z) => [
  Math.max(-160, Math.min(160, Math.round(x / 40) * 40)),
  Math.max(-160, Math.min(160, Math.round(z / 40) * 40)),
];

// BFS over the road grid; returns a list of waypoints from (fx,fz) to (tx,tz).
export function bfsPath(fx, fz, tx, tz) {
  const key = (x, z) => `${x},${z}`;
  const from = nearestNode(fx, fz);
  const to = nearestNode(tx, tz);
  const prev = new Map([[key(from[0], from[1]), null]]);
  const q = [from];
  while (q.length) {
    const [x, z] = q.shift();
    if (x === to[0] && z === to[1]) break;
    for (const [dx, dz] of [[40, 0], [-40, 0], [0, 40], [0, -40]]) {
      const nx = x + dx, nz = z + dz;
      if (Math.abs(nx) > 160 || Math.abs(nz) > 160) continue;
      if (!prev.has(key(nx, nz))) { prev.set(key(nx, nz), [x, z]); q.push([nx, nz]); }
    }
  }
  const path = [];
  let cur = to;
  if (!prev.has(key(cur[0], cur[1]))) return [[tx, tz]];
  while (cur) { path.unshift(cur); cur = prev.get(key(cur[0], cur[1])); }
  path.push([tx, tz]);
  return path;
}

export class Police {
  constructor(game, rng) {
    this.game = game;
    this.rng = rng;
    this.level = 0;
    this.heat = 0;
    this.cruisers = [];
    this.roadblockAt = 0;
    this.roadblockCars = [];
    this.shootAt = 0;
  }

  setWanted(level) {
    this.level = Math.max(0, Math.min(5, level));
    // start 10 heat INTO the band, never exactly on its threshold
    this.heat = this.level === 0 ? 0 : (this.level - 1) * CFG.wantedHeatPerStar + 10;
    this.syncCruisers();
  }

  addHeat(n) {
    if (this.level >= 5) return;
    this.heat += n;
    const lvl = Math.min(5, Math.floor(this.heat / CFG.wantedHeatPerStar) + 1);
    if (lvl !== this.level) { this.level = lvl; this.syncCruisers(); }
  }

  decay(dt) {
    if (this.level === 0) return;
    this.heat -= dt * 1.2;
    if (this.heat < 0) { this.heat = 0; this.level = 0; this.syncCruisers(); return; }
    const lvl = Math.min(5, Math.floor(this.heat / CFG.wantedHeatPerStar) + 1);
    if (lvl !== this.level) { this.level = lvl; this.syncCruisers(); }
  }

  // Explicit coords are used as-is (staged shots need exact placement).
  // Only random spawns (no coords given) snap to a road node.
  spawnCruiser(x, z) {
    let sx = x, sz = z;
    if (sx === undefined || sz === undefined) {
      const p = this.game.player;
      const a = this.rng.range(0, Math.PI * 2);
      const d = this.rng.range(40, 80);
      [sx, sz] = nearestNode(p.pos.x + Math.sin(a) * d, p.pos.z + Math.cos(a) * d);
    }
    const car = new Car(this.game, 'cruiser', sx, sz, 0, 0x11151c, true);
    car.isTraffic = false;
    car.slot = this.cruisers.length;
    this.cruisers.push(car);
    return car;
  }

  syncCruisers() {
    const want = this.level === 0 ? 0 : Math.min(6, 1 + this.level);
    while (this.cruisers.length < want) this.spawnCruiser();
    while (this.cruisers.length > want) {
      const c = this.cruisers.pop();
      this.game.scene.remove(c.mesh);
    }
    this.cruisers.forEach((c, i) => { c.slot = i; });
  }

  // Roadblock: two cruisers across the road ahead of the player.
  maybeRoadblock(now) {
    if (this.level < 3) return;
    if (now - this.roadblockAt < 22) return;
    this.roadblockAt = now;
    const p = this.game.player;
    const f = p.inCar && p.car ? p.car.forward() : { x: Math.sin(p.yaw), z: Math.cos(p.yaw) };
    const cx = p.pos.x + f.x * 45, cz = p.pos.z + f.z * 45;
    const px = -f.z, pz = f.x; // perpendicular
    for (const s of [-4, 4]) {
      const c = this.spawnCruiser(cx + px * s, cz + pz * s);
      c.yaw = Math.atan2(f.x, f.z) + Math.PI / 2;
      this.roadblockCars.push(c);
    }
  }

  update(dt, now) {
    this.decay(dt);
    this.maybeRoadblock(now);
    const p = this.game.player;
    const tx = p.pos.x, tz = p.pos.z;
    const pCar = p.inCar && p.car ? p.car : null;
    this.cruisers.forEach((c, i) => {
      // slot controller: each cruiser aims at a different offset around the player
      const slotA = (i / Math.max(1, this.cruisers.length)) * Math.PI * 2 + now * 0.05;
      const gx = tx + Math.sin(slotA) * 9, gz = tz + Math.cos(slotA) * 9;
      const path = bfsPath(c.pos.x, c.pos.z, gx, gz);
      const wp = path.length > 1 ? path[1] : path[0];
      const want = Math.atan2(wp[0] - c.pos.x, wp[1] - c.pos.z);
      let dy = want - c.yaw;
      while (dy > Math.PI) dy -= Math.PI * 2;
      while (dy < -Math.PI) dy += Math.PI * 2;
      const d = Math.hypot(tx - c.pos.x, tz - c.pos.z);
      // close in directly once near the player (BFS nodes are coarse)
      const driveTo = d < 25 ? [tx, tz] : wp;
      const want2 = Math.atan2(driveTo[0] - c.pos.x, driveTo[1] - c.pos.z);
      let dy2 = want2 - c.yaw;
      while (dy2 > Math.PI) dy2 -= Math.PI * 2;
      while (dy2 < -Math.PI) dy2 += Math.PI * 2;
      const steer = dy2 > 0.12 ? 1 : dy2 < -0.12 ? -1 : 0;
      const sev = c.step(dt, { fwd: 1, steer, brake: Math.abs(dy2) > 1.4 && c.speed > 5 },
        this.game.city.colliders);
      // ram: touch the player car and shove it
      if (pCar && d < 4.5 && c.speed > 3) {
        const push = 2.2;
        pCar.pos.x += (pCar.pos.x - c.pos.x) / Math.max(1, d) * push * dt * 10;
        pCar.pos.z += (pCar.pos.z - c.pos.z) / Math.max(1, d) * push * dt * 10;
        this.game.player.damage(4 * dt * 10, 'ram');
      }
      // PIT at 3+ stars: a fast cruiser alongside the player shoves sideways
      if (pCar && this.level >= 3 && d < 5 && d > 2.5 && c.speed > 20) {
        const side = Math.sign((pCar.pos.x - c.pos.x) * Math.cos(c.yaw) - (pCar.pos.z - c.pos.z) * Math.sin(c.yaw)) || 1;
        pCar.pos.x += Math.cos(c.yaw) * side * 1.1 * dt * 10;
        pCar.pos.z -= Math.sin(c.yaw) * side * 1.1 * dt * 10;
        pCar.speed *= (1 - 0.12 * dt * 10);
      }
      if (sev === 2) c.speed *= 0.9;
    });
    // cops shoot at the player on foot at 3+ stars
    if (this.level >= 3 && !p.inCar && now - this.shootAt > 1.1) {
      const near = this.cruisers.some((c) => Math.hypot(c.pos.x - tx, c.pos.z - tz) < 40);
      if (near) {
        this.shootAt = now;
        this.game.player.damage(6, 'shot');
        this.game.effects?.muzzle(cruisersPos(this));
      }
    }
  }
}
function cruisersPos(police) {
  const c = police.cruisers[0];
  return c ? { x: c.pos.x, z: c.pos.z } : { x: 0, z: 0 };
}
