import * as THREE from 'three';
import { FEATURES, PADS, SITE_BOUNDARY, P, toY } from './layout.js';
import { box, hipRoof, merge, prep, deg } from './geom.js';
import { M } from './materials.js';

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

// ---------- building kit ----------
function buildingBlocks(name, blocks) {
  const walls = [], roofs = [], glass = [], plinth = [];
  for (const b of blocks) {
    const { w, d, x, z, wallH, roofH, rot = 0 } = b;
    const wg = new THREE.BoxGeometry(w, wallH + 2, d); wg.translate(0, (wallH - 2) / 2, 0);
    const pg = new THREE.BoxGeometry(w + 0.3, 0.6, d + 0.3); pg.translate(0, 0.1, 0);
    const rg = hipRoof(w, d, roofH, 0.8); rg.translate(0, wallH, 0);
    const parts = [[wg, walls], [pg, plinth], [rg, roofs]];
    // window bands on all four facades
    const bands = [];
    const ww = Math.max(1, w * 0.62), dw = Math.max(1, d * 0.62);
    if (b.windows !== false) {
      for (const s of [-1, 1]) {
        bands.push(new THREE.BoxGeometry(ww, wallH * 0.38, 0.12).translate(0, wallH * 0.5, s * (d / 2 + 0.03)));
        bands.push(new THREE.BoxGeometry(0.12, wallH * 0.38, dw).translate(s * (w / 2 + 0.03), wallH * 0.5, 0));
      }
    }
    for (const g of bands) parts.push([g, glass]);
    for (const [g, list] of parts) { g.rotateY(rot); g.translate(x, 0, z); list.push(prep(g)); }
  }
  const grp = new THREE.Group(); grp.name = name;
  grp.add(mesh(walls, M.wall, `${name}_Walls`), mesh(roofs, M.roof, `${name}_Roof`), mesh(plinth, M.plinth, `${name}_Plinth`));
  if (glass.length) grp.add(mesh(glass, M.glass, `${name}_Glazing`, false));
  return grp;
}

function mainBuilding() {
  const f = FEATURES.mainBuilding;
  const g = buildingBlocks('MainBuilding', [
    { w: 25, d: 15, x: -1, z: 0, wallH: 6, roofH: 4.8 },
    { w: 10, d: 21, x: 14, z: 1, wallH: 6, roofH: 4.4 },
    { w: 10, d: 16, x: -14.5, z: 3, wallH: 5.2, roofH: 4 },
    { w: 8, d: 5, x: 2, z: 9.5, wallH: 4.2, roofH: 2.4, windows: false },
    { w: 13, d: 6, x: -2, z: -9.5, wallH: 4.2, roofH: 2.4 },
  ]);
  place(g, f.pos, padY('courtyard'), f.rot);
  obstacles.push({ x: f.pos[0], z: f.pos[1], hx: 22, hz: 14, rot: f.rot });
  return g;
}

