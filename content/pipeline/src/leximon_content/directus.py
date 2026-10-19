"""Review workflow in Directus (D-008): one item per draft, reviewed blind (the model is hidden)."""

import random
import statistics
from collections import Counter, defaultdict
from datetime import date, datetime
from itertools import pairwise

import httpx

from . import config, littre, ngram
from .checks import Check, failed
from .drafting import THEMES, CardDraft
from .rarity import LABELS, RarityRule, can_be_pepite, frequency_label, rarity, rule_on

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
        "rarity",
        "string",
        "input",
        readonly=True,
        width="half",
        note="Calculée depuis la fréquence et la mention pépite (D-020). Recalculée par refresh.",
    ),
    _field(
        "pepite",
        "boolean",
        "boolean",
        width="half",
        note="Une carte qu'on serait fier de tirer. Proposée par le modèle quand le mot est assez "
        "rare pour être Épique ou Légendaire ; sans effet sur un mot plus courant.",
    ),
    _field(
        "modern_frequency",
        "string",
        "input",
        readonly=True,
        note="Google Ngram, occurrences par milliard de mots depuis 1990. Affichée sur la carte.",
    ),
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
    word = entry.headword.lower()
    frequency = ngram.frequency(word)
    rule = rule_on(date.today())
    pepite = draft.pepite and frequency is not None and can_be_pepite(frequency, rule)
    return {
        "run": run,
        "model": result["model"],
        "word": word,
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
        "modern_frequency": frequency_label(frequency),
        "pepite": pepite,
        "rarity": rarity_label(frequency, pepite, rule),
        "cost_usd": result["cost_usd"],
    }


def rarity_label(frequency: ngram.NgramFrequency | None, pepite: bool, rule: RarityRule) -> str:
    computed = rarity(frequency, pepite, rule)
    return LABELS[computed] if computed else "à compléter (mot composé)"


#: Columns of the review table, in order. The model stays hidden: the review is blind.
TABLE_FIELDS = ["word", "definition", "rarity", "pepite", "verdict"]


def ensure_layout(client: httpx.Client) -> None:
    """Shows the word first in every table view of the collection (default and saved views)."""
    layout_query = {"tabular": {"fields": TABLE_FIELDS, "sort": ["review_order"], "limit": 50}}
    presets = (
        client.get("/presets", params={"filter[collection][_eq]": COLLECTION, "limit": "-1"})
        .raise_for_status()
        .json()["data"]
    )
    for preset in presets:
        client.patch(
            f"/presets/{preset['id']}", json={"layout": "tabular", "layout_query": layout_query}
        ).raise_for_status()
    if not any(p["user"] is None and p["role"] is None and p["bookmark"] is None for p in presets):
        client.post(
            "/presets",
            json={"collection": COLLECTION, "layout": "tabular", "layout_query": layout_query},
        ).raise_for_status()

    # The item form follows the same order, then the remaining fields as declared.
    order = [*TABLE_FIELDS, *(f["field"] for f in FIELDS if f["field"] not in TABLE_FIELDS)]
    for position, name in enumerate(order, start=1):
        client.patch(
            f"/fields/{COLLECTION}/{name}", json={"meta": {"sort": position}}
        ).raise_for_status()


def refresh_run(client: httpx.Client, run: str) -> int:
    """Recomputes the derived fields (frequency, rarity from the reviewer's pépite mark) without
    touching the review itself (verdicts, edits)."""
    items = (
        client.get(
            f"/items/{COLLECTION}",
            params={"filter[run][_eq]": run, "fields": "id,word,pepite", "limit": "-1"},
        )
        .raise_for_status()
        .json()["data"]
    )
    rule = rule_on(date.today())
    for item in items:
        frequency = ngram.frequency(item["word"])
        client.patch(
            f"/items/{COLLECTION}/{item['id']}",
            json={
                "modern_frequency": frequency_label(frequency),
                "rarity": rarity_label(frequency, bool(item["pepite"]), rule),
            },
        ).raise_for_status()
    return len(items)


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
