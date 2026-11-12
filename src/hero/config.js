// Central tuning for the hero scene. World units are metres; site centre ≈ (15, 0, 0).
const coarse = matchMedia('(pointer: coarse)').matches;
const small = Math.min(screen.width, screen.height) < 820;
export const TIER = coarse || small ? 'low' : 'high';

export const QUALITY = {
  high: { pixelRatio: 2, antialias: true, shadows: true, shadowMapSize: 4096, mistCount: 26 },
  low: { pixelRatio: 1.5, antialias: true, shadows: true, shadowMapSize: 2048, mistCount: 14 },
}[TIER];

export const CONFIG = {
  modelUrl: './public/models/mountain-courtyard.glb',
  dracoPath: 'https://cdn.jsdelivr.net/npm/three@0.170.0/examples/jsm/libs/draco/gltf/',

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

  sky: { top: 0x8fb4cf, horizon: 0xd9e4e3, bottom: 0xc9d6cf },
  fog: { color: 0xc9d8d6, near: 380, far: 1050 },

  sun: { color: 0xffe4c0, intensity: 3.3, position: [-170, 240, -70], shadowExtent: 150, shadowFar: 700 },
  hemi: { sky: 0xd4e6ff, ground: 0x3e4f26, intensity: 0.8 },
  envIntensity: 0.35,
  exposure: 1.0,

  mist: { ringMin: 105, ringMax: 240, heightMin: 30, heightMax: 85, sizeMin: 110, sizeMax: 210, opacity: 0.7, drift: 0.006 },
};
