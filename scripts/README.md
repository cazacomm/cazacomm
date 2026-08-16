# Publication automatique du blog

Chaque lundi à 9 h UTC, GitHub Actions génère un article et le pousse sur
`main`. GitHub Pages le met en ligne dans la foulée.

```
blog-config.json              paramètres du site (ton, zone, longueur, modèle)
scripts/generate-article.py   génération + mise à jour des fichiers de diffusion
.github/workflows/blog-auto.yml  déclencheur hebdomadaire
BLOG_WORKFLOW.md              règles éditoriales + tableau des sujets
```

---

## 1. Poser la clé API

Une seule fois, sur GitHub :

**Settings › Secrets and variables › Actions › New repository secret**

| Champ | Valeur |
|---|---|
| Name | `OPENAI_API_KEY` |
| Secret | votre clé `sk-…` (platform.openai.com › API keys) |

Rien d'autre à configurer : le workflow utilise le `GITHUB_TOKEN` fourni
automatiquement pour committer.

En local :

```bash
export OPENAI_API_KEY=sk-...
```

---

## 2. Lancer à la main

Depuis GitHub : onglet **Actions › Blog auto › Run workflow**. Deux champs
facultatifs — un numéro de sujet à forcer, et une case pour ne rien écrire.

En ligne de commande :

```bash
python3 scripts/generate-article.py             # génère, écrit, ne commite pas
python3 scripts/generate-article.py --dry-run   # appelle l'API, n'écrit rien
python3 scripts/generate-article.py --mock      # sans API ni écriture
python3 scripts/generate-article.py --topic 7   # force le sujet 7
```

`--mock` utilise une charge de test au lieu du modèle : c'est le moyen de
vérifier la chaîne (gabarit, JSON-LD, sitemap, RSS) sans dépenser un jeton.
Ce mode force le dry-run, son texte de remplissage ne peut donc jamais être
publié par accident.

**Codes de sortie** — `0` article généré · `1` erreur, rien n'est écrit ·
`78` tous les sujets sont traités, le workflow s'arrête sans commit.

---

## 3. Choix du sujet

Le script lit le tableau de la section « Douze sujets prêts à écrire » de
`BLOG_WORKFLOW.md` et prend **le premier sujet non traité, dans l'ordre**.

Un sujet est considéré traité si :
- son dossier `/blog/<slug>/` existe déjà, ou
- un article porte son marqueur `<!-- cazacomm-topic: N -->`.

Rejouer le workflow ne peut donc jamais écraser un article : le dossier
cible est vérifié avant toute écriture, et le script s'arrête plutôt que de
remplacer quoi que ce soit.

**Quand la liste est épuisée**, le workflow sort en 78 chaque lundi sans
rien faire. Pour relancer la publication, ajoutez des lignes au tableau, au
même format :

```
| 13 | Titre de l'article | `slug-de-l-article` | angle à traiter |
```

---

## 4. Ce que le script écrit

| Fichier | Modification |
|---|---|
| `blog/<slug>/index.html` | l'article, créé (jamais écrasé) |
| `blog/index.html` | carte ajoutée en tête de liste + entrée `blogPost` |
| `sitemap.xml` | nouvelle `<url>` + `lastmod` de `/blog/` rafraîchi |
| `rss.xml` | nouvel `<item>` en tête + `lastBuildDate` |

Aucune autre page du site n'est touchée.

Le gabarit n'est pas recopié dans le script : à chaque exécution, l'article
le plus ancien de `/blog/` est relu et ses fragments d'habillage — barre du
haut, bloc contact, coordonnées, pied de page, feuilles de style — sont
réutilisés tels quels. Si vous changez la clé de cache de `blog.css` ou un
lien du pied de page, les articles suivants en héritent automatiquement.

---

## 5. Garde-fous

Le script refuse d'écrire si l'un de ces contrôles échoue :

- réponse OpenAI absente, non-JSON ou incomplète (2 tentatives) ;
- moins de 3 sections exploitables ;
- nombre de questions de FAQ différent de `faq_questions_count` ;
- article sous 60 % de `target_word_count` ;
- JSON-LD invalide, ou différent de `Article` + `BreadcrumbList` + `FAQPage` ;
- texte visible de la FAQ différent du balisage `FAQPage` ;
- `sitemap.xml` ou `rss.xml` mal formé.

Tout est calculé en mémoire ; les fichiers ne sont écrits qu'une fois **tous**
les contrôles passés. Un échec ne laisse jamais le dépôt à moitié modifié.

Le modèle ne produit jamais de HTML : il renvoie du JSON, le script fabrique
le balisage. Le texte est échappé, `<` `>` `&` sont neutralisés dans les blocs
JSON-LD, et seul le marqueur `**expression**` produit une mise en relief.

Les règles éditoriales — pas de prix, de chiffres, de noms de clients, de
dates ni de références réglementaires inventés — sont dans le prompt système
du script. **Elles réduisent le risque sans le supprimer : un modèle peut
toujours affirmer une contre-vérité plausible.** Une relecture avant ou après
publication reste nécessaire, surtout sur les sujets 5, 9 et 12 du tableau,
qui touchent aux avis, aux devis et au RGPD.

---

## 6. Coût

Pour un article d'environ 1 300 mots avec `gpt-4o-mini` : le prompt système
et la consigne pèsent quelques milliers de jetons en entrée, la réponse
environ 2 500 à 3 500 jetons en sortie.

Aux tarifs publiés pour `gpt-4o-mini` (0,15 $ le million de jetons en entrée,
0,60 $ en sortie), cela place un article **nettement sous le centime**, soit
de l'ordre de quelques centimes par an pour une publication hebdomadaire.
Le coût réel est à vérifier sur votre tableau de bord OpenAI : les tarifs
évoluent et cette estimation n'engage rien.

Les minutes GitHub Actions sont gratuites sur un dépôt public.

Le nombre de jetons réellement consommés est affiché dans le journal
d'exécution, à la ligne `✓ … jetons en entrée, … en sortie`.
