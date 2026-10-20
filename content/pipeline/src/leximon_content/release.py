"""Catalogue releases (D-023): turns the publishable cards of Directus into a versioned folder,
`content/releases/<version>/`, with a manifest and one hash-named file per collection.

The schema is `packages/contract/src/catalog.ts`; `pnpm catalog:publish` validates it again
before anything reaches the game."""

import hashlib
import json
import re
import tomllib
import unicodedata
from collections.abc import Callable, Mapping, Sequence
from dataclasses import dataclass
from datetime import date, datetime
from pathlib import Path

from . import config, ngram
from .rarity import LABELS

SCHEMA_VERSION = 1
RELEASES_DIR = config.REPO_ROOT / "content" / "releases"
COLLECTIONS_FILE = config.REPO_ROOT / "content" / "collections.toml"
#: Directus verdicts that accept a card as it stands or after the reviewer's edit.
ACCEPTED_VERDICTS = frozenset({"ok", "retouche"})
RARITY_CODES = {label: code for code, label in LABELS.items()}
ROMAN = {
    10: "Xe", 11: "XIe", 12: "XIIe", 13: "XIIIe", 14: "XIVe", 15: "XVe",
    16: "XVIe", 17: "XVIIe", 18: "XVIIIe", 19: "XIXe", 20: "XXe",
}  # fmt: skip
HASH_LENGTH = 12


@dataclass(frozen=True)
class Collection:
    id: str
    name: str
    #: Content runs whose publishable cards make up the collection.
    runs: tuple[str, ...]
    #: Pre-screen domains its new runs select from (D-024); empty for any domain.
    domains: tuple[str, ...] = ()


class ReleaseError(Exception):
    """The release would break a rule of the catalogue; nothing is written."""


def load_collections(path: Path = COLLECTIONS_FILE) -> list[Collection]:
    data = tomllib.loads(path.read_text(encoding="utf-8"))
    return [
        Collection(
            id=item["id"],
            name=item["name"],
            runs=tuple(item["runs"]),
            domains=tuple(item.get("domains", ())),
        )
        for item in data["collection"]
    ]


def collection_of_run(collections: Sequence[Collection], run: str) -> Collection | None:
    return next((c for c in collections if run in c.runs), None)


def slug(word: str) -> str:
    lower = word.lower().replace("œ", "oe").replace("æ", "ae")
    plain = unicodedata.normalize("NFKD", lower)
    ascii_word = plain.encode("ascii", "ignore").decode().lower()
    return re.sub(r"[^a-z0-9]+", "-", ascii_word).strip("-")


def era_label(era: str | None) -> str | None:
    """ "13e siècle" (Directus) becomes "XIIIe s."; an unknown era stays unknown."""
    match = re.fullmatch(r"(\d+)e siècle", era or "")
    return f"{ROMAN[int(match.group(1))]} s." if match and int(match.group(1)) in ROMAN else None


def publishable(row: Mapping[str, object]) -> bool:
    """Accepted in review, or never sent to review. Cards waiting for review are left out."""
    verdict = row.get("verdict")
    if verdict:
        return verdict in ACCEPTED_VERDICTS
    return not row.get("to_review")


def per_billion(frequency: ngram.NgramFrequency | None) -> float | None:
    if frequency is None or not frequency.attested:
        return None
    return float(f"{frequency.modern:.3g}")


