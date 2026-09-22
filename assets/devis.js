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

  /* Preuve qu'un humain manipule le formulaire. isTrusted n'est pas falsifiable
     par un script : un robot qui remplit les champs par programme ne produit
     aucun événement de confiance et laisse donc le piège à bots intact. */
  var human = false;
  function markHuman(e) { if (e && e.isTrusted) human = true; }
  ['pointerdown', 'click', 'keydown', 'touchstart', 'input'].forEach(function (ev) {
    form.addEventListener(ev, markHuman, true);
  });

  /* Passage automatique à l'étape suivante. Choisir une carte ou un délai est
     une réponse complète : réclamer « Continuer » en plus fait croire que le
     choix n'a pas été pris en compte, et c'est là qu'on abandonne. Le court
     délai laisse voir la pastille s'allumer avant que l'écran change, et les
     boutons « Continuer » et « Retour » restent en place pour qui les cherche. */
  var pendingGo = null;
  function autoGo(step) {
    var next = step && step.querySelector('.devis-next');
    if (!next) return;                       // dernière étape : rien après
    w.clearTimeout(pendingGo);
    pendingGo = w.setTimeout(function () { go(Number(next.dataset.go)); }, 320);
  }

  function go(n) {
    // Un passage demandé à la main annule celui qui était en attente, sinon un
    // « Retour » immédiat après un choix serait aussitôt repoussé en avant.
    w.clearTimeout(pendingGo);
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
        autoGo(btn.closest ? btn.closest('.devis-step') : null);
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
    if (!status) return;
    status.className = 'form-status error';
    status.textContent = '';
    // La cause exacte est affichée, pas seulement journalisée : sans elle,
    // impossible de diagnostiquer ce que le visiteur a vu.
    var cause = detail ? reason + ' : ' + detail : reason;
    status.appendChild(d.createTextNode("Oups, l'envoi a échoué (" + cause + "). Réessayez, ou écrivez-nous directement à "));
    var mail = d.createElement('a');
    mail.href = 'mailto:jeremy@cazacomm.fr?subject=' + encodeURIComponent(subjectValue());
    mail.textContent = 'jeremy@cazacomm.fr';
    status.appendChild(mail);
    status.appendChild(d.createTextNode('.'));
  }

  function subjectValue() {
    var f = form.querySelector('input[name="subject"]');
    return f && f.value ? f.value : 'Demande de devis';
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

    /* Piège à bots. Coché, Web3Forms répond « success » mais jette la demande :
       aucune trace dans le tableau de bord, pas même en indésirables, pendant que
       le visiteur voit « merci ». C'est le seul échec réellement silencieux du
       parcours, et un remplissage automatique de navigateur ou une extension
       suffit à cocher la case à l'insu du visiteur.
       Deux cas, aucun silencieux : si un humain a réellement manipulé le
       formulaire, c'est un faux positif et on décoche ; sinon on n'envoie rien,
       puisque la demande serait jetée, et on le dit au lieu de mentir. */
    var trap = form.querySelector('input[name="botcheck"]');
    if (trap && trap.checked) {
      if (human) {
        trap.checked = false;
        if (w.console && console.warn) console.warn('[devis] piège à bots coché à tort, neutralisé');
      } else {
        fail('formulaire marqué comme automatique', 'la demande ne serait pas remise');
        return;
      }
    }

    var btn = form.querySelector('.devis-submit');
    if (btn) btn.disabled = true;
    if (status) { status.className = 'form-status'; status.textContent = 'Envoi en cours…'; }

    // Sans délai maximum, une requête qui ne revient jamais laisse le visiteur
    // sur « Envoi en cours… » pour toujours : un échec silencieux de plus.
    var ctrl = typeof w.AbortController === 'function' ? new w.AbortController() : null;
    var timer = w.setTimeout(function () {
      if (ctrl) ctrl.abort();
    }, 15000);

    fetch(form.action, {
      method: 'POST',
      body: new FormData(form),
      headers: { Accept: 'application/json' },
      signal: ctrl ? ctrl.signal : undefined
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
        if (status) { status.className = 'form-status'; status.textContent = ''; }
        form.hidden = true;
        var prog = d.querySelector('.devis-progress');
        if (prog) prog.hidden = true;
        if (done) done.hidden = false;
        w.scrollTo({ top: 0, behavior: 'auto' });
      })
      .catch(function (err) {
        if (err && err.name === 'AbortError') fail('délai dépassé', 'aucune réponse en 15 secondes');
        else fail('envoi refusé', err && err.message);
      })
      .then(function () {
        w.clearTimeout(timer);
        if (btn) btn.disabled = false;
      });
  }

  go(1);
})(window, document);
