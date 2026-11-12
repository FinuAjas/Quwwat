// Central tuning for the hero scene. World units are metres; site centre ≈ (15, 0, 0).
import { getTier } from './tier.js';

// 'ultra' | 'high' | 'low' — chosen by a GPU benchmark before this file loads (see tier.js).
// Force one for testing from the address bar: ?tier=ultra, ?tier=high or ?tier=low
export const TIER = getTier();

// ultra = strong desktop GPUs: smoother edges, finer shadows and ambient occlusion, a little more mist and traffic.
// high = ordinary desktops and the fastest phones. low = phones and weak GPUs (no AO / bloom / blur).
export const QUALITY = {
  ultra: { pixelRatio: 2, antialias: true, msaa: 8, ao: true, aoSamples: 16, bloom: true, dof: true, shadows: true, shadowMapSize: 6144, mistCount: 34, cars: 7 },
  high: { pixelRatio: 2, antialias: true, msaa: 4, ao: true, aoSamples: 12, bloom: true, dof: true, shadows: true, shadowMapSize: 4096, mistCount: 26, cars: 5 },
  low: { pixelRatio: 1.5, antialias: true, msaa: 2, ao: false, bloom: false, dof: false, shadows: true, shadowMapSize: 2048, mistCount: 14, cars: 3 },
}[TIER];

// ---------- time-of-day looks ----------
// Pick with CONFIG.look, or try one from the address bar: ?look=midday
// grade: contrast (S-curve amount), saturation, greenDesat (tames neon greens towards olive),
//        shadows / highlights (RGB tints, split-toning), lift / gain (black level, white level).
export const LOOKS = {
  golden: { // late afternoon: low warm sun, long soft shadows, cool shade
    sky: { top: 0x7f9fc0, horizon: 0xf1dcc0, bottom: 0xd2cab8 },
    fog: { color: 0xdcd3c0, near: 380, far: 1050 },
    sun: { color: 0xffd3a0, intensity: 3.6, position: [-205, 150, -45], shadowExtent: 160, shadowFar: 700 },
    hemi: { sky: 0xc6d8f2, ground: 0x4b4a2e, intensity: 0.9 },
    env: { intensity: 0.55, skyBoost: 1.25, ground: 0x3d4a26, sunGlow: 1.0 },
    haze: { density: 0.00085, aerial: 0x8fa3b5, sunTint: 0xffd9a6, valleyAmount: 0.45, ridge: 0x6f7f86 },
    cloudShadow: 0.42, exposure: 1.55, mistColor: 0xb4ada0, mistOpacity: 0.42,
    grade: { contrast: 0.14, saturation: 1.14, greenDesat: 0.2, shadows: [0.93, 0.99, 1.09], highlights: [1.08, 1.01, 0.9], lift: 0.0, gain: 1.0 },
  },
  midday: { // high neutral sun, crisp and clear
    sky: { top: 0x6f9fd0, horizon: 0xd6e4ea, bottom: 0xc9d6cf },
    fog: { color: 0xcfdde0, near: 400, far: 1100 },
    sun: { color: 0xfff3e0, intensity: 3.6, position: [-90, 300, -60], shadowExtent: 150, shadowFar: 700 },
    hemi: { sky: 0xd4e6ff, ground: 0x3e4f26, intensity: 0.9 },
    env: { intensity: 0.6, skyBoost: 1.25, ground: 0x3a4a25, sunGlow: 0.7 },
    haze: { density: 0.00075, aerial: 0x9fb6cc, sunTint: 0xf2f0e6, valleyAmount: 0.3, ridge: 0x6d8496 },
    cloudShadow: 0.36, exposure: 1.4, mistColor: 0xb9c0c2, mistOpacity: 0.42,
    grade: { contrast: 0.12, saturation: 1.12, greenDesat: 0.18, shadows: [0.97, 1.0, 1.05], highlights: [1.02, 1.01, 0.97], lift: 0.0, gain: 1.0 },
  },
  overcast: { // soft, shadowless monsoon light
    sky: { top: 0xb7c2ca, horizon: 0xd9dee0, bottom: 0xc9cfce },
    fog: { color: 0xcdd3d3, near: 330, far: 980 },
    sun: { color: 0xe6edf2, intensity: 1.1, position: [-120, 260, -80], shadowExtent: 150, shadowFar: 700 },
    hemi: { sky: 0xe2e8ef, ground: 0x565f4a, intensity: 1.55 },
    env: { intensity: 0.8, skyBoost: 1.15, ground: 0x4a5340, sunGlow: 0.08 },
    haze: { density: 0.0011, aerial: 0xaab3b8, sunTint: 0xd4d9dc, valleyAmount: 0.55, ridge: 0x8a9499 },
    cloudShadow: 0.12, exposure: 1.4, mistColor: 0xb4b9ba, mistOpacity: 0.42,
    grade: { contrast: 0.08, saturation: 0.95, greenDesat: 0.28, shadows: [0.98, 1.0, 1.03], highlights: [1.0, 1.0, 1.0], lift: 0.01, gain: 1.0 },
  },
};
const DEFAULT_LOOK = 'golden';
const requested = new URLSearchParams(location.search).get('look');
export const LOOK_NAME = LOOKS[requested] ? requested : DEFAULT_LOOK;
const LOOK = LOOKS[LOOK_NAME];

