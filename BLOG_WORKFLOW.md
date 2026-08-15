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
  Tarbes, Pau et Hautes-Pyrénées
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
- Ancrage local explicite : Tarbes, Pau, Hautes-Pyrénées, Lourdes, Bigorre —
  dans le titre, le premier paragraphe, au moins deux H2 et la FAQ.
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

## 5. Douze sujets prêts à écrire

Tous ancrés local + métier, aucun ne nécessite de donnée inventée.

| # | Sujet | Slug proposé | Angle |
|---|---|---|---|
| 1 | ✅ *Publié* — SEO local à Tarbes : être trouvé sur Google et cité par les IA | `seo-local-tarbes-hautes-pyrenees` | Fiche Google, NAP, GEO |
| 2 | Google Ads pour les artisans des Hautes-Pyrénées : par où commencer | `google-ads-artisans-hautes-pyrenees` | Structure de compte, zone géographique, mots-clés locaux |
| 3 | Créer un site internet pour un commerce de Tarbes : ce qui compte vraiment | `site-internet-commerce-tarbes` | Vitesse, mobile, page contact, horaires |
| 4 | Agents IA pour les TPE : trois usages concrets qui font gagner des heures | `agents-ia-tpe-usages-concrets` | Tri des mails, devis, relances |
| 5 | Répondre aux avis Google : la méthode qui protège votre réputation | `repondre-avis-google-methode` | Ton, délai, avis négatifs |
| 6 | WordPress ou site sur mesure : comment choisir quand on est une TPE | `wordpress-ou-site-sur-mesure` | Coût de maintenance, autonomie, performance |
| 7 | Meta Ads pour un commerce local : cibler sans gaspiller son budget | `meta-ads-commerce-local` | Rayon géographique, créatives, saisonnalité |
| 8 | GEO : comment être cité par ChatGPT et Perplexity quand on est une PME | `geo-etre-cite-par-les-ia` | Contenu citable, robots.txt, données structurées |
| 9 | Automatiser le suivi des devis avec un CRM simple | `automatiser-suivi-devis-crm` | Relances, statuts, gain de temps |
| 10 | Le tourisme dans les Hautes-Pyrénées : préparer sa visibilité avant la saison | `visibilite-tourisme-hautes-pyrenees` | Saisonnalité, multilingue, réservation |
| 11 | Pourquoi votre site ne convertit pas (et ce qui se corrige en une journée) | `pourquoi-votre-site-ne-convertit-pas` | Appel à l'action, formulaire, preuve sociale |
| 12 | RGPD et IA : ce qu'une petite entreprise doit vraiment mettre en place | `rgpd-et-ia-petite-entreprise` | Données personnelles, hébergement, transparence |

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
