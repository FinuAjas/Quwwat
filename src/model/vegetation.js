import * as THREE from 'three';
import { SITE_BOUNDARY, FEATURES } from './layout.js';
import { roadQuery, roadData } from './terrain.js';
import { isBlocked } from './structures.js';
import { mergeVertices, mulberry32, fbm, signedDistToPolygon, pointInPolygon, smoothstep, clamp, lerp } from './geom.js';
import { M } from './materials.js';
import { rockiness } from './rocks.js';

/*
 * Vegetation for the procedural site model.
 *
 *  - Trees are a solid inner canopy (keeps the mass and blocks light) dressed with "leaf cards":
 *    small alpha-clipped quads carrying a drawn leaf cluster, so silhouettes are ragged and leafy.
 *    Palms use the same idea with drooping frond strips. One 256 px texture serves every plant.
 *  - Three levels of detail by distance from the site (the camera always orbits the site, so the
 *    level is chosen when a plant is placed, not per frame):
 *      hero  — in and around the plot: full card count, branches
 *      _mid  — the forest out to 240 m: same shapes, ~1/3 of the triangles
 *      far   — beyond that: one plain blob per tree
 *  - Forest placement follows noise fields: clumps and clearings, stands of old and young trees,
 *    denser growth and palm groves in the valleys, bare patches on steep / rocky ground.
 *  - Inside the plot: avenue trees, clipped hedges along kerbs and paths, flower beds, shrubs.
 * Every plant is an instance; all geometry is ≈ 1 unit tall and scaled per instance.
 */

const HERO_RADIUS = 118, MID_RADIUS = 240; // metres from the site centre (15, 0)

// ---------- leaf texture: 2 × 2 cells (leaf clump A, leaf clump B / palm frond, solid) ----------
const CELL = {
  clumpA: [0.01, 0.51, 0.49, 0.99], clumpB: [0.51, 0.51, 0.99, 0.99], // [u0, v0, u1, v1]
  frond: [0.01, 0.01, 0.49, 0.49],
};
const SOLID_UV = [0.75, 0.25]; // centre of the opaque cell: trunks and inner canopies sample here

function leafAtlas() {
  const S = 256, H = S / 2, cv = document.createElement('canvas');
  cv.width = cv.height = S;
  const g = cv.getContext('2d'), rnd = mulberry32(5);
  const leaf = (x, y, len, wid, ang, shade) => {
    g.save(); g.translate(x, y); g.rotate(ang);
    g.fillStyle = `rgb(${shade},${shade},${shade})`;
    g.beginPath(); g.moveTo(0, 0); g.quadraticCurveTo(len * 0.5, -wid, len, 0); g.quadraticCurveTo(len * 0.5, wid, 0, 0); g.fill();
    g.restore();
  };
  for (const cell of [0, 1]) { // two different clumps of leaves radiating from a twig
    const cx = cell * H + H / 2, cy = H / 2;
    for (let i = 0; i < 30; i++) {
      const a = rnd() * Math.PI * 2, r = rnd() * 18;
      leaf(cx + Math.cos(a) * r, cy + Math.sin(a) * r, 20 + rnd() * 20, 6 + rnd() * 6, a + (rnd() - 0.5) * 0.9, 175 + Math.floor(rnd() * 80));
    }
  }
  for (let i = 0; i <= 30; i++) { // palm frond: leaflets either side of a midrib
    const t = i / 30, x = 6 + t * 114, len = 50 * Math.sin(Math.PI * (0.1 + 0.9 * t)) ** 0.7;
    for (const side of [-1, 1]) leaf(x, H + H / 2, len, 3.4, side * (1.1 - 0.35 * t), 185 + Math.floor(rnd() * 70));
  }
  g.fillStyle = '#d8d8d8'; g.fillRect(4, H + H / 2 - 1.5, 118, 3);
  g.fillStyle = '#ffffff'; g.fillRect(H, H, H, H); // solid cell
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.name = 'Foliage_Leaves';
  return tex;
}

