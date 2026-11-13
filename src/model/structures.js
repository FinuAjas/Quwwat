import * as THREE from 'three';
import { FEATURES, PADS, SITE_BOUNDARY, P, toY } from './layout.js';
import { box, hipRoof, merge, prep, deg } from './geom.js';
import { roadQuery } from './terrain.js';
import { building, FLOOR } from './architecture.js';
import { M } from './materials.js';
import { blockedBy } from './legacy.js';

/** Obstacles for vegetation placement: circles {x,z,r} and oriented boxes {x,z,hx,hz,rot}. */
export const obstacles = [];
const padY = (id) => toY(PADS.find((p) => p.id === id).elev);

function mesh(geoms, mat, name, shadow = true) {
  const m = new THREE.Mesh(Array.isArray(geoms) ? merge(geoms) : prep(geoms), mat);
  m.name = name;
  m.userData = { castShadow: shadow, receiveShadow: true };
  return m;
}
function place(group, [x, z], y, rot = 0) { group.position.set(x, y, z); group.rotation.y = rot; return group; }
const cyl = (rTop, rBot, h, x, y, z, sides = 8) => new THREE.CylinderGeometry(rTop, rBot, h, sides).translate(x, y, z);
const UP = new THREE.Vector3(0, 1, 0);
/** Round bar between two points. */
function bar(a, b, r = 0.04, sides = 6) {
  const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b), d = B.clone().sub(A), len = d.length();
  const g = new THREE.CylinderGeometry(r, r, len, sides);
  g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(UP, d.normalize()));
  return g.translate((A.x + B.x) / 2, (A.y + B.y) / 2, (A.z + B.z) / 2);
}

// ---------- buildings (see architecture.js for the kit) ----------
function mainBuilding() {
  const f = FEATURES.mainBuilding;
  // U-shaped hall open to the south: core with a column verandah and an entrance portico, two wings, rear annex.
  const g = building('MainBuilding', [
    { w: 25, d: 15, x: -1, z: 0, wallH: 6, roofH: 4.8,
      faces: { S: { from: -9.5, to: 9, doors: [2] }, N: [{ from: -13.5, to: -8.5 }, { from: 4.5, to: 9 }] },
      verandahs: [{ side: 'S', from: -9.3, to: -2.3 }, { side: 'S', from: 6.3, to: 8.8 }] },
    { w: 10, d: 21, x: 14, z: 1, wallH: 6, roofH: 4.4, faces: { E: {}, S: { doors: [14] }, N: {}, W: { from: 7.6, to: 11.5 } } },
    { w: 10, d: 16, x: -14.5, z: 3, wallH: 5.2, roofH: 4, faces: { W: {}, S: {}, N: { from: -19.5, to: -13.6 }, E: { from: 7.6, to: 11 } } },
    { w: 13, d: 6, x: -2, z: -9.5, wallH: 4.2, roofH: 2.4, faces: { N: { doors: [-2] }, E: { from: -12.5, to: -7.6 }, W: { from: -12.5, to: -7.6 } } },
    { type: 'portico', w: 8, d: 5, x: 2, z: 10, colH: 3.6, roofH: 2.2 },
  ]);
  place(g, f.pos, padY('courtyard'), f.rot);
  obstacles.push({ x: f.pos[0], z: f.pos[1], hx: 22, hz: 14, rot: f.rot });
  return g;
}

function prayerHall() {
  const f = FEATURES.prayerHall;
  const g = building('PrayerHall', [
    { w: 6, d: 10, x: -4.2, z: 0, wallH: 3.6, roofH: 2.8, faces: { W: {}, S: { doors: [-4.2] }, N: {} } },
    { w: 6, d: 10, x: 4.2, z: 0, wallH: 3.6, roofH: 2.8, faces: { E: {}, S: { doors: [4.2] }, N: {} } },
    { w: 3, d: 4, x: 0, z: 0, wallH: 3, roofH: 1.6, faces: { S: {}, N: {} } },
  ]);
  place(g, f.pos, padY('prayer'), f.rot);
  obstacles.push({ x: f.pos[0], z: f.pos[1], r: 9 });
  return g;
}

