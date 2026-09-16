/* ════════════════════════════════════════════════════════════════
   CAZA COMM — CONSENTEMENT AUX TRACEURS PUBLICITAIRES
   ════════════════════════════════════════════════════════════════

   Le pixel OpenAI Ads n'est PAS chargé puis bridé : il n'est chargé
   qu'à partir d'ici, et uniquement si le visiteur a accepté. Tant
   qu'il n'a pas répondu, aucune requête ne part vers OpenAI — c'est
   ce que demande la CNIL pour un traceur publicitaire.

   Ce fichier est autonome : il injecte ses propres styles et son
   propre balisage. Il n'a besoin ni de caza-v2.css ni d'une librairie
   externe, et fonctionnera à l'identique après la migration sur VPS.
   Il reprend les variables de thème du site quand elles existent, avec
   des valeurs de repli sinon — la page de redirection sites-vitrine.html
   ne charge aucune feuille de style, par exemple.

   API publique : window.CazaConsent
     .granted()  → true si la mesure publicitaire est autorisée
     .decided()  → true si le visiteur a déjà répondu
     .accept() / .decline()
     .open()     → rouvre le bandeau (« Gérer mes cookies »)
   Événement : window addEventListener('caza:consent', e => e.detail.ads)
   ════════════════════════════════════════════════════════════════ */

