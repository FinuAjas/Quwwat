import * as THREE from 'three';
import { roadData } from './terrain.js';
import { toY } from './layout.js';
import { ribbon, merge, box, paint, mulberry32, lerp } from './geom.js';
import { M } from './materials.js';

const Y_ROAD = 0.12, Y_KERB = 0.16, Y_MARK = 0.15;

function interp(samples, closed, d, step = 2) {
  const n = samples.length;
  const f = d / step, i = Math.floor(f), t = f - i;
  const a = samples[closed ? i % n : Math.min(i, n - 1)], b = samples[closed ? (i + 1) % n : Math.min(i + 1, n - 1)];
  const nx = lerp(a.nx, b.nx, t), nz = lerp(a.nz, b.nz, t), l = Math.hypot(nx, nz) || 1;
  return { x: lerp(a.x, b.x, t), z: lerp(a.z, b.z, t), nx: nx / l, nz: nz / l, h: lerp(a.h, b.h, t), parkL: a.parkL && b.parkL, parkR: a.parkR && b.parkR, hw: 0 };
}

function carGeometry() {
  const body = paint(box(1.8, 0.75, 4.3, 0, 0.6, 0), 0xffffff);
  const cabin = paint(box(1.62, 0.55, 2.3, 0, 1.25, -0.15), 0x1c2228);
  const roof = paint(box(1.5, 0.06, 1.9, 0, 1.55, -0.15), 0xffffff);
  const g = merge([body, cabin, roof]);
  return g;
}

const PAINTS = [['White', 0xe4e4e0, 0.34], ['Silver', 0x979ba0, 0.22], ['Black', 0x1b1d20, 0.18], ['Red', 0x7c1d18, 0.12], ['Blue', 0x243f69, 0.14]];

export function buildRoads() {
  const roads = new THREE.Group(); roads.name = 'Roads';
  const parking = new THREE.Group(); parking.name = 'Parking';
  const rand = mulberry32(42);
  const paved = { asphalt: [], path: [] }, kerbs = [], marks = [];
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

  // instanced cars, one InstancedMesh per paint colour
  const carGeo = carGeometry();
  const buckets = PAINTS.map(() => []);
  for (const slot of carSlots) {
    let r = rand(), k = 0; while (k < PAINTS.length - 1 && (r -= PAINTS[k][2]) > 0) k++;
    buckets[k].push(slot);
  }
  const mtx = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0), one = new THREE.Vector3(1, 1, 1);
  PAINTS.forEach(([name, color], k) => {
    const list = buckets[k]; if (!list.length) return;
    const im = new THREE.InstancedMesh(carGeo, M.car(name, color), list.length);
    im.name = `Cars_${name}`;
    im.userData = { castShadow: true };
    list.forEach((s, i) => { q.setFromAxisAngle(up, s.yaw); im.setMatrixAt(i, mtx.compose(new THREE.Vector3(s.x, s.y, s.z), q, one)); });
    parking.add(im);
  });
  return { roads, parking, carCount: carSlots.length };
}
