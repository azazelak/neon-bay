// Neon Bay v4 — wiring: builds the world, runs the loop, steals cars,
// starts missions, and exposes window.__neonBay for headless tests.
import * as THREE from 'three';
import { PITCH, clamp, angleLerp, TOKEN_COUNT } from './config.js';
import { buildCity } from './city.js';
import { createRenderer, createSky, createCamera, updateCamera as updateCameraFn } from './render.js';
import { Car } from './vehicles.js';
import { Player } from './player.js';
import { createTraffic } from './traffic.js';
import { createPolice } from './police.js';
import { createCombat } from './combat.js';
import { createMissions } from './missions.js';
import { createTokens } from './tokens.js';
import { createSide } from './side.js';
import { createHud } from './hud.js';
import { createEffects } from './effects.js';
import { createAudio } from './audio.js';
import { createInput } from './input.js';
import { saveGame, loadGame, clearSave } from './save.js';
import { stageShot } from './shots.js';

const canvas = document.getElementById('game');
const renderer = createRenderer(canvas);
const scene = new THREE.Scene();
createSky(scene);
const camera = createCamera();
const city = buildCity(scene);
const hud = createHud();
const effects = createEffects(scene);
const audio = createAudio();
const input = createInput(canvas);
const player = new Player(scene);
const traffic = createTraffic(scene, city.colliders, city.lights);
const police = createPolice(scene, city.colliders);
const combat = createCombat();
const tokens = createTokens(scene);
const side = createSide(scene, city.colliders);

let cash = 0, rep = 0;
let screen = 'title'; // title | play | pause | busted | wasted | complete
let frozen = false; // shots freeze the sim after posing
let time = 0;
let camYaw = 0, camPitch = 0.32, camSnap = true;
let playerCar = null;
let sportsCar = null, taxiCar = null;
let smokeTimer = 0;
let muted = false;

const worldCars = [];
for (const c of traffic.cars) worldCars.push(c);
for (const c of traffic.parked) worldCars.push(c);

const missions = createMissions({
  onUnlockPistol: () => { combat.giveGun(); hud.toast('Pistol unlocked — press F or click to shoot'); },
  onSpawnSports: () => {
    sportsCar = new Car(scene, 'sports', 384, 84, Math.PI);
    worldCars.push(sportsCar);
    hud.toast('Sports car waiting at the marina');
  },
  onSpawnTaxi: () => {
    taxiCar = side.spawnTaxi(-192, 228);
    worldCars.push(taxiCar);
    hud.toast('Taxi waiting by the garage');
  },
  onSetWanted: (n) => police.setWanted(n),
  onStandoff: (p) => police.setStandoff(p),
  onMessage: (m) => hud.toast(m),
  onPay: (pay) => {
    cash += pay; rep += 10; audio.cash();
    saveGame({ cash, rep, missionIndex: missions.index, tokens: tokens.collected, hasGun: combat.hasGun, sports: !!sportsCar });
  },
  faresDone: () => side.faresDone,
});

// Mission target beacon: a tall beam + ground ring at the current target.
const beaconBeam = new THREE.Mesh(
  new THREE.CylinderGeometry(1.4, 1.4, 70, 12, 1, true),
  new THREE.MeshBasicMaterial({ color: 0xffd94a, transparent: true, opacity: 0.16, side: THREE.DoubleSide, depthWrite: false }));
const beaconRing = new THREE.Mesh(
  new THREE.RingGeometry(7, 9.5, 32),
  new THREE.MeshBasicMaterial({ color: 0xffd94a, transparent: true, opacity: 0.75, side: THREE.DoubleSide }));
beaconRing.rotation.x = -Math.PI / 2;
scene.add(beaconBeam); scene.add(beaconRing);
beaconBeam.visible = false; beaconRing.visible = false;

function playerPos() {
  return playerCar ? { x: playerCar.x, z: playerCar.z, yaw: playerCar.yaw } : { x: player.x, z: player.z, yaw: player.yaw };
}

function nearestStealable(x, z, maxD) {
  let best = null, bestD = maxD;
  for (const c of worldCars) {
    if (c.dead || c === playerCar) continue;
    if (c.kind.name === 'cruiser') continue; // police cars are locked
    const d = Math.hypot(c.x - x, c.z - z);
    if (d < bestD) { bestD = d; best = c; }
  }
  return best;
}

function enterCar(car) {
  playerCar = car;
  car.stolen = true;
  player.onFoot = false;
  player.hide();
  hud.toast(car.kind.name === 'taxi' ? 'Taxi — fares pay $60–$120' : 'Driving a ' + car.kind.name);
}