// ---------- pool ----------
function eyeShape(L, top, bottom) {
  const s = new THREE.Shape();
  s.moveTo(-L / 2, 0); s.quadraticCurveTo(0, top * 2, L / 2, 0); s.quadraticCurveTo(0, -bottom * 2, -L / 2, 0);
  return s;
}
function pool() {
  const f = FEATURES.pool;
  const g = new THREE.Group(); g.name = 'SwimmingPool';
  const L = f.length, top = f.width * 0.6, bottom = f.width * 0.4;
  const deck = new THREE.ExtrudeGeometry(eyeShape(L + 5, top + 2.4, bottom + 2.4), { depth: 2.2, bevelEnabled: false, curveSegments: 24 });
  deck.rotateX(-Math.PI / 2); deck.translate(0, -1.8, 0);
  // raised stone coping round the water (glossier: reads as the wet edge)
  const rim = eyeShape(L + 1.3, top + 0.65, bottom + 0.65);
  rim.holes.push(new THREE.Path(eyeShape(L, top, bottom).getPoints(28)));
  const coping = new THREE.ExtrudeGeometry(rim, { depth: 0.13, bevelEnabled: false, curveSegments: 28 });
  coping.rotateX(-Math.PI / 2); coping.translate(0, 0.4, 0);
  const water = new THREE.ShapeGeometry(eyeShape(L, top, bottom), 32);
  water.rotateX(-Math.PI / 2); water.translate(0, 0.46, 0);
  // two-tier fountain
  const fountain = [cyl(1.45, 1.6, 0.42, 0, 0.6, 0, 20), cyl(1.25, 1.25, 0.06, 0, 0.83, 0, 20), cyl(0.2, 0.3, 1.25, 0, 1.4, 0, 10), cyl(0.85, 0.3, 0.3, 0, 2.1, 0, 16), cyl(0.12, 0.16, 0.5, 0, 2.5, 0, 8)];
  const sprayA = new THREE.ConeGeometry(1.5, 2.2, 16, 1, true); sprayA.translate(0, 3.3, 0);
  const sprayB = new THREE.CylinderGeometry(0.12, 0.3, 3.2, 8); sprayB.translate(0, 3.6, 0);
  // pool ladder (two hoops) and a row of loungers on the north deck
  const steel = [], frames = [], pads = [];
  const edgeZ = (x, off) => (bottom) * (1 - (2 * x / L) ** 2) + off;       // south (pergola) side is +Z
  const lx = L / 2 - 5.5, lz = edgeZ(lx, 0.1);
  for (const s of [-0.28, 0.28]) steel.push(new THREE.TorusGeometry(0.42, 0.03, 6, 12, Math.PI).rotateY(Math.PI / 2).translate(lx + s, 0.5, lz));
  for (let i = 0; i < 5; i++) {                                               // loungers lie along the deck, heads to the west
    const x = -L * 0.26 + i * (L * 0.52 / 4), z = -(top * (1 - (2 * x / L) ** 2)) - 1.5; // north side is -Z
    frames.push(box(1.95, 0.07, 0.68, x, 0.66, z));
    for (const sx of [-0.85, 0.85]) for (const sz of [-0.28, 0.28]) frames.push(box(0.06, 0.26, 0.06, x + sx, 0.53, z + sz));
    pads.push(box(1.3, 0.07, 0.6, x + 0.3, 0.73, z));
    pads.push(prep(new THREE.BoxGeometry(0.7, 0.07, 0.6).rotateZ(-0.6).translate(x - 0.62, 0.92, z)));
  }
  g.add(mesh(deck, M.deck, 'Pool_Deck'), mesh(coping, M.coping, 'Pool_Coping'));
  const w = mesh(water, M.water, 'Pool_Water', false);
  w.userData.poolShape = [L, top, bottom]; // lets the water shader shade the shallows and the tiled floor
  g.add(w);
  g.add(mesh(fountain, M.plinth, 'Fountain_Base'), mesh([sprayA, sprayB], M.spray, 'Fountain_Spray', false));
  g.add(mesh(steel, M.metal, 'Pool_Ladder'), mesh(frames, M.joinery, 'Pool_Loungers'), mesh(pads, M.trim, 'Pool_Lounger_Pads'));
  place(g, f.pos, padY('courtyard') + 0.05, f.rot);
  obstacles.push({ x: f.pos[0], z: f.pos[1], hx: L / 2 + 4, hz: f.width / 2 + 4, rot: f.rot });
  return g;
}

