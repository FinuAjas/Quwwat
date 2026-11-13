/**
 * Page-level hero UI that works before (and without) the 3D model:
 * mobile menu, 3D / Site Images view switcher, image gallery.
 */
export function bindPage(hero, { onViewChange = () => {} } = {}) {
  const $ = (s) => hero.querySelector(s);
  const $$ = (s) => [...hero.querySelectorAll(s)];

  // ---------- mobile menu ----------
  const nav = $('.nav'), toggle = $('.nav__toggle');
  const drop = $('.nav__dropdown'), dropBtn = $('.nav__trigger');
  const setDrop = (open) => {
    drop.classList.toggle('is-open', open);
    dropBtn.setAttribute('aria-expanded', String(open));
  };
  const setMenu = (open) => {
    nav.classList.toggle('is-open', open);
    toggle.setAttribute('aria-expanded', String(open));
    toggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    if (!open) setDrop(false);
  };
  toggle.addEventListener('click', () => setMenu(!nav.classList.contains('is-open')));
  dropBtn.addEventListener('click', () => setDrop(!drop.classList.contains('is-open')));
  document.addEventListener('click', (e) => {
    if (!nav.contains(e.target)) setMenu(false);
    else if (!drop.contains(e.target)) setDrop(false);
  });
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if (drop.classList.contains('is-open')) dropBtn.focus();
    setMenu(false);
  });
  $$('.nav__links a').forEach((a) => a.addEventListener('click', () => setMenu(false)));

  // ---------- gallery ----------
  const gallery = [{ src: './public/assets/images/site-render.webp', caption: 'Rendered site layout', alt: 'Rendered aerial layout of Mountain Courtyard' }];
  let gi = 0;
  const img = $('#gallery-img'), cap = $('#gallery-caption'), count = $('#gallery-count');
  function showImage(i) {
    gi = (i + gallery.length) % gallery.length;
    const g = gallery[gi];
    img.src = g.src; img.alt = g.alt ?? g.caption;
    cap.textContent = g.caption;
    count.textContent = `${gi + 1} / ${gallery.length}`;
    $$('.panel__arrow').forEach((b) => { b.hidden = gallery.length < 2; });
  }
  $$('.panel__arrow').forEach((b) => b.addEventListener('click', () => showImage(gi + Number(b.dataset.dir))));
  showImage(0);

  // ---------- view switcher (tabs) ----------
  const tabs = $$('.views__tab');
  const panels = { images: $('#panel-images') };
  function setView(view, focus = false) {
    tabs.forEach((t) => {
      const on = t.dataset.view === view;
      t.classList.toggle('is-active', on);
      t.setAttribute('aria-selected', String(on));
      t.tabIndex = on ? 0 : -1;
      if (on && focus) t.focus();
    });
    Object.entries(panels).forEach(([k, p]) => { p.hidden = k !== view; });
    hero.classList.toggle('view-2d', view !== '3d');
    onViewChange(view);
  }
  tabs.forEach((t, i) => {
    t.addEventListener('click', () => setView(t.dataset.view));
    t.addEventListener('keydown', (e) => {
      const d = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
      if (d) { e.preventDefault(); setView(tabs[(i + d + tabs.length) % tabs.length].dataset.view, true); }
    });
  });
  document.addEventListener('keydown', (e) => {
    if (!panels.images.hidden && (e.key === 'ArrowRight' || e.key === 'ArrowLeft') && !e.target.closest?.('.views')) showImage(gi + (e.key === 'ArrowRight' ? 1 : -1));
  });

  return {
    setView,
    /** Add captured 3D views to the gallery: [{ src, caption }] */
    addImages(items) { gallery.push(...items); showImage(gi); },
  };
}

/** Use captured renders as the preset thumbnail backgrounds. */
export function applyThumbnails(hero, captures) {
  hero.querySelectorAll('.shot').forEach((s) => {
    const c = captures[s.dataset.preset];
    if (c) s.style.backgroundImage = `url("${c.thumb}")`;
  });
}
