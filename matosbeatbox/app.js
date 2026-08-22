/* ════════ DATA ════════ */
const CLIPS = [
  {f:'video1', cat:'bbq',   tag:'BBQ',    t:'Plateau texan',      s:'4,2 M de vues'},
  {f:'vc4',    cat:'spicy', tag:'Spicy',  t:'Hot tenders XXL',    s:'6,8 M de vues'},
  {f:'cd1',    cat:'sweet', tag:'Sucré',  t:'Le plateau sucré',   s:'3,1 M de vues'},
  {f:'video2', cat:'bbq',   tag:'BBQ',    t:'Ribs & burnt ends',  s:'2,9 M de vues'},
  {f:'vc2',    cat:'spicy', tag:'Spicy',  t:'Le défi sauce',      s:'5,4 M de vues'},
  {f:'cd3',    cat:'sweet', tag:'Sucré',  t:'Vitrine pâtisserie', s:'2,2 M de vues'},
  {f:'video3', cat:'bbq',   tag:'BBQ',    t:'Première bouchée',   s:'1,8 M de vues'},
  {f:'vc5',    cat:'spicy', tag:'Spicy',  t:'Wings marathon',     s:'7,1 M de vues'},
  {f:'cd5',    cat:'sweet', tag:'Sucré',  t:'Dessert signature',  s:'2,6 M de vues'},
  {f:'vc1',    cat:'spicy', tag:'Spicy',  t:'Sauce brûlante',     s:'3,9 M de vues'},
  {f:'cd6',    cat:'sweet', tag:'Sucré',  t:'Le carrousel sucré', s:'1,9 M de vues'},
  {f:'cd4',    cat:'sweet', tag:'Sucré',  t:'Mille-feuille',      s:'2,4 M de vues'},
  {f:'vc3',    cat:'spicy', tag:'Spicy',  t:'Menu complet',       s:'4,6 M de vues'},
  {f:'cd2',    cat:'sweet', tag:'Sucré',  t:'Chantilly maison',   s:'1,5 M de vues'}
];

const rail = document.getElementById('rail');

function buildRail(filter){
  live = null;
  rail.innerHTML = '';
  CLIPS.filter(c => filter === 'all' || c.cat === filter).forEach((c, i) => {
    const el = document.createElement('article');
    el.className = 'vcard';
    el.dataset.src = `assets/video/${c.f}.mp4`;
    el.innerHTML = `
      <img class="pv" src="assets/img/${c.f}.jpg" alt="${c.t}" loading="${i < 3 ? 'eager' : 'lazy'}">
      <video muted playsinline loop preload="none" poster="assets/img/${c.f}.jpg"></video>
      <div class="vcard__ov">
        <span class="vcard__tag">${c.tag}</span>
        <span class="vcard__play"></span>
        <h3 class="vcard__t">${c.t}</h3>
        <p class="vcard__s">${c.s}</p>
      </div>`;
    el.addEventListener('click', () => openLb(el.dataset.src));
    rail.appendChild(el);
  });
  observeCards();
  queueCoverflow();
}

/* ════════ LECTURE : 1 SEULE VIDÉO À LA FOIS ════════ */
const REDUCE = matchMedia('(prefers-reduced-motion: reduce)').matches;
const isDesktop = () => innerWidth >= 700;
let live = null;

function setLive(card){
  if (card === live) return;
  if (live){
    live.classList.remove('is-live');
    const pv = live.querySelector('video');
    pv.pause();
  }
  live = card;
  if (!card) return;
  card.classList.add('is-live');
  const v = card.querySelector('video');
  if (!v.src) v.src = card.dataset.src;
  v.play().catch(() => {});
}

/* mobile : la carte la plus centrée joue */
function updateLive(){
  if (REDUCE || isDesktop()) return;
  const r = rail.getBoundingClientRect(), mid = r.left + r.width / 2;
  let best = null, bestD = Infinity;
  rail.querySelectorAll('.vcard').forEach(c => {
    const b = c.getBoundingClientRect();
    const d = Math.abs(b.left + b.width / 2 - mid);
    if (d < bestD && b.right > r.left && b.left < r.right){ bestD = d; best = c; }
  });
  setLive(best);
}

/* le rail n'est actif que s'il est à l'écran */
const railVisible = new IntersectionObserver(es => {
  es.forEach(e => e.isIntersecting ? updateLive() : setLive(null));
}, {threshold: 0.25});
railVisible.observe(rail);

/* desktop : survol */
function observeCards(){
  rail.querySelectorAll('.vcard').forEach(c => {
    c.addEventListener('mouseenter', () => { if (isDesktop()) setLive(c); });
    c.addEventListener('mouseleave', () => { if (isDesktop()) setLive(null); });
  });
  updateLive();
}

/* ════════ COVERFLOW 3D ════════ */
let rafId = null;
function coverflow(){
  rafId = null;
  if (REDUCE) return;
  if (isDesktop()){
    rail.querySelectorAll('.vcard').forEach(c => {
      c.style.transform = ''; c.style.opacity = ''; c.style.zIndex = '';
    });
    return;
  }
  const r = rail.getBoundingClientRect(), mid = r.left + r.width / 2;
  rail.querySelectorAll('.vcard').forEach(c => {
    const b = c.getBoundingClientRect();
    // -1 (gauche) … 0 (centre) … 1 (droite)
    const d = Math.max(-1.6, Math.min(1.6, (b.left + b.width / 2 - mid) / (r.width * 0.5)));
    const a = Math.abs(d);
    c.style.transform =
      `rotateY(${-d * 17}deg) translateZ(${-a * 62}px) scale(${1 - a * 0.055})`;
    c.style.opacity = 1 - a * 0.34;
    c.style.zIndex = String(100 - Math.round(a * 50));
  });
}
const queueCoverflow = () => { if (rafId === null) rafId = requestAnimationFrame(coverflow); };
rail.addEventListener('scroll', () => { queueCoverflow(); updateLive(); }, {passive: true});
addEventListener('resize', queueCoverflow, {passive: true});