// ---------- amphitheatre ----------
function sector(r0, r1, a0, a1) {
  const s = new THREE.Shape();
  s.absarc(0, 0, r1, a0, a1, false); s.absarc(0, 0, r0, a1, a0, true);
  return s;
}
const flat = (shape, depth, y, seg = 40) => new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false, curveSegments: seg }).rotateX(-Math.PI / 2).translate(0, y, 0);
/**
 * Amphitheatre (Plan 3): a half-ring of tiers on the NW side of the parking drive. Its straight, open side lies on
 * the drive's kerb and faces the drive; the stage is the half-disc inside the tiers. Local frame: angle 0 = +X,
 * 90 deg = -Z (the middle of the seats); the seats cover f.arc, the stage the whole half-disc.
 */
function amphitheatre() {
  const f = FEATURES.amphitheatre;
  const g = new THREE.Group(); g.name = 'Amphitheater';
  const seats = [], risers = [], nosings = [], steps = [];
  const a0 = deg(f.arc[0]), a1 = deg(f.arc[1]);
  const aisles = [45, 90, 135].map(deg);
  for (let i = 0; i < f.tiers; i++) {
    const r0 = f.r0 + i * f.tierDepth, r1 = r0 + f.tierDepth;
    const top = (i + 1) * f.tierRise;
    (i % 2 ? risers : seats).push(flat(sector(r0, r1, a0, a1), top + 2, -2));
    nosings.push(flat(sector(r0 - 0.04, r0 + 0.13, a0, a1), 0.045, top));            // darker edge strip on each step
    for (const phi of aisles) {                                                      // half-height steps up the aisles
      const r = r0 - f.tierDepth * 0.25;
      steps.push(new THREE.BoxGeometry(1.0, f.tierRise / 2, f.tierDepth * 0.5).translate(0, i * f.tierRise + f.tierRise / 4, -r).rotateY(phi - Math.PI / 2));
    }
  }
  const rim = f.r0 + f.tiers * f.tierDepth, outer = rim + f.walkway, top = f.tiers * f.tierRise;
  const walk = flat(sector(rim, outer, a0, a1), top + 2, -2);                         // upper walkway, level with the top tier
  const wall = flat(sector(outer, outer + 0.5, a0, a1), top + 2.9, -2);
  const cope = flat(sector(outer - 0.06, outer + 0.58, a0, a1), 0.1, top + 0.9);
  const stage = flat(sector(0, f.r0, 0, Math.PI), 2.25, -2, 32);                      // top at +0.25
  // open timber backdrop along the stage's straight edge (posts + two beams): frames the stage without hiding it
  const frame = [], W = f.r0 - 0.7;
  for (let i = 0; i < 5; i++) frame.push(box(0.24, 3.3, 0.24, -W + (2 * W * i) / 4, 0.25 + 1.65, -0.3));
  frame.push(box(2 * W + 0.6, 0.24, 0.34, 0, 3.55 + 0.12, -0.3), box(2 * W + 0.3, 0.14, 0.16, 0, 2.9, -0.3));
  g.add(mesh([...seats, walk], M.tier, 'Amphi_Seats'), mesh(risers, M.stage, 'Amphi_Risers'), mesh([...nosings, ...steps], M.plinth, 'Amphi_Steps'));
  g.add(mesh([wall, cope], M.plinth, 'Amphi_Wall'), mesh([stage], M.stage, 'Amphi_Stage'), mesh(frame, M.timber, 'Amphi_Backdrop'));
  place(g, f.pos, padY('amphitheatre'), f.rot);
  // footprint: the half-disc only, as a box on the seats' side, so the drive beside it is not blocked (plan3: see legacy.js)
  const R = outer + 2, c = Math.cos(f.rot), sn = Math.sin(f.rot);
  obstacles.push({ x: f.pos[0] - sn * R / 2, z: f.pos[1] - c * R / 2, hx: R, hz: R / 2, rot: f.rot, plan3: 'amphitheatre' });
  return g;
}

