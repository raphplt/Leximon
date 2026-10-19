import json
from datetime import UTC, date, datetime

import pytest

from leximon_content import release
from leximon_content.ngram import NgramFrequency
from leximon_content.release import Collection, ReleaseError


def row(word: str, **overrides: object) -> dict[str, object]:
    base: dict[str, object] = {
        "run": "lot-1",
        "word": word,
        "part_of_speech": "n. f.",
        "era": "13e siècle",
        "definition": "Une définition.",
        "etymology": "Une étymologie.",
        "quote_text": "Une citation",
        "quote_author": "Molière",
        "themes": ["cuisine", "cuisine", "arts"],
        "rarity": "Rare",
        "verdict": None,
        "to_review": False,
    }
    return {**base, **overrides}


def frequency(_word: str) -> NgramFrequency:
    return NgramFrequency(modern=1.23456, littre_era=10.0, attested=True)


FONDATEURS = Collection(id="fondateurs", name="Les Fondateurs", runs=("lot-1",))
NOW = datetime(2026, 10, 19, 20, 0, tzinfo=UTC)


def build(rows: list[dict[str, object]], collections=(FONDATEURS,)) -> dict[str, bytes]:
    return release.build(collections, {"lot-1": rows}, frequency, "2026-10-19.1", NOW)


def test_card_follows_the_catalogue_schema() -> None:
    files = build([row("poêlonnée")])
    manifest = json.loads(files["manifest.json"])
    entry = manifest["collections"][0]
    assert manifest["schemaVersion"] == 1
    assert manifest["releasedAt"] == "2026-10-19T20:00:00.000Z"
    assert entry["cardCount"] == 1
    card = json.loads(files[entry["file"]])["cards"][0]
    assert card == {
        "id": "poelonnee",
        "word": "poêlonnée",
        "partOfSpeech": "n. f.",
        "era": "XIIIe s.",
        "definition": "Une définition.",
        "etymology": "Une étymologie.",
        "quote": {"text": "Une citation", "author": "Molière"},
        "rarity": "rare",
        "collectionId": "fondateurs",
        "themes": ["arts", "cuisine"],
        "perBillion": 1.23,
    }


def test_only_publishable_cards_are_released() -> None:
    files = build(
        [
            row("accepte", verdict="ok", to_review=True),
            row("retouche", verdict="retouche"),
            row("en-attente", to_review=True),
            row("a-reecrire", verdict="reecrire"),
            row("rejete", verdict="rejet"),
            row("compose", rarity="à compléter (mot composé)"),
            row("libre"),
        ]
    )
    manifest = json.loads(files["manifest.json"])
    cards = json.loads(files[manifest["collections"][0]["file"]])["cards"]
    assert [c["id"] for c in cards] == ["accepte", "libre", "retouche"]


def test_file_name_changes_only_with_content() -> None:
    first = build([row("billevesee")])
    again = build([row("billevesee")])
    changed = build([row("billevesee", definition="Autre définition.")])
    name = lambda files: [p for p in files if p.startswith("collections/")]  # noqa: E731
    assert name(first) == name(again)
    assert name(first) != name(changed)


def test_a_card_belongs_to_one_collection() -> None:
    twice = Collection(id="doublon", name="Doublon", runs=("lot-1",))
    with pytest.raises(ReleaseError, match="déjà dans fondateurs"):
        build([row("billevesee")], collections=(FONDATEURS, twice))


def test_unknown_run_is_refused() -> None:
    missing = Collection(id="vide", name="Vide", runs=("lot-9",))
    with pytest.raises(ReleaseError, match="lot-9"):
        build([], collections=(missing,))


def test_unknown_era_and_missing_quote_stay_empty() -> None:
    assert release.era_label("à compléter") is None
    files = build([row("poue", era="à compléter", quote_text=None)])
    manifest = json.loads(files["manifest.json"])
    card = json.loads(files[manifest["collections"][0]["file"]])["cards"][0]
    assert card["era"] is None and card["quote"] is None


def test_slug_and_versions(tmp_path) -> None:
    assert release.slug("Œil-de-bœuf") == "oeil-de-boeuf"
    assert release.next_version(tmp_path, date(2026, 10, 19)) == "2026-10-19.1"
    (tmp_path / "2026-10-19.1").mkdir()
    (tmp_path / "2026-10-19.2").mkdir()
    assert release.next_version(tmp_path, date(2026, 10, 19)) == "2026-10-19.3"
    assert release.latest_release(tmp_path).name == "2026-10-19.2"


def test_unattested_word_has_no_frequency() -> None:
    assert release.per_billion(NgramFrequency(modern=0.0, littre_era=0.0, attested=False)) is None
