/* ════════════════════════════════════════════════════════════════
   CAZA COMM — moteur d'interface partagé
   Sons Web Audio · grille 3D · tilt · scramble · navigation · i18n
   Aucun module externe, aucun fichier audio : tout est synthétisé.
   ════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var FINE_POINTER = window.matchMedia('(hover: hover) and (pointer: fine)').matches;

  /* ─────────────────────────────────────────────
     1. LANGUE
     ───────────────────────────────────────────── */
  function getLang() {
    try { return localStorage.getItem('cazaLang') === 'en' ? 'en' : 'fr'; }
    catch (e) { return 'fr'; }
  }
  window.cazaGetLang = getLang;

  /* ─────────────────────────────────────────────
     2. MOTEUR SONORE (Web Audio, 100 % synthétisé)
     ───────────────────────────────────────────── */
  var Sound = (function () {
    var ctx = null, master = null, muted = false, unlocked = false;
    var lastPlay = 0;

    try { muted = localStorage.getItem('cazaSound') === 'off'; } catch (e) {}

    function ensure() {
      if (ctx) return ctx;
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      try {
        ctx = new AC();
        master = ctx.createGain();
        master.gain.value = 0.5;
        // Compresseur : garde les sons doux et homogènes, jamais agressifs
        var comp = ctx.createDynamicsCompressor();
        comp.threshold.value = -18;
        comp.ratio.value = 8;
        master.connect(comp);
        comp.connect(ctx.destination);
      } catch (e) { ctx = null; }
      return ctx;
    }

    // Le navigateur exige un geste utilisateur avant tout son
    function unlock() {
      if (unlocked) return;
      unlocked = true;
      var c = ensure();
      if (c && c.state === 'suspended') c.resume().catch(function () {});
    }
    ['pointerdown', 'keydown', 'touchstart'].forEach(function (ev) {
      window.addEventListener(ev, unlock, { once: true, passive: true, capture: true });
    });

    function ready() {
      if (muted) return null;
      var c = ensure();
      if (!c) return null;
      if (c.state === 'suspended') c.resume().catch(function () {});
      if (c.state !== 'running') return null;
      return c;
    }

    // Petite note douce (sinus + harmonique, attaque rapide, longue décroissance)
    function tone(freq, dur, vol, type, detuneHz) {
      var c = ready(); if (!c) return;
      var t = c.currentTime;
      var osc = c.createOscillator();
      var gain = c.createGain();
      var filt = c.createBiquadFilter();
      filt.type = 'lowpass';
      filt.frequency.value = Math.min(freq * 6, 12000);
      osc.type = type || 'sine';
      osc.frequency.setValueAtTime(freq, t);
      if (detuneHz) osc.frequency.exponentialRampToValueAtTime(Math.max(40, freq + detuneHz), t + dur);
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(vol, t + 0.008);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      osc.connect(filt); filt.connect(gain); gain.connect(master);
      osc.start(t);
      osc.stop(t + dur + 0.02);
    }

    // Souffle feutré (bruit filtré) : woosh, transitions
    function noise(dur, vol, from, to, q) {
      var c = ready(); if (!c) return;
      var t = c.currentTime;
      var frames = Math.floor(c.sampleRate * dur);
      var buf = c.createBuffer(1, frames, c.sampleRate);
      var data = buf.getChannelData(0);
      for (var i = 0; i < frames; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / frames);
      var src = c.createBufferSource();
      src.buffer = buf;
      var filt = c.createBiquadFilter();
      filt.type = 'bandpass';
      filt.Q.value = q || 1.2;
      filt.frequency.setValueAtTime(from, t);
      filt.frequency.exponentialRampToValueAtTime(to, t + dur);
      var gain = c.createGain();
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(vol, t + dur * 0.25);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      src.connect(filt); filt.connect(gain); gain.connect(master);
      src.start(t);
      src.stop(t + dur + 0.02);
    }

    // Anti-spam : jamais deux sons collés
    function gate(ms) {
      var now = performance.now();
      if (now - lastPlay < (ms || 45)) return false;
      lastPlay = now;
      return true;
    }

    var api = {
      // Clic feutré, type interface premium
      tap: function () {
        if (!gate(40)) return;
        tone(660, 0.075, 0.10, 'sine', -140);
        noise(0.045, 0.028, 2400, 900, 1.6);
      },
      // Survol : tick presque subliminal
      hover: function () {
        if (!gate(70)) return;
        tone(1180, 0.035, 0.022, 'sine');
      },
      // Bascule (langue, page, FAQ)
      toggle: function (up) {
        if (!gate(40)) return;
        tone(up === false ? 620 : 520, 0.07, 0.075, 'sine');
        setTimeout(function () { tone(up === false ? 460 : 784, 0.10, 0.065, 'sine'); }, 52);
      },
      // Changement de diapo : souffle discret
      swipe: function () {
        if (!gate(120)) return;
        noise(0.30, 0.030, 480, 2200, 0.8);
      },
      // Validation : petit arpège satisfaisant
      success: function () {
        [523.25, 659.25, 783.99, 1046.5].forEach(function (f, i) {
          setTimeout(function () { tone(f, 0.42, 0.085, 'sine'); }, i * 78);
        });
      },
      // Erreur : deux notes basses, sans agressivité
      error: function () {
        tone(320, 0.16, 0.075, 'sine');
        setTimeout(function () { tone(232, 0.28, 0.07, 'sine'); }, 130);
      },
      isMuted: function () { return muted; },
      setMuted: function (v) {
        muted = !!v;
        try { localStorage.setItem('cazaSound', muted ? 'off' : 'on'); } catch (e) {}
        if (!muted) { unlock(); setTimeout(api.tap, 30); }
      }
    };
    return api;
  })();
  window.cazaSound = Sound;

  /* Bouton mute dans la barre du haut */
  function initSoundToggle() {
    var btn = document.getElementById('soundToggle');
    if (!btn) return;
    btn.classList.toggle('is-muted', Sound.isMuted());
    btn.setAttribute('aria-pressed', Sound.isMuted() ? 'false' : 'true');
    btn.addEventListener('click', function () {
      var next = !Sound.isMuted();
      Sound.setMuted(next);
      btn.classList.toggle('is-muted', next);
      btn.setAttribute('aria-pressed', next ? 'false' : 'true');
    });
  }

  /* Sons branchés globalement sur les éléments interactifs */
  function initSoundBindings() {
    var TAPPABLE = 'a[href], button, .fp-dot, .faq-q, input[type="submit"]';
    document.addEventListener('pointerdown', function (e) {
      var el = e.target.closest ? e.target.closest(TAPPABLE) : null;
      if (!el) return;
      if (el.classList.contains('faq-q') || el.classList.contains('lang-opt') || el.classList.contains('page-toggle-opt')) return;
      if (el.id === 'soundToggle') return;
      Sound.tap();
    }, { passive: true, capture: true });

    if (FINE_POINTER) {
      document.addEventListener('pointerover', function (e) {
        var el = e.target.closest ? e.target.closest('.btn-primary, .btn-secondary, .btn-cta-email, .btn-cta-call, .service-card, .metric-card, .method-step, .page-toggle-opt, .lang-opt, .fp-dot') : null;
        if (!el || el === initSoundBindings._last) return;
        initSoundBindings._last = el;
        Sound.hover();
      }, { passive: true });
      document.addEventListener('pointerout', function (e) {
        if (!e.relatedTarget) initSoundBindings._last = null;
      }, { passive: true });
    }
  }

  /* ─────────────────────────────────────────────
     3. i18n FR / EN
     ───────────────────────────────────────────── */
  function initI18n() {
    var toggle = document.getElementById('langToggle');
    var nodes = document.querySelectorAll('[data-en]');
    Array.prototype.forEach.call(nodes, function (el) { el.dataset.fr = el.innerHTML; });

    // Champs de formulaire : le texte d'invite se traduit aussi
    var phNodes = document.querySelectorAll('[data-en-placeholder]');
    Array.prototype.forEach.call(phNodes, function (el) { el.dataset.frPlaceholder = el.getAttribute('placeholder') || ''; });

    function apply(lang) {
      Array.prototype.forEach.call(nodes, function (el) {
        var v = lang === 'en' ? el.dataset.en : el.dataset.fr;
        if (v != null) el.innerHTML = v;
      });
      Array.prototype.forEach.call(phNodes, function (el) {
        var v = lang === 'en' ? el.dataset.enPlaceholder : el.dataset.frPlaceholder;
        if (v != null) el.setAttribute('placeholder', v);
      });
      document.documentElement.lang = lang;
      if (toggle) {
        Array.prototype.forEach.call(toggle.querySelectorAll('.lang-opt'), function (b) {
          var on = b.dataset.lang === lang;
          b.classList.toggle('is-active', on);
          b.setAttribute('aria-pressed', on ? 'true' : 'false');
        });
      }
      document.dispatchEvent(new CustomEvent('cazalangchange', { detail: { lang: lang } }));
    }

    var cur = getLang();
    apply(cur);

    if (toggle) {
      toggle.addEventListener('click', function (e) {
        var btn = e.target.closest('.lang-opt');
        if (!btn || btn.dataset.lang === cur) return;
        cur = btn.dataset.lang;
        try { localStorage.setItem('cazaLang', cur); } catch (err) {}
        Sound.toggle(cur === 'en');
        apply(cur);
      });
    }
  }

  /* ─────────────────────────────────────────────
     4. SLIDER DU TOGGLE 3 PAGES
     ───────────────────────────────────────────── */
  function initPageToggle() {
    var tg = document.querySelector('.page-toggle');
    if (!tg) return;
    var slider = tg.querySelector('.page-toggle-slider');
    var active = tg.querySelector('.page-toggle-opt.is-active');
    if (!slider || !active) return;

    function fit() {
      var a = tg.querySelector('.page-toggle-opt.is-active');
      if (!a) return;
      var tgRect = tg.getBoundingClientRect();
      var aRect = a.getBoundingClientRect();
      if (!aRect.width) return;
      // Le décalage vient du padding du conteneur (3 px en V1, 0 en V2)
      var padLeft = parseFloat(getComputedStyle(tg).paddingLeft) || 0;
      slider.style.width = aRect.width + 'px';
      slider.style.transform = 'translateX(' + (aRect.left - tgRect.left - padLeft) + 'px)';
    }
    fit();
    window.addEventListener('resize', fit, { passive: true });
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(fit).catch(function () {});
    setTimeout(fit, 250);
    setTimeout(fit, 900);

    tg.addEventListener('pointerdown', function (e) {
      if (e.target.closest('.page-toggle-opt')) Sound.toggle(true);
    }, { passive: true });
  }

  /* ─────────────────────────────────────────────
     5. NAVIGATION : points latéraux + son de diapo
     ───────────────────────────────────────────── */
  function initSlideNav() {
    var slides = Array.prototype.slice.call(document.querySelectorAll('.fp-slide'));
    var dotsWrap = document.getElementById('fpDots');
    var hint = document.getElementById('fpSwipeHint');
    if (!slides.length || !dotsWrap) return;

    slides.forEach(function (s, i) {
      var d = document.createElement('button');
      d.type = 'button';
      d.className = 'fp-dot' + (i === 0 ? ' is-active' : '');
      d.setAttribute('aria-label', 'Section ' + (i + 1));
      d.addEventListener('click', function () {
        s.scrollIntoView({ behavior: REDUCED ? 'auto' : 'smooth', block: 'start' });
      });
      dotsWrap.appendChild(d);
    });
    var dots = Array.prototype.slice.call(dotsWrap.children);

    var hintDismissed = false;
    var current = 0;
    var first = true;

    var obs = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        var idx = slides.indexOf(e.target);
        if (idx === current) return;
        current = idx;
        dots.forEach(function (d, i) { d.classList.toggle('is-active', i === idx); });
        if (!first) Sound.swipe();
        first = false;
        if (idx > 0 && hint && !hintDismissed) {
          hintDismissed = true;
          hint.classList.add('is-hidden');
        }
      });
    }, { rootMargin: '-50% 0px -50% 0px', threshold: 0 });
    slides.forEach(function (s) { obs.observe(s); });
  }

  /* ─────────────────────────────────────────────
     6. RÉVÉLATION AU SCROLL
     ───────────────────────────────────────────── */
  function initReveal() {
    var els = document.querySelectorAll('.reveal');
    if (!els.length) return;
    if (REDUCED) {
      Array.prototype.forEach.call(els, function (el) { el.classList.add('visible'); });
      return;
    }
    var obs = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          obs.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
    Array.prototype.forEach.call(els, function (el) { obs.observe(el); });
  }

  /* ─────────────────────────────────────────────
     7. TILT 3D (souris uniquement)
     ───────────────────────────────────────────── */
  function initTilt() {
    var els = document.querySelectorAll('.tilt');
    if (!els.length) return;

    // Sur mobile : pas d'inclinaison, mais un léger enfoncement au toucher
    if (!FINE_POINTER || REDUCED) {
      Array.prototype.forEach.call(els, function (el) {
        el.addEventListener('touchstart', function () { el.style.transform = 'scale(.985)'; }, { passive: true });
        var reset = function () { el.style.transform = ''; };
        el.addEventListener('touchend', reset, { passive: true });
        el.addEventListener('touchcancel', reset, { passive: true });
      });
      return;
    }

    Array.prototype.forEach.call(els, function (el) {
      var raf = null, tx = 0, ty = 0;
      var MAX = parseFloat(el.dataset.tilt || '8');

      function move(e) {
        var r = el.getBoundingClientRect();
        var px = (e.clientX - r.left) / r.width;
        var py = (e.clientY - r.top) / r.height;
        el.style.setProperty('--mx', (px * 100) + '%');
        el.style.setProperty('--my', (py * 100) + '%');
        tx = (py - 0.5) * -2 * MAX;
        ty = (px - 0.5) * 2 * MAX;
        if (raf) return;
        raf = requestAnimationFrame(function () {
          raf = null;
          el.style.transform = 'perspective(900px) rotateX(' + tx.toFixed(2) + 'deg) rotateY(' + ty.toFixed(2) + 'deg) translateZ(6px)';
        });
      }
      el.addEventListener('pointerenter', function (e) {
        if (e.pointerType !== 'mouse') return;
        el.classList.add('is-tilting');
        move(e);
      });
      el.addEventListener('pointermove', function (e) {
        if (e.pointerType !== 'mouse') return;
        move(e);
      });
      el.addEventListener('pointerleave', function () {
        el.classList.remove('is-tilting');
        if (raf) { cancelAnimationFrame(raf); raf = null; }
        el.style.transform = '';
      });
    });
  }

  /* ─────────────────────────────────────────────
     8. BOUTONS MAGNÉTIQUES
     ───────────────────────────────────────────── */
  function initMagnetic() {
    if (!FINE_POINTER || REDUCED) return;
    var els = document.querySelectorAll('.btn-primary, .btn-secondary, .btn-cta-email, .btn-cta-call');
    Array.prototype.forEach.call(els, function (el) {
      el.addEventListener('pointermove', function (e) {
        if (e.pointerType !== 'mouse') return;
        var r = el.getBoundingClientRect();
        var dx = (e.clientX - (r.left + r.width / 2)) / r.width;
        var dy = (e.clientY - (r.top + r.height / 2)) / r.height;
        el.style.transform = 'translate(' + (dx * 8).toFixed(1) + 'px,' + (dy * 6).toFixed(1) + 'px)';
      });
      el.addEventListener('pointerleave', function () { el.style.transform = ''; });
      el.addEventListener('pointerup', function () { el.style.transform = ''; });
    });
  }

  /* ─────────────────────────────────────────────
     9. SCRAMBLE (petits libellés mono uniquement)
     ───────────────────────────────────────────── */
  function initScramble() {
    var els = document.querySelectorAll('[data-scramble]');
    if (!els.length || REDUCED) return;
    var CHARS = '▲▼◆●▪ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789/\\<>*+-';

    // Un changement de langue réécrit le texte : on annule les scrambles en cours
    var version = 0;
    document.addEventListener('cazalangchange', function () { version++; });

    function run(el) {
      var target = el.textContent;
      if (!target || el._scrambling) return;
      el._scrambling = true;
      var myVersion = version;
      var len = target.length;
      var frame = 0;
      var total = 22 + len;
      function step() {
        if (myVersion !== version) { el._scrambling = false; return; }
        var out = '';
        for (var i = 0; i < len; i++) {
          var reveal = frame - i * 1.1;
          if (target[i] === ' ') { out += ' '; continue; }
          if (reveal > 8) out += target[i];
          else if (reveal > 0) out += CHARS[Math.floor(Math.random() * CHARS.length)];
          else out += ' ';
        }
        el.textContent = out;
        frame++;
        if (frame < total) requestAnimationFrame(step);
        else { el.textContent = target; el._scrambling = false; }
      }
      step();
    }

    var obs = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { run(e.target); obs.unobserve(e.target); }
      });
    }, { threshold: 0.5 });
    Array.prototype.forEach.call(els, function (el) { obs.observe(el); });
  }

  /* ─────────────────────────────────────────────
     10. FOND : grille 3D en perspective + particules
     ───────────────────────────────────────────── */
  function initHoloGrid() {
    var canvas = document.getElementById('holoGrid');
    if (!canvas || REDUCED) return;
    var ctx = canvas.getContext('2d');
    if (!ctx) return;

    var W = 0, H = 0, dpr = 1, raf = null, t = 0;
    var mouseX = 0, mouseY = 0, curX = 0, curY = 0;
    var stars = [];

    function resize() {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      W = canvas.clientWidth; H = canvas.clientHeight;
      canvas.width = Math.floor(W * dpr);
      canvas.height = Math.floor(H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      seedStars();
    }

    function seedStars() {
      var count = W < 700 ? 26 : 52;
      stars = [];
      for (var i = 0; i < count; i++) {
        stars.push({
          x: (Math.random() - 0.5) * 2,
          y: (Math.random() - 0.5) * 2,
          z: Math.random() * 1 + 0.06,
          r: Math.random() * 1.3 + 0.4,
          tw: Math.random() * Math.PI * 2
        });
      }
    }

    function drawGrid(horizon, vx) {
      var f = H * 0.85;          // focale
      var camH = 1.0;            // hauteur caméra
      var spacing = 1.0;
      var speed = 0.0075;
      var offset = (t * speed) % spacing;

      ctx.lineWidth = 1;

      // Lignes transversales (constant z) : de la plus proche à l'horizon
      for (var i = 0; i < 26; i++) {
        var z = i * spacing + offset + 0.55;
        var sy = horizon + (f * camH) / z;
        if (sy > H + 2) continue;
        var fade = Math.max(0, 1 - i / 22);
        ctx.strokeStyle = 'rgba(111,207,151,' + (0.26 * fade * fade).toFixed(4) + ')';
        ctx.beginPath();
        ctx.moveTo(0, sy);
        ctx.lineTo(W, sy);
        ctx.stroke();
      }

      // Lignes fuyantes (constant x) : convergent vers le point de fuite
      var zNear = 0.55 + offset;
      var zFar = 26 * spacing + offset;
      for (var k = -14; k <= 14; k++) {
        var x = k * spacing * 1.15;
        var x1 = vx + (f * x) / zNear, y1 = horizon + (f * camH) / zNear;
        var x2 = vx + (f * x) / zFar,  y2 = horizon + (f * camH) / zFar;
        var fadeK = Math.max(0, 1 - Math.abs(k) / 15);
        var g = ctx.createLinearGradient(x1, y1, x2, y2);
        g.addColorStop(0, 'rgba(111,207,151,' + (0.20 * fadeK).toFixed(4) + ')');
        g.addColorStop(1, 'rgba(111,207,151,0)');
        ctx.strokeStyle = g;
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
      }

      // Ligne d'horizon lumineuse
      var hg = ctx.createLinearGradient(0, horizon, W, horizon);
      hg.addColorStop(0, 'rgba(67,240,200,0)');
      hg.addColorStop(0.5, 'rgba(67,240,200,0.34)');
      hg.addColorStop(1, 'rgba(67,240,200,0)');
      ctx.strokeStyle = hg;
      ctx.beginPath();
      ctx.moveTo(0, horizon);
      ctx.lineTo(W, horizon);
      ctx.stroke();
    }

    function drawStars(cx, cy) {
      for (var i = 0; i < stars.length; i++) {
        var s = stars[i];
        s.z -= 0.0016;
        if (s.z <= 0.05) { s.z = 1.1; s.x = (Math.random() - 0.5) * 2; s.y = (Math.random() - 0.5) * 2; }
        var k = 0.6 / s.z;
        var px = cx + s.x * W * k * 0.5;
        var py = cy + s.y * H * k * 0.5;
        if (px < -20 || px > W + 20 || py < -20 || py > H + 20) continue;
        var tw = 0.45 + 0.55 * Math.abs(Math.sin(s.tw + t * 0.02));
        var a = Math.min(0.5, (1 - s.z) * 0.55) * tw;
        if (a <= 0.01) continue;
        ctx.beginPath();
        ctx.arc(px, py, s.r * k * 0.8, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(168,230,193,' + a.toFixed(3) + ')';
        ctx.fill();
      }
    }

    function frame() {
      t++;
      curX += (mouseX - curX) * 0.05;
      curY += (mouseY - curY) * 0.05;
      ctx.clearRect(0, 0, W, H);
      var horizon = H * 0.60 + curY * 26;
      var vx = W / 2 + curX * 40;
      drawStars(W / 2 + curX * 22, H * 0.42 + curY * 18);
      drawGrid(horizon, vx);
      raf = requestAnimationFrame(frame);
    }

    function start() { if (!raf) raf = requestAnimationFrame(frame); }
    function stop() { if (raf) { cancelAnimationFrame(raf); raf = null; } }

    resize();
    start();

    window.addEventListener('resize', function () { resize(); }, { passive: true });
    document.addEventListener('visibilitychange', function () {
      if (document.hidden) stop(); else start();
    });
    if (FINE_POINTER) {
      window.addEventListener('pointermove', function (e) {
        mouseX = (e.clientX / window.innerWidth - 0.5) * 2;
        mouseY = (e.clientY / window.innerHeight - 0.5) * 2;
      }, { passive: true });
    }
  }

  /* ─────────────────────────────────────────────
     11. CARROUSEL AVIS (glisser à la souris)
     ───────────────────────────────────────────── */
  function initReviews() {
    var track = document.getElementById('reviewsTrack');
    if (!track) return;
    var down = false, startX = 0, startScroll = 0, moved = false;

    track.addEventListener('pointerdown', function (e) {
      if (e.pointerType !== 'mouse') return;
      down = true; moved = false;
      startX = e.clientX; startScroll = track.scrollLeft;
      track.classList.add('is-dragging');
    });
    window.addEventListener('pointermove', function (e) {
      if (!down) return;
      var dx = e.clientX - startX;
      if (Math.abs(dx) > 4) moved = true;
      track.scrollLeft = startScroll - dx;
    });
    window.addEventListener('pointerup', function () {
      if (!down) return;
      down = false;
      track.classList.remove('is-dragging');
    });
    track.addEventListener('click', function (e) {
      if (moved) { e.preventDefault(); e.stopPropagation(); }
    }, true);

    // Petit son en changeant de carte
    var lastCard = -1;
    track.addEventListener('scroll', function () {
      var card = track.querySelector('.review-card');
      if (!card) return;
      var w = card.getBoundingClientRect().width + 14;
      var idx = Math.round(track.scrollLeft / w);
      if (idx !== lastCard) { lastCard = idx; Sound.hover(); }
    }, { passive: true });
  }

  /* ─────────────────────────────────────────────
     12. FAQ
     ───────────────────────────────────────────── */
  function initFaq() {
    var items = Array.prototype.slice.call(document.querySelectorAll('.faq-item'));
    if (!items.length) return;

    function setOpenHeights() {
      Array.prototype.forEach.call(document.querySelectorAll('.faq-item.open .faq-a'), function (p) {
        p.style.maxHeight = p.scrollHeight + 'px';
      });
    }

    items.forEach(function (item) {
      var btn = item.querySelector('.faq-q');
      var panel = item.querySelector('.faq-a');
      if (!btn || !panel) return;
      btn.addEventListener('click', function () {
        var willOpen = !item.classList.contains('open');
        items.forEach(function (o) {
          if (o === item) return;
          o.classList.remove('open');
          var b = o.querySelector('.faq-q');
          var p = o.querySelector('.faq-a');
          if (b) b.setAttribute('aria-expanded', 'false');
          if (p) p.style.maxHeight = null;
        });
        item.classList.toggle('open', willOpen);
        btn.setAttribute('aria-expanded', willOpen ? 'true' : 'false');
        panel.style.maxHeight = willOpen ? panel.scrollHeight + 'px' : null;
        Sound.toggle(willOpen);
      });
    });

    document.addEventListener('cazalangchange', setOpenHeights);
    window.addEventListener('resize', setOpenHeights, { passive: true });
  }

  /* ─────────────────────────────────────────────
     13. FORMULAIRE DE CONTACT (Web3Forms)
     ───────────────────────────────────────────── */
  function initForm() {
    // Une page peut porter plusieurs formulaires (demande en haut, contact en bas)
    var forms = document.querySelectorAll('form.contact-form');
    if (!forms.length) return;

    var MSG = {
      fr: {
        sending: 'Envoi en cours…',
        ok: 'Merci ! Votre message a bien été envoyé, nous vous répondons sous 24 h.',
        err: "Oups, l'envoi a échoué. Réessayez ou écrivez-nous à jeremy@cazacomm.fr."
      },
      en: {
        sending: 'Sending…',
        ok: "Thank you! Your message has been sent, we'll reply within 24h.",
        err: 'Oops, sending failed. Please try again or email us at jeremy@cazacomm.fr.'
      }
    };

    Array.prototype.forEach.call(forms, function (form) {
      var statusEl = form.querySelector('.form-status');
      if (!statusEl) return;

      form.addEventListener('submit', function (e) {
        e.preventDefault();
        var lang = getLang();
        var btn = form.querySelector('.btn-submit');
        statusEl.className = 'form-status';
        statusEl.textContent = MSG[lang].sending;
        if (btn) btn.disabled = true;

        fetch(form.action, {
          method: 'POST',
          body: new FormData(form),
          headers: { Accept: 'application/json' }
        })
          .then(function (res) { return res.json().catch(function () { return {}; }).then(function (j) { return { ok: res.ok, json: j }; }); })
          .then(function (r) {
            if (r.ok && r.json.success) {
              statusEl.classList.add('success');
              statusEl.textContent = MSG[lang].ok;
              form.reset();
              Sound.success();
            } else {
              throw new Error('failed');
            }
          })
          .catch(function () {
            statusEl.classList.add('error');
            statusEl.textContent = MSG[lang].err;
            Sound.error();
          })
          .then(function () { if (btn) btn.disabled = false; });
      });
    });
  }

  /* ─────────────────────────────────────────────
     BOOT
     ───────────────────────────────────────────── */
  function boot() {
    initI18n();
    initSoundToggle();
    initSoundBindings();
    initPageToggle();
    initSlideNav();
    initReveal();
    initTilt();
    initMagnetic();
    initScramble();
    initHoloGrid();
    initReviews();
    initFaq();
    initForm();
    document.body.classList.add('caza-ready');
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
