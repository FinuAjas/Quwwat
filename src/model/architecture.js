import * as THREE from 'three';
import { box, hipRoof, merge, prep } from './geom.js';
import { M } from './materials.js';

/**
 * Building kit in the local Kerala idiom: plastered walls on a stone plinth, tiled hip roofs with deep
 * eaves, timber fascia boards, ridge and hip caps with finials, timber-framed windows with stone sills,
 * panelled doors with steps, and column verandahs under lean-to tile roofs.
 *
 * A building is a list of blocks in building-local metres (+X east, +Z south, Y up, floor at y = FLOOR):
 *   { w, d, x, z, wallH, roofH, faces: { S|N|E|W: opts | [opts] }, verandahs: [{ side, from, to }] }
 *   { type: 'portico', w, d, x, z, colH, roofH }                      — open, columns only
 * Face opts: { from, to } limit windows to a stretch of the wall (building-local X for N/S faces, Z for E/W) —
 * use them where another block covers part of the wall; { doors: [position, …] } puts a door there.
 */
export const FLOOR = 0.35;      // finished floor / plinth top above the pad
const EAVE = 1.05;              // roof overhang

const UP = new THREE.Vector3(0, 1, 0);
function tube(a, b, r, sides = 6) {
  const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b), d = B.clone().sub(A), len = d.length();
  const g = new THREE.CylinderGeometry(r, r, len, sides);
  g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(UP, d.normalize()));
  g.translate((A.x + B.x) / 2, (A.y + B.y) / 2, (A.z + B.z) / 2);
  return g;
}

// ---- units are built in a "face frame": X along the wall, Y up, Z out of the wall, origin on the wall line ----
function windowUnit(w, h) {
  const t = 0.09, dp = 0.16, zc = 0.05;
  return {
    joinery: [
      box(t, h, dp, -w / 2 + t / 2, h / 2, zc), box(t, h, dp, w / 2 - t / 2, h / 2, zc),
      box(w, t, dp, 0, h - t / 2, zc), box(w, t, dp, 0, t / 2, zc),
      box(0.05, h - 2 * t, 0.07, 0, h / 2, zc), box(w - 2 * t, 0.05, 0.07, 0, h * 0.64, zc),
    ],
    glass: [box(w - 2 * t, h - 2 * t, 0.04, 0, h / 2, 0.03)],
    trim: [box(w + 0.3, 0.09, 0.26, 0, -0.045, 0.11), box(w + 0.24, 0.14, 0.09, 0, h + 0.07, 0.035)],
  };
}
function doorUnit(w, h) {
  const t = 0.12, zc = 0.06, iw = w - 2 * t, ih = h - t;
  return {
    joinery: [
      box(t, h, 0.2, -w / 2 + t / 2, h / 2, zc), box(t, h, 0.2, w / 2 - t / 2, h / 2, zc), box(w, t, 0.2, 0, h - t / 2, zc),
      box(iw, ih * 0.44, 0.07, 0, ih * 0.22, 0.04),                       // panelled lower half
      box(0.07, ih, 0.08, 0, ih / 2, 0.045), box(iw, 0.07, 0.08, 0, ih * 0.44, 0.045), // meeting stile + rail
    ],
    glass: [box(iw, ih * 0.56, 0.04, 0, ih * 0.72, 0.03)],
    trim: [box(w + 0.3, 0.16, 0.1, 0, h + 0.08, 0.04)],
    plinth: [box(w + 1.5, 0.18, 1.0, 0, -0.09, 0.5), box(w + 2.1, 0.17, 1.5, 0, -0.265, 0.75)], // two steps down to the ground
  };
}

const ROT = { S: 0, N: Math.PI, E: Math.PI / 2, W: -Math.PI / 2 };
/** Move a face-frame geometry onto a wall of block b at position `a` along it and height y. */
function toFace(g, b, side, a, y = 0) {
  g.rotateY(ROT[side]);
  if (side === 'S') g.translate(a, y, b.z + b.d / 2);
  else if (side === 'N') g.translate(a, y, b.z - b.d / 2);
  else if (side === 'E') g.translate(b.x + b.w / 2, y, a);
  else g.translate(b.x - b.w / 2, y, a);
  return prep(g);
}
function addUnit(parts, unit, b, side, a, y) {
  for (const [key, list] of Object.entries(unit)) for (const g of list) parts[key].push(toFace(g, b, side, a, y));
}

