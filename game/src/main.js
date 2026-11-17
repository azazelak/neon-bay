// Neon Bay — boot and the one loop. The game moves between menu, playing,
// paused, busted, wasted and story-complete. Fixed 1/60 s steps, several in
// a slow frame, none in a fast one. ?seed=N fixes the city. ?shot=chase|
// street|mission|skyline stages that scene instead of the menu, plays the
// real rules forward, paints twice and sets window.__shotReady.
import * as THREE from 'three';
import { CFG } from './config.js';
import { Input } from './input.js';
import { SoundEngine } from './audio.js';
import { buildCity } from './city.js';
import { createRenderer, createScene, CameraRig } from './render.js';
import { Player } from './player.js';
import { Car, separateCars } from './vehicles.js';
import { TrafficManager } from './traffic.js';
import { WantedSystem, PoliceManager } from './police.js';
import { Combat } from './combat.js';
import { MissionManager } from './missions.js';
import { HUD } from './hud.js';
import { saveGame, loadGame, hasSave } from './save.js';
import { Effects } from './effects.js';
import { setupShot } from './shots.js';

const STEP = 1 / 60;
const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : CFG.seed;

const $ = (id) => document.getElementById(id);

class Game {
  constructor() {
    this.canvas = $('game');
    this.renderer = createRenderer(this.canvas);
    this.scene = createScene();
    this.camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 2000);
    this.rig = new CameraRig(this.camera);
    this.rig.yaw = 0; // opening shot: looking north into downtown
    this.input = new Input(this.canvas);
    this.sound = new SoundEngine();
    this.city = buildCity(this.scene, seed);
    this.effects = new Effects(this.scene);
    this.traffic = new TrafficManager(this.scene, this.city, seed + 7);
    this.wanted = new WantedSystem();
    this.police = new PoliceManager(this.scene, this.city);
    this.player = new Player(this.scene, 0, 156); // mid-avenue, facing downtown
    this.combat = new Combat(this.sound, this.effects, this.wanted, this.traffic, this.police);
    this.hud = new HUD();
    this.extraCars = [];
    this.missions = new MissionManager(this.scene, {
      onMissionStart: (m) => { this.sound.pickup(); },
      onStage: (m, i) => { this.sound.pickup(); },
      onMissionComplete: (m) => this._onMissionComplete(m),
      onMissionFailed: () => { this.sound.busted(); },
      onBanner: (t, s) => this.hud.banner(t, s),
    });
    this.state = 'menu';
    this.cash = 0;
    this.rep = 0;
    this.timeMin = 18 * 60 + 20; // 18:20, golden hour
    this.time = 0;
    this._acc = 0;
    this._last = performance.now();
    this._bustedT = 0;

