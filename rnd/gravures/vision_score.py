"""Throwaway: score the vision models against the hand-made reference.

Reads out/vision/candidates.json, out/vision/reference.json (good candidates and technique of each
candidate, judged by eye on the thumbnails) and out/vision/results-<model>[-<tag>].jsonl.
Prints the table of docs/rnd/gravures.md. Stdlib only. Run: python3 rnd/gravures/vision_score.py
"""

import json
import statistics
from pathlib import Path

HERE = Path(__file__).parent
OUT = HERE / "out" / "vision"
CARDS = 1500
# Technique labels of the models -> reference codes.
CODES = {"gravure": "G", "lithographie": "L", "dessin au trait": "D", "dessin lavé ou aquarelle": "W",
         "peinture": "P", "photographie": "F", "autre": "T"}
# Proposed pipeline: 8 candidates at 500 px instead of up to 6 at 330 px (image tokens grow with area).
IMAGE_SCALE_500PX_8 = (500 / 330) ** 2


def load_results(path: Path) -> dict[str, dict]:
    rows = {}
    for line in path.read_text().splitlines():
        row = json.loads(line)
        if row["answer"] is not None:
            rows[row["word"]] = row
    return rows


def pct(part: int, whole: int) -> str:
    return f"{part}/{whole} ({100 * part / whole:.0f} %)" if whole else "-"


def score(name: str, results: dict, cands: dict, ref: dict) -> dict:
    asked = [w for w, e in cands.items() if e["candidates"]]
    good_words = [w for w in asked if ref[w]["good"]]
    counts = {"bon": 0, "aucun_raison": 0, "aucun_tort": 0, "mauvais": 0, "faux_positif": 0,
              "peinture": 0, "photo": 0}
    tech_total = tech_ok = 0
    paint_seen = paint_flagged = photo_seen = photo_flagged = 0
    for word in asked:
        row = results[word]
        choice = row["answer"]["choix"]
        good = ref[word]["good"]
        kinds = ref[word]["kinds"]
        if choice == "aucun":
            counts["aucun_tort" if good else "aucun_raison"] += 1
        else:
            n = int(choice)
            if n in good:
                counts["bon"] += 1
            elif good:
                counts["mauvais"] += 1
            else:
                counts["faux_positif"] += 1
            counts["peinture"] += kinds[n - 1] == "P"
            counts["photo"] += kinds[n - 1] == "F"
        labels = [CODES[t] for t in row["answer"]["techniques"]]
        for index, kind in enumerate(kinds):
            label = labels[index] if index < len(labels) else None
            tech_total += 1
            # Prints (G, L) count as one family: the ink treatment handles both.
            family = {"G": "print", "L": "print"}
            tech_ok += family.get(label, label) == family.get(kind, kind)
            if kind == "P":
                paint_seen += 1
                paint_flagged += label == "P"
            if kind == "F":
                photo_seen += 1
                photo_flagged += label == "F"
    costs = [results[w]["cost_usd"] for w in asked]
    latencies = sorted(results[w]["latency_s"] for w in asked)
    usage_in = statistics.mean(results[w]["usage"]["input_tokens"] for w in asked)
    usage_out = statistics.mean(results[w]["usage"]["output_tokens"] for w in asked)
    proposals = len(asked) - counts["aucun_raison"] - counts["aucun_tort"]
    per_card = sum(costs) / len(asked)
    return {
        "name": name,
        "asked": len(asked),
        "good_words": len(good_words),
        "accuracy": counts["bon"] + counts["aucun_raison"],
        "precision": (counts["bon"], proposals),
        "counts": counts,
        "tech": (tech_ok, tech_total),
        "paint": (paint_flagged, paint_seen),
        "photo": (photo_flagged, photo_seen),
        "cost_total": sum(costs),
        "per_card": per_card,
        "in": usage_in,
        "out": usage_out,
        "lat_median": statistics.median(latencies),
        "lat_p90": latencies[int(0.9 * (len(latencies) - 1))],
    }


def main() -> None:
    cands = json.loads((OUT / "candidates.json").read_text())
    ref = json.loads((OUT / "reference.json").read_text())
    empty = [w for w, e in cands.items() if not e["candidates"]]
    print(f"{len(cands)} words, {len(empty)} without candidate ({', '.join(empty)}), "
          f"{sum(1 for w in cands if ref[w]['good'])} with a good candidate")
    scores = []
    for path in sorted(OUT.glob("results-*.jsonl")):
        name = path.stem.removeprefix("results-")
        scores.append(score(name, load_results(path), cands, ref))
    for s in scores:
        c = s["counts"]
        print(f"\n== {s['name']}")
        print(f"  right answer (good pick or rightful none): {pct(s['accuracy'], s['asked'])}")
        print(f"  good pick when a good candidate exists:    {pct(c['bon'], s['good_words'])}")
        print(f"  precision of proposals:                    {pct(*s['precision'])}")
        print(f"  none, rightly: {c['aucun_raison']}   none, wrongly: {c['aucun_tort']}")
        print(f"  wrong pick (good one existed): {c['mauvais']}   pick when none was good: {c['faux_positif']}")
        print(f"  painting picked: {c['peinture']}   photo picked: {c['photo']}")
        print(f"  technique family right: {pct(*s['tech'])}   paintings flagged: {pct(*s['paint'])}   "
              f"photos flagged: {pct(*s['photo'])}")
        print(f"  tokens per card: {s['in']:.0f} in, {s['out']:.0f} out")
        print(f"  cost: ${s['cost_total']:.4f} total, ${s['per_card']:.5f} per card, "
              f"{CARDS} cards: ${s['per_card'] * CARDS:.2f} (batch ${s['per_card'] * CARDS / 2:.2f})")
        print(f"  latency: median {s['lat_median']:.1f}s, p90 {s['lat_p90']:.1f}s")
    names = [s["name"] for s in scores]
    runs = {n: load_results(OUT / f"results-{n}.jsonl") for n in names}
    asked = [w for w, e in cands.items() if e["candidates"]]
    print()
    for i, a in enumerate(names):
        for b in names[i + 1 :]:
            same = sum(runs[a][w]["answer"]["choix"] == runs[b][w]["answer"]["choix"] for w in asked)
            print(f"same answer {a} / {b}: {pct(same, len(asked))}")
    print(f"\n  {'word':14} {'ref':12} " + " ".join(f"{n[7:20]:14}" for n in names))
    for w in asked:
        good = ",".join(map(str, ref[w]["good"])) or "-"
        print(f"  {w:14} {good:12} " + " ".join(f"{runs[n][w]['answer']['choix']:14}" for n in names))


if __name__ == "__main__":
    main()
