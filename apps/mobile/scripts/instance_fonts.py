"""Static instances of the variable fonts for React Native, which cannot set font axes.

The sources are the variable fonts of google/fonts (ofl/fraunces, ofl/bricolagegrotesque,
ofl/newsreader), saved as Fraunces.ttf, Bricolage.ttf, Newsreader.ttf and NewsreaderItalic.ttf:

    uv run --no-project --with fonttools python -I scripts/instance_fonts.py <sources> assets/fonts

Each instance keeps the axes the web sets (Fraunces 900 and 800 with SOFT 100) and the Latin subset the
web loads, under a PostScript name equal to its file name: the name `fontFamily` uses on both
platforms.
"""
import sys
from pathlib import Path
from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont
from fontTools import subset

src, out = Path(sys.argv[1]), Path(sys.argv[2])
out.mkdir(parents=True, exist_ok=True)
LATIN = ("U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,"
         "U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD")
JOBS = [
    ("Fraunces.ttf", "Fraunces-Black.ttf", {"wght": 900, "SOFT": 100, "WONK": 0, "opsz": 48}),
    ("Fraunces.ttf", "Fraunces-ExtraBold.ttf", {"wght": 800, "SOFT": 100, "WONK": 0, "opsz": 16}),
    ("Bricolage.ttf", "BricolageGrotesque-Medium.ttf", {"wght": 500, "opsz": 16, "wdth": 100}),
    ("Bricolage.ttf", "BricolageGrotesque-SemiBold.ttf", {"wght": 600, "opsz": 16, "wdth": 100}),
    ("Bricolage.ttf", "BricolageGrotesque-Bold.ttf", {"wght": 700, "opsz": 16, "wdth": 100}),
    ("Bricolage.ttf", "BricolageGrotesque-ExtraBold.ttf", {"wght": 800, "opsz": 16, "wdth": 100}),
    ("Newsreader.ttf", "Newsreader-Regular.ttf", {"wght": 400, "opsz": 16}),
    ("Newsreader.ttf", "Newsreader-Medium.ttf", {"wght": 500, "opsz": 16}),
    ("NewsreaderItalic.ttf", "Newsreader-Italic.ttf", {"wght": 400, "opsz": 16}),
]
for source, target, axes in JOBS:
    font = TTFont(src / source)
    static = instantiateVariableFont(font, axes, updateFontNames=False)
    options = subset.Options()
    options.layout_features = ["*"]
    options.name_IDs = ["*"]
    options.notdef_outline = True
    subsetter = subset.Subsetter(options)
    subsetter.populate(unicodes=subset.parse_unicodes(LATIN))
    subsetter.subset(static)
    family, style = target.removesuffix(".ttf").split("-")
    names = static["name"]
    names.removeNames(nameID=16)
    names.removeNames(nameID=17)
    names.removeNames(nameID=25)
    for name_id, value in {1: f"{family} {style}", 2: "Regular", 3: target.removesuffix(".ttf"),
                           4: f"{family} {style}", 6: target.removesuffix(".ttf")}.items():
        names.setName(value, name_id, 3, 1, 0x409)
        names.setName(value, name_id, 1, 0, 0)
    static.save(out / target)
    print(target, (out / target).stat().st_size)
