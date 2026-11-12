import * as THREE from 'three';
import { SPOT_LEVELS, PADS, SITE_BOUNDARY, TERRAIN, ROADS, toY } from './layout.js';
import { fbm, lerp, clamp, smoothstep, signedDistToPolygon, samplePath, SegmentIndex } from './geom.js';
import { M } from './materials.js';

// ---------- 1. base elevation from spot levels (plane fit + Gaussian residuals) ----------
function solve3(A, b) {
  const m = A.map((r, i) => [...r, b[i]]);
  for (let c = 0; c < 3; c++) {
    let p = c; for (let r = c + 1; r < 3; r++) if (Math.abs(m[r][c]) > Math.abs(m[p][c])) p = r;
    [m[c], m[p]] = [m[p], m[c]];
    for (let r = 0; r < 3; r++) if (r !== c) { const f = m[r][c] / m[c][c]; for (let k = c; k < 4; k++) m[r][k] -= f * m[c][k]; }
  }
  return [m[0][3] / m[0][0], m[1][3] / m[1][1], m[2][3] / m[2][2]];
}
const plane = (() => {
  const A = [[0, 0, 0], [0, 0, 0], [0, 0, 0]], b = [0, 0, 0];
  for (const [x, z, e] of SPOT_LEVELS) {
    const v = [1, x, z];
    for (let i = 0; i < 3; i++) { b[i] += v[i] * e; for (let j = 0; j < 3; j++) A[i][j] += v[i] * v[j]; }
  }
  return solve3(A, b);
})();
const planeAt = (x, z) => plane[0] + plane[1] * x + plane[2] * z;
const residuals = SPOT_LEVELS.map(([x, z, e]) => [x, z, e - planeAt(x, z)]);
const SIGMA2 = 2 * 34 * 34;

function baseElevation(x, z) {
  const r = Math.hypot(x - 15, z);
  const s = r > 170 ? 170 / r : 1; // stop the regional slope from running away beyond the site
  let e = planeAt(15 + (x - 15) * s, z * s);
  let sw = 0, sr = 0;
  for (const [px, pz, res] of residuals) {
    const w = Math.exp(-((x - px) ** 2 + (z - pz) ** 2) / SIGMA2);
    sw += w; sr += w * res;
  }
  e += sr / (sw + 0.05);
  const out = Math.max(0, signedDistToPolygon(x, z, SITE_BOUNDARY));
  e += fbm(x / 45, z / 45) * 1.2;
  e += fbm(x / 120 + 7, z / 120 - 3, 5) * Math.min(30, out * 0.09);
  e += Math.max(0, r - 300) * 0.16; // distant hills frame the valley
  return e;
}

// ---------- 2. graded pads ----------
function padded(x, z) {
  let e = baseElevation(x, z);
  for (const p of PADS) {
    const dx = x - p.c[0], dz = z - p.c[1];
    const c = Math.cos(p.rot), s = Math.sin(p.rot);
    const lx = dx * c - dz * s, lz = dx * s + dz * c;
    const q = Math.hypot(lx / p.rx, lz / p.rz);
    const dist = Math.max(0, (q - 1) * Math.min(p.rx, p.rz));
    const w = 1 - smoothstep(0, p.falloff, dist);
    e = lerp(e, p.elev, w);
  }
  return e;
}

// ---------- 3. road network: smoothed longitudinal profile ----------
export const roadIndex = new SegmentIndex(8, 22);
export const roadData = ROADS.map((def) => {
  const { samples, length } = samplePath(def.points, !!def.closed, 2);
  const hw = def.width / 2;
  const park = (side) => def.parking?.[side];
  for (const s of samples) {
    const sideOk = (side, sign) => {
      const p = park(side); if (!p) return false;
      const cx = s.x + sign * s.nx * (hw + 2.75), cz = s.z + sign * s.nz * (hw + 2.75);
      return p === true ? true : p(cx, cz);
    };
    s.parkL = sideOk('left', 1); s.parkR = sideOk('right', -1);
    s.hl = hw + (s.parkL ? 5.5 : 0); s.hr = hw + (s.parkR ? 5.5 : 0);
    s.h = padded(s.x, s.z);
  }
  const n = samples.length, wrap = !!def.closed;
  const at = (i) => samples[wrap ? (i + n) % n : clamp(i, 0, n - 1)];
  for (let pass = 0; pass < 6; pass++) {
    const hs = samples.map((_, i) => { let a = 0; for (let k = -4; k <= 4; k++) a += at(i + k).h; return a / 9; });
    samples.forEach((s, i) => (s.h = hs[i]));
  }
  for (const key of ['hl', 'hr']) { // taper parking widths
    const v = samples.map((_, i) => { let a = 0; for (let k = -2; k <= 2; k++) a += at(i + k)[key]; return a / 5; });
    samples.forEach((s, i) => (s[key] = v[i]));
  }
  const segCount = wrap ? n : n - 1;
  for (let i = 0; i < segCount; i++) {
    const a = samples[i], b = samples[(i + 1) % n];
    roadIndex.add({ ax: a.x, az: a.z, bx: b.x, bz: b.z, a, b, road: def });
  }
  return { def, samples, length };
});

