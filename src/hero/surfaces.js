import { CONFIG } from './config.js';

/**
 * Procedural surface detail for flat-coloured materials, chosen by material name in CONFIG.surfaces —
 * so nothing in the scene is a single flat colour:
 *  - terrain   : grass mottling and speckle, dry patches, bare red earth on steeper ground, rock on the steepest
 *  - asphalt   : aggregate speckle, darker repair patches, hairline cracks;  marking: worn, faded paint
 *  - brick / flagstone / tile : paver patterns with per-stone colour and joints (tile follows the object, e.g. the pool)
 *  - rubber    : granule speckle (play surface)
 *  - timber    : wood grain along the member, weathered grey patches (pergolas, frames, beams)
 *  - wall / roof / stone : building weathering — fading, rain streaks and ground grime; tile variation and moss; mottling
 *  - every building also gets its own slight lighter / darker, warmer / cooler cast
 * All of it is computed in the fragment shader from world (or object) position: no textures or UVs, on every tier.
 * Fine detail fades out with distance, so the aerial view does not shimmer.
 * Textured artist materials should not be listed: their detail belongs in the textures.
 */
const KINDS = ['wall', 'roof', 'stone', 'terrain', 'asphalt', 'marking', 'brick', 'flagstone', 'tile', 'rubber', 'timber'];

