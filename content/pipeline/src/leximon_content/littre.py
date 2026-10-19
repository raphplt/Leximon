"""Reads the Littré from XMLittré (CC BY-SA 3.0 markup; the text without markup is public domain).

Only plain text leaves this module: definitions, citations with their author and reference,
etymology and the dated history. The XML itself is never redistributed.
"""

import re
import xml.etree.ElementTree as ET
from collections.abc import Iterator
from dataclasses import dataclass, field
from functools import cache
from pathlib import Path

from .config import LITTRE_DIR

ROMAN = {"I": 1, "V": 5, "X": 10, "L": 50, "C": 100}
CENTURY_LABEL = re.compile(r"^\s*([IVXLC]+)e\s+s\.")


@dataclass(frozen=True)
class Citation:
    text: str
    #: Author as printed by Littré (often abbreviated, e.g. "MOL."). "ID." is already resolved.
    author: str
    reference: str


@dataclass(frozen=True)
class Sense:
    number: str | None
    definition: str
    citations: tuple[Citation, ...]


@dataclass(frozen=True)
class HistoryItem:
    century: int
    citations: tuple[Citation, ...]


@dataclass(frozen=True)
class Entry:
    headword: str
    homograph: int
    nature: str
    senses: tuple[Sense, ...]
    etymology: str
    history: tuple[HistoryItem, ...] = field(default_factory=tuple)

    @property
    def earliest_century(self) -> int | None:
        """Century of the oldest dated attestation in the history section, if any."""
        return min((item.century for item in self.history), default=None)

    @property
    def citations(self) -> tuple[Citation, ...]:
        """Citations of the senses, in order: the candidates for a card's quote."""
        return tuple(c for sense in self.senses for c in sense.citations)


def roman_to_int(roman: str) -> int:
    total = 0
    for current, following in zip(roman, [*roman[1:], ""], strict=True):
        value = ROMAN[current]
        total += -value if following and ROMAN[following] > value else value
    return total


def _text(element: ET.Element, skip: tuple[str, ...] = ()) -> str:
    """Text content of an element, skipping some child tags, with whitespace normalized."""
    parts: list[str] = []

    def walk(node: ET.Element) -> None:
        if node.text:
            parts.append(node.text)
        for child in node:
            if child.tag not in skip:
                walk(child)
            if child.tail:
                parts.append(child.tail)

    walk(element)
    return re.sub(r"\s+", " ", "".join(parts)).strip()


def _citations(element: ET.Element, previous_author: list[str]) -> list[Citation]:
    """Direct and nested citations of an element. `previous_author` resolves Littré's "ID."."""
    found: list[Citation] = []
    for cit in element.iter("cit"):
        author = (cit.get("aut") or "").strip()
        if author.upper() in ("ID.", "ID"):
            author = previous_author[0]
        elif author:
            previous_author[0] = author
        found.append(
            Citation(text=_text(cit), author=author, reference=(cit.get("ref") or "").strip())
        )
    return found


def parse_entry(element: ET.Element) -> Entry:
    previous_author = [""]
    nature_el = element.find("entete/nature")
    senses: list[Sense] = []
    corps = element.find("corps")
    if corps is not None:
        for variante in corps.findall("variante"):
            senses.append(
                Sense(
                    number=variante.get("num"),
                    definition=_text(variante, skip=("cit", "indent", "rubrique")),
                    citations=tuple(_citations(variante, previous_author)),
                )
            )

    etymology = ""
    history: list[HistoryItem] = []
    for rubrique in element.findall("rubrique"):
        name = rubrique.get("nom", "")
        if name.startswith("ÉTYMOLOGIE"):
            etymology = _text(rubrique)
        elif name.startswith("HISTORIQUE"):
            for indent in rubrique.findall("indent"):
                match = CENTURY_LABEL.match(indent.text or "")
                if match:
                    history.append(
                        HistoryItem(
                            century=roman_to_int(match.group(1)),
                            citations=tuple(_citations(indent, previous_author)),
                        )
                    )

    return Entry(
        headword=element.get("terme", "").strip(),
        homograph=int(element.get("sens", "1")),
        nature=_text(nature_el) if nature_el is not None else "",
        senses=tuple(senses),
        etymology=etymology,
        history=tuple(history),
    )


def iter_entries(directory: Path = LITTRE_DIR) -> Iterator[Entry]:
    for path in sorted(directory.glob("[a-z].xml")):
        # ElementTree does not fetch the external DTD and expat limits entity expansion.
        for element in ET.parse(path).getroot().iter("entree"):
            if element.get("supplement") == "1":
                continue
            yield parse_entry(element)


@cache
def index(directory: Path = LITTRE_DIR) -> dict[str, tuple[Entry, ...]]:
    """Entries by lowercase headword (homographs grouped)."""
    grouped: dict[str, list[Entry]] = {}
    for entry in iter_entries(directory):
        grouped.setdefault(entry.headword.lower(), []).append(entry)
    return {word: tuple(entries) for word, entries in grouped.items()}


def render(entry: Entry, max_citations: int = 12) -> str:
    """Plain-text rendering given to the drafting model, with numbered citations."""
    lines = [f"MOT : {entry.headword}", f"NATURE : {entry.nature}", "", "DÉFINITIONS :"]
    for sense in entry.senses:
        prefix = f"{sense.number}° " if sense.number else "- "
        lines.append(prefix + sense.definition)
    lines += ["", "CITATIONS (choisir par numéro) :"]
    for number, citation in enumerate(entry.citations[:max_citations], start=1):
        lines.append(
            f"[{number}] « {citation.text} » — {citation.author or '?'}, {citation.reference}"
        )
    if entry.etymology:
        lines += ["", f"ÉTYMOLOGIE : {entry.etymology}"]
    if entry.earliest_century is not None:
        lines += ["", f"PREMIÈRE ATTESTATION DATÉE : {entry.earliest_century}e siècle"]
    return "\n".join(lines)
