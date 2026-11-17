// Neon Bay — missions and the story. Rico Vega, ex-wheelman, is back in
// Neon Bay and owes Mara Solano, the fixer who runs the night. Four jobs:
// steal a car, run a getaway, deliver the packages, then rob Dante Cross's
// Coral Casino and vanish by boat. Each mission is stages with a beacon,
// an objective line and a timer; finishing one pays cash, raises rep and
// unlocks the next.
import * as THREE from 'three';
import { CFG } from './config.js';

const MISSIONS = [
  {
    id: 'first-wheels',
    title: 'First Wheels',
    contact: 'Mara Solano',
    briefing: 'Rico, you are back in Neon Bay with nothing but the shirt on your back. Steal a car — any car — and bring it to my garage on Marlin Ave. Try not to get the whole city on your tail.',
    stages: [
      { text: 'Steal a car (walk up to one and press E)', type: 'steal' },
      { text: 'Drive the car to Mara\'s garage', type: 'goto', pos: { x: 104, z: 52 }, radius: 7 },
    ],
    reward: 500,
    timeLimit: 0,
  },
  {
    id: 'bay-run',
    title: 'Bay Run',
    contact: 'Mara Solano',
    briefing: 'A package needs to cross town and the cops are already sniffing around. Grab it, then run the checkpoints. They will be waiting — drive like you mean it.',
    stages: [
      { text: 'Pick up the package at the pier warehouse', type: 'goto', pos: { x: 0, z: -156 }, radius: 6 },
      { text: 'Checkpoint 1 of 3 — Ocean Drive', type: 'goto', pos: { x: -156, z: 0 }, radius: 7 },
      { text: 'Checkpoint 2 of 3 — Marlin Ave', type: 'goto', pos: { x: -52, z: 156 }, radius: 7 },
      { text: 'Checkpoint 3 of 3 — reach the safehouse', type: 'goto', pos: { x: 156, z: 104 }, radius: 7 },
    ],
    reward: 1200,
    timeLimit: 180,
    wantedOnStage: { 1: 2 }, // heat the chase after the pickup
  },
  {
    id: 'neon-nights',
    title: 'Neon Nights',
    contact: 'Mara Solano',
    briefing: 'Three drops, three corners of the city, one night. The buyers pay cash and ask no questions. Do not keep them waiting.',
    stages: [
      { text: 'Drop 1 of 3 — Coral Casino corner', type: 'goto', pos: { x: 156, z: -156 }, radius: 6 },
      { text: 'Drop 2 of 3 — the old arcade', type: 'goto', pos: { x: -156, z: -52 }, radius: 6 },
      { text: 'Drop 3 of 3 — the marina', type: 'goto', pos: { x: 52, z: 208 }, radius: 6 },
    ],
    reward: 2000,
    timeLimit: 300,
  },
  {
    id: 'coral-heist',
    title: 'The Coral Heist',
    contact: 'Mara Solano',
    briefing: 'Dante Cross owns this city and he knows it. Tonight we take his casino vault and sail out on the tide. Get in, grab the cash, and do not stop driving until you see the boat.',
    stages: [
      { text: 'Reach the Coral Casino', type: 'goto', pos: { x: 0, z: 52 }, radius: 7 },
      { text: 'Hold the vault — stay inside the marker', type: 'hold', pos: { x: 0, z: 52 }, radius: 7, holdTime: 8 },
      { text: 'Escape to the marina boat — the whole city is coming', type: 'goto', pos: { x: 0, z: 248 }, radius: 8 },
    ],
    reward: 8000,
    timeLimit: 300,
    wantedOnStage: { 2: 4 },
  },
];

export class MissionManager {
  constructor(scene, hooks) {
    this.hooks = hooks; // { onMissionStart, onStage, onMissionComplete, onMissionFailed, onBanner }
    this.missionIndex = -1;
    this.stageIndex = 0;
    this.state = 'idle'; // idle | active | done | failed
    this.timer = 0;
    this.holdT = 0;
    this.missionsDone = 0;
    this.completed = new Set();

    // Beacon: a glowing pillar marking the current objective.
    const geo = new THREE.CylinderGeometry(3, 3, 40, 16, 1, true);
    const mat = new THREE.MeshBasicMaterial({
      color: 0xffe600, transparent: true, opacity: 0.22, side: THREE.DoubleSide, depthWrite: false,
    });
    this.beacon = new THREE.Mesh(geo, mat);
    this.beacon.position.y = 20;
    this.beacon.visible = false;
    scene.add(this.beacon);
    const ringGeo = new THREE.RingGeometry(2.4, 3.2, 24);
    const ringMat = new THREE.MeshBasicMaterial({ color: 0xffe600, transparent: true, opacity: 0.8, side: THREE.DoubleSide });
    this.ring = new THREE.Mesh(ringGeo, ringMat);
    this.ring.rotation.x = -Math.PI / 2;
    this.ring.position.y = 0.15;
    this.ring.visible = false;
    scene.add(this.ring);
    this._pulse = 0;
  }

