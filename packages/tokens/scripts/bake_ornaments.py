"""The old ornaments kept for Le Livre, from the candidates in rnd/ornements.

Changing a choice means changing a line of CHOSEN and running this again: it writes the images of
the web and the mobile app, their list for the code, and the credits in docs/ornements.md.

    uv run --no-project --with pillow python -I packages/tokens/scripts/bake_ornaments.py

Each image is black ink on transparent, so that the theme colors it: a CSS mask on the web, a tint
on the mobile app.
"""

import io
import json
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[3]
CANDIDATES = ROOT / "rnd/ornements"
WEB = ROOT / "apps/web/public/ornements"
MOBILE = ROOT / "apps/mobile/assets/ornements"
TOKENS = ROOT / "packages/tokens/src/ornament-plates.ts"
MOBILE_FILES = ROOT / "apps/mobile/src/ui/ornament-files.ts"
CREDITS = ROOT / "docs/ornements.md"

CHOSEN = {
    "fleuron": ["F01", "F02", "F03", "F05", "F06", "F09", "F10", "F15"],
    "bandeau": ["B01", "B02", "B04", "B05", "B06", "B07"],
    "lettrine": [f"LR{number:02}" for number in range(1, 21)],
}
# The widest each family is shown, at three pixels per point on a phone.
LONGEST_SIDE = {"fleuron": 480, "bandeau": 1080, "lettrine": 300}


def baked(path: Path, longest: int) -> tuple[bytes, tuple[int, int]]:
    image = Image.open(path).convert("RGBA")
    image.thumbnail((longest, longest), Image.Resampling.LANCZOS)
    buffer = io.BytesIO()
    image.save(buffer, "WEBP", quality=30, alpha_quality=55, method=6)
    return buffer.getvalue(), image.size


def file_name(candidate: dict) -> str:
    return f"{candidate['numero'].lower()}.webp"


def write_lists(kept: list[dict]) -> None:
    plates = [
        f'  {c["numero"].lower()}: {{ width: {c["size"][0]}, height: {c["size"][1]} }},' for c in kept
    ]
    letters = [
        f'  {c["lettre"]}: "{c["numero"].lower()}",' for c in kept if c["famille"] == "lettrine"
    ]
    def names(family: str) -> str:
        chosen = [f'"{c["numero"].lower()}"' for c in kept if c["famille"] == family]
        return ", ".join(chosen)

    TOKENS.write_text(
        "// Written by packages/tokens/scripts/bake_ornaments.py.\n\n"
        "export const plates = {\n" + "\n".join(plates) + "\n} as const;\n\n"
        "export type PlateName = keyof typeof plates;\n\n"
        f"export const fleurons = [{names('fleuron')}] as const;\n\n"
        f"export const bandeaux = [{names('bandeau')}] as const;\n\n"
        "export const lettrines = {\n" + "\n".join(letters) + "\n} as const;\n"
    )
    requires = [
        f'  {c["numero"].lower()}: require("../../assets/ornements/{file_name(c)}"),' for c in kept
    ]
    MOBILE_FILES.write_text(
        "// Written by packages/tokens/scripts/bake_ornaments.py.\n\n"
        'import type { PlateName } from "@leximon/tokens";\n\n'
        "export const PLATE_FILES: Readonly<Record<PlateName, number>> = {\n"
        + "\n".join(requires)
        + "\n};\n"
    )


def write_credits(kept: list[dict]) -> None:
    lines = [
        "# Ornements anciens",
        "",
        "Les ornements gardés pour Le Livre, leur source et leur licence. Ce fichier est écrit par",
        "`packages/tokens/scripts/bake_ornaments.py`, à partir de `rnd/ornements/sources.json`, qui",
        "donne le détail de chaque vérification. Les ornements dessinés par nous sont dans",
        "`packages/tokens/src/ornaments.ts`.",
        "",
        "| N° | Œuvre | Auteur | Date | Institution | Identifiant | Licence |",
        "|---|---|---|---|---|---|---|",
    ]
    for c in kept:
        title = c["titre"].replace("|", "/")
        author = ", ".join(c["auteur"]) if isinstance(c["auteur"], list) else c["auteur"]
        lines.append(
            f"| {c['numero']} | [{title}]({c['url_objet']}) | {author} | {c['date']} "
            f"| {c['institution']} | {c['identifiant_objet']} | {c['licence']} |"
        )
    CREDITS.write_text("\n".join(lines) + "\n")


def main() -> None:
    catalog = json.loads((CANDIDATES / "sources.json").read_text())["candidats"]
    by_number = {candidate["numero"]: candidate for candidate in catalog}
    for folder in (WEB, MOBILE):
        folder.mkdir(parents=True, exist_ok=True)
        for old in folder.glob("*.webp"):
            old.unlink()
    kept = []
    total = 0
    for family, numbers in CHOSEN.items():
        for number in numbers:
            candidate = by_number[number]
            data, size = baked(CANDIDATES / candidate["fichier"], LONGEST_SIDE[family])
            total += len(data)
            for folder in (WEB, MOBILE):
                (folder / file_name(candidate)).write_bytes(data)
            kept.append({**candidate, "size": size})
    write_lists(kept)
    write_credits(kept)
    print(len(kept), "ornaments,", total // 1024, "KB")


main()
