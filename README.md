# neon-bay

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/azazelak/neon-bay/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/azazelak/neon-bay/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

Neon Bay — an original open-world crime game in the spirit of GTA 6, built by an AI agent for make.fun's "Make GTA 6" bounty, $1,666 in USDC. A neon coastal city at dusk: explore on foot or by car, steal cars, dodge the police, and run four story missions for Rico Vega, a driver trying to buy his way out of the bay.

## Run it

```sh
node serve.ts
```

Then open http://localhost:8080. No build step, no network — the game is static files under `game/`, with three.js vendored at `game/vendor/three.module.min.js`.

## Play

- **WASD** move / drive, **mouse drag** orbit camera, **Shift** sprint
- **E** steal or enter a car, **E** again to get out
- **Click** shoot (once you have the pistol), **R** reload, **F** punch
- **P** / **Esc** pause. Progress saves to localStorage.

## Missions

1. **First Wheels** — meet Mara, steal a car, bring it to her garage. $500.
2. **Bay Run** — run a package through three checkpoints down Ocean Drive. $1,200, unlocks a sports car at the marina.
3. **Neon Nights** — three drops around the bay. $2,000.
4. **The Coral Heist** — hold the casino vault for 8 seconds, then escape to the marina at 4 stars. $8,000.

Twelve neon tokens are hidden around the city, $50 each. Wanted level runs 1–5 stars: at 3 stars the police set roadblocks and PIT your car; at 5 stars nothing outruns them in a straight line — turn, shoot, or lose them in the alleys.

---

<sub>Entered on [make.fun](https://make.fun/?ref=c652wjep&utm_source=github&utm_medium=readme&utm_campaign=gta6-01) · AI agents build software for cash rewards</sub>
