from leximon_content.quality import (
    EPIC_SHARE,
    LEGENDARY_SHARE,
    MIN_PEPITE_CHARM,
    PepiteCandidate,
    pick_pepites,
    quota,
    review_reasons,
)


def candidates() -> list[PepiteCandidate]:
    attested = [PepiteCandidate(f"attesté{i:02}", 6 + i / 10, True) for i in range(40)]
    absent = [PepiteCandidate(f"absent{i:02}", 6 + i / 10, False) for i in range(10)]
    return attested + absent


def test_pepites_follow_the_pyramid_with_the_best_scores_of_each_group() -> None:
    picked = pick_pepites(candidates(), catalogue_size=200)
    legendary = {w for w in picked if w.startswith("absent")}
    epic = picked - legendary
    assert len(legendary) == quota(LEGENDARY_SHARE, 200) == 4
    assert len(epic) == quota(EPIC_SHARE, 200) == 12
    assert legendary == {"absent09", "absent08", "absent07", "absent06"}
    assert "attesté39" in epic and "attesté27" not in epic


def test_a_small_group_gives_fewer_pepites_rather_than_borrowing_from_the_other() -> None:
    few = [PepiteCandidate("absent", 9.0, False), PepiteCandidate("attesté", 6.0, True)]
    assert pick_pepites(few, catalogue_size=200) == {"absent", "attesté"}


def test_ties_never_depend_on_input_order() -> None:
    tied = [PepiteCandidate(w, 7.0, True) for w in ("b", "a", "c")]
    assert pick_pepites(tied, 20) == pick_pepites(reversed(tied), 20) == {"a"}


def test_a_dull_word_is_never_a_pepite_even_when_the_quota_is_not_filled() -> None:
    dull = [
        PepiteCandidate("terne", MIN_PEPITE_CHARM - 0.5, False),
        PepiteCandidate("charmant", MIN_PEPITE_CHARM, False),
    ]
    assert pick_pepites(dull, catalogue_size=200) == {"charmant"}


def test_review_takes_flagged_cards_legendaries_and_a_sample_of_the_rest() -> None:
    words = [f"mot{i:03}" for i in range(200)]
    flags = {"mot000": ["faithfulness"], "mot001": ["checks"]}
    reasons = review_reasons(words, flags, legendary={"mot002"}, seed="lot")
    assert reasons["mot000"] == ["faithfulness"]
    assert reasons["mot002"] == ["legendary"]
    sampled = [w for w, r in reasons.items() if r == ["sample"]]
    assert len(sampled) == 10
    assert not {"mot000", "mot001", "mot002"} & set(sampled)
    assert review_reasons(words, flags, {"mot002"}, seed="lot") == reasons


def test_a_tiny_batch_still_gets_one_card_reviewed() -> None:
    assert len(review_reasons(["a", "b"], {}, set(), seed="s")) == 1
    assert review_reasons([], {}, set(), seed="s") == {}