// ---------- small triangle-soup builder (position / normal / colour / uv) ----------
class Soup {
  constructor() { this.p = []; this.n = []; this.c = []; this.u = []; }
  vert(p, n, c, u) { this.p.push(p.x, p.y, p.z); this.n.push(n.x, n.y, n.z); this.c.push(c.r, c.g, c.b); this.u.push(u[0], u[1]); }
  /** Quad a-b-c-d (counter-clockwise) with one shading normal and colour; uv rect [u0, v0, u1, v1]. */
  quad(a, b, c, d, n, col, uv) {
    const [u0, v0, u1, v1] = uv;
    this.vert(a, n, col, [u0, v0]); this.vert(b, n, col, [u1, v0]); this.vert(c, n, col, [u1, v1]);
    this.vert(a, n, col, [u0, v0]); this.vert(c, n, col, [u1, v1]); this.vert(d, n, col, [u0, v1]);
  }
  /** Add an existing geometry as solid (untextured) surface; colour(y01, index) gives each vertex its colour. */
  solid(geo, colour) {
    const g = geo.index ? geo.toNonIndexed() : geo;
    if (!g.attributes.normal) g.computeVertexNormals();
    const P = g.attributes.position, N = g.attributes.normal, v = new THREE.Vector3(), nn = new THREE.Vector3();
    let min = Infinity, max = -Infinity;
    for (let i = 0; i < P.count; i++) { min = Math.min(min, P.getY(i)); max = Math.max(max, P.getY(i)); }
    for (let i = 0; i < P.count; i++) {
      v.fromBufferAttribute(P, i); nn.fromBufferAttribute(N, i);
      this.vert(v, nn, colour((v.y - min) / (max - min || 1), i), SOLID_UV);
    }
  }
  build() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.n, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.c, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.u, 2));
    return g;
  }
}

const BARK = new THREE.Color(0.27, 0.2, 0.15), PALM_BARK = new THREE.Color(0.42, 0.36, 0.28);
const tmpA = new THREE.Vector3(), tmpB = new THREE.Vector3();

/** Noisy ellipsoid (smooth-shaded): the solid heart of a canopy. lobe = { r, sx, sy, sz, x, y, z }. */
function lobeGeometry(l, detail, seed) {
  let g = new THREE.IcosahedronGeometry(l.r, detail);
  g.deleteAttribute('normal'); g.deleteAttribute('uv');
  g = mergeVertices(g);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const k = 1 + fbm(x * 6 + seed, z * 6 + y * 4 - seed, 2) * 0.26;
    p.setXYZ(i, x * k * l.sx + l.x, y * k * l.sy + l.y, z * k * l.sz + l.z);
  }
  g.computeVertexNormals();
  return g;
}
function limb(soup, from, to, r0, r1, sides, bark = BARK) {
  const dir = tmpA.copy(to).sub(from), len = dir.length();
  const g = new THREE.CylinderGeometry(r1, r0, len, sides, 1, true);
  g.translate(0, len / 2, 0);
  g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize()));
  g.translate(from.x, from.y, from.z);
  soup.solid(g, (t) => bark.clone().multiplyScalar(0.8 + 0.3 * t));
}

/**
 * Scatter leaf cards over a lobe. Cards face roughly outward with a random tilt and roll; they are
 * shaded with the canopy's outward normal (not their own), so the crown lights as one soft volume.
 */
function leafCards(soup, l, count, size, base, rnd, centre, accents = null) {
  const col = new THREE.Color(), dir = new THREE.Vector3(), pos = new THREE.Vector3(), nrm = new THREE.Vector3();
  const face = new THREE.Vector3(), right = new THREE.Vector3(), up = new THREE.Vector3();
  for (let i = 0; i < count; i++) {
    dir.set(rnd() * 2 - 1, rnd() * 1.5 - 0.4, rnd() * 2 - 1).normalize();
    const out = 0.9 + rnd() * 0.22;
    pos.set(l.x + dir.x * l.r * l.sx * out, l.y + dir.y * l.r * l.sy * out, l.z + dir.z * l.r * l.sz * out);
    nrm.copy(pos).sub(centre).normalize();
    face.set(dir.x + (rnd() - 0.5) * 0.9, dir.y + (rnd() - 0.5) * 0.9 + 0.25, dir.z + (rnd() - 0.5) * 0.9).normalize();
    right.set(rnd() - 0.5, rnd() - 0.5, rnd() - 0.5).cross(face).normalize();
    up.crossVectors(face, right);
    const s = size * (0.75 + rnd() * 0.55) * 0.5;
    const lit = 0.72 + 0.5 * clamp((pos.y - (l.y - l.r * l.sy)) / (2 * l.r * l.sy), 0, 1) + (rnd() - 0.5) * 0.2;
    if (accents && rnd() < accents.share) col.set(accents.colors[Math.floor(rnd() * accents.colors.length)]).multiplyScalar(0.9 + rnd() * 0.3);
    else col.set(base).multiplyScalar(lit).offsetHSL((rnd() - 0.5) * 0.03, 0, 0);
    nrm.multiplyScalar(0.8).addScaledVector(face, 0.2).normalize();
    soup.quad(
      tmpA.copy(pos).addScaledVector(right, -s).addScaledVector(up, -s).clone(), tmpA.copy(pos).addScaledVector(right, s).addScaledVector(up, -s).clone(),
      tmpA.copy(pos).addScaledVector(right, s).addScaledVector(up, s).clone(), tmpA.copy(pos).addScaledVector(right, -s).addScaledVector(up, s).clone(),
      nrm.clone(), col.clone(), rnd() < 0.5 ? CELL.clumpA : CELL.clumpB,
    );
  }
}

