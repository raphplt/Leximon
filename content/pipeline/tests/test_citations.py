from leximon_content import citations

HEADER = (
    '<div id="ws-data" class="ws-noexport" style="display:none"><span class="ws-type">book</span>'
    '<span class="ws-title">Histoire naturelle</span><span class="ws-author">'
    '<a href="/wiki/Auteur:Georges-Louis_Leclerc_de_Buffon">Buffon</a></span>'
    '<span class="ws-year">1770</span></div>'
)

PAGE = (
    HEADER + '<div class="mw-parser-output"><p>Le sizerin fréquente les bois, il se tient\n'
    "souvent sur les chênes.<sup>1</sup> Il chante peu. Les sizerins vont en troupe.</p>"
    '<div class="references">1. Note de l’éditeur sur le sizerin.</div></div>'
)

BUFFON = {
    "url": "https://fr.wikisource.org/wiki/Buffon",
    "author": "Buffon",
    "year": "1770",
    "author_death": 1788,
    "sentences": ["Le sizerin fréquente les bois, il se tient souvent sur les chênes, y grimpe."],
}


def test_page_text_keeps_the_text_without_notes_or_header() -> None:
    text = citations.page_text(PAGE)
    assert "Le sizerin fréquente les bois, il se tient souvent sur les chênes." in text
    assert "éditeur" not in text and "Histoire naturelle" not in text


def test_sentences_hold_the_word_or_a_form_the_search_matched() -> None:
    text = citations.page_text(PAGE)
    assert citations.sentences_with(text, {"sizerin", "sizerins"}) == [
        "Le sizerin fréquente les bois, il se tient souvent sur les chênes.",
        "Les sizerins vont en troupe.",
    ]


def test_the_author_and_year_come_from_the_page_header() -> None:
    assert citations.work_metadata(PAGE) == {
        "author": "Buffon",
        "author_page": "Georges-Louis Leclerc de Buffon",
        "year": "1770",
    }
    assert citations.work_metadata("<p>Sans en-tête</p>") == {
        "author": None,
        "author_page": None,
        "year": None,
    }


def test_matched_forms_come_from_the_highlighted_snippet() -> None:
    snippet = 'les <span class="searchmatch">verveux</span> et la <span class="searchmatch">Verveux</span>'
    assert citations.matched_forms(snippet) == {"verveux", "Verveux"}


def test_tables_and_dictionaries_are_skipped_and_headword_articles_spotted() -> None:
    assert citations.skipped_title("Thresor de la langue françoise/F")
    assert citations.skipped_title("Annales de pomologie/Table des matières")
    assert not citations.skipped_title("Cours d’agriculture (Rozier)/VERVEUX")
    assert citations.headword_article("Cours d’agriculture (Rozier)/VERVEUX", "verveux")
    assert not citations.headword_article("Cours d’agriculture (Rozier)/TRÈFLE", "fromental")


def test_public_domain_by_death_or_by_an_old_edition() -> None:
    assert citations.public_domain({"author_death": 1955, "year": "1950"})
    assert not citations.public_domain({"author_death": 1962, "year": "1925"})
    assert citations.public_domain({"author_death": None, "year": "1751"})
    assert not citations.public_domain({"author_death": None, "year": "1871"})
    assert not citations.public_domain({"author_death": None, "year": None})


def test_a_quote_copies_its_sentence_word_for_word_with_cuts() -> None:
    whole = "Le sizerin fréquente les bois, il se tient souvent sur les chênes, y grimpe"
    cut = "Le sizerin fréquente les bois .... y grimpe"
    assert citations.problems("sizerin", whole, [BUFFON]) == []
    assert citations.problems("sizerin", cut, [BUFFON]) == []
    assert citations.problems("sizerin", "Le sizerin fréquente les prés", [BUFFON]) == [
        "absente de la page"
    ]


def test_a_quote_needs_its_word_and_free_rights() -> None:
    late = {**BUFFON, "author_death": 1970, "year": "1930"}
    assert citations.problems("sizerin", "il se tient souvent sur les chênes", [BUFFON]) == [
        "le mot n'y est pas"
    ]
    assert citations.problems("sizerin", "Le sizerin fréquente les bois", [late]) == [
        "droits : auteur mort en 1970, paru en 1930"
    ]


def test_accepted_quotes_keep_the_checked_picks_with_their_source() -> None:
    candidates = {"sizerin": {"word": "sizerin", "candidates": [BUFFON]}}
    picks = {
        "sizerin": {"quote_text": "Le sizerin fréquente les bois", "quote_author": "Buffon"},
        "rien": {"quote_text": None, "quote_author": None},
    }
    quotes, refused = citations.accepted_quotes(picks, candidates)
    assert quotes == {
        "sizerin": {
            "text": "Le sizerin fréquente les bois",
            "author": "Buffon",
            "source": BUFFON["url"],
        }
    }
    assert refused == []
    wrong = {"sizerin": {"quote_text": "Le sizerin vole", "quote_author": "Buffon"}}
    assert citations.accepted_quotes(wrong, candidates)[1] == [
        "sizerin : absente de la page · Le sizerin vole"
    ]


def test_the_word_is_found_whatever_its_accents() -> None:
    page = {**BUFFON, "sentences": ["Il faut épépiner les groseilles avant de les confire."]}
    quote = "Il faut épépiner les groseilles avant de les confire"
    assert citations.problems("épepiner", quote, [page]) == []


def test_an_anonymous_work_is_credited_without_its_quotation_marks() -> None:
    candidates = {"sizerin": {"word": "sizerin", "candidates": [BUFFON]}}
    picks = {
        "sizerin": {
            "quote_text": "Le sizerin fréquente les bois",
            "quote_author": "« L'Encyclopédie »",
        }
    }
    quotes, _ = citations.accepted_quotes(picks, candidates)
    assert quotes["sizerin"]["author"] == "L'Encyclopédie"


def test_the_word_is_found_in_an_old_spelling_with_a_single_letter() -> None:
    page = {**BUFFON, "sentences": ["Il leur fit une belle barretade en passant."]}
    assert citations.problems("barrettade", "Il leur fit une belle barretade", [page]) == []
