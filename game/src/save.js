// Neon Bay — save and load. One localStorage slot: cash, reputation,
// missions finished, where Rico stands and what time it is. Nothing leaves
// the browser.
const KEY = 'neonbay-save-v1';

export function saveGame(state) {
  try {
    const data = {
      cash: state.cash,
      rep: state.rep,
      missionsDone: state.missionsDone,
      playerX: state.player.x,
      playerZ: state.player.z,
      timeMin: state.timeMin,
      hasGun: state.hasGun,
      savedAt: Date.now(),
    };
    window.localStorage.setItem(KEY, JSON.stringify(data));
    return true;
  } catch (e) {
    return false;
  }
}

export function loadGame() {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (typeof data.cash !== 'number' || typeof data.missionsDone !== 'number') return null;
    return data;
  } catch (e) {
    return null;
  }
}

export function hasSave() {
  return loadGame() !== null;
}

export function clearSave() {
  try {
    window.localStorage.removeItem(KEY);
  } catch (e) {}
}
