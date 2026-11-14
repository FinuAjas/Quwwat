import * as THREE from 'three';
import { FEATURES, PADS, toY } from './layout.js';
import { merge, prep, paint, mulberry32 } from './geom.js';

/**
 * People, for life and scale: children at the play equipment (with a few parents), and a wedding in the
 * amphitheatre (bride and groom on the stage, family beside them, guests on the tiers).
 * Each figure is posed from a few joint angles and built from capsules; all figures of one place are merged
 * into a single vertex-coloured mesh. Local frame of a figure: feet at y = 0, facing +Z.
 */
const SKIN = [0xc68e63, 0xb57a50, 0xd3a077, 0xa9683f, 0xddb08a];
const HAIR = [0x17120f, 0x241a14, 0x2e2018, 0x0f0d0c];
const KID_TOPS = [0xe2483c, 0xf2b72c, 0x2f7fd0, 0x3ea560, 0xe86fa2, 0xf47b2a, 0x7c4fc4, 0x21a9a3];
const KID_BOTTOMS = [0x2c3e5c, 0x3a4a3c, 0x6b4a33, 0x1f2a44, 0x8a8f96];
const SHIRTS = [0xf1ede4, 0xcfd9e6, 0xe4d2b3, 0x9fb7cf, 0xd8c2c2, 0xb9cbb0, 0xe9e2c8];
const TROUSERS = [0x23262d, 0x3a3f4a, 0x4a3d31, 0x1c2433, 0xe9e4d6];
const DRESSES = [0xb8243a, 0x1f7a6d, 0xd9912a, 0x6a2c8f, 0x1f4f9c, 0xc9457f, 0x2f8f4a, 0xd8572a, 0x8c1c4a, 0xe0b23a, 0x147a94];
const SCARVES = [0xf0e6d2, 0xd9b6c4, 0xb8d0c8, 0xe6cf9a, 0xc9c2de, 0xf2d7c4];

const pick = (rand, list) => list[Math.floor(rand() * list.length)];
const part = (g, color) => paint(prep(g), color);
const Y = new THREE.Vector3(0, 1, 0);

/** Capsule from a to b (arrays), radius r; sx widens it sideways (for torsos). */
function limb(a, b, r, color, sx = 1, sz = 1) {
  return span(a, b, (len) => new THREE.CapsuleGeometry(r, len, 2, 7), color, sx, sz);
}
/** Tapered trunk from a (radius ra) to b (radius rb): chests and waists. */
function trunk(a, b, ra, rb, color, sx = 1, sz = 1) {
  return span(a, b, (len) => new THREE.CylinderGeometry(rb, ra, len, 9, 1), color, sx, sz);
}
function span(a, b, make, color, sx, sz) {
  const A = new THREE.Vector3().fromArray(a), B = new THREE.Vector3().fromArray(b), d = B.clone().sub(A), len = d.length();
  const g = make(Math.max(len, 0.001));
  if (sx !== 1 || sz !== 1) g.scale(sx, 1, sz);
  g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(Y, d.normalize()));
  g.translate((A.x + B.x) / 2, (A.y + B.y) / 2, (A.z + B.z) / 2);
  return part(g, color);
}
const ball = (c, r, color, s = [1, 1, 1]) => part(new THREE.SphereGeometry(r, 10, 8).scale(...s).translate(...c), color);

