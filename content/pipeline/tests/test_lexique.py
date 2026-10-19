from leximon_content.lexique import lexique_spelling


def test_ligatures_are_spelled_out_as_in_lexique() -> None:
    assert lexique_spelling("Cœur") == "coeur"
    assert lexique_spelling("ex æquo") == "ex aequo"
