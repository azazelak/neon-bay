// Neon Bay v5c — traffic cars and pedestrians.
// Traffic AI NEVER drives the player's stolen car: update() skips every car
// where isTraffic is false. During a vault hold, traffic freezes near the
// player so it cannot shove the parked car out of the hold ring.
import * as THREE from '../vendor/three.module.min.js';
import { CFG } from './config.js';
import { Car } from './vehicles.js';

const NODES = [];
for (let v = CFG.gridMin; v <= CFG.gridMax; v += CFG.roadStep) {
  for (let u = CFG.gridMin; u <= CFG.gridMax; u += CFG.roadStep) NODES.push([u, v]);
}
const nearestNode = (x, z) => {
  const sx = Math.max(-160, Math.min(160, Math.round(x / 40) * 40));
  const sz = Math.max(-160, Math.min(160, Math.round(z / 40) * 40));
  return [sx, sz];
};

export class Traffic {
  constructor(game, rng) {
    this.game = game;
    this.rng = rng;
    this.cars = [];
    this.peds = [];
    const kinds = ['sedan', 'sedan', 'taxi', 'van', 'muscle', 'pickup'];
    for (let i = 0; i < 20; i++) {
      const [nx, nz] = NODES[Math.floor(rng.next() * NODES.length)];
      const car = new Car(game, kinds[i % kinds.length],
        nx + rng.range(-4, 4), nz + rng.range(-4, 4), rng.range(0, Math.PI * 2));
      car.isTraffic = true;
      car.target = this.pickTarget(nx, nz);
      this.cars.push(car);
    }
    const skins = [0xc98a5a, 0x8a5a3a, 0xe8b88a, 0x5a3a2a];
    const shirts = [0xff5a5a, 0x5a8aff, 0xffd23e, 0x7dff5a, 0xffffff, 0xff7a2e];
    for (let i = 0; i < 36; i++) {
      const g = new THREE.Group();
      const h = rng.range(0.92, 1.08);
      const body = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.9 * h, 0.3),
        new THREE.MeshStandardMaterial({ color: shirts[i % shirts.length] }));
      body.position.y = 0.85 * h; g.add(body);
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.22, 8, 8),
        new THREE.MeshStandardMaterial({ color: skins[i % skins.length] }));
      head.position.y = 1.55 * h; g.add(head);
      if (rng.chance(0.3)) {
        const hat = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.28, 0.12, 8),
          new THREE.MeshStandardMaterial({ color: 0x222222 }));
        hat.position.y = 1.75 * h; g.add(hat);
      }
      const legs = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.7 * h, 0.25),
        new THREE.MeshStandardMaterial({ color: [0x222244, 0x333333, 0x5a3a2a][i % 3] }));
      legs.position.y = 0.35 * h; g.add(legs);
      const [nx, nz] = NODES[Math.floor(rng.next() * NODES.length)];
      g.position.set(nx + rng.range(-8, 8), 0, nz + rng.range(-8, 8));
      game.scene.add(g);
      this.peds.push({ mesh: g, x: g.position.x, z: g.position.z, speed: rng.range(1, 2), dir: rng.range(0, Math.PI * 2), h });
    }
  }

  pickTarget(x, z) {
    const [nx, nz] = nearestNode(x, z);
    const opts = [[40, 0], [-40, 0], [0, 40], [0, -40]]
      .map(([dx, dz]) => [nx + dx, nz + dz])
      .filter(([tx, tz]) => Math.abs(tx) <= 160 && Math.abs(tz) <= 160);
    return opts.length ? opts[Math.floor(this.rng.next() * opts.length)] : [nx, nz];
  }

  update(dt) {
    const hold = this.game.missions?.holding;
    const px = this.game.player.pos.x, pz = this.game.player.pos.z;
    for (const car of this.cars) {
      // NEVER drive the player's car or any non-traffic car.
      if (car.disabled || !car.isTraffic) continue;
      if (hold) {
        const d = Math.hypot(car.pos.x - px, car.pos.z - pz);
        if (d < 30) continue; // frozen near the player during a vault hold
      }
      const [tx, tz] = car.target;
      const want = Math.atan2(tx - car.pos.x, tz - car.pos.z);
      let dy = want - car.yaw;
      while (dy > Math.PI) dy -= Math.PI * 2;
      while (dy < -Math.PI) dy += Math.PI * 2;
      const steer = dy > 0.15 ? 1 : dy < -0.15 ? -1 : 0;
      const d = Math.hypot(tx - car.pos.x, tz - car.pos.z);
      if (d < 5) car.target = this.pickTarget(car.pos.x, car.pos.z);
      car.step(dt, { fwd: Math.abs(dy) > 1.2 ? 0.4 : 1, steer, brake: Math.abs(dy) > 1.2 && car.speed > 4 },
        this.game.city.colliders);
    }
    for (const p of this.peds) {
      p.dir += (this.rng.next() - 0.5) * 0.1;
      let nx = p.x + Math.sin(p.dir) * p.speed * dt;
      let nz = p.z + Math.cos(p.dir) * p.speed * dt;
      if (Math.abs(nx) > 170 || Math.abs(nz) > 170) { p.dir += Math.PI; continue; }
      p.x = nx; p.z = nz;
      p.mesh.position.set(nx, 0, nz);
      p.mesh.rotation.y = p.dir;
      p.mesh.position.y = Math.abs(Math.sin(performance.now() / 300 + p.x)) * 0.06;
    }
  }
}
