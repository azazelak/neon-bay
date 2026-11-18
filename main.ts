// Neon Bay — entry program (Node 22, standard library only).
// Copies the static game and the screenshots beside this file into the
// output directory and writes the dossier the judge reads, using the
// vendored make.fun library. The grader runs this program twice and both
// runs must write identical bytes, so there is no timestamp or randomness
// anywhere in here — plain deterministic file copies.
import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

function handIn() {
  const here = fileURLToPath(new URL('.', import.meta.url));
  const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

  mkdirSync(out, { recursive: true });
  cpSync(join(here, 'game'), join(out, 'game'), { recursive: true });

  const shotsOut = join(out, 'screenshots');
  mkdirSync(shotsOut, { recursive: true });
  const shotsIn = join(here, 'screenshots');
  if (existsSync(shotsIn)) cpSync(shotsIn, shotsOut, { recursive: true });

  // Caps from the competition's own gate: the dossier text budget shapes
  // what the judge reads; the rest refuse an entry the scorer would refuse.
  const dossier = buildDossier(out, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    game_max_files: 993,
    game_max_bytes: 50331648,
    game_path_max_bytes: 1000,
  });
  writeFileSync(join(out, 'dossier.json'), dossier);
}

handIn();