// ---------- playground ----------
function playground() {
  const f = FEATURES.playground;
  const g = new THREE.Group(); g.name = 'RecreationZone';
  const surf = new THREE.CylinderGeometry(f.radius, f.radius, 0.3, 48); surf.translate(0, 0.05, 0);
  const rim = new THREE.CylinderGeometry(f.radius + 0.9, f.radius + 0.9, 0.24, 48); rim.translate(0, 0.0, 0);
  g.add(mesh(surf, M.playSurface, 'Play_Surface'), mesh(rim, M.kerb, 'Play_Rim'));
  const G = 0.2; // top of the play surface
  const red = [], blue = [], green = [], yellow = [], steel = [];

  // play tower: four posts, deck, guard rails, pyramid roof, ladder, slide with side rails
  const tx = -2.2, tz = -1.2, deckY = G + 1.5;
  for (const sx of [-0.75, 0.75]) for (const sz of [-0.75, 0.75]) blue.push(cyl(0.07, 0.07, 3.0, tx + sx, G + 1.5, tz + sz));
  yellow.push(box(1.7, 0.1, 1.7, tx, deckY, tz));
  for (const s of [-1, 1]) red.push(box(0.05, 0.5, 1.5, tx + s * 0.78, deckY + 0.5, tz)); // guard panels on the two open sides
  red.push(new THREE.ConeGeometry(1.45, 0.9, 4).rotateY(Math.PI / 4).translate(tx, G + 3.45, tz));
  for (const s of [-0.28, 0.28]) steel.push(bar([tx + s, G, tz - 1.35], [tx + s, deckY, tz - 0.8]));
  for (let i = 1; i < 6; i++) steel.push(bar([tx - 0.28, G + i * 0.25, tz - 1.35 + i * 0.092], [tx + 0.28, G + i * 0.25, tz - 1.35 + i * 0.092], 0.025));
  const chuteLen = Math.hypot(2.9, 1.45), chuteRot = Math.atan2(1.45, 2.9);
  blue.push(prep(new THREE.BoxGeometry(0.72, 0.06, chuteLen).rotateX(chuteRot).translate(tx, G + 0.78, tz + 0.8 + 1.45)));
  for (const s of [-1, 1]) blue.push(prep(new THREE.BoxGeometry(0.05, 0.22, chuteLen).rotateX(chuteRot).translate(tx + s * 0.38, G + 0.88, tz + 0.8 + 1.45)));
  blue.push(box(0.72, 0.06, 0.6, tx, G + 0.08, tz + 0.8 + 3.1));

  // swing set: A-frames, top beam, chains and seats
  const sx0 = 2.5, sz0 = 1.9;
  for (const e of [-1.7, 1.7]) for (const s of [-1, 1]) steel.push(bar([sx0 + e, G + 2.5, sz0], [sx0 + e, G, sz0 + s * 0.95], 0.05));
  steel.push(bar([sx0 - 1.8, G + 2.5, sz0], [sx0 + 1.8, G + 2.5, sz0], 0.055));
  for (const c of [-0.8, 0.8]) {
    for (const s of [-0.22, 0.22]) steel.push(bar([sx0 + c + s, G + 2.5, sz0], [sx0 + c + s, G + 0.55, sz0 + 0.18], 0.012, 4));
    green.push(box(0.52, 0.05, 0.2, sx0 + c, G + 0.53, sz0 + 0.18));
  }

  // see-saw: beam on a pivot with handles
  const wx = 1.9, wz = -2.9, wr = 0.45;
  steel.push(cyl(0.07, 0.1, 0.5, wx, G + 0.25, wz));
  green.push(prep(new THREE.BoxGeometry(3.2, 0.09, 0.26).rotateZ(0.16).rotateY(wr).translate(wx, G + 0.52, wz)));
  for (const s of [-1, 1]) {
    const hx = wx + Math.cos(wr) * s * 1.25, hz = wz - Math.sin(wr) * s * 1.25, hy = G + 0.52 + s * 0.2;
    yellow.push(box(0.36, 0.06, 0.3, hx + Math.cos(wr) * s * 0.2, hy + 0.06, hz - Math.sin(wr) * s * 0.2, wr));
    steel.push(bar([hx, hy, hz - 0.12], [hx, hy + 0.3, hz - 0.12], 0.02), bar([hx, hy, hz + 0.12], [hx, hy + 0.3, hz + 0.12], 0.02), bar([hx, hy + 0.3, hz - 0.12], [hx, hy + 0.3, hz + 0.12], 0.02));
  }

  // roundabout: deck, hub and four hoop handles
  const rx = -1.2, rz = 3.5;
  red.push(cyl(1.15, 1.15, 0.1, rx, G + 0.28, rz, 24));
  steel.push(cyl(0.07, 0.07, 0.95, rx, G + 0.6, rz));
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + 0.4, px = rx + Math.cos(a) * 0.95, pz = rz + Math.sin(a) * 0.95;
    steel.push(bar([px, G + 0.33, pz], [px, G + 0.95, pz], 0.022), bar([px, G + 0.95, pz], [rx, G + 1.02, rz], 0.022));
  }

  // two spring riders
  for (const [qx, qz, mat] of [[3.9, -0.4, yellow], [-4.3, 1.6, green]]) {
    steel.push(cyl(0.09, 0.09, 0.4, qx, G + 0.2, qz, 6));
    mat.push(box(0.26, 0.42, 0.8, qx, G + 0.6, qz, 0.5));
    steel.push(bar([qx - 0.22, G + 0.78, qz], [qx + 0.22, G + 0.78, qz], 0.02));
  }
  g.add(mesh(red, M.playRed, 'Play_Red'), mesh(blue, M.playBlue, 'Play_Blue'), mesh(green, M.playGreen, 'Play_Green'));
  g.add(mesh(yellow, M.playYellow, 'Play_Yellow'), mesh(steel, M.metal, 'Play_Steel'));
  place(g, f.pos, padY('playground'), 0);
  obstacles.push({ x: f.pos[0], z: f.pos[1], r: f.radius + 2 });
  return g;
}

