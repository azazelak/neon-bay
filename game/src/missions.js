// The story: four missions for Rico Vega, a driver working for the fixer
// Mara Solano against the rival Dante Cross. The state machine is
// idle → active → complete() → idle, and complete() is the only way out of
// active — a finished mission can never park the machine in a dead state,
// so the next mission always starts after the short delay.
import * as THREE from 'three';
import { CONFIG } from './config.js';

const DEFS = [
  {
    name: 'First Wheels',
    briefing: 'Mara Solano needs a driver. Meet her at the corner.',
    reward: 500,
    stages: [
      { text: 'Meet Mara at the corner', type: 'meet', x: 0, z: 8, r: 6 },
      { text: 'Steal a car — press E near a parked car', type: 'steal' },
      { text: "Drive the car to Mara's garage", type: 'reach', x: 148, z: -37, r: 12, needCar: true },
    ],
    onComplete(game) {
      game.combat.giveGun();
      game.hud.toast('Mara: nice wheels. Take this pistol — you will need it.');
    },
  },
  {
    name: 'Bay Run',
    briefing: 'A package for the north side. Three checkpoints, no stops.',
    reward: 1200,
    stages: [
      { text: 'Pick up the package at the market', type: 'reach', x: 0, z: -222, r: 8 },
      { text: 'Checkpoint 1 of 3 — Ocean Drive', type: 'reach', x: 148, z: 222, r: 10 },
      { text: 'Checkpoint 2 of 3 — Ocean Drive', type: 'reach', x: -148, z: 222, r: 10 },
      { text: 'Checkpoint 3 of 3 — Ocean Drive', type: 'reach', x: -148, z: -148, r: 10 },
    ],
    onComplete(game) {
      game.sportsUnlocked = true;
      game.spawnSportsCar();
      game.hud.toast('Mara: a sports car is waiting for you at the marina.');
    },
  },
  {
    name: 'Neon Nights',
    briefing: 'Three drops before dawn. The bay never sleeps.',
    reward: 2000,
    stages: [
      { text: 'Pick up the goods at the pier', type: 'reach', x: 37, z: 222, r: 8 },
      { text: 'Drop 1 of 3 — Northside', type: 'reach', x: -222, z: -74, r: 10 },
      { text: 'Drop 2 of 3 — East End', type: 'reach', x: 222, z: 148, r: 10 },
      { text: 'Drop 3 of 3 — South Market', type: 'reach', x: 74, z: -222, r: 10 },
    ],
    onComplete(game) {
      game.hud.toast('Dante Cross is asking questions. One last job, then you are out.');
    },
  },
  {
    name: 'The Coral Heist',
    briefing: 'Casino Luna. Eight seconds in the vault, then run.',
    reward: 8000,
    stages: [
      { text: 'Get to the Casino Luna', type: 'reach', x: 185, z: 148, r: 10 },
      { text: 'Hold the vault — stay in the ring', type: 'hold', x: 185, z: 148, r: CONFIG.holdRadius },
      { text: 'Escape to the marina', type: 'reach', x: -318, z: 222, r: 12 },
    ],
    onComplete(game) {
      game.hud.toast('Rico Vega walks out of Neon Bay $11,700 richer.');
    },
  },
];

