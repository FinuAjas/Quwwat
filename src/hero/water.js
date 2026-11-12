import * as THREE from 'three';

/**
 * Turns the exported "Water" material into animated pool water:
 * world-space ripple normals, a depth tint and a view-angle (Fresnel) sheen.
 * No textures or UVs are needed, so it works on any mesh using the Water material.
 */
export function createWater(original) {
  const mat = new THREE.MeshPhysicalMaterial({
    name: 'Water_Animated',
    color: original?.color ?? new THREE.Color(0x2aa6d6),
    roughness: 0.04,
    metalness: 0,
    clearcoat: 1,
    clearcoatRoughness: 0.05,
    envMapIntensity: 1.6,
  });
  const uniforms = { uTime: { value: 0 }, uDeep: { value: new THREE.Color(0x0c6e9c) }, uShallow: { value: new THREE.Color(0x5fd0e8) } };

  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWPos;')
      .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvWPos = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>
        uniform float uTime; uniform vec3 uDeep; uniform vec3 uShallow; varying vec3 vWPos;
        vec2 waveGrad(vec2 p, float t) {
          vec2 g = vec2(0.0);
          g += vec2(0.9, 0.4) * cos(dot(p, vec2(0.9, 0.4)) * 1.7 + t * 1.6) * 0.5;
          g += vec2(-0.3, 1.0) * cos(dot(p, vec2(-0.3, 1.0)) * 2.3 + t * 1.9) * 0.35;
          g += vec2(0.7, -0.8) * cos(dot(p, vec2(0.7, -0.8)) * 3.9 + t * 2.6) * 0.2;
          g += vec2(-0.95, -0.2) * cos(dot(p, vec2(-0.95, -0.2)) * 6.1 + t * 3.1) * 0.12;
          return g;
        }`)
      .replace('#include <color_fragment>', `#include <color_fragment>
        float shimmer = 0.5 + 0.5 * sin(vWPos.x * 0.8 + uTime * 0.7) * sin(vWPos.z * 0.6 - uTime * 0.5);
        diffuseColor.rgb = mix(uDeep, uShallow, 0.35 + 0.3 * shimmer);`)
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
        vec2 wg = waveGrad(vWPos.xz, uTime) * 0.18;
        normal = normalize(normal + (viewMatrix * vec4(-wg.x, 0.0, -wg.y, 0.0)).xyz);`);
  };
  mat.customProgramCacheKey = () => 'water-v1';
  return { material: mat, update: (t) => { uniforms.uTime.value = t; } };
}
