"""Command line: `uv run python -m leximon_content <command> [--run essai-50]`.

ngram     download Google Ngram (5 GB, once) and compute word frequencies
prescreen predict with Haiku which words are worth drafting (data/prescreen.jsonl): --pool
          screens the candidate pool (--limit N), --run compares with a drafted run;
          --pool --domain nature screens again the promising words of a domain since split
select    pick the words of a run (selection.json), skipping words of earlier runs and words the
          pre-screen rejected, within the domains of the run's collection; --size
draft     draft every word with the chosen model (drafts.jsonl); --compare uses all models
quality   drop unsuitable drafts, verify faithfulness (Opus), send flagged cards back to the
          drafter once and verify them again, judge charm (Opus), then summarize
push      send the kept cards to Directus, with pépites and the review sample marked
refresh   update the Directus layout, frequencies and rarities, keeping the review
report    compare models from the review verdicts recorded in Directus
release   write a catalogue release (content/releases/<version>/) from the publishable cards of
          the collections in content/collections.toml

gravures-queries  Haiku writes Commons search queries for each card of the latest release
gravures-search   search Commons with the rights filter, keep up to 8 thumbnails per card (hours:
                  run it in the background; it resumes where it stopped)
gravures-pick     Sonnet picks the engraving of each card among its thumbnails (Batches API)
gravures-report   counts, rejections by reason and cost so far
                  All four take --cards id1,id2 or --limit N (default: every card) and
                  --release <dir> (default: the latest one). Data in data/gravures/.
                  --round 2: second round for the cards still without an engraving, with
                  wider queries, a laxer pick and the first round's other candidates.
                  --round 3: last round, from queries written by hand in queries-3.jsonl
                  (gravures-search, then gravures-pick), never showing a file seen before.
gravures-render   download the approved engravings of data/gravures/validation.json and render
                  their ink and colour plate (WebP, data/gravures/out/), read by release; also
                  the decorated initials of data/gravures/lettrines.json, which release shows
                  on the cards without an engraving

prononciation-notation  phonetic notation of every card of the latest release (Littré checked
                  by eSpeak NG, Wiktionnaire deciding), data/prononciation/notation.json; lists
                  the words for the owner, to settle in data/prononciation/corrections.json
prononciation-audio     read each settled notation with the Google voice (MP3,
                  data/prononciation/out/), read by release; --limit N, --cards

A step whose estimated cost exceeds a few dollars waits for --yes (the owner's approval).
"""

import argparse
import asyncio
import json
from collections import Counter
from datetime import UTC, date, datetime

import httpx

from . import (
    config,
    curation,
    directus,
    drafting,
    engraving,
    gravures,
    littre,
    ngram,
    prescreen,
    pronunciation,
    release,
    selection,
)
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
    collection = release.collection_of_run(release.load_collections(), run)
    if collection is not None and collection.domains:
        # Only screened words have a domain: a themed run never picks an unscreened word. Old
        # insults (Wiktionnaire category) belong with the characters, whatever their domain.
        def domain(candidate: selection.Candidate) -> object:
            if "insulte" in candidate.categories:
                return "caractere"
            return screened.get(candidate.word, {}).get("domain")

        promising = [c for c in promising if domain(c) in collection.domains]
        print(f"{collection.name} : {len(promising)} mots dans {', '.join(collection.domains)}")
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


def command_prescreen(
    run: str, pool: bool, limit: int | None, yes: bool, domain: str | None
) -> None:
    config.load_env()
    config.require_env("ANTHROPIC_API_KEY")
    if pool:
        words = sorted(c.word for c in selection.candidate_pool())
        screened = prescreen.load()
        if domain is not None:
            # A domain split in two: its words are screened again under the new list. Only the
            # promising ones, since the others are never drafted whatever their domain.
            todo = [
                w
                for w in words
                if (row := screened.get(w))
                and row.get("domain") == domain
                and row["suitability"] == "ok"
                and prescreen.outdated_domain(row)
            ][:limit]
            asyncio.run(curation.prescreen_words(todo, yes, again=True))
            return
        todo = [w for w in words if w not in screened][:limit]
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
    directus.ensure_layout(client)
    created = directus.replace_run(client, run, rows)
    to_review = sum(bool(row["to_review"]) for row in rows)
    print(f"{created} cartes envoyées dans Directus ({config.require_env('DIRECTUS_URL')})")
    print(f"{len(curated.drafts) - created} brouillons écartés, {to_review} cartes à relire")


