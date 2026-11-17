# neon-bay

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/azazelak/neon-bay/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/azazelak/neon-bay/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

**Neon Bay** — a three.js open-world crime game in a fictional neon coastal city, built from scratch for the make.fun GTA 6 bounty. Rico Vega is back in town with nothing; Mara Solano, the fixer who runs the night, has work for him — and Dante Cross's Coral Casino is the prize at the end of it.

## What is in the game

- **An open world:** a seeded 9×9-block city with roads, sidewalks, crosswalks, traffic lights, neon signs with real text, billboards, a marina with a pier and boats, a market street with awnings, rooftop water towers and antennas, a helipad, palms, a beach and an ocean, all procedural — no assets from any commercial game.
- **On foot and by car:** third-person WASD movement with a mouse-orbit camera, sprint and jump; arcade driving with steering, braking and reversing. Press **E** to steal any parked or traffic car (and watch the wanted level jump). Sedans, taxis, sports cars, muscle cars, pickups, vans and trucks all drive.
- **Traffic and pedestrians:** 20 cars follow the road grid and brake for the car ahead; 36 pedestrians with varied clothes, skin and hair stroll the sidewalks and run from gunfire and chases.
- **Wanted level (1–5 stars):** stealing, hitting pedestrians, shooting and punching cops all add heat. Police cars are fast enough to catch you now — they chase, ram and PIT you, and at 3+ stars they throw up roadblocks across the road ahead. Foot cops run you down and arrest you; at 3+ stars they open fire. Lay low and the heat cools off.
- **Four story missions:** *First Wheels* (steal a car for Mara), *Bay Run* (a getaway through three checkpoints at 2 stars), *Neon Nights* (three drops across the city), *The Coral Heist* (rob the casino vault and escape to the marina boat at 4 stars). Briefings, beacons, timers, success/fail states.
- **Side activity:** 12 neon tokens hidden around the city — the pier, the promenade, the marina — each pays $50. Find them all between jobs.
- **Progression:** cash and reputation per job; a pistol after the first job; a sports car unlocked at the marina after the second.
- **Combat:** fists up close, hitscan pistol with tracers, muzzle smoke, health that regenerates out of combat.
- **HUD + live minimap:** health, cash, rep, clock, wanted stars, mission objective, ammo, and a 2D minimap with roads, traffic, police blips and the mission marker.
- **Menus and saves:** start screen, pause menu, busted/wasted screens, and localStorage save/load (cash, rep, missions, position).
- **Sound:** fully synthesized WebAudio — engine hum, police sirens, gunshots, punches, pickups and a synthwave music loop. No audio files.

## Run it

```sh
node serve.ts
```

Then open http://localhost:8080 in desktop Chrome.

Screenshots are staged deterministically from the game's own code: `?shot=chase|street|mission|skyline&seed=1`.

## Layout

```
game/
  index.html            page + HUD
  vendor/three.module.min.js   three.js, vendored offline
  src/
    config.js   tuning + palette      rng.js      seeded random
    city.js     city generation       render.js   renderer/lights/camera
    player.js   on-foot character     vehicles.js car mesh + arcade physics
    traffic.js  traffic + pedestrians police.js   wanted + police AI
    combat.js   melee + pistol        missions.js story + 4 missions
    tokens.js   neon token collectibles
    hud.js      HUD + live minimap    save.js     localStorage save/load
    effects.js  particles + tracers   audio.js    synthesized WebAudio
    input.js    keyboard + mouse      shots.js    screenshot scenes
    main.js     boot + game loop
```

---

<sub>Entered on [make.fun](https://make.fun/?ref=c652wjep&utm_source=github&utm_medium=readme&utm_campaign=gta6-01) · AI agents build software for cash rewards</sub>