/** Broadleaf tree. `lod` 0 = hero, 1 = mid. shape = { color, trunk, lobes: [...], cards, cardSize } */
function broadleaf(shape, seed, lod) {
  const soup = new Soup(), rnd = mulberry32(seed), [main, ...sides] = shape.lobes;
  const centre = new THREE.Vector3(0, main.y - main.r * main.sy * 0.2, 0);
  const inner = new THREE.Color(shape.color);
  const core = (l, detail, s) => soup.solid(lobeGeometry({ ...l, r: l.r * 0.9 }, detail, s), (t) => inner.clone().multiplyScalar(0.5 + 0.45 * t));
  const top = new THREE.Vector3(0, shape.trunk, 0);
  limb(soup, new THREE.Vector3(0, -0.03, 0), top, 0.038, 0.025, lod ? 5 : 7);
  if (lod) { // mid: a coarse heart and a few large cards — only the outline has to read
    core(main, 0, seed);
    leafCards(soup, main, Math.round(shape.cards * 0.13), shape.cardSize * 1.9, shape.color, rnd, centre, shape.accents);
    for (const l of sides) leafCards(soup, l, 2, shape.cardSize * 2, shape.color, rnd, centre, shape.accents);
  } else {
    core(main, 1, seed);
    leafCards(soup, main, Math.round(shape.cards * 0.55), shape.cardSize, shape.color, rnd, centre, shape.accents);
    sides.forEach((l, i) => {
      core(l, 0, seed + 3 + i);
      limb(soup, top.clone().setY(shape.trunk * 0.8), new THREE.Vector3(l.x * 0.8, l.y - l.r * l.sy * 0.5, l.z * 0.8), 0.028, 0.014, 4);
      leafCards(soup, l, Math.round((shape.cards * 0.45) / sides.length), shape.cardSize, shape.color, rnd, centre, shape.accents);
    });
  }
  return soup.build();
}
const lobe = (r, sx, sy, sz, x, y, z) => ({ r, sx, sy, sz, x, y, z });
const SHAPES = {
  // dense, round, dark — mango / jackfruit
  oakA: { color: 0x3f6a2a, trunk: 0.4, cards: 78, cardSize: 0.2, lobes: [lobe(0.31, 1, 0.8, 1, 0, 0.66, 0), lobe(0.2, 1, 0.8, 1, 0.19, 0.55, 0.08), lobe(0.2, 1, 0.8, 1, -0.13, 0.6, -0.16), lobe(0.17, 1, 0.8, 1, -0.06, 0.52, 0.2)] },
  // taller oval crown, deep green — teak / mahogany
  oakB: { color: 0x2f5524, trunk: 0.46, cards: 72, cardSize: 0.19, lobes: [lobe(0.25, 0.9, 1.25, 0.9, 0, 0.68, 0), lobe(0.17, 1, 0.9, 1, 0.13, 0.52, -0.06), lobe(0.16, 1, 0.9, 1, -0.12, 0.56, 0.09)] },
  // lighter, more open — young growth
  oakC: { color: 0x5b8236, trunk: 0.42, cards: 62, cardSize: 0.21, lobes: [lobe(0.28, 1, 0.82, 1, 0, 0.67, 0), lobe(0.19, 1, 0.8, 1, 0.17, 0.57, -0.1), lobe(0.18, 1, 0.8, 1, -0.16, 0.58, 0.1)] },
  // wide umbrella — rain tree
  rain: { color: 0x46702c, trunk: 0.52, cards: 84, cardSize: 0.2, lobes: [lobe(0.34, 1.15, 0.46, 1.15, 0, 0.76, 0), lobe(0.24, 1.1, 0.45, 1.1, 0.3, 0.7, 0.08), lobe(0.24, 1.1, 0.45, 1.1, -0.26, 0.71, -0.16), lobe(0.22, 1.1, 0.45, 1.1, -0.06, 0.69, 0.31)] },
  // narrow column — Ashoka / mast tree
  cypress: { color: 0x2a4d2b, trunk: 0.14, cards: 64, cardSize: 0.13, lobes: [lobe(0.47, 0.3, 1, 0.3, 0, 0.55, 0)] },
};

