# BLOG_WORKFLOW — Caza Comm

Comment publier un nouvel article sur `www.cazacomm.fr/blog/`.
Site statique, GitHub Pages, aucune dépendance, aucun build.

---

## 0. Règles fixes

- **Domaine canonique** : `https://www.cazacomm.fr/` (avec `www`, conforme au `CNAME`).
  Toutes les URL absolues du site doivent utiliser cette forme.
- **Jamais inventer** : prix, chiffres, pourcentages, noms de clients,
  réglementations, dates. Si une donnée n'est pas vérifiable, on écrit
  la phrase sans elle.
- **NAP identique partout** — dans les articles, le JSON-LD, `llms.txt`,
  les mentions légales et les annuaires :

  ```
  Caza Comm
  jeremy@cazacomm.fr
  +33 7 67 19 74 67
  France et francophonie
  https://www.cazacomm.fr/
  ```

---

## 1. Créer l'article

```
blog/<slug>/index.html
```

Le slug est en minuscules, sans accent, mots séparés par des tirets, et il
contient le mot-clé principal + le repère géographique quand c'est pertinent.
Exemple : `seo-local-tarbes-hautes-pyrenees`.

Le plus simple : **copier `blog/seo-local-tarbes-hautes-pyrenees/index.html`**
et remplacer le contenu. La structure est déjà complète.

### Ce qu'il faut changer, dans l'ordre

| Emplacement | À modifier |
|---|---|
| `<title>` | Titre de l'article + ` \| Caza Comm` (≤ 60 caractères si possible) |
| `<meta name="description">` | **< 155 caractères**, une phrase, contient la ville |
| `<link rel="canonical">` | `https://www.cazacomm.fr/blog/<slug>/` |
| Balises `og:*` | titre, description, `og:url`, dates |
| Balises `twitter:*` | titre, description |
| JSON-LD `Article` | `headline`, `description`, `datePublished`, `dateModified`, `url`, `mainEntityOfPage`, `articleSection` |
| JSON-LD `BreadcrumbList` | 3ᵉ élément : nom court + URL |
| JSON-LD `FAQPage` | les 5 questions/réponses, **texte identique** à celui affiché |
| Fil d'Ariane HTML | le dernier `<span aria-current="page">` |
| `<h1 class="blog-title">` | le titre, avec un `<span class="accent">` sur la fin |
| `.blog-lede` | 2 à 3 phrases d'accroche |
| `.blog-meta` | date (`<time datetime="AAAA-MM-JJ">`), rubrique, durée de lecture |
| `.blog-body` | le corps de l'article |
| `.blog-faq` | les 5 questions |

> ⚠️ Le texte des réponses de la FAQ **doit être identique** entre le HTML
> visible et le JSON-LD `FAQPage`. Un décalage fait rejeter le balisage.

### Gabarit de contenu

- **1200 à 1500 mots.**
- **H2** pour les grandes sections (4 à 6), **H3** pour les sous-parties.
- Une section « Questions fréquentes » en H2, avec **5 questions en H3**.
- Portée nationale et francophone : aucun nom de ville ni de département dans
  le titre, le texte ou la FAQ. On parle métiers et situations, pas territoires.
- Un encart `.blog-callout` « À retenir » avant la FAQ.
- Le bloc `.blog-cta` et le bloc `.blog-nap` restent tels quels.
- Ton : concret, direct, sans jargon, sans superlatif. Pas de promesse chiffrée.

---

## 2. Référencer l'article dans les 4 fichiers de diffusion

À faire **à chaque publication**, sans exception.

### `blog/index.html`
Ajouter une carte **en haut** de `.blog-list` :

```html
<a class="blog-card" href="/blog/<slug>/">
  <div class="blog-card-meta">
    <span><time datetime="AAAA-MM-JJ">JJ mois AAAA</time></span>
    <span>Rubrique</span>
    <span>Lecture X min</span>
  </div>
  <h2 class="blog-card-title">Titre de l'article</h2>
  <p class="blog-card-lede">Résumé en une à deux phrases.</p>
</a>
```

Ajouter aussi une entrée dans le tableau `blogPost` du JSON-LD `Blog`.