def command_refresh(run: str) -> None:
    config.load_env()
    client = directus.connect()
    directus.ensure_schema(client)
    directus.ensure_layout(client)
    print(f"{directus.refresh_run(client, run)} brouillons mis à jour, relecture conservée")


def command_report(run: str) -> None:
    config.load_env()
    print(directus.report(directus.connect(), run))


def command_release() -> None:
    config.load_env()
    collections = release.load_collections()
    runs = {run for collection in collections for run in collection.runs}
    rows = directus.release_rows(directus.connect(), runs)
    version = release.next_version(release.RELEASES_DIR, date.today())
    engravings = engraving.load_engravings()
    pronunciations = pronunciation.load_pronunciations()
    try:
        files = release.build(
            collections,
            rows,
            ngram.frequency,
            version,
            datetime.now(UTC),
            engravings,
            pronunciations,
            engraving.load_initials(),
            engraving.load_seals(),
        )
    except release.ReleaseError as error:
        raise SystemExit(f"Version refusée : {error}") from error
    latest = release.latest_release(release.RELEASES_DIR)
    if latest is not None and release.same_collections(files, latest):
        print(f"Rien de nouveau depuis {latest.name}.")
        return
    target = release.RELEASES_DIR / version
    release.write(files, target)
    manifest = json.loads(files["manifest.json"])
    for entry in manifest["collections"]:
        print(f"{entry['name']} : {entry['cardCount']} cartes")
    released = {
        c["id"]
        for entry in manifest["collections"]
        for c in json.loads(files[entry["file"]])["cards"]
        if c["engraving"] is not None and c["id"] in engravings
    }
    missing = sorted(set(engravings) - released)
    print(
        f"{len(released)} cartes avec gravure" + (f" (hors version : {missing})" if missing else "")
    )
    lettered = sum(
        1
        for entry in manifest["collections"]
        for c in json.loads(files[entry["file"]])["cards"]
        if c["engraving"] is not None and c["id"] not in engravings
    )
    print(f"{lettered} cartes avec une lettrine à la place")
    spoken = sum(
        1
        for entry in manifest["collections"]
        for c in json.loads(files[entry["file"]])["cards"]
        if c["pronunciation"] is not None
    )
    print(f"{spoken} cartes avec prononciation")
    print(f"Version {version} écrite dans {target}. Publier : pnpm catalog:publish")


def gravure_cards(
    release_dir: str | None, ids: str | None, limit: int | None
) -> tuple[list[gravures.Card], list[gravures.Card]]:
    """(selected cards, whole catalogue) of the release."""
    path = release.latest_release(release.RELEASES_DIR) if release_dir is None else None
    path = path or release.RELEASES_DIR / str(release_dir)
    catalogue = gravures.load_cards(path)
    wanted = [i.strip() for i in ids.split(",") if i.strip()] if ids else None
    selected = gravures.select_cards(catalogue, wanted, limit)
    print(f"{path.name} : {len(selected)} cartes sur {len(catalogue)}")
    return selected, catalogue


def command_gravures(
    command: str,
    release_dir: str | None,
    ids: str | None,
    limit: int | None,
    yes: bool,
    round_number: int,
) -> None:
    if round_number not in (1, 2, 3):
        raise SystemExit("--round : 1, 2 ou 3")
    gravures.start_round(round_number)
    cards, catalogue = gravure_cards(release_dir, ids, limit)
    if command == "gravures-search":
        gravures.run_search(cards)
    elif command == "gravures-report":
        print(gravures.report(cards))
    else:
        config.load_env()
        config.require_env("ANTHROPIC_API_KEY")
        if command == "gravures-queries":
            asyncio.run(gravures.run_queries(cards, yes))
        else:
            asyncio.run(gravures.run_pick(cards, catalogue, yes))


def command_pronunciation_notation(release_dir: str | None) -> None:
    cards, _ = gravure_cards(release_dir, None, None)
    entries = littre.index()
    corrections = pronunciation.read_json(pronunciation.CORRECTIONS_FILE)
    cache = pronunciation.read_json(pronunciation.WIKTIONARY_FILE)
    wiktionary = pronunciation.fetch_wiktionary([c.word for c in cards], cache)
    notations = []
    for card in cards:
        littre_entries = entries.get(card.word.lower(), ())
        respelling = next((e.pronunciation for e in littre_entries if e.pronunciation), "")
        notations.append(
            pronunciation.decide(
                card.id,
                card.word,
                respelling,
                pronunciation.espeak_reading(card.word),
                wiktionary.get(card.word, []),
                corrections.get(card.id),
            )
        )
    pronunciation.write_notations(notations)
    counts = Counter(n.status for n in notations)
    print(", ".join(f"{status} {count}" for status, count in counts.most_common()))
    waiting = [n for n in notations if n.status == "a-relire"]
    if waiting:
        print(
            f"À relire ({len(waiting)}), notation à mettre dans {pronunciation.CORRECTIONS_FILE} :"
        )
        for n in waiting:
            print(
                f"  {n.card:18} littré « {n.littre} » → {n.littre_ipa or '—'} · "
                f"espeak {n.espeak or '—'} · wiktionnaire {' / '.join(n.wiktionary) or '—'}"
            )


