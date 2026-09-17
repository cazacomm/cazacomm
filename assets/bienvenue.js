/* Page de bienvenue : deux moments du double opt-in, une seule page.
   Sans paramètre, c'est la confirmation finale. Avec ?etape=email, l'écran
   intermédiaire qui invite à ouvrir sa boîte mail.
   Le texte par défaut est déjà dans le HTML : sans JavaScript, le visiteur
   voit la confirmation, jamais une page vide. */
(function (w, d) {
  'use strict';

  var etape;
  try {
    etape = new w.URLSearchParams(w.location.search).get('etape');
  } catch (err) {
    return;                       // navigateur sans URLSearchParams : on garde le texte par défaut
  }
  if (etape !== 'email') return;

  var title = d.getElementById('wTitle');
  var text  = d.getElementById('wText');
  if (title) title.innerHTML = 'Plus<br />qu’un clic';
  if (text) {
    text.textContent = 'On vient de vous envoyer un email de confirmation. '
      + 'Ouvrez-le et cliquez sur le lien : votre inscription sera validée. '
      + "Pensez aux indésirables s'il tarde à arriver.";
  }
  d.title = 'Confirmez votre inscription | Caza Comm';
})(window, document);
