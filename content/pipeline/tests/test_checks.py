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