const POSES = {
  stand: {},
  // legs: [thigh forward, knee bend]; arms: [swing forward, out sideways, elbow bend, hands inward]
  walk: { legL: [0.45, 0.25], legR: [-0.3, 0.35], armL: [-0.45, 0.12, 0.35], armR: [0.5, 0.12, 0.5] },
  run: { lean: 0.22, legL: [0.95, 0.9], legR: [-0.55, 0.75], armL: [-0.9, 0.2, 1.3], armR: [0.9, 0.2, 1.4] },
  sit: { sit: true, legL: [1.5, 1.5], legR: [1.5, 1.5], armL: [0.55, 0.12, 0.7, 0.25], armR: [0.55, 0.12, 0.7, 0.25] },
  sitClap: { sit: true, legL: [1.5, 1.5], legR: [1.5, 1.5], armL: [0.9, 0.1, 1.5, 0.75], armR: [0.9, 0.1, 1.5, 0.75] },
  sitLap: { sit: true, legL: [1.5, 1.5], legR: [1.5, 1.5], armL: [0.3, 0.06, 1.15, 0.5], armR: [0.3, 0.06, 1.15, 0.5] },
  sitPhoto: { sit: true, legL: [1.5, 1.5], legR: [1.5, 1.5], armL: [1.15, 0.1, 1.2, 0.55], armR: [1.15, 0.1, 1.2, 0.55] },
  sitWave: { sit: true, legL: [1.5, 1.5], legR: [1.5, 1.5], armL: [0.55, 0.12, 0.7, 0.25], armR: [2.6, 0.5, 0.3] },
  cheer: { armL: [2.7, 0.45, 0.25], armR: [2.75, 0.45, 0.25] },
  wave: { armR: [2.6, 0.5, 0.35] },
  push: { lean: 0.2, legL: [0.35, 0.15], legR: [-0.35, 0.2], armL: [1.35, 0.1, 0.2], armR: [1.35, 0.1, 0.2] },
  photo: { legL: [0.12, 0.05], legR: [-0.12, 0.1], armL: [1.15, 0.1, 1.2, 0.55], armR: [1.15, 0.1, 1.2, 0.55] },
  swing: { sit: true, lean: -0.22, legL: [1.25, 0.5], legR: [1.25, 0.5], armL: [1.9, 0.3, 0.9], armR: [1.9, 0.3, 0.9] },
  slide: { sit: true, lean: -0.3, legL: [1.3, 0.25], legR: [1.3, 0.25], armL: [2.6, 0.5, 0.2], armR: [2.6, 0.5, 0.2] },
  ride: { sit: true, lean: 0.12, legL: [0.9, 1.1], legR: [0.9, 1.1], armL: [1.0, 0.25, 0.6, 0.2], armR: [1.0, 0.25, 0.6, 0.2] },
  seesaw: { sit: true, legL: [1.1, 0.9], legR: [1.1, 0.9], armL: [1.0, 0.1, 0.6, 0.35], armR: [1.0, 0.1, 0.6, 0.35] },
  holdL: { armL: [0.5, 0.25, 0.9, 0.3] },                      // offering a hand / holding a bouquet side
  holdR: { armR: [0.5, 0.25, 0.9, 0.3] },
  bouquet: { armL: [0.6, 0.1, 1.2, 0.7], armR: [0.6, 0.1, 1.2, 0.7] },
  holdDown: { armR: [0.15, 0.35, 0.1] },                       // a parent's hand held out low, to a child
  reachUp: { armL: [2.4, 0.3, 0.2] },
};

/**
 * One figure. o: { h, pose, skin, hair, top, bottom, shoes, sleeves ('short' | 'long'), skirt (hem radius, 0 = none),
 * skirtColor, scarf (colour), longHair, child, extras(parts, joints) }.
 */