/* ════════ TABS ════════ */
document.querySelectorAll('.tab').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(b => b.classList.remove('is-on'));
    btn.classList.add('is-on');
    buildRail(btn.dataset.filter);
    rail.scrollTo({left: 0, behavior: 'smooth'});
  });
});

buildRail('all');

/* ════════ VIDÉOS D'AMBIANCE (formats + process) ════════ */
/* preload="none" : elles ne se chargent qu'une fois à l'écran, et se coupent en sortant */
const ambientObs = new IntersectionObserver(es => {
  es.forEach(e => {
    const v = e.target;
    if (e.isIntersecting){ v.play().catch(() => {}); }
    else { v.pause(); }
  });
}, {threshold: 0.2});
document.querySelectorAll('.fcard__v video, .steps__bg video')
  .forEach(v => ambientObs.observe(v));

/* ════════ LIGHTBOX ════════ */
const lb = document.getElementById('lb'), lbv = document.getElementById('lbv');
function openLb(src){
  lbv.src = src;
  lb.hidden = false;
  document.body.style.overflow = 'hidden';
  lbv.play().catch(() => {});
}
function closeLb(){
  lbv.pause(); lbv.removeAttribute('src'); lbv.load();
  lb.hidden = true;
  document.body.style.overflow = '';
}
document.getElementById('lbx').addEventListener('click', closeLb);
lb.addEventListener('click', e => { if (e.target === lb) closeLb(); });
addEventListener('keydown', e => { if (e.key === 'Escape' && !lb.hidden) closeLb(); });

/* ════════ REVEAL ════════ */
const revObs = new IntersectionObserver((entries, o) => {
  entries.forEach((e, i) => {
    if (!e.isIntersecting) return;
    setTimeout(() => e.target.classList.add('in'), Math.min(i * 70, 280));
    o.unobserve(e.target);
  });
}, {rootMargin: '0px 0px -8% 0px', threshold: 0.08});
document.querySelectorAll('.reveal').forEach(el => revObs.observe(el));
// filet de sécurité : rien ne doit rester invisible
setTimeout(() => document.querySelectorAll('.reveal').forEach(el => el.classList.add('in')), 4000);

/* ════════ COMPTEURS ════════ */
const numObs = new IntersectionObserver((entries, o) => {
  entries.forEach(e => {
    if (!e.isIntersecting) return;
    const el = e.target;
    const to = parseFloat(el.dataset.to);
    const dec = parseInt(el.dataset.dec || 0, 10);
    const suf = el.dataset.suffix || '';
    const dur = 1400;
    const t0 = performance.now();
    (function step(now){
      const p = Math.min((now - t0) / dur, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      el.textContent = (to * eased).toFixed(dec).replace('.', ',') + suf;
      if (p < 1) requestAnimationFrame(step);
    })(t0);
    o.unobserve(el);
  });
}, {threshold: 0.5});
document.querySelectorAll('.num').forEach(el => numObs.observe(el));

/* ════════ NAV + DOCK ════════ */
const nav = document.getElementById('nav'), dock = document.querySelector('.dock');
const contact = document.getElementById('contact');
const prog = document.getElementById('prog');
addEventListener('scroll', () => {
  const y = scrollY;
  const max = document.documentElement.scrollHeight - innerHeight;
  prog.style.width = (max > 0 ? (y / max) * 100 : 0) + '%';
  nav.classList.toggle('solid', y > 40);
  const nearContact = contact.getBoundingClientRect().top < innerHeight * 0.9;
  dock.classList.toggle('show', y > innerHeight * 0.85 && !nearContact);
}, {passive: true});

/* ════════ FORMULAIRE (mailto, pas de back) ════════ */
const form = document.getElementById('form');
form.addEventListener('submit', e => {
  e.preventDefault();
  const d = Object.fromEntries(new FormData(form));
  let bad = false;
  ['nom', 'email'].forEach(k => {
    const input = form.elements[k];
    const ok = k === 'email' ? /^\S+@\S+\.\S+$/.test(d[k] || '') : (d[k] || '').trim().length > 1;
    input.classList.toggle('err', !ok);
    if (!ok) bad = true;
  });
  if (bad) return;

  const body = [
    `Marque / nom : ${d.nom}`,
    `Email : ${d.email}`,
    `Collaboration : ${d.offre}`,
    ``,
    `Projet :`,
    d.msg || '—'
  ].join('\n');

  location.href = `mailto:contact@matosbeatbox.fr?subject=${
    encodeURIComponent('Collaboration — ' + d.nom)}&body=${encodeURIComponent(body)}`;
});

/* ════════ HERO : relance la vidéo si iOS la coupe ════════ */
const hv = document.querySelector('.hero__vid');
if (hv){
  const kick = () => hv.play().catch(() => {});
  ['touchstart', 'click', 'visibilitychange'].forEach(ev =>
    document.addEventListener(ev, kick, {once: ev !== 'visibilitychange', passive: true}));
  kick();
}
