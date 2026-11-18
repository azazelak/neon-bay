// Neon Bay v4 — screenshot scenes behind ?shot=chase-down|boulevard|vault|pier.
// Each scene resets the world, warms the simulation up for 3 seconds so the
// traffic and pedestrians are mid-flow, then poses the player, police and
// camera deterministically. The parent freezes the sim after this returns,
// so nothing drifts while the screenshot is taken.
import { PLACES } from './config.js';

function warmUp(game, seconds) {
  const steps = Math.round(seconds * 60);
  for (let i = 0; i < steps; i++) game.stepWorld(1 / 60);
}

function poseCar(car, x, z, yaw) {
  car.x = x; car.z = z; car.yaw = yaw; car.speed = 0;
  car.group.position.set(x, 0, z);
  car.group.rotation.y = yaw;
}

export function stageShot(name, game) {
  game.resetWorld();
  warmUp(game, 3);

  if (name === 'chase-down') {
    // COVER: 3-star chase, roadblock ahead, cruiser tight beside the player.
    const sports = game.spawnSportsCar();
    poseCar(sports, 0, 60, 0);
    game.enterCar(sports);
    game.cash = 1250; game.rep = 12;
    game.tokens.setCollected(3);
    game.police.setWanted(3);
    game.police.spawnAt(5.5, 68, 0); // cruiser tight beside the player
    game.police.spawnAt(-4.5, 82, Math.PI / 2, 'block'); // roadblock left
    game.police.spawnAt(4.5, 82, Math.PI / 2, 'block'); // roadblock right
    game.missions.setState(0, 1, 0); // First Wheels: drive to the garage
    game.camYaw = 0.35; game.camPitch = 0.16;
    game.setCamSnap();
  } else if (name === 'boulevard') {
    // Rico on foot on a neon boulevard, taxi coming down the avenue, the
    // Club Volt beacon down the street.
    game.player.place(-90, -96, Math.PI);
    game.spawnTaxiCar(-96, -122);
    game.cash = 800; game.rep = 8;
    game.missions.setState(2, 0, 0); // Neon Nights: pick up at Club Volt
    game.camYaw = Math.PI + 0.3; game.camPitch = 0.1;
    game.setCamSnap();
  } else if (name === 'vault') {
    // The Coral Heist mid-hold: the vault countdown live, police ringing
    // the casino instead of ramming.
    const sports = game.spawnSportsCar();
    poseCar(sports, 192, -136, Math.PI);
    game.enterCar(sports);
    game.cash = 3700; game.rep = 45;
    game.missions.setState(4, 1, 4.2); // hold stage, 3.8 s left
    game.police.setWanted(3);
    game.police.setStandoff({ x: PLACES.casino.x, z: PLACES.casino.z, r: 11 });
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
      const x = PLACES.casino.x + Math.cos(a) * 11;
      const z = PLACES.casino.z + Math.sin(a) * 11;
      game.police.spawnAt(x, z, Math.atan2(PLACES.casino.x - x, PLACES.casino.z - z));
    }
    game.camYaw = 2.4; game.camPitch = 0.42;
    game.setCamSnap();
  } else if (name === 'pier') {
    // The escape: pier, Ferris wheel, boats and the sun disc, 5 stars.
    const sports = game.spawnSportsCar();
    poseCar(sports, 432, 0, Math.PI / 2);
    game.enterCar(sports);
    game.cash = 11700; game.rep = 80;
    game.tokens.setCollected(12);
    game.missions.setState(5, 2, 0); // Skyline Drop: escape to the pier
    game.police.setWanted(5);
    game.police.spawnAt(408, -6, Math.PI / 2);
    game.police.spawnAt(408, 6, Math.PI / 2);
    game.camYaw = Math.PI / 2; game.camPitch = 0.24;
    game.setCamSnap();
  } else {
    // Unknown shot name: plain street view.
    game.player.place(0, 96, 0);
    game.camYaw = 0; game.camPitch = 0.2;
    game.setCamSnap();
  }
}
