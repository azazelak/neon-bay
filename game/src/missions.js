// Neon Bay v4 — six story missions with Rico Vega, Mara Solano and Dante
// Cross. The state machine is idle -> active -> complete() -> idle, so a
// finished mission can never park the chain in a dead state. Targets always
// sit on roads (never inside buildings). The vault hold rings the casino
// with police instead of ramming the player.
import { PLACES, MISSION_PAY } from './config.js';

const MISSIONS = [
  {
    name: 'First Wheels', giver: 'Mara Solano',
    brief: 'Steal a car, then drive it to Mara\'s garage.',
    stages: [
      { text: 'Steal a car (walk up and press E)', need: 'car' },
      { text: 'Drive the car to Mara\'s garage', target: PLACES.garage, r: 10 },
    ],
    reward: 'Pistol unlocked',
  },
  {
    name: 'Bay Run', giver: 'Mara Solano',
    brief: 'Grab the package on Ocean Drive and run 3 checkpoints.',
    stages: [
      { text: 'Pick up the package on Ocean Drive', target: PLACES.package, r: 10 },
      { text: 'Checkpoint 1 of 3 — Ocean Drive', target: { x: 384, z: 288 }, r: 10 },
      { text: 'Checkpoint 2 of 3 — Ocean Drive', target: { x: 384, z: 0 }, r: 10 },
      { text: 'Checkpoint 3 of 3 — Ocean Drive', target: { x: 384, z: -288 }, r: 10 },
    ],
    reward: 'Sports car at the marina',
  },
  {
    name: 'Neon Nights', giver: 'Dante Cross',
    brief: 'Pick up at Club Volt, then make 3 drops across the bay.',
    stages: [
      { text: 'Pick up the goods at Club Volt', target: PLACES.club, r: 10 },
      { text: 'Drop 1 of 3 — North Docks', target: PLACES.drop1, r: 10 },
      { text: 'Drop 2 of 3 — Market Row', target: PLACES.drop2, r: 10 },
      { text: 'Drop 3 of 3 — Ocean Drive', target: PLACES.drop3, r: 10 },
    ],
    reward: 'Rep +20',
  },
  {
    name: 'Taxi Rush', giver: 'Mara Solano',
    brief: 'Three fares, 150 seconds. Get in a taxi and go.',
    stages: [
      { text: 'Get in the taxi by the garage', need: 'taxi' },
      { text: 'Complete 3 fares before the clock runs out', need: 'fares', count: 3, time: 150 },
    ],
    reward: 'Rep +15',
  },
  {
    name: 'The Coral Heist', giver: 'Dante Cross',
    brief: 'Hit Casino Luna, hold the vault 8 seconds, escape to the marina.',
    stages: [
      { text: 'Get to Casino Luna', target: PLACES.casino, r: 10 },
      { text: 'Hold the vault — stay in the ring!', need: 'hold', hold: 8, target: PLACES.casino, r: 11 },
      { text: 'Escape to the Marina — 4 stars!', target: PLACES.marina, r: 12 },
    ],
    reward: 'Rep +30',
  },
  {
    name: 'Skyline Drop', giver: 'Dante Cross',
    brief: 'Drive to Coral Tower, grab the drop on foot, escape to the pier at 5 stars.',
    stages: [
      { text: 'Drive to Coral Tower', target: PLACES.helipad, r: 10 },
      { text: 'On foot — grab the drop at the tower door', need: 'foot', target: { x: -180, z: 144 }, r: 5 },
      { text: 'Escape to the Neon Bay Pier — 5 stars!', target: { x: 438, z: 0 }, r: 10 },
    ],
    reward: 'Neon Bay is yours',
  },
];

