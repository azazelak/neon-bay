// Neon Bay v4 — combat: fists and a hitscan pistol. The pistol holds 12
// rounds, reloads in 1.2 s, and takes 3 hits to disable a cruiser. Punching
// works up close on foot. Both return an event the effects and audio modules
// can play from.
import { clamp } from './config.js';

export function createCombat() {
  let hasGun = false;
  let ammo = 0;
  let reloading = 0;
  let punchCool = 0;

  function update(dt) {
    if (reloading > 0) {
      reloading -= dt;
      if (reloading <= 0) ammo = 12;
    }
    punchCool -= dt;
  }

  function shoot(aim, police) {
    if (!hasGun || reloading > 0 || ammo <= 0) return { fired: false };
    ammo--;
    if (ammo === 0) reloading = 1.2;
    // Nearest cruiser inside the aim cone.
    let best = null, bestD = 60;
    for (const c of police.cruisers) {
      if (c.dead) continue;
      const dx = c.x - aim.x, dz = c.z - aim.z;
      const d = Math.hypot(dx, dz);
      if (d > 60 || d > bestD) continue;
      const dot = (dx * aim.dx + dz * aim.dz) / (d || 1);
      if (dot > 0.985) { best = c; bestD = d; }
    }
    if (best) {
      police.damageCruiser(best, 1);
      return { fired: true, hit: true, x: best.x, z: best.z, dist: bestD };
    }
    return { fired: true, hit: false, x: aim.x + aim.dx * 55, z: aim.z + aim.dz * 55, dist: 55 };
  }

  function punch(player, police) {
    if (punchCool > 0) return { hit: false };
    punchCool = 0.45;
    for (const c of police.cruisers) {
      if (c.dead) continue;
      const d = Math.hypot(c.x - player.x, c.z - player.z);
      if (d < 3) {
        police.damageCruiser(c, 1);
        return { hit: true, x: c.x, z: c.z };
      }
    }
    return { hit: false };
  }

  return {
    get hasGun() { return hasGun; },
    get ammo() { return ammo; },
    get reloading() { return reloading > 0; },
    giveGun() { hasGun = true; ammo = 12; },
    update, shoot, punch,
  };
}
