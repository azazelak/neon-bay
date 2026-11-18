// Neon Bay v5c — side activities: taxi fares and stunt jumps.
import * as THREE from '../vendor/three.module.min.js';
import { CFG } from './config.js';

export class Side {
  constructor(game, rng) {
    this.game = game;
    this.rng = rng;
    this.fare = null;
    this.faresDone = 0;
    this.jumps = [];
    // 3 stunt ramps at roadside spots
    const spots = [[-40, 40, 0], [80, -40, Math.PI / 2], [0, 120, Math.PI]];
    for (const [x, z, rot] of spots) {
      const ramp = new THREE.Mesh(new THREE.BoxGeometry(6, 1.2, 8),
        new THREE.MeshStandardMaterial({ color: 0xffd23e, roughness: 0.6 }));
      ramp.position.set(x, 0.6, z);
      ramp.rotation.y = rot;
      ramp.rotation.x = 0; // visual wedge: tilt via a second slab
      game.scene.add(ramp);
      const wedge = new THREE.Mesh(new THREE.BoxGeometry(6, 0.3, 8),
        new THREE.MeshStandardMaterial({ color: 0x222222 }));
      wedge.position.set(x, 1.2, z);
      wedge.rotation.y = rot;
      wedge.rotation.z = 0.28;
      game.scene.add(wedge);
      this.jumps.push({ x, z, done: false });
    }
  }

  hailFare() {
    const p = this.game.player;
    if (!p.inCar) return false;
    if (this.fare) return false;
    // destination: a random road node at least 80 m away
    let tx, tz;
    do {
      tx = this.rng.int(-4, 4) * 40;
      tz = this.rng.int(-4, 4) * 40;
    } while (Math.hypot(tx - p.pos.x, tz - p.pos.z) < 80);
    const dist = Math.hypot(tx - p.pos.x, tz - p.pos.z);
    this.fare = { tx, tz, pay: Math.round(CFG.fareBase + dist * CFG.farePerMetre) };
    this.game.hud?.toast('Fare hailed', `Take them to the marker — $${this.fare.pay}`);
    this.game.audio?.blip(880, 0.08);
    return true;
  }

  update(dt) {
    const p = this.game.player;
    if (this.fare && p.inCar) {
      const d = Math.hypot(p.pos.x - this.fare.tx, p.pos.z - this.fare.tz);
      if (d < 8) {
        this.game.cash += this.fare.pay;
        this.faresDone += 1;
        this.game.hud?.toast('Fare complete', `+$${this.fare.pay}`);
        this.game.audio?.cash();
        if (this.game.missions.state === 'active'
          && this.game.missions.stageDef?.kind === 'taxi') {
          this.game.missions.taxiDone += 1;
        }
        this.fare = null;
      }
    }
    // stunt jumps: cross a ramp fast and the car flies
    if (p.inCar && p.car) {
      for (const j of this.jumps) {
        if (j.done) continue;
        const d = Math.hypot(p.car.pos.x - j.x, p.car.pos.z - j.z);
        if (d < 4 && Math.abs(p.car.speed) > 15 && p.car.airY === 0) {
          p.car.airV = 9;
          j.done = true;
          this.game.cash += CFG.jumpValue;
          this.game.hud?.toast('Stunt jump!', `+$${CFG.jumpValue}`);
          this.game.audio?.cash();
        }
      }
    }
  }
}