def command_pronunciation_audio(ids: str | None, limit: int | None, yes: bool) -> None:
    config.load_env()
    api_key = config.require_env("GOOGLE_TTS_API_KEY")
    rendered_data = pronunciation.read_json(pronunciation.RENDERED_FILE)
    rendered: dict[str, dict[str, object]] = rendered_data.get("cards", {})
    wanted = {i.strip() for i in ids.split(",")} if ids else None
    todo = [
        n
        for n in pronunciation.read_notations()
        if n.ipa and (wanted is None or n.card in wanted) and pronunciation.stale(n, rendered)
    ][:limit]
    characters = pronunciation.billed_characters(todo)
    cost = pronunciation.estimated_cost(characters)
    print(f"{len(todo)} sons à générer, {characters} caractères, {cost:.2f} $ au tarif public")
    if cost > 3 and not yes:
        raise SystemExit("Plus de 3 $ : relancer avec --yes, avec l'accord du propriétaire.")
    out = pronunciation.OUT_DIR
    with httpx.Client(timeout=60) as http:
        for n in todo:
            audio = pronunciation.synthesize(http, api_key, n.word, n.ipa)
            path = pronunciation.published_path(n.card, audio)
            (out / path).parent.mkdir(parents=True, exist_ok=True)
            (out / path).write_bytes(audio)
            rendered[n.card] = {"ipa": n.ipa, "audio": path, "voice": pronunciation.VOICE}
            # Saved after each file: an interrupted run resumes where it stopped.
            pronunciation.RENDERED_FILE.write_text(
                json.dumps({"cards": rendered}, ensure_ascii=False, indent=1), encoding="utf-8"
            )
            print(f"{n.card:18} {n.ipa:20} {len(audio) / 1024:4.1f} Ko", flush=True)
    print(f"{len(rendered)} cartes ont un son dans {out}")


def main() -> None:
    parser = argparse.ArgumentParser(prog="leximon_content")
    parser.add_argument(
        "command",
        choices=[
            "ngram",
            "prescreen",
            "select",
            "draft",
            "quality",
            "push",
            "refresh",
            "report",
            "release",
            "gravures-queries",
            "gravures-search",
            "gravures-pick",
            "gravures-report",
            "gravures-render",
            "prononciation-notation",
            "prononciation-audio",
        ],
    )
    parser.add_argument("--run", default="essai-50")
    parser.add_argument("--compare", action="store_true", help="draft: compare every model")
    parser.add_argument("--size", type=int, default=50, help="select: number of words")
    parser.add_argument("--pool", action="store_true", help="prescreen: the candidate pool")
    parser.add_argument(
        "--domain",
        default=None,
        help="prescreen --pool: screen again the promising words of a domain since split",
    )
    parser.add_argument(
        "--limit",
        type=int,
        default=None,
        help="prescreen --pool, gravures-*, prononciation-audio: at most N",
    )
    parser.add_argument(
        "--cards", default=None, help="gravures-*, prononciation-audio: comma-separated card ids"
    )
    parser.add_argument(
        "--release", default=None, help="gravures-*, prononciation-notation: release directory name"
    )
    parser.add_argument(
        "--round", type=int, default=1, help="gravures-*: 2 or 3 for the cards still without one"
    )
    parser.add_argument("--yes", action="store_true", help="approve a step above a few dollars")
    args = parser.parse_args()
    if args.command == "prononciation-notation":
        command_pronunciation_notation(args.release)
        return
    if args.command == "prononciation-audio":
        command_pronunciation_audio(args.cards, args.limit, args.yes)
        return
    if args.command == "gravures-render":
        engraving.run_render()
        return
    if args.command.startswith("gravures-"):
        command_gravures(args.command, args.release, args.cards, args.limit, args.yes, args.round)
        return
    if args.command == "release":
        command_release()
        return
    if args.command == "prescreen":
        command_prescreen(args.run, args.pool, args.limit, args.yes, args.domain)
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
