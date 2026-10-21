import io
import json

import numpy as np
import pytest
from PIL import Image, ImageDraw

from leximon_content import engraving


def hit(**overrides: object) -> dict:
    base: dict[str, object] = {
        "n": 1,
        "title": "File:Casuarius plate.jpg",
        "page_url": "https://commons.wikimedia.org/wiki/File:Casuarius_plate.jpg",
        "original_url": "https://upload.wikimedia.org/wikipedia/commons/1/1f/Casuarius_plate.jpg",
        "original_size": [2400, 1800],
        "thumb_url": "https://thumb.wikimedia.org/wikipedia/commons/thumb/1/1f/Casuarius_plate.jpg/330px-Casuarius_plate.jpg",
        "licence": "Public domain",
        "licence_code": "pd",
        "usage_terms": "Public domain",
        "artist": "Edmund Evans",
        "date": "1880",
        "description": "Cassowary, wood engraving",
        "credit": "Popular Science Monthly",
        "categories": ["Casuarius in art"],
    }
    return {**base, **overrides}


# --- Credit line ---------------------------------------------------------------------------------


@pytest.mark.parametrize(
    ("artist", "expected"),
    [
        ("Albrecht Dürer", "Albrecht Dürer"),
        ("Desfontaines, René; Redouté, Henri Joseph", "René Desfontaines"),
        (
            "C. Butterworth sc., presumably engraved by John Bartholomew & Son",
            "C. Butterworth",
        ),
        ("Edward Linley Sambourne", "Edward Linley Sambourne"),
        ("Unknown author Unknown author", None),
        ("Anonymous Unknown author", None),
        ("onbekend (ontwerper), onbekend (etser), onbekend (uitgever)", None),
        ("", None),
        ("Internet Archive Book Images", None),
        ("Rijksmuseum", None),
        ("Engraver Charles Taylor", "Charles Taylor"),
        ("Engraved by Matthew Greuter.", "Matthew Greuter"),
        ("Attributed to Maerten de Vos", "Maerten de Vos"),
        ("Robert Havell after John James Audubon", "John James Audubon"),
        ("Adolphe Gusman / After Élisa Drojat", "Élisa Drojat"),
        ("Caricature by Edmé Jean Pigal ", "Edmé Jean Pigal"),
        ("Darley and Ridgway", "Darley et Ridgway"),
        ("Johann Georg Sturm & Jacob Sturm", "Johann Georg Sturm et Jacob Sturm"),
        ("Illustrated by Engravings on Wood.", None),
        ("Illustrateur : Saint-Elme Gautier", "Saint-Elme Gautier"),
        ("a painting by Nicolas Poussin", "Nicolas Poussin"),
        ("Creator:Raphael Sadeler I", "Raphael Sadeler I"),
        ("en:Eugenius Warming", "Eugenius Warming"),
    ],
)
def test_author_display(artist: str, expected: str | None) -> None:
    assert engraving.author_display(artist) == expected


def test_credit_line_names_author_year_fonds_and_licence() -> None:
    assert engraving.credit_line(hit(artist="Albrecht Dürer", date="1514 date QS:P571")) == (
        "D'après Albrecht Dürer, 1514 · Wikimedia Commons (domaine public)"
    )


def test_an_unknown_author_is_anonymous() -> None:
    line = engraving.credit_line(hit(artist="Anonymous Unknown author", date="1849"))
    assert line == "Anonyme, 1849 · Wikimedia Commons (domaine public)"
    assert engraving.credit_line(hit(artist="", date="Unknown")) == (
        "Anonyme · Wikimedia Commons (domaine public)"
    )


def test_a_cc_by_credit_keeps_author_source_and_licence() -> None:
    wellcome = hit(
        artist="Edward Linley Sambourne",
        date="",
        licence="CC BY 4.0",
        licence_code="cc-by-4.0",
        credit="Wellcome Collection gallery (2018-03-22): https://wellcomecollection.org/works/x",
    )
    assert engraving.credit_line(wellcome) == (
        "D'après Edward Linley Sambourne · Wellcome Collection (CC BY 4.0)"
    )