export class Missions {
  constructor(scene, game) {
    this.scene = scene;
    this.game = game;
    this.defs = DEFS;
    this.state = 'idle'; // 'idle' | 'active'
    this.current = null;
    this.stageI = 0;
    this.stage = { text: 'Free roam — Neon Bay is yours' };
    this.missionsDone = 0;
    this.idleT = 0;
    this.holdT = 0;

    // The beacon: a light beam and a ground ring over the current target.
    const beamMat = new THREE.MeshBasicMaterial({ color: 0xffd23e, transparent: true, opacity: 0.12, depthWrite: false });
    this.beam = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.9, 60, 12, 1, true), beamMat);
    this.beam.position.y = 30;
    this.beam.visible = false;
    scene.add(this.beam);
    const ringMat = new THREE.MeshBasicMaterial({ color: 0xffd23e, transparent: true, opacity: 0.8, side: THREE.DoubleSide });
    this.ring = new THREE.Mesh(new THREE.RingGeometry(7, 9, 32), ringMat);
    this.ring.rotation.x = -Math.PI / 2;
    this.ring.position.y = 0.15;
    this.ring.visible = false;
    scene.add(this.ring);

    // Mara Solano, waiting at the corner for mission one.
    const g = new THREE.Group();
    const coat = new THREE.MeshLambertMaterial({ color: 0x8a2a6a });
    const skin = new THREE.MeshLambertMaterial({ color: 0xe8b88a });
    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.7, 0.3), coat);
    torso.position.y = 1.1;
    g.add(torso);
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.38, 0.36), skin);
    head.position.y = 1.68;
    g.add(head);
    const hairM = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.3, 0.4), new THREE.MeshLambertMaterial({ color: 0x1a1210 }));
    hairM.position.y = 1.9;
    g.add(hairM);
    g.position.set(0, 0, 8);
    scene.add(g);
    this.mara = g;
  }

  get objectiveText() {
    if (this.state === 'active' && this.current) {
      return `${this.current.name} — ${this.stage.text}`;
    }
    if (this.missionsDone >= 4) return 'Story complete — Neon Bay is yours';
    return 'Free roam — Neon Bay is yours';
  }

  reset() {
    this.state = 'idle';
    this.current = null;
    this.stageI = 0;
    this.stage = { text: 'Free roam — Neon Bay is yours' };
    this.missionsDone = 0;
    this.idleT = 0;
    this.holdT = 0;
    this.beam.visible = false;
    this.ring.visible = false;
    this.mara.visible = true;
  }

  startNext() {
    if (this.missionsDone >= this.defs.length) return;
    this.current = this.defs[this.missionsDone];
    this.stageI = 0;
    this.state = 'active';
    this.holdT = 0;
    this.setStageText();
    this.game.hud.toast(`${this.current.name}: ${this.current.briefing}`);
    if (this.missionsDone === 0) this.mara.visible = true;
  }

  setStageText() {
    const s = this.current.stages[this.stageI];
    this.stage = { text: s.text };
    if (s.x !== undefined) {
      this.beam.position.x = s.x;
      this.beam.position.z = s.z;
      this.ring.position.x = s.x;
      this.ring.position.z = s.z;
      this.ring.scale.setScalar((s.r || 10) / 8);
      this.beam.visible = true;
      this.ring.visible = true;
    } else {
      this.beam.visible = false;
      this.ring.visible = false;
    }
    // The vault hold starts the standoff: heat jumps, police ring the vault.
    if (this.current.name === 'The Coral Heist' && s.type === 'hold') {
      this.game.police.setHeat(60);
      this.game.police.holdPos = { x: s.x, z: s.z };
    }
  }

  advance() {
    this.stageI++;
    if (this.stageI >= this.current.stages.length) {
      this.complete();
      return;
    }
    this.setStageText();
  }

  complete() {
    const def = this.current;
    this.game.cash += def.reward;
    this.game.rep += 25;
    this.game.audio.cash();
    this.game.hud.toast(`${def.name} complete — $${def.reward.toLocaleString()}`);
    if (def.onComplete) def.onComplete(this.game);
    this.missionsDone++;
    this.state = 'idle';
    this.idleT = 0;
    this.holdT = 0;
    this.beam.visible = false;
    this.ring.visible = false;
    if (this.missionsDone === 1) this.mara.visible = false;
    if (this.missionsDone >= this.defs.length) {
      this.game.storyComplete();
    } else {
      this.game.saveGame();
    }
  }

  update(dt) {
    const game = this.game;
    if (this.state === 'idle') {
      if (this.missionsDone < this.defs.length) {
        this.idleT += dt;
        if (this.idleT >= CONFIG.missionDelay) this.startNext();
      }
      return;
    }
    const s = this.current.stages[this.stageI];
    const p = game.player;
    if (s.type === 'steal') {
      if (p.inCar) this.advance();
      return;
    }
    if (s.type === 'hold') {
      const d = Math.hypot(p.x - s.x, p.z - s.z);
      if (d < s.r) {
        this.holdT += dt;
        // The ring shrinks as the hold runs down.
        this.ring.scale.setScalar(((s.r || 10) / 8) * (1 - (this.holdT / CONFIG.holdSeconds) * 0.35));
        if (this.holdT >= CONFIG.holdSeconds) {
          game.police.holdPos = null;
          game.police.setHeat(80); // 4 stars for the escape
          this.advance();
        }
      }
      return;
    }
    // meet / reach
    const d = Math.hypot(p.x - s.x, p.z - s.z);
    if (d < s.r && (!s.needCar || p.inCar)) this.advance();
  }
}
