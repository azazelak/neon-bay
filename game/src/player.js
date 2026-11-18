// Neon Bay — Rico Vega on foot: walk, sprint, jump, enter and exit cars.

import * as THREE from 'three';
import { CFG, clamp } from './config.js';

export class Player {
  constructor(scene) {
    this.scene = scene;
    this.x = 0;
    this.z = 40;
    this.y = 0;
    this.vy = 0;
    this.heading = 0;
    this.health = CFG.playerHealth;
    this.car = null; // Car the player is driving, or null
    this.group = new THREE.Group();
    // Rico: dark jacket, jeans, cap — built from boxes.
    const jacket = new THREE.MeshLambertMaterial({ color: 0x2a2a3a });
    const jeans = new THREE.MeshLambertMaterial({ color: 0x3a4a6a });
    const skin = new THREE.MeshLambertMaterial({ color: 0xc08a5a });
    const cap = new THREE.MeshLambertMaterial({ color: 0xc02a2a });
    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.78, 0.34), jacket);
    torso.position.y = 1.15;
    this.group.add(torso);
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.36, 0.34), skin);
    head.position.y = 1.76;
    this.group.add(head);
    const hat = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.12, 0.4), cap);
    hat.position.y = 1.98;
    this.group.add(hat);
    this.legL = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.72, 0.26), jeans);
    this.legL.position.set(-0.16, 0.38, 0);
    this.group.add(this.legL);
    this.legR = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.72, 0.26), jeans);
    this.legR.position.set(0.16, 0.38, 0);
    this.group.add(this.legR);
    this.armL = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.66, 0.2), jacket);
    this.armL.position.set(-0.42, 1.18, 0);
    this.group.add(this.armL);
    this.armR = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.66, 0.2), jacket);
    this.armR.position.set(0.42, 1.18, 0);
    this.group.add(this.armR);
    this.group.position.set(this.x, 0, this.z);
    scene.add(this.group);
    this.walkPhase = 0;
  }

  get pos() { return this.car ? { x: this.car.x, z: this.car.z } : { x: this.x, z: this.z }; }
  get speed() { return this.car ? Math.abs(this.car.speed) : 0; }

  place(x, z, heading = 0) {
    this.x = x;
    this.z = z;
    this.heading = heading;
    this.group.position.set(x, 0, z);
    this.group.rotation.y = heading;
  }

  // On-foot step. moveX/moveZ are camera-relative wish directions (-1..1).
  stepOnFoot(moveX, moveZ, sprint, jump, dt, collide) {
    const speed = sprint ? CFG.sprintSpeed : CFG.walkSpeed;
    const mx = moveX * speed;
    const mz = moveZ * speed;
    this.x += mx * dt;
    this.z += mz * dt;
    const hit = collide(this.x, this.z, CFG.playerRadius);
    this.x = hit.x;
    this.z = hit.z;
    if (mx !== 0 || mz !== 0) {
      this.heading = Math.atan2(mx, mz);
      this.walkPhase += dt * speed * 1.6;
      const swing = Math.sin(this.walkPhase) * 0.55;
      this.legL.rotation.x = swing;
      this.legR.rotation.x = -swing;
      this.armL.rotation.x = -swing * 0.8;
      this.armR.rotation.x = swing * 0.8;
    } else {
      this.legL.rotation.x *= 0.8;
      this.legR.rotation.x *= 0.8;
      this.armL.rotation.x *= 0.8;
      this.armR.rotation.x *= 0.8;
    }
    if (jump && this.y === 0) this.vy = CFG.jumpSpeed;
    this.vy -= 22 * dt;
    this.y = Math.max(0, this.y + this.vy * dt);
    if (this.y === 0) this.vy = 0;
    this.group.position.set(this.x, this.y, this.z);
    this.group.rotation.y = this.heading;
  }

  enterCar(car) {
    this.car = car;
    this.group.visible = false;
  }

  exitCar() {
    const car = this.car;
    this.car = null;
    // Step out to the driver's side.
    const side = { x: Math.cos(car.heading), z: -Math.sin(car.heading) };
    this.x = car.x + side.x * 2.2;
    this.z = car.z + side.z * 2.2;
    this.heading = car.heading;
    this.group.visible = true;
    this.group.position.set(this.x, 0, this.z);
    return car;
  }

  damage(amount) {
    this.health = Math.max(0, this.health - amount);
    return this.health <= 0;
  }

  heal(amount) { this.health = Math.min(CFG.playerHealth, this.health + amount); }
}