function exitCar() {
  if (!playerCar) return;
  const car = playerCar;
  const sx = Math.cos(car.yaw), sz = -Math.sin(car.yaw);
  player.place(car.x + sx * 3, car.z + sz * 3, car.yaw);
  player.onFoot = true;
  player.show();
  playerCar = null;
}

function startGame() {
  screen = 'play';
  hud.hideMenus();
  audio.ensure(); audio.startMusic();
  hud.toast('Neon Bay — press N to start the first mission');
}

function bust() {
  cash = Math.max(0, cash - 200);
  police.reset();
  if (playerCar) { playerCar = null; }
  player.place(48, 60, 0);
  player.onFoot = true; player.show(); player.health = 100;
  screen = 'busted';
  hud.showMenu('busted');
  saveGame({ cash, rep, missionIndex: missions.index, tokens: tokens.collected, hasGun: combat.hasGun, sports: !!sportsCar });
}

function waste() {
  cash = Math.max(0, cash - 200);
  police.reset();
  playerCar = null;
  player.place(48, 60, 0);
  player.onFoot = true; player.show(); player.health = 100;
  screen = 'wasted';
  hud.showMenu('wasted');
}

function stepWorld(dt) {
  // Camera orbit from the mouse.
  camYaw += input.orbitDX * 0.005;
  camPitch = clamp(camPitch + input.orbitDY * 0.003, 0.08, 0.9);

  if (screen === 'title') {
    // Attract mode: the city lives behind the menu.
    traffic.update(dt, time, null, null);
    return;
  }

  // Missions.
  if (input.pressed('KeyN') && missions.state === 'idle' && !missions.complete) missions.start();
  if (input.pressed('KeyM')) { muted = !muted; audio.setMuted(muted); }

  const pos = playerPos();
  if (playerCar) {
    const throttle = input.forward ? 1 : input.back ? -0.7 : 0;
    const steer = (input.left ? 1 : 0) - (input.right ? 1 : 0);
    playerCar.step(throttle, steer, input.brake, dt, city.colliders, worldCars);
    camYaw = angleLerp(camYaw, playerCar.yaw, 1 - Math.exp(-2.2 * dt));
    // Damage smoke.
    if (playerCar.smoke > 0) {
      smokeTimer -= dt;
      if (smokeTimer <= 0) { smokeTimer = 0.1; effects.smoke(playerCar.x, 1.6, playerCar.z); playerCar.smoke -= 0.1; }
    }
    if (playerCar.dead) { waste(); return; }
    if (input.pressed('KeyE')) exitCar();
  } else {
    player.step({
      forward: input.forward, back: input.back, left: input.left, right: input.right,
      run: input.run, jump: input.jump,
    }, dt, city.colliders);
    if (input.pressed('KeyE')) {
      const car = nearestStealable(player.x, player.z, 4.5);
      if (car) enterCar(car);
      else hud.toast('No car close enough to steal');
    }
  }

  // Shooting / punching.
  if (input.shoot) {
    input.consumeShoot();
    if (combat.hasGun) {
      const dir = new THREE.Vector3();
      camera.getWorldDirection(dir);
      const o = playerPos();
      const res = combat.shoot({ x: o.x, z: o.z, dx: dir.x, dz: dir.z }, police);
      if (res.fired) {
        audio.shot();
        effects.tracer(o.x, 1.5, o.z, res.x, 1.5, res.z);
        if (res.hit) {
          effects.burst(res.x, 1.5, res.z, 0xffc233, 10, 6);
          const c = police.cruisers.find(c => !c.dead && Math.hypot(c.x - res.x, c.z - res.z) < 1);
          if (c && c.dead) { rep += 2; hud.toast('Cruiser disabled'); }
        }
      }
    } else if (player.onFoot) {
      const res = combat.punch(player, police);
      if (res.hit) { audio.punch(); effects.burst(res.x, 1.5, res.z, 0xffffff, 6, 4); }
    }
  }
  combat.update(dt);

  traffic.update(dt, time, playerCar, () => { police.addWanted(1); hud.toast('Pedestrian hit — wanted level up'); });
  police.update(dt, time, {
    x: pos.x, z: pos.z, yaw: pos.yaw,
    onFoot: player.onFoot, car: playerCar,
  }, () => bust());
  missions.update(dt, {
    x: pos.x, z: pos.z, inCar: !!playerCar,
    carKind: playerCar ? playerCar.kind.name : '', onFoot: player.onFoot,
    speed: playerCar ? Math.abs(playerCar.speed) : 0,
  });
  side.update(dt, {
    x: pos.x, z: pos.z, inCar: !!playerCar,
    carKind: playerCar ? playerCar.kind.name : '', car: playerCar,
    speed: playerCar ? Math.abs(playerCar.speed) : 0,
    faresAllowed: missions.state === 'idle' || missions.currentName === 'Taxi Rush',
    onFare: (pay) => { cash += pay; rep += 2; audio.cash(); hud.toast('Fare complete +$' + pay); },
    onStunt: (pay) => { cash += pay; rep += 3; audio.cash(); hud.toast('Stunt jump +$' + pay); },
    onMessage: (m) => hud.toast(m),
  });
  tokens.update(dt, time, pos.x, pos.z, () => {
    cash += 50; audio.pickup();
    effects.burst(pos.x, 2, pos.z, 0xff2e88, 8, 5);
    hud.toast('Neon token +$50');
  });
  effects.update(dt);
  audio.update(dt, playerCar ? playerCar.speed : 0, police.wanted);

  // Mission beacon.
  const target = missions.state === 'active' ? missions.stageTarget() : null;
  if (target) {
    beaconBeam.visible = true; beaconRing.visible = true;
    beaconBeam.position.set(target.x, 35, target.z);
    beaconRing.position.set(target.x, 0.25, target.z);
    const s = 1 + Math.sin(time * 3) * 0.12;
    beaconRing.scale.setScalar(s);
  } else {
    beaconBeam.visible = false; beaconRing.visible = false;
  }

  if (missions.complete && screen === 'play') {
    screen = 'complete';
    hud.showMenu('complete');
    document.getElementById('final-cash').textContent = '$' + cash.toLocaleString('en-US');
    clearSave();
  }
}

