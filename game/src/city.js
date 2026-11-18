// Neon Bay — the city itself. A 9x9 grid of avenues (74 m pitch) built
// deterministically from the seed: ~140 buildings with stepped crowns,
// rooftop props and blinking beacons, 20 neon signs and 6 billboards with
// real canvas text, street props, 13 cycling traffic lights, and a marina
// with a pier and four bobbing boats on the western ocean. Also owns the
// building colliders the player and cars resolve against.
import * as THREE from 'three';
import { CONFIG, avenue } from './config.js';
import { Rng } from './rng.js';

function canvasTexture(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d'), w, h);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function textTexture(text, color, w = 512, h = 128, sub = '') {
  return canvasTexture(w, h, (g) => {
    g.clearRect(0, 0, w, h);
    g.fillStyle = 'rgba(8,6,16,0.92)';
    g.fillRect(0, 0, w, h);
    g.strokeStyle = color;
    g.lineWidth = 6;
    g.strokeRect(6, 6, w - 12, h - 12);
    g.font = `900 ${sub ? 64 : 78}px Arial, sans-serif`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.shadowColor = color;
    g.shadowBlur = 26;
    g.fillStyle = color;
    g.fillText(text, w / 2, sub ? h / 2 - 18 : h / 2);
    if (sub) {
      g.font = '700 34px Arial, sans-serif';
      g.shadowBlur = 10;
      g.fillText(sub, w / 2, h - 34);
    }
  });
}

export class City {
  constructor(scene, seed = CONFIG.seed) {
    this.scene = scene;
    this.rng = new Rng(seed);
    this.colliders = []; // {minX, maxX, minZ, maxZ}
    this.beacons = []; // {mat, phase}
    this.boats = []; // {group, phase, baseY}
    this.trafficLights = []; // {x, z, offset, redMat, greenMat, nsGreen}
    this.signSpots = []; // tall facades the neon signs hang on
    this.intersections = [];
    for (let i = -CONFIG.gridHalf; i <= CONFIG.gridHalf; i++) {
      for (let j = -CONFIG.gridHalf; j <= CONFIG.gridHalf; j++) {
        this.intersections.push({ x: avenue(i), z: avenue(j) });
      }
    }
    this.buildGround();
    this.buildOceanAndBeach();
    this.buildBuildings();
    this.buildSignsAndBillboards();
    this.buildStreetProps();
    this.buildMarina();
    this.buildTrafficLights();
  }

  // ---- ground: one big canvas texture with roads, lanes, crosswalks ----
  buildGround() {
    const size = 760;
    const px = 2048;
    const scale = px / size;
    const toPx = (v) => (v + size / 2) * scale;
    const tex = canvasTexture(px, px, (g) => {
      g.fillStyle = '#555066'; // sidewalk grey
      g.fillRect(0, 0, px, px);
      // Blocks slightly darker than the sidewalk.
      g.fillStyle = '#453f52';
      for (let bi = -4; bi <= 3; bi++) {
        for (let bj = -4; bj <= 3; bj++) {
          const x0 = toPx(bi * 74 + 8);
          const z0 = toPx(bj * 74 + 8);
          g.fillRect(x0, z0, 58 * scale, 58 * scale);
        }
      }
      // Road strips.
      g.fillStyle = '#3a3546';
      for (let i = -4; i <= 4; i++) {
        const c = toPx(i * 74);
        g.fillRect(0, c - 7 * scale, px, 14 * scale);
        g.fillRect(c - 7 * scale, 0, 14 * scale, px);
      }
      // Lane dashes.
      g.fillStyle = '#8a7a30';
      for (let i = -4; i <= 4; i++) {
        const c = toPx(i * 74);
        for (let d = -360; d < 360; d += 12) {
          g.fillRect(toPx(d), c - 0.5 * scale, 6 * scale, 1 * scale);
          g.fillRect(c - 0.5 * scale, toPx(d), 1 * scale, 6 * scale);
        }
      }
      // Crosswalks at every intersection.
      g.fillStyle = '#d8d8d8';
      for (let i = -4; i <= 4; i++) {
        for (let j = -4; j <= 4; j++) {
          const cx = toPx(i * 74);
          const cz = toPx(j * 74);
          for (let s = -3; s <= 3; s++) {
            g.fillRect(cx + s * 2 * scale - 0.7 * scale, cz - 9 * scale, 1.4 * scale, 3.4 * scale);
            g.fillRect(cx + s * 2 * scale - 0.7 * scale, cz + 5.6 * scale, 1.4 * scale, 3.4 * scale);
          }
        }
      }
    });
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(size, size),
      new THREE.MeshLambertMaterial({ map: tex }),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = 0;
    this.scene.add(ground);
  }

