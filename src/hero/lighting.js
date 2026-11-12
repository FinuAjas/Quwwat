import * as THREE from 'three';
import { CONFIG, QUALITY } from './config.js';

/**
 * Outdoor lighting for the active look:
 *  - warm directional sun with soft shadows (fitted to the site once the model is loaded)
 *  - hemisphere fill
 *  - a procedural sky (gradient + sun glow + ground bounce colour) used both as the visible
 *    background and, pre-filtered, as the image-based lighting / reflection environment —
 *    so glass, water and car paint reflect a sky whose sun matches the real light direction
 *  - distance fog matched to the horizon
 */
export function setupLighting(scene, renderer) {
  const center = new THREE.Vector3().fromArray(CONFIG.siteCenter);

  const h = CONFIG.hemi;
  const hemi = new THREE.HemisphereLight(h.sky, h.ground, h.intensity);
  hemi.name = 'SkyFill';
  scene.add(hemi);

  const s = CONFIG.sun;
  const sun = new THREE.DirectionalLight(s.color, s.intensity);
  sun.name = 'Sun';
  sun.position.copy(center).add(new THREE.Vector3().fromArray(s.position));
  sun.target.position.copy(center);
  if (QUALITY.shadows) {
    sun.castShadow = true;
    sun.shadow.mapSize.set(QUALITY.shadowMapSize, QUALITY.shadowMapSize);
    const e = s.shadowExtent;
    Object.assign(sun.shadow.camera, { left: -e, right: e, top: e, bottom: -e, near: 20, far: s.shadowFar });
    sun.shadow.bias = -0.0003;
    sun.shadow.normalBias = 0.35;
  }
  scene.add(sun, sun.target);
  const sunDir = new THREE.Vector3().fromArray(s.position).normalize();

  // Visible sky
  const dome = createSkyDome(sunDir, 1);
  scene.add(dome);

  // Environment (IBL + reflections) rendered from the same sky, slightly brighter, with a ground colour
  const envScene = new THREE.Scene();
  envScene.add(createSkyDome(sunDir, CONFIG.env.skyBoost));
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(envScene, 0.02, 1, 6000).texture;
  scene.environmentIntensity = CONFIG.env.intensity;
  pmrem.dispose();

  scene.fog = new THREE.Fog(CONFIG.fog.color, CONFIG.fog.near, CONFIG.fog.far);
  scene.background = new THREE.Color(CONFIG.fog.color);

  /**
   * Tighten the shadow camera around the given objects (in light space) so the whole shadow map
   * is spent on the site instead of on empty forest. Call once after the model is added.
   */
  function fitShadows(objects, margin = 22) {
    if (!sun.castShadow) return;
    const box = new THREE.Box3();
    objects.filter(Boolean).forEach((o) => box.expandByObject(o));
    if (box.isEmpty()) return;
    box.expandByScalar(margin);
    sun.updateMatrixWorld(); sun.target.updateMatrixWorld();
    const cam = sun.shadow.camera;
    const view = new THREE.Matrix4().lookAt(sun.position, sun.target.position, cam.up).setPosition(sun.position).invert();
    const p = new THREE.Vector3(), b = new THREE.Box3();
    for (let i = 0; i < 8; i++) {
      p.set(i & 1 ? box.max.x : box.min.x, i & 2 ? box.max.y : box.min.y, i & 4 ? box.max.z : box.min.z).applyMatrix4(view);
      b.expandByPoint(p);
    }
    cam.left = b.min.x; cam.right = b.max.x; cam.bottom = b.min.y; cam.top = b.max.y;
    cam.near = Math.max(1, -b.max.z - 260); // keep tall trees between the sun and the site as casters
    cam.far = -b.min.z + 40;
    cam.updateProjectionMatrix();
    const texel = Math.max(b.max.x - b.min.x, b.max.y - b.min.y) / sun.shadow.mapSize.x;
    sun.shadow.normalBias = THREE.MathUtils.clamp(texel * 4, 0.12, 0.5);
    renderer.shadowMap.needsUpdate = true;
    return { width: b.max.x - b.min.x, height: b.max.y - b.min.y, texel };
  }

  return { sun, hemi, dome, fitShadows };
}

function createSkyDome(sunDir, boost) {
  const { top, horizon, bottom } = CONFIG.sky;
  const mat = new THREE.ShaderMaterial({
    name: 'SkyGradient',
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: {
      top: { value: new THREE.Color(top) }, horizon: { value: new THREE.Color(horizon) }, bottom: { value: new THREE.Color(bottom) },
      ground: { value: new THREE.Color(CONFIG.env.ground) },
      sunDir: { value: sunDir.clone() }, sunColor: { value: new THREE.Color(CONFIG.sun.color) },
      glow: { value: CONFIG.env.sunGlow }, boost: { value: boost },
    },
    vertexShader: /* glsl */`
      varying vec3 vDir;
      void main() { vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */`
      uniform vec3 top, horizon, bottom, ground, sunDir, sunColor; uniform float glow, boost; varying vec3 vDir;
      void main() {
        vec3 d = normalize(vDir);
        vec3 sky = mix(horizon, top, pow(smoothstep(0.0, 0.6, d.y), 0.8));
        // below the horizon: haze band, then (for reflections / bounce light) the ground colour
        vec3 low = mix(bottom, ground, smoothstep(-0.03, -0.25, d.y) * step(1.001, boost));
        vec3 c = d.y > 0.0 ? sky : mix(horizon, low, smoothstep(0.0, -0.06, d.y));
        // sun: tight core + wide atmospheric glow, only above the horizon
        float s = max(dot(d, sunDir), 0.0);
        c += sunColor * glow * (pow(s, 900.0) * 14.0 + pow(s, 48.0) * 0.9 + pow(s, 6.0) * 0.22) * smoothstep(-0.05, 0.05, d.y);
        gl_FragColor = vec4(c * boost, 1.0);
        #include <colorspace_fragment>
      }`,
  });
  const dome = new THREE.Mesh(new THREE.SphereGeometry(2500, 48, 24), mat);
  dome.name = 'SkyDome';
  dome.renderOrder = -1;
  dome.frustumCulled = false;
  return dome;
}
