// Neon Bay — wiring: fixed-step loop, menus, steal/enter/exit, wanted,
// busted/wasted, save, and the headless debug API (window.__neonBay).

import * as THREE from 'three';
import { CFG, PLACES, clamp } from './config.js';
import { Render } from './render.js';
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
import { saveGame, loadGame } from './save.js';
import { applyShot } from './shots.js';

const STEP = 1 / 60;

export class Game {
  constructor() {
    this.canvas = document.getElementById('game-canvas');
    this.render = new Render(this.canvas);
    this.scene = this.render.scene;
    this.city = new City(this.scene);
    this.effects = new Effects(this.scene);
    this.audio = new AudioSys();
    this.input = new Input(this.canvas);
    this.player = new Player(this.scene);
    this.traffic = new Traffic(this.scene, this.city);
    this.police = new Police(this.scene, this.city, this.effects);
    this.combat = new Combat(this.scene, this.effects, this.audio);
    this.tokens = new Tokens(this.scene);
    this.hud = new Hud(document, this.city);
    this.missions = new Missions(this.scene, {
      reward: (amount) => { this.cash += amount; this.rep += 10; this.save(); },
      unlockGun: () => { this.combat.giveGun(); this.gunUnlocked = true; this.hud.toast('Pistol unlocked — click to shoot, R to reload.'); },
      unlockSports: () => { this.sportsUnlocked = true; this.spawnSportsCar(); this.hud.toast('Sports car unlocked — parked at the Marina.'); },
      setWanted: (n) => this.police.setWanted(n),
      setStandoff: (p) => { this.police.standoff = p; },
      toast: (t) => this.hud.toast(t, 6),
      sound: (kind) => { if (kind === 'mission') this.audio.mission(); else if (kind === 'cash') this.audio.cash(); },
      onStoryComplete: () => {
        this.mode = 'complete';
        this.hud.showScreen('complete-screen');
        const el = document.getElementById('final-cash');
        if (el) el.textContent = `$${Math.floor(this.cash).toLocaleString()}`;
      },
    });
    this.cash = 0;
    this.rep = 0;
    this.clock = CFG.startClock;
    this.time = 0;
    this.mode = 'start';
    this.playerCar = null;
    this.sportsUnlocked = false;
    this.gunUnlocked = false;
    this.saveTimer = 0;
    this.restoreSave();
    this.bindButtons();
    this.hud.showScreen('start-screen');
    // Deterministic screenshot mode.
    const params = new URLSearchParams(location.search);
    const shot = params.get('shot');
    if (shot) setTimeout(() => applyShot(this, shot), 150);
    window.__neonBay = this.debugApi();
    this.last = performance.now();
    this.acc = 0;
    const loop = (t) => {
      requestAnimationFrame(loop);
      const dt = Math.min(0.1, (t - this.last) / 1000);
      this.last = t;
      this.acc += dt;
      let n = 0;
      while (this.acc >= STEP && n < 5) {
        this.stepWorld(STEP);
        this.acc -= STEP;
        n++;
      }
      this.render.render();
      this.input.endFrame();
    };
    requestAnimationFrame(loop);
  }

  bindButtons() {
    const bind = (id, fn) => {
      const el = document.getElementById(id);
      if (el) el.addEventListener('click', fn);
    };
    bind('play-btn', () => this.startGame());
    bind('resume-btn', () => this.resume());
    bind('restart-btn', () => this.restartAfterBusted());
    bind('retry-btn', () => this.restartAfterBusted());
    bind('explore-btn', () => { this.mode = 'play'; this.hud.hideScreens(); });
    bind('menu-btn', () => { this.mode = 'start'; this.hud.showScreen('start-screen'); });
  }

  restoreSave() {
    const s = loadGame();
    if (!s) return;
    this.cash = s.cash || 0;
    this.rep = s.rep || 0;
    if (s.missionIndex) this.missions.index = Math.min(s.missionIndex, 4);
    if (s.tokensTaken) this.tokens.setCollected(s.tokensTaken);
    if (s.hasGun) { this.combat.giveGun(); this.gunUnlocked = true; }
    if (s.sportsUnlocked) { this.sportsUnlocked = true; this.spawnSportsCar(); }
  }