def test_manual_author_and_year_override_commons() -> None:
    line = engraving.credit_line(
        hit(artist="", date="", licence="CC BY 4.0", licence_code="cc-by-4.0"),
        {"author": "Giovanni Volpato", "year": 1780},
    )
    assert line == "D'après Giovanni Volpato, 1780 · Wikimedia Commons (CC BY 4.0)"


@pytest.mark.parametrize(
    ("fields", "expected"),
    [
        ({"credit": "https://wellcomeimages.org/x"}, "Wellcome Collection"),
        ({"artist": "Rijksmuseum", "licence": "CC0", "licence_code": "cc0"}, "Rijksmuseum"),
        (
            {"artist": "Internet Archive Book Images", "credit": "https://www.flickr.com/x"},
            "Internet Archive",
        ),
        ({}, "Wikimedia Commons"),
    ],
)
def test_fonds(fields: dict, expected: str) -> None:
    assert engraving.fonds(hit(**fields)) == expected


@pytest.mark.parametrize(
    ("short", "code", "terms", "expected"),
    [
        ("Public domain", "pd", "Public domain", "domaine public"),
        ("PDM-owner", "", "Creative Commons Public Domain Mark Owner", "domaine public"),
        ("No restrictions", "", "No known copyright restrictions", "domaine public"),
        ("CC0", "cc0", "Creative Commons Zero", "CC0"),
        ("CC BY 4.0", "cc-by-4.0", "Creative Commons Attribution 4.0", "CC BY 4.0"),
    ],
)
def test_licence_label(short: str, code: str, terms: str, expected: str) -> None:
    assert (
        engraving.licence_label(hit(licence=short, licence_code=code, usage_terms=terms))
        == expected
    )


def test_a_licence_outside_the_filter_is_an_error() -> None:
    with pytest.raises(ValueError):
        engraving.licence_label(
            hit(licence="CC BY-SA 4.0", licence_code="cc-by-sa-4.0", usage_terms="")
        )


# --- Download ------------------------------------------------------------------------------------


def test_a_large_original_is_fetched_as_a_standard_thumbnail() -> None:
    assert engraving.download_url(hit()) == (
        "https://thumb.wikimedia.org/wikipedia/commons/thumb/1/1f/Casuarius_plate.jpg/1280px-Casuarius_plate.jpg"
    )


def test_a_small_original_is_fetched_as_is() -> None:
    small = hit(original_size=[1190, 1404])
    assert engraving.download_url(small) == small["original_url"]


def test_multipage_thumbnails_keep_their_page_prefix() -> None:
    tif = hit(
        original_size=[3066, 1279],
        thumb_url="https://thumb.wikimedia.org/a/b/X.tif/lossy-page1-330px-X.tif.jpg",
    )
    assert engraving.download_url(tif) == (
        "https://thumb.wikimedia.org/a/b/X.tif/lossy-page1-1280px-X.tif.jpg"
    )


# --- Image treatment -----------------------------------------------------------------------------


def test_crop_box_in_pixels() -> None:
    assert engraving.crop_box((1000, 500), [0.1, 0.2, 0.9, 1.0]) == (100, 100, 900, 500)


@pytest.mark.parametrize("bad", [[0.5, 0.0, 0.4, 1.0], [0.0, 0.0, 1.2, 1.0], [0.0, 0.0, 1.0]])
def test_crop_box_refuses_impossible_boxes(bad: list[float]) -> None:
    with pytest.raises(ValueError):
        engraving.crop_box((1000, 500), bad)


def test_fit_contains_and_never_enlarges() -> None:
    assert engraving.fit((1280, 1686), engraving.INK_BOX) == (364, 480)
    assert engraving.fit((2000, 500), engraving.INK_BOX) == (774, 194)
    assert engraving.fit((300, 200), engraving.INK_BOX) == (300, 200)


