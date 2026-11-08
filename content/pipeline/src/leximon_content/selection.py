"""Picks the words of a drafting batch from the whole Littré, spread across the rarity tiers that
the Ngram frequency predicts. Deterministic for a given seed."""

import json
import random
import re
from collections.abc import Iterable, Sequence
from dataclasses import asdict, dataclass
from datetime import date
from pathlib import Path

from . import config, lexique, littre, ngram, rarity, wiktionary
from .exclusions import is_excluded
from .release import slug

#: Editorial seed list for the "odd words" theme, which has no Wiktionnaire category.
ODD_WORDS = (
    "calembredaine",
    "coquecigrue",
    "billevesée",
    "turlupinade",
    "faribole",
    "hurluberlu",
    "croquignole",
    "galimafrée",
    "escogriffe",
    "jocrisse",
    "olibrius",
    "matamore",
    "fanfreluche",
    "ripopée",
    "rogaton",
    "brimborion",
    "barguigner",
    "gourgandine",
    "coquefredouille",
)

#: Above this modern frequency (per billion words), a word is still in common use.
MAX_MODERN_FREQUENCY = 500
#: Above this frequency in film subtitles (per million words), everybody says the word, however
#: rarely it is written (tournevis, torticolis).
MAX_SPOKEN_FREQUENCY = 0.5
#: Insults may be more frequent: their old sense is what makes the card. Above this, the
#: word is too banal to carry it (peau, bête).
MAX_INSULT_FREQUENCY = 2000
#: A rare word made of one of these and a common word reads at a glance (renettoyer, insolide).
TRANSPARENT_PREFIXES = ("re", "ré", "dés", "in", "im", "sur", "pré", "contre")
#: Science terms rarely make good cards (docs/rnd/rarete.md); the model would flag them anyway.
SCIENCE = re.compile(
    r"^\s*Terme d[e']\s*(botanique|médecine|chimie|zoologie|anatomie|histoire naturelle|"
    r"chirurgie|minéralogie|physique|physiologie|pharmacie|géométrie|géologie|astronomie|"
    r"tératologie|entomologie|pathologie|mathématique|mécanique|métallurgie)"
)
#: Share of the batch for each predicted tier. Précieux is oversampled: only part of these
#: words will be confirmed as pépites, and obscure words are rejected more often.
TIER_SHARES = {"common": 0.35, "uncommon": 0.22, "rare": 0.15, "precious": 0.28}
#: Share of the batch reserved for the themes with a strong buzz potential.
INSULT_SHARE = 0.05
ODD_SHARE = 0.03
#: Words patrons reserved in the game ("dénicher un mot"), written by the API's export.
FINDS_FILE = config.DATA_DIR / "finds.json"
FOUND_REASON = "déniché"


@dataclass(frozen=True)
class Candidate:
    word: str
    #: Rarity from the frequency alone; a confirmed pépite can raise Précieux higher.
    predicted_rarity: str
    modern_per_billion: float
    categories: tuple[str, ...]
    pick_reason: str = ""


def is_transparent(word: str, natures: list[str], common_words: frozenset[str]) -> bool:
    """Words anyone understands without a card: participles, affixes, adverbs in -ment, and
    a prefix glued to a common word."""
    if all(nature.startswith("part.") or nature in ("préfixe", "suffixe") for nature in natures):
        return True
    if word.endswith("ment") and any(nature.startswith("adv") for nature in natures):
        return True
    return any(
        word.startswith(prefix) and word[len(prefix) :] in common_words
        for prefix in TRANSPARENT_PREFIXES
    )


