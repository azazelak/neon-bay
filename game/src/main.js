// Neon Bay — the Game. Wires every system together, runs the fixed-step
// loop, and owns the test surface the headless harness drives
// (window.__neonBay): step(), the player, traffic, police, missions,
// tokens, combat, and the save. Menus pause the simulation; only the
// 'playing' state advances it.
import { CONFIG, resolveBuildings } from './config.js';
import { RenderRig } from './render.js';
import { City } from './city.js';
import { Car } from './vehicles.js';
import { Player } from './player.js';
import { Traffic } from './traffic.js';
import { Police } from './police.js';
import { Combat } from './combat.js';
import { Missions } from './missions.js';
import { Tokens } from './tokens.js';
import { Hud } from './hud.js';
import { Effects } from './effects.js';
import { AudioSys } from './audio.js';
import { Input } from './input.js';
import { SaveSys } from './save.js';
import { setupShot } from './shots.js';
import { Rng } from './rng.js';

const STEP = 1 / 60;

export class Game {
  constructor(canvas) {
    this.rig = new RenderRig(canvas);
    this.city = new City(this.rig.scene, CONFIG.seed);
    this.rng = new Rng(CONFIG.seed + 7);
    this.effects = new Effects(this.rig.scene);
    this.audio = new AudioSys();
    this.player = new Player(this.rig.scene);
    this.player.colliders = this.city.colliders;
    this.traffic = new Traffic(this.rig.scene, this.city, new Rng(CONFIG.seed + 11));
    this.police = new Police(this.rig.scene, this.city, new Rng(CONFIG.seed + 23));
    this.combat = new Combat(this.rig.scene, this.effects, this.audio);
    this.missions = new Missions(this.rig.scene, this);
    this.tokens = new Tokens(this.rig.scene);
    this.hud = new Hud(this);
    this.input = new Input(canvas, this.rig);
    this.save = new SaveSys();

    this.state = 'menu'; // menu | playing | paused | busted | wasted | complete
    this.cash = 0;
    this.rep = 0;
    this.sportsUnlocked = false;
    this.time = 0;
    this.lastDamageT = -100;
    this.freeCam = null;
    this.shotName = new URLSearchParams(window.location.search).get('shot');

    window.__neonBay = this;
    this.toMenu();
    if (this.shotName) setupShot(this, this.shotName);
    this.loop();
  }

  // ---- game flow ----
  startNewGame() {
    this.save.clear();
    this.cash = 0;
    this.rep = 0;
    this.sportsUnlocked = false;
    this.time = 0;
    this.freeCam = null;
    this.police.heat = 0;
    this.police.stars = 0;
    this.police.holdPos = null;
    for (const e of [...this.police.cars]) this.police.removeCruiser(e);
    for (const c of [...this.police.footCops]) this.rig.scene.remove(c.group);
    this.police.footCops = [];
    this.traffic.rebuild();
    this.tokens.reset();
    this.combat.reset();
    this.missions.reset();
    this.player.reset(0, 30, Math.PI);
    this.player.health = CONFIG.playerHealth;
    this.state = 'playing';
    this.hud.hideAll();
    this.audio.startMusic();
    this.missions.startNext();
  }

  continueGame() {
    const data = this.save.load();
    if (!data) return this.startNewGame();
    this.startNewGame();
    this.cash = data.cash || 0;
    this.rep = data.rep || 0;
    this.missions.missionsDone = data.missionsDone || 0;
    if (data.hasGun) this.combat.giveGun();
    if (data.sportsUnlocked) {
      this.sportsUnlocked = true;
      this.spawnSportsCar();
    }
    this.tokens.reset(data.tokens || []);
    // The next mission starts after the usual short delay.
    this.missions.state = 'idle';
    this.missions.idleT = CONFIG.missionDelay;
  }

  toMenu() {
    this.state = 'menu';
    this.hud.showOnly('menu');
    const cont = document.getElementById('btn-continue');
    if (cont) cont.classList.toggle('hidden', !this.save.exists());
  }

