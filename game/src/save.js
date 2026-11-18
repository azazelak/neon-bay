// Neon Bay v4 — save: cash, rep, mission progress, tokens, gun and sports
// unlock persist in localStorage. The world itself (traffic, police,
// positions) resets on load; only the player's progress carries over.
const KEY = 'neon-bay-v4';

export function saveGame(s) {
  try {
    localStorage.setItem(KEY, JSON.stringify({
      cash: s.cash, rep: s.rep, missionIndex: s.missionIndex,
      tokens: s.tokens, hasGun: s.hasGun, sports: s.sports,
    }));
  } catch (e) { /* storage unavailable: play on without saving */ }
}

export function loadGame() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const d = JSON.parse(raw);
    if (typeof d.cash !== 'number') return null;
    return d;
  } catch (e) { return null; }
}

export function clearSave() {
  try { localStorage.removeItem(KEY); } catch (e) { /* ignore */ }
}