    window.addEventListener('resize', () => this._resize());
    document.addEventListener('visibilitychange', () => {
      if (document.hidden && this.state === 'playing') this.pause();
    });
    $('btn-new').addEventListener('click', () => this.startGame(false));
    $('btn-continue').addEventListener('click', () => this.startGame(true));
    $('btn-resume').addEventListener('click', () => this.resume());
    $('btn-quit').addEventListener('click', () => {
      this._save();
      this.state = 'menu';
      $('pause').classList.add('hidden');
      $('menu').classList.remove('hidden');
      this.sound.stopMusic();
      this.sound.setSiren(false);
    });
    $('btn-end').addEventListener('click', () => this._afterEnd());
    if (!hasSave()) $('btn-continue').disabled = true;
    this._resize();
  }

  _resize() {
    this.renderer.setSize(window.innerWidth, window.innerHeight, false);
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
  }

  _save() {
    saveGame({
      cash: this.cash,
      rep: this.rep,
      missionsDone: this.missions.missionsDone,
      player: this.player,
      timeMin: this.timeMin,
      hasGun: this.combat.hasGun,
    });
  }

  _load(save) {
    this.cash = save.cash;
    this.rep = save.rep;
    this.timeMin = save.timeMin;
    if (save.hasGun) this.combat.giveGun();
    this.missions.missionsDone = save.missionsDone;
    this.missions.completed = new Set(Array.from({ length: save.missionsDone }, (_, i) => i));
    this.player.respawn(save.playerX, save.playerZ);
  }

  startGame(fromSave) {
    this.sound.ensure();
    this.sound.startMusic();
    if (fromSave) {
      const save = loadGame();
      if (save) this._load(save);
    }
    $('menu').classList.add('hidden');
    $('pause').classList.add('hidden');
    $('end').classList.add('hidden');
    this.state = 'playing';
    this.hud.banner('NEON BAY', 'Rico Vega is back. Find the yellow marker — Mara has work for you.');
  }

  pause() {
    if (this.state !== 'playing') return;
    this.state = 'paused';
    $('pause').classList.remove('hidden');
  }

  resume() {
    $('pause').classList.add('hidden');
    this.state = 'playing';
  }

  _showEnd(title, text, button) {
    this.state = this.state === 'playing' ? 'playing' : this.state;
    $('end-title').textContent = title;
    $('end-text').textContent = text;
    $('btn-end').textContent = button;
    $('end').classList.remove('hidden');
  }

  _clearPolice() {
    for (const car of this.police.cars) this.scene.remove(car.mesh);
    for (const cop of this.police.cops) this.scene.remove(cop.mesh);
    this.police.cars = [];
    this.police.cops = [];
  }

  _busted() {
    if (this.state !== 'playing') return;
    this.state = 'busted';
    const fine = Math.floor(this.cash * 0.1);
    this.cash -= fine;
    this.wanted.clear();
    this._clearPolice();
    this.sound.busted();
    this.sound.setSiren(false);
    this._showEnd('BUSTED', `The N.B.P.D. took you in. Bail cost $${fine}. Mara is not happy.`, 'Back on the street');
  }

  _wasted() {
    if (this.state !== 'playing') return;
    this.state = 'wasted';
    const lost = Math.floor(this.cash * 0.15);
    this.cash -= lost;
    this.wanted.clear();
    this._clearPolice();
    this.sound.busted();
    this.sound.setSiren(false);
    this._showEnd('WASTED', `You woke up at Bay General, $${lost} lighter. The city is still out there.`, 'Get up');
  }

  _afterEnd() {
    $('end').classList.add('hidden');
    if (this.state === 'busted' || this.state === 'wasted') {
      this.player.respawn(52, -156); // Bay General hospital corner
    }
    this.state = 'playing';
  }

  _onMissionComplete(m) {
    this.cash += m.reward;
    this.rep += 1;
    this.sound.missionDone();
    this._save();
    if (m.id === 'first-wheels') {
      this.combat.giveGun();
      this.hud.banner('New gear', 'Mara trusts you with a pistol now. Click or press G to shoot.');
    }
    if (m.id === 'bay-run') {
      // A sports car appears at the marina as Mara's thank-you.
      const car = new Car('sports', 0xff7a1a, -8, 228, Math.PI / 2);
      this.scene.add(car.mesh);
      this.extraCars.push(car);
      this.hud.banner('Unlocked', 'A sports car is waiting at the marina. It is fast. It is yours.');
    }
    if (this.missions.missionsDone >= 4) {
      this.state = 'complete';
      this._showEnd('NEON BAY IS YOURS', 'Dante Cross is finished, the vault is empty and the boat is waiting. Rico Vega owns this city now — keep driving, the streets are still yours.', 'Keep playing');
    }
  }

  // One fixed step of the whole simulation.
  step(dt) {
    this.time += dt;
    this.timeMin += dt * 0.5; // one game minute every two real seconds
    this.city.update(this.time);
    this.rig.addDrag(this.input.dragDX, this.input.dragDY);

    const camF = this.rig.forward();
    this.player.update(dt, this.input, camF, this.city, this.traffic.allCars(), (car) => {
      if (!car._counted) {
        car._counted = true;
        this.wanted.addHeat(CFG.heatStealCar);
        this.traffic.scare(car.x, car.z, 20);
      }
    });

    // Hit-and-run: the player's car vs pedestrians.
    if (this.player.inCar) {
      const car = this.player.currentCar;
      for (const ped of this.traffic.peds) {
        if (ped.dead) continue;
        if (Math.hypot(ped.x - car.x, ped.z - car.z) < 2.1 && Math.abs(car.speed) > 4) {
          ped.health = 0;
          ped.dead = true;
          ped.fallT = 0;
          ped.mesh.rotation.x = -Math.PI / 2;
          ped.mesh.position.y = 0.4;
          this.wanted.addHeat(CFG.heatHitPed);
          this.traffic.scare(ped.x, ped.z, 30);
          this.effects.burst({ x: ped.x, y: 1, z: ped.z }, 0xff4444, 10);
        }
      }
    } else {
      // Traffic can run the player over on foot.
      for (const t of this.traffic.cars) {
        if (Math.hypot(t.car.x - this.player.x, t.car.z - this.player.z) < 1.9 && Math.abs(t.car.speed) > 3) {
          if (this.player.damage(20)) this.hud.damageFlash();
          this.player.x += Math.sin(t.car.heading) * 2;
          this.player.z += Math.cos(t.car.heading) * 2;
        }
      }
    }

    this.traffic.update(dt, this.player, this.wanted.level, this.time);
    const policeNear = this.police.update(dt, this.player, this.wanted, this.time,
      () => this._busted(),
      (dmg) => {
        if (this.player.damage(dmg)) this.hud.damageFlash();
      });
    this.wanted.update(dt, policeNear);
    this.combat.update(dt, this.input, this.player, camF, this.camera.position);
    this.missions.update(dt, this.player, this);
    this.effects.update(dt);

    // Car-car separation (traffic, police, player's ride, parked cars).
    const allCars = [...this.traffic.allCars(), ...this.police.cars, ...this.extraCars];
    separateCars(allCars);

    // Engine hum + sirens.
    const inCar = this.player.inCar;
    const ratio = inCar ? Math.abs(this.player.currentCar.speed) / this.player.currentCar.maxSpeed : 0;
    this.sound.setEngine(ratio, inCar);
    this.sound.setSiren(this.wanted.level > 0);
    if (this.input.pressed('KeyH') && inCar) this.sound.horn();

    // Health regen after 8 seconds without damage.
    if (!this.player.dead && this.player.health < CFG.playerHealth && this.player.invuln <= 0) {
      this.player.heal(dt * 3);
    }
    if (this.player.dead) {
      this._wasted();
      return;
    }
    if (this.input.pressed('Escape') || this.input.pressed('KeyP')) this.pause();

    // Camera follows the player (or their car).
    const target = new THREE.Vector3(this.player.x, this.player.y + 1, this.player.z);
    this.rig.update(dt, target, inCar);

    this.hud.update(dt, {
      health: this.player.health,
      cash: this.cash,
      wanted: this.wanted.level,
      objective: this.missions.objectiveText,
      timeMin: this.timeMin,
      ammo: this.combat.ammo,
      hasGun: this.combat.hasGun,
      rep: this.rep,
      time: this.time,
      city: this.city,
      marker: this.missions.markerPos,
      trafficCars: this.traffic.cars.map((t) => t.car),
      policeCars: this.police.cars,
      player: this.player,
    });
  }

  frame(now) {
    requestAnimationFrame((t) => this.frame(t));
    const dt = Math.min((now - this._last) / 1000, MAX_FRAME);
    this._last = now;
    if (this.state === 'menu') {
      // Slow orbit over the city behind the title screen.
      this.rig.yaw += dt * 0.03;
      this.time += dt;
      this.city.update(this.time);
      this.traffic.update(dt, this.player, 0, this.time);
      this.rig.snapTo(new THREE.Vector3(0, 6, 0), this.rig.yaw, 0.42, 150, 55);
      this.renderer.render(this.scene, this.camera);
      return;
    }
    if (this.state === 'playing') {
      this._acc += dt;
      let n = 0;
      while (this._acc >= STEP && n < 5) {
        this.step(STEP);
        this._acc -= STEP;
        n++;
      }
      if (n === 5) this._acc = 0;
    }
    this.input.endFrame();
    this.renderer.render(this.scene, this.camera);
  }

  run() {
    if (shot) {
      // Deterministic screenshot staging: no menu, no audio, real rules.
      $('menu').classList.add('hidden');
      this.state = 'playing';
      setupShot(this, shot);
      let painted = 0;
      const paint = () => {
        this.renderer.render(this.scene, this.camera);
        painted += 1;
        if (painted < 2) requestAnimationFrame(paint);
        else window.__shotReady = true;
      };
      requestAnimationFrame(paint);
      return;
    }
    requestAnimationFrame((t) => this.frame(t));
  }
}

const game = new Game();
game.run();

// Headless playthrough and debugging hook: state, input injection, systems.
window.__neonBay = {
  game,
  get state() { return game.state; },
  get cash() { return game.cash; },
  get wanted() { return game.wanted.level; },
  get missionsDone() { return game.missions.missionsDone; },
  get health() { return game.player.health; },
  player: game.player,
  input: game.input,
  missions: game.missions,
  traffic: game.traffic,
  police: game.police,
  wantedSystem: game.wanted,
  combat: game.combat,
};
