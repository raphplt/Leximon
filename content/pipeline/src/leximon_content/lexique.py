"""Modern word frequencies from Lexique 3.83 (CC BY-SA 4.0). Only derived scores leave this module."""

import csv
import math
from dataclasses import dataclass
from functools import cache
from pathlib import Path

from .config import LEXIQUE_FILE


@dataclass(frozen=True)
class Frequency:
    #: Occurrences per million words in film subtitles (spoken, contemporary).
    films: float
    #: Occurrences per million words in books.
    books: float

    @property
    def score(self) -> float:
        """Commonness on a log scale: 0 for a word absent from both corpora."""
        return math.log10(1 + self.films + self.books)


@cache
def frequencies(path: Path = LEXIQUE_FILE) -> dict[str, Frequency]:
    """Lemma frequencies, keeping the highest value when a lemma has several categories."""
    found: dict[str, Frequency] = {}
    with path.open(encoding="utf-8", newline="") as file:
        for row in csv.DictReader(file, delimiter="\t"):
            lemma = row["lemme"].lower()
            current = Frequency(
                films=float(row["freqlemfilms2"]), books=float(row["freqlemlivres"])
            )
            previous = found.get(lemma)
            if previous is None or current.score > previous.score:
                found[lemma] = current
    return found


def frequency(word: str) -> Frequency:
    return frequencies().get(word.lower(), Frequency(films=0.0, books=0.0))
