// Neon Bay — combat: punch up close, hitscan pistol with a 12-round
// magazine and reload. Three hits disable a cruiser.

import * as THREE from 'three';
import { CFG } from './config.js';

export class Combat {
  constructor(scene, effects, audio) {
    this.scene = scene;
    this.effects = effects;
    this.audio = audio;
    this.hasGun = false;
    this.ammo = 0;
    this.reloading = 0;
    this.cooldown = 0;
    this.tracer = null;
  }

  get armed() { return this.hasGun; }

  giveGun() {
    this.hasGun = true;
    this.ammo = CFG.pistolMag;
  }

  update(dt) {
    this.cooldown -= dt;
    if (this.reloading > 0) {
      this.reloading -= dt;
      if (this.reloading <= 0) this.ammo = CFG.pistolMag;
    }
    if (this.tracer) {
      this.tracer.material.opacity -= dt * 3;
      if (this.tracer.material.opacity <= 0) {
        this.scene.remove(this.tracer);
        this.tracer = null;
      }
    }
  }

  reload() {
    if (!this.hasGun || this.ammo === CFG.pistolMag || this.reloading > 0) return;
    this.reloading = 1.1;
    if (this.audio) this.audio.reload();
  }

  // Hitscan shot from (ox, oy, oz) along a heading. Returns what it hit.
  shoot(ox, oy, oz, heading, targets) {
    if (!this.hasGun || this.cooldown > 0 || this.reloading > 0 || this.ammo <= 0) return null;
    this.cooldown = 0.22;
    this.ammo--;
    if (this.audio) this.audio.shot();
    const dx = -Math.sin(heading);
    const dz = -Math.cos(heading);
    const range = CFG.pistolRange;
    const endX = ox + dx * range;
    const endZ = oz + dz * range;
    let best = null;
    let bestT = range;
    for (const t of targets) {
      // Ray vs circle in the ground plane.
      const rx = t.x - ox;
      const rz = t.z - oz;
      const along = rx * dx + rz * dz;
      if (along < 0 || along > range) continue;
      const px = ox + dx * along;
      const pz = oz + dz * along;
      const perp = Math.hypot(t.x - px, t.z - pz);
      if (perp < (t.radius || 2) && along < bestT) {
        bestT = along;
        best = t;
      }
    }
    const hitX = ox + dx * bestT;
    const hitZ = oz + dz * bestT;
    // Tracer line from the muzzle to the hit point.
    const geo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(ox, oy, oz),
      new THREE.Vector3(hitX, 1.2, hitZ),
    ]);
    const mat = new THREE.LineBasicMaterial({ color: 0xffd42a, transparent: true, opacity: 0.9 });
    if (this.tracer) this.scene.remove(this.tracer);
    this.tracer = new THREE.Line(geo, mat);
    this.scene.add(this.tracer);
    if (best) {
      if (this.effects) this.effects.burst(hitX, 1.2, hitZ, 0xff7a2a, 10);
      return best;
    }
    return null;
  }

  // A punch: short range, knocks a pedestrian down.
  punch(px, pz, heading, peds) {
    const dx = -Math.sin(heading);
    const dz = -Math.cos(heading);
    for (const p of peds) {
      if (p.state !== 'walk') continue;
      const rx = p.x - px;
      const rz = p.z - pz;
      const along = rx * dx + rz * dz;
      const perp = Math.hypot(p.x - (px + dx * along), p.z - (pz + dz * along));
      if (along > 0 && along < 2.4 && perp < 1.2) {
        p.state = 'down';
        p.timer = 4;
        if (this.effects) this.effects.burst(p.x, 1.4, p.z, 0xffffff, 6);
        return p;
      }
    }
    return null;
  }
}
