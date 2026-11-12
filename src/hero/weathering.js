import { CONFIG } from './config.js';

/**
 * Weathering for flat-coloured building materials (chosen by material name in CONFIG.weathering), so walls
 * and roofs stop looking freshly painted:
 *  - walls: broad patchy fading, faint rain streaks, and splash-back grime rising from the ground
 *  - roofs: tile-to-tile colour variation, faint tile courses, patches of dark moss / staining
 *  - stone & paving: mottling, fine speckle, grime at the foot of walls
 *  - every building also gets its own slight warm / cool, lighter / darker cast
 * All procedural in the fragment shader from world position (no textures or UVs), on every tier.
 * Fine detail fades out with distance, so the aerial view does not shimmer.
 * Textured artist materials should not be listed: their weathering is painted into the textures.
 */
const KIND = { wall: 0, roof: 1, stone: 2 };

export function createWeathering() {
  const W = CONFIG.weathering;
  const kindOf = new Map();
  if (W?.amount > 0) for (const k of Object.keys(KIND)) for (const name of W[k] ?? []) kindOf.set(name, k);
  const patched = new Map(); // material.uuid -> patched clone

  function patch(material) {
    if (patched.has(material.uuid)) return patched.get(material.uuid);
    const kind = KIND[kindOf.get(material.name)], A = Number(W.amount).toFixed(3);
    const mat = material.clone();
    mat.onBeforeCompile = (shader) => {
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nvarying vec3 vWxPos; varying float vWxBase; varying float vWxTint;')
        .replace('#include <project_vertex>', `#include <project_vertex>
          vWxPos = (modelMatrix * vec4(transformed, 1.0)).xyz;
          vWxBase = modelMatrix[3].y;                                              // the building's ground level
          vWxTint = fract(sin(dot(modelMatrix[3].xz, vec2(12.9898, 78.233))) * 43758.5453); // one random value per building`);
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', `#include <common>
          varying vec3 vWxPos; varying float vWxBase; varying float vWxTint;
          float wxHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
          float wxNoise(vec2 p) {
            vec2 i = floor(p), f = fract(p);
            f = f * f * (3.0 - 2.0 * f);
            return mix(mix(wxHash(i), wxHash(i + vec2(1.0, 0.0)), f.x), mix(wxHash(i + vec2(0.0, 1.0)), wxHash(i + vec2(1.0, 1.0)), f.x), f.y);
          }`)
        .replace('#include <color_fragment>', `#include <color_fragment>
          {
            vec3 p = vWxPos;
            float h = p.y - vWxBase;                                   // metres above the building's ground level
            float px = length(fwidth(p));                              // metres covered by one pixel
            float near = 1.0 - smoothstep(0.08, 0.3, px);              // fine detail only when close enough to resolve it
            float broad = wxNoise(p.xz * 0.2 + p.y * 0.13);
            float fine = wxNoise(p.xz * 5.0 + p.y * 4.0);
            vec3 c = diffuseColor.rgb;
            #if ${kind} == 0
              float streak = 0.5 * (wxNoise(vec2(p.x * 2.3, p.y * 0.22)) + wxNoise(vec2(p.z * 2.3 + 7.0, p.y * 0.22 + 3.0)));
              float splash = 1.0 - smoothstep(0.2, 1.3 + broad * 0.9, h);
              c *= 1.0 + (broad - 0.5) * 0.16 * ${A};
              c = mix(c, c * vec3(0.80, 0.78, 0.72), smoothstep(0.48, 0.76, streak) * 0.4 * ${A});
              c = mix(c, c * vec3(0.64, 0.57, 0.47), splash * 0.5 * ${A});
              c *= 1.0 + (fine - 0.5) * 0.06 * near * ${A};
            #elif ${kind} == 1
              float tiles = wxNoise(p.xz * 1.1);
              float courses = 0.5 + 0.5 * sin(p.y * 20.0);
              float moss = smoothstep(0.56, 0.86, wxNoise(p.xz * 0.33 + 11.0));
              c *= 1.0 + ((tiles - 0.5) * 0.22 + (broad - 0.5) * 0.12) * ${A};
              c *= 1.0 + ((fine - 0.5) * 0.12 - courses * 0.07) * near * ${A};
              c = mix(c, c * vec3(0.52, 0.58, 0.44), moss * 0.42 * ${A});
            #else
              float foot = 1.0 - smoothstep(0.0, 0.5 + broad * 0.4, h);
              c *= 1.0 + (broad - 0.5) * 0.18 * ${A} + (fine - 0.5) * 0.08 * near * ${A};
              c = mix(c, c * vec3(0.7, 0.66, 0.58), foot * 0.3 * ${A});
            #endif
            // per-building cast: slightly lighter / darker and warmer / cooler
            c *= (1.0 + (vWxTint - 0.5) * 0.09 * ${A}) * mix(vec3(1.02, 1.0, 0.97), vec3(0.98, 1.0, 1.03), fract(vWxTint * 7.3));
            diffuseColor.rgb = c;
          }`);
    };
    mat.customProgramCacheKey = () => `weathering-${kind}-${A}`;
    patched.set(material.uuid, mat);
    return mat;
  }

  /** Apply to every mesh under `root` whose material is listed in CONFIG.weathering. */
  function apply(root) {
    if (!kindOf.size) return;
    root.traverse((o) => {
      if (o.isMesh && o.material?.isMeshStandardMaterial && kindOf.has(o.material.name)) o.material = patch(o.material);
    });
  }
  return { apply };
}
