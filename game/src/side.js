// Neon Bay v4 — side activities: taxi fares and stunt jumps.
// Fares run when no story mission is active (or during the Taxi Rush
// mission, which counts them). A fare pays $60–$120 by distance. Stunt
// ramps launch the car; a clean landing pays $100.
import * as THREE from 'three';
import { Car } from './vehicles.js';
import { PLACES, FARE_PAY, STUNT_PAY, clamp } from './config.js';
import { Rng } from './rng.js';

const RAMPS = [
  { x: 96, z: 48, dir: 1 },
  { x: -288, z: -48, dir: -1 },
  { x: 288, z: 144, dir: 1 },
];

export function createSide(scene, colliders) {
  const rng = new Rng(99);
  let phase = 'idle'; // idle | pickup | ride
  let pickup = null, dest = null, timer = 0, cool = 0;
  let faresDone = 0;
  let airT = 0, airCar = null;
  const rampCool = [0, 0, 0];
  const markers = {};

  // Ramp wedges + a beacon ring mesh reused for fare markers.
  for (const r of RAMPS) {
    const wedge = new THREE.Mesh(
      new THREE.BoxGeometry(6, 1.2, 10),
      new THREE.MeshLambertMaterial({ color: 0xffc233 }));
    wedge.position.set(r.x, 0.6, r.z);
    wedge.rotation.x = r.dir > 0 ? -0.18 : 0.18;
    scene.add(wedge);
  }
  const ringGeo = new THREE.RingGeometry(6, 8, 32);
  const ringMat = new THREE.MeshBasicMaterial({ color: 0x39ff88, transparent: true, opacity: 0.8, side: THREE.DoubleSide });
  const ring = new THREE.Mesh(ringGeo, ringMat);
  ring.rotation.x = -Math.PI / 2; ring.position.y = 0.3; ring.visible = false;
  scene.add(ring);
  markers.ring = ring;

  function randomDest(fromX, fromZ) {
    for (let i = 0; i < 20; i++) {
      const x = (rng.int(-4, 4)) * 96, z = (rng.int(-4, 4)) * 96;
      if (Math.hypot(x - fromX, z - fromZ) > 120) return { x, z };
    }
    return { x: 288, z: -288 };
  }

  function startFare(px, pz) {
    const stand = PLACES.taxiStand[rng.int(0, PLACES.taxiStand.length - 1)];
    pickup = { x: stand.x, z: stand.z };
    dest = null; phase = 'pickup';
    ring.visible = true;
    ring.position.set(pickup.x, 0.3, pickup.z);
    return pickup;
  }

  function update(dt, ctx) {
    // ctx: {x, z, inCar, carKind, car, speed, faresAllowed, onFare(pay), onStunt(), onMessage}
    cool -= dt;
    for (let i = 0; i < 3; i++) rampCool[i] -= dt;
    const car = ctx.car;
    if (ctx.faresAllowed && phase === 'idle' && cool <= 0 && ctx.inCar) {
      startFare(ctx.x, ctx.z);
    }
    if (phase === 'pickup') {
      if (!ctx.faresAllowed) { phase = 'idle'; ring.visible = false; }
      else if (ctx.inCar && Math.hypot(ctx.x - pickup.x, ctx.z - pickup.z) < 9) {
        dest = randomDest(pickup.x, pickup.z);
        timer = Math.hypot(dest.x - pickup.x, dest.z - pickup.z) / 12 + 25;
        phase = 'ride';
        ring.position.set(dest.x, 0.3, dest.z);
        if (ctx.onMessage) ctx.onMessage('Passenger aboard — get to the marker!');
      }
    } else if (phase === 'ride') {
      timer -= dt;
      if (timer <= 0) {
        phase = 'idle'; ring.visible = false; cool = 5;
        if (ctx.onMessage) ctx.onMessage('Fare failed — too slow.');
      } else if (ctx.inCar && Math.hypot(ctx.x - dest.x, ctx.z - dest.z) < 10) {
        const pay = FARE_PAY[clamp(Math.floor(Math.hypot(dest.x - pickup.x, dest.z - pickup.z) / 150), 0, 3)];
        faresDone++;
        phase = 'idle'; ring.visible = false; cool = 2;
        if (ctx.onFare) ctx.onFare(pay);
      }
    }
    // Stunt jumps: cross a ramp fast and the car flies.
    if (car && !car.dead && airT <= 0) {
      for (let i = 0; i < RAMPS.length; i++) {
        const r = RAMPS[i];
        if (rampCool[i] > 0) continue;
        const d = Math.hypot(car.x - r.x, car.z - r.z);
        if (d < 6 && Math.abs(car.speed) > 22) {
          airT = 1.1; airCar = car; rampCool[i] = 12;
          break;
        }
      }
    }
    if (airT > 0 && airCar) {
      airT -= dt;
      const p = 1 - airT / 1.1;
      airCar.airY = Math.sin(p * Math.PI) * 3.5;
      if (airT <= 0) {
        airCar.airY = 0;
        if (ctx.onStunt) ctx.onStunt(STUNT_PAY);
        airCar = null;
      }
    }
  }

  function spawnTaxi(x, z) {
    return new Car(scene, 'taxi', x, z, 0);
  }

  function reset() {
    phase = 'idle'; faresDone = 0; timer = 0; cool = 0; airT = 0;
    ring.visible = false;
  }

  return {
    get phase() { return phase; },
    get pickup() { return pickup; },
    get dest() { return dest; },
    get timer() { return timer; },
    get faresDone() { return faresDone; },
    resetFares() { faresDone = 0; },
    startFare, update, spawnTaxi, reset,
  };
}