  pause() {
    if (this.state !== 'playing') return;
    this.state = 'paused';
    this.hud.showOnly('pause');
  }

  resume() {
    if (this.state !== 'paused') return;
    this.state = 'playing';
    this.hud.hideAll();
  }

  busted() {
    if (this.state !== 'playing') return;
    this.state = 'busted';
    this.saveGame();
    this.audio.update(0, 0);
    this.hud.showOnly('busted');
  }

  wasted() {
    if (this.state !== 'playing') return;
    this.state = 'wasted';
    this.saveGame();
    this.audio.update(0, 0);
    this.hud.showOnly('wasted');
  }

  storyComplete() {
    this.state = 'complete';
    // The heat dies at the marina: free roam continues without a chase.
    this.police.setHeat(0);
    this.hud.el.completeStats.textContent =
      `All four missions done — $${this.cash.toLocaleString()} earned, ${this.tokens.collected} / 12 tokens, REP ${this.rep}.`;
    this.saveGame();
    this.hud.showOnly('complete');
  }

  // Dismiss the story-complete screen and keep playing in free roam.
  resumeFreeRoam() {
    if (this.state !== 'complete') return;
    this.state = 'playing';
    this.hud.hideAll();
  }

  saveGame() {
    this.save.save(this);
  }

  // ---- cars ----
  spawnSportsCar() {
    return this.spawnSportsCarAt(-280, 222, 0);
  }

  spawnSportsCarAt(x, z, heading) {
    const car = new Car(this.rig.scene, 'sports', x, z, heading, 0xff6a00);
    car.driver = null;
    this.traffic.parked.push(car);
    return car;
  }

  putPlayerInCar(car) {
    this.traffic.removeParked(car);
    this.traffic.removeMoving(car);
    car.driver = 'player';
    this.player.inCar = car;
    this.player.x = car.x;
    this.player.z = car.z;
    this.player.syncMesh();
  }

  enterCar() {
    const p = this.player;
    if (p.inCar) {
      // Get out on the driver's side.
      const car = p.inCar;
      const f = car.forward();
      p.x = car.x - f.z * 2.4;
      p.z = car.z + f.x * 2.4;
      p.heading = car.heading;
      p.inCar = null;
      car.driver = null;
      car.speed = 0;
      this.traffic.parked.push(car);
      p.syncMesh();
      return;
    }
    let car = this.traffic.stealNear(p.x, p.z);
    if (!car) {
      const moving = this.traffic.movingNear(p.x, p.z);
      if (moving && Math.abs(moving.speed) < 3) car = moving;
    }
    if (!car) return;
    this.putPlayerInCar(car);
    this.police.addHeat(CONFIG.heatSteal);
    this.hud.toast('Car stolen — the police noticed');
    this.audio.blip(520, 0.1, 'square', 0.06);
  }

