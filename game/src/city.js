// Neon Bay — the city itself. A seeded 9x9 block grid with roads, sidewalks,
// procedural buildings (lit windows, neon signs), palms, street lamps,
// traffic lights, a beach and an ocean, plus the road graph traffic and
// pedestrians drive on and the colliders everything bumps into.
import * as THREE from 'three';
import { CFG, PALETTE } from './config.js';
import { makeRng } from './rng.js';

const WORLD = 520; // world spans -260..260
const TEX = 2048;
const px = (v) => ((v + WORLD / 2) / WORLD) * TEX;

function canvasTexture(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

function windowTexture(rng, litRatio) {
  return canvasTexture(128, 256, (g) => {
    g.fillStyle = '#141824';
    g.fillRect(0, 0, 128, 256);
    const cols = 8;
    const rows = 16;
    const cw = 128 / cols;
    const ch = 256 / rows;
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        if (rng.rand() < litRatio) {
          g.fillStyle = rng.pick(PALETTE.windowLit);
          g.globalAlpha = 0.55 + rng.rand() * 0.45;
        } else {
          g.fillStyle = PALETTE.windowDark;
          g.globalAlpha = 1;
        }
        g.fillRect(x * cw + 2, y * ch + 3, cw - 4, ch - 6);
      }
    }
    g.globalAlpha = 1;
  });
}

function signTexture(text, color, sub) {
  return canvasTexture(512, 128, (g) => {
    g.clearRect(0, 0, 512, 128);
    g.font = '900 64px system-ui, sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.shadowColor = color;
    g.shadowBlur = 26;
    g.fillStyle = color;
    g.fillText(text, 256, sub ? 52 : 64);
    if (sub) {
      g.font = '700 30px system-ui, sans-serif';
      g.shadowBlur = 12;
      g.fillText(sub, 256, 102);
    }
  });
}

function groundTexture(rng, roadLines) {
  return canvasTexture(TEX, TEX, (g) => {
    // Block tops.
    g.fillStyle = PALETTE.blockTop;
    g.fillRect(0, 0, TEX, TEX);
    // Vary each block's shade a little.
    for (let i = 0; i < CFG.blocks; i++) {
      for (let j = 0; j < CFG.blocks; j++) {
        const x0 = px(-CFG.worldHalf + i * CFG.blockPitch + CFG.roadWidth / 2);
        const z0 = px(-CFG.worldHalf + j * CFG.blockPitch + CFG.roadWidth / 2);
        const s = CFG.blockPitch - CFG.roadWidth;
        const shade = 58 + Math.floor(rng.rand() * 16);
        g.fillStyle = `rgb(${shade},${shade + 2},${shade + 14})`;
        g.fillRect(x0, z0, px(s) - px(0) + 0, px(s) - px(0));
      }
    }
    // Sidewalks (lighter strips flanking every road).
    g.fillStyle = PALETTE.sidewalk;
    for (const c of roadLines) {
      g.fillRect(px(c - CFG.roadWidth / 2 - 2), 0, px(CFG.roadWidth + 4) - px(0), TEX);
      g.fillRect(0, px(c - CFG.roadWidth / 2 - 2), TEX, px(CFG.roadWidth + 4) - px(0));
    }
    // Asphalt.
    g.fillStyle = PALETTE.asphalt;
    for (const c of roadLines) {
      g.fillRect(px(c - CFG.roadWidth / 2), 0, px(CFG.roadWidth) - px(0), TEX);
      g.fillRect(0, px(c - CFG.roadWidth / 2), TEX, px(CFG.roadWidth) - px(0));
    }
    // Lane dashes.
    g.fillStyle = '#d8c25a';
    for (const c of roadLines) {
      for (let d = -CFG.worldHalf + 8; d < CFG.worldHalf; d += 16) {
        g.fillRect(px(c) - 1.5, px(d), 3, px(7) - px(0));
        g.fillRect(px(d), px(c) - 1.5, px(7) - px(0), 3);
      }
    }
    // Crosswalks at every intersection.
    g.fillStyle = 'rgba(235,235,235,0.85)';
    for (const cx of roadLines) {
      for (const cz of roadLines) {
        for (let k = -2; k <= 2; k++) {
          g.fillRect(px(cx + k * 2.2) - 2, px(cz - CFG.roadWidth / 2), 4, px(3) - px(0));
          g.fillRect(px(cx + k * 2.2) - 2, px(cz + CFG.roadWidth / 2 - 3), 4, px(3) - px(0));
          g.fillRect(px(cx - CFG.roadWidth / 2), px(cz + k * 2.2) - 2, px(3) - px(0), 4);
          g.fillRect(px(cx + CFG.roadWidth / 2 - 3), px(cz + k * 2.2) - 2, px(3) - px(0), 4);
        }
      }
    }
    // Beach sand at the south edge.
    g.fillStyle = PALETTE.sand;
    g.fillRect(0, px(CFG.beachZ), TEX, TEX - px(CFG.beachZ));
    g.fillStyle = 'rgba(255,255,255,0.35)';
    for (let i = 0; i < 40; i++) {
      g.fillRect(rng.rand() * TEX, px(CFG.beachZ) + rng.rand() * (TEX - px(CFG.beachZ)), 3, 3);
    }
  });
}

