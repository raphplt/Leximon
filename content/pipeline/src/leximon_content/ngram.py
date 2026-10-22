"""Word frequencies from Google Books Ngram, French corpus, 2019 release (CC BY 3.0, to credit).

The six 1-gram files (5 GB) are downloaded once, then filtered down to the forms of the Littré
headwords: `data/ngram/frequencies.tsv` is the only file the rest of the pipeline reads.
See docs/rnd/rarete.md.
"""

import gzip
import re
import statistics
from collections import defaultdict
from collections.abc import Iterable, Iterator
from concurrent.futures import ProcessPoolExecutor
from dataclasses import dataclass
from functools import cache
from pathlib import Path

import httpx

from . import lexique, littre
from .config import DATA_DIR, USER_AGENT

NGRAM_DIR = DATA_DIR / "ngram"
RAW_DIR = NGRAM_DIR / "raw"
FREQUENCIES_FILE = NGRAM_DIR / "frequencies.tsv"
BASE_URL = "http://storage.googleapis.com/books/ngrams/books/20200217/fre"
SHARDS = tuple(f"1-{i:05d}-of-00006.gz" for i in range(6))
TOTALS = "totalcounts-1"

FIRST_DECADE = 1800
DECADES = (2020 - FIRST_DECADE) // 10
MODERN = range(1990, 2020)
LITTRE_ERA = range(1800, 1900)

SIMPLE_WORD = re.compile(r"^[a-zàâäçéèêëîïôöûùüÿœæ]+$")
# Regular forms of first-group verbs, the bulk of the rare verbs in the Littré.
ER_ENDINGS = (
    "e", "es", "ent", "é", "ée", "és", "ées", "ait", "aient", "ant", "a", "èrent", "ons", "ez",
)  # fmt: skip


@dataclass(frozen=True)
class NgramFrequency:
    """Occurrences per billion words, all forms of the word summed."""

    modern: float
    littre_era: float
    #: False when no form of the word reaches Ngram's publication threshold (40 occurrences).
    attested: bool


# --- Target forms ---------------------------------------------------------------------------


def guessed_forms(word: str, nature: str) -> set[str]:
    forms = {word, word + "s", word + "x"}
    if "v." in nature and word.endswith("er"):
        forms |= {word[:-2] + ending for ending in ER_ENDINGS}
    if "adj" in nature:
        forms |= {word + "e", word + "es"}
    return forms


def assign_forms(
    lemma_forms: dict[str, set[str]], lexique_owners: dict[str, set[str]]
) -> dict[str, str]:
    """Form -> lemma. A lemma always owns its own spelling; any other form shared by several
    lemmas is dropped, since its counts cannot be split between them."""
    claims: dict[str, set[str]] = defaultdict(set)
    for lemma, forms in lemma_forms.items():
        for form in forms:
            claims[form].add(lemma)
    owner_of: dict[str, str] = {}
    for form, lemmas in claims.items():
        if form in lemmas:
            owner_of[form] = form
        elif len(lemmas | lexique_owners.get(form, set())) == 1:
            owner_of[form] = next(iter(lemmas))
    return owner_of


def target_forms() -> dict[str, str]:
    """Forms of every simple Littré headword. Compounds are left out: Ngram splits them."""
    lemma_lexique_forms = lexique.forms()
    owners: dict[str, set[str]] = defaultdict(set)
    for lemma, forms in lemma_lexique_forms.items():
        for form in forms:
            owners[form].add(lemma)
    lemma_forms: dict[str, set[str]] = {}
    for headword, entries in littre.index().items():
        word = headword.lower()
        if SIMPLE_WORD.match(word):
            nature = " ".join(entry.nature for entry in entries)
            lemma_forms[word] = guessed_forms(word, nature) | lexique.forms_of(
                word, lemma_lexique_forms
            )
    return assign_forms(lemma_forms, owners)


# --- Counting -------------------------------------------------------------------------------