// ---------- pergola / gates / shades / turning head ----------
export function pergolaGeometry(length, width, height = 3) {
  const parts = [];
  const nPost = Math.max(2, Math.round(length / 3) + 1);
  for (let i = 0; i < nPost; i++) {
    const x = -length / 2 + (length * i) / (nPost - 1);
    for (const s of [-1, 1]) {
      parts.push(box(0.3, height, 0.3, x, height / 2, s * width / 2));
      parts.push(box(0.46, 0.35, 0.46, x, 0.175, s * width / 2));                           // post footing
    }
  }
  for (const s of [-1, 1]) parts.push(box(length + 0.9, 0.3, 0.18, 0, height + 0.05, s * width / 2));
  const nRaf = Math.round(length / 0.55);
  for (let i = 0; i <= nRaf; i++) parts.push(box(0.12, 0.22, width + 1.1, -length / 2 + (length * i) / nRaf, height + 0.3, 0));
  for (const s of [-0.5, 0, 0.5]) parts.push(box(length + 0.5, 0.06, 0.1, 0, height + 0.44, s * width * 0.55));   // battens over the rafters
  return merge(parts);
}
function pergolas() {
  const g = new THREE.Group(); g.name = 'Pergolas';
  FEATURES.pergolas.forEach((p, i) => {
    const m = mesh(pergolaGeometry(p.length, p.width), M.timber, `Pergola_${i + 1}`);
    m.position.set(p.pos[0], 0, p.pos[1]); m.rotation.y = p.rot;
    m.userData.snapToGround = true;
    g.add(m);
    obstacles.push({ x: p.pos[0], z: p.pos[1], hx: p.length / 2 + 0.5, hz: p.width / 2 + 0.5, rot: p.rot });
  });
  return g;
}
function shades() {
  const g = new THREE.Group(); g.name = 'Shades';
  FEATURES.shades.forEach((s, i) => {
    const post = new THREE.CylinderGeometry(0.1, 0.1, 2.6, 6); post.translate(0, 1.3, 0);
    const roof = new THREE.ConeGeometry(2.6, 1.0, 4, 1, true); roof.rotateY(Math.PI / 4); roof.translate(0, 3.0, 0);
    const table = [cyl(0.55, 0.55, 0.05, 0, 0.74, 0, 14), cyl(0.3, 0.3, 0.04, 0, 0.02, 0, 10)];
    for (let k = 0; k < 4; k++) { const a = k * Math.PI / 2 + Math.PI / 4; table.push(box(0.42, 0.45, 0.42, Math.cos(a) * 1.05, 0.225, Math.sin(a) * 1.05, -a)); }
    const grp = new THREE.Group(); grp.name = `Shade_${i + 1}`;
    grp.add(mesh(post, M.metal, `Shade_${i + 1}_Post`), mesh(roof, M.canvas, `Shade_${i + 1}_Canopy`), mesh(table, M.joinery, `Shade_${i + 1}_Seating`));
    grp.position.set(s.pos[0], padY('courtyard'), s.pos[1]);
    g.add(grp);
    obstacles.push({ x: s.pos[0], z: s.pos[1], r: 3 });
  });
  return g;
}

