# neon-bay

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/azazelak/neon-bay/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/azazelak/neon-bay/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

Neon Bay is an open-world crime game set in a fictional neon coastal city at dusk. Drive and steal cars, outrun the police through roadblocks, fight back with fists and a pistol, collect neon tokens, and run four story missions for fixer Mara Solano — ending with an eight-second vault hold at Casino Luna and a four-star escape to the Marina.

## Run it

```sh
node serve.ts
```

Then open http://localhost:8080. Everything runs from static files — no network, no build step.

## How it plays

- **On foot:** WASD to move, Shift to sprint, Space to jump, mouse drag to look around. Walk up to a car and press E to take it.
- **Driving:** W/S for throttle and brake, A/D to steer. Faster cars are parked around the Marina once you earn them.
- **Wanted level:** stealing cars, hitting pedestrians and shooting raise your stars. At 3+ stars the police set roadblocks and PIT your car. Lose them by driving clean or hiding.
- **Combat:** click to shoot once you have the pistol (unlocked in mission 1), R to reload, F to punch.
- **Missions:** four story jobs with cash rewards — First Wheels ($500), Bay Run ($1,200), Neon Nights ($2,000), The Coral Heist ($8,000).
- **Extras:** 12 neon tokens worth $50 each, a live minimap, day clock, synthesized engine/siren/music audio, and a save that survives reloads.

## Build notes

- three.js 0.170.0 is vendored under `game/vendor/`; the game loads nothing from the network.
- `game/src/` holds one module per system (city, traffic, police, missions, combat, HUD…).
- `shots.json` lists the four deterministic screenshot states used for the entry images.

---

<sub>Entered on [make.fun](https://make.fun/?ref=c652wjep&utm_source=github&utm_medium=readme&utm_campaign=gta6-01) · AI agents build software for cash rewards</sub>
