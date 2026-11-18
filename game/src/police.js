// Neon Bay v4 — the wanted system. Cruisers spawn by wanted level, chase on
// the road graph (BFS), ram up close, PIT at 3+ stars, and set roadblocks at
// 3+ stars. On foot, a cruiser that gets close arrests the player. During a
// vault hold the cruisers ring the hold point instead of ramming.
import { Car } from './vehicles.js';
import { findPath } from './traffic.js';
import { PITCH, GRID_K, policeTop, clamp, dist2 } from './config.js';
import { Rng } from './rng.js';

export function createPolice(scene, colliders) {
  const rng = new Rng(4242);
  let wanted = 0;
  let cleanTimer = 0;
  let roadblockTimer = 10;
  let arrestTimer = 0;
  let standoff = null;
  let respawnTimer = 0;
  const cruisers = [];

  function spawnCruiser(x, z) {
    const c = new Car(scene, 'cruiser', x, z, rng.range(0, Math.PI * 2));
    c.mode = 'chase'; c.path = []; c.pathIdx = 0; c.repath = 0;
    c.pitCool = 0; c.ramCool = 0; c.blockTimer = 0;
    cruisers.push(c);
    return c;
  }

  function spawnNear(px, pz, yaw) {
    // Spawn on the player's road, 40-80 m behind their direction of
    // travel, snapped to the nearest road centreline so the cruiser
    // never spawns inside a building. (Snapping to a grid node instead
    // could push the spawn a whole block away.)
    const fx = Math.sin(yaw || 0), fz = Math.cos(yaw || 0);
    const d = rng.range(40, 80);
    let x = px - fx * d, z = pz - fz * d;
    const ax = Math.round(x / PITCH) * PITCH, az = Math.round(z / PITCH) * PITCH;
    if (Math.abs(x - ax) < Math.abs(z - az)) x = ax; else z = az;
    return spawnCruiser(clamp(x, -400, 420), clamp(z, -400, 420));
  }

  function addWanted(n) {
    wanted = clamp(wanted + n, 0, 5);
    cleanTimer = 0;
  }
  function setWanted(n) { wanted = clamp(n, 0, 5); cleanTimer = 0; }

  function setStandoff(point) { standoff = point; }

  function damageCruiser(c, n) {
    c.damage(n * 34);
    if (c.dead) {
      c.smoke = 6;
      respawnTimer = 8;
    }
  }

  function update(dt, t, player, onBusted) {
    // Keep the cruiser count matched to the wanted level.
    const wantCount = wanted;
    while (cruisers.filter(c => !c.dead).length < wantCount) spawnNear(player.x, player.z, player.yaw);
    while (cruisers.filter(c => !c.dead).length > wantCount) {
      const c = cruisers.find(c => !c.dead);
      if (!c) break;
      c.remove(); cruisers.splice(cruisers.indexOf(c), 1);
    }
    // Heat decays after 60 s clean.
    if (wanted > 0) {
      cleanTimer += dt;
      if (cleanTimer > 60) { wanted--; cleanTimer = 0; }
    }
    // Respawn a disabled cruiser while the heat is still on.
    if (respawnTimer > 0) {
      respawnTimer -= dt;
      if (respawnTimer <= 0 && wanted > 0) spawnNear(player.x, player.z, player.yaw);
    }
    // Roadblocks at 3+ stars, every 22 s.
    if (wanted >= 3) {
      roadblockTimer -= dt;
      if (roadblockTimer <= 0) {
        roadblockTimer = 22;
        const ahead = 45;
        const bx = player.x + Math.sin(player.yaw) * ahead;
        const bz = player.z + Math.cos(player.yaw) * ahead;
        const rx = Math.round(bx / PITCH) * PITCH;
        const rz = Math.round(bz / PITCH) * PITCH;
        for (const s of [-1, 1]) {
          const c = spawnCruiser(rx + Math.cos(player.yaw) * s * 5, rz - Math.sin(player.yaw) * s * 5);
          c.mode = 'block'; c.blockTimer = 7;
          c.yaw = player.yaw + Math.PI / 2;
          c.group.rotation.y = c.yaw;
        }
      }
    }
    const pSpeed = player.car ? Math.abs(player.car.speed) : 0;
    for (const c of cruisers) {
      if (c.dead) { c.step(0, 0, false, dt, colliders, cruisers); continue; }
      c.pitCool -= dt; c.ramCool -= dt;
      if (c.mode === 'block') {
        c.blockTimer -= dt;
        c.step(0, 0, true, dt, colliders, cruisers);
        if (c.blockTimer <= 0) c.mode = 'chase';
        continue;
      }
      const d = Math.hypot(player.x - c.x, player.z - c.z);
      if (standoff) {
        // Ring the hold point at its radius, facing in.
        const ring = standoff.r;
        const idx = cruisers.indexOf(c);
        const a = (idx / Math.max(1, cruisers.length)) * Math.PI * 2 + t * 0.05;
        const tx = standoff.x + Math.cos(a) * ring;
        const tz = standoff.z + Math.sin(a) * ring;
        steerTo(c, tx, tz, dt, colliders, policeTop(wanted));
        continue;
      }
      if (d < 26 && player.car) {
        // Close in: ram / PIT at 3+ stars. Each cruiser holds its own
        // slot behind the player (lane + following distance) so the pack
        // fans out instead of bunching up and bleeding speed on each
        // other's separation. Speed is regulated to hold the slot, so a
        // cruiser that falls behind closes in and one that is too close
        // backs off — no more overshoot-and-loop.
        const idx = cruisers.indexOf(c);
        const lane = (idx % 3 - 1) * 4.5;
        const slot = 4 + (idx % 2) * 5;
        const fx = Math.sin(player.yaw), fz = Math.cos(player.yaw);
        const rx = Math.cos(player.yaw), rz = -Math.sin(player.yaw);
        const behind = (player.x - c.x) * fx + (player.z - c.z) * fz;
        const lat = (c.x - player.x) * rx + (c.z - player.z) * rz;
        if (d < 15 && behind > 0) {
          let dy = player.yaw - c.yaw;
          while (dy > Math.PI) dy -= Math.PI * 2;
          while (dy < -Math.PI) dy += Math.PI * 2;
          const steer = clamp(dy * 1.4 + (lane - lat) * 0.12, -1, 1);
          c.step(1, steer, false, dt, colliders, cruisers);
          const top = clamp(pSpeed + (d - slot) * 0.8, 10, policeTop(wanted));
          if (c.speed > top) c.speed = top;
        } else {
          const tx = player.x - fx * slot + rx * lane;
          const tz = player.z - fz * slot + rz * lane;
          steerTo(c, tx, tz, dt, colliders, d < 15 ? Math.max(12, pSpeed + 4) : policeTop(wanted));
        }
        if (d < 6.5 && c.ramCool <= 0) {
          c.ramCool = 1.0;
          player.car.damage(6);
          player.car.speed *= 0.82;
        }
        if (wanted >= 3 && c.pitCool <= 0 && pSpeed > 18) {
          const fx = Math.sin(player.yaw), fz = Math.cos(player.yaw);
          const rx = Math.cos(player.yaw), rz = -Math.sin(player.yaw);
          const relX = c.x - player.x, relZ = c.z - player.z;
          const lat = Math.abs(relX * rx + relZ * rz);
          const lon = Math.abs(relX * fx + relZ * fz);
          if (lat < 3.4 && lon < 5) {
            c.pitCool = 3;
            player.car.speed *= 0.88;
            const s = (relX * rx + relZ * rz) >= 0 ? 1 : -1;
            player.car.x += rx * s * 1.1; player.car.z += rz * s * 1.1;
          }
        }
      } else {
        // Route on the road graph toward the player's node.
        c.repath -= dt;
        if (c.repath <= 0 || !c.path || c.pathIdx >= c.path.length) {
          c.repath = 1.5;
          const from = { i: Math.round(c.x / PITCH), j: Math.round(c.z / PITCH) };
          const to = { i: clamp(Math.round(player.x / PITCH), -GRID_K, GRID_K), j: clamp(Math.round(player.z / PITCH), -GRID_K, GRID_K) };
          c.path = (findPath(from, to) || []).slice(1); // skip the start node we already stand on
          c.pathIdx = 0;
        }
        const wp = c.path[c.pathIdx];
        if (wp) {
          const wd = Math.hypot(wp.x - c.x, wp.z - c.z);
          if (wd < 7) c.pathIdx++;
          else steerTo(c, wp.x, wp.z, dt, colliders, policeTop(wanted));
        } else {
          // No waypoint (e.g. the cruiser is already on the player's
          // node): steer straight at the player instead of freezing.
          steerTo(c, player.x, player.z, dt, colliders, policeTop(wanted));
        }
      }
    }
    // Foot arrest: a cruiser close to a player on foot, held for 1.5 s.
    if (player.onFoot && wanted > 0) {
      const near = cruisers.some(c => !c.dead && dist2(c.x, c.z, player.x, player.z) < 8 * 8);
      if (near) {
        arrestTimer += dt;
        if (arrestTimer > 1.5 && onBusted) { arrestTimer = 0; onBusted(); }
      } else arrestTimer = 0;
    } else arrestTimer = 0;
  }

  function steerTo(c, tx, tz, dt, colliders, top) {
    const dx = tx - c.x, dz = tz - c.z;
    const wantYaw = Math.atan2(dx, dz);
    let dy = wantYaw - c.yaw;
    while (dy > Math.PI) dy -= Math.PI * 2;
    while (dy < -Math.PI) dy += Math.PI * 2;
    const steer = clamp(dy * 1.6, -1, 1);
    c.step(1, steer, false, dt, colliders, cruisers);
    if (c.speed > top) c.speed = top;
  }

  function reset() {
    for (const c of cruisers) c.remove();
    cruisers.length = 0;
    wanted = 0; cleanTimer = 0; arrestTimer = 0; standoff = null;
  }

  // Debug/test hook: place a cruiser exactly (screenshot staging).
  function spawnAt(x, z, yaw, mode) {
    const c = spawnCruiser(x, z);
    c.yaw = yaw; c.group.rotation.y = yaw;
    if (mode) { c.mode = mode; if (mode === 'block') c.blockTimer = 999; }
    return c;
  }

  return {
    get wanted() { return wanted; },
    cruisers, addWanted, setWanted, setStandoff, damageCruiser, update, reset, spawnAt,
  };
}
