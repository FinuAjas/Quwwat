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

async function exportGLB() {
  // Terrain normals are cheap to rebuild at load time (saves ~0.4 MB); restore them after export.
  const terrain = root.getObjectByName('Terrain');
  const normal = terrain.geometry.getAttribute('normal');
  terrain.geometry.deleteAttribute('normal');
  terrain.userData.recomputeNormals = true;
  try {
    return await new GLTFExporter().parseAsync(root, { binary: true, onlyVisible: true });
  } finally {
    terrain.geometry.setAttribute('normal', normal);
  }
}
document.getElementById('save').onclick = async () => {
  statusEl.textContent = 'exporting…';
  const glb = await exportGLB();
  const res = await fetch('/api/save-model', { method: 'POST', body: glb, headers: { 'Content-Type': 'model/gltf-binary' } });
  statusEl.textContent = res.ok ? `saved ${(glb.byteLength / 1048576).toFixed(2)} MB → ${await res.text()}` : `save failed: ${res.status}`;
  window.__saved = res.ok;
};
document.getElementById('download').onclick = async () => {
  const glb = await exportGLB();
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([glb], { type: 'model/gltf-binary' }));
  a.download = 'mountain-courtyard.glb'; a.click();
};
document.getElementById('top').onclick = () => { camera.position.set(15, 330, 1); controls.target.set(15, 0, 0); };

addEventListener('resize', () => { camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight); });
renderer.setAnimationLoop(() => { controls.update(); renderer.render(scene, camera); });
window.__builder = { camera, controls, scene, root };
if (new URLSearchParams(location.search).has('save')) document.getElementById('save').click();
