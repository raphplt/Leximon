"""The paper and leather of Le Livre, baked once as translucent tiles.

A tile only holds the grain, over whatever color the theme puts behind it: one file serves the
day and the night, without a blend mode or live noise, which are too slow on a modest phone. The
strengths are limits read by the token tests, which measure text on the tile's darkest and
lightest pixels (`matterStrength` in tokens.ts must follow them):

    uv run --no-project --with numpy --with pillow python -I packages/tokens/scripts/bake_matter.py

The noise is filtered in frequency space, so the tile wraps around without a seam.
"""

import io
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[3]
OUTPUTS = [ROOT / "apps/web/public/matter", ROOT / "apps/mobile/assets/matter"]
SIZE = 128
DARK = (20, 12, 6)
LIGHT = (255, 246, 226)

rng = np.random.default_rng(1789)


def smooth_noise(radius: float) -> np.ndarray:
    """Periodic gaussian noise, scaled to a standard deviation of 1."""
    white = rng.normal(size=(SIZE, SIZE))
    frequencies = np.fft.fftfreq(SIZE)
    fx, fy = np.meshgrid(frequencies, frequencies)
    kernel = np.exp(-2 * (np.pi * radius) ** 2 * (fx**2 + fy**2))
    field = np.fft.ifft2(np.fft.fft2(white) * kernel).real
    return (field - field.mean()) / field.std()


def stretched_noise(along: float, across: float) -> np.ndarray:
    """Periodic noise drawn out along the rows, as fibres lie in a sheet of paper."""
    white = rng.normal(size=(SIZE, SIZE))
    frequencies = np.fft.fftfreq(SIZE)
    fx, fy = np.meshgrid(frequencies, frequencies)
    kernel = np.exp(-2 * np.pi**2 * ((along * fx) ** 2 + (across * fy) ** 2))
    field = np.fft.ifft2(np.fft.fft2(white) * kernel).real
    return (field - field.mean()) / field.std()


def translucent(field: np.ndarray, darkest: float, lightest: float) -> Image.Image:
    """Below zero the field darkens, above zero it lightens, up to the given opacities."""
    limit = np.percentile(np.abs(field), 99.5)
    field = np.clip(field / limit, -1, 1)
    alpha = np.where(field < 0, -field * darkest, field * lightest)
    pixels = np.zeros((SIZE, SIZE, 4), dtype=np.uint8)
    pixels[..., :3] = np.where(field[..., None] < 0, DARK, LIGHT)
    pixels[..., 3] = np.round(alpha * 255)
    return Image.fromarray(pixels, "RGBA")


def paper() -> Image.Image:
    fibres = stretched_noise(9, 0.8)
    mottling = smooth_noise(14)
    grain = smooth_noise(0.7)
    return translucent(0.65 * fibres + 0.3 * mottling + 0.5 * grain, 0.05, 0.03)


def leather() -> Image.Image:
    # Rounded pebbles between darker creases, then a slow variation across the hide.
    pebbles = np.abs(smooth_noise(2.2)) - 0.75
    pebbles += 0.5 * (np.abs(smooth_noise(1.1)) - 0.75)
    hide = smooth_noise(22)
    return translucent(pebbles + 0.2 * hide, 0.3, 0.1)


def main() -> None:
    for name, tile in (("paper", paper()), ("leather", leather())):
        buffer = io.BytesIO()
        tile.save(buffer, "WEBP", quality=40, alpha_quality=45, method=6, exact=True)
        for output in OUTPUTS:
            output.mkdir(parents=True, exist_ok=True)
            (output / f"{name}.webp").write_bytes(buffer.getvalue())
        print(name, buffer.getbuffer().nbytes, "bytes")


main()