function prayerHall() {
  const f = FEATURES.prayerHall;
  const g = buildingBlocks('PrayerHall', [
    { w: 6, d: 10, x: -4.2, z: 0, wallH: 3.6, roofH: 2.8 },
    { w: 6, d: 10, x: 4.2, z: 0, wallH: 3.6, roofH: 2.8 },
    { w: 3, d: 4, x: 0, z: 0, wallH: 3, roofH: 1.6, windows: false },
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
  const water = new THREE.ShapeGeometry(eyeShape(L, top, bottom), 32);
  water.rotateX(-Math.PI / 2); water.translate(0, 0.46, 0);
  const plinth = new THREE.CylinderGeometry(1.2, 1.4, 0.5, 16); plinth.translate(0, 0.55, 0);
  const sprayA = new THREE.ConeGeometry(1.5, 2.2, 16, 1, true); sprayA.translate(0, 1.9, 0);
  const sprayB = new THREE.CylinderGeometry(0.12, 0.3, 3.2, 8); sprayB.translate(0, 2.2, 0);
  g.add(mesh(deck, M.deck, 'Pool_Deck'));
  g.add(mesh(water, M.water, 'Pool_Water', false));
  g.add(mesh(plinth, M.deck, 'Fountain_Base'));
  g.add(mesh([sprayA, sprayB], M.spray, 'Fountain_Spray', false));
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
function amphitheatre() {
  const f = FEATURES.amphitheatre;
  const g = new THREE.Group(); g.name = 'Amphitheater';
  const seats = [], risers = [];
  const a0 = deg(-8), a1 = Math.PI + deg(8); // tiers wrap the north half (local -Z)
  for (let i = 0; i < f.tiers; i++) {
    const r0 = f.r0 + i * f.tierDepth, r1 = r0 + f.tierDepth;
    const top = (i + 1) * f.tierRise;
    const geo = new THREE.ExtrudeGeometry(sector(r0, r1, a0, a1), { depth: top + 2, bevelEnabled: false, curveSegments: 40 });
    geo.rotateX(-Math.PI / 2); geo.translate(0, -2, 0);
    (i % 2 ? risers : seats).push(geo);
  }
  const outer = f.r0 + f.tiers * f.tierDepth;
  const wall = new THREE.ExtrudeGeometry(sector(outer, outer + 0.5, a0, a1), { depth: f.tiers * f.tierRise + 2.9, bevelEnabled: false, curveSegments: 40 });
  wall.rotateX(-Math.PI / 2); wall.translate(0, -2, 0);
  const orchestra = new THREE.CylinderGeometry(f.r0, f.r0, 0.3, 40); orchestra.translate(0, 0.1, 0);
  const stage = new THREE.ExtrudeGeometry(sector(0, f.r0 + 1.5, Math.PI, Math.PI * 2), { depth: 2.6, bevelEnabled: false, curveSegments: 32 });
  stage.rotateX(-Math.PI / 2); stage.translate(0, -2, 0);
  g.add(mesh(seats, M.tier, 'Amphi_Seats'), mesh(risers, M.stage, 'Amphi_Risers'));
  g.add(mesh(wall, M.plinth, 'Amphi_Wall'), mesh([orchestra, stage], M.stage, 'Amphi_Stage'));
  place(g, f.pos, padY('amphitheatre'), f.rot);
  obstacles.push({ x: f.pos[0], z: f.pos[1], r: outer + 2 });
  return g;
}

// ---------- playground ----------
function playground() {
  const f = FEATURES.playground;
  const g = new THREE.Group(); g.name = 'RecreationZone';
  const surf = new THREE.CylinderGeometry(f.radius, f.radius, 0.3, 48); surf.translate(0, 0.05, 0);
  const rim = new THREE.CylinderGeometry(f.radius + 0.9, f.radius + 0.9, 0.24, 48); rim.translate(0, 0.0, 0);
  g.add(mesh(surf, M.playSurface, 'Play_Surface'), mesh(rim, M.kerb, 'Play_Rim'));
  // slide tower
  g.add(mesh([box(1.6, 2.2, 1.6, -1.8, 1.3, -1)], M.playRed, 'Play_Tower'));
  const slide = new THREE.BoxGeometry(0.9, 0.12, 3.4); slide.rotateX(0.62); slide.translate(-1.8, 1.25, 1.2);
  g.add(mesh([box(1.6, 0.3, 1.2, -1.8, 2.5, -1), slide], M.playBlue, 'Play_Slide'));
  // swing frame
  const legs = [];
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const c = new THREE.CylinderGeometry(0.08, 0.08, 2.9, 6); c.rotateZ(sx * 0.18); c.translate(2.3 + sx * 1.6, 1.4, 1.6 + sz * 0.5); legs.push(c);
  }
  const beam = new THREE.CylinderGeometry(0.08, 0.08, 3.6, 6); beam.rotateZ(Math.PI / 2); beam.translate(2.3, 2.8, 1.6); legs.push(beam);
  g.add(mesh(legs, M.metal, 'Play_SwingFrame'));
  g.add(mesh([box(0.5, 0.06, 0.25, 1.7, 0.7, 1.6), box(0.5, 0.06, 0.25, 2.9, 0.7, 1.6)], M.playGreen, 'Play_Swings'));
  // see-saw + roundabout
  g.add(mesh([box(3.4, 0.12, 0.35, 1.6, 0.55, -3.0, 0.4)], M.playGreen, 'Play_Seesaw'));
  const rnd = new THREE.CylinderGeometry(1.1, 1.1, 0.2, 20); rnd.translate(-1.5, 0.45, 3.2);
  g.add(mesh(rnd, M.playRed, 'Play_Roundabout'));
  place(g, f.pos, padY('playground'), 0);
  obstacles.push({ x: f.pos[0], z: f.pos[1], r: f.radius + 2 });
  return g;
}

// ---------- pergola / gates / shades / plaza ----------
export function pergolaGeometry(length, width, height = 3) {
  const parts = [];
  const nPost = Math.max(2, Math.round(length / 3) + 1);
  for (let i = 0; i < nPost; i++) {
    const x = -length / 2 + (length * i) / (nPost - 1);
    for (const s of [-1, 1]) parts.push(box(0.3, height, 0.3, x, height / 2, s * width / 2));
  }
  for (const s of [-1, 1]) parts.push(box(length + 0.6, 0.3, 0.18, 0, height + 0.05, s * width / 2));
  const nRaf = Math.round(length / 0.55);
  for (let i = 0; i <= nRaf; i++) parts.push(box(0.12, 0.22, width + 0.9, -length / 2 + (length * i) / nRaf, height + 0.3, 0));
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
    const grp = new THREE.Group(); grp.name = `Shade_${i + 1}`;
    grp.add(mesh(post, M.metal, `Shade_${i + 1}_Post`), mesh(roof, M.canvas, `Shade_${i + 1}_Canopy`));
    grp.position.set(s.pos[0], padY('courtyard'), s.pos[1]);
    g.add(grp);
    obstacles.push({ x: s.pos[0], z: s.pos[1], r: 3 });
  });
  return g;
}
function gateWest(heightAt) {
  const f = FEATURES.gateWest;
  const g = new THREE.Group(); g.name = 'EntranceGate_West';
  g.add(mesh(pergolaGeometry(10, 4.2, 3.6), M.timber, 'WestGate_Pergola'));
  g.add(mesh([box(0.9, 2.2, 0.9, -5.6, 0.6, -2.1), box(0.9, 2.2, 0.9, -5.6, 0.6, 2.1), box(0.9, 2.2, 0.9, 5.6, 0.6, -2.1), box(0.9, 2.2, 0.9, 5.6, 0.6, 2.1)], M.plinth, 'WestGate_Piers'));
  place(g, f.pos, heightAt(f.pos[0], f.pos[1]), f.rot);
  obstacles.push({ x: f.pos[0], z: f.pos[1], r: 7 });
  return g;
}
function gateSouth() {
  const f = FEATURES.gateSouth;
  const g = new THREE.Group(); g.name = 'EntranceGate_South';
  const pillars = [box(1.3, 5, 1.3, -5.2, 2, 0), box(1.3, 5, 1.3, 5.2, 2, 0)];
  const caps = [box(1.7, 0.4, 1.7, -5.2, 4.7, 0), box(1.7, 0.4, 1.7, 5.2, 4.7, 0), box(11.8, 0.7, 0.9, 0, 5.1, 0)];
  g.add(mesh(pillars, M.wall, 'SouthGate_Pillars'), mesh(caps, M.timber, 'SouthGate_Lintel'));
  const cabin = buildingBlocks('SecurityCabin', [{ w: 3, d: 3, x: 9, z: -2.5, wallH: 2.8, roofH: 1.4 }]);
  g.add(cabin);
  place(g, f.pos, padY('gate-south'), f.rot);
  obstacles.push({ x: f.pos[0] + 6, z: f.pos[1] - 2, r: 7 });
  return g;
}
function plaza() {
  const f = FEATURES.plaza;
  const disc = new THREE.CylinderGeometry(f.radius, f.radius, 0.6, 40); disc.translate(0, -0.12, 0);
  const ring = new THREE.CylinderGeometry(f.radius + 0.7, f.radius + 0.7, 0.5, 40); ring.translate(0, -0.2, 0);
  const g = new THREE.Group(); g.name = 'Plaza';
  g.add(mesh(disc, M.plaza, 'Plaza_Paving', false), mesh(ring, M.kerb, 'Plaza_Edge', false));
  place(g, f.pos, padY('plaza') * 1 + 0.08, 0);
  obstacles.push({ x: f.pos[0], z: f.pos[1], r: f.radius + 1.5 });
  return g;
}

