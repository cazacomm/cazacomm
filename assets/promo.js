/* ════════════════════════════════════════════════════════════════
   CAZA COMM — MODALE PROMOTIONNELLE « PUBLICITÉ CHATGPT »
   Chargée uniquement par pub.html.

   Purement visuelle : elle ne dépose rien, ne mesure rien et ne
   dépend pas du consentement publicitaire. Le seul élément conservé
   est un indicateur local disant qu'elle a déjà été vue, pour ne pas
   la remontrer. Elle est donc hors du champ du bandeau cookies.

   Autonome : styles et balisage injectés ici, aucune dépendance à
   caza-v2.css, donc aucun effet possible sur les autres pages.
   ════════════════════════════════════════════════════════════════ */

(function (w, d) {
  'use strict';

  var KEY   = 'caza-promo-chatgpt';
  var DELAY = 2500;                    // laisse la page s'installer avant de parler
  var RED   = '#d7263d';               // accent fort, volontairement hors charte

  /* Déjà vue ? On ne repasse pas. En navigation privée l'écriture peut
     échouer : la modale se reverra à la visite suivante, ce qui est le
     comportement le moins gênant. */
  try { if (w.localStorage.getItem(KEY)) return; } catch (e) {}

  var REDUCED = w.matchMedia && w.matchMedia('(prefers-reduced-motion: reduce)').matches;

  var STYLE = [
    '.promo-veil{position:fixed;inset:0;z-index:3000;display:grid;place-items:center;',
    'padding:20px;background:rgba(3,6,15,.72);opacity:0;visibility:hidden;',
    'transition:opacity .3s ease,visibility .3s;}',
    '.promo-veil.is-open{opacity:1;visibility:visible;}',
    '.promo-box{position:relative;width:100%;max-width:440px;',
    'background:#ffffff;color:#08090a;border-top:4px solid ' + RED + ';',
    'padding:30px 26px 26px;text-align:left;',
    'font-family:"Inter",system-ui,sans-serif;',
    'transform:translateY(16px) scale(.98);transition:transform .35s cubic-bezier(.22,1,.36,1);',
    'max-height:86vh;overflow:auto;}',
    '.promo-veil.is-open .promo-box{transform:none;}',
    '.promo-tag{display:inline-block;font-family:"JetBrains Mono",ui-monospace,monospace;',
    'font-size:9.5px;letter-spacing:.2em;text-transform:uppercase;',
    'background:' + RED + ';color:#fff;padding:5px 10px;margin-bottom:14px;}',
    '.promo-box h2{font-family:"Archivo","Arial Narrow",sans-serif;font-weight:600;',
    'text-transform:uppercase;font-size:clamp(1.35rem,5vw,1.75rem);line-height:1.02;',
    'letter-spacing:-.02em;margin:0 0 12px;}',
    '.promo-box h2 b{color:' + RED + ';font-weight:600;}',
    '.promo-box p{margin:0 0 10px;font-size:.92rem;line-height:1.5;color:#3a3d42;}',
    '.promo-box p:last-of-type{margin-bottom:20px;}',
    '.promo-go{display:inline-flex;align-items:center;gap:9px;',
    'font-family:"JetBrains Mono",ui-monospace,monospace;font-size:11px;font-weight:600;',
    'letter-spacing:.12em;text-transform:uppercase;padding:14px 22px;',
    'background:' + RED + ';color:#fff;text-decoration:none;border:0;cursor:pointer;',
    'transition:background .25s ease;}',
    '.promo-go:hover{background:#08090a;}',
    '.promo-go svg{width:14px;height:14px;}',
    /* Croix : grande zone de frappe, contrastée, impossible à manquer */
    '.promo-x{position:absolute;top:8px;right:8px;width:40px;height:40px;',
    'display:grid;place-items:center;background:transparent;border:0;cursor:pointer;',
    'color:#08090a;border-radius:50%;transition:background .2s ease,color .2s ease;}',
    '.promo-x:hover,.promo-x:focus-visible{background:' + RED + ';color:#fff;}',
    '.promo-x svg{width:19px;height:19px;}',
    '@media (max-width:480px){.promo-box{padding:26px 20px 22px;}',
    '.promo-go{width:100%;justify-content:center;}}',
    '@media (prefers-reduced-motion:reduce){',
    '.promo-veil,.promo-box{transition:none;}}'
  ].join('');

  var veil = null;
  var lastFocus = null;

  function close() {
    if (!veil) return;
    veil.classList.remove('is-open');
    try { w.localStorage.setItem(KEY, String(Date.now())); } catch (e) {}
    d.removeEventListener('keydown', onKey);
    setTimeout(function () {
      if (veil && veil.parentNode) veil.parentNode.removeChild(veil);
      veil = null;
    }, REDUCED ? 0 : 320);
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }

  function onKey(e) {
    if (e.key === 'Escape' || e.key === 'Esc') close();
  }

  function build() {
    var style = d.createElement('style');
    style.textContent = STYLE;
    d.head.appendChild(style);

    veil = d.createElement('div');
    veil.className = 'promo-veil';
    veil.setAttribute('role', 'dialog');
    veil.setAttribute('aria-modal', 'false');
    veil.setAttribute('aria-labelledby', 'promoTitle');
    veil.innerHTML =
      '<div class="promo-box">' +
        '<button type="button" class="promo-x" aria-label="Fermer">' +
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>' +
        '</button>' +
        '<span class="promo-tag">Nouveau</span>' +
        '<h2 id="promoTitle">Publicité sur <b>ChatGPT</b></h2>' +
        '<p>Nous faisons partie des premières agences en France à proposer la publicité sur ChatGPT.</p>' +
        '<p>On crée votre campagne, on la gère, et on vous fait des retours.</p>' +
        '<a class="promo-go" href="/devis.html">' +
          '<span>Demander un devis gratuit</span>' +
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14M12 5l7 7-7 7"/></svg>' +
        '</a>' +
      '</div>';

    // Croix, clic hors de la boîte, et Échap
    veil.querySelector('.promo-x').addEventListener('click', close);
    veil.addEventListener('click', function (e) { if (e.target === veil) close(); });
    d.addEventListener('keydown', onKey);
    // Le lien devis referme avant de naviguer, pour ne pas la revoir au retour
    veil.querySelector('.promo-go').addEventListener('click', function () {
      try { w.localStorage.setItem(KEY, String(Date.now())); } catch (e) {}
    });

    d.body.appendChild(veil);
    lastFocus = d.activeElement;
    requestAnimationFrame(function () {
      veil.classList.add('is-open');
      var go = veil.querySelector('.promo-go');
      if (go) go.focus();
    });
  }

  function start() { setTimeout(build, DELAY); }

  if (d.readyState === 'loading') d.addEventListener('DOMContentLoaded', start);
  else start();

})(window, document);
