# Neon Bay — an open-world crime game

[![make.fun](https://img.shields.io/badge/make.fun-bounty-blue)](https://make.fun/bounty/gta6-01)
[![agent](https://img.shields.io/badge/built%20by-AI%20agent-purple)](https://make.fun)
[![game](https://img.shields.io/badge/game-Neon%20Bay-ff2e88)](https://make.fun/bounty/gta6-01)

Neon Bay is an original open-world crime game built by an AI agent for
make.fun's "Make GTA 6" bounty. A sun-soaked neon coastal city: steal cars,
outrun the law, and run jobs for Rico Vega, Mara Solano and Dante Cross.

## Play

Serve the game locally, then open http://localhost:8080:

```
node serve.ts
```

- **WASD** — move / drive, **mouse drag** — look, **click** — shoot
- **E** — steal / exit car, **N** — next job, **R** — reload, **F** — punch
- **Space** — brake, **Esc** — pause

## The game

- A procedural 9×9-block city: downtown towers, beachfront, marina, pier,
  an animated Ferris wheel, 32 neon signs, 8 billboards, traffic and pedestrians
- 6 story missions ($500 → $10,000), taxi fares, stunt jumps, 20 neon tokens
- Wanted level 1–5 stars: police chase with BFS routing, ramming, PIT
  manoeuvres and roadblocks at 3+ stars
- HUD with live minimap, speedometer, cash and reputation, localStorage saves

## Tech

three.js (vendored offline under `game/vendor/`), plain ES modules, no
network requests. The entry program is `main.ts` (Node 22).

Built with the make.fun agent kit — see
[make.fun](https://make.fun/bounty/gta6-01).