/** One open gate leaf (hinge at x = 0, extends along +X): frame with upright bars. */
function gateLeaf(width, height) {
  const parts = [box(width, 0.08, 0.06, width / 2, 0.25, 0), box(width, 0.08, 0.06, width / 2, height, 0), box(0.08, height, 0.06, 0.04, height / 2 + 0.1, 0), box(0.08, height, 0.06, width - 0.04, height / 2 + 0.1, 0)];
  const n = Math.round(width / 0.22);
  for (let i = 1; i < n; i++) parts.push(box(0.03, height - 0.25, 0.03, (width * i) / n, height / 2 + 0.12, 0));
  return parts;
}
const swing = (parts, x, z, yaw) => parts.map((p) => p.rotateY(yaw).translate(x, 0, z));

function gateWest(heightAt) {
  const f = FEATURES.gateWest;
  const g = new THREE.Group(); g.name = 'EntranceGate_West';
  g.add(mesh(pergolaGeometry(10, 4.2, 3.6), M.timber, 'WestGate_Pergola'));
  const piers = [];
  for (const sx of [-5.6, 5.6]) for (const sz of [-2.1, 2.1]) piers.push(box(0.9, 2.2, 0.9, sx, 0.6, sz), box(1.1, 0.16, 1.1, sx, 1.78, sz));
  g.add(mesh(piers, M.plinth, 'WestGate_Piers'));
  g.add(mesh([...swing(gateLeaf(3.3, 1.9), -4.4, 2.1, -1.35), ...swing(gateLeaf(3.3, 1.9), 4.4, 2.1, Math.PI + 1.35)], M.gateIron, 'WestGate_Leaves'));
  place(g, f.pos, heightAt(f.pos[0], f.pos[1]), f.rot);
  obstacles.push({ x: f.pos[0], z: f.pos[1], r: 7 });
  return g;
}
function gateSouth() {
  const f = FEATURES.gateSouth;
  const g = new THREE.Group(); g.name = 'EntranceGate_South';
  // gatehouse in the padippura manner: two stout piers carrying a small tiled hip roof over the road
  const piers = [], trim = [];
  for (const s of [-1, 1]) {
    piers.push(box(1.4, 5.2, 1.6, s * 5.3, 2.1, 0));
    trim.push(box(1.7, 0.3, 1.9, s * 5.3, 0.4, 0), box(1.64, 0.22, 1.84, s * 5.3, 4.5, 0));
  }
  const beams = [box(12.4, 0.36, 0.3, 0, 4.85, -0.6), box(12.4, 0.36, 0.3, 0, 4.85, 0.6)];
  for (let i = 0; i <= 12; i++) beams.push(box(0.16, 0.2, 2.6, -6 + i, 5.1, 0));
  const roof = hipRoof(12.6, 2.4, 1.7, 0.7).translate(0, 5.2, 0);
  const caps = [bar([-5.6, 6.94, 0], [5.6, 6.94, 0], 0.14)];
  for (const s of [-1, 1]) for (const t of [-1, 1]) caps.push(bar([s * 5.6, 6.92, 0], [s * 7.0, 5.25, t * 1.9], 0.11));
  for (const s of [-1, 1]) caps.push(new THREE.SphereGeometry(0.17, 8, 6).translate(s * 5.6, 7.05, 0), new THREE.ConeGeometry(0.09, 0.5, 8).translate(s * 5.6, 7.4, 0));
  g.add(mesh(piers, M.wall, 'SouthGate_Pillars'), mesh(trim, M.trim, 'SouthGate_Trim'), mesh(beams, M.joinery, 'SouthGate_Lintel'));
  g.add(mesh(roof, M.roof, 'SouthGate_Roof'), mesh(caps, M.roof, 'SouthGate_Ridge'));
  g.add(mesh([...swing(gateLeaf(4.2, 2.3), -4.55, 0.6, -1.4), ...swing(gateLeaf(4.2, 2.3), 4.55, 0.6, Math.PI + 1.4)], M.gateIron, 'SouthGate_Leaves'));
  const cabin = building('SecurityCabin', [{ w: 3.4, d: 3.4, x: 9.4, z: -2.6, wallH: 2.9, roofH: 1.4, faces: { W: { doors: [-2.6] }, S: {}, N: {}, E: {} } }]);
  g.add(cabin);
  // lift-arm barrier beside the cabin
  const barrier = [box(0.3, 1.1, 0.3, 4.2, 0.55, -2.4), prep(new THREE.BoxGeometry(4.6, 0.1, 0.1).rotateZ(1.25).translate(3.5, 3.1, -2.4))];
  g.add(mesh(barrier, M.playRed, 'SouthGate_Barrier'));
  place(g, f.pos, padY('gate-south'), f.rot);
  obstacles.push({ x: f.pos[0] + 6, z: f.pos[1] - 2, r: 7 });
  return g;
}
/**
 * Turning head: the paved bulb where the parking drive and the access road meet. An asphalt disc just under
 * the road surfaces (they run a little way onto it), with a kerb round it that opens where the roads enter.
 */