(function (w, d) {
  'use strict';

  var STORE_KEY = 'caza-consent';
  var SCHEMA    = 1;
  var MAX_DAYS  = 182;                 // ~6 mois, puis on redemande
  var PIXEL_ID  = 'HNV6mAW5pk8REeZ6jjY6kC';
  var SDK_URL   = 'https://bzrcdn.openai.com/sdk/oaiq.min.js';
  var PRIVACY   = '/confidentialite.html';

  /* ── Mémoire du choix ──────────────────────────────────────────
     En navigation privée, localStorage peut lever : le choix ne vaut
     alors que pour la session, ce qui est le repli sûr (on redemande
     plutôt que de supposer un accord). */
  var session = null;                  // repli si localStorage indisponible

  function read() {
    if (session !== null) return session;
    try {
      var raw = w.localStorage.getItem(STORE_KEY);
      if (!raw) return null;
      var v = JSON.parse(raw);
      if (!v || typeof v.ads !== 'boolean' || !v.at || v.v !== SCHEMA) return null;
      if (Date.now() - v.at > MAX_DAYS * 864e5) return null;   // consentement périmé
      return v;
    } catch (e) { return null; }
  }

  function write(ads) {
    session = { ads: ads, at: Date.now(), v: SCHEMA };
    try { w.localStorage.setItem(STORE_KEY, JSON.stringify(session)); } catch (e) {}
  }

  /* ── Le pixel, chargé seulement sur accord ─────────────────── */
  var pixelStarted = false;

  function loadPixel() {
    if (pixelStarted || w.oaiq) return;
    pixelStarted = true;
    (function (w, d, s, u) {
      if (w.oaiq) return;
      var q = function () { q.q.push(arguments); };
      q.q = []; w.oaiq = q;
      var j = d.createElement(s); j.async = 1; j.src = u;
      var f = d.getElementsByTagName(s)[0];
      f.parentNode.insertBefore(j, f);
    })(w, d, 'script', SDK_URL);
    w.oaiq('init', { pixelId: PIXEL_ID, debug: true });
  }

  /* ── Retrait du consentement ───────────────────────────────────
     Le SDK déjà chargé ne peut pas être « déchargé » proprement : on
     efface ce qu'il a pu déposer, puis on recharge la page pour repartir
     d'un contexte sans lui. */
  function purge() {
    try {
      [w.localStorage, w.sessionStorage].forEach(function (store) {
        Object.keys(store).forEach(function (k) {
          if (/oai/i.test(k)) store.removeItem(k);
        });
      });
    } catch (e) {}
    try {
      var host = w.location.hostname;
      d.cookie.split(';').forEach(function (c) {
        var name = c.split('=')[0].trim();
        if (!/oai/i.test(name)) return;
        ['/', ''].forEach(function (path) {
          [host, '.' + host, ''].forEach(function (dom) {
            d.cookie = name + '=; Max-Age=0'
                     + (path ? '; path=' + path : '')
                     + (dom ? '; domain=' + dom : '');
          });
        });
      });
    } catch (e) {}
  }

  function set(ads) {
    var before = read();
    var wasGranted = !!(before && before.ads);
    write(ads);
    hide();
    try {
      w.dispatchEvent(new CustomEvent('caza:consent', { detail: { ads: ads } }));
    } catch (e) {}

    if (ads) {
      loadPixel();                     // accord : effet immédiat, sans rechargement
    } else if (wasGranted) {
      purge();                         // retrait après accord : on nettoie et on repart propre
      w.location.reload();
    }
  }

  /* ── Habillage ─────────────────────────────────────────────────
     Les deux boutons sont strictement identiques : même taille, même
     bordure, même fond, même typographie. Un « Accepter » mis en avant
     par rapport au « Refuser » serait précisément le procédé que la
     CNIL considère comme un choix non libre. */
  var STYLE = [
    '.cc-banner{position:fixed;left:0;right:0;bottom:0;z-index:2000;',
    'background:var(--bg-solid,#000);color:var(--txt,#fff);',
    'border-top:1px solid var(--line,rgba(255,255,255,.14));',
    'font-family:var(--body,"Inter",system-ui,sans-serif);',
    'padding:14px clamp(16px,4vw,48px);',
    'transform:translateY(100%);transition:transform .45s cubic-bezier(.22,1,.36,1);}',
    '.cc-banner.is-open{transform:none;}',
    '.cc-inner{max-width:1180px;margin:0 auto;display:flex;flex-wrap:wrap;',
    'align-items:center;justify-content:space-between;gap:14px 26px;}',
    '.cc-text{flex:1 1 420px;min-width:0;}',
    '.cc-title{font-family:var(--mono,ui-monospace,monospace);font-size:10px;',
    'letter-spacing:.2em;text-transform:uppercase;color:var(--green-light,#6fcf97);',
    'margin:0 0 5px;}',
    '.cc-desc{margin:0;font-size:.85rem;line-height:1.5;color:var(--dim,rgba(255,255,255,.62));}',
    '.cc-desc a{color:inherit;text-decoration:underline;text-underline-offset:3px;}',
    '.cc-desc a:hover{color:var(--green-light,#6fcf97);}',
    '.cc-actions{display:flex;gap:10px;flex:0 0 auto;}',
    '.cc-btn{font-family:var(--mono,ui-monospace,monospace);font-size:10.5px;',
    'letter-spacing:.14em;text-transform:uppercase;padding:11px 20px;min-width:118px;',
    'border:1px solid var(--stroke,rgba(255,255,255,.28));border-radius:0;',
    'background:transparent;color:inherit;cursor:pointer;line-height:1;',
    'transition:background .25s,color .25s,border-color .25s;}',
    '.cc-btn:hover,.cc-btn:focus-visible{background:var(--green-light,#6fcf97);',
    'color:var(--on-accent,#000);border-color:var(--green-light,#6fcf97);}',
    '.cc-manage{font:inherit;letter-spacing:inherit;text-transform:inherit;color:inherit;',
    'background:none;border:0;padding:0;cursor:pointer;}',
    '.cc-manage:hover{color:var(--green-light,#6fcf97);}',
    '@media (max-width:640px){',
    '.cc-inner{flex-direction:column;align-items:stretch;gap:12px;}',
    '.cc-actions{display:grid;grid-template-columns:1fr 1fr;}',
    '.cc-btn{min-width:0;width:100%;}}',
    '@media (prefers-reduced-motion:reduce){.cc-banner{transition:none;}}'
  ].join('');

  var banner = null;

  function build() {
    if (banner) return banner;

    var style = d.createElement('style');
    style.id = 'cc-style';
    style.textContent = STYLE;
    d.head.appendChild(style);

    banner = d.createElement('div');
    banner.className = 'cc-banner';
    banner.setAttribute('role', 'dialog');
    banner.setAttribute('aria-label', 'Consentement aux traceurs publicitaires');
    banner.innerHTML =
      '<div class="cc-inner">' +
        '<div class="cc-text">' +
          '<p class="cc-title">Cookies</p>' +
          '<p class="cc-desc">Nous utilisons un traceur publicitaire OpenAI Ads, qui sert ' +
          'uniquement à mesurer les demandes issues de nos publicités. Il n’est déposé ' +
          'qu’avec votre accord, et le site fonctionne normalement si vous refusez. ' +
          '<a href="' + PRIVACY + '">En savoir plus</a></p>' +
        '</div>' +
        '<div class="cc-actions">' +
          '<button type="button" class="cc-btn" data-cc="decline">Refuser</button>' +
          '<button type="button" class="cc-btn" data-cc="accept">Accepter</button>' +
        '</div>' +
      '</div>';

    banner.addEventListener('click', function (e) {
      var btn = e.target.closest ? e.target.closest('[data-cc]') : null;
      if (!btn) return;
      set(btn.getAttribute('data-cc') === 'accept');
    });

    d.body.appendChild(banner);
    return banner;
  }

  function show() {
    build();
    requestAnimationFrame(function () { banner.classList.add('is-open'); });
  }

  function hide() {
    if (banner) banner.classList.remove('is-open');
  }

  /* ── Point d'entrée « Gérer mes cookies » ──────────────────────
     Injecté dans le pied de page plutôt qu'écrit dans les 13 fichiers :
     les nouveaux articles de blog l'auront donc aussi, sans rien faire.
     Un gestionnaire de consentement n'existe de toute façon pas sans
     JavaScript, sa porte d'entrée peut donc l'être aussi. */
  function injectManageLink() {
    var targets = d.querySelectorAll('.site-footer nav, .site-footer');
    var placed = false;
    Array.prototype.forEach.call(targets, function (host) {
      if (placed && !host.matches('nav')) return;
      if (host.querySelector('.cc-manage')) return;
      if (!host.matches('nav') && d.querySelector('.site-footer nav')) return;
      var b = d.createElement('button');
      b.type = 'button';
      b.className = 'cc-manage';
      b.textContent = 'Gérer mes cookies';
      b.addEventListener('click', function () { show(); });
      host.appendChild(b);
      placed = true;
    });
  }

  /* ── API ──────────────────────────────────────────────────────── */
  w.CazaConsent = {
    granted: function () { var c = read(); return !!(c && c.ads); },
    decided: function () { return read() !== null; },
    accept:  function () { set(true); },
    decline: function () { set(false); },
    open:    function () { show(); }
  };

  /* ── Démarrage ────────────────────────────────────────────────── */
  var choice = read();
  if (choice && choice.ads) loadPixel();     // accord déjà donné : on charge tout de suite

  function ready() {
    injectManageLink();
    if (!choice) show();                     // pas encore répondu : on demande
  }

  if (d.readyState === 'loading') d.addEventListener('DOMContentLoaded', ready);
  else ready();

})(window, document);
