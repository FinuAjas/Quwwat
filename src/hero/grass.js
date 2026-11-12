import * as THREE from 'three';
import { CONFIG, QUALITY } from './config.js';

const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * Grass tufts on the lawns, so they have some depth when the camera is close.
 *
 * Built at load from whatever model is on screen (nothing is stored in the model file):
 *  - where: random points over the plot that land on lawn-coloured terrain (bright green vertex colour — not
 *    forest floor, deep shade or bare earth) and are not covered by a road, path, building or paving
 *    (every other mesh is rasterised top-down into a coverage grid first)
 *  - what: one instanced mesh; each tuft is five blades tinted to match the lawn under it
 *  - when: tufts shrink to nothing between `near` and `far` metres from the camera, and the whole mesh is
 *    switched off in wide views — so the aerial view pays nothing for them
 */
export function createGrass(scene, site, heightAt) {
  const G = CONFIG.grass, count = QUALITY.grass ?? 0;
  const terrain = site.terrain, colour = terrain?.geometry.attributes.color;
  if (!G || !count || !colour) return { update() {} };
  const { minX, maxX, minZ, maxZ } = G.area;

  // ---- lawn colour lookup: average terrain vertex colour per 2 m cell ----
  const CC = 2, cnx = Math.ceil((maxX - minX) / CC) + 1, cnz = Math.ceil((maxZ - minZ) / CC) + 1;
  const sum = new Float32Array(cnx * cnz * 3), hits = new Uint16Array(cnx * cnz);
  const pos = terrain.geometry.attributes.position, v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i).applyMatrix4(terrain.matrixWorld);
    if (v.x < minX || v.x > maxX || v.z < minZ || v.z > maxZ) continue;
    const k = Math.round((v.z - minZ) / CC) * cnx + Math.round((v.x - minX) / CC);
    sum[k * 3] += colour.getX(i); sum[k * 3 + 1] += colour.getY(i); sum[k * 3 + 2] += colour.getZ(i); hits[k]++;
  }

  // ---- coverage grid: everything that sits on the ground, seen from above (0.5 m cells) ----
  const OC = 0.5, onx = Math.ceil((maxX - minX) / OC) + 1, onz = Math.ceil((maxZ - minZ) / OC) + 1;
  const covered = new Uint8Array(onx * onz);
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
  site.root.traverse((o) => {
    if (!o.isMesh || o.isInstancedMesh || o === terrain || o.userData.vegetation) return;
    const p = o.geometry.attributes.position, index = o.geometry.index, tris = (index ? index.count : p.count) / 3;
    for (let t = 0; t < tris; t++) {
      const ia = index ? index.getX(t * 3) : t * 3, ib = index ? index.getX(t * 3 + 1) : t * 3 + 1, ic = index ? index.getX(t * 3 + 2) : t * 3 + 2;
      a.fromBufferAttribute(p, ia).applyMatrix4(o.matrixWorld); b.fromBufferAttribute(p, ib).applyMatrix4(o.matrixWorld); c.fromBufferAttribute(p, ic).applyMatrix4(o.matrixWorld);
      const den = (b.z - c.z) * (a.x - c.x) + (c.x - b.x) * (a.z - c.z);
      if (Math.abs(den) < 1e-9) continue; // vertical face: covers nothing
      // pad by one cell so tufts keep a little clear of every edge
      const i0 = Math.max(0, Math.floor((Math.min(a.x, b.x, c.x) - minX) / OC) - 1), i1 = Math.min(onx - 1, Math.ceil((Math.max(a.x, b.x, c.x) - minX) / OC) + 1);
      const j0 = Math.max(0, Math.floor((Math.min(a.z, b.z, c.z) - minZ) / OC) - 1), j1 = Math.min(onz - 1, Math.ceil((Math.max(a.z, b.z, c.z) - minZ) / OC) + 1);
      const pad = (OC * 1.5) / Math.sqrt(Math.abs(den)); // barycentric slack ≈ one cell
      for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
        const x = minX + i * OC, z = minZ + j * OC;
        const w1 = ((b.z - c.z) * (x - c.x) + (c.x - b.x) * (z - c.z)) / den, w2 = ((c.z - a.z) * (x - c.x) + (a.x - c.x) * (z - c.z)) / den;
        if (w1 >= -pad && w2 >= -pad && 1 - w1 - w2 >= -pad) covered[j * onx + i] = 1;
      }
    }
  });

  // ---- scatter ----
  let seed = 4242;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const spots = [];
  for (let tries = 0; tries < count * 8 && spots.length < count; tries++) {
    const x = minX + rnd() * (maxX - minX), z = minZ + rnd() * (maxZ - minZ);
    if (covered[Math.round((z - minZ) / OC) * onx + Math.round((x - minX) / OC)]) continue;
    const k = Math.round((z - minZ) / CC) * cnx + Math.round((x - minX) / CC);
    if (!hits[k]) continue;
    const r = sum[k * 3] / hits[k], g = sum[k * 3 + 1] / hits[k], bl = sum[k * 3 + 2] / hits[k];
    if (g < G.lawnGreen || g < r * 1.25) continue; // not lawn: forest floor, deep shade, earth
    spots.push({ x, z, r, g, b: bl });
  }
  if (!spots.length) return { update() {} };

  // ---- one tuft: five tapering blades, darker at the root; normals point up so tufts light like the lawn ----
  const P = [], C = [], N = [];
  for (let i = 0; i < 5; i++) {
    const az = (i / 5) * 6.283 + (i % 2) * 0.5, lean = 0.12 + (i % 3) * 0.1, h = 0.7 + ((i * 37) % 10) * 0.03;
    const bx = Math.cos(az) * 0.06, bz = Math.sin(az) * 0.06, sx = -Math.sin(az) * 0.035, sz = Math.cos(az) * 0.035;
    P.push(bx - sx, 0, bz - sz, bx + sx, 0, bz + sz, bx + Math.cos(az) * lean, h, bz + Math.sin(az) * lean);
    C.push(0.72, 0.72, 0.72, 0.72, 0.72, 0.72, 1.4, 1.4, 1.15);
    N.push(0, 1, 0, 0, 1, 0, 0, 1, 0);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(C, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3));

  const uniforms = { uGrassNear: { value: G.near }, uGrassFar: { value: G.far }, uGrassTime: { value: 0 }, uGrassWind: { value: reducedMotion ? 0 : G.wind } };
  const mat = new THREE.MeshStandardMaterial({ name: 'Grass_Tufts', vertexColors: true, roughness: 1, metalness: 0, side: THREE.DoubleSide });
  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uGrassNear, uGrassFar, uGrassTime, uGrassWind;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        vec3 gOrigin = (modelMatrix * vec4(instanceMatrix[3].xyz, 1.0)).xyz;
        transformed *= 1.0 - smoothstep(uGrassNear, uGrassFar, distance(gOrigin, cameraPosition)); // shrink away with distance
        float gSway = sin(uGrassTime * 1.7 + gOrigin.x * 0.6 + gOrigin.z * 0.45) + 0.4 * sin(uGrassTime * 3.9 + gOrigin.x * 1.9);
        transformed.xz += gSway * uGrassWind * transformed.y * transformed.y;`);
  };
  mat.customProgramCacheKey = () => 'grass-v1';

  const mesh = new THREE.InstancedMesh(geo, mat, spots.length);
  mesh.name = 'Grass';
  mesh.receiveShadow = true;
  mesh.frustumCulled = false;
  mesh.layers.set(2); // like leaf cards: kept out of the ambient-occlusion pass, which would speckle the lawn
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0), sc = new THREE.Vector3(), tint = new THREE.Color();
  spots.forEach((s, i) => {
    const h = G.height[0] + rnd() * (G.height[1] - G.height[0]);
    q.setFromAxisAngle(up, rnd() * 6.283);
    mesh.setMatrixAt(i, m4.compose(v.set(s.x, heightAt(s.x, s.z) - 0.02, s.z), q, sc.set(h * 1.2, h, h * 1.2)));
    const k = 0.9 + rnd() * 0.35;
    mesh.setColorAt(i, tint.setRGB(s.r * k * (1 + rnd() * 0.2), s.g * k, s.b * k));
  });
  mesh.instanceColor.needsUpdate = true;
  scene.add(mesh);

  const centre = new THREE.Vector3((minX + maxX) / 2, 0, (minZ + maxZ) / 2), reach = Math.hypot(maxX - minX, maxZ - minZ) / 2 + G.far;
  function update(t, camera) {
    mesh.visible = camera.position.distanceTo(centre) < reach && camera.position.y < G.far * 1.6; // nothing to draw in wide views
    uniforms.uGrassTime.value = t;
  }
  return { mesh, update, count: spots.length };
}
