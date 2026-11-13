import * as THREE from 'three';
import { roadData } from './terrain.js';
import { toY } from './layout.js';
import { ribbon, merge, box, prep, paint, mulberry32, lerp, fbm } from './geom.js';
import { M } from './materials.js';

const Y_ROAD = 0.12, Y_KERB = 0.16, Y_MARK = 0.15;

function interp(samples, closed, d, step = 2) {
  const n = samples.length;
  const f = d / step, i = Math.floor(f), t = f - i;
  const a = samples[closed ? i % n : Math.min(i, n - 1)], b = samples[closed ? (i + 1) % n : Math.min(i + 1, n - 1)];
  const nx = lerp(a.nx, b.nx, t), nz = lerp(a.nz, b.nz, t), l = Math.hypot(nx, nz) || 1;
  return { x: lerp(a.x, b.x, t), z: lerp(a.z, b.z, t), nx: nx / l, nz: nz / l, h: lerp(a.h, b.h, t), parkL: a.parkL && b.parkL, parkR: a.parkR && b.parkR, hw: 0 };
}

/** Extrude a side profile ([z along the car, y up] points, front = +z) to the given width, centred on the car. */
function profile(points, width) {
  const s = new THREE.Shape(points.map(([z, y]) => new THREE.Vector2(z, y)));
  const g = new THREE.ExtrudeGeometry(s, { depth: width, bevelEnabled: false });
  return g.translate(0, 0, -width / 2).rotateY(-Math.PI / 2);
}
// Body styles as side profiles: painted lower body, dark glasshouse, painted roof, wheels and a dark sill.
// Vertex colours multiply the paint colour: white = paint, dark = glass / rubber whatever the paint.
const CAR_STYLES = {
  Sedan: { len: 4.4, wheel: 1.36, width: 1.76,
    body: [[-2.2, 0.3], [2.2, 0.3], [2.2, 0.62], [2.02, 0.8], [0.98, 0.9], [-1.3, 0.93], [-2.08, 0.9], [-2.2, 0.72]],
    glass: [[-1.5, 0.92], [0.98, 0.89], [0.3, 1.4], [-0.95, 1.42]], roof: [-0.95, 0.3, 1.42] },
  Hatch: { len: 3.9, wheel: 1.2, width: 1.72,
    body: [[-1.95, 0.3], [1.95, 0.3], [1.95, 0.64], [1.78, 0.82], [0.9, 0.92], [-1.8, 0.95], [-1.95, 0.8]],
    glass: [[-1.82, 0.94], [0.9, 0.91], [0.28, 1.44], [-1.5, 1.46]], roof: [-1.5, 0.28, 1.46] },
  SUV: { len: 4.6, wheel: 1.42, width: 1.86,
    body: [[-2.3, 0.36], [2.3, 0.36], [2.3, 0.78], [2.1, 1.0], [1.05, 1.08], [-2.15, 1.1], [-2.3, 0.95]],
    glass: [[-2.12, 1.09], [1.05, 1.07], [0.45, 1.68], [-1.85, 1.7]], roof: [-1.85, 0.45, 1.7] },
};
function carGeometry(style) {
  const c = CAR_STYLES[style], r = style === 'SUV' ? 0.37 : 0.32;
  const parts = [
    paint(prep(profile(c.body, c.width)), 0xffffff),
    paint(prep(profile(c.glass, c.width - 0.2)), 0x161b20),
    paint(box(c.width - 0.24, 0.05, c.roof[1] - c.roof[0], 0, c.roof[2] + 0.02, (c.roof[0] + c.roof[1]) / 2), 0xffffff),
    paint(box(c.width + 0.02, 0.14, c.len - 0.1, 0, c.body[0][1] + 0.05, 0), 0x1d1d1f),                      // sill / bumper line
  ];
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    parts.push(paint(prep(new THREE.CylinderGeometry(r, r, 0.24, 10).rotateZ(Math.PI / 2).translate(sx * (c.width / 2 - 0.1), r, sz * c.wheel)), 0x101012));
    parts.push(paint(prep(new THREE.CylinderGeometry(r * 0.55, r * 0.55, 0.26, 8).rotateZ(Math.PI / 2).translate(sx * (c.width / 2 - 0.1), r, sz * c.wheel)), 0x8f9296)); // hub
  }
  return merge(parts);
}

