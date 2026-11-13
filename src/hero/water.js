import * as THREE from 'three';

/**
 * Turns the exported "Water" material into clear, animated pool water. Nothing is textured: the shader
 * draws what you would see through the surface —
 *  - a mosaic-tiled floor, shifted by the viewing angle and the water depth (refraction parallax)
 *  - a band of darker blue tiles along the walls
 *  - caustics: the moving net of light the ripples focus onto the floor
 *  - depth colour: red light is absorbed first, so deep water turns blue-green and the shallows stay pale
 *  - ripple normals for the reflections on top
 *
 * `shape` = [length, topHalfWidth, bottomHalfWidth] of the model's eye-shaped pool (mesh custom property
 * `poolShape`): with it the water is shallow at the edges and deep in the middle. Without it (any other
 * water mesh) the depth is uniform.
 */
export function createWater(original, shape) {
  const mat = new THREE.MeshPhysicalMaterial({
    name: 'Water_Animated',
    color: original?.color ?? new THREE.Color(0x2aa6d6),
    roughness: 0.04,
    metalness: 0,
    clearcoat: 1,
    clearcoatRoughness: 0.05,
    envMapIntensity: 1.6,
  });
  const uniforms = {
    uTime: { value: 0 },
    uDeep: { value: new THREE.Color(0x0b5a78) },      // colour scattered back by deep water
    uFloor: { value: new THREE.Color(0xa9dfe0) },     // pale aqua mosaic
    uShape: { value: new THREE.Vector4(...(Array.isArray(shape) && shape.length === 3 ? [...shape, 1] : [1, 1, 1, 0])) },
  };

  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWPos; varying vec3 vLPos; varying vec3 vLCam;')
      .replace('#include <worldpos_vertex>', `#include <worldpos_vertex>
        vWPos = (modelMatrix * vec4(transformed, 1.0)).xyz;
        vLPos = transformed;
        vLCam = (inverse(modelMatrix) * vec4(cameraPosition, 1.0)).xyz;`);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>
        uniform float uTime; uniform vec3 uDeep; uniform vec3 uFloor; uniform vec4 uShape;
        varying vec3 vWPos; varying vec3 vLPos; varying vec3 vLCam;
        float wHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
        vec2 waveGrad(vec2 p, float t) {
          vec2 g = vec2(0.0);
          g += vec2(0.9, 0.4) * cos(dot(p, vec2(0.9, 0.4)) * 1.7 + t * 1.6) * 0.5;
          g += vec2(-0.3, 1.0) * cos(dot(p, vec2(-0.3, 1.0)) * 2.3 + t * 1.9) * 0.35;
          g += vec2(0.7, -0.8) * cos(dot(p, vec2(0.7, -0.8)) * 3.9 + t * 2.6) * 0.2;
          g += vec2(-0.95, -0.2) * cos(dot(p, vec2(-0.95, -0.2)) * 6.1 + t * 3.1) * 0.12;
          return g;
        }
        // moving net of bright lines, like sunlight focused by ripples
        float caustics(vec2 p, float t) {
          float a = sin(p.x * 1.7 + sin(p.y * 1.3 + t) * 1.6 + t * 0.7);
          float b = sin(p.y * 1.9 + sin(p.x * 1.1 - t * 0.8) * 1.6 - t * 0.6);
          float c = sin((p.x + p.y) * 1.2 + sin((p.x - p.y) * 0.9 + t * 0.6) * 1.4);
          return pow(max(0.0, 1.0 - abs(a + b + c * 0.6) * 0.45), 5.0);
        }`)
      .replace('#include <color_fragment>', `#include <color_fragment>
        {
          vec3 V = normalize(vLPos - vLCam);                         // view ray in the pool's own frame
          float down = max(-V.y, 0.28);
          // distance to the nearest wall of the eye-shaped pool → depth (shallow ledge at the edge, deep in the middle)
          float u = clamp(vLPos.x / (uShape.x * 0.5), -1.0, 1.0), k = 1.0 - u * u;
          float edge = min(uShape.y * k + vLPos.z, uShape.z * k - vLPos.z);
          float depth = uShape.w > 0.5 ? mix(0.55, 1.9, smoothstep(0.0, 3.2, edge)) : 1.4;
          vec2 floorP = vLPos.xz + V.xz / down * depth * 0.75;       // where the refracted ray meets the floor
          float px = length(fwidth(vLPos.xz));
          float fineDetail = 1.0 - smoothstep(0.06, 0.22, px);       // tiles only when close enough to resolve them
          vec2 tq = floorP / 0.3, tf = fract(tq);
          float joint = smoothstep(0.03, 0.1, min(min(tf.x, 1.0 - tf.x), min(tf.y, 1.0 - tf.y)));
          vec3 floorCol = uFloor * mix(1.0, (0.86 + 0.22 * wHash(floor(tq))) * mix(0.7, 1.0, joint), fineDetail);
          float band = uShape.w > 0.5 ? 1.0 - smoothstep(0.3, 0.6, edge) : 0.0;
          floorCol = mix(floorCol, uFloor * vec3(0.3, 0.55, 0.9), band * 0.65);
          floorCol += uFloor * caustics(floorP * 1.5, uTime * 0.9) * 0.6 * (1.15 - depth * 0.3);
          // absorption along the path through the water (red goes first), plus light scattered back from the depths
          float path = depth / down;
          vec3 keep = exp(-path * vec3(0.68, 0.15, 0.08));
          diffuseColor.rgb = floorCol * keep + uDeep * (1.0 - keep.g) * 0.9;
        }`)
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
        vec2 wg = waveGrad(vWPos.xz, uTime) * 0.18;
        normal = normalize(normal + (viewMatrix * vec4(-wg.x, 0.0, -wg.y, 0.0)).xyz);`);
  };
  mat.customProgramCacheKey = () => 'water-v3';
  return { material: mat, update: (t) => { uniforms.uTime.value = t; } };
}
