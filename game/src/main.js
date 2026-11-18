// Neon Bay v5c — game wiring: loop, screens, test API (window.__game).
import * as THREE from '../vendor/three.module.min.js';
import { makeRng } from './rng.js';
import { buildCity } from './city.js';
import { Traffic } from './traffic.js';
import { Police } from './police.js';
import { Player } from './player.js';
import { Combat } from './combat.js';
import { Missions } from './missions.js';
import { Side } from './side.js';
import { Tokens } from './tokens.js';
import { AudioSys } from './audio.js';
import { Effects } from './effects.js';
import { SaveSys } from './save.js';
import { Input } from './input.js';
import { HUD } from './hud.js';
import { RenderSys } from './render.js';
import { stageShot } from './shots.js';

export class Game {
  constructor() {
    const params = new URLSearchParams(location.search);
    const seed = parseInt(params.get('seed') || '7', 10) || 7;
    this.rng = makeRng(seed);
    this.scene = new THREE.Scene();
    this.time = 0;
    this.timeScale = 1;
    this.screen = 'start';
    this.cash = 0;
    this.rep = 0;
    this.shotCam = null;
    this.shotName = params.get('shot');
    this.lastHardHitAt = -10;
    this.saveAt = 0;

    this.city = buildCity(this.scene, this.rng);
    this.traffic = new Traffic(this, this.rng);
    this.police = new Police(this, this.rng);
    this.player = new Player(this);
    this.combat = new Combat(this);
    this.missions = new Missions(this);
    this.side = new Side(this, this.rng);
    this.tokens = new Tokens(this, this.rng);
    this.audio = new AudioSys();
    this.effects = new Effects(this);
    this.save = new SaveSys(this);
    this.input = new Input(this);
    this.hud = new HUD(this);
    this.render = new RenderSys(this);

    const saved = this.save.load();
    if (saved) {
      this.cash = saved.cash || 0;
      this.rep = saved.rep || 0;
    }

    this.player.reset(0, 0);
    this.hud.showScreen('NEON BAY', 'An open-world crime game. Steal cars, dodge the law, run the city.',
      'Click to start — WASD move/drive, E steal car, N next job, click shoot');
    if (this.shotName) {
      // staged screenshot: skip the start screen, pose the scene
      this.screen = 'play';
      this.hud.hideScreen();
      stageShot(this, this.shotName);
    }
    window.__game = this.api();
    this.last = performance.now();
    const loop = (now) => {
      const rawDt = Math.min(0.1, (now - this.last) / 1000);
      this.last = now;
      this.tick(rawDt);
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }

  api() {
    return {
      state: () => ({
        screen: this.screen,
        player: { x: this.player.pos.x, z: this.player.pos.z },
        carSpeed: this.player.inCar && this.player.car ? this.player.car.speed : 0,
        yaw: this.player.yaw,
        wanted: this.police.level,
        inCar: this.player.inCar,
        cash: this.cash,
        objective: this.missions.objective,
        missionDone: [...this.missions.done],
        storyDone: this.missions.storyDone,
        tokens: this.tokens.count,
        faresDone: this.side.faresDone,
        fare: this.side.fare,
        police: this.police.cruisers.map((c) => ({
          d: Math.hypot(c.pos.x - this.player.pos.x, c.pos.z - this.player.pos.z),
        })),
      }),
      setTimeScale: (n) => { this.timeScale = n; },
      teleport: (x, z) => {
        this.player.pos.set(x, 0, z);
        if (this.player.inCar && this.player.car) {
          this.player.car.pos.set(x, 0, z);
          this.player.car.mesh.position.set(x, this.player.car.airY, z);
        }
        this.player.mesh.position.set(x, 0, z);
      },
      teleportNearCar: () => {
        let best = null, bestD = 1e9;
        for (const c of this.traffic.cars) {
          const d = Math.hypot(c.pos.x - this.player.pos.x, c.pos.z - this.player.pos.z);
          if (d < bestD) { bestD = d; best = c; }
        }
        if (!best) return false;
        this.player.pos.set(best.pos.x + 2.5, 0, best.pos.z + 2.5);
        this.player.mesh.position.copy(this.player.pos);
        return true;
      },
      hailFare: () => this.side.hailFare(),
      objectiveTarget: () => this.missions.objectiveTarget(),
      setWanted: (n) => this.police.setWanted(n),
    };
  }

  onKey(code) {
    if (code === 'KeyN' && this.screen === 'play') this.missions.startNext();
    else if (code === 'KeyE' && this.screen === 'play') {
      if (this.player.inCar) this.player.exitCar();
      else this.player.enterCar();
    } else if (code === 'KeyR' && this.screen === 'play') this.combat.reload();
    else if (code === 'KeyF' && this.screen === 'play') this.combat.punch();
    else if (code === 'Escape' || code === 'KeyP') {
      if (this.screen === 'play') {
        this.screen = 'pause';
        this.hud.showScreen('PAUSED', 'Neon Bay waits for no one. Except now.', 'Click to resume');
      } else if (this.screen === 'pause') {
        this.screen = 'play';
        this.hud.hideScreen();
      }
    }
  }

  onClick(x, y) {
    if (this.screen === 'start') {
      this.audio.ensure();
      this.screen = 'play';
      this.hud.hideScreen();
      return;
    }
    if (this.screen === 'wasted') {
      this.respawn();
      return;
    }
    if (this.screen === 'pause') {
      this.screen = 'play';
      this.hud.hideScreen();
      return;
    }
    if (this.screen === 'play') this.combat.shoot();
  }

  respawn() {
    this.player.reset(0, 0);
    this.police.setWanted(0);
    this.screen = 'play';
    this.hud.hideScreen();
    this.hud.toast('Back on the streets', 'Stay sharp.');
  }

  onWasted() {
    if (this.screen !== 'play') return;
    this.screen = 'wasted';
    this.hud.showScreen('WASTED', 'The city chewed you up. Your cash stays where it fell — in your pocket, luckily.',
      'Click to get back up');
    this.audio.blip(90, 0.3);
  }

  onHardHit(speed) {
    if (this.time - this.lastHardHitAt < 0.5) return;
    this.lastHardHitAt = this.time;
    const car = this.player.car;
    if (car) {
      car.hp -= 10;
      this.effects.spark(car.pos.x, car.pos.z);
      this.player.damage(3, 'crash');
    }
  }

  tick(rawDt) {
    const dt = rawDt * this.timeScale;
    if (this.screen === 'play') {
      this.time += dt;
      this.player.update(dt, this.input);
      if (!this.shotName) {
        // staged shots freeze traffic and police so the pose holds
        this.traffic.update(dt);
        this.police.update(dt, this.time);
      }
      this.missions.update(dt);
      this.side.update(dt);
      this.tokens.update(dt, this.time);
      this.effects.update(dt);
      this.city.update(dt, this.time);
      this.audio.update(this.player.inCar && this.player.car ? this.player.car.speed : 0, this.police.level);
      if (this.time - this.saveAt > 30) { this.saveAt = this.time; this.save.save(); }
    }
    this.hud.update(rawDt);
    this.render.update(rawDt);
    this.render.render();
  }
}

new Game();