export function createSurfaces() {
  const W = CONFIG.surfaces;
  const kindOf = new Map();
  if (W?.amount > 0) KINDS.forEach((k) => { for (const name of W[k] ?? []) kindOf.set(name, k); });
  const patched = new Map(); // material.uuid -> patched clone

  function patch(material) {
    if (patched.has(material.uuid)) return patched.get(material.uuid);
    const kind = KINDS.indexOf(kindOf.get(material.name)), A = Number(W.amount).toFixed(3);
    const is = (k) => `KIND == ${KINDS.indexOf(k)}`;
    const mat = material.clone();
    mat.onBeforeCompile = (shader) => {
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nvarying vec3 vWxPos; varying vec3 vWxLocal; varying vec3 vWxNormal; varying float vWxBase; varying float vWxTint;')
        .replace('#include <project_vertex>', `#include <project_vertex>
          vWxLocal = transformed;
          vWxPos = (modelMatrix * vec4(transformed, 1.0)).xyz;
          vWxNormal = normalize(mat3(modelMatrix) * normal);
          vWxBase = modelMatrix[3].y;                                              // the object's ground level
          vWxTint = fract(sin(dot(modelMatrix[3].xz, vec2(12.9898, 78.233))) * 43758.5453); // one random value per object`);
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', `#include <common>
          #define KIND ${kind}
          varying vec3 vWxPos; varying vec3 vWxLocal; varying vec3 vWxNormal; varying float vWxBase; varying float vWxTint;
          float wxHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
          float wxNoise(vec2 p) {
            vec2 i = floor(p), f = fract(p);
            f = f * f * (3.0 - 2.0 * f);
            return mix(mix(wxHash(i), wxHash(i + vec2(1.0, 0.0)), f.x), mix(wxHash(i + vec2(0.0, 1.0)), wxHash(i + vec2(1.0, 1.0)), f.x), f.y);
          }
          // Pavers: q = position in paver units (rows staggered by half). Returns a per-paver tint in x, the joint mask in y (0 on a joint).
          vec2 wxPavers(vec2 q, float joint) {
            q.x += 0.5 * mod(floor(q.y), 2.0);
            vec2 f = fract(q);
            float edge = min(min(f.x, 1.0 - f.x), min(f.y, 1.0 - f.y));
            return vec2(wxHash(floor(q)), smoothstep(joint * 0.5, joint, edge));
          }`)
        .replace('#include <color_fragment>', `#include <color_fragment>
          {
            vec3 p = vWxPos;
            float h = p.y - vWxBase;                                   // metres above the object's ground level
            float px = length(fwidth(p));                              // metres covered by one pixel
            float near = 1.0 - smoothstep(0.08, 0.3, px);              // fine detail only when close enough to resolve it
            float mid = 1.0 - smoothstep(0.3, 1.1, px);
            float broad = wxNoise(p.xz * 0.2 + p.y * 0.13);
            float fine = wxNoise(p.xz * 5.0 + p.y * 4.0);
            vec3 c = diffuseColor.rgb;
            #if ${is('wall')}
              float streak = 0.5 * (wxNoise(vec2(p.x * 2.3, p.y * 0.22)) + wxNoise(vec2(p.z * 2.3 + 7.0, p.y * 0.22 + 3.0)));
              float splash = 1.0 - smoothstep(0.2, 1.3 + broad * 0.9, h);
              c *= 1.0 + (broad - 0.5) * 0.16 * ${A};
              c = mix(c, c * vec3(0.80, 0.78, 0.72), smoothstep(0.48, 0.76, streak) * 0.4 * ${A});
              c = mix(c, c * vec3(0.64, 0.57, 0.47), splash * 0.5 * ${A});
              c *= 1.0 + (fine - 0.5) * 0.06 * near * ${A};
            #elif ${is('roof')}
              float tiles = wxNoise(p.xz * 1.1);
              float courses = 0.5 + 0.5 * sin(p.y * 20.0);
              float moss = smoothstep(0.56, 0.86, wxNoise(p.xz * 0.33 + 11.0));
              c *= 1.0 + ((tiles - 0.5) * 0.22 + (broad - 0.5) * 0.12) * ${A};
              c *= 1.0 + ((fine - 0.5) * 0.12 - courses * 0.07) * near * ${A};
              c = mix(c, c * vec3(0.52, 0.58, 0.44), moss * 0.42 * ${A});
            #elif ${is('stone')}
              float foot = 1.0 - smoothstep(0.0, 0.5 + broad * 0.4, h);
              c *= 1.0 + (broad - 0.5) * 0.18 * ${A} + (fine - 0.5) * 0.08 * near * ${A};
              c = mix(c, c * vec3(0.7, 0.66, 0.58), foot * 0.3 * ${A});
            #elif ${is('terrain')}
              float slope = 1.0 - normalize(vWxNormal).y;               // 0 on the flat, ~0.13 at 30°, ~0.3 at 45°
              float patches = wxNoise(p.xz * 0.9), tufts = wxNoise(p.xz * 3.7 + 9.0), blades = wxNoise(p.xz * 15.0 + 3.0);
              c *= 1.0 + ((patches - 0.5) * 0.16 + (tufts - 0.5) * 0.14 * mid + (blades - 0.5) * 0.18 * near) * ${A};
              c = mix(c, c * vec3(1.22, 1.1, 0.7), smoothstep(0.58, 0.85, wxNoise(p.xz * 0.33 + 21.0)) * 0.28 * ${A});   // dry, yellowed patches
              vec3 earth = vec3(0.2, 0.1, 0.05) * (0.75 + 0.5 * tufts);                                                 // red laterite soil
              c = mix(c, earth, smoothstep(0.09, 0.2, slope + (broad - 0.5) * 0.1) * 0.7 * ${A});
              vec3 rock = vec3(0.13, 0.12, 0.105) * (0.7 + 0.6 * wxNoise(vec2(p.x * 0.5 + p.z * 0.35, p.y * 2.2)));     // bedded rock
              c = mix(c, rock, smoothstep(0.24, 0.38, slope + (patches - 0.5) * 0.1) * ${A});
            #elif ${is('asphalt')}
              float repair = smoothstep(0.62, 0.66, wxNoise(p.xz * 0.11 + 4.0));
              float crack = 1.0 - smoothstep(0.0, 0.035, abs(wxNoise(p.xz * 0.45 + 13.0) - 0.5));
              c *= 1.0 + ((broad - 0.5) * 0.16 + (wxNoise(p.xz * 1.3) - 0.5) * 0.1) * ${A};
              c *= 1.0 + (wxHash(floor(p.xz * 40.0)) - 0.5) * 0.3 * near * ${A};                                        // aggregate
              c = mix(c, c * 0.8, repair * 0.6 * ${A});
              c = mix(c, c * 0.6, crack * near * 0.5 * ${A});                                                     // close views only
            #elif ${is('marking')}
              float wear = smoothstep(0.3, 0.75, wxNoise(p.xz * 2.4)) * (0.6 + 0.4 * broad);
              c = mix(c, vec3(0.2, 0.2, 0.195), wear * 0.6 * ${A});
            #elif ${is('brick')}
              vec2 pv = wxPavers(p.xz / vec2(0.42, 0.21), 0.09);
              c *= 1.0 + (broad - 0.5) * 0.14 * ${A};
              c *= mix(1.0, (0.8 + 0.4 * pv.x) * mix(0.62, 1.0, pv.y), mid * ${A});
            #elif ${is('flagstone')}
              vec2 pv = wxPavers(p.xz / vec2(1.1, 0.75), 0.05);
              c *= 1.0 + (broad - 0.5) * 0.14 * ${A} + (fine - 0.5) * 0.07 * near * ${A};
              c *= mix(1.0, (0.86 + 0.28 * pv.x) * mix(0.6, 1.0, pv.y), mid * ${A});
            #elif ${is('tile')}
              vec2 q = vWxLocal.xz / 0.6;
              vec2 f = fract(q);
              float joint = smoothstep(0.02, 0.045, min(min(f.x, 1.0 - f.x), min(f.y, 1.0 - f.y)));
              c *= 1.0 + (broad - 0.5) * 0.1 * ${A};
              c *= mix(1.0, (0.92 + 0.16 * wxHash(floor(q))) * mix(0.7, 1.0, joint), mid * ${A});
            #elif ${is('rubber')}
              c *= 1.0 + (broad - 0.5) * 0.14 * ${A} + (wxHash(floor(p.xz * 60.0)) - 0.5) * 0.3 * near * ${A};
            #elif ${is('timber')}
              // grain runs along the member: pick the plane the surface lies in
              vec3 an = abs(normalize(vWxNormal));
              vec2 gp = an.y > 0.6 ? p.xz : (an.x > an.z ? p.zy : p.xy);
              float grain = wxNoise(vec2(gp.x * 1.3 + gp.y * 0.4, (gp.y - gp.x * 0.3) * 26.0));
              float grey = smoothstep(0.5, 0.85, wxNoise(p.xz * 0.7 + p.y * 0.5 + 5.0));
              c *= 1.0 + ((broad - 0.5) * 0.2 + (grain - 0.5) * 0.34 * mid) * ${A};
              c = mix(c, vec3(dot(c, vec3(0.33))) * vec3(1.05, 1.0, 0.94), grey * 0.4 * ${A});
            #endif
            #if KIND < 3
              // per-building cast: slightly lighter / darker and warmer / cooler
              c *= (1.0 + (vWxTint - 0.5) * 0.09 * ${A}) * mix(vec3(1.02, 1.0, 0.97), vec3(0.98, 1.0, 1.03), fract(vWxTint * 7.3));
            #endif
            diffuseColor.rgb = c;
          }`);
    };
    mat.customProgramCacheKey = () => `surface-${kind}-${A}`;
    patched.set(material.uuid, mat);
    return mat;
  }

  /** Apply to every mesh under `root` whose material is listed in CONFIG.surfaces. */
  function apply(root) {
    if (!kindOf.size) return;
    root.traverse((o) => {
      if (o.isMesh && o.material?.isMeshStandardMaterial && kindOf.has(o.material.name)) o.material = patch(o.material);
    });
  }
  return { apply };
}
