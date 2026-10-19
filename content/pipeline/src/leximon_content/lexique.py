"""Lexique 3.83 (CC BY-SA 4.0): word forms, and how often a word is heard in film subtitles.
Only derived values leave this module, never Lexique's rows."""

import csv
from collections import defaultdict
from functools import cache
from pathlib import Path

from .config import LEXIQUE_FILE


def spelling(word: str) -> str:
    """Lexique spells the ligatures out (coeur, oeuvre), the Littré does not (cœur, œuvre)."""
    return word.lower().replace("œ", "oe").replace("æ", "ae")


@cache
def _rows(path: Path = LEXIQUE_FILE) -> tuple[tuple[str, str, float], ...]:
    """(form, lemma, lemma frequency in subtitles per million words)."""
    with path.open(encoding="utf-8", newline="") as file:
        return tuple(
            (row["ortho"].lower(), row["lemme"].lower(), float(row["freqlemfilms2"]))
            for row in csv.DictReader(file, delimiter="\t")
        )


@cache
def forms() -> dict[str, frozenset[str]]:
    """Lemma -> its inflected forms, in Lexique's spelling."""
    found: dict[str, set[str]] = defaultdict(set)
    for form, lemma, _ in _rows():
        found[lemma].add(form)
    return {lemma: frozenset(f) for lemma, f in found.items()}


def forms_of(word: str, lemma_forms: dict[str, frozenset[str]]) -> set[str]:
    """Forms of a Littré headword, in both spellings when it has a ligature."""
    spelled = spelling(word)
    found = set(lemma_forms.get(spelled, ()))
    if spelled == word:
        return found
    return found | {form.replace("oe", "œ").replace("ae", "æ") for form in found}


@cache
def _spoken() -> dict[str, float]:
    found: dict[str, float] = {}
    for _, lemma, films in _rows():
        found[lemma] = max(films, found.get(lemma, 0.0))
    return found


def spoken_frequency(word: str) -> float:
    """Occurrences per million words in film subtitles: everyday spoken use, which the written
    corpus of Ngram underrates (tournevis, torticolis)."""
    return _spoken().get(spelling(word), 0.0)