function facade(parts, b, side, o) {
  const horiz = side === 'S' || side === 'N';
  const c = horiz ? b.x : b.z, half = (horiz ? b.w : b.d) / 2;
  const from = Math.max(o.from ?? -Infinity, c - half) + 0.85, to = Math.min(o.to ?? Infinity, c + half) - 0.85;
  const span = to - from;
  if (span < 1.3) return;
  const tall = b.wallH >= 5;
  const winW = Math.min(o.winW ?? 1.3, span - 0.2), winH = o.winH ?? Math.min(2.2, b.wallH * 0.42), sill = FLOOR + (o.sill ?? 0.8);
  const doorW = tall ? 2.2 : 1.15, doorH = Math.min(2.7, b.wallH - 0.75);
  const doors = (o.doors ?? []).filter((d) => d > from - 0.5 && d < to + 0.5);
  for (const d of doors) addUnit(parts, doorUnit(doorW, doorH), b, side, d, FLOOR);
  const n = Math.max(1, Math.floor(span / (o.spacing ?? 2.9))), step = span / n;
  for (let i = 0; i < n; i++) {
    const a = from + step * (i + 0.5);
    const atDoor = doors.some((d) => Math.abs(d - a) < (doorW + winW) / 2 + 0.35);
    if (!atDoor) addUnit(parts, windowUnit(winW, winH), b, side, a, sill);
    // high-level lights on the tall halls (also above the doors)
    if (tall && o.clerestory !== false) addUnit(parts, windowUnit(winW, 0.75), b, side, a, b.wallH - 1.55);
  }
}

function verandah(parts, b, v) {
  const { side, from, to, depth = 2.4, colH = 3.05 } = v;
  const len = to - from, a = (from + to) / 2;
  const put = (key, g) => parts[key].push(toFace(g, b, side, a, 0));
  put('plinth', box(len, 0.55, depth + 0.35, 0, FLOOR - 0.275, depth / 2 + 0.175));       // floor slab
  put('plinth', box(len + 0.5, 0.18, 0.55, 0, 0.0, depth + 0.55));                        // step along the front
  const n = Math.max(2, Math.round(len / 3) + 1);
  for (let i = 0; i < n; i++) {
    const x = -len / 2 + 0.3 + ((len - 0.6) * i) / (n - 1);
    const shaft = new THREE.CylinderGeometry(0.15, 0.17, colH - FLOOR - 0.4, 10); shaft.translate(x, (colH + FLOOR) / 2 - 0.02, depth);
    put('trim', shaft);
    put('trim', box(0.46, 0.24, 0.46, x, FLOOR + 0.12, depth));
    put('trim', box(0.44, 0.18, 0.44, x, colH - 0.09, depth));
  }
  put('joinery', box(len + 0.2, 0.26, 0.24, 0, colH + 0.13, depth));                       // timber beam on the columns
  const run = depth + 0.8, rise = 1.15, slope = Math.hypot(run, rise);
  const roof = new THREE.BoxGeometry(len + 0.7, 0.1, slope); roof.rotateX(Math.atan2(rise, run)); roof.translate(0, colH + 0.26 + rise / 2, run / 2);
  put('roof', roof);                                                                      // lean-to tile roof
  put('joinery', box(len + 0.7, 0.16, 0.05, 0, colH + 0.22, run + 0.02));                  // fascia board
}

function roofTrim(parts, b, y, overhang) {
  const W = b.w + 2 * overhang, D = b.d + 2 * overhang, hw = W / 2, hd = D / 2, h = b.roofH;
  const at = (g) => { g.translate(b.x, y, b.z); return prep(g); };
  // fascia boards round the eaves and a light soffit under them
  for (const s of [-1, 1]) {
    parts.joinery.push(at(new THREE.BoxGeometry(W + 0.06, 0.2, 0.06).translate(0, 0.03, s * hd)));
    parts.joinery.push(at(new THREE.BoxGeometry(0.06, 0.2, D + 0.06).translate(s * hw, 0.03, 0)));
  }
  parts.trim.push(at(new THREE.BoxGeometry(W - 0.1, 0.05, D - 0.1).translate(0, -0.05, 0)));
  // ridge + hip caps, finials at the ridge ends
  const alongX = W >= D, r = Math.abs(hw - hd);
  const ends = alongX ? [[-r, h, 0], [r, h, 0]] : [[0, h, -r], [0, h, r]];
  if (r > 0.05) parts.ridge.push(at(tube([ends[0][0], h + 0.04, ends[0][2]], [ends[1][0], h + 0.04, ends[1][2]], 0.14)));
  ends.forEach((e, k) => {
    const sign = k ? 1 : -1;
    for (const s of [-1, 1]) {
      const corner = alongX ? [sign * hw, 0, s * hd] : [s * hw, 0, sign * hd];
      parts.ridge.push(at(tube([e[0], h + 0.03, e[2]], [corner[0], 0.05, corner[2]], 0.11)));
    }
    if (r > 0.05 || k === 0) {
      parts.ridge.push(at(new THREE.SphereGeometry(0.17, 8, 6).translate(e[0], h + 0.14, e[2])));
      parts.ridge.push(at(new THREE.ConeGeometry(0.09, 0.5, 8).translate(e[0], h + 0.5, e[2])));
    }
  });
}

