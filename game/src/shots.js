// Neon Bay v5c — staged screenshot scenes for ?shot=<name>&seed=19.
// Each shot poses the world, then fixes the camera. The escort cruiser is
// placed to the player's side (visible, never dominating the frame) and
// explicit spawn coordinates are never snapped to road nodes.
import * as THREE from '../vendor/three.module.min.js';
import { Car } from './vehicles.js';

// Neon sign texture for staged shot dressing (same look as the city signs).
function neonSignTexture(text, color) {
  const c = document.createElement('canvas');
  c.width = 512; c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = '#0a0a12'; g.fillRect(0, 0, 512, 128);
  g.strokeStyle = color; g.lineWidth = 6; g.strokeRect(6, 6, 500, 116);
  g.fillStyle = color; g.font = 'bold 64px Arial';
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.shadowColor = color; g.shadowBlur = 22;
  g.fillText(text, 256, 66);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function addSignPost(game, text, color, x, y, z) {
  const post = new THREE.Mesh(new THREE.BoxGeometry(0.4, y, 0.4),
    new THREE.MeshStandardMaterial({ color: 0x555555 }));
  post.position.set(x, y / 2, z);
  game.scene.add(post);
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(11, 2.6),
    new THREE.MeshBasicMaterial({ map: neonSignTexture(text, color), side: THREE.DoubleSide }));
  sign.position.set(x, y + 1.2, z);
  game.scene.add(sign);
}

function putPlayerCar(game, x, z, yaw, kind = 'sports') {
  const p = game.player;
  let car = game.traffic.cars.find((c) => c.kind === kind);
  if (!car) car = new Car(game, kind, x, z, yaw);
  car.pos.set(x, 0, z);
  car.yaw = yaw;
  car.speed = 0; // staged cars stay exactly posed (no drift during settle)
  car.isTraffic = false;
  car.mesh.position.set(x, 0, z);
  car.mesh.rotation.y = yaw;
  p.car = car;
  p.inCar = true;
  p.pos.set(x, 0, z);
  p.yaw = yaw;
  p.mesh.visible = false;
  return car;
}

function putPlayerOnFoot(game, x, z, yaw) {
  const p = game.player;
  if (p.inCar && p.car) { p.car.isTraffic = true; p.car = null; p.inCar = false; }
  p.pos.set(x, 0, z);
  p.yaw = yaw;
  p.mesh.visible = true;
  p.mesh.position.set(x, 0, z);
  p.mesh.rotation.y = yaw;
}

export function stageShot(game, name) {
  const police = game.police;
  const set = (obj, cash, rep, tokensGot) => {
    game.cash = cash;
    game.rep = rep;
    game.tokens.items.forEach((t, i) => {
      if (i < tokensGot) { t.got = true; t.mesh.visible = false; }
    });
    game.missions.objective = obj;
  };

  if (name === 'siege') {
    // Cover: side-on from the south, low and tight — the player car shows
    // its full side profile, the roadblock reads close (both cruisers
    // beside the car in the frame, not occluded by it), and the escort is
    // visible on the far side. Camera moved in to ~10 m from the car so
    // the car is the largest thing in the frame; the whole staging sits
    // 20 m west of the v5c builder's spot so the token that floated over
    // the car's nose at (0,111) is out of frame.
    putPlayerCar(game, -20, 120, -Math.PI / 2 + 0.4, 'sports');
    // escort cruiser: far (north) side, west of the car — fully visible
    // with its light bar, clear of the token at (0,111)
    const esc = police.spawnCruiser(-26, 114.5);
    esc.yaw = -Math.PI / 2 + 0.4;
    esc.mesh.rotation.y = esc.yaw;
    // roadblock: two cruisers across the road, 12 m ahead
    const rb1 = police.spawnCruiser(-32, 116);
    rb1.yaw = Math.PI / 2; rb1.mesh.rotation.y = rb1.yaw;
    const rb2 = police.spawnCruiser(-32, 124);
    rb2.yaw = Math.PI / 2; rb2.mesh.rotation.y = rb2.yaw;
    police.level = 3; police.heat = 2 * 40 + 10;
    set('Escape the roadblock — lose the cops!', 1250, 12, 3);
    game.shotCam = {
      pos: new THREE.Vector3(-17, 3.0, 130),
      look: new THREE.Vector3(-25, 1.0, 119.5),
    };
  } else if (name === 'avenue') {
    // Downtown street canyon: player on foot walking north up road x=0,
    // towers and neon signs on both sides, a taxi in the street.
    putPlayerOnFoot(game, 2, 68, Math.PI);
    const taxi = game.traffic.cars.find((c) => c.kind === 'taxi');
    if (taxi) {
      taxi.pos.set(-4, 0, 46); taxi.yaw = Math.PI;
      taxi.mesh.position.set(-4, 0, 46); taxi.mesh.rotation.y = taxi.yaw;
    }
    // staged neon signs, framed whole facing the camera (both on the west
    // side of the street, at different heights so they never overlap)
    addSignPost(game, 'HOTEL MIRA', '#ff2e88', -2, 9, 36);
    addSignPost(game, 'CASINO LUNA', '#22e6ff', -13, 7, 30);
    police.level = 0; police.heat = 0;
    set('Neon Nights — the city never sleeps', 2400, 8, 5);
    game.shotCam = {
      pos: new THREE.Vector3(2, 4.5, 78),
      look: new THREE.Vector3(0, 11, 10),
    };
  } else if (name === 'breakout') {
    // Coral Bank vault hold: player car inside the ring, cruisers ringing it.
    putPlayerCar(game, 40, 80, Math.PI / 2, 'sports');
    game.missions.showRing(40, 80);
    const c1 = police.spawnCruiser(48, 88);
    c1.yaw = -Math.PI * 0.75; c1.mesh.rotation.y = c1.yaw;
    const c2 = police.spawnCruiser(30, 90);
    c2.yaw = -Math.PI * 0.25; c2.mesh.rotation.y = c2.yaw;
    const c3 = police.spawnCruiser(52, 74);
    c3.yaw = Math.PI * 0.75; c3.mesh.rotation.y = c3.yaw;
    police.level = 4; police.heat = 3 * 40 + 10;
    set('Hold the vault — stay in the ring! (5s)', 13725, 18, 7);
    game.shotCam = {
      pos: new THREE.Vector3(54, 4.5, 98),
      look: new THREE.Vector3(38, 1, 78),
    };
  } else if (name === 'pierwheel') {
    // Pier: player on the beach beside the pier, Ferris wheel + sea + sun
    // disc behind; the pier deck shows at the right edge.
    putPlayerOnFoot(game, 122, 204, -1.28);
    police.level = 0; police.heat = 0;
    set('Skyline Drop — the pier at dusk', 23825, 25, 12);
    game.shotCam = {
      pos: new THREE.Vector3(135, 4.5, 188),
      look: new THREE.Vector3(102, 12, 214),
    };
  }
}
