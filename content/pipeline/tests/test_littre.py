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


def _entry(headword: str, etymology: str = "") -> littre.Entry:
    sense = littre.Sense(number=None, definition=f"Sens de {headword}.", citations=())
    return littre.Entry(headword, 0, "s. m.", (sense,), etymology)


BASES = {
    w: (_entry(w),)
    for w in ("secréter", "secret", "secrétaire", "oculaire", "cep", "et", "stathouder")
}


def test_the_base_word_named_in_a_short_etymology_is_found() -> None:
    assert littre.base_entry(_entry("oculariste", "Oculaire."), BASES) == BASES["oculaire"][0]
    assert littre.base_entry(_entry("receper", "Re..., et cep."), BASES) == BASES["cep"][0]
    long = "Ital. festone. " + "L'étymologie paraît être le latin festum. " * 3
    assert littre.base_entry(_entry("feston", long), BASES) is None


def test_without_etymology_the_longest_shared_stem_gives_the_base() -> None:
    assert littre.base_entry(_entry("secrétage"), BASES) == BASES["secréter"][0]
    assert littre.base_entry(_entry("stathoudérat"), BASES) == BASES["stathouder"][0]
    assert littre.base_entry(_entry("abracadabra"), BASES) is None


def test_the_base_word_is_rendered_after_the_entry() -> None:
    text = littre.render(_entry("secrétage"), base=_entry("secréter", "Secret."))
    assert "MOT DE BASE PROBABLE (autre entrée du Littré) : secréter" in text
    assert "ÉTYMOLOGIE DU MOT DE BASE : Secret." in text
    assert "MOT DE BASE" not in littre.render(_entry("secrétage"))
