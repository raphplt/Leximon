"""The shelves of the reading room, baked once into a tile.

Rows of bound books in the dark, darkened and desaturated so that nothing on them catches the
eye. The tile wraps around on both sides: the web repeats it under any window, the phone draws
it once at its height. The lamp, the vignette and the desk are gradients laid over it by each
platform, so that they follow the screen instead of the tile.

    uv run --no-project --with numpy --with pillow python -I packages/tokens/scripts/bake_room.py

`room.shelves` in library.ts must follow the size of the 1x tile.
"""

import io
from pathlib import Path

import numpy as np
from PIL import Image, ImageEnhance

ROOT = Path(__file__).resolve().parents[3]
WEB = ROOT / "apps/web/public/room"
MOBILE = ROOT / "apps/mobile/assets/room"
# Drawn at three times the size, so that every density is a reduction, never an enlargement.
S = 3
WIDTH = 420 * S
ROW = 116 * S
ROWS = 8
BOARD = 11 * S
LEATHERS = ["#6e1e26", "#24452f", "#1f2f55", "#7a5520", "#4a2a18", "#5b3a5e", "#2e4a4a", "#8a3a1e", "#3d3020"]
GILT = np.array([214, 170, 80]) / 255
GILT_BANDS = ((0.10, 0.12), (0.16, 0.17), (0.82, 0.84))
BUDGET = 120_000

rng = np.random.default_rng(1694)


def rgb(hex_color: str) -> np.ndarray:
    return np.array([int(hex_color[i : i + 2], 16) for i in (1, 3, 5)]) / 255


def vertical(top: str, middle: str, bottom: str, height: int) -> np.ndarray:
    """The back of a shelf: dark at the top, under the board above, then lighter."""
    stops = np.interp(np.arange(height), [0, height * 0.2, height - 1], [0, 1, 2])
    colors = np.stack([rgb(top), rgb(middle), rgb(bottom)])
    low = np.floor(stops).astype(int).clip(0, 1)
    part = (stops - low)[:, None]
    return colors[low] * (1 - part) + colors[low + 1] * part


def book(width: int, height: int) -> np.ndarray:
    """A spine: its leather, rounded by light and shade across, with three gilt bands."""
    leather = rgb(LEATHERS[rng.integers(len(LEATHERS))])
    across = np.linspace(0, 1, width)
    light = np.interp(across, [0, 0.4, 1], [-0.45, 0.1, -0.5])
    spine = np.clip(leather[None, :] * (1 + light[:, None]), 0, 1)
    pixels = np.repeat(spine[None, :, :], height, axis=0)
    along = np.linspace(0, 1, height)
    for start, end in GILT_BANDS:
        band = (along >= start) & (along < end)
        pixels[band] = pixels[band] * 0.45 + GILT * 0.55 * (1 + light[None, :, None] * 0.6)
    pixels[: 3 * S] += 0.08
    pixels[:, -S:] *= 0.4
    return np.clip(pixels, 0, 1)


def row() -> np.ndarray:
    pixels = vertical("#140a04", "#2a170b", "#24130a", ROW)
    pixels = np.repeat(pixels[:, None, :], WIDTH, axis=1)
    # The shade the board above throws into the shelf.
    shade = np.ones(ROW)
    shade[: 18 * S] = np.linspace(0.3, 1, 18 * S)
    pixels *= shade[:, None, None]
    x = int(rng.integers(0, 6)) * S
    while x < WIDTH:
        width = int(rng.integers(11, 24)) * S
        height = int(rng.integers(70, 105)) * S
        spine = book(width, height)
        # Spines that cross the right edge carry on from the left: the tile wraps around.
        for column in range(width):
            pixels[ROW - height :, (x + column) % WIDTH] = spine[:, column]
        x += width + 2 * S
    return pixels


def board() -> np.ndarray:
    pixels = np.tile(rgb("#5a3418"), (BOARD, WIDTH, 1))
    pixels[: 3 * S] = pixels[: 3 * S] * 0.82 + np.array([255, 210, 150]) / 255 * 0.18
    pixels[-2 * S :] *= 0.6
    return pixels


def tile() -> Image.Image:
    shelves = np.concatenate([np.concatenate([row(), board()]) for _ in range(ROWS)])
    image = Image.fromarray(np.round(shelves * 255).astype(np.uint8), "RGB")
    image = ImageEnhance.Brightness(image).enhance(0.62)
    return ImageEnhance.Color(image).enhance(0.8)


def save(image: Image.Image, scale: int, path: Path) -> None:
    size = (image.width * scale // S, image.height * scale // S)
    scaled = image.resize(size, Image.Resampling.LANCZOS) if scale < S else image
    for quality in (70, 60, 50, 40, 30):
        buffer = io.BytesIO()
        scaled.save(buffer, "WEBP", quality=quality, method=6)
        if buffer.getbuffer().nbytes <= BUDGET:
            break
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(buffer.getvalue())
    print(path.relative_to(ROOT), size, buffer.getbuffer().nbytes, "bytes, quality", quality)


def main() -> None:
    image = tile()
    save(image, 1, WEB / "shelves.webp")
    save(image, 2, WEB / "shelves@2x.webp")
    save(image, 1, MOBILE / "shelves.webp")
    save(image, 2, MOBILE / "shelves@2x.webp")
    save(image, 3, MOBILE / "shelves@3x.webp")


main()
