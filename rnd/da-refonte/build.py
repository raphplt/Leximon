"""Builds maquettes.html: five art directions on the same four screens, self-contained."""

import base64
import glob
import io
import json
from pathlib import Path

from PIL import Image, ImageChops, ImageFilter

HERE = Path(__file__).parent
ROOT = HERE.parent.parent
CATALOG = ROOT / "apps/web/public/catalog"


def b64(data: bytes) -> str:
    return base64.b64encode(data).decode()


def fonts_css() -> str:
    rules = []
    for font in json.loads((HERE / "fonts/fonts.json").read_text()):
        data = b64((HERE / "fonts" / font["file"]).read_bytes())
        css = font["css"]
        start = css.index("url(")
        end = css.index(")", start) + 1
        rules.append(css[:start] + f"url(data:font/woff2;base64,{data})" + css[end:])
    return "\n".join(rules)


def tile(blur: float, strength: int, size: int = 256) -> str:
    """A dark speckle tile, baked once: live SVG turbulence is too slow on phones."""
    noise = Image.effect_noise((size, size), 64).filter(ImageFilter.GaussianBlur(blur))
    fine = Image.effect_noise((size, size), 40)
    mixed = ImageChops.add(noise, fine, scale=2)
    alpha = mixed.point(lambda v: max(0, min(255, (v - 120) * strength // 10)))
    image = Image.new("RGBA", (size, size), (20, 12, 6, 0))
    image.putalpha(alpha)
    buffer = io.BytesIO()
    image.save(buffer, "WEBP", quality=70)
    return f"data:image/webp;base64,{b64(buffer.getvalue())}"


def load_cards() -> dict:
    cards = {}
    for path in glob.glob(str(CATALOG / "collections/*.json")):
        for card in json.loads(Path(path).read_text())["cards"]:
            cards[card["word"]] = card
    return cards


CARDS = load_cards()


def ink(word: str) -> str:
    rel = CARDS[word]["engraving"]["ink"]
    return f"data:image/webp;base64,{b64((CATALOG / rel).read_bytes())}"


def seal() -> str:
    path = next(iter((CATALOG / "gravures").glob("collection-fondateurs.*.ink.webp")))
    return f"data:image/webp;base64,{b64(path.read_bytes())}"


WORDS = {
    "main": "abajoue",
    "legend": "charivarieur",
    "grid": ["faisandier", "maremme", "revancher", "abalourdir"],
}
for word in [WORDS["main"], WORDS["legend"], *WORDS["grid"]]:
    assert word in CARDS, word

FLEURON = (
    '<svg class="fleuron" viewBox="0 0 120 16" aria-hidden="true">'
    '<path d="M0 8h42M78 8h42" stroke="currentColor" stroke-width=".8"/>'
    '<path d="M60 1.5c4.5 2.2 6.5 4.3 6.5 6.5s-2 4.3-6.5 6.5c-4.5-2.2-6.5-4.3-6.5-6.5s2-4.3 6.5-6.5z" fill="currentColor"/>'
    '<circle cx="47" cy="8" r="1.5" fill="currentColor"/><circle cx="73" cy="8" r="1.5" fill="currentColor"/>'
    "</svg>"
)

RINCEAU = (
    '<svg class="rinceau" viewBox="0 0 26 120" preserveAspectRatio="none" aria-hidden="true">'
    '<path d="M13 0c9 10 9 20 0 30s-9 20 0 30 9 20 0 30-9 20 0 30" fill="none" stroke="currentColor" stroke-width="1.6"/>'
    '<g fill="currentColor"><circle cx="21" cy="15" r="2.4"/><circle cx="5" cy="45" r="2.4"/>'
    '<circle cx="21" cy="75" r="2.4"/><circle cx="5" cy="105" r="2.4"/></g>'
    "</svg>"
)

CORNER = (
    '<svg class="fer" viewBox="0 0 30 30" aria-hidden="true"><path d="M1 29V1h28" fill="none" stroke="currentColor"/>'
    '<path d="M5 25V5h20" fill="none" stroke="currentColor" stroke-width=".6"/>'
    '<path d="M8 8c6 0 9 3 9 9-6 0-9-3-9-9z" fill="currentColor"/></svg>'
)

MAIL = (
    '<svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M3 6h18v12H3zM3 7l9 7 9-7" fill="none" '
    'stroke="currentColor" stroke-width="1.6"/></svg>'
)


def mask(url: str, cls: str = "gr") -> str:
    return f'<span class="{cls}" style="--m:url({url})"></span>'


def full_card(word: str, cls: str = "") -> str:
    card = CARDS[word]
    return f"""
<article class="card {cls}">
  <div class="card-art">{mask(ink(word))}</div>
  <h4 class="card-word">{word}</h4>
  <p class="card-pos">{card["partOfSpeech"]}</p>
  <p class="card-def">{card["definition"]}</p>
  <footer class="card-foot"><span>Les Fondateurs</span><span>1/120 M</span></footer>
</article>"""


def mini_card(word: str) -> str:
    card = CARDS[word]
    return f"""<div class="mini"><div class="mini-art">{mask(ink(word))}</div><b>{word}</b><i>{card["partOfSpeech"]}</i></div>"""


def tabs(active: str) -> str:
    names = ["Album", "Défis", "Jouer", "Échanges", "Communauté"]
    items = "".join(
        f'<a class="{"on" if n == active else ""}">{n}</a>' for n in names
    )
    return f'<nav class="tabs">{items}</nav>'


BAR = f"""<div class="bar"><span class="lvl"><b>7</b></span><span class="xp"><i></i></span>
<span class="stock">5/6</span><span class="mailbox">{MAIL}</span></div>"""


def screen_play() -> str:
    return f"""
{BAR}
<div class="page">
  <p class="kicker">Sachet n<sup>o</sup> 1</p>
  <h3 class="title">Les Fondateurs</h3>
  <p class="tag">De l'abajoue à la logodiarrhée.</p>
  <div class="pack">
    <div class="pack-crimp">déchirer ici</div>
    <div class="pack-label">
      <span class="pack-maker">Leximon</span>
      {mask(seal(), "pack-seal")}
      <span class="pack-name">Les Fondateurs</span>
      <span class="pack-count">Cinq cartes</span>
    </div>
    <span class="wax">L</span>
  </div>
  <button class="cta">Ouvrir le sachet</button>
  <p class="note">Il te reste cinq sachets.</p>
  {FLEURON}
</div>
{tabs("Jouer")}"""


def screen_card(special: bool) -> str:
    word = WORDS["legend"] if special else WORDS["main"]
    label = "Légendaire" if special else "Courant"
    return f"""
{BAR}
<div class="page reveal">
  {full_card(word, "legend" if special else "")}
  <p class="freq"><em>Imprimé une fois sur 120 millions de mots.</em></p>
  <p class="rarity">{label}</p>
  <div class="row"><a class="link">Tout révéler</a><button class="cta small">Suivante</button></div>
</div>
{tabs("Jouer")}"""


def screen_album() -> str:
    letters = "".join(
        f'<a class="{"on" if c == "M" else ""}">{c}</a>' for c in "ABCDEFGHILMNOPQRSTUV"
    )
    minis = "".join(mini_card(w) for w in WORDS["grid"])
    return f"""
{BAR}
<div class="page album">
  <h3 class="title">Album</h3>
  <p class="tag">231 mots sur 1 561</p>
  <div class="search">Chercher un mot</div>
  <div class="chips"><a class="on">Tout</a><a>Fondateurs</a><a>Caractères</a><a>Métiers</a></div>
  <div class="album-body">
    <div class="grid">{minis}{mini_card("abajoue")}<div class="mini missing"><b>?</b><i>À trouver</i></div></div>
    <div class="letters">{letters}</div>
  </div>
</div>
{tabs("Album")}"""


def screen_challenge() -> str:
    options = [
        "Plaine marécageuse et malsaine du littoral.",
        "Vieille femme querelleuse.",
        "Étoffe de laine grossière.",
        "Petit pain sucré d'autrefois.",
    ]
    items = "".join(
        f'<li class="{"good" if i == 0 else ""}"><span class="num">{n}</span>{text}</li>'
        for i, (n, text) in enumerate(zip("abcd", options))
    )
    steps = "".join(
        f'<span class="{"done" if i < 3 else ""}"></span>' for i in range(5)
    )
    return f"""
{BAR}
<div class="page challenge">
  <p class="kicker">Défi du jour</p>
  <div class="steps">{steps}<span class="prize">Sachet bonus</span></div>
  <p class="steps-note">Encore deux réponses justes pour gagner ton sachet.</p>
  <h3 class="question">Que veut dire <em>maremme</em>&nbsp;?</h3>
  <ol class="options">{items}</ol>
  <p class="gain">+15 XP</p>
  {FLEURON}
</div>
{tabs("Défis")}"""


DIRECTIONS = [
    {
        "id": "dico",
        "num": "1",
        "name": "Le Dictionnaire",
        "era": "Imprimerie des XVIIIe et XIXe siècles",
        "pitch": "Tout le jeu devient une page imprimée : papier, encre noire, un seul rouge de rubrique, filets et fleurons. C'est le plus proche du Littré, et le plus lisible.",
        "risk": "Peut paraître sage si les récompenses ne sont pas très marquées.",
    },
    {
        "id": "reliure",
        "num": "2",
        "name": "La Reliure",
        "era": "Cuir et fers dorés",
        "pitch": "On joue sur la couverture d'un livre précieux : cuir sombre, filets et fers dorés, nerfs au dos pour les onglets. C'est le plus proche du thème sombre actuel.",
        "risk": "Devient vite « casino » si l'or n'est pas tenu. Moins de surface pour lire.",
    },
    {
        "id": "manuscrit",
        "num": "3",
        "name": "Le Manuscrit",
        "era": "Enluminure médiévale",
        "pitch": "Vélin, bleu lapis, vermillon et or, rinceaux dans les marges, titres en écriture gothique. C'est le plus spectaculaire et le plus marquant sur une capture.",
        "risk": "S'éloigne du Littré. Lourd sur tous les écrans, dur à tenir sur 60 écrans et sur mobile.",
    },
    {
        "id": "imagerie",
        "num": "4",
        "name": "L'Imagerie",
        "era": "Épinal et colportage",
        "pitch": "Bois gravé, gros caractères, aplats de pochoir rouges, bleus et jaunes légèrement décalés. C'est le plus populaire et le plus gai, dans l'esprit de D-022.",
        "risk": "Moins littéraire. Peut faire enfantin.",
    },
    {
        "id": "livre",
        "num": "5",
        "name": "Le Livre",
        "era": "Reliure, page et enluminure, une par fonction",
        "pitch": "La coque est une reliure de cuir, le contenu est une page imprimée, et l'enluminure est réservée aux plus hautes raretés. L'objet raconte la progression : plus la carte est rare, plus elle remonte vers le manuscrit.",
        "risk": "Le plus de travail : trois matières à tenir. C'est ma recommandation.",
    },
]


def direction(d: dict) -> str:
    phones = [
        ("Jouer", screen_play()),
        ("Carte commune", screen_card(False)),
        ("Carte légendaire", screen_card(True)),
        ("Album, avec les lettres", screen_album()),
        ("Défi", screen_challenge()),
    ]
    rendered = "".join(
        f'<figure class="phone"><figcaption>{name}</figcaption>'
        f'<div class="screen">{html}<div class="frame-ornaments">{CORNER}{CORNER}{CORNER}{CORNER}</div>'
        f'<div class="margin-vine">{RINCEAU}</div></div></figure>'
        for name, html in phones
    )
    return f"""
<section class="dir d-{d["id"]}" id="{d["id"]}">
  <header class="dir-head">
    <h2><span>{d["num"]}</span> {d["name"]}</h2>
    <p class="era">{d["era"]}</p>
    <p>{d["pitch"]}</p>
    <p class="risk">{d["risk"]}</p>
  </header>
  <div class="phones">{rendered}</div>
</section>"""


def main() -> None:
    style = (HERE / "style.css").read_text()
    style = style.replace("__PAPER__", tile(1.6, 3)).replace("__LEATHER__", tile(2.6, 16))
    links = "".join(f'<a href="#{d["id"]}">{d["num"]}. {d["name"]}</a>' for d in DIRECTIONS)
    html = f"""<!doctype html>
<html lang="fr"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Maquettes de direction artistique</title>
<style>{fonts_css()}</style><style>{style}</style></head>
<body>
<header class="intro">
  <h1>Leximon : cinq directions artistiques</h1>
  <p>Les mêmes écrans dans cinq esprits, avec de vraies gravures du jeu et des polices libres. Ce sont des essais de ton, pas des écrans finis : les ornements définitifs viendront de vrais livres anciens, et rien ici n'est encore jouable.</p>
  <nav>{links}</nav>
</header>
{"".join(direction(d) for d in DIRECTIONS)}
</body></html>"""
    (HERE / "maquettes.html").write_text(html)
    print(len(html) // 1024, "Ko")



def screen_play_page() -> str:
    rows = [("Défi du jour", "5 mots"), ("Énigme n<sup>o</sup> 12", "à trouver"), ("Mots à revoir", "8"), ("Récompense à prendre", "1")]
    items = "".join(f'<li><span>{a}</span><i></i><b>{b}</b></li>' for a, b in rows)
    return f"""
{BAR}
<div class="page today">
  <p class="kicker">Les Fondateurs</p>
  {pack_bookish()}
  <button class="cta">Ouvrir le sachet</button>
  <p class="note">Il te reste cinq sachets.</p>
  <h4 class="today-title">Aujourd'hui</h4>
  <ol class="today-list">{items}</ol>
</div>
{tabs("Jouer")}"""


def screen_play_seals() -> str:
    left = "".join(f'<span class="seal"><i>{a}</i><b>{b}</b></span>' for a, b in [("C", "Clan"), ("D", "Discussion"), ("J", "Joutes")])
    right = "".join(f'<span class="seal"><i>{a}</i><b>{b}</b></span>' for a, b in [("D", "Défi"), ("A", "Amis"), ("R", "Réglages")])
    return f"""
{BAR}
<div class="page seals">
  <p class="kicker">Les Fondateurs</p>
  <div class="seal-row"><div class="seal-col">{left}</div>{pack_bookish()}<div class="seal-col">{right}</div></div>
  <button class="cta">Ouvrir le sachet</button>
  <p class="note">Il te reste cinq sachets.</p>
  {FLEURON}
</div>
{tabs("Jouer")}"""


def pack_bookish() -> str:
    return f"""<div class="pack small"><div class="pack-crimp">déchirer ici</div><div class="pack-label"><span class="pack-maker">Leximon</span>{mask(seal(), "pack-seal")}<span class="pack-name">Les Fondateurs</span></div><span class="wax">L</span></div>"""


def pack_variants() -> str:
    current = f"""<div class="v v-actuel"><div class="v-teeth"></div><span class="v-maker">LEXIMON</span><span class="v-rosette">{mask(seal(), "pack-seal")}</span><span class="v-band">Les Fondateurs</span><span class="v-five">5 cartes</span><div class="v-teeth bottom"></div></div>"""
    paper = f"""<div class="v v-papier"><div class="v-fold"></div><div class="v-tag"><span class="pack-maker">Leximon</span>{mask(seal(), "pack-seal")}<span class="pack-name">Les Fondateurs</span><span class="pack-count">Cinq cartes</span></div><span class="wax">L</span></div>"""
    letter = f"""<div class="v v-pli"><span class="v-flap"></span><span class="v-name">Les Fondateurs</span><span class="wax big">L</span></div>"""
    book = f"""<div class="v v-fascicule"><span class="v-spine"></span><div class="v-cover">{mask(seal(), "pack-seal")}<span class="pack-name">Les Fondateurs</span></div><span class="v-string"></span><span class="v-knot"></span></div>"""
    items = [
        (current, "Le sachet actuel", "Teinté dans le ton du Livre. Rien à refaire dans la déchirure : c'est le moins cher et il reste le plus proche d'un booster."),
        (paper, "La pochette de papier", "Une pochette de graines ou d'herboriste. Même geste de déchirure, nouveau dessin sur les deux plateformes."),
        (letter, "Le pli cacheté", "On brise le cachet et on déplie. L'idée d'origine, mais tout le mot « sachet » change, et le geste aussi."),
        (book, "Le fascicule", "On coupe la ficelle et on ouvre. Le plus original, et le plus long à construire."),
    ]
    return "".join(f'<figure class="variant">{html}<figcaption><b>{title}</b><br>{text}</figcaption></figure>' for html, title, text in items)


def livre_page() -> None:
    style = (HERE / "style.css").read_text()
    style = style.replace("__PAPER__", tile(1.6, 3)).replace("__LEATHER__", tile(2.6, 16))
    phones = [("A. Page simplifiée, clair", screen_play_page(), ""), ("A. Page simplifiée, nuit", screen_play_page(), "nuit"), ("B. Sceaux autour du sachet, clair", screen_play_seals(), ""), ("Album, nuit", screen_album(), "nuit"), ("Défi, nuit", screen_challenge(), "nuit")]
    rendered = "".join(
        f'<figure class="phone {mode}"><figcaption>{name}</figcaption><div class="screen">{html}</div></figure>'
        for name, html, mode in phones
    )
    html = f"""<!doctype html>
<html lang="fr"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Le Livre : essais</title>
<style>{fonts_css()}</style><style>{style}</style></head>
<body>
<header class="intro">
  <h1>Le Livre : l'écran Jouer, la nuit et le sachet</h1>
  <p>Deux façons d'organiser l'écran Jouer, le thème de nuit, et quatre formes possibles pour le paquet. Tu tranches sur pièces.</p>
</header>
<section class="dir d-livre"><header class="dir-head"><h2>L'écran Jouer et le thème de nuit</h2>
<p>Version A : un sommaire de ce qui attend le joueur aujourd'hui remplace les boutons ronds. Version B : les boutons restent, en sceaux.</p></header>
<div class="phones">{rendered}</div></section>
<section class="dir d-livre"><header class="dir-head"><h2>Quatre formes pour le paquet</h2></header>
<div class="variants">{pack_variants()}</div></section>
</body></html>"""
    (HERE / "maquettes-livre.html").write_text(html)
    print(len(html) // 1024, "Ko")


main()
livre_page()
