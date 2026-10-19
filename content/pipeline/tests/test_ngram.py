from leximon_content import ngram


def test_guessed_forms_cover_plurals_feminines_and_er_verbs() -> None:
    assert {"faquins", "faquin"} <= ngram.guessed_forms("faquin", "s. m.")
    assert {"barguigné", "barguignait"} <= ngram.guessed_forms("barguigner", "v. n.")
    assert "matoise" in ngram.guessed_forms("matois", "adj.")


def test_shared_forms_are_dropped_but_a_lemma_keeps_its_own_spelling() -> None:
    owner_of = ngram.assign_forms(
        {"rais": {"rais"}, "rai": {"rai", "rais"}, "faquin": {"faquin", "faquins"}},
        lexique_owners={},
    )
    assert owner_of == {"rais": "rais", "rai": "rai", "faquin": "faquin", "faquins": "faquin"}


def test_a_form_claimed_by_another_lexique_lemma_is_dropped() -> None:
    owner_of = ngram.assign_forms({"bai": {"bai", "baie"}}, lexique_owners={"baie": {"baie"}})
    assert owner_of == {"bai": "bai"}


def test_only_untagged_lowercase_lines_are_counted_by_decade() -> None:
    lines = [
        "faquin\t1805,2,1\t1809,3,1\t1995,4,2\n",
        "faquin_NOUN\t1805,2,1\n",
        "Faquin\t1805,100,1\n",
        "1799\t1799,7,1\n",
    ]
    counts = ngram.count_forms(lines, {"faquin"})
    assert list(counts) == ["faquin"]
    assert counts["faquin"][0] == 5
    assert counts["faquin"][(1990 - 1800) // 10] == 4


def test_frequencies_sum_the_forms_of_a_lemma_per_billion_words() -> None:
    decades = [0] * ngram.DECADES
    modern = (1990 - 1800) // 10
    a, b = decades.copy(), decades.copy()
    a[modern], b[modern] = 2, 1
    totals = [10**9] * ngram.DECADES
    result = ngram.frequencies_from_counts(
        {"faquin": a, "faquins": b},
        {"faquin": "faquin", "faquins": "faquin", "matois": "matois"},
        totals,
    )
    assert result["faquin"].modern == 1.0  # 3 occurrences over the 3 modern decades
    assert result["faquin"].attested
    assert result["matois"] == ngram.NgramFrequency(0.0, 0.0, attested=False)
