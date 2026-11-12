import * as THREE from 'three';
import { CONFIG } from './config.js';
import { frameCamera } from './scene.js';

/**
 * Renders still images of the 3D scene from the camera presets (desktop framing), used as the
 * thumbnail backgrounds and as extra "Site Images". Runs once while the loader is visible.
 * Returns { [presetName]: { thumb: objectURL, large: objectURL } }.
 */
export async function capturePresets(renderer, scene, camera, names, { thumb = [336, 216], large = [1600, 1000], render = () => renderer.render(scene, camera) } = {}) {
  const canvas = renderer.domElement;
  if (!canvas.width || !canvas.height) return {}; // page loaded while hidden / zero-sized: skip, thumbnails are optional
  const saved = { pos: camera.position.clone(), quat: camera.quaternion.clone(), view: camera.view && { ...camera.view }, aspect: camera.aspect, fov: camera.fov };
  const target = new THREE.Vector3();
  const out = {};

  const crop = (w, h) => {
    // largest centred crop of the canvas with the requested aspect, drawn into a w×h canvas
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const sw = canvas.width, sh = canvas.height, a = w / h;
    let cw = sw, ch = sw / a; if (ch > sh) { ch = sh; cw = sh * a; }
    c.getContext('2d').drawImage(canvas, (sw - cw) / 2, (sh - ch) / 2, cw, ch, 0, 0, w, h);
    return new Promise((res) => c.toBlob((b) => res(URL.createObjectURL(b)), 'image/webp', 0.86));
  };

  camera.clearViewOffset();
  camera.fov = CONFIG.camera.fov;
  camera.updateProjectionMatrix();
  for (const name of names) {
    const p = CONFIG.presets[name];
    if (!p) continue;
    camera.position.fromArray(p.position);
    camera.lookAt(target.fromArray(p.target));
    camera.updateMatrixWorld();
    render(); // drawImage must run in the same task, before the buffer is cleared
    const [tw, th] = thumb, [lw, lh] = large;
    const thumbP = crop(tw, th), largeP = crop(lw, lh);
    out[name] = { thumb: await thumbP, large: await largeP };
  }

  camera.position.copy(saved.pos); camera.quaternion.copy(saved.quat);
  camera.aspect = saved.aspect; camera.fov = saved.fov;
  if (saved.view?.enabled) camera.setViewOffset(saved.view.fullWidth, saved.view.fullHeight, saved.view.offsetX, saved.view.offsetY, saved.view.width, saved.view.height);
  camera.updateProjectionMatrix();
  return out;
}

// Poster stills shown before the 3D loads (and instead of it without WebGL / with data saver on).
// Desktop frame = the aerial preset as the page opens; mobile = the portrait aerial preset.
const POSTERS = [
  { file: 'hero-poster.webp', size: [1920, 1200], preset: (p) => p },
  { file: 'hero-poster-mobile.webp', size: [900, 1600], preset: (p) => p.mobile ?? p },
];

/**
 * Developer tool (page opened with ?poster): renders each poster at its fixed size through the full
 * post-processing chain and posts it to serve.py, which writes it into public/assets/images/.
 * Run it before the animation loop starts. Returns [{ file, kb, ok }].
 */
export async function savePosters(renderer, camera, post, quality = 0.8) {
  const canvas = renderer.domElement;
  const saved = { size: renderer.getSize(new THREE.Vector2()), ratio: renderer.getPixelRatio(), pos: camera.position.clone(), quat: camera.quaternion.clone() };
  const setFrame = (w, h) => { renderer.setSize(w, h, false); post.setSize(w, h); frameCamera(camera, w, h); };
  const target = new THREE.Vector3(), out = [];
  renderer.setPixelRatio(1);
  try {
    for (const { file, size: [w, h], preset } of POSTERS) {
      const p = preset(CONFIG.presets.aerial);
      setFrame(w, h);
      camera.position.fromArray(p.position);
      camera.lookAt(target.fromArray(p.target));
      camera.updateMatrixWorld();
      post.update(0, target, camera.position.distanceTo(target));
      post.render(); // the copy below must run in the same task, before the drawing buffer is cleared
      const copy = document.createElement('canvas'); copy.width = w; copy.height = h;
      copy.getContext('2d').drawImage(canvas, 0, 0);
      const blob = await new Promise((res) => copy.toBlob(res, 'image/webp', quality));
      const res = await fetch(`/api/save-image?name=${file}`, { method: 'POST', body: blob, headers: { 'Content-Type': 'image/webp' } });
      out.push({ file, kb: Math.round(blob.size / 1024), ok: res.ok });
    }
  } finally {
    renderer.setPixelRatio(saved.ratio);
    setFrame(saved.size.x, saved.size.y);
    camera.position.copy(saved.pos); camera.quaternion.copy(saved.quat);
    camera.updateMatrixWorld();
  }
  return out;
}
