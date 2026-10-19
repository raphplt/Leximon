"""Picks the words of a drafting batch: candidates from Wiktionnaire categories that the Littré
defines, spread across modern frequency bands and themes. Deterministic for a given seed."""

import random
import re
from dataclasses import asdict, dataclass

from . import lexique, littre, wiktionary

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

SIMPLE_WORD = re.compile(r"^[a-zàâäçéèêëîïôöûùüÿœæ'-]+$")
#: Above this modern frequency score (log10 of occurrences per million + 1), a word is too common.
MAX_SCORE = 1.5
#: Frequency bands (inclusive lower bound, exclusive upper bound) and how many words to draw.
BANDS = ((0.8, MAX_SCORE + 1e-9, 8), (0.3, 0.8, 8), (1e-9, 0.3, 8), (0.0, 1e-9, 8))


@dataclass(frozen=True)
class Candidate:
    word: str
    frequency_score: float
    categories: tuple[str, ...]
    pick_reason: str


def candidates() -> dict[str, Candidate]:
    """Single words tagged in at least one category, defined by the Littré, not too common."""
    index = littre.index()
    tagged: dict[str, set[str]] = {}
    for key in wiktionary.CATEGORIES:
        for title in wiktionary.category_members(key):
            word = title.lower()
            if SIMPLE_WORD.match(word) and word in index:
                tagged.setdefault(word, set()).add(key)
    found: dict[str, Candidate] = {}
    for word, keys in tagged.items():
        score = lexique.frequency(word).score
        if score <= MAX_SCORE:
            found[word] = Candidate(word, round(score, 3), tuple(sorted(keys)), "")
    return found


def select(seed: int = 2026, insults: int = 10, odd_words: int = 8) -> list[Candidate]:
    rng = random.Random(seed)
    pool = candidates()
    index = littre.index()
    chosen: dict[str, Candidate] = {}

    def take(words: list[str], count: int, reason: str) -> None:
        available = sorted(w for w in words if w not in chosen)
        for word in rng.sample(available, min(count, len(available))):
            base = pool.get(word) or Candidate(
                word, round(lexique.frequency(word).score, 3), (), ""
            )
            chosen[word] = Candidate(base.word, base.frequency_score, base.categories, reason)

    take([w for w, c in pool.items() if "insulte" in c.categories], insults, "insulte")
    take([w for w in ODD_WORDS if w in index], odd_words, "loufoque")
    for low, high, count in BANDS:
        band = [w for w, c in pool.items() if low <= c.frequency_score < high]
        take(band, count, f"fréquence {low:g}–{min(high, MAX_SCORE):g}")
    return list(chosen.values())


def as_rows(selected: list[Candidate]) -> list[dict[str, object]]:
    return [asdict(candidate) for candidate in selected]
