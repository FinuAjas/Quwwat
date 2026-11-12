import * as THREE from 'three';
import { SITE_BOUNDARY, ROADS } from './layout.js';
import { roadQuery, roadData } from './terrain.js';
import { isBlocked } from './structures.js';
import { prep, merge, mergeVertices, mulberry32, fbm, signedDistToPolygon, pointInPolygon } from './geom.js';
import { M } from './materials.js';

// ---------- unit-height tree geometries (≈1 m tall, scaled per instance) ----------
function blob(r, detail, sx, sy, sz, ox, oy, oz, seed) {
  let g = new THREE.IcosahedronGeometry(r, detail);
  g.deleteAttribute('normal'); g.deleteAttribute('uv');
  g = mergeVertices(g);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const k = 1 + fbm(x * 6 + seed, z * 6 + y * 4 - seed, 2) * 0.28;
    p.setXYZ(i, x * k * sx + ox, y * k * sy + oy, z * k * sz + oz);
  }
  g.computeVertexNormals();
  return g;
}
function shadeCanopy(g, base, seed) {
  g = prep(g);
  const p = g.attributes.position, c = new THREE.Color(base), out = new THREE.Color();
  let min = Infinity, max = -Infinity;
  for (let i = 0; i < p.count; i++) { min = Math.min(min, p.getY(i)); max = Math.max(max, p.getY(i)); }
  const col = new Float32Array(p.count * 3), rnd = mulberry32(seed);
  for (let i = 0; i < p.count; i += 3) {
    const t = (p.getY(i) - min) / (max - min || 1);
    out.copy(c).multiplyScalar(0.62 + 0.55 * t + (rnd() - 0.5) * 0.12);
    for (let k = 0; k < 3; k++) col.set([out.r, out.g, out.b], (i + k) * 3);
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return g;
}
function trunk(h, r0, r1, sides = 5) {
  const g = new THREE.CylinderGeometry(r1, r0, h, sides, 1, true); g.translate(0, h / 2, 0);
  const pg = prep(g); const n = pg.attributes.position.count, col = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) col.set([0.33, 0.24, 0.17], i * 3);
  pg.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return pg;
}

function broadleaf(color, seed, detail = 1) {
  return merge([
    trunk(0.42, 0.045, 0.03),
    shadeCanopy(blob(0.3, detail, 1, 0.78, 1, 0, 0.66, 0, seed), color, seed),
    shadeCanopy(blob(0.2, 0, 1, 0.8, 1, 0.17, 0.55, 0.08, seed + 3), color, seed + 1),
    shadeCanopy(blob(0.2, 0, 1, 0.8, 1, -0.12, 0.6, -0.14, seed + 5), color, seed + 2),
  ]);
}
function columnar(color, seed) {
  return merge([trunk(0.15, 0.03, 0.025), shadeCanopy(blob(0.5, 1, 0.3, 1, 0.3, 0, 0.55, 0, seed), color, seed)]);
}
function palm(seed) {
  const parts = [trunk(0.85, 0.022, 0.016, 6)];
  const fronds = [];
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + 0.3;
    const g = new THREE.BoxGeometry(0.42, 0.008, 0.075); g.translate(0.21, 0, 0);
    g.rotateZ(-0.45 - (i % 2) * 0.25); g.rotateY(a); g.translate(0, 0.86, 0);
    fronds.push(g);
  }
  parts.push(shadeCanopy(merge(fronds), 0x4f8a2a, seed));
  return merge(parts);
}
function farTree(color, seed) {
  return shadeCanopy(blob(0.42, 0, 1, 0.8, 1, 0, 0.5, 0, seed), color, seed);
}

const SPECIES = {
  oakA: () => broadleaf(0x3f7a2a, 11),
  oakB: () => broadleaf(0x2f6324, 23),
  oakC: () => broadleaf(0x58913a, 37),
  cypress: () => columnar(0x2d5f2a, 51),
  palm: () => palm(61),
  shrub: () => shadeCanopy(blob(0.5, 1, 1, 0.65, 1, 0, 0.3, 0, 71), 0x467f2f, 71),
  flowering: () => shadeCanopy(blob(0.5, 1, 1, 0.7, 1, 0, 0.32, 0, 83), 0x8c9a3a, 83),
  farA: () => farTree(0x2e5a22, 91),
  farB: () => farTree(0x3d6d2a, 97),
};

