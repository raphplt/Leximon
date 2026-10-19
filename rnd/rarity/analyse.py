"""Spike: compare rarity scores on the candidate pool. Run from content/pipeline after the extract:
uv run python ../../rnd/rarity/analyse.py
"""

import json
import math
import random
import re
import statistics
from collections import Counter, defaultdict

from ngram_extract import FIRST_DECADE, NGRAM_DIR

from leximon_content import config, lexique, littre, selection

RARITIES = ("Courant", "Peu courant", "Rare", "Précieux", "Épique", "Légendaire")
PYRAMID = (0.40, 0.25, 0.17, 0.10, 0.06, 0.02)  # catalogue shares used by the simulation
MODERN = range(1990, 2020)
LITTRE_ERA = range(1800, 1900)


def load() -> dict[str, list[float]]:
    """Occurrences per billion words, per decade, summed over each lemma's forms."""
    totals = [int(x) for x in (NGRAM_DIR / "totals.tsv").read_text().strip().split(",")]
    lemma_of = dict(line.rstrip("\n").split("\t") for line in (NGRAM_DIR / "forms.tsv").open())
    counts: dict[str, list[int]] = defaultdict(lambda: [0] * len(totals))
    for shard in range(6):
        for line in (NGRAM_DIR / f"counts-{shard}.tsv").open():
            form, row = line.rstrip("\n").split("\t")
            target = counts[lemma_of[form]]
            for i, value in enumerate(row.split(",")):
                target[i] += int(value)
    return {
        lemma: [1e9 * c / t for c, t in zip(row, totals, strict=True)]
        for lemma, row in counts.items()
    }


