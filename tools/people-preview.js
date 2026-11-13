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
  const people = buildPeople();
  people.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  scene.add(people);
  let tris = 0;
  people.traverse((o) => { if (o.isMesh) tris += o.geometry.attributes.position.count / 3; });
  log(`People added: ${Math.round(tris)} triangles`);

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
  window.__preview = { shoot, out, hero, people };
}

run().catch((err) => { log(`Failed: ${err.message}`); window.__preview = { error: String(err) }; console.error(err); });