def decade_counts(cells: Iterable[str]) -> list[int]:
    """`year,match_count,volume_count` cells -> match counts per decade since 1800."""
    counts = [0] * DECADES
    for cell in cells:
        year, count, _ = cell.split(",")
        if int(year) >= FIRST_DECADE:
            counts[(int(year) - FIRST_DECADE) // 10] += int(count)
    return counts


def count_forms(lines: Iterable[str], forms: set[str]) -> dict[str, list[int]]:
    counts: dict[str, list[int]] = {}
    for line in lines:
        token, _, rest = line.rstrip("\n").partition("\t")
        # Untagged lines only (the `_NOUN`… lines repeat them), lowercase spellings only:
        # capitalised ones mix in proper nouns (Paris, Louis).
        if token in forms:
            counts[token] = decade_counts(rest.split("\t"))
    return counts


def _count_shard(path: Path, forms: frozenset[str]) -> dict[str, list[int]]:
    with gzip.open(path, "rt", encoding="utf-8") as lines:
        return count_forms(lines, set(forms))


def mean_over(per_decade: list[float], years: range) -> float:
    first = (years.start - FIRST_DECADE) // 10
    return statistics.fmean(per_decade[first : first + len(years) // 10])


def frequencies_from_counts(
    form_counts: dict[str, list[int]], owner_of: dict[str, str], totals: list[int]
) -> dict[str, NgramFrequency]:
    lemma_counts: dict[str, list[int]] = defaultdict(lambda: [0] * DECADES)
    for form, counts in form_counts.items():
        target = lemma_counts[owner_of[form]]
        for decade, count in enumerate(counts):
            target[decade] += count
    result = {}
    for lemma in set(owner_of.values()):
        counts = lemma_counts.get(lemma, [0] * DECADES)
        per_billion = [1e9 * c / t for c, t in zip(counts, totals, strict=True)]
        result[lemma] = NgramFrequency(
            modern=mean_over(per_billion, MODERN),
            littre_era=mean_over(per_billion, LITTRE_ERA),
            attested=any(counts),
        )
    return result


# --- Files ----------------------------------------------------------------------------------


def download(client: httpx.Client, name: str) -> Path:
    """Downloads a file once, checking its size: a transfer cut at a gzip member boundary would
    otherwise read as a clean, shorter file."""
    path = RAW_DIR / name
    expected = int(client.head(f"{BASE_URL}/{name}").raise_for_status().headers["content-length"])
    if path.exists() and path.stat().st_size == expected:
        return path
    RAW_DIR.mkdir(parents=True, exist_ok=True)
    partial = path.with_suffix(".part")
    with client.stream("GET", f"{BASE_URL}/{name}") as response, partial.open("wb") as file:
        response.raise_for_status()
        for chunk in response.iter_bytes(1 << 20):
            file.write(chunk)
    if partial.stat().st_size != expected:
        raise RuntimeError(f"{name}: {partial.stat().st_size} bytes instead of {expected}")
    partial.rename(path)
    return path


def parse_totals(text: str) -> list[int]:
    totals = [0] * DECADES
    for cell in text.split():
        year, count, *_ = cell.split(",")
        if int(year) >= FIRST_DECADE:
            totals[(int(year) - FIRST_DECADE) // 10] += int(count)
    return totals


def build() -> int:
    """Downloads the corpus if needed and writes `frequencies.tsv`. Returns the number of words."""
    with httpx.Client(headers={"User-Agent": USER_AGENT}, timeout=60) as client:
        paths = [download(client, name) for name in SHARDS]
        totals = parse_totals(download(client, TOTALS).read_text(encoding="utf-8"))
    owner_of = target_forms()
    forms = frozenset(owner_of)
    form_counts: dict[str, list[int]] = {}
    with ProcessPoolExecutor() as pool:
        for counts in pool.map(_count_shard, paths, [forms] * len(paths)):
            form_counts.update(counts)
    frequencies = frequencies_from_counts(form_counts, owner_of, totals)
    with FREQUENCIES_FILE.open("w", encoding="utf-8") as out:
        out.write("lemma\tmodern\tlittre_era\tattested\n")
        for lemma, f in sorted(frequencies.items()):
            out.write(f"{lemma}\t{f.modern:.6g}\t{f.littre_era:.6g}\t{int(f.attested)}\n")
    return len(frequencies)


def _rows(path: Path) -> Iterator[list[str]]:
    with path.open(encoding="utf-8") as file:
        next(file)
        for line in file:
            yield line.rstrip("\n").split("\t")


@cache
def frequencies(path: Path = FREQUENCIES_FILE) -> dict[str, NgramFrequency]:
    return {
        lemma: NgramFrequency(float(modern), float(old), attested == "1")
        for lemma, modern, old, attested in _rows(path)
    }


def frequency(word: str) -> NgramFrequency | None:
    """None when Ngram cannot tell: compounds, and words outside the Littré."""
    return frequencies().get(word.lower())