function skyTexture() {
  return canvasTexture(1024, 512, (g, w, h) => {
    const grad = g.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, '#1a1440');
    grad.addColorStop(0.42, '#5b2a6e');
    grad.addColorStop(0.62, '#ff7a4d');
    grad.addColorStop(0.78, '#ffb36b');
    grad.addColorStop(1, '#2c1e3a');
    g.fillStyle = grad;
    g.fillRect(0, 0, w, h);
    // Low sun, west.
    const sx = w * 0.22;
    const sy = h * 0.66;
    const sun = g.createRadialGradient(sx, sy, 4, sx, sy, 90);
    sun.addColorStop(0, 'rgba(255,240,200,1)');
    sun.addColorStop(0.25, 'rgba(255,180,90,0.9)');
    sun.addColorStop(1, 'rgba(255,120,60,0)');
    g.fillStyle = sun;
    g.fillRect(0, 0, w, h);
    // Early stars up high.
    g.fillStyle = 'rgba(255,255,255,0.8)';
    for (let i = 0; i < 160; i++) {
      const y = Math.random() * h * 0.3;
      g.globalAlpha = 0.3 + Math.random() * 0.7;
      g.fillRect(Math.random() * w, y, 1.6, 1.6);
    }
    g.globalAlpha = 1;
  });
}

