"""Review workflow in Directus (D-008): one item per draft, reviewed blind (the model is hidden)."""

import random
import statistics
from collections import Counter, defaultdict
from datetime import datetime
from itertools import pairwise

import httpx

from . import config, littre
from .checks import Check, failed
from .drafting import THEMES, CardDraft

COLLECTION = "card_drafts"
VERDICTS = {
    "ok": "OK tel quel",
    "retouche": "Retouche légère",
    "reecrire": "À réécrire",
    "rejet": "Mot à rejeter",
}
#: Gaps longer than this between two reviews are pauses, not review time.
MAX_REVIEW_GAP_S = 600


def connect() -> httpx.Client:
    token = config.require_env("DIRECTUS_ADMIN_TOKEN")
    return httpx.Client(
        base_url=config.require_env("DIRECTUS_URL"),
        headers={"Authorization": f"Bearer {token}"},
        timeout=30,
    )


def _field(name: str, kind: str, interface: str | None = None, **meta: object) -> dict[str, object]:
    return {"field": name, "type": kind, "meta": {"interface": interface, **meta}, "schema": {}}


FIELDS = [
    _field("review_order", "integer", hidden=True, readonly=True),
    _field("word", "string", "input", readonly=True, width="half"),
    _field("part_of_speech", "string", "input", width="half"),
    _field(
        "definition", "text", "input-multiline", note="25 mots au maximum. Corrigez directement."
    ),
    _field("etymology", "text", "input-multiline", note="30 mots au maximum."),
    _field(
        "era",
        "string",
        "input",
        readonly=True,
        width="half",
        note="Calculée depuis l'historique du Littré.",
    ),
    _field("quote_author", "string", "input", width="half"),
    _field("quote_text", "text", "input-multiline", readonly=True),
    _field("quote_reference", "string", "input", readonly=True),
    _field("themes", "json", "tags", options={"presets": list(THEMES), "allowCustom": False}),
    _field(
        "model_opinion",
        "text",
        "input-multiline",
        readonly=True,
        note="Avis du modèle sur l'intérêt du mot.",
    ),
    _field("automatic_checks", "text", "input-multiline", readonly=True),
    _field(
        "verdict",
        "string",
        "select-dropdown",
        options={"choices": [{"value": v, "text": t} for v, t in VERDICTS.items()]},
        width="half",
    ),
    _field("reviewer_notes", "text", "input-multiline", note="Erreur factuelle, problème de ton…"),
    _field(
        "littre_entry",
        "text",
        "input-multiline",
        readonly=True,
        note="Source : Littré, via XMLittré.",
    ),
    # Hidden: the review is blind, and these feed the report.
    _field("model", "string", hidden=True, readonly=True),
    _field("run", "string", hidden=True, readonly=True),
    _field("original_definition", "text", hidden=True, readonly=True),
    _field("original_etymology", "text", hidden=True, readonly=True),
    _field("automatic_checks_failed", "json", hidden=True, readonly=True),
    _field("selection", "json", hidden=True, readonly=True),
    _field("cost_usd", "float", hidden=True, readonly=True),
    {
        "field": "reviewed_at",
        "type": "timestamp",
        "meta": {"special": ["date-updated"], "hidden": True, "readonly": True},
        "schema": {},
    },
]


def ensure_schema(client: httpx.Client) -> None:
    """Creates the collection and any missing field. Idempotent."""
    collections = {
        c["collection"] for c in client.get("/collections").raise_for_status().json()["data"]
    }
    if COLLECTION not in collections:
        client.post(
            "/collections",
            json={
                "collection": COLLECTION,
                "meta": {
                    "icon": "style",
                    "note": "Brouillons de cartes à relire (essai éditorial P4)",
                    "sort_field": "review_order",
                },
                "schema": {},
                "fields": [
                    {
                        "field": "id",
                        "type": "integer",
                        "meta": {"hidden": True, "readonly": True},
                        "schema": {"is_primary_key": True, "has_auto_increment": True},
                    }
                ],
            },
        ).raise_for_status()

    existing = {
        f["field"] for f in client.get(f"/fields/{COLLECTION}").raise_for_status().json()["data"]
    }
    for definition in FIELDS:
        if definition["field"] not in existing:
            client.post(f"/fields/{COLLECTION}", json=definition).raise_for_status()


