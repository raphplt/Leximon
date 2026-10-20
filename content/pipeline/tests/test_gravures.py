import json
from types import SimpleNamespace

import pytest

from leximon_content import gravures
from leximon_content.gravures import Card


def hit(**overrides: object) -> dict:
    base: dict[str, object] = {
        "title": "File:Casuarius plate.jpg",
        "page_url": "https://commons.wikimedia.org/wiki/File:Casuarius_plate.jpg",
        "thumb_url": "https://upload.wikimedia.org/thumb.jpg",
        "thumb_size": [330, 440],
        "licence": "Public domain",
        "licence_code": "pd",
        "usage_terms": "Public domain",
        "artist": "Edmund Evans",
        "artist_dates": "Edmund Evans",
        "date": "1880",
        "description": "Cassowary, wood engraving",
        "credit": "Internet Archive book images",
        "object_name": "Casuarius plate",
        "categories": ["Casuarius in art"],
    }
    return {**base, **overrides}


# --- Licences ------------------------------------------------------------------------------------


@pytest.mark.parametrize(
    ("short", "code"),
    [
        ("Public domain", "pd"),
        ("CC0", "cc0"),
        ("Public Domain Mark 1.0", ""),
        ("No restrictions", ""),
        ("No known copyright restrictions", ""),
        ("CC BY 4.0", "cc-by-4.0"),
    ],
)
def test_free_licences_pass(short: str, code: str) -> None:
    assert gravures.licence_reason(short, code, short) is None


@pytest.mark.parametrize(
    ("short", "code"),
    [
        ("CC BY-SA 4.0", "cc-by-sa-4.0"),
        ("CC BY-SA 3.0", "cc-by-sa-3.0"),
        ("CC BY-NC 4.0", "cc-by-nc-4.0"),
        ("CC BY-NC-ND 4.0", ""),
        ("CC BY 3.0", "cc-by-3.0"),
        ("GFDL", "gfdl"),
        ("", ""),
    ],
)
def test_share_alike_non_commercial_and_unknown_licences_are_refused(short: str, code: str) -> None:
    assert gravures.licence_reason(short, code, "") is not None


# --- Sources -------------------------------------------------------------------------------------


def test_gallica_copies_are_refused_wherever_they_show() -> None:
    assert gravures.quick_reason(hit(title="File:Le charlatan btv1b8410818r.jpg")) == (
        "gallica-bnf",
        "source gallica-bnf",
    )
    assert gravures.quick_reason(hit(credit="Source gallica.bnf.fr / BnF"))[0] == "gallica-bnf"  # type: ignore[index]
    assert gravures.quick_reason(hit(credit="https://gallica.bnf.fr/ark:/12148/x"))[0] == (  # type: ignore[index]
        "gallica-bnf"
    )
    assert gravures.quick_reason(hit(categories=["Images from Gallica"]))[0] == "gallica-bnf"  # type: ignore[index]


def test_british_museum_files_are_refused_even_without_the_name() -> None:
    # The R&D miss: a fan maker's trade card named "BM Heal,60.11".
    heal = hit(title="File:Trade card of a fan maker (BM Heal,60.11).jpg")
    assert gravures.quick_reason(heal)[0] == "british-museum"  # type: ignore[index]
    prefix = hit(title="File:BM Heal,60.11 fan maker.jpg")
    assert gravures.quick_reason(prefix)[0] == "british-museum"  # type: ignore[index]
    number = hit(title="File:Satire (BM 2012,7027.12).jpg")
    assert gravures.quick_reason(number)[0] == "british-museum"  # type: ignore[index]
    source = hit(credit="© The Trustees of the British Museum")
    assert gravures.quick_reason(source)[0] == "british-museum"  # type: ignore[index]
    assert gravures.quick_reason(hit(title="File:BMW poster engraving.jpg")) is None


def test_enccre_copies_are_refused() -> None:
    assert gravures.quick_reason(hit(credit="ENCCRE, Bibliothèque Mazarine"))[0] == (  # type: ignore[index]
        "enccre-mazarine"
    )


def test_a_share_alike_file_is_refused_for_its_licence() -> None:
    reason = gravures.quick_reason(hit(licence="CC BY-SA 4.0", licence_code="cc-by-sa-4.0"))
    assert reason is not None and reason[0] == "licence"


