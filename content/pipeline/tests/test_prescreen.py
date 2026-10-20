import asyncio
from pathlib import Path

from fake_api import FakeApi

from leximon_content import littre, prescreen

ENTRY = next(littre.iter_entries(Path(__file__).parent / "fixtures"))


def test_the_excerpt_is_short_and_keeps_the_essentials() -> None:
    text = prescreen.excerpt(ENTRY)
    assert text.startswith(f"MOT : {ENTRY.headword}")
    assert len(text) < len(littre.render(ENTRY))
    assert "CITATIONS" not in text


def test_a_prediction_outside_the_categories_is_an_error() -> None:
    answer = {"suitability": "ok", "domain": "nature"}
    good = asyncio.run(prescreen.predict(FakeApi(answer), ENTRY))  # type: ignore[arg-type]
    assert good.suitability == "ok" and good.domain == "nature"
    assert good.error is None and good.cost_usd > 0
    bad = asyncio.run(prescreen.predict(FakeApi({"suitability": "bof", "domain": "nature"}), ENTRY))  # type: ignore[arg-type]
    assert bad.suitability is None and bad.error
    no_domain = asyncio.run(prescreen.predict(FakeApi({"suitability": "ok", "domain": "x"}), ENTRY))  # type: ignore[arg-type]
    assert no_domain.suitability is None and no_domain.error


def test_agreement_counts_the_words_let_through_and_those_lost() -> None:
    predicted = {"a": "ok", "b": "ok", "c": "trop_courant", "d": "trop_technique", "z": "ok"}
    reference = {"a": "ok", "b": "sens_incertain", "c": "ok", "d": "trop_technique"}
    a = prescreen.agreement(predicted, reference)
    assert (a.compared, a.both_ok, a.only_prescreen_ok, a.only_reference_ok) == (4, 1, 1, 1)
    assert a.precision == 0.5 and a.recall == 0.5
    assert a.same_category == 2
