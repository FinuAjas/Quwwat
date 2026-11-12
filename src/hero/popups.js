import * as THREE from 'three';
import { CSS2DRenderer, CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import { HOTSPOT_CONTENT } from './content.js';

const FAR = { 1: 520, 2: 230 }; // label visible below this camera distance, by priority
const FADE = 60;                // metres over which labels fade out
const isNarrow = () => innerWidth <= 760;
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/**
 * HTML labels pinned to the GLB's `Hotspot_<id>` anchors (CSS2DRenderer), plus a detail card
 * that opens on `hotspot:select`. Desktop: the card floats at the 3D anchor. Mobile: bottom sheet.
 */
export function createPopups({ scene, camera, stage, hero, hotspots, onResize }) {
  const css = new CSS2DRenderer();
  css.domElement.className = 'labels';
  stage.appendChild(css.domElement);
  onResize((w, h) => css.setSize(w, h));

  // ---------- labels ----------
  const labels = hotspots.spots.map((spot) => {
    const c = HOTSPOT_CONTENT[spot.id] ?? { label: spot.title, priority: 2 };
    const el = document.createElement('button');
    el.type = 'button';
    el.className = 'pin';
    el.innerHTML = `<span class="pin__label">${esc(c.label)}</span><span class="pin__stem"></span><span class="pin__dot"></span>`;
    el.setAttribute('aria-label', `${c.label} — show details`);
    el.addEventListener('click', (e) => { e.stopPropagation(); hotspots.select(spot.id); });
    const obj = new CSS2DObject(el);
    obj.center.set(0.5, 1); // stem tip sits on the anchor
    obj.position.copy(spot.anchor);
    scene.add(obj);
    return { spot, el, obj, priority: c.priority ?? 2, order: Object.keys(HOTSPOT_CONTENT).indexOf(spot.id) };
  });
  labels.sort((a, b) => a.priority - b.priority || a.order - b.order); // importance order for overlap culling

  // ---------- card ----------
  const card = document.createElement('article');
  card.className = 'card';
  card.setAttribute('role', 'dialog');
  card.setAttribute('aria-modal', 'false');
  card.tabIndex = -1;
  const cardObj = new CSS2DObject(card);
  cardObj.center.set(-0.07, 0.5); // card sits to the right of the anchor, vertically centred
  // The card object is only in the scene while a desktop card is open; on mobile the same
  // element is a bottom sheet outside the CSS2D layer (CSS2DRenderer would otherwise restyle it).
  ['pointerdown', 'wheel'].forEach((t) => card.addEventListener(t, (e) => e.stopPropagation()));

  let openId = null, returnFocus = null;
  function open({ id, anchor }) {
    const c = HOTSPOT_CONTENT[id] ?? { label: id, text: '' };
    card.innerHTML = `
      ${c.image ? `<img class="card__img" src="${esc(c.image)}" alt="" loading="lazy" />` : ''}
      <div class="card__body">
        <p class="card__eyebrow">${esc(c.eyebrow ?? '')}</p>
        <h2 class="card__title" id="card-title">${esc(c.label)}</h2>
        <p class="card__text">${esc(c.text ?? '')}</p>
        ${c.tags?.length ? `<ul class="card__tags">${c.tags.map((t) => `<li>${esc(t)}</li>`).join('')}</ul>` : ''}
        <div class="card__actions">
          <a class="btn btn--sand btn--sm" href="#contact">Enquire <span aria-hidden="true">→</span></a>
        </div>
      </div>
      <button class="card__close" type="button" aria-label="Close">×</button>`;
    card.setAttribute('aria-labelledby', 'card-title');
    card.querySelector('.card__close').addEventListener('click', () => hotspots.clear());
    openId = id;
    returnFocus = document.activeElement?.classList?.contains('pin') ? document.activeElement : null;

    card.classList.remove('is-open');
    if (isNarrow()) {
      scene.remove(cardObj);
      card.classList.add('card--sheet');
      card.style.transform = ''; card.style.display = '';
      hero.appendChild(card);
    } else {
      card.classList.remove('card--sheet');
      cardObj.position.copy(anchor);
      scene.add(cardObj);
    }
    hero.classList.add('has-selection');
    requestAnimationFrame(() => card.classList.add('is-open'));
    labels.forEach((l) => l.el.classList.toggle('is-selected', l.spot.id === id));
    if (returnFocus) card.focus({ preventScroll: true });
  }
  function close() {
    openId = null;
    hero.classList.remove('has-selection');
    card.classList.remove('is-open');
    scene.remove(cardObj);
    card.remove();
    labels.forEach((l) => l.el.classList.remove('is-selected'));
    returnFocus?.focus({ preventScroll: true });
    returnFocus = null;
  }
  hero.addEventListener('hotspot:select', (e) => open(e.detail));
  hero.addEventListener('hotspot:clear', close);
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && openId) hotspots.clear(); });

  // ---------- label visibility toggle (map "layers" button) ----------
  let showLabels = true;
  try { showLabels = localStorage.getItem('mc-labels') !== 'off'; } catch { /* storage unavailable */ }
  const applyToggle = () => {
    css.domElement.classList.toggle('labels--off', !showLabels);
    hero.querySelector('[data-action="layers"]')?.setAttribute('aria-pressed', String(showLabels));
  };
  hero.addEventListener('labels:toggle', () => {
    showLabels = !showLabels;
    try { localStorage.setItem('mc-labels', showLabels ? 'on' : 'off'); } catch { /* ignore */ }
    applyToggle();
  });
  applyToggle();

  // ---------- per-frame ----------
  const tmp = new THREE.Vector3();
  const placed = [];
  function update() {
    const w = stage.clientWidth, h = stage.clientHeight;
    placed.length = 0;
    for (const l of labels) {
      const d = tmp.copy(l.obj.position).distanceTo(camera.position);
      const far = FAR[l.priority] ?? FAR[2];
      const o = THREE.MathUtils.clamp((far - d) / FADE, 0, 1);
      // screen-space box of the pill; hide if it collides with a more important visible label
      tmp.project(camera);
      const lw = (l.w ||= l.el.offsetWidth || 120), lh = (l.h ||= l.el.offsetHeight || 50);
      const x = (tmp.x + 1) / 2 * w - lw / 2, y = (1 - tmp.y) / 2 * h - lh;
      const overlaps = placed.some((r) => x < r.x + r.w + 6 && x + lw + 6 > r.x && y < r.y + 34 && y + 34 > r.y);
      const hidden = o <= 0.01 || l.spot.id === openId || overlaps || tmp.z > 1;
      if (!hidden) placed.push({ x, y, w: lw });
      l.el.style.opacity = hidden ? 0 : o.toFixed(2);
      l.el.classList.toggle('is-hidden', hidden);
      l.el.tabIndex = hidden ? -1 : 0;
    }
    css.render(scene, camera);
  }

  return { update, open, close };
}
