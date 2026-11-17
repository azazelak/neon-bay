// Neon Bay — tuning and world constants. One place for every number the
// systems share, so a tweak here retunes the whole game.
export const CFG = {
  seed: 1337,
  // City grid: 9 x 9 blocks, pitch 52 (40 block + 12 road).
  blocks: 9,
  blockPitch: 52,
  blockSize: 40,
  roadWidth: 12,
  worldHalf: 260, // playable bounds (beach + ocean beyond +z)
  beachZ: 236, // sand starts here, ocean plane beyond worldHalf
  // Sun-soaked dusk: warm low sun, pink-orange sky, neon signs.
  sunColor: 0xffb36b,
  sunIntensity: 2.6,
  hemiSky: 0xffd9a0,
  hemiGround: 0x2a1e3f,
  hemiIntensity: 1.25,
  fogColor: 0x2c1e3a,
  fogNear: 120,
  fogFar: 520,
  // Player on foot.
  walkSpeed: 6,
  sprintSpeed: 10,
  playerRadius: 0.6,
  playerHealth: 100,
  // Cars (arcade physics).
  carAccel: 16,
  carBrake: 30,
  carMaxSpeed: 34, // sports 42
  carReverseMax: 10,
  carTurn: 1.9,
  carRadius: 1.6,
  trafficCount: 20,
  trafficSpeed: 9,
  pedCount: 36,
  pedSpeed: 1.6,
  // Neon tokens: collectibles that pay cash (side activity).
  tokenCount: 12,
  tokenReward: 50,
  // Police pursuit: cruisers must be able to catch a fleeing player.
  // Speed cap per wanted level: 26 + 3.6 * level (L1 29.6 … L5 44).
  policeBaseSpeed: 26,
  policeSpeedPerStar: 3.6,
  policeTopSpeed: 44,
  roadblockMinStars: 3,
  // Wanted system.
  heatPerStar: 20,
  maxWanted: 5,
  heatStealCar: 20, // one full star: stealing a car always brings the cops
  heatHitPed: 25,
  heatShoot: 20,
  heatHitCop: 30,
  heatPunch: 8,
  heatDecay: 2.0, // per second while unseen
  bustTime: 1.2, // seconds a cop must hold the player to bust them
  // Combat.
  punchDamage: 15,
  punchRange: 2.2,
  gunDamage: 34,
  gunRange: 45,
  gunMagazine: 12,
  // Missions.
  missionReward: [500, 1200, 2000, 8000],
  // HUD / minimap.
  minimapSize: 180,
  // Camera.
  camDistFoot: 7,
  camDistCar: 10,
  camHeightFoot: 3.2,
  camHeightCar: 4.2,
};

// Neon palette for the city: building glass, signs, cars, UI accents.
export const PALETTE = {
  asphalt: '#3d3d4d',
  sidewalk: '#5a5a68',
  blockTop: '#43435a',
  sand: '#c9a86a',
  ocean: '#1d4e6b',
  windowLit: ['#ffd27a', '#9fd8ff', '#ff9d6b', '#c9f2ff', '#ffb3d9'],
  windowDark: '#1c2030',
  neon: ['#ff2d78', '#00e5ff', '#ffe600', '#7cff00', '#ff6a00', '#b967ff'],
  carColors: [0xd23b3b, 0x2b6fd6, 0xe8b93a, 0x37c978, 0xe8e8e8, 0x222226, 0x8a4fd0, 0xff7a1a],
  policeWhite: 0xf2f2f2,
  policeBlack: 0x14141a,
};