function figure(o) {
  const H = o.h, p = { ...POSES.stand, ...(typeof o.pose === 'string' ? POSES[o.pose] : o.pose) };
  const child = o.child, parts = [];
  const headR = H * (child ? 0.082 : 0.066), limbR = H * (child ? 0.034 : 0.031);
  const thigh = H * 0.245, shin = H * 0.235, torsoLen = H * (child ? 0.27 : 0.29), hipW = H * 0.055, shoulderW = H * (child ? 0.105 : 0.118);
  const upper = H * 0.165, fore = H * 0.15;
  const legs = [p.legL ?? [0.03, 0.03], p.legR ?? [-0.03, 0.03]];
  // pelvis height: seated figures sit on y = 0, standing ones have their lowest foot on y = 0
  let pelvisY = limbR * 1.45;
  if (!p.sit) pelvisY = Math.max(...legs.map(([t, k]) => thigh * Math.cos(t) + shin * Math.cos(t - k))) + limbR * 1.5;
  const lean = p.lean ?? 0;
  const pelvis = [0, pelvisY, 0];
  const neck = [0, pelvisY + torsoLen * Math.cos(lean), torsoLen * Math.sin(lean)];
  const longSkirt = o.skirt && !p.sit;

  // legs
  legs.forEach(([t, k], i) => {
    const x = (i ? 1 : -1) * hipW, s = t - k;
    const hip = [x, pelvisY, 0], knee = [x, hip[1] - thigh * Math.cos(t), thigh * Math.sin(t)];
    const ankle = [x, knee[1] - shin * Math.cos(s), knee[2] + shin * Math.sin(s)];
    const legColor = o.skirt ? (o.skirtColor ?? o.bottom) : o.bottom;
    parts.push(limb(hip, knee, limbR * 1.35, legColor), limb(knee, ankle, limbR * 1.1, o.skirt && !o.child ? legColor : (o.shorts ? o.skin : legColor)));
    const toe = [x, ankle[1] + Math.sin(s) * H * 0.07 - limbR * 0.2, ankle[2] + Math.cos(s) * H * 0.07];
    parts.push(limb([x, ankle[1] - limbR * 0.3, ankle[2]], toe, limbR * 1.05, o.shoes ?? 0x2a2622));
  });
  if (o.skirt && p.sit && !child) { // seated in a dress: one piece over the lap and down the shins, instead of two trouser legs
    const [t, k] = legs[0], s = t - k, c = o.skirtColor ?? o.bottom;
    const knee = [0, pelvisY - thigh * Math.cos(t), thigh * Math.sin(t)], hem = [0, knee[1] - shin * 0.8 * Math.cos(s), knee[2] + shin * 0.8 * Math.sin(s)];
    parts.push(limb([0, pelvisY, -limbR], knee, limbR * 1.5, c, 2.5, 1), limb(knee, hem, limbR * 1.35, c, 2.5, 1));
  }
  if (longSkirt) { // dress or gown: a cone from the waist to the hem
    const top = pelvisY + H * 0.1, hem = o.skirtHem ?? H * 0.05, r = o.skirt;
    parts.push(part(new THREE.CylinderGeometry(H * 0.085, r, top - hem, 14, 1).translate(0, (top + hem) / 2, r * 0.06), o.skirtColor ?? o.bottom));
  }

  // torso, neck, head
  const waist = [0, pelvisY + H * 0.02, 0];
  const wide = child ? 1.3 : o.female ? 1.38 : 1.62, chest = [neck[0], neck[1] - H * 0.03, neck[2]];
  parts.push(trunk(waist, chest, H * (child ? 0.064 : 0.058), H * 0.073, o.top, wide, 0.84));          // narrower at the waist
  parts.push(ball(chest, H * 0.073, o.top, [wide, 0.5, 0.84]));                                           // rounded shoulders
  parts.push(limb(pelvis, waist, H * 0.064, o.skirt ? (o.skirtColor ?? o.bottom) : o.bottom, o.female ? 1.55 : 1.35, 0.95));
  const head = [0, neck[1] + headR * 1.25, neck[2] + headR * 0.12];
  parts.push(limb(neck, [head[0], head[1] - headR * 0.5, head[2]], headR * 0.42, o.skin));
  parts.push(ball(head, headR, o.skin, [0.92, 1.1, 0.98]));
  if (o.scarf) { // head scarf: covers the hair and drapes over the shoulders
    parts.push(part(new THREE.SphereGeometry(headR * 1.13, 12, 8, 0, Math.PI * 2, 0, 2.15).rotateX(-0.62).translate(head[0], head[1] + headR * 0.05, head[2] - headR * 0.06), o.scarf));
    parts.push(part(new THREE.CylinderGeometry(headR * 0.95, shoulderW * 1.25, H * 0.13, 12, 1).scale(1, 1, 0.8).translate(neck[0], neck[1] - H * 0.02, neck[2]), o.scarf));
  } else {
    parts.push(part(new THREE.SphereGeometry(headR * 1.07, 12, 8, 0, Math.PI * 2, 0, 1.75).rotateX(-0.5).translate(head[0], head[1] + headR * 0.08, head[2] - headR * 0.04), o.hair));
    if (o.bun) parts.push(ball([0, head[1] + headR * 0.25, head[2] - headR * 0.95], headR * 0.5, o.hair));
    else if (o.longHair) parts.push(limb([0, head[1], head[2] - headR * 0.75], [0, neck[1] - H * 0.12, neck[2] - H * 0.06], headR * 0.55, o.hair, 1.25, 0.6));
  }

  // arms
  const hands = [];
  [p.armL ?? [0.05, 0.1, 0.12], p.armR ?? [-0.05, 0.1, 0.12]].forEach(([sw, out, bend, inward = 0], i) => {
    const side = i ? 1 : -1;
    const sh = [side * shoulderW, neck[1] - H * 0.035, neck[2]];
    const dir = (a, inw) => new THREE.Vector3(side * (Math.sin(out) - inw), -Math.cos(out) * Math.cos(a), Math.cos(out) * Math.sin(a)).normalize();
    const u = dir(sw + lean, 0), f = dir(sw + bend + lean, inward);
    const elbow = [sh[0] + u.x * upper, sh[1] + u.y * upper, sh[2] + u.z * upper];
    const wrist = [elbow[0] + f.x * fore, elbow[1] + f.y * fore, elbow[2] + f.z * fore];
    parts.push(limb(sh, elbow, limbR * 1.05, o.top), limb(elbow, wrist, limbR * 0.9, o.sleeves === 'long' ? o.top : o.skin));
    parts.push(ball(wrist, limbR * 1.05, o.skin));
    hands.push(wrist);
  });
  o.extras?.(parts, { H, head, headR, neck, pelvisY, hands, shoulderW });
  return merge(parts);
}

