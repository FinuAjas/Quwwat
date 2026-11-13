import * as THREE from 'three';
import { createGLTFLoader } from '../src/hero/loader.js';
import { createHeightSampler } from '../src/hero/terrainHeight.js';

// The contract from docs/BLENDER_ARTIST_BRIEF.md
const ZONES = {
  MainBuilding: 'main-building', SwimmingPool: 'swimming-pool', Amphitheater: 'amphitheater', RecreationZone: 'recreation-zone',
  PrayerHall: 'prayer-hall', Parking: 'parking', EntranceGate_South: 'gate-south', EntranceGate_West: 'gate-west',
};
const BUDGET = { tris: 1.5e6, calls: 150, materials: 40, terrainTris: 150e3, sizeMB: 10, tex: 2048, terrainTex: 4096 };

const renderer = new THREE.WebGLRenderer();
const { loader } = createGLTFLoader(renderer);
const report = document.getElementById('report'), summary = document.getElementById('summary');
const esc = (s) => String(s).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
const fmt = (n) => (n >= 1e6 ? `${(n / 1e6).toFixed(2)} M` : n >= 1e3 ? `${(n / 1e3).toFixed(1)} k` : String(Math.round(n)));

export function validate(root, sizeBytes) {
  const rows = [];
  const add = (level, check, detail = '') => rows.push({ level, check, detail });
  root.updateMatrixWorld(true);

  // ---- gather ----
  let tris = 0, calls = 0, instanced = 0, instances = 0;
  const materials = new Set(), meshes = [], geoUse = new Map(), textures = new Map();
  let shadowFlags = 0, waterFound = false, vegInstanced = 0, vegMissing = [];
  root.traverse((o) => {
    if (!o.isMesh) return;
    meshes.push(o);
    const g = o.geometry, t = (g.index ? g.index.count : g.attributes.position.count) / 3;
    const count = o.isInstancedMesh ? o.count : 1;
    tris += t * count; calls += Array.isArray(o.material) ? o.material.length : 1;
    if (o.isInstancedMesh) { instanced++; instances += o.count; o.userData.vegetation ? vegInstanced++ : (o.count > 200 && vegMissing.push(o.name)); }
    else geoUse.set(g.uuid, (geoUse.get(g.uuid) ?? []).concat(o.name));
    for (const m of [].concat(o.material)) {
      materials.add(m);
      if (m.name?.startsWith('Water')) waterFound = true;
      for (const k of ['map', 'normalMap', 'roughnessMap', 'metalnessMap', 'aoMap', 'emissiveMap', 'lightMap']) {
        const img = m[k]?.image; if (img) textures.set(m[k].uuid, { w: img.width, h: img.height, mat: m.name, slot: k, onTerrain: o.name === 'Terrain' });
      }
    }
    if (o.userData.castShadow || o.userData.receiveShadow) shadowFlags++;
  });

  // ---- terrain ----
  const terrains = meshes.filter((m) => m.name === 'Terrain');
  let heightAt = null;
  if (terrains.length !== 1) add('fail', 'Terrain mesh', `Expected exactly one mesh named "Terrain", found ${terrains.length}.`);
  else {
    const tm = terrains[0], g = tm.geometry, t = (g.index ? g.index.count : g.attributes.position.count) / 3;
    const box = new THREE.Box3().setFromObject(tm), size = box.getSize(new THREE.Vector3());
    add(t <= BUDGET.terrainTris ? 'pass' : 'warn', 'Terrain triangles', `${fmt(t)} (budget ${fmt(BUDGET.terrainTris)})`);
    add(size.x > 400 && size.x < 3000 && size.z > 400 && size.z < 3000 ? 'pass' : 'fail', 'Terrain extent / scale', `${size.x.toFixed(0)} m × ${size.z.toFixed(0)} m, height range ${size.y.toFixed(0)} m — expected ≈ 1400 m across in metres.`);
    add(Math.abs(box.getCenter(new THREE.Vector3()).x) < 150 && Math.abs(box.getCenter(new THREE.Vector3()).z) < 150 ? 'pass' : 'warn', 'Origin', 'Terrain should be roughly centred on the origin (site centre).');
    heightAt = createHeightSampler(tm);
  }

  // ---- zones & anchors ----
  const hotspotIds = new Map();
  root.traverse((o) => { if (o.userData.hotspotId && !o.name.startsWith('Hotspot_')) hotspotIds.set(o.userData.hotspotId, o); });
  for (const [name, id] of Object.entries(ZONES)) {
    const o = root.getObjectByName(name);
    if (!o) { add('fail', `Zone ${name}`, 'Object not found.'); continue; }
    let meshCount = 0; o.traverse((c) => { if (c.isMesh) meshCount++; });
    if (o.userData.hotspotId !== id) add('fail', `Zone ${name}`, `Custom property hotspotId should be "${id}" (found ${JSON.stringify(o.userData.hotspotId)}). Enable "Custom Properties" in the glTF export.`);
    else if (!meshCount) add('fail', `Zone ${name}`, 'Has no meshes inside it — nothing to click.');
    else add(o.userData.title ? 'pass' : 'warn', `Zone ${name}`, o.userData.title ? `${meshCount} mesh(es), title "${o.userData.title}"` : 'OK, but custom property "title" is missing.');
  }
  const extra = [...hotspotIds.keys()].filter((id) => !Object.values(ZONES).includes(id));
  if (extra.length) add('pass', 'Additional zones', `${extra.join(', ')} — tell the developer so pop-up text can be added.`);

  const anchorParent = root.getObjectByName('Hotspots');
  if (!anchorParent) add('fail', 'Hotspots group', 'Parent Empty named "Hotspots" not found.');
  for (const id of hotspotIds.keys()) {
    const a = root.getObjectByName(`Hotspot_${id}`);
    if (!a) { add('fail', `Anchor Hotspot_${id}`, 'Empty not found.'); continue; }
    const p = a.getWorldPosition(new THREE.Vector3());
    const above = heightAt ? p.y - heightAt(p.x, p.z) : NaN;
    const zone = hotspotIds.get(id), zc = new THREE.Box3().setFromObject(zone).getCenter(new THREE.Vector3());
    const dist = Math.hypot(p.x - zc.x, p.z - zc.z);
    if (above < 1) add('fail', `Anchor Hotspot_${id}`, `Is ${above.toFixed(1)} m above the ground — place it above the zone (≈ 4–15 m).`);
    else if (dist > 40) add('warn', `Anchor Hotspot_${id}`, `Is ${dist.toFixed(0)} m away (in plan) from its zone's centre.`);
    else add('pass', `Anchor Hotspot_${id}`, `${above.toFixed(1)} m above ground.`);
  }

  // ---- budgets ----
  add(tris <= BUDGET.tris ? 'pass' : 'fail', 'Total triangles', `${fmt(tris)} (budget ${fmt(BUDGET.tris)})`);
  add(calls <= BUDGET.calls ? 'pass' : 'fail', 'Draw calls (meshes × materials)', `${calls} (budget ${BUDGET.calls}) — join meshes that share a material.`);
  add(materials.size <= BUDGET.materials ? 'pass' : 'warn', 'Materials', `${materials.size} (budget ${BUDGET.materials})`);
  if (sizeBytes) add(sizeBytes / 1048576 <= BUDGET.sizeMB ? 'pass' : 'warn', 'File size', `${(sizeBytes / 1048576).toFixed(2)} MB (target ≤ ${BUDGET.sizeMB} MB; split into core + vegetation if larger)`);

  // ---- instancing ----
  add(instanced ? 'pass' : 'warn', 'GPU instancing', instanced ? `${instanced} instanced meshes, ${fmt(instances)} instances.` : 'No instanced meshes found — trees/cars must be linked duplicates exported with "GPU Instances".');
  const dupes = [...geoUse.values()].filter((names) => names.length > 20);
  if (dupes.length) add('fail', 'Repeated objects not instanced', dupes.map((n) => `${n.length}× ${n[0]}…`).join('; '));
  // identical-looking separate meshes (same vertex count, many copies) usually mean instancing was lost on export
  const byVerts = new Map();
  meshes.filter((m) => !m.isInstancedMesh).forEach((m) => { const k = m.geometry.attributes.position.count; byVerts.set(k, (byVerts.get(k) ?? 0) + 1); });
  const suspicious = [...byVerts].filter(([k, c]) => c > 50 && k > 24);
  if (suspicious.length) add('warn', 'Possible un-instanced duplicates', suspicious.map(([k, c]) => `${c} meshes with ${k} vertices`).join('; '));
  if (vegMissing.length) add('warn', 'Vegetation flag', `Large instanced meshes without custom property vegetation=1: ${vegMissing.join(', ')}`);
  else if (vegInstanced) add('pass', 'Vegetation flag', `${vegInstanced} instanced vegetation meshes flagged.`);

  // ---- materials / textures / flags ----
  add(waterFound ? 'pass' : 'warn', 'Water material', waterFound ? 'Found (will be animated).' : 'No material whose name starts with "Water" — the pool will not animate.');
  add(shadowFlags ? 'pass' : 'warn', 'Shadow flags', shadowFlags ? `${shadowFlags} meshes carry castShadow / receiveShadow.` : 'No castShadow / receiveShadow custom properties — the scene will have no shadows.');
  const big = [...textures.values()].filter((t) => Math.max(t.w, t.h) > (t.onTerrain ? BUDGET.terrainTex : BUDGET.tex));
  add(big.length ? 'warn' : 'pass', 'Texture sizes', big.length ? big.map((t) => `${t.mat}.${t.slot} ${t.w}×${t.h}`).join('; ') : `${textures.size} texture(s), all within ${BUDGET.tex} px.`);
  const scaled = meshes.filter((m) => !m.isInstancedMesh && m.getWorldScale(new THREE.Vector3()).toArray().some((s) => s < 0));
  if (scaled.length) add('fail', 'Negative scale', `${scaled.slice(0, 5).map((m) => m.name).join(', ')}${scaled.length > 5 ? '…' : ''} — apply transforms.`);

  return rows;
}

