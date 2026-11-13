// The site as it was before Plan 3 (docs/IMPLEMENTATION_PLAN_3.md), kept for one purpose: Plan 3 may change
// nothing outside its work area. Parked cars, plants, street furniture and rocks are scattered with running
// random sequences, so moving one road reshuffles them across the whole site. To stop that, every scatter is
// run twice: once on this old layout, which gives exactly the old result, and once on the current layout.
// mergeScatter() then keeps the old items outside the work area and the new ones inside it.
import { P, PADS, ROADS, FEATURES, PLAN3_AREA } from './layout.js';
import { makeGround, heightField } from './terrain.js';
import { signedDistToPolygon, distToSegment, samplePath, deg } from './geom.js';

const pts = (arr) => arr.map(([x, y]) => P(x, y));
const keep = (id) => ROADS.find((r) => r.id === id); // a road Plan 3 does not touch

const LEGACY_ROADS = [
  keep('ring'),
  {
    id: 'parking-spine', width: 7, dashes: true, kerb: true,
    parking: { left: false, right: (x) => x > -16 && x < 34 },
    points: pts([[1040, 550], [950, 588], [840, 620], [740, 655], [672, 690], [640, 722]]),
  },
  { id: 'connector', width: 6.5, dashes: false, kerb: true, points: pts([[700, 545], [712, 592], [738, 652]]) },
  {
    id: 'west-road', width: 7, dashes: true, kerb: true,
    points: pts([[1040, 555], [960, 640], [860, 692], [760, 742], [660, 800], [585, 858], [520, 905]]),
  },
  keep('hairpin-road'),
  keep('prayer-path'),
];

// The one approved change outside the outline (P3.4): the old west road ran on its own to the hairpin junction, and
// its last ~12 m lay outside the work area. That tail is gone, so the ground within TAIL_REACH of it counts as work area.
const TAIL_REACH = 8;
const TAIL = samplePath(LEGACY_ROADS[3].points, false, 2).samples.map((s) => [s.x, s.z]);
TAIL.length = TAIL.findIndex(([x, z]) => signedDistToPolygon(x, z, PLAN3_AREA) < 0) + 1;

/** Distance to the edge of the ground Plan 3 may change: negative inside the work area (or by the removed tail). */
export function workAreaDistance(x, z) {
  let d = signedDistToPolygon(x, z, PLAN3_AREA);
  for (let i = 0; i < TAIL.length - 1; i++) d = Math.min(d, distToSegment(x, z, ...TAIL[i], ...TAIL[i + 1]).d - TAIL_REACH);
  return d;
}

const LEGACY_PADS = PADS.flatMap((p) => {
  if (p.id === 'amphitheatre') return [{ id: 'amphitheatre', c: P(585, 672), rx: 13, rz: 13, rot: 0, elev: 93, falloff: 6 }];
  if (p.id === 'turning-head') return [{ id: 'plaza', c: P(630, 732), rx: 7.5, rz: 7.5, rot: 0, elev: 92, falloff: 5 }];
  return [p];
});

const LEGACY_FEATURES = {
  ...FEATURES,
  amphitheatre: { pos: P(585, 672), rot: deg(33), r0: 4.5, tiers: 7, tierDepth: 1.05, tierRise: 0.5 },
  plaza: { pos: P(630, 732), radius: 6 },
};
delete LEGACY_FEATURES.turningHead;

/** True if (x, z) is on or inside one of the obstacles ({x, z, r} discs or {x, z, hx, hz, rot} boxes), grown by pad. */
export const blockedBy = (obstacles) => (x, z, pad = 0) => {
  for (const o of obstacles) {
    if (o.r !== undefined) { if (Math.hypot(x - o.x, z - o.z) < o.r + pad) return true; continue; }
    const dx = x - o.x, dz = z - o.z, c = Math.cos(o.rot), s = Math.sin(o.rot);
    const lx = dx * c - dz * s, lz = dx * s + dz * c; // inverse of rotation.y
    if (Math.abs(lx) < o.hx + pad && Math.abs(lz) < o.hz + pad) return true;
  }
  return false;
};

/** What a scatter needs to know about the site: { roadData, roadQuery, heightAt, obstacles, isBlocked, features }. */
export function makeWorld(ground, heightAt, obstacles, features) {
  return { roadData: ground.roadData, roadQuery: ground.roadQuery, heightAt, obstacles, isBlocked: blockedBy(obstacles), features };
}

/**
 * The old site. structureObstacles: the footprints of the current structures; those tagged with a Plan 3 id
 * (the amphitheatre and the turning head) are swapped for the old amphitheatre and the old round plaza.
 */
export function legacyWorld(structureObstacles) {
  const ground = makeGround(LEGACY_ROADS, LEGACY_PADS);
  const a = LEGACY_FEATURES.amphitheatre, pl = LEGACY_FEATURES.plaza;
  const obstacles = [
    ...structureObstacles.filter((o) => !o.plan3),
    { x: a.pos[0], z: a.pos[1], r: a.r0 + a.tiers * a.tierDepth + 2 },
    { x: pl.pos[0], z: pl.pos[1], r: pl.radius + 1.5 },
  ];
  return makeWorld(ground, heightField(ground.elevationAt).heightAt, obstacles, LEGACY_FEATURES);
}

/**
 * Join two scatters of the same thing: the old one outside the Plan 3 work area, the current one inside.
 *  band:  metres inside the outline where old items are still kept if `valid` accepts them, and new ones are
 *         not planted. For things much wider than their base (tree crowns), so the outline does not show as a
 *         line of swapped trees whose crowns reach outside the area.
 *  gap:   a new item closer than this to a kept old one is dropped, so the two sets do not double up at the seam.
 *  tail:  false = the ground by the removed west-road tail does not count as work area (parked cars: none stood
 *         on the tail, and the bays beside it belong to the access road, which did not change there).
 */
export function mergeScatter(legacy, current, { band = 0, gap = 0, valid = () => true, tail = true } = {}) {
  const sd = tail ? (o) => workAreaDistance(o.x, o.z) : (o) => signedDistToPolygon(o.x, o.z, PLAN3_AREA);
  const kept = legacy.filter((o) => { const d = sd(o); return d > 0 || (d > -band && valid(o)); });
  const near = gap ? kept.filter((o) => sd(o) < gap) : [];
  const fresh = current.filter((o) => sd(o) <= -band && !near.some((k) => Math.hypot(k.x - o.x, k.z - o.z) < gap));
  return [...kept, ...fresh];
}
