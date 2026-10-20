"""Throwaway: assets for the engraving render trial (apps/web/src/app/essai-gravures).

Builds, for six rights-clean images already downloaded by the R&D, the files the trial page
shows in the real card component:
  - <name>.ink.webp   ink alone, black + alpha (variants A, B, E, and the ink layer of D);
                      the card tints it with CSS mask-image, so one file serves every rarity;
  - <name>.fill.webp  colour masses for the two-tone print (variant D), alpha only, half size;
  - <name>.plate.webp the engraving kept on its paper, cleaned, warm duotone (variant C).

Crops are fixed by hand here, as they would be at validation. Sources of 330 px (Commons
thumbnails of the vision test) are upscaled: their weights are indicative only.

Needs Pillow and NumPy (system Python). Run: python3 rnd/gravures/render_trial.py
"""

import io
import json
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter, ImageOps

HERE = Path(__file__).parent
OUT = HERE.parent.parent / "apps" / "web" / "public" / "essai-gravures"

# Fit box at 3x: slot width 258 units, height up to 150 units (variant E lets it grow).
BOX = (774, 450)
PLATE_BOX = (720, 330)  # plate inner area at 3x (C)
FILL_SHARE = 35  # percent of the image area covered by the flat colour (D)
SEPIA_INK = np.array([42, 32, 24], dtype=np.float32)
SEPIA_PAPER = np.array([255, 252, 246], dtype=np.float32)

# name: (source, crop box in fractions x0, y0, x1, y1)
IMAGES = {
    "casoar": ("out/thumbs/casoar.jpg", (0.0, 0.0, 1.0, 0.98)),
    "barbon": ("out/thumbs/vieux-niais.jpg", (0.21, 0.13, 0.73, 0.79)),
    "sabord": ("out/thumbs/sabord.jpg", (0.05, 0.03, 0.95, 0.97)),
    "scramaison": ("out/vision/thumbs/scramaison/4.jpg", (0.04, 0.10, 0.97, 0.96)),
    "gastrolatre": ("out/vision/thumbs/gastrolatre/3.jpg", (0.03, 0.01, 0.97, 0.85)),
    "charivarieur": ("out/vision/thumbs/charivarieur/1.jpg", (0.0, 0.0, 1.0, 0.85)),
}


def flat_field(grey: Image.Image) -> Image.Image:
    radius = max(grey.size) // 30
    background = grey.filter(ImageFilter.GaussianBlur(radius))
    a = np.asarray(grey, dtype=np.float32)
    b = np.maximum(np.asarray(background, dtype=np.float32), 1.0)
    return Image.fromarray(np.clip(a / b * 255.0, 0, 255).astype(np.uint8))


def trim(grey: Image.Image, ink_level: int = 170, pad: float = 0.02) -> Image.Image:
    ink = grey.filter(ImageFilter.MedianFilter(5)).point(lambda v: 255 if v < ink_level else 0)
    box = ink.getbbox()
    if box is None:
        return grey
    w, h = grey.size
    p = int(pad * max(w, h))
    return grey.crop((max(0, box[0] - p), max(0, box[1] - p), min(w, box[2] + p), min(h, box[3] + p)))


def ramp(a: np.ndarray, low: float, high: float) -> np.ndarray:
    """1 at or below low, 0 at or above high, linear between."""
    return np.clip((high - a) / (high - low), 0.0, 1.0)


def edge_feather(size: tuple[int, int], fraction: float = 0.05) -> np.ndarray:
    """Soft rectangular fade so a cropped background never ends on a hard edge."""
    w, h = size
    f = max(2, int(fraction * min(w, h)))
    x = np.minimum(np.arange(w), np.arange(w)[::-1]) / f
    y = np.minimum(np.arange(h), np.arange(h)[::-1]) / f
    return np.clip(np.minimum.outer(y, x), 0.0, 1.0)


def fit(size: tuple[int, int], box: tuple[int, int]) -> tuple[int, int]:
    w, h = size
    s = min(box[0] / w, box[1] / h)
    return round(w * s), round(h * s)


def webp(img: Image.Image, **opts) -> bytes:
    buf = io.BytesIO()
    img.save(buf, "WEBP", method=6, **opts)
    return buf.getvalue()