export function buildCity(scene, seed = CFG.seed) {
  const rng = makeRng(seed);
  const roadLines = [];
  for (let i = 0; i < CFG.blocks; i++) roadLines.push((i - 4) * CFG.blockPitch);

  const city = {
    roadLines,
    colliders: [],
    buildings: [],
    intersections: [],
    trafficLights: [],
    signs: [],
    ocean: null,
    update(time) {
      // Cycle the traffic lights and shimmer the ocean.
      for (const tl of this.trafficLights) {
        const phase = (time * 0.12 + tl.phase) % 2;
        const nsGreen = phase < 1;
        // MeshBasicMaterial has no emissive slot: swap its colour instead.
        tl.nsMat.color.setHex(nsGreen ? 0x2aff66 : 0xff2a2a);
        tl.ewMat.color.setHex(nsGreen ? 0xff2a2a : 0x2aff66);
      }
      if (this.ocean) this.ocean.material.map.offset.x = time * 0.004;
    },
  };
  for (const cx of roadLines) {
    for (const cz of roadLines) city.intersections.push({ x: cx, z: cz });
  }

  // Sky dome.
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(900, 24, 16),
    new THREE.MeshBasicMaterial({ map: skyTexture(), side: THREE.BackSide, fog: false }),
  );
  scene.add(sky);

  // Ground: one big textured plane (roads, sidewalks, blocks, beach).
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(WORLD, WORLD),
    new THREE.MeshLambertMaterial({ map: groundTexture(rng, roadLines) }),
  );
  ground.rotation.x = -Math.PI / 2;
  scene.add(ground);

  // Ocean beyond the beach.
  const oceanTex = canvasTexture(512, 128, (g, w, h) => {
    const grad = g.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, '#2a7a9e');
    grad.addColorStop(1, '#0e2f4d');
    g.fillStyle = grad;
    g.fillRect(0, 0, w, h);
    g.strokeStyle = 'rgba(255,255,255,0.25)';
    for (let i = 0; i < 24; i++) {
      g.beginPath();
      const y = Math.random() * h;
      g.moveTo(0, y);
      g.bezierCurveTo(w * 0.3, y + 6, w * 0.6, y - 6, w, y);
      g.stroke();
    }
  });
  oceanTex.wrapS = THREE.RepeatWrapping;
  oceanTex.repeat.set(3, 1);
  const ocean = new THREE.Mesh(
    new THREE.PlaneGeometry(WORLD + 400, 220),
    new THREE.MeshBasicMaterial({ map: oceanTex }),
  );
  ocean.rotation.x = -Math.PI / 2;
  ocean.position.set(0, -0.3, CFG.worldHalf + 110);
  scene.add(ocean);
  city.ocean = ocean;

  // Distant skyline silhouettes for depth.
  const silMat = new THREE.MeshBasicMaterial({ color: 0x1a1030, fog: true });
  for (let i = 0; i < 34; i++) {
    const angle = rng.range(0, Math.PI * 2);
    const r = rng.range(320, 480);
    const x = Math.cos(angle) * r;
    const z = Math.sin(angle) * r - 40;
    if (z > CFG.worldHalf + 60) continue; // keep the ocean side open
    const w = rng.range(18, 42);
    const h = rng.range(30, 130);
    const box = new THREE.Mesh(new THREE.BoxGeometry(w, h, w), silMat);
    box.position.set(x, h / 2 - 1, z);
    scene.add(box);
  }

  // Building window materials (shared, 4 variants).
  const winMats = [0.5, 0.65, 0.8, 0.45].map((lit) => {
    const tex = windowTexture(rng, lit);
    return new THREE.MeshLambertMaterial({ map: tex, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 0.75 });
  });
  const roofMat = new THREE.MeshLambertMaterial({ color: 0x23222e });
  const acMat = new THREE.MeshLambertMaterial({ color: 0x3c3c4c });

  const signDefs = [
    ['NEON BAY', '#00e5ff', 'HOTEL & CASINO'],
    ['CORAL CASINO', '#ff2d78', 'SLOTS • TABLES'],
    ['HOTEL PALMA', '#ffe600', 'ROOMS • POOL'],
    ['CLUB VOLT', '#b967ff', 'DANCE ALL NIGHT'],
    ['TACOS', '#ff6a00', 'EL CAMINO'],
    ['RAMEN', '#ff2d78', 'OPEN 24H'],
    ['ARCADE', '#00e5ff', 'PIXEL PALACE'],
    ['MOTEL', '#7cff00', 'VACANCY'],
    ['CINEMA', '#ffe600', 'NEON SCREENS'],
    ['DONUTS', '#ff9d6b', 'FRESH DAILY'],
    ['BAR', '#ff2d78', 'LA PLAYA'],
    ['PIER 9', '#00e5ff', 'FISH • BOATS'],
  ];

  // Buildings, block by block.
  for (let bi = 0; bi < CFG.blocks; bi++) {
    for (let bj = 0; bj < CFG.blocks; bj++) {
      const bx = -CFG.worldHalf + bi * CFG.blockPitch + CFG.roadWidth / 2;
      const bz = -CFG.worldHalf + bj * CFG.blockPitch + CFG.roadWidth / 2;
      const cx = bx + CFG.blockSize / 2;
      const cz = bz + CFG.blockSize / 2;
      const beachRow = bj === CFG.blocks - 1;
      if (beachRow) {
        // Boardwalk palms instead of towers.
        for (let k = 0; k < 4; k++) {
          const palm = makePalm(rng);
          palm.position.set(bx + 6 + k * 10 + rng.range(-2, 2), 0, bz + 8 + rng.range(-3, 3));
          scene.add(palm);
        }
        continue;
      }
      const distC = Math.hypot(cx, cz);
      const lots = rng.chance(0.45) ? 1 : rng.chance(0.6) ? 2 : 4;
      const lotSize = CFG.blockSize / (lots === 1 ? 1 : 2);
      for (let l = 0; l < lots; l++) {
        if (lots > 1 && rng.chance(0.25)) continue; // empty lot / parking
        const lx = lots === 1 ? cx : bx + (l % 2) * lotSize + lotSize / 2;
        const lz = lots === 1 ? cz : bz + Math.floor(l / 2) * lotSize + lotSize / 2;
        const w = lotSize * rng.range(0.62, 0.88);
        const d = lotSize * rng.range(0.62, 0.88);
        let h;
        if (distC < 80) h = rng.range(28, 68);
        else if (distC < 160) h = rng.range(14, 34);
        else h = rng.range(8, 18);
        const mat = rng.pick(winMats);
        const mesh = new THREE.Mesh(
          new THREE.BoxGeometry(w, h, d),
          [mat, mat, roofMat, roofMat, mat, mat],
        );
        mesh.position.set(lx, h / 2, lz);
        scene.add(mesh);
        city.colliders.push({ minX: lx - w / 2, maxX: lx + w / 2, minZ: lz - d / 2, maxZ: lz + d / 2 });
        city.buildings.push({ x: lx, z: lz, w, d, h });
        if (rng.chance(0.3)) {
          const ac = new THREE.Mesh(new THREE.BoxGeometry(2.4, 1.2, 2.4), acMat);
          ac.position.set(lx + rng.range(-w / 4, w / 4), h + 0.6, lz + rng.range(-d / 4, d / 4));
          scene.add(ac);
        }
        // Neon sign on taller downtown buildings.
        if (h > 24 && rng.chance(0.55) && city.signs.length < signDefs.length) {
          const def = signDefs[city.signs.length];
          const tex = signTexture(def[0], def[1], def[2]);
          const sign = new THREE.Mesh(
            new THREE.PlaneGeometry(Math.min(26, w * 0.95), 6.5),
            new THREE.MeshBasicMaterial({ map: tex, transparent: true, side: THREE.DoubleSide }),
          );
          const face = rng.pick([0, 1, 2, 3]); // N/E/S/W face
          const off = 0.15;
          if (face === 0) { sign.position.set(lx, h - 4, lz - d / 2 - off); sign.rotation.y = Math.PI; }
          if (face === 1) { sign.position.set(lx + w / 2 + off, h - 4, lz); sign.rotation.y = Math.PI / 2; }
          if (face === 2) { sign.position.set(lx, h - 4, lz + d / 2 + off); }
          if (face === 3) { sign.position.set(lx - w / 2 - off, h - 4, lz); sign.rotation.y = -Math.PI / 2; }
          scene.add(sign);
          city.signs.push(sign);
        }
      }
    }
  }

  // Street lamps along the roads.
  const poleMat = new THREE.MeshLambertMaterial({ color: 0x22222c });
  const lampMat = new THREE.MeshBasicMaterial({ color: 0xffe9a8 });
  for (const c of roadLines) {
    for (let d = -CFG.worldHalf + 26; d < CFG.worldHalf; d += 52) {
      for (const [x, z] of [[c + 8, d], [c - 8, d + 26]]) {
        const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 7, 6), poleMat);
        pole.position.set(x, 3.5, z);
        scene.add(pole);
        const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.35, 8, 6), lampMat);
        bulb.position.set(x, 7.1, z);
        scene.add(bulb);
      }
    }
  }

  // Traffic lights at a few central intersections.
  const tlPoleMat = new THREE.MeshLambertMaterial({ color: 0x1c1c22 });
  const tlBoxMat = new THREE.MeshLambertMaterial({ color: 0x111116 });
  for (const { x, z } of city.intersections) {
    if (Math.abs(x) > 104 || Math.abs(z) > 104) continue;
    if (rng.chance(0.5)) continue;
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 6.4, 6), tlPoleMat);
    pole.position.set(x + 7.5, 3.2, z + 7.5);
    scene.add(pole);
    const box = new THREE.Mesh(new THREE.BoxGeometry(0.7, 1.8, 0.7), tlBoxMat);
    box.position.set(x + 7.5, 6.6, z + 7.5);
    scene.add(box);
    const nsMat = new THREE.MeshBasicMaterial({ color: 0x2aff66 });
    const ewMat = new THREE.MeshBasicMaterial({ color: 0xff2a2a });
    const ns = new THREE.Mesh(new THREE.SphereGeometry(0.22, 8, 6), nsMat);
    ns.position.set(x + 7.5, 7.0, z + 7.5);
    scene.add(ns);
    const ew = new THREE.Mesh(new THREE.SphereGeometry(0.22, 8, 6), ewMat);
    ew.position.set(x + 7.5, 6.3, z + 7.5);
    scene.add(ew);
    city.trafficLights.push({ nsMat, ewMat, phase: rng.rand() * 2 });
  }

  // Palms scattered on sidewalks and the beach.
  for (let i = 0; i < 26; i++) {
    const palm = makePalm(rng);
    const road = rng.pick(roadLines);
    const along = rng.range(-CFG.worldHalf + 20, CFG.worldHalf - 20);
    const side = rng.chance(0.5) ? 1 : -1;
    palm.position.set(rng.chance(0.5) ? road + side * 8.5 : along, 0, rng.chance(0.5) ? along : road + side * 8.5);
    scene.add(palm);
  }

  return city;
}

