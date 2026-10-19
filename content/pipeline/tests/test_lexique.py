from leximon_content import lexique


def test_ligatures_are_spelled_out_as_in_lexique() -> None:
    assert lexique.spelling("Cœur") == "coeur"
    assert lexique.spelling("ex æquo") == "ex aequo"


def test_forms_are_found_in_both_spellings_of_a_ligature() -> None:
    lemma_forms = {"coeur": frozenset({"coeur", "coeurs"}), "faquin": frozenset({"faquin"})}
    assert lexique.forms_of("cœur", lemma_forms) == {"coeur", "coeurs", "cœur", "cœurs"}
    assert lexique.forms_of("faquin", lemma_forms) == {"faquin"}