const PAINTS = [['White', 0xe4e4e0, 0.34], ['Silver', 0x979ba0, 0.22], ['Black', 0x1b1d20, 0.18], ['Red', 0x7c1d18, 0.12], ['Blue', 0x243f69, 0.14]];

export function buildRoads() {
  const roads = new THREE.Group(); roads.name = 'Roads';
  const parking = new THREE.Group(); parking.name = 'Parking';
  const rand = mulberry32(42);
  const paved = { asphalt: [], path: [] }, kerbs = [], marks = [];
  const shoulder = { pos: [], col: [] };
  const carSlots = [];

  for (const { def, samples, length } of roadData) {
    const closed = !!def.closed;
    const list = closed ? [...samples, samples[0]] : samples;
    const L = [], R = [], KL = [], KR = [];
    for (const s of list) {
      const y = toY(s.h);
      L.push([s.x + s.nx * s.hl, y + Y_ROAD, s.z + s.nz * s.hl]);
      R.push([s.x - s.nx * s.hr, y + Y_ROAD, s.z - s.nz * s.hr]);
      KL.push([s.x + s.nx * (s.hl + 0.7), y + Y_KERB, s.z + s.nz * (s.hl + 0.7)]);
      KR.push([s.x - s.nx * (s.hr + 0.7), y + Y_KERB, s.z - s.nz * (s.hr + 0.7)]);
    }
    paved[def.surface === 'path' ? 'path' : 'asphalt'].push(ribbon(L, R));
    if (def.kerb) {
      kerbs.push(ribbon(L.map((p) => [p[0], p[1] + 0.04, p[2]]), KL));
      kerbs.push(ribbon(KR, R.map((p) => [p[0], p[1] + 0.04, p[2]])));
    }
    // worn-earth shoulder: a strip outside each edge, opaque-ish at the kerb and fading to nothing over the grass
    const inner = def.kerb ? 0.7 : 0, wide = def.kerb ? 1.5 : 0.6;
    for (let i = 0; i < list.length - 1; i++) {
      const a = list[i], b = list[i + 1];
      for (const sign of [1, -1]) {
        const edge = (s, off) => { const e = (sign > 0 ? s.hl : s.hr) + off; return [s.x + s.nx * sign * e, toY(s.h) + Y_ROAD - 0.05, s.z + s.nz * sign * e]; };
        const reach = (s) => inner + wide * (0.75 + 0.5 * (fbm(s.x / 4 + sign * 3, s.z / 4, 2) * 0.5 + 0.5));
        const a0 = edge(a, inner), a1 = edge(a, reach(a)), b0 = edge(b, inner), b1 = edge(b, reach(b));
        const quad = sign > 0 ? [a0, b0, b1, a0, b1, a1] : [a0, b1, b0, a0, a1, b1]; // wound to face up
        const alpha = sign > 0 ? [1, 1, 0, 1, 0, 0] : [1, 0, 1, 1, 0, 0];
        quad.forEach((p, k) => {
          const shade = 0.85 + 0.3 * (fbm(p[0] / 2.2, p[2] / 2.2, 2) * 0.5 + 0.5);
          shoulder.pos.push(...p);
          shoulder.col.push(0.2 * shade, 0.135 * shade, 0.08 * shade, alpha[k] * (def.kerb ? 0.7 : 0.55));
        });
      }
    }
    const hw = def.width / 2;
    // centre dashes: 2 m dash / 4 m gap
    if (def.dashes) {
      for (let d = 0; d + 2 < length; d += 6) {
        const a = interp(samples, closed, d), b = interp(samples, closed, d + 2);
        const w = 0.09;
        marks.push(ribbon(
          [[a.x + a.nx * w, toY(a.h) + Y_MARK, a.z + a.nz * w], [b.x + b.nx * w, toY(b.h) + Y_MARK, b.z + b.nz * w]],
          [[a.x - a.nx * w, toY(a.h) + Y_MARK, a.z - a.nz * w], [b.x - b.nx * w, toY(b.h) + Y_MARK, b.z - b.nz * w]],
        ));
      }
    }
    // perpendicular parking stalls
    if (def.parking) {
      for (let d = 1.3; d < length - 1.3; d += 2.6) {
        const p = interp(samples, closed, d);
        for (const [flag, sign] of [['parkL', 1], ['parkR', -1]]) {
          if (!p[flag]) continue;
          const y = toY(p.h) + Y_MARK;
          // stall divider line
          const tx = -p.nz * sign, tz = p.nx * sign; // along-road direction (any sign ok for a thin line)
          const o0 = hw + 0.3, o1 = hw + 5.3, w = 0.06;
          const ax = p.x + p.nx * sign * o0, az = p.z + p.nz * sign * o0;
          const bx = p.x + p.nx * sign * o1, bz = p.z + p.nz * sign * o1;
          marks.push(ribbon([[ax + tx * w, y, az + tz * w], [bx + tx * w, y, bz + tz * w]], [[ax - tx * w, y, az - tz * w], [bx - tx * w, y, bz - tz * w]]));
          if (rand() < 0.72) {
            const c = interp(samples, closed, d + 1.3);
            if (!c[flag]) continue;
            carSlots.push({ x: c.x + c.nx * sign * (hw + 2.8), z: c.z + c.nz * sign * (hw + 2.8), y: toY(c.h) + Y_ROAD, yaw: Math.atan2(c.nx * sign, c.nz * sign) + (rand() < 0.5 ? Math.PI : 0) + (rand() - 0.5) * 0.08 });
          }
        }
      }
    }
    // one car stopped on the west road (the cars driving the hairpin road are added live: src/hero/life.js)
    if (def.id === 'west-road') {
      for (const f of [0.45]) {
        const p = interp(samples, closed, f * length), q = interp(samples, closed, f * length + 1);
        const side = rand() < 0.5 ? 1 : -1;
        carSlots.push({ x: p.x + p.nx * side * 1.8, z: p.z + p.nz * side * 1.8, y: toY(p.h) + Y_ROAD, yaw: Math.atan2(q.x - p.x, q.z - p.z) + (side > 0 ? Math.PI : 0) });
      }
    }
  }

  const add = (geoms, mat, name, parent = roads) => {
    if (!geoms.length) return;
    const m = new THREE.Mesh(merge(geoms), mat); m.name = name; m.userData = { receiveShadow: true }; parent.add(m);
  };
  add(paved.asphalt, M.asphalt, 'Road_Surface');
  add(paved.path, M.path, 'Footpath');
  add(kerbs, M.kerb, 'Road_Kerbs');
  add(marks, M.marking, 'Road_Markings');
  if (shoulder.pos.length) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(shoulder.pos, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(shoulder.col, 4));
    g.computeVertexNormals();
    const m = new THREE.Mesh(g, M.shoulder); m.name = 'Road_Shoulders'; m.userData = { receiveShadow: true }; roads.add(m);
  }

  // instanced cars: one InstancedMesh per body style and paint colour
  const styles = Object.keys(CAR_STYLES), styleMix = [0.45, 0.3, 0.25];
  const geos = styles.map(carGeometry);
  const paints = PAINTS.map(([name, color]) => M.car(name, color));
  const buckets = styles.map(() => PAINTS.map(() => []));
  for (const slot of carSlots) {
    let r = rand(), k = 0; while (k < PAINTS.length - 1 && (r -= PAINTS[k][2]) > 0) k++;
    let r2 = rand(), st = 0; while (st < styles.length - 1 && (r2 -= styleMix[st]) > 0) st++;
    buckets[st][k].push(slot);
  }
  const mtx = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0), one = new THREE.Vector3(1, 1, 1);
  styles.forEach((style, st) => PAINTS.forEach(([name], k) => {
    const list = buckets[st][k]; if (!list.length) return;
    const im = new THREE.InstancedMesh(geos[st], paints[k], list.length);
    im.name = `Cars_${style}_${name}`;
    im.userData = { castShadow: true };
    list.forEach((s, i) => { q.setFromAxisAngle(up, s.yaw); im.setMatrixAt(i, mtx.compose(new THREE.Vector3(s.x, s.y, s.z), q, one)); });
    parking.add(im);
  }));
  return { roads, parking, carCount: carSlots.length };
}