function turningHead() {
  const f = FEATURES.turningHead, [cx, cz] = f.pos, R = f.radius;
  const g = new THREE.Group(); g.name = 'TurningHead';
  const disc = new THREE.CylinderGeometry(R, R, 0.6, 56); disc.translate(0, -0.2, 0); // top at +0.10: under the roads (+0.12)
  const kerb = [], N = 96;
  for (let i = 0; i < N; i++) {
    const a0 = (i / N) * Math.PI * 2, a1 = ((i + 1) / N) * Math.PI * 2, am = (a0 + a1) / 2;
    const q = roadQuery(cx + Math.cos(am) * (R + 0.35), cz - Math.sin(am) * (R + 0.35));
    if (q && q.road.surface !== 'path' && q.d < q.extent + 0.9) continue;         // a road comes in here: leave the kerb open
    kerb.push(flat(sector(R - 0.05, R + 0.7, a0, a1), 0.5, -0.34, 2));               // top at +0.16, like the road kerbs
  }
  g.add(mesh(disc, M.asphalt, 'TurningHead_Surface', false));
  if (kerb.length) g.add(mesh(kerb, M.kerb, 'TurningHead_Kerb', false));
  place(g, f.pos, padY('turning-head'), 0);
  obstacles.push({ x: cx, z: cz, r: R + 1.5, plan3: 'turning-head' });
  return g;
}