  get current() {
    return this.missionIndex >= 0 ? MISSIONS[this.missionIndex] : null;
  }

  get stage() {
    const m = this.current;
    return m ? m.stages[this.stageIndex] : null;
  }

  get objectiveText() {
    if (this.state === 'active' && this.stage) return this.stage.text;
    if (this.state === 'idle') return this.missionsDone >= MISSIONS.length ? 'Neon Bay is yours, Rico.' : 'Find the yellow marker to start the next job.';
    if (this.state === 'done') return 'Job done. Find the next marker.';
    return '';
  }

  get markerPos() {
    if (this.state === 'active' && this.stage && this.stage.pos) return this.stage.pos;
    if (this.state === 'idle') return this._nextStartPos();
    return null;
  }

  _nextStartPos() {
    const next = MISSIONS[this.missionsDone];
    if (!next) return null;
    const first = next.stages[0];
    return first.pos || { x: 52, z: -52 }; // mission 1 starts anywhere (steal a car)
  }

  startNext() {
    if (this.missionsDone >= MISSIONS.length) return false;
    this.missionIndex = this.missionsDone;
    this.stageIndex = 0;
    this.state = 'active';
    this.timer = this.current.timeLimit || 0;
    this.holdT = 0;
    this.hooks.onMissionStart(this.current);
    this.hooks.onBanner(this.current.title, `${this.current.contact}: ${this.current.briefing}`);
    return true;
  }

  fail(reason) {
    if (this.state !== 'active') return;
    this.state = 'failed';
    this.hooks.onMissionFailed(this.current, reason);
    this.hooks.onBanner('Job failed', reason);
  }

  complete() {
    const m = this.current;
    this.state = 'done';
    this.missionsDone++;
    this.completed.add(m.id);
    this.beacon.visible = false;
    this.ring.visible = false;
    this.hooks.onMissionComplete(m);
    this.hooks.onBanner('Job complete', `+$${m.reward} — ${m.title}`);
  }

  update(dt, player, game) {
    this._pulse += dt;
    if (this.beacon.visible) {
      const s = 1 + Math.sin(this._pulse * 4) * 0.08;
      this.beacon.scale.set(s, 1, s);
      this.beacon.rotation.y += dt * 0.8;
    }
    if (this.state === 'idle') {
      // Stand at the next job's start marker to begin.
      const pos = this._nextStartPos();
      if (pos) {
        this.beacon.visible = true;
        this.ring.visible = true;
        this.beacon.position.set(pos.x, 20, pos.z);
        this.ring.position.set(pos.x, 0.15, pos.z);
        if (Math.hypot(player.x - pos.x, player.z - pos.z) < 6) this.startNext();
      }
      return;
    }
    if (this.state !== 'active') return;
    const m = this.current;
    const stage = this.stage;
    if (!stage) {
      this.complete();
      return;
    }
    if (m.timeLimit > 0) {
      this.timer -= dt;
      if (this.timer <= 0) {
        this.fail('Out of time — the window closed.');
        return;
      }
    }
    if (stage.type === 'steal') {
      if (player.inCar) this._advance(game);
      return;
    }
    const pos = stage.pos;
    if (!pos) return;
    this.beacon.visible = true;
    this.ring.visible = true;
    this.beacon.position.set(pos.x, 20, pos.z);
    this.ring.position.set(pos.x, 0.15, pos.z);
    const d = Math.hypot(player.x - pos.x, player.z - pos.z);
    if (stage.type === 'goto') {
      if (d < stage.radius) this._advance(game);
    } else if (stage.type === 'hold') {
      if (d < stage.radius) {
        this.holdT += dt;
        if (this.holdT >= stage.holdTime) this._advance(game);
      } else {
        this.holdT = Math.max(0, this.holdT - dt * 2);
      }
    }
  }

  _advance(game) {
    const m = this.current;
    this.stageIndex++;
    this.holdT = 0;
    this.hooks.onStage(m, this.stageIndex);
    if (m.wantedOnStage && m.wantedOnStage[this.stageIndex] !== undefined) {
      game.wanted.heat = m.wantedOnStage[this.stageIndex] * CFG.heatPerStar;
      game.wanted._recalc();
    }
    if (this.stageIndex >= m.stages.length) this.complete();
  }
}

export function missionCount() {
  return MISSIONS.length;
}
