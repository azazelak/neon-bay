// Arcade cars: box-built bodies, cabins, spinning wheels, headlights and
// tail lights, a light bar on police cruisers. One class serves the
// player's car, traffic, parked cars and cruisers — the caller drives it
// either through updatePlayer() (keyboard) or by setting x/z/heading
// directly and calling syncMesh().
import * as THREE from 'three';
import { CONFIG } from './config.js';

const bodyGeo = new THREE.BoxGeometry(2, 0.85, 4.4);
const cabinGeo = new THREE.BoxGeometry(1.7, 0.75, 2.2);
const wheelGeo = new THREE.CylinderGeometry(0.42, 0.42, 0.35, 10);
const lightGeo = new THREE.BoxGeometry(0.35, 0.22, 0.1);

export class Car {
  constructor(scene, kind, x, z, heading = 0, color = null) {
    this.scene = scene;
    this.kind = kind;
    this.spec = CONFIG.carKinds[kind];
    this.x = x;
    this.z = z;
    this.heading = heading;
    this.speed = 0;
    this.hp = CONFIG.cruiserHitsToKill; // only cruisers take hits
    this.disabled = false;
    this.driver = null; // 'player' | 'traffic' | null (parked)
    this.steerVis = 0;

    const paint = color ?? this.spec.colors[Math.floor(Math.random() * this.spec.colors.length)];
    this.group = new THREE.Group();
    this.bodyGroup = new THREE.Group();
    this.group.add(this.bodyGroup);
    const paintMat = new THREE.MeshLambertMaterial({ color: paint });
    const glassMat = new THREE.MeshLambertMaterial({ color: 0x10141e });
    const darkMat = new THREE.MeshLambertMaterial({ color: 0x14141a });
    const body = new THREE.Mesh(bodyGeo, paintMat);
    body.position.y = 0.62;
    this.bodyGroup.add(body);
    const cabin = new THREE.Mesh(cabinGeo, glassMat);
    cabin.position.set(0, 1.35, -0.3);
    this.bodyGroup.add(cabin);
    // Bumpers.
    const bumperF = new THREE.Mesh(new THREE.BoxGeometry(2.05, 0.3, 0.25), darkMat);
    bumperF.position.set(0, 0.35, 2.2);
    this.bodyGroup.add(bumperF);
    const bumperB = bumperF.clone();
    bumperB.position.z = -2.2;
    this.bodyGroup.add(bumperB);
    // Headlights (warm) and tail lights (red, emissive).
    const headMat = new THREE.MeshBasicMaterial({ color: 0xfff2b0 });
    const tailMat = new THREE.MeshBasicMaterial({ color: 0xff2a2a });
    for (const sx of [-0.65, 0.65]) {
      const hl = new THREE.Mesh(lightGeo, headMat);
      hl.position.set(sx, 0.72, 2.22);
      this.bodyGroup.add(hl);
      const tl = new THREE.Mesh(lightGeo, tailMat);
      tl.position.set(sx, 0.72, -2.22);
      this.bodyGroup.add(tl);
    }
    // Wheels.
    this.wheels = [];
    for (const [wx, wz] of [[-0.95, 1.45], [0.95, 1.45], [-0.95, -1.45], [0.95, -1.45]]) {
      const wheel = new THREE.Mesh(wheelGeo, darkMat);
      wheel.rotation.z = Math.PI / 2;
      wheel.position.set(wx, 0.42, wz);
      this.group.add(wheel);
      this.wheels.push(wheel);
    }
    // Muscle cars get a hood scoop and a racing stripe; pickups a bed.
    if (kind === 'muscle') {
      const scoop = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.3, 1), darkMat);
      scoop.position.set(0, 1.15, 1.2);
      this.bodyGroup.add(scoop);
    }
    if (kind === 'pickup') {
      const bed = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.5, 1.6), darkMat);
      bed.position.set(0, 1.0, -1.2);
      this.bodyGroup.add(bed);
    }
    // Police light bar: red and blue beacons that flash in turns.
    if (kind === 'police') {
      this.barRed = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.25, 0.5), new THREE.MeshBasicMaterial({ color: 0xff2222 }));
      this.barRed.position.set(-0.45, 1.85, -0.3);
      this.bodyGroup.add(this.barRed);
      this.barBlue = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.25, 0.5), new THREE.MeshBasicMaterial({ color: 0x2266ff }));
      this.barBlue.position.set(0.45, 1.85, -0.3);
      this.bodyGroup.add(this.barBlue);
      // White doors on both sides and the nose, so a cruiser reads as
      // police from any angle at dusk.
      const doorMat = new THREE.MeshBasicMaterial({ color: 0xe8e8e8 });
      const doorF = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 0.5), doorMat);
      doorF.position.set(0, 0.62, 2.21);
      this.bodyGroup.add(doorF);
      for (const sx of [-1.01, 1.01]) {
        const door = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 0.55), doorMat);
        door.position.set(sx, 0.62, 0);
        door.rotation.y = sx > 0 ? Math.PI / 2 : -Math.PI / 2;
        this.bodyGroup.add(door);
      }
    }
    scene.add(this.group);
    this.syncMesh();
  }

  forward() {
    return { x: Math.sin(this.heading), z: Math.cos(this.heading) };
  }

  // Keyboard driving for the player's car. dt is a fixed step.
  updatePlayer(dt, input) {
    if (this.disabled) {
      this.speed *= Math.max(0, 1 - 3 * dt);
    } else {
      const gas = input.isDown('KeyW') || input.isDown('ArrowUp');
      const brake = input.isDown('KeyS') || input.isDown('ArrowDown');
      const steer = (input.isDown('KeyD') || input.isDown('ArrowRight') ? 1 : 0)
        - (input.isDown('KeyA') || input.isDown('ArrowLeft') ? 1 : 0);
      if (gas) this.speed += this.spec.accel * dt;
      if (brake) {
        if (this.speed > 0.5) this.speed -= this.spec.brake * dt;
        else this.speed -= this.spec.accel * 0.55 * dt;
      }
      // Drag and rolling resistance.
      this.speed -= this.speed * 0.35 * dt;
      if (!gas && !brake) this.speed -= Math.sign(this.speed) * Math.min(Math.abs(this.speed), 3 * dt);
      this.speed = Math.max(-8, Math.min(this.spec.maxSpeed, this.speed));
      const turn = steer * 1.9 * dt * Math.max(-1, Math.min(1, this.speed / 10));
      this.heading += turn;
      this.steerVis += (steer - this.steerVis) * Math.min(1, dt * 8);
    }
    const f = this.forward();
    this.x += f.x * this.speed * dt;
    this.z += f.z * this.speed * dt;
    this.syncMesh();
  }

  syncMesh() {
    this.group.position.set(this.x, 0, this.z);
    this.group.rotation.y = this.heading;
    for (const w of this.wheels) w.rotation.x += this.speed * 0.016;
    // Body lean: roll into corners, pitch on acceleration.
    this.bodyGroup.rotation.z = -this.steerVis * Math.min(1, Math.abs(this.speed) / 20) * 0.06;
    this.bodyGroup.rotation.x = -Math.max(-1, Math.min(1, this.speed / 30)) * 0.02;
    if (this.barRed) {
      const on = Math.floor(performance.now() / 180) % 2 === 0;
      this.barRed.material.color.setHex(on ? 0xff2222 : 0x551111);
      this.barBlue.material.color.setHex(on ? 0x112266 : 0x2266ff);
    }
  }

  remove() {
    this.scene.remove(this.group);
  }
}
