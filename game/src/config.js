// Neon Bay v5c — world, car, economy and mission tuning (fresh numbers).
export const CFG = {
  world: 180,            // land half-extent; sea beyond z > 180
  beachZ: 160,           // beach strip starts here
  seaZ: 180,
  roadStep: 40,
  roadHalf: 6,           // 12 m wide roads
  gridMin: -160,
  gridMax: 160,
  timeScale: 1,

  carKinds: {
    sedan:   { top: 34, acc: 15, turn: 1.9, color: 0x8a97a8 },
    sports:  { top: 41, acc: 19, turn: 2.2, color: 0xff6a1a },
    taxi:    { top: 33, acc: 14, turn: 1.9, color: 0xf5c400 },
    van:     { top: 29, acc: 11, turn: 1.6, color: 0x5a6b7d },
    muscle:  { top: 37, acc: 17, turn: 1.8, color: 0x7a1f2b },
    pickup:  { top: 32, acc: 13, turn: 1.7, color: 0x2e6b4f },
    cruiser: { top: 38, acc: 17, turn: 2.0, color: 0x11151c },
  },
  policeTop: (level) => Math.min(44, 26 + level * 3.6),
  wantedHeatPerStar: 40,
  tokenValue: 50,
  jumpValue: 100,
  fareBase: 60,
  farePerMetre: 0.25,

  // Mission chain: name, payout, client, stages.
  // stage: {kind:'steal'} | {kind:'drive', x, z, label} | {kind:'hold', x, z, secs, label} | {kind:'taxi', count}
  missions: [
    {
      name: 'First Wheels', pay: 500, client: 'Rico Vega',
      intro: 'Rico needs wheels. Steal a car, then bring it to his garage.',
      stages: [
        { kind: 'steal', label: 'Steal a car — press E near a car' },
        { kind: 'drive', x: -120, z: -120, label: 'Drive to Rico’s garage' },
      ],
    },
    {
      name: 'Bay Run', pay: 1200, client: 'Rico Vega',
      intro: 'A package for the docks. Two stops, no questions.',
      stages: [
        { kind: 'drive', x: 120, z: -40, label: 'Drive to the north docks' },
        { kind: 'drive', x: 160, z: 120, label: 'Drive to the marina gate' },
      ],
    },
    {
      name: 'Neon Nights', pay: 2000, client: 'Mara Solano',
      intro: 'Mara wants the skyline lit. Two stops, then hold the plaza.',
      stages: [
        { kind: 'drive', x: -40, z: 40, label: 'Drive to the plaza lookout' },
        { kind: 'drive', x: 0, z: -80, label: 'Drive to the plaza' },
        { kind: 'hold', x: 0, z: -80, secs: 5, label: 'Hold the plaza — stay in the ring!' },
      ],
    },
    {
      name: 'Taxi Rush', pay: 1500, client: 'Mara Solano',
      intro: 'Three fares, one shift. Keep the meter running.',
      stages: [
        { kind: 'taxi', count: 3, label: 'Taxi Rush — hail a fare' },
      ],
    },
    {
      name: 'Coral Heist', pay: 8000, client: 'Dante Cross',
      intro: 'The Coral Bank vault. Hold the ring while the crew works.',
      stages: [
        { kind: 'drive', x: 40, z: 80, label: 'Drive to the Coral Bank' },
        { kind: 'hold', x: 40, z: 80, secs: 8, label: 'Hold the vault — stay in the ring!' },
        { kind: 'drive', x: -160, z: 160, label: 'Escape to the beach hideout' },
      ],
    },
    {
      name: 'Skyline Drop', pay: 10000, client: 'Dante Cross',
      intro: 'Last job. The drop is at the end of the pier — drive it there.',
      stages: [
        { kind: 'drive', x: 135, z: 238, label: 'Drive to the pier-end drop' },
        { kind: 'hold', x: 135, z: 238, secs: 5, label: 'Hold the drop — stay in the ring!' },
      ],
    },
  ],

  signs: [
    'NEON BAY', 'CASINO LUNA', 'HOTEL MIRA', 'CLUB VOLT', 'TACOS EL CAMINO',
    'MARINA', 'PIER 9', 'SUNSET GRILL', 'BAR NEON', 'HOTEL CORAL', 'ARCADE',
    'DISCO SOL', 'RAMEN 24H', 'CINEMA ROXY', 'GYM IRON', 'DONUT KING',
  ],
  billboards: [
    'NEON BAY — OWN THE NIGHT', 'CASINO LUNA — WIN BIG', 'HOTEL MIRA — STAY GOLD',
    'TACOS EL CAMINO', 'MARINA — BOATS & SUNSETS', 'CLUB VOLT — ALL NIGHT',
    'PIER 9 — FISH & FUN', 'SUNSET GRILL — EAT THE VIEW',
  ],
};
