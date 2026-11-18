// Neon Bay — the 4 deterministic screenshot scenes (?shot=...&seed=7).
// Each one warms the simulation up for 2 s, THEN poses the player
// elements (a rolling car would otherwise drift during warm-up), and
// hands the camera to a fixed spot. Shots (new names for v3c):
//   pursuit — 3-star chase, roadblock ahead, cover shot
//   corner  — Rico on foot at a crosswalk, Mara in the beacon ring
//   heist   — Bay Run checkpoint 1, sedan 16 m out
//   marina  — wide dusk skyline: pier, boats, ocean, sun, MARINA board

import { PLACES } from './config.js';

const SHOT_NAMES = ['pursuit', 'corner', 'heist', 'marina'];

export function shotList() { return SHOT_NAMES; }

export function applyShot(game, name) {
  const g = game;
  g.mode = 'play';
  g.hud.hideScreens();
  g.audio.ensure();
  if (name === 'pursuit') {
    // Rico in the orange sports car, northbound on the centre avenue,
    // 3 stars, two cruisers blocking the road 45 m ahead.
    g.missions.debugStart(0);
    g.missions.started = true;
    g.missions.index = 0;
    g.missions.state = 'active';
    g.missions.stage = 1; // "Drive the car to Mara's garage"
    g.player.place(0, 150, 0);
    const car = g.spawnPlayerCar('sports', 0xff7a1a, 0, 150, 0);
    g.police.setWanted(3);
    g.police.layRoadblock(car);
    g.warmup(2);
    // Pose after warm-up: the car rolls during the sim, so put it back.
    // Tight chase cam: sit the car 9 m short of the roadblock (laid
    // 45 m ahead of the spawn point) and keep its speed low (5 m/s) so
    // the harness's 600 ms wait only rolls it a couple of metres — the
    // car stays large in the lower frame and the two roadblock cruisers
    // fill the middle of the frame instead of sitting tiny at 45 m.
    // Camera off to the right: a chaser cruiser rides the player's
    // bumper, and from dead behind it hides the orange car — from the
    // side the chaser separates to the left edge and the player's car
    // reads on its own. (No tail cruiser added: the two spawned
    // chasers plus the roadblock give the police presence.)
    car.place(0, 114, 0);
    car.speed = 5;
    g.render.setFree(6.5, 3.2, 122, 0, 1.6, 106);
  } else if (name === 'corner') {
    // On foot at the centre crosswalk; Mara waits in the beacon ring and
    // a taxi rolls through the intersection on the green light.
    g.missions.debugStart(0);
    g.missions.started = true;
    g.missions.index = 0;
    g.missions.state = 'active';
    g.missions.stage = 0; // "Steal a car"
    g.player.place(2, -4, Math.PI);
    g.missions.mara.visible = true;
    g.missions.mara.position.set(9, 0, -9);
    g.missions.beaconOverride = { x: 9, z: -9 };
    g.warmup(2);
    // Drive one traffic car through the frame.
    const t = g.traffic.cars.find((c) => c.horiz && c.avenue === 0);
    if (t) {
      t.car.place(-46, 0, -Math.PI / 2);
      t.car.speed = 10;
      t.speed = 10;
      t.dir = 1;
    }
    g.render.setFree(16, 4.5, 16, 0, 1.5, -8);
  } else if (name === 'heist') {
    // Bay Run: the sedan sits 16 m short of checkpoint 1 on Ocean Drive,
    // beacon ahead, 2 stars on the HUD, full magazine.
    g.missions.debugStart(1);
    g.missions.started = true;
    g.missions.index = 1;
    g.missions.state = 'active';
    g.missions.stage = 1; // "Checkpoint 1 of 3 — Ocean Drive"
    g.combat.giveGun();
    g.player.place(-160, 338, 0);
    const car = g.spawnPlayerCar('sedan', 0x3a6ab0, -160, 338, 0);
    g.police.setWanted(2);
    g.warmup(2);
    // Pose after warm-up: the car would otherwise roll into the ring
    // and advance the stage to checkpoint 2. Sit 20 m out: even after
    // the harness's wait the car stays outside the 10 m radius.
    car.place(-160, 340, 0);
    car.speed = 14;
    g.render.setFree(-156, 3.2, 350, -160, 1.8, 322);
  } else if (name === 'marina') {
    // Wide dusk skyline from the sand: the pier runs out to the hut,
    // boats bob beside it, the sun hangs over the ocean and the MARINA
    // billboard reads at the pier root.
    g.missions.debugStart(0);
    g.missions.started = true;
    g.missions.index = 0;
    g.missions.state = 'active';
    g.missions.stage = 0;
    g.player.place(60, 350, Math.PI * 0.75);
    g.warmup(2);
    g.render.setFree(156, 8, 378, 108, 4, 448);
  }
  g.render.render();
  window.__shotReady = true;
}