function makePalm(rng) {
  const group = new THREE.Group();
  const trunkMat = new THREE.MeshLambertMaterial({ color: 0x6b4a2f });
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.34, 5.5, 6), trunkMat);
  trunk.position.y = 2.75;
  trunk.rotation.z = rng.range(-0.08, 0.08);
  group.add(trunk);
  const leafMat = new THREE.MeshLambertMaterial({ color: 0x2f8f4e });
  for (let i = 0; i < 6; i++) {
    const leaf = new THREE.Mesh(new THREE.ConeGeometry(0.5, 2.4, 4), leafMat);
    const a = (i / 6) * Math.PI * 2;
    leaf.position.set(Math.cos(a) * 0.85, 5.7, Math.sin(a) * 0.85);
    leaf.rotation.z = Math.cos(a) * 1.1;
    leaf.rotation.x = -Math.sin(a) * 1.1;
    group.add(leaf);
  }
  return group;
}

// Circle (player / car) vs building AABBs: push the circle out and report
// whether it hit anything. Keeps everything out of the buildings.
export function collideCircle(city, x, z, r) {
  let hit = false;
  for (const b of city.colliders) {
    const nx = Math.max(b.minX, Math.min(x, b.maxX));
    const nz = Math.max(b.minZ, Math.min(z, b.maxZ));
    const dx = x - nx;
    const dz = z - nz;
    const d2 = dx * dx + dz * dz;
    if (d2 < r * r) {
      hit = true;
      if (d2 > 1e-6) {
        const d = Math.sqrt(d2);
        x = nx + (dx / d) * r;
        z = nz + (dz / d) * r;
      } else {
        // Centre inside the box: push out along the smallest penetration.
        const pl = x - b.minX;
        const pr = b.maxX - x;
        const pt = z - b.minZ;
        const pb = b.maxZ - z;
        const m = Math.min(pl, pr, pt, pb);
        if (m === pl) x = b.minX - r;
        else if (m === pr) x = b.maxX + r;
        else if (m === pt) z = b.minZ - r;
        else z = b.maxZ + r;
      }
    }
  }
  const B = CFG.worldHalf - 2;
  x = Math.max(-B, Math.min(B, x));
  z = Math.max(-B, Math.min(B, z));
  return { x, z, hit };
}

// Nearest point on the road grid (used to snap spawns onto roads).
export function nearestRoad(city, x, z) {
  let best = null;
  let bestD = Infinity;
  for (const c of city.roadLines) {
    const d1 = Math.abs(x - c);
    if (d1 < bestD) { bestD = d1; best = { x: c, z, axis: 'z' }; }
    const d2 = Math.abs(z - c);
    if (d2 < bestD) { bestD = d2; best = { x, z: c, axis: 'x' }; }
  }
  return best;
}
