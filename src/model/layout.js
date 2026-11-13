// Site layout digitised from the rendered master plan (1600×1200 px image).
// World frame: X = east (image right), Z = south (image down), Y = up. 1 px = 0.15 m.
// Origin = image pixel (800, 600).
import { deg, samplePath } from './geom.js';

export const PX = 0.15;
export const P = (x, y) => [(x - 800) * PX, (y - 600) * PX];
const pts = (arr) => arr.map(([x, y]) => P(x, y));

// Elevations are real metres (from the contour map spot levels). Exported Y = (e - ELEV_BASE) * VSCALE.
export const ELEV_BASE = 85;
export const VSCALE = 0.6;
export const toY = (e) => (e - ELEV_BASE) * VSCALE;

export const SITE_BOUNDARY = pts([
  [372, 72], [415, 72], [1030, 485], [1042, 512], [1245, 180], [1597, 345], [1555, 520],
  [1110, 880], [1145, 1105], [1040, 1135], [975, 990], [830, 705], [560, 905], [605, 1000],
  [275, 1110], [268, 975], [480, 848], [212, 378], [380, 282],
]);

// [px x, px y, elevation m] — approximated from the contour survey (high NW → low S/SE).
export const SPOT_LEVELS = [
  [395, 75, 106], [300, 250, 102], [215, 380, 99], [640, 400, 97], [850, 300, 96], [1000, 440, 92],
  [1245, 180, 86], [1597, 345, 70], [1555, 520, 64], [1380, 300, 80], [1250, 600, 72], [1110, 880, 60],
  [1045, 1125, 52], [975, 990, 58], [830, 705, 82], [1040, 550, 86], [760, 650, 90], [620, 720, 91],
  [480, 845, 85], [560, 900, 80], [605, 1000, 70], [275, 1110, 62], [268, 975, 70], [380, 650, 94],
].map(([x, y, e]) => [...P(x, y), e]);

// Graded platforms. rx/rz in metres, falloff = blend distance (m).
export const PADS = [
  { id: 'courtyard', c: P(615, 402), rx: 47, rz: 34, rot: 0, elev: 97, falloff: 14 },
  { id: 'prayer', c: P(415, 108), rx: 10, rz: 10, rot: 0, elev: 105, falloff: 8 },
  { id: 'playground', c: P(300, 388), rx: 9.5, rz: 9.5, rot: 0, elev: 97.5, falloff: 7 },
  { id: 'amphitheatre', c: P(586.6, 671.4), rx: 13, rz: 13, rot: 0, elev: 93, falloff: 6 },
  { id: 'turning-head', c: P(560, 752), rx: 8.5, rz: 8.5, rot: 0, elev: 90, falloff: 5, firm: true }, // firm: see terrain.js
  { id: 'gate-south', c: P(1050, 1100), rx: 8, rz: 6, rot: 0, elev: 52.5, falloff: 6 },
];

// The access road ("spine"), Plan 3: from the hairpin junction to the turning head, on the render's line.
// Its first stretch, from the junction to x = 990 px, lies outside the Plan 3 work area and must not move, so it is
// taken point by point from the road's previous curve; from there it eases onto the new line.
const SPINE_BEFORE = pts([[1040, 550], [950, 588], [840, 620], [740, 655], [672, 690], [640, 722]]);
const SPINE_POINTS = [
  ...samplePath(SPINE_BEFORE, false, 1.5).samples.filter((s) => s.x > P(990, 0)[0]).map((s) => [s.x, s.z]),
  ...pts([[960, 588], [930, 607], [900, 626], [873, 640], [843, 652], [813, 663.5], [785, 675.5], [753, 688], [724, 700],
    [693, 712], [662, 724], [631, 736], [602, 748]]),
];

// no bays along the south side of the ring (amphitheatre) or beside the children's play area
const ringNoParking = (x, z) => !(z > -14 && x > -62 && x < -5) && Math.hypot(x + 75, z + 31.8) > 15;

export const ROADS = [
  {
    id: 'ring', closed: true, width: 7, dashes: true, kerb: true,
    parking: { left: ringNoParking, right: ringNoParking },
    points: pts([[700, 545], [800, 522], [860, 458], [852, 360], [800, 288], [710, 232], [600, 214], [480, 248],
      [392, 318], [350, 410], [362, 500], [420, 572], [520, 580], [610, 565]]),
  },
  {
    // Access road from the hairpin junction to the turning head. Bays on the north side stop at x = 768 px:
    // west of that the parking drive's own bays fill the wedge between the two roads.
    id: 'parking-spine', width: 7, dashes: true, kerb: true,
    parking: { left: false, right: (x) => x > P(768, 0)[0] && x < 34 },
    points: SPINE_POINTS,
  },
  {
    // Parking drive: leaves the ring, runs south-west along the amphitheatre's straight side (its NW kerb is the
    // amphitheatre's edge) and ends in the turning head. Bays on the SE side only, near the ring end; the model's
    // roads are wider than the render's, so bays on the NW side or further down would overlap the ring or the spine.
    id: 'amphi-drive', width: 7, dashes: false, kerb: true, banksTo: 'parking-spine', // banksTo: see terrain.js
    parking: { left: (x, z) => z > P(0, 627)[1] && z < P(0, 661)[1], right: false },
    points: pts([[724, 541], [719, 562], [707, 584], [689.6, 606.6], [661.6, 635.2], [633.6, 663.7], [605.6, 692.3], [582.5, 715.9]]),
  },
  {
    // From the west gate up to the access road, on the render's line; it merges into the spine at (843,652).
    // Listed from the merge down to the gate. Plan 3 removed its old tail to the hairpin junction.
    id: 'west-road', width: 7, dashes: true, kerb: true, joins: 'parking-spine',
    points: pts([[843, 652], [822, 667], [800, 684], [770, 705.5], [735, 731], [700, 760], [660, 800], [585, 858], [520, 905]]),
  },
  {
    id: 'hairpin-road', width: 7, dashes: true, kerb: true,
    points: pts([[1040, 550], [1150, 455], [1250, 352], [1318, 300], [1358, 282], [1392, 305], [1380, 360],
      [1320, 472], [1250, 600], [1170, 750], [1100, 880], [1060, 990], [1050, 1125]]),
  },
  {
    id: 'prayer-path', width: 2.6, dashes: false, kerb: false, surface: 'path',
    points: pts([[425, 140], [445, 180], [490, 200], [535, 212]]),
  },
];

