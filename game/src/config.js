// Neon Bay — all tuning, palette, car kinds and grid helpers.
// One place for every number the rest of the game reads.

export const CFG = {
  // City grid: avenues every 80 m, from -320 to +320. Blocks sit between them.
  avenueStep: 80,
  avenueMin: -320,
  avenueMax: 320,
  roadHalf: 7,
  // Facades must stay >= 12 m from an avenue centreline, so cruisers can
  // chase down an avenue without clipping walls.
  facadeClear: 12,
  // South of z = 360 is sand, then ocean.
  beachZ: 360,
  oceanZ: 400,
  // Marina pier root (x) and reach (z).
  pierX: 120,
  pierZ0: 392,
  pierZ1: 468,

  // Player on foot.
  walkSpeed: 6,
  sprintSpeed: 10.5,
  jumpSpeed: 8,
  playerRadius: 0.7,
  playerHealth: 100,

  // Arcade driving.
  carAccel: 16,
  carBrake: 30,
  carReverse: 12,
  steerRate: 2.1,
  grip: 6,

  // Wanted.
  wantedDecaySeconds: 45,
  maxCruisers: 5,
  roadblockCooldown: 22,
  roadblockRange: 45,

  // Combat.
  pistolMag: 12,
  pistolRange: 70,
  cruiserHitsToDisable: 3,

  // Missions.
  missionRewards: [500, 1200, 2000, 8000],
  vaultHoldSeconds: 8,
  tokenValue: 50,
  tokenCount: 12,

  // Traffic.
  trafficCars: 20,
  pedestrians: 36,
  parkedCars: 16,

  // World clock: a full day in 8 real minutes, starting at dusk.
  daySeconds: 480,
  startClock: 18.6, // 18:36, sun low in the south-west
};

// Avenue centreline positions.
export const AVENUES = [];
for (let v = CFG.avenueMin; v <= CFG.avenueMax; v += CFG.avenueStep) AVENUES.push(v);

// Block centres (between avenues).
export const BLOCKS = [];
for (let v = CFG.avenueMin + CFG.avenueStep / 2; v < CFG.avenueMax; v += CFG.avenueStep) BLOCKS.push(v);

export function nearestAvenue(v) {
  let best = AVENUES[0];
  for (const a of AVENUES) if (Math.abs(a - v) < Math.abs(best - v)) best = a;
  return best;
}

// Nearest intersection to a point.
export function nearestIntersection(x, z) {
  return { x: nearestAvenue(x), z: nearestAvenue(z) };
}

// True when a point sits on a road (within a road strip of either axis).
export function onRoad(x, z) {
  const dx = Math.abs(x - nearestAvenue(x));
  const dz = Math.abs(z - nearestAvenue(z));
  return dx <= CFG.roadHalf + 1.5 || dz <= CFG.roadHalf + 1.5;
}

export function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }
export function lerp(a, b, t) { return a + (b - a) * t; }
export function angleLerp(a, b, t) {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
}
export function angleDiff(a, b) {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}
export function dist2D(ax, az, bx, bz) { return Math.hypot(ax - bx, az - bz); }

// Dusk palette — warm sunset, teal shadows, hot neon.
export const PALETTE = {
  skyTop: 0x2b3a6e,
  skyMid: 0xb45a6e,
  skyLow: 0xff9a52,
  fog: 0x8a5a72,
  sun: 0xffd9a0,
  road: 0x3a3f4a,
  roadLine: 0xd8c86a,
  sidewalk: 0x8a8578,
  sand: 0xc9a06a,
  ocean: 0x2a6a8a,
  oceanDeep: 0x1a4a6a,
  grass: 0x4a6a3a,
  buildingGlass: 0x2a3a55,
  neonPink: 0xff2a7a,
  neonCyan: 0x2ad4ff,
  neonYellow: 0xffd42a,
  neonGreen: 0x3aff8a,
  neonOrange: 0xff7a2a,
  neonPurple: 0xb44aff,
};

// Car kinds: top speed (m/s), acceleration, size, palette.
export const CAR_KINDS = {
  sedan:   { top: 34, accel: 15, len: 4.4, wid: 1.9, colors: [0x8a9ab0, 0xb03030, 0x3a6ab0, 0xd8d8d8, 0x2a2a2a] },
  taxi:    { top: 30, accel: 14, len: 4.4, wid: 1.9, colors: [0xffc42a] },
  van:     { top: 28, accel: 12, len: 5.2, wid: 2.1, colors: [0xd8d8d8, 0x7a5a3a, 0x4a6a8a] },
  sports:  { top: 41, accel: 19, len: 4.2, wid: 2.0, colors: [0xff7a1a, 0xd42a2a, 0x2ad4ff] },
  pickup:  { top: 32, accel: 14, len: 4.9, wid: 2.0, colors: [0x3a5a2a, 0x8a2a2a, 0x5a6a7a] },
  muscle:  { top: 38, accel: 17, len: 4.6, wid: 2.0, colors: [0x1a1a2a, 0x6a1a8a, 0xc0c0c0] },
  police:  { top: 44, accel: 18, len: 4.6, wid: 2.0, colors: [0x1a1a1a] },
};

// Named places the story uses. Every target sits ON a road (an avenue),
// in front of its building — a target at a block centre can sit inside
// a building footprint, where no car can ever reach it.
export const PLACES = {
  start:        { x: 0, z: 40 },
  garage:       { x: -200, z: 240, name: "Mara's Garage" },
  casino:       { x: 200, z: -160, name: 'Casino Luna' },
  clubVolt:     { x: -40, z: -80, name: 'Club Volt' },
  marina:       { x: 120, z: 340, name: 'Marina' },
  sportsSpawn:  { x: 132, z: 336, name: 'Marina parking' },
  oceanDrive:   { z: 320 },
};
