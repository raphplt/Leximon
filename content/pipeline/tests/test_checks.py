from pathlib import Path

from leximon_content import checks, littre
from leximon_content.drafting import CardDraft

ENTRY = next(littre.iter_entries(Path(__file__).parent / "fixtures"))


def draft(**overrides: object) -> CardDraft:
    values: dict[str, object] = {
        "definition": "Individu sans valeur qui se donne de grands airs.",
        "etymology": "De l'italien facchino, portefaix.",
        "quote_index": 2,
        "quote_author": "Molière",
        "part_of_speech": "n. m.",
        "themes": ["insultes"],
        "suitability": "ok",
        "suitability_reason": "Insulte ancienne et savoureuse.",
    }
    return CardDraft.model_validate({**values, **overrides})


def test_a_good_draft_passes_every_check() -> None:
    assert checks.failed(checks.run_checks(draft(), ENTRY)) == []


def test_too_long_definitions_fail() -> None:
    assert "definition_length" in checks.failed(
        checks.run_checks(draft(definition="mot " * 26), ENTRY)
    )


def test_copying_the_littre_is_shown_despite_accents_and_case_but_is_not_a_failure() -> None:
    copied = draft(definition="C'est un HOMME DE NEANT, PLAT ET IMPERTINENT envers tous.")
    results = {c.name: c for c in checks.run_checks(copied, ENTRY)}
    assert not results["not_copied"].passed
    assert checks.symbol(results["not_copied"]) == "○"
    assert checks.failed(list(results.values())) == []


def test_a_quote_number_outside_the_list_fails() -> None:
    assert "quote" in checks.failed(checks.run_checks(draft(quote_index=9), ENTRY))


def test_an_unsuitable_word_is_flagged() -> None:
    flagged = draft(suitability="offensant_aujourdhui", suitability_reason="Injure raciste.")
    assert checks.failed(checks.run_checks(flagged, ENTRY)) == ["suitability"]


def test_a_word_on_the_exclusion_list_fails_whatever_the_model_says() -> None:
    from dataclasses import replace

    slur = replace(ENTRY, headword="Métèque")
    assert "not_excluded" in checks.failed(checks.run_checks(draft(), slur))


def test_an_english_word_in_the_definition_or_etymology_fails() -> None:
    slipped = draft(definition="Les moines, vus comme une masse that l'on dédaigne.")
    results = {c.name: c for c in checks.run_checks(slipped, ENTRY)}
    assert checks.failed(list(results.values())) == ["french_only"]
    assert "« that »" in results["french_only"].detail
    assert "french_only" in checks.failed(
        checks.run_checks(draft(etymology="Of the Italian facchino."), ENTRY)
    )


def test_french_words_spelled_like_english_ones_pass() -> None:
    french = draft(
        definition="Buveur de thé, as du jeu, qui fait de l'are son but, or on l'en blâme.",
        etymology="Du latin in, « dans », et de l'anglais for.",
    )
    assert checks.failed(checks.run_checks(french, ENTRY)) == []


def test_a_definition_using_the_words_family_is_shown() -> None:
    from dataclasses import replace

    hussarde = replace(ENTRY, headword="Hussarde")
    results = {
        c.name: c for c in checks.run_checks(draft(definition="Danse des hussards."), hussarde)
    }
    assert not results["no_giveaway"].passed
    assert checks.failed(list(results.values())) == []  # tolerated, only reworded once
    assert "« hussards »" in results["no_giveaway"].detail
    assert checks.giveaway_words("jarron", "Petite jarre.") == ["jarre"]
    assert checks.giveaway_words("prévôté", "Charge du prevot.") == ["prevot"]


def test_short_words_and_unrelated_definitions_pass() -> None:
    assert checks.giveaway_words("noc", "Canal noc.") == []
    assert checks.giveaway_words("hussarde", "Danse hongroise à deux temps.") == []