function updateCamera(dt) {
  const pos = playerPos();
  let focus, dist, height;
  if (screen === 'title') {
    const a = time * 0.05;
    camera.position.set(48 + Math.cos(a) * 90, 42, 48 + Math.sin(a) * 90);
    camera.lookAt(48, 8, 48);
    return;
  }
  if (playerCar) {
    focus = { x: playerCar.x + Math.sin(playerCar.yaw) * 3, y: 1.5, z: playerCar.z + Math.cos(playerCar.yaw) * 3 };
    dist = 13; height = 4.2;
  } else {
    focus = { x: player.x, y: 1.6, z: player.z };
    dist = 9; height = 2.6;
  }
  updateCameraFn(camera, focus, camYaw, camPitch, dist, height, dt, camSnap);
  camSnap = false;
}

function updateHud() {
  const pos = playerPos();
  hud.setCash(cash);
  hud.setRep(rep);
  hud.setTokens(tokens.collected, TOKEN_COUNT);
  hud.setStars(police.wanted);
  hud.setSpeed(playerCar ? Math.abs(playerCar.speed) * 3.6 : 0);
  hud.setAmmo(combat.ammo, combat.hasGun);
  hud.setClock(time);
  hud.setObjective(missions.objectiveText());
  hud.drawMinimap({
    x: pos.x, z: pos.z, yaw: pos.yaw,
    target: missions.state === 'active' ? missions.stageTarget() : null,
    police: police.cruisers.filter(c => !c.dead),
    tokens: tokens.tokens,
    fare: side.phase === 'pickup' ? side.pickup : side.phase === 'ride' ? side.dest : null,
  });
}

function resetWorld() {
  traffic.reset(); police.reset(); tokens.reset(); side.reset();
  cash = 0; rep = 0; time = 0;
  playerCar = null;
  player.health = 100; player.onFoot = true; player.show();
  player.place(48, 60, 0);
  if (sportsCar) { sportsCar.remove(); worldCars.splice(worldCars.indexOf(sportsCar), 1); sportsCar = null; }
  if (taxiCar) { taxiCar.remove(); worldCars.splice(worldCars.indexOf(taxiCar), 1); taxiCar = null; }
  screen = 'play';
  hud.hideMenus();
  frozen = false;
}

