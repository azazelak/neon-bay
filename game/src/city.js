// Neon Bay — the city itself: 9x9 blocks, ~140 buildings, neon, marina.
// Built once from a fixed seed, so every load looks the same.

import * as THREE from 'three';
import { CFG, AVENUES, BLOCKS, PALETTE, clamp } from './config.js';
import { Rng } from './rng.js';

// Canvas texture with a grid of lit windows on dark glass.
function windowTexture(rng, variant) {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = '#2c3852';
  g.fillRect(0, 0, 128, 256);
  const cols = 6, rows = 14;
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const lit = rng.chance(0.55);
      const warm = rng.chance(0.7);
      g.fillStyle = lit
        ? (warm ? '#ffd88a' : '#8ad4ff')
        : (variant % 2 === 0 ? '#2c3a58' : '#1c2438');
      g.globalAlpha = lit ? rng.float(0.75, 1) : 1;
      g.fillRect(6 + x * 20, 8 + y * 17, 13, 10);
    }
  }
  g.globalAlpha = 1;
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// Neon sign / billboard face: glowing text on a dark plate.
function textTexture(lines, fg, bg, size = 64) {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 160;
  const g = c.getContext('2d');
  g.fillStyle = bg;
  g.fillRect(0, 0, 512, 160);
  g.strokeStyle = fg;
  g.lineWidth = 6;
  g.strokeRect(6, 6, 500, 148);
  g.fillStyle = fg;
  g.font = `bold ${size}px Arial, sans-serif`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.shadowColor = fg;
  g.shadowBlur = 22;
  const n = lines.length;
  lines.forEach((line, i) => {
    g.fillText(line, 256, 80 + (i - (n - 1) / 2) * (size + 6));
  });
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export class City {
  constructor(scene) {
    this.scene = scene;
    this.rng = new Rng(1337);
    this.colliders = [];   // { minX, maxX, minZ, maxZ } building footprints
    this.beacons = [];     // blinking red spheres { mesh, phase }
    this.boats = [];       // { group, phase, speed }
    this.lights = [];      // traffic lights { x, z, state, timer }
    this.signMeshes = [];
    this.group = new THREE.Group();
    scene.add(this.group);
    this.buildGround();
    this.buildRoads();
    this.buildBuildings();
    this.buildSigns();
    this.buildProps();
    this.buildMarina();
    this.buildPalms();
  }

  buildGround() {
    // City ground: warm dark asphalt-grey slab.
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(760, 760),
      new THREE.MeshLambertMaterial({ color: 0x565660 }),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.set(0, 0, 0);
    this.group.add(ground);
    // Sand strip along the south edge.
    const sand = new THREE.Mesh(
      new THREE.PlaneGeometry(760, 60),
      new THREE.MeshLambertMaterial({ color: PALETTE.sand }),
    );
    sand.rotation.x = -Math.PI / 2;
    sand.position.set(0, 0.05, CFG.beachZ + 30);
    this.group.add(sand);
    // Ocean: two overlapping planes for a cheap shimmer.
    const ocean = new THREE.Mesh(
      new THREE.PlaneGeometry(900, 300),
      new THREE.MeshLambertMaterial({ color: PALETTE.ocean }),
    );
    ocean.rotation.x = -Math.PI / 2;
    ocean.position.set(0, -0.4, CFG.oceanZ + 150);
    this.group.add(ocean);
    const deep = new THREE.Mesh(
      new THREE.PlaneGeometry(900, 300),
      new THREE.MeshLambertMaterial({ color: PALETTE.oceanDeep, transparent: true, opacity: 0.55 }),
    );
    deep.rotation.x = -Math.PI / 2;
    deep.position.set(0, -0.2, CFG.oceanZ + 150);
    this.group.add(deep);
  }

  buildRoads() {
    // Road strips with dashed centre lines, drawn once on a canvas.
    // Dashes run along the canvas width (u), which maps to the road length.
    const c = document.createElement('canvas');
    c.width = 256;
    c.height = 64;
    const g = c.getContext('2d');
    g.fillStyle = '#33363f';
    g.fillRect(0, 0, 256, 64);
    g.fillStyle = '#d8c86a';
    for (let x = 0; x < 256; x += 64) g.fillRect(x + 8, 30, 34, 4);
    g.fillStyle = '#c8c8c8';
    g.fillRect(0, 2, 256, 2);
    g.fillRect(0, 60, 256, 2);
    const roadTex = new THREE.CanvasTexture(c);
    roadTex.wrapS = THREE.RepeatWrapping;
    roadTex.wrapT = THREE.RepeatWrapping;
    roadTex.repeat.set(12, 1);
    roadTex.colorSpace = THREE.SRGBColorSpace;
    const roadMat = new THREE.MeshLambertMaterial({ map: roadTex });
    const walkMat = new THREE.MeshLambertMaterial({ color: PALETTE.sidewalk });
    for (const a of AVENUES) {
      for (const horizontal of [true, false]) {
        const road = new THREE.Mesh(new THREE.PlaneGeometry(720, 14), roadMat);
        road.rotation.x = -Math.PI / 2;
        // A strip runs along X by default; rotate it to run along Z for
        // the north-south avenues.
        if (!horizontal) road.rotation.z = Math.PI / 2;
        road.position.set(horizontal ? 0 : a, 0.06, horizontal ? a : 0);
        this.group.add(road);
        // Sidewalks flank each road.
        for (const side of [-1, 1]) {
          const walk = new THREE.Mesh(new THREE.PlaneGeometry(720, 5), walkMat);
          walk.rotation.x = -Math.PI / 2;
          if (!horizontal) walk.rotation.z = Math.PI / 2;
          walk.position.set(
            horizontal ? 0 : a + side * 9.5,
            0.08,
            horizontal ? a + side * 9.5 : 0,
          );
          this.group.add(walk);
        }
      }
    }
    // Crosswalk stripes at the centre intersection.
    const stripeMat = new THREE.MeshLambertMaterial({ color: 0xe8e8e8 });
    for (const [sx, sz] of [[0, 0], [0, 320], [-160, 0], [160, 0]]) {
      for (let i = -3; i <= 3; i++) {
        const s = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 5), stripeMat);
        s.rotation.x = -Math.PI / 2;
        s.position.set(sx + i * 2.2, 0.1, sz - 9);
        this.group.add(s);
      }
    }
  }

  buildBuildings() {
    const rng = this.rng;
    const winTexs = [];
    for (let v = 0; v < 6; v++) winTexs.push(windowTexture(rng, v));
    const roofMat = new THREE.MeshLambertMaterial({ color: 0x2a2a30 });
    const acMat = new THREE.MeshLambertMaterial({ color: 0x6a6a72 });
    const towerMat = new THREE.MeshLambertMaterial({ color: 0x7a5a3a });
    const antennaMat = new THREE.MeshLambertMaterial({ color: 0x3a3a42 });
    const beaconMat = new THREE.MeshBasicMaterial({ color: 0xff2a2a });
    let count = 0;
    for (const bx of BLOCKS) {
      for (const bz of BLOCKS) {
        const downtown = Math.abs(bx) <= 120 && Math.abs(bz) <= 120;
        const n = downtown ? rng.int(2, 3) : rng.int(1, 2);
        const slots = n === 3
          ? [[-14, -14], [14, -14], [0, 14]]
          : n === 2 ? [[-13, -13], [13, 13]] : [[0, 0]];
        for (const [ox, oz] of slots) {
          const w = rng.float(18, 28);
          const d = rng.float(18, 28);
          const h = downtown
            ? rng.float(28, 72)
            : rng.float(12, 34);
          const cx = bx + ox;
          const cz = bz + oz;
          const tex = rng.pick(winTexs).clone();
          tex.needsUpdate = true;
          tex.repeat.set(Math.max(1, Math.round(w / 14)), Math.max(1, Math.round(h / 18)));
          const mat = new THREE.MeshLambertMaterial({ map: tex });
          const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
          b.position.set(cx, h / 2, cz);
          this.group.add(b);
          // Stepped crown: a smaller box on top.
          const cw = w * rng.float(0.5, 0.7);
          const cd = d * rng.float(0.5, 0.7);
          const ch = rng.float(3, 8);
          const crown = new THREE.Mesh(new THREE.BoxGeometry(cw, ch, cd), roofMat);
          crown.position.set(cx, h + ch / 2, cz);
          this.group.add(crown);
          // Rooftop props.
          if (rng.chance(0.55)) {
            const ac = new THREE.Mesh(new THREE.BoxGeometry(3, 1.6, 2.4), acMat);
            ac.position.set(cx + rng.float(-w / 4, w / 4), h + ch + 0.8, cz + rng.float(-d / 4, d / 4));
            this.group.add(ac);
          }
          if (rng.chance(0.3)) {
            const tower = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.6, 5, 8), towerMat);
            tower.position.set(cx + rng.float(-w / 4, w / 4), h + ch + 2.5, cz + rng.float(-d / 4, d / 4));
            this.group.add(tower);
            const cap = new THREE.Mesh(new THREE.ConeGeometry(2.8, 2, 8), towerMat);
            cap.position.set(tower.position.x, h + ch + 6, tower.position.z);
            this.group.add(cap);
          }
          if (rng.chance(0.4)) {
            const ant = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.3, rng.float(6, 12), 6), antennaMat);
            ant.position.set(cx + rng.float(-w / 4, w / 4), h + ch + 4, cz + rng.float(-d / 4, d / 4));
            this.group.add(ant);
            const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.55, 8, 8), beaconMat);
            beacon.position.set(ant.position.x, h + ch + 4 + ant.geometry.parameters.height / 2 + 0.4, ant.position.z);
            this.group.add(beacon);
            this.beacons.push({ mesh: beacon, phase: rng.float(0, Math.PI * 2) });
          }
          this.colliders.push({
            minX: cx - w / 2, maxX: cx + w / 2,
            minZ: cz - d / 2, maxZ: cz + d / 2,
          });
          count++;
        }
      }
    }
    this.buildingCount = count;
  }

  buildSigns() {
    const rng = this.rng;
    // 20 neon signs on building faces along avenues.
    const signDefs = [
      ['NEON BAY', PALETTE.neonCyan], ['TACOS', PALETTE.neonYellow],
      ['EL CAMINO', PALETTE.neonYellow], ['CASINO', PALETTE.neonPink],
      ['LUNA', PALETTE.neonPink], ['HOTEL', PALETTE.neonCyan],
      ['CORAL', PALETTE.neonCyan], ['CLUB VOLT', PALETTE.neonPurple],
      ['MARINA', PALETTE.neonGreen], ['PIZZA', PALETTE.neonOrange],
      ['BAR 24H', PALETTE.neonPink], ['SURF SHOP', PALETTE.neonCyan],
      ['MOTEL', PALETTE.neonYellow], ['GYM', PALETTE.neonGreen],
      ['DONUTS', PALETTE.neonOrange], ['ARCADE', PALETTE.neonPurple],
      ['TATTOO', PALETTE.neonPink], ['SUSHI', PALETTE.neonCyan],
      ['LAUNDRY', PALETTE.neonYellow], ['RECORDS', PALETTE.neonGreen],
    ];
    const used = new Set();
    for (let i = 0; i < 20; i++) {
      const [text, color] = signDefs[i];
      // Pick a building near a random avenue.
      const bx = rng.pick(BLOCKS);
      const bz = rng.pick(BLOCKS);
      const key = `${bx},${bz}`;
      if (used.has(key)) continue;
      used.add(key);
      const faceEast = rng.chance(0.5);
      const tex = textTexture([text], `#${color.toString(16).padStart(6, '0')}`, '#14101c', 72);
      const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true });
      const sign = new THREE.Mesh(new THREE.PlaneGeometry(11, 3.4), mat);
      const y = rng.float(9, 22);
      if (faceEast) {
        // On the east facade, facing the avenue.
        sign.position.set(bx + 28.5, y, bz + rng.float(-20, 20));
        sign.rotation.y = Math.PI / 2;
      } else {
        // On the south facade, facing the avenue.
        sign.position.set(bx + rng.float(-20, 20), y, bz + 28.5);
      }
      this.group.add(sign);
      this.signMeshes.push(sign);
    }
    // 6 freestanding billboards with real canvas text.
    const boards = [
      { text: ['NEON BAY'], color: PALETTE.neonCyan, x: -40, z: -40, y: 48, w: 26, h: 8, ry: 0 },
      { text: ['CASINO', 'LUNA'], color: PALETTE.neonPink, x: 200, z: -200, y: 38, w: 24, h: 9, ry: 0 },
      { text: ['MARINA'], color: PALETTE.neonGreen, x: 100, z: 400, y: 16, w: 22, h: 7, ry: 1.9 },
      { text: ['HOTEL', 'CORAL'], color: PALETTE.neonCyan, x: 120, z: 120, y: 38, w: 24, h: 9, ry: Math.PI / 2 },
      { text: ['TACOS', 'EL CAMINO'], color: PALETTE.neonYellow, x: -120, z: 40, y: 30, w: 24, h: 9, ry: -Math.PI / 2 },
      { text: ['CLUB VOLT'], color: PALETTE.neonPurple, x: -40, z: -120, y: 28, w: 22, h: 7, ry: 0 },
    ];
    const poleMat = new THREE.MeshLambertMaterial({ color: 0x3a3a42 });
    for (const b of boards) {
      const tex = textTexture(b.text, `#${b.color.toString(16).padStart(6, '0')}`, '#101018', 64);
      const mat = new THREE.MeshBasicMaterial({ map: tex });
      const board = new THREE.Mesh(new THREE.PlaneGeometry(b.w, b.h), mat);
      board.position.set(b.x, b.y, b.z);
      board.rotation.y = b.ry;
      this.group.add(board);
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.7, b.y, 8), poleMat);
      pole.position.set(b.x, b.y / 2, b.z);
      this.group.add(pole);
      const back = new THREE.Mesh(new THREE.BoxGeometry(b.w, b.h, 0.4), poleMat);
      back.position.set(b.x, b.y, b.z);
      back.rotation.y = b.ry;
      back.translateZ(-0.3);
      this.group.add(back);
      this.signMeshes.push(board);
    }
  }

  buildProps() {
    const rng = this.rng;
    const hydMat = new THREE.MeshLambertMaterial({ color: 0xc02a2a });
    const benchMat = new THREE.MeshLambertMaterial({ color: 0x6a4a2a });
    const stopMat = new THREE.MeshLambertMaterial({ color: 0x2a6a8a });
    // Hydrants, benches, bus stops scattered on sidewalks.
    for (let i = 0; i < 26; i++) {
      const a = rng.pick(AVENUES);
      const along = rng.float(-320, 320);
      const side = rng.chance(0.5) ? 1 : -1;
      const horiz = rng.chance(0.5);
      const x = horiz ? along : a + side * 9.5;
      const z = horiz ? a + side * 9.5 : along;
      const kind = rng.pick(['hydrant', 'bench', 'bench', 'bus']);
      if (kind === 'hydrant') {
        const h = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.45, 1.1, 8), hydMat);
        h.position.set(x, 0.55, z);
        this.group.add(h);
      } else if (kind === 'bench') {
        const b = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.5, 0.7), benchMat);
        b.position.set(x, 0.5, z);
        b.rotation.y = rng.float(0, Math.PI);
        this.group.add(b);
      } else {
        const shelter = new THREE.Mesh(new THREE.BoxGeometry(4, 2.6, 1.6), stopMat);
        shelter.position.set(x, 1.3, z);
        this.group.add(shelter);
        const roof = new THREE.Mesh(new THREE.BoxGeometry(4.4, 0.2, 2), new THREE.MeshLambertMaterial({ color: 0x1a3a4a }));
        roof.position.set(x, 2.7, z);
        this.group.add(roof);
      }
    }
    // 13 traffic lights at busy intersections, cycling green/yellow/red.
    const spots = [
      [-160, -160], [0, -160], [160, -160], [-160, 0], [0, 0], [160, 0],
      [-160, 160], [0, 160], [160, 160], [-320, 0], [320, 0], [0, -320], [0, 320],
    ];
    const poleMat = new THREE.MeshLambertMaterial({ color: 0x2a2a2e });
    for (const [x, z] of spots) {
      const g = new THREE.Group();
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.3, 6.5, 8), poleMat);
      pole.position.y = 3.25;
      g.add(pole);
      const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 4.4, 8), poleMat);
      arm.rotation.z = Math.PI / 2;
      arm.position.set(1.8, 6.2, 0);
      g.add(arm);
      const head = new THREE.Mesh(new THREE.BoxGeometry(0.9, 2.4, 0.9), poleMat);
      head.position.set(3.6, 5.6, 0);
      g.add(head);
      const lampGeo = new THREE.SphereGeometry(0.32, 8, 8);
      const lamps = {};
      for (const [name, dy, color] of [['red', 0.7, 0xff2a2a], ['yellow', 0, 0xffd42a], ['green', -0.7, 0x2aff5a]]) {
        const lamp = new THREE.Mesh(lampGeo, new THREE.MeshBasicMaterial({ color }));
        lamp.position.set(3.6, 5.6 + dy, 0.48);
        lamp.visible = name === 'green';
        g.add(lamp);
        lamps[name] = lamp;
      }
      g.position.set(x + 9, 0, z + 9);
      this.group.add(g);
      this.lights.push({ x: x + 9, z: z + 9, state: 'green', timer: rng.float(0, 8), lamps });
    }
  }

  buildMarina() {
    const rng = this.rng;
    const woodMat = new THREE.MeshLambertMaterial({ color: 0x8a6a42 });
    const woodDark = new THREE.MeshLambertMaterial({ color: 0x6a4a2a });
    // Pier deck from the sand out over the water.
    const deck = new THREE.Mesh(new THREE.BoxGeometry(9, 0.8, CFG.pierZ1 - CFG.pierZ0), woodMat);
    deck.position.set(CFG.pierX, 0.6, (CFG.pierZ0 + CFG.pierZ1) / 2);
    this.group.add(deck);
    for (let z = CFG.pierZ0 + 4; z < CFG.pierZ1; z += 10) {
      const plank = new THREE.Mesh(new THREE.BoxGeometry(9.4, 0.25, 1.2), woodDark);
      plank.position.set(CFG.pierX, 1.05, z);
      this.group.add(plank);
    }
    // Lamp posts along the pier.
    const lampMat = new THREE.MeshBasicMaterial({ color: 0xffe8a0 });
    for (let z = CFG.pierZ0 + 6; z < CFG.pierZ1 - 4; z += 16) {
      for (const side of [-4, 4]) {
        const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 3.4, 6), woodDark);
        pole.position.set(CFG.pierX + side, 2.6, z);
        this.group.add(pole);
        const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.3, 8, 8), lampMat);
        bulb.position.set(CFG.pierX + side, 4.4, z);
        this.group.add(bulb);
      }
    }
    // Hut at the pier end.
    const hut = new THREE.Mesh(new THREE.BoxGeometry(7, 3.4, 6), new THREE.MeshLambertMaterial({ color: 0x2a6a8a }));
    hut.position.set(CFG.pierX, 2.6, CFG.pierZ1 - 4);
    this.group.add(hut);
    const hutRoof = new THREE.Mesh(new THREE.ConeGeometry(5.4, 2.4, 4), new THREE.MeshLambertMaterial({ color: 0xc02a2a }));
    hutRoof.position.set(CFG.pierX, 5.4, CFG.pierZ1 - 4);
    hutRoof.rotation.y = Math.PI / 4;
    this.group.add(hutRoof);
    // 4 bobbing boats moored beside the pier.
    const hullColors = [0xd8d8d8, 0x2a6ab0, 0xc02a2a, 0xffd42a];
    const boatSpots = [
      [CFG.pierX - 10, 424], [CFG.pierX + 10, 436],
      [CFG.pierX - 10, 452], [CFG.pierX + 10, 462],
    ];
    boatSpots.forEach(([x, z], i) => {
      const g = new THREE.Group();
      const hull = new THREE.Mesh(new THREE.BoxGeometry(3.4, 1.1, 8.5), new THREE.MeshLambertMaterial({ color: hullColors[i] }));
      hull.position.y = 0.4;
      g.add(hull);
      const bow = new THREE.Mesh(new THREE.ConeGeometry(1.7, 2.6, 4), new THREE.MeshLambertMaterial({ color: hullColors[i] }));
      bow.rotation.x = Math.PI / 2;
      bow.rotation.y = Math.PI / 4;
      bow.position.set(0, 0.4, 5.4);
      g.add(bow);
      const cabin = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.2, 2.6), new THREE.MeshLambertMaterial({ color: 0x2a2a30 }));
      cabin.position.set(0, 1.4, -0.6);
      g.add(cabin);
      g.position.set(x, 0, z);
      this.group.add(g);
      this.boats.push({ group: g, phase: rng.float(0, Math.PI * 2), speed: rng.float(0.7, 1.1) });
    });
  }

  buildPalms() {
    const rng = this.rng;
    const trunkMat = new THREE.MeshLambertMaterial({ color: 0x6a4a2a });
    const leafMat = new THREE.MeshLambertMaterial({ color: 0x2a7a3a });
    for (let i = 0; i < 34; i++) {
      const beach = rng.chance(0.6);
      const x = beach ? rng.float(-340, 340) : rng.pick(BLOCKS) + rng.float(-24, 24);
      const z = beach ? rng.float(330, 356) : rng.pick(BLOCKS) + rng.float(-24, 24);
      const h = rng.float(5, 8);
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.4, h, 6), trunkMat);
      trunk.position.set(x, h / 2, z);
      trunk.rotation.z = rng.float(-0.08, 0.08);
      this.group.add(trunk);
      for (let f = 0; f < 6; f++) {
        const leaf = new THREE.Mesh(new THREE.ConeGeometry(0.9, 3.4, 4), leafMat);
        const a = (f / 6) * Math.PI * 2;
        leaf.position.set(x + Math.cos(a) * 1.4, h + 0.6, z + Math.sin(a) * 1.4);
        leaf.rotation.z = Math.cos(a) * 1.1;
        leaf.rotation.x = -Math.sin(a) * 1.1;
        this.group.add(leaf);
      }
    }
  }

  // Push a circle (x, z, r) out of every building footprint. Returns true if pushed.
  resolveCollision(x, z, r) {
    for (const c of this.colliders) {
      const nx = clamp(x, c.minX, c.maxX);
      const nz = clamp(z, c.minZ, c.maxZ);
      const dx = x - nx;
      const dz = z - nz;
      const d2 = dx * dx + dz * dz;
      if (d2 < r * r) {
        if (d2 > 0.0001) {
          const d = Math.sqrt(d2);
          x = nx + (dx / d) * r;
          z = nz + (dz / d) * r;
        } else {
          // Centre inside the box: push out along the smallest axis.
          const left = x - c.minX, right = c.maxX - x;
          const top = z - c.minZ, bottom = c.maxZ - z;
          const m = Math.min(left, right, top, bottom);
          if (m === left) x = c.minX - r;
          else if (m === right) x = c.maxX + r;
          else if (m === top) z = c.minZ - r;
          else z = c.maxZ + r;
        }
        return { x, z, hit: true };
      }
    }
    return { x, z, hit: false };
  }

  // Line of sight between two ground points (sampled against colliders).
  hasLineOfSight(x1, z1, x2, z2) {
    const d = Math.hypot(x2 - x1, z2 - z1);
    const steps = Math.max(2, Math.ceil(d / 2));
    for (let i = 1; i < steps; i++) {
      const t = i / steps;
      const x = x1 + (x2 - x1) * t;
      const z = z1 + (z2 - z1) * t;
      for (const c of this.colliders) {
        if (x > c.minX - 1 && x < c.maxX + 1 && z > c.minZ - 1 && z < c.maxZ + 1) return false;
      }
    }
    return true;
  }

  // Traffic light state for a given intersection position.
  lightAt(x, z) {
    let best = null;
    let bd = 1e9;
    for (const l of this.lights) {
      const d = Math.hypot(l.x - x, l.z - z);
      if (d < bd) { bd = d; best = l; }
    }
    return bd < 30 ? best.state : 'green';
  }

  update(dt, time) {
    for (const b of this.beacons) {
      b.mesh.visible = Math.sin(time * 2.4 + b.phase) > 0;
    }
    for (const boat of this.boats) {
      boat.group.position.y = Math.sin(time * boat.speed + boat.phase) * 0.35;
      boat.group.rotation.z = Math.sin(time * boat.speed * 0.8 + boat.phase) * 0.04;
      boat.group.rotation.x = Math.cos(time * boat.speed * 0.7 + boat.phase) * 0.03;
    }
    // Traffic lights cycle: green 6 s, yellow 1.5 s, red 6 s.
    for (const l of this.lights) {
      l.timer += dt;
      const cycle = l.timer % 13.5;
      const state = cycle < 6 ? 'green' : cycle < 7.5 ? 'yellow' : 'red';
      if (state !== l.state) {
        l.state = state;
        l.lamps.red.visible = state === 'red';
        l.lamps.yellow.visible = state === 'yellow';
        l.lamps.green.visible = state === 'green';
      }
    }
  }
}