function render(rows, label) {
  const order = { fail: 0, warn: 1, pass: 2 };
  const n = (l) => rows.filter((r) => r.level === l).length;
  summary.innerHTML = `<b>${esc(label)}</b> — <span class="${n('fail') ? 'fail' : 'pass'}">${n('fail') ? `${n('fail')} failing` : 'contract OK'}</span>, <span class="warn">${n('warn')} warning(s)</span>, <span class="pass">${n('pass')} passed</span>`;
  report.innerHTML = '<tr><th>Result</th><th>Check</th><th>Detail</th></tr>' + [...rows].sort((a, b) => order[a.level] - order[b.level])
    .map((r) => `<tr><td class="${r.level}">${r.level.toUpperCase()}</td><td>${esc(r.check)}</td><td>${esc(r.detail)}</td></tr>`).join('');
  window.__validation = { label, rows };
}

/** Check one model. `urls` may list several files that together make up the model (core first). */
async function check(urls, label, size) {
  urls = [].concat(urls);
  summary.textContent = `Checking ${label}…`; report.innerHTML = '';
  try {
    if (size === undefined) {
      size = 0;
      for (const url of urls) size += Number((await fetch(url, { method: 'HEAD' })).headers.get('X-Uncompressed-Length') ?? 0) || (await (await fetch(url)).arrayBuffer()).byteLength;
    }
    const scenes = [];
    for (const url of urls) scenes.push((await loader.loadAsync(url)).scene);
    const whole = scenes.length === 1 ? scenes[0] : new THREE.Group().add(...scenes);
    render(validate(whole, size), label);
  } catch (err) {
    summary.innerHTML = `<span class="fail">Could not load ${esc(label)}: ${esc(err.message)}</span>`;
    window.__validation = { label, error: err.message };
  }
}

const drop = document.getElementById('drop'), input = document.getElementById('file');
const take = (f) => f && check(URL.createObjectURL(f), f.name, f.size);
drop.addEventListener('click', () => input.click());
input.addEventListener('change', () => take(input.files[0]));
drop.addEventListener('dragover', (e) => { e.preventDefault(); drop.classList.add('over'); });
drop.addEventListener('dragleave', () => drop.classList.remove('over'));
drop.addEventListener('drop', (e) => { e.preventDefault(); drop.classList.remove('over'); take(e.dataTransfer.files[0]); });

// The project's own model is delivered as three files (see tools/model-builder.js); check them as one.
const PROJECT = ['mountain-courtyard.glb', 'mountain-courtyard-vegetation.glb', 'mountain-courtyard-details.glb'];
check(PROJECT.map((f) => `../public/models/${f}`), `public/models/ (${PROJECT.length} files)`);
