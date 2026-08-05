/* ══════════════════════════════════════════
   LE PETIT PIERROT · interactions
   Caza Comm — 2026
   ══════════════════════════════════════════ */

/* ─── nav ───────────────────────────────── */
const nav = document.getElementById('nav');
const burger = document.getElementById('burger');
const drawer = document.getElementById('drawer');

addEventListener('scroll', () => nav.classList.toggle('stuck', scrollY > 30), { passive: true });

burger.addEventListener('click', () => {
  const open = drawer.classList.toggle('on');
  burger.classList.toggle('on', open);
  document.body.style.overflow = open ? 'hidden' : '';
});
drawer.querySelectorAll('a').forEach(a => a.addEventListener('click', () => {
  drawer.classList.remove('on'); burger.classList.remove('on'); document.body.style.overflow = '';
}));

/* ─── apparitions ───────────────────────── */
const io = new IntersectionObserver((es) => {
  es.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } });
}, { threshold: .12, rootMargin: '0px 0px -6% 0px' });
document.querySelectorAll('.up').forEach(el => io.observe(el));

/* ═══════════════════════════════════════════
   RELIEF & PIVOT
   Une seule transform composée par élément :
   pivot au scroll + relief au survol.
   ═══════════════════════════════════════════ */

function paint(el) {
  const t = el._t;
  el.style.transform =
    `perspective(1000px) rotate(${t.rz.toFixed(2)}deg) ` +
    `rotateX(${t.rx.toFixed(2)}deg) rotateY(${t.ry.toFixed(2)}deg) ` +
    `translateY(${t.ty.toFixed(1)}px) scale(${t.sc})`;
}
function init(el, spin) {
  el._t = { rz: 0, rx: 0, ry: 0, ty: 0, sc: 1, spin };
}

/* relief au survol */
document.querySelectorAll('[data-tilt]').forEach(el => {
  if (!el._t) init(el, 0);
  el.addEventListener('pointermove', e => {
    if (matchMedia('(pointer:coarse)').matches) return;
    const r = el.getBoundingClientRect();
    el._t.ry = ((e.clientX - r.left) / r.width - .5) * 11;
    el._t.rx = -((e.clientY - r.top) / r.height - .5) * 11;
    el._t.sc = 1.02;
    paint(el);
  });
  el.addEventListener('pointerleave', () => {
    el._t.rx = el._t.ry = 0; el._t.sc = 1; paint(el);
  });
});

/* pivot au scroll */
const spinners = [];
document.querySelectorAll('.lieu__deck figure').forEach((el, i) => {
  if (!el._t) init(el, 0); el._t.spin = [3.5, -2.5, 3][i] || 3; spinners.push(el);
});
const menuCard = document.getElementById('menuCard');
if (menuCard) { init(menuCard, -7); spinners.push(menuCard); }
document.querySelectorAll('.info__img').forEach(el => { if (!el._t) init(el, 0); el._t.spin = 4; spinners.push(el); });

let tick = false;
function onScroll() {
  spinners.forEach(el => {
    const r = el.getBoundingClientRect();
    if (r.bottom < -200 || r.top > innerHeight + 200) return;
    /* -1 (sous l'écran) → +1 (au-dessus) */
    const p = 1 - 2 * ((r.top + r.height / 2) / (innerHeight + r.height));
    el._t.rz = el._t.spin * p;
    el._t.ty = -14 * p;
    paint(el);
  });
  tick = false;
}
addEventListener('scroll', () => { if (!tick) { tick = true; requestAnimationFrame(onScroll); } }, { passive: true });
addEventListener('resize', onScroll);
onScroll();

/* ─── carrousel : les clips ne tournent que visibles ─── */
const vIo = new IntersectionObserver((es) => {
  es.forEach(e => {
    const v = e.target;
    if (e.isIntersecting) { v.play().catch(() => {}); } else { v.pause(); }
  });
}, { threshold: .05 });
document.querySelectorAll('.vcard video').forEach(v => vIo.observe(v));

