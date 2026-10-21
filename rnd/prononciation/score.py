"""Throwaway: score what the phoneme recogniser heard (out/recognised.json, from phone_rec.py).

1. Phoneme error rate against the Wiktionnaire IPA (edit distance over the lenient phonemes
   of g2p.py, divided by the reference length), per source: human recording, Piper raw,
   Piper guided. Same 39 random words for the three, plus the 20 hard words.
2. For the 20 hard words, whether the one sound the word turns on is heard (TARGETS).

Run: python3 rnd/prononciation/score.py
"""

import json
import re
from pathlib import Path
from statistics import mean, median

from g2p import lenient, no_schwa, tokens

OUT = Path(__file__).parent / "out"
HERE = Path(__file__).parent

# Deciding sound of each hard word, as a regex over the recognised string.
TARGETS = {
    "ambesas": r"s$",
    "comput": r"t$",
    "orémus": r"s$",
    "tacet": r"t\w?$",
    "palus": r"s$",
    "introït": r"i[td]$",
    "chorographe": r"^k",
    "épichérème": r"k",
    "nychthémère": r"k",
    "picrochole": r"k.*k",
    "didrachme": r"k",
    "casoar": r"aʁ$|ɑʁ$",
    "lycanthrope": r"^[^θɹ]*$",
    "léthifère": r"fɛʁ$",
    "apathiste": r"^[^θɹ]*t$",
    "pensum": r"ɛ̃|æ̃",
    "canzone": r"ts",
    "quinquatries": r"kw",
    "magnaud": r"ɲ|nj",
    "faraud": r"ʁo$|ro$",
}


def distance(a: list[str], b: list[str]) -> int:
    prev = list(range(len(b) + 1))
    for i, x in enumerate(a, 1):
        cur = [i]
        for j, y in enumerate(b, 1):
            cur.append(min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (x != y)))
        prev = cur
    return prev[-1]


def per(heard: str, ipa_variants: list[str]) -> float:
    got = lenient(no_schwa(tokens(heard.replace("ʔ", ""))))
    best = 9.9
    for ipa in ipa_variants:
        ref = lenient(no_schwa(tokens(ipa)))
        if ref:
            best = min(best, distance(got, ref) / len(ref))
    return best


def main() -> None:
    heard = json.loads((OUT / "recognised.json").read_text())
    wikt = json.loads((OUT / "wiktionary.json").read_text())
    hard = [x["word"] for x in json.loads((HERE / "words20.json").read_text())]
    sample = [x["word"] for x in json.loads((HERE / "words40.json").read_text())]

    def src(word: str, kind: str) -> str | None:
        name = f"{word}.opus" if kind == "human" else f"{word}.{kind if '-' in kind else 'piper-' + kind}.opus"
        return heard.get(name)

    for label, words in (("39 random words", sample), ("20 hard words", hard)):
        print(f"== {label}")
        for kind in ("human", "raw", "guided", "kokoro-raw", "kokoro-guided", "google-chirp3-hd-charon-raw", "google-chirp3-hd-charon-guided", "google-chirp3-hd-kore-raw", "google-chirp3-hd-kore-guided", "google-neural2-g-raw", "google-neural2-g-guided"):
            scores = [per(src(w, kind), wikt[w]["ipa"]) for w in words if src(w, kind) is not None]
            if scores:
                print(f"  {kind:7} n={len(scores):2}  PER mean {mean(scores):.2f}  median {median(scores):.2f}")

    print("== deciding sound heard (20 hard words)")
    totals = {k: [0, 0] for k in ("human", "raw", "guided", "kokoro-raw", "kokoro-guided", "google-chirp3-hd-charon-raw", "google-chirp3-hd-charon-guided", "google-chirp3-hd-kore-raw", "google-chirp3-hd-kore-guided", "google-neural2-g-raw", "google-neural2-g-guided")}
    for w in hard:
        cells = []
        for kind in totals:
            h = src(w, kind)
            if h is None:
                cells.append(f"{kind}: -")
                continue
            ok = re.search(TARGETS[w], h) is not None
            totals[kind][0] += ok
            totals[kind][1] += 1
            cells.append(f"{kind}: {h} {'ok' if ok else 'NO'}")
        print(f"  {w:14} " + " | ".join(cells))
    for kind, (ok, n) in totals.items():
        print(f"  {kind}: {ok}/{n}")


if __name__ == "__main__":
    main()
