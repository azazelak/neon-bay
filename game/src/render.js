// Neon Bay v5c — renderer, dusk lighting, sky, follow camera.
// Bright dusk grade: strong hemisphere light plus warm sun, a cool
// north-east fill and a warm rear fill so the first renders are never dark.
import * as THREE from '../vendor/three.module.min.js';

export class RenderSys {
  constructor(game) {
    this.game = game;
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    document.getElementById('app').appendChild(this.renderer.domElement);
    this.scene = game.scene;
    this.camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 900);
    this.scene.background = new THREE.Color(0x2a1a3a);
    this.scene.fog = new THREE.Fog(0x3a2440, 120, 520);

    const hemi = new THREE.HemisphereLight(0xffd9a0, 0x2a2a44, 1.7);
    this.scene.add(hemi);
    const sun = new THREE.DirectionalLight(0xff9a4a, 2.2);
    sun.position.set(-120, 90, 180);
    this.scene.add(sun);
    const fillNE = new THREE.DirectionalLight(0x8a7aff, 0.7);
    fillNE.position.set(120, 60, -120);
    this.scene.add(fillNE);
    const fillRear = new THREE.DirectionalLight(0xffc890, 0.55);
    fillRear.position.set(0, 40, 260);
    this.scene.add(fillRear);

    // sun disc low over the sea to the south-west
    const sunDisc = new THREE.Mesh(new THREE.CircleGeometry(26, 32),
      new THREE.MeshBasicMaterial({ color: 0xffb347, fog: false }));
    sunDisc.position.set(-60, 26, 420);
    sunDisc.lookAt(0, 20, 0);
    this.scene.add(sunDisc);
    const glow = new THREE.Mesh(new THREE.CircleGeometry(44, 32),
      new THREE.MeshBasicMaterial({ color: 0xff7a2e, transparent: true, opacity: 0.35, fog: false }));
    glow.position.set(-60, 26, 418);
    glow.lookAt(0, 20, 0);
    this.scene.add(glow);

    this.camPos = new THREE.Vector3(0, 8, 14);
    this.camLook = new THREE.Vector3(0, 1, 0);
    window.addEventListener('resize', () => {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(window.innerWidth, window.innerHeight);
    });
  }

  update(dt) {
    const game = this.game;
    if (game.shotCam) {
      // staged screenshot camera: fixed pose, no smoothing
      this.camera.position.copy(game.shotCam.pos);
      this.camera.lookAt(game.shotCam.look);
      return;
    }
    const p = game.player;
    const back = 9.5 + (p.inCar && p.car ? Math.abs(p.car.speed) * 0.12 : 0);
    const up = p.inCar ? 4.2 : 3.4;
    const fx = Math.sin(p.yaw), fz = Math.cos(p.yaw);
    const wantPos = new THREE.Vector3(
      p.pos.x - fx * back, up + (p.inCar && p.car ? p.car.airY * 0.5 : 0), p.pos.z - fz * back);
    const wantLook = new THREE.Vector3(p.pos.x + fx * 6, 1.4, p.pos.z + fz * 6);
    const k = 1 - Math.pow(0.001, dt);
    this.camPos.lerp(wantPos, k);
    this.camLook.lerp(wantLook, k);
    this.camera.position.copy(this.camPos);
    this.camera.lookAt(this.camLook);
  }

  render() { this.renderer.render(this.scene, this.camera); }
}
