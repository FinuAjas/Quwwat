import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { KTX2Loader } from 'three/addons/loaders/KTX2Loader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { CONFIG, TIER } from './config.js';
import { createWater } from './water.js';

/** GLTFLoader that understands Draco, Meshopt and KTX2/Basis textures (decoders are fetched only if a file needs them). */
export function createGLTFLoader(renderer) {
  const draco = new DRACOLoader().setDecoderPath(CONFIG.dracoPath);
  const ktx2 = new KTX2Loader().setTranscoderPath(CONFIG.basisPath).detectSupport(renderer);
  const loader = new GLTFLoader().setDRACOLoader(draco).setKTX2Loader(ktx2).setMeshoptDecoder(MeshoptDecoder);
  return { loader, dispose: () => { draco.dispose(); ktx2.dispose(); } };
}

/**
 * Loads the site model. `CONFIG.models.core` is required and shown first; `CONFIG.models.extras`
 * (vegetation / detail files) are streamed in afterwards with `site.loadExtras()`.
 * Every file gets the same preparation: shadow flags from glTF extras, rebuilt normals where asked,
 * animated water, baked lightmaps, frozen matrices and fewer trees on low-tier devices.
 */
export async function loadSite(renderer, onProgress = () => {}) {
  const { loader, dispose } = createGLTFLoader(renderer);
  const maxAniso = renderer.capabilities.getMaxAnisotropy();
  const texLoader = new THREE.TextureLoader();
  const clickable = [];
  let water = null;
  const lightMapped = new Map(); // `${material.uuid}|${file}` -> material clone with that lightmap

  function prepare(root, baseUrl) {
    root.traverse((o) => {
      if (o.isMesh) {
        o.castShadow = !!o.userData.castShadow && CONFIG.shadowsFor(o);
        o.receiveShadow = !!o.userData.receiveShadow;
        if (!o.geometry.attributes.normal || o.userData.recomputeNormals) o.geometry.computeVertexNormals();
        for (const key of ['map', 'normalMap', 'roughnessMap', 'metalnessMap', 'aoMap']) {
          const t = o.material?.[key];
          if (t) t.anisotropy = maxAniso;
        }
        if (o.material?.name?.startsWith('Water')) {
          water ??= createWater(o.material);
          o.material = water.material;
        }
        // Baked lightmap: custom property `lightMap` = image file next to the GLB, sampled on UV2 (falls back to UV1).
        if (o.userData.lightMap && o.material?.isMeshStandardMaterial) {
          const key = `${o.material.uuid}|${o.userData.lightMap}`;
          if (!lightMapped.has(key)) {
            const tex = texLoader.load(new URL(o.userData.lightMap, baseUrl).href);
            tex.flipY = false; tex.colorSpace = THREE.SRGBColorSpace;
            tex.channel = o.geometry.attributes.uv1 ? 1 : 0;
            const m = o.material.clone();
            m.lightMap = tex; m.lightMapIntensity = CONFIG.lightMapIntensity;
            lightMapped.set(key, m);
          }
          o.material = lightMapped.get(key);
        }
        if (o.isInstancedMesh && TIER === 'low' && o.userData.vegetation && !o.userData.keepAll) thinInstances(o, o.name.includes('_far') ? 0.45 : 0.7);
      }
      if (o.userData.hotspotId && !o.name.startsWith('Hotspot_')) clickable.push(o);
      o.updateMatrix();
      o.matrixAutoUpdate = false; // static scene: skip per-frame matrix recomposition
    });
    root.updateMatrixWorld(true);
    return root;
  }

  const coreUrl = new URL(CONFIG.models.core, document.baseURI).href;
  const gltf = await loader.loadAsync(coreUrl, (e) => {
    // With gzip/brotli the reported total may be the compressed size (or 0), so clamp.
    if (e.total) onProgress(Math.min(0.95, e.loaded / e.total));
  });
  const root = prepare(gltf.scene, coreUrl);
  const extras = CONFIG.models.extras ?? [];
  if (!extras.length) dispose();

  return {
    root,
    terrain: root.getObjectByName('Terrain'),
    clickable,
    anchors: root.getObjectByName('Hotspots')?.children ?? [],
    update: (t) => water?.update(t),
    hasExtras: extras.length > 0,
    /** Stream in the remaining files one by one; `onPart(root)` is called for each (add it to the scene there). */
    async loadExtras(onPart) {
      for (const path of extras) {
        const url = new URL(path, document.baseURI).href;
        try {
          const part = prepare((await loader.loadAsync(url)).scene, url);
          await onPart(part);
        } catch (err) {
          console.warn(`Optional model part failed to load: ${path}`, err);
        }
      }
      dispose();
    },
  };
}

/** Keep an evenly spread fraction of instances (instances are stored in spatial order). */
function thinInstances(mesh, keep) {
  const m = new THREE.Matrix4(), c = new THREE.Color();
  let n = 0, acc = 0;
  for (let i = 0; i < mesh.count; i++) {
    acc += keep;
    if (acc >= 1) {
      acc -= 1;
      mesh.getMatrixAt(i, m); mesh.setMatrixAt(n, m);
      if (mesh.instanceColor) { mesh.getColorAt(i, c); mesh.setColorAt(n, c); }
      n++;
    }
  }
  mesh.count = n;
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  mesh.computeBoundingSphere();
}
