import * as THREE from 'three';
import { createScene } from './scene.js';
import { setupLighting } from './lighting.js';
import { createMist } from './atmosphere.js';
import { loadSite } from './loader.js';
import { createPerformance } from './performance.js';
import { createHeightSampler } from './terrainHeight.js';
import { createCameraRig } from './controls.js';
import { bindUI } from './ui.js';
import { createHotspots } from './hotspots.js';
import { createPopups } from './popups.js';
import { bindPage, applyThumbnails } from './page.js';
import { capturePresets } from './capture.js';

const hero = document.getElementById('hero');
const stage = document.getElementById('stage');
const loaderEl = document.getElementById('loader');
const fill = document.getElementById('loader-fill');
const text = document.getElementById('loader-text');
const setProgress = (p) => { fill.style.width = `${Math.round(p * 100)}%`; };

const { renderer, scene, camera, onResize } = createScene(stage);
const lights = setupLighting(scene, renderer);
const mist = createMist(scene);
const perf = createPerformance(renderer, stage);

// The scene is static and the sun never moves: render the shadow map once, on demand.
renderer.shadowMap.autoUpdate = false;

let site = null, rig = null, hotspots = null, popups = null;

// Page UI (menu, view tabs, gallery) works even while/if the model is loading.
const page = bindPage(hero, {
  onViewChange: (view) => {
    perf.setPaused(view !== '3d'); // no GPU work while a 2D panel covers the scene
    if (view !== '3d') hotspots?.clear();
  },
});
const clock = new THREE.Clock();
function frame() {
  if (!perf.tick()) return;
  const t = clock.getElapsedTime();
  mist.update(t);
  site.update(t);
  rig.update();
  hotspots.update(t);
  renderer.render(scene, camera);
  popups.update();
}

try {
  site = await loadSite(renderer, (p) => setProgress(p * 0.8));
  scene.add(site.root);
  const heightAt = createHeightSampler(site.terrain);
  rig = createCameraRig(camera, renderer.domElement, heightAt);
  bindUI(rig, { hero });
  hotspots = createHotspots({ camera, dom: renderer.domElement, hero, site, rig, heightAt });
  popups = createPopups({ scene, camera, stage, hero, hotspots, onResize });

  text.textContent = 'Preparing scene…';
  setProgress(0.85);
  // Compile every shader (incl. shadow depth variants) while the loader is still visible,
  // so the first interactive frame doesn't hitch.
  await renderer.compileAsync(scene, camera);
  renderer.shadowMap.needsUpdate = true;
  // Render stills from the camera presets for the thumbnails and the Site Images gallery.
  const captures = await capturePresets(renderer, scene, camera, ['aerial', 'main-building', 'recreation'], { large: [1280, 800] });
  applyThumbnails(hero, captures);
  page.addImages([
    { src: captures.aerial.large, caption: '3D aerial view' },
    { src: captures['main-building'].large, caption: 'Convention centre — 3D view' },
    { src: captures.recreation.large, caption: 'Pool & play area — 3D view' },
  ]);
  setProgress(1);
  loaderEl.classList.add('is-done');
  rig.intro();
  renderer.setAnimationLoop(frame);
  window.__hero = { renderer, scene, camera, rig, lights, site, perf, heightAt, hotspots, popups, page };
} catch (err) {
  console.error(err);
  text.textContent = 'The 3D model could not be loaded.';
}