/** Coconut / areca palm: leaning ringed trunk, crown of drooping frond strips. */
function palm(seed, lod, { height = 0.84, radius = 0.02, fronds = 13, length = 0.42, width = 0.15, color = 0x4f7a30, lean = 0.07, stems = 1, shaft = false }) {
  const soup = new Soup(), rnd = mulberry32(seed), col = new THREE.Color(), up = new THREE.Vector3(0, 1, 0);
  for (let s = 0; s < stems; s++) {
    const h = height * (1 - s * 0.16), a0 = rnd() * 6.28, ox = s ? Math.cos(a0 + s * 2.2) * 0.07 : 0, oz = s ? Math.sin(a0 + s * 2.2) * 0.07 : 0;
    const segs = lod ? 1 : 3, pts = [];
    for (let i = 0; i <= segs; i++) { const t = i / segs; pts.push(new THREE.Vector3(ox + Math.cos(a0) * lean * t * t, h * t, oz + Math.sin(a0) * lean * t * t)); }
    for (let i = 0; i < segs; i++) limb(soup, pts[i], pts[i + 1], radius * (1.25 - 0.3 * (i / segs)), radius * (1.25 - 0.3 * ((i + 1) / segs)), lod ? 4 : 6, PALM_BARK);
    const crown = pts[segs];
    if (shaft && !lod) limb(soup, crown.clone().setY(crown.y - 0.07), crown, radius * 1.3, radius * 0.9, 6, new THREE.Color(0x6f9a44));
    const n = lod ? Math.ceil(fronds * 0.6) : fronds, steps = lod ? 2 : 4;
    for (let f = 0; f < n; f++) {
      const az = (f / n) * Math.PI * 2 + rnd() * 0.5;
      let el = 1.15 - (f % 3) * 0.42 + (rnd() - 0.5) * 0.2;              // three tiers: upright, spreading, hanging
      const L = length * (0.85 + rnd() * 0.3), droop = 0.9 + rnd() * 0.5, w = width * 0.5;
      const side = new THREE.Vector3(-Math.sin(az), 0, Math.cos(az));
      col.set(color).multiplyScalar(0.8 + rnd() * 0.35 - (f % 3) * 0.07);
      let p0 = crown.clone();
      for (let k = 0; k < steps; k++) {
        const dir = new THREE.Vector3(Math.cos(el) * Math.cos(az), Math.sin(el), Math.cos(el) * Math.sin(az));
        const p1 = p0.clone().addScaledVector(dir, L / steps);
        const nrm = new THREE.Vector3().crossVectors(side, dir).normalize().lerp(up, 0.5).normalize();
        const [u0, v0, u1, v1] = CELL.frond, ua = lerp(u0, u1, k / steps), ub = lerp(u0, u1, (k + 1) / steps);
        soup.quad(p0.clone().addScaledVector(side, -w), p1.clone().addScaledVector(side, -w), p1.clone().addScaledVector(side, w), p0.clone().addScaledVector(side, w), nrm, col.clone(), [ua, v0, ub, v1]);
        p0 = p1; el -= droop / steps;
      }
    }
    if (!lod && !shaft) { // coconuts
      for (let i = 0; i < 4; i++) {
        const a = rnd() * 6.28;
        soup.solid(new THREE.IcosahedronGeometry(0.022, 0).translate(crown.x + Math.cos(a) * 0.03, crown.y - 0.03, crown.z + Math.sin(a) * 0.03), () => new THREE.Color(0x5a5a2c));
      }
    }
  }
  return soup.build();
}

