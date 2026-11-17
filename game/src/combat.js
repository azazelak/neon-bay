// Neon Bay — combat. Fists up close, a pistol once Mara trusts you with
// one. Punches knock people down; bullets are hitscan against the nearest
// person or car in the aim cone. Every violent act feeds the wanted system
// and scares the pedestrians nearby.
import * as THREE from 'three';
import { CFG } from './config.js';

export class Combat {
  constructor(sound, effects, wanted, traffic, police) {
    this.sound = sound;
    this.effects = effects;
    this.wanted = wanted;
    this.traffic = traffic;
    this.police = police;
    this.hasGun = false;
    this.ammo = 0;
    this._cooldown = 0;
    this._reloadT = 0;
    this._punchT = 0;
  }

  giveGun() {
    this.hasGun = true;
    this.ammo = CFG.gunMagazine;
  }

  update(dt, input, player, camForward, camPos) {
    this._cooldown -= dt;
    this._punchT -= dt;
    if (this._reloadT > 0) {
      this._reloadT -= dt;
      if (this._reloadT <= 0) this.ammo = CFG.gunMagazine;
      return;
    }
    // Punch: F, short arc in front of the player.
    if (input.pressed('KeyF') && this._punchT <= 0 && !player.inCar) {
      this._punchT = 0.45;
      this.sound.punch();
      this._melee(player, camForward);
    }
    // Shoot: click or G, only with the gun out and the player on foot.
    const wantShoot = (input.clicked || input.pressed('KeyG')) && this.hasGun && !player.inCar;
    if (wantShoot && this._cooldown <= 0) {
      if (this.ammo <= 0) {
        this._reloadT = 1.2;
        return;
      }
      this._cooldown = 0.22;
      this.ammo -= 1;
      this.sound.gunshot();
      this._shoot(player, camForward, camPos);
    }
  }

  _aimDir(player, camForward) {
    // Aim from the camera's forward on the ground plane.
    return { x: camForward.x, z: camForward.z };
  }

  _melee(player, camForward) {
    const dir = this._aimDir(player, camForward);
    const hit = (tx, tz, range) => {
      const dx = tx - player.x;
      const dz = tz - player.z;
      const d = Math.hypot(dx, dz);
      if (d > range) return false;
      const dot = (dx * dir.x + dz * dir.z) / (d || 1);
      return dot > 0.35;
    };
    for (const ped of this.traffic.peds) {
      if (ped.dead) continue;
      if (hit(ped.x, ped.z, CFG.punchRange)) {
        this._hurtPed(ped, CFG.punchDamage, dir);
        return;
      }
    }
    for (const cop of this.police.cops) {
      if (cop.dead) continue;
      if (hit(cop.x, cop.z, CFG.punchRange)) {
        this._hurtCop(cop, CFG.punchDamage);
        return;
      }
    }
  }

  _shoot(player, camForward, camPos) {
    const dir = this._aimDir(player, camForward);
    const ox = player.x;
    const oz = player.z;
    let best = null;
    let bestD = CFG.gunRange;
    let bestKind = null;
    const consider = (tx, tz, kind, ref) => {
      const dx = tx - ox;
      const dz = tz - oz;
      const d = Math.hypot(dx, dz);
      if (d > bestD) return;
      const dot = (dx * dir.x + dz * dir.z) / (d || 1);
      if (dot < 0.93) return; // ~21 degree cone
      bestD = d;
      best = ref;
      bestKind = kind;
    };
    for (const ped of this.traffic.peds) if (!ped.dead) consider(ped.x, ped.z, 'ped', ped);
    for (const cop of this.police.cops) if (!cop.dead) consider(cop.x, cop.z, 'cop', cop);
    for (const car of [...this.traffic.allCars(), ...this.police.cars]) {
      consider(car.x, car.z, 'car', car);
    }
    const muzzle = { x: ox + dir.x * 1.2, y: 1.4, z: oz + dir.z * 1.2 };
    const end = { x: ox + dir.x * bestD, y: 1.2, z: oz + dir.z * bestD };
    this.effects.tracer(muzzle, end);
    this.effects.burst(end, 0xffd27a, 6);
    if (!best) return;
    if (bestKind === 'ped') this._hurtPed(best, CFG.gunDamage, dir);
    else if (bestKind === 'cop') this._hurtCop(best, CFG.gunDamage);
    else if (bestKind === 'car') {
      best.speed *= 0.6;
      this.effects.burst({ x: best.x, y: 1, z: best.z }, 0x888888, 8);
    }
    this.wanted.addHeat(CFG.heatShoot);
    this.traffic.scare(ox, oz, 34);
  }

  _hurtPed(ped, dmg, dir) {
    ped.health -= dmg;
    this.wanted.addHeat(ped.health <= 0 ? CFG.heatHitPed : CFG.heatPunch);
    this.traffic.scare(ped.x, ped.z, 30);
    if (ped.health <= 0) {
      ped.dead = true;
      ped.fallT = 0;
      ped.mesh.rotation.x = -Math.PI / 2;
      ped.mesh.position.y = 0.4;
      this.effects.burst({ x: ped.x, y: 1, z: ped.z }, 0xff4444, 10);
    } else {
      // Shove them away from the punch.
      ped.x += dir.x * 1.2;
      ped.z += dir.z * 1.2;
      ped.state = 'flee';
      ped.fleeFrom = { x: ped.x - dir.x * 5, z: ped.z - dir.z * 5 };
      ped.fleeT = 3;
    }
  }

  _hurtCop(cop, dmg) {
    cop.health -= dmg;
    this.wanted.addHeat(CFG.heatHitCop);
    if (cop.health <= 0) {
      cop.dead = true;
      cop.mesh.rotation.x = -Math.PI / 2;
      cop.mesh.position.y = 0.4;
      this.effects.burst({ x: cop.x, y: 1, z: cop.z }, 0xff4444, 10);
      this.police.removeCop(cop);
    }
  }
}
