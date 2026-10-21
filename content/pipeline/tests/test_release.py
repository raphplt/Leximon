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
        "engraving": None,
        "pronunciation": None,
    }


def test_a_rendered_engraving_is_attached_to_its_card() -> None:
    engraving = {
        "ink": "gravures/poelonnee.0123456789ab.ink.webp",
        "fill": "gravures/poelonnee.ba9876543210.fill.webp",
        "width": 300,
        "height": 480,
        "credit": "Anonyme, 1849 · Wikimedia Commons (domaine public)",
        "sourceUrl": "https://commons.wikimedia.org/wiki/File:X.jpg",
        "licence": "domaine public",
    }
    files = release.build(
        [FONDATEURS],
        {"lot-1": [row("poêlonnée"), row("raclure")]},
        frequency,
        "2026-10-19.1",
        NOW,
        {"poelonnee": engraving, "retiree": engraving},
    )
    manifest = json.loads(files["manifest.json"])
    cards = json.loads(files[manifest["collections"][0]["file"]])["cards"]
    assert {c["id"]: c["engraving"] for c in cards} == {"poelonnee": engraving, "raclure": None}


def test_a_pronunciation_is_attached_to_its_card() -> None:
    spoken = {"ipa": "pwalɔne", "audio": "prononciation/poelonnee.0123456789ab.mp3"}
    files = release.build(
        [FONDATEURS],
        {"lot-1": [row("poêlonnée"), row("raclure")]},
        frequency,
        "2026-10-19.1",
        NOW,
        {},
        {"poelonnee": spoken},
    )
    manifest = json.loads(files["manifest.json"])
    cards = json.loads(files[manifest["collections"][0]["file"]])["cards"]
    assert {c["id"]: c["pronunciation"] for c in cards} == {"poelonnee": spoken, "raclure": None}


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


def test_the_back_tone_goes_into_the_collection_file() -> None:
    toned = Collection(id="fondateurs", name="Les Fondateurs", runs=("lot-1",), back="burgundy")
    files = build([row("billevesee")], collections=(toned,))
    manifest = json.loads(files["manifest.json"])
    collection = json.loads(files[manifest["collections"][0]["file"]])
    assert collection["back"] == "burgundy"
    plain = build([row("billevesee")])
    manifest = json.loads(plain["manifest.json"])
    assert "back" not in json.loads(plain[manifest["collections"][0]["file"]])


def test_a_card_without_engraving_shows_the_initial_of_its_word() -> None:
    def initial(letter: str) -> dict[str, object]:
        return {"ink": f"gravures/lettrine-{letter.lower()}.0123456789ab.ink.webp"}

    initials = {"E": initial("E"), "O": initial("O"), "I": initial("I")}
    engraving = {"ink": "gravures/raclure.0123456789ab.ink.webp"}
    words = ["écornifleur", "œillade", "jaserie", "raclure", "zinzolin"]
    files = release.build(
        [FONDATEURS],
        {"lot-1": [row(word) for word in words]},
        frequency,
        "2026-10-19.1",
        NOW,
        {"raclure": engraving},
        None,
        initials,
    )
    manifest = json.loads(files["manifest.json"])
    cards = json.loads(files[manifest["collections"][0]["file"]])["cards"]
    assert {c["id"]: c["engraving"] for c in cards} == {
        "ecornifleur": initials["E"],
        "oeillade": initials["O"],
        "jaserie": initials["I"],
        "raclure": engraving,
        "zinzolin": None,
    }