  save() {
    saveGame({
      cash: this.cash,
      rep: this.rep,
      missionIndex: this.missions.index,
      tokensTaken: this.tokens.takenIndices(),
      hasGun: this.combat.hasGun,
      sportsUnlocked: this.sportsUnlocked,
    });
  }

  startGame() {
    this.audio.ensure();
    this.mode = 'play';
    this.render.free = false;
    this.hud.hideScreens();
    this.missions.begin();
    this.hud.toast('Neon Bay — steal a car, meet Mara, make your name.', 5);
  }

  resume() {
    this.mode = 'play';
    this.hud.hideScreens();
  }

  restartAfterBusted() {
    this.police.clearAll();
    this.police.setWanted(0);
    this.player.health = CFG.playerHealth;
    if (this.playerCar) {
      this.player.exitCar();
      this.playerCar = null;
    }
    this.player.place(PLACES.start.x, PLACES.start.z, 0);
    this.mode = 'play';
    this.hud.hideScreens();
  }

  spawnPlayerCar(kind, color, x, z, heading) {
    const car = new Car(this.scene, kind, color, x, z, heading);
    this.player.enterCar(car);
    this.playerCar = car;
    return car;
  }

  spawnSportsCar() {
    const car = new Car(this.scene, 'sports', 0xff7a1a, PLACES.sportsSpawn.x, PLACES.sportsSpawn.z, Math.PI / 2);
    this.traffic.parked.push(car);
    car.free = true; // the reward car: taking it is not a crime
    return car;
  }

