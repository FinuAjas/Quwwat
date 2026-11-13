import * as THREE from 'three';
import { CONFIG } from './config.js';

const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * Upgrades materials on meshes flagged `userData.vegetation`:
 *  - gentle wind sway (vertex shader; stronger towards the top of each plant, phase varies per instance)
 *  - back-light translucency (leaves glow when the sun is behind them)
 * Works with plain, vertex-coloured or textured alpha-clipped (leaf card) materials, instanced or not.
 * Leaf cards (materials with `alphaTest`) also get soft cut-out edges and canopy-style lighting on both faces;
 * three.js already honours `alphaTest` in the shadow pass.
 */
export function createFoliage(sun) {
  const f = CONFIG.foliage;
  const shared = {
    uTime: { value: 0 },
    uWind: { value: reducedMotion ? 0 : f.wind },
    uSunDirView: { value: new THREE.Vector3(0, 1, 0) },
    uSunColor: { value: new THREE.Color(sun.color).multiplyScalar(f.translucency) },
    uGrow: { value: 1 }, // 0–1 size of every plant: animated when the vegetation file arrives after the scene is on screen
  };
  let growStart = -1, planted = false;
  const patched = new Map(); // `${material.uuid}:${height}` -> patched clone
  const sunDir = new THREE.Vector3();

  /** Distant forest blobs: no wind or back-light (too small to see), but they grow in with the rest. */
  function patchFar(material) {
    const key = `${material.uuid}:far`;
    if (patched.has(key)) return patched.get(key);
    const mat = material.clone();
    mat.onBeforeCompile = (shader) => {
      shader.uniforms.uGrow = shared.uGrow;
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nuniform float uGrow;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\ntransformed *= uGrow;');
    };
    mat.customProgramCacheKey = () => 'foliage-v3-far';
    patched.set(key, mat);
    return mat;
  }

  function patch(material, height) {
    const key = `${material.uuid}:${height.toFixed(2)}`;
    if (patched.has(key)) return patched.get(key);
    const mat = material.clone();
    // Leaf cards (alpha-clipped, two-sided): soften their cut-out edges with the MSAA samples, and light both
    // faces with the canopy's outward normal instead of flipping it on the back face.
    const cards = material.alphaTest > 0;
    if (cards) { mat.alphaToCoverage = true; mat.defines = { ...mat.defines, FOLIAGE_CARDS: '' }; }
    const uHeight = { value: Math.max(height, 0.001) };
    mat.onBeforeCompile = (shader) => {
      Object.assign(shader.uniforms, shared, { uHeight });
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nuniform float uTime; uniform float uWind; uniform float uHeight; uniform float uGrow;')
        .replace('#include <begin_vertex>', `#include <begin_vertex>
          #ifdef USE_INSTANCING
            vec3 wOrigin = instanceMatrix[3].xyz;
          #else
            vec3 wOrigin = modelMatrix[3].xyz;
          #endif
          float wH = clamp(transformed.y / uHeight, 0.0, 1.0);
          float wPhase = wOrigin.x * 0.21 + wOrigin.z * 0.17;
          float wSway = sin(uTime * 1.3 + wPhase) * 0.6 + sin(uTime * 2.9 + wPhase * 2.3 + transformed.x * 3.0) * 0.25;
          float wAmt = wSway * wH * wH * uHeight * uWind;
          transformed.x += wAmt;
          transformed.z += wAmt * 0.6;
          transformed *= uGrow;`);
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', '#include <common>\nuniform vec3 uSunDirView; uniform vec3 uSunColor;')
        .replace('#include <normal_fragment_begin>', `#include <normal_fragment_begin>
          #ifdef FOLIAGE_CARDS
            normal = normalize(vNormal);
            nonPerturbedNormal = normal;
          #endif`)
        .replace('#include <opaque_fragment>', `
          float backLit = pow(max(dot(-normalize(vViewPosition), uSunDirView), 0.0), 3.0);
          outgoingLight += diffuseColor.rgb * uSunColor * backLit;
          #include <opaque_fragment>`);
    };
    mat.customProgramCacheKey = () => (cards ? 'foliage-v3-cards' : 'foliage-v3');
    patched.set(key, mat);
    return mat;
  }

  /**
   * Apply to every vegetation mesh under `root`.
   * Returns { found, first }: whether it held any plants, and whether they are the first ones seen.
   */
  function apply(root) {
    let found = false;
    root.traverse((o) => {
      if (!o.isMesh || !o.userData.vegetation || !o.material?.isMeshStandardMaterial) return;
      found = true;
      if (o.name.includes('_far')) { o.material = patchFar(o.material); return; }
      if (!o.geometry.boundingBox) o.geometry.computeBoundingBox();
      if (o.material.alphaTest > 0) o.layers.set(2); // leaf cards: kept out of the ambient-occlusion pass (see post.js)
      o.material = patch(o.material, o.geometry.boundingBox.max.y);
    });
    const first = found && !planted;
    planted ||= found;
    return { found, first };
  }

  /**
   * Make every plant rise from the ground over `growSeconds` instead of popping in. Call it just before adding
   * a late-arriving vegetation file to a scene that is already on screen (only when its plants are the first).
   */
  function growIn() {
    if (reducedMotion) return;
    shared.uGrow.value = 0;
    growStart = -2;
  }

  function update(t, camera) {
    shared.uTime.value = t;
    if (growStart === -2) growStart = t; // first frame with the new plants in the scene
    if (growStart >= 0) {
      const k = Math.min(1, (t - growStart) / f.growSeconds);
      shared.uGrow.value = 1 - (1 - k) ** 3;
      if (k >= 1) growStart = -1;
    }
    sunDir.copy(sun.position).sub(sun.target.position).normalize().transformDirection(camera.matrixWorldInverse);
    shared.uSunDirView.value.copy(sunDir);
  }
  return { apply, growIn, update };
}
