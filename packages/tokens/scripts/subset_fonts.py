"""The fonts of Le Livre, cut down to what French needs, with their small capitals kept.

Google's own latin subsets drop the small capitals and old-style figures this look relies on. The
sources come from github.com/google/fonts (ofl/spectral, ofl/imfellfrenchcanon):

    uv run --no-project --with fonttools --with brotli python -I \
      packages/tokens/scripts/subset_fonts.py <folder of the sources>

IM Fell's licence reserves its name for the original: a cut version must carry another one, so
these are called Leximon Canon. Its copyright and licence stay in the file and beside it.
"""

import sys
from pathlib import Path

from fontTools import subset
from fontTools.ttLib import TTFont

ROOT = Path(__file__).resolve().parents[3]
WEB = ROOT / "apps/web/src/theme/fonts"
MOBILE = ROOT / "apps/mobile/assets/fonts"

UNICODES = [
    *range(0x20, 0x7F),
    *range(0xA0, 0x100),
    0x152,  # Œ
    0x153,  # œ
    0x178,  # Ÿ
    *range(0x250, 0x2B0),  # phonetic alphabet
    0x2BC,
    0x2C8,
    0x2CC,
    0x2D0,
    0x2009,
    0x2013,
    0x2014,
    0x2018,
    0x2019,
    0x201C,
    0x201D,
    0x2020,
    0x2022,
    0x2026,
    0x202F,
    0x20AC,
]
FEATURES = ["kern", "liga", "locl", "ccmp", "mark", "mkmk", "smcp", "c2sc", "onum", "lnum", "pnum"]

SOURCES = {
    "Spectral-Regular.ttf": ("Spectral-Regular", None),
    "Spectral-Italic.ttf": ("Spectral-Italic", None),
    "Spectral-Medium.ttf": ("Spectral-Medium", None),
    "Spectral-SemiBold.ttf": ("Spectral-SemiBold", None),
    "IMFeFCrm28P.ttf": ("LeximonCanon-Regular", ("Leximon Canon", "Regular")),
    "IMFeFCit28P.ttf": ("LeximonCanon-Italic", ("Leximon Canon", "Italic")),
}


def rename(font: TTFont, name: str, family: str, style: str) -> None:
    """Replaces the reserved name wherever a font name is recorded."""
    table = font["name"]
    for record in list(table.names):
        if record.nameID in (10, 16, 17, 21, 22):
            table.removeNames(nameID=record.nameID)
    for name_id, value in (
        (1, family),
        (2, style),
        (3, f"{name};Leximon"),
        (4, f"{family} {style}"),
        (6, name),
    ):
        table.setName(value, name_id, 3, 1, 0x409)
        table.setName(value, name_id, 1, 0, 0)


def thin_space(font: TTFont) -> None:
    """French spacing needs U+202F, which none of the sources draw: the thin space stands in."""
    for table in font["cmap"].tables:
        if table.isUnicode() and 0x2009 in table.cmap:
            table.cmap.setdefault(0x202F, table.cmap[0x2009])


def cut(source: Path, name: str, naming: tuple[str, str] | None) -> None:
    options = subset.Options()
    options.layout_features = FEATURES
    options.name_IDs = ["*"]
    options.notdef_outline = True
    options.hinting = False
    font = subset.load_font(source, options)
    thin_space(font)
    subsetter = subset.Subsetter(options)
    subsetter.populate(unicodes=UNICODES)
    subsetter.subset(font)
    if naming is not None:
        rename(font, name, *naming)
    font.flavor = None
    font.save(MOBILE / f"{name}.ttf")
    font.flavor = "woff2"
    font.save(WEB / f"{name}.woff2")
    print(name, (WEB / f"{name}.woff2").stat().st_size, "woff2", (MOBILE / f"{name}.ttf").stat().st_size, "ttf")


def main() -> None:
    sources = Path(sys.argv[1])
    WEB.mkdir(parents=True, exist_ok=True)
    for file, (name, naming) in SOURCES.items():
        cut(sources / file, name, naming)


main()