def mean_over(per_decade: list[float], years: range) -> float:
    indexes = range((years.start - FIRST_DECADE) // 10, (years.stop - FIRST_DECADE) // 10)
    return statistics.fmean(per_decade[i] for i in indexes)


def tiers(scores: dict[str, float]) -> dict[str, str]:
    """Assigns rarities by quantile: lowest score = most common."""
    ordered = sorted(scores, key=lambda w: (scores[w], w))
    result, start = {}, 0
    for rarity, share in zip(RARITIES, PYRAMID, strict=True):
        end = len(ordered) if rarity == RARITIES[-1] else start + round(share * len(ordered))
        for word in ordered[start:end]:
            result[word] = rarity
        start = end
    return result


def main() -> None:
    freq = load()
    pool = selection.candidates()
    words = sorted(pool)
    missing = [w for w in words if w not in freq]
    zero = lambda: [0.0] * 22  # noqa: E731
    modern = {w: mean_over(freq.get(w, zero()), MODERN) for w in words}
    old = {w: mean_over(freq.get(w, zero()), LITTRE_ERA) for w in words}

    print(f"Pool: {len(words)} candidates, {len(missing)} with no Ngram count at all")
    no_modern = sum(modern[w] == 0 for w in words)
    print(f"No occurrence since 1990: {no_modern} ({no_modern / len(words):.1%})")
    for q in (0.1, 0.25, 0.5, 0.75, 0.9, 0.98):
        values = sorted(modern.values())
        print(f"  modern per billion, q{q:.2f}: {values[int(q * len(values))]:.2f}")

    # Option A: modern frequency only. Option B: modern, ties broken by the 19th century.
    # Option C: geometric blend, 2/3 modern and 1/3 Littré era (a word never common is rarer).
    eps = 0.01
    score_a = {w: -math.log10(modern[w] + eps) for w in words}
    score_b = {w: -math.log10(modern[w] + eps) - 1e-6 * math.log10(old[w] + eps) for w in words}
    score_c = {w: -(2 * math.log10(modern[w] + eps) + math.log10(old[w] + eps)) / 3 for w in words}
    rng = random.Random(7)
    for name, scores in (
        ("A modern only", score_a),
        ("B modern, tie on 1800s", score_b),
        ("C blend 2/3 modern + 1/3 1800s", score_c),
    ):
        tier = tiers(scores)
        print(f"\n== Option {name}")
        for rarity in RARITIES:
            mine = [w for w in words if tier[w] == rarity]
            lo = min(modern[w] for w in mine)
            hi = max(modern[w] for w in mine)
            sample = ", ".join(rng.sample(mine, 8))
            print(f"{rarity:12} {len(mine):5}  modern {lo:8.2f}–{hi:8.2f}/bn  e.g. {sample}")
        by_cat: dict[str, Counter[str]] = defaultdict(Counter)
        for w in words:
            for cat in pool[w].categories:
                by_cat[cat][tier[w]] += 1
        for cat, counter in sorted(by_cat.items()):
            total = sum(counter.values())
            shares = " ".join(f"{counter[r] / total:4.0%}" for r in RARITIES)
            print(f"  {cat:11} {total:5}  {shares}")

    # Agreement with Lexique (modern books + films) on the words both know.
    both = [w for w in words if pool[w].frequency_score > 0 and modern[w] > 0]
    rank = lambda d: {w: i for i, w in enumerate(sorted(both, key=lambda x: d[x]))}  # noqa: E731
    ra = rank(modern)
    rl = rank({w: pool[w].frequency_score for w in both})
    n = len(both)
    rho = 1 - 6 * sum((ra[w] - rl[w]) ** 2 for w in both) / (n * (n * n - 1))
    print(f"\nSpearman Ngram modern vs Lexique on {n} words: {rho:.2f}")
    lexique_zero = [w for w in words if pool[w].frequency_score == 0]
    print(
        f"Absent from Lexique: {len(lexique_zero)}; their Ngram modern median "
        f"{statistics.median(modern[w] for w in lexique_zero):.2f}/bn"
    )

    # Suspects: tagged old, yet frequent today (homographs, OCR, still-used senses).
    suspects = sorted(words, key=lambda w: -modern[w])[:25]
    print("Most frequent today:", ", ".join(f"{w} ({modern[w]:.0f})" for w in suspects))
    examples = [
        "billevesée",
        "faquin",
        "coquecigrue",
        "barguigner",
        "hurluberlu",
        "maroufle",
        "olibrius",
        "gourgandine",
        "escogriffe",
        "jocrisse",
        "brimborion",
        "ripopée",
    ]
    for w in examples:
        m = mean_over(freq.get(w, zero()), MODERN)
        o = mean_over(freq.get(w, zero()), LITTRE_ERA)
        print(
            f"  {w:12} modern {m:8.2f}/bn  1800s {o:8.2f}/bn  lexique {lexique.frequency(w).score:.2f}"
        )


SCIENCE = re.compile(
    r"^\s*Terme d[e']\s*(botanique|médecine|chimie|zoologie|anatomie|histoire naturelle|chirurgie|"
    r"minéralogie|physique|physiologie|pharmacie|géométrie|géologie|astronomie|tératologie|"
    r"entomologie|pathologie|mathématique|mécanique|métallurgie)"
)
#: Above this modern frequency, a word is still in common use (per billion words, 1990-2019).
CAP = 500


def plausible_catalogue() -> None:
    """The pool once the obvious non-cards are removed, as the editorial filter would do."""
    freq = load()
    pool = selection.candidates()
    index = littre.index()
    zero = [0.0] * 22
    modern = {w: mean_over(freq.get(w, zero), MODERN) for w in pool}
    old = {w: mean_over(freq.get(w, zero), LITTRE_ERA) for w in pool}
    compounds = [w for w in pool if "-" in w]
    science = [
        w for w in pool if any(SCIENCE.match(s.definition) for e in index[w] for s in e.senses[:1])
    ]
    common = [w for w in pool if modern[w] > CAP]
    words = sorted(set(pool) - set(compounds) - set(science) - set(common))
    print(
        f"\n== Plausible catalogue: {len(pool)} candidates - {len(compounds)} compounds "
        f"- {len(science)} science terms - {len(common)} above {CAP}/bn = {len(words)}"
    )
    near_cap = sorted(
        (w for w in pool if CAP / 3 < modern[w] <= CAP * 3 and "-" not in w),
        key=lambda w: modern[w],
    )
    rng = random.Random(3)
    print(
        "Around the cap:",
        ", ".join(
            f"{w} {modern[w]:.0f}"
            for w in sorted(rng.sample(near_cap, 30), key=lambda w: modern[w])
        ),
    )
    eps = 0.01
    score = {w: -(2 * math.log10(modern[w] + eps) + math.log10(old[w] + eps)) / 3 for w in words}
    nowhere = sum(modern[w] == 0 and old[w] == 0 for w in words)
    print(f"No occurrence in either period: {nowhere} ({nowhere / len(words):.1%})")
    tier = tiers(score)
    for rarity in RARITIES:
        mine = sorted((w for w in words if tier[w] == rarity), key=lambda w: score[w])
        print(
            f"{rarity:12} {len(mine):5}  score {score[mine[0]]:.2f}–{score[mine[-1]]:.2f}  "
            f"modern median {statistics.median(modern[w] for w in mine):.2f}/bn  e.g. "
            + ", ".join(rng.sample(mine, 12))
        )
    by_cat: dict[str, Counter[str]] = defaultdict(Counter)
    for w in words:
        for cat in pool[w].categories:
            by_cat[cat][tier[w]] += 1
    for cat, counter in sorted(by_cat.items()):
        total = sum(counter.values())
        print(f"  {cat:11} {total:5}  " + " ".join(f"{counter[r] / total:4.0%}" for r in RARITIES))
    trial = json.loads((config.RUNS_DIR / "essai-50" / "selection.json").read_text())
    print("Trial words:")
    for row in sorted(trial, key=lambda r: score.get(r["word"], -99)):
        w = row["word"]
        print(
            f"  {w:16} {tier.get(w, 'hors catalogue'):14} modern {modern.get(w, mean_over(freq.get(w, zero), MODERN)):9.2f}/bn"
        )


if __name__ == "__main__":
    main()
    plausible_catalogue()
