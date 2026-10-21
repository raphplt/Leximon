"""Engravings of the catalogue: from the validated Commons file to the two published images
(docs/rnd/gravures.md §4 and §5; owner's render « B + D », 2026-10-20).

For each card approved in data/gravures/validation.json:

1. download a larger version of the picked Commons file, kept in data/gravures/originals/;
2. render it: grey, background corrected, margins trimmed, steep curve, then two WebP files that
   hold only an alpha channel, so the card tints them at display time:
   - `ink`: the lines of the engraving (every rarity);
   - `fill`: the dark masses, posterised into one flat shape, half size (the misregistered colour
     plate of Rare cards and above);
3. write data/gravures/out/rendered.json, which `release` reads to attach the engravings.

Files are named after their content (`gravures/<card>.<hash12>.ink.webp`), like the catalogue
(D-023): a published file never changes. Rendering is deterministic and fast, so it is always
redone; only the downloads are kept. Port of rnd/gravures/render_trial.py, never imported."""

import hashlib
import io
import json
import re
import time
from collections.abc import Mapping, Sequence
from dataclasses import dataclass
from pathlib import Path

import httpx
import numpy as np
from PIL import Image, ImageFilter, ImageOps

from . import gravures
from .gravures import GRAVURES_DIR

VALIDATION_FILE = GRAVURES_DIR / "validation.json"
#: The alphabet of decorated initials shown on a card that has no engraving (chosen by hand):
#: {"letters": {"A": {"title": "File:…", "crop": […], "author": …, "year": …}, …}}.
INITIALS_FILE = GRAVURES_DIR / "lettrines.json"
#: Commons fields of those files, fetched once.
INITIALS_FILES_FILE = GRAVURES_DIR / "lettrines-files.json"
ORIGINALS_DIR = GRAVURES_DIR / "originals"
OUT_DIR = GRAVURES_DIR / "out"
RENDERED_FILE = OUT_DIR / "rendered.json"
#: Published paths start with this folder, relative to the catalogue root (and to OUT_DIR).
PUBLISHED_FOLDER = "gravures"

#: Bumped whenever the recipe changes: every file then gets a new hash (R&D §5).
RENDER_VERSION = 1
#: Commons serves thumbnails at standard widths (…, 960, 1280, 1920); larger than any output.
DOWNLOAD_WIDTH = 1280
#: Ink fit box in px: the 258-unit slot at 3x, and up to 160 units high for the tall subjects
#: that overflow upward (118 + 26 units, rounded up).
INK_BOX = (774, 480)
#: Steep curve (R&D §4): at or below LOW is full ink, at or above HIGH is paper.
INK_LOW, INK_HIGH = 110, 205
#: Share of the image area the flat colour covers, in percent.
FILL_SHARE = 35
#: Lowest density threshold (0–255): sparse line art (a sword, a plant) would otherwise set it
#: near zero and tint the whole background.
FILL_MIN_LEVEL = 16
INK_QUALITY, FILL_QUALITY, ALPHA_QUALITY = 80, 70, 60
HASH_LENGTH = 12
#: Seconds between two downloads: upload.wikimedia.org answers a burst with a 10-minute 429.
DOWNLOAD_PAUSE_S = 5.0
#: The fields of a card's `engraving` in the catalogue (packages/contract/src/catalog.ts).
CONTRACT_FIELDS = ("ink", "fill", "width", "height", "credit", "sourceUrl", "licence")

Box = tuple[float, float, float, float]


# --- Credit line (pure) --------------------------------------------------------------------------

#: The engraver's mark after a name: "C. Butterworth sc." (sculpsit), "del.", "fecit"…
ROLE_SUFFIX = re.compile(r"\s+(sc|sculp|sculpsit|del|delin|fecit|fec|inv|pinx|exc|excud)\.?$", re.I)


