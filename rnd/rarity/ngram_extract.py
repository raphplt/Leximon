"""Spike: per-decade Google Books Ngram counts (fr, 2019 release) for the forms of Littré headwords.

Usage, from content/pipeline:
  uv run python ../../rnd/rarity/ngram_extract.py forms      # writes data/ngram/forms.tsv
  uv run python ../../rnd/rarity/ngram_extract.py shard 0    # streams one of the 6 shards

Download the shards first (5 GB, checked against their size), then filter them: only the counts
of the target forms are kept. The shards can be deleted afterwards.
"""

import gzip
import re
import sys
import urllib.request
from collections import defaultdict

from leximon_content import config, littre

NGRAM_DIR = config.DATA_DIR / "ngram"
BASE = "http://storage.googleapis.com/books/ngrams/books/20200217/fre"
SHARDS = 6
FIRST_DECADE = 1800
WORD = re.compile(r"^[a-zàâäçéèêëîïôöûùüÿœæ-]+$")
# Regular forms of first-group verbs, the bulk of the rare verbs in the Littré.
ER_ENDINGS = (
    "e",
    "es",
    "ent",
    "é",
    "ée",
    "és",
    "ées",
    "ait",
    "aient",
    "ant",
    "a",
    "èrent",
    "ons",
    "ez",
)


def lexique_forms() -> dict[str, set[str]]:
    forms: dict[str, set[str]] = defaultdict(set)
    with config.LEXIQUE_FILE.open(encoding="utf-8") as file:
        next(file)
        for line in file:
            ortho, _, lemma = line.split("\t", 3)[:3]
            forms[lemma.lower()].add(ortho.lower())
    return forms


def guessed_forms(word: str, nature: str) -> set[str]:
    forms = {word, word + "s", word + "x"}
    if "v." in nature and word.endswith("er"):
        forms |= {word[:-2] + ending for ending in ER_ENDINGS}
    if "adj" in nature:
        forms |= {word + "e", word + "es"}
    return forms


def build_forms() -> None:
    lexique = lexique_forms()
    candidates: dict[str, set[str]] = defaultdict(set)
    for headword, entries in littre.index().items():
        word = headword.lower()
        if not WORD.match(word):
            continue
        natures = " ".join(entry.nature for entry in entries)
        for form in guessed_forms(word, natures) | lexique.get(word, set()):
            candidates[form].add(word)
    # A form shared by several lemmas (other than the lemma itself) would mix their counts.
    owners: dict[str, set[str]] = defaultdict(set)
    for lemma, forms in lexique.items():
        for form in forms:
            owners[form].add(lemma)
    NGRAM_DIR.mkdir(parents=True, exist_ok=True)
    kept = 0
    with (NGRAM_DIR / "forms.tsv").open("w", encoding="utf-8") as out:
        for form, lemmas in sorted(candidates.items()):
            all_owners = lemmas | owners.get(form, set())
            if form in lemmas:
                out.write(f"{form}\t{form}\n")  # a lemma always counts its own spelling
                kept += 1
            elif len(all_owners) == 1:
                out.write(f"{form}\t{next(iter(lemmas))}\n")
                kept += 1
    print(f"{kept} forms")


def stream_shard(shard: int) -> None:
    targets = {line.split("\t")[0] for line in (NGRAM_DIR / "forms.tsv").open(encoding="utf-8")}
    # Downloaded beforehand and checked against their size: a stream cut at a gzip member boundary
    # would look like a clean end of file.
    path = NGRAM_DIR / "raw" / f"1-{shard:05d}-of-{SHARDS:05d}.gz"
    counts: dict[str, list[int]] = {}
    decades = (2020 - FIRST_DECADE) // 10
    with gzip.open(path, "rt", encoding="utf-8") as lines:
        for line in lines:
            token, _, rest = line.partition("\t")
            if "_" in token:  # POS-tagged duplicates of the untagged line
                continue
            # Lowercase spellings only: capitalised ones mix in proper nouns (Paris, Louis).
            # The sentence-initial occurrences lost this way are a similar share for every word.
            form = token
            if form not in targets:
                continue
            row = counts.setdefault(form, [0] * decades)
            for cell in rest.split("\t"):
                year, count, _ = cell.split(",")
                y = int(year)
                if y >= FIRST_DECADE:
                    row[(y - FIRST_DECADE) // 10] += int(count)
    with (NGRAM_DIR / f"counts-{shard}.tsv").open("w", encoding="utf-8") as out:
        for form, row in counts.items():
            out.write(form + "\t" + ",".join(map(str, row)) + "\n")
    print(f"shard {shard}: {len(counts)} forms")


def totals() -> None:
    with urllib.request.urlopen(f"{BASE}/totalcounts-1") as response:
        text = response.read().decode()
    decades = [0] * ((2020 - FIRST_DECADE) // 10)
    for cell in text.split():
        year, count, *_ = cell.split(",")
        if int(year) >= FIRST_DECADE:
            decades[(int(year) - FIRST_DECADE) // 10] += int(count)
    (NGRAM_DIR / "totals.tsv").write_text(",".join(map(str, decades)) + "\n", encoding="utf-8")
    print(decades)


if __name__ == "__main__":
    command = sys.argv[1]
    if command == "forms":
        build_forms()
    elif command == "shard":
        stream_shard(int(sys.argv[2]))
    elif command == "totals":
        totals()
