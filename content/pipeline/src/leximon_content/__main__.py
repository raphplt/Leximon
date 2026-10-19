"""Command line: `uv run python -m leximon_content <command> [--run essai-50]`.

select    pick the words of a run (selection.json)
draft     draft every word with every model (drafts.jsonl)
push      run the automatic checks and send the drafts to Directus for review
report    compare models from the review verdicts recorded in Directus
"""

import argparse
import asyncio
import json
from collections import Counter

from . import checks, config, directus, drafting, littre, selection


def run_dir(name: str):
    path = config.RUNS_DIR / name
    path.mkdir(parents=True, exist_ok=True)
    return path


def command_select(run: str) -> None:
    selected = selection.select()
    out = run_dir(run) / "selection.json"
    out.write_text(
        json.dumps(selection.as_rows(selected), ensure_ascii=False, indent=2), encoding="utf-8"
    )
    print(f"{len(selected)} mots -> {out}")


def command_draft(run: str) -> None:
    config.load_env()
    config.require_env("ANTHROPIC_API_KEY")
    words = [
        row["word"]
        for row in json.loads((run_dir(run) / "selection.json").read_text(encoding="utf-8"))
    ]
    index = littre.index()
    entries = [index[word][0] for word in words]
    results = asyncio.run(drafting.draft_all(entries))
    out = run_dir(run) / "drafts.jsonl"
    with out.open("w", encoding="utf-8") as file:
        for result in results:
            file.write(json.dumps(result.to_json(), ensure_ascii=False) + "\n")

    for model in drafting.MODELS:
        mine = [r for r in results if r.model == model]
        ok = sum(r.draft is not None for r in mine)
        total = sum(r.cost_usd for r in mine)
        latency = sorted(r.latency_s for r in mine)[len(mine) // 2]
        print(
            f"{model}: {ok}/{len(mine)} brouillons, {total:.3f} $, latence médiane {latency:.1f} s"
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
    created = directus.replace_run(client, run, rows)
    failures = Counter(name for row in rows for name in row["automatic_checks_failed"])
    print(f"{created} brouillons envoyés dans Directus ({config.require_env('DIRECTUS_URL')})")
    print("contrôles en échec :", dict(failures))


def command_report(run: str) -> None:
    config.load_env()
    print(directus.report(directus.connect(), run))


def main() -> None:
    parser = argparse.ArgumentParser(prog="leximon_content")
    parser.add_argument("command", choices=["select", "draft", "push", "report"])
    parser.add_argument("--run", default="essai-50")
    args = parser.parse_args()
    {
        "select": command_select,
        "draft": command_draft,
        "push": command_push,
        "report": command_report,
    }[args.command](args.run)


if __name__ == "__main__":
    main()