#: English roles written before a name in Commons fields: "Engraved by …", "Attributed to …".
ROLE_PREFIX = re.compile(
    r"^(?:(?:(?:wood\s+)?engraved\s+by|engraving\s+by|engraver|drawn\s+by|caricature\s+by|"
    r"illustrat(?:ed|ions?)\s+by|attributed\s+to|after|(?:a\s+)?(?:painting|drawing|print)\s+by)"
    r"\s+|illustrateur\s*:\s*)",
    re.I,
)
#: A wiki namespace left in front of a name: "Creator:Raphael Sadeler I", "en:Eugenius Warming".
WIKI_PREFIX = re.compile(r"^(?:[a-z]{2,3}|creator|template|user|category)\s*:\s*", re.I)
#: "Robert Havell after John James Audubon": the credit names whom the print is after.
AFTER = re.compile(r"(?:\s+|\s*/\s*)after\s+", re.I)
#: A phrase about the technique rather than a person: "Engravings on Wood".
NOT_A_NAME = re.compile(r"\bengravings?\b|\billustrations?\b", re.I)


def strip_roles(text: str) -> str:
    """The names alone, in French: English roles dropped, "and" and "&" as "et"."""
    text = " ".join(text.split()).rstrip(".").strip()
    parts = AFTER.split(text)
    text = parts[-1] if len(parts) > 1 and parts[-1].strip() else text
    text = WIKI_PREFIX.sub("", ROLE_PREFIX.sub("", text)).strip()
    return re.sub(r"\s+(?:and|&)\s+", " et ", text)


def author_display(artist: str) -> str | None:
    """The first person named in a Commons artist field, as "First Last"; None when the field
    is empty, says the author is unknown, or names an institution (a museum, a scan)."""
    text = re.sub(r"\([^)]*\)", " ", artist.split(";")[0])
    text = strip_roles(text)
    if (
        NOT_A_NAME.search(text)
        or not text
        or gravures.UNKNOWN_AUTHOR.search(text)
        or gravures.INSTITUTION.search(text)
        or re.search(r"\d", text)
    ):
        return None
    parts = [p.strip() for p in text.split(",")]
    first = parts[0]
    if (
        len(parts) >= 2
        and len(first.split()) == 1
        and 1 <= len(parts[1].split()) <= 3
        and not ROLE_SUFFIX.search(" " + parts[1])
    ):
        first = f"{parts[1]} {first}"  # "Desfontaines, René"
    name = ROLE_SUFFIX.sub("", first).strip()
    return name if name and len(name.split()) <= 6 else None


def fonds(hit: Mapping[str, object]) -> str:
    """The collection the file comes from, as the credit names it."""
    fields = [str(hit.get(k, "")) for k in ("title", "credit", "artist", "description")]
    haystack = " ".join([*fields, *(str(c) for c in hit.get("categories") or [])]).lower()  # type: ignore[attr-defined]
    if "wellcome" in haystack:
        return "Wellcome Collection"
    if "rijksmuseum" in haystack:
        return "Rijksmuseum"
    if "internet archive" in haystack or "internetarchivebookimages" in haystack:
        return "Internet Archive"
    return "Wikimedia Commons"


def licence_label(hit: Mapping[str, object]) -> str:
    """ "domaine public", "CC0" or "CC BY 4.0": the only licences the rights filter lets through."""
    short = str(hit.get("licence", "")).lower().replace("-", " ").strip()
    code = str(hit.get("licence_code", "")).lower()
    if short == "cc by 4.0" or code == "cc-by-4.0":
        return "CC BY 4.0"
    if short == "cc0" or code == "cc0":
        return "CC0"
    terms = f"{short} {code} {str(hit.get('usage_terms', '')).lower()}"
    if any(tag in terms for tag in gravures.FREE_LICENCES) or code in gravures.FREE_CODES:
        return "domaine public"
    raise ValueError(f"licence hors du filtre de droits : {hit.get('licence')!r}")


