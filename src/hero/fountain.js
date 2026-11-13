import * as THREE from 'three';
import { TIER } from './config.js';

const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * Fountain spray as moving droplets. Looks for a node named `Fountain_Spray` in the model (the static
 * spray cone, or just an Empty in an artist model), hides it and plays a particle fountain from its base:
 * a tall central jet and a ring of arcing side jets. Every droplet is a pure function of time in the
 * vertex shader (launch velocity + gravity), so there is no per-frame work on the CPU.
 * With "reduce motion" on, the static spray is left as it is.
 */
export function createFountain(scene, site) {
  const marker = site.root.getObjectByName('Fountain_Spray');
  if (!marker || reducedMotion) return { update() {} };
  const box = new THREE.Box3().setFromObject(marker);
  const origin = box.isEmpty()
    ? marker.getWorldPosition(new THREE.Vector3())
    : new THREE.Vector3((box.min.x + box.max.x) / 2, box.min.y, (box.min.z + box.max.z) / 2);
  marker.visible = false;

  const count = TIER === 'low' ? 220 : 520;
  const seed = new Float32Array(count * 4), pos = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) seed.set([Math.random(), Math.random(), Math.random(), i < count * 0.42 ? 0 : 1], i * 4);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('aSeed', new THREE.BufferAttribute(seed, 4));
  geo.boundingSphere = new THREE.Sphere(origin.clone().add(new THREE.Vector3(0, 1.5, 0)), 5);

  const uniforms = { uTime: { value: 0 }, uOrigin: { value: origin }, uSize: { value: 1 } };
  const mat = new THREE.ShaderMaterial({
    name: 'Fountain_Droplets', transparent: true, depthWrite: false, uniforms,
    vertexShader: /* glsl */`
      uniform float uTime; uniform vec3 uOrigin; uniform float uSize;
      attribute vec4 aSeed;
      varying float vFade;
      void main() {
        float central = 1.0 - aSeed.w;
        float ang = aSeed.y * 6.2832;
        // launch velocity: tall, tight central jet — or a ring of jets arcing outwards
        vec3 v0 = central > 0.5
          ? vec3(cos(ang) * 0.3 * aSeed.z, 5.6 + aSeed.z * 0.7, sin(ang) * 0.3 * aSeed.z)
          : vec3(cos(ang) * (1.3 + aSeed.z * 0.25), 3.5 + aSeed.z * 0.5, sin(ang) * (1.3 + aSeed.z * 0.25));
        float life = 2.0 * v0.y / 9.8;                                 // time to fall back to the nozzle height
        float t = fract(uTime / life + aSeed.x) * life;
        vec3 p = uOrigin + v0 * t + vec3(0.0, -4.9 * t * t, 0.0);
        vFade = smoothstep(0.0, 0.08, t / life) * (1.0 - smoothstep(0.75, 1.0, t / life));
        vec4 mv = viewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mv;
        gl_PointSize = clamp(uSize * (0.07 + 0.05 * aSeed.z) / -mv.z, 1.0, 14.0);
      }`,
    fragmentShader: /* glsl */`
      varying float vFade;
      void main() {
        float d = length(gl_PointCoord - 0.5);
        float a = (1.0 - smoothstep(0.2, 0.5, d)) * vFade * 0.75;
        if (a < 0.01) discard;
        gl_FragColor = vec4(vec3(1.25, 1.3, 1.35), a);                 // slightly over white: droplets catch the sun
      }`,
  });
  const points = new THREE.Points(geo, mat);
  points.name = 'Fountain_Particles';
  points.layers.set(1); // overlay layer: skipped by the ambient-occlusion pass
  points.renderOrder = 6;
  scene.add(points);

  return {
    points,
    /** viewportHeight in device pixels and the camera, so droplets keep their size in metres on screen. */
    update(t, camera, viewportHeight) {
      uniforms.uTime.value = t;
      uniforms.uSize.value = viewportHeight / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2));
    },
  };
}