def alpha_webp(alpha: np.ndarray, quality: int = 80) -> bytes:
    a = Image.fromarray(np.clip(alpha * 255, 0, 255).astype(np.uint8))
    rgba = Image.new("RGBA", a.size, (0, 0, 0, 0))
    rgba.putalpha(a)
    return webp(rgba, quality=quality, alpha_quality=60)


def prepare(source: Path, crop: tuple[float, float, float, float]) -> Image.Image:
    grey = ImageOps.exif_transpose(Image.open(source)).convert("L")
    w, h = grey.size
    grey = grey.crop((round(crop[0] * w), round(crop[1] * h), round(crop[2] * w), round(crop[3] * h)))
    return ImageOps.autocontrast(trim(flat_field(grey)), cutoff=1)


def build(name: str, source: Path, crop: tuple[float, float, float, float]) -> dict:
    grey = prepare(source, crop)
    native = grey.size

    # Ink alone (R&D steep curve), at the 3x fit box.
    size = fit(native, BOX)
    g = np.asarray(grey.resize(size, Image.LANCZOS), dtype=np.float32)
    ink = ramp(g, 110, 205) * edge_feather(size)
    ink_bytes = alpha_webp(ink)
    # Weight at the plain 118-unit slot (3x), comparable with the R&D table (h360).
    s3 = fit(native, (BOX[0], 354))
    g3 = np.asarray(grey.resize(s3, Image.LANCZOS), dtype=np.float32)
    ink_slot_bytes = len(alpha_webp(ramp(g3, 110, 205) * edge_feather(s3)))

    # Colour masses: local ink density, posterised into flat shapes. The threshold is a
    # percentile, so every image gets about the same share of colour. Half size: it is a blob.
    half = (size[0] // 2, size[1] // 2)
    a = Image.fromarray((ink * 255).astype(np.uint8)).resize(half, Image.LANCZOS)
    density = np.asarray(a.filter(ImageFilter.GaussianBlur(max(half) / 70)), dtype=np.float32)
    level = float(np.percentile(density, 100 - FILL_SHARE))
    fill = (1.0 - ramp(density, level - 6, level + 6)) * edge_feather(half, 0.08)
    fill_bytes = alpha_webp(fill, quality=70)

    # Plate: keep the paper and the mid-tones, map to a warm duotone (paper ~ white so that a
    # multiply blend lets the card's plate colour show through).
    psize = fit(native, PLATE_BOX)
    p = np.asarray(grey.resize(psize, Image.LANCZOS), dtype=np.float32) / 255
    t = np.clip((p - 0.12) / 0.80, 0, 1) ** 1.25  # 0 = ink, 1 = paper
    rgb = SEPIA_INK + (SEPIA_PAPER - SEPIA_INK) * t[..., None]
    plate_bytes = webp(Image.fromarray(rgb.astype(np.uint8)), quality=72)

    OUT.mkdir(parents=True, exist_ok=True)
    (OUT / f"{name}.ink.webp").write_bytes(ink_bytes)
    (OUT / f"{name}.fill.webp").write_bytes(fill_bytes)
    (OUT / f"{name}.plate.webp").write_bytes(plate_bytes)
    return {
        "name": name,
        "native": native,
        "ink": {"size": size, "bytes": len(ink_bytes)},
        "ink354": {"size": s3, "bytes": ink_slot_bytes},
        "fill": {"size": half, "bytes": len(fill_bytes)},
        "plate": {"size": psize, "bytes": len(plate_bytes)},
    }


def main() -> None:
    results = [build(name, HERE / src, crop) for name, (src, crop) in IMAGES.items()]
    print(f"{'image':13} {'source px':>11} {'ink':>16} {'ink354':>16} {'fill':>16} {'plate':>16}")
    for r in results:
        cells = "  ".join(
            f"{r[k]['size'][0]}x{r[k]['size'][1]} {r[k]['bytes'] / 1024:4.1f}K" for k in ("ink", "ink354", "fill", "plate")
        )
        print(f"{r['name']:13} {r['native'][0]:>5}x{r['native'][1]:<5} {cells}")
    for k in ("ink", "ink354", "fill", "plate"):
        print(f"total {k}: {sum(r[k]['bytes'] for r in results) / 1024:.1f} KiB")
    dims = {r["name"]: list(r["ink"]["size"]) for r in results}
    print(json.dumps(dims))


if __name__ == "__main__":
    main()
