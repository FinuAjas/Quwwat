import * as THREE from 'three';
import { FEATURES, SITE_BOUNDARY, PADS, toY } from './layout.js';
import { mergeScatter, blockedBy } from './legacy.js';
import { box, merge, prep, paint, signedDistToPolygon, mulberry32 } from './geom.js';
import { M } from './materials.js';

/**
 * Site furniture, for human scale: street lamps along the roads, benches at the play area, prayer
 * hall and footpath, bollards at the west gate, and a name sign at each gate.
 * Lamps, benches and bollards are one instanced mesh each, sharing one vertex-coloured material.
 */
const DARK = 0x23282c, TEAK = 0x7a4b2d, CREAM = 0xf3e6c0;
const part = (g, color) => paint(prep(g), color);

function lampGeometry() {
  const arm = new THREE.CylinderGeometry(0.04, 0.04, 1.0, 6).rotateX(Math.PI / 2 - 0.3).translate(0, 5.35, 0.45);
  return merge([
    part(new THREE.CylinderGeometry(0.16, 0.2, 0.55, 8).translate(0, 0.275, 0), DARK),
    part(new THREE.CylinderGeometry(0.06, 0.09, 5.2, 8).translate(0, 2.6, 0), DARK),
    part(arm, DARK),
    part(new THREE.BoxGeometry(0.3, 0.1, 0.62).translate(0, 5.5, 1.05), DARK),
    part(new THREE.BoxGeometry(0.22, 0.035, 0.44).translate(0, 5.435, 1.07), CREAM),   // lens
  ]);
}
function benchGeometry() {
  const parts = [];
  for (const z of [-0.14, 0.02, 0.18]) parts.push(part(new THREE.BoxGeometry(1.7, 0.04, 0.13).translate(0, 0.46, z), TEAK));
  for (const y of [0.68, 0.86]) parts.push(part(new THREE.BoxGeometry(1.7, 0.13, 0.04).rotateX(-0.18).translate(0, y, -0.24 - (y - 0.68) * 0.2), TEAK));
  for (const x of [-0.74, 0.74]) {
    parts.push(part(new THREE.BoxGeometry(0.06, 0.46, 0.5).translate(x, 0.23, 0.02), DARK));
    parts.push(part(new THREE.BoxGeometry(0.06, 0.5, 0.06).translate(x, 0.7, -0.26), DARK));
    parts.push(part(new THREE.BoxGeometry(0.07, 0.04, 0.46).translate(x, 0.66, 0.0), DARK));  // armrest
  }
  return merge(parts);
}
function bollardGeometry() {
  return merge([
    part(new THREE.CylinderGeometry(0.1, 0.12, 0.85, 10).translate(0, 0.425, 0), DARK),
    part(new THREE.CylinderGeometry(0.105, 0.105, 0.09, 10).translate(0, 0.68, 0), CREAM),
    part(new THREE.SphereGeometry(0.11, 10, 6).translate(0, 0.86, 0), DARK),
  ]);
}

/** Name board texture, drawn once and shared by both gate signs. */
function signTexture() {
  const cv = document.createElement('canvas');
  cv.width = 1024; cv.height = 320;
  const g = cv.getContext('2d');
  g.fillStyle = '#1d3526'; g.fillRect(0, 0, 1024, 320);
  g.strokeStyle = '#d9c39a'; g.lineWidth = 6; g.strokeRect(18, 18, 988, 284);
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillStyle = '#d9c39a'; g.font = '600 34px Georgia, "Times New Roman", serif';
  g.fillText('Q U W W A T   G R O U P', 512, 84);
  g.fillStyle = '#f6f1e6'; g.font = '112px Georgia, "Times New Roman", serif';
  g.fillText('Mountain Courtyard', 512, 190);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  tex.name = 'Sign_MountainCourtyard';
  return tex;
}