/** Places a figure geometry: seat/foot point [x, y, z] and heading (yaw 0 = facing +Z). */
function put(list, geo, [x, y, z], yaw = 0) { list.push(geo.rotateY(yaw).translate(x, y, z)); }

// ---------- who they are ----------
function kid(rand, pose, o = {}) {
  const girl = o.girl ?? rand() < 0.5;
  return figure({
    h: o.h ?? 1.02 + rand() * 0.32, child: true, pose, skin: pick(rand, SKIN), hair: pick(rand, HAIR), longHair: girl,
    top: o.top ?? pick(rand, KID_TOPS), bottom: pick(rand, KID_BOTTOMS), shorts: !girl && rand() < 0.6,
    skirt: girl && rand() < 0.5 ? 0.2 : 0, skirtHem: 0.38, skirtColor: pick(rand, KID_TOPS), shoes: pick(rand, [0xf2f2f2, 0x2a2622, 0xd23c3c, 0x2c64b8]), ...o,
  });
}
function man(rand, pose, o = {}) {
  return figure({ h: 1.68 + rand() * 0.14, pose, skin: pick(rand, SKIN), hair: pick(rand, HAIR), top: pick(rand, SHIRTS), bottom: pick(rand, TROUSERS), sleeves: rand() < 0.6 ? 'long' : 'short', ...o });
}
function woman(rand, pose, o = {}) {
  const h = 1.54 + rand() * 0.12, dress = pick(rand, DRESSES);
  return figure({
    h, pose, female: true, skin: pick(rand, SKIN), hair: pick(rand, HAIR), longHair: true, bun: rand() < 0.35, top: dress, bottom: dress, skirt: h * 0.2, skirtColor: dress,
    sleeves: 'long', scarf: rand() < 0.55 ? pick(rand, SCARVES) : null, shoes: 0x5a3b2a, ...o,
  });
}
const adult = (rand, pose, o) => (rand() < 0.5 ? man(rand, pose, o) : woman(rand, pose, o));

/** Seats a figure on a bench { x, y, z, yaw } (furniture.js: seat 0.48 m up, front faces +Z of the bench), off metres along it. */
function sitOnBench(list, geo, b, off) {
  put(list, geo, [b.x + Math.cos(b.yaw) * off - Math.sin(b.yaw) * 0.03, b.y + 0.49, b.z - Math.sin(b.yaw) * off - Math.cos(b.yaw) * 0.03], b.yaw);
}
/** The play area's benches when the model's own list is not given: furniture.js puts five round the edge, facing the middle. */
function defaultPlayBenches() {
  const R = FEATURES.playground.radius + 1.9;
  return [75, 130, 185, 240, 290].map((a) => { const t = (a * Math.PI) / 180, x = Math.cos(t) * R, z = Math.sin(t) * R; return { x, y: 0, z, yaw: Math.atan2(-x, -z) }; });
}

