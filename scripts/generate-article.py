#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Génère et publie un article de blog Caza Comm.

Principe : le gabarit HTML n'est PAS recopié dans ce script. À chaque
exécution, l'article de référence (le plus ancien de /blog/) est relu et
ses fragments d'habillage — barre du haut, blocs d'appel à l'action, NAP,
pied de page, feuilles de style — sont réutilisés tels quels. Si le site
change (nouvelle clé de cache CSS, nouveau lien dans le pied de page), les
articles générés suivent sans qu'on touche à ce fichier.

Le modèle ne produit jamais de HTML : il renvoie un objet JSON structuré,
et c'est ce script qui fabrique le balisage. C'est ce qui garantit que les
classes CSS, le JSON-LD et le texte visible de la FAQ restent cohérents.

Codes de sortie :
   0  article généré (ou dry-run réussi)
   1  erreur
  78  aucun sujet nouveau à traiter

Usage :
  python3 scripts/generate-article.py                # génère et écrit
  python3 scripts/generate-article.py --dry-run      # n'écrit rien
  python3 scripts/generate-article.py --mock         # sans API (implique --dry-run)
  python3 scripts/generate-article.py --topic 4      # force un sujet précis
"""

from __future__ import annotations

import argparse
import html as html_mod
import json
import os
import re
import sys
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CONFIG_PATH = ROOT / "blog-config.json"
WORKFLOW_PATH = ROOT / "BLOG_WORKFLOW.md"
BLOG_DIR = ROOT / "blog"
BLOG_INDEX = BLOG_DIR / "index.html"
SITEMAP = ROOT / "sitemap.xml"
RSS = ROOT / "rss.xml"

EXIT_OK, EXIT_ERROR, EXIT_NOTHING = 0, 1, 78

MOIS_FR = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet",
           "août", "septembre", "octobre", "novembre", "décembre"]
JOURS_EN = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
MOIS_EN = ["Jan", "Feb", "Mar", "Apr", "May", "Jun",
           "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]


# ───────────────────────────── journal ─────────────────────────────

def log(msg: str = "") -> None:
    print(msg, flush=True)


def step(msg: str) -> None:
    log(f"→ {msg}")


def ok(msg: str) -> None:
    log(f"  ✓ {msg}")


def die(msg: str, code: int = EXIT_ERROR) -> None:
    log(f"✗ {msg}")
    sys.exit(code)


# ──────────────────────── configuration & sujets ────────────────────────

def load_config() -> dict:
    if not CONFIG_PATH.exists():
        die(f"blog-config.json introuvable ({CONFIG_PATH})")
    try:
        cfg = json.loads(CONFIG_PATH.read_text(encoding="utf-8"))
    except json.JSONDecodeError as e:
        die(f"blog-config.json illisible : {e}")
    for key in ("site_name", "site_url", "site_slug", "sector", "location",
                "geo_keywords", "tone", "author", "target_word_count",
                "faq_questions_count", "language"):
        if key not in cfg:
            die(f"blog-config.json : clé « {key} » manquante")
    cfg["site_url"] = cfg["site_url"].rstrip("/")
    return cfg


TOPIC_ROW = re.compile(
    r"^\|\s*(\d+)\s*\|\s*(.+?)\s*\|\s*`([a-z0-9\-]+)`\s*\|\s*(.+?)\s*\|\s*$"
)


def parse_topics() -> list[dict]:
    """Extrait le tableau des sujets de BLOG_WORKFLOW.md."""
    if not WORKFLOW_PATH.exists():
        die(f"BLOG_WORKFLOW.md introuvable ({WORKFLOW_PATH})")
    topics = []
    for line in WORKFLOW_PATH.read_text(encoding="utf-8").splitlines():
        m = TOPIC_ROW.match(line)
        if not m:
            continue
        num, title, slug, angle = m.groups()
        # « ✅ *Publié* — Titre » : on ne garde que le titre
        title = re.sub(r"^.*?\*Publié\*\s*—\s*", "", title).strip()
        title = title.replace("\\|", "|").strip()
        topics.append({"n": int(num), "title": title, "slug": slug, "angle": angle.strip()})
    if not topics:
        die("aucun sujet trouvé dans BLOG_WORKFLOW.md "
            "(tableau attendu : | n | titre | `slug` | angle |)")
    topics.sort(key=lambda t: t["n"])
    return topics


MARKER = re.compile(r"<!--\s*([a-z0-9\-]+)-topic:\s*(\d+)\s*-->")


def scan_existing(site_slug: str) -> tuple[set[int], set[str]]:
    """Sujets déjà traités (marqueur d'idempotence) et slugs déjà présents."""
    done_numbers: set[int] = set()
    slugs: set[str] = set()
    if not BLOG_DIR.exists():
        return done_numbers, slugs
    for page in sorted(BLOG_DIR.glob("*/index.html")):
        slugs.add(page.parent.name)
        m = MARKER.search(page.read_text(encoding="utf-8"))
        if m and m.group(1) == site_slug:
            done_numbers.add(int(m.group(2)))
    return done_numbers, slugs


def pick_topic(topics: list[dict], done: set[int], slugs: set[str],
               forced: int | None) -> dict:
    if forced is not None:
        for t in topics:
            if t["n"] == forced:
                if t["slug"] in slugs:
                    die(f"sujet {forced} : /blog/{t['slug']}/ existe déjà, "
                        f"rien n'est écrasé")
                return t
        die(f"sujet {forced} absent de BLOG_WORKFLOW.md")
    for t in topics:
        if t["n"] in done:
            log(f"  · sujet {t['n']:>2} déjà traité (marqueur)")
            continue
        if t["slug"] in slugs:
            log(f"  · sujet {t['n']:>2} déjà publié (/blog/{t['slug']}/)")
            continue
        return t
    log("Tous les sujets de BLOG_WORKFLOW.md sont traités. "
        "Ajoutez-en de nouveaux au tableau pour relancer la publication.")
    sys.exit(EXIT_NOTHING)


# ────────────────────── gabarit relu depuis l'existant ──────────────────────

def reference_article() -> Path:
    """L'article le plus ancien du blog sert de gabarit."""
    pages = sorted(BLOG_DIR.glob("*/index.html"))
    if not pages:
        die("aucun article existant dans /blog/ : impossible de relire le gabarit")
    dated = []
    for p in pages:
        m = re.search(r'"datePublished":\s*"(\d{4}-\d{2}-\d{2})"',
                      p.read_text(encoding="utf-8"))
        dated.append((m.group(1) if m else "9999-99-99", p.parent.name, p))
    dated.sort()
    return dated[0][2]


def slice_between(src: str, start: str, end: str, label: str,
                  include_end: bool = True) -> str:
    i = src.find(start)
    if i < 0:
        die(f"gabarit : ancre de début introuvable pour « {label} » ({start!r})")
    j = src.find(end, i + len(start))
    if j < 0:
        die(f"gabarit : ancre de fin introuvable pour « {label} » ({end!r})")
    return src[i:j + len(end)] if include_end else src[i:j]


def load_template(path: Path) -> dict:
    """Récupère les fragments d'habillage de l'article de référence."""
    src = path.read_text(encoding="utf-8")
    head = src[:src.find("</head>")]

    tpl = {
        "head_top": slice_between(
            head, "<meta charset=", "/>", "en-tête (charset → theme-color)")
            .split("\n")[0],
        "head_meta_block": slice_between(
            head, "<meta charset=", '<meta name="theme-color"', "métas de base",
            include_end=False) + slice_between(
            head, '<meta name="theme-color"', "/>", "theme-color"),
        "head_icons": slice_between(
            head, '<link rel="icon"', "rss.xml\" />", "icônes et flux"),
        "head_assets": slice_between(
            head, '<link rel="preconnect"', "blog.css", "polices et styles")
            + slice_between(head[head.find("blog.css"):], "blog.css", "/>",
                            "fin de la feuille blog.css")[len("blog.css"):],
        "robots": slice_between(
            head, '<meta name="robots"', "/>", "meta robots"),
        "body_tag": slice_between(
            src, "<body", ">", "balise body"),
        "topbar": slice_between(
            src, '<div class="page-toggle-bar"', "<main class=", "barre du haut",
            include_end=False).rstrip(),
        "main_open": slice_between(
            src, "<main class=", ">", "ouverture du main"),
        "cta": slice_between(
            src, '<section class="blog-cta"', "</section>", "bloc contact"),
        "nap": slice_between(
            src, '<aside class="blog-nap"', "</aside>", "bloc coordonnées"),
        "footer": slice_between(
            src, '<footer class="site-footer">', "</footer>", "pied de page"),
    }
    return tpl


# ───────────────────────────── appel du modèle ─────────────────────────────

SYSTEM_PROMPT = """Tu es rédacteur pour une agence web française. Tu écris des \
articles de blog SEO/GEO ancrés localement, à destination de dirigeants de TPE, \
PME, artisans et indépendants.

RÈGLES ÉDITORIALES ABSOLUES — une seule violation rend l'article inutilisable :
- N'invente JAMAIS de prix, tarif, pourcentage, statistique, chiffre d'affaires, \
délai chiffré, nombre de clients, date de fondation, nom de client ou de \
personne, ni référence à un article de loi, une sanction ou un texte \
réglementaire. Si tu ne peux pas vérifier une donnée, écris la phrase sans elle.
- Les seuls repères chiffrés autorisés sont ceux qui relèvent du fonctionnement \
public et stable d'un outil (par exemple : le pack local de Google affiche trois \
établissements).
- Pas de superlatif commercial, pas de promesse de résultat, pas de « leader », \
« incontournable », « révolutionnaire ».
- Ton : expert-conseil, factuel, chaleureux, direct, sans jargon inutile. On \
explique une mécanique, on ne vend pas.
- Ancrage local explicite et naturel : les villes et départements fournis doivent \
apparaître dans le titre, l'introduction, plusieurs sections et la FAQ — sans \
bourrage de mots-clés.
- Écris en français, avec les apostrophes typographiques (') et les guillemets \
français (« »).

FORMAT DE SORTIE — un objet JSON strict, rien d'autre, aucun HTML, aucun Markdown \
dans les valeurs :
{
  "title": "titre de l'article, sans le nom du site",
  "title_tail": "les 2 à 5 derniers mots de title, exactement tels qu'ils y figurent",
  "crumb": "libellé court pour le fil d'Ariane (3 à 5 mots)",
  "meta_description": "une phrase, STRICTEMENT moins de 150 caractères",
  "og_description": "une phrase, moins de 150 caractères, formulée différemment",
  "lede": "2 à 3 phrases d'accroche",
  "category": "rubrique courte, 2 à 4 mots",
  "intro": ["paragraphe d'introduction", "second paragraphe d'introduction"],
  "sections": [
    {
      "h2": "titre de section",
      "blocks": [
        {"type": "p",  "text": "un paragraphe"},
        {"type": "h3", "text": "un sous-titre"},
        {"type": "ul", "items": ["élément", "élément"]},
        {"type": "ol", "items": ["étape", "étape"]}
      ]
    }
  ],
  "callout": {"title": "À retenir", "paragraphs": ["...", "..."]},
  "faq": [{"q": "question ?", "a": "réponse de 3 à 5 phrases"}]
}

CONTRAINTES DE STRUCTURE :
- 4 à 6 sections, chacune avec au moins un "h3" et plusieurs paragraphes.
- La dernière section ne doit PAS être la FAQ : la FAQ est le champ "faq".
- Les réponses de FAQ sont autonomes et directement citables par un moteur \
génératif : la première phrase répond, les suivantes précisent.
- N'écris JAMAIS de HTML. Pour mettre en relief une expression clé, encadre-la \
de doubles astérisques : **comme ceci**. Une à trois mises en relief par section \
au maximum, uniquement dans les paragraphes et les listes — jamais dans un \
titre, ni dans le lede, ni dans la FAQ, ni dans meta_description. Aucun autre \
balisage Markdown n'est accepté."""


def build_user_prompt(cfg: dict, topic: dict) -> str:
    return f"""Rédige l'article suivant.

SUJET : {topic['title']}
ANGLE À TRAITER : {topic['angle']}

ENTREPRISE : {cfg['site_name']}
SECTEUR : {cfg['sector']}
IMPLANTATION : {cfg['location']}
ZONE COUVERTE : {', '.join(cfg.get('coverage_area', []))}
VILLES ET TERRITOIRES À CITER NATURELLEMENT : {', '.join(cfg['geo_keywords'])}
TON : {cfg['tone']}

LONGUEUR VISÉE : environ {cfg['target_word_count']} mots pour l'ensemble
(introduction + sections), hors FAQ.
NOMBRE DE QUESTIONS DE FAQ : exactement {cfg['faq_questions_count']}.

Rappel : aucun prix, aucun chiffre inventé, aucun nom de client, aucune \
référence réglementaire. Réponds uniquement par l'objet JSON demandé."""


def call_openai(cfg: dict, topic: dict) -> dict:
    api_key = os.environ.get("OPENAI_API_KEY", "").strip()
    if not api_key:
        die("OPENAI_API_KEY absente de l'environnement. "
            "En local : export OPENAI_API_KEY=sk-… — "
            "en CI : Settings › Secrets and variables › Actions.")
    try:
        from openai import OpenAI
    except ImportError:
        die("bibliothèque « openai » absente. Installez-la : pip install openai")

    client = OpenAI(api_key=api_key)
    model = cfg.get("model", "gpt-4o-mini")
    temperature = cfg.get("temperature", 0.7)
    last_error = None

    for attempt in (1, 2):
        try:
            step(f"appel OpenAI ({model}, temperature {temperature}, essai {attempt}/2)")
            resp = client.chat.completions.create(
                model=model,
                temperature=temperature,
                response_format={"type": "json_object"},
                messages=[
                    {"role": "system", "content": SYSTEM_PROMPT},
                    {"role": "user", "content": build_user_prompt(cfg, topic)},
                ],
            )
            payload = json.loads(resp.choices[0].message.content)
            usage = getattr(resp, "usage", None)
            if usage:
                ok(f"{usage.prompt_tokens} jetons en entrée, "
                   f"{usage.completion_tokens} en sortie")
            return payload
        except json.JSONDecodeError as e:
            last_error = f"réponse non-JSON du modèle : {e}"
        except Exception as e:  # réseau, quota, authentification…
            last_error = f"{type(e).__name__} : {e}"
        log(f"  ! échec ({last_error})")

    die(f"OpenAI injoignable ou réponse inexploitable après 2 essais — {last_error}")


def build_mock_payload(cfg: dict) -> dict:
    """Charge de test hors ligne, dimensionnée sur la config.

    Elle sert à valider la chaîne complète — gabarit, rendu, JSON-LD,
    fichiers de diffusion, seuils — sans appeler l'API ni consommer de
    jetons. Ce n'est pas du contenu éditorial : le mode mock force le
    dry-run, ce texte ne peut donc jamais être publié.
    """
    phrase = ("Ce paragraphe de contrôle sert à vérifier le rendu du gabarit "
              "et le calcul de la longueur, sans consommer de jetons ni "
              "appeler le modèle de génération.")
    words_per_para = len(phrase.split())
    target = int(cfg["target_word_count"])
    n_sections = 4
    paras_per_section = max(2, round(target / (n_sections * words_per_para)))

    def para(i: int, j: int) -> str:
        return f"{phrase} Section {i}, paragraphe {j}."

    sections = []
    for i in range(1, n_sections + 1):
        blocks = [{"type": "p", "text": para(i, 1)},
                  {"type": "h3", "text": f"Sous-titre de contrôle {i}"}]
        for j in range(2, paras_per_section + 1):
            blocks.append({"type": "p", "text": para(i, j)})
        if i == 2:
            blocks.append({"type": "ul", "items": [
                f"Élément de liste non ordonnée numéro {k}." for k in (1, 2, 3)]})
        if i == 3:
            blocks.append({"type": "ol", "items": [
                f"Étape numérotée numéro {k}." for k in (1, 2, 3)]})
        sections.append({"h2": f"Section de contrôle {i}", "blocks": blocks})

    return {
        "title": "Article de démonstration hors ligne",
        "title_tail": "hors ligne",
        "crumb": "Démonstration",
        "meta_description": ("Charge de démonstration utilisée pour vérifier la "
                             "chaîne de génération sans appeler l'API."),
        "og_description": ("Charge de démonstration servant à valider le rendu "
                           "HTML et les fichiers de diffusion."),
        "lede": ("Ce texte ne provient pas du modèle. Il sert uniquement à "
                 "vérifier que le gabarit, le JSON-LD et les fichiers de "
                 "diffusion sont correctement assemblés."),
        "category": "Démonstration",
        "intro": [para(0, 1), para(0, 2)],
        "sections": sections,
        "callout": {"title": "À retenir", "paragraphs": [
            "Encart de contrôle, première ligne.",
            "Encart de contrôle, seconde ligne."]},
        "faq": [
            {"q": f"Question de contrôle numéro {i} ?",
             "a": (f"Réponse de contrôle numéro {i}. Elle existe pour vérifier "
                   "que le texte visible et le balisage FAQPage restent "
                   "strictement identiques.")}
            for i in range(1, int(cfg["faq_questions_count"]) + 1)
        ],
    }


# ───────────────────────────── validation ─────────────────────────────

def clean(text: str) -> str:
    """Normalise les espaces et retire les marqueurs de relief."""
    return strip_marks(re.sub(r"\s+", " ", str(text)).strip())


def validate(payload: dict, cfg: dict) -> dict:
    """Normalise et contrôle la charge renvoyée par le modèle."""
    required = ("title", "meta_description", "lede", "intro", "sections", "faq")
    missing = [k for k in required if not payload.get(k)]
    if missing:
        die(f"réponse du modèle incomplète, champs manquants : {', '.join(missing)}")

    data = {
        "title": clean(payload["title"]),
        "title_tail": clean(payload.get("title_tail", "")),
        "crumb": clean(payload.get("crumb") or payload["title"])[:60],
        "meta_description": clean(payload["meta_description"]),
        "og_description": clean(payload.get("og_description") or payload["meta_description"]),
        "lede": clean(payload["lede"]),
        "category": clean(payload.get("category") or "Conseils"),
        "intro": [re.sub(r"\s+", " ", str(p)).strip() for p in payload["intro"] if clean(p)],
        "sections": [],
        "callout": None,
        "faq": [],
    }

    def keep(text: str) -> str:
        """Normalise sans retirer les ** : réservé au corps de l'article."""
        return re.sub(r"\s+", " ", str(text)).strip()

    for sec in payload["sections"]:
        h2 = clean(sec.get("h2", ""))
        if not h2:
            continue
        blocks = []
        for b in sec.get("blocks", []):
            t = b.get("type")
            if t in ("p", "h3"):
                txt = keep(b["text"]) if t == "p" and b.get("text") else clean(b.get("text", ""))
                if txt:
                    blocks.append({"type": t, "text": txt})
            elif t in ("ul", "ol"):
                items = [keep(i) for i in b.get("items", []) if clean(i)]
                if items:
                    blocks.append({"type": t, "items": items})
        if blocks:
            data["sections"].append({"h2": h2, "blocks": blocks})

    if len(data["sections"]) < 3:
        die(f"seulement {len(data['sections'])} section(s) exploitable(s), 3 minimum attendues")

    co = payload.get("callout") or {}
    paras = [re.sub(r"\s+", " ", str(p)).strip() for p in co.get("paragraphs", []) if clean(p)]
    if paras:
        data["callout"] = {"title": clean(co.get("title") or "À retenir"), "paragraphs": paras}

    for item in payload["faq"]:
        q, a = clean(item.get("q", "")), clean(item.get("a", ""))
        if q and a:
            data["faq"].append({"q": q, "a": a})

    expected = int(cfg["faq_questions_count"])
    if len(data["faq"]) != expected:
        die(f"{len(data['faq'])} question(s) de FAQ au lieu de {expected}")

    # meta description : au-delà de ~155 caractères, Google tronque
    if len(data["meta_description"]) >= 155:
        cut = data["meta_description"][:152].rsplit(" ", 1)[0].rstrip(" ,;:—-")
        log(f"  ! meta description de {len(data['meta_description'])} caractères, "
            f"raccourcie à {len(cut)}")
        data["meta_description"] = cut
    if len(data["og_description"]) >= 200:
        data["og_description"] = data["og_description"][:197].rsplit(" ", 1)[0]

    # accent typographique sur la fin du titre
    if not (data["title_tail"] and data["title"].endswith(data["title_tail"])):
        data["title_tail"] = ""

    data["word_count"] = count_words(data)
    floor = int(cfg["target_word_count"] * 0.6)
    if data["word_count"] < floor:
        die(f"article trop court : {data['word_count']} mots (plancher {floor})")
    data["read_minutes"] = max(4, round(data["word_count"] / 220))
    return data


def count_words(data: dict) -> int:
    parts = list(data["intro"])
    for sec in data["sections"]:
        parts.append(sec["h2"])
        for b in sec["blocks"]:
            parts.extend(b["items"] if "items" in b else [b["text"]])
    if data["callout"]:
        parts.extend(data["callout"]["paragraphs"])
    return len(strip_marks(" ".join(parts)).split())


# ───────────────────────────── rendu HTML ─────────────────────────────

def esc(text: str) -> str:
    """Échappe pour un nœud texte, en gardant la typographie française."""
    return html_mod.escape(str(text), quote=False)


def esc_rich(text: str) -> str:
    """Comme esc(), mais convertit **expression** en <strong>.

    L'échappement est fait AVANT la conversion : le modèle ne peut donc pas
    injecter de balise, seul le marqueur ** produit du HTML.
    """
    out = html_mod.escape(str(text), quote=False)
    return re.sub(r"\*\*(.+?)\*\*", r"<strong>\1</strong>", out)


def strip_marks(text: str) -> str:
    """Retire les marqueurs de relief là où le HTML n'est pas souhaité."""
    return re.sub(r"\*\*(.+?)\*\*", r"\1", str(text))


def attr(text: str) -> str:
    return html_mod.escape(str(text), quote=True)


def json_safe(body: str) -> str:
    """Neutralise < > & dans un bloc JSON-LD.

    Une chaîne contenant « </script> » refermerait la balise et ferait
    passer le reste pour du HTML. Les échappements \\u003c, \\u003e et
    \\u0026 restent du JSON strictement valide.
    """
    return (body.replace("&", "\\u0026")
                .replace("<", "\\u003c")
                .replace(">", "\\u003e"))


def jsonld(obj: dict, indent: str = "  ") -> str:
    body = json_safe(json.dumps(obj, ensure_ascii=False, indent=2))
    body = "\n".join(indent + line for line in body.splitlines())
    return (f'{indent}<script type="application/ld+json">\n'
            f'{body}\n'
            f'{indent}</script>')


def render_body(data: dict) -> str:
    out = []
    for p in data["intro"]:
        out.append(f"      <p>{esc_rich(p)}</p>")
    for sec in data["sections"]:
        out.append("")
        out.append(f"      <h2>{esc(sec['h2'])}</h2>")
        for b in sec["blocks"]:
            out.append("")
            if b["type"] == "p":
                out.append(f"      <p>{esc_rich(b['text'])}</p>")
            elif b["type"] == "h3":
                out.append(f"      <h3>{esc(b['text'])}</h3>")
            else:
                tag = b["type"]
                out.append(f"      <{tag}>")
                for it in b["items"]:
                    out.append(f"        <li>{esc_rich(it)}</li>")
                out.append(f"      </{tag}>")
    if data["callout"]:
        out.append("")
        out.append('      <div class="blog-callout">')
        out.append(f'        <span class="kicker">{esc(data["callout"]["title"])}</span>')
        for p in data["callout"]["paragraphs"]:
            out.append(f"        <p>{esc_rich(p)}</p>")
        out.append("      </div>")
    out.append("")
    out.append("      <h2>Questions fréquentes</h2>")
    out.append("")
    out.append('      <div class="blog-faq">')
    for item in data["faq"]:
        out.append("")
        out.append('        <div class="blog-faq-item">')
        out.append(f"          <h3>{esc(item['q'])}</h3>")
        out.append(f"          <p>{esc(item['a'])}</p>")
        out.append("        </div>")
    out.append("")
    out.append("      </div>")
    return "\n".join(out)


def render_article(cfg: dict, tpl: dict, topic: dict, data: dict,
                   today: datetime) -> str:
    base = cfg["site_url"]
    url = f"{base}/blog/{topic['slug']}/"
    iso = today.strftime("%Y-%m-%d")
    human = f"{today.day} {MOIS_FR[today.month - 1]} {today.year}"
    logo = f"{base}/images/logo.png"
    org = {"@type": "Organization", "name": cfg["site_name"], "url": f"{base}/"}

    if data["title_tail"]:
        head_part = data["title"][: -len(data["title_tail"])].rstrip()
        h1 = (f'{esc(head_part)} <span class="accent">'
              f'{esc(data["title_tail"])}</span>')
    else:
        h1 = esc(data["title"])

    article_ld = {
        "@context": "https://schema.org", "@type": "Article",
        "headline": data["title"], "description": data["og_description"],
        "inLanguage": "fr-FR", "datePublished": iso, "dateModified": iso,
        "mainEntityOfPage": {"@type": "WebPage", "@id": url},
        "url": url, "image": logo, "articleSection": data["category"],
        "author": org,
        "publisher": {**org, "logo": {"@type": "ImageObject", "url": logo}},
    }
    crumb_ld = {
        "@context": "https://schema.org", "@type": "BreadcrumbList",
        "itemListElement": [
            {"@type": "ListItem", "position": 1, "name": "Accueil", "item": f"{base}/"},
            {"@type": "ListItem", "position": 2, "name": "Blog", "item": f"{base}/blog/"},
            {"@type": "ListItem", "position": 3, "name": data["crumb"], "item": url},
        ],
    }
    # Le texte des réponses vient de la même source que le HTML visible :
    # les deux ne peuvent pas diverger.
    faq_ld = {
        "@context": "https://schema.org", "@type": "FAQPage",
        "mainEntity": [
            {"@type": "Question", "name": i["q"],
             "acceptedAnswer": {"@type": "Answer", "text": i["a"]}}
            for i in data["faq"]
        ],
    }

    return f"""<!DOCTYPE html>
<html lang="fr">
<head>
{tpl['head_meta_block']}
  <title>{esc(data['title'])} | {esc(cfg['site_name'])}</title>
  <meta name="description" content="{attr(data['meta_description'])}" />
  <link rel="canonical" href="{url}" />
  {tpl['robots']}

  {tpl['head_icons']}

  <meta property="og:type" content="article" />
  <meta property="og:locale" content="fr_FR" />
  <meta property="og:site_name" content="{attr(cfg['site_name'])}" />
  <meta property="og:title" content="{attr(data['title'])}" />
  <meta property="og:description" content="{attr(data['og_description'])}" />
  <meta property="og:url" content="{url}" />
  <meta property="og:image" content="{logo}" />
  <meta property="article:published_time" content="{iso}" />
  <meta property="article:modified_time" content="{iso}" />

  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="{attr(data['title'])}" />
  <meta name="twitter:description" content="{attr(data['og_description'])}" />
  <meta name="twitter:image" content="{logo}" />

  {tpl['head_assets']}

{jsonld(article_ld)}

{jsonld(crumb_ld)}

{jsonld(faq_ld)}
</head>
{tpl['body_tag']}>
<!-- {cfg['site_slug']}-topic: {topic['n']} -->

{tpl['topbar']}

{tpl['main_open']}

  <nav class="blog-crumb" aria-label="Fil d'Ariane">
    <a href="/">Accueil</a>
    <span aria-hidden="true">/</span>
    <a href="/blog/">Blog</a>
    <span aria-hidden="true">/</span>
    <span aria-current="page">{esc(data['crumb'])}</span>
  </nav>

  <article>

    <header class="blog-head">
      <h1 class="blog-title">{h1}</h1>
      <p class="blog-lede">{esc(data['lede'])}</p>
      <div class="blog-meta">
        <span><time datetime="{iso}">{human}</time></span>
        <span>{esc(data['category'])}</span>
        <span>Lecture {data['read_minutes']} min</span>
        <span>{esc(cfg['author'])}</span>
      </div>
    </header>

    <div class="blog-body">

{render_body(data)}

    </div>

    {tpl['cta']}

    {tpl['nap']}

  </article>

</main>

{tpl['footer']}

</body>
</html>
"""


# ─────────────────── fichiers de diffusion (en mémoire) ───────────────────

def updated_blog_index(cfg: dict, topic: dict, data: dict, today: datetime) -> str:
    src = BLOG_INDEX.read_text(encoding="utf-8")
    base = cfg["site_url"]
    url = f"{base}/blog/{topic['slug']}/"
    iso = today.strftime("%Y-%m-%d")
    human = f"{today.day} {MOIS_FR[today.month - 1]} {today.year}"

    if f'href="/blog/{topic["slug"]}/"' in src:
        log("  ! carte déjà présente dans blog/index.html, non dupliquée")
        return src

    card = f"""    <a class="blog-card" href="/blog/{topic['slug']}/">
      <div class="blog-card-meta">
        <span><time datetime="{iso}">{human}</time></span>
        <span>{esc(data['category'])}</span>
        <span>Lecture {data['read_minutes']} min</span>
      </div>
      <h2 class="blog-card-title">{esc(data['title'])}</h2>
      <p class="blog-card-lede">{esc(data['lede'])}</p>
    </a>
"""
    anchor = '<div class="blog-list">\n'
    i = src.find(anchor)
    if i < 0:
        die('blog/index.html : conteneur <div class="blog-list"> introuvable')
    i += len(anchor)
    src = src[:i] + "\n" + card + src[i:]

    # entrée dans le JSON-LD Blog
    def add_post(m):
        block = m.group(1)
        try:
            obj = json.loads(block)
        except json.JSONDecodeError:
            log("  ! JSON-LD Blog illisible, non modifié")
            return m.group(0)
        if obj.get("@type") != "Blog":
            return m.group(0)
        obj.setdefault("blogPost", []).insert(0, {
            "@type": "BlogPosting", "headline": data["title"], "url": url,
            "datePublished": iso,
            "author": {"@type": "Organization", "name": cfg["site_name"]},
        })
        body = json_safe(json.dumps(obj, ensure_ascii=False, indent=2))
        body = "\n".join("  " + line for line in body.splitlines())
        return f'<script type="application/ld+json">\n{body}\n  </script>'

    src = re.sub(r'<script type="application/ld\+json">\s*(\{.*?\})\s*</script>',
                 add_post, src, count=1, flags=re.S)
    return src


def updated_sitemap(cfg: dict, topic: dict, today: datetime) -> str:
    src = SITEMAP.read_text(encoding="utf-8")
    base = cfg["site_url"]
    url = f"{base}/blog/{topic['slug']}/"
    iso = today.strftime("%Y-%m-%d")
    if f"<loc>{url}</loc>" in src:
        log("  ! URL déjà dans sitemap.xml, non dupliquée")
        return src
    entry = (f"  <url><loc>{url}</loc><lastmod>{iso}</lastmod>"
             f"<changefreq>monthly</changefreq><priority>0.7</priority></url>\n")
    blog_line = re.search(r"[ \t]*<url><loc>" + re.escape(f"{base}/blog/") +
                          r"</loc>.*?</url>\n", src)
    if not blog_line:
        die("sitemap.xml : ligne de /blog/ introuvable")
    updated = re.sub(r"<lastmod>\d{4}-\d{2}-\d{2}</lastmod>",
                     f"<lastmod>{iso}</lastmod>", blog_line.group(0), count=1)
    return src[:blog_line.start()] + updated + entry + src[blog_line.end():]


def updated_rss(cfg: dict, topic: dict, data: dict, today: datetime) -> str:
    src = RSS.read_text(encoding="utf-8")
    base = cfg["site_url"]
    url = f"{base}/blog/{topic['slug']}/"
    if f"<link>{url}</link>" in src:
        log("  ! article déjà dans rss.xml, non dupliqué")
        return src
    stamp = (f"{JOURS_EN[today.weekday()]}, {today.day:02d} "
             f"{MOIS_EN[today.month - 1]} {today.year} 09:00:00 +0200")
    item = f"""
    <item>
      <title>{esc(data['title'])}</title>
      <link>{url}</link>
      <guid isPermaLink="true">{url}</guid>
      <pubDate>{stamp}</pubDate>
      <category>{esc(data['category'])}</category>
      <description>{esc(data['lede'])}</description>
    </item>
"""
    src = re.sub(r"<lastBuildDate>.*?</lastBuildDate>",
                 f"<lastBuildDate>{stamp}</lastBuildDate>", src, count=1)
    i = src.find("</image>")
    if i < 0:
        die("rss.xml : balise </image> introuvable")
    i += len("</image>\n")
    return src[:i] + item + src[i:]


# ───────────────────────────── contrôles finaux ─────────────────────────────

def selfcheck(article_html: str, index_html: str, sitemap: str, rss: str) -> None:
    import xml.dom.minidom as minidom

    blocks = re.findall(r'<script type="application/ld\+json">(.*?)</script>',
                        article_html, re.S)
    if len(blocks) != 3:
        die(f"article : {len(blocks)} bloc(s) JSON-LD au lieu de 3")
    types = []
    for b in blocks:
        try:
            types.append(json.loads(b)["@type"])
        except json.JSONDecodeError as e:
            die(f"article : JSON-LD invalide — {e}")
    if types != ["Article", "BreadcrumbList", "FAQPage"]:
        die(f"article : types JSON-LD inattendus {types}")
    ok(f"JSON-LD valide ({', '.join(types)})")

    faq_ld = json.loads(blocks[2])["mainEntity"]
    visible = re.findall(
        r'<div class="blog-faq-item">\s*<h3>(.*?)</h3>\s*<p>(.*?)</p>',
        article_html, re.S)
    if len(visible) != len(faq_ld):
        die(f"FAQ : {len(visible)} bloc(s) visible(s) pour {len(faq_ld)} balisé(s)")
    for (q, a), entry in zip(visible, faq_ld):
        if html_mod.unescape(q) != entry["name"] or html_mod.unescape(a) != entry["acceptedAnswer"]["text"]:
            die("FAQ : le texte visible diffère du balisage FAQPage")
    ok(f"FAQ visible identique au FAQPage ({len(faq_ld)}/{len(faq_ld)})")

    desc = re.search(r'<meta name="description" content="([^"]*)"', article_html)
    if not desc or len(desc.group(1)) >= 155:
        die("article : meta description absente ou trop longue")
    ok(f"meta description {len(desc.group(1))} caractères")

    for name, blob in (("sitemap.xml", sitemap), ("rss.xml", rss)):
        try:
            minidom.parseString(blob)
        except Exception as e:
            die(f"{name} : XML mal formé — {e}")
    ok("sitemap.xml et rss.xml bien formés")

    for tag in ("</html>", "</body>", "</main>", "</article>"):
        if tag not in article_html:
            die(f"article : balise {tag} manquante")
    if index_html.count("<article") != index_html.count("</article"):
        die("blog/index.html : balises <article> déséquilibrées")
    ok("structure HTML complète")


# ───────────────────────────────── main ─────────────────────────────────

def main() -> int:
    ap = argparse.ArgumentParser(description="Génère un article de blog.")
    ap.add_argument("--dry-run", action="store_true",
                    help="génère et contrôle sans rien écrire")
    ap.add_argument("--mock", action="store_true",
                    help="charge de test au lieu de l'API (implique --dry-run)")
    ap.add_argument("--topic", type=int, default=None,
                    help="force le numéro de sujet à traiter")
    args = ap.parse_args()
    dry = args.dry_run or args.mock

    log("═" * 62)
    log(f"  Génération d'article — {datetime.now(timezone.utc):%Y-%m-%d %H:%M UTC}")
    if args.mock:
        log("  MODE MOCK : aucune requête OpenAI, écriture désactivée")
    elif dry:
        log("  MODE DRY-RUN : aucune écriture sur disque")
    log("═" * 62)

    step("lecture de blog-config.json")
    cfg = load_config()
    ok(f"{cfg['site_name']} — {cfg['site_url']}")

    step("lecture des sujets de BLOG_WORKFLOW.md")
    topics = parse_topics()
    ok(f"{len(topics)} sujets au tableau")

    step("inventaire des articles existants")
    done, slugs = scan_existing(cfg["site_slug"])
    ok(f"{len(slugs)} article(s) en ligne, {len(done)} marqueur(s) trouvé(s)")

    topic = pick_topic(topics, done, slugs, args.topic)
    log(f"  → sujet retenu : {topic['n']} · {topic['title']}")
    log(f"    slug : /blog/{topic['slug']}/")

    target_dir = BLOG_DIR / topic["slug"]
    if target_dir.exists():
        die(f"/blog/{topic['slug']}/ existe déjà — rien n'est écrasé")

    step("relecture du gabarit depuis l'article de référence")
    ref = reference_article()
    tpl = load_template(ref)
    ok(f"gabarit relu depuis /blog/{ref.parent.name}/ ({len(tpl)} fragments)")

    if args.mock:
        step("chargement de la charge de test")
        payload = build_mock_payload(cfg)
    else:
        payload = call_openai(cfg, topic)

    step("validation de la réponse")
    data = validate(payload, cfg)
    ok(f"{data['word_count']} mots · {len(data['sections'])} sections · "
       f"{len(data['faq'])} questions · lecture {data['read_minutes']} min")

    step("rendu des fichiers")
    today = datetime.now(timezone.utc)
    article_html = render_article(cfg, tpl, topic, data, today)
    index_html = updated_blog_index(cfg, topic, data, today)
    sitemap_xml = updated_sitemap(cfg, topic, today)
    rss_xml = updated_rss(cfg, topic, data, today)
    ok(f"article {len(article_html):,} octets".replace(",", " "))

    step("contrôles avant écriture")
    selfcheck(article_html, index_html, sitemap_xml, rss_xml)

    if dry:
        log("")
        log("─" * 62)
        log(f"  TITRE      {data['title']}")
        log(f"  SLUG       /blog/{topic['slug']}/")
        log(f"  CATÉGORIE  {data['category']}")
        log(f"  META       {data['meta_description']}")
        log("─" * 62)
        log("")
        log("Dry-run terminé : aucun fichier écrit.")
        return EXIT_OK

    step("écriture")
    target_dir.mkdir(parents=True, exist_ok=False)
    (target_dir / "index.html").write_text(article_html, encoding="utf-8")
    BLOG_INDEX.write_text(index_html, encoding="utf-8")
    SITEMAP.write_text(sitemap_xml, encoding="utf-8")
    RSS.write_text(rss_xml, encoding="utf-8")
    ok(f"blog/{topic['slug']}/index.html")
    ok("blog/index.html · sitemap.xml · rss.xml")

    log("")
    log(f"Article publié : {cfg['site_url']}/blog/{topic['slug']}/")
    return EXIT_OK


if __name__ == "__main__":
    try:
        sys.exit(main())
    except SystemExit:
        raise
    except Exception as exc:  # filet de sécurité : jamais de trace nue en CI
        log(f"✗ erreur inattendue : {type(exc).__name__} : {exc}")
        sys.exit(EXIT_ERROR)
