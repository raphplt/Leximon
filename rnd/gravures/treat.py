"""Throwaway test of a reproducible "Planche populaire" treatment.

For each image in out/thumbs/:
  1. greyscale, then flat-field: divide by a heavy blur to remove paper tint, stains, foxing;
  2. trim margins (bounding box of the remaining ink);
  3. steep tone curve instead of a hard threshold: hatching stays, edges stay antialiased;
  4. export the ink alone (the only file a card needs): the colours come from the rarity
     tokens at display time (CSS mask on the web, tintColor on React Native);
  5. preview composites to judge the look: the full image with a silhouette flat, and the
     web card slot (272 x 118 reference units) with the image contained on a colour disc.

Measures encode sizes (WebP, AVIF; alpha or luminance) and time per image.
Needs Pillow (12+, AVIF built in) and NumPy. Run: python3 rnd/gravures/treat.py
"""

import io
import time
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageOps

HERE = Path(__file__).parent
SRC = HERE / "out" / "thumbs"
DST = HERE / "out" / "treated"

PAPER = (251, 245, 232)  # tokens: cream.paper
INK = (30, 27, 22)  # tokens: cream.ink
FLAT = (240, 96, 60)  # tokens: rare.frame (tomate)
SLOT = (816, 354)  # 272 x 118 slot at 3x
# Asset heights: 3x of the slot (118 units) and 2x of an enlarged view.
HEIGHTS = (360, 720)


def flat_field(grey: Image.Image) -> Image.Image:
    """Paper becomes white whatever its tint: pixel / local background."""
    radius = max(grey.size) // 30
    background = grey.filter(ImageFilter.GaussianBlur(radius))
    a = np.asarray(grey, dtype=np.float32)
    b = np.maximum(np.asarray(background, dtype=np.float32), 1.0)
    return Image.fromarray(np.clip(a / b * 255.0, 0, 255).astype(np.uint8))


def trim(grey: Image.Image, ink_level: int = 170, pad: float = 0.02) -> Image.Image:
    # Median first so isolated specks (dust, stamp dots) do not widen the box.
    ink = grey.filter(ImageFilter.MedianFilter(5)).point(lambda v: 255 if v < ink_level else 0)
    box = ink.getbbox()
    if box is None:
        return grey
    w, h = grey.size
    p = int(pad * max(w, h))
    return grey.crop((max(0, box[0] - p), max(0, box[1] - p), min(w, box[2] + p), min(h, box[3] + p)))


def ink_alpha(grey: Image.Image, low: int = 110, high: int = 205) -> Image.Image:
    """Alpha of the ink: steep linear ramp between low (full ink) and high (no ink)."""
    span = high - low

    def curve(v: int) -> int:
        if v <= low:
            return 255
        if v >= high:
            return 0
        return round(255 * (high - v) / span)

    return grey.point(curve)


def silhouette(alpha: Image.Image) -> Image.Image:
    """Rough subject shape for a colour flat: blur the ink a lot, then threshold."""
    radius = max(alpha.size) // 25
    blurred = alpha.filter(ImageFilter.GaussianBlur(radius))
    return blurred.point(lambda v: 255 if v > 40 else 0).filter(ImageFilter.GaussianBlur(2))


def compose_full(alpha: Image.Image) -> Image.Image:
    shape = silhouette(alpha)
    out = Image.new("RGB", alpha.size, PAPER)
    offset = max(alpha.size) // 60
    out.paste(Image.new("RGB", alpha.size, FLAT), (offset, offset), shape)
    out.paste(Image.new("RGB", alpha.size, INK), (0, 0), alpha)
    return out