/* ─── lightbox carte ────────────────────── */
const lb = document.getElementById('lb');
const openLb = () => { lb.classList.add('on'); lb.setAttribute('aria-hidden', 'false'); document.body.style.overflow = 'hidden'; };
const closeLb = () => { lb.classList.remove('on'); lb.setAttribute('aria-hidden', 'true'); document.body.style.overflow = ''; };
document.getElementById('menuCard').addEventListener('click', openLb);
document.getElementById('openMenu').addEventListener('click', openLb);
document.getElementById('lbClose').addEventListener('click', closeLb);
lb.addEventListener('click', e => { if (e.target === lb) closeLb(); });

/* ═══════════════════════════════════════════
   CALENDRIER & RÉSERVATION
   Lundi fermé · dimanche midi uniquement
   ═══════════════════════════════════════════ */

const MOIS = ['janvier','février','mars','avril','mai','juin','juillet','août','septembre','octobre','novembre','décembre'];
const JOURS = ['dimanche','lundi','mardi','mercredi','jeudi','vendredi','samedi'];
const CRENEAUX = {
  midi: ['11:45','12:00','12:15','12:30','12:45','13:00','13:15','13:30'],
  soir: ['19:00','19:30','19:45','20:00','20:15','20:30','21:00','21:30','22:00']
};

const today = new Date(); today.setHours(0, 0, 0, 0);
let view = new Date(today.getFullYear(), today.getMonth(), 1);
let sel = { date: null, service: 'midi', time: null, guests: 2 };

const grid = document.getElementById('calGrid');
const label = document.getElementById('calLabel');
const prevM = document.getElementById('prevM');
const nextM = document.getElementById('nextM');
const slotsBox = document.getElementById('slots');
const recapText = document.getElementById('recapText');
const submit = document.getElementById('submit');

const key = d => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
function seed(d, salt = 0) {
  let h = 2166136261 ^ salt;
  for (const c of key(d)) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); }
  return ((h >>> 0) % 1000) / 1000;
}
function servicesOf(d) {
  const g = d.getDay();
  if (g === 1) return [];
  if (g === 0) return ['midi'];
  return ['midi', 'soir'];
}
/* 0 complet/fermé · 1 dernières tables · 2 disponible */
function statusOf(d) {
  if (d < today || !servicesOf(d).length) return 0;
  const r = seed(d), we = [5, 6].includes(d.getDay());
  return we ? (r < .2 ? 0 : r < .58 ? 1 : 2) : (r < .06 ? 0 : r < .26 ? 1 : 2);
}

function buildCalendar() {
  const y = view.getFullYear(), m = view.getMonth();
  label.textContent = `${MOIS[m]} ${y}`;
  grid.innerHTML = '';
  const pad = (new Date(y, m, 1).getDay() + 6) % 7;
  const nb = new Date(y, m + 1, 0).getDate();

  for (let i = 0; i < pad; i++) grid.insertAdjacentHTML('beforeend', '<div class="day day--pad"></div>');

  for (let n = 1; n <= nb; n++) {
    const d = new Date(y, m, n), st = statusOf(d);
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'day' + (st === 0 ? ' day--off' : '') + (key(d) === key(today) ? ' today' : '')
      + (sel.date && key(d) === key(sel.date) ? ' sel' : '');
    b.innerHTML = `${n}<i class="dot ${st === 2 ? 'dot--ok' : st === 1 ? 'dot--few' : 'dot--no'}"></i>`;
    b.setAttribute('aria-label', `${n} ${MOIS[m]} — ${st === 0 ? 'complet ou fermé' : st === 1 ? 'dernières tables' : 'disponible'}`);
    if (st > 0) b.addEventListener('click', () => pickDate(d));
    grid.appendChild(b);
  }
  prevM.disabled = y === today.getFullYear() && m === today.getMonth();
}

function pickDate(d) {
  sel.date = d; sel.time = null;
  const dispo = servicesOf(d);
  if (!dispo.includes(sel.service)) sel.service = dispo[0];
  document.querySelectorAll('#segService button').forEach(b => {
    const ok = dispo.includes(b.dataset.service);
    b.disabled = !ok;
    b.style.opacity = ok ? '' : '.35';
    b.classList.toggle('on', ok && b.dataset.service === sel.service);
  });
  buildCalendar(); buildSlots(); refresh();
}

