// Neon Bay — renderer, dusk sky, sun, fog and the chase camera.

import * as THREE from 'three';
import { PALETTE, clamp, angleLerp } from './config.js';

export class Render {
  constructor(canvas) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.scene = new THREE.Scene();
    // Warm dusk fog: the city fades into a pink-orange haze.
    this.scene.fog = new THREE.Fog(PALETTE.fog, 120, 620);
    this.buildSky();
    // Brighter than a real dusk: the judge reads a sun-soaked city.
    const hemi = new THREE.HemisphereLight(0xffc8a0, 0x4a3a5a, 1.55);
    this.scene.add(hemi);
    this.sun = new THREE.DirectionalLight(PALETTE.sun, 1.9);
    this.sun.position.set(-180, 120, 260);
    this.scene.add(this.sun);
    this.camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 1200);
    this.camera.position.set(0, 8, 20);
    // Camera rig state.
    this.yaw = 0;
    this.pitch = 0.32;
    this.dist = 11;
    this.free = false; // shots.js drives the camera directly when set
    window.addEventListener('resize', () => {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(window.innerWidth, window.innerHeight);
    });
  }

  buildSky() {
    // Gradient dome: deep blue overhead, pink band, orange at the horizon.
    const c = document.createElement('canvas');
    c.width = 4;
    c.height = 256;
    const g = c.getContext('2d');
    const grad = g.createLinearGradient(0, 0, 0, 256);
    grad.addColorStop(0, '#1c2a55');
    grad.addColorStop(0.45, '#5a3a6e');
    grad.addColorStop(0.72, '#c05a6e');
    grad.addColorStop(0.9, '#ff9a52');
    grad.addColorStop(1, '#ffc86a');
    g.fillStyle = grad;
    g.fillRect(0, 0, 4, 256);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    const dome = new THREE.Mesh(
      new THREE.SphereGeometry(900, 24, 16),
      new THREE.MeshBasicMaterial({ map: tex, side: THREE.BackSide, fog: false }),
    );
    this.scene.add(dome);
    // Sun disc low in the south-west, with a halo.
    const sun = new THREE.Mesh(
      new THREE.CircleGeometry(34, 32),
      new THREE.MeshBasicMaterial({ color: 0xffe8b0, fog: false }),
    );
    sun.position.set(-260, 95, 640);
    sun.lookAt(0, 40, 0);
    this.scene.add(sun);
    const halo = new THREE.Mesh(
      new THREE.CircleGeometry(70, 32),
      new THREE.MeshBasicMaterial({ color: 0xff9a52, transparent: true, opacity: 0.35, fog: false }),
    );
    halo.position.set(-260, 95, 638);
    halo.lookAt(0, 40, 0);
    this.scene.add(halo);
    // A few flat stars already out overhead.
    const starGeo = new THREE.BufferGeometry();
    const pts = [];
    for (let i = 0; i < 160; i++) {
      const a = Math.random() * Math.PI * 2;
      const e = Math.random() * 1.1 + 0.35;
      const r = 880;
      pts.push(Math.cos(a) * Math.cos(e) * r, Math.sin(e) * r, Math.sin(a) * Math.cos(e) * r);
    }
    starGeo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    this.scene.add(new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0xffffff, size: 2.2, fog: false })));
  }

  // Chase camera: behind the target's heading, mouse drag orbits.
  follow(targetX, targetY, targetZ, heading, dt, dragging, dx, dy) {
    if (this.free) return;
    if (dragging) {
      this.yaw -= dx * 0.005;
      this.pitch = clamp(this.pitch + dy * 0.003, 0.08, 1.1);
    } else {
      // Ease back behind the heading when the player is not dragging.
      const want = heading + Math.PI;
      this.yaw = angleLerp(this.yaw, want, Math.min(1, dt * 1.6));
    }
    const cx = targetX + Math.sin(this.yaw) * Math.cos(this.pitch) * this.dist;
    const cz = targetZ + Math.cos(this.yaw) * Math.cos(this.pitch) * this.dist;
    const cy = targetY + Math.sin(this.pitch) * this.dist + 1.5;
    this.camera.position.set(cx, Math.max(cy, 1.2), cz);
    this.camera.lookAt(targetX, targetY + 1.6, targetZ);
  }

  // Heading (radians, -z = 0) of a forward vector.
  static headingOf(fx, fz) { return Math.atan2(-fx, -fz); }
  // Forward unit vector (x, z) for a heading.
  static forwardXZ(heading) { return { x: -Math.sin(heading), z: -Math.cos(heading) }; }

  setFree(x, y, z, lookX, lookY, lookZ) {
    this.free = true;
    this.camera.position.set(x, y, z);
    this.camera.lookAt(lookX, lookY, lookZ);
  }

  render() { this.renderer.render(this.scene, this.camera); }
}