/** Query nearest road: distance, profile height and paved half-extent on that side. */
export function roadQuery(x, z) {
  const q = roadIndex.nearest(x, z);
  if (!q) return null;
  const { a, b } = q.seg;
  const t = q.t;
  const cx = lerp(a.x, b.x, t), cz = lerp(a.z, b.z, t);
  const nx = lerp(a.nx, b.nx, t), nz = lerp(a.nz, b.nz, t);
  const left = (x - cx) * nx + (z - cz) * nz > 0;
  return { d: q.d, h: lerp(a.h, b.h, t), extent: left ? lerp(a.hl, b.hl, t) : lerp(a.hr, b.hr, t), road: q.seg.road };
}

/** Final graded elevation in real metres. */
export function elevationAt(x, z) {
  const e = padded(x, z);
  const q = roadQuery(x, z);
  if (!q) return e;
  const flat = q.extent + (q.road.surface === 'path' ? 0.4 : 1.2);
  const w = 1 - smoothstep(flat, flat + (q.road.surface === 'path' ? 3 : 8), q.d);
  return lerp(e, q.h, w);
}

// ---------- 4. terrain mesh on a non-uniform grid ----------
function axis([a, b], step, outer, segs) {
  const arr = [];
  for (let i = 0; i < segs; i++) arr.push(a - (a + outer) * ((segs - i) / segs) ** 1.7);
  const n = Math.round((b - a) / step);
  for (let i = 0; i <= n; i++) arr.push(a + ((b - a) * i) / n);
  for (let i = 1; i <= segs; i++) arr.push(b + (outer - b) * (i / segs) ** 1.7);
  return arr;
}

export function buildTerrain() {
  const xs = axis(TERRAIN.innerX, TERRAIN.step, TERRAIN.outer, TERRAIN.outerSegs);
  const zs = axis(TERRAIN.innerZ, TERRAIN.step, TERRAIN.outer, TERRAIN.outerSegs);
  const nx = xs.length, nz = zs.length;
  const pos = new Float32Array(nx * nz * 3), col = new Uint8Array(nx * nz * 3), heights = new Float32Array(nx * nz);
  const lawnA = new THREE.Color(0x6c8b3d), lawnB = new THREE.Color(0x4d6e2f), lawnDry = new THREE.Color(0x8a8a4c);
  const forestA = new THREE.Color(0x24381a), forestB = new THREE.Color(0x385229);
  const verge = new THREE.Color(0x7c8153);
  const c = new THREE.Color(), c2 = new THREE.Color();
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
    const x = xs[i], z = zs[j], k = j * nx + i;
    const y = toY(elevationAt(x, z));
    heights[k] = y;
    pos.set([x, y, z], k * 3);
    const sd = signedDistToPolygon(x, z, SITE_BOUNDARY);
    const n1 = fbm(x / 9, z / 9, 3) * 0.5 + 0.5, n2 = fbm(x / 40 + 3, z / 40, 3) * 0.5 + 0.5;
    c.copy(lawnA).lerp(lawnB, clamp(n1 * 0.7 + n2 * 0.5 - 0.1, 0, 1));
    // natural mottling: broad dry patches + fine speckle
    const n3 = fbm(x / 17 - 9, z / 17 + 4, 4) * 0.5 + 0.5;
    c.lerp(lawnDry, smoothstep(0.58, 0.82, n3) * 0.45);
    c.multiplyScalar(0.92 + 0.16 * (fbm(x / 2.3, z / 2.3, 2) * 0.5 + 0.5));
    c2.copy(forestA).lerp(forestB, clamp(n1 * 0.6 + n2 * 0.4, 0, 1));
    c.lerp(c2, smoothstep(-1.5, 3, sd));
    if (sd < 0) {
      const q = roadQuery(x, z);
      if (q) c.lerp(verge, 0.35 * (1 - smoothstep(q.extent, q.extent + 3, q.d)));
    }
    col.set([c.r * 255 + 0.5, c.g * 255 + 0.5, c.b * 255 + 0.5], k * 3);
  }
  const idx = [];
  for (let j = 0; j < nz - 1; j++) for (let i = 0; i < nx - 1; i++) {
    const a = j * nx + i, b = a + 1, cc = a + nx, d = cc + 1;
    idx.push(a, cc, b, b, cc, d);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.BufferAttribute(col, 3, true));
  g.setIndex(idx);
  g.computeVertexNormals();
  const mesh = new THREE.Mesh(g, M.terrain);
  mesh.name = 'Terrain';
  mesh.userData = { receiveShadow: true, ground: true };

  // Exact height lookup matching the triangulation (for placing objects on the mesh).
  const find = (arr, v) => { let lo = 0, hi = arr.length - 2; while (lo < hi) { const m = (lo + hi + 1) >> 1; if (arr[m] <= v) lo = m; else hi = m - 1; } return lo; };
  const heightAt = (x, z) => {
    const i = find(xs, x), j = find(zs, z);
    const u = clamp((x - xs[i]) / (xs[i + 1] - xs[i]), 0, 1), v = clamp((z - zs[j]) / (zs[j + 1] - zs[j]), 0, 1);
    const ha = heights[j * nx + i], hb = heights[j * nx + i + 1], hc = heights[(j + 1) * nx + i], hd = heights[(j + 1) * nx + i + 1];
    return u + v <= 1 ? ha + u * (hb - ha) + v * (hc - ha) : hd + (1 - u) * (hc - hd) + (1 - v) * (hb - hd);
  };
  return { mesh, heightAt };
}
