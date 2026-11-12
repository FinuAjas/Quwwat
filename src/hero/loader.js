import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { CONFIG, TIER } from './config.js';
import { createWater } from './water.js';

/**
 * Loads the site GLB (Draco / Meshopt ready) and prepares it for rendering:
 * shadow flags, rebuilt terrain normals, animated water, frozen matrices,
 * and fewer trees on low-tier devices.
 */
export async function loadSite(renderer, onProgress = () => {}) {
  const draco = new DRACOLoader().setDecoderPath(CONFIG.dracoPath);
  const loader = new GLTFLoader().setDRACOLoader(draco).setMeshoptDecoder(MeshoptDecoder);
  const gltf = await loader.loadAsync(CONFIG.modelUrl, (e) => {
    // With gzip/brotli the reported total may be the compressed size (or 0), so clamp.
    if (e.total) onProgress(Math.min(0.95, e.loaded / e.total));
  });
  draco.dispose();

  const root = gltf.scene;
  const clickable = [];
  let water = null;
  const maxAniso = renderer.capabilities.getMaxAnisotropy();

  root.traverse((o) => {
    if (o.isMesh) {
      o.castShadow = !!o.userData.castShadow && CONFIG.shadowsFor(o);
      o.receiveShadow = !!o.userData.receiveShadow;
      if (!o.geometry.attributes.normal || o.userData.recomputeNormals) o.geometry.computeVertexNormals();
      if (o.material?.map) o.material.map.anisotropy = maxAniso;
      if (o.material?.name === 'Water') {
        water ??= createWater(o.material);
        o.material = water.material;
      }
      if (o.isInstancedMesh && TIER === 'low' && o.userData.vegetation) thinInstances(o, o.name.includes('_far') ? 0.45 : 0.7);
    }
    if (o.userData.hotspotId && !o.name.startsWith('Hotspot_')) clickable.push(o);
    o.updateMatrix();
    o.matrixAutoUpdate = false; // static scene: skip per-frame matrix recomposition
  });
  root.updateMatrixWorld(true);

  return {
    root,
    terrain: root.getObjectByName('Terrain'),
    clickable,
    anchors: root.getObjectByName('Hotspots')?.children ?? [],
    update: (t) => water?.update(t),
  };
}

/** Keep an evenly spread fraction of instances (instances are stored in spatial order). */
function thinInstances(mesh, keep) {
  const m = new THREE.Matrix4();
  let n = 0, acc = 0;
  for (let i = 0; i < mesh.count; i++) {
    acc += keep;
    if (acc >= 1) { acc -= 1; mesh.getMatrixAt(i, m); mesh.setMatrixAt(n++, m); }
  }
  mesh.count = n;
  mesh.instanceMatrix.needsUpdate = true;
  mesh.computeBoundingSphere();
}
