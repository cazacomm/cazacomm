/* ============================================================
   INOXTAG — vitrine. Aucune dépendance externe.
   ============================================================ */
(function () {
  'use strict';

  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var fine   = !!(window.matchMedia && window.matchMedia('(hover:hover) and (pointer:fine)').matches)
               && !(navigator.maxTouchPoints > 0);
  var SUMMIT = 8849;

  var clamp = function (v, a, b) { return v < a ? a : v > b ? b : v; };
  var lerp  = function (a, b, t) { return a + (b - a) * t; };

  /* ---------------------------------------------------------
     1. Bandeau défilant
     --------------------------------------------------------- */
  (function ticker() {
    var el = document.getElementById('tick');
    if (!el) return;
    var items = ['8 849 m', 'Everest', '<em>Kaizen</em>', 'Népal', '9,4 M d’abonnés',
                 '<em>Instinct</em>', '365 jours', 'Col Sud', '12 M de vues', '<em>Zone de la mort</em>'];
    var html = items.map(function (t) { return '<span>' + t + '</span>'; }).join('');
    el.innerHTML = html + html;
  })();

  /* ---------------------------------------------------------
     2. Réticule (desktop uniquement)
     --------------------------------------------------------- */
  if (fine && !reduce) {
    var ret = document.querySelector('.reticle');
    var rx = window.innerWidth / 2, ry = window.innerHeight / 2, cx = rx, cy = ry;
    var moveTimer;
    document.addEventListener('mousemove', function (e) {
      rx = e.clientX; ry = e.clientY;
      document.body.classList.add('moving');
      clearTimeout(moveTimer);
      moveTimer = setTimeout(function () { document.body.classList.remove('moving'); }, 900);
    }, { passive: true });

    (function loop() {
      cx = lerp(cx, rx, 0.22); cy = lerp(cy, ry, 0.22);
      ret.style.transform = 'translate3d(' + cx.toFixed(1) + 'px,' + cy.toFixed(1) + 'px,0)';
      requestAnimationFrame(loop);
    })();

    var hots = document.querySelectorAll('a,button,[data-hot],.card,.frame');
    Array.prototype.forEach.call(hots, function (h) {
      h.addEventListener('mouseenter', function () { document.body.classList.add('hot'); });
      h.addEventListener('mouseleave', function () { document.body.classList.remove('hot'); });
    });
  }

  /* ---------------------------------------------------------
     3. Apparitions
     --------------------------------------------------------- */
  (function reveals() {
    var els = document.querySelectorAll('.rv');
    if (!('IntersectionObserver' in window) || reduce) {
      Array.prototype.forEach.call(els, function (e) { e.classList.add('in'); });
      return;
    }
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (e) {
        if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
      });
    }, { rootMargin: '0px 0px -12% 0px', threshold: 0.12 });
    Array.prototype.forEach.call(els, function (e) { io.observe(e); });

    // tout ce qui est déjà dans le premier écran s'affiche sans attendre un scroll
    requestAnimationFrame(function () {
      Array.prototype.forEach.call(els, function (e) {
        if (e.getBoundingClientRect().top < window.innerHeight - 8) {
          e.classList.add('in'); io.unobserve(e);
        }
      });
    });

    // le H1 du hero se démasque tout de suite
    var h1 = document.querySelector('.hero h1 .mask');
    if (h1) setTimeout(function () { h1.classList.add('in'); }, 260);
  })();

  /* ---------------------------------------------------------
     4. Compteurs
     --------------------------------------------------------- */
  (function counters() {
    var nums = document.querySelectorAll('[data-to]');
    if (!('IntersectionObserver' in window)) return;
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (e) {
        if (!e.isIntersecting) return;
        io.unobserve(e.target);
        var el = e.target;
        var to  = parseFloat(el.getAttribute('data-to'));
        var dec = parseInt(el.getAttribute('data-dec') || '0', 10);
        var suf = el.getAttribute('data-suffix') || '';
        if (reduce) { el.innerHTML = fmt(to, dec) + '<i>' + suf + '</i>'; return; }
        var t0 = performance.now(), dur = 1500;
        (function step(t) {
          var p = clamp((t - t0) / dur, 0, 1);
          var e2 = 1 - Math.pow(1 - p, 4);
          el.innerHTML = fmt(to * e2, dec) + '<i>' + suf + '</i>';
          if (p < 1) requestAnimationFrame(step);
        })(t0);
      });
    }, { threshold: 0.5 });
    Array.prototype.forEach.call(nums, function (n) { io.observe(n); });

    function fmt(v, dec) {
      var s = dec ? v.toFixed(dec).replace('.', ',') : Math.round(v).toString();
      if (!dec && v >= 1000) s = s.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
      return s;
    }
  })();

  /* ---------------------------------------------------------
     5. Barres de plateformes
     --------------------------------------------------------- */
  (function bars() {
    var bs = document.querySelectorAll('.plat__bar');
    if (!('IntersectionObserver' in window)) return;
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (e) {
        if (!e.isIntersecting) return;
        io.unobserve(e.target);
        e.target.style.width = e.target.getAttribute('data-w') + '%';
      });
    }, { threshold: 0.4 });
    Array.prototype.forEach.call(bs, function (b) { io.observe(b); });
  })();

  /* ---------------------------------------------------------
     6. Vidéos : ne chargent qu'à l'écran, muettes, une par une
     --------------------------------------------------------- */
  (function videos() {
    var vids = document.querySelectorAll('video[data-src], #heroVid');
    if (!('IntersectionObserver' in window)) return;
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (e) {
        var v = e.target;
        if (e.isIntersecting) {
          var src = v.getAttribute('data-src') || (v.id === 'heroVid' ? 'assets/video/hero.mp4' : null);
          if (src && !v.getAttribute('src')) {
            v.setAttribute('src', src);
            v.load();
          }
          var p = v.play();
          if (p && p.catch) p.catch(function () {});
          if (v.id === 'heroVid') {
            v.addEventListener('playing', function () { v.classList.add('on'); }, { once: true });
          }
        } else if (!v.paused) {
          v.pause();
        }
      });
    }, { threshold: 0.25 });
    Array.prototype.forEach.call(vids, function (v) {
      v.muted = true; v.setAttribute('muted', '');
      if (!reduce) io.observe(v);
    });
  })();

  /* ---------------------------------------------------------
     7. Rail altimètre + nav + parallaxe de bande
     --------------------------------------------------------- */
  var scrollP = 0;
  (function rail() {
    var railEl  = document.getElementById('rail');
    var fill    = document.getElementById('railFill');
    var cursor  = document.getElementById('railCursor');
    var read    = document.getElementById('railRead');
    var nav     = document.getElementById('nav');
    var camps   = document.querySelectorAll('.camp');
    var bandImg = document.getElementById('bandImg');
    var band    = document.getElementById('band');
    if (!railEl) return;

    // repères d'altitude sur le rail
    var marks = [];
    Array.prototype.forEach.call(camps, function (c) {
      var alt = parseInt(c.getAttribute('data-alt'), 10);
      var t = document.createElement('i');
      t.className = 'rail__tick';
      t.style.bottom = 'calc(14vh + ' + (alt / SUMMIT * 72) + 'vh)';
      railEl.appendChild(t);
      marks.push({ el: t, alt: alt, camp: c });
    });

    var shown = 0, target = 0, ticking = false;

    function measure() {
      var max = document.documentElement.scrollHeight - window.innerHeight;
      target = max > 0 ? clamp(window.pageYOffset / max, 0, 1) : 0;
      if (!ticking) { ticking = true; requestAnimationFrame(paint); }
    }

    function paint() {
      ticking = false;
      shown = reduce ? target : lerp(shown, target, 0.12);
      if (Math.abs(target - shown) < 0.0015) shown = target;
      scrollP = shown;

      var h = 72 * shown; // vh
      fill.style.height = h + 'vh';
      cursor.style.bottom = 'calc(14vh + ' + h + 'vh)';
      read.style.bottom = 'calc(14vh + ' + h + 'vh)';

      var alt = Math.round(shown * SUMMIT);
      read.firstChild.textContent = alt.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');

      marks.forEach(function (m) {
        var on = alt >= m.alt - 40;
        m.el.setAttribute('data-on', on ? '1' : '0');
        m.camp.setAttribute('data-on', on ? '1' : '0');
      });

      nav.classList.toggle('solid', window.pageYOffset > window.innerHeight * 0.75);

      if (bandImg && band && !reduce) {
        var r = band.getBoundingClientRect();
        if (r.bottom > 0 && r.top < window.innerHeight) {
          var p = (window.innerHeight - r.top) / (window.innerHeight + r.height);
          bandImg.style.transform = 'translate3d(0,' + ((p - 0.5) * -12).toFixed(2) + '%,0)';
        }
      }

      if (Math.abs(shown - target) > 0.0004 && !ticking) {
        ticking = true; requestAnimationFrame(paint);
      }
    }

    window.addEventListener('scroll', measure, { passive: true });
    window.addEventListener('resize', measure);
    measure();
  })();

  /* ---------------------------------------------------------
     8. Carte topographique animée
     --------------------------------------------------------- */
  (function topo() {
    var host = document.getElementById('topo');
    var cv   = document.getElementById('topoCv');
    if (!host || !cv || !cv.getContext) return;
    var ctx = cv.getContext('2d');
    if (!ctx) return;

    var small   = window.innerWidth < 760;
    var N       = small ? 96 : 132;          // résolution du relief
    var LEVELS  = small ? 14 : 22;           // nombre de courbes de niveau
    var field   = new Float32Array(N * N);

    /* --- bruit de valeur déterministe --- */
    function hash(x, y) {
      var n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453123;
      return n - Math.floor(n);
    }
    function vnoise(x, y) {
      var xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
      var u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
      var a = hash(xi, yi), b = hash(xi + 1, yi), c = hash(xi, yi + 1), d = hash(xi + 1, yi + 1);
      return lerp(lerp(a, b, u), lerp(c, d, u), v);
    }
    function fbm(x, y) {
      var s = 0, amp = 0.5, f = 1;
      for (var i = 0; i < 5; i++) { s += amp * vnoise(x * f, y * f); f *= 2.03; amp *= 0.5; }
      return s;
    }

    /* --- construction du massif : un sommet dominant + arêtes --- */
    var PX = 0.47, PY = 0.44;                // sommet principal
    var SX = 0.74, SY = 0.68;                // antécime
    (function build() {
      var min = 1e9, max = -1e9;
      for (var gy = 0; gy < N; gy++) {
        for (var gx = 0; gx < N; gx++) {
          var u = gx / (N - 1), v = gy / (N - 1);
          var d1 = Math.sqrt(Math.pow((u - PX) * 1.08, 2) + Math.pow(v - PY, 2));
          var d2 = Math.sqrt(Math.pow((u - SX) * 1.1, 2) + Math.pow(v - SY, 2));
          var main = Math.pow(Math.max(0, 1 - d1 / 0.86), 1.9);
          var sec  = Math.pow(Math.max(0, 1 - d2 / 0.40), 1.7) * 0.46;
          var ridge = 1 - Math.abs(fbm(u * 3.4 + 11, v * 3.4 + 7) * 2 - 1);
          var h = main + sec + ridge * 0.30 + fbm(u * 5.4, v * 5.4) * 0.26;
          field[gy * N + gx] = h;
          if (h < min) min = h;
          if (h > max) max = h;
        }
      }
      for (var i = 0; i < field.length; i++) field[i] = (field[i] - min) / (max - min);

      // deux passes de lissage : des courbes propres, pas du gribouillis au sommet
      var tmp = new Float32Array(field.length);
      for (var pass = 0; pass < 3; pass++) {
        for (var y = 0; y < N; y++) {
          for (var x = 0; x < N; x++) {
            var acc = 0, cnt = 0;
            for (var oy2 = -1; oy2 <= 1; oy2++) {
              for (var ox2 = -1; ox2 <= 1; ox2++) {
                var xx = x + ox2, yy = y + oy2;
                if (xx < 0 || yy < 0 || xx >= N || yy >= N) continue;
                acc += field[yy * N + xx]; cnt++;
              }
            }
            tmp[y * N + x] = acc / cnt;
          }
        }
        field.set(tmp);
      }
    })();

    function sample(u, v) {
      var x = clamp(u, 0, 0.999) * (N - 1), y = clamp(v, 0, 0.999) * (N - 1);
      var xi = x | 0, yi = y | 0, xf = x - xi, yf = y - yi;
      var i = yi * N + xi;
      return lerp(lerp(field[i], field[i + 1], xf), lerp(field[i + N], field[i + N + 1], xf), yf);
    }

    /* --- courbes de niveau (marching squares), calculées une fois --- */
    var contours = [];
    (function contourize() {
      for (var L = 0; L < LEVELS; L++) {
        var lv = 0.06 + (L / (LEVELS - 1)) * 0.86;
        var pts = [];
        for (var gy = 0; gy < N - 1; gy++) {
          for (var gx = 0; gx < N - 1; gx++) {
            var a = field[gy * N + gx],       b = field[gy * N + gx + 1];
            var c = field[(gy + 1) * N + gx + 1], d = field[(gy + 1) * N + gx];
            var s = (a > lv ? 8 : 0) | (b > lv ? 4 : 0) | (c > lv ? 2 : 0) | (d > lv ? 1 : 0);
            if (s === 0 || s === 15) continue;
            var x0 = gx / (N - 1), y0 = gy / (N - 1), st = 1 / (N - 1);
            var T = [x0 + st * ip(a, b, lv), y0];
            var R = [x0 + st,                y0 + st * ip(b, c, lv)];
            var B = [x0 + st * ip(d, c, lv), y0 + st];
            var Lf= [x0,                     y0 + st * ip(a, d, lv)];
            push(s, T, R, B, Lf, pts);
          }
        }
        contours.push({ lv: lv, pts: new Float32Array(pts) });
      }
      function ip(v1, v2, lv) { var dd = v2 - v1; return dd === 0 ? 0.5 : clamp((lv - v1) / dd, 0, 1); }
      function push(s, T, R, B, Lf, out) {
        var seg = null;
        switch (s) {
          case 1: case 14: seg = [Lf, B]; break;
          case 2: case 13: seg = [B, R];  break;
          case 3: case 12: seg = [Lf, R]; break;
          case 4: case 11: seg = [T, R];  break;
          case 6: case 9:  seg = [T, B];  break;
          case 7: case 8:  seg = [Lf, T]; break;
          case 5: out.push(Lf[0], Lf[1], T[0], T[1], B[0], B[1], R[0], R[1]); return;
          case 10: out.push(T[0], T[1], R[0], R[1], Lf[0], Lf[1], B[0], B[1]); return;
        }
        if (seg) out.push(seg[0][0], seg[0][1], seg[1][0], seg[1][1]);
      }
    })();

    /* --- la voie : spirale qui monte jusqu'au sommet --- */
    var ROUTE = [];
    (function route() {
      for (var i = 0; i <= 240; i++) {
        var t = i / 240;
        var r = 0.44 * Math.pow(1 - t, 1.15);
        var a = 2.4 + t * 4.1;
        var u = PX + Math.cos(a) * r * 1.06;
        var v = PY + Math.sin(a) * r * 0.94;
        ROUTE.push(u, v, sample(u, v) + 0.014);
      }
    })();
    var CAMP_T = [0.0, 0.24, 0.42, 0.60, 0.79, 1.0];

    /* --- rendu --- */
    var W = 0, H = 0, dpr = 1, live = false, ang = 0.62, raf = 0;

    function size() {
      var r = host.getBoundingClientRect();
      dpr = Math.min(window.devicePixelRatio || 1, small ? 1.5 : 2);
      W = Math.max(1, r.width); H = Math.max(1, r.height);
      cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    function project(u, v, h, cos, sin, scale, ox, oy, hk) {
      var px = u - 0.5, py = v - 0.5;
      var X = px * cos - py * sin;
      var Y = px * sin + py * cos;
      return [ox + X * scale, oy + Y * scale * 0.46 - h * hk];
    }

    // cadrage automatique sur l'emprise reelle des courbes, quel que soit l'angle
    var HK = 0.70;
    var FIT = (function () {
      var a = [];
      for (var L = 0; L < contours.length; L++) {
        var c = contours[L];
        for (var i = 0; i < c.pts.length; i += 24) a.push(c.pts[i], c.pts[i + 1], c.lv);
      }
      for (var k = 0; k < ROUTE.length; k += 3) a.push(ROUTE[k], ROUTE[k + 1], ROUTE[k + 2]);
      return new Float32Array(a);
    })();

    function fit(cos, sin) {
      var minX = 1e9, maxX = -1e9, minY = 1e9, maxY = -1e9;
      for (var i = 0; i < FIT.length; i += 3) {
        var px = FIT[i] - 0.5, py = FIT[i + 1] - 0.5;
        var X = px * cos - py * sin;
        var Y = (px * sin + py * cos) * 0.46 - FIT[i + 2] * HK;
        if (X < minX) minX = X; if (X > maxX) maxX = X;
        if (Y < minY) minY = Y; if (Y > maxY) maxY = Y;
      }
      var s = Math.min(W * 0.99 / (maxX - minX), H * 0.96 / (maxY - minY));
      return { s: s, ox: W / 2 - (minX + maxX) / 2 * s, oy: H / 2 - (minY + maxY) / 2 * s };
    }

    function draw() {
      raf = 0;
      var cos = Math.cos(ang), sin = Math.sin(ang);
      var f = fit(cos, sin);
      var scale = f.s, ox = f.ox, oy = f.oy, hk = scale * HK;

      ctx.clearRect(0, 0, W, H);
      ctx.lineJoin = 'round';
      ctx.lineCap  = 'round';

      // altitude courante d'après le scroll global
      var cur = clamp(scrollP * 1.55 - 0.18, 0, 1);

      for (var L = 0; L < contours.length; L++) {
        var c = contours[L], p = c.pts, lv = c.lv;
        var t = L / (contours.length - 1);
        var near = 1 - clamp(Math.abs(lv - cur) * 5.2, 0, 1);

        var r = Math.round(lerp(lerp(62, 196, t * t), 231, near));
        var g = Math.round(lerp(lerp(92, 222, t * t), 182, near));
        var b = Math.round(lerp(lerp(114, 240, t * t), 92, near));
        ctx.strokeStyle = 'rgba(' + r + ',' + g + ',' + b + ',' + (0.16 + t * 0.46 + near * 0.38).toFixed(3) + ')';
        ctx.lineWidth = 0.7 + t * 0.35 + near * 1.1;

        ctx.beginPath();
        for (var i = 0; i < p.length; i += 4) {
          var A = project(p[i], p[i + 1], lv, cos, sin, scale, ox, oy, hk);
          var B = project(p[i + 2], p[i + 3], lv, cos, sin, scale, ox, oy, hk);
          ctx.moveTo(A[0], A[1]); ctx.lineTo(B[0], B[1]);
        }
        ctx.stroke();
      }

      // la voie
      var prog = clamp(scrollP * 1.7 - 0.22, 0, 1);
      ctx.lineWidth = 1.6;
      ctx.strokeStyle = 'rgba(220,236,245,.16)';
      strokeRoute(0, 1);
      if (prog > 0) {
        ctx.save();
        ctx.shadowColor = 'rgba(227,178,90,.9)';
        ctx.shadowBlur = 12;
        ctx.strokeStyle = '#e3b25a';
        ctx.lineWidth = 2;
        strokeRoute(0, prog);
        ctx.restore();
      }

      function strokeRoute(a, b) {
        var n = ROUTE.length / 3;
        var i0 = Math.floor(a * (n - 1)), i1 = Math.ceil(b * (n - 1));
        ctx.beginPath();
        for (var i = i0; i <= i1; i++) {
          var P = project(ROUTE[i * 3], ROUTE[i * 3 + 1], ROUTE[i * 3 + 2], cos, sin, scale, ox, oy, hk);
          if (i === i0) ctx.moveTo(P[0], P[1]); else ctx.lineTo(P[0], P[1]);
        }
        ctx.stroke();
      }

      // camps
      var n = ROUTE.length / 3;
      for (var k = 0; k < CAMP_T.length; k++) {
        var idx = Math.round(CAMP_T[k] * (n - 1));
        var P = project(ROUTE[idx * 3], ROUTE[idx * 3 + 1], ROUTE[idx * 3 + 2], cos, sin, scale, ox, oy, hk);
        var on = prog >= CAMP_T[k] - 0.005;
        ctx.beginPath();
        ctx.arc(P[0], P[1], on ? 3.4 : 2.2, 0, 6.2832);
        ctx.fillStyle = on ? '#e3b25a' : 'rgba(143,176,196,.45)';
        ctx.fill();
        if (on) {
          ctx.beginPath();
          ctx.arc(P[0], P[1], 8, 0, 6.2832);
          ctx.strokeStyle = 'rgba(227,178,90,.35)';
          ctx.lineWidth = 1;
          ctx.stroke();
        }
      }
    }

    function tick() {
      if (!live) return;
      if (!reduce) ang += 0.0016;
      draw();
      requestAnimationFrame(tick);
    }

    size();
    draw();

    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (es) {
        es.forEach(function (e) {
          if (e.isIntersecting && !live) { live = true; if (!reduce) tick(); else draw(); }
          else if (!e.isIntersecting) { live = false; }
        });
      }, { threshold: 0.05 }).observe(host);
    } else { live = true; tick(); }

    window.addEventListener('scroll', function () {
      if (!live && !raf) { raf = requestAnimationFrame(draw); }
    }, { passive: true });

    var rt;
    window.addEventListener('resize', function () {
      clearTimeout(rt);
      rt = setTimeout(function () { size(); draw(); }, 180);
    });
  })();

  /* ---------------------------------------------------------
     9. Galerie : inclinaison 3D des cartes selon leur position
     --------------------------------------------------------- */
  (function gallery() {
    var gal = document.getElementById('gal');
    if (!gal || reduce) return;
    var cards = gal.querySelectorAll('.card');
    var raf = 0;

    function paint() {
      raf = 0;
      var mid = gal.getBoundingClientRect().left + gal.clientWidth / 2;
      Array.prototype.forEach.call(cards, function (c) {
        var r = c.getBoundingClientRect();
        var d = (r.left + r.width / 2 - mid) / gal.clientWidth;
        d = clamp(d, -1, 1);
        c.style.transform =
          'rotateY(' + (-d * 13).toFixed(2) + 'deg) ' +
          'translateZ(' + (-Math.abs(d) * 52).toFixed(1) + 'px) ' +
          'scale(' + (1 - Math.abs(d) * 0.045).toFixed(3) + ')';
        c.style.opacity = (1 - Math.abs(d) * 0.35).toFixed(3);
      });
    }
    function req() { if (!raf) raf = requestAnimationFrame(paint); }

    gal.addEventListener('scroll', req, { passive: true });
    window.addEventListener('resize', req);
    window.addEventListener('scroll', req, { passive: true });
    paint();

    // glisser à la souris sur desktop
    var down = false, sx = 0, sl = 0;
    gal.addEventListener('mousedown', function (e) { down = true; sx = e.pageX; sl = gal.scrollLeft; });
    window.addEventListener('mouseup', function () { down = false; });
    window.addEventListener('mousemove', function (e) {
      if (!down) return;
      e.preventDefault();
      gal.scrollLeft = sl - (e.pageX - sx) * 1.25;
    });
  })();

  /* ---------------------------------------------------------
     10. Coordonnées vivantes sous le réticule
     --------------------------------------------------------- */
  if (fine) {
    var alt = document.getElementById('retAlt');
    if (alt) {
      setInterval(function () {
        var la = (27.9881 + (Math.random() - 0.5) * 0.0006).toFixed(4);
        var lo = (86.9250 + (Math.random() - 0.5) * 0.0006).toFixed(4);
        alt.textContent = la + '° N / ' + lo + '° E';
      }, 1600);
    }
  }
})();