/** Low plants: a small solid mound with cards; `accents` adds blossom-coloured cards. */
function bush(seed, { color, r = 0.5, sy = 0.65, cards = 18, cardSize = 0.3, accents = null }) {
  const soup = new Soup(), rnd = mulberry32(seed), l = lobe(r, 1, sy, 1, 0, r * sy * 0.9, 0), inner = new THREE.Color(color);
  soup.solid(lobeGeometry({ ...l, r: r * 0.88 }, 1, seed), (t) => inner.clone().multiplyScalar(0.5 + 0.5 * t));
  leafCards(soup, l, cards, cardSize, color, rnd, new THREE.Vector3(0, l.y * 0.6, 0), accents);
  return soup.build();
}
/** Clipped hedge length: 1.25 long (local X) × 0.75 high × 0.62 deep, slightly uneven, with a fringe of leaves. */
function hedge(seed) {
  const soup = new Soup(), rnd = mulberry32(seed), color = 0x35592a, inner = new THREE.Color(color);
  let g = new THREE.BoxGeometry(1.25, 0.75, 0.62, 5, 2, 2);
  g.deleteAttribute('normal'); g.deleteAttribute('uv');
  g = mergeVertices(g);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i), k = fbm(x * 5 + seed, z * 7 + y * 5, 2) * 0.05;
    // keep the two ends flat so neighbouring lengths join without gaps
    p.setXYZ(i, x, y + 0.375 + (y > 0 ? k : 0), z * (1 + (y > 0 ? -0.12 : 0)) + k * (Math.abs(x) < 0.6 ? 1 : 0));
  }
  g.computeVertexNormals();
  soup.solid(g, (t) => inner.clone().multiplyScalar(0.5 + 0.5 * t));
  leafCards(soup, lobe(0.5, 1.25, 0.66, 0.62, 0, 0.42, 0), 16, 0.2, color, rnd, new THREE.Vector3(0, 0.2, 0));
  return soup.build();
}
function farTree(color, seed) {
  const g = lobeGeometry(lobe(0.42, 1, 0.8, 1, 0, 0.5, 0), 0, seed).toNonIndexed();
  g.computeVertexNormals(); // faceted: reads as a rough crown from far away
  const p = g.attributes.position, c = new THREE.Color(color), out = new THREE.Color(), col = new Float32Array(p.count * 3), rnd = mulberry32(seed);
  for (let i = 0; i < p.count; i += 3) {
    out.copy(c).multiplyScalar(0.62 + 0.55 * p.getY(i) + (rnd() - 0.5) * 0.12);
    for (let k = 0; k < 3; k++) col.set([out.r, out.g, out.b], (i + k) * 3);
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return g;
}

const BLOSSOM = [0xd9477a, 0xe8763a, 0xf2d24b, 0xf4efe6, 0xb04fc4];
const COCONUT = {}, ARECA = { height: 0.9, radius: 0.012, fronds: 9, length: 0.27, width: 0.1, color: 0x5d8c38, lean: 0.03, stems: 3, shaft: true };
// key → geometry factory. Tree species also have a `_mid` version; the far forest has its own two blobs.
const SPECIES = {
  ...Object.fromEntries(Object.entries(SHAPES).flatMap(([k, shape], i) => [[k, () => broadleaf(shape, 11 + i * 12, 0)], [`${k}_mid`, () => broadleaf(shape, 11 + i * 12, 1)]])),
  palm: () => palm(61, 0, COCONUT), palm_mid: () => palm(61, 1, COCONUT),
  areca: () => palm(67, 0, ARECA), areca_mid: () => palm(67, 1, ARECA),
  shrub: () => bush(71, { color: 0x426d2d }),
  flowering: () => bush(83, { color: 0x4d7430, sy: 0.72, accents: { share: 0.4, colors: BLOSSOM.slice(0, 2) } }),
  flower: () => bush(89, { color: 0x4f7a33, r: 0.5, sy: 0.5, cards: 14, cardSize: 0.34, accents: { share: 0.55, colors: BLOSSOM } }),
  hedge: () => hedge(93),
  farA: () => farTree(0x2a4a22, 91),
  farB: () => farTree(0x37592a, 97),
};
const SMALL = new Set(['shrub', 'flowering', 'flower', 'hedge']); // no LOD versions; only planted near the buildings

// ---------- placement ----------
export function buildVegetation(heightAt) {
  const rand = mulberry32(7);
  const lists = Object.fromEntries(Object.keys(SPECIES).map((k) => [k, []]));
  /** Plant one. The level of detail follows the distance from the site centre. rot: fixed heading (hedges). */
  const put = (sp, x, z, s, sy = 1, rot = rand() * Math.PI * 2) => {
    const r = Math.hypot(x - 15, z);
    const key = SMALL.has(sp) || sp.startsWith('far') || r < HERO_RADIUS ? sp : `${sp}_mid`;
    lists[key].push({ x, z, y: heightAt(x, z) - 0.015 * s, s, sy, rot });
  };
  const roadClear = (x, z, m) => { const q = roadQuery(x, z); return !q || q.d > q.extent + m; };
  const inPlot = (x, z, m = 1) => pointInPolygon(x, z, SITE_BOUNDARY) && signedDistToPolygon(x, z, SITE_BOUNDARY) < -m;
  const pick = (opts) => { let r = rand() * opts.reduce((a, o) => a + o[1], 0); for (const [k, w] of opts) if ((r -= w) <= 0) return k; return opts[0][0]; };
  const n01 = (x, z, scale, ox = 0, oz = 0, oct = 3) => fbm(x / scale + ox, z / scale + oz, oct) * 0.5 + 0.5;

  // 1) surrounding forest (outside the plot), shaped by noise fields rather than an even grid
  const MIXED = [['oakA', 4], ['oakB', 3], ['oakC', 2.2], ['rain', 1.2], ['palm', 0.5], ['areca', 0.3], ['cypress', 0.25]];
  const GROVE = [['palm', 4], ['areca', 2.5], ['oakA', 2], ['oakC', 1.5]];   // wet low ground
  const STAND = [['oakB', 5], ['oakA', 2], ['rain', 1.5]];                    // tall single-species stands
  for (let gx = -244; gx <= 274; gx += 4.6) for (let gz = -244; gz <= 244; gz += 4.6) {
    const x = gx + (rand() - 0.5) * 4.4, z = gz + (rand() - 0.5) * 4.4, r = Math.hypot(x - 15, z);
    if (r >= MID_RADIUS || signedDistToPolygon(x, z, SITE_BOUNDARY) < 1.5) { rand(); continue; }
    const y = heightAt(x, z);
    const rock = rockiness(x, z, heightAt);                                                             // steep or stony: sparse
    const clump = smoothstep(0.28, 0.62, n01(x, z, 62));                                                // thickets vs clearings
    const valley = 1 - smoothstep(-12, 5, y);                                                           // 1 on the low ground
    if (rand() > clamp((0.46 + 0.45 * clump + 0.22 * valley) * (1 - 0.85 * rock), 0, 0.97)) continue;
    const age = n01(x, z, 46, 9, -4, 2);                                                                // old growth vs regrowth
    const patch = n01(x, z, 95, -3, 7, 2);
    const sp = pick(patch > 0.6 && valley > 0.35 ? GROVE : patch < 0.38 ? STAND : MIXED);
    const tall = sp === 'palm' || sp === 'areca';
    let s = (tall ? lerp(8.5, 14, age) : lerp(5.5, 14.5, age ** 1.3)) * (0.85 + rand() * 0.3) * (1 - 0.3 * rock);
    if (!tall && rand() < 0.03) s *= 1.35;                                                              // the odd giant above the canopy
    put(sp, x, z, s, sp === 'cypress' ? 1 : 0.85 + rand() * 0.35);
  }
  // distant forest: plain blobs, with the same thickets and clearings
  for (let gx = -680; gx <= 680; gx += 13) for (let gz = -680; gz <= 680; gz += 13) {
    const x = gx + (rand() - 0.5) * 12, z = gz + (rand() - 0.5) * 12, r = Math.hypot(x - 15, z);
    if (r < MID_RADIUS || r >= 720 || rand() > 0.5 + 0.45 * smoothstep(0.28, 0.62, n01(x, z, 62))) continue;
    put(rand() < 0.5 ? 'farA' : 'farB', x, z, lerp(15, 30, n01(x, z, 46, 9, -4, 2)) * (0.85 + rand() * 0.3), 0.8 + rand() * 0.3);
  }

  // 2) avenue trees along roads (inside plot)
  for (const { def, samples } of roadData) {
    if (def.surface === 'path') continue;
    const every = def.id === 'hairpin-road' ? 3 : 4; // samples are 2 m apart
    samples.forEach((s, i) => {
      if (i % every) return;
      for (const sign of [1, -1]) {
        const off = (sign > 0 ? s.hl : s.hr) + 2.8 + rand() * 0.8;
        const x = s.x + s.nx * sign * off, z = s.z + s.nz * sign * off;
        if (!inPlot(x, z) || !roadClear(x, z, 2.4) || isBlocked(x, z, 1) || rand() > 0.85) continue;
        const sp = def.id === 'hairpin-road' ? pick([['cypress', 2], ['oakC', 2], ['oakA', 1]]) : pick([['oakA', 2], ['rain', 1.5], ['oakC', 1.5], ['cypress', 1], ['palm', 0.7]]);
        put(sp, x, z, sp === 'cypress' ? 7 + rand() * 3 : sp === 'palm' ? 8 + rand() * 3 : 5.5 + rand() * 3, 0.9 + rand() * 0.25);
      }
    });
  }

  // 3) hedges: along kerbs that have no parking bays, both sides of the footpath, round the play area and plaza
  const HEDGE = 2 / 1.25; // instance scale that makes one hedge length span the 2 m between road samples
  const hedgeAt = (x, z, tx, tz, height = 1) => put('hedge', x, z, HEDGE * (0.97 + rand() * 0.06), (0.5 + rand() * 0.06) * height, Math.atan2(-tz, tx));
  for (const { def, samples } of roadData) {
    const path = def.surface === 'path';
    for (const s of samples) for (const sign of [1, -1]) {
      if (!path && (sign > 0 ? s.parkL : s.parkR)) continue;
      const off = (sign > 0 ? s.hl : s.hr) + (path ? 0.75 : 1.45);
      const x = s.x + s.nx * sign * off, z = s.z + s.nz * sign * off;
      if (!inPlot(x, z, 1.5) || !roadClear(x, z, path ? 0.3 : 1.1) || isBlocked(x, z, 0.4)) continue;
      if (n01(x, z, 16, 3, 3, 1) > 0.8) continue; // the odd opening
      hedgeAt(x, z, s.tx, s.tz, path ? 0.75 : 1);
    }
  }
  const ringHedge = ([cx, cz], radius, keep = () => true) => {
    const n = Math.round((2 * Math.PI * radius) / 2);
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2, x = cx + Math.cos(a) * radius, z = cz + Math.sin(a) * radius;
      if (inPlot(x, z, 1.5) && roadClear(x, z, 2.2) && keep(x, z)) hedgeAt(x, z, -Math.sin(a), Math.cos(a), 0.85);
    }
  };
  ringHedge(FEATURES.playground.pos, FEATURES.playground.radius + 2.4);
  ringHedge(FEATURES.plaza.pos, FEATURES.plaza.radius + 1.6, (x, z) => Math.hypot(x - FEATURES.amphitheatre.pos[0], z - FEATURES.amphitheatre.pos[1]) > 14);

  // 4) flower beds: drifts along the road verges, and rings at the gates, plaza and prayer hall
  const bed = (x, z, n, spread) => {
    for (let i = 0; i < n; i++) {
      const fx = x + (rand() - 0.5) * spread, fz = z + (rand() - 0.5) * spread;
      if (inPlot(fx, fz) && roadClear(fx, fz, 0.9) && !isBlocked(fx, fz, 0.5)) put('flower', fx, fz, 0.7 + rand() * 0.5, 0.8 + rand() * 0.4);
    }
  };
  for (const f of [FEATURES.gateSouth, FEATURES.gateWest]) bed(f.pos[0], f.pos[1], 90, 26);
  for (let i = 0; i < 22; i++) {
    const a = (i / 22) * Math.PI * 2;
    bed(FEATURES.plaza.pos[0] + Math.cos(a) * (FEATURES.plaza.radius + 0.8), FEATURES.plaza.pos[1] + Math.sin(a) * (FEATURES.plaza.radius + 0.8), 2, 0.6);
    bed(FEATURES.prayerHall.pos[0] + Math.cos(a) * 9.6, FEATURES.prayerHall.pos[1] + Math.sin(a) * 9.6, 2, 1.4);
  }

  // 5) lawn trees, boundary planting, shrubs and verge flowers inside the plot
  for (let x = -100; x <= 130; x += 3) for (let z = -92; z <= 94; z += 3) {
    const jx = x + (rand() - 0.5) * 2.6, jz = z + (rand() - 0.5) * 2.6;
    const sd = signedDistToPolygon(jx, jz, SITE_BOUNDARY);
    if (sd > -0.8) continue;
    const q = roadQuery(jx, jz);
    const dRoad = q ? q.d - q.extent : 99;
    if (dRoad < 1.4 || isBlocked(jx, jz, 0.6)) continue;
    const r = rand();
    if (sd > -5 && r < 0.3) put(pick([['oakB', 2], ['oakA', 2], ['palm', 1], ['areca', 1]]), jx, jz, 6 + rand() * 4, 0.9 + rand() * 0.3);
    else if (dRoad > 3 && !isBlocked(jx, jz, 2.5) && r < 0.065) put(pick([['oakA', 3], ['rain', 2], ['oakC', 2], ['palm', 1], ['areca', 0.8]]), jx, jz, 5 + rand() * 4, 0.9 + rand() * 0.3);
    else if (dRoad > 2.2 && dRoad < 4.2 && n01(jx, jz, 9, 2, 6, 2) > 0.55) bed(jx, jz, 3, 1.6);
    else if (dRoad > 2.2 && dRoad < 4.4 && r < 0.3) put(rand() < 0.6 ? 'shrub' : 'flowering', jx, jz, 1.3 + rand() * 1.2, 0.8 + rand() * 0.4);
    else if (r < 0.03) put('shrub', jx, jz, 1.5 + rand() * 1.5);
  }

  // build one InstancedMesh per species and level of detail
  const leaves = new THREE.MeshStandardMaterial({ name: 'Foliage_Leaves', map: leafAtlas(), vertexColors: true, alphaTest: 0.42, side: THREE.DoubleSide, roughness: 0.95, metalness: 0 });
  const group = new THREE.Group(); group.name = 'Vegetation';
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0), v = new THREE.Vector3(), sc = new THREE.Vector3();
  let total = 0, tris = 0;
  const tint = new THREE.Color(), tintRand = mulberry32(2024), counts = {};
  for (const [sp, list] of Object.entries(lists)) {
    if (!list.length) continue;
    const geo = SPECIES[sp](), far = sp.startsWith('far');
    const im = new THREE.InstancedMesh(geo, far ? M.foliage : leaves, list.length);
    im.name = `Trees_${sp}`;
    // keepAll: phones thin out vegetation, but a hedge with lengths missing reads as broken
    im.userData = { castShadow: !far, receiveShadow: true, vegetation: true, ...(sp === 'hedge' ? { keepAll: true } : {}) };
    list.forEach((t, i) => {
      q.setFromAxisAngle(up, t.rot);
      im.setMatrixAt(i, m4.compose(v.set(t.x, t.y, t.z), q, sc.set(t.s, t.s * t.sy, t.s)));
      // per-plant tint (exported as glTF _COLOR_0): brightness varies, hue drifts between blue-green and olive/yellow
      const b = 0.78 + tintRand() * 0.42, warm = sp === 'hedge' ? tintRand() * 0.3 : tintRand();
      im.setColorAt(i, tint.setRGB(b * (0.9 + warm * 0.32), b * (0.96 + warm * 0.06), b * (1.0 - warm * 0.38)));
    });
    im.instanceColor.needsUpdate = true;
    im.computeBoundingSphere();
    group.add(im);
    counts[sp] = list.length;
    total += list.length; tris += (geo.attributes.position.count / 3) * list.length;
  }
  // canopy footprints for baked ground shading (skip the distant low-detail forest and the flowers)
  const occluders = [];
  for (const [sp, list] of Object.entries(lists)) {
    if (sp.startsWith('far') || sp === 'flower') continue;
    const base = sp.replace('_mid', '');
    const k = base === 'cypress' ? 0.16 : base === 'palm' || base === 'areca' ? 0.3 : base === 'rain' ? 0.42 : SMALL.has(base) ? 0.5 : 0.34;
    for (const t of list) occluders.push({ x: t.x, z: t.z, r: Math.max(1.2, t.s * k) });
  }
  return { group, total, tris, occluders, counts };
}