  buildOceanAndBeach() {
    const sand = new THREE.Mesh(
      new THREE.PlaneGeometry(38, 700),
      new THREE.MeshLambertMaterial({ color: CONFIG.palette.sand }),
    );
    sand.rotation.x = -Math.PI / 2;
    sand.position.set(-314, 0.05, 0);
    this.scene.add(sand);
    const ocean = new THREE.Mesh(
      new THREE.PlaneGeometry(420, 760),
      new THREE.MeshLambertMaterial({ color: CONFIG.palette.ocean }),
    );
    ocean.rotation.x = -Math.PI / 2;
    ocean.position.set(-543, 0.02, 0);
    this.scene.add(ocean);
    // A pale surf line where the water meets the sand.
    const surf = new THREE.Mesh(
      new THREE.PlaneGeometry(4, 700),
      new THREE.MeshBasicMaterial({ color: 0x9fd8e8 }),
    );
    surf.rotation.x = -Math.PI / 2;
    surf.position.set(-333, 0.08, 0);
    this.scene.add(surf);
  }

  // ---- buildings ----
  facadeTextures() {
    const variants = [];
    const bases = ['#5a5468', '#6e4a3a', '#3d5a74', '#7a6a4a'];
    for (const base of bases) {
      const lit = [];
      const map = canvasTexture(128, 256, (g) => {
        g.fillStyle = base;
        g.fillRect(0, 0, 128, 256);
        g.fillStyle = 'rgba(0,0,0,0.25)';
        for (let y = 0; y < 256; y += 16) g.fillRect(0, y, 128, 2);
        // Windows: dark glass, some warm-lit.
        for (let y = 10; y < 248; y += 18) {
          for (let x = 10; x < 120; x += 18) {
            const on = this.rng.chance(0.42);
            g.fillStyle = on ? '#ffd27a' : '#1c2438';
            g.fillRect(x, y, 11, 12);
            if (on) lit.push([x, y]);
          }
        }
      });
      const emissive = canvasTexture(128, 256, (g) => {
        g.fillStyle = '#000000';
        g.fillRect(0, 0, 128, 256);
        g.fillStyle = '#ffca6a';
        for (const [x, y] of lit) g.fillRect(x, y, 11, 12);
      });
      variants.push({ map, emissive });
    }
    return variants;
  }