  // ---- the fixed step ----
  // The world keeps simulating behind the story-complete screen (free roam
  // continues); every other non-playing state freezes it.
  step(dt) {
    if (this.state !== 'playing' && this.state !== 'complete') return;
    this.time += dt;
    const input = this.input;
    const p = this.player;

    if (this.state === 'playing' && (input.pressed('KeyP') || input.pressed('Escape'))) {
      this.pause();
      input.endStep();
      return;
    }
    if (input.pressed('KeyE')) this.enterCar();
    if (input.pressed('Space') && !p.inCar) p.jump();

    if (p.inCar) {
      const car = p.inCar;
      car.updatePlayer(dt, input);
      resolveBuildings(car, 2.3, this.city.colliders);
      car.x = Math.max(-382, Math.min(333, car.x));
      car.z = Math.max(-333, Math.min(333, car.z));
      p.x = car.x;
      p.z = car.z;
      p.heading = car.heading;
      car.syncMesh();
    } else {
      const fwd = this.rig.forwardXZ();
      const mv = input.moveVector(fwd);
      p.walk(dt, mv.x, mv.z, input.sprint);
      p.x = Math.max(-382, Math.min(333, p.x));
      p.z = Math.max(-333, Math.min(333, p.z));
      p.syncMesh();
    }

    this.traffic.update(dt, this);
    this.police.update(dt, this);
    if (this.state !== 'playing' && this.state !== 'complete') { input.endStep(); return; } // busted mid-step
    this.missions.update(dt);
    this.tokens.update(dt, this);
    this.combat.update(dt, this);
    this.effects.update(dt);
    this.city.update(dt, this.time);

    // Car-car separation: every pair of cars pushes apart.
    this.separateCars();

    // A traffic car that clips Rico on foot knocks him down hard.
    if (!p.inCar) {
      for (const t of this.traffic.cars) {
        if (Math.abs(t.car.speed) < 3) continue;
        if (Math.hypot(t.car.x - p.x, t.car.z - p.z) < 2.4) {
          if (p.takeDamage(12)) { this.wasted(); break; }
          this.lastDamageT = this.time;
          p.x += (p.x - t.car.x) * 0.6;
          p.z += (p.z - t.car.z) * 0.6;
          this.audio.punch();
          break;
        }
      }
    }
    // Slow health regen after a calm stretch.
    if (this.time - this.lastDamageT > 5 && p.health < CONFIG.playerHealth && !p.dead) {
      p.heal(2 * dt);
    }

    // Camera.
    const focus = p.inCar
      ? { x: p.inCar.x, y: 1, z: p.inCar.z }
      : { x: p.x, y: 1, z: p.z };
    const heading = p.inCar ? p.inCar.heading : p.heading;
    this.rig.updateCamera(dt, focus, heading, !!p.inCar);
    if (this.freeCam) {
      this.rig.camera.position.set(this.freeCam.pos.x, this.freeCam.pos.y, this.freeCam.pos.z);
      this.rig.camera.lookAt(this.freeCam.look.x, this.freeCam.look.y, this.freeCam.look.z);
    }

    // Sound follows speed and wanted level.
    const speed01 = p.inCar ? Math.abs(p.inCar.speed) / 44 : 0;
    this.audio.update(speed01, this.police.stars);
    this.hud.update();
    input.endStep();
  }

  separateCars() {
    const all = [];
    if (this.player.inCar) all.push(this.player.inCar);
    for (const t of this.traffic.cars) all.push(t.car);
    for (const e of this.police.cars) all.push(e.car);
    for (const c of this.traffic.parked) all.push(c);
    for (let i = 0; i < all.length; i++) {
      for (let j = i + 1; j < all.length; j++) {
        const a = all[i];
        const b = all[j];
        const dx = b.x - a.x;
        const dz = b.z - a.z;
        const d = Math.hypot(dx, dz);
        if (d >= 4.4 || d < 0.01) continue;
        const push = (4.4 - d) / 2;
        const nx = dx / d;
        const nz = dz / d;
        const aParked = this.traffic.parked.includes(a) || a.disabled;
        const bParked = this.traffic.parked.includes(b) || b.disabled;
        if (!aParked) { a.x -= nx * (bParked ? push * 2 : push); a.z -= nz * (bParked ? push * 2 : push); }
        if (!bParked) { b.x += nx * (aParked ? push * 2 : push); b.z += nz * (aParked ? push * 2 : push); }
        a.syncMesh();
        b.syncMesh();
      }
    }
  }

  // requestAnimationFrame loop with a fixed-step accumulator.
  loop() {
    let last = performance.now();
    let acc = 0;
    const frame = (now) => {
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      acc += dt;
      let n = 0;
      while (acc >= STEP && n < 5) {
        this.step(STEP);
        acc -= STEP;
        n++;
      }
      if (this.state === 'playing' || this.state === 'menu') {
        // Keep the menu backdrop alive: the city renders behind it.
        if (this.state === 'menu') this.city.update(dt, this.time + dt);
        this.rig.render();
      } else {
        this.rig.render();
      }
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  }
}
