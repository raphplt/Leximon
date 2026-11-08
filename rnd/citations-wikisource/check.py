"""Mechanical checks of the quotes picked by the agents (spike, throwaway).

Each kept quote must be the source sentence, or pieces of it in order joined by "....", word for
word; its author must have died before 1956 (or the text be
older than 1871); the word must be in it; 300 characters at most.

    python3 rnd/citations-wikisource/check.py rnd/citations-wikisource/candidates.json rnd/citations-wikisource/picks.json
"""

import json
import re
import sys
import unicodedata

MAX_CHARS = 300
LAST_DEATH_YEAR = 1955
LAST_UNKNOWN_YEAR = 1870


def norm(text: str) -> str:
    text = unicodedata.normalize("NFC", text).replace("’", "'").replace(" ", " ")
    return re.sub(r"\s+", " ", text).strip()


def public_domain(page: dict) -> bool:
    """Author dead before 1956, or published before 1871: even an unknown or anonymous author of
    such a text cannot have lived past 1955."""
    death, year = page.get("author_death"), page.get("year")
    return (death is not None and death <= LAST_DEATH_YEAR) or (
        year is not None and int(year) <= LAST_UNKNOWN_YEAR
    )


def in_order(pieces: list[str], sentence: str) -> bool:
    at = 0
    for piece in pieces:
        found = sentence.find(piece, at)
        if found < 0:
            return False
        at = found + len(piece)
    return True


def main() -> None:
    candidates = {c["id"]: c for c in json.load(open(sys.argv[1], encoding="utf-8"))}
    picks = json.load(open(sys.argv[2], encoding="utf-8"))
    kept = failed = 0
    for card_id, pick in picks.items():
        if not pick.get("quote_text"):
            continue
        card = candidates[card_id]
        sources = [
            (page, norm(s)) for page in card["candidates"] for s in page["sentences"]
        ]
        text = norm(pick["quote_text"])
        pieces = [norm(p).strip(" ,;:") for p in text.split("....") if norm(p).strip(" ,;:")]
        page = next((p for p, s in sources if in_order(pieces, s)), None)
        problems = []
        if page is None:
            problems.append("absente de la page")
        elif not public_domain(page):
            problems.append(f"droits : mort {page.get('author_death')}, publié {page.get('year')}")
        if len(text) > MAX_CHARS:
            problems.append(f"{len(text)} caractères")
        # A stem, so that a plural or a conjugated verb still counts.
        word = norm(card["word"]).lower()
        if word[: max(4, len(word) - 2)] not in text.lower():
            problems.append("mot absent")
        if problems:
            failed += 1
            print(f"✗ {card['word']} : {', '.join(problems)} · {text}")
        else:
            kept += 1
    print(f"{kept} citations conformes, {failed} refusées")


if __name__ == "__main__":
    main()
