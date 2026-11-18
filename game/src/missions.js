// Neon Bay — the story: 4 missions for Rico Vega, fixer Mara Solano and
// rival Dante Cross. The machine is idle -> active -> complete() -> idle;
// complete() always returns to idle, the only state update() starts the
// next mission from, so a finished mission can never park the chain.

import * as THREE from 'three';
import { CFG, PLACES } from './config.js';

const STORY = [
  {
    name: 'First Wheels',
    intro: "Mara Solano: Rico. You need wheels before you need a name. Take a car — any car — and bring it to my garage.",
    stages: [
      { label: 'Steal a car — walk up to one and press E', needsCar: true, x: null, z: null },
      { label: "Drive the car to Mara's garage", x: PLACES.garage.x, z: PLACES.garage.z, radius: 10 },
    ],
    reward: 500,
    onDone: 'gun',
  },
  {
    name: 'Bay Run',
    intro: "Mara: Package in the trunk. Three drops down Ocean Drive, fast and quiet. Dante's boys are watching the beach road.",
    stages: [
      { label: 'Pick up the package at the garage', x: PLACES.garage.x, z: PLACES.garage.z, radius: 8 },
      { label: 'Checkpoint 1 of 3 — Ocean Drive', x: -160, z: 320, radius: 10 },
      { label: 'Checkpoint 2 of 3 — Ocean Drive', x: 0, z: 320, radius: 10 },
      { label: 'Checkpoint 3 of 3 — Ocean Drive', x: 160, z: 320, radius: 10 },
    ],
    reward: 1200,
    onDone: 'sports',
  },
  {
    name: 'Neon Nights',
    intro: "Mara: Club Volt is short three crates. Pick them up, run the drops, and don't let Dante Cross buy you off.",
    stages: [
      { label: 'Pick up the crates at Club Volt', x: PLACES.clubVolt.x, z: PLACES.clubVolt.z, radius: 8 },
      { label: 'Drop 1 of 3 — Eastside', x: 280, z: 80, radius: 10 },
      { label: 'Drop 2 of 3 — North End', x: -240, z: -200, radius: 10 },
      { label: 'Drop 3 of 3 — South Beach', x: 80, z: 280, radius: 10 },
    ],
    reward: 2000,
    onDone: null,
  },
  {
    name: 'The Coral Heist',
    intro: "Dante Cross: The Casino Luna vault, Rico. Eight seconds and the money is ours. The whole city's police will be on you — so be faster.",
    stages: [
      { label: 'Get to Casino Luna', x: PLACES.casino.x, z: PLACES.casino.z, radius: 10 },
      { label: 'Hold the vault — stay in the ring', x: PLACES.casino.x, z: PLACES.casino.z, radius: 9, hold: CFG.vaultHoldSeconds },
      { label: 'Escape to the Marina — 4 stars', x: PLACES.marina.x, z: PLACES.marina.z, radius: 12 },
    ],
    reward: 8000,
    onDone: null,
  },
];

export class Missions {
  constructor(scene, hooks) {
    this.scene = scene;
    this.hooks = hooks; // { reward, unlockGun, unlockSports, setWanted, setStandoff, toast, sound }
    this.index = 0;      // next mission to start
    this.state = 'idle'; // idle | active | complete (story done)
    this.stage = 0;
    this.holdTimer = 0;
    this.nextDelay = 0;
    this.started = false; // the game has begun (start screen dismissed)
    // Beacon: a translucent beam + ground ring at the current target.
    this.beacon = new THREE.Group();
    const beam = new THREE.Mesh(
      new THREE.CylinderGeometry(0.9, 1.4, 60, 12, 1, true),
      new THREE.MeshBasicMaterial({ color: 0xffd42a, transparent: true, opacity: 0.18, side: THREE.DoubleSide, depthWrite: false }),
    );
    beam.position.y = 30;
    this.beacon.add(beam);
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(4, 6, 32),
      new THREE.MeshBasicMaterial({ color: 0xffd42a, transparent: true, opacity: 0.7, side: THREE.DoubleSide }),
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.15;
    this.beacon.add(ring);
    this.beacon.visible = false;
    scene.add(this.beacon);
    // Mara: an NPC who stands at the current meeting point.
    this.mara = this.buildMara();
  }

