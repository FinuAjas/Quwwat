import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { KTX2Loader } from 'three/addons/loaders/KTX2Loader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { CONFIG, TIER } from './config.js';
import { createWater } from './water.js';
import { takePrefetched } from './prefetch.js';

/** GLTFLoader that understands Draco, Meshopt and KTX2/Basis textures (decoders are fetched only if a file needs them). */
export function createGLTFLoader(renderer) {
  const draco = new DRACOLoader().setDecoderPath(CONFIG.dracoPath);
  const ktx2 = new KTX2Loader().setTranscoderPath(CONFIG.basisPath).detectSupport(renderer);
  const loader = new GLTFLoader().setDRACOLoader(draco).setKTX2Loader(ktx2).setMeshoptDecoder(MeshoptDecoder);
  return { loader, dispose: () => { draco.dispose(); ktx2.dispose(); } };
}

/**
 * Loads the site model. `CONFIG.models.core` is required and shown first; `CONFIG.models.extras`
 * (vegetation / detail files) download alongside it and are handed over by `site.loadExtras()`.
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
          water ??= createWater(o.material, o.userData.poolShape);
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
    const forest = [];
    root.traverse((o) => { if (o.isInstancedMesh && o.userData.vegetation) forest.push(o); });
    forest.forEach(splitInstances);
    root.updateMatrixWorld(true);
    return root;
  }

  // Use the bytes main.js already started downloading (prefetch.js); request the file here only if that failed
  // or never happened (e.g. tools that import this module directly).
  async function load(url, progress) {
    const early = takePrefetched(url);
    if (early) {
      early.onProgress(progress);
      try {
        return await loader.parseAsync(await early.buffer, url.slice(0, url.lastIndexOf('/') + 1));
      } catch (err) {
        console.warn(`Prefetched model could not be used, loading it again: ${url}`, err);
      }
    }
    // With gzip/brotli the reported total may be the compressed size (or 0), so clamp.
    return loader.loadAsync(url, (e) => { if (e.total) progress(Math.min(0.99, e.loaded / e.total)); });
  }

  // Start every download now: the extras arrive while the core is being prepared, not after it.
  const extras = (CONFIG.models.extras ?? []).map((path) => {
    const url = new URL(path, document.baseURI).href;
    const loading = load(url, () => {});
    loading.catch(() => {}); // reported when the part is collected in loadExtras
    return { path, url, loading };
  });
  const coreUrl = new URL(CONFIG.models.core, document.baseURI).href;
  const gltf = await load(coreUrl, (p) => onProgress(Math.min(0.95, p)));
  const root = prepare(gltf.scene, coreUrl);
  if (!extras.length) dispose();

  return {
    root,
    terrain: root.getObjectByName('Terrain'),
    clickable,
    anchors: root.getObjectByName('Hotspots')?.children ?? [],
    update: (t) => water?.update(t),
    hasExtras: extras.length > 0,
    /** Collect the remaining files in order as they finish; `onPart(root)` is called for each (add it to the scene there). */
    async loadExtras(onPart) {
      for (const { path, url, loading } of extras) {
        try {
          const part = prepare((await loading).scene, url);
          await onPart(part);
        } catch (err) {
          console.warn(`Optional model part failed to load: ${path}`, err);
        }
      }
      dispose();
    },
  };
}

/**
 * Split one instanced plant mesh into compact tiles so three.js can skip the tiles outside the view (an
 * InstancedMesh is culled as a whole, and one tree type spans the entire 1.4 km forest).
 * Tiles are cut in half along their longer side, at the median, until each holds at most `CHUNK.tris` triangles:
 * dense, detailed trees around the site get small tiles; cheap distant blobs stay in a few large ones, which keeps
 * the extra draw calls in the wide aerial view low.
 * Tiles share the geometry and material and keep the mesh's name, transform, flags and layers.
 */
const CHUNK = { tris: 16000, minInstances: 24 }; // 8000 culls ~1/3 more in close-ups but more than doubles the extra draw calls in the aerial view
function splitInstances(mesh) {
  const g = mesh.geometry, perInstance = (g.index ? g.index.count : g.attributes.position.count) / 3;
  const maxPer = Math.max(CHUNK.minInstances, Math.floor(CHUNK.tris / perInstance));
  if (mesh.count <= maxPer || !mesh.parent) return;
  const m = new THREE.Matrix4(), c = new THREE.Color();
  const pts = [];
  for (let i = 0; i < mesh.count; i++) {
    mesh.getMatrixAt(i, m);
    pts.push({ i, x: m.elements[12], z: m.elements[14] });
  }
  const groups = [];
  const cut = (list) => {
    if (list.length <= maxPer) { groups.push(list.map((q) => q.i)); return; }
    let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
    for (const q of list) { x0 = Math.min(x0, q.x); x1 = Math.max(x1, q.x); z0 = Math.min(z0, q.z); z1 = Math.max(z1, q.z); }
    const k = x1 - x0 >= z1 - z0 ? 'x' : 'z';
    list.sort((u, v) => u[k] - v[k]);
    const half = list.length >> 1;
    cut(list.slice(0, half)); cut(list.slice(half));
  };
  cut(pts);
  if (groups.length < 2) return;
  for (const ids of groups) {
    const tile = new THREE.InstancedMesh(mesh.geometry, mesh.material, ids.length);
    ids.forEach((src, j) => {
      mesh.getMatrixAt(src, m); tile.setMatrixAt(j, m);
      if (mesh.instanceColor) { mesh.getColorAt(src, c); tile.setColorAt(j, c); }
    });
    tile.name = mesh.name;
    tile.userData = mesh.userData;
    tile.castShadow = mesh.castShadow; tile.receiveShadow = mesh.receiveShadow;
    tile.layers.mask = mesh.layers.mask; tile.renderOrder = mesh.renderOrder;
    tile.matrix.copy(mesh.matrix); tile.matrix.decompose(tile.position, tile.quaternion, tile.scale);
    tile.matrixAutoUpdate = false;
    tile.computeBoundingSphere();
    mesh.parent.add(tile);
  }
  mesh.removeFromParent();
  mesh.dispose(); // frees only its instance buffers; the geometry and material live on in the tiles
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
