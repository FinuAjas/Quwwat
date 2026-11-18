/**
 * Early downloads (no three.js). main.js calls `prefetchHero()` the moment it decides to show the 3D scene, so
 * the model files and the three.js library download alongside the scene code instead of after it: without
 * this, the .glb requests only went out once app.js, three.js and every module they import had arrived.
 * loader.js then takes the downloaded bytes with `takePrefetched()` (and falls back to its own request if a
 * prefetch failed).
 */

// `core` (terrain, roads, buildings, cars, hotspots) is shown as soon as it has loaded; the `extras` download at the
// same time and are added as they arrive. tools/model-builder.html writes all three files.
// An artist model delivered as one file: set extras to [].
export const MODELS = {
  core: './public/models/mountain-courtyard.glb',
  extras: ['./public/models/mountain-courtyard-vegetation.glb', './public/models/mountain-courtyard-details.glb'],
};

// Modules app.js needs from the CDN. Preloaded in parallel instead of being discovered one import level at a time.
// Must match the import map in index.html; a stale entry only costs a wasted request.
const THREE_BASE = 'https://cdn.jsdelivr.net/npm/three@0.170.0/';
const THREE_MODULES = [
  'build/three.module.js',
  'examples/jsm/loaders/GLTFLoader.js',
  'examples/jsm/controls/OrbitControls.js',
  'examples/jsm/postprocessing/EffectComposer.js',
  'examples/jsm/postprocessing/GTAOPass.js',
  'examples/jsm/postprocessing/UnrealBloomPass.js',
  'examples/jsm/renderers/CSS2DRenderer.js',
];

const pending = new Map(); // absolute URL -> { buffer: Promise<ArrayBuffer>, progress }
let started = false;

/** Start the model downloads and preload three.js. Safe to call more than once. */
export function prefetchHero() {
  if (started) return;
  started = true;
  for (const path of THREE_MODULES) {
    const link = document.createElement('link');
    link.rel = 'modulepreload';
    link.crossOrigin = 'anonymous';
    link.href = THREE_BASE + path;
    document.head.appendChild(link);
  }
  for (const path of [MODELS.core, ...MODELS.extras]) {
    const url = new URL(path, document.baseURI).href;
    const entry = { progress: null };
    entry.buffer = download(url, entry);
    entry.buffer.catch(() => {}); // loader.js retries with its own request
    pending.set(url, entry);
  }
}

/**
 * The prefetched bytes of `url` as { buffer, onProgress(fn) }, or null if it was never prefetched.
 * Each file can be taken once (the memory is released to the loader).
 */
export function takePrefetched(url) {
  const entry = pending.get(url);
  if (!entry) return null;
  pending.delete(url);
  return { buffer: entry.buffer, onProgress: (fn) => { entry.progress = fn; } };
}

async function download(url, entry) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} for ${url}`);
  // With gzip the Content-Length is the compressed size while the stream yields uncompressed bytes,
  // so prefer the dev server's uncompressed length and clamp the fraction.
  const total = Number(res.headers.get('X-Uncompressed-Length') || res.headers.get('Content-Length')) || 0;
  if (!res.body || !total) return res.arrayBuffer();
  const reader = res.body.getReader();
  const chunks = [];
  let loaded = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    loaded += value.byteLength;
    entry.progress?.(Math.min(0.99, loaded / total));
  }
  const out = new Uint8Array(loaded);
  let at = 0;
  for (const c of chunks) { out.set(c, at); at += c.byteLength; }
  return out.buffer;
}
