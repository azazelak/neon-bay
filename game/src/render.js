// Renderer, dusk sky, and the chase camera. One directional sun plus a
// hemisphere light carry the whole scene — no per-street lights, so the
// frame stays cheap even with ~140 buildings on screen.
import * as THREE from 'three';
import { CONFIG } from './config.js';

export class RenderRig {
  constructor(canvas) {
    this.canvas = canvas;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.Fog(CONFIG.palette.fog, 180, 780);
    this.camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 1400);
    this.camera.position.set(0, 12, 30);

    // Dusk sky dome: deep blue overhead, purple mid-band, orange horizon.
    const skyMat = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
      uniforms: {
        top: { value: new THREE.Color(CONFIG.palette.skyTop) },
        mid: { value: new THREE.Color(CONFIG.palette.skyMid) },
        horizon: { value: new THREE.Color(CONFIG.palette.horizon) },
      },
      vertexShader: `
        varying vec3 vPos;
        void main() {
          vPos = position;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }`,
      fragmentShader: `
        varying vec3 vPos;
        uniform vec3 top; uniform vec3 mid; uniform vec3 horizon;
        void main() {
          float h = normalize(vPos).y;
          vec3 c = h > 0.25 ? mix(mid, top, smoothstep(0.25, 0.8, h))
                            : mix(horizon, mid, smoothstep(-0.05, 0.25, h));
          gl_FragColor = vec4(c, 1.0);
        }`,
    });
    const sky = new THREE.Mesh(new THREE.SphereGeometry(1000, 24, 16), skyMat);
    this.scene.add(sky);

    // Low sun disc over the ocean, west, with a soft halo.
    const sun = new THREE.Mesh(
      new THREE.CircleGeometry(30, 32),
      new THREE.MeshBasicMaterial({ color: CONFIG.palette.sun, fog: false }),
    );
    sun.position.set(-880, 70, 140);
    sun.lookAt(0, 40, 0);
    this.scene.add(sun);
    const haloCanvas = document.createElement('canvas');
    haloCanvas.width = haloCanvas.height = 256;
    const hg = haloCanvas.getContext('2d');
    const grad = hg.createRadialGradient(128, 128, 8, 128, 128, 128);
    grad.addColorStop(0, 'rgba(255,190,90,0.85)');
    grad.addColorStop(0.4, 'rgba(255,120,60,0.35)');
    grad.addColorStop(1, 'rgba(255,120,60,0)');
    hg.fillStyle = grad;
    hg.fillRect(0, 0, 256, 256);
    const haloTex = new THREE.CanvasTexture(haloCanvas);
    const halo = new THREE.Sprite(
      new THREE.SpriteMaterial({ map: haloTex, transparent: true, depthWrite: false, fog: false }),
    );
    halo.scale.set(340, 340, 1);
    halo.position.copy(sun.position);
    this.scene.add(halo);

    const hemi = new THREE.HemisphereLight(0x8a6bbf, 0x2a2030, 1.3);
    this.scene.add(hemi);
    const dir = new THREE.DirectionalLight(0xff9a4d, 1.65);
    dir.position.set(-300, 180, 120);
    this.scene.add(dir);

    // Camera orbit state. yaw = direction from target to camera.
    this.yaw = Math.PI;
    this.pitch = 0.32;
    this.dist = 11;
    this.distOverride = null; // a shot can pin the camera closer/farther
    this.lastDragT = -10;
    this.time = 0;

    window.addEventListener('resize', () => this.resize());
  }

  resize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }

  // Camera forward projected onto the ground plane — what W walks toward.
  forwardXZ() {
    return { x: -Math.sin(this.yaw), z: -Math.cos(this.yaw) };
  }

  // Chase/orbit camera. When driving and the player has not dragged the
  // mouse recently, the camera swings behind the car; on foot it stays
  // where the player left it.
  updateCamera(dt, focus, heading, driving) {
    this.time += dt;
    if (driving && this.time - this.lastDragT > 2) {
      let want = heading + Math.PI;
      let d = want - this.yaw;
      while (d > Math.PI) d -= Math.PI * 2;
      while (d < -Math.PI) d += Math.PI * 2;
      this.yaw += d * Math.min(1, dt * 2.2);
    }
    const wantDist = this.distOverride ?? (driving ? 11.5 : 7.5);
    this.dist += (wantDist - this.dist) * Math.min(1, dt * 3);
    const cp = Math.cos(this.pitch);
    const target = new THREE.Vector3(
      focus.x + Math.sin(this.yaw) * cp * this.dist,
      focus.y + 1.6 + Math.sin(this.pitch) * this.dist,
      focus.z + Math.cos(this.yaw) * cp * this.dist,
    );
    const k = 1 - Math.exp(-dt * 9);
    this.camera.position.lerp(target, k);
    this.camera.lookAt(focus.x, focus.y + 1.6, focus.z);
  }

  render() {
    this.renderer.render(this.scene, this.camera);
  }
}
