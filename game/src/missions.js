// Neon Bay v5c — the 6-mission story chain.
// complete() always returns to 'idle' so the next mission can start;
// hold stages only progress while the player stays inside the ring.
import * as THREE from '../vendor/three.module.min.js';
import { CFG } from './config.js';

export class Missions {
  constructor(game) {
    this.game = game;
    this.state = 'idle'; // idle | active
    this.index = 0;
    this.stage = 0;
    this.done = [];
    this.storyDone = false;
    this.holding = false; // true while a hold stage is in progress inside the ring
    this.holdLeft = 0;
    this.taxiDone = 0;
    this.objective = 'Press N to start the next job';
    // hold ring + beacon, shown during hold stages and staged shots
    this.ring = new THREE.Mesh(
      new THREE.RingGeometry(10.4, 11, 48),
      new THREE.MeshBasicMaterial({ color: 0xff4fa8, side: THREE.DoubleSide, transparent: true, opacity: 0.85 }),
    );
    this.ring.rotation.x = -Math.PI / 2;
    this.ring.position.y = 0.15;
    this.ring.visible = false;
    game.scene.add(this.ring);
    this.beacon = new THREE.Mesh(
      new THREE.CylinderGeometry(1.2, 1.2, 26, 12, 1, true),
      new THREE.MeshBasicMaterial({ color: 0xff4fa8, transparent: true, opacity: 0.16, side: THREE.DoubleSide }),
    );
    this.beacon.position.y = 13;
    this.beacon.visible = false;
    game.scene.add(this.beacon);
  }

  showRing(x, z) {
    this.ring.position.set(x, 0.15, z);
    this.ring.visible = true;
    this.beacon.position.set(x, 13, z);
    this.beacon.visible = true;
  }

  hideRing() { this.ring.visible = false; this.beacon.visible = false; }

  get current() { return CFG.missions[this.index]; }
  get stageDef() { return this.current?.stages[this.stage]; }

  startNext() {
    if (this.state !== 'idle' || this.storyDone) return false;
    if (this.index >= CFG.missions.length) return false;
    this.state = 'active';
    this.stage = 0;
    this.taxiDone = 0;
    this.game.hud?.toast(`${this.current.name} — ${this.current.client}`, this.current.intro);
    this.game.audio?.cash();
    return true;
  }

  objectiveText() {
    if (this.state !== 'active') {
      return this.storyDone
        ? 'Story complete — Neon Bay is yours'
        : 'Press N to start the next job';
    }
    const s = this.stageDef;
    if (!s) return '';
    if (s.kind === 'hold') return `${s.label} (${Math.ceil(this.holdLeft)}s)`;
    if (s.kind === 'taxi') {
      const f = this.game.side?.fare;
      if (f) return `Taxi Rush — drop the fare at the marker (${this.taxiDone}/3 fares)`;
      return `${s.label} (${this.taxiDone}/3 fares)`;
    }
    return s.label;
  }

  objectiveTarget() {
    if (this.state !== 'active') return null;
    const s = this.stageDef;
    if (!s) return null;
    if (s.kind === 'drive' || s.kind === 'hold') return { x: s.x, z: s.z };
    if (s.kind === 'taxi') {
      const f = this.game.side?.fare;
      return f ? { x: f.tx, z: f.tz } : null;
    }
    return null; // steal
  }

  completeStage() {
    this.stage += 1;
    if (this.stage >= this.current.stages.length) this.completeMission();
  }

  completeMission() {
    const m = this.current;
    this.game.cash += m.pay;
    this.done.push(m.name);
    this.game.hud?.toast(`Job done — ${m.name}`, `+$${m.pay.toLocaleString()} from ${m.client}`);
    this.game.audio?.cash();
    this.state = 'idle';
    this.stage = 0;
    this.holding = false;
    this.hideRing();
    this.index += 1;
    if (this.index >= CFG.missions.length) {
      this.storyDone = true;
      this.game.hud?.toast('STORY COMPLETE', 'Neon Bay is yours, boss.');
    }
  }

  update(dt) {
    // In staged-shot mode the shot sets the objective text itself.
    if (!this.game.shotName) this.objective = this.objectiveText();
    if (this.state !== 'active') { this.holding = false; return; }
    const s = this.stageDef;
    if (!s) return;
    const p = this.game.player;
    if (s.kind === 'steal') {
      if (p.inCar) this.completeStage();
      return;
    }
    if (s.kind === 'drive') {
      const d = Math.hypot(p.pos.x - s.x, p.pos.z - s.z);
      if (d < 8) this.completeStage();
      return;
    }
    if (s.kind === 'hold') {
      this.showRing(s.x, s.z);
      const d = Math.hypot(p.pos.x - s.x, p.pos.z - s.z);
      if (d < 11) {
        if (!this.holding) { this.holding = true; this.holdLeft = s.secs; }
        this.holdLeft -= dt;
        if (this.holdLeft <= 0) {
          this.holding = false;
          this.hideRing();
          // Coral Heist: the heat jumps when the vault hold ends
          if (this.current.name === 'Coral Heist') this.game.police.setWanted(4);
          this.completeStage();
        }
      } else {
        this.holding = false;
        this.holdLeft = s.secs;
      }
      return;
    }
    if (s.kind === 'taxi') {
      if (this.taxiDone >= s.count) this.completeMission();
    }
  }
}