  buildMara() {
    const g = new THREE.Group();
    const dress = new THREE.MeshLambertMaterial({ color: 0xc02a6a });
    const skin = new THREE.MeshLambertMaterial({ color: 0xe0b08a });
    const hair = new THREE.MeshLambertMaterial({ color: 0x1a1a1a });
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.9, 0.3), dress);
    body.position.y = 1.0;
    g.add(body);
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.32, 0.3), skin);
    head.position.y = 1.66;
    g.add(head);
    const hairM = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.18, 0.34), hair);
    hairM.position.y = 1.86;
    g.add(hairM);
    const legL = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.6, 0.2), skin);
    legL.position.set(-0.12, 0.3, 0);
    g.add(legL);
    const legR = legL.clone();
    legR.position.x = 0.12;
    g.add(legR);
    g.position.set(PLACES.garage.x + 4, 0, PLACES.garage.z);
    g.visible = false;
    this.scene.add(g);
    return g;
  }

  get current() { return STORY[this.index] || null; }
  get done() { return this.state === 'complete'; }

  objective() {
    if (this.state === 'complete') return 'Story complete — Neon Bay is yours. Keep exploring.';
    if (!this.started) return 'Press ENTER to start the story.';
    if (this.state === 'idle') return 'Get ready…';
    const m = this.current;
    if (!m) return '';
    const stage = m.stages[this.stage];
    if (stage.hold) {
      const left = Math.max(0, stage.hold - this.holdTimer);
      return `${stage.label} — ${left.toFixed(1)}s`;
    }
    return stage.label;
  }

  beaconTarget() {
    if (this.state !== 'active') return null;
    const stage = this.current.stages[this.stage];
    if (stage.x === null || stage.x === undefined) return null;
    return { x: stage.x, z: stage.z };
  }

  begin() {
    this.started = true;
    this.nextDelay = 0.5;
  }

  startMission(i) {
    this.index = i;
    this.stage = 0;
    this.holdTimer = 0;
    this.state = 'active';
    const m = this.current;
    if (this.hooks.toast) this.hooks.toast(`${m.name} — ${m.intro}`);
    if (this.hooks.sound) this.hooks.sound('mission');
    this.mara.visible = i === 0;
  }

  complete() {
    const m = this.current;
    if (this.hooks.reward) this.hooks.reward(m.reward);
    if (this.hooks.toast) this.hooks.toast(`${m.name} complete — $${m.reward.toLocaleString()} earned.`);
    if (this.hooks.sound) this.hooks.sound('cash');
    if (m.onDone === 'gun' && this.hooks.unlockGun) this.hooks.unlockGun();
    if (m.onDone === 'sports' && this.hooks.unlockSports) this.hooks.unlockSports();
    if (this.hooks.setStandoff) this.hooks.setStandoff(null);
    this.index++;
    this.stage = 0;
    this.holdTimer = 0;
    // THE fix: always return to idle, from which the next mission starts.
    this.state = 'idle';
    this.beacon.visible = false;
    this.mara.visible = false;
    if (this.index >= STORY.length) {
      this.state = 'complete';
      if (this.hooks.toast) this.hooks.toast('Story complete — you own Neon Bay.');
      if (this.hooks.onStoryComplete) this.hooks.onStoryComplete();
    } else {
      this.nextDelay = 1.6;
    }
  }

  update(dt, px, pz, inCar) {
    // A shot can pin the beacon somewhere the mission logic would not.
    if (this.beaconOverride) {
      this.beacon.visible = true;
      this.beacon.position.set(this.beaconOverride.x, 0, this.beaconOverride.z);
      this.beacon.rotation.y += dt * 0.6;
    } else {
      // Beacon follows the current target.
      const target = this.beaconTarget();
      if (target) {
        this.beacon.visible = true;
        this.beacon.position.set(target.x, 0, target.z);
        this.beacon.rotation.y += dt * 0.6;
      } else {
        this.beacon.visible = false;
      }
    }
    if (!this.started) return;
    if (this.state === 'idle') {
      if (this.index < STORY.length) {
        this.nextDelay -= dt;
        if (this.nextDelay <= 0) this.startMission(this.index);
      }
      return;
    }
    if (this.state !== 'active') return;
    const m = this.current;
    const stage = m.stages[this.stage];
    if (!stage) { this.complete(); return; }
    // A stage that only needs the player to be in a car.
    if (stage.needsCar) {
      if (inCar) {
        this.stage++;
        if (this.hooks.toast) this.hooks.toast('Car stolen. Now drive it to the garage.');
      }
      return;
    }
    const d = Math.hypot(px - stage.x, pz - stage.z);
    if (stage.hold) {
      // Vault hold: the timer only runs inside the ring.
      if (d <= stage.radius) {
        this.holdTimer += dt;
        if (this.hooks.setStandoff && !this.standoffOn) {
          this.standoffOn = true;
          this.hooks.setStandoff({ x: stage.x, z: stage.z });
        }
        if (this.holdTimer >= stage.hold) {
          this.standoffOn = false;
          if (this.hooks.setStandoff) this.hooks.setStandoff(null);
          if (this.hooks.setWanted) this.hooks.setWanted(4);
          if (this.hooks.toast) this.hooks.toast('Vault cracked — $8,000. Lose the heat at the Marina!');
          this.stage++;
          this.holdTimer = 0;
        }
      } else {
        this.holdTimer = Math.max(0, this.holdTimer - dt * 0.5);
      }
      return;
    }
    if (d <= stage.radius) {
      this.stage++;
      if (this.stage >= m.stages.length) this.complete();
    }
  }

  // Debug/test: jump straight to a mission.
  debugStart(i) {
    this.started = true;
    this.index = i;
    this.state = 'idle';
    this.nextDelay = 0;
  }
}
