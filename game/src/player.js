// Neon Bay — the player on foot. WASD moves relative to the camera, Shift
// sprints, Space jumps, E steps into the nearest car (or out of one), F
// throws a punch. A simple stylized character: jacket, head, swinging legs.
// Health, damage and the busted/wasted states live here too.
import * as THREE from 'three';
import { CFG } from './config.js';
import { collideCircle } from './city.js';

export function makePlayerMesh() {
  const group = new THREE.Group();
  const jacket = new THREE.MeshLambertMaterial({ color: 0x0e7d7b });
  const skin = new THREE.MeshLambertMaterial({ color: 0xd9a077 });
  const pants = new THREE.MeshLambertMaterial({ color: 0x1d2436 });
  const hair = new THREE.MeshLambertMaterial({ color: 0x14100c });

  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.85, 0.4), jacket);
  torso.position.y = 1.15;
  group.add(torso);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.26, 12, 10), skin);
  head.position.y = 1.82;
  group.add(head);
  const hairM = new THREE.Mesh(new THREE.SphereGeometry(0.27, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.55), hair);
  hairM.position.y = 1.86;
  group.add(hairM);
  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.75, 0.3), pants);
  legL.position.set(-0.18, 0.38, 0);
  group.add(legL);
  const legR = legL.clone();
  legR.position.x = 0.18;
  group.add(legR);
  const armL = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.7, 0.24), jacket);
  armL.position.set(-0.48, 1.15, 0);
  group.add(armL);
  const armR = armL.clone();
  armR.position.x = 0.48;
  group.add(armR);
  group.userData = { legL, legR, armL, armR, torso };
  return group;
}

export class Player {
  constructor(scene, x, z) {
    this.mesh = makePlayerMesh();
    scene.add(this.mesh);
    this.x = x;
    this.z = z;
    this.y = 0;
    this.vy = 0;
    this.heading = 0;
    this.health = CFG.playerHealth;
    this.invuln = 0;
    this.currentCar = null; // the Car being driven, or null
    this.walkPhase = 0;
    this.moving = false;
    this.dead = false;
    this.syncMesh();
  }

  get radius() {
    return CFG.playerRadius;
  }

  get inCar() {
    return this.currentCar !== null;
  }

  damage(amount) {
    if (this.invuln > 0 || this.dead) return false;
    this.health -= amount;
    this.invuln = 0.6;
    if (this.health <= 0) {
      this.health = 0;
      this.dead = true;
    }
    return true;
  }

  heal(amount) {
    this.health = Math.min(CFG.playerHealth, this.health + amount);
  }

  respawn(x, z) {
    this.x = x;
    this.z = z;
    this.y = 0;
    this.vy = 0;
    this.health = CFG.playerHealth;
    this.dead = false;
    this.invuln = 2;
    if (this.currentCar) {
      this.currentCar.isPlayer = false;
      this.currentCar = null;
    }
    this.mesh.visible = true;
    this.syncMesh();
  }

  enterCar(car) {
    this.currentCar = car;
    car.isPlayer = true;
    car.stolen = true;
    this.mesh.visible = false;
  }

  exitCar() {
    if (!this.currentCar) return;
    const car = this.currentCar;
    car.isPlayer = false;
    this.currentCar = null;
    // Step out on the driver's side.
    const side = { x: Math.cos(car.heading), z: -Math.sin(car.heading) };
    this.x = car.x + side.x * 2.2;
    this.z = car.z + side.z * 2.2;
    this.y = 0;
    this.heading = car.heading;
    this.mesh.visible = true;
    this.syncMesh();
  }

  // On-foot movement. Returns the car the player is driving (if any).
  update(dt, input, camForward, city, cars, onEnterCar) {
    if (this.invuln > 0) this.invuln -= dt;
    if (this.inCar) {
      const car = this.currentCar;
      const axes = input.moveAxes();
      const throttle = axes.y;
      const steer = -axes.x;
      car.drive(dt, throttle, steer, city);
      if (input.pressed('KeyE')) {
        this.exitCar();
      }
      this.x = car.x;
      this.z = car.z;
      this.heading = car.heading;
      return car;
    }

    const axes = input.moveAxes();
    const speed = input.sprint ? CFG.sprintSpeed : CFG.walkSpeed;
    const fx = camForward.x;
    const fz = camForward.z;
    const rx = -fz;
    const rz = fx;
    let mx = fx * axes.y + rx * axes.x;
    let mz = fz * axes.y + rz * axes.x;
    const len = Math.hypot(mx, mz);
    this.moving = len > 0.01;
    if (this.moving) {
      mx /= len;
      mz /= len;
      this.x += mx * speed * dt;
      this.z += mz * speed * dt;
      const targetHeading = Math.atan2(mx, mz);
      let dh = targetHeading - this.heading;
      while (dh > Math.PI) dh -= Math.PI * 2;
      while (dh < -Math.PI) dh += Math.PI * 2;
      this.heading += dh * Math.min(1, dt * 12);
      this.walkPhase += dt * speed * 1.6;
    }
    // Jump + gravity.
    if (input.pressed('Space') && this.y === 0) this.vy = 6.5;
    if (this.y > 0 || this.vy !== 0) {
      this.vy -= 18 * dt;
      this.y += this.vy * dt;
      if (this.y <= 0) {
        this.y = 0;
        this.vy = 0;
      }
    }
    const res = collideCircle(city, this.x, this.z, this.radius);
    this.x = res.x;
    this.z = res.z;
    // Step into the nearest car.
    if (input.pressed('KeyE')) {
      let best = null;
      let bestD = 3.2;
      for (const car of cars) {
        const d = Math.hypot(car.x - this.x, car.z - this.z);
        if (d < bestD) {
          bestD = d;
          best = car;
        }
      }
      if (best) {
        this.enterCar(best);
        if (onEnterCar) onEnterCar(best);
      }
    }
    this.syncMesh();
    return null;
  }

  syncMesh() {
    this.mesh.position.set(this.x, this.y, this.z);
    this.mesh.rotation.y = this.heading;
    const swing = this.moving ? Math.sin(this.walkPhase) * 0.55 : 0;
    const u = this.mesh.userData;
    u.legL.rotation.x = swing;
    u.legR.rotation.x = -swing;
    u.armL.rotation.x = -swing * 0.7;
    u.armR.rotation.x = swing * 0.7;
    // Blink while briefly invulnerable after a hit.
    this.mesh.visible = this.inCar ? false : !(this.invuln > 0 && Math.floor(this.invuln * 10) % 2 === 0);
  }
}
