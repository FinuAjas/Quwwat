// Site layout digitised from the rendered master plan (1600×1200 px image).
// World frame: X = east (image right), Z = south (image down), Y = up. 1 px = 0.15 m.
// Origin = image pixel (800, 600).
import { deg } from './geom.js';

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
  { id: 'amphitheatre', c: P(585, 672), rx: 13, rz: 13, rot: 0, elev: 93, falloff: 6 },
  { id: 'plaza', c: P(630, 732), rx: 7.5, rz: 7.5, rot: 0, elev: 92, falloff: 5 },
  { id: 'gate-south', c: P(1050, 1100), rx: 8, rz: 6, rot: 0, elev: 52.5, falloff: 6 },
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
    id: 'parking-spine', width: 7, dashes: true, kerb: true,
    parking: { left: false, right: (x) => x > -16 && x < 34 },
    points: pts([[1040, 550], [950, 588], [840, 620], [740, 655], [672, 690], [640, 722]]),
  },
  { id: 'connector', width: 6.5, dashes: false, kerb: true, points: pts([[700, 545], [712, 592], [738, 652]]) },
  {
    id: 'west-road', width: 7, dashes: true, kerb: true,
    points: pts([[1040, 555], [960, 640], [860, 692], [760, 742], [660, 800], [585, 858], [520, 905]]),
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
  amphitheatre: { pos: P(585, 672), rot: deg(33), r0: 4.5, tiers: 7, tierDepth: 1.05, tierRise: 0.5 },
  plaza: { pos: P(630, 732), radius: 6 },
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
  { id: 'amphitheater', title: 'Amphitheatre', group: 'Amphitheater', at: FEATURES.amphitheatre.pos, lift: 7 },
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
