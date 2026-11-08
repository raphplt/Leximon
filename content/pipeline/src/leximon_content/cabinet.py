"""The cabinet of each published card, which patrons open from its sheet: the word's use in books
since 1800 (Google Books Ngram, CC BY 3.0), its Littré article (public domain text) and its family
among the words of the Littré and the catalogue. No call to a model.

Each cabinet is a JSON file named after its content (`cabinet/<card>.<hash12>.json`) in
`data/cabinet/out`, listed by card in `rendered.json`; `catalog:publish` serves those of the
release it publishes, like the engravings.
"""

import hashlib
import json
import unicodedata
from collections.abc import Mapping, Sequence
from dataclasses import dataclass
from pathlib import Path

from . import littre, ngram
from .config import DATA_DIR
from .release import RELEASES_DIR, latest_release

OUT_DIR = DATA_DIR / "cabinet" / "out"
RENDERED_FILE = OUT_DIR / "rendered.json"
#: Published paths start with this folder, relative to the catalogue root (and to OUT_DIR).
PUBLISHED_FOLDER = "cabinet"
HASH_LENGTH = 12

#: The longest articles of the Littré run to pages: a cabinet keeps what a phone screen can hold.
MAX_ARTICLES = 2
MAX_SENSES = 12
MAX_SENSE_CITATIONS = 3
MAX_HISTORY = 10
MAX_HISTORY_CITATIONS = 2
MAX_TEXT = 600
MAX_FAMILY = 8
#: A base word shares at least its first letters with the word (arc, arcure; cep, écepper):
#: the Littré's etymology also opens on words that are not one ("Ce mot paraît venir…").
BASE_STEM = 3


@dataclass(frozen=True)
class CatalogWord:
    id: str
    word: str


def clip(text: str, limit: int = MAX_TEXT) -> str:
    text = " ".join(text.split())
    return text if len(text) <= limit else text[: limit - 1].rstrip() + "…"


def _citations(citations: Sequence[littre.Citation], limit: int) -> list[dict[str, str]]:
    return [
        {"text": clip(c.text), "author": c.author, "reference": c.reference}
        for c in citations[:limit]
        if c.text.strip()
    ]


def article(entry: littre.Entry) -> dict[str, object]:
    return {
        "nature": entry.nature,
        "senses": [
            {
                "number": sense.number,
                "definition": clip(sense.definition),
                "citations": _citations(sense.citations, MAX_SENSE_CITATIONS),
            }
            for sense in entry.senses[:MAX_SENSES]
        ],
        "etymology": clip(entry.etymology) or None,
        "history": [
            {
                "century": item.century,
                "citations": _citations(item.citations, MAX_HISTORY_CITATIONS),
            }
            for item in entry.history[:MAX_HISTORY]
        ],
    }


def entries_of(
    word: str, index: Mapping[str, tuple[littre.Entry, ...]]
) -> tuple[littre.Entry, ...]:
    """The word's homographs that define something, the first ones first."""
    found = index.get(word.lower(), ())
    return tuple(entry for entry in found if entry.senses)[:MAX_ARTICLES]


def _folded(text: str) -> str:
    decomposed = unicodedata.normalize("NFD", text.lower())
    return "".join(char for char in decomposed if not unicodedata.combining(char))


def plausible_base(word: str, base: str) -> bool:
    stem = _folded(base)[:BASE_STEM]
    return len(base) >= BASE_STEM and stem in _folded(word)


def bases(
    cards: Sequence[CatalogWord], index: Mapping[str, tuple[littre.Entry, ...]]
) -> dict[str, str]:
    """Card id -> the word it derives from, as the Littré names it."""
    found: dict[str, str] = {}
    for card in cards:
        entries = entries_of(card.word, index)
        base = littre.base_entry(entries[0], index) if entries else None
        if base is not None and plausible_base(card.word, base.headword):
            found[card.id] = base.headword.lower()
    return found


def family(
    card: CatalogWord, cards: Sequence[CatalogWord], base_of: Mapping[str, str]
) -> list[dict[str, object]]:
    """The word it derives from, then the catalogue's words derived from it, then those derived
    from the same word. A word of the catalogue links to its card."""
    card_of = {other.word.lower(): other.id for other in cards}
    word = card.word.lower()
    base = base_of.get(card.id)
    members: list[dict[str, object]] = []
    if base is not None:
        members.append({"word": base, "cardId": card_of.get(base), "relation": "base"})
    for other in cards:
        if other.id == card.id:
            continue
        if base_of.get(other.id) == word:
            members.append({"word": other.word, "cardId": other.id, "relation": "derived"})
        elif base is not None and base_of.get(other.id) == base:
            members.append({"word": other.word, "cardId": other.id, "relation": "sibling"})
    return members[:MAX_FAMILY]


def cabinet_of(
    card: CatalogWord,
    index: Mapping[str, tuple[littre.Entry, ...]],
    usage: Sequence[float] | None,
    members: list[dict[str, object]],
) -> dict[str, object]:
    return {
        "word": card.word,
        "usage": None
        if usage is None
        else {"from": ngram.FIRST_DECADE, "step": 10, "perBillion": list(usage)},
        "articles": [article(entry) for entry in entries_of(card.word, index)],
        "family": members,
    }


def published_path(card_id: str, content: bytes) -> str:
    digest = hashlib.sha256(content).hexdigest()[:HASH_LENGTH]
    return f"{PUBLISHED_FOLDER}/{card_id}.{digest}.json"


def release_cards(releases_dir: Path = RELEASES_DIR) -> list[CatalogWord]:
    release = latest_release(releases_dir)
    if release is None:
        return []
    return [
        CatalogWord(str(card["id"]), str(card["word"]))
        for path in sorted(release.glob("collections/*.json"))
        for card in json.loads(path.read_text(encoding="utf-8"))["cards"]
    ]


def build(out_dir: Path = OUT_DIR) -> int:
    """Writes the cabinet of every card of the latest release. Returns the number written."""
    cards = release_cards()
    index = littre.index()
    base_of = bases(cards, index)
    rendered: dict[str, str] = {}
    (out_dir / PUBLISHED_FOLDER).mkdir(parents=True, exist_ok=True)
    for card in cards:
        cabinet = cabinet_of(card, index, ngram.usage(card.word), family(card, cards, base_of))
        content = json.dumps(cabinet, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
        path = published_path(card.id, content)
        (out_dir / path).write_bytes(content)
        rendered[card.id] = path
    kept = set(rendered.values())
    for stale in (out_dir / PUBLISHED_FOLDER).glob("*.json"):
        if f"{PUBLISHED_FOLDER}/{stale.name}" not in kept:
            stale.unlink()
    (out_dir / "rendered.json").write_text(
        json.dumps(rendered, ensure_ascii=False, indent=2, sort_keys=True) + "\n", encoding="utf-8"
    )
    return len(rendered)
