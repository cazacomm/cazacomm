# Automatisation du blog — Caza Comm

Un article de blog est généré et publié automatiquement **chaque lundi à 9h00 UTC**
par le workflow [`.github/workflows/blog-auto.yml`](../.github/workflows/blog-auto.yml).

## 1. Mettre la clé API en place (à faire une seule fois)

1. Créer une clé sur <https://platform.openai.com/api-keys>.
2. Dans le dépôt GitHub : **Settings → Secrets and variables → Actions → New repository secret**.
3. Nom : `OPENAI_API_KEY` — Valeur : la clé (`sk-…`).

En ligne de commande :

```bash
gh secret set OPENAI_API_KEY -R cazacomm/cazacomm
```

Sans ce secret, le workflow échoue proprement (code 1) sans rien committer.

## 2. Lancer manuellement

**Depuis GitHub** : onglet *Actions* → *Blog auto — Caza Comm* → *Run workflow*.
La case **dry_run** génère l'article et affiche le résultat dans les logs **sans rien écrire ni pousser**.

**En local** :

```bash
pip install openai
export OPENAI_API_KEY="sk-..."

python3 scripts/generate-article.py --dry-run   # simulation, aucun fichier touché
python3 scripts/generate-article.py             # génère et écrit (à committer soi-même)
python3 scripts/generate-article.py --mock      # teste la tuyauterie sans appeler l'API
```

`--mock` ne produit **aucun contenu éditorial réel** : il remplit le gabarit d'un texte
de démonstration pour vérifier que le choix du sujet, l'assemblage, la validation et les
mises à jour de fichiers fonctionnent. Combiné à `--dry-run`, rien n'est écrit.

## 3. Codes de sortie

| Code | Signification | Effet sur le workflow |
|---|---|---|
| `0` | Article généré et validé | commit + push |
| `78` | Aucun sujet restant dans `BLOG_WORKFLOW.md` | arrêt propre, pas de commit |
| `1` | Erreur (API, validation, fichier manquant) | échec visible, **aucun fichier écrit** |

## 4. Ce que fait le script

1. Lit `blog-config.json`. Tout ce qui est propre au site y vit — rien de
   spécifique n'est codé en dur dans le script, ce qui permet de le réutiliser
   tel quel sur un autre site en ne changeant que ce fichier. Les 19 clés
   obligatoires sont contrôlées au démarrage : mieux vaut échouer tout de suite
   avec un message clair que publier un JSON-LD portant le logo d'un autre site.

   | Clé | Rôle |
   |---|---|
   | `site_name`, `site_url`, `author` | identité, URL canonique (forme du `CNAME`, avec `www`) |
   | `sector`, `location`, `geo_keywords`, `tone`, `language` | cadrage éditorial |
   | `facts` | **seuls** faits chiffrés, tarifs et adresses que le modèle a le droit d'employer |
   | `internal_link_targets` | cibles du maillage interne (prompt, validation, reprise) |
   | `og_image`, `logo_path` | visuel de partage et logo du JSON-LD |
   | `default_article_section` | rubrique affichée et `articleSection` |
   | `reference_article_slug` | article servant de gabarit |
   | `topic_marker_prefix` | préfixe du marqueur d'idempotence |
   | `model`, `temperature` | `gpt-4o`, 0.7 |
   | `target_word_count`, `faq_questions_count` | 1300 mots, 5 questions |

   `about_id` (facultatif) pointe le JSON-LD `about` vers l'`Organization`
   déclarée sur la page d'accueil — `/#organization` ici.

2. Extrait de `BLOG_WORKFLOW.md` les 12 sujets **et** les règles éditoriales,
   injectées telles quelles dans le prompt. Le tableau des sujets de ce site est
   en Markdown (`| n | titre | \`slug\` | angle |`) : c'est le parser qui s'y
   adapte, `BLOG_WORKFLOW.md` n'est jamais modifié. Le slug annoncé dans le
   tableau prime sur le slug déduit du titre — c'est lui qui fixe la convention
   de nommage.
3. Scanne `/blog/*/index.html` : un article généré porte un marqueur
   `<!-- cazacomm-topic: N -->` juste après `<body class="blog-page">`.
   Un sujet marqué n'est jamais repris.