/** Where the lamps, benches and bollards go in one world (legacy.js). Adds each lamp and bench to world.obstacles. */
function placeFurniture(world) {
  const { roadData, roadQuery, obstacles, isBlocked, features: F } = world;
  const rand = mulberry32(77);
  const inPlot = (x, z, margin = 1.5) => signedDistToPolygon(x, z, SITE_BOUNDARY) < -margin;
  const offRoad = (x, z, clear = 0.4) => { const q = roadQuery(x, z); return !q || q.d > q.extent + clear; };
  const lamps = [], benches = [], bollards = [];

  // ---- street lamps: every ~26 m, alternating sides, just behind the kerb, arm over the road ----
  for (const { def, samples } of roadData) {
    if (def.surface === 'path') continue;
    let side = 1;
    for (let i = 5; i < samples.length - 3; i += 13) {
      const s = samples[i];
      for (let attempt = 0; attempt < 2; attempt++, side = -side) {
        const off = (side > 0 ? s.hl : s.hr) + 1.15;
        const x = s.x + s.nx * side * off, z = s.z + s.nz * side * off;
        if (!inPlot(x, z) || !offRoad(x, z, 0.7) || isBlocked(x, z, 0.6)) continue;
        lamps.push({ x, z, r: 0.9, yaw: Math.atan2(-s.nx * side, -s.nz * side) });
        obstacles.push({ x, z, r: 0.9 });
        side = -side;
        break;
      }
    }
  }

  // ---- benches (front of the bench faces the given point) ----
  const bench = (x, z, lookX, lookZ) => {
    if (!inPlot(x, z, 1) || !offRoad(x, z, 0.8)) return;
    benches.push({ x, z, r: 1.3, yaw: Math.atan2(lookX - x, lookZ - z) });
    obstacles.push({ x, z, r: 1.3 });
  };
  const ring = (c, r, anglesDeg) => anglesDeg.forEach((a) => { const t = (a * Math.PI) / 180; bench(c[0] + Math.cos(t) * r, c[1] + Math.sin(t) * r, c[0], c[1]); });
  if (F.plaza) ring(F.plaza.pos, F.plaza.radius + 1.5, [20, 95, 160, 235, 300]); // the old round plaza (legacy.js)
  ring(F.playground.pos, F.playground.radius + 1.9, [75, 130, 185, 240, 290]);
  if (F.amphitheatre.walkway) { // Plan 3: four benches on the amphitheatre's upper walkway, between the aisles, facing the stage
    const a = F.amphitheatre, r = a.r0 + a.tiers * a.tierDepth + a.walkway / 2, c = Math.cos(a.rot), sn = Math.sin(a.rot);
    const y = toY(PADS.find((p) => p.id === 'amphitheatre').elev) + a.tiers * a.tierRise; // the walkway's surface, not the ground
    for (const d of [24, 68, 112, 152]) {
      const t = (d * Math.PI) / 180, lx = r * Math.cos(t), lz = -r * Math.sin(t);
      const x = a.pos[0] + lx * c + lz * sn, z = a.pos[1] - lx * sn + lz * c;
      benches.push({ x, z, y, r: 1.3, yaw: Math.atan2(a.pos[0] - x, a.pos[1] - z) });
    }
  }
  { // in front of the prayer hall, facing it
    const [px, pz] = F.prayerHall.pos, rot = F.prayerHall.rot;
    for (const lx of [-3.2, 3.2]) {
      const x = px + lx * Math.cos(rot) + 8.2 * Math.sin(rot), z = pz - lx * Math.sin(rot) + 8.2 * Math.cos(rot);
      bench(x, z, px, pz);
    }
  }
  const path = roadData.find((r) => r.def.id === 'prayer-path');
  if (path) for (const i of [Math.floor(path.samples.length * 0.35), Math.floor(path.samples.length * 0.7)]) {
    const s = path.samples[i], side = i % 2 ? 1 : -1;
    bench(s.x + s.nx * side * 2.1, s.z + s.nz * side * 2.1, s.x, s.z);
  }

  // ---- bollards beside the west gate (and, on the old layout, round the plaza where no road met it) ----
  if (F.plaza) for (let a = 0; a < 360; a += 24) {
    const t = (a * Math.PI) / 180, x = F.plaza.pos[0] + Math.cos(t) * (F.plaza.radius + 0.38), z = F.plaza.pos[1] + Math.sin(t) * (F.plaza.radius + 0.38);
    if (offRoad(x, z, 0.5)) bollards.push({ x, z, yaw: 0 });
  }
  if (F.turningHead) { // Plan 3: round the turning head, where no road enters and the amphitheatre is not in the way
    const others = blockedBy(obstacles.filter((o) => o.plan3 !== 'turning-head')); // its own footprint would block them all
    for (let a = 0; a < 360; a += 24) {
      const t = (a * Math.PI) / 180, R = F.turningHead.radius + 1.05;
      const x = F.turningHead.pos[0] + Math.cos(t) * R, z = F.turningHead.pos[1] + Math.sin(t) * R;
      if (offRoad(x, z, 1.2) && !others(x, z, 0.3)) bollards.push({ x, z, yaw: 0 });
    }
  }
  {
    const [gx, gz] = F.gateWest.pos, rot = F.gateWest.rot;
    for (const lx of [-4.3, 4.3]) for (const lz of [-5.5, -7.5, -9.5]) {
      const x = gx + lx * Math.cos(rot) + lz * Math.sin(rot), z = gz - lx * Math.sin(rot) + lz * Math.cos(rot);
      if (offRoad(x, z, 0.2)) bollards.push({ x, z, yaw: 0 });
    }
  }

  // a little heading scatter, drawn in the order the instanced meshes are built
  for (const list of [lamps, benches, bollards]) for (const o of list) o.yaw += (rand() - 0.5) * 0.04;
  return { lamps, benches, bollards };
}