### `sitemap.xml`
```xml
<url><loc>https://www.cazacomm.fr/blog/<slug>/</loc><lastmod>AAAA-MM-JJ</lastmod><changefreq>monthly</changefreq><priority>0.7</priority></url>
```
Et mettre à jour le `<lastmod>` de `/blog/`.

### `rss.xml`
Ajouter un `<item>` **en haut** de la liste, mettre à jour `<lastBuildDate>`.
Le format de date RSS est `Sat, 15 Aug 2026 09:00:00 +0200` (RFC 822, en anglais).

### `llms.txt`
Ajouter une ligne sous `## Blog` :
```
- [Titre](https://www.cazacomm.fr/blog/<slug>/) — résumé en une phrase. Publié le JJ mois AAAA.
```

---

## 3. Vérifier avant de pousser

```bash
# XML bien formé
python3 -c "import xml.dom.minidom as m; m.parse('sitemap.xml'); m.parse('rss.xml'); print('xml ok')"

# JSON-LD valide dans les pages du blog
python3 - <<'EOF'
import json, re, glob
for f in glob.glob('blog/**/index.html', recursive=True):
    for b in re.findall(r'<script type="application/ld\+json">(.*?)</script>', open(f, encoding='utf-8').read(), re.S):
        json.loads(b)
    print('json-ld ok:', f)
EOF

# Longueur des meta description (< 155)
python3 - <<'EOF'
import re, glob
for f in glob.glob('**/*.html', recursive=True):
    for d in re.findall(r'<meta name="description" content="([^"]*)"', open(f, encoding='utf-8').read()):
        print(len(d), '·', f)
EOF
```

Puis vérifier à l'œil :
- l'article s'affiche correctement en mobile,
- le lien **BLOG** est présent dans le pied de page de toutes les pages,
- aucun chiffre inventé n'a survécu à la relecture.

Après mise en ligne : demander l'indexation dans la Search Console et
soumettre le sitemap.

---

## 4. Rythme conseillé

Un article toutes les deux à trois semaines vaut mieux que cinq d'un coup
puis six mois de silence. La régularité est le signal, pas le volume.

---

## 5. Sujets prêts à écrire

La liste se complète toute seule : sous huit sujets non traités, le script
en génère quarante de plus et les ajoute à la fin de ce tableau, en gardant
la numérotation continue. Un sujet est « non traité » tant qu'aucun article
ne porte son numéro et qu'aucun dossier ne porte son slug.

