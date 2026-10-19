import asyncio
from pathlib import Path

from fake_api import FakeApi

from leximon_content import littre, verification
from leximon_content.drafting import CardDraft

ENTRY = next(littre.iter_entries(Path(__file__).parent / "fixtures"))
DRAFT = CardDraft(
    definition="Individu sans valeur qui se donne de grands airs.",
    etymology="De l'italien facchino, portefaix.",
    quote_index=1,
    quote_author="Molière",
    part_of_speech="n. m.",
    themes=["insultes"],
    suitability="ok",
    suitability_reason="Insulte ancienne.",
)


def verify(answer: object) -> verification.Verification:
    return asyncio.run(verification.verify(FakeApi(answer), DRAFT, ENTRY))  # type: ignore[arg-type]


def test_the_verifier_sees_the_entry_and_the_card_with_the_quote_abbreviation() -> None:
    api = FakeApi({"faithful": True, "problems": []})
    asyncio.run(verification.verify(api, DRAFT, ENTRY))  # type: ignore[arg-type]
    assert "ENTRÉE DU LITTRÉ" in api.prompts[0]
    assert DRAFT.definition in api.prompts[0]
    assert f"({ENTRY.citations[0].author}" in api.prompts[0]


def test_an_invented_or_contradicted_claim_fails_the_card_whatever_the_flag() -> None:
    problem = {"field": "etymology", "kind": "invente", "issue": "L'entrée ne donne pas l'italien."}
    result = verify({"faithful": True, "problems": [problem]})
    assert result.verdict is not None and not result.verdict.faithful
    assert "✗ etymology (invente)" in verification.summary(result.verdict)


def test_an_exact_addition_is_shown_but_does_not_fail_the_card() -> None:
    problem = {"field": "definition", "kind": "ajout_exact", "issue": "Bernard-l'ermite."}
    result = verify({"faithful": False, "problems": [problem]})
    assert result.verdict is not None and result.verdict.faithful
    assert verification.summary(result.verdict).startswith("✓")


def test_a_malformed_verdict_is_an_error_to_retry() -> None:
    result = verify({"faithful": "oui"})
    assert result.verdict is None and result.error


def test_only_failing_problems_go_back_to_the_drafter() -> None:
    row = {
        "verdict": {
            "faithful": False,
            "problems": [
                {"field": "definition", "kind": "invente", "issue": "Pelle « de fer »."},
                {"field": "definition", "kind": "ajout_exact", "issue": "Bernard-l'ermite."},
            ],
        }
    }
    assert verification.failing_problems(row) == ["definition : Pelle « de fer »."]


def test_the_attempt_is_recorded_so_that_a_correction_is_verified_again() -> None:
    result = asyncio.run(
        verification.verify(FakeApi({"faithful": True, "problems": []}), DRAFT, ENTRY, attempt=1)  # type: ignore[arg-type]
    )
    assert result.to_json()["attempt"] == 1