/**
 * world: the current site; legacy: the site before Plan 3 (legacy.js). Outside the Plan 3 work area the
 * furniture is what the old site had; inside it, it follows the current roads.
 */
export function buildFurniture(heightAt, world, legacy) {
  const group = new THREE.Group(); group.name = 'Furniture';
  const { obstacles } = world, structures = obstacles.length;
  const old = placeFurniture(legacy), now = placeFurniture(world);
  const lamps = mergeScatter(old.lamps, now.lamps, { gap: 9 });
  const benches = mergeScatter(old.benches, now.benches, { gap: 1.5 });
  const bollards = mergeScatter(old.bollards, now.bollards, { gap: 0.5 });
  obstacles.length = structures; // replace the trial placement's footprints with those of what is really built
  for (const o of [...lamps, ...benches]) obstacles.push({ x: o.x, z: o.z, r: o.r });

  // ---- instanced meshes ----
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0), one = new THREE.Vector3(1, 1, 1), v = new THREE.Vector3();
  const instanced = (name, geo, list) => {
    if (!list.length) return;
    const im = new THREE.InstancedMesh(geo, M.furniture, list.length);
    im.name = name; im.userData = { castShadow: true, receiveShadow: true };
    list.forEach((o, i) => { q.setFromAxisAngle(up, o.yaw); im.setMatrixAt(i, m4.compose(v.set(o.x, o.y ?? heightAt(o.x, o.z), o.z), q, one)); });
    group.add(im);
  };
  instanced('Street_Lamps', lampGeometry(), lamps);
  instanced('Benches', benchGeometry(), benches);
  instanced('Bollards', bollardGeometry(), bollards);

  // ---- gate signs: a low monument sign on the left of the road, outside each gate ----
  const face = new THREE.MeshStandardMaterial({ map: signTexture(), roughness: 0.7 }); face.name = 'Sign_Face';
  for (const [key, lx, lz] of [['gateSouth', -9.2, 4.2], ['gateWest', -8.4, 4.4]]) {
    const f = FEATURES[key], rot = f.rot;
    const x = f.pos[0] + lx * Math.cos(rot) + lz * Math.sin(rot), z = f.pos[1] - lx * Math.sin(rot) + lz * Math.cos(rot);
    const sign = new THREE.Group(); sign.name = `Sign_${key === 'gateSouth' ? 'South' : 'West'}`;
    const base = new THREE.Mesh(merge([box(4.5, 0.5, 0.8, 0, 0.25, 0), box(0.5, 1.75, 0.6, -2.0, 1.35, 0), box(0.5, 1.75, 0.6, 2.0, 1.35, 0), box(4.7, 0.14, 0.9, 0, 2.28, 0)]), M.plinth);
    base.name = `${sign.name}_Base`; base.userData = { castShadow: true, receiveShadow: true };
    const board = new THREE.Mesh(box(3.55, 1.3, 0.16, 0, 1.4, 0), M.joinery);
    board.name = `${sign.name}_Board`; board.userData = { castShadow: true, receiveShadow: true };
    sign.add(base, board);
    for (const s of [1, -1]) {
      const p = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 1.06), face);
      p.name = `${sign.name}_Face${s > 0 ? 'A' : 'B'}`; p.userData = { receiveShadow: true };
      p.position.set(0, 1.4, s * 0.085); p.rotation.y = s > 0 ? 0 : Math.PI;
      sign.add(p);
    }
    sign.position.set(x, heightAt(x, z), z);
    sign.rotation.y = rot + 0.35; // angled towards arriving traffic
    group.add(sign);
    obstacles.push({ x, z, r: 3 });
    legacy.obstacles.push({ x, z, r: 3 });
  }
  return { group, counts: { lamps: lamps.length, benches: benches.length, bollards: bollards.length } };
}