function wallBlock(parts, b) {
  const at = (g) => { g.translate(b.x, 0, b.z); return prep(g); };
  parts.walls.push(at(new THREE.BoxGeometry(b.w, b.wallH + 2, b.d).translate(0, (b.wallH - 2) / 2, 0)));
  parts.plinth.push(at(new THREE.BoxGeometry(b.w + 0.3, 0.75, b.d + 0.3).translate(0, FLOOR - 0.375, 0)));
  parts.trim.push(at(new THREE.BoxGeometry(b.w + 0.14, 0.24, b.d + 0.14).translate(0, b.wallH - 0.3, 0))); // cornice band
  parts.roof.push(at(hipRoof(b.w, b.d, b.roofH, EAVE).translate(0, b.wallH, 0)));
  roofTrim(parts, b, b.wallH, EAVE);
  for (const [side, spec] of Object.entries(b.faces ?? {})) for (const o of [].concat(spec)) facade(parts, b, side, o);
  for (const v of b.verandahs ?? []) verandah(parts, b, v);
}

function portico(parts, b) {
  const { w, d, colH } = b, at = (g) => { g.translate(b.x, 0, b.z); return prep(g); };
  parts.plinth.push(at(new THREE.BoxGeometry(w + 0.4, 0.55, d + 0.4).translate(0, FLOOR - 0.275, 0)));
  parts.plinth.push(at(new THREE.BoxGeometry(w - 1, 0.18, 1.1).translate(0, 0, d / 2 + 0.6)));           // entrance step
  const xs = [-w / 2 + 0.35, -w / 6, w / 6, w / 2 - 0.35];
  for (const x of xs) for (const z of [d / 2 - 0.35, -d / 2 + 1.2]) {
    if (z < 0 && Math.abs(x) < w / 3) continue; // keep the doorway clear
    parts.trim.push(at(new THREE.CylinderGeometry(0.2, 0.23, colH - FLOOR - 0.5, 12).translate(x, (colH + FLOOR) / 2 - 0.03, z)));
    parts.trim.push(at(new THREE.BoxGeometry(0.6, 0.3, 0.6).translate(x, FLOOR + 0.15, z)));
    parts.trim.push(at(new THREE.BoxGeometry(0.56, 0.22, 0.56).translate(x, colH - 0.11, z)));
  }
  for (const s of [-1, 1]) parts.joinery.push(at(new THREE.BoxGeometry(0.26, 0.3, d).translate(s * (w / 2 - 0.35), colH + 0.15, 0)));
  parts.joinery.push(at(new THREE.BoxGeometry(w, 0.3, 0.26).translate(0, colH + 0.15, d / 2 - 0.35)));
  const top = colH + 0.3;
  parts.roof.push(at(hipRoof(w, d, b.roofH, 0.6).translate(0, top, 0)));
  roofTrim(parts, b, top, 0.6);
}

/** Build a named building group from blocks. Meshes: _Walls, _Roof, _Ridge, _Plinth, _Trim, _Joinery, _Glazing. */
export function building(name, blocks) {
  const parts = { walls: [], roof: [], ridge: [], plinth: [], trim: [], joinery: [], glass: [] };
  for (const b of blocks) (b.type === 'portico' ? portico : wallBlock)(parts, b);
  const grp = new THREE.Group(); grp.name = name;
  const add = (list, mat, suffix, shadow = true) => {
    if (!list.length) return;
    const m = new THREE.Mesh(merge(list), mat);
    m.name = `${name}_${suffix}`;
    m.userData = { castShadow: shadow, receiveShadow: true };
    grp.add(m);
  };
  add(parts.walls, M.wall, 'Walls'); add(parts.roof, M.roof, 'Roof'); add(parts.ridge, M.roof, 'Ridge');
  add(parts.plinth, M.plinth, 'Plinth'); add(parts.trim, M.trim, 'Trim'); add(parts.joinery, M.joinery, 'Joinery');
  add(parts.glass, M.glass, 'Glazing', false);
  return grp;
}