  buildBuildings() {
    const variants = this.facadeTextures();
    const mats = variants.map(
      (v) =>
        new THREE.MeshLambertMaterial({
          map: v.map,
          emissive: 0xffffff,
          emissiveMap: v.emissive,
          emissiveIntensity: 0.55,
        }),
    );
    const crownMat = new THREE.MeshLambertMaterial({ color: 0x2c2836 });
    const propMat = new THREE.MeshLambertMaterial({ color: 0x3a3644 });
    const towerMat = new THREE.MeshLambertMaterial({ color: 0x4a3a2e });
    const boxGeo = new THREE.BoxGeometry(1, 1, 1);
    const beaconGeo = new THREE.SphereGeometry(0.5, 8, 6);
    let count = 0;
    for (let bi = -4; bi <= 3; bi++) {
      for (let bj = -4; bj <= 3; bj++) {
        const cx = (bi + 0.5) * CONFIG.pitch;
        const cz = (bj + 0.5) * CONFIG.pitch;
        // The casino block and the marina block are special; parks stay open.
        const isCasino = bi === 2 && bj === 2;
        const isMarinaBlock = bi === -4 && bj === 2;
        if (this.rng.chance(0.08) && !isCasino) continue; // pocket park
        const dist = Math.hypot(cx, cz);
        const downtown = dist < 150;
        const mid = dist < 240;
        const perBlock = isCasino ? 1 : downtown ? 3 : mid ? 2 : this.rng.chance(0.5) ? 2 : 1;
        for (let k = 0; k < perBlock; k++) {
          const w = this.rng.range(18, 30);
          const d = this.rng.range(18, 30);
          const h = isCasino
            ? 34
            : downtown
              ? this.rng.range(26, 58)
              : mid
                ? this.rng.range(12, 28)
                : this.rng.range(6, 15);
          const ox = this.rng.range(-10, 10);
          const oz = this.rng.range(-10, 10);
          const x = cx + ox;
          const z = cz + oz;
          const mat = isCasino
            ? new THREE.MeshLambertMaterial({ color: 0x8a6a2e, emissive: 0x332200, emissiveIntensity: 0.6 })
            : this.rng.pick(mats);
          const b = new THREE.Mesh(boxGeo, mat);
          b.scale.set(w, h, d);
          b.position.set(x, h / 2, z);
          this.scene.add(b);
          this.colliders.push({ minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2 });
          count++;
          // Stepped crown on tall towers.
          if (h > 24) {
            const crown = new THREE.Mesh(boxGeo, crownMat);
            crown.scale.set(w * 0.55, h * 0.14, d * 0.55);
            crown.position.set(x, h + h * 0.07, z);
            this.scene.add(crown);
          }
          // Rooftop props: AC units, water towers, antennas with beacons.
          const roll = this.rng.next();
          if (roll < 0.3) {
            const ac = new THREE.Mesh(boxGeo, propMat);
            ac.scale.set(3, 1.6, 2.4);
            ac.position.set(x + w * 0.2, h + 0.8, z);
            this.scene.add(ac);
          } else if (roll < 0.5) {
            const tower = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.2, 4, 8), towerMat);
            tower.position.set(x - w * 0.2, h + 2, z - d * 0.2);
            this.scene.add(tower);
            const roof = new THREE.Mesh(new THREE.ConeGeometry(2.6, 2, 8), towerMat);
            roof.position.set(x - w * 0.2, h + 5, z - d * 0.2);
            this.scene.add(roof);
          } else if (roll < 0.68 && h > 14) {
            const ant = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 9, 6), propMat);
            ant.position.set(x, h + 4.5, z);
            this.scene.add(ant);
            const bmat = new THREE.MeshBasicMaterial({ color: 0xff2a2a });
            const beacon = new THREE.Mesh(beaconGeo, bmat);
            beacon.position.set(x, h + 9.4, z);
            this.scene.add(beacon);
            this.beacons.push({ mat: bmat, phase: this.rng.range(0, 6.28) });
          }
          // Remember a few tall facades for neon signs.
          if (h > 16 && this.signSpots && this.signSpots.length < 20 && this.rng.chance(0.35)) {
            this.signSpots.push({ x, z, h, w, d });
          }
        }
        if (isMarinaBlock) {
          // Low beachfront shops only; the pier handles the rest.
        }
      }
    }
    this.buildingCount = count;
  }

  buildSignsAndBillboards() {
    this.signSpots = this.signSpots || [];
    // Signs need facades; if the pass above collected too few, fall back to
    // fixed spots along the avenues.
    const spots = this.signSpots.slice(0, 20);
    for (let i = 0; i < 20; i++) {
      const def = CONFIG.signs[i % CONFIG.signs.length];
      const tex = textTexture(def.text, def.color, 512, 128);
      const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true });
      const sign = new THREE.Mesh(new THREE.PlaneGeometry(11, 2.75), mat);
      if (spots[i]) {
        const s = spots[i];
        const face = this.rng.pick([0, 1, 2, 3]);
        const y = s.h * this.rng.range(0.45, 0.7);
        if (face === 0) { sign.position.set(s.x, y, s.z + s.d / 2 + 0.15); sign.rotation.y = 0; }
        if (face === 1) { sign.position.set(s.x, y, s.z - s.d / 2 - 0.15); sign.rotation.y = Math.PI; }
        if (face === 2) { sign.position.set(s.x + s.w / 2 + 0.15, y, s.z); sign.rotation.y = Math.PI / 2; }
        if (face === 3) { sign.position.set(s.x - s.w / 2 - 0.15, y, s.z); sign.rotation.y = -Math.PI / 2; }
      } else {
        // Fallback: float the sign on a pole over the sidewalk.
        const ix = this.rng.pick([-2, -1, 0, 1, 2]) * 74;
        const iz = this.rng.pick([-2, -1, 0, 1, 2]) * 74;
        sign.position.set(ix + 10, 9, iz + 10);
        sign.rotation.y = this.rng.range(0, 6.28);
      }
      this.scene.add(sign);
    }
    // Six freestanding billboards, each readable from the avenue it faces.
    const boards = [
      { text: 'NEON BAY', sub: 'DUSK CITY', color: '#ff2e88', x: -260, z: 150, ry: Math.PI / 2 },
      { text: 'CASINO LUNA', sub: 'OPEN ALL NIGHT', color: '#ffd23e', x: 180, z: -180, ry: -Math.PI / 2 },
      { text: 'TACOS EL CAMINO', sub: '24 HOURS', color: '#7dff5a', x: -150, z: -260, ry: 0 },
      { text: 'HOTEL CORAL', sub: 'OCEAN VIEW', color: '#ff7a3c', x: 260, z: 100, ry: Math.PI },
      { text: 'CLUB VOLT', sub: 'LIVE TONIGHT', color: '#b45aff', x: 100, z: 260, ry: Math.PI / 2 },
      { text: 'MARINA', sub: 'PIER 9 · BOATS', color: '#2ee6ff', x: -330, z: 218, ry: Math.PI / 2 },
    ];
    const poleMat = new THREE.MeshLambertMaterial({ color: 0x2c2836 });
    for (const b of boards) {
      const tex = textTexture(b.text, b.color, 512, 256, b.sub);
      const panel = new THREE.Mesh(
        new THREE.PlaneGeometry(15, 7.5),
        new THREE.MeshBasicMaterial({ map: tex, transparent: true }),
      );
      panel.position.set(b.x, 10, b.z);
      panel.rotation.y = b.ry;
      this.scene.add(panel);
      for (const dx of [-5, 5]) {
        const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 10, 6), poleMat);
        const off = b.ry === 0 || b.ry === Math.PI ? { x: dx, z: 0 } : { x: 0, z: dx };
        pole.position.set(b.x + off.x, 5, b.z + off.z);
        this.scene.add(pole);
      }
    }
  }

  buildStreetProps() {
    const rng = this.rng;
    const hydrantMat = new THREE.MeshLambertMaterial({ color: 0xb02020 });
    const benchMat = new THREE.MeshLambertMaterial({ color: 0x6a4a2e });
    const palmTrunk = new THREE.MeshLambertMaterial({ color: 0x6a4a2e });
    const palmLeaf = new THREE.MeshLambertMaterial({ color: 0x2e5a2e });
    const trunkGeo = new THREE.CylinderGeometry(0.25, 0.4, 6, 6);
    const frondGeo = new THREE.ConeGeometry(1.1, 3.4, 5);
    // Palms along the beach promenade and a few downtown.
    for (let i = 0; i < 36; i++) {
      const x = i < 24 ? -308 + rng.range(-4, 4) : rng.pick([-222, -148, 0, 148, 222]) + rng.range(-9, 9);
      const z = i < 24 ? -300 + i * 26 + rng.range(-6, 6) : rng.pick([-222, -148, 0, 148, 222]) + rng.range(-9, 9);
      const trunk = new THREE.Mesh(trunkGeo, palmTrunk);
      trunk.position.set(x, 3, z);
      trunk.rotation.z = rng.range(-0.08, 0.08);
      this.scene.add(trunk);
      for (let f = 0; f < 5; f++) {
        const frond = new THREE.Mesh(frondGeo, palmLeaf);
        const a = (f / 5) * Math.PI * 2;
        frond.position.set(x + Math.cos(a) * 1.1, 6.6, z + Math.sin(a) * 1.1);
        frond.rotation.z = Math.cos(a) * 1.1;
        frond.rotation.x = -Math.sin(a) * 1.1;
        this.scene.add(frond);
      }
    }
    // Hydrants, benches, bus stops.
    for (let i = 0; i < 20; i++) {
      const x = rng.pick([-296, -222, -148, -74, 0, 74, 148, 222, 296]) + rng.range(9, 11) * rng.pick([-1, 1]);
      const z = rng.pick([-296, -222, -148, -74, 0, 74, 148, 222, 296]) + rng.range(-20, 20);
      const h = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.45, 1, 8), hydrantMat);
      h.position.set(x, 0.5, z);
      this.scene.add(h);
    }
    for (let i = 0; i < 12; i++) {
      const x = rng.pick([-222, -148, 0, 148, 222]) + 9.5;
      const z = rng.pick([-222, -148, 0, 148, 222]) + rng.range(-30, 30);
      const bench = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.5, 0.8), benchMat);
      bench.position.set(x, 0.5, z);
      this.scene.add(bench);
    }
    for (const [bx, bz] of [[-140, 8], [82, -140], [8, 230], [230, -82]]) {
      const postMat = new THREE.MeshLambertMaterial({ color: 0x2c2836 });
      for (const dx of [-2, 2]) {
        const post = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 3, 6), postMat);
        post.position.set(bx + dx, 1.5, bz);
        this.scene.add(post);
      }
      const roof = new THREE.Mesh(new THREE.BoxGeometry(5.4, 0.25, 2.2), postMat);
      roof.position.set(bx, 3.1, bz);
      this.scene.add(roof);
    }
  }

  buildMarina() {
    const wood = new THREE.MeshLambertMaterial({ color: 0x7a5a34 });
    const pier = new THREE.Mesh(new THREE.BoxGeometry(52, 1, 10), wood);
    pier.position.set(-359, 0.6, 222);
    this.scene.add(pier);
    for (let i = 0; i < 6; i++) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 2.4, 6), wood);
      post.position.set(-340 - i * 8, 0.4, 222 + (i % 2 === 0 ? 4.6 : -4.6));
      this.scene.add(post);
    }
    // Lamp posts along the pier so it reads at dusk, and a hut at its end.
    const lampMat = new THREE.MeshBasicMaterial({ color: 0xffe9a0 });
    for (const lx of [-344, -360, -376]) {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 4, 6), wood);
      pole.position.set(lx, 2.6, 225.5);
      this.scene.add(pole);
      const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.45, 8, 6), lampMat);
      lamp.position.set(lx, 4.8, 225.5);
      this.scene.add(lamp);
    }
    const hut = new THREE.Mesh(new THREE.BoxGeometry(6, 3.4, 5), new THREE.MeshLambertMaterial({ color: 0x2a6a8a }));
    hut.position.set(-382, 2.3, 222);
    this.scene.add(hut);
    const hutRoof = new THREE.Mesh(new THREE.ConeGeometry(4.4, 2, 4), new THREE.MeshLambertMaterial({ color: 0x8a2a3a }));
    hutRoof.position.set(-382, 5, 222);
    hutRoof.rotation.y = Math.PI / 4;
    this.scene.add(hutRoof);
    const hullMat = new THREE.MeshLambertMaterial({ color: 0xd8d8d8 });
    const cabinMat = new THREE.MeshLambertMaterial({ color: 0x2a6a8a });
    const spots = [[-352, 208], [-366, 236], [-346, 244], [-376, 214]];
    for (const [x, z] of spots) {
      const g = new THREE.Group();
      const hull = new THREE.Mesh(new THREE.BoxGeometry(9, 2, 3.4), hullMat);
      hull.position.y = 0.5;
      g.add(hull);
      const cabin = new THREE.Mesh(new THREE.BoxGeometry(3.6, 2, 2.4), cabinMat);
      cabin.position.set(-0.6, 2.2, 0);
      g.add(cabin);
      g.position.set(x, 0, z);
      g.rotation.y = this.rng.range(-0.2, 0.2);
      this.scene.add(g);
      this.boats.push({ group: g, phase: this.rng.range(0, 6.28), baseY: 0 });
    }
  }

  buildTrafficLights() {
    const spots = [
      [0, 0], [148, 0], [-148, 0], [0, 148], [0, -148], [222, 74], [-222, -74],
      [74, 222], [-74, -222], [148, -222], [-148, 222], [222, -148], [-222, 148],
    ];
    const poleMat = new THREE.MeshLambertMaterial({ color: 0x1c1a22 });
    spots.forEach(([x, z], i) => {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 6.5, 6), poleMat);
      pole.position.set(x + 8.5, 3.25, z + 8.5);
      this.scene.add(pole);
      const head = new THREE.Mesh(new THREE.BoxGeometry(1, 2.6, 0.8), poleMat);
      head.position.set(x + 8.5, 6.8, z + 8.5);
      this.scene.add(head);
      const redMat = new THREE.MeshBasicMaterial({ color: 0x881111 });
      const greenMat = new THREE.MeshBasicMaterial({ color: 0x11aa44 });
      const red = new THREE.Mesh(new THREE.SphereGeometry(0.32, 8, 6), redMat);
      red.position.set(x + 8.5, 7.5, z + 9);
      this.scene.add(red);
      const green = new THREE.Mesh(new THREE.SphereGeometry(0.32, 8, 6), greenMat);
      green.position.set(x + 8.5, 6.2, z + 9);
      this.scene.add(green);
      this.trafficLights.push({ x, z, offset: i * 1.7, redMat, greenMat, nsGreen: true });
    });
  }

  // Animate boats, beacons and traffic lights. Called every frame.
  update(dt, t) {
    for (const b of this.boats) {
      b.group.position.y = Math.sin(t * 0.7 + b.phase) * 0.35;
      b.group.rotation.z = Math.sin(t * 0.5 + b.phase) * 0.03;
    }
    for (const b of this.beacons) {
      b.mat.color.setHex(Math.sin(t * 2.4 + b.phase) > 0 ? 0xff2a2a : 0x551111);
    }
    for (const l of this.trafficLights) {
      const ns = ((t + l.offset) % 20) < 10;
      l.nsGreen = ns;
      l.redMat.color.setHex(ns ? 0x551111 : 0xff2a2a);
      l.greenMat.color.setHex(ns ? 0x2aff66 : 0x115522);
    }
  }

  // Line of sight between two points, for the police: true when the
  // straight segment stays clear of every building (expanded by 2 m).
  // A cruiser only charges straight at the player when it can actually
  // see them — otherwise it follows the road graph and never cuts a
  // corner through a block and gets stuck on a wall.
  hasLineOfSight(x1, z1, x2, z2) {
    const dist = Math.hypot(x2 - x1, z2 - z1);
    const steps = Math.max(1, Math.ceil(dist / 2));
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const x = x1 + (x2 - x1) * t;
      const z = z1 + (z2 - z1) * t;
      for (const b of this.colliders) {
        if (x > b.minX - 2 && x < b.maxX + 2 && z > b.minZ - 2 && z < b.maxZ + 2) return false;
      }
    }
    return true;
  }

  // Is the north-south direction green at the light nearest (x, z)?
  lightIsGreen(x, z, ns) {
    let best = null;
    let bestD = 1e9;
    for (const l of this.trafficLights) {
      const d = Math.hypot(l.x - x, l.z - z);
      if (d < bestD) { bestD = d; best = l; }
    }
    if (!best || bestD > 30) return true; // no light nearby: go
    return ns ? best.nsGreen : !best.nsGreen;
  }
}
