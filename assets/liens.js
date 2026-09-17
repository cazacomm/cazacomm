/* Page liens : déroulé du panneau newsletter.
   Le panneau est fermé dans le HTML, donc sans script la page reste
   utilisable, il suffit que le bouton l'ouvre. On garde aria-expanded
   à jour pour les lecteurs d'écran. */
(function (w, d) {
  'use strict';

  var toggle = d.getElementById('newsToggle');
  var panel  = d.getElementById('newsPanel');
  if (!toggle || !panel) return;

  toggle.addEventListener('click', function () {
    var open = toggle.getAttribute('aria-expanded') === 'true';
    toggle.setAttribute('aria-expanded', open ? 'false' : 'true');
    panel.hidden = open;

    if (!open) {
      // On amène le champ sous le pouce, sans voler le focus au clavier
      // virtuel : le focus direct ferait sauter la page sur iOS.
      var field = d.getElementById('newsEmail');
      if (field && w.matchMedia && w.matchMedia('(hover: hover)').matches) field.focus();
      if (panel.scrollIntoView) panel.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  });
})(window, document);
