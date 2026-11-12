import * as THREE from 'three';
import { CONFIG } from './config.js';

const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const smooth = (a, b, x) => THREE.MathUtils.smoothstep(x, a, b);

/** 5-tap moving average, repeated — takes the grid steps out of sampled heights and speeds. */
function blur(arr, passes) {
  const n = arr.length, tmp = new Float32Array(n);
  for (let p = 0; p < passes; p++) {
    for (let i = 0; i < n; i++) {
      let s = 0;
      for (let k = -2; k <= 2; k++) s += arr[Math.min(n - 1, Math.max(0, i + k))];
      tmp[i] = s / 5;
    }
    arr.set(tmp);
  }
}

/**
 * A few cars driving the access road: in through the south gate, up the hairpin, once round the ring
 * road and out again on the other side of the road (left-hand traffic).
 *
 * The route is sampled once: lane position, road height (from the terrain, so it works on any model) and
 * a speed that drops in bends. Every car is the same function of time, offset from the others, so cars
 * never catch each other. The scene's shadow map is static, so each car carries a soft blob shadow instead.
 * Car shapes and paints are copied from the model's own `Cars_*` meshes when it has them.
 */
export function createTraffic(scene, site, heightAt, sun) {
  const T = CONFIG.traffic;
  if (!T?.count || reducedMotion) return { update() {} };

  // ---- route: in → loop → back out (mirrored), as one smooth centre line ----
  const way = [...T.inbound, ...T.loop, ...T.inbound.slice().reverse()];
  const curve = new THREE.CatmullRomCurve3(way.map(([x, z]) => new THREE.Vector3(x, 0, z)), false, 'centripetal');
  const n = Math.ceil(curve.getLength() / 1.5);
  const px = new Float32Array(n + 1), py = new Float32Array(n + 1), pz = new Float32Array(n + 1);
  const lane = new Float32Array(n + 1), speed = new Float32Array(n + 1), time = new Float32Array(n + 1), dist = new Float32Array(n + 1);
  const pts = [], tangents = [];
  for (let i = 0; i <= n; i++) { pts.push(curve.getPointAt(i / n)); tangents.push(curve.getTangentAt(i / n)); }
  // Signed bend between the directions a few samples either side (radians per metre; negative = left turn).
  const bendAt = (dir, i, metres) => {
    const a = dir(Math.max(0, i - 3)), b = dir(Math.min(n, i + 3));
    return (Math.atan2(a.x * b.z - a.z * b.x, a.x * b.x + a.z * b.z)) / metres;
  };
  // Keep left, but drift to the middle of the road on tight left turns (hairpin, junctions) like a real driver —
  // holding the lane there would pivot the car almost on the spot.
  for (let i = 0; i <= n; i++) {
    const bend = bendAt((k) => tangents[k], i, 9);
    lane[i] = T.lane * (bend < 0 ? smooth(5, 16, -1 / bend) : 1);
  }
  blur(lane, 4);
  for (let i = 0; i <= n; i++) {
    px[i] = pts[i].x + tangents[i].z * lane[i]; pz[i] = pts[i].z - tangents[i].x * lane[i]; // left of the direction of travel
    py[i] = heightAt(pts[i].x, pts[i].z);                                                  // roads are level across: use the centre line
  }
  blur(px, 2); blur(pz, 2); blur(py, 3);
  // Speed along the driven line: lateral acceleration capped at ~2 m/s², so cars slow into bends.
  for (let i = 1; i <= n; i++) dist[i] = dist[i - 1] + Math.hypot(px[i] - px[i - 1], pz[i] - pz[i - 1]);
  const seg = { x: 0, z: 0 }, seg2 = { x: 0, z: 0 };
  const dirAt = (out) => (k) => { const j = Math.min(n - 1, k); out.x = px[j + 1] - px[j]; out.z = pz[j + 1] - pz[j]; return out; };
  for (let i = 0; i <= n; i++) {
    const a = dirAt(seg)(Math.max(0, i - 3)), b = dirAt(seg2)(Math.min(n, i + 3));
    const metres = Math.max(1, dist[Math.min(n, i + 3)] - dist[Math.max(0, i - 3)]);
    const bend = Math.abs(Math.atan2(a.x * b.z - a.z * b.x, a.x * b.x + a.z * b.z)) / metres;
    speed[i] = THREE.MathUtils.clamp(Math.sqrt(2 / Math.max(bend, 1e-4)), T.cornerSpeed, T.speed);
  }
  blur(speed, 6);
  for (let i = 1; i <= n; i++) time[i] = time[i - 1] + (2 * (dist[i] - dist[i - 1])) / (speed[i] + speed[i - 1]);
  const length = dist[n], lap = time[n];

  // ---- car meshes ----
  const group = new THREE.Group();
  group.name = 'Traffic';
  const donors = [];
  site.root.traverse((o) => { if (o.isMesh && o.name.startsWith('Cars_')) donors.push(o); });
  const fallback = donors.length ? null : new THREE.BoxGeometry(1.8, 1.3, 4.3).translate(0, 0.75, 0);
  const sunDir = new THREE.Vector3().fromArray(CONFIG.sun.position).normalize();
  const reach = Math.min(1.6, (0.7 * Math.hypot(sunDir.x, sunDir.z)) / sunDir.y); // how far the shadow falls beside the car (m)
  const away = new THREE.Vector2(-sunDir.x, -sunDir.z).normalize().multiplyScalar(reach);
  const blobMat = new THREE.MeshBasicMaterial({
    map: blobTexture(), color: 0x000000, transparent: true, depthWrite: false, fog: false,
    opacity: 0.2 + 0.3 * Math.min(1, sun.intensity / 3.6), polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
  });
  const blobGeo = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
  const cars = [];
  for (let i = 0; i < T.count; i++) {
    const donor = donors[i % Math.max(1, donors.length)];
    const body = new THREE.Mesh(
      donor?.geometry ?? fallback,
      donor?.material ?? new THREE.MeshStandardMaterial({ color: T.colors[i % T.colors.length], roughness: 0.4, metalness: 0.3 }),
    );
    body.receiveShadow = true; // passes through tree shadows from the static shadow map
    const blob = new THREE.Mesh(blobGeo, blobMat);
    blob.scale.set(2.7 + reach, 1, 5.2 + reach);
    blob.layers.set(1); // overlay layer: skipped by the ambient-occlusion pass
    const car = new THREE.Group();
    car.add(body, blob);
    car.rotation.order = 'YXZ';
    group.add(car);
    cars.push({ car, blob, offset: (i / T.count + (i % 2) * 0.04) * lap });
  }
  scene.add(group);

  function update(t) {
    for (const c of cars) {
      const tt = (t + c.offset) % lap;
      let lo = 0, hi = n; // last sample at or before tt
      while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (time[mid] <= tt) lo = mid; else hi = mid; }
      const k = (tt - time[lo]) / (time[hi] - time[lo]);
      const dx = px[hi] - px[lo], dy = py[hi] - py[lo], dz = pz[hi] - pz[lo];
      c.car.position.set(px[lo] + dx * k, py[lo] + dy * k + 0.12, pz[lo] + dz * k);
      const yaw = Math.atan2(dx, dz);
      c.car.rotation.set(-Math.atan2(dy, Math.hypot(dx, dz)), yaw, 0);
      // blob shadow falls away from the sun (world direction → car's local frame)
      const cs = Math.cos(yaw), sn = Math.sin(yaw);
      c.blob.position.set(away.x * cs - away.y * sn, 0.05, away.x * sn + away.y * cs);
      // cars grow in / out over a few metres at the gate, where the road leaves the model
      const d = dist[lo] + (dist[hi] - dist[lo]) * k;
      const s = smooth(0, 7, d) * smooth(0, 7, length - d);
      c.car.visible = s > 0.01;
      c.car.scale.setScalar(Math.max(s, 0.01));
    }
  }
  update(0);
  return { group, update, length, lap };
}