export function createMissions(cb) {
  // cb: {onUnlockPistol, onSpawnSports, onSpawnTaxi, onSetWanted, onStandoff,
  //      onMessage, onPay}
  let index = 0; // next mission to start
  let state = 'idle'; // idle | active
  let stage = 0;
  let holdT = 0, stageTimer = 0, faresAtStart = 0;
  let complete = false;

  function current() { return MISSIONS[index] || null; }

  function start() {
    const m = current();
    if (!m || state !== 'idle') return false;
    state = 'active'; stage = 0; holdT = 0; stageTimer = 0;
    faresAtStart = cb.faresDone ? cb.faresDone() : 0;
    if (m.name === 'Taxi Rush' && cb.onSpawnTaxi) cb.onSpawnTaxi();
    if (cb.onMessage) cb.onMessage(m.name + ' — ' + m.brief);
    return true;
  }

  function stageTarget() {
    const m = current();
    if (!m) return null;
    return m.stages[stage] ? m.stages[stage].target || null : null;
  }

  function objectiveText() {
    if (state !== 'active') {
      if (complete) return 'Story complete — Neon Bay is yours!';
      const m = current();
      return m ? 'Next: ' + m.name + ' — press N to start' : 'No missions left';
    }
    const m = current();
    const s = m.stages[stage];
    let text = s.text;
    if (s.need === 'hold') text += ' ' + Math.max(0, s.hold - holdT).toFixed(1) + 's';
    if (s.need === 'fares') {
      const done = (cb.faresDone ? cb.faresDone() : 0) - faresAtStart;
      text += ' (' + Math.max(0, done) + '/' + s.count + ') ' + Math.max(0, Math.ceil(stageTimer)) + 's';
    }
    return m.name + ': ' + text;
  }

  function completeMission() {
    const m = current();
    const pay = MISSION_PAY[index];
    if (cb.onPay) cb.onPay(pay);
    if (m.name === 'First Wheels' && cb.onUnlockPistol) cb.onUnlockPistol();
    if (m.name === 'Bay Run' && cb.onSpawnSports) cb.onSpawnSports();
    if (cb.onMessage) cb.onMessage(m.name + ' complete! +$' + pay + ' — ' + m.reward);
    index++;
    state = 'idle'; stage = 0; holdT = 0;
    if (cb.onStandoff) cb.onStandoff(null);
    if (index >= MISSIONS.length) complete = true;
  }

  function update(dt, ctx) {
    // ctx: {x, z, inCar, carKind, onFoot, speed}
    if (state !== 'active') return;
    const m = current();
    if (!m) return;
    const s = m.stages[stage];
    if (!s) { completeMission(); return; }
    if (s.need === 'car') {
      if (ctx.inCar) { stage++; }
      return;
    }
    if (s.need === 'taxi') {
      if (ctx.inCar && ctx.carKind === 'taxi') { stage++; stageTimer = s.time || 150; if (m.stages[stage]) stageTimer = m.stages[stage].time || 150; }
      return;
    }
    if (s.need === 'fares') {
      stageTimer -= dt;
      const done = (cb.faresDone ? cb.faresDone() : 0) - faresAtStart;
      if (done >= s.count) { completeMission(); return; }
      if (stageTimer <= 0) {
        if (cb.onMessage) cb.onMessage('Taxi Rush failed — out of time.');
        state = 'idle'; stage = 0;
        return;
      }
      return;
    }
    if (s.need === 'hold') {
      const d = Math.hypot(ctx.x - s.target.x, ctx.z - s.target.z);
      if (d < s.r) {
        if (holdT === 0 && cb.onStandoff) cb.onStandoff({ x: s.target.x, z: s.target.z, r: 11 });
        if (holdT === 0 && cb.onSetWanted) cb.onSetWanted(3);
        holdT += dt;
        if (holdT >= s.hold) {
          if (cb.onStandoff) cb.onStandoff(null);
          if (cb.onSetWanted) cb.onSetWanted(4);
          stage++;
        }
      } else {
        holdT = Math.max(0, holdT - dt * 2);
        if (holdT === 0 && cb.onStandoff) cb.onStandoff(null);
      }
      return;
    }
    if (s.need === 'foot') {
      if (!ctx.inCar) {
        const d = Math.hypot(ctx.x - s.target.x, ctx.z - s.target.z);
        if (d < s.r) {
          if (cb.onSetWanted) cb.onSetWanted(5);
          stage++;
        }
      }
      return;
    }
    if (s.target) {
      const d = Math.hypot(ctx.x - s.target.x, ctx.z - s.target.z);
      if (d < s.r) { stage++; if (stage >= m.stages.length) completeMission(); }
    }
  }

  // Debug/test hooks: jump the chain (save restore, screenshot staging).
  function setIndex(i) {
    index = Math.min(i, MISSIONS.length);
    state = 'idle'; stage = 0; holdT = 0;
    complete = index >= MISSIONS.length;
  }
  function setState(idx, stg, hold) {
    index = idx; stage = stg; state = 'active'; holdT = hold || 0; stageTimer = 0;
    complete = false;
  }

  return {
    get index() { return index; },
    get state() { return state; },
    get stage() { return stage; },
    get complete() { return complete; },
    get total() { return MISSIONS.length; },
    get currentName() { const m = current(); return m ? m.name : ''; },
    start, update, stageTarget, objectiveText, setIndex, setState,
  };
}
