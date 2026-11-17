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

function placeParkedCar(game, kind, color, x, z, heading) {
  const car = new Car(kind, color, x, z, heading);
  game.scene.add(car.mesh);
  game.extraCars.push(car);
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
    // Rico in a sports car down Ocean Drive, three stars, cruisers closing
    // in from behind and head-on. The cover shot: low camera, the chase
    // filling the frame, wanted stars, objective and minimap all visible.
    game.missions.startNext(); // First Wheels: already in a car, so the
    // objective reads "Drive the car to Mara's garage".
    placePlayerCar(game, 'sports', 0xff7a1a, 0, -52, 0, 24);
    W.heat = 60;
    W._recalc();
    // One cruiser ahead, coming at the player head-on (visible in frame),
    // one tight behind in pursuit, plus a taxi crossing the avenue ahead.
    placePoliceCar(game, 6, 95, Math.PI);
    placePoliceCar(game, -4, -68, 0);
    placeParkedCar(game, 'taxi', 0xe8b93a, -6, 34, Math.PI / 2);
    cam.snapTo(target(0, 1, -52), Math.PI, 0.28, 9.5, 3.4);
    warmUp(game, 2.2, true);
    cam.snapTo(target(P.x, 1, P.z), Math.PI, 0.28, 9.5, 3.4);
    hideBanner(game);
    return;
  }

  if (name === 'mission') {
    // Bay Run, stage two: package in hand, two stars, racing the
    // checkpoint on Ocean Drive with the beacon ahead and a cruiser
    // closing in behind. Low camera, the checkpoint beacon in frame.
    game.missions.missionsDone = 1;
    game.missions.startNext();
    game.combat.giveGun();
    P.x = 0;
    P.z = -156;
    P.syncMesh();
    warmUp(game, 0.4, false); // walks into the pickup, stage advances, heat hits 2
    // Drive the checkpoint approach one lane over (z = -6) so the lamp
    // post at the intersection no longer sits dead-centre in front of
    // the beacon; a parked sedan ahead adds street life to the frame.
    placePlayerCar(game, 'sedan', 0x2b6fd6, -190, -6, Math.PI / 2, 20);
    placePoliceCar(game, -214, -6, Math.PI / 2);
    placeParkedCar(game, 'sedan', 0x3aa655, -138, 8, Math.PI / 2);
    cam.snapTo(target(P.x, 1, P.z), Math.PI / 2 + Math.PI, 0.26, 10, 4.0);
    warmUp(game, 0.7, true); // short: the car closes on the checkpoint, beacon still ahead
    cam.snapTo(target(P.x, 1, P.z), Math.PI / 2 + Math.PI, 0.26, 10, 4.0);
    hideBanner(game);
    return;
  }

  if (name === 'skyline') {
    // Golden hour on the coastal road: the car, the beach, the marina
    // boats, downtown and the sun sinking into the bay behind it all.
    game.missions.startNext();
    placePlayerCar(game, 'sports', 0xe8b93a, 90, 224, -Math.PI / 2, 18);
    W.heat = 20;
    W._recalc();
    placePoliceCar(game, 122, 224, -Math.PI / 2);
    // Flatter pitch (0.22) drops the horizon — and the tall billboards —
    // below the HUD star row, so the sign text no longer collides with it.
    cam.snapTo(target(90, 1, 224), Math.PI / 2, 0.22, 11, 3.6);
    warmUp(game, 1.6, true);
    cam.snapTo(target(P.x, 1, P.z), Math.PI / 2, 0.22, 11, 3.6);
    hideBanner(game);
    return;
  }

  // 'street' (and any unknown name): Rico on foot at the downtown
  // crossing, traffic and pedestrians around him, clean record. Low
  // camera so the towers, the crossing and the street life fill the frame.
  // Rico stands 12 m south of the v1 spot with a slight diagonal yaw:
  // the palm that used to fill the centre of the frame now sits
  // off-centre and further away, and the crossing, marker and parked
  // muscle car all stay in view.
  game.missions.startNext(); // objective: "Steal a car (walk up to one and press E)"
  P.x = 2;
  P.z = 20;
  P.heading = 0;
  P.syncMesh();
  // Stage the street: a traffic car rolling through the crossing ahead,
  // pedestrians on the sidewalk, and a parked muscle car at the corner.
  const t0 = game.traffic.cars[0];
  t0.car.x = 4;
  t0.car.z = -30;
  t0.car.heading = 0;
  t0.car.speed = 8;
  t0.axis = 'z';
  t0.dir = 1;
  t0.waypoint = { x: 4, z: 52 };
  t0.car.syncMesh();
  const p0 = game.traffic.peds[0];
  p0.x = -5;
  p0.z = -2;
  p0.target = { x: -5, z: 40 };
  p0.state = 'walk';
  const p1 = game.traffic.peds[1];
  p1.x = -2;
  p1.z = 32;
  p1.target = { x: -2, z: -20 };
  p1.state = 'walk';
  const p2 = game.traffic.peds[2];
  p2.x = 6;
  p2.z = 6;
  p2.target = { x: 6, z: -30 };
  p2.state = 'walk';
  placeParkedCar(game, 'muscle', 0xd23b3b, 9, -10, Math.PI / 2);
  cam.snapTo(target(2, 1, 20), 0.12, 0.3, 8, 3.6);
  warmUp(game, 1.5, false);
  cam.snapTo(target(P.x, 1, P.z), 0.12, 0.3, 8, 3.6);
  hideBanner(game);
}
