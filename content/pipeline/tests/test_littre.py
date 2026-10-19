from pathlib import Path

import pytest

from leximon_content import littre

FIXTURES = Path(__file__).parent / "fixtures"


@pytest.fixture(scope="module")
def faquin() -> littre.Entry:
    entries = list(littre.iter_entries(FIXTURES))
    assert len(entries) == 1, "supplement entries are skipped"
    return entries[0]


@pytest.mark.parametrize(("roman", "value"), [("XI", 11), ("XIV", 14), ("XIX", 19), ("IV", 4)])
def test_roman_numerals(roman: str, value: int) -> None:
    assert littre.roman_to_int(roman) == value


def test_senses_keep_the_definition_without_citations(faquin: littre.Entry) -> None:
    assert [s.definition for s in faquin.senses] == [
        "Homme de néant, plat et impertinent.",
        "Portefaix.",
    ]


def test_id_refers_to_the_previous_author(faquin: littre.Entry) -> None:
    assert [(c.author, c.reference) for c in faquin.citations] == [
        ("MOL.", "Préc. 12"),
        ("MOL.", "Scap. III, 2"),
        ("BOIL.", "Sat. I"),
    ]


def test_earliest_century_comes_from_the_history(faquin: littre.Entry) -> None:
    assert faquin.earliest_century == 14


def test_render_numbers_the_citations(faquin: littre.Entry) -> None:
    text = littre.render(faquin)
    assert "[2] « Tu fais le faquin » — MOL., Scap. III, 2" in text
    assert "ÉTYMOLOGIE : Ital. facchino, portefaix." in text
    assert "PREMIÈRE ATTESTATION DATÉE : 14e siècle" in text