4. Choisit le premier sujet non traité, dans l'ordre de la liste.
5. **Relit l'article de référence** (`blog/seo-local-tarbes-hautes-pyrenees/index.html`)
   et s'en sert de gabarit. Aucun template HTML n'est dupliqué dans le script :
   barre du haut, pied de page, favicons, polices, feuilles de style, bloc contact
   et bloc coordonnées en sont extraits à chaque exécution, donc si le gabarit
   évolue les articles suivants suivent.
6. Appelle OpenAI (`gpt-4o`, `temperature` 0.7, `max_tokens` 9000, réponse forcée
   en `json_object`) et lui demande **uniquement le contenu éditorial** :

   ```json
   {"title": …, "h1": …, "breadcrumb": …, "meta_description": …, "lede": …,
    "sections": [{"h2": …, "content": [{"type": "p|h3|ul|ol|strong", "text": …}]}],
    "faq": [{"question": …, "answer": …}]}
   ```

   Le modèle **n'écrit pas une ligne de HTML**. Quand il régénérait la page
   entière, les deux tiers de ses tokens de sortie partaient en balisage
   (`<head>`, JSON-LD, header, footer), ce qui plafonnait le corps rédigé autour
   de 850 mots quelle que soit la consigne.

   Seul balisage autorisé dans les textes : `**gras**` et `[libellé](/chemin)`.
   Les liens sont restreints aux chemins internes, un lien externe est donc
   structurellement impossible. Tout le reste est échappé — le modèle ne peut pas
   injecter de HTML. Dans les blocs JSON-LD, `<`, `>` et `&` sont en plus
   neutralisés en `<`, `>`, `&` : sans cela une chaîne contenant
   `</script>` refermerait la balise et ferait passer la suite pour du HTML.
7. **Valide le contenu** avant toute écriture : champs présents, longueur du
   `title` (40–70) et de la `meta_description` (< 155), types de blocs connus,
   exactement 5 questions de FAQ, maillage interne (≥ 2 liens vers
   `/sites-vitrine.html`, `/pub.html` ou `/#contact` et ≥ 1 vers `/blog/`),
   volume entre 900 et 1900 mots. Le moindre échec ⇒ code 1, **rien n'est écrit**.

   Le volume se compte sur le **contenu** (`content_word_count()`), pas sur du
   HTML : `lede` + sections, FAQ exclue.

   *Rattrapage :* le script relance un appel avec un prompt correctif dès que le
   corps passe **sous la cible de 1200 mots** — même si la validation passerait —
   **ou** qu'une erreur de validation que le modèle peut corriger subsiste
   (maillage interne absent, nombre de questions, longueur du `title`). Le message
   de reprise est construit à partir des erreurs réellement relevées
   (`build_correction()`). Il garde ensuite **la meilleure des copies** : celle qui
   a le moins d'erreurs, puis la plus proche de la cible, et chaque reprise repart
   de la meilleure copie obtenue. Plafond strict : **3 appels** (`MAX_CALLS`).

   Le maillage interne est le point sur lequel le modèle achoppe le plus : la
   consigne liste les chemins un par un et montre la forme attendue. Les cibles
   viennent de `internal_link_targets` — elles servent à la fois au prompt, à la
   validation et au message de reprise, et sont tenues courtes (trois cibles).
8. **Assemble la page** : `<head>` repris du gabarit avec seulement les champs
   propres à l'article remplacés (title, description, canonical, OG, Twitter,
   dates), les trois blocs JSON-LD sérialisés depuis le contenu, le marqueur
   d'idempotence inséré après `<body …>`, le `<main>` construit de toutes pièces,
   barre du haut et pied de page repris tels quels.

   `validate_assembled()` contrôle ensuite notre propre code : DOCTYPE, `</html>`,
   marqueur, `<h1>` unique, canonical, balises `<article>` appariées, 3 JSON-LD
   valides, 5 blocs `.blog-faq-item`, et **égalité stricte entre le texte visible
   de la FAQ et le balisage `FAQPage`**.
9. Écrit `blog/<slug>/index.html`, puis met à jour `blog/index.html` (carte + JSON-LD),
   `sitemap.xml`, `rss.xml` et `llms.txt`.

