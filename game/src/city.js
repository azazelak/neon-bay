// Neon Bay v4 — the city: 8x8 blocks of buildings, neon signs, billboards,
// a Ferris wheel on the pier, a fountain plaza, marina, traffic lights, props.
// Deterministic from seed 1337; every mesh is built once, then animated by
// update() (wheel, boats, beacons, fountain, traffic-light cycle).
import * as THREE from 'three';
import { PITCH, ROAD_W, GRID_K, CITY_EDGE, BEACH_X, PALETTE } from './config.js';
import { Rng } from './rng.js';

const NEON_TEXTS = [
  ['NEON BAY', 0xff2e88], ['CASINO LUNA', 0xffc233], ['MARINA', 0x19e3ff],
  ['HOTEL CORAL', 0xff7a2e], ['TACOS EL CAMINO', 0x39ff88], ['CLUB VOLT', 0xb44dff],
  ['SURF SHOP', 0x19e3ff], ['PALM HOTEL', 0xffc233], ['DANCE HALL', 0xff2e88],
  ['PIZZA NOVA', 0x39ff88], ['BAR LA LUNA', 0xff7a2e], ['CINEMA RIO', 0xb44dff],
  ['GYM IRON', 0x19e3ff], ['HOTEL VISTA', 0xff2e88], ['RAMEN 24', 0xffc233],
  ['CLUB NEON', 0x39ff88], ['TATTOO INK', 0xff7a2e], ['BOWLING BAY', 0x19e3ff],
  ['CAFE SOL', 0xffc233], ['ARCADE 88', 0xb44dff], ['HOTEL MARINA', 0xff2e88],
  ['SUSHI WAVE', 0x19e3ff], ['BAR EL FARO', 0x39ff88], ['DISCO SOL', 0xff7a2e],
  ['MOTEL 66', 0xffc233], ['BURGER BAY', 0xb44dff], ['SPA AZUL', 0x19e3ff],
  ['TEATRO LUZ', 0xff2e88], ['MARKET 9', 0x39ff88], ['HOTEL CIELO', 0xffc233],
  ['CLUB OLA', 0xff7a2e], ['TACOS SOL', 0x19e3ff],
];
const BILLBOARDS = [
  ['NEON BAY', 'THE CITY NEVER SLEEPS', 0xff2e88],
  ['CASINO LUNA', 'JACKPOT NIGHTLY', 0xffc233],
  ['MARINA', 'BOATS • SUN • SALT', 0x19e3ff],
  ['HOTEL CORAL', 'SLEEP WITH THE SEA', 0xff7a2e],
  ['TACOS EL CAMINO', 'OPEN 24 HOURS', 0x39ff88],
  ['CLUB VOLT', 'DANCE TILL DAWN', 0xb44dff],
  ['SURF SHOP', 'RIDE THE BAY', 0x19e3ff],
  ['PIZZA NOVA', 'HOT & FAST', 0xffc233],
];

function canvasTexture(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function windowTexture(rng, base) {
  return canvasTexture(128, 256, (g, w, h) => {
    g.fillStyle = base; g.fillRect(0, 0, w, h);
    const cols = 6, rows = 12, cw = w / cols, ch = h / rows;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const lit = rng.chance(0.55);
        g.fillStyle = lit ? rng.pick(['#ffd98a', '#ffe9b8', '#9fd8ff', '#ffb46a']) : '#1d2733';
        g.fillRect(c * cw + 3, r * ch + 4, cw - 6, ch - 8);
      }
    }
  });
}

function neonTexture(text, color) {
  const hex = '#' + color.toString(16).padStart(6, '0');
  return canvasTexture(512, 128, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    g.font = 'bold 64px Arial, sans-serif';
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.shadowColor = hex; g.shadowBlur = 28;
    g.fillStyle = hex;
    g.fillText(text, w / 2, h / 2);
    g.shadowBlur = 8; g.fillStyle = '#ffffff';
    g.fillText(text, w / 2, h / 2);
  });
}

function billboardTexture(title, sub, color) {
  const hex = '#' + color.toString(16).padStart(6, '0');
  return canvasTexture(512, 256, (g, w, h) => {
    g.fillStyle = '#101018'; g.fillRect(0, 0, w, h);
    g.strokeStyle = hex; g.lineWidth = 6; g.strokeRect(8, 8, w - 16, h - 16);
    g.font = 'bold 56px Arial, sans-serif'; g.textAlign = 'center';
    g.shadowColor = hex; g.shadowBlur = 22; g.fillStyle = hex;
    g.fillText(title, w / 2, 100);
    g.shadowBlur = 0; g.fillStyle = '#ffffff'; g.font = 'bold 30px Arial, sans-serif';
    g.fillText(sub, w / 2, 180);
  });
}