// ---------- play area ----------
function playPeople(rand, benches) {
  const list = [], G = 0.2; // top of the play surface (structures.js)
  // slide and tower
  const tx = -2.2, tz = -1.2;
  put(list, kid(rand, 'slide', { h: 1.12 }), [tx, G + 0.83, tz + 0.8 + 1.5], 0);
  put(list, kid(rand, 'wave', { h: 1.15 }), [tx + 0.1, G + 1.55, tz + 0.15], 0.5);
  put(list, kid(rand, 'reachUp', { h: 1.05 }), [tx, G, tz - 1.75], 0);              // waiting at the ladder
  put(list, kid(rand, 'cheer', { h: 1.2 }), [tx - 1.0, G, tz + 0.8 + 3.3], Math.PI / 2); // beside the foot of the slide, clear of the roundabout
  // swings: two children, one pushed by a parent
  const sx0 = 2.5, sz0 = 1.9;
  for (const c of [-0.8, 0.8]) put(list, kid(rand, 'swing', { h: 1.1 + rand() * 0.15 }), [sx0 + c, G + 0.56, sz0 + 0.14], 0);
  put(list, woman(rand, 'push'), [sx0 - 1.12, G, sz0 - 1.3], 0.22); // behind the seat and half a step aside, out of its path
  // see-saw
  const wx = 1.9, wz = -2.9, wr = 0.45;
  for (const s of [-1, 1]) {
    put(list, kid(rand, 'seesaw', { h: 1.08 }), [wx + Math.cos(wr) * s * 1.48, G + 0.6 + s * 0.24, wz - Math.sin(wr) * s * 1.48], Math.atan2(-s * Math.cos(wr), s * Math.sin(wr)));
  }
  // roundabout: two riding, one running round with it
  const rx = -1.2, rz = 3.5;
  for (const a of [0.9, 3.9]) put(list, kid(rand, 'sitWave', { h: 1.1 }), [rx + Math.cos(a) * 0.72, G + 0.35, rz + Math.sin(a) * 0.72], Math.atan2(Math.cos(a), Math.sin(a)));
  put(list, kid(rand, 'run', { h: 1.25 }), [rx + Math.cos(2.4) * 1.75, G, rz + Math.sin(2.4) * 1.75], Math.atan2(-Math.sin(2.4), Math.cos(2.4)));
  // spring riders
  put(list, kid(rand, 'ride', { h: 0.98 }), [3.9, G + 0.84, -0.4], 0.5);
  put(list, kid(rand, 'ride', { h: 1.0 }), [-4.3, G + 0.84, 1.6], 0.5);
  put(list, man(rand, 'holdDown'), [-4.95, G, 2.0], 0.5 + Math.PI / 2);               // dad beside the small one
  // tag across the open middle, and a ball game
  put(list, kid(rand, 'run', { h: 1.3 }), [-0.55, G, 0.45], 2.2);
  put(list, kid(rand, 'run', { h: 1.22 }), [0.45, G, -0.75], 2.3);
  put(list, kid(rand, 'cheer', { h: 1.18 }), [-0.6, G, -3.9], 0.9);
  put(list, kid(rand, 'walk', { h: 1.1 }), [0.9, G, -4.6], -1.6);
  list.push(part(new THREE.SphereGeometry(0.13, 12, 8).translate(0.15, G + 0.13, -4.3), 0xe8462f));
  // toddler holding a parent's hand, and a parent taking a photo
  put(list, woman(rand, 'holdDown'), [4.85, G, 4.1], -2.3);          // clear of the swing frame's leg
  put(list, kid(rand, 'reachUp', { h: 0.86 }), [4.5, G, 3.75], -2.3);
  put(list, man(rand, 'photo'), [-0.4, G, 5.3], Math.PI * 0.92);
  // parents on the benches round the edge: only on benches the model really has (local frame; see buildPeople)
  const seats = [[[-0.4, woman], [0.35, man]], [[0.3, woman]], [[-0.3, man]], [[0.2, woman]], []];
  benches.forEach((b, i) => {
    for (const [off, who] of seats[i % seats.length]) sitOnBench(list, who(rand, pick(rand, ['sit', 'sitLap', 'sitWave'])), b, off);
  });
  return merge(list);
}

