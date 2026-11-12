import * as THREE from 'three';
import { CONFIG } from './config.js';

/**
 * Renders still images of the 3D scene from the camera presets (desktop framing), used as the
 * thumbnail backgrounds and as extra "Site Images". Runs once while the loader is visible.
 * Returns { [presetName]: { thumb: objectURL, large: objectURL } }.
 */
export async function capturePresets(renderer, scene, camera, names, { thumb = [336, 216], large = [1600, 1000] } = {}) {
  const canvas = renderer.domElement;
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
    renderer.render(scene, camera); // drawImage must run in the same task, before the buffer is cleared
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