function blobTexture() {
  const cv = document.createElement('canvas');
  cv.width = cv.height = 64;
  const g = cv.getContext('2d'), grad = g.createRadialGradient(32, 32, 6, 32, 32, 32);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.55, 'rgba(255,255,255,0.75)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(cv);
}

/**
 * A loose flock of egrets flying a wide oval round the valley. All birds share one small mesh
 * (two wing triangles each) rebuilt on the CPU every frame — one draw call, a few dozen vertices.
 */
export function createBirds(scene) {
  const B = CONFIG.birds;
  if (!B?.count || reducedMotion) return { update() {} };
  const [cx, , cz] = CONFIG.siteCenter, [rx, rz] = B.radius;
  const pos = new Float32Array(B.count * 18);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage));
  const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: B.color, side: THREE.DoubleSide }));
  mesh.name = 'Birds';
  mesh.frustumCulled = false;
  mesh.layers.set(1); // overlay layer: skipped by the ambient-occlusion pass
  scene.add(mesh);

  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const birds = Array.from({ length: B.count }, (_, i) => ({
    lag: i * 0.022 + rnd() * 0.012,              // position along the path (radians behind the leader)
    side: (i % 2 ? 1 : -1) * (2 + i * 2.2 + rnd() * 3), // loose V: metres left / right of the path
    lift: rnd() * 6 - 3, phase: rnd() * 6.28, rate: 15 + rnd() * 3,
  }));
  const w = B.speed / ((rx + rz) / 2); // angular speed for roughly B.speed m/s
  const half = B.span / 2, body = B.span * 0.3;

  function update(t) {
    let o = 0;
    for (const b of birds) {
      const a = t * w - b.lag, ca = Math.cos(a), sa = Math.sin(a);
      // forward = path tangent, right = across it (both horizontal)
      let fx = -sa * rx, fz = ca * rz; const fl = Math.hypot(fx, fz); fx /= fl; fz /= fl;
      const sx = -fz, sz = fx;
      const x = cx + ca * rx + sx * b.side, z = cz + sa * rz + sz * b.side;
      const y = B.height + b.lift + Math.sin(t * 0.5 + b.phase) * 1.5;
      const flap = Math.sin(t * b.rate + b.phase) * 0.75 + 0.15; // wing angle above / below level
      const wx = Math.cos(flap) * half, wy = Math.sin(flap) * half;
      for (const sgn of [-1, 1]) {
        pos[o++] = x + fx * body; pos[o++] = y; pos[o++] = z + fz * body;                                  // head
        pos[o++] = x - fx * body; pos[o++] = y; pos[o++] = z - fz * body;                                  // tail
        pos[o++] = x + sx * wx * sgn - fx * 0.1; pos[o++] = y + wy; pos[o++] = z + sz * wx * sgn - fz * 0.1; // wing tip
      }
    }
    geo.attributes.position.needsUpdate = true;
  }
  update(0);
  return { mesh, update };
}
