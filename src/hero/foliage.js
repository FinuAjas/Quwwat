import * as THREE from 'three';
import { CONFIG } from './config.js';

const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * Upgrades materials on meshes flagged `userData.vegetation`:
 *  - gentle wind sway (vertex shader; stronger towards the top of each plant, phase varies per instance)
 *  - back-light translucency (leaves glow when the sun is behind them)
 * Works with plain, vertex-coloured or textured alpha-clipped (leaf card) materials, instanced or not.
 * Leaf cards need nothing else: three.js already honours `alphaTest` in the shadow pass.
 */
export function createFoliage(sun) {
  const f = CONFIG.foliage;
  const shared = {
    uTime: { value: 0 },
    uWind: { value: reducedMotion ? 0 : f.wind },
    uSunDirView: { value: new THREE.Vector3(0, 1, 0) },
    uSunColor: { value: new THREE.Color(sun.color).multiplyScalar(f.translucency) },
  };
  const patched = new Map(); // `${material.uuid}:${height}` -> patched clone
  const sunDir = new THREE.Vector3();

  function patch(material, height) {
    const key = `${material.uuid}:${height.toFixed(2)}`;
    if (patched.has(key)) return patched.get(key);
    const mat = material.clone();
    const uHeight = { value: Math.max(height, 0.001) };
    mat.onBeforeCompile = (shader) => {
      Object.assign(shader.uniforms, shared, { uHeight });
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nuniform float uTime; uniform float uWind; uniform float uHeight;')
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
          transformed.z += wAmt * 0.6;`);
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', '#include <common>\nuniform vec3 uSunDirView; uniform vec3 uSunColor;')
        .replace('#include <opaque_fragment>', `
          float backLit = pow(max(dot(-normalize(vViewPosition), uSunDirView), 0.0), 3.0);
          outgoingLight += diffuseColor.rgb * uSunColor * backLit;
          #include <opaque_fragment>`);
    };
    mat.customProgramCacheKey = () => 'foliage-v1';
    patched.set(key, mat);
    return mat;
  }

  /** Apply to every vegetation mesh under `root` (skips the distant low-detail forest). */
  function apply(root) {
    root.traverse((o) => {
      if (!o.isMesh || !o.userData.vegetation || o.name.includes('_far') || !o.material?.isMeshStandardMaterial) return;
      if (!o.geometry.boundingBox) o.geometry.computeBoundingBox();
      o.material = patch(o.material, o.geometry.boundingBox.max.y);
    });
  }

  function update(t, camera) {
    shared.uTime.value = t;
    sunDir.copy(sun.position).sub(sun.target.position).normalize().transformDirection(camera.matrixWorldInverse);
    shared.uSunDirView.value.copy(sunDir);
  }
  return { apply, update };
}
