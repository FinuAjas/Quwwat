import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { CONFIG } from './config.js';

const deg = THREE.MathUtils.degToRad;
const easeInOutCubic = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const isNarrow = () => innerWidth <= 760 || innerHeight > innerWidth * 1.1;

/**
 * Camera rig around OrbitControls:
 *  - damping, polar/zoom limits, pan clamped to the site, camera kept above the terrain
 *  - smooth spherical tweens between presets / hotspots, intro fly-in, idle auto-rotate
 *  - wheel zoom only once the visitor engages with the 3D scene, so page scrolling isn't trapped
 */
export function createCameraRig(camera, dom, heightAt) {
  const c = CONFIG.controls;
  const controls = new OrbitControls(camera, dom);
  Object.assign(controls, {
    enableDamping: true, dampingFactor: c.damping,
    minPolarAngle: deg(c.minPolar), maxPolarAngle: deg(c.maxPolar),
    minDistance: c.minDistance, maxDistance: c.maxDistance,
    rotateSpeed: c.rotateSpeed, zoomSpeed: c.zoomSpeed, panSpeed: c.panSpeed,
    screenSpacePanning: false, // pan across the ground plane, like a map
    autoRotateSpeed: c.autoRotateSpeed,
    zoomToCursor: true,
  });
  dom.tabIndex = 0; // arrow keys pan when the canvas has focus (not while reading the page)
  dom.setAttribute('aria-label', 'Interactive 3D site model. Drag to rotate, right-drag to pan, arrow keys to move.');
  controls.listenToKeyEvents(dom);
  controls.keyPanSpeed = 14;

  const listeners = { change: new Set(), userstart: new Set() };
  const emit = (type, ...a) => listeners[type].forEach((fn) => fn(...a));

  // ---------- engagement: wheel zoom only after the user interacts with the scene ----------
  let engaged = false;
  const hint = document.createElement('div');
  hint.className = 'zoom-hint';
  hint.textContent = 'Click the model, then scroll to zoom';
  dom.parentElement.appendChild(hint);
  let hintTimer = 0;
  dom.addEventListener('pointerdown', () => { engaged = true; hint.classList.remove('is-visible'); });
  dom.parentElement.addEventListener('pointerleave', () => { engaged = false; });
  dom.addEventListener('wheel', (e) => {
    controls.enableZoom = engaged || e.ctrlKey || e.metaKey;
    if (!controls.enableZoom) {
      hint.classList.add('is-visible');
      clearTimeout(hintTimer);
      hintTimer = setTimeout(() => hint.classList.remove('is-visible'), 1600);
    }
  }, { capture: true, passive: true });

  // ---------- tweens ----------
  let tween = null;
  const sph0 = new THREE.Spherical(), sph1 = new THREE.Spherical(), tmp = new THREE.Vector3();
  function flyTo({ target, position }, seconds = 1.8) {
    const t0 = controls.target.clone(), t1 = new THREE.Vector3().fromArray(target);
    sph0.setFromVector3(tmp.copy(camera.position).sub(t0));
    sph1.setFromVector3(new THREE.Vector3().fromArray(position).sub(t1));
    // take the short way round
    let dTheta = sph1.theta - sph0.theta;
    dTheta = Math.atan2(Math.sin(dTheta), Math.cos(dTheta));
    const from = { r: sph0.radius, phi: sph0.phi, theta: sph0.theta };
    const to = { r: sph1.radius, phi: sph1.phi, theta: sph0.theta + dTheta };
    controls.autoRotate = false;
    lastInput = performance.now() + seconds * 1000;
    if (reducedMotion) seconds = 0.001;
    return new Promise((resolve) => {
      tween = { start: performance.now(), dur: seconds * 1000, t0, t1, from, to, resolve };
    });
  }
  function stepTween(now) {
    if (!tween) return;
    const k = Math.min(1, (now - tween.start) / tween.dur), e = easeInOutCubic(k);
    controls.target.lerpVectors(tween.t0, tween.t1, e);
    const s = new THREE.Spherical(
      THREE.MathUtils.lerp(tween.from.r, tween.to.r, e),
      THREE.MathUtils.lerp(tween.from.phi, tween.to.phi, e),
      THREE.MathUtils.lerp(tween.from.theta, tween.to.theta, e),
    );
    camera.position.setFromSpherical(s).add(controls.target);
    if (k >= 1) { const r = tween.resolve; tween = null; r(); }
  }
  const cancelTween = () => { if (tween) { const r = tween.resolve; tween = null; r(); } };

  // ---------- idle auto-rotate ----------
  let lastInput = performance.now();
  controls.addEventListener('start', () => {
    cancelTween();
    controls.autoRotate = false;
    lastInput = performance.now();
    emit('userstart');
  });
  controls.addEventListener('end', () => { lastInput = performance.now(); });

  // ---------- per-frame constraints ----------
  const b = c.panBounds;
  function update(now = performance.now()) {
    stepTween(now);
    if (!tween && !reducedMotion && !controls.autoRotate && now - lastInput > c.idleSeconds * 1000) controls.autoRotate = true;
    controls.update();

    // keep the orbit centre on the site and on the ground
    const t = controls.target;
    const cx = THREE.MathUtils.clamp(t.x, b.minX, b.maxX), cz = THREE.MathUtils.clamp(t.z, b.minZ, b.maxZ);
    const gy = tween ? t.y : THREE.MathUtils.lerp(t.y, heightAt(cx, cz), 0.08);
    tmp.set(cx - t.x, gy - t.y, cz - t.z);
    if (tmp.lengthSq() > 1e-8) { t.add(tmp); camera.position.add(tmp); }

    // never dip below the hills (checks under the camera and slightly towards the target)
    const p = camera.position;
    const ground = Math.max(heightAt(p.x, p.z), heightAt((p.x * 3 + t.x) / 4, (p.z * 3 + t.z) / 4));
    if (p.y < ground + c.groundClearance) p.y = ground + c.groundClearance;
    emit('change');
  }

  // ---------- public API ----------
  const presetFor = (name) => {
    const p = CONFIG.presets[name];
    return isNarrow() && p.mobile ? p.mobile : p;
  };
  const api = {
    controls,
    update,
    flyTo,
    goTo: (name, seconds) => flyTo(presetFor(name), seconds),
    async intro() {
      const from = isNarrow() ? CONFIG.intro.mobile : CONFIG.intro.from;
      controls.target.fromArray(from.target);
      camera.position.fromArray(from.position);
      await api.goTo('aerial', reducedMotion ? 0 : c.introSeconds);
      lastInput = performance.now();
    },
    zoom(factor) {
      const off = tmp.copy(camera.position).sub(controls.target);
      const r = THREE.MathUtils.clamp(off.length() * factor, controls.minDistance, controls.maxDistance);
      off.setLength(r);
      return flyTo({ target: controls.target.toArray(), position: off.add(controls.target).toArray() }, 0.6);
    },
    faceNorth() {
      const off = tmp.copy(camera.position).sub(controls.target);
      const s = new THREE.Spherical().setFromVector3(off); s.theta = 0;
      return flyTo({ target: controls.target.toArray(), position: new THREE.Vector3().setFromSpherical(s).add(controls.target).toArray() }, 1);
    },
    /** Focus a world point (used by hotspots in Phase 5). */
    focus(point, distance = 70) {
      const dir = tmp.copy(camera.position).sub(controls.target).normalize();
      const target = point.clone();
      return flyTo({ target: target.toArray(), position: target.clone().addScaledVector(dir, distance).toArray() }, 1.4);
    },
    /** Compass heading in radians (0 = looking north). */
    heading: () => controls.getAzimuthalAngle(),
    on: (type, fn) => listeners[type].add(fn),
  };
  return api;
}
