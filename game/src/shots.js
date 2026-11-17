// Neon Bay — the screenshot scenes behind ?shot=chase|street|mission|
// skyline. Each one sets the real game state (player, cars, wanted level,
// mission) from a fixed seed, then plays the real rules forward for a fixed
// number of steps, so the frame is what a short game really looks like and
// the same seed always gives the same frame. Every shot shows the HUD.
import * as THREE from 'three';
import { Car } from './vehicles.js';

const STEP = 1 / 60;

function placePoliceCar(game, x, z, heading) {
  const car = new Car('police', 0xf2f2f2, x, z, heading);
  game.scene.add(car.mesh);
  game.police.cars.push(car);
  return car;
}

function placePlayerCar(game, kind, color, x, z, heading, speed) {
  const car = new Car(kind, color, x, z, heading);
  car.speed = speed;
  game.scene.add(car.mesh);
  game.extraCars.push(car);
  game.player.enterCar(car);
  car.syncMesh();
  return car;
}

function warmUp(game, seconds, holdW) {
  if (holdW) game.input.testDown('KeyW');
  for (let i = 0; i < Math.round(seconds / STEP); i++) game.step(STEP);
  if (holdW) game.input.testUp('KeyW');
  game.input.endFrame();
}

function hideBanner(game) {
  game.hud._bannerT = 0;
  game.hud.el.banner.classList.remove('show');
}

export function setupShot(game, name) {
  game.state = 'playing';
  game.timeMin = 18 * 60 + 24; // 18:24, sun low, neon on
  const P = game.player;
  const W = game.wanted;
  const cam = game.rig;
  const target = (x, y, z) => new THREE.Vector3(x, y, z);

  if (name === 'chase') {
    // Rico in a sports car down Ocean Drive, three stars, two cruisers
    // closing in behind. The cover shot.
    game.missions.startNext(); // First Wheels: already in a car, so the
    // objective reads "Drive the car to Mara's garage".
    placePlayerCar(game, 'sports', 0xff7a1a, 0, -52, 0, 24);
    W.heat = 60;
    W._recalc();
    // One cruiser ahead, coming at the player head-on (visible in frame),
    // one behind in pursuit. The ahead cruiser starts far enough south that
    // it is still ahead, lights flashing, when the frame is taken.
    placePoliceCar(game, 6, 85, Math.PI);
    placePoliceCar(game, -4, -80, 0);
    cam.snapTo(target(0, 1, -52), Math.PI, 0.3, 12, 4.6);
    warmUp(game, 2.2, true);
    cam.snapTo(target(P.x, 1, P.z), Math.PI, 0.3, 12, 4.6);
    hideBanner(game);
    return;
  }

  if (name === 'mission') {
    // Bay Run, stage two: package in hand, two stars, racing the
    // checkpoint on Ocean Drive with the beacon ahead.
    game.missions.missionsDone = 1;
    game.missions.startNext();
    game.combat.giveGun();
    P.x = 0;
    P.z = -156;
    P.syncMesh();
    warmUp(game, 0.4, false); // walks into the pickup, stage advances, heat hits 2
    placePlayerCar(game, 'sedan', 0x2b6fd6, -190, 0, Math.PI / 2, 20);
    placePoliceCar(game, -212, 0, Math.PI / 2);
    cam.snapTo(target(P.x, 1, P.z), Math.PI / 2 + Math.PI, 0.26, 11, 4.2);
    warmUp(game, 0.7, true); // short: the car closes on the checkpoint, beacon still ahead
    cam.snapTo(target(P.x, 1, P.z), Math.PI / 2 + Math.PI, 0.26, 11, 4.2);
    hideBanner(game);
    return;
  }

  if (name === 'skyline') {
    // Golden hour on the coastal road: the car, the beach, downtown and
    // the sun sinking into the bay behind it all.
    game.missions.startNext();
    placePlayerCar(game, 'sports', 0xe8b93a, 156, 220, -Math.PI / 2, 18);
    W.heat = 20;
    W._recalc();
    placePoliceCar(game, 190, 220, -Math.PI / 2);
    cam.snapTo(target(156, 1, 220), Math.PI / 2, 0.34, 13, 5);
    warmUp(game, 1.6, true);
    cam.snapTo(target(P.x, 1, P.z), Math.PI / 2, 0.34, 13, 5);
    hideBanner(game);
    return;
  }

  // 'street' (and any unknown name): Rico on foot at the downtown
  // crossing, traffic and pedestrians around him, clean record.
  game.missions.startNext(); // objective: "Steal a car (walk up to one and press E)"
  P.x = 2;
  P.z = 8;
  P.heading = 0;
  P.syncMesh();
  // Stage the street: a traffic car rolling through the crossing ahead and
  // a pedestrian on the sidewalk, so the frame shows the living city.
  const t0 = game.traffic.cars[0];
  t0.car.x = 4;
  t0.car.z = -44;
  t0.car.heading = 0;
  t0.car.speed = 8;
  t0.axis = 'z';
  t0.dir = 1;
  t0.waypoint = { x: 4, z: 52 };
  t0.car.syncMesh();
  const p0 = game.traffic.peds[0];
  p0.x = -5;
  p0.z = -14;
  p0.target = { x: -5, z: 30 };
  p0.state = 'walk';
  cam.snapTo(target(2, 1, 8), 0, 0.28, 9.5, 4.4);
  warmUp(game, 1.5, false);
  cam.snapTo(target(P.x, 1, P.z), 0, 0.28, 9.5, 4.4);
  hideBanner(game);
}
