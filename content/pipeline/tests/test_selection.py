from collections import Counter
from pathlib import Path

import pytest

from leximon_content.selection import Candidate, Find, FindsError, load_finds, match_finds, pick

TIERS = ("common", "uncommon", "rare", "precious")


def pool() -> list[Candidate]:
    words = [Candidate(f"{tier}{i}", tier, 1.0, ()) for tier in TIERS for i in range(200)]
    words += [Candidate(f"insulte{i}", "common", 900.0, ("insulte",)) for i in range(20)]
    words += [Candidate("billevesée", "common", 160.0, ())]
    return words


def test_the_batch_follows_the_themes_then_the_tier_shares() -> None:
    picked = pick(pool(), 100, seed=1)
    assert len(picked) == 100
    reasons = Counter(c.pick_reason for c in picked)
    assert reasons["insulte"] == 5
    assert reasons["loufoque"] == 1  # only one odd word in the pool
    assert reasons["Précieux"] > reasons["Rare"]
    assert len({c.word for c in picked}) == 100


def test_the_same_seed_gives_the_same_batch() -> None:
    assert pick(pool(), 60, seed=7) == pick(pool(), 60, seed=7)


def test_words_drafted_in_an_earlier_run_are_skipped() -> None:
    first = pick(pool(), 60, seed=7)
    second = pick(pool(), 60, seed=7, exclude=frozenset(c.word for c in first))
    assert not {c.word for c in first} & {c.word for c in second}


def test_transparent_words_are_recognised() -> None:
    from leximon_content.selection import is_transparent

    common = frozenset({"nettoyer", "solide"})
    assert is_transparent("renettoyer", ["v. a."], common)
    assert is_transparent("insolide", ["adj."], common)
    assert is_transparent("héréditairement", ["adv."], common)
    assert is_transparent("abaissé", ["part. passé"], common)
    assert not is_transparent("barguigner", ["v. n."], common)
    assert not is_transparent("rogaton", ["s. m."], common)


def test_found_words_come_first_and_count_toward_the_size() -> None:
    found = ["rare3", "precious7", "common1"]
    picked = pick(pool(), 60, seed=7, first=found)
    assert len(picked) == 60
    assert [c.word for c in picked[:3]] == found
    assert all(c.pick_reason == "déniché" for c in picked[:3])
    assert len({c.word for c in picked}) == 60


def test_found_words_are_kept_beyond_the_size() -> None:
    found = [f"common{i}" for i in range(12)]
    picked = pick(pool(), 10, seed=7, first=found)
    assert [c.word for c in picked] == found


def test_finds_match_the_pool_by_word_or_card_id(tmp_path: Path) -> None:
    assert load_finds(tmp_path / "absent.json") == []
    path = tmp_path / "finds.json"
    path.write_text(
        '{"words": [{"id": "billevesee", "word": "Billevesée"}, {"id": "rare3", "word": "x"},'
        ' {"id": "lucubrateur", "word": "lucubrateur"}]}',
        encoding="utf-8",
    )
    finds = load_finds(path)
    placed, missing = match_finds(finds, pool())
    assert placed == ["billevesée", "rare3"]
    assert missing == [Find("lucubrateur", "lucubrateur")]


def test_a_malformed_finds_file_is_refused(tmp_path: Path) -> None:
    path = tmp_path / "finds.json"
    path.write_text('{"words": [{"id": 3}]}', encoding="utf-8")
    with pytest.raises(FindsError):
        load_finds(path)
