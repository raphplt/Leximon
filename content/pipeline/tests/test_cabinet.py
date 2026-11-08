import json

from leximon_content import cabinet
from leximon_content.littre import Citation, Entry, HistoryItem, Sense


def entry(headword: str, etymology: str = "", senses: int = 1) -> Entry:
    return Entry(
        headword=headword,
        homograph=1,
        nature="s. f.",
        senses=tuple(
            Sense(
                number=str(n + 1),
                definition=f"Sens {n + 1}.",
                citations=(Citation(text="Une phrase.", author="MOL.", reference="Mis. I, 2"),),
            )
            for n in range(senses)
        ),
        etymology=etymology,
        history=(HistoryItem(century=13, citations=(Citation("Vieux mot.", "JOINV.", "12"),)),),
    )


INDEX = {
    "muable": (entry("MUABLE", "Lat. mutabilis."),),
    "muabilité": (entry("MUABILITÉ", "Muable."),),
    "immuable": (entry("IMMUABLE", "In..., et muable."),),
    "sans sens": (Entry("SANS SENS", 1, "s. m.", (), ""),),
}
CARDS = [
    cabinet.CatalogWord("muabilite", "muabilité"),
    cabinet.CatalogWord("immuable", "immuable"),
    cabinet.CatalogWord("doryphore", "doryphore"),
]


def test_family_names_the_base_word_then_its_other_derivatives():
    base_of = cabinet.bases(CARDS, INDEX)
    assert base_of == {"muabilite": "muable", "immuable": "muable"}
    assert cabinet.family(CARDS[0], CARDS, base_of) == [
        {"word": "muable", "cardId": None, "relation": "base"},
        {"word": "immuable", "cardId": "immuable", "relation": "sibling"},
    ]
    assert cabinet.family(CARDS[2], CARDS, base_of) == []


def test_family_links_the_derivatives_of_a_word_of_the_catalogue():
    cards = [*CARDS, cabinet.CatalogWord("muable", "muable")]
    base_of = cabinet.bases(cards, INDEX)
    assert cabinet.family(cards[3], cards, base_of) == [
        {"word": "muabilité", "cardId": "muabilite", "relation": "derived"},
        {"word": "immuable", "cardId": "immuable", "relation": "derived"},
    ]


def test_cabinet_holds_the_curve_and_a_trimmed_article():
    long = {"muabilité": (entry("MUABILITÉ", "Muable.", senses=20),)}
    built = cabinet.cabinet_of(CARDS[0], long, (1.0, 2.5), [])
    assert built["usage"] == {"from": 1800, "step": 10, "perBillion": [1.0, 2.5]}
    [article] = built["articles"]
    assert len(article["senses"]) == cabinet.MAX_SENSES
    assert article["senses"][0]["citations"] == [
        {"text": "Une phrase.", "author": "MOL.", "reference": "Mis. I, 2"}
    ]
    assert article["history"] == [
        {
            "century": 13,
            "citations": [{"text": "Vieux mot.", "author": "JOINV.", "reference": "12"}],
        }
    ]
    assert (
        cabinet.cabinet_of(cabinet.CatalogWord("x", "sans sens"), INDEX, None, [])["articles"] == []
    )


def test_a_long_text_is_cut_on_a_word_with_an_ellipsis():
    assert cabinet.clip("un  mot\n", 50) == "un mot"
    assert cabinet.clip("a" * 700).endswith("…")
    assert len(cabinet.clip("a" * 700)) == cabinet.MAX_TEXT


def test_the_file_is_named_after_its_content():
    content = json.dumps({"word": "muabilité"}).encode()
    path = cabinet.published_path("muabilite", content)
    assert path.startswith("cabinet/muabilite.") and path.endswith(".json")
    assert path == cabinet.published_path("muabilite", content)
    assert path != cabinet.published_path("muabilite", content + b" ")


def test_a_base_shares_the_first_letters_of_the_word() -> None:
    assert cabinet.plausible_base("écepper", "cep")
    assert cabinet.plausible_base("débucher", "bûche")
    assert not cabinet.plausible_base("abajoue", "ce")
    assert not cabinet.plausible_base("gesse", "origine")
