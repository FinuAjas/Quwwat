/**
 * People preview: loads the real page in a hidden frame, adds the figures from src/model/people.js to the live
 * scene (they are not part of the exported model yet) and renders stills through the page's full post-processing.
 * Saves them to docs/previews/ through serve.py. `window.__preview.shoot({ name, target, position, fov })` re-renders
 * one view by hand.
 */
const SIZE = [1920, 1200], T = 1000;
const SHOTS = [
  { name: 'people-play-area', target: [-75, 8.3, -31.6], position: [-65.5, 13.8, -18], fov: 35 },
  { name: 'people-wedding', target: [-33.4, 5.4, 8.6], position: [-45.8, 17.6, -4.8], fov: 33 },
];
/**
 * Triangles, vertices and the download cost of a group, laid out the way the model files store it: positions
 * float32, normals int8 and colours uint16 (tools/glb_quantize.py), indices uint16 or uint32, then gzip.
 */
async function measure(group) {
  const chunks = [], rows = [];
  let tris = 0, verts = 0;
  group.traverse((o) => {
    if (!o.isMesh) return;
    const g = o.geometry, n = g.attributes.position.count, t = (g.index ? g.index.count : n) / 3;
    tris += t; verts += n; rows.push(`${o.name} ${Math.round(t)}`);
    chunks.push(new Float32Array(g.attributes.position.array));
    const nr = g.attributes.normal?.array, cl = g.attributes.color?.array;
    if (nr) { const q = new Int8Array(n * 4); for (let i = 0; i < n; i++) for (let k = 0; k < 3; k++) q[i * 4 + k] = Math.round(nr[i * 3 + k] * 127); chunks.push(q); }
    if (cl) { const q = new Uint16Array(n * 4); for (let i = 0; i < n; i++) for (let k = 0; k < 3; k++) q[i * 4 + k] = Math.round(cl[i * 3 + k] * 65535); chunks.push(q); }
    if (g.index) chunks.push(n < 65536 ? new Uint16Array(g.index.array) : new Uint32Array(g.index.array));
  });
  const blob = new Blob(chunks);
  const gz = (await new Response(blob.stream().pipeThrough(new CompressionStream('gzip'))).arrayBuffer()).byteLength;
  const kb = (b) => Math.round(b / 1024);
  return { tris: Math.round(tris), verts, rawKB: kb(blob.size), gzKB: kb(gz), text: `${Math.round(tris)} triangles (${rows.join(', ')}), ${verts} vertices, ${kb(blob.size)} KB stored, ${kb(gz)} KB gzipped` };
}

const logEl = document.getElementById('log'), shotsEl = document.getElementById('shots');
const log = (msg) => { logEl.textContent += `\n${msg}`; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function run() {
  const frame = document.createElement('iframe');
  frame.src = '../index.html?tier=ultra';
  document.body.appendChild(frame);
  let hero = null;
  for (let i = 0; i < 600 && !hero; i++) { await sleep(200); hero = frame.contentWindow.__hero; }
  if (!hero) throw new Error('the 3D scene did not start within 2 minutes');
  await hero.partsReady;
  await sleep(2500);
  const win = frame.contentWindow;
  const fromPage = (spec) => new Promise((resolve, reject) => {
    const key = `__people_${Math.random().toString(36).slice(2)}`;
    const s = win.document.createElement('script');
    s.type = 'module';
    s.textContent = `import * as m from ${JSON.stringify(spec)}; window[${JSON.stringify(key)}] = m; window.dispatchEvent(new Event(${JSON.stringify(key)}));`;
    win.addEventListener(key, () => resolve(win[key]), { once: true });
    s.onerror = () => reject(new Error(`could not import ${spec} in the page`));
    win.document.head.appendChild(s);
  });
  const THREE = await fromPage('three');
  const { buildPeople } = await fromPage(`./src/model/people.js?v=${Date.now()}`);
  const { renderer, scene, camera, lights, site, foliage, hotspots, post, grass } = hero;

  renderer.setAnimationLoop(null);
  hotspots.clear?.();
  for (const name of ['HotspotRing', 'Mist']) { const o = scene.getObjectByName(name); if (o) o.visible = false; }
  // the benches the model really has (instanced mesh in the details file), as world { x, y, z, yaw }
  const benches = [], benchMesh = scene.getObjectByName('Benches');
  if (benchMesh) {
    const m = new THREE.Matrix4();
    benchMesh.updateWorldMatrix(true, false);
    for (let i = 0; i < benchMesh.count; i++) {
      benchMesh.getMatrixAt(i, m); m.premultiply(benchMesh.matrixWorld);
      const e = m.elements;
      benches.push({ x: e[12], y: e[13], z: e[14], yaw: Math.atan2(e[8], e[10]) });
    }
  }
  log(`Benches in the model: ${benches.length}`);
  // Since H4 the model files carry their own people: hide them and show the ones built from src/model/people.js.
  const loaded = scene.getObjectByName('People');
  if (loaded) { loaded.visible = false; log('The model\'s own people are hidden; showing src/model/people.js'); }
  const { group: people, counts } = buildPeople({ benches: benches.length ? benches : null });
  log(`Figures: ${counts.people}`);
  people.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  scene.add(people);
  const m = await measure(people);
  log(`People added: ${m.text}`);

  const target = new THREE.Vector3();
  async function shoot({ name, target: t, position, fov = 35 }) {
    const [w, h] = SIZE;
    renderer.setPixelRatio(1);
    renderer.setSize(w, h, false); post.setSize(w, h);
    camera.clearViewOffset(); camera.aspect = w / h; camera.fov = fov; camera.updateProjectionMatrix();
    camera.position.fromArray(position); camera.lookAt(target.fromArray(t)); camera.updateMatrixWorld();
    // sharp shadows: spend the whole shadow map on what this view looks at
    const near = people.children.reduce((a, b) => (a.position.distanceTo(target) < b.position.distanceTo(target) ? a : b));
    lights.fitShadows([near], 16);
    renderer.shadowMap.needsUpdate = true;
    for (let i = 0; i < 3; i++) {
      lights.update(T); site.update(T); grass?.update(T, camera); foliage.update(T, camera);
      post.update(T, target, 40);
      post.render();
    }
    const copy = document.createElement('canvas'); copy.width = w; copy.height = h;
    copy.getContext('2d').drawImage(renderer.domElement, 0, 0);
    const blob = await new Promise((r) => copy.toBlob(r, 'image/jpeg', 0.92));
    const res = await fetch(`/api/save-preview?name=${name}.jpg`, { method: 'POST', body: blob });
    const fig = document.createElement('figure');
    fig.innerHTML = `<img src="${URL.createObjectURL(blob)}" alt="" /><figcaption>${name}.jpg · ${Math.round(blob.size / 1024)} KB · ${res.ok ? 'saved' : `not saved (${res.status})`}</figcaption>`;
    shotsEl.prepend(fig);
    return { name, kb: Math.round(blob.size / 1024), saved: res.ok };
  }
  const out = [];
  for (const s of SHOTS) out.push(await shoot(s));
  log(`Saved ${out.filter((o) => o.saved).length} of ${out.length} images to docs/previews/`);
  window.__preview = { shoot, out, hero, people, benches, measure: () => measure(people) };
}

run().catch((err) => { log(`Failed: ${err.message}`); window.__preview = { error: String(err) }; console.error(err); });