  // One fixed world step. Runs in play/complete modes; attract mode only
  // moves traffic, the city and the camera.
  stepWorld(dt) {
    this.time += dt;
    this.clock += (dt * 24) / CFG.daySeconds;
    if (this.clock >= 24) this.clock -= 24;
    const input = this.input;
    this.city.update(dt, this.time);
    this.effects.update(dt);
    if (this.mode === 'start') {
      this.traffic.update(dt, null, null);
      if (input.pressed('Enter')) this.startGame();
      const a = this.time * 0.05;
      this.render.setFree(Math.cos(a) * 220, 60, Math.sin(a) * 220, 0, 10, 0);
      return;
    }
    if (this.mode === 'pause' || this.mode === 'busted' || this.mode === 'wasted') return;

    const drag = input.takeDrag();
    const yaw = this.render.yaw;
    // Camera-relative wish direction.
    const fwd = { x: -Math.sin(yaw), z: -Math.cos(yaw) };
    const right = { x: Math.cos(yaw), z: -Math.sin(yaw) };
    let mx = 0;
    let mz = 0;
    if (input.down('KeyW') || input.down('ArrowUp')) { mx += fwd.x; mz += fwd.z; }
    if (input.down('KeyS') || input.down('ArrowDown')) { mx -= fwd.x; mz -= fwd.z; }
    if (input.down('KeyA') || input.down('ArrowLeft')) { mx -= right.x; mz -= right.z; }
    if (input.down('KeyD') || input.down('ArrowRight')) { mx += right.x; mz += right.z; }
    const ml = Math.hypot(mx, mz);
    if (ml > 1) { mx /= ml; mz /= ml; }

    if (input.pressed('Enter') && this.mode === 'play' && this.missions.state === 'idle' && !this.missions.started) {
      this.missions.begin();
    }
    if (input.pressed('Escape')) {
      this.mode = 'pause';
      this.hud.showScreen('pause-screen');
    }

    const p = this.player;
    if (p.car) {
      // Driving: W/S throttle, A/D steer.
      const throttle = (input.down('KeyW') || input.down('ArrowUp') ? 1 : 0) - (input.down('KeyS') || input.down('ArrowDown') ? 1 : 0);
      const steer = (input.down('KeyA') || input.down('ArrowLeft') ? 1 : 0) - (input.down('KeyD') || input.down('ArrowRight') ? 1 : 0);
      const car = p.car;
      car.drive(throttle, steer, dt);
      const hit = this.city.resolveCollision(car.x, car.z, 1.6);
      if (hit.hit) {
        car.x = hit.x;
        car.z = hit.z;
        car.speed *= 0.6;
      }
      car.x = clamp(car.x, -350, 350);
      car.z = clamp(car.z, -350, 470);
      car.group.position.set(car.x, 0, car.z);
      // Shooting from the car window.
      if (input.mouseDown && this.combat.hasGun) this.tryShoot(car);
      this.render.follow(car.x, 1.2, car.z, car.heading, dt, input.dragging, drag.dx, drag.dy);
    } else {
      p.stepOnFoot(mx, mz, input.down('ShiftLeft') || input.down('ShiftRight'), input.pressed('Space'), dt, (x, z, r) => this.city.resolveCollision(x, z, r));
      p.x = clamp(p.x, -350, 350);
      p.z = clamp(p.z, -350, 470);
      p.group.position.set(p.x, p.y, p.z);
      if (input.mouseDown && this.combat.hasGun) this.tryShoot(null);
      if (input.pressed('KeyF')) {
        const hit = this.combat.punch(p.x, p.z, this.render.yaw, this.traffic.peds);
        if (hit) this.police.addWanted(1);
      }
      this.render.follow(p.x, p.y, p.z, p.heading, dt, input.dragging, drag.dx, drag.dy);
    }

    // Enter / exit a car.
    if (input.pressed('KeyE')) {
      if (p.car) {
        const car = p.exitCar();
        this.playerCar = null;
        this.traffic.parked.push(car);
      } else {
        const pos = p.pos;
        const car = this.traffic.nearestCar(pos.x, pos.z, 4);
        if (car) {
          this.traffic.removeCar(car);
          if (!car.free && !car.stolen) {
            car.stolen = true;
            this.police.addWanted(1);
            this.hud.toast('Car stolen — the law noticed.', 3);
          }
          p.enterCar(car);
          this.playerCar = car;
        }
      }
    }
    if (input.pressed('KeyR')) this.combat.reload();

    this.traffic.update(dt, this.playerCar, () => {
      this.police.addWanted(1);
      this.hud.toast('Pedestrian hit — wanted level up.', 3);
    });
    this.police.update(dt, this.time, {
      playerX: p.pos.x,
      playerZ: p.pos.z,
      playerCar: this.playerCar,
      onFoot: !p.car,
      onBusted: () => this.busted(),
    });
    this.missions.update(dt, p.pos.x, p.pos.z, !!p.car);
    this.tokens.update(dt, this.time, p.pos.x, p.pos.z, () => {
      this.cash += CFG.tokenValue;
      this.audio.pickup();
      this.hud.toast(`Neon token +$${CFG.tokenValue}`, 2);
      this.save();
    });
    this.combat.update(dt);

    // Wasted?
    if (p.health <= 0 && this.mode === 'play') {
      this.mode = 'wasted';
      this.audio.busted();
      this.hud.showScreen('wasted-screen');
    }

    // Autosave.
    this.saveTimer += dt;
    if (this.saveTimer > 15) {
      this.saveTimer = 0;
      this.save();
    }

    // HUD + audio.
    const beacon = this.missions.beaconTarget();
    this.hud.update(dt, {
      health: p.health,
      cash: this.cash,
      rep: this.rep,
      clock: this.clock,
      wanted: this.police.wanted,
      tokens: this.tokens.collected,
      objective: this.missions.objective(),
      ammo: this.combat.ammo,
      hasGun: this.combat.hasGun,
      gunUnlocked: this.gunUnlocked,
      reloading: this.combat.reloading > 0,
      speed: p.speed,
      inCar: !!p.car,
      playerX: p.pos.x,
      playerZ: p.pos.z,
      playerHeading: p.car ? p.car.heading : p.heading,
      beacon,
      tokenList: this.tokens.items,
      trafficCars: this.traffic.cars.map((t) => t.car),
      cruisers: this.police.cruisers.map((c) => c.car),
    });
    this.audio.setEngine(p.car ? Math.abs(p.car.speed) / p.car.spec.top : 0, !!p.car);
    this.audio.setSiren(this.police.wanted, this.time);
  }

