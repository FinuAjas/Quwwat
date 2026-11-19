/**
 * Header navigation: mobile menu button + the "Projects" dropdown.
 * Shared by the 3D home page (page.js) and the content pages (src/pages/site.js).
 */
export function bindNav(root = document, { idlePrefetch = false } = {}) {
  const nav = root.querySelector('.nav'), toggle = root.querySelector('.nav__toggle');
  const drop = root.querySelector('.nav__dropdown'), dropBtn = root.querySelector('.nav__trigger');
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
  nav.querySelectorAll('.nav__links a').forEach((a) => a.addEventListener('click', () => setMenu(false)));

  // ---------- instant page changes: fetch a page's HTML before it is clicked ----------
  // On hover / focus / touch for every page; on content pages (light) also once the browser is idle.
  // Skipped on data saver, so it never competes with the 3D model download on the home page.
  const saver = navigator.connection?.saveData === true;
  const done = new Set();
  const prefetch = (href) => {
    if (saver || done.has(href)) return;
    done.add(href);
    const l = document.createElement('link');
    l.rel = 'prefetch'; l.as = 'document'; l.href = href;
    document.head.appendChild(l);
  };
  const pages = [...nav.querySelectorAll('.nav__links a[href$=".html"], .nav__cta[href$=".html"]')]
    .filter((a) => !a.hasAttribute('aria-current') && a.getAttribute('href') !== location.pathname.split('/').pop());
  pages.forEach((a) => ['pointerenter', 'focus', 'touchstart'].forEach((ev) => a.addEventListener(ev, () => prefetch(a.href), { passive: true, once: true })));
  if (idlePrefetch) (window.requestIdleCallback ?? ((f) => setTimeout(f, 1500)))(() => pages.forEach((a) => prefetch(a.href)), { timeout: 4000 });
}