### Conventions HTML de ce site

`split_template()` et `build_main()` sont réglés sur le balisage de ce site, qui
diffère de celui du dépôt de référence :

| Élément | Ici |
|---|---|
| corps | `<body class="blog-page">` |
| conteneur | `<main class="blog-wrap">` |
| fil d'Ariane | `<nav class="blog-crumb">` |
| en-tête d'article | `header.blog-head` → `h1.blog-title`, `p.blog-lede`, `div.blog-meta` |
| corps d'article | `div.blog-body` |
| FAQ | `div.blog-faq` → `div.blog-faq-item` (`h3` + `p`) |
| contact / coordonnées | `section.blog-cta` + `aside.blog-nap`, dans l'`<article>` |
| pied de page | `footer.site-footer` |
| JSON-LD | trois blocs nus, sans commentaire `<!-- Article -->` |

Le gabarit n'a pas été touché : c'est le parser qui s'y conforme.

## 4 bis. Réécrire un article existant

```bash
python scripts/generate-article.py --rewrite <slug>
```

Régénère un article déjà publié et **écrase** son fichier. Le sujet est retrouvé
via le marqueur `<!-- cazacomm-topic: N -->` présent dans le fichier, donc aucun
risque de se tromper de sujet. Le teaser de `blog/index.html` et l'entrée
`rss.xml` sont resynchronisés (`refresh_entries()`) : les updaters normaux sont
idempotents par URL et laisseraient sinon le texte de l'ancienne version.

Disponible aussi depuis Actions : champ **rewrite** du `workflow_dispatch`.

> L'article fondateur `seo-local-tarbes-hautes-pyrenees`, écrit à la main, ne
> porte pas de marqueur : il n'est donc pas réécrivable par cette commande, et
> c'est voulu.

## 5. Idempotence

- Le slug vient du tableau de `BLOG_WORKFLOW.md`, à défaut il est **déterministe** :
  même titre de sujet ⇒ même slug.
- Si `blog/<slug>/index.html` existe déjà, le script s'arrête en code 78 sans rien écraser.
- Les mises à jour de `blog/index.html`, `sitemap.xml`, `rss.xml` et `llms.txt` vérifient
  d'abord si l'URL est déjà présente : rejouer le workflow ne crée jamais de doublon.
- Aucun article existant n'est jamais modifié ni supprimé.

## 6. Coût estimé

Tarifs OpenAI `gpt-4o` en vigueur à la mise en place — **à revérifier sur
<https://openai.com/api/pricing/>**, ils changent.

Par exécution : environ **3 000 à 5 000 tokens en entrée** et **4 000 à 7 000 en
sortie**, multipliés par le nombre d'appels (1 à 3 selon le rattrapage).

`gpt-4o` coûte nettement plus cher que `gpt-4o-mini` : compter de l'ordre de
**quelques dizaines de centimes d'euro par article**, soit quelques euros par an
pour une publication hebdomadaire. C'est le prix du volume rédactionnel — `mini`
ne tenait pas les 1200 mots. Le poste de coût réel reste la relecture humaine.

Pour vérifier la consommation réelle : les logs du workflow affichent le décompte
exact des tokens de chaque exécution (`[blog] Tokens : … entrée + … sortie = …`).

## 7. Ajouter des sujets

La réserve de sujets est la section **« Douze sujets prêts à écrire »** de
[`BLOG_WORKFLOW.md`](../BLOG_WORKFLOW.md). Quand elle est épuisée, le workflow sort
en code 78 chaque lundi sans rien casser. Il suffit d'ajouter des lignes au même
format de tableau pour relancer la machine :

```markdown
| 13 | Titre du sujet | `slug-de-l-article` | angle, intention de recherche visée |
```

## 8. Relecture

La génération est automatique, la responsabilité éditoriale ne l'est pas.
Après chaque publication, vérifier au minimum : aucun prix ni chiffre inventé
hors de `facts`, ton conforme, ancrage local crédible. Les règles complètes sont
dans `BLOG_WORKFLOW.md`.

Les sujets 5, 9 et 12 du tableau (avis Google, devis, RGPD) sont les plus exposés
au risque d'affirmation réglementaire inventée : les relire de près.
