// Combat: fists up close, a hitscan pistol once Mara hands one over.
// Three hits disable a cruiser — the pistol is how a sedan driver survives
// a 5-star chase. Shots are resolved against the camera's aim, so what the
// player sees is what they hit.
import { CONFIG } from './config.js';

export class Combat {
  constructor(scene, effects, audio) {
    this.scene = scene;
    this.effects = effects;
    this.audio = audio;
    this.hasGun = false;
    this.ammo = 0;
    this.reloadT = 0;
  }

  reset() {
    this.hasGun = false;
    this.ammo = 0;
    this.reloadT = 0;
  }

  giveGun() {
    this.hasGun = true;
    this.ammo = CONFIG.magSize;
  }

  update(dt, game) {
    if (this.reloadT > 0) {
      this.reloadT -= dt;
      if (this.reloadT <= 0) this.ammo = CONFIG.magSize;
      return;
    }
    const input = game.input;
    if (input.pressed('KeyR') && this.hasGun && this.ammo < CONFIG.magSize) {
      this.reloadT = 1.0;
      return;
    }
    if (input.pressed('KeyF') && !game.player.inCar) this.punch(game);
    if (input.clicked && this.hasGun) this.shoot(game);
  }

  // The shot goes where the camera looks; the nearest cruiser or pedestrian
  // near that line takes the hit.
  shoot(game) {
    if (this.ammo <= 0) {
      this.reloadT = 1.0;
      this.audio.blip(180, 0.05, 'square', 0.05);
      return;
    }
    this.ammo--;
    const rig = game.rig;
    const f = rig.forwardXZ();
    const px = game.player.x;
    const pz = game.player.z;
    const from = { x: px + f.x * 1.2, y: 1.5, z: pz + f.z * 1.2 };
    const to = { x: px + f.x * 70, y: 1.5, z: pz + f.z * 70 };
    let hit = null;
    let hitD = 70;
    for (const e of game.police.cars) {
      if (e.car.disabled) continue;
      const d = this.aimDistance(px, pz, f, e.car.x, e.car.z);
      if (d && d.dist < hitD && d.lateral < 4) { hitD = d.dist; hit = { kind: 'cruiser', entry: e, x: e.car.x, z: e.car.z }; }
    }
    for (const p of game.traffic.peds) {
      if (p.state !== 'walk') continue;
      const d = this.aimDistance(px, pz, f, p.x, p.z);
      if (d && d.dist < hitD && d.lateral < 2.5) { hitD = d.dist; hit = { kind: 'ped', ped: p, x: p.x, z: p.z }; }
    }
    if (hit) {
      to.x = hit.x;
      to.y = 1.2;
      to.z = hit.z;
      this.effects.burst(hit.x, 1.2, hit.z, 0xff5040, 12, 5, 3, 0.6);
      if (hit.kind === 'cruiser') {
        hit.entry.car.hp--;
        if (hit.entry.car.hp <= 0) {
          hit.entry.car.disabled = true;
          game.police.addHeat(5);
          game.hud.toast('Cruiser disabled');
        }
      } else {
        game.traffic.fallPed(hit.ped);
        game.police.addHeat(CONFIG.heatKill);
      }
    }
    this.effects.tracer(from, to);
    this.effects.burst(from.x, from.y, from.z, 0xffe9a0, 4, 2, 1, 0.15, 0);
    this.audio.shot();
  }

  // Distance along the aim line and lateral offset of a point from it.
  aimDistance(px, pz, f, x, z) {
    const dx = x - px;
    const dz = z - pz;
    const along = dx * f.x + dz * f.z;
    if (along < 2 || along > 70) return null;
    const lateral = Math.abs(dx * (-f.z) + dz * f.x);
    return { dist: along, lateral };
  }

  punch(game) {
    const player = game.player;
    const f = game.rig.forwardXZ();
    let best = null;
    let bestD = 2.6;
    for (const p of game.traffic.peds) {
      if (p.state !== 'walk') continue;
      const d = Math.hypot(p.x - player.x, p.z - player.z);
      if (d < bestD) { bestD = d; best = { kind: 'ped', ped: p }; }
    }
    for (const cop of game.police.footCops) {
      if (cop.downT > 0) continue;
      const d = Math.hypot(cop.x - player.x, cop.z - player.z);
      if (d < bestD) { bestD = d; best = { kind: 'cop', cop }; }
    }
    this.audio.punch();
    this.effects.burst(player.x + f.x * 1.4, 1.2, player.z + f.z * 1.4, 0xffffff, 5, 2, 1, 0.3, 0);
    if (!best) return;
    if (best.kind === 'ped') {
      game.traffic.fallPed(best.ped);
      game.police.addHeat(5);
    } else {
      best.cop.downT = 3;
      best.cop.group.rotation.x = -Math.PI / 2;
      setTimeout(() => { best.cop.group.rotation.x = 0; }, 3000);
      game.police.addHeat(10);
    }
  }
}