export const CONFIG = {
  // `core` (terrain, roads, buildings, hotspots) loads first; `extras` (e.g. vegetation, details) stream in after.
  models: { core: './public/models/mountain-courtyard.glb', extras: [] },
  dracoPath: 'https://cdn.jsdelivr.net/npm/three@0.170.0/examples/jsm/libs/draco/gltf/',
  basisPath: 'https://cdn.jsdelivr.net/npm/three@0.170.0/examples/jsm/libs/basis/',
  lightMapIntensity: 1.0,
  foliage: { wind: 0.012, translucency: 0.35 }, // sway as a fraction of plant height; back-light strength

  siteCenter: [15, 0, 0],
  // Low tier: only buildings/cars cast shadows (trees still receive them).
  shadowsFor: (mesh) => TIER !== 'low' || !mesh.userData.vegetation,
  perf: { minPixelRatio: 1, step: 0.25, slowMs: 24, fastMs: 13, sampleFrames: 90 },
  camera: {
    fov: 35, near: 1, far: 3000,
    target: [-27.3, 8, -21.75], // the Convention Centre, kept at the exact centre of the screen
    position: [-47, 165, 145],  // from the south, ~45° down — like the reference aerial
    viewShift: 0,               // fraction of the width to shift the frame right (desktop only); 0 = centred
  },

  controls: {
    damping: 0.06,
    minPolar: 20, maxPolar: 80,         // degrees from straight down
    minDistance: 35, maxDistance: 480,
    groundClearance: 9,                 // metres the camera stays above the terrain
    panBounds: { minX: -110, maxX: 140, minZ: -100, maxZ: 110 },
    rotateSpeed: 0.55, zoomSpeed: 0.9, panSpeed: 0.8,
    autoRotateSpeed: 0.35, idleSeconds: 9,
    // Preset / hotspot moves: shortest duration (longer moves add time), how far ahead the look-at point runs,
    // and how much long moves pull back mid-flight (fraction of the distance the orbit centre travels).
    flySeconds: 1.3, targetLead: 1.15, arcLift: 0.3,
    introSkipSeconds: 0.7,              // a skipped intro fast-forwards to the end in this time
  },

  // Camera presets: [target], [position]. `mobile` overrides apply to portrait/narrow screens.
  presets: {
    aerial: { target: [-27.3, 8, -21.75], position: [-47, 165, 145], mobile: { target: [-27.3, 8, -21.75], position: [-35.5, 206, 156.5] } },
    'main-building': { target: [-28, 8, -22], position: [8, 46, 32], mobile: { target: [-28, 8, -10], position: [0, 75, 60] } },
    recreation: { target: [-52, 7, -34], position: [-62, 38, 22], mobile: { target: [-52, 7, -20], position: [-58, 70, 55] } },
  },
  // Opening shot: the camera flies through `path` ([x, y, z] waypoints, low over the forest from the south-east)
  // and lands on the `aerial` preset; `look` is where it looks at the start. Click, scroll, a key or the button skips it.
  intro: {
    seconds: 6.5,
    path: [[255, 52, 345], [150, 64, 290], [62, 118, 262]], look: [70, 4, 40],
    mobile: { path: [[290, 70, 420], [170, 96, 360], [70, 170, 330]], look: [60, 4, 60] },
  },

  // Drifting cloud shadows (strength per look: `cloudShadow`). size = metres per cloud patch, wind = drift in m/s [x, z],
  // cover = 0–1 share of the ground in shade, soft = edge softness.
  clouds: { size: 210, wind: [5.5, 2.2], cover: 0.4, soft: 0.2 },

  // Moving cars: they drive `inbound` (road centreline, [x, z]) from the south gate up to the ring-road junction, go once
  // round `loop`, and leave the way they came on the other side of the road. lane = offset to the left of travel (m).
  // Junction corners and the hairpin carry extra points so the driving line is a round arc, not a sharp corner.
  traffic: {
    count: QUALITY.cars, speed: 7.5, cornerSpeed: 3, lane: 1.75,
    inbound: [[37.5, 78.75], [39, 58.5], [45, 42], [55.5, 22.5], [67.5, 0], [78, -19.2], [87, -36],
      [88.5, -38.9], [89.3, -42], [88.5, -45.2], [86.2, -47.5], [83, -48.3], [79.9, -47.5], [77.5, -45.2], // hairpin
      [67.5, -37.2], [52.5, -21.75], [36, -7.5], [22.5, -1.8], [6, 3], [-3.8, 6.4], [-8.1, 6], [-11.3, 3.2], [-13.2, -1.2]],
    loop: [[-16.5, -5.9], [-20.9, -6.9], [-28.5, -5.25], [-42, -3], [-57, -4.2], [-65.7, -15], [-67.5, -28.5], [-61.2, -42.3], [-48, -52.8],
      [-30, -57.9], [-13.5, -55.2], [0, -46.8], [7.8, -36], [9, -21.3], [0, -11.7], [-9.2, -9.6], [-12.6, -6.8]],
    colors: [0xe4e4e0, 0x979ba0, 0x1b1d20, 0x7c1d18, 0x243f69], // used only if the model has no `Cars_*` meshes to copy
  },
  // A loose flock of egrets circling the valley: path radii [x, z] in metres around the site centre, flight height (world Y).
  // span = wing tip to wing tip in metres (larger than life so the birds still read from the aerial view).
  birds: { count: 7, radius: [125, 85], height: 46, speed: 9, span: 2.6, color: 0xc9c6bc },

  // Camera effects. bloom/tiltShift/aberration run on the desktop tier only; vignette + grain everywhere.
  post: {
    bloom: { strength: 0.22, radius: 0.75, threshold: 1.5 },   // threshold is in scene (HDR) brightness: only sun glints bloom
    tiltShift: { blur: 5.5, band: 0.2, falloff: 0.34 },         // blur in CSS px at the frame edge; band = sharp half-height (0–0.5)
    vignette: 0.34, grain: 0.035, aberration: 0.45,             // aberration in px at the corners
  },
  // Atmosphere shape (colours/density come from the look's `haze`).
  // heightFalloff: metres over which the distance haze thins with altitude.
  // valley: ground-hugging mist below `top` (world Y), fading over `falloff` metres, thickening over `reach` metres of view distance.
  atmosphere: { heightFalloff: 140, valley: { top: -10, falloff: 6, reach: 260 }, ridges: true },
  // Ambient occlusion (ultra / high tiers): radius in metres, intensity 0–1; sample count comes from the tier
  ao: { radius: 3.2, intensity: 0.85, thickness: 1.2 },
  // sky / fog / sun / hemi / env / exposure / grade come from the active look (see LOOKS below)
  ...LOOK,
  toneMapping: 'agx', // 'agx' | 'neutral' | 'aces'

  mist: { ringMin: 105, ringMax: 240, heightMin: 30, heightMax: 85, sizeMin: 110, sizeMax: 210, drift: 0.006, fadeNear: 45, fadeFar: 150 },
};