function boundaryWall(heightAt) {
  const pos = [];
  const n = SITE_BOUNDARY.length;
  for (let i = 0; i < n; i++) {
    const [ax, az] = SITE_BOUNDARY[i], [bx, bz] = SITE_BOUNDARY[(i + 1) % n];
    const len = Math.hypot(bx - ax, bz - az), steps = Math.max(1, Math.ceil(len / 2));
    for (let k = 0; k < steps; k++) {
      const x0 = ax + ((bx - ax) * k) / steps, z0 = az + ((bz - az) * k) / steps;
      const x1 = ax + ((bx - ax) * (k + 1)) / steps, z1 = az + ((bz - az) * (k + 1)) / steps;
      const y0 = heightAt(x0, z0), y1 = heightAt(x1, z1);
      pos.push(x0, y0 - 0.4, z0, x1, y1 - 0.4, z1, x0, y0 + 0.65, z0, x0, y0 + 0.65, z0, x1, y1 - 0.4, z1, x1, y1 + 0.65, z1);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.computeVertexNormals();
  const m = new THREE.Mesh(g, M.fence); m.name = 'PlotBoundary'; m.userData = { receiveShadow: true };
  return m;
}

export function buildStructures(heightAt) {
  const root = new THREE.Group(); root.name = 'Structures';
  root.add(mainBuilding(), prayerHall(), pool(), amphitheatre(), playground(), pergolas(), shades(), gateWest(heightAt), gateSouth(), plaza(), boundaryWall(heightAt));
  root.traverse((o) => { if (o.userData.snapToGround) o.position.y = heightAt(o.position.x, o.position.z); });
  return root;
}

export function isBlocked(x, z, pad = 0) {
  for (const o of obstacles) {
    if (o.r !== undefined) { if (Math.hypot(x - o.x, z - o.z) < o.r + pad) return true; continue; }
    const dx = x - o.x, dz = z - o.z, c = Math.cos(o.rot), s = Math.sin(o.rot);
    const lx = dx * c - dz * s, lz = dx * s + dz * c; // inverse of rotation.y
    if (Math.abs(lx) < o.hx + pad && Math.abs(lz) < o.hz + pad) return true;
  }
  return false;
}
export { P };
