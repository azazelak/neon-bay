// Rico Vega on foot: a simple box-built pedestrian with a walk swing,
// sprint, and a little hop. The player is a circle of radius 0.6 for
// collision; the mesh is only a picture of where that circle is.
import * as THREE from 'three';
import { CONFIG, resolveBuildings } from './config.js';

export class Player {
  constructor(scene) {
    this.scene = scene;
    this.x = 0;
    this.z = 0;
    this.heading = Math.PI;
    this.health = CONFIG.playerHealth;
    this.inCar = null; // the Car Rico drives, or null
    this.vy = 0;
    this.y = 0;
    this.walkPhase = 0;
    this.dead = false;

    this.group = new THREE.Group();
    const jacket = new THREE.MeshLambertMaterial({ color: 0x27355e });
    const jeans = new THREE.MeshLambertMaterial({ color: 0x2e2e38 });
    const skin = new THREE.MeshLambertMaterial({ color: 0xc98a5e });
    const hair = new THREE.MeshLambertMaterial({ color: 0x1a1210 });
    this.torso = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.75, 0.34), jacket);
    this.torso.position.y = 1.15;
    this.group.add(this.torso);
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.42, 0.4), skin);
    head.position.y = 1.78;
    this.group.add(head);
    const hairM = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.16, 0.42), hair);
    hairM.position.y = 2.0;
    this.group.add(hairM);
    this.legL = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.8, 0.26), jeans);
    this.legL.position.set(-0.16, 0.4, 0);
    this.group.add(this.legL);
    this.legR = this.legL.clone();
    this.legR.position.x = 0.16;
    this.group.add(this.legR);
    this.armL = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.65, 0.2), jacket);
    this.armL.position.set(-0.42, 1.15, 0);
    this.group.add(this.armL);
    this.armR = this.armL.clone();
    this.armR.position.x = 0.42;
    this.group.add(this.armR);
    scene.add(this.group);
    this.syncMesh();
  }

  reset(x, z, heading = Math.PI) {
    this.x = x;
    this.z = z;
    this.heading = heading;
    this.health = CONFIG.playerHealth;
    this.inCar = null;
    this.vy = 0;
    this.y = 0;
    this.dead = false;
    this.syncMesh();
  }

  // Camera-relative walking. moveX/moveZ is a unit vector (or zero).
  walk(dt, moveX, moveZ, sprint) {
    const speed = sprint ? CONFIG.playerSprint : CONFIG.playerWalk;
    this.x += moveX * speed * dt;
    this.z += moveZ * speed * dt;
    if (moveX !== 0 || moveZ !== 0) {
      this.heading = Math.atan2(moveX, moveZ);
      this.walkPhase += dt * speed * 1.6;
    }
    resolveBuildings(this, 0.6, this.colliders || []);
    // Hop.
    if (this.y > 0 || this.vy !== 0) {
      this.vy -= 22 * dt;
      this.y += this.vy * dt;
      if (this.y <= 0) { this.y = 0; this.vy = 0; }
    }
    this.syncMesh();
  }

  jump() {
    if (this.y === 0) this.vy = 7;
  }

  takeDamage(n) {
    this.health -= n;
    if (this.health <= 0) {
      this.health = 0;
      this.dead = true;
    }
    return this.dead;
  }

  heal(n) {
    this.health = Math.min(CONFIG.playerHealth, this.health + n);
  }

  syncMesh() {
    this.group.position.set(this.x, this.y, this.z);
    this.group.rotation.y = this.heading;
    const swing = Math.sin(this.walkPhase) * 0.55;
    this.legL.rotation.x = swing;
    this.legR.rotation.x = -swing;
    this.armL.rotation.x = -swing * 0.8;
    this.armR.rotation.x = swing * 0.8;
    this.group.visible = !this.inCar;
  }
}
