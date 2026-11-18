// Neon Bay v5c — procedural city: blocks, towers, neon, marina, pier, wheel.
// Every footprint is clamped 2 m inside its block edge so no building ever
// overhangs a road; billboards sit inside corner blocks, never on road nodes.
// The pier has NO collider (mission 6's target is on it).
import * as THREE from '../vendor/three.module.min.js';
import { CFG } from './config.js';

function canvasTexture(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function windowTexture(rng) {
  return canvasTexture(128, 256, (g, w, h) => {
    g.fillStyle = '#101018'; g.fillRect(0, 0, w, h);
    for (let y = 8; y < h - 8; y += 16) {
      for (let x = 8; x < w - 8; x += 16) {
        const lit = rng.next();
        g.fillStyle = lit < 0.45 ? (rng.chance(0.5) ? '#ffd27a' : '#9fd8ff')
          : lit < 0.6 ? '#ff9a5a' : '#232336';
        g.fillRect(x, y, 10, 10);
      }
    }
  });
}

function signTexture(text, color, bg) {
  return canvasTexture(512, 128, (g, w, h) => {
    g.fillStyle = bg; g.fillRect(0, 0, w, h);
    g.strokeStyle = color; g.lineWidth = 6; g.strokeRect(6, 6, w - 12, h - 12);
    g.fillStyle = color; g.font = 'bold 64px Arial';
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.shadowColor = color; g.shadowBlur = 22;
    g.fillText(text, w / 2, h / 2 + 2);
  });
}

export function buildCity(scene, rng) {
  const colliders = [];
  const ferris = { group: null, cabins: [] };
  const animated = [];
  const W = CFG.world;

  // --- ground, beach, sea ---
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(W * 2 + 120, W * 2 + 120),
    new THREE.MeshStandardMaterial({ color: 0x464a52, roughness: 0.95 }),
  );
  ground.rotation.x = -Math.PI / 2; ground.position.set(0, 0, 40);
  scene.add(ground);
  const sand = new THREE.Mesh(
    new THREE.PlaneGeometry(W * 2 + 120, 24),
    new THREE.MeshStandardMaterial({ color: 0xc9a06a, roughness: 1 }),
  );
  sand.rotation.x = -Math.PI / 2; sand.position.set(0, 0.05, 172);
  scene.add(sand);
  const sea = new THREE.Mesh(
    new THREE.PlaneGeometry(W * 2 + 400, 260),
    new THREE.MeshStandardMaterial({ color: 0x0d3a5c, roughness: 0.25, metalness: 0.35 }),
  );
  sea.rotation.x = -Math.PI / 2; sea.position.set(0, 0.02, 320);
  scene.add(sea);

  // --- roads: dark strips + centre dashes ---
  const roadMat = new THREE.MeshStandardMaterial({ color: 0x272b34, roughness: 0.9 });
  const dashMat = new THREE.MeshBasicMaterial({ color: 0xd8c95a });
  const lines = [];
  for (let v = CFG.gridMin; v <= CFG.gridMax; v += CFG.roadStep) lines.push(v);
  for (const v of lines) {
    const h = new THREE.Mesh(new THREE.PlaneGeometry(W * 2 + 20, 12), roadMat);
    h.rotation.x = -Math.PI / 2; h.position.set(0, 0.08, v); scene.add(h);
    const vt = new THREE.Mesh(new THREE.PlaneGeometry(12, W * 2 + 20), roadMat);
    vt.rotation.x = -Math.PI / 2; vt.position.set(v, 0.08, 0); scene.add(vt);
    for (let d = -160; d <= 160; d += 16) {
      const dash = new THREE.Mesh(new THREE.PlaneGeometry(6, 0.7), dashMat);
      dash.rotation.x = -Math.PI / 2; dash.position.set(d, 0.12, v); scene.add(dash);
      const dash2 = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 6), dashMat);
      dash2.rotation.x = -Math.PI / 2; dash2.position.set(v, 0.12, d); scene.add(dash2);
    }
  }

  // --- buildings: one or two per block, clamped inside the block edge ---
  const winTex = windowTexture(rng);
  const wallCols = [0x4a4a58, 0x5a4a44, 0x44505e, 0x5e4a52, 0x3e4a44, 0x55483a];
  const roofMat = new THREE.MeshStandardMaterial({ color: 0x2a2c33, roughness: 1 });
  let signIdx = 0;
  for (let bx = -160; bx <= 120; bx += 40) {
    for (let bz = -160; bz <= 120; bz += 40) {
      // skip the fountain plaza block and the pier approach block
      if (bx === -80 && bz === -80) continue;
      if (bx === 120 && bz === 120) continue;
      const cx = bx + 20, cz = bz + 20;
      const downtown = Math.abs(cx) <= 80 && Math.abs(cz) <= 80;
      const beach = cz >= 120;
      const n = rng.chance(0.35) ? 2 : 1;
      for (let i = 0; i < n; i++) {
        const w = rng.range(10, 14), d = rng.range(10, 14);
        const ox = n === 2 ? (i === 0 ? -7 : 7) : 0;
        const oz = n === 2 ? (i === 0 ? -7 : 7) : 0;
        const x = cx + ox, z = cz + oz;
        // clamp: footprint stays 2 m inside the block edge
        const hw = w / 2, hd = d / 2;
        if (Math.abs(x - cx) + hw > 18 || Math.abs(z - cz) + hd > 18) continue;
        const hgt = downtown ? rng.range(24, 68) : beach ? rng.range(10, 22) : rng.range(12, 34);
        const mat = new THREE.MeshStandardMaterial({
          color: wallCols[Math.floor(rng.next() * wallCols.length)],
          roughness: 0.85, emissive: 0xffffff, emissiveMap: winTex,
          emissiveIntensity: 0.55,
        });
        const b = new THREE.Mesh(new THREE.BoxGeometry(w, hgt, d), mat);
        b.position.set(x, hgt / 2, z);
        scene.add(b);
        const roof = new THREE.Mesh(new THREE.BoxGeometry(w + 0.6, 0.5, d + 0.6), roofMat);
        roof.position.set(x, hgt + 0.25, z);
        scene.add(roof);
        colliders.push({ x, z, hw: hw + 0.4, hd: hd + 0.4 });
        // rooftop props: AC units, water tower, blinking beacon
        if (rng.chance(0.6)) {
          const ac = new THREE.Mesh(new THREE.BoxGeometry(2, 1, 2),
            new THREE.MeshStandardMaterial({ color: 0x777777 }));
          ac.position.set(x + rng.range(-3, 3), hgt + 1, z + rng.range(-3, 3));
          scene.add(ac);
        }
        if (rng.chance(0.35)) {
          const tw = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.2, 3, 8),
            new THREE.MeshStandardMaterial({ color: 0x8a6a4a }));
          tw.position.set(x + 3, hgt + 2, z - 3); scene.add(tw);
        }
        if (hgt > 45 && rng.chance(0.5)) {
          const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.5, 8, 8),
            new THREE.MeshBasicMaterial({ color: 0xff2222 }));
          beacon.position.set(x, hgt + 1.2, z); scene.add(beacon);
          animated.push({ mesh: beacon, kind: 'blink' });
        }
        // stepped tower crown on the tallest downtown blocks
        if (downtown && hgt > 50) {
          const crown = new THREE.Mesh(new THREE.BoxGeometry(w * 0.5, 4, d * 0.5), mat);
          crown.position.set(x, hgt + 2.2, z); scene.add(crown);
        }
        // neon sign on the facade, facing the nearest road
        if (signIdx < CFG.signs.length && rng.chance(0.75)) {
          const text = CFG.signs[signIdx++];
          const col = ['#ff2e88', '#22e6ff', '#ffd23e', '#7dff5a', '#ff7a2e'][signIdx % 5];
          const sign = new THREE.Mesh(
            new THREE.PlaneGeometry(Math.min(14, 3 + text.length * 0.7), 3.2),
            new THREE.MeshBasicMaterial({ map: signTexture(text, col, '#0a0a12'), side: THREE.DoubleSide }),
          );
          const faceSouth = Math.abs(z - (bz + 40)) < Math.abs(z - bz);
          sign.position.set(x, Math.min(hgt - 2, 12), z + (faceSouth ? hd + 0.15 : -hd - 0.15));
          if (!faceSouth) sign.rotation.y = Math.PI;
          scene.add(sign);
        }
      }
    }
  }
  // remaining signs on freestanding posts along the beach road
  while (signIdx < CFG.signs.length) {
    const text = CFG.signs[signIdx];
    const col = ['#ff2e88', '#22e6ff', '#ffd23e', '#7dff5a', '#ff7a2e'][signIdx % 5];
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.4, 7, 0.4),
      new THREE.MeshStandardMaterial({ color: 0x555555 }));
    const px = -140 + signIdx * 28, pz = 152;
    post.position.set(px, 3.5, pz); scene.add(post);
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(12, 2.8),
      new THREE.MeshBasicMaterial({ map: signTexture(text, col, '#0a0a12'), side: THREE.DoubleSide }));
    sign.position.set(px, 7.5, pz); scene.add(sign);
    colliders.push({ x: px, z: pz, hw: 0.6, hd: 0.6 });
    signIdx++;
  }

  // --- billboards: freestanding, inside corner blocks (never on road nodes) ---
  const bbSpots = [[-152, -152], [152, -152], [-152, 152], [152, 152], [-152, 0], [152, 0], [0, -152], [0, 152]];
  CFG.billboards.forEach((text, i) => {
    const [bx, bz] = bbSpots[i % bbSpots.length];
    const col = ['#ff2e88', '#22e6ff', '#ffd23e', '#7dff5a'][i % 4];
    const legs = new THREE.Mesh(new THREE.BoxGeometry(0.6, 9, 0.6),
      new THREE.MeshStandardMaterial({ color: 0x444444 }));
    legs.position.set(bx, 4.5, bz); scene.add(legs);
    const board = new THREE.Mesh(new THREE.PlaneGeometry(16, 5),
      new THREE.MeshBasicMaterial({ map: signTexture(text, col, '#101018'), side: THREE.DoubleSide }));
    board.position.set(bx, 11, bz);
    board.rotation.y = (i % 2 === 0) ? Math.PI / 4 : -Math.PI / 4;
    scene.add(board);
    colliders.push({ x: bx, z: bz, hw: 1, hd: 1 });
  });

  // --- fountain plaza (block -80,-80) ---
  const plaza = new THREE.Mesh(new THREE.CylinderGeometry(9, 9, 0.6, 24),
    new THREE.MeshStandardMaterial({ color: 0x8a8a92, roughness: 0.7 }));
  plaza.position.set(-60, 0.3, -60); scene.add(plaza);
  const water = new THREE.Mesh(new THREE.CylinderGeometry(7.5, 7.5, 0.4, 24),
    new THREE.MeshStandardMaterial({ color: 0x2a9ad8, roughness: 0.15, metalness: 0.4 }));
  water.position.set(-60, 0.6, -60); scene.add(water);
  const jet = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 1.2, 4, 8),
    new THREE.MeshStandardMaterial({ color: 0x9fd8ff, emissive: 0x3a7aff, emissiveIntensity: 0.6 }));
  jet.position.set(-60, 2.5, -60); scene.add(jet);
  colliders.push({ x: -60, z: -60, hw: 9.5, hd: 9.5 });
  for (let i = 0; i < 4; i++) {
    const bench = new THREE.Mesh(new THREE.BoxGeometry(3, 0.6, 1),
      new THREE.MeshStandardMaterial({ color: 0x6a4a2a }));
    const a = (i / 4) * Math.PI * 2;
    bench.position.set(-60 + Math.cos(a) * 13, 0.3, -60 + Math.sin(a) * 13);
    bench.rotation.y = -a; scene.add(bench);
  }

  // --- marina: pier (NO collider), boats, lamps, hut ---
  const pierMat = new THREE.MeshStandardMaterial({ color: 0x7a5a38, roughness: 0.9 });
  const pier = new THREE.Mesh(new THREE.BoxGeometry(8, 1, 84), pierMat);
  pier.position.set(135, 0.5, 204); scene.add(pier);
  for (let i = 0; i < 5; i++) {
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.5, 8, 8),
      new THREE.MeshBasicMaterial({ color: 0xffe9a8 }));
    lamp.position.set(135 + (i % 2 === 0 ? -3.2 : 3.2), 3.2, 172 + i * 16);
    scene.add(lamp);
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 3, 6),
      new THREE.MeshStandardMaterial({ color: 0x333333 }));
    pole.position.set(135 + (i % 2 === 0 ? -3.2 : 3.2), 1.5, 172 + i * 16);
    scene.add(pole);
  }
  const hut = new THREE.Mesh(new THREE.BoxGeometry(6, 4, 5),
    new THREE.MeshStandardMaterial({ color: 0x9a7a4a }));
  hut.position.set(128, 2, 170); scene.add(hut);
  colliders.push({ x: 128, z: 170, hw: 3.4, hd: 2.9 });
  const boatCols = [0xe8e8e8, 0xff5a5a, 0x5a8aff, 0xffd23e];
  for (let i = 0; i < 4; i++) {
    const boat = new THREE.Group();
    const hull = new THREE.Mesh(new THREE.BoxGeometry(3, 1.2, 8),
      new THREE.MeshStandardMaterial({ color: boatCols[i] }));
    hull.position.y = 0.4; boat.add(hull);
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 5, 6),
      new THREE.MeshStandardMaterial({ color: 0x666666 }));
    mast.position.y = 3; boat.add(mast);
    boat.position.set(112 + i * 14, 0.2, 196 + (i % 2) * 22);
    boat.rotation.y = rng.range(-0.3, 0.3);
    scene.add(boat);
    animated.push({ mesh: boat, kind: 'bob', baseY: 0.2, phase: i * 1.7 });
  }

  // --- Ferris wheel (beach, near the pier) ---
  const wheel = new THREE.Group();
  wheel.position.set(95, 0, 212);
  const legMat = new THREE.MeshStandardMaterial({ color: 0xdddddd, metalness: 0.4, roughness: 0.4 });
  for (const s of [-1, 1]) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.9, 26, 8), legMat);
    leg.position.set(s * 4, 13, 0); leg.rotation.z = s * 0.35; wheel.add(leg);
  }
  const rim = new THREE.Mesh(new THREE.TorusGeometry(11, 0.5, 8, 32),
    new THREE.MeshBasicMaterial({ color: 0xff2e88 }));
  rim.position.y = 24; wheel.add(rim);
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.2, 2, 12), legMat);
  hub.rotation.x = Math.PI / 2; hub.position.y = 24; wheel.add(hub);
  const cabinCols = [0xff2e88, 0x22e6ff, 0xffd23e, 0x7dff5a, 0xff7a2e, 0x9a6aff, 0xff5a5a, 0x5ad8ff];
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(2.4, 2.4, 2.4),
      new THREE.MeshStandardMaterial({ color: cabinCols[i], emissive: cabinCols[i], emissiveIntensity: 0.25 }));
    cabin.position.set(Math.cos(a) * 11, 24 + Math.sin(a) * 11, 0);
    wheel.add(cabin);
    ferris.cabins.push({ mesh: cabin, angle: a });
  }
  scene.add(wheel);
  ferris.group = wheel;
  // wheel support collider (the legs), small
  colliders.push({ x: 95, z: 212, hw: 5, hd: 1.5 });

  // --- street props: palms, lamps, hydrants, bus stops, traffic lights ---
  const palmMat = new THREE.MeshStandardMaterial({ color: 0x2e7d32, roughness: 1 });
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x6a4a2a, roughness: 1 });
  for (let i = 0; i < 26; i++) {
    const px = rng.range(-160, 160), pz = rng.range(140, 158);
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.45, 5, 6), trunkMat);
    trunk.position.set(px, 2.5, pz); scene.add(trunk);
    const top = new THREE.Mesh(new THREE.SphereGeometry(2.2, 8, 6), palmMat);
    top.position.set(px, 5.6, pz); top.scale.y = 0.55; scene.add(top);
  }
  const lampMat = new THREE.MeshStandardMaterial({ color: 0x222222 });
  for (let i = 0; i < 24; i++) {
    const lx = -160 + (i % 8) * 40 + 8, lz = -160 + Math.floor(i / 8) * 80 + 8;
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 6, 6), lampMat);
    pole.position.set(lx, 3, lz); scene.add(pole);
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.4, 8, 8),
      new THREE.MeshBasicMaterial({ color: 0xffe9a8 }));
    bulb.position.set(lx, 6.2, lz); scene.add(bulb);
  }
  for (let i = 0; i < 13; i++) {
    const tx = -160 + (i % 5) * 80, tz = -120 + Math.floor(i / 5) * 80;
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 5, 6), lampMat);
    pole.position.set(tx + 7, 2.5, tz + 7); scene.add(pole);
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.8, 1.6, 0.8),
      new THREE.MeshBasicMaterial({ color: i % 3 === 0 ? 0x22ff66 : 0xff3333 }));
    head.position.set(tx + 7, 5.4, tz + 7); scene.add(head);
    animated.push({ mesh: head, kind: 'trafficlight', phase: i });
  }
  for (let i = 0; i < 4; i++) {
    const bx = -120 + i * 80, bz = 168;
    const shelter = new THREE.Mesh(new THREE.BoxGeometry(6, 0.4, 2.5),
      new THREE.MeshStandardMaterial({ color: 0x3a6a8a }));
    shelter.position.set(bx, 3, bz); scene.add(shelter);
  }
  // helipad on the tallest downtown roof (visual only)
  const pad = new THREE.Mesh(new THREE.CylinderGeometry(6, 6, 0.3, 20),
    new THREE.MeshStandardMaterial({ color: 0x222226 }));
  pad.position.set(20, 68.8, 20); scene.add(pad);

  // --- distant skyline silhouettes (outside the playable grid) ---
  const skyMat = new THREE.MeshBasicMaterial({ color: 0x1a1430, fog: true });
  for (let i = 0; i < 18; i++) {
    const sx = -260 + i * 30 + rng.range(-8, 8);
    const sh = rng.range(30, 90);
    const sil = new THREE.Mesh(new THREE.BoxGeometry(16, sh, 16), skyMat);
    sil.position.set(sx, sh / 2, -220); scene.add(sil);
  }

  function update(dt, t) {
    for (const a of animated) {
      if (a.kind === 'blink') a.mesh.visible = (t % 1.4) < 0.9;
      else if (a.kind === 'bob') a.mesh.position.y = a.baseY + Math.sin(t * 0.9 + a.phase) * 0.25;
      else if (a.kind === 'trafficlight') {
        a.mesh.material.color.setHex(((t + a.phase * 7) % 14) < 7 ? 0x22ff66 : 0xff3333);
      }
    }
    // Ferris wheel: cabins orbit, staying upright (local coords — the
    // cabins are children of the wheel group, which sits at (95, 0, 212))
    const w = ferris.group;
    if (w) {
      const rot = t * 0.12;
      ferris.cabins.forEach((c) => {
        c.mesh.position.set(
          Math.cos(c.angle + rot) * 11,
          24 + Math.sin(c.angle + rot) * 11,
          0,
        );
      });
    }
  }

  return { colliders, update, ferris };
}
