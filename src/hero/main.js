import { bindPage } from './page.js';
import { hasWebGL2, pickTier } from './tier.js';

/**
 * Bootstrap (small, no three.js). The poster image in the loader is on screen from the first paint;
 * this script then decides whether the interactive scene should replace it:
 *  - no WebGL 2                → poster stays, with a short note
 *  - data saver / reduced data → poster stays until the visitor asks for the 3D model
 *  - otherwise                 → pick a quality tier, download the 3D code and model, fade the poster out
 * Menu, view tabs and gallery work in every case.
 */
const hero = document.getElementById('hero');
const loaderEl = document.getElementById('loader');
const fill = document.getElementById('loader-fill');
const text = document.getElementById('loader-text');
const params = new URLSearchParams(location.search);

let app = null;
const page = bindPage(hero, { onViewChange: (view) => app?.onViewChange(view) });

/** Keep the poster as the hero image. `action` adds a button (by default it starts the 3D scene). */
function showStatic(message, action, run = start) {
  hero.classList.remove('is-loading');
  hero.classList.add('is-static');
  text.textContent = message;
  loaderEl.querySelector('.loader__action')?.remove();
  if (action) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'btn btn--sand loader__action';
    btn.textContent = action;
    btn.addEventListener('click', () => { btn.remove(); run(); });
    text.after(btn);
  }
}

async function start() {
  hero.classList.remove('is-static');
  hero.classList.add('is-loading');
  text.textContent = 'Loading 3D model…';
  try {
    const tier = pickTier();
    if (params.has('debug')) console.info('Quality tier', tier);
    const { startHero } = await import('./app.js');
    app = await startHero({
      hero, page,
      onProgress: (p) => { fill.style.width = `${Math.round(p * 100)}%`; },
      onStatus: (msg) => { text.textContent = msg; },
    });
    hero.classList.remove('is-loading');
    loaderEl.classList.add('is-done');
  } catch (err) {
    console.error(err);
    showStatic('The 3D model could not be loaded.', 'Try again', () => location.reload());
  }
}

// ?3d=off previews the poster-only page (as data-saver visitors see it); ?3d forces the scene on.
const saveData = navigator.connection?.saveData === true || matchMedia('(prefers-reduced-data: reduce)').matches;
const want3d = params.get('3d');
if (!hasWebGL2()) showStatic('Interactive 3D is not available in this browser.');
else if (want3d === 'off' || (saveData && want3d === null)) showStatic(saveData ? 'Data saver is on — showing a still image.' : 'Showing a still image.', 'Load 3D model');
else start();
