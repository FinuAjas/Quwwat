import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { buildSite } from '../src/model/buildSite.js';

const statsEl = document.getElementById('stats');
const statusEl = document.getElementById('status');

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xbcd3dc);
scene.fog = new THREE.Fog(0xbcd3dc, 300, 900);
const camera = new THREE.PerspectiveCamera(35, innerWidth / innerHeight, 1, 3000);
camera.position.set(-20, 190, 230);
const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(15, 0, 0);
controls.enableDamping = true;

scene.add(new THREE.HemisphereLight(0xdfefff, 0x3b4a2a, 1.2));
const sun = new THREE.DirectionalLight(0xfff1dc, 2.6);
sun.position.set(-160, 220, 120);
sun.castShadow = true;
sun.shadow.mapSize.set(4096, 4096);
Object.assign(sun.shadow.camera, { left: -170, right: 170, top: 170, bottom: -170, near: 10, far: 700 });
sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.6;
sun.target.position.set(15, 0, 0);
scene.add(sun, sun.target);

const { root, stats } = buildSite();
root.traverse((o) => { if (o.isMesh) { o.castShadow = !!o.userData.castShadow; o.receiveShadow = !!o.userData.receiveShadow; } });
scene.add(root);

let tris = 0, meshes = 0;
root.traverse((o) => {
  if (!o.isMesh) return; meshes++;
  const g = o.geometry, n = g.index ? g.index.count / 3 : g.attributes.position.count / 3;
  tris += n * (o.isInstancedMesh ? o.count : 1);
});
statsEl.textContent = `build   ${stats.ms} ms\nmeshes  ${meshes}\ntris    ${(tris / 1e6).toFixed(2)} M\ntrees   ${stats.trees}\ncars    ${stats.cars}
rocks   ${stats.rocks}`;

// The model is delivered as three files, so the page can show the site before the forest has arrived:
// the core loads first (CONFIG.models.core), the others stream in after it (CONFIG.models.extras).
// A group that is not listed goes into the core file.
const PARTS = [
  { file: 'mountain-courtyard.glb', name: 'MountainCourtyard', groups: null },
  { file: 'mountain-courtyard-vegetation.glb', name: 'MountainCourtyard_Vegetation', groups: ['Vegetation'] },
  { file: 'mountain-courtyard-details.glb', name: 'MountainCourtyard_Details', groups: ['Furniture', 'Rocks'] },
];
const listed = new Set(PARTS.flatMap((p) => p.groups ?? []));

/** Export every part as its own GLB: [{ file, glb }]. Groups are lent to a temporary parent and put back in order. */
async function exportParts() {
  // Terrain normals are cheap to rebuild at load time (saves ~0.4 MB); restore them after export.
  const terrain = root.getObjectByName('Terrain');
  const normal = terrain.geometry.getAttribute('normal');
  terrain.geometry.deleteAttribute('normal');
  terrain.userData.recomputeNormals = true;
  const order = [...root.children], out = [];
  try {
    for (const part of PARTS) {
      const holder = new THREE.Group();
      holder.name = part.name;
      if (!part.groups) holder.userData = root.userData;
      for (const child of order) if (part.groups ? part.groups.includes(child.name) : !listed.has(child.name)) holder.add(child);
      if (holder.children.length) out.push({ file: part.file, glb: await new GLTFExporter().parseAsync(holder, { binary: true, onlyVisible: true }) });
    }
  } finally {
    for (const child of order) root.add(child); // back under the model root, original order
    terrain.geometry.setAttribute('normal', normal);
  }
  return out;
}
document.getElementById('save').onclick = async () => {
  statusEl.textContent = 'exporting…';
  const parts = await exportParts(), lines = [];
  let ok = true;
  for (const { file, glb } of parts) {
    const res = await fetch(`/api/save-model?name=${file}`, { method: 'POST', body: glb, headers: { 'Content-Type': 'model/gltf-binary' } });
    ok &&= res.ok;
    lines.push(res.ok ? `${(glb.byteLength / 1048576).toFixed(2)} MB → ${await res.text()}` : `${file}: save failed (${res.status})`);
  }
  statusEl.textContent = `${ok ? 'saved' : 'FAILED'}\n${lines.join('\n')}`;
  window.__saved = ok;
};
document.getElementById('download').onclick = async () => {
  for (const { file, glb } of await exportParts()) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([glb], { type: 'model/gltf-binary' }));
    a.download = file; a.click();
  }
};
document.getElementById('top').onclick = () => { camera.position.set(15, 330, 1); controls.target.set(15, 0, 0); };

addEventListener('resize', () => { camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight); });
renderer.setAnimationLoop(() => { controls.update(); renderer.render(scene, camera); });
window.__builder = { camera, controls, scene, root };
if (new URLSearchParams(location.search).has('save')) document.getElementById('save').click();