| # | Sujet | Slug proposé | Angle |
|---|---|---|---|
| 1 | ✅ *Publié* — SEO local : être trouvé sur Google et cité par les IA | `seo-local-tarbes-hautes-pyrenees` | Fiche Google, NAP, GEO |
| 2 | Google Ads pour les artisans des Hautes-Pyrénées : par où commencer | `google-ads-artisans-hautes-pyrenees` | Structure de compte, zone géographique, mots-clés locaux |
| 3 | Créer un site internet pour un commerce : ce qui compte vraiment | `site-internet-commerce-tarbes` | Vitesse, mobile, page contact, horaires |
| 4 | Agents IA pour les TPE : trois usages concrets qui font gagner des heures | `agents-ia-tpe-usages-concrets` | Tri des mails, devis, relances |
| 5 | Répondre aux avis Google : la méthode qui protège votre réputation | `repondre-avis-google-methode` | Ton, délai, avis négatifs |
| 6 | WordPress ou site sur mesure : comment choisir quand on est une TPE | `wordpress-ou-site-sur-mesure` | Coût de maintenance, autonomie, performance |
| 7 | Meta Ads pour un commerce local : cibler sans gaspiller son budget | `meta-ads-commerce-local` | Rayon géographique, créatives, saisonnalité |
| 8 | GEO : comment être cité par ChatGPT et Perplexity quand on est une PME | `geo-etre-cite-par-les-ia` | Contenu citable, robots.txt, données structurées |
| 9 | Automatiser le suivi des devis avec un CRM simple | `automatiser-suivi-devis-crm` | Relances, statuts, gain de temps |
| 10 | Le tourisme dans les Hautes-Pyrénées : préparer sa visibilité avant la saison | `visibilite-tourisme-hautes-pyrenees` | Saisonnalité, multilingue, réservation |
| 11 | Pourquoi votre site ne convertit pas (et ce qui se corrige en une journée) | `pourquoi-votre-site-ne-convertit-pas` | Appel à l'action, formulaire, preuve sociale |
| 12 | RGPD et IA : ce qu'une petite entreprise doit vraiment mettre en place | `rgpd-et-ia-petite-entreprise` | Données personnelles, hébergement, transparence |
| 13 | Optimiser WordPress pour le référencement naturel | `optimiser-wordpress-referencement-naturel` | Techniques SEO pratiques pour améliorer votre site WordPress |
| 14 | Automatiser vos campagnes email grâce à un CRM | `automatiser-campagnes-email-grace-crm` | Utiliser un CRM pour planifier et envoyer des emails efficacement |
| 15 | Créer une page Google My Business performante | `creer-page-google-my-business-performante` | Étapes pour améliorer votre présence locale en ligne |
| 16 | Choisir le bon thème WordPress pour votre activité | `choisir-bon-theme-wordpress-activite` | Critères de sélection selon votre secteur et vos besoins |
| 17 | Comment améliorer la vitesse de chargement de votre site | `comment-ameliorer-vitesse-chargement-site` | Astuces pour rendre votre site plus rapide et performant |
| 18 | Intégrer l'IA dans votre stratégie marketing | `integrer-ia-strategie-marketing` | Utiliser l'IA pour personnaliser et améliorer vos campagnes |
| 19 | Rédiger des textes efficaces pour le SEO local | `rediger-textes-efficaces-seo-local` | Techniques de rédaction pour améliorer votre visibilité locale |
| 20 | Analyser vos campagnes Google Ads avec Google Analytics | `analyser-campagnes-google-ads-google-analytics` | Suivre et optimiser vos campagnes grâce à des indicateurs clés |
| 21 | Concevoir une landing page qui convertit | `concevoir-landing-page-convertit` | Éléments essentiels pour transformer les visiteurs en clients |
| 22 | Gérer les réseaux sociaux de votre entreprise efficacement | `gerer-reseaux-sociaux-entreprise-efficacement` | Stratégies pour maximiser l'impact de vos publications |
| 23 | Optimiser votre site pour les recherches vocales | `optimiser-site-recherches-vocales` | Adapter votre contenu pour répondre aux requêtes vocales |
| 24 | Utiliser les chatbots pour améliorer le service client | `utiliser-chatbots-ameliorer-service-client` | Mise en place de chatbots pour répondre aux besoins clients |
| 25 | Créer un blog qui attire et engage vos clients | `creer-blog-attire-engage-clients` | Stratégies de contenu pour fidéliser et attirer vos lecteurs |
| 26 | Utiliser les données pour personnaliser votre marketing | `utiliser-donnees-personnaliser-marketing` | Exploiter les données client pour adapter vos offres marketing |
| 27 | Comment sécuriser votre site WordPress | `comment-securiser-site-wordpress` | Mesures à mettre en place pour protéger votre site et vos données |
| 28 | Stratégies pour booster votre présence sur LinkedIn | `strategies-booster-presence-linkedin` | Conseils pour améliorer votre visibilité professionnelle |
| 29 | Les meilleures pratiques pour le SEO on-page | `meilleures-pratiques-seo-page` | Optimisations concrètes à appliquer sur vos pages web |
| 30 | Créer un plan de contenu pour le SEO | `creer-plan-contenu-seo` | Étapes pour élaborer un calendrier éditorial efficace |
| 31 | Augmenter la portée de vos Meta Ads | `augmenter-portee-meta-ads` | Techniques pour gagner en visibilité avec Meta Ads |
| 32 | Utiliser les stories pour promouvoir votre entreprise | `utiliser-stories-promouvoir-entreprise` | Comment utiliser les stories sur les réseaux sociaux pour engager |
| 33 | La personnalisation des emails pour améliorer l'engagement | `personnalisation-emails-ameliorer-engagement` | Techniques pour personnaliser et rendre vos emails plus pertinents |
| 34 | Améliorer l'expérience utilisateur sur votre site web | `ameliorer-experience-utilisateur-site-web` | Astuces pour rendre la navigation agréable et intuitive |
| 35 | Utiliser les webinaires pour attirer de nouveaux clients | `utiliser-webinaires-attirer-nouveaux-clients` | Organisation et promotion de webinaires pour développer votre audience |
| 36 | Comment utiliser les avis clients pour booster vos ventes | `comment-utiliser-avis-clients-booster-ventes` | Stratégies pour collecter, gérer et tirer parti des avis clients |
| 37 | Adapter votre stratégie SEO aux changements d'algorithme | `adapter-strategie-seo-changements-algorithme` | Réagir efficacement aux mises à jour des moteurs de recherche |
| 38 | Mettre en place une stratégie de backlinks efficace | `mettre-place-strategie-backlinks-efficace` | Comment obtenir des liens de qualité pour améliorer votre SEO |
| 39 | Utiliser le marketing vidéo pour renforcer votre marque | `utiliser-marketing-video-renforcer-marque` | Créer et diffuser des vidéos pour améliorer votre notoriété |
| 40 | Réussir sa transition vers le commerce en ligne | `reussir-transition-vers-commerce-ligne` | Étapes clés pour les PME et TPE passant au e-commerce |
| 41 | Construire une identité visuelle forte pour votre site | `construire-identite-visuelle-forte-site` | Éléments graphiques essentiels pour un site attrayant |
| 42 | Comment choisir les bons mots-clés pour votre SEO | `comment-choisir-bons-mots-cles-seo` | Méthodes pour identifier les mots-clés pertinents et efficaces |
| 43 | Le rôle des réseaux sociaux dans le SEO | `role-reseaux-sociaux-seo` | Influence des réseaux sociaux sur votre positionnement en ligne |
| 44 | Organiser une veille concurrentielle pour rester compétitif | `organiser-veille-concurrentielle-rester-competitif` | Techniques pour surveiller et analyser la concurrence |
| 45 | Créer des publicités Google Ads qui captent l'attention | `creer-publicites-google-ads-captent-attention` | Concevoir des annonces efficaces pour maximiser les clics |
| 46 | Optimiser l'utilisation des hashtags sur Instagram | `optimiser-utilisation-hashtags-instagram` | Stratégie pour choisir et utiliser les hashtags efficacement |
| 47 | Utiliser les données de votre CRM pour mieux cibler | `utiliser-donnees-crm-mieux-cibler` | Exploiter les informations client pour affiner votre marketing |
| 48 | Optimiser votre site pour les mobiles | `optimiser-site-mobiles` | Conseils pour rendre votre site user-friendly sur smartphones |
| 49 | Comment relancer une campagne publicitaire inefficace | `comment-relancer-campagne-publicitaire-inefficace` | Stratégies pour analyser et redresser une campagne qui ne performe pas |
| 50 | Créer des formulaires de contact qui convertissent | `creer-formulaires-contact-convertissent` | Concevoir des formulaires attrayants et efficaces pour générer des leads |
| 51 | Utiliser les infographies pour renforcer votre stratégie de contenu | `utiliser-infographies-renforcer-strategie-contenu` | Créer des visuels informatifs pour capter l'attention et informer |
| 52 | Mettre à jour votre site pour améliorer la sécurité | `mettre-jour-site-ameliorer-securite` | Pratiques essentielles pour maintenir la sécurité de votre site web |

> Sur les sujets 5, 9 et 12, rester **descriptif** : décrire les principes et
> les démarches, jamais citer d'article de loi, de sanction chiffrée ou de
> délai réglementaire sans l'avoir vérifié à la source.

---

## 6. Fichiers concernés par le blog

```
blog/index.html                                 liste des articles
blog/<slug>/index.html                          un article
assets/blog.css                                 styles du blog (additif à caza-v2.css)
sitemap.xml                                     plan du site
robots.txt                                      accès des robots, y compris IA
rss.xml                                         flux d'abonnement
llms.txt                                        fiche d'identité pour les IA
BLOG_WORKFLOW.md                                ce document
```

`assets/blog.css` est un **additif** : toutes ses règles sont préfixées
`.blog-page` ou `.blog-*` et n'affectent aucune page existante du site.
Les pages du blog ne chargent pas `caza.js` / `caza-v2.js` — donc pas de
préchargeur, pas d'animations au défilement, pas de bascule FR/EN.
Ne pas utiliser les classes `.fade`, `.rise` ou `.scene` dans un article :
elles resteraient invisibles sans le JavaScript.