def test_a_file_without_thumbnail_is_refused() -> None:
    assert gravures.quick_reason(hit(thumb_url=None))[0] == "no-thumbnail"  # type: ignore[index]


# --- Authors -------------------------------------------------------------------------------------


@pytest.mark.parametrize(
    ("text", "year"),
    [
        ("Grandville (Nancy, 1803 - Vanves, 1847)", 1847),
        ("J. F. Horrabin (1884–1962)", 1962),
        ("Honoré Daumier (1808-1879) after Gavarni (1804–1866)", 1879),
        ("Jean Ignace Isidore Gérard, died 1962", 1962),
        ("Gustave Doré, mort en 1883", 1883),
        ("Engraver fl. 1820–1840", 1880),
        ("Honoré Daumier", None),
        ("Rijksmuseum RP-P-1906-2345", None),
    ],
)
def test_death_year_is_read_from_the_artist_text(text: str, year: int | None) -> None:
    assert gravures.death_year(text) == year


def test_dates_hidden_in_a_title_attribute_are_read() -> None:
    raw = (
        '<bdi><a href="https://en.wikipedia.org/wiki/en:Neville_William_Cayley" '
        'title="w:en:Neville William Cayley"><span title="Australian author, artist and '
        'ornithologist (1886–1950)">Neville William Cayley</span></a></bdi>'
    )
    assert gravures.death_year(gravures.artist_dates_text(raw)) == 1950
    assert gravures.author_name(gravures.strip_html(raw)) == "Neville William Cayley"


@pytest.mark.parametrize(
    ("text", "name"),
    [
        ("Gustave Doré", "Gustave Doré"),
        ("Gustave Doré (1832–1883)", "Gustave Doré"),
        ("Jacques Callot, engraved by Israel Henriet", "Jacques Callot"),
        ("Unknown author", None),
        ("Anonymous", None),
        ("", None),
    ],
)
def test_author_name(text: str, name: str | None) -> None:
    assert gravures.author_name(text) == name


def test_horrabin_dead_in_1962_is_refused() -> None:
    plate = hit(artist="J. F. Horrabin", artist_dates="J. F. Horrabin", date="1920")
    # Death found on Wikidata by name.
    assert gravures.rights_reason(plate, 1962) == (
        "author-died-after-1955",
        "auteur mort en 1962",
    )
    # Death not found anywhere: a 1920 work by a named author stays out.
    assert gravures.rights_reason(plate, None)[0] == "author-death-unknown"  # type: ignore[index]
    # Dates written next to the name.
    dated = hit(artist="J. F. Horrabin (1884–1962)", artist_dates="J. F. Horrabin (1884–1962)")
    assert gravures.rights_reason(dated, gravures.death_year(dated["artist_dates"]))[0] == (  # type: ignore[index]
        "author-died-after-1955"
    )


def test_recent_works_by_unknown_authors_are_refused() -> None:
    assert gravures.rights_reason(hit(artist="Unknown author", date="1935"), None) == (
        "unknown-author-after-1930",
        "daté 1935, auteur inconnu",
    )
    assert gravures.rights_reason(hit(artist="Unknown author", date="1910"), None) is None
    assert gravures.rights_reason(hit(artist="Unknown author", date=""), None) is None


def test_old_works_pass() -> None:
    assert gravures.rights_reason(hit(artist="Honoré Daumier", date="1833"), 1879) is None
    assert gravures.rights_reason(hit(artist="Edmund Evans", date="1880"), None) is None
    assert gravures.rights_reason(hit(date="1925"), 1950) is None


# --- Candidates and queries ----------------------------------------------------------------------


def test_candidates_are_interleaved_across_queries_without_duplicates() -> None:
    a = [{"title": t} for t in ("a1", "a2", "shared", "a4")]
    b = [{"title": t} for t in ("shared", "b2")]
    c: list[dict] = []
    order = [h["title"] for h in gravures.interleave([a, b, c])]
    assert order == ["a1", "shared", "a2", "b2", "a4"]


def test_queries_get_a_plate_term_and_stay_six_at_most() -> None:
    queries = gravures.normalize_queries(
        [
            "candle snuffer",
            "Candle  snuffer engraving",
            "éteignoir gravure",
            "",
            '"Casuarius" plate',
            "a caricature",
            "b lithograph",
            "c woodcut",
            "d etching",
        ]
    )
    assert queries == [
        "candle snuffer engraving",
        "éteignoir gravure",
        "Casuarius plate",
        "a caricature",
        "b lithograph",
        "c woodcut",
    ]


