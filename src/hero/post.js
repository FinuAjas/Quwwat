import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { CONFIG, QUALITY } from './config.js';

/**
 * Colour grade applied after tone mapping (display space), like a film LUT:
 * black/white level → split-toning (cool shadows, warm highlights) → S-curve contrast →
 * saturation, with extra desaturation + a slight olive shift for over-bright greens.
 */
const GradeShader = {
  name: 'GradeShader',
  uniforms: {
    tDiffuse: { value: null },
    uContrast: { value: 0.1 }, uSaturation: { value: 1 }, uGreenDesat: { value: 0.2 },
    uShadows: { value: new THREE.Vector3(1, 1, 1) }, uHighlights: { value: new THREE.Vector3(1, 1, 1) },
    uLift: { value: 0 }, uGain: { value: 1 },
  },
  vertexShader: /* glsl */`varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: /* glsl */`
    uniform sampler2D tDiffuse;
    uniform float uContrast, uSaturation, uGreenDesat, uLift, uGain;
    uniform vec3 uShadows, uHighlights;
    varying vec2 vUv;
    void main() {
      vec4 tex = texture2D(tDiffuse, vUv);
      vec3 c = tex.rgb * uGain + uLift * (1.0 - tex.rgb);
      float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
      // split-toning
      c *= mix(uShadows, uHighlights, smoothstep(0.15, 0.85, l));
      // S-curve contrast around mid-grey
      vec3 s = c * c * (3.0 - 2.0 * c);
      c = mix(c, s, uContrast * 2.0);
      // selective greens: how much green dominates red/blue
      l = dot(c, vec3(0.2126, 0.7152, 0.0722));
      float greenness = clamp((c.g - max(c.r, c.b)) * 4.0, 0.0, 1.0);
      float sat = uSaturation * (1.0 - uGreenDesat * greenness);
      c = mix(vec3(l), c, sat);
      c.r += greenness * uGreenDesat * 0.06 * l; // nudge neon green towards olive
      gl_FragColor = vec4(clamp(c, 0.0, 1.0), tex.a);
    }`,
};

/** Post-processing chain: scene (HDR, MSAA) → tone map + sRGB → colour grade. Later phases insert AO / bloom / DoF. */
export function createPost(renderer, scene, camera) {
  const size = renderer.getDrawingBufferSize(new THREE.Vector2());
  const target = new THREE.WebGLRenderTarget(Math.max(1, size.x), Math.max(1, size.y), { type: THREE.HalfFloatType, samples: QUALITY.msaa });
  const composer = new EffectComposer(renderer, target);
  composer.addPass(new RenderPass(scene, camera));

  // Ground-truth ambient occlusion: soft contact darkening under trees, cars and eaves (desktop tier).
  let ao = null;
  if (QUALITY.ao) {
    ao = new GTAOPass(scene, camera, Math.max(1, size.x), Math.max(1, size.y));
    const a = CONFIG.ao;
    ao.updateGtaoMaterial({ radius: a.radius, distanceExponent: 1, thickness: a.thickness, scale: 1, samples: a.samples, distanceFallOff: 1, screenSpaceRadius: false });
    ao.updatePdMaterial({ lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 6, radiusExponent: 1, rings: 2, samples: 12 });
    ao.blendIntensity = a.intensity;
    // Overlays (mist sprites, selection ring) are on layer 1: hide them while AO renders its depth/normal buffers.
    const renderAO = ao.render.bind(ao);
    ao.render = (...args) => { camera.layers.disable(1); try { renderAO(...args); } finally { camera.layers.enable(1); } };
    composer.addPass(ao);
  }
  composer.addPass(new OutputPass()); // tone mapping (renderer.toneMapping/exposure) + sRGB
  const grade = new ShaderPass(GradeShader);
  composer.addPass(grade);

  function setGrade(g) {
    const u = grade.uniforms;
    u.uContrast.value = g.contrast; u.uSaturation.value = g.saturation; u.uGreenDesat.value = g.greenDesat;
    u.uShadows.value.fromArray(g.shadows); u.uHighlights.value.fromArray(g.highlights);
    u.uLift.value = g.lift; u.uGain.value = g.gain;
  }
  setGrade(CONFIG.grade);

  return {
    composer, grade, ao, setGrade,
    render: () => composer.render(),
    /** Call after the canvas size or pixel ratio changes. */
    setSize(w, h) { composer.setPixelRatio(renderer.getPixelRatio()); composer.setSize(Math.max(1, w), Math.max(1, h)); },
  };
}