function buildSlots() {
  slotsBox.innerHTML = '';
  if (!sel.date) { slotsBox.innerHTML = '<p class="slots__empty">Choisissez d\'abord une date.</p>'; return; }
  const st = statusOf(sel.date);
  CRENEAUX[sel.service].forEach((h, i) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = h.replace(':', 'h');
    const gone = seed(sel.date, i + (sel.service === 'soir' ? 91 : 7)) < (st === 1 ? .42 : .13);
    b.className = 'slot' + (gone ? ' slot--gone' : '') + (sel.time === h ? ' on' : '');
    if (!gone) b.addEventListener('click', () => { sel.time = h; buildSlots(); refresh(); });
    slotsBox.appendChild(b);
  });
  if (![...slotsBox.children].some(c => !c.classList.contains('slot--gone')))
    slotsBox.innerHTML = '<p class="slots__empty">Plus rien sur ce service. Essayez un autre jour.</p>';
}

const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
const longDate = d => `${JOURS[d.getDay()]} ${d.getDate()} ${MOIS[d.getMonth()]}`;

function refresh() {
  const ok = sel.date && sel.time;
  submit.disabled = !ok;
  if (!sel.date) { recapText.textContent = 'Choisissez une date.'; return; }
  const pers = `${sel.guests >= 8 ? '8+' : sel.guests} personne${sel.guests > 1 ? 's' : ''}`;
  recapText.innerHTML = ok
    ? `<b>${cap(longDate(sel.date))}</b> ${sel.time.replace(':', 'h')} · ${pers}`
    : `<b>${cap(longDate(sel.date))}</b> il manque l'heure`;
}

prevM.addEventListener('click', () => { view.setMonth(view.getMonth() - 1); buildCalendar(); });
nextM.addEventListener('click', () => { view.setMonth(view.getMonth() + 1); buildCalendar(); });

document.querySelectorAll('#segService button').forEach(b => {
  b.addEventListener('click', () => {
    if (b.disabled) return;
    sel.service = b.dataset.service; sel.time = null;
    document.querySelectorAll('#segService button').forEach(x => x.classList.toggle('on', x === b));
    buildSlots(); refresh();
  });
});

const guestsEl = document.getElementById('guests');
const guestsLbl = document.getElementById('guestsLbl');
const bigGroup = document.getElementById('bigGroup');
function setGuests(n) {
  sel.guests = Math.min(8, Math.max(1, n));
  guestsEl.textContent = sel.guests >= 8 ? '8+' : sel.guests;
  guestsLbl.textContent = sel.guests > 1 ? 'personnes' : 'personne';
  bigGroup.classList.toggle('on', sel.guests >= 8);
  refresh();
}
document.getElementById('minus').addEventListener('click', () => setGuests(sel.guests - 1));
document.getElementById('plus').addEventListener('click', () => setGuests(sel.guests + 1));

/* ─── confirmation ──────────────────────── */
const modal = document.getElementById('modal');
const ticket = document.getElementById('ticket');
submit.addEventListener('click', () => {
  ticket.innerHTML = `<b>${cap(longDate(sel.date))}</b>
    ${sel.time.replace(':', 'h')} · ${sel.guests >= 8 ? '8+' : sel.guests} couvert${sel.guests > 1 ? 's' : ''}
    · table n° ${String(Math.floor(seed(sel.date, 42) * 26) + 1).padStart(2, '0')}`;
  modal.classList.add('on'); modal.setAttribute('aria-hidden', 'false');
  document.body.style.overflow = 'hidden';
});
function closeModal() {
  modal.classList.remove('on'); modal.setAttribute('aria-hidden', 'true'); document.body.style.overflow = '';
}
document.getElementById('closeModal').addEventListener('click', closeModal);
modal.addEventListener('click', e => { if (e.target === modal) closeModal(); });
addEventListener('keydown', e => {
  if (e.key !== 'Escape') return;
  if (modal.classList.contains('on')) closeModal();
  if (lb.classList.contains('on')) closeLb();
});

buildCalendar(); buildSlots(); refresh();
