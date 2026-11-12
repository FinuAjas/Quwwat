import * as THREE from 'three';
import { CONFIG, QUALITY } from './config.js';

/** Procedural puffy cloud texture (no image download). */
function cloudTexture(size = 256, seed = 1) {
  const cv = document.createElement('canvas');
  cv.width = cv.height = size;
  const g = cv.getContext('2d');
  let s = seed;
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 28; i++) {
    const a = rnd() * Math.PI * 2, d = Math.pow(rnd(), 0.7) * size * 0.26;
    const x = size / 2 + Math.cos(a) * d, y = size / 2 + Math.sin(a) * d * 0.6;
    const r = size * (0.1 + rnd() * 0.16);
    const grad = g.createRadialGradient(x, y, 0, x, y, r);
    grad.addColorStop(0, 'rgba(255,255,255,0.32)');
    grad.addColorStop(0.6, 'rgba(255,255,255,0.12)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, size, size);
  }
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** Drifting mist banks around the edge of the site, like the reference hero. */
export function createMist(scene) {
  const m = CONFIG.mist;
  const center = new THREE.Vector3().fromArray(CONFIG.siteCenter);
  const textures = [cloudTexture(256, 7), cloudTexture(256, 99), cloudTexture(256, 1234)];
  const group = new THREE.Group();
  group.name = 'Mist';
  const puffs = [];
  for (let i = 0; i < QUALITY.mistCount; i++) {
    const mat = new THREE.SpriteMaterial({
      map: textures[i % textures.length], transparent: true, depthWrite: false,
      opacity: m.opacity * (0.6 + Math.random() * 0.4), color: 0xf4f7f4,
    });
    const sp = new THREE.Sprite(mat);
    const size = m.sizeMin + Math.random() * (m.sizeMax - m.sizeMin);
    sp.scale.set(size, size * 0.55, 1);
    sp.renderOrder = 10;
    const p = {
      sprite: sp,
      angle: (i / QUALITY.mistCount) * Math.PI * 2 + Math.random() * 0.3,
      radius: m.ringMin + Math.random() * (m.ringMax - m.ringMin),
      height: m.heightMin + Math.random() * (m.heightMax - m.heightMin),
      speed: m.drift * (0.5 + Math.random()),
      phase: Math.random() * 10,
    };
    puffs.push(p);
    group.add(sp);
  }
  scene.add(group);

  function update(t) {
    for (const p of puffs) {
      const a = p.angle + t * p.speed;
      p.sprite.position.set(center.x + Math.cos(a) * p.radius, p.height + Math.sin(t * 0.2 + p.phase) * 2.5, center.z + Math.sin(a) * p.radius * 0.8);
    }
  }
  update(0);
  return { group, update };
}
