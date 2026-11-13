import { PLAN3_AREA_PX, PX } from '../src/model/layout.js';

/**
 * Plan 3 snapshot tool (docs/IMPLEMENTATION_PLAN_3.md, tasks P3.1 and P3.8).
 *
 * Loads the real page in a hidden frame, waits for the whole model, then takes the scene over:
 *  - stops the animation loop and pins every clock to one fixed time (wind, water, cloud shadows)
 *  - hides everything that is random or moving: mist, cars, birds, grass tufts, fountain droplets
 *  - renders straight to the canvas at fixed pixel sizes, without post-processing (no blur, bloom or
 *    ambient occlusion, which would smear a local change across its neighbours)
 * The "strict" views also switch sun shadows off, so a change inside the work area cannot show up outside it
 * as a moved shadow. Two "beauty" views keep the shadows, for looking at.
 *
 * Views: the layout frame from straight above (1 image pixel = 1 layout pixel, so the render and the area
 * outline overlay directly), a wider top view that includes the surrounding forest, the three camera presets
 * and one view per hotspot. Each image is the median of five frames; the tool reports how many pixels flickered
 * between frames and how many differ from the previous run, which is the tolerance the comparison must allow.
 */
const params = new URLSearchParams(location.search);
const SET = params.get('set') === 'after' ? 'after' : 'before';
const T = 1000;                       // the frozen scene time, in seconds
const HIDE = ['Mist', 'Traffic', 'Birds', 'Grass', 'HotspotRing', 'Fountain_Particles'];
const SKIP_COUNT = new Set([...HIDE, 'SkyDome', 'Ridges']);
const LAYOUT = { w: 1600, h: 1203 };  // the layout / render frame, in pixels
const VIEW = { w: 1280, h: 800 };

