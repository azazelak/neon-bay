// Deterministic screenshot scenes, driven by ?shot=<name>&seed=1.
// Each one stages a real game state — a chase, a street, a mission, the
// skyline — warms the simulation up for a few seconds, and hides the
// menus so the shot shows the game itself. The screenshots are taken by
// the headless harness from these exact states.
import { CONFIG } from './config.js';

export function setupShot(game, name) {
  game.startNewGame();
  game.hud.hideAll();
  const rig = game.rig;
  rig.lastDragT = 1e9; // keep the staged camera where we put it

  if (name === 'chase') {
    // Rico in the orange sports car on Ocean Drive, 3 stars, a roadblock
    // pair ahead and cruisers closing from behind. Mission 1's garage run
    // is the objective on the HUD.
    const m = game.missions;
    m.missionsDone = 0;
    m.startNext();
    m.stageI = 2;
    m.setStageText();
    const sports = game.spawnSportsCarAt(0, 120, Math.PI);
    game.putPlayerInCar(sports);
    game.police.setHeat(60);
    game.police.spawnCruiser(0, 168, Math.PI);
    game.police.spawnCruiser(4, 182, Math.PI);
    // Roadblock right ahead: two cruisers angled across the road, 12 m up,
    // plus a third bearing down the oncoming lane — the cover reads as an
    // interception, not an empty street.
    for (const [off, ang] of [[-2, 0.45], [2, -0.45]]) {
      const e = game.police.spawnCruiser(off, 108, Math.PI / 2 + ang);
      e.state = 'block';
      e.blockT = 30;
    }
    const headOn = game.police.spawnCruiser(-6, 106, -0.3);
    headOn.state = 'block';
    headOn.blockT = 30;
    rig.distOverride = 7;
    // The car heads north (heading PI), so the chase camera sits south of
    // it: yaw 0 puts the camera behind the car, looking north at the
    // roadblock ahead. (Yaw PI would put the camera in front of the car.)
    rig.yaw = 0;
    rig.pitch = 0.18;
    return;
  }

  if (name === 'street') {
    // Rico on foot at the downtown crosswalk, Mara waiting at the corner,
    // a taxi and a van rolling past, pedestrians on the sidewalk.
    game.player.reset(12, 16, Math.PI * 0.75);
    const taxi = game.traffic.cars.find((t) => t.car.kind === 'taxi');
    if (taxi) { taxi.car.x = -6; taxi.car.z = -18; taxi.tx = -6; taxi.tz = 222; taxi.car.heading = 0; }
    const van = game.traffic.cars.find((t) => t.car.kind === 'van');
    if (van) { van.car.x = 6; van.car.z = 34; van.tx = 6; van.tz = -222; van.car.heading = Math.PI; }
    rig.yaw = 0.99;
    rig.pitch = 0.22;
    return;
  }

  if (name === 'mission') {
    // Bay Run, checkpoint 1: Rico in a sedan just short of the checkpoint
    // ring on Ocean Drive, 2 stars, pistol loaded.
    const m = game.missions;
    m.missionsDone = 1;
    m.startNext();
    m.stageI = 1;
    m.setStageText();
    game.combat.giveGun();
    const sedan = game.traffic.parked.find((c) => c.kind === 'sedan') || game.traffic.parked[0];
    sedan.x = 132;
    sedan.z = 222;
    sedan.heading = Math.PI / 2;
    sedan.syncMesh();
    game.putPlayerInCar(sedan);
    game.police.setHeat(30);
    rig.distOverride = 9.5;
    rig.yaw = -Math.PI / 2;
    rig.pitch = 0.3;
    return;
  }

  if (name === 'skyline') {
    // WIDE dusk skyline from the beach: the marina pier and its bobbing
    // boats, the ocean horizon, the sun disc, and the MARINA billboard
    // readable in frame. 1 star for a little life.
    game.police.setHeat(10);
    const cruiser = game.police.spawnCruiser(-222, 148, 0);
    if (cruiser) { cruiser.car.speed = 12; }
    // Free camera: low on the sand, aimed down the pier to the west.
    game.freeCam = {
      pos: { x: -290, y: 12, z: 238 },
      look: { x: -420, y: 5, z: 215 },
    };
  }
}
