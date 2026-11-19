import { bindNav } from '../hero/nav.js';

/** Behaviour shared by the content pages: header menu, solid header on scroll, reveal-on-scroll, contact form. */
bindNav(document);

// ---------- header turns solid once the page scrolls ----------
const nav = document.querySelector('.nav');
const onScroll = () => nav.classList.toggle('is-scrolled', scrollY > 24);
addEventListener('scroll', onScroll, { passive: true });
onScroll();

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