def test_ramp_between_the_two_thresholds() -> None:
    values = engraving.ramp(np.array([0.0, 110.0, 157.5, 205.0, 255.0]), 110, 205)
    assert values.tolist() == [1.0, 1.0, 0.5, 0.0, 0.0]


def drawing(mode: str = "L") -> Image.Image:
    """A dark disc and a few lines on yellowed paper, in a wide margin."""
    image = Image.new("RGB", (900, 600), (236, 222, 190))
    draw = ImageDraw.Draw(image)
    draw.ellipse((300, 200, 500, 400), fill=(30, 25, 20))
    for x in range(520, 640, 12):
        draw.line((x, 180, x, 420), fill=(40, 30, 20), width=3)
    return image.convert(mode)


def test_prepare_trims_the_margins_and_whitens_the_paper() -> None:
    grey = engraving.prepare(drawing())
    w, h = grey.size
    assert w < 450 and h < 300
    a = np.asarray(grey)
    assert a[0, 0] > 240  # paper, now white
    assert a.min() < 30  # ink


def test_a_transparent_background_is_paper() -> None:
    rgba = Image.new("RGBA", (200, 200), (0, 0, 0, 0))
    ImageDraw.Draw(rgba).rectangle((80, 80, 120, 120), fill=(0, 0, 0, 255))
    grey = engraving.to_grey(rgba)
    assert grey.getpixel((5, 5)) == 255
    assert grey.getpixel((100, 100)) == 0


def test_render_gives_alpha_only_webp_ink_and_half_size_fill() -> None:
    rendered = engraving.render(engraving.prepare(drawing()))
    ink = Image.open(io.BytesIO(rendered.ink))
    fill = Image.open(io.BytesIO(rendered.fill))
    assert ink.format == "WEBP" and ink.mode == "RGBA"
    assert ink.size == rendered.size
    assert fill.size == rendered.fill_size == (rendered.size[0] // 2, rendered.size[1] // 2)
    assert set(np.asarray(ink)[..., :3].ravel().tolist()) <= {0, 1, 2}  # black ink only
    assert np.asarray(ink)[..., 3].max() > 200


def test_render_is_deterministic() -> None:
    grey = engraving.prepare(drawing())
    assert engraving.render(grey) == engraving.render(grey)


# --- Naming and manifest -------------------------------------------------------------------------


def test_published_path_is_named_after_the_content() -> None:
    path = engraving.published_path("canephore", b"abc", "ink")
    assert path == "gravures/canephore.ba7816bf8f01.ink.webp"
    assert engraving.published_path("canephore", b"abd", "ink") != path


def test_only_approved_cards_are_rendered() -> None:
    validation = {
        "a": {"pick": 1, "approved": True},
        "b": {"pick": 2, "approved": False},
        "c": {"pick": None, "approved": None},
    }
    assert list(engraving.approved_cards(validation)) == ["a"]


def test_engraving_entry_and_loaded_engraving_follow_the_contract(tmp_path) -> None:
    rendered = engraving.Rendered(ink=b"ink", fill=b"fill", size=(300, 480), fill_size=(150, 240))
    entry = engraving.engraving_entry("casoar", rendered, hit(), {"pick": 1, "approved": True})
    path = tmp_path / "rendered.json"
    path.write_text(json.dumps({"renderVersion": 1, "cards": {"casoar": entry}}))
    assert engraving.load_engravings(path) == {
        "casoar": {
            "ink": engraving.published_path("casoar", b"ink", "ink"),
            "fill": engraving.published_path("casoar", b"fill", "fill"),
            "width": 300,
            "height": 480,
            "credit": "D'après Edmund Evans, 1880 · Wikimedia Commons (domaine public)",
            "sourceUrl": "https://commons.wikimedia.org/wiki/File:Casuarius_plate.jpg",
            "licence": "domaine public",
        }
    }


def test_no_rendered_file_means_no_engraving(tmp_path) -> None:
    assert engraving.load_engravings(tmp_path / "missing.json") == {}