def test_select_cards_by_id_or_limit() -> None:
    cards = [Card(i, i, "déf", "c", "common") for i in ("a", "b", "c")]
    assert [c.id for c in gravures.select_cards(cards, ["c", "a"], None)] == ["c", "a"]
    assert [c.id for c in gravures.select_cards(cards, None, 2)] == ["a", "b"]
    with pytest.raises(SystemExit):
        gravures.select_cards(cards, ["z"], None)


# --- Batches and cost ----------------------------------------------------------------------------


def test_batches_respect_both_the_card_and_the_byte_limits() -> None:
    sizes = [(f"c{i}", 10) for i in range(5)]
    assert gravures.split_batches(sizes, max_cards=2, max_bytes=1000) == [
        ["c0", "c1"],
        ["c2", "c3"],
        ["c4"],
    ]
    assert gravures.split_batches(sizes, max_cards=100, max_bytes=25) == [
        ["c0", "c1"],
        ["c2", "c3"],
        ["c4"],
    ]
    # An oversized request still goes, alone.
    assert gravures.split_batches([("big", 50), ("x", 1)], max_cards=10, max_bytes=20) == [
        ["big"],
        ["x"],
    ]
    assert gravures.split_batches([], max_cards=2, max_bytes=10) == []


def test_batch_cost_is_half_the_list_price() -> None:
    assert gravures.batch_cost({"input_tokens": 1_000_000}) == pytest.approx(1.0)
    assert gravures.batch_cost({"output_tokens": 1_000_000}) == pytest.approx(5.0)


def test_pick_estimate_counts_image_tokens_and_skips_cards_without_candidates() -> None:
    candidates = [{"thumb_size": [330, 750]}, {"thumb_size": [330, 750]}]  # 330 tokens each
    tokens_in = gravures.PICK_TEXT_TOKENS + 660
    expected = (tokens_in * 2.0 + gravures.PICK_OUTPUT_TOKENS * 10.0) / 1_000_000 / 2
    assert gravures.estimate_pick([candidates, []]) == pytest.approx(expected)


# --- Pick results --------------------------------------------------------------------------------

CARD = Card(
    "eteignoir", "éteignoir", "Petit cône pour éteindre les chandelles.", "fondateurs", "rare"
)
CANDIDATES = [
    {
        "n": n,
        "title": f"File:{n}.jpg",
        "thumb": f"thumbs/eteignoir/{n}.jpg",
        "page_url": f"https://commons.wikimedia.org/wiki/File:{n}.jpg",
        "licence": "Public domain",
        "credit_line": "x",
    }
    for n in (1, 2, 3)
]


def succeeded(answer: object, stop_reason: str = "end_turn") -> SimpleNamespace:
    return SimpleNamespace(
        type="succeeded",
        message=SimpleNamespace(
            stop_reason=stop_reason,
            content=[SimpleNamespace(type="text", text=json.dumps(answer))],
            usage=SimpleNamespace(
                input_tokens=2000,
                output_tokens=150,
                cache_creation_input_tokens=0,
                cache_read_input_tokens=0,
            ),
        ),
    )


def answer(choice: str) -> dict:
    return {
        "choix": choice,
        "pertinence": 8,
        "technique_choix": "gravure",
        "techniques": ["peinture", "gravure", "photographie"],
        "raison": "La gravure montre l'objet.",
    }


def test_a_pick_records_the_chosen_candidate_and_its_batch_cost() -> None:
    row = gravures.pick_row(CARD, CANDIDATES, "msgbatch_1", succeeded(answer("2")))
    assert row["error"] is None
    assert row["pick"] == 2 and row["pick_thumb"] == "thumbs/eteignoir/2.jpg"
    assert row["score"] == 8 and row["techniques"] == ["peinture", "gravure", "photographie"]
    assert row["cost_usd"] == pytest.approx((2000 * 2.0 + 150 * 10.0) / 1_000_000 / 2)
    assert row["batch_id"] == "msgbatch_1"