def credit_line(hit: Mapping[str, object], overrides: Mapping[str, object] | None = None) -> str:
    """« D'après Honoré Daumier, 1833 · Wikimedia Commons (domaine public) », or « Anonyme, 1849 ·
    … » when the author is unknown. The author (when known), the source and the licence are all
    there: CC BY 4.0 requires them. `overrides` may set "author" and "year" by hand
    (validation.json), when Commons does not say them in a machine-readable field."""
    overrides = overrides or {}
    override = overrides.get("author")
    author = strip_roles(str(override)) if override else author_display(str(hit.get("artist", "")))
    year = overrides.get("year") or gravures.work_year(str(hit.get("date", "")))
    who = f"D'après {author}" if author else "Anonyme"
    when = f", {year}" if year else ""
    return f"{who}{when} · {fonds(hit)} ({licence_label(hit)})"


# --- Download (pure parts) -----------------------------------------------------------------------

THUMB_WIDTH_IN_URL = re.compile(r"/((?:lossy-|lossless-)?page\d+-)?(\d+)px-")


def download_url(candidate: Mapping[str, object], width: int = DOWNLOAD_WIDTH) -> str:
    """The original when it is no wider than `width`, else its Commons thumbnail at `width`."""
    original = str(candidate["original_url"])
    size = candidate.get("original_size") or [None, None]
    original_width = size[0]  # type: ignore[index]
    thumb = str(candidate.get("thumb_url") or "")
    if (original_width is not None and int(original_width) <= width) or not thumb:
        return original
    match = list(THUMB_WIDTH_IN_URL.finditer(thumb))
    if not match:
        return original
    last = match[-1]
    return f"{thumb[: last.start()]}/{last.group(1) or ''}{width}px-{thumb[last.end() :]}"


# --- Image treatment (pure) ----------------------------------------------------------------------


def crop_box(size: tuple[int, int], fractions: Sequence[float]) -> tuple[int, int, int, int]:
    """A manual crop (x0, y0, x1, y1 in fractions of the original) in pixels."""
    if len(fractions) != 4:
        raise ValueError(f"crop : quatre fractions attendues, pas {list(fractions)}")
    x0, y0, x1, y1 = (float(f) for f in fractions)
    if not (0 <= x0 < x1 <= 1 and 0 <= y0 < y1 <= 1):
        raise ValueError(f"crop : 0 ≤ x0 < x1 ≤ 1 et 0 ≤ y0 < y1 ≤ 1, pas {list(fractions)}")
    w, h = size
    return round(x0 * w), round(y0 * h), max(round(x1 * w), 1), max(round(y1 * h), 1)


def fit(size: tuple[int, int], box: tuple[int, int]) -> tuple[int, int]:
    """Contained in `box`, never enlarged (an upscale would only add weight)."""
    w, h = size
    scale = min(box[0] / w, box[1] / h, 1.0)
    return max(1, round(w * scale)), max(1, round(h * scale))


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


def to_grey(image: Image.Image) -> Image.Image:
    """Grey levels on white paper: a transparent background (PNG line art) becomes paper, not ink."""
    image = ImageOps.exif_transpose(image)
    if image.mode in ("I", "I;16", "I;16B", "I;16L", "F"):
        a = np.asarray(image, dtype=np.float32)
        span = max(float(a.max() - a.min()), 1.0)
        return Image.fromarray(((a - a.min()) / span * 255).astype(np.uint8))
    if image.mode in ("RGBA", "LA", "PA") or "transparency" in image.info:
        rgba = image.convert("RGBA")
        paper = Image.new("RGBA", rgba.size, (255, 255, 255, 255))
        image = Image.alpha_composite(paper, rgba)
    return image.convert("L")


