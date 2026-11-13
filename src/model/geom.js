import * as THREE from 'three';
import { mergeGeometries, mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';

export const lerp = (a, b, t) => a + (b - a) * t;
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const smoothstep = (e0, e1, x) => { const t = clamp((x - e0) / (e1 - e0), 0, 1); return t * t * (3 - 2 * t); };
export const deg = (d) => d * Math.PI / 180;

export function mulberry32(seed) {
  return function () {
    let t = (seed += 0x6D2B79F5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hash2(ix, iz) {
  let h = (Math.imul(ix, 374761393) + Math.imul(iz, 668265263)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967295;
}
export function valueNoise(x, z) {
  const ix = Math.floor(x), iz = Math.floor(z);
  const fx = x - ix, fz = z - iz;
  const u = fx * fx * (3 - 2 * fx), v = fz * fz * (3 - 2 * fz);
  const a = hash2(ix, iz), b = hash2(ix + 1, iz), c = hash2(ix, iz + 1), d = hash2(ix + 1, iz + 1);
  return (a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v) * 2 - 1;
}
export function fbm(x, z, oct = 4) {
  let s = 0, a = 0.5, f = 1, n = 0;
  for (let i = 0; i < oct; i++) { s += a * valueNoise(x * f + i * 17.3, z * f - i * 9.1); n += a; a *= 0.5; f *= 2.03; }
  return s / n;
}

// ---------- 2D polygon / path maths (x,z plane) ----------
export function pointInPolygon(x, z, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, zi] = poly[i], [xj, zj] = poly[j];
    if ((zi > z) !== (zj > z) && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) inside = !inside;
  }
  return inside;
}
export function distToSegment(px, pz, ax, az, bx, bz) {
  const dx = bx - ax, dz = bz - az;
  const l2 = dx * dx + dz * dz;
  let t = l2 ? ((px - ax) * dx + (pz - az) * dz) / l2 : 0;
  t = clamp(t, 0, 1);
  return { d: Math.hypot(px - (ax + t * dx), pz - (az + t * dz)), t };
}
/** Negative inside, positive outside. */
export function signedDistToPolygon(x, z, poly) {
  let m = Infinity;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    m = Math.min(m, distToSegment(x, z, poly[j][0], poly[j][1], poly[i][0], poly[i][1]).d);
  }
  return pointInPolygon(x, z, poly) ? -m : m;
}

/** Sample a smooth centripetal Catmull-Rom path at ~step metres. n = left normal (screen-left in plan view). */
export function samplePath(points, closed, step) {
  const curve = new THREE.CatmullRomCurve3(points.map(([x, z]) => new THREE.Vector3(x, 0, z)), closed, 'centripetal');
  const length = curve.getLength();
  const n = Math.max(2, Math.round(length / step));
  const count = closed ? n : n + 1;
  const out = [];
  for (let i = 0; i < count; i++) {
    const u = i / n;
    const p = curve.getPointAt(u), t = curve.getTangentAt(u);
    out.push({ x: p.x, z: p.z, tx: t.x, tz: t.z, nx: t.z, nz: -t.x, u });
  }
  return { samples: out, length };
}

/** Uniform spatial hash of segments for nearest-segment queries. */
export class SegmentIndex {
  constructor(cell = 8, reach = 20) { this.cell = cell; this.reach = reach; this.map = new Map(); this.segs = []; }
  key(i, j) { return i * 73856093 ^ j * 19349663; }
  add(seg) { // seg: {ax,az,bx,bz, ...payload}
    const id = this.segs.push(seg) - 1, c = this.cell, r = this.reach;
    const i0 = Math.floor((Math.min(seg.ax, seg.bx) - r) / c), i1 = Math.floor((Math.max(seg.ax, seg.bx) + r) / c);
    const j0 = Math.floor((Math.min(seg.az, seg.bz) - r) / c), j1 = Math.floor((Math.max(seg.az, seg.bz) + r) / c);
    for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) {
      const k = this.key(i, j); let arr = this.map.get(k); if (!arr) this.map.set(k, (arr = [])); arr.push(id);
    }
  }
  /** Every segment that could be within reach of (x, z). */
  around(x, z) {
    return (this.map.get(this.key(Math.floor(x / this.cell), Math.floor(z / this.cell))) ?? []).map((id) => this.segs[id]);
  }
  nearest(x, z) {
    const arr = this.map.get(this.key(Math.floor(x / this.cell), Math.floor(z / this.cell)));
    if (!arr) return null;
    let best = null, bd = Infinity, bt = 0;
    for (const id of arr) {
      const s = this.segs[id];
      const r = distToSegment(x, z, s.ax, s.az, s.bx, s.bz);
      if (r.d < bd) { bd = r.d; best = s; bt = r.t; }
    }
    return best ? { seg: best, d: bd, t: bt } : null;
  }
}

// ---------- geometry helpers ----------
/** Non-indexed, uv-free geometry so heterogeneous parts can be merged. */
export function prep(g) {
  let out = g.index ? g.toNonIndexed() : g;
  if (out.hasAttribute('uv')) out.deleteAttribute('uv');
  if (out.hasAttribute('uv1')) out.deleteAttribute('uv1');
  if (!out.hasAttribute('normal')) out.computeVertexNormals();
  return out;
}
export function paint(g, color) {
  const c = new THREE.Color(color);
  const n = g.attributes.position.count, a = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { a[i * 3] = c.r; a[i * 3 + 1] = c.g; a[i * 3 + 2] = c.b; }
  g.setAttribute('color', new THREE.BufferAttribute(a, 3));
  return g;
}
export function merge(list) { return mergeGeometries(list.map(prep), false); }
export { mergeVertices };

export function box(w, h, d, x = 0, y = 0, z = 0, rotY = 0) {
  const g = new THREE.BoxGeometry(w, h, d);
  if (rotY) g.rotateY(rotY);
  g.translate(x, y, z);
  return prep(g);
}

/** Hip roof over a w × d rectangle (local, base at y=0). */
export function hipRoof(w, d, h, overhang = 0.7) {
  let W = w + 2 * overhang, D = d + 2 * overhang;
  const swap = D > W; if (swap) [W, D] = [D, W];
  const hw = W / 2, hd = D / 2, r = Math.max(0, hw - hd);
  const a = [-hw, 0, -hd], b = [hw, 0, -hd], c = [hw, 0, hd], dd = [-hw, 0, hd], e = [-r, h, 0], f = [r, h, 0];
  const tris = [dd, c, f, dd, f, e, b, a, e, b, e, f, c, b, f, a, dd, e, /* soffit */ a, b, c, a, c, dd];
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(tris.flat(), 3));
  g.computeVertexNormals();
  if (swap) g.rotateY(Math.PI / 2);
  return g;
}

/** Flat ribbon strip from two edge polylines (arrays of [x,y,z]); normals up. */
export function ribbon(left, right) {
  const pos = [];
  for (let i = 0; i < left.length - 1; i++) {
    const l0 = left[i], l1 = left[i + 1], r0 = right[i], r1 = right[i + 1];
    pos.push(...l0, ...r0, ...l1, ...l1, ...r0, ...r1);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.computeVertexNormals();
  // force upward-facing winding
  const n = g.attributes.normal;
  if (n.count && n.getY(0) < 0) {
    for (let i = 0; i < pos.length; i += 9) { for (let k = 0; k < 3; k++) { const t = pos[i + 3 + k]; pos[i + 3 + k] = pos[i + 6 + k]; pos[i + 6 + k] = t; } }
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.computeVertexNormals();
  }
  return g;
}