def card(
    row: Mapping[str, object],
    collection_id: str,
    frequency: ngram.NgramFrequency | None,
    engraving: Mapping[str, object] | None = None,
) -> dict[str, object] | None:
    """The catalogue card of a Directus row, or `None` when its rarity is not computed yet
    (compound words, D-020). A card without an approved engraving keeps its initial (`null`)."""
    rarity = RARITY_CODES.get(str(row["rarity"]))
    if rarity is None:
        return None
    quote = (
        {"text": row["quote_text"], "author": row["quote_author"]}
        if row.get("quote_text") and row.get("quote_author")
        else None
    )
    word = str(row["word"])
    return {
        "id": slug(word),
        "word": word,
        "partOfSpeech": row["part_of_speech"],
        "era": era_label(row.get("era")),  # type: ignore[arg-type]
        "definition": row["definition"],
        "etymology": row.get("etymology") or None,
        "quote": quote,
        "rarity": rarity,
        "collectionId": collection_id,
        "themes": sorted(set(row.get("themes") or [])),  # type: ignore[call-overload]
        "perBillion": per_billion(frequency),
        "engraving": dict(engraving) if engraving is not None else None,
    }


def _json(value: object) -> bytes:
    return (json.dumps(value, ensure_ascii=False, indent=2) + "\n").encode("utf-8")


def build(
    collections: Sequence[Collection],
    rows_by_run: Mapping[str, Sequence[Mapping[str, object]]],
    frequency_of: Callable[[str], ngram.NgramFrequency | None],
    version: str,
    released_at: datetime,
    engravings: Mapping[str, Mapping[str, object]] | None = None,
) -> dict[str, bytes]:
    """Every file of the release, keyed by path relative to the release folder. `engravings`
    holds the rendered engraving of each card that has one (data/gravures/out/rendered.json)."""
    engravings = engravings or {}
    files: dict[str, bytes] = {}
    entries = []
    owner: dict[str, str] = {}
    for collection in collections:
        cards = []
        for run in collection.runs:
            if run not in rows_by_run:
                raise ReleaseError(f"{collection.id} : la série {run} n'existe pas dans Directus")
            for row in rows_by_run[run]:
                if not publishable(row):
                    continue
                word = str(row["word"])
                built = card(row, collection.id, frequency_of(word), engravings.get(slug(word)))
                if built is None:
                    continue
                card_id = str(built["id"])
                if card_id in owner:
                    raise ReleaseError(
                        f"« {built['word']} » ({card_id}) est déjà dans {owner[card_id]}"
                    )
                owner[card_id] = collection.id
                cards.append(built)
        cards.sort(key=lambda c: str(c["id"]))
        content = _json({"id": collection.id, "name": collection.name, "cards": cards})
        digest = hashlib.sha256(content).hexdigest()[:HASH_LENGTH]
        path = f"collections/{collection.id}.{digest}.json"
        files[path] = content
        entries.append(
            {"id": collection.id, "name": collection.name, "cardCount": len(cards), "file": path}
        )
    files["manifest.json"] = _json(
        {
            "schemaVersion": SCHEMA_VERSION,
            "version": version,
            "releasedAt": released_at.isoformat(timespec="milliseconds").replace("+00:00", "Z"),
            "collections": entries,
        }
    )
    return files


def next_version(releases_dir: Path, today: date) -> str:
    taken = [
        int(path.name.rsplit(".", 1)[1])
        for path in releases_dir.glob(f"{today.isoformat()}.*")
        if path.is_dir() and path.name.rsplit(".", 1)[1].isdigit()
    ]
    return f"{today.isoformat()}.{max(taken, default=0) + 1}"


def latest_release(releases_dir: Path) -> Path | None:
    def key(path: Path) -> tuple[str, int]:
        day, number = path.name.rsplit(".", 1)
        return day, int(number)

    candidates = [
        p
        for p in releases_dir.glob("*.*")
        if p.is_dir() and re.fullmatch(r"\d{4}-\d{2}-\d{2}\.\d+", p.name)
    ]
    return max(candidates, key=key, default=None)


def same_collections(files: Mapping[str, bytes], release: Path) -> bool:
    """True when `release` already holds exactly these collection files."""
    previous = {p.relative_to(release).as_posix() for p in release.glob("collections/*.json")}
    return previous == {path for path in files if path.startswith("collections/")}


def write(files: Mapping[str, bytes], release: Path) -> None:
    for path, content in files.items():
        target = release / path
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(content)