def flat_field(grey: Image.Image) -> Image.Image:
    """Divides by a wide blur: yellowed paper, stains and foxing turn white, the lines stay."""
    radius = max(grey.size) // 30
    background = grey.filter(ImageFilter.GaussianBlur(radius))
    a = np.asarray(grey, dtype=np.float32)
    b = np.maximum(np.asarray(background, dtype=np.float32), 1.0)
    return Image.fromarray(np.clip(a / b * 255.0, 0, 255).astype(np.uint8))


def trim(grey: Image.Image, ink_level: int = 170, pad: float = 0.02) -> Image.Image:
    """Crops to the ink's bounding box; the median filter ignores dust."""
    ink = grey.filter(ImageFilter.MedianFilter(5)).point(lambda v: 255 if v < ink_level else 0)
    box = ink.getbbox()
    if box is None:
        return grey
    w, h = grey.size
    p = int(pad * max(w, h))
    return grey.crop(
        (max(0, box[0] - p), max(0, box[1] - p), min(w, box[2] + p), min(h, box[3] + p))
    )


def prepare(image: Image.Image, crop: Sequence[float] | None = None) -> Image.Image:
    grey = to_grey(image)
    if crop is not None:
        grey = grey.crop(crop_box(grey.size, crop))
    return ImageOps.autocontrast(trim(flat_field(grey)), cutoff=1)


def alpha_webp(alpha: np.ndarray, quality: int) -> bytes:
    """Black with this alpha, lossy WebP (lossless alpha doubles the weight, R&D §4)."""
    a = Image.fromarray(np.clip(alpha * 255, 0, 255).astype(np.uint8))
    rgba = Image.new("RGBA", a.size, (0, 0, 0, 0))
    rgba.putalpha(a)
    buffer = io.BytesIO()
    rgba.save(buffer, "WEBP", method=6, quality=quality, alpha_quality=ALPHA_QUALITY)
    return buffer.getvalue()


@dataclass(frozen=True)
class Rendered:
    ink: bytes
    fill: bytes
    #: Size of the ink image, in px.
    size: tuple[int, int]
    fill_size: tuple[int, int]