/**
 * Compound wall round the plot: a plastered wall with a coping that follows the ground, piers every few
 * metres, and gaps wherever a road crosses the boundary (the gates stand there).
 */
function boundaryWall(heightAt) {
  const H = 1.45, T = 0.13, STEP = 2;
  const pos = [], piers = [];
  const quad = (a, b, c, d) => pos.push(...a, ...b, ...c, ...c, ...b, ...d);
  const n = SITE_BOUNDARY.length;
  for (let i = 0; i < n; i++) {
    const [ax, az] = SITE_BOUNDARY[i], [bx, bz] = SITE_BOUNDARY[(i + 1) % n];
    const len = Math.hypot(bx - ax, bz - az), steps = Math.max(1, Math.round(len / STEP));
    const nx = -(bz - az) / len * T, nz = (bx - ax) / len * T;
    let open = true; // previous step was a gap (or the corner): start with a pier
    for (let k = 0; k < steps; k++) {
      const x0 = ax + ((bx - ax) * k) / steps, z0 = az + ((bz - az) * k) / steps;
      const x1 = ax + ((bx - ax) * (k + 1)) / steps, z1 = az + ((bz - az) * (k + 1)) / steps;
      const q = roadQuery((x0 + x1) / 2, (z0 + z1) / 2);
      if (q && q.road.surface !== 'path' && q.d < q.extent + 1.6) { if (!open) piers.push([x0, z0]); open = true; continue; }
      if (open || k % 3 === 0) piers.push([x0, z0]);
      open = false;
      const y0 = heightAt(x0, z0), y1 = heightAt(x1, z1);
      const b0 = y0 - 0.5, b1 = y1 - 0.5, t0 = y0 + H, t1 = y1 + H;
      quad([x0 + nx, b0, z0 + nz], [x1 + nx, b1, z1 + nz], [x0 + nx, t0, z0 + nz], [x1 + nx, t1, z1 + nz]);   // one face
      quad([x1 - nx, b1, z1 - nz], [x0 - nx, b0, z0 - nz], [x1 - nx, t1, z1 - nz], [x0 - nx, t0, z0 - nz]);   // the other
      const c = 1.6;                                                                                         // coping, slightly wider
      quad([x0 + nx * c, t0, z0 + nz * c], [x1 + nx * c, t1, z1 + nz * c], [x0 - nx * c, t0, z0 - nz * c], [x1 - nx * c, t1, z1 - nz * c]);
    }
    piers.push([bx, bz]);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.computeVertexNormals();
  const wall = new THREE.Mesh(g, M.fence); wall.name = 'PlotBoundary'; wall.userData = { castShadow: true, receiveShadow: true };

  const pierGeo = merge([box(0.46, H + 0.75, 0.46, 0, (H + 0.75) / 2 - 0.5, 0), box(0.6, 0.12, 0.6, 0, H + 0.31, 0), prep(new THREE.ConeGeometry(0.34, 0.26, 4).rotateY(Math.PI / 4).translate(0, H + 0.5, 0))]);
  const im = new THREE.InstancedMesh(pierGeo, M.fence, piers.length);
  im.name = 'PlotBoundary_Piers'; im.userData = { castShadow: true, receiveShadow: true };
  const m4 = new THREE.Matrix4();
  piers.forEach(([x, z], i) => im.setMatrixAt(i, m4.makeTranslation(x, heightAt(x, z), z)));
  const grp = new THREE.Group(); grp.name = 'Boundary';
  grp.add(wall, im);
  return grp;
}

export function buildStructures(heightAt) {
  const root = new THREE.Group(); root.name = 'Structures';
  root.add(mainBuilding(), prayerHall(), pool(), amphitheatre(), playground(), pergolas(), shades(), gateWest(heightAt), gateSouth(), turningHead(), boundaryWall(heightAt));
  root.traverse((o) => { if (o.userData.snapToGround) o.position.y = heightAt(o.position.x, o.position.z); });
  return root;
}

export const isBlocked = blockedBy(obstacles);
export { P, FLOOR };