// ---------- wedding in the amphitheatre ----------
function weddingPeople(rand) {
  const f = FEATURES.amphitheatre, list = [], S = 0.25; // stage top (structures.js)
  const IVORY = 0xf6f0e2, GOLD = 0xd8b45a;
  // The couple, centre stage in front of the timber backdrop, facing the seats (local -Z)
  const bride = figure({
    h: 1.6, pose: 'bouquet', skin: SKIN[2], hair: HAIR[0], top: IVORY, bottom: IVORY, sleeves: 'long', skirt: 0.52, skirtHem: 0.0, skirtColor: IVORY, scarf: 0xfbf7ee,
    extras(parts, j) {
      // veil down the back, train on the floor, gold trim at the hem and a bouquet in the hands
      parts.push(part(new THREE.CylinderGeometry(j.headR * 0.9, 0.42, 1.25, 12, 1, true).scale(1, 1, 0.5).translate(0, j.head[1] - 0.58, j.head[2] - 0.2), 0xfdfaf2));
      parts.push(part(new THREE.CylinderGeometry(0.3, 0.75, 0.05, 14).scale(1, 1, 1.5).translate(0, 0.03, -0.75), IVORY));
      parts.push(part(new THREE.TorusGeometry(0.52, 0.02, 5, 20).rotateX(Math.PI / 2).translate(0, 0.04, 0.03), GOLD));
      const b = [(j.hands[0][0] + j.hands[1][0]) / 2, j.hands[0][1] + 0.04, j.hands[0][2] + 0.05];
      for (const [dx, dy, dz, c] of [[0, 0.03, 0, 0xd9304a], [0.06, 0, 0.02, 0xf4e9e2], [-0.06, 0, 0.02, 0xf07a9a], [0, -0.03, 0.05, 0xf4e9e2], [0.02, 0.06, 0.04, 0xf07a9a]]) parts.push(ball([b[0] + dx, b[1] + dy, b[2] + dz], 0.055, c));
      parts.push(ball([b[0], b[1] - 0.06, b[2]], 0.07, 0x3d7a44));
    },
  });
  put(list, bride, [-0.42, S, -1.9], Math.PI);
  const groom = figure({
    h: 1.76, pose: 'holdL', skin: SKIN[1], hair: HAIR[0], top: 0x1c2740, bottom: 0x1c2740, sleeves: 'long', shoes: 0x14110f,
    extras(parts, j) { // shirt front, tie and a buttonhole flower
      parts.push(part(new THREE.BoxGeometry(0.1, 0.3, 0.03).translate(0, j.neck[1] - 0.2, 0.105), 0xf7f5ef));
      parts.push(part(new THREE.BoxGeometry(0.035, 0.26, 0.035).translate(0, j.neck[1] - 0.2, 0.115), 0x8c1c2c));
      parts.push(ball([-0.11, j.neck[1] - 0.13, 0.11], 0.03, 0xf4e9e2));
    },
  });
  put(list, groom, [0.42, S, -1.9], Math.PI);

  // flower arch on the backdrop behind the couple, petals on the aisle
  const flowers = [0xf4e9e2, 0xf07a9a, 0xd9304a, 0xf6c7d2, 0x4f8f56];
  for (let i = 0; i <= 40; i++) {
    const t = i / 40, a = Math.PI * t, x = Math.cos(a) * 1.75, y = S + 0.2 + Math.sin(a) * 3.0;
    for (let k = 0; k < 3; k++) list.push(ball([x + (rand() - 0.5) * 0.22, y + (rand() - 0.5) * 0.22, -0.42 + (rand() - 0.5) * 0.16], 0.09 + rand() * 0.06, pick(rand, flowers)));
  }
  for (let i = 0; i < 70; i++) list.push(part(new THREE.CylinderGeometry(0.045, 0.045, 0.012, 5).translate((rand() - 0.5) * 1.3, S + 0.01, -2.4 - rand() * 1.6), pick(rand, flowers)));

  // family beside the couple, flower girls in front, a photographer
  put(list, woman(rand, 'stand', { scarf: 0xe6cf9a }), [-1.75, S, -1.6], Math.PI - 0.35);
  put(list, man(rand, 'stand', { top: 0x3a3f4a, bottom: 0x3a3f4a, sleeves: 'long' }), [-2.5, S, -1.35], Math.PI - 0.45);
  put(list, man(rand, 'stand', { top: 0x6d7f8f, bottom: 0x6d7f8f, sleeves: 'long' }), [1.75, S, -1.6], Math.PI + 0.35);
  put(list, woman(rand, 'wave'), [2.5, S, -1.35], Math.PI + 0.45);
  put(list, kid(rand, 'bouquet', { h: 1.05, girl: true, top: 0xf6c7d2, skirt: 0.24, skirtColor: 0xf6c7d2 }), [-1.1, S, -2.7], Math.PI - 0.2);
  put(list, kid(rand, 'cheer', { h: 1.12, girl: false, top: 0xf1ede4 }), [1.55, S, -2.5], Math.PI + 0.25);
  put(list, man(rand, 'photo', { top: 0x23262d, bottom: 0x23262d }), [0.9, S, -3.75], 0.25);

  // guests on the tiers: seated facing the stage, between the aisles; a few standing on the top walkway
  const aisles = [45, 90, 135];
  for (let i = 0; i < f.tiers; i++) {
    // the lowest tier sits further back, so knees and feet stay clear of the raised stage edge
    const r = f.r0 + i * f.tierDepth + (i ? 0.42 : 0.7), y = (i + 1) * f.tierRise, stepDeg = (0.64 / r) * (180 / Math.PI);
    for (let d = f.arc[0] + 5; d < f.arc[1] - 4; d += stepDeg) {
      if (aisles.some((a) => Math.abs(d - a) < (0.85 / r) * (180 / Math.PI))) continue;
      if (rand() > (i < 3 ? 0.86 : 0.62)) continue;
      const t = ((d + (rand() - 0.5) * 1.2) * Math.PI) / 180, x = r * Math.cos(t), z = -r * Math.sin(t);
      const turned = rand() < 0.14 ? (rand() < 0.5 ? -0.6 : 0.6) : 0;        // a few are talking to a neighbour
      const yaw = Math.atan2(-x, -z - 0.57) + (rand() - 0.5) * 0.25 + turned; // towards the couple
      const q = rand(), pose = q < 0.24 ? 'sitClap' : q < 0.32 ? 'sitWave' : q < 0.52 ? 'sitLap' : q < 0.6 ? 'sitPhoto' : 'sit';
      const g = rand() < 0.14 ? kid(rand, pose, { h: 1.05 + rand() * 0.25 }) : adult(rand, pose);
      put(list, g, [x, y, z], yaw);
    }
  }
  const rw = f.r0 + f.tiers * f.tierDepth + f.walkway * 0.45, yw = f.tiers * f.tierRise;
  for (const d of [11, 38, 53, 127, 139]) {
    const t = (d * Math.PI) / 180, x = rw * Math.cos(t), z = -rw * Math.sin(t);
    put(list, adult(rand, rand() < 0.4 ? 'wave' : rand() < 0.5 ? 'photo' : 'stand'), [x, yw, z], Math.atan2(-x, -z));
  }
  // and seated on the walkway's four benches (furniture.js: at 24, 68, 112 and 152 degrees, facing the stage)
  const rb = f.r0 + f.tiers * f.tierDepth + f.walkway / 2;
  [24, 68, 112, 152].forEach((d, i) => {
    const t = (d * Math.PI) / 180, x = rb * Math.cos(t), z = -rb * Math.sin(t), b = { x, y: yw, z, yaw: Math.atan2(-x, -z) };
    for (const off of i % 2 ? [-0.38, 0.38] : [0.3]) sitOnBench(list, adult(rand, pick(rand, ['sit', 'sitLap', 'sitClap'])), b, off);
  });
  return merge(list);
}

