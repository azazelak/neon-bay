// Neon Bay — cars: box-built bodies, arcade physics, police livery.
// A Car is one mesh group plus speed/heading; the world moves it.

import * as THREE from 'three';
import { CAR_KINDS, clamp } from './config.js';

let carId = 0;

export class Car {
  constructor(scene, kind, color, x = 0, z = 0, heading = 0) {
    this.id = carId++;
    this.kind = kind;
    this.spec = CAR_KINDS[kind];
    this.color = color;
    this.x = x;
    this.z = z;
    this.heading = heading;
    this.speed = 0;
    this.steer = 0;
    this.disabled = false;
    this.hits = 0;
    this.group = new THREE.Group();
    this.buildMesh(scene);
    this.group.position.set(x, 0, z);
    this.group.rotation.y = heading;
    scene.add(this.group);
  }

  buildMesh(scene) {
    const { len, wid } = this.spec;
    const bodyMat = new THREE.MeshLambertMaterial({ color: this.color });
    const darkMat = new THREE.MeshLambertMaterial({ color: 0x1a2028 });
    const glassMat = new THREE.MeshLambertMaterial({ color: 0x2a3a55 });
    const body = new THREE.Mesh(new THREE.BoxGeometry(wid, 0.75, len), bodyMat);
    body.position.y = 0.62;
    this.group.add(body);
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(wid * 0.86, 0.62, len * 0.46), glassMat);
    cabin.position.set(0, 1.28, -len * 0.04);
    this.group.add(cabin);
    // Hood scoop + racing stripe on the muscle car.
    if (this.kind === 'muscle') {
      const scoop = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.22, 0.9), darkMat);
      scoop.position.set(0, 1.06, len * 0.28);
      this.group.add(scoop);
      const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.02, len * 0.98), new THREE.MeshLambertMaterial({ color: 0xffd42a }));
      stripe.position.set(0, 1.0, 0);
      this.group.add(stripe);
    }
    // Pickup bed.
    if (this.kind === 'pickup') {
      const bed = new THREE.Mesh(new THREE.BoxGeometry(wid * 0.8, 0.3, len * 0.34), darkMat);
      bed.position.set(0, 1.05, len * 0.28);
      this.group.add(bed);
    }
    // Wheels.
    const wheelGeo = new THREE.CylinderGeometry(0.36, 0.36, 0.28, 12);
    wheelGeo.rotateZ(Math.PI / 2);
    const wheelMat = new THREE.MeshLambertMaterial({ color: 0x141414 });
    this.wheels = [];
    for (const [wx, wz] of [[-wid / 2, len * 0.32], [wid / 2, len * 0.32], [-wid / 2, -len * 0.32], [wid / 2, -len * 0.32]]) {
      const w = new THREE.Mesh(wheelGeo, wheelMat);
      w.position.set(wx, 0.36, wz);
      this.group.add(w);
      this.wheels.push(w);
    }
    // Headlights (front = -z in local space) and taillights.
    const headMat = new THREE.MeshBasicMaterial({ color: 0xfff2c0 });
    const tailMat = new THREE.MeshBasicMaterial({ color: 0xff2a2a });
    for (const side of [-1, 1]) {
      const h = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.18, 0.1), headMat);
      h.position.set(side * wid * 0.3, 0.62, -len / 2 - 0.02);
      this.group.add(h);
      const t = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.18, 0.1), tailMat);
      t.position.set(side * wid * 0.3, 0.62, len / 2 + 0.02);
      this.group.add(t);
    }
    // Police: white doors + red/blue light bar.
    if (this.kind === 'police') {
      const doorMat = new THREE.MeshLambertMaterial({ color: 0xf0f0f0 });
      for (const side of [-1, 1]) {
        const door = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.6, 1.5), doorMat);
        door.position.set(side * (wid / 2 + 0.02), 0.62, 0);
        this.group.add(door);
      }
      this.barRed = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.18, 0.4), new THREE.MeshBasicMaterial({ color: 0xff2020 }));
      this.barRed.position.set(-0.4, 1.72, -0.1);
      this.group.add(this.barRed);
      this.barBlue = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.18, 0.4), new THREE.MeshBasicMaterial({ color: 0x2050ff }));
      this.barBlue.position.set(0.4, 1.72, -0.1);
      this.group.add(this.barBlue);
    }
  }

  // Arcade step: throttle -1..1, steer -1..1.
  drive(throttle, steer, dt) {
    if (this.disabled) {
      this.speed *= Math.max(0, 1 - dt * 2);
    } else {
      const top = this.spec.top;
      if (throttle > 0) {
        this.speed += this.spec.accel * throttle * dt;
      } else if (throttle < 0) {
        // Brake while moving forward, reverse once nearly stopped.
        if (this.speed > 0.5) this.speed -= 30 * dt;
        else this.speed -= this.spec.accel * 0.7 * dt;
      }
      this.speed = clamp(this.speed, -top * 0.35, top);
      if (Math.abs(throttle) < 0.05) this.speed *= Math.max(0, 1 - dt * 0.6);
    }
    const turn = steer * 2.1 * clamp(Math.abs(this.speed) / 8, 0, 1) * (this.speed >= 0 ? 1 : -1);
    this.heading += turn * dt;
    const fx = -Math.sin(this.heading);
    const fz = -Math.cos(this.heading);
    this.x += fx * this.speed * dt;
    this.z += fz * this.speed * dt;
    this.group.position.set(this.x, 0, this.z);
    this.group.rotation.y = this.heading;
    for (const w of this.wheels) w.rotation.x += this.speed * dt * 2.4;
  }

  // Direct placement (spawns, teleports, shots).
  place(x, z, heading) {
    this.x = x;
    this.z = z;
    this.heading = heading;
    this.speed = 0;
    this.group.position.set(x, 0, z);
    this.group.rotation.y = heading;
  }

  flashLights(time) {
    if (!this.barRed) return;
    const on = Math.sin(time * 9) > 0;
    this.barRed.visible = on;
    this.barBlue.visible = !on;
  }

  remove(scene) { scene.remove(this.group); }
}