def draft_row(
    run: str,
    result: dict[str, object],
    draft: CardDraft,
    entry: littre.Entry,
    automatic: list[Check],
    selected: dict[str, object],
) -> dict[str, object]:
    citations = entry.citations[:12]
    quote = (
        citations[draft.quote_index - 1]
        if draft.quote_index and draft.quote_index <= len(citations)
        else None
    )
    century = entry.earliest_century
    return {
        "run": run,
        "model": result["model"],
        "word": entry.headword.lower(),
        "part_of_speech": draft.part_of_speech,
        "definition": draft.definition,
        "original_definition": draft.definition,
        "etymology": draft.etymology,
        "original_etymology": draft.etymology,
        "era": f"{century}e siècle" if century else "à compléter",
        "quote_text": quote.text if quote else None,
        "quote_author": draft.quote_author if quote else None,
        "quote_reference": quote.reference if quote else None,
        "themes": draft.themes,
        "model_opinion": f"{draft.suitability} : {draft.suitability_reason}",
        "automatic_checks": "\n".join(
            f"{'✓' if c.passed else '✗'} {c.name} — {c.detail}" for c in automatic
        ),
        "automatic_checks_failed": failed(automatic),
        "littre_entry": littre.render(entry),
        "selection": selected,
        "cost_usd": result["cost_usd"],
    }


def replace_run(
    client: httpx.Client, run: str, rows: list[dict[str, object]], seed: int = 2026
) -> int:
    """Deletes the run's previous items, then inserts the rows in a shuffled (blind) order."""
    old = (
        client.get(
            f"/items/{COLLECTION}", params={"filter[run][_eq]": run, "fields": "id", "limit": "-1"}
        )
        .raise_for_status()
        .json()["data"]
    )
    if old:
        client.request(
            "DELETE", f"/items/{COLLECTION}", json=[item["id"] for item in old]
        ).raise_for_status()

    shuffled = rows[:]
    random.Random(seed).shuffle(shuffled)
    for order, row in enumerate(shuffled, start=1):
        row["review_order"] = order
    client.post(f"/items/{COLLECTION}", json=shuffled).raise_for_status()
    return len(shuffled)


def report(client: httpx.Client, run: str) -> str:
    items = (
        client.get(
            f"/items/{COLLECTION}",
            params={
                "filter[run][_eq]": run,
                "fields": "model,verdict,definition,original_definition,etymology,original_etymology,"
                "reviewed_at,automatic_checks_failed,cost_usd",
                "limit": "-1",
            },
        )
        .raise_for_status()
        .json()["data"]
    )

    reviewed = sorted((i for i in items if i["verdict"]), key=lambda i: i["reviewed_at"] or "")
    seconds: dict[str, list[float]] = defaultdict(list)
    for previous, current in pairwise(reviewed):
        gap = (_parse(current["reviewed_at"]) - _parse(previous["reviewed_at"])).total_seconds()
        if 0 < gap <= MAX_REVIEW_GAP_S:
            seconds[current["model"]].append(gap)

    lines = [f"Run {run} : {len(reviewed)}/{len(items)} brouillons relus", ""]
    for model in sorted({i["model"] for i in items}):
        mine = [i for i in items if i["model"] == model]
        done = [i for i in mine if i["verdict"]]
        verdicts = Counter(i["verdict"] for i in done)
        accepted = verdicts["ok"] + verdicts["retouche"]
        edited = sum(
            i["definition"] != i["original_definition"] or i["etymology"] != i["original_etymology"]
            for i in done
        )
        times = seconds.get(model, [])
        lines += [
            f"{model}",
            f"  relus : {len(done)}/{len(mine)}",
            "  verdicts : " + ", ".join(f"{VERDICTS[v]} {verdicts[v]}" for v in VERDICTS),
            f"  acceptés (OK + retouche légère) : {accepted / len(done):.0%}"
            if done
            else "  acceptés : -",
            f"  textes modifiés par le relecteur : {edited}",
            f"  temps de relecture médian : {statistics.median(times):.0f} s"
            if times
            else "  temps : -",
            f"  coût total : {sum(i['cost_usd'] or 0 for i in mine):.3f} $",
            "",
        ]
    return "\n".join(lines)


def _parse(value: str) -> datetime:
    return datetime.fromisoformat(value.replace("Z", "+00:00"))
