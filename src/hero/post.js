import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { CONFIG, QUALITY } from './config.js';

const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const VERT = /* glsl */`varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;

/**
 * Tilt-shift blur (one direction per pass): sharp in a horizontal band around the focus line,
 * progressively blurred above and below — the "architectural model" depth-of-field look.
 * Screen-space only (no depth buffer needed), so it is cheap and artefact-free on foliage.
 */
const TiltShiftShader = {
  name: 'TiltShiftShader',
  uniforms: { tDiffuse: { value: null }, uStep: { value: new THREE.Vector2() }, uFocusY: { value: 0.5 }, uBand: { value: 0.2 }, uFalloff: { value: 0.3 }, uBlur: { value: 0 } },
  vertexShader: VERT,
  fragmentShader: /* glsl */`
    uniform sampler2D tDiffuse; uniform vec2 uStep; uniform float uFocusY, uBand, uFalloff, uBlur; varying vec2 vUv;
    void main() {
      float a = smoothstep(uBand, uBand + uFalloff, abs(vUv.y - uFocusY)) * uBlur;
      if (a < 0.05) { gl_FragColor = texture2D(tDiffuse, vUv); return; }
      vec2 s = uStep * a * 0.25;
      vec4 c = texture2D(tDiffuse, vUv) * 0.2042;
      c += (texture2D(tDiffuse, vUv + s) + texture2D(tDiffuse, vUv - s)) * 0.1802;
      c += (texture2D(tDiffuse, vUv + s * 2.0) + texture2D(tDiffuse, vUv - s * 2.0)) * 0.1238;
      c += (texture2D(tDiffuse, vUv + s * 3.0) + texture2D(tDiffuse, vUv - s * 3.0)) * 0.0663;
      c += (texture2D(tDiffuse, vUv + s * 4.0) + texture2D(tDiffuse, vUv - s * 4.0)) * 0.0276;
      gl_FragColor = c;
    }`,
};

/**
 * Final pass: tone mapping + sRGB (what three's OutputPass did, folded in here to save a full-screen pass), then
 * the "film" look in display space: chromatic aberration → black/white level → split-toning → S-curve contrast →
 * saturation (extra desaturation + olive shift for over-bright greens) → vignette → grain.
 */
const GradeShader = {
  name: 'GradeShader',
  uniforms: {
    tDiffuse: { value: null },
    uContrast: { value: 0.1 }, uSaturation: { value: 1 }, uGreenDesat: { value: 0.2 },
    uShadows: { value: new THREE.Vector3(1, 1, 1) }, uHighlights: { value: new THREE.Vector3(1, 1, 1) },
    uLift: { value: 0 }, uGain: { value: 1 }, toneMappingExposure: { value: 1 },
    uVignette: { value: 0 }, uGrain: { value: 0 }, uAberration: { value: 0 }, uTime: { value: 0 }, uRes: { value: new THREE.Vector2(1, 1) },
  },
  vertexShader: VERT,
  fragmentShader: /* glsl */`
    uniform sampler2D tDiffuse;
    uniform float uContrast, uSaturation, uGreenDesat, uLift, uGain, uVignette, uGrain, uAberration, uTime;
    uniform vec3 uShadows, uHighlights; uniform vec2 uRes;
    varying vec2 vUv;
    #include <tonemapping_pars_fragment>
    vec3 wxToneMap(vec3 c) {
      #if defined(LINEAR_TONE_MAPPING)
        c = LinearToneMapping(c);
      #elif defined(REINHARD_TONE_MAPPING)
        c = ReinhardToneMapping(c);
      #elif defined(CINEON_TONE_MAPPING)
        c = CineonToneMapping(c);
      #elif defined(ACES_FILMIC_TONE_MAPPING)
        c = ACESFilmicToneMapping(c);
      #elif defined(AGX_TONE_MAPPING)
        c = AgXToneMapping(c);
      #elif defined(NEUTRAL_TONE_MAPPING)
        c = NeutralToneMapping(c);
      #endif
      #ifdef SRGB_TRANSFER
        c = sRGBTransferOETF(vec4(c, 1.0)).rgb;
      #endif
      return c;
    }
    float hash(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
    void main() {
      vec2 d = vUv - 0.5;
      // lens: red/blue fringes grow towards the corners (sub-pixel at the centre)
      vec2 ca = d * 2.0 * uAberration / uRes;
      // each sample is tone-mapped whole before its channel is taken (AgX mixes channels), as with a separate output pass
      vec3 tex = wxToneMap(texture2D(tDiffuse, vUv).rgb);
      if (uAberration > 0.0) tex = vec3(wxToneMap(texture2D(tDiffuse, vUv + ca).rgb).r, tex.g, wxToneMap(texture2D(tDiffuse, vUv - ca).rgb).b);
      vec3 c = tex * uGain + uLift * (1.0 - tex);
      float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
      c *= mix(uShadows, uHighlights, smoothstep(0.15, 0.85, l));
      vec3 s = c * c * (3.0 - 2.0 * c);
      c = mix(c, s, uContrast * 2.0);
      l = dot(c, vec3(0.2126, 0.7152, 0.0722));
      float greenness = clamp((c.g - max(c.r, c.b)) * 4.0, 0.0, 1.0);
      c = mix(vec3(l), c, uSaturation * (1.0 - uGreenDesat * greenness));
      c.r += greenness * uGreenDesat * 0.06 * l;
      // vignette (slightly oval) and luminance-weighted film grain
      c *= 1.0 - uVignette * smoothstep(0.45, 1.25, length(d * vec2(1.0, 0.8)) * 1.6);
      c += (hash(vUv * uRes + fract(uTime) * 311.7) - 0.5) * uGrain * (1.0 - 0.6 * l);
      gl_FragColor = vec4(clamp(c, 0.0, 1.0), 1.0);
    }`,
};

/**
 * Post-processing chain (each stage optional per quality tier):
 * scene (HDR, MSAA) → ambient occlusion → bloom → tilt-shift → tone map + sRGB + film grade.
 */
export function createPost(renderer, scene, camera) {
  const P = CONFIG.post;
  const size = renderer.getDrawingBufferSize(new THREE.Vector2());
  const w0 = Math.max(1, size.x), h0 = Math.max(1, size.y);
  const target = new THREE.WebGLRenderTarget(w0, h0, { type: THREE.HalfFloatType, samples: QUALITY.msaa });
  const composer = new EffectComposer(renderer, target);
  composer.addPass(new RenderPass(scene, camera));

  // Ground-truth ambient occlusion: soft contact darkening under trees, cars and eaves.
  let ao = null;
  if (QUALITY.ao) {
    // AO is soft and low-frequency: computing it (and the extra normal/depth render of the scene) at reduced
    // resolution costs a fraction of full size and looks the same once blended.
    const aoScale = QUALITY.aoScale ?? 1;
    const aoSize = (w, h) => [Math.max(1, Math.round(w * aoScale)), Math.max(1, Math.round(h * aoScale))];
    ao = new GTAOPass(scene, camera, ...aoSize(w0, h0));
    const setAOSize = ao.setSize.bind(ao);
    ao.setSize = (w, h) => setAOSize(...aoSize(w, h));
    const a = CONFIG.ao;
    ao.updateGtaoMaterial({ radius: a.radius, distanceExponent: 1, thickness: a.thickness, scale: 1, samples: QUALITY.aoSamples, distanceFallOff: 1, screenSpaceRadius: false });
    ao.updatePdMaterial({ lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 6, radiusExponent: 1, rings: 2, samples: 12 });
    ao.blendIntensity = a.intensity;
    // Hide two layers while AO renders its depth/normal buffers: overlays (1: mist sprites, selection ring) and
    // leaf-card plants (2) — that pass ignores alpha cut-outs, so every leaf card would count as a solid quad
    // and leave dark triangles hanging in the canopy.
    // The stock "Default" output copies the whole image to the other buffer and then darkens the copy. Instead, only
    // compute the AO here (output Off) and multiply it straight onto the image in place: one full-screen pass less.
    ao.output = GTAOPass.OUTPUT.Off;
    ao.needsSwap = false;
    const renderAO = ao.render.bind(ao);
    ao.render = (renderer, writeBuffer, readBuffer, ...rest) => {
      camera.layers.disable(1); camera.layers.disable(2);
      try { renderAO(renderer, writeBuffer, readBuffer, ...rest); } finally { camera.layers.enable(1); camera.layers.enable(2); }
      ao.blendMaterial.uniforms.intensity.value = ao.blendIntensity;
      ao.blendMaterial.uniforms.tDiffuse.value = ao.pdRenderTarget.texture;
      ao.renderPass(renderer, ao.blendMaterial, readBuffer);
    };
    composer.addPass(ao);
  }

  // Bloom: only very bright (HDR) pixels — sun glints on water, glass and car paint.
  let bloom = null;
  if (QUALITY.bloom) {
    bloom = new UnrealBloomPass(new THREE.Vector2(w0, h0), P.bloom.strength, P.bloom.radius, P.bloom.threshold);
    composer.addPass(bloom);
  }

  // Tilt-shift depth of field (horizontal + vertical pass)
  let tiltH = null, tiltV = null;
  if (QUALITY.dof) {
    tiltH = new ShaderPass(TiltShiftShader); tiltV = new ShaderPass(TiltShiftShader);
    for (const t of [tiltH, tiltV]) { t.uniforms.uBand.value = P.tiltShift.band; t.uniforms.uFalloff.value = P.tiltShift.falloff; }
    composer.addPass(tiltH); composer.addPass(tiltV);
  }

  const grade = new ShaderPass(GradeShader);
  // Tone mapping is done inside the shader (as OutputPass does), so three.js must not add its own on the way to screen.
  grade.material.toneMapped = false;
  const TONE = { [THREE.LinearToneMapping]: 'LINEAR', [THREE.ReinhardToneMapping]: 'REINHARD', [THREE.CineonToneMapping]: 'CINEON',
    [THREE.ACESFilmicToneMapping]: 'ACES_FILMIC', [THREE.AgXToneMapping]: 'AGX', [THREE.NeutralToneMapping]: 'NEUTRAL' }[renderer.toneMapping];
  grade.material.defines = { ...(TONE ? { [`${TONE}_TONE_MAPPING`]: '' } : {}),
    ...(THREE.ColorManagement.getTransfer(renderer.outputColorSpace) === THREE.SRGBTransfer ? { SRGB_TRANSFER: '' } : {}) };
  grade.uniforms.toneMappingExposure.value = renderer.toneMappingExposure;
  grade.uniforms.uVignette.value = P.vignette;
  grade.uniforms.uGrain.value = P.grain;
  grade.uniforms.uAberration.value = QUALITY.dof ? P.aberration : 0;
  composer.addPass(grade);

  function setGrade(g) {
    const u = grade.uniforms;
    u.uContrast.value = g.contrast; u.uSaturation.value = g.saturation; u.uGreenDesat.value = g.greenDesat;
    u.uShadows.value.fromArray(g.shadows); u.uHighlights.value.fromArray(g.highlights);
    u.uLift.value = g.lift; u.uGain.value = g.gain;
  }
  setGrade(CONFIG.grade);

  const ndc = new THREE.Vector3();
  let pxRatio = renderer.getPixelRatio();
  function sizeUniforms() {
    const s = renderer.getDrawingBufferSize(new THREE.Vector2());
    grade.uniforms.uRes.value.set(Math.max(1, s.x), Math.max(1, s.y));
    if (tiltH) { tiltH.uniforms.uStep.value.set(1 / Math.max(1, s.x), 0); tiltV.uniforms.uStep.value.set(0, 1 / Math.max(1, s.y)); }
    pxRatio = renderer.getPixelRatio();
  }
  sizeUniforms();

  return {
    composer, grade, ao, bloom, setGrade,
    render: () => composer.render(),
    /**
     * Per-frame: keep the sharp band on the orbit target and scale blur with viewing distance
     * (wide aerial views get the full miniature effect, close-ups stay mostly sharp).
     */
    update(t, focusPoint, distance) {
      if (!reducedMotion) grade.uniforms.uTime.value = t;
      grade.uniforms.toneMappingExposure.value = renderer.toneMappingExposure;
      if (!tiltH) return;
      ndc.copy(focusPoint).project(camera);
      const y = THREE.MathUtils.clamp(ndc.y * 0.5 + 0.5, 0.25, 0.75);
      const k = THREE.MathUtils.clamp((distance - 40) / 220, 0.25, 1);
      for (const pass of [tiltH, tiltV]) { pass.uniforms.uFocusY.value = y; pass.uniforms.uBlur.value = P.tiltShift.blur * pxRatio * k; }
    },
    /** Call after the canvas size or pixel ratio changes. */
    setSize(w, h) {
      composer.setPixelRatio(renderer.getPixelRatio());
      composer.setSize(Math.max(1, w), Math.max(1, h));
      sizeUniforms();
    },
  };
}