// ---------- placement ----------
export function buildVegetation(heightAt) {
  const rand = mulberry32(7);
  const lists = Object.fromEntries(Object.keys(SPECIES).map((k) => [k, []]));
  const put = (sp, x, z, s, sy = 1) => lists[sp].push({ x, z, y: heightAt(x, z) - 0.15 * s * 0.1, s, sy, rot: rand() * Math.PI * 2 });
  const roadClear = (x, z, m) => { const q = roadQuery(x, z); return !q || q.d > q.extent + m; };
  const pick = (opts) => { let r = rand() * opts.reduce((a, o) => a + o[1], 0); for (const [k, w] of opts) if ((r -= w) <= 0) return k; return opts[0][0]; };

  // 1) surrounding forest (outside plot)
  const forest = (step, rMin, rMax, prob, farScale) => {
    for (let x = -680; x <= 680; x += step) for (let z = -680; z <= 680; z += step) {
      const jx = x + (rand() - 0.5) * step * 0.9, jz = z + (rand() - 0.5) * step * 0.9;
      const r = Math.hypot(jx - 15, jz);
      if (r < rMin || r >= rMax || rand() > prob) continue;
      if (signedDistToPolygon(jx, jz, SITE_BOUNDARY) < 1.5) continue;
      if (farScale) { put(rand() < 0.5 ? 'farA' : 'farB', jx, jz, (13 + rand() * 7) * farScale, 0.8 + rand() * 0.3); continue; }
      const sp = pick([['oakA', 4], ['oakB', 4], ['oakC', 2], ['palm', 0.45], ['cypress', 0.5]]);
      const s = sp === 'palm' ? 10 + rand() * 4 : 8 + rand() * 6;
      put(sp, jx, jz, s, 0.85 + rand() * 0.35);
    }
  };
  forest(5.5, 0, 240, 0.92, 0);
  forest(13, 240, 720, 0.85, 1.4);

  // 2) avenue trees along roads (inside plot)
  for (const { def, samples } of roadData) {
    if (def.surface === 'path') continue;
    const every = def.id === 'hairpin-road' ? 3 : 4; // samples are 2 m apart
    samples.forEach((s, i) => {
      if (i % every) return;
      for (const sign of [1, -1]) {
        const off = (sign > 0 ? s.hl : s.hr) + 2.6 + rand() * 0.8;
        const x = s.x + s.nx * sign * off, z = s.z + s.nz * sign * off;
        if (!pointInPolygon(x, z, SITE_BOUNDARY) || signedDistToPolygon(x, z, SITE_BOUNDARY) > -1) continue;
        if (!roadClear(x, z, 2.2) || isBlocked(x, z, 1) || rand() > 0.85) continue;
        const sp = def.id === 'hairpin-road' ? pick([['cypress', 2], ['oakC', 2], ['oakA', 1]]) : pick([['oakA', 2], ['oakC', 2], ['cypress', 1], ['palm', 0.6]]);
        put(sp, x, z, sp === 'cypress' ? 7 + rand() * 3 : sp === 'palm' ? 8 + rand() * 3 : 5.5 + rand() * 3, 0.9 + rand() * 0.25);
      }
    });
  }

  // 3) lawn trees, boundary planting and shrubs inside the plot
  for (let x = -100; x <= 130; x += 3) for (let z = -92; z <= 94; z += 3) {
    const jx = x + (rand() - 0.5) * 2.6, jz = z + (rand() - 0.5) * 2.6;
    const sd = signedDistToPolygon(jx, jz, SITE_BOUNDARY);
    if (sd > -0.8) continue;
    const q = roadQuery(jx, jz);
    const dRoad = q ? q.d - q.extent : 99;
    if (dRoad < 1.4 || isBlocked(jx, jz, 0.6)) continue;
    const r = rand();
    if (sd > -5 && r < 0.3) put(pick([['oakB', 2], ['oakA', 2], ['palm', 1]]), jx, jz, 6 + rand() * 4, 0.9 + rand() * 0.3);
    else if (dRoad > 3 && !isBlocked(jx, jz, 2.5) && r < 0.065) put(pick([['oakA', 3], ['oakC', 2], ['palm', 1], ['flowering', 1]]), jx, jz, 5 + rand() * 4, 0.9 + rand() * 0.3);
    else if (dRoad < 3.5 && r < 0.22) put(rand() < 0.75 ? 'shrub' : 'flowering', jx, jz, 1.3 + rand() * 1.2, 0.8 + rand() * 0.4);
    else if (r < 0.03) put('shrub', jx, jz, 1.5 + rand() * 1.5);
  }

  // build one InstancedMesh per species
  const group = new THREE.Group(); group.name = 'Vegetation';
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0), v = new THREE.Vector3(), sc = new THREE.Vector3();
  let total = 0, tris = 0;
  for (const [sp, list] of Object.entries(lists)) {
    if (!list.length) continue;
    const geo = SPECIES[sp]();
    const im = new THREE.InstancedMesh(geo, M.foliage, list.length);
    im.name = `Trees_${sp}`;
    im.userData = { castShadow: !sp.startsWith('far'), receiveShadow: true, vegetation: true };
    list.forEach((t, i) => {
      q.setFromAxisAngle(up, t.rot);
      im.setMatrixAt(i, m4.compose(v.set(t.x, t.y, t.z), q, sc.set(t.s, t.s * t.sy, t.s)));
    });
    im.computeBoundingSphere();
    group.add(im);
    total += list.length; tris += (geo.attributes.position.count / 3) * list.length;
  }
  return { group, total, tris };
}
