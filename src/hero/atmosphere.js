import * as THREE from 'three';
import { CONFIG, QUALITY } from './config.js';

// ---------- small value-noise helpers (texture + ridge profiles) ----------
function makeNoise(seed) {
  const perm = new Float32Array(1024);
  let s = seed;
  for (let i = 0; i < 1024; i++) { s = (s * 16807) % 2147483647; perm[i] = s / 2147483647; }
  const at = (x, y) => perm[((x & 31) + (y & 31) * 32) & 1023];
  const smooth = (t) => t * t * (3 - 2 * t);
  return function noise(x, y) {
    const ix = Math.floor(x), iy = Math.floor(y), fx = smooth(x - ix), fy = smooth(y - iy);
    const a = at(ix, iy), b = at(ix + 1, iy), c = at(ix, iy + 1), d = at(ix + 1, iy + 1);
    return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
  };
}
const fbm = (n, x, y, oct = 4) => { let v = 0, a = 0.5, f = 1, t = 0; for (let i = 0; i < oct; i++) { v += a * n(x * f, y * f); t += a; a *= 0.5; f *= 2.1; } return v / t; };

/** Wispy cloud texture: fractal noise shaped by a soft oval falloff (no visible blobs or hard rims). */
function cloudTexture(size, seed) {
  const cv = document.createElement('canvas');
  cv.width = cv.height = size;
  const g = cv.getContext('2d'), img = g.createImageData(size, size), n = makeNoise(seed);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const u = x / size - 0.5, v = y / size - 0.5;
    const r = Math.hypot(u * 1.9, v * 2.7);                          // oval: wider than tall
    const edge = Math.max(0, 1 - r * 1.05);
    const wisp = fbm(n, x / size * 5 + seed, y / size * 5, 5);
    const a = Math.pow(Math.max(0, edge * (0.35 + wisp * 1.25) - 0.18), 1.35);
    const k = (y * size + x) * 4;
    img.data[k] = img.data[k + 1] = img.data[k + 2] = 255;
    img.data[k + 3] = Math.min(255, a * 300);
  }
  g.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/**
 * Drifting mist banks around the edge of the site. Each bank fades out as the camera approaches,
 * so flying through one never whites out the view, and slowly rotates so the shapes keep changing.
 * (The mist that sits between the trees in the valleys comes from the atmosphere shader in lighting.js.)
 */
export function createMist(scene) {
  const m = CONFIG.mist;
  const center = new THREE.Vector3().fromArray(CONFIG.siteCenter);
  const textures = [cloudTexture(256, 7), cloudTexture(256, 99), cloudTexture(256, 1234)];
  const group = new THREE.Group();
  group.name = 'Mist';
  const puffs = [];
  for (let i = 0; i < QUALITY.mistCount; i++) {
    const base = CONFIG.mistOpacity * (0.6 + Math.random() * 0.4);
    const mat = new THREE.SpriteMaterial({
      map: textures[i % textures.length], transparent: true, depthWrite: false, opacity: base,
      color: CONFIG.mistColor, // tinted per look so mist stays soft white after exposure
      rotation: Math.random() * Math.PI,
    });
    const sp = new THREE.Sprite(mat);
    const size = m.sizeMin + Math.random() * (m.sizeMax - m.sizeMin);
    sp.scale.set(size * 1.25, size * 0.8, 1);
    sp.renderOrder = 10;
    sp.layers.set(1); // overlay layer: skipped by the ambient-occlusion pass
    puffs.push({
      sprite: sp, base,
      angle: (i / QUALITY.mistCount) * Math.PI * 2 + Math.random() * 0.3,
      radius: m.ringMin + Math.random() * (m.ringMax - m.ringMin),
      height: m.heightMin + Math.random() * (m.heightMax - m.heightMin),
      speed: m.drift * (0.5 + Math.random()),
      spin: (Math.random() - 0.5) * 0.02,
      phase: Math.random() * 10,
    });
    group.add(sp);
  }
  scene.add(group);

  function update(t, camera) {
    for (const p of puffs) {
      const a = p.angle + t * p.speed;
      p.sprite.position.set(center.x + Math.cos(a) * p.radius, p.height + Math.sin(t * 0.2 + p.phase) * 2.5, center.z + Math.sin(a) * p.radius * 0.8);
      p.sprite.material.rotation += p.spin * 0.016;
      if (camera) {
        const d = p.sprite.position.distanceTo(camera.position);
        p.sprite.material.opacity = p.base * THREE.MathUtils.smoothstep(d, m.fadeNear, m.fadeFar);
      }
    }
  }
  update(0, null);
  return { group, update };
}

/**
 * Layered mountain silhouettes beyond the terrain — each ridge further, taller and closer to the
 * horizon colour, giving the Western-Ghats depth behind the forest. Unlit and fog-free: the haze is
 * painted into each layer's colour, so they cost almost nothing.
 */
export function createRidges(scene) {
  if (!CONFIG.atmosphere.ridges) return null;
  const center = new THREE.Vector3().fromArray(CONFIG.siteCenter);
  const base = new THREE.Color(CONFIG.haze.ridge), horizon = new THREE.Color(CONFIG.sky.horizon);
  const group = new THREE.Group();
  group.name = 'Ridges';
  const layers = [
    { r: 1080, min: 70, max: 185, haze: 0.42, seed: 11, scale: 7 },
    { r: 1480, min: 130, max: 300, haze: 0.64, seed: 23, scale: 5 },
    { r: 1980, min: 210, max: 430, haze: 0.82, seed: 37, scale: 3.5 },
  ];
  const SEG = 220;
  for (const L of layers) {
    const n = makeNoise(L.seed), pos = [], idx = [];
    for (let i = 0; i <= SEG; i++) {
      const u = i / SEG, a = u * Math.PI * 2;
      // sample noise on a circle so the profile wraps seamlessly
      const nx = Math.cos(a) * L.scale + 20, ny = Math.sin(a) * L.scale + 20;
      const hgt = L.min + (L.max - L.min) * Math.pow(fbm(n, nx, ny, 5), 1.25) * 1.35;
      const x = center.x + Math.cos(a) * L.r, z = center.z + Math.sin(a) * L.r;
      pos.push(x, -80, z, x, hgt, z);
      if (i < SEG) { const k = i * 2; idx.push(k, k + 1, k + 2, k + 1, k + 3, k + 2); }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setIndex(idx);
    const mesh = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: base.clone().lerp(horizon, L.haze), fog: false, side: THREE.DoubleSide }));
    mesh.name = `Ridge_${L.r}`;
    mesh.frustumCulled = false;
    mesh.matrixAutoUpdate = false;
    group.add(mesh);
  }
  scene.add(group);
  return group;
}
