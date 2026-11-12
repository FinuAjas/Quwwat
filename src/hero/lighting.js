import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { CONFIG, QUALITY } from './config.js';

/** Sun + sky fill, soft shadows, PBR environment, sky dome and distance fog. */
export function setupLighting(scene, renderer) {
  const center = new THREE.Vector3().fromArray(CONFIG.siteCenter);

  // Soft sky/ground bounce
  const h = CONFIG.hemi;
  const hemi = new THREE.HemisphereLight(h.sky, h.ground, h.intensity);
  hemi.name = 'SkyFill';
  scene.add(hemi);

  // Warm sun from the north-west so shadows fall towards the south-east (as in the render)
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
    sun.shadow.normalBias = 0.5;
    sun.shadow.radius = 3;
  }
  scene.add(sun, sun.target);

  // Image-based lighting for glass/water/paint reflections (cheap, no HDR download)
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = CONFIG.envIntensity;
  pmrem.dispose();

  // Atmosphere: linear fog matched to the sky horizon colour
  scene.fog = new THREE.Fog(CONFIG.fog.color, CONFIG.fog.near, CONFIG.fog.far);
  scene.background = new THREE.Color(CONFIG.fog.color);
  scene.add(createSkyDome());

  return { sun, hemi };
}

function createSkyDome() {
  const { top, horizon, bottom } = CONFIG.sky;
  const mat = new THREE.ShaderMaterial({
    name: 'SkyGradient',
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { top: { value: new THREE.Color(top) }, horizon: { value: new THREE.Color(horizon) }, bottom: { value: new THREE.Color(bottom) } },
    vertexShader: /* glsl */`
      varying vec3 vDir;
      void main() { vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */`
      uniform vec3 top; uniform vec3 horizon; uniform vec3 bottom; varying vec3 vDir;
      void main() {
        float y = vDir.y;
        vec3 c = y > 0.0 ? mix(horizon, top, pow(smoothstep(0.0, 0.6, y), 0.8)) : mix(horizon, bottom, smoothstep(0.0, -0.2, y));
        gl_FragColor = vec4(c, 1.0);
        #include <colorspace_fragment>
      }`,
  });
  const dome = new THREE.Mesh(new THREE.SphereGeometry(2500, 32, 16), mat);
  dome.name = 'SkyDome';
  dome.renderOrder = -1;
  dome.frustumCulled = false;
  return dome;
}