def render(grey: Image.Image) -> Rendered:
    size = fit(grey.size, INK_BOX)
    g = np.asarray(grey.resize(size, Image.Resampling.LANCZOS), dtype=np.float32)
    ink = ramp(g, INK_LOW, INK_HIGH) * edge_feather(size)

    # Colour masses: local ink density, posterised into flat shapes. The threshold is a
    # percentile, so every image gets about the same share of colour. Half size: it is a blob.
    half = (max(1, size[0] // 2), max(1, size[1] // 2))
    a = Image.fromarray((ink * 255).astype(np.uint8)).resize(half, Image.Resampling.LANCZOS)
    density = np.asarray(a.filter(ImageFilter.GaussianBlur(max(half) / 70)), dtype=np.float32)
    level = max(float(np.percentile(density, 100 - FILL_SHARE)), FILL_MIN_LEVEL)
    fill = (1.0 - ramp(density, level - 6, level + 6)) * edge_feather(half, 0.08)
    return Rendered(
        ink=alpha_webp(ink, INK_QUALITY),
        fill=alpha_webp(fill, FILL_QUALITY),
        size=size,
        fill_size=half,
    )


def content_hash(content: bytes) -> str:
    return hashlib.sha256(content).hexdigest()[:HASH_LENGTH]


def published_path(card_id: str, content: bytes, kind: str) -> str:
    """`gravures/<card>.<hash12>.<kind>.webp`, relative to the catalogue root."""
    return f"{PUBLISHED_FOLDER}/{card_id}.{content_hash(content)}.{kind}.webp"


# --- Validation and rendered manifest ------------------------------------------------------------


def approved_cards(validation: Mapping[str, Mapping[str, object]]) -> dict[str, Mapping]:
    return {card: entry for card, entry in validation.items() if entry.get("approved")}


def picked_candidate(search: Mapping[str, object], pick: int) -> dict:
    for candidate in search["candidates"]:  # type: ignore[attr-defined]
        if candidate["n"] == pick:
            return candidate
    raise ValueError(f"{search['card']} : pas de candidat n° {pick}")


def engraving_entry(
    card_id: str,
    rendered: Rendered,
    candidate: Mapping[str, object],
    validation: Mapping[str, object],
) -> dict[str, object]:
    """One card of rendered.json: the catalogue fields first, then what makes it reproducible."""
    return {
        "ink": published_path(card_id, rendered.ink, "ink"),
        "fill": published_path(card_id, rendered.fill, "fill"),
        "width": rendered.size[0],
        "height": rendered.size[1],
        "credit": credit_line(candidate, validation),
        "sourceUrl": str(candidate["page_url"]),
        "licence": licence_label(candidate),
        "inkBytes": len(rendered.ink),
        "fillBytes": len(rendered.fill),
        "fillSize": list(rendered.fill_size),
        "title": candidate["title"],
        "pick": validation["pick"],
        "crop": validation.get("crop"),
    }


def load_initials(path: Path = RENDERED_FILE) -> dict[str, dict[str, object]]:
    """The rendered decorated initial of each letter, with the catalogue fields only."""
    if not path.exists():
        return {}
    data = json.loads(path.read_text(encoding="utf-8"))
    return {
        letter: {field: entry[field] for field in CONTRACT_FIELDS}
        for letter, entry in data.get("initials", {}).items()
    }


def load_engravings(path: Path = RENDERED_FILE) -> dict[str, dict[str, object]]:
    """The `engraving` of every rendered card, with the catalogue fields only. Empty before the
    first `gravures-render`: every card is then released without an engraving."""
    if not path.exists():
        return {}
    data = json.loads(path.read_text(encoding="utf-8"))
    return {
        card: {field: entry[field] for field in CONTRACT_FIELDS}
        for card, entry in data["cards"].items()
    }


# --- Run (I/O) -----------------------------------------------------------------------------------


def original_for(
    http: httpx.Client, card_id: str, candidate: Mapping[str, object], round_number: int = 1
) -> Path:
    """The downloaded original of the picked file, fetched once (a new pick is a new file)."""
    prefix = card_id if round_number == 1 else f"{card_id}-r{round_number}"
    stem = f"{prefix}-{candidate['n']}"
    existing = sorted(ORIGINALS_DIR.glob(f"{stem}.*"))
    if existing:
        return existing[0]
    url = download_url(candidate)
    time.sleep(DOWNLOAD_PAUSE_S)  # one file at a time, slowly
    raw = gravures.download(http, url)
    if raw is None:
        raise RuntimeError(f"{card_id} : téléchargement impossible ({url})")
    _media, suffix = gravures.media_type(raw)
    path = ORIGINALS_DIR / f"{stem}{suffix}"
    ORIGINALS_DIR.mkdir(parents=True, exist_ok=True)
    path.write_bytes(raw)
    return path


def run_render() -> None:
    validation = json.loads(VALIDATION_FILE.read_text(encoding="utf-8"))
    approved = approved_cards(validation)
    # An engraving approved in a later round points at that round's candidates.
    rounds = {int(entry.get("round", 1)) for entry in approved.values()}  # type: ignore[arg-type]
    searches = {n: gravures.searches_of_round(n) for n in rounds}
    print(f"gravures validées : {len(approved)} sur {len(validation)}")
    entries: dict[str, dict[str, object]] = {}
    files: dict[str, bytes] = {}
    with httpx.Client(
        headers={"User-Agent": gravures.USER_AGENT}, timeout=120, follow_redirects=True
    ) as http:
        for card_id, entry in sorted(approved.items()):
            round_number = int(entry.get("round", 1))  # type: ignore[arg-type]
            search = searches[round_number][card_id]
            candidate = picked_candidate(search, int(entry["pick"]))  # type: ignore[arg-type]
            original = original_for(http, card_id, candidate, round_number)
            with Image.open(original) as image:
                grey = prepare(image, entry.get("crop"))  # type: ignore[arg-type]
            rendered = render(grey)
            row = engraving_entry(card_id, rendered, candidate, entry)
            entries[card_id] = row
            files[str(row["ink"])] = rendered.ink
            files[str(row["fill"])] = rendered.fill
            print(
                f"{card_id:14} {rendered.size[0]:>4}x{rendered.size[1]:<4} "
                f"encre {len(rendered.ink) / 1024:5.1f} Ko · aplat {len(rendered.fill) / 1024:4.1f} Ko"
                f" · {row['credit']}",
                flush=True,
            )
        initials = render_initials(http, files)
    write_out(entries, files, initials)
    total = sum(len(b) for b in files.values())
    print(
        f"{len(entries)} gravures et {len(initials)} lettrines, {total / 1024:.1f} Ko en tout, "
        f"dans {OUT_DIR}"
    )


def initial_files(letters: Mapping[str, Mapping[str, object]]) -> dict[str, dict]:
    """Commons fields of every initial, fetched once and kept in INITIALS_FILES_FILE."""
    known = (
        json.loads(INITIALS_FILES_FILE.read_text(encoding="utf-8"))
        if INITIALS_FILES_FILE.exists()
        else {}
    )
    missing = sorted({str(e["title"]) for e in letters.values()} - known.keys())
    if missing:
        wiki = gravures.Wikimedia()
        try:
            for start in range(0, len(missing), 50):
                known.update(wiki.files(missing[start : start + 50]))
        finally:
            wiki.close()
        INITIALS_FILES_FILE.write_text(
            json.dumps(known, ensure_ascii=False, indent=1), encoding="utf-8"
        )
    return known


def render_initials(http: httpx.Client, files: dict[str, bytes]) -> dict[str, dict[str, object]]:
    """The decorated initials of INITIALS_FILE, rendered like engravings; `files` gets theirs."""
    if not INITIALS_FILE.exists():
        return {}
    letters = json.loads(INITIALS_FILE.read_text(encoding="utf-8"))["letters"]
    commons = initial_files(letters)
    entries: dict[str, dict[str, object]] = {}
    for letter, choice in sorted(letters.items()):
        hit = commons.get(str(choice["title"]))
        if hit is None:
            raise RuntimeError(f"lettrine {letter} : {choice['title']} introuvable sur Commons")
        name = f"lettrine-{letter.lower()}"
        original = original_for(http, name, {**hit, "n": 1})
        with Image.open(original) as image:
            grey = prepare(image, choice.get("crop"))
        rendered = render(grey)
        row = engraving_entry(name, rendered, hit, {"pick": 1, **choice})
        entries[letter] = row
        files[str(row["ink"])] = rendered.ink
        files[str(row["fill"])] = rendered.fill
        print(f"lettrine {letter} : {rendered.size[0]}x{rendered.size[1]} · {row['credit']}")
    return entries


def write_out(
    entries: Mapping[str, Mapping[str, object]],
    files: Mapping[str, bytes],
    initials: Mapping[str, Mapping[str, object]] | None = None,
) -> None:
    """Writes the files, drops those no card refers to any more, then the manifest."""
    folder = OUT_DIR / PUBLISHED_FOLDER
    folder.mkdir(parents=True, exist_ok=True)
    for path, content in files.items():
        (OUT_DIR / path).write_bytes(content)
    for stale in folder.glob("*.webp"):
        if f"{PUBLISHED_FOLDER}/{stale.name}" not in files:
            stale.unlink()
    RENDERED_FILE.write_text(
        json.dumps(
            {
                "renderVersion": RENDER_VERSION,
                "cards": dict(sorted(entries.items())),
                "initials": dict(sorted((initials or {}).items())),
            },
            ensure_ascii=False,
            indent=1,
        )
        + "\n",
        encoding="utf-8",
    )
