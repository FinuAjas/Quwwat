/** Wires the overlay controls (map buttons, compass, camera-preset thumbnails) to the camera rig. */
export function bindUI(rig, { hero }) {
  const $ = (s) => hero.querySelector(s);
  const $$ = (s) => [...hero.querySelectorAll(s)];

  // ----- map controls -----
  const actions = {
    fullscreen: () => (document.fullscreenElement ? document.exitFullscreen() : hero.requestFullscreen?.()),
    reset: () => { setActiveShot('aerial'); return rig.goTo('aerial'); },
    'zoom-in': () => rig.zoom(0.7),
    'zoom-out': () => rig.zoom(1.4),
    layers: () => hero.dispatchEvent(new CustomEvent('labels:toggle')), // handled by pop-ups (Phase 6)
  };
  $$('.map-controls [data-action]').forEach((btn) => btn.addEventListener('click', () => actions[btn.dataset.action]?.()));

  // ----- compass follows the camera heading; click to face north -----
  const compass = $('#compass');
  const needle = compass.querySelector('i');
  compass.setAttribute('role', 'button');
  compass.tabIndex = 0;
  compass.addEventListener('click', () => rig.faceNorth());
  compass.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); rig.faceNorth(); } });
  let lastDeg = NaN;
  rig.on('change', () => {
    const d = Math.round((rig.heading() * 180) / Math.PI * 10) / 10;
    if (d !== lastDeg) { needle.style.transform = `translate(-50%, -78%) rotate(${d}deg)`; lastDeg = d; }
  });

  // ----- preset thumbnails -----
  const shots = $$('.shot');
  function setActiveShot(name) { shots.forEach((s) => s.classList.toggle('is-active', s.dataset.preset === name)); }
  shots.forEach((s) => s.addEventListener('click', () => { setActiveShot(s.dataset.preset); rig.goTo(s.dataset.preset); }));
  $$('.shots__arrow').forEach((a) => a.addEventListener('click', () => {
    const i = shots.findIndex((s) => s.classList.contains('is-active'));
    const next = shots[(i + Number(a.dataset.dir) + shots.length) % shots.length];
    next.click();
  }));
  // free navigation clears the "current preset" highlight
  rig.on('userstart', () => setActiveShot(null));
  hero.addEventListener('hotspot:select', () => setActiveShot(null));
}
