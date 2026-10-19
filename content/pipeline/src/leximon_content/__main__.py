"""Command line: `uv run python -m leximon_content <command> [--run essai-50]`.

ngram     download Google Ngram (5 GB, once) and compute word frequencies (D-020)
select    pick the words of a run (selection.json), skipping words of earlier runs; --size
draft     draft every word with the chosen model (drafts.jsonl); --compare uses all models
push      run the automatic checks and send the drafts to Directus for review
refresh   update the Directus layout, frequencies and rarities, keeping the review
report    compare models from the review verdicts recorded in Directus
"""

import argparse
import asyncio
import json
from collections import Counter

from . import checks, config, directus, drafting, littre, ngram, selection


def run_dir(name: str):
    path = config.RUNS_DIR / name
    path.mkdir(parents=True, exist_ok=True)
    return path


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
    selected = selection.pick(
        selection.candidate_pool(), size, seed=2026, exclude=drafted_elsewhere(run)
    )
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


def command_push(run: str) -> None:
    config.load_env()
    index = littre.index()
    selected = {
        row["word"]: row
        for row in json.loads((run_dir(run) / "selection.json").read_text(encoding="utf-8"))
    }
    rows = []
    for line in (run_dir(run) / "drafts.jsonl").read_text(encoding="utf-8").splitlines():
        result = json.loads(line)
        if result["draft"] is None:
            continue
        entry = index[result["word"]][0]
        draft = drafting.CardDraft.model_validate(result["draft"])
        rows.append(
            directus.draft_row(
                run, result, draft, entry, checks.run_checks(draft, entry), selected[result["word"]]
            )
        )
    client = directus.connect()
    directus.ensure_schema(client)
    directus.ensure_layout(client)
    created = directus.replace_run(client, run, rows)
    failures = Counter(name for row in rows for name in row["automatic_checks_failed"])
    print(f"{created} brouillons envoyés dans Directus ({config.require_env('DIRECTUS_URL')})")
    print("contrôles en échec :", dict(failures))


def command_refresh(run: str) -> None:
    config.load_env()
    client = directus.connect()
    directus.ensure_schema(client)
    directus.ensure_layout(client)
    print(f"{directus.refresh_run(client, run)} brouillons mis à jour, relecture conservée")


def command_report(run: str) -> None:
    config.load_env()
    print(directus.report(directus.connect(), run))


def main() -> None:
    parser = argparse.ArgumentParser(prog="leximon_content")
    parser.add_argument(
        "command", choices=["ngram", "select", "draft", "push", "refresh", "report"]
    )
    parser.add_argument("--run", default="essai-50")
    parser.add_argument("--compare", action="store_true", help="draft: compare every model")
    parser.add_argument("--size", type=int, default=50, help="select: number of words")
    args = parser.parse_args()
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