def test_none_is_a_valid_answer_and_bad_answers_are_errors() -> None:
    none = gravures.pick_row(CARD, CANDIDATES, "b", succeeded(answer("aucun")))
    assert none["pick"] is None and none["error"] is None
    out_of_range = gravures.pick_row(CARD, CANDIDATES, "b", succeeded(answer("7")))
    assert out_of_range["error"]
    cut = gravures.pick_row(CARD, CANDIDATES, "b", succeeded(answer("1"), "max_tokens"))
    assert cut["error"] and cut["cost_usd"] > 0
    failed = gravures.pick_row(CARD, CANDIDATES, "b", SimpleNamespace(type="errored", error="x"))
    assert failed["error"] and failed["cost_usd"] == 0.0


def test_the_pick_request_numbers_each_image(tmp_path, monkeypatch) -> None:
    monkeypatch.setattr(gravures, "GRAVURES_DIR", tmp_path)
    (tmp_path / "thumbs" / "eteignoir").mkdir(parents=True)
    for n in (1, 2, 3):
        (tmp_path / "thumbs" / "eteignoir" / f"{n}.jpg").write_bytes(b"\xff\xd8\xff" + bytes(n))
    request = gravures.pick_request(CARD, CANDIDATES)
    assert request["custom_id"] == "eteignoir"
    content = request["params"]["messages"][0]["content"]
    images = [b for b in content if b["type"] == "image"]
    assert len(images) == 3 and images[0]["source"]["media_type"] == "image/jpeg"
    schema = request["params"]["output_config"]["format"]["schema"]
    assert schema["properties"]["choix"]["enum"] == ["1", "2", "3", "aucun"]


@pytest.mark.parametrize(
    ("text", "name"),
    [
        ("Monnier, Henry", "Henry Monnier"),
        ("Buffon, Georges Louis Leclerc", "Georges Louis Leclerc Buffon"),
        ("Honoré Daumier", "Honoré Daumier"),
        ("Internet Archive Book Images", None),
        ("Scan by NYPL", None),
        ("onbekend (ontwerper), onbekend (etser)", None),
        ("{{Creator: }}", None),
    ],
)
def test_lookup_name_turns_library_names_around_and_skips_institutions(
    text: str, name: str | None
) -> None:
    assert gravures.lookup_name(text) == name


def test_a_cc_by_credit_line_carries_the_source() -> None:
    line = gravures.credit_line(
        hit(artist="", licence="CC BY 4.0", date="", credit="Wellcome Collection")
    )
    assert line == "auteur inconnu · CC BY 4.0 · Wikimedia Commons · Wellcome Collection"
    assert gravures.credit_line(hit(artist="Honoré Daumier", date="1833")) == (
        "Honoré Daumier, 1833 · Public domain · Wikimedia Commons"
    )


# --- Wikimedia API -------------------------------------------------------------------------------


def wikimedia_answering(monkeypatch, tmp_path, payloads: list[dict]) -> gravures.Wikimedia:
    import httpx

    monkeypatch.setattr(gravures, "AUTHORS_FILE", tmp_path / "authors.json")
    monkeypatch.setattr(gravures.time, "sleep", lambda _: None)
    answers = iter(payloads)
    wiki = gravures.Wikimedia()
    wiki.http = httpx.Client(
        transport=httpx.MockTransport(lambda _: httpx.Response(200, json=next(answers)))
    )
    return wiki


def test_a_busy_search_is_retried_then_answered(monkeypatch, tmp_path) -> None:
    busy = {"error": {"code": "cirrussearch-too-busy-error", "info": "too busy"}}
    wiki = wikimedia_answering(monkeypatch, tmp_path, [busy, busy, {"query": {}}])
    assert wiki.api(gravures.COMMONS_API, {"action": "query"}) == {"query": {}}
    assert wiki.pause == gravures.API_PAUSE_S


def test_a_search_busy_for_good_postpones_the_card(monkeypatch, tmp_path) -> None:
    busy = {"error": {"code": "cirrussearch-too-busy-error", "info": "too busy"}}
    wiki = wikimedia_answering(monkeypatch, tmp_path, [busy] * gravures.MAX_RETRIES)
    with pytest.raises(gravures.WikimediaUnavailable):
        wiki.api(gravures.COMMONS_API, {"action": "query"})


def test_a_wrong_request_still_fails_loudly(monkeypatch, tmp_path) -> None:
    wrong = {"error": {"code": "badvalue", "info": "Unrecognized value"}}
    wiki = wikimedia_answering(monkeypatch, tmp_path, [wrong])
    with pytest.raises(RuntimeError, match="badvalue"):
        wiki.api(gravures.COMMONS_API, {"action": "query"})
