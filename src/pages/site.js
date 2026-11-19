import { bindNav } from '../hero/nav.js';

/** Behaviour shared by the content pages: header menu, solid header on scroll, reveal-on-scroll, contact form. */
bindNav(document, { idlePrefetch: true });

const calm = matchMedia('(prefers-reduced-motion: reduce)').matches;

// ---------- header turns solid once the page scrolls; reading-progress line; banner parallax; back-to-top ----------
const nav = document.querySelector('.nav');
const bar = Object.assign(document.createElement('div'), { className: 'progress', ariaHidden: 'true' });
const top = Object.assign(document.createElement('button'), { className: 'to-top', type: 'button', ariaLabel: 'Back to top', innerHTML: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 14 6-6 6 6"/></svg>' });
top.addEventListener('click', () => scrollTo({ top: 0, behavior: calm ? 'auto' : 'smooth' }));
document.body.append(bar, top);
const bannerImg = document.querySelector('.banner__img');
let ticking = false;
function frame() {
  ticking = false;
  const y = scrollY, max = document.documentElement.scrollHeight - innerHeight;
  nav.classList.toggle('is-scrolled', y > 24);
  bar.style.transform = `scaleX(${max > 0 ? Math.min(1, y / max) : 0})`;
  top.classList.toggle('is-shown', y > 700);
  if (bannerImg && !calm && y < innerHeight) bannerImg.style.transform = `translate3d(0, ${(y * 0.22).toFixed(1)}px, 0) scale(1.08)`;
}
addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(frame); } }, { passive: true });
frame();

// ---------- tiles: a soft light follows the pointer ----------
if (!calm && matchMedia('(hover: hover)').matches) {
  document.querySelectorAll('.tile, .info__item, .steps li').forEach((el) => el.addEventListener('pointermove', (e) => {
    const r = el.getBoundingClientRect();
    el.style.setProperty('--mx', `${e.clientX - r.left}px`);
    el.style.setProperty('--my', `${e.clientY - r.top}px`);
  }, { passive: true }));
}

// ---------- numbers count up when they come into view ----------
document.querySelectorAll('.stats b').forEach((el) => {
  const n = parseInt(el.textContent, 10);
  if (!Number.isFinite(n) || calm || !('IntersectionObserver' in window) || String(n) !== el.textContent.trim()) return;
  new IntersectionObserver(([e], io) => {
    if (!e.isIntersecting) return;
    io.disconnect();
    const t0 = performance.now();
    const step = (t) => {
      const k = Math.min(1, (t - t0) / 1100);
      el.textContent = Math.round(n * (1 - Math.pow(1 - k, 3)));
      if (k < 1) requestAnimationFrame(step);
    };
    el.textContent = '0';
    requestAnimationFrame(step);
  }, { threshold: 0.6 }).observe(el);
});

// ---------- reveal on scroll ----------
const items = [...document.querySelectorAll('.reveal')];
if ('IntersectionObserver' in window && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
  const io = new IntersectionObserver((entries) => entries.forEach((e) => {
    if (e.isIntersecting) { e.target.classList.add('is-in'); io.unobserve(e.target); }
  }), { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
  items.forEach((el, i) => { el.style.setProperty('--d', `${(i % 4) * 0.07}s`); io.observe(el); });
} else {
  items.forEach((el) => el.classList.add('is-in'));
}

// ---------- contact form ----------
// There is no server behind this site yet: the form opens the visitor's mail app with the enquiry filled in.
// PLACEHOLDER address (".example" never delivers) — replace with the real enquiries inbox before launch.
const ENQUIRY_EMAIL = 'enquiries@quwwatgroup.example';

const form = document.getElementById('enquiry');
if (form) {
  const status = document.getElementById('form-status');
  const rules = {
    name: (v) => (v.trim().length >= 2 ? '' : 'Please enter your name.'),
    email: (v) => (/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim()) ? '' : 'Please enter a valid email address.'),
    phone: (v) => (!v.trim() || /^[+()\d\s-]{7,20}$/.test(v.trim()) ? '' : 'Use digits, spaces, + or - only.'),
    interest: (v) => (v ? '' : 'Please choose a topic.'),
    message: (v) => (v.trim().length >= 10 ? '' : 'Tell us a little more (at least 10 characters).'),
  };
  const check = (el) => {
    const msg = rules[el.name]?.(el.value) ?? '';
    const field = el.closest('.field');
    field.classList.toggle('is-invalid', !!msg);
    field.querySelector('.field__error').textContent = msg;
    el.setAttribute('aria-invalid', String(!!msg));
    return !msg;
  };
  const inputs = [...form.querySelectorAll('input, select, textarea')];
  inputs.forEach((el) => {
    el.addEventListener('blur', () => check(el));
    el.addEventListener('input', () => { if (el.closest('.field').classList.contains('is-invalid')) check(el); });
  });
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const bad = inputs.filter((el) => !check(el));
    if (bad.length) { bad[0].focus(); status.hidden = true; return; }
    const d = Object.fromEntries(new FormData(form));
    const body = `Name: ${d.name}\nEmail: ${d.email}\nPhone: ${d.phone || '—'}\n\n${d.message}`;
    location.href = `mailto:${ENQUIRY_EMAIL}?subject=${encodeURIComponent(`${d.interest} — website enquiry`)}&body=${encodeURIComponent(body)}`;
    status.textContent = 'Opening your email app with your enquiry. If nothing opens, email us directly using the address on this page.';
    status.hidden = false;
  });
}
