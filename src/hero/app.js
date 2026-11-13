import * as THREE from 'three';
import { createScene } from './scene.js';
import { setupLighting } from './lighting.js';
import { createMist, createRidges } from './atmosphere.js';
import { loadSite } from './loader.js';
import { createPerformance } from './performance.js';
import { createHeightSampler } from './terrainHeight.js';
import { createCameraRig } from './controls.js';
import { bindUI } from './ui.js';
import { createHotspots } from './hotspots.js';
import { createPopups } from './popups.js';
import { applyThumbnails } from './page.js';
import { capturePresets, savePosters } from './capture.js';
import { createFoliage } from './foliage.js';
import { createPost } from './post.js';
import { createTraffic, createBirds } from './life.js';
import { createSurfaces } from './surfaces.js';
import { createGrass } from './grass.js';
import { createFountain } from './fountain.js';

/**
 * The interactive 3D hero. Loaded on demand by main.js (after the WebGL / data-saver checks and the
 * tier benchmark), so visitors who only get the poster never download three.js or the model.
 * Resolves once the scene is on screen; rejects if the model cannot be loaded.
 * Returns { onViewChange(view) } for the page's view tabs.
 */
export async function startHero({ hero, page, onProgress = () => {}, onStatus = () => {} }) {
  const stage = hero.querySelector('#stage');
  const { renderer, scene, camera, onResize } = createScene(stage);
  const lights = setupLighting(scene, renderer);
  const mist = createMist(scene);
  createRidges(scene);
  const foliage = createFoliage(lights.sun);
  const surfaces = createSurfaces();
  const post = createPost(renderer, scene, camera);
  onResize((w, h) => post.setSize(w, h));
  const perf = createPerformance(renderer, stage, { onPixelRatio: () => post.setSize(stage.clientWidth, stage.clientHeight) });
  const birds = createBirds(scene);

  // The scenery is static and the sun never moves: render the shadow map once, on demand.
  // (Moving cars carry their own blob shadows instead of casting into it.)
  renderer.shadowMap.autoUpdate = false;
  renderer.info.autoReset = false;

  const site = await loadSite(renderer, (p) => onProgress(p * 0.8));
  foliage.apply(site.root);
  surfaces.apply(site.root);
  scene.add(site.root);
  const heightAt = createHeightSampler(site.terrain);
  const traffic = createTraffic(scene, site, heightAt, lights.sun);
  const grass = createGrass(scene, site, heightAt);
  const fountain = createFountain(scene, site);
  const rig = createCameraRig(camera, renderer.domElement, heightAt);
  bindUI(rig, { hero });
  const hotspots = createHotspots({ camera, dom: renderer.domElement, hero, site, rig, heightAt });
  const popups = createPopups({ scene, camera, stage, hero, hotspots, onResize });

  onStatus('Preparing scene…');
  onProgress(0.85);
  // Compile every shader (incl. shadow depth variants) while the loader is still visible,
  // so the first interactive frame doesn't hitch.
  await renderer.compileAsync(scene, camera);
  // Spend the whole shadow map on the plot (buildings + roads), not the surrounding forest.
  lights.fitShadows([site.root.getObjectByName('Structures'), site.root.getObjectByName('Roads'), ...site.clickable]);
  renderer.shadowMap.needsUpdate = true;

  // The rest of the model (forest, then furniture and rocks) has been downloading alongside the core. Each file is
  // added when it is ready; if the scene is already on screen by then, the forest rises from the ground.
  let revealed = false;
  const partsReady = site.loadExtras(async (part) => {
    const plants = foliage.apply(part);
    surfaces.apply(part);
    await renderer.compileAsync(part, camera, scene); // compile off-screen first, so adding it doesn't hitch
    if (revealed && plants.first) foliage.growIn();
    scene.add(part);
    renderer.shadowMap.needsUpdate = true;
  });

  // Developer step: open the page with ?poster to re-render the poster images shown before the 3D loads (needs serve.py).
  if (new URLSearchParams(location.search).has('poster')) {
    await partsReady; // the poster must show the whole model
    window.__posters = await savePosters(renderer, camera, post).catch((err) => ({ error: String(err) }));
    console.info('Poster images', window.__posters);
  }
  // Once the whole model is in: render stills from the camera presets for the thumbnails and the Site Images
  // gallery (optional: never block the scene). If the scene is live by then, re-draw the current view at once.
  partsReady.then(() => {
    const stills = capturePresets(renderer, scene, camera, ['aerial', 'main-building', 'recreation'], { large: [1280, 800], render: post.render });
    if (revealed) post.render();
    return stills;
  }).then((captures) => {
    applyThumbnails(hero, captures);
    const shots = [['aerial', '3D aerial view'], ['main-building', 'Convention centre — 3D view'], ['recreation', 'Pool & play area — 3D view']];
    page.addImages(shots.filter(([k]) => captures[k]).map(([k, caption]) => ({ src: captures[k].large, caption })));
  }).catch((err) => console.warn('Preset thumbnails could not be rendered', err));

  const clock = new THREE.Clock();
  function frame() {
    if (!perf.tick()) return;
    renderer.info.reset(); // count draw calls across all post-processing passes of this frame
    const t = clock.getElapsedTime();
    mist.update(t, camera);
    lights.update(t);
    traffic.update(t);
    birds.update(t);
    grass.update(t, camera);
    fountain.update(t, camera, renderer.domElement.height);
    site.update(t);
    foliage.update(t, camera);
    rig.update();
    hotspots.update(t);
    post.update(t, rig.controls.target, camera.position.distanceTo(rig.controls.target));
    post.render();
    popups.update();
  }

  const onViewChange = (view) => {
    perf.setPaused(view !== '3d'); // no GPU work while a 2D panel covers the scene
    if (view !== '3d') hotspots.clear();
  };
  onViewChange(hero.classList.contains('view-2d') ? '2d' : '3d'); // a panel may already be open

  onProgress(1);
  rig.intro();
  renderer.setAnimationLoop(frame);
  revealed = true;
  window.__hero = { renderer, scene, camera, rig, lights, site, perf, heightAt, hotspots, popups, page, post, traffic, birds, grass, foliage, partsReady };
  return { onViewChange };
}