export function buildCity(scene) {
  const rng = new Rng(1337);
  const colliders = [];
  const beacons = [];
  const boats = [];
  const lights = [];
  const signs = [];
  let wheel = null;
  let fountain = null;

  const boxGeo = new THREE.BoxGeometry(1, 1, 1);
  const cylGeo = new THREE.CylinderGeometry(1, 1, 1, 10);
  const sphereGeo = new THREE.SphereGeometry(1, 8, 6);

  // ---- ground, roads, sidewalks, sand, ocean
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(1400, 1400),
    new THREE.MeshLambertMaterial({ color: PALETTE.ground }));
  ground.rotation.x = -Math.PI / 2; ground.position.set(300, -0.05, 0); scene.add(ground);

  const roadTex = canvasTexture(128, 128, (g, w, h) => {
    g.fillStyle = '#464b55'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#565b66'; g.fillRect(0, 0, 6, h); g.fillRect(w - 6, 0, 6, h);
    g.fillStyle = '#d8c25a';
    for (let y = 0; y < h; y += 32) g.fillRect(w / 2 - 2, y, 4, 18);
  });
  roadTex.wrapS = roadTex.wrapT = THREE.RepeatWrapping;
  const roadMat = new THREE.MeshLambertMaterial({ map: roadTex });
  const walkMat = new THREE.MeshLambertMaterial({ color: PALETTE.sidewalk });
  const span = (GRID_K * 2 + 1) * PITCH; // 864
  for (let k = -GRID_K; k <= GRID_K; k++) {
    const c = k * PITCH;
    const rep = span / 96;
    const rt = roadTex.clone(); rt.needsUpdate = true; rt.repeat.set(1, rep);
    const av = new THREE.Mesh(new THREE.PlaneGeometry(ROAD_W, span), new THREE.MeshLambertMaterial({ map: rt }));
    av.rotation.x = -Math.PI / 2; av.position.set(c, 0, 0); scene.add(av);
    const rt2 = roadTex.clone(); rt2.needsUpdate = true; rt2.repeat.set(rep, 1);
    const st = new THREE.Mesh(new THREE.PlaneGeometry(span, ROAD_W), new THREE.MeshLambertMaterial({ map: rt2 }));
    st.rotation.x = -Math.PI / 2; st.position.set(0, 0, c); scene.add(st);
    const sw1 = new THREE.Mesh(new THREE.PlaneGeometry(ROAD_W + 6, span), walkMat);
    sw1.rotation.x = -Math.PI / 2; sw1.position.set(c, -0.02, 0); scene.add(sw1);
    const sw2 = new THREE.Mesh(new THREE.PlaneGeometry(span, ROAD_W + 6), walkMat);
    sw2.rotation.x = -Math.PI / 2; sw2.position.set(0, -0.02, c); scene.add(sw2);
  }
  const sand = new THREE.Mesh(new THREE.PlaneGeometry(60, 1400),
    new THREE.MeshLambertMaterial({ color: PALETTE.sand }));
  sand.rotation.x = -Math.PI / 2; sand.position.set(BEACH_X + 8, 0.02, 0); scene.add(sand);
  const ocean = new THREE.Mesh(new THREE.PlaneGeometry(900, 1400),
    new THREE.MeshLambertMaterial({ color: PALETTE.ocean }));
  ocean.rotation.x = -Math.PI / 2; ocean.position.set(BEACH_X + 480, -0.4, 0); scene.add(ocean);

  // ---- buildings
  const facadeCols = ['#8a7f8d', '#6f7a8c', '#9c8a7a', '#7a6a7a', '#5f6a7a', '#8a7a6a'];
  const winTexs = facadeCols.map(c => windowTexture(new Rng(100 + facadeCols.indexOf(c) * 7), c));
  const roofMat = new THREE.MeshLambertMaterial({ color: PALETTE.roof });
  const propMat = new THREE.MeshLambertMaterial({ color: 0x555560 });
  const beaconMat = new THREE.MeshBasicMaterial({ color: 0xff2222 });
  const beaconOff = new THREE.MeshBasicMaterial({ color: 0x551111 });
  const buildings = [];
  let signIdx = 0;
  for (let bi = -GRID_K; bi < GRID_K; bi++) {
    for (let bj = -GRID_K; bj < GRID_K; bj++) {
      const cx = bi * PITCH + PITCH / 2, cz = bj * PITCH + PITCH / 2;
      // Fountain plaza block (48, 48): no buildings, handled below.
      if (cx === 48 && cz === 48) continue;
      const n = rng.int(2, 3);
      for (let b = 0; b < n; b++) {
        const w = rng.range(16, 26), d = rng.range(16, 26);
        const h = rng.range(12, 58);
        const ox = cx + rng.range(-14, 14), oz = cz + rng.range(-14, 14);
        const mat = new THREE.MeshLambertMaterial({ map: winTexs[rng.int(0, 5)] });
        const m = new THREE.Mesh(boxGeo, mat);
        m.scale.set(w, h, d); m.position.set(ox, h / 2, oz); scene.add(m);
        colliders.push({ x: ox, z: oz, hw: w / 2, hd: d / 2 });
        buildings.push({ x: ox, z: oz, w, d, h });
        if (h > 34) { // stepped crown
          const cw = w * 0.6, cd = d * 0.6, ch = rng.range(4, 8);
          const crown = new THREE.Mesh(boxGeo, roofMat);
          crown.scale.set(cw, ch, cd); crown.position.set(ox, h + ch / 2, oz); scene.add(crown);
        }
        // Rooftop props: AC box, water tower, antenna with blinking beacon.
        if (rng.chance(0.7)) {
          const ac = new THREE.Mesh(boxGeo, propMat);
          ac.scale.set(3, 1.6, 2.4);
          ac.position.set(ox + rng.range(-w / 4, w / 4), h + 0.8, oz + rng.range(-d / 4, d / 4));
          scene.add(ac);
        }
        if (rng.chance(0.5)) {
          const tw = new THREE.Mesh(cylGeo, propMat);
          tw.scale.set(2.2, 3.4, 2.2);
          tw.position.set(ox - w / 4, h + 1.7, oz - d / 4); scene.add(tw);
          const cone = new THREE.Mesh(new THREE.ConeGeometry(2.6, 2, 10), roofMat);
          cone.position.set(ox - w / 4, h + 4.4, oz - d / 4); scene.add(cone);
        }
        if (rng.chance(0.45)) {
          const ant = new THREE.Mesh(cylGeo, propMat);
          ant.scale.set(0.25, 9, 0.25);
          ant.position.set(ox + w / 4, h + 4.5, oz + d / 4); scene.add(ant);
          const bc = new THREE.Mesh(sphereGeo, beaconMat);
          bc.scale.setScalar(0.7);
          bc.position.set(ox + w / 4, h + 9.4, oz + d / 4); scene.add(bc);
          beacons.push({ mesh: bc, on: beaconMat, off: beaconOff });
        }
        // Neon sign on the facade facing the nearest avenue.
        if (signIdx < NEON_TEXTS.length && rng.chance(0.42)) {
          const [text, color] = NEON_TEXTS[signIdx++];
          const faceWest = Math.abs(ox - (bi * PITCH)) < Math.abs(ox - ((bi + 1) * PITCH));
          const fx = faceWest ? ox - w / 2 - 0.4 : ox + w / 2 + 0.4;
          const sm = new THREE.Mesh(
            new THREE.PlaneGeometry(16, 4),
            new THREE.MeshBasicMaterial({ map: neonTexture(text, color), transparent: true, side: THREE.DoubleSide }));
          sm.position.set(fx, rng.range(7, Math.max(8, h - 6)), oz);
          sm.rotation.y = faceWest ? -Math.PI / 2 : Math.PI / 2;
          scene.add(sm);
          signs.push({ text, x: fx, z: oz, y: sm.position.y });
        }
      }
    }
  }
  // Helipads on two tall towers.
  const padTex = canvasTexture(128, 128, (g, w, h) => {
    g.fillStyle = '#2c2f36'; g.fillRect(0, 0, w, h);
    g.strokeStyle = '#ffd94a'; g.lineWidth = 6;
    g.beginPath(); g.arc(w / 2, h / 2, 44, 0, Math.PI * 2); g.stroke();
    g.font = 'bold 64px Arial'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillStyle = '#ffd94a'; g.fillText('H', w / 2, h / 2);
  });
  const tall = [...buildings].sort((a, b) => b.h - a.h).slice(0, 2);
  for (const t of tall) {
    const pad = new THREE.Mesh(new THREE.CircleGeometry(7, 20),
      new THREE.MeshLambertMaterial({ map: padTex }));
    pad.rotation.x = -Math.PI / 2; pad.position.set(t.x, t.h + 0.15, t.z); scene.add(pad);
  }

  // ---- billboards (8, freestanding on block interiors)
  const bbSpots = [[-336, -336], [-144, -336], [144, -240], [336, -48], [-336, 144], [48, -336], [240, 336], [-48, 336]];
  for (let i = 0; i < BILLBOARDS.length; i++) {
    const [title, sub, color] = BILLBOARDS[i];
    const [bx, bz] = bbSpots[i];
    const g = new THREE.Group();
    const face = new THREE.Mesh(new THREE.PlaneGeometry(22, 11),
      new THREE.MeshBasicMaterial({ map: billboardTexture(title, sub, color), side: THREE.DoubleSide }));
    face.position.y = 9; g.add(face);
    const postMat = new THREE.MeshLambertMaterial({ color: 0x333338 });
    for (const px of [-8, 8]) {
      const p = new THREE.Mesh(boxGeo, postMat);
      p.scale.set(1, 9, 1); p.position.set(px, 4.5, 0); g.add(p);
    }
    g.position.set(bx, 0, bz);
    g.rotation.y = rng.range(-0.5, 0.5);
    scene.add(g);
    colliders.push({ x: bx, z: bz, hw: 11, hd: 1.5 });
  }

  // ---- fountain plaza (block centre 48, 48)
  {
    const basin = new THREE.Mesh(new THREE.CylinderGeometry(10, 11, 1.4, 24),
      new THREE.MeshLambertMaterial({ color: 0x8a8f96 }));
    basin.position.set(48, 0.7, 48); scene.add(basin);
    const water = new THREE.Mesh(new THREE.CircleGeometry(9.4, 24),
      new THREE.MeshLambertMaterial({ color: 0x3fa8d8, transparent: true, opacity: 0.85 }));
    water.rotation.x = -Math.PI / 2; water.position.set(48, 1.45, 48); scene.add(water);
    fountain = water;
    const jet = new THREE.Mesh(cylGeo, new THREE.MeshLambertMaterial({ color: 0x9fd8ff }));
    jet.scale.set(0.7, 3, 0.7); jet.position.set(48, 3, 48); scene.add(jet);
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2;
      const bench = new THREE.Mesh(boxGeo, new THREE.MeshLambertMaterial({ color: 0x6a4a2e }));
      bench.scale.set(3.4, 0.8, 1.2);
      bench.position.set(48 + Math.cos(a) * 15, 0.4, 48 + Math.sin(a) * 15);
      bench.rotation.y = -a; scene.add(bench);
    }
    colliders.push({ x: 48, z: 48, hw: 11, hd: 11 });
  }

  // ---- traffic lights at 13 intersections
  const lightSpots = [[-288, -288], [-96, -288], [96, -288], [288, -288], [-288, -96], [96, -96],
    [288, -96], [-288, 96], [-96, 96], [288, 96], [-288, 288], [0, 288], [288, 288]];
  for (const [lx, lz] of lightSpots) {
    const pole = new THREE.Mesh(cylGeo, new THREE.MeshLambertMaterial({ color: 0x222226 }));
    pole.scale.set(0.35, 7, 0.35); pole.position.set(lx + 8, 3.5, lz + 8); scene.add(pole);
    const head = new THREE.Mesh(boxGeo, new THREE.MeshLambertMaterial({ color: 0x111114 }));
    head.scale.set(1.2, 3.2, 1.2); head.position.set(lx + 8, 7.6, lz + 8); scene.add(head);
    const lampMats = [new THREE.MeshBasicMaterial({ color: 0x330000 }),
      new THREE.MeshBasicMaterial({ color: 0x332200 }),
      new THREE.MeshBasicMaterial({ color: 0x003300 })];
    const lamps = [];
    for (let i = 0; i < 3; i++) {
      const lamp = new THREE.Mesh(sphereGeo, lampMats[i]);
      lamp.scale.setScalar(0.42);
      lamp.position.set(lx + 8, 8.6 - i * 0.95, lz + 8 + 0.65);
      scene.add(lamp); lamps.push(lamp);
    }
    lights.push({ x: lx, z: lz, lamps, mats: lampMats, phase: (lx + lz) % 3 });
  }

  // ---- street props: hydrants, benches, bus stops, palms
  const hydMat = new THREE.MeshLambertMaterial({ color: 0xc22a2a });
  const benchMat = new THREE.MeshLambertMaterial({ color: 0x6a4a2e });
  const palmTrunk = new THREE.MeshLambertMaterial({ color: 0x7a5a38 });
  const palmLeaf = new THREE.MeshLambertMaterial({ color: 0x2e8b57 });
  for (let i = 0; i < 60; i++) {
    const px = rng.range(-380, 380), pz = rng.range(-380, 380);
    if (Math.abs(px % PITCH) < 14 || Math.abs(pz % PITCH) < 14) continue; // keep off roads
    const kind = rng.int(0, 2);
    if (kind === 0) {
      const hyd = new THREE.Mesh(cylGeo, hydMat);
      hyd.scale.set(0.5, 1.1, 0.5); hyd.position.set(px, 0.55, pz); scene.add(hyd);
    } else if (kind === 1) {
      const b = new THREE.Mesh(boxGeo, benchMat);
      b.scale.set(3, 0.7, 1); b.position.set(px, 0.35, pz); b.rotation.y = rng.range(0, Math.PI); scene.add(b);
    } else {
      const trunk = new THREE.Mesh(cylGeo, palmTrunk);
      trunk.scale.set(0.35, 7, 0.35); trunk.position.set(px, 3.5, pz); scene.add(trunk);
      const top = new THREE.Mesh(new THREE.ConeGeometry(3, 3.4, 7), palmLeaf);
      top.position.set(px, 8.2, pz); scene.add(top);
    }
  }
  // Beach palms row
  for (let i = 0; i < 14; i++) {
    const pz = -380 + i * 58;
    const trunk = new THREE.Mesh(cylGeo, palmTrunk);
    trunk.scale.set(0.4, 8, 0.4); trunk.position.set(448, 4, pz); scene.add(trunk);
    const top = new THREE.Mesh(new THREE.ConeGeometry(3.4, 3.8, 7), palmLeaf);
    top.position.set(448, 9.4, pz); scene.add(top);
  }
  // Bus stops
  for (const [bx, bz] of [[-192, 96], [96, -192], [288, 0], [-96, 288]]) {
    const roof = new THREE.Mesh(boxGeo, new THREE.MeshLambertMaterial({ color: 0x2e6b8a }));
    roof.scale.set(6, 0.4, 2.4); roof.position.set(bx, 3.4, bz); scene.add(roof);
    for (const dx of [-2.6, 2.6]) {
      const post = new THREE.Mesh(boxGeo, propMat);
      post.scale.set(0.3, 3.4, 0.3); post.position.set(bx + dx, 1.7, bz); scene.add(post);
    }
  }

  // ---- marina pier, lamps, hut, boats
  const pier = new THREE.Mesh(boxGeo, new THREE.MeshLambertMaterial({ color: 0x7a5a38 }));
  pier.scale.set(130, 2, 26); pier.position.set(505, 1, 0); scene.add(pier);
  colliders.push({ x: 505, z: 0, hw: 65, hd: 13 }); // pier edge blocks cars
  const lampMat = new THREE.MeshBasicMaterial({ color: 0xffe9a8 });
  for (let i = 0; i < 6; i++) {
    const px = 450 + i * 22;
    for (const pz of [-11, 11]) {
      const pole = new THREE.Mesh(cylGeo, propMat);
      pole.scale.set(0.25, 5, 0.25); pole.position.set(px, 4.5, pz); scene.add(pole);
      const bulb = new THREE.Mesh(sphereGeo, lampMat);
      bulb.scale.setScalar(0.6); bulb.position.set(px, 7.2, pz); scene.add(bulb);
    }
  }
  const hut = new THREE.Mesh(boxGeo, new THREE.MeshLambertMaterial({ color: 0xb5654a }));
  hut.scale.set(10, 6, 8); hut.position.set(470, 5, 8); scene.add(hut);
  const hutRoof = new THREE.Mesh(new THREE.ConeGeometry(8, 4, 4), roofMat);
  hutRoof.position.set(470, 10, 8); hutRoof.rotation.y = Math.PI / 4; scene.add(hutRoof);
  const boatCols = [0xd8d8d8, 0x3f6fb5, 0xc25a3a, 0x39a06a];
  for (let i = 0; i < 4; i++) {
    const g = new THREE.Group();
    const hull = new THREE.Mesh(boxGeo, new THREE.MeshLambertMaterial({ color: boatCols[i] }));
    hull.scale.set(10, 2, 3.4); g.add(hull);
    const cab = new THREE.Mesh(boxGeo, new THREE.MeshLambertMaterial({ color: 0xf0f0f0 }));
    cab.scale.set(3.4, 2, 2.4); cab.position.set(-1, 1.8, 0); g.add(cab);
    g.position.set(500 + i * 26, 0.4, 34 + (i % 2) * 26);
    scene.add(g);
    boats.push({ group: g, baseY: 0.4, phase: i * 1.7 });
  }

  // ---- Ferris wheel at the pier end
  {
    const g = new THREE.Group();
    const legMat = new THREE.MeshLambertMaterial({ color: 0xd8d8d8 });
    for (const s of [-1, 1]) {
      const leg = new THREE.Mesh(boxGeo, legMat);
      leg.scale.set(1.4, 24, 1.4);
      leg.position.set(0, 12, s * 7); leg.rotation.x = s * 0.35; g.add(leg);
    }
    const rim = new THREE.Mesh(new THREE.TorusGeometry(18, 0.9, 8, 40),
      new THREE.MeshLambertMaterial({ color: 0xff2e88 }));
    rim.rotation.y = Math.PI / 2; // wheel faces east-west, down the pier
    rim.position.y = 24; g.add(rim);
    const spokeMat = new THREE.MeshLambertMaterial({ color: 0xcccccc });
    const spokes = [];
    for (let i = 0; i < 8; i++) {
      const sp = new THREE.Mesh(boxGeo, spokeMat);
      sp.scale.set(0.7, 35, 0.7);
      sp.position.y = 24; sp.rotation.x = (i / 8) * Math.PI;
      g.add(sp); spokes.push(sp);
    }
    const cabins = [];
    const cabMat = new THREE.MeshLambertMaterial({ color: 0xffc233 });
    for (let i = 0; i < 8; i++) {
      const cab = new THREE.Mesh(boxGeo, cabMat);
      cab.scale.set(3, 3.4, 4);
      g.add(cab); cabins.push(cab);
    }
    const bulbMat = new THREE.MeshBasicMaterial({ color: 0x19e3ff });
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2;
      const bulb = new THREE.Mesh(sphereGeo, bulbMat);
      bulb.scale.setScalar(0.55);
      bulb.position.set(0, 24 + Math.sin(a) * 18, Math.cos(a) * 18);
      g.add(bulb);
    }
    g.position.set(545, 2, 0);
    scene.add(g);
    wheel = { group: g, spokes, cabins, angle: 0 };
  }

  const litMats = [new THREE.MeshBasicMaterial({ color: 0xff3333 }),
    new THREE.MeshBasicMaterial({ color: 0xffcc22 }),
    new THREE.MeshBasicMaterial({ color: 0x33ff66 })];
  function update(dt, t) {
    if (wheel) {
      wheel.angle += dt * 0.12;
      for (let i = 0; i < 8; i++) {
        const a = wheel.angle + (i / 8) * Math.PI * 2;
        wheel.spokes[i].rotation.x = a;
        wheel.cabins[i].position.set(0, 24 + Math.sin(a) * 18, Math.cos(a) * 18);
      }
    }
    for (const b of boats) {
      b.group.position.y = b.baseY + Math.sin(t * 0.9 + b.phase) * 0.35;
      b.group.rotation.z = Math.sin(t * 0.7 + b.phase) * 0.03;
    }
    for (let i = 0; i < beacons.length; i++) {
      const on = Math.sin(t * 2.4 + i) > 0;
      beacons[i].mesh.material = on ? beacons[i].on : beacons[i].off;
    }
    if (fountain) {
      fountain.scale.setScalar(1 + Math.sin(t * 2.2) * 0.03);
      fountain.material.opacity = 0.8 + Math.sin(t * 2.2) * 0.08;
    }
    // Traffic lights: 3-phase cycle, 6 s per phase.
    const phase = Math.floor(t / 6) % 3;
    for (const L of lights) {
      const p = (phase + L.phase) % 3;
      L.lamps[0].material = p === 0 ? litMats[0] : L.mats[0];
      L.lamps[1].material = p === 1 ? litMats[1] : L.mats[1];
      L.lamps[2].material = p === 2 ? litMats[2] : L.mats[2];
    }
  }

  return { colliders, buildings, signs, lights, wheel, boats, update };
}
