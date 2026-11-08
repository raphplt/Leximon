import json
from datetime import date
from pathlib import Path

from leximon_content import littre, reserve
from leximon_content.selection import Candidate


def entry(headword: str, definition: str, nature: str = "s. m.") -> littre.Entry:
    senses = (littre.Sense(None, definition, ()),) if definition else ()
    return littre.Entry(headword, 1, nature, senses, "")


def candidate(word: str) -> Candidate:
    return Candidate(word, "rare", 0.5, ())


POOL = [
    candidate(w)
    for w in ("lucubrateur", "faquin", "rogaton", "panneresse", "épellation", "abat", "côte")
]
POOL.append(candidate("cote"))
SCREENED = {
    w: {"suitability": "ok", "domain": "autre"}
    for w in ("lucubrateur", "faquin", "rogaton", "épellation", "abat", "côte", "cote")
} | {"panneresse": {"suitability": "trop_technique", "domain": "metiers_objets"}}
ENTRIES = {
    "lucubrateur": (entry("Lucubrateur", "  Celui qui   travaille la nuit. "),),
    "faquin": (entry("Faquin", "Homme de néant."),),
    "rogaton": (entry("Rogaton", "Restes de viande."),),
    "panneresse": (entry("Panneresse", "Ouvrière.", "s. f."),),
    "épellation": (entry("Épellation", "Action d'épeler.", "s. f."),),
    "abat": (entry("Abat", ""), entry("Abat", "Pluie abondante.")),
    "côte": (entry("Côte", "Os du thorax.", "s. f."),),
    "cote": (entry("Cote", "Marque numérale.", "s. f."),),
}


def build(**overrides: object) -> list[dict[str, object]]:
    arguments: dict[str, object] = {
        "pool": POOL,
        "screened": SCREENED,
        "entries": ENTRIES,
        "released": reserve.Published(frozenset({"faquin"}), frozenset({"faquin"})),
        "drafted": frozenset({"rogaton"}),
    }
    rows, _ = reserve.build(**{**arguments, **overrides})  # type: ignore[arg-type]
    return rows


def test_the_reserve_holds_the_promising_words_never_drafted_nor_published() -> None:
    rows = build()
    assert [row["id"] for row in rows] == ["abat", "cote", "epellation", "lucubrateur"]
    assert rows[3] == {
        "id": "lucubrateur",
        "word": "lucubrateur",
        "definition": "Celui qui travaille la nuit.",
        "theme": None,
        "partOfSpeech": "s. m.",
    }


def test_a_reserved_id_is_the_future_card_id() -> None:
    epellation = next(row for row in build() if row["word"] == "épellation")
    assert epellation["id"] == "epellation"


def test_two_words_with_the_same_id_keep_only_the_first() -> None:
    rows, collisions = reserve.build(
        POOL, SCREENED, ENTRIES, reserve.Published(frozenset(), frozenset()), frozenset()
    )
    assert collisions == 1
    assert next(row for row in rows if row["id"] == "cote")["word"] == "cote"


def test_a_word_whose_id_is_taken_by_a_published_card_is_left_out() -> None:
    released = reserve.Published(frozenset({"cote", "faquin"}), frozenset({"faquin"}))
    assert "cote" not in [row["id"] for row in build(released=released)]


def test_the_first_defined_sense_is_used_and_words_without_one_are_skipped() -> None:
    abat = next(row for row in build() if row["id"] == "abat")
    assert abat["definition"] == "Pluie abondante."
    entries = {**ENTRIES, "abat": (entry("Abat", ""),)}
    assert "abat" not in [row["id"] for row in build(entries=entries)]


def test_the_reserve_never_tells_the_rarity() -> None:
    assert all(set(row) == {"id", "word", "definition", "theme", "partOfSpeech"} for row in build())


def test_long_definitions_are_cut_at_a_word_boundary() -> None:
    text = "Celui qui compose avec peine, à la lueur de la lampe, " * 10
    clipped = reserve.clip(text)
    assert len(clipped) <= reserve.MAX_DEFINITION_CHARS
    assert clipped.endswith("…")
    assert text.startswith(clipped[:-1])
    assert not clipped[:-1].endswith((" ", ","))
    assert reserve.clip("Court.") == "Court."


def test_published_reads_every_release(tmp_path: Path) -> None:
    for version, word in (("2026-10-19.1", "Faquin"), ("2026-11-08.1", "côte")):
        folder = tmp_path / version / "collections"
        folder.mkdir(parents=True)
        card = {"id": reserve.slug(word), "word": word}
        (folder / "fondateurs.abc.json").write_text(json.dumps({"cards": [card]}))
    assert reserve.published(tmp_path) == reserve.Published(
        frozenset({"faquin", "cote"}), frozenset({"faquin", "côte"})
    )


def test_the_version_counts_the_files_written_the_same_day(tmp_path: Path) -> None:
    path = tmp_path / "reserve" / "reserve.json"
    today = date(2026, 11, 8)
    assert reserve.next_version(path, today) == "2026-11-08.1"
    reserve.write([], "2026-11-08.1", path)
    assert reserve.next_version(path, today) == "2026-11-08.2"
    assert reserve.next_version(path, date(2026, 11, 9)) == "2026-11-09.1"
    assert json.loads(path.read_text(encoding="utf-8")) == {"version": "2026-11-08.1", "words": []}