def candidate_pool() -> list[Candidate]:
    """Simple Littré headwords with a known frequency, not science terms, not transparent
    derivatives, not excluded."""
    rule = rarity.rule_on(date.today())
    tagged: dict[str, set[str]] = {}
    for key in wiktionary.CATEGORIES:
        for title in wiktionary.category_members(key):
            tagged.setdefault(title.lower(), set()).add(key)
    frequencies = ngram.frequencies()
    common_words = frozenset(w for w, f in frequencies.items() if f.modern > MAX_MODERN_FREQUENCY)
    pool = []
    for headword, entries in littre.index().items():
        word = headword.lower()
        frequency = frequencies.get(word)
        if frequency is None or is_excluded(word):
            continue
        if is_transparent(word, [entry.nature for entry in entries], common_words):
            continue
        if any(SCIENCE.match(sense.definition) for e in entries for sense in e.senses[:1]):
            continue
        categories = tuple(sorted(tagged.get(word, ())))
        if "insulte" in categories:
            if frequency.modern > MAX_INSULT_FREQUENCY:
                continue
        elif (
            frequency.modern > MAX_MODERN_FREQUENCY
            or lexique.spoken_frequency(word) > MAX_SPOKEN_FREQUENCY
        ):
            continue
        predicted = rarity.rarity(frequency, pepite=False, rule=rule)
        assert predicted is not None  # the frequency is known
        pool.append(Candidate(word, predicted, round(frequency.modern, 3), categories))
    return pool


@dataclass(frozen=True)
class Find:
    id: str
    word: str


class FindsError(Exception):
    """finds.json does not have the expected shape."""


def load_finds(path: Path = FINDS_FILE) -> list[Find]:
    """The reserved words, in the file's order; none when the file is absent."""
    if not path.exists():
        return []
    data = json.loads(path.read_text(encoding="utf-8"))
    words = data.get("words") if isinstance(data, dict) else None
    if not isinstance(words, list):
        raise FindsError(f"{path} : une liste « words » est attendue")
    finds = []
    for item in words:
        if not (
            isinstance(item, dict)
            and isinstance(item.get("id"), str)
            and isinstance(item.get("word"), str)
            and item["word"].strip()
        ):
            raise FindsError(f"{path} : entrée invalide {item!r}")
        finds.append(Find(item["id"], item["word"].strip().lower()))
    return finds


def match_finds(finds: Sequence[Find], pool: Iterable[Candidate]) -> tuple[list[str], list[Find]]:
    """(words of the pool that patrons found, finds absent from the pool). A find matches by its
    word or by its card id."""
    by_word = {c.word: c for c in pool}
    by_id = {slug(word): word for word in by_word}
    placed: list[str] = []
    missing: list[Find] = []
    for find in finds:
        word = find.word if find.word in by_word else by_id.get(find.id)
        if word is None:
            missing.append(find)
        elif word not in placed:
            placed.append(word)
    return placed, missing


def pick(
    pool: Iterable[Candidate],
    size: int,
    seed: int,
    exclude: frozenset[str] = frozenset(),
    first: Sequence[str] = (),
) -> list[Candidate]:
    """The words of `first` (found by patrons), then themed words, then each predicted tier in
    its share. Words in `first` all count toward `size` and are never left out, even beyond it.
    Words in `exclude` (already drafted in an earlier run) are skipped."""
    rng = random.Random(seed)
    available = sorted((c for c in pool if c.word not in exclude), key=lambda c: c.word)
    chosen: dict[str, Candidate] = {}

    def keep(candidate: Candidate, reason: str) -> None:
        chosen[candidate.word] = Candidate(**{**asdict(candidate), "pick_reason": reason})

    def take(candidates: list[Candidate], count: int, reason: str) -> None:
        fresh = [c for c in candidates if c.word not in chosen]
        for candidate in rng.sample(fresh, max(0, min(count, len(fresh)))):
            keep(candidate, reason)

    by_word = {c.word: c for c in available}
    for word in first:
        if word in by_word:
            keep(by_word[word], FOUND_REASON)
    take([c for c in available if "insulte" in c.categories], round(size * INSULT_SHARE), "insulte")
    take([c for c in available if c.word in ODD_WORDS], round(size * ODD_SHARE), "loufoque")
    remaining = size - len(chosen)
    for tier, share in TIER_SHARES.items():
        count = min(round(remaining * share), size - len(chosen))
        take([c for c in available if c.predicted_rarity == tier], count, rarity.LABELS[tier])
    return list(chosen.values())


def as_rows(selected: list[Candidate]) -> list[dict[str, object]]:
    return [asdict(candidate) for candidate in selected]