  tryShoot(fromCar) {
    const p = this.player;
    const ox = p.pos.x;
    const oz = p.pos.z;
    const heading = this.render.yaw;
    const targets = [];
    for (const c of this.police.cruisers) {
      if (!c.car.disabled) targets.push({ x: c.car.x, z: c.car.z, radius: 2.2, cruiser: c.car });
    }
    for (const b of this.police.blockers) targets.push({ x: b.car.x, z: b.car.z, radius: 2.2, cruiser: b.car });
    for (const ped of this.traffic.peds) {
      if (ped.state === 'walk') targets.push({ x: ped.x, z: ped.z, radius: 1, ped });
    }
    const hit = this.combat.shoot(ox, 1.5, oz, heading, targets);
    if (hit) {
      if (hit.cruiser) {
        const disabled = this.police.hitCruiser(hit.cruiser);
        if (disabled) this.hud.toast('Cruiser disabled.', 2);
        else this.hud.toast('Hit on a cruiser.', 1.5);
        this.police.addWanted(1);
      } else if (hit.ped) {
        hit.ped.state = 'down';
        hit.ped.timer = 5;
        this.police.addWanted(1);
      }
    }
  }

  busted() {
    if (this.mode !== 'play') return;
    this.mode = 'busted';
    this.cash = Math.max(0, this.cash - 200);
    this.audio.busted();
    this.hud.showScreen('busted-screen');
    const el = document.getElementById('busted-cash');
    if (el) el.textContent = `$${Math.floor(this.cash).toLocaleString()}`;
  }

  // Run N fixed steps synchronously (shots + headless tests).
  warmup(seconds) {
    const n = Math.round(seconds / STEP);
    for (let i = 0; i < n; i++) this.stepWorld(STEP);
  }

  step(n) {
    for (let i = 0; i < n; i++) this.stepWorld(STEP);
    this.render.render();
  }

  debugApi() {
    const g = this;
    return {
      game: g,
      mode: () => g.mode,
      state: () => ({
        mode: g.mode,
        cash: g.cash,
        rep: g.rep,
        wanted: g.police.wanted,
        health: g.player.health,
        missionIndex: g.missions.index,
        missionState: g.missions.state,
        missionStage: g.missions.stage,
        objective: g.missions.objective(),
        tokens: g.tokens.collected,
        cruisers: g.police.cruisers.length,
        inCar: !!g.player.car,
        playerX: g.player.pos.x,
        playerZ: g.player.pos.z,
        carSpeed: g.player.car ? g.player.car.speed : 0,
      }),
      start: () => g.startGame(),
      press: (code) => g.input.testDown(code),
      release: (code) => g.input.testUp(code),
      click: () => g.input.testClick(),
      mouseDown: (v) => { g.input.mouseDown = v; },
      setWanted: (n) => g.police.setWanted(n),
      teleport: (x, z) => {
        if (g.player.car) g.player.car.place(x, z, g.player.car.heading);
        else g.player.place(x, z, g.player.heading);
      },
      giveCar: (kind, x, z, heading = 0) => {
        const colors = { sports: 0xff7a1a, sedan: 0x3a6ab0, taxi: 0xffc42a };
        return g.spawnPlayerCar(kind, colors[kind] || 0x8a9ab0, x, z, heading);
      },
      startMission: (i) => g.missions.debugStart(i),
      mission: () => g.missions,
      player: () => g.player,
      police: () => g.police,
      step: (n) => g.step(n || 1),
      save: () => g.save(),
    };
  }
}

new Game();
