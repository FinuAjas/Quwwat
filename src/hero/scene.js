import * as THREE from 'three';
import { CONFIG, QUALITY } from './config.js';

/** Creates renderer, scene and camera inside `container` and keeps them sized to it. */
export function createScene(container) {
  const renderer = new THREE.WebGLRenderer({ antialias: QUALITY.antialias, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, QUALITY.pixelRatio));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = CONFIG.exposure;
  renderer.shadowMap.enabled = QUALITY.shadows;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const c = CONFIG.camera;
  const camera = new THREE.PerspectiveCamera(c.fov, 1, c.near, c.far);
  camera.position.fromArray(c.position);
  camera.lookAt(new THREE.Vector3().fromArray(c.target));

  const listeners = new Set();
  function resize() {
    const w = container.clientWidth || innerWidth, h = container.clientHeight || innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    // Portrait screens: widen the vertical FOV so the site still fits horizontally (hFOV >= 38°).
    const minH = THREE.MathUtils.degToRad(38);
    const needV = THREE.MathUtils.radToDeg(2 * Math.atan(Math.tan(minH / 2) / camera.aspect));
    camera.fov = THREE.MathUtils.clamp(needV, c.fov, 62);
    // Shift the projection so the model sits right of centre, leaving room for the hero copy.
    const shift = w > 760 ? c.viewShift : 0;
    if (shift) camera.setViewOffset(w, h, -w * shift, 0, w, h); else camera.clearViewOffset();
    camera.updateProjectionMatrix();
    listeners.forEach((fn) => fn(w, h));
  }
  new ResizeObserver(resize).observe(container);
  resize();

  return { renderer, scene, camera, onResize: (fn) => { listeners.add(fn); fn(container.clientWidth, container.clientHeight); } };
}