const logEl = document.getElementById('log'), shotsEl = document.getElementById('shots');
const log = (msg, cls) => { logEl.innerHTML += `\n${cls ? `<span class="${cls}">` : ''}${msg}${cls ? '</span>' : ''}`; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const hex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
const sha = async (data) => hex(await crypto.subtle.digest('SHA-256', data));

async function post(name, body) {
  const res = await fetch(`/api/save-snapshot?set=${SET}&name=${name}`, { method: 'POST', body });
  if (!res.ok) throw new Error(`saving ${name} failed: ${res.status}`);
}

async function run() {
  logEl.textContent = `Set: ${SET}\nLoading the page…`;
  const previous = await fetch(`./plan3/${SET}/manifest.json`).then((r) => (r.ok ? r.json() : null)).catch(() => null);

  // ---- the real page, in a frame ----
  const frame = document.createElement('iframe');
  frame.src = '../index.html?tier=high';
  document.body.appendChild(frame);
  let hero = null;
  for (let i = 0; i < 600 && !hero; i++) { await sleep(200); hero = frame.contentWindow.__hero; }
  if (!hero) throw new Error('the 3D scene did not start within 2 minutes');
  await hero.partsReady;
  await sleep(2500); // let the page finish its own preset thumbnails
  const win = frame.contentWindow;
  // Import through a module script inside the frame, so these are the page's own module instances
  // (the same three.js build and the same config object the scene was built from).
  const fromPage = (spec) => new Promise((resolve, reject) => {
    const key = `__plan3_${Math.random().toString(36).slice(2)}`;
    const s = win.document.createElement('script');
    s.type = 'module';
    s.textContent = `import * as m from ${JSON.stringify(spec)}; window[${JSON.stringify(key)}] = m; window.dispatchEvent(new Event(${JSON.stringify(key)}));`;
    win.addEventListener(key, () => resolve(win[key]), { once: true });
    s.onerror = () => reject(new Error(`could not import ${spec} in the page`));
    win.document.head.appendChild(s);
  });
  const THREE = await fromPage('three');
  const { renderer, scene, camera, lights, site, foliage, hotspots } = hero;
  const configModule = await fromPage('./src/hero/config.js');
  const CONFIG = configModule.CONFIG;

  // ---- freeze ----
  renderer.setAnimationLoop(null);
  hotspots.clear?.();
  for (const name of HIDE) { const o = scene.getObjectByName(name); if (o) o.visible = false; }
  lights.update(T);
  site.update(T);
  camera.updateMatrixWorld();
  foliage.update(T - 5, camera); foliage.update(T, camera); // finishes the forest's grow-in animation, if it was running
  log(`Scene frozen at t = ${T} s; hidden: ${HIDE.join(', ')}`);

  // ---- cameras ----
  const top = (scale) => {
    const hw = (LAYOUT.w * PX * scale) / 2, zTop = -600 * PX * scale, zBottom = (LAYOUT.h - 600) * PX * scale;
    const cam = new THREE.OrthographicCamera(-hw, hw, -zTop, -zBottom, 1, 900);
    cam.position.set(0, 260, 0); cam.up.set(0, 0, -1); cam.lookAt(0, 0, 0); // north (−Z) is up, like the layout image
    cam.layers.mask = camera.layers.mask;
    return cam;
  };
  const persp = (target, position) => {
    const cam = new THREE.PerspectiveCamera(CONFIG.camera.fov, VIEW.w / VIEW.h, CONFIG.camera.near, CONFIG.camera.far);
    cam.position.fromArray(position); cam.lookAt(new THREE.Vector3().fromArray(target));
    cam.layers.mask = camera.layers.mask;
    return cam;
  };
  const views = [];
  const add = (name, cam, size, extra = {}) => views.push({ name, cam, ...size, ...extra });
  add('top', top(1), LAYOUT, { kind: 'top', layoutScale: 1 });
  add('top-wide', top(2), LAYOUT, { kind: 'top', layoutScale: 2 });
  for (const [name, p] of Object.entries(CONFIG.presets)) add(`preset-${name}`, persp(p.target, p.position), VIEW, { kind: 'preset' });
  const dir = new THREE.Vector3(0.35, 0.75, 0.9).normalize();
  for (const s of hotspots.spots) {
    const dist = THREE.MathUtils.clamp(s.sphere.radius * 3.4, 45, 150);
    add(`spot-${s.id}`, persp(s.sphere.center.toArray(), s.sphere.center.clone().addScaledVector(dir, dist).toArray()), VIEW, { kind: 'hotspot' });
  }

  // ---- capture ----
  const shoot = (v) => {
    renderer.setPixelRatio(1);
    renderer.setSize(v.w, v.h, false);
    v.cam.updateMatrixWorld();
    foliage.update(T, v.cam);
    renderer.setRenderTarget(null);
    renderer.render(scene, v.cam);
    const c = document.createElement('canvas'); c.width = v.w; c.height = v.h;
    const g = c.getContext('2d', { willReadFrequently: true });
    g.drawImage(renderer.domElement, 0, 0); // same task as the render: the drawing buffer is still intact
    return { canvas: c, pixels: g.getImageData(0, 0, v.w, v.h).data };
  };
  const records = [];
  // Pixels that differ between two RGBA buffers: how many, and the box they fall in.
  const diff = (p, q, w) => {
    let n = 0, strong = 0, worst = 0, x0 = Infinity, y0 = Infinity, x1 = -1, y1 = -1;
    for (let i = 0; i < p.length; i += 4) {
      const d = Math.max(Math.abs(p[i] - q[i]), Math.abs(p[i + 1] - q[i + 1]), Math.abs(p[i + 2] - q[i + 2]));
      if (!d) continue;
      const k = i / 4, x = k % w, y = (k - x) / w;
      n++; if (d > STRONG) strong++; if (d > worst) worst = d;
      if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
    }
    // strong = pixels off by more than STRONG levels (of 255) in some channel; worst = the largest difference seen
    return { pixels: n, strong, worst, box: n ? [x0, y0, x1, y1] : null };
  };
  const loadPixels = async (url, w, h) => {
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) return null;
    const bmp = await createImageBitmap(await res.blob(), { colorSpaceConversion: 'none', premultiplyAlpha: 'none' });
    if (bmp.width !== w || bmp.height !== h) return null;
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const g = c.getContext('2d', { willReadFrequently: true });
    g.drawImage(bmp, 0, 0);
    return g.getImageData(0, 0, w, h).data;
  };
  const FRAMES = 5, STRONG = 24;
  async function capture(v, file, shadows) {
    // The GPU does not draw every frame bit-for-bit alike: a few scattered pixels (tens in a million) flicker
    // between two states even with the scene frozen. So each view is the per-pixel median of five frames,
    // and the flicker that was seen is recorded as this view's noise level.
    const shots = [];
    for (let i = 0; i < FRAMES; i++) shots.push(shoot(v));
    let noise = 0;
    for (let i = 1; i < FRAMES; i++) noise = Math.max(noise, diff(shots[i - 1].pixels, shots[i].pixels, v.w).pixels);
    const out = shots[0].canvas, g = out.getContext('2d'), img = g.getImageData(0, 0, v.w, v.h), px = img.data, five = new Uint8Array(FRAMES);
    if (noise) {
      for (let i = 0; i < px.length; i++) {
        if ((i & 3) === 3) continue;
        const a = shots[0].pixels[i];
        let same = true;
        for (let k = 1; k < FRAMES; k++) if (shots[k].pixels[i] !== a) { same = false; break; }
        if (same) continue;
        for (let k = 0; k < FRAMES; k++) five[k] = shots[k].pixels[i];
        five.sort();
        px[i] = five[FRAMES >> 1];
      }
      g.putImageData(img, 0, 0);
    }
    const hash = await sha(px);
    // how far this run is from the previous run of the same set (a fresh page load): the tolerance P3.8 has to allow
    const old = previous?.views?.some((r) => r.file === file) ? await loadPixels(`./plan3/${SET}/${file}`, v.w, v.h) : null;
    const drift = old ? diff(old, px, v.w) : null;
    const blob = await new Promise((r) => out.toBlob(r, 'image/png'));
    await post(file, blob);
    const rec = {
      name: v.name, file, kind: v.kind, shadows, width: v.w, height: v.h, layoutScale: v.layoutScale, kb: Math.round(blob.size / 1024),
      hash, framesAveraged: FRAMES, noisePixels: noise, driftFromPreviousRun: drift,
      camera: { type: v.cam.isOrthographicCamera ? 'orthographic' : 'perspective', projection: v.cam.projectionMatrix.toArray(), view: v.cam.matrixWorldInverse.toArray() },
    };
    records.push(rec);
    const fig = document.createElement('figure');
    fig.innerHTML = `<img src="${URL.createObjectURL(blob)}" alt="" /><figcaption>${file} · ${rec.kb} KB · flicker ${noise} px${drift ? ` · ${drift.pixels} px from last run` : ''}</figcaption>`;
    shotsEl.appendChild(fig);
  }

  log('Beauty views (sun shadows on)…');
  for (const v of views.filter((x) => x.name === 'top' || x.name === 'preset-aerial')) await capture(v, `beauty-${v.name}.png`, true);
  lights.sun.castShadow = false; // strict views: no shadow can cross the edge of the work area
  log('Strict views (sun shadows off)…');
  for (const v of views) await capture(v, `${v.name}.png`, false);

  // ---- what the model is made of (compared again after the change) ----
  const meshes = [];
  scene.traverse((o) => {
    if (!o.isMesh || !o.name) return;
    const path = [];
    for (let p = o.parent; p && p !== scene; p = p.parent) if (p.name) path.unshift(p.name);
    if (SKIP_COUNT.has(o.name) || path.some((n) => SKIP_COUNT.has(n))) return;
    const g = o.geometry, tris = Math.round((g.index ? g.index.count : g.attributes.position.count) / 3);
    meshes.push({ path: path.join('/'), name: o.name, triangles: tris, instances: o.isInstancedMesh ? o.count : 1 });
  });
  meshes.sort((a, b) => (a.path + a.name).localeCompare(b.path + b.name));
  const groups = {};
  for (const m of meshes) {
    const key = m.path.split('/').slice(0, 3).join('/') || '(root)';
    const g = (groups[key] ??= { meshes: 0, triangles: 0, instances: 0 });
    g.meshes++; g.triangles += m.triangles * m.instances; g.instances += m.instances;
  }
  const models = [];
  for (const url of [CONFIG.models.core, ...(CONFIG.models.extras ?? [])]) {
    const buf = await (await fetch(new URL(url, new URL('../', location.href)))).arrayBuffer();
    models.push({ file: url.split('/').pop(), bytes: buf.byteLength, sha256: await sha(buf) });
  }

  const manifest = {
    set: SET, created: new Date().toISOString(), commit: params.get('commit') ?? null,
    capture: { tier: 'high', look: configModule.LOOK_NAME, time: T, hidden: HIDE, postProcessing: false },
    layout: { pxToMetres: PX, originPx: [800, 600], frame: LAYOUT, note: 'top.png: 1 image pixel = 1 layout pixel; top-wide.png: 1 image pixel = 2 layout pixels, same centre' },
    areaPx: PLAN3_AREA_PX,
    views: records, models, groups, meshes,
  };
  await post('manifest.json', new Blob([JSON.stringify(manifest, null, 1)], { type: 'application/json' }));

  const total = (w) => records.reduce((n, r) => n + w(r), 0);
  const worstNoise = Math.max(...records.map((r) => r.noisePixels));
  const drifts = records.filter((r) => r.driftFromPreviousRun).map((r) => ({ file: r.file, pixels: r.driftFromPreviousRun.pixels, strong: r.driftFromPreviousRun.strong, worst: r.driftFromPreviousRun.worst }));
  log(`Saved ${records.length} images + manifest.json to tools/plan3/${SET}/ (${Math.round(total((r) => r.kb) / 1024)} MB)`, 'ok');
  log(`Frame-to-frame flicker: at most ${worstNoise} pixels in any view (each image is the median of ${FRAMES} frames).`);
  if (drifts.length) log(`Against the previous ${SET} run (fresh page load): at most ${Math.max(...drifts.map((d) => d.pixels))} pixels differ in any view.`);
  window.__snapshot = { set: SET, images: records.length, worstNoise, noise: records.map((r) => [r.file, r.noisePixels]), drifts, hadPrevious: !!previous, models, groups };
}

run().catch((err) => { log(`Failed: ${err.message}`, 'bad'); window.__snapshot = { error: String(err) }; console.error(err); });
