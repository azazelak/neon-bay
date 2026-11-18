// Neon Bay v5c — localStorage save / load (cash, rep, tokens, missions done).
export class SaveSys {
  constructor(game) {
    this.game = game;
    this.key = 'neon-bay-v5c-save';
  }

  save() {
    try {
      localStorage.setItem(this.key, JSON.stringify({
        cash: this.game.cash,
        rep: this.game.rep,
        missionsDone: this.game.missions.done,
        tokens: this.game.tokens.count,
      }));
    } catch (e) { /* storage unavailable */ }
  }

  load() {
    try {
      const raw = localStorage.getItem(this.key);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch (e) { return null; }
  }

  clear() {
    try { localStorage.removeItem(this.key); } catch (e) { /* ignore */ }
  }
}
