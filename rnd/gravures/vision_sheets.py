"""Throwaway: one contact sheet per word (numbered thumbnails), for the hand-made reference.

Needs Pillow. Reads out/vision/candidates.json, writes out/vision/sheets/<word>.jpg.
Run: python3 rnd/gravures/vision_sheets.py
"""

import json
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

HERE = Path(__file__).parent
OUT = HERE / "out" / "vision"
TILE = (300, 300)
COLUMNS = 3


def font(size: int) -> ImageFont.ImageFont:
    for name in ("DejaVuSans-Bold.ttf", "/usr/share/fonts/TTF/DejaVuSans-Bold.ttf"):
        try:
            return ImageFont.truetype(name, size)
        except OSError:
            continue
    return ImageFont.load_default()


def main() -> None:
    results = json.loads((OUT / "candidates.json").read_text())
    (OUT / "sheets").mkdir(exist_ok=True)
    big, small = font(34), font(18)
    for word, entry in results.items():
        candidates = entry["candidates"]
        if not candidates:
            continue
        rows = (len(candidates) + COLUMNS - 1) // COLUMNS
        sheet = Image.new("RGB", (TILE[0] * COLUMNS, TILE[1] * rows + 30), "white")
        draw = ImageDraw.Draw(sheet)
        draw.text((6, 4), word, fill="black", font=small)
        for index, cand in enumerate(candidates):
            image = Image.open(HERE / cand["thumb"]).convert("RGB")
            image.thumbnail((TILE[0] - 8, TILE[1] - 8))
            x = (index % COLUMNS) * TILE[0] + (TILE[0] - image.width) // 2
            y = 30 + (index // COLUMNS) * TILE[1] + (TILE[1] - image.height) // 2
            sheet.paste(image, (x, y))
            lx, ly = (index % COLUMNS) * TILE[0] + 4, 30 + (index // COLUMNS) * TILE[1] + 2
            draw.rectangle((lx, ly, lx + 34, ly + 40), fill="red")
            draw.text((lx + 7, ly + 2), str(cand["n"]), fill="white", font=big)
        sheet.save(OUT / "sheets" / f"{Path(candidates[0]['thumb']).parent.name}.jpg", quality=85)


if __name__ == "__main__":
    main()
