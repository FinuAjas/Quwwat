import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { CONFIG } from './config.js';

const deg = THREE.MathUtils.degToRad;
// Camera ease: speed peaks a third of the way in, then a long soft tail — the move "settles" instead of stopping.
const settle = (t) => 1 - (1 - t) ** 3 * (1 + 3 * t);
// Intro ease: already moving when the loader fades (like a film cut), gliding to rest.
const glide = (t) => 1 - (1 - t) ** 2.2;
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const isNarrow = () => innerWidth <= 760 || innerHeight > innerWidth * 1.1;

/**
 * Camera rig around OrbitControls:
 *  - damping, polar/zoom limits, pan clamped to the site, camera kept above the terrain
 *  - settling arc moves between presets / hotspots, cinematic intro path (skippable), idle auto-rotate
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
  dom.setAttribute('role', 'application'); // a custom widget with its own keys; also makes the label below valid ARIA
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
  /**
   * Fly to a new orbit centre + camera position along a spherical arc. The look-at point arrives
   * slightly before the camera, and long moves pull back a little mid-flight (crane-style arc).
   * `seconds` defaults to a duration that grows with how far the camera has to travel.
   */
  function flyTo({ target, position }, seconds) {
    if (intro) endIntro(); // a preset / hotspot chosen during the intro takes over from wherever the camera is
    const t0 = controls.target.clone(), t1 = new THREE.Vector3().fromArray(target);
    sph0.setFromVector3(tmp.copy(camera.position).sub(t0));
    sph1.setFromVector3(new THREE.Vector3().fromArray(position).sub(t1));
    // take the short way round
    let dTheta = sph1.theta - sph0.theta;
    dTheta = Math.atan2(Math.sin(dTheta), Math.cos(dTheta));
    const from = { r: sph0.radius, phi: sph0.phi, theta: sph0.theta };
    const to = { r: sph1.radius, phi: sph1.phi, theta: sph0.theta + dTheta };
    const travel = t0.distanceTo(t1);
    seconds ??= THREE.MathUtils.clamp(
      c.flySeconds + travel / 110 + Math.abs(dTheta) * 0.3 + Math.abs(Math.log(to.r / Math.max(from.r, 1))) * 0.35, c.flySeconds, 3);
    const lift = Math.min(travel * c.arcLift, Math.max(from.r, to.r) * 0.3);
    controls.autoRotate = false;
    lastInput = performance.now() + seconds * 1000;
    if (reducedMotion) seconds = 0.001;
    cancelTween();
    return new Promise((resolve) => {
      tween = { start: performance.now(), dur: seconds * 1000, t0, t1, from, to, lift, resolve };
    });
  }
  function stepTween(now) {
    if (!tween) return;
    const k = Math.min(1, (now - tween.start) / tween.dur), e = settle(k);
    controls.target.lerpVectors(tween.t0, tween.t1, settle(Math.min(1, k * c.targetLead)));
    const s = new THREE.Spherical(
      THREE.MathUtils.lerp(tween.from.r, tween.to.r, e) + tween.lift * Math.sin(Math.PI * e),
      THREE.MathUtils.lerp(tween.from.phi, tween.to.phi, e),
      THREE.MathUtils.lerp(tween.from.theta, tween.to.theta, e),
    );
    camera.position.setFromSpherical(s).add(controls.target);
    if (k >= 1) { const r = tween.resolve; tween = null; r(); }
  }
  const cancelTween = () => { if (tween) { const r = tween.resolve; tween = null; r(); } };

  // ---------- intro: camera flown along a spline over the forest into the aerial preset ----------
  let intro = null;
  const skipBtn = document.createElement('button');
  skipBtn.type = 'button';
  skipBtn.className = 'intro-skip';
  skipBtn.textContent = 'Skip intro';
  dom.parentElement.appendChild(skipBtn);
  /** Fast-forward the rest of the path (never a cut), so skipping still lands smoothly. */
  function skipIntro() {
    if (!intro) return;
    intro.rate = Math.max(intro.rate, ((1 - intro.k) * intro.dur) / (c.introSkipSeconds * 1000));
    skipBtn.classList.remove('is-visible');
  }
  const skipOnKey = (e) => { if (e.key === 'Escape' || e.key === 'Enter' || e.key === ' ') skipIntro(); };
  skipBtn.addEventListener('click', skipIntro);
  function endIntro() {
    const done = intro.resolve;
    intro = null;
    controls.enabled = true;
    skipBtn.classList.remove('is-visible');
    dom.removeEventListener('pointerdown', skipIntro);
    dom.removeEventListener('wheel', skipIntro);
    removeEventListener('keydown', skipOnKey);
    lastInput = performance.now();
    done();
  }
  function stepIntro(now) {
    const dt = Math.min(100, now - intro.last); // a paused tab resumes the flight instead of jumping to the end
    intro.last = now;
    intro.k = Math.min(1, intro.k + (dt * intro.rate) / intro.dur);
    const e = glide(intro.k);
    intro.pos.getPointAt(e, camera.position);
    intro.look.getPoint(e, controls.target);
    if (e > 0.94) skipBtn.classList.remove('is-visible'); // only the slow final glide is left: nothing worth skipping
  }

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
    if (intro) {
      // The path runs outside the orbit limits (low and far out), so OrbitControls is bypassed until it lands.
      stepIntro(now);
      const p = camera.position;
      const ground = heightAt(p.x, p.z);
      if (p.y < ground + c.groundClearance) p.y = ground + c.groundClearance;
      camera.lookAt(controls.target);
      if (intro.k >= 1) endIntro();
      emit('change');
      return;
    }
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
    /** Cinematic opener: fly the configured path and land exactly on the aerial preset. Any input skips it. */
    intro() {
      const end = presetFor('aerial');
      const path = (isNarrow() && CONFIG.intro.mobile) || CONFIG.intro;
      if (reducedMotion || !path.path?.length) {
        controls.target.fromArray(end.target);
        camera.position.fromArray(end.position);
        return Promise.resolve();
      }
      const v = (a) => new THREE.Vector3().fromArray(a);
      controls.enabled = false;
      controls.autoRotate = false;
      dom.addEventListener('pointerdown', skipIntro);
      dom.addEventListener('wheel', skipIntro, { passive: true });
      addEventListener('keydown', skipOnKey);
      skipBtn.classList.add('is-visible');
      return new Promise((resolve) => {
        intro = {
          pos: new THREE.CatmullRomCurve3([...path.path.map(v), v(end.position)], false, 'centripetal'),
          look: new THREE.LineCurve3(v(path.look), v(end.target)),
          dur: CONFIG.intro.seconds * 1000, k: 0, rate: 1, last: performance.now(), resolve,
        };
        stepIntro(intro.last);
        camera.lookAt(controls.target);
      });
    },
    skipIntro,
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
