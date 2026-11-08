"""The reserve: words patrons may "dénicher" before they become cards. It holds exactly the words
that `select` could still pick (pre-screened as promising, never drafted, never published), with
the card id each would get, so that a reserved id is the future card's id.

Patrons choose by the word and its meaning alone: the reserve never carries a rarity or a
frequency."""

import json
from collections.abc import Iterable, Mapping
from dataclasses import dataclass
from datetime import date
from pathlib import Path

from . import config, littre
from .release import RELEASES_DIR, slug
from .selection import Candidate

RESERVE_FILE = config.REPO_ROOT / "content" / "reserve" / "reserve.json"
MAX_DEFINITION_CHARS = 240


@dataclass(frozen=True)
class Published:
    ids: frozenset[str]
    words: frozenset[str]


def published(releases_dir: Path = RELEASES_DIR) -> Published:
    """Every card of every release ever written: a word published once is never offered again,
    even if a later release dropped it."""
    ids: set[str] = set()
    words: set[str] = set()
    for path in releases_dir.glob("*/collections/*.json"):
        for card in json.loads(path.read_text(encoding="utf-8"))["cards"]:
            ids.add(str(card["id"]))
            words.add(str(card["word"]).lower())
    return Published(frozenset(ids), frozenset(words))


def clip(text: str, limit: int = MAX_DEFINITION_CHARS) -> str:
    """The text cut at a word boundary, with an ellipsis, so that it stays within `limit`."""
    text = " ".join(text.split())
    if len(text) <= limit:
        return text
    head = text[: limit - 1]
    if " " in head:
        head = head.rsplit(" ", 1)[0]
    return head.rstrip(" ,;:.–-") + "…"


def first_sense(entries: Iterable[littre.Entry]) -> tuple[str, str] | None:
    """(definition, nature) of the first entry with a defined first sense."""
    for entry in entries:
        if entry.senses and entry.senses[0].definition.strip():
            return entry.senses[0].definition, entry.nature
    return None


def build(
    pool: Iterable[Candidate],
    screened: Mapping[str, Mapping[str, object]],
    entries: Mapping[str, tuple[littre.Entry, ...]],
    released: Published,
    drafted: frozenset[str],
) -> tuple[list[dict[str, object]], int]:
    """(rows of the reserve sorted by id, number of words dropped because another word already
    takes their id). `pool` is `selection.candidate_pool()`, `drafted` the words of every run."""
    by_id: dict[str, dict[str, object]] = {}
    collisions = 0
    for candidate in sorted(pool, key=lambda c: c.word):
        word = candidate.word
        if screened.get(word, {}).get("suitability") != "ok":
            continue
        if word in drafted or word in released.words:
            continue
        card_id = slug(word)
        if not card_id or card_id in released.ids:
            continue
        sense = first_sense(entries.get(word, ()))
        if sense is None:
            continue
        if card_id in by_id:
            collisions += 1
            continue
        definition, nature = sense
        by_id[card_id] = {
            "id": card_id,
            "word": word,
            "definition": clip(definition),
            # Card themes are only given when a card is drafted; no reserved word has one yet.
            "theme": None,
            "partOfSpeech": nature.strip() or None,
        }
    return [by_id[i] for i in sorted(by_id)], collisions


def next_version(path: Path, today: date) -> str:
    """Today's date and a number, one more than the file's if it was written today."""
    number = 1
    if path.exists():
        previous = str(json.loads(path.read_text(encoding="utf-8")).get("version", ""))
        day, _, count = previous.partition(".")
        if day == today.isoformat() and count.isdigit():
            number = int(count) + 1
    return f"{today.isoformat()}.{number}"


def write(rows: list[dict[str, object]], version: str, path: Path = RESERVE_FILE) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    content = json.dumps({"version": version, "words": rows}, ensure_ascii=False, indent=2)
    path.write_text(content + "\n", encoding="utf-8")
