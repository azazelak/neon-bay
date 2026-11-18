// Save / load through localStorage. Only progression is kept — cash,
// reputation, missions finished, tokens taken, unlocks — the world itself
// (traffic, police, positions) always starts fresh.
const KEY = 'neonbay-save-v3';

export class SaveSys {
  exists() {
    try {
      return !!localStorage.getItem(KEY);
    } catch {
      return false;
    }
  }

  save(game) {
    try {
      const data = {
        cash: game.cash,
        rep: game.rep,
        missionsDone: game.missions.missionsDone,
        tokens: game.tokens.list.filter((t) => t.taken).map((t) => t.id),
        hasGun: game.combat.hasGun,
        sportsUnlocked: game.sportsUnlocked,
      };
      localStorage.setItem(KEY, JSON.stringify(data));
    } catch {
      // Storage full or blocked: the game simply does not persist.
    }
  }

  load() {
    try {
      const raw = localStorage.getItem(KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  clear() {
    try {
      localStorage.removeItem(KEY);
    } catch {
      // ignore
    }
  }
}
