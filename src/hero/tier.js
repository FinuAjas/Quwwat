/**
 * Quality-tier choice (ultra / high / low). Deliberately free of three.js: it runs in the small
 * bootstrap script, before any of the 3D code is downloaded.
 *
 *  - `?tier=ultra|high|low` in the address bar always wins.
 *  - Otherwise a short GPU benchmark (well under a second, first visit only — the result is remembered,
 *    except a slow one, which is re-measured on the next visit)
 *    decides: desktops get ultra / high / low, phones and tablets get high / low.
 *  - If the benchmark cannot run, the old rule applies: touch or small screens → low, everything else → high.
 *  - Devices with no graphics acceleration (software rendering) are flagged `tooSlow`: main.js keeps the poster
 *    for them and offers the 3D scene behind a button, because it would crawl or crash the tab.
 */
const TIERS = ['ultra', 'high', 'low'];
const STORE_KEY = 'mc-hero-tier-v2';
// Median milliseconds for one benchmark batch (see `benchmark`). Faster than `fast` = strong GPU, slower than `slow` = weak GPU.
// Only calibrated on one machine so far (RTX 5050 laptop: 0.8 ms); adjust once more devices have been measured (?debug logs the result).
// Slower than `tooSlow`, or software rendering (no GPU at all): the 3D scene is not started automatically.
export const BENCH = { fast: 2.5, slow: 16, tooSlow: 150, maxMs: 350, samples: 12, draws: 8, size: 512 };

const forced = new URLSearchParams(location.search).get('tier');
const handheld = matchMedia('(pointer: coarse)').matches || Math.min(screen.width, screen.height) < 820;
const fallback = handheld ? 'low' : 'high';
let chosen = TIERS.includes(forced) ? forced : null;

/** The tier in use. Before `pickTier()` has run this is the forced tier or the screen-size rule. */
export const getTier = () => chosen ?? fallback;

export function hasWebGL2() {
  try {
    const gl = document.createElement('canvas').getContext('webgl2');
    gl?.getExtension('WEBGL_lose_context')?.loseContext();
    return !!gl;
  } catch { return false; }
}

/**
 * Times a fixed fragment-shader workload on a hidden canvas: `draws` full-canvas passes of a 48-step
 * loop per sample, each sample ended by a 1-pixel read-back so the GPU must actually finish.
 * Returns { ms (median per sample), renderer, software } or null when WebGL 2 is unavailable.
 */
export function benchmark() {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = BENCH.size;
  let gl = null;
  try { gl = canvas.getContext('webgl2', { antialias: false, alpha: false, powerPreference: 'high-performance' }); } catch { /* blocked */ }
  if (!gl) return null;
  try {
    const dbg = gl.getExtension('WEBGL_debug_renderer_info');
    const renderer = String(dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER));
    const software = /swiftshader|llvmpipe|software|basic render/i.test(renderer);
    // No GPU at all: the answer is already known, and the workload below would block the page for about a second
    // on a software renderer (Lighthouse measured a 930 ms long task here).
    if (software) return { ms: Infinity, renderer, software };
    const compile = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); return s; };
    const prog = gl.createProgram();
    gl.attachShader(prog, compile(gl.VERTEX_SHADER, `#version 300 es
      void main() { vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2)); gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0); }`));
    gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, `#version 300 es
      precision highp float; uniform float uSeed; out vec4 o;
      void main() {
        vec2 p = gl_FragCoord.xy * 0.013 + uSeed; float a = 0.0;
        for (int i = 0; i < 48; i++) { p = vec2(sin(p.y * 1.7 + float(i)), cos(p.x * 1.3 - a)) * 1.1 + p * 0.31; a += fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
        o = vec4(vec3(a / 48.0), 1.0);
      }`));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return null;
    gl.useProgram(prog);
    gl.bindVertexArray(gl.createVertexArray());
    const seed = gl.getUniformLocation(prog, 'uSeed'), px = new Uint8Array(4);
    const batch = (k, draws = BENCH.draws) => {
      const t0 = performance.now();
      for (let j = 0; j < draws; j++) { gl.uniform1f(seed, k + j * 0.37); gl.drawArrays(gl.TRIANGLES, 0, 3); }
      gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
      return performance.now() - t0;
    };
    // Warm-up (shader compile, first-use costs) with a single pass first. If one pass alone is already past the
    // "too slow" mark, stop: a full measurement would hold the page up for seconds. (One pass also carries the
    // fixed cost of the read-back, so it is only compared as it is, never scaled up to a full batch.)
    batch(0, 1);
    const probe = batch(1, 1);
    if (probe > BENCH.tooSlow) return { ms: probe * BENCH.draws, renderer, software };
    batch(2);
    const times = [], start = performance.now();
    while (times.length < BENCH.samples && performance.now() - start < BENCH.maxMs) times.push(batch(times.length + 3));
    times.sort((a, b) => a - b);
    return { ms: times[times.length >> 1], renderer, software };
  } catch {
    return null;
  } finally {
    gl.getExtension('WEBGL_lose_context')?.loseContext();
  }
}

/** Decide the tier once (forced → remembered → benchmark → screen-size rule). Call before loading the 3D code. */
export function pickTier() {
  if (chosen) return { tier: chosen, source: 'forced' };
  try {
    const saved = JSON.parse(localStorage.getItem(STORE_KEY) ?? sessionStorage.getItem(STORE_KEY) ?? 'null');
    if (TIERS.includes(saved?.tier)) { chosen = saved.tier; return { ...saved, source: 'remembered' }; }
  } catch { /* storage blocked or corrupt: measure again */ }
  const b = benchmark();
  if (!b) { chosen = fallback; return { tier: chosen, source: 'screen-size rule' }; }
  const speed = b.software || b.ms > BENCH.slow ? 'slow' : b.ms < BENCH.fast ? 'fast' : 'medium';
  chosen = handheld ? (speed === 'fast' ? 'high' : 'low') : { fast: 'ultra', medium: 'high', slow: 'low' }[speed];
  const result = { tier: chosen, ms: Number.isFinite(b.ms) ? Math.round(b.ms * 100) / 100 : null, renderer: b.renderer, tooSlow: b.software || b.ms > BENCH.tooSlow };
  // A tab opened in the background can measure many times slower than the GPU really is, so a slow result
  // is only kept for this visit and measured again next time; fast and medium results are remembered.
  try { (speed === 'slow' ? sessionStorage : localStorage).setItem(STORE_KEY, JSON.stringify(result)); } catch { /* private mode */ }
  return { ...result, source: 'benchmark' };
}
