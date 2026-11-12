// Central tuning for the hero scene. World units are metres; site centre ≈ (15, 0, 0).
const coarse = matchMedia('(pointer: coarse)').matches;
const small = Math.min(screen.width, screen.height) < 820;
// Force a tier for testing from the address bar: ?tier=high or ?tier=low
const forcedTier = new URLSearchParams(location.search).get('tier');
export const TIER = forcedTier === 'high' || forcedTier === 'low' ? forcedTier : coarse || small ? 'low' : 'high';

export const QUALITY = {
  high: { pixelRatio: 2, antialias: true, msaa: 4, ao: true, bloom: true, dof: true, shadows: true, shadowMapSize: 4096, mistCount: 26 },
  low: { pixelRatio: 1.5, antialias: true, msaa: 2, ao: false, bloom: false, dof: false, shadows: true, shadowMapSize: 2048, mistCount: 14 },
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
    exposure: 1.55, mistColor: 0xb4ada0, mistOpacity: 0.42,
    grade: { contrast: 0.14, saturation: 1.14, greenDesat: 0.2, shadows: [0.93, 0.99, 1.09], highlights: [1.08, 1.01, 0.9], lift: 0.0, gain: 1.0 },
  },
  midday: { // high neutral sun, crisp and clear
    sky: { top: 0x6f9fd0, horizon: 0xd6e4ea, bottom: 0xc9d6cf },
    fog: { color: 0xcfdde0, near: 400, far: 1100 },
    sun: { color: 0xfff3e0, intensity: 3.6, position: [-90, 300, -60], shadowExtent: 150, shadowFar: 700 },
    hemi: { sky: 0xd4e6ff, ground: 0x3e4f26, intensity: 0.9 },
    env: { intensity: 0.6, skyBoost: 1.25, ground: 0x3a4a25, sunGlow: 0.7 },
    exposure: 1.4, mistColor: 0xb9c0c2, mistOpacity: 0.42,
    grade: { contrast: 0.12, saturation: 1.12, greenDesat: 0.18, shadows: [0.97, 1.0, 1.05], highlights: [1.02, 1.01, 0.97], lift: 0.0, gain: 1.0 },
  },
  overcast: { // soft, shadowless monsoon light
    sky: { top: 0xb7c2ca, horizon: 0xd9dee0, bottom: 0xc9cfce },
    fog: { color: 0xcdd3d3, near: 330, far: 980 },
    sun: { color: 0xe6edf2, intensity: 1.1, position: [-120, 260, -80], shadowExtent: 150, shadowFar: 700 },
    hemi: { sky: 0xe2e8ef, ground: 0x565f4a, intensity: 1.55 },
    env: { intensity: 0.8, skyBoost: 1.15, ground: 0x4a5340, sunGlow: 0.08 },
    exposure: 1.4, mistColor: 0xb4b9ba, mistOpacity: 0.42,
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
  shadowsFor: (mesh) => TIER === 'high' || !mesh.userData.vegetation,
  perf: { minPixelRatio: 1, step: 0.25, slowMs: 24, fastMs: 13, sampleFrames: 90 },
  camera: {
    fov: 35, near: 1, far: 3000,
    target: [18, 0, 4],
    position: [-6, 190, 205],   // from the south, ~45° down — like the reference aerial
    viewShift: 0.09,            // shift the frame right so the hero copy sits over forest (desktop only)
  },

  controls: {
    damping: 0.06,
    minPolar: 20, maxPolar: 72,         // degrees from straight down
    minDistance: 35, maxDistance: 480,
    groundClearance: 9,                 // metres the camera stays above the terrain
    panBounds: { minX: -110, maxX: 140, minZ: -100, maxZ: 110 },
    rotateSpeed: 0.55, zoomSpeed: 0.9, panSpeed: 0.8,
    autoRotateSpeed: 0.35, idleSeconds: 9,
    introSeconds: 3.4,
  },

  // Camera presets: [target], [position]. `mobile` overrides apply to portrait/narrow screens.
  presets: {
    aerial: { target: [18, 0, 4], position: [-6, 190, 205], mobile: { target: [10, 0, 34], position: [0, 240, 250] } },
    'main-building': { target: [-28, 8, -22], position: [8, 46, 32], mobile: { target: [-28, 8, -10], position: [0, 75, 60] } },
    recreation: { target: [-52, 7, -34], position: [-62, 38, 22], mobile: { target: [-52, 7, -20], position: [-58, 70, 55] } },
  },
  intro: { from: { target: [18, 0, 4], position: [-260, 330, 300] }, mobile: { target: [8, 0, 32], position: [-300, 420, 420] } },

  // Camera effects. bloom/tiltShift/aberration run on the desktop tier only; vignette + grain everywhere.
  post: {
    bloom: { strength: 0.22, radius: 0.75, threshold: 1.5 },   // threshold is in scene (HDR) brightness: only sun glints bloom
    tiltShift: { blur: 5.5, band: 0.2, falloff: 0.34 },         // blur in CSS px at the frame edge; band = sharp half-height (0–0.5)
    vignette: 0.34, grain: 0.035, aberration: 0.45,             // aberration in px at the corners
  },
  // Ambient occlusion (desktop tier): radius in metres, intensity 0–1
  ao: { radius: 3.2, intensity: 0.85, samples: 12, thickness: 1.2 },
  // sky / fog / sun / hemi / env / exposure / grade come from the active look (see LOOKS below)
  ...LOOK,
  toneMapping: 'agx', // 'agx' | 'neutral' | 'aces'

  mist: { ringMin: 105, ringMax: 240, heightMin: 30, heightMax: 85, sizeMin: 110, sizeMax: 210, opacity: 0.7, drift: 0.006 },
};
