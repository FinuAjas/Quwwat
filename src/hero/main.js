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
import { createFoliage } from './foliage.js';
import { createPost } from './post.js';

const hero = document.getElementById('hero');
const stage = document.getElementById('stage');
const loaderEl = document.getElementById('loader');
const fill = document.getElementById('loader-fill');
const text = document.getElementById('loader-text');
const setProgress = (p) => { fill.style.width = `${Math.round(p * 100)}%`; };

const { renderer, scene, camera, onResize } = createScene(stage);
const lights = setupLighting(scene, renderer);
const mist = createMist(scene);
const foliage = createFoliage(lights.sun);
const post = createPost(renderer, scene, camera);
onResize((w, h) => post.setSize(w, h));
const perf = createPerformance(renderer, stage, { onPixelRatio: () => post.setSize(stage.clientWidth, stage.clientHeight) });

// The scene is static and the sun never moves: render the shadow map once, on demand.
renderer.shadowMap.autoUpdate = false;
renderer.info.autoReset = false;

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
  renderer.info.reset(); // count draw calls across all post-processing passes of this frame
  const t = clock.getElapsedTime();
  mist.update(t);
  site.update(t);
  foliage.update(t, camera);
  rig.update();
  hotspots.update(t);
  post.update(t, rig.controls.target, camera.position.distanceTo(rig.controls.target));
  post.render();
  popups.update();
}

try {
  site = await loadSite(renderer, (p) => setProgress(p * 0.8));
  foliage.apply(site.root);
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
  // Spend the whole shadow map on the plot (buildings + roads), not the surrounding forest.
  lights.fitShadows([site.root.getObjectByName('Structures'), site.root.getObjectByName('Roads'), ...site.clickable]);
  renderer.shadowMap.needsUpdate = true;
  // Render stills from the camera presets for the thumbnails and the Site Images gallery (optional: never block the scene).
  try {
    const captures = await capturePresets(renderer, scene, camera, ['aerial', 'main-building', 'recreation'], { large: [1280, 800], render: post.render });
    applyThumbnails(hero, captures);
    const shots = [['aerial', '3D aerial view'], ['main-building', 'Convention centre — 3D view'], ['recreation', 'Pool & play area — 3D view']];
    page.addImages(shots.filter(([k]) => captures[k]).map(([k, caption]) => ({ src: captures[k].large, caption })));
  } catch (err) {
    console.warn('Preset thumbnails could not be rendered', err);
  }
  setProgress(1);
  loaderEl.classList.add('is-done');
  rig.intro();
  renderer.setAnimationLoop(frame);

  // Remaining model parts (vegetation, details) stream in after the first interactive frame.
  if (site.hasExtras) {
    site.loadExtras(async (part) => {
      foliage.apply(part);
      await renderer.compileAsync(part, camera, scene); // compile off-screen first, so adding it doesn't hitch
      scene.add(part);
      renderer.shadowMap.needsUpdate = true;
    });
  }
  window.__hero = { renderer, scene, camera, rig, lights, site, perf, heightAt, hotspots, popups, page, post };
} catch (err) {
  console.error(err);
  text.textContent = 'The 3D model could not be loaded.';
}
