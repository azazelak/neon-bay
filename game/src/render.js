// Neon Bay — renderer, lights and the third-person camera rig. One warm
// low sun, a dusk hemisphere fill and fog give the sun-soaked evening look;
// the camera chases the player (or their car) with a smoothed orbit the
// mouse drag steers.
import * as THREE from 'three';
import { CFG } from './config.js';

export function createRenderer(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.3;
  return renderer;
}

export function createScene() {
  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(CFG.fogColor, CFG.fogNear, CFG.fogFar);

  const hemi = new THREE.HemisphereLight(CFG.hemiSky, CFG.hemiGround, CFG.hemiIntensity);
  scene.add(hemi);

  // A little ambient lift so the roads never read as black.
  scene.add(new THREE.AmbientLight(0x604a6a, 0.55));

  const sun = new THREE.DirectionalLight(CFG.sunColor, CFG.sunIntensity);
  sun.position.set(-180, 90, 60); // low in the west, long evening shadows
  scene.add(sun);
  scene.add(sun.target);

  const fill = new THREE.DirectionalLight(0x8a7bff, 0.35);
  fill.position.set(120, 80, -140);
  scene.add(fill);

  // A real sun disc low in the west, so a camera looking down the coast
  // sees the sunset the sky texture only hints at.
  const disc = new THREE.Mesh(
    new THREE.CircleGeometry(30, 32),
    new THREE.MeshBasicMaterial({ color: 0xffe9b0, fog: false }),
  );
  disc.position.set(-520, 78, 140);
  disc.rotation.y = Math.PI / 2;
  scene.add(disc);
  const halo = new THREE.Mesh(
    new THREE.CircleGeometry(62, 32),
    new THREE.MeshBasicMaterial({ color: 0xff9d5c, transparent: true, opacity: 0.35, fog: false }),
  );
  halo.position.set(-525, 78, 140);
  halo.rotation.y = Math.PI / 2;
  scene.add(halo);

  return scene;
}

// Third-person orbit camera: yaw/pitch from mouse drag, distance and height
// by mode (on foot vs driving), smoothed so it never snaps.
export class CameraRig {
  constructor(camera) {
    this.camera = camera;
    this.yaw = Math.PI; // looking north down the avenue at start
    this.pitch = 0.32;
    this.dist = CFG.camDistFoot;
    this.height = CFG.camHeightFoot;
    this._target = new THREE.Vector3();
    this._pos = new THREE.Vector3(0, 6, 20);
  }

  addDrag(dx, dy) {
    this.yaw -= dx * 0.0045;
    this.pitch = Math.max(0.08, Math.min(1.1, this.pitch + dy * 0.003));
  }

  snapTo(target, yaw, pitch, dist, height) {
    this.yaw = yaw;
    this.pitch = pitch;
    this.dist = dist;
    this.height = height;
    this._target.copy(target);
    this._updatePosition(1);
  }

  update(dt, target, inCar) {
    const wantDist = inCar ? CFG.camDistCar : CFG.camDistFoot;
    const wantHeight = inCar ? CFG.camHeightCar : CFG.camHeightFoot;
    this.dist += (wantDist - this.dist) * Math.min(1, dt * 4);
    this.height += (wantHeight - this.height) * Math.min(1, dt * 4);
    this._target.lerp(target, Math.min(1, dt * 10));
    this._updatePosition(Math.min(1, dt * 8));
  }

  _updatePosition(smooth) {
    const cx = Math.sin(this.yaw) * Math.cos(this.pitch);
    const cz = Math.cos(this.yaw) * Math.cos(this.pitch);
    const cy = Math.sin(this.pitch);
    const want = new THREE.Vector3(
      this._target.x + cx * this.dist,
      this._target.y + this.height + cy * this.dist * 0.6,
      this._target.z + cz * this.dist,
    );
    this._pos.lerp(want, smooth);
    this.camera.position.copy(this._pos);
    this.camera.lookAt(this._target.x, this._target.y + 1.2, this._target.z);
  }

  // Forward direction on the ground plane (for WASD movement).
  forward() {
    return { x: -Math.sin(this.yaw), z: -Math.cos(this.yaw) };
  }
}