const game = {
  scene, camera, renderer, city, player, traffic, police, combat, missions,
  tokens, side, hud, effects, audio, input, worldCars,
  get cash() { return cash; }, set cash(v) { cash = v; },
  get rep() { return rep; }, set rep(v) { rep = v; },
  get screen() { return screen; },
  get frozen() { return frozen; }, set frozen(v) { frozen = v; },
  get playerCar() { return playerCar; }, set playerCar(c) { playerCar = c; },
  get sportsCar() { return sportsCar; },
  get time() { return time; },
  get camYaw() { return camYaw; }, set camYaw(v) { camYaw = v; },
  get camPitch() { return camPitch; }, set camPitch(v) { camPitch = v; },
  setCamSnap() { camSnap = true; },
  startGame, resetWorld, stepWorld, bust, waste,
  enterCar, exitCar,
  spawnSportsCar() {
    if (!sportsCar) { sportsCar = new Car(scene, 'sports', 384, 84, Math.PI); worldCars.push(sportsCar); }
    return sportsCar;
  },
  spawnTaxiCar(x, z) {
    const t = side.spawnTaxi(x, z);
    worldCars.push(t);
    return t;
  },
};

// Shot mode: ?shot=<name>&seed=11 stages a deterministic scene.
const params = new URLSearchParams(location.search);
const shotName = params.get('shot');
if (shotName) {
  screen = 'play';
  hud.hideMenus();
  stageShot(shotName, game);
  frozen = true;
}

// Restore a saved run (progress only; the world resets).
const saved = loadGame();
if (saved && !shotName) {
  cash = saved.cash || 0; rep = saved.rep || 0;
  if (saved.missionIndex) missions.setIndex(saved.missionIndex);
  if (saved.hasGun) combat.giveGun();
  if (saved.sports) game.spawnSportsCar();
}

// Menu buttons.
document.getElementById('btn-start').addEventListener('click', startGame);
document.getElementById('btn-resume').addEventListener('click', () => { screen = 'play'; hud.hideMenus(); });
document.getElementById('btn-busted').addEventListener('click', () => { screen = 'play'; hud.hideMenus(); });
document.getElementById('btn-wasted').addEventListener('click', () => { screen = 'play'; hud.hideMenus(); });
document.getElementById('btn-free').addEventListener('click', () => { screen = 'play'; hud.hideMenus(); });
window.addEventListener('keydown', (e) => {
  if (e.code === 'Enter' && screen === 'title') startGame();
  if ((e.code === 'Escape' || e.code === 'KeyP') && screen === 'play') { screen = 'pause'; hud.showMenu('pause'); }
  else if ((e.code === 'Escape' || e.code === 'KeyP') && screen === 'pause') { screen = 'play'; hud.hideMenus(); }
});

// Test hooks for the headless harness.
window.__neonBay = {
  game,
  start: startGame,
  state() {
    const pos = playerPos();
    return {
      screen, cash, rep, time,
      missionIndex: missions.index, missionState: missions.state, stage: missions.stage,
      objective: missions.objectiveText(), wanted: police.wanted,
      x: pos.x, z: pos.z, yaw: pos.yaw,
      inCar: !!playerCar, carKind: playerCar ? playerCar.kind.name : '',
      speed: playerCar ? playerCar.speed : 0,
      carHp: playerCar ? playerCar.hp : 0, hp: player.health,
      tokens: tokens.collected, faresDone: side.faresDone,
      complete: missions.complete,
      cruisers: police.cruisers.filter(c => !c.dead).length,
      fare: { phase: side.phase, pickup: side.pickup, dest: side.dest, timer: side.timer },
    };
  },
  teleport(x, z, yaw) {
    if (playerCar) {
      playerCar.x = x; playerCar.z = z;
      if (yaw !== undefined) playerCar.yaw = yaw;
      playerCar.speed = 0;
    } else player.place(x, z, yaw);
    camSnap = true;
  },
  startMission: () => missions.start(),
  setWanted: (n) => police.setWanted(n),
  giveGun: () => combat.giveGun(),
  setCash: (n) => { cash = n; },
  setSpeed: (s) => { if (playerCar) playerCar.speed = s; },
  pressKey: (c) => input.testDown(c),
  releaseKey: (c) => input.testUp(c),
  warpToStage() {
    const t = missions.stageTarget();
    if (t) this.teleport(t.x, t.z);
  },
};

let last = performance.now();
function loop(now) {
  requestAnimationFrame(loop);
  const dt = Math.min((now - last) / 1000, 0.05);
  last = now;
  time += dt;
  if (!frozen && screen !== 'pause') stepWorld(dt);
  city.update(dt, time);
  updateCamera(dt);
  renderer.render(scene, camera);
  if (screen !== 'title') updateHud();
  else { hud.setCash(cash); }
}
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});
requestAnimationFrame(loop);
