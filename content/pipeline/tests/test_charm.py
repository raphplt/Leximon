import asyncio
from collections import Counter

from fake_api import FakeApi

from leximon_content import charm

CARDS = [charm.Card(w, "n. m.", f"Sens de {w}.", "Origine incertaine.", None) for w in "abc"]


def test_every_word_is_judged_once_per_round_among_other_neighbours() -> None:
    words = [f"mot{i}" for i in range(20)]
    planned = charm.batches(words, seed="lot")
    seen = Counter(w for _, batch in planned for w in batch)
    assert set(seen.values()) == {charm.ROUNDS}
    assert all(len(batch) >= charm.BATCH_SIZE // 2 for _, batch in planned)
    first = {batch for r, batch in planned if r == 1}
    second = {batch for r, batch in planned if r == 2}
    assert first != second
    assert charm.batches(list(reversed(words)), seed="lot") == planned


def test_a_judgement_must_score_exactly_the_cards_shown() -> None:
    scores = [
        {"word": w.upper(), "score": s, "reason": "."}
        for w, s in zip("abc", (9, 4, 1), strict=True)
    ]
    good = asyncio.run(charm.judge(FakeApi({"scores": scores}), 1, CARDS))  # type: ignore[arg-type]
    assert good.error is None and good.scores == {"a": 9, "b": 4, "c": 1}
    missing = asyncio.run(charm.judge(FakeApi({"scores": scores[:2]}), 1, CARDS))  # type: ignore[arg-type]
    assert missing.error and not missing.scores
    too_high = [{**scores[0], "score": 11}, *scores[1:]]
    out = asyncio.run(charm.judge(FakeApi({"scores": too_high}), 1, CARDS))  # type: ignore[arg-type]
    assert out.error


def test_the_charm_of_a_word_is_its_mean_over_rounds() -> None:
    judgements = [{"scores": {"a": 8, "b": 2}}, {"scores": {"a": 6}}]
    assert charm.mean_scores(judgements) == {"a": 7.0, "b": 2.0}
