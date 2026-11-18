// Neon Bay — every tunable number in one place. The city is a 9x9 grid of
// avenues on a 74 m pitch; intersections sit at multiples of 74 from -296
// to 296, the shore and the ocean lie west of x = -333.
export const CONFIG = {
  seed: 1337,
  pitch: 74,
  gridHalf: 4, // intersections at -4..4 * pitch
  roadHalf: 7, // half the drivable width of an avenue
  cityHalf: 333, // playable edge, east/north/south
  shoreX: -333, // ocean starts west of here
  beachHalf: 296, // westernmost avenue; beach strip between shore and it

  playerWalk: 6,
  playerSprint: 9.5,
  playerHealth: 100,

  // Arcade car kinds: top speed, acceleration, braking, paint jobs.
  carKinds: {
    sedan: { maxSpeed: 34, accel: 15, brake: 26, colors: [0x3a6fd8, 0xc0392b, 0xd8d8d8, 0x222226] },
    taxi: { maxSpeed: 30, accel: 13, brake: 24, colors: [0xf7b500] },
    van: { maxSpeed: 28, accel: 11, brake: 22, colors: [0x8a8f98, 0x5a7d5a] },
    muscle: { maxSpeed: 36, accel: 17, brake: 26, colors: [0xb02020, 0x1a1a2e] },
    pickup: { maxSpeed: 32, accel: 14, brake: 24, colors: [0x2e6b4f, 0x7a5a2e] },
    sports: { maxSpeed: 41, accel: 20, brake: 30, colors: [0xff6a00] },
    police: { maxSpeed: 44, accel: 18, brake: 30, colors: [0x101418] },
  },

  trafficCars: 20,
  peds: 36,
  parkedCars: 16,
  tokenCount: 12,
  tokenValue: 50,

  // Wanted level: heat thresholds that buy each star.
  starAt: [1, 25, 45, 70, 90],
  heatSteal: 15,
  heatKill: 20,
  heatDecay: 1.2, // per second, after 8 s without a crime
  heatCleanDelay: 8,
  // Cruiser top speed grows with the wanted level, 29.6 at 1 star to 44 at 5.
  policeCap: (stars) => Math.min(44, 26 + stars * 3.6),
  policeRamRange: 25,
  policePitStars: 3,
  policeRoadblockStars: 3,
  roadblockCooldown: 22,
  roadblockAhead: 45,
  arrestRange: 2,
  arrestSeconds: 1.5,

  rewards: [500, 1200, 2000, 8000],
  missionDelay: 1.5, // seconds between one mission ending and the next starting
  holdSeconds: 8,
  holdRadius: 9,

  magSize: 12,
  cruiserHitsToKill: 3,

  // Palette for the dusk look: warm sun, purple sky, neon accents.
  palette: {
    skyTop: 0x1b2340,
    skyMid: 0x7a4a8a,
    horizon: 0xff7e3d,
    sun: 0xffd27a,
    fog: 0x2a1a33,
    road: 0x2e2a38,
    sidewalk: 0x4a4552,
    sand: 0xc2a878,
    ocean: 0x144a6e,
    grass: 0x2e4a2e,
  },

  // Original names only — nothing from any commercial game.
  signs: [
    { text: 'NEON BAY', color: '#ff2e88' },
    { text: 'CASINO LUNA', color: '#ffd23e' },
    { text: 'MARINA', color: '#2ee6ff' },
    { text: 'HOTEL CORAL', color: '#ff7a3c' },
    { text: 'TACOS EL CAMINO', color: '#7dff5a' },
    { text: 'CLUB VOLT', color: '#b45aff' },
    { text: 'PALM COURT', color: '#ff5a5a' },
    { text: 'BAY BURGER', color: '#ffb13c' },
    { text: 'DISCO SOL', color: '#3cffb1' },
    { text: 'PIER 9', color: '#5aa8ff' },
  ],
};

// Avenue coordinate for grid index i (-gridHalf..gridHalf).
export function avenue(i) {
  return i * CONFIG.pitch;
}

// Snap a world position to its nearest intersection.
export function nearestIntersection(x, z) {
  const c = (v) => {
    const i = Math.max(-CONFIG.gridHalf, Math.min(CONFIG.gridHalf, Math.round(v / CONFIG.pitch)));
    return i * CONFIG.pitch;
  };
  return { x: c(x), z: c(z) };
}

// True when (x, z) lies on a drivable avenue (within the road plus curb).
export function onRoad(x, z) {
  const near = (v) => {
    const r = Math.abs(v / CONFIG.pitch - Math.round(v / CONFIG.pitch)) * CONFIG.pitch;
    return r <= CONFIG.roadHalf + 2;
  };
  return near(x) || near(z);
}

// Push a circle (x, z, radius r) out of every building AABB it overlaps.
// Mutates and returns the position object; also reports whether it hit.
export function resolveBuildings(pos, r, colliders) {
  let hit = false;
  for (let i = 0; i < colliders.length; i++) {
    const b = colliders[i];
    const cx = Math.max(b.minX, Math.min(pos.x, b.maxX));
    const cz = Math.max(b.minZ, Math.min(pos.z, b.maxZ));
    const dx = pos.x - cx;
    const dz = pos.z - cz;
    const d2 = dx * dx + dz * dz;
    if (d2 >= r * r) continue;
    hit = true;
    if (d2 > 1e-6) {
      const d = Math.sqrt(d2);
      pos.x = cx + (dx / d) * r;
      pos.z = cz + (dz / d) * r;
    } else {
      // Centre inside the box: shove out along the smallest penetration.
      const pl = pos.x - b.minX;
      const pr = b.maxX - pos.x;
      const pt = pos.z - b.minZ;
      const pb = b.maxZ - pos.z;
      const m = Math.min(pl, pr, pt, pb);
      if (m === pl) pos.x = b.minX - r;
      else if (m === pr) pos.x = b.maxX + r;
      else if (m === pt) pos.z = b.minZ - r;
      else pos.z = b.maxZ + r;
    }
  }
  return hit;
}
