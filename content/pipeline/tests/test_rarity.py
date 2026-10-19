from datetime import date

import pytest

from leximon_content.ngram import NgramFrequency
from leximon_content.rarity import RULES, frequency_label, rarity, rule_on, score

RULE = RULES[0]


def word(modern: float, littre_era: float | None = None, attested: bool = True) -> NgramFrequency:
    return NgramFrequency(modern, modern if littre_era is None else littre_era, attested)


def test_a_rarer_word_scores_higher() -> None:
    assert score(word(0.1)) > score(word(10)) > score(word(1000))


def test_a_word_never_common_is_rarer_than_one_that_was() -> None:
    assert score(word(1, littre_era=0.1)) > score(word(1, littre_era=100))


@pytest.mark.parametrize(
    ("modern", "expected"),
    [(160, "common"), (7, "uncommon"), (1.3, "rare"), (0.2, "precious"), (0, "precious")],
)
def test_frequency_alone_gives_common_to_precious(modern: float, expected: str) -> None:
    assert rarity(word(modern), pepite=False, rule=RULE) == expected


def test_a_pepite_has_no_effect_on_a_word_that_is_not_rare_enough() -> None:
    assert rarity(word(160), pepite=True, rule=RULE) == "common"
    assert rarity(word(1.3), pepite=True, rule=RULE) == "rare"


def test_a_rare_pepite_is_epic_and_legendary_when_absent_from_the_corpus() -> None:
    assert rarity(word(0.05), pepite=True, rule=RULE) == "epic"
    assert rarity(word(0, attested=False), pepite=True, rule=RULE) == "legendary"


def test_an_unknown_frequency_leaves_the_rarity_to_complete() -> None:
    assert rarity(None, pepite=True, rule=RULE) is None


def test_the_rule_in_force_is_the_latest_started() -> None:
    assert rule_on(date(2030, 1, 1)) == RULES[-1]
    with pytest.raises(ValueError):
        rule_on(date(2000, 1, 1))


def test_the_card_figure_is_short() -> None:
    assert frequency_label(word(0)) == "< 1 par milliard"
    assert frequency_label(word(0.284)) == "0,28 par milliard"
    assert frequency_label(word(1533.4)) == "1 533 par milliard"
    assert frequency_label(None).startswith("inconnue")