/**
 * Group "People": one mesh per place, in the same local frames as the structures they stand on.
 * benches: the model's benches as world { x, y, z, yaw } (y = the ground under the bench). Those round the play area
 * get parents sitting on them; without the list, the five that furniture.js places there are assumed.
 */
export function buildPeople({ benches = null } = {}) {
  const group = new THREE.Group(); group.name = 'People';
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.82, metalness: 0 }); mat.name = 'People';
  const padY = (id) => toY(PADS.find((p) => p.id === id).elev);
  const add = (name, geo, pos, y, rot) => {
    const m = new THREE.Mesh(geo, mat);
    m.name = name; m.userData = { castShadow: true, receiveShadow: true };
    m.position.set(pos[0], y, pos[1]); m.rotation.y = rot;
    group.add(m);
    return m;
  };
  const pg = FEATURES.playground, py = padY('playground');
  const near = benches
    ? benches.map((b) => ({ x: b.x - pg.pos[0], y: b.y - py, z: b.z - pg.pos[1], yaw: b.yaw })).filter((b) => Math.hypot(b.x, b.z) < pg.radius + 3.5)
      .sort((a, b) => Math.atan2(a.z, a.x) - Math.atan2(b.z, b.x))
    : defaultPlayBenches();
  add('People_PlayArea', playPeople(mulberry32(4117), near), pg.pos, py, 0);
  add('People_Wedding', weddingPeople(mulberry32(9203)), FEATURES.amphitheatre.pos, padY('amphitheatre'), FEATURES.amphitheatre.rot);
  return group;
}
