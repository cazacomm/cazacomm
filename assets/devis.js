/* Assistant de demande de devis en trois étapes.
   Même envoi que le formulaire de contact (Web3Forms), même comportement de
   succès, et même conversion pixel : elle reste conditionnée au consentement,
   exactement comme dans assets/caza.js. */
(function (w, d) {
  'use strict';

  var form = d.getElementById('devisForm');
  if (!form) return;

  var steps  = Array.prototype.slice.call(form.querySelectorAll('.devis-step'));
  var bar    = d.getElementById('devisBar');
  var count  = d.getElementById('devisStep');
  var status = d.getElementById('devisStatus');
  var done   = d.getElementById('devisDone');
  var fType  = d.getElementById('dvType');
  var fDelai = d.getElementById('dvDelai');   // absent sur certains formulaires
  var current = 1;
  var lastStep = steps.length;                // 2 ou 3 selon le métier

  function go(n) {
    current = n;
    steps.forEach(function (s) {
      var on = Number(s.dataset.step) === n;
      s.hidden = !on;
      s.classList.toggle('is-current', on);
    });
    if (bar) bar.style.width = (n / steps.length * 100) + '%';
    if (count) count.textContent = String(n);
    // On revient en haut de l'assistant, pas en haut de la page
    var top = form.getBoundingClientRect().top + w.scrollY - 90;
    w.scrollTo({ top: top < 0 ? 0 : top, behavior: 'auto' });
  }

  function showError(step, on) {
    var el = form.querySelector('.devis-error[data-for="' + step + '"]');
    if (el) el.hidden = !on;
  }

  /* Choix uniques : cartes de l'étape 1, pastilles de délai de l'étape 2 */
  function singleChoice(selector, target) {
    var group = form.querySelectorAll(selector);
    Array.prototype.forEach.call(group, function (btn) {
      btn.addEventListener('click', function () {
        Array.prototype.forEach.call(group, function (b) {
          b.classList.remove('is-on');
          b.setAttribute('aria-checked', 'false');
        });
        btn.classList.add('is-on');
        btn.setAttribute('aria-checked', 'true');
        if (target) target.value = btn.dataset.value;
        showError(1, false);
      });
    });
  }
  singleChoice('.devis-card', fType);
  singleChoice('.devis-chip', fDelai);

  form.addEventListener('click', function (e) {
    var next = e.target.closest ? e.target.closest('.devis-next') : null;
    var back = e.target.closest ? e.target.closest('.devis-back') : null;
    if (next) {
      if (current === 1 && fType && !fType.value) { showError(1, true); return; }
      go(Number(next.dataset.go));
    } else if (back) {
      go(Number(back.dataset.go));
    }
  });

  /* Conversion, identique au formulaire de contact : consentement d'abord. */
  function trackLead() {
    try {
      if (!w.CazaConsent || !w.CazaConsent.granted()) return;
      if (typeof w.oaiq === 'function') {
        w.oaiq('measure', 'lead_created', { type: 'customer_action' });
      }
    } catch (err) { /* le suivi ne doit jamais casser l'envoi */ }
  }

  /* Remonte la cause réelle d'un échec. Sans cela, une exception levée avant
     l'appel réseau laissait le bouton muet : rien ne partait et rien ne
     s'affichait, ce qui est le pire des cas pour diagnostiquer à distance. */
  function fail(reason, detail) {
    if (w.console && console.error) console.error('[devis] échec :', reason, detail || '');
    var btn = form.querySelector('.devis-submit');
    if (btn) btn.disabled = false;
    if (status) {
      status.className = 'form-status error';
      status.textContent = "Oups, l'envoi a échoué (" + reason + "). "
        + "Réessayez ou écrivez-nous à jeremy@cazacomm.fr.";
    }
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    try { submitForm(); } catch (err) { fail('erreur interne', err && err.message); }
  });

  function submitForm() {
    var required = form.querySelectorAll('.devis-step[data-step="' + lastStep + '"] [required]');
    var missing = Array.prototype.filter.call(required, function (i) {
      return !i.value.trim() || (i.type === 'email' && i.validity && i.validity.typeMismatch);
    });
    if (missing.length) {
      showError(lastStep, true);
      missing[0].focus();
      return;
    }
    showError(lastStep, false);

    var btn = form.querySelector('.devis-submit');
    if (btn) btn.disabled = true;
    if (status) { status.className = 'form-status'; status.textContent = 'Envoi en cours…'; }

    fetch(form.action, {
      method: 'POST',
      body: new FormData(form),
      headers: { Accept: 'application/json' }
    })
      .then(function (res) {
        return res.json().catch(function () { return {}; })
          .then(function (j) { return { ok: res.ok, json: j }; });
      })
      .then(function (r) {
        if (!(r.ok && r.json.success)) {
          // Web3Forms explique lui-même le refus : on le remonte au lieu de le perdre.
          throw new Error(r.json && r.json.message ? r.json.message : 'réponse ' + r.ok);
        }
        trackLead();
        form.hidden = true;
        var prog = d.querySelector('.devis-progress');
        if (prog) prog.hidden = true;
        if (done) done.hidden = false;
        w.scrollTo({ top: 0, behavior: 'auto' });
      })
      .catch(function (err) {
        fail('envoi refusé', err && err.message);
      })
      .then(function () { if (btn) btn.disabled = false; });
  }

  go(1);
})(window, document);
