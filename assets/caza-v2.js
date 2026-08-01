/* ════════════════════════════════════════════════════════════════
   CAZA COMM — V2 : préchargeur, apparitions, bandeaux, compteur,
   decks glissables et curseur. Complète assets/caza.js (son, i18n,
   FAQ, formulaire), qui doit être chargé avant.
   ════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var FINE = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  var S = window.cazaSound || { tap: function () {}, hover: function () {}, swipe: function () {}, toggle: function () {} };

  /* ── 1. PRÉCHARGEUR : compteur % puis levée du rideau ── */
  function initPreloader() {
    var pre = document.getElementById('preloader');
    if (!pre) return;
    var countEl = pre.querySelector('.pre-count');
    var barEl = pre.querySelector('.pre-bar');

    function finish() {
      if (pre.classList.contains('is-done')) return;
      pre.classList.add('is-done');
      document.body.classList.add('is-loaded');
      // Les scènes visibles s'animent une fois le rideau levé
      document.dispatchEvent(new CustomEvent('cazaloaded'));
      setTimeout(function () { pre.setAttribute('hidden', ''); }, 900);
    }

    if (REDUCED) { finish(); return; }

    var pct = 0;
    var pageLoaded = false;
    window.addEventListener('load', function () { pageLoaded = true; });

    var timer = setInterval(function () {
      // Monte vite jusqu'à 90 %, puis attend le chargement réel
      var step = pct < 70 ? 4 + Math.random() * 7 : pct < 90 ? 1.5 + Math.random() * 3 : (pageLoaded ? 6 : 0.25);
      pct = Math.min(100, pct + step);
      if (countEl) countEl.textContent = String(Math.floor(pct)).padStart(3, '0') + ' %';
      if (barEl) barEl.style.width = pct + '%';
      if (pct >= 100) {
        clearInterval(timer);
        setTimeout(finish, 320);
      }
    }, 55);

    // Filet de sécurité : jamais bloqué plus de 6 s
    setTimeout(function () { clearInterval(timer); finish(); }, 6000);
  }

  /* ── 2. APPARITIONS (.rise / .fade / .swap-item / .step) ── */
  function initAppear() {
    var sel = '.rise, .fade, .swap-item, .step';
    var els = document.querySelectorAll(sel);
    if (!els.length) return;
    if (REDUCED) {
      Array.prototype.forEach.call(els, function (el) { el.classList.add('visible'); });
      return;
    }
    var obs = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        e.target.classList.add('visible');
        obs.unobserve(e.target);
      });
    }, { threshold: 0.15, rootMargin: '0px 0px -30px 0px' });
    Array.prototype.forEach.call(els, function (el) { obs.observe(el); });
  }

  /* ── 3. BANDEAUX DÉFILANTS : on duplique la piste pour boucler ── */
  function initMarquees() {
    var wraps = document.querySelectorAll('.marquee');
    Array.prototype.forEach.call(wraps, function (w) {
      var track = w.querySelector('.marquee__track');
      if (!track || track.dataset.cloned) return;
      track.dataset.cloned = '1';
      var clone = track.cloneNode(true);
      clone.setAttribute('aria-hidden', 'true');
      w.appendChild(clone);
    });
  }

  /* ── 4. COMPTEUR DE SCÈNE + BARRE DE PROGRESSION ── */
  function initSceneIndex() {
    var scenes = Array.prototype.slice.call(document.querySelectorAll('.scene'));
    var idxEl = document.getElementById('sceneIndex');
    var barEl = document.querySelector('.scroll-bar span');
    var hint = document.getElementById('swipeHint');
    if (!scenes.length) return;

    var total = String(scenes.length).padStart(2, '0');
    var cur = -1, first = true, hintGone = false;

    function paint(i) {
      if (i === cur) return;
      cur = i;
      if (idxEl) {
        idxEl.innerHTML = '<b>' + String(i + 1).padStart(2, '0') + '</b> / ' + total +
          ' <span class="si-name"></span>';
        idxEl.querySelector('.si-name').textContent = scenes[i].dataset.name || '';
      }
      if (!first) S.swipe();
      first = false;
      if (i > 0 && hint && !hintGone) { hintGone = true; hint.classList.add('is-hidden'); }
      document.body.classList.toggle('at-end', i === scenes.length - 1);
    }

    if (idxEl) paint(0);

    var obs = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) paint(scenes.indexOf(e.target));
      });
    }, { rootMargin: '-50% 0px -50% 0px', threshold: 0 });
    scenes.forEach(function (s) { obs.observe(s); });

    if (barEl) {
      var raf = null;
      var update = function () {
        raf = null;
        var el = document.scrollingElement || document.documentElement;
        var max = el.scrollHeight - el.clientHeight;
        barEl.style.width = (max > 0 ? (el.scrollTop / max) * 100 : 0) + '%';
      };
      window.addEventListener('scroll', function () {
        if (!raf) raf = requestAnimationFrame(update);
      }, { passive: true });
      update();
    }
  }

  /* ── 5. DECKS HORIZONTAUX : glisser à la souris + son au changement ── */
  function initDecks() {
    var decks = document.querySelectorAll('.swap-deck, .steps-deck, .reviews-track');
    Array.prototype.forEach.call(decks, function (deck) {
      var down = false, startX = 0, startScroll = 0, moved = false;

      deck.addEventListener('pointerdown', function (e) {
        if (e.pointerType !== 'mouse') return;
        down = true; moved = false;
        startX = e.clientX; startScroll = deck.scrollLeft;
        deck.classList.add('is-dragging');
      });
      window.addEventListener('pointermove', function (e) {
        if (!down) return;
        var dx = e.clientX - startX;
        if (Math.abs(dx) > 4) moved = true;
        deck.scrollLeft = startScroll - dx;
      });
      window.addEventListener('pointerup', function () {
        if (!down) return;
        down = false;
        deck.classList.remove('is-dragging');
      });
      deck.addEventListener('click', function (e) {
        if (moved) { e.preventDefault(); e.stopPropagation(); }
      }, true);

      var last = -1;
      deck.addEventListener('scroll', function () {
        var child = deck.firstElementChild;
        if (!child) return;
        var w = child.getBoundingClientRect().width || 1;
        var i = Math.round(deck.scrollLeft / w);
        if (i !== last) { last = i; S.hover(); }
      }, { passive: true });
    });
  }

  /* ── 6. CURSEUR PERSONNALISÉ ── */
  function initCursor() {
    if (!FINE || REDUCED) return;
    var dot = document.createElement('div');
    dot.className = 'cursor-dot';
    dot.setAttribute('aria-hidden', 'true');
    document.body.appendChild(dot);

    var x = window.innerWidth / 2, y = window.innerHeight / 2, cx = x, cy = y, raf = null;
    function loop() {
      cx += (x - cx) * 0.22;
      cy += (y - cy) * 0.22;
      dot.style.transform = 'translate(' + cx + 'px,' + cy + 'px) translate(-50%,-50%)';
      raf = requestAnimationFrame(loop);
    }
    window.addEventListener('pointermove', function (e) {
      if (e.pointerType !== 'mouse') return;
      x = e.clientX; y = e.clientY;
      if (!raf) loop();
    }, { passive: true });

    var HOT = 'a[href], button, .swap-deck, .steps-deck, .faq-q, input, textarea, .stat-row';
    document.addEventListener('pointerover', function (e) {
      if (!e.target.closest) return;
      dot.classList.toggle('is-big', !!e.target.closest(HOT));
    }, { passive: true });
  }

  /* ── 7. Sons sur les éléments propres à la V2 ── */
  function initV2Sounds() {
    if (!FINE) return;
    var last = null;
    document.addEventListener('pointerover', function (e) {
      var el = e.target.closest ? e.target.closest('.link-action, .faq-q, .stat-row, .contact-line, .page-toggle-opt, .lang-opt') : null;
      if (!el || el === last) return;
      last = el;
      S.hover();
    }, { passive: true });
  }

  function boot() {
    initPreloader();
    initAppear();
    initMarquees();
    initSceneIndex();
    initDecks();
    initCursor();
    initV2Sounds();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
