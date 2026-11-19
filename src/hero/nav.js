/**
 * Header navigation: mobile menu button + the "Projects" dropdown.
 * Shared by the 3D home page (page.js) and the content pages (src/pages/site.js).
 */
export function bindNav(root = document) {
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
}
