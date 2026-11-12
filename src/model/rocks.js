import * as THREE from 'three';
import { SITE_BOUNDARY } from './layout.js';
import { roadQuery } from './terrain.js';
import { isBlocked } from './structures.js';
import { mergeVertices, mulberry32, fbm, signedDistToPolygon, smoothstep } from './geom.js';
import { M } from './materials.js';

/**
 * How rocky the ground is at (x, z), 0–1: steep slopes, plus scattered stony patches.
 * Shared with the vegetation, which thins out where this is high.
 */
export function rockiness(x, z, heightAt) {
  const slope = Math.hypot(heightAt(x + 3, z) - heightAt(x - 3, z), heightAt(x, z + 3) - heightAt(x, z - 3)) / 6;
  const stony = fbm(x / 38 + 5, z / 38 - 8, 3) * 0.5 + 0.5;
  return Math.max(smoothstep(0.42, 0.75, slope), smoothstep(0.74, 0.86, stony));
}

/** One boulder ≈ 1 unit across, faceted, sitting a third into the ground; grey with warm and lichen-green faces. */
function boulder(seed) {
  let g = new THREE.IcosahedronGeometry(0.5, 1);
  g.deleteAttribute('normal'); g.deleteAttribute('uv');
  g = mergeVertices(g);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const k = 1 + fbm(x * 3 + seed, z * 3 + y * 2.5 - seed, 3) * 0.55;
    p.setXYZ(i, x * k, y * k * 0.62 + 0.12, z * k * 0.85);
  }
  g = g.toNonIndexed();
  g.computeVertexNormals(); // faceted
  const q = g.attributes.position, col = new Float32Array(q.count * 3), rnd = mulberry32(seed), c = new THREE.Color();
  for (let i = 0; i < q.count; i += 3) {
    const r = rnd(), top = smoothstep(-0.1, 0.4, q.getY(i));
    c.setRGB(0.2, 0.19, 0.17).multiplyScalar(0.7 + 0.55 * top + (rnd() - 0.5) * 0.25);
    if (r < 0.2) c.lerp(new THREE.Color(0.22, 0.15, 0.1), 0.5);            // iron-stained (laterite) face
    else if (r < 0.38 && top > 0.5) c.lerp(new THREE.Color(0.14, 0.2, 0.09), 0.45); // lichen / moss on top
    for (let k = 0; k < 3; k++) col.set([c.r, c.g, c.b], (i + k) * 3);
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return g;
}

/**
 * Boulders and outcrops where the ground is steep or stony — mostly in the forest round the plot, a few
 * on the plot's own banks. Three boulder shapes, instanced; each placement is a small cluster.
 */
export function buildRocks(heightAt) {
  const rand = mulberry32(31), spots = [];
  for (let gx = -244; gx <= 274; gx += 6) for (let gz = -244; gz <= 244; gz += 6) {
    const x = gx + (rand() - 0.5) * 5.6, z = gz + (rand() - 0.5) * 5.6;
    if (Math.hypot(x - 15, z) > 240) continue;
    // on steep or stony ground, plus loose scatters of fieldstone where a second noise field runs high
    const rock = Math.max(rockiness(x, z, heightAt), 0.45 * smoothstep(0.56, 0.72, fbm(x / 24 - 11, z / 24 + 6, 3) * 0.5 + 0.5));
    if (rock < 0.12 || rand() > rock * 0.7) continue;
    const sd = signedDistToPolygon(x, z, SITE_BOUNDARY), q = roadQuery(x, z);
    if (sd < 0 && (isBlocked(x, z, 2) || (q && q.d < q.extent + 3))) continue; // keep the built areas clear
    const n = 1 + Math.floor(rand() * 3), big = (0.9 + rand() * 2.6) * (0.6 + 0.6 * rock);
    for (let i = 0; i < n; i++) {
      const a = rand() * 6.28, d = i ? big * (0.5 + rand() * 0.6) : 0, s = i ? big * (0.3 + rand() * 0.35) : big;
      spots.push({ x: x + Math.cos(a) * d, z: z + Math.sin(a) * d, s, sy: 0.7 + rand() * 0.6, rot: rand() * 6.28, tilt: (rand() - 0.5) * 0.5 });
    }
  }
  const group = new THREE.Group(); group.name = 'Rocks';
  const kinds = [boulder(3), boulder(17), boulder(41)], lists = kinds.map(() => []);
  const cap = 190 * kinds.length, stride = Math.max(1, spots.length / cap); // even thinning if there are too many
  for (let i = 0; i < spots.length && Math.floor(i / stride) < cap; i += stride) lists[Math.floor(rand() * kinds.length)].push(spots[Math.floor(i)]);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), v = new THREE.Vector3(), sc = new THREE.Vector3(), tint = new THREE.Color();
  let total = 0;
  kinds.forEach((geo, k) => {
    const list = lists[k]; if (!list.length) return;
    const im = new THREE.InstancedMesh(geo, M.rock, list.length);
    im.name = `Rocks_${'ABC'[k]}`;
    im.userData = { castShadow: true, receiveShadow: true };
    list.forEach((t, i) => {
      q.setFromEuler(e.set(t.tilt, t.rot, t.tilt * 0.6, 'YXZ'));
      im.setMatrixAt(i, m4.compose(v.set(t.x, heightAt(t.x, t.z) - 0.12 * t.s, t.z), q, sc.set(t.s, t.s * t.sy, t.s)));
      const b = 0.8 + rand() * 0.45;
      im.setColorAt(i, tint.setRGB(b * (1 + rand() * 0.1), b, b * (1 - rand() * 0.12)));
    });
    im.instanceColor.needsUpdate = true;
    im.computeBoundingSphere();
    group.add(im);
    total += list.length;
  });
  return { group, total };
}
