// Neon Bay v4 — all tuning, palette, car kinds, grid helpers, named places.
// One grid: avenues at x = k*96 and streets at z = k*96, k in -4..4. Blocks
// sit between them; the marina, beach and ocean lie east of x = 432.
export const PITCH = 96;
export const ROAD_W = 18;
export const GRID_K = 4; // avenues/streets at -384..384
export const CITY_EDGE = 432;
export const BEACH_X = 470;
export const OCEAN_X = 1200;
export const WORLD_R = 640; // minimap / culling radius

export const PALETTE = {
  skyTop: 0x2e4a7a, skyMid: 0xff9a5c, skyLow: 0xffc98a,
  sun: 0xffd9a0, fog: 0xe08a5a,
  ground: 0x4a4a52, road: 0x3d4149, sidewalk: 0x6a6a72,
  sand: 0xd9b380, ocean: 0x2a6f8f, oceanDeep: 0x1d4f6e,
  buildingA: 0x8a7f8d, buildingB: 0x6f7a8c, buildingC: 0x9c8a7a,
  buildingD: 0x7a6a7a, glass: 0x2c3e55, roof: 0x3a3340,
  neonPink: 0xff2e88, neonCyan: 0x19e3ff, neonGold: 0xffc233,
  neonGreen: 0x39ff88, neonPurple: 0xb44dff, neonOrange: 0xff7a2e,
};

export const CAR_KINDS = {
  sedan:  { top: 34, accel: 22, grip: 2.6, len: 4.4, wid: 2.0, color: 0x3f6fb5, name: 'sedan' },
  sports: { top: 41, accel: 30, grip: 3.1, len: 4.5, wid: 2.0, color: 0xff7a1a, name: 'sports' },
  taxi:   { top: 33, accel: 21, grip: 2.6, len: 4.4, wid: 2.0, color: 0xffc233, name: 'taxi' },
  van:    { top: 29, accel: 17, grip: 2.2, len: 5.2, wid: 2.2, color: 0x8a8f96, name: 'van' },
  muscle: { top: 38, accel: 27, grip: 2.8, len: 4.7, wid: 2.1, color: 0x8a1a2e, name: 'muscle' },
  pickup: { top: 35, accel: 23, grip: 2.5, len: 4.9, wid: 2.1, color: 0x2e6b4f, name: 'pickup' },
  cruiser:{ top: 44, accel: 30, grip: 4.5, len: 4.6, wid: 2.0, color: 0x14161c, name: 'cruiser' },
};

// Police top speed by wanted level: 29.6 at 1 star up to 44 at 5.
export function policeTop(wanted) { return Math.min(44, 26 + wanted * 3.6); }

// Named places. Every target sits ON a road (avenue x or street z a multiple
// of 96) or on the pier, never inside a building footprint.
export const PLACES = {
  garage:   { x: -192, z: 240,  label: "Mara's Garage" },
  package:  { x: 96,   z: 288,  label: 'Ocean Drive Package' },
  club:     { x: -96,  z: -48,  label: 'Club Volt' },
  casino:   { x: 192,  z: -144, label: 'Casino Luna' },
  marina:   { x: 384,  z: 96,   label: 'Neon Bay Marina' },
  helipad:  { x: -192, z: 144,  label: 'Coral Tower Helipad' },
  pier:     { x: 520,  z: 0,    label: 'Neon Bay Pier' },
  plaza:    { x: 48,   z: 48,   label: 'Fountain Plaza' },
  drop1:    { x: 288,  z: -288, label: 'Drop 1 — North Docks' },
  drop2:    { x: -288, z: 96,   label: 'Drop 2 — Market Row' },
  drop3:    { x: 0,    z: 288,  label: 'Drop 3 — Ocean Drive' },
  taxiStand:[{ x: -288, z: -288 }, { x: 288, z: 192 }, { x: -96, z: 288 }, { x: 192, z: 288 }],
};

export const MISSION_PAY = [500, 1200, 2000, 1500, 8000, 10000];
export const TOKEN_PAY = 50;
export const TOKEN_COUNT = 20;
export const FARE_PAY = [60, 80, 100, 120];
export const STUNT_PAY = 100;

export function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
export function lerp(a, b, t) { return a + (b - a) * t; }
export function dist2(ax, az, bx, bz) { const dx = ax - bx, dz = az - bz; return dx * dx + dz * dz; }
export function angleLerp(a, b, t) {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
}
// Nearest point on the road grid to (x, z): snap to the closest avenue/street.
export function nearestRoad(x, z) {
  const rx = Math.round(x / PITCH) * PITCH;
  const rz = Math.round(z / PITCH) * PITCH;
  return Math.abs(x - rx) < Math.abs(z - rz) ? { x: rx, z } : { x, z: rz };
}
export function roadNode(x, z) { return { x: Math.round(x / PITCH), z: Math.round(z / PITCH) }; }