// Feature placements (world metres; rot = rotation about Y, +rot turns local +X towards image-up).
export const FEATURES = {
  mainBuilding: { pos: P(618, 455), rot: deg(25) },
  pool: { pos: P(535, 355), rot: deg(28), length: 32, width: 11 },
  prayerHall: { pos: P(415, 108), rot: deg(-8) },
  playground: { pos: P(300, 388), radius: 6.8 },
  // Plan 3: pos is the middle of the straight, open side, which lies on the parking drive's NW kerb; the seats are a
  // half-ring on the NW side (rot 45 deg = parallel to the drive). Outer radius = r0 + tiers * tierDepth + walkway +
  // 0.5 m wall = 10.6 m: all that fits between the drive and the ring road, whose roads are wider than the render's.
  // arc: the seats stop 14 deg short at the SW end, where the turning head's rim comes in.
  amphitheatre: { pos: P(586.6, 671.4), rot: deg(45), r0: 4.2, tiers: 5, tierDepth: 1.0, tierRise: 0.5, walkway: 0.9, arc: [0, 166] },
  // Planted bank between the parking drive and the access road (the render's median); steps: where a flight of
  // steps crosses it, at the render's red path.
  median: { roads: ['amphi-drive', 'parking-spine'], steps: P(712, 582) },
  turningHead: { pos: P(560, 752), radius: 7.5 }, // paved bulb where the parking drive and the spine meet
  pergolas: [
    { pos: P(530, 404), rot: deg(28), length: 17, width: 3.4 }, // along the pool deck, south side
    { pos: P(668, 330), rot: deg(-60), length: 9, width: 3 },
    { pos: P(820, 572), rot: deg(26), length: 11, width: 3.2 },
    { pos: P(915, 515), rot: deg(26), length: 10, width: 3.2 },
    { pos: P(868, 548), rot: deg(-64), length: 8, width: 3 },
  ],
  shades: [{ pos: P(478, 470) }, { pos: P(705, 300) }],
  gateWest: { pos: P(548, 884), rot: deg(-53) },
  gateSouth: { pos: P(1050, 1108), rot: deg(0) },
};

// Clickable hotspots (anchor heights are added to ground level).
export const HOTSPOTS = [
  { id: 'main-building', title: 'Convention Centre', group: 'MainBuilding', at: FEATURES.mainBuilding.pos, lift: 15 },
  { id: 'swimming-pool', title: 'Infinity Swimming Pool', group: 'SwimmingPool', at: FEATURES.pool.pos, lift: 5 },
  { id: 'amphitheater', title: 'Amphitheatre', group: 'Amphitheater', at: [FEATURES.amphitheatre.pos[0] - 3.5, FEATURES.amphitheatre.pos[1] - 3.5], lift: 7 }, // over the seats, 5 m NW of the stage edge
  { id: 'recreation-zone', title: "Children's Play Area", group: 'RecreationZone', at: FEATURES.playground.pos, lift: 6 },
  { id: 'prayer-hall', title: 'Prayer Hall', group: 'PrayerHall', at: FEATURES.prayerHall.pos, lift: 10 },
  { id: 'parking', title: 'Visitor Parking', group: 'Parking', at: P(600, 214), lift: 4 },
  { id: 'gate-south', title: 'Entrance Gate — Nellankandi', group: 'EntranceGate_South', at: FEATURES.gateSouth.pos, lift: 8 },
  { id: 'gate-west', title: 'Pergola Gate — West', group: 'EntranceGate_West', at: FEATURES.gateWest.pos, lift: 7 },
];

// Plan 3 work area (docs/IMPLEMENTATION_PLAN_3.md): the amphitheatre and south parking area, as layout pixels.
// Every Plan 3 geometry change must lie inside this outline. Used only by tools and checks, never by the model.
export const PLAN3_AREA_PX = [
  [997, 566], [965, 680], [895, 758], [833, 808], [776, 845], [717, 883], [642, 905], [551, 906], [445, 878],
  [388, 787], [381, 680], [442, 594], [523, 548], [640, 520], [780, 500], [917, 482],
];
export const PLAN3_AREA = pts(PLAN3_AREA_PX); // the same outline in world metres [x, z]

// Terrain mesh extents (metres).
export const TERRAIN = { innerX: [-100, 130], innerZ: [-92, 94], step: 1.5, outer: 700, outerSegs: 26 };
