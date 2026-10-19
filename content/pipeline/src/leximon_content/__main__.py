"""Command line: `uv run python -m leximon_content <command> [--run essai-50]`.

ngram     download Google Ngram (5 GB, once) and compute word frequencies (D-020)
prescreen predict with Haiku which words are worth drafting (data/prescreen.jsonl): --pool
          screens the candidate pool (--limit N), --run compares with a drafted run
select    pick the words of a run (selection.json), skipping words of earlier runs and words the
          pre-screen rejected; --size
draft     draft every word with the chosen model (drafts.jsonl); --compare uses all models
quality   drop unsuitable drafts, verify faithfulness (Opus), send flagged cards back to the
          drafter once and verify them again, judge charm (Opus), then summarize
push      send the kept cards to Directus, with pépites and the review sample marked
refresh   update the Directus layout, frequencies and rarities, keeping the review
report    compare models from the review verdicts recorded in Directus

A step whose estimated cost exceeds a few dollars waits for --yes (the owner's approval).
"""

import argparse
import asyncio
import json
from collections import Counter

from . import config, curation, directus, drafting, littre, ngram, prescreen, selection
from .curation import run_dir


def command_ngram(_run: str) -> None:
    print(f"{ngram.build()} mots -> {ngram.FREQUENCIES_FILE}")


def drafted_elsewhere(run: str) -> frozenset[str]:
    return frozenset(
        row["word"]
        for path in config.RUNS_DIR.glob("*/selection.json")
        if path.parent.name != run
        for row in json.loads(path.read_text(encoding="utf-8"))
    )


def command_select(run: str, size: int) -> None:
    screened = prescreen.load()
    pool = selection.candidate_pool()
    promising = [c for c in pool if screened.get(c.word, {}).get("suitability", "ok") == "ok"]
    unscreened = sum(c.word not in screened for c in pool)
    print(
        f"pré-tri : {len(pool) - len(promising)} mots écartés, {unscreened} pas encore pré-triés "
        f"sur {len(pool)}"
    )
    selected = selection.pick(promising, size, seed=2026, exclude=drafted_elsewhere(run))
    out = run_dir(run) / "selection.json"
    out.write_text(
        json.dumps(selection.as_rows(selected), ensure_ascii=False, indent=2), encoding="utf-8"
    )
    reasons = Counter(candidate.pick_reason for candidate in selected)
    print(f"{len(selected)} mots -> {out}")
    print(", ".join(f"{reason} {count}" for reason, count in reasons.items()))


def command_draft(run: str, compare: bool) -> None:
    config.load_env()
    config.require_env("ANTHROPIC_API_KEY")
    words = [
        row["word"]
        for row in json.loads((run_dir(run) / "selection.json").read_text(encoding="utf-8"))
    ]
    index = littre.index()
    entries = [index[word][0] for word in words]
    models = drafting.COMPARED_MODELS if compare else (drafting.MODEL,)
    results = asyncio.run(drafting.draft_all(entries, models))
    out = run_dir(run) / "drafts.jsonl"
    with out.open("w", encoding="utf-8") as file:
        for result in results:
            file.write(json.dumps(result.to_json(), ensure_ascii=False) + "\n")

    for model in models:
        mine = [r for r in results if r.model == model]
        ok = sum(r.draft is not None for r in mine)
        shortened = sum(r.shortened for r in mine)
        total = sum(r.cost_usd for r in mine)
        latency = sorted(r.latency_s for r in mine)[len(mine) // 2]
        print(
            f"{model}: {ok}/{len(mine)} brouillons ({shortened} raccourcis), {total:.3f} $, "
            f"latence médiane {latency:.1f} s"
        )
    print(f"-> {out}")


def command_prescreen(run: str, pool: bool, limit: int | None, yes: bool) -> None:
    config.load_env()
    config.require_env("ANTHROPIC_API_KEY")
    if pool:
        words = sorted(c.word for c in selection.candidate_pool())
        todo = [w for w in words if w not in prescreen.load()][:limit]
        asyncio.run(curation.prescreen_words(todo, yes))
        return
    words = [
        row["word"]
        for row in json.loads((run_dir(run) / "selection.json").read_text(encoding="utf-8"))
    ]
    asyncio.run(curation.prescreen_words(words, yes))
    reference = {d.word: d.draft.suitability for d in curation.load_drafts(run) if d.word in words}
    screened = prescreen.load()
    a = prescreen.agreement({w: str(screened[w]["suitability"]) for w in screened}, reference)
    print(
        f"{a.compared} mots comparés avec {drafting.MODEL} : précision {a.precision:.0%} "
        f"(mots retenus que la rédaction garde), rappel {a.recall:.0%} (mots gardés que le "
        f"pré-tri retient), même catégorie {a.same_category / a.compared:.0%}"
    )
    print(f"retenus à tort {a.only_prescreen_ok}, écartés à tort {a.only_reference_ok}")


def command_quality(run: str, yes: bool) -> None:
    config.load_env()
    config.require_env("ANTHROPIC_API_KEY")
    asyncio.run(curation.verify_run(run, yes))
    asyncio.run(curation.correct_run(run, yes))
    asyncio.run(curation.verify_run(run, yes))  # the corrected drafts
    asyncio.run(curation.judge_run(run, yes))
    print(curation.summary(curation.curate(run)))


def command_push(run: str) -> None:
    config.load_env()
    curated = curation.curate(run)
    rows = [
        directus.draft_row(
            run,
            card.draft.result,
            card.draft.draft,
            card.draft.entry,
            card.automatic,
            card.draft.selected,
            card.decision,
        )
        for card in curated.cards
    ]
    client = directus.connect()
    directus.ensure_schema(client)
    directus.ensure_layout(client, run)
    created = directus.replace_run(client, run, rows)
    to_review = sum(bool(row["to_review"]) for row in rows)
    print(f"{created} cartes envoyées dans Directus ({config.require_env('DIRECTUS_URL')})")
    print(f"{len(curated.drafts) - created} brouillons écartés, {to_review} cartes à relire")


def command_refresh(run: str) -> None:
    config.load_env()
    client = directus.connect()
    directus.ensure_schema(client)
    directus.ensure_layout(client, run)
    print(f"{directus.refresh_run(client, run)} brouillons mis à jour, relecture conservée")


def command_report(run: str) -> None:
    config.load_env()
    print(directus.report(directus.connect(), run))


def main() -> None:
    parser = argparse.ArgumentParser(prog="leximon_content")
    parser.add_argument(
        "command",
        choices=["ngram", "prescreen", "select", "draft", "quality", "push", "refresh", "report"],
    )
    parser.add_argument("--run", default="essai-50")
    parser.add_argument("--compare", action="store_true", help="draft: compare every model")
    parser.add_argument("--size", type=int, default=50, help="select: number of words")
    parser.add_argument("--pool", action="store_true", help="prescreen: the candidate pool")
    parser.add_argument("--limit", type=int, default=None, help="prescreen --pool: at most N")
    parser.add_argument("--yes", action="store_true", help="approve a step above a few dollars")
    args = parser.parse_args()
    if args.command == "prescreen":
        command_prescreen(args.run, args.pool, args.limit, args.yes)
        return
    if args.command == "quality":
        command_quality(args.run, args.yes)
        return
    if args.command == "draft":
        command_draft(args.run, args.compare)
        return
    if args.command == "select":
        command_select(args.run, args.size)
        return
    {
        "ngram": command_ngram,
        "push": command_push,
        "refresh": command_refresh,
        "report": command_report,
    }[args.command](args.run)


if __name__ == "__main__":
    main()