def compose_slot(alpha: Image.Image) -> Image.Image:
    """Image contained in the slot height, over an offset disc: no subject is cut."""
    sw, sh = SLOT
    out = Image.new("RGB", SLOT, PAPER)
    h = round(sh * 0.94)
    w = round(alpha.width * h / alpha.height)
    if w > sw:
        w, h = sw, round(alpha.height * sw / alpha.width)
    ink = alpha.resize((w, h), Image.LANCZOS)
    # Feathered oval: rectangular backgrounds (landscape, plate border) fade into the paper.
    oval = Image.new("L", (w, h), 0)
    ImageDraw.Draw(oval).ellipse((w * 0.04, h * 0.02, w * 0.96, h * 0.98), fill=255)
    oval = oval.filter(ImageFilter.GaussianBlur(min(w, h) // 14))
    ink = Image.fromarray((np.asarray(ink, dtype=np.uint16) * np.asarray(oval) // 255).astype(np.uint8))
    x, y = (sw - w) // 2, (sh - h) // 2
    r = round(min(sh * 0.46, max(w, h) * 0.5))
    cx, cy = sw // 2 + sh // 25, sh // 2 + sh // 25
    ImageDraw.Draw(out).ellipse((cx - r, cy - r, cx + r, cy + r), fill=FLAT)
    out.paste(Image.new("RGB", (w, h), INK), (x, y), ink)
    return out


def encoded_size(img: Image.Image, fmt: str, **opts) -> tuple[int, bytes]:
    buf = io.BytesIO()
    img.save(buf, fmt, **opts)
    return buf.tell(), buf.getvalue()


def encodes(alpha: Image.Image, height: int, name: str) -> dict:
    width = round(alpha.width * height / alpha.height)
    a = alpha.resize((width, height), Image.LANCZOS)
    rgba = Image.new("RGBA", a.size, (0, 0, 0, 0))
    rgba.putalpha(a)
    # Luminance mask: white = ink. Usable by CSS mask-mode: luminance, not by RN tintColor.
    lum = a
    out = {}
    size, data = encoded_size(rgba, "WEBP", quality=80, alpha_quality=60, method=6)
    (DST / f"{name}-h{height}.webp").write_bytes(data)
    out["webp_alpha_q60"] = size
    out["webp_alpha_lossless"] = encoded_size(rgba, "WEBP", quality=80, method=6)[0]
    size, data = encoded_size(rgba, "AVIF", quality=60, speed=6)
    (DST / f"{name}-h{height}.avif").write_bytes(data)
    out["avif_alpha_q60"] = size
    out["webp_luma_q75"] = encoded_size(lum, "WEBP", quality=75, method=6)[0]
    out["avif_luma_q60"] = encoded_size(lum, "AVIF", quality=60, speed=6)[0]
    return out


def treat(path: Path) -> dict:
    t0 = time.perf_counter()
    grey = ImageOps.exif_transpose(Image.open(path)).convert("L")
    grey = trim(flat_field(grey))
    alpha = ink_alpha(ImageOps.autocontrast(grey, cutoff=1))
    treat_ms = (time.perf_counter() - t0) * 1000

    name = path.stem
    DST.mkdir(parents=True, exist_ok=True)
    compose_full(alpha).save(DST / f"{name}-preview.jpg", quality=85)
    compose_slot(alpha).save(DST / f"{name}-slot.jpg", quality=85)

    t1 = time.perf_counter()
    sizes = {h: encodes(alpha, h, name) for h in HEIGHTS if alpha.height >= h}
    encode_ms = (time.perf_counter() - t1) * 1000
    return {"name": name, "source": path.stat().st_size, "trimmed": alpha.size,
            "treat_ms": round(treat_ms), "encode_ms": round(encode_ms), "sizes": sizes}


def main() -> None:
    for path in sorted(SRC.glob("*.jpg")):
        r = treat(path)
        print(f"{r['name']:12} source {r['source'] / 1024:4.0f} KiB  trimmed {r['trimmed']}  "
              f"treat {r['treat_ms']} ms  encode {r['encode_ms']} ms")
        for height, s in r["sizes"].items():
            cells = "  ".join(f"{k} {v / 1024:5.1f}" for k, v in s.items())
            print(f"    h{height:<4} KiB: {cells}")


if __name__ == "__main__":
    main()
