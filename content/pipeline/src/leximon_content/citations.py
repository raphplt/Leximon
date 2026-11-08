"""Quotes from fr.wikisource for the cards the Littré leaves without one (D-058).

Three steps:
1. `citations-search`: for each card of the latest release without a quote, the sentences of the
   fr.wikisource pages that hold the word, with the page's author and edition year and the
   author's death year (Wikidata). Resumable: a card already searched is never searched again.
2. Claude Code agents pick at most one sentence per card, following `citations-agents.md`, into
   `data/citations/picks/*.json`.
3. `citations-apply`: checks every pick word for word against its page, and its rights, then
   writes the accepted ones to `data/citations/quotes.json`, which `release` reads.

Only the author's text leaves Wikisource: never its notes, headers or introductions.
"""

import html
import json
import re
import threading
import time
import unicodedata
from collections.abc import Iterable, Mapping, Sequence
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass
from html.parser import HTMLParser
from pathlib import Path
from typing import ClassVar
from urllib.parse import unquote

import httpx

from . import config, gravures

CITATIONS_DIR = config.DATA_DIR / "citations"
CANDIDATES_FILE = CITATIONS_DIR / "candidates.jsonl"
AUTHORS_FILE = CITATIONS_DIR / "authors.json"
PICKS_DIR = CITATIONS_DIR / "picks"
QUOTES_FILE = CITATIONS_DIR / "quotes.json"

API = "https://fr.wikisource.org/w/api.php"
WIKIDATA = "https://www.wikidata.org/w/api.php"
PAGE_URL = "https://fr.wikisource.org/wiki/"

#: Hits examined per word (quoted search first, then the stemmed one), and pages kept.
HITS_PER_WORD = 20
PAGES_PER_WORD = 10
SENTENCES_PER_PAGE = 3
MAX_SENTENCE = 400
MAX_QUOTE = 300
#: Parallel requests: Wikimedia asks bots to stay modest.
WORKERS = 4
#: A paragraph boundary: the page's own line breaks are only wrapping.
BLOCK = "\u2029"

#: An author dead in 1955 or before is in the public domain in France since 2026 at the latest.
LAST_DEATH_YEAR = 1955
#: Published in 1870 or before: even an anonymous or unknown author cannot have lived past 1955.
LAST_UNKNOWN_YEAR = 1870

#: Pages that list or define words instead of using them.
SKIP_TITLES = re.compile(
    r"Table|Index|Dictionnaire|Lexique|Glossaire|Vocabulaire|Sommaire|Errata|Thresor", re.I
)


#: Dictionaries come first for a common word and would fill every hit.
EXCLUDED_FROM_SEARCH = "-intitle:Dictionnaire -intitle:Lexique -intitle:Glossaire -intitle:Thresor"


@dataclass(frozen=True)
class Card:
    id: str
    word: str
    definition: str
    collection: str


def cards_without_quote(release_dir: Path) -> list[Card]:
    manifest = json.loads((release_dir / "manifest.json").read_text(encoding="utf-8"))
    cards = []
    for entry in manifest["collections"]:
        data = json.loads((release_dir / entry["file"]).read_text(encoding="utf-8"))
        cards += [
            Card(c["id"], c["word"], c["definition"], entry["id"])
            for c in data["cards"]
            if not c.get("quote")
        ]
    return cards


# --- Pure helpers ---------------------------------------------------------------------------------


def norm(text: str) -> str:
    """Spacing and apostrophes evened out, so that a copy is compared on its words alone."""
    text = unicodedata.normalize("NFC", text).replace("’", "'").replace("\u00a0", " ")
    return re.sub(r"\s+", " ", text).strip()


class _TextOnly(HTMLParser):
    """Visible text of a parsed page, without Wikisource's header, notes and page numbers."""

    VOID: ClassVar[set[str]] = {"br", "img", "hr", "input", "meta", "link", "wbr"}
    SKIP_TAGS: ClassVar[set[str]] = {"style", "script", "sup"}
    SKIP_CLASSES = ("ws-noexport", "headertemplate", "references", "mw-editsection", "pagenum")
    BLOCKS: ClassVar[set[str]] = {"p", "div", "li", "td", "h2", "h3"}

    def __init__(self) -> None:
        super().__init__()
        self.parts: list[str] = []
        self.skipping = 0
        self.stack: list[bool] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        if tag in self.VOID:
            return
        classes = dict(attrs).get("class") or ""
        skipped = tag in self.SKIP_TAGS or any(c in classes for c in self.SKIP_CLASSES)
        self.stack.append(skipped)
        self.skipping += skipped
        if tag in self.BLOCKS:
            self.parts.append(BLOCK)

    def handle_endtag(self, tag: str) -> None:
        if tag in self.VOID or not self.stack:
            return
        self.skipping -= self.stack.pop()

    def handle_data(self, data: str) -> None:
        if not self.skipping:
            self.parts.append(data.replace("\n", " "))


def page_text(page_html: str) -> str:
    parser = _TextOnly()
    parser.feed(page_html)
    return re.sub(r"[ \t\u00a0]+", " ", "".join(parser.parts))


def sentences_with(text: str, forms: Iterable[str]) -> list[str]:
    """The first sentences of the text that hold one of the forms as a whole word."""
    alternatives = "|".join(re.escape(f) for f in sorted(set(forms), key=len, reverse=True))
    pattern = re.compile(rf"(?<![\w-])({alternatives})(?![\w-])", re.I)
    found = []
    for paragraph in text.split(BLOCK):
        for sentence in re.split(r"(?<=[.!?…])\s+(?=[«A-ZÀ-Ý—])", paragraph.strip()):
            sentence = sentence.strip()
            if pattern.search(sentence) and 20 <= len(sentence) <= MAX_SENTENCE:
                found.append(sentence)
    return found[:SENTENCES_PER_PAGE]


def work_metadata(page_html: str) -> dict[str, str | None]:
    """Author and edition year from the page's hidden `ws-data` block (the header's microdata).
    `author_page` is the author's Wikisource page when the header links to one."""
    start = page_html.find('id="ws-data"')
    data = page_html[start : start + 4000] if start >= 0 else ""
    author_html = re.search(
        r'<span class="ws-author">(.*?)</span>(?=<span class="ws-|</div>)', data
    )
    linked = (
        re.search(r'href="/wiki/Auteur:([^"#?]+)"', author_html.group(1)) if author_html else None
    )
    author = None
    if author_html:
        author = html.unescape(re.sub(r"<[^>]+>", "", author_html.group(1))).strip() or None
    year = re.search(r'<span class="ws-year">\D*?(1[0-9]{3})', data)
    return {
        "author": author,
        "author_page": unquote(linked.group(1)).replace("_", " ") if linked else None,
        "year": year.group(1) if year else None,
    }


def matched_forms(snippet: str) -> set[str]:
    """The forms the search highlighted in a hit's snippet (plural, conjugated verb…)."""
    return {
        html.unescape(m) for m in re.findall(r'<span class="searchmatch">(.*?)</span>', snippet)
    }


def skipped_title(title: str) -> bool:
    """A table, an index or a dictionary: they list or define words instead of using them."""
    return bool(SKIP_TITLES.search(title))


def headword_article(title: str, word: str) -> bool:
    """An encyclopedia or treatise article on the word itself (« …/VERVEUX »): its first
    sentence defines the word, the next ones may use it."""
    last = title.rsplit("/", 1)[-1]
    return last == last.upper() and norm(last).upper().startswith(norm(word).upper())


def public_domain(page: Mapping[str, object]) -> bool:
    death, year = page.get("author_death"), page.get("year")
    return (isinstance(death, int) and death <= LAST_DEATH_YEAR) or (
        year is not None and int(str(year)) <= LAST_UNKNOWN_YEAR
    )


def _in_order(pieces: Sequence[str], sentence: str) -> bool:
    at = 0
    for piece in pieces:
        found = sentence.find(piece, at)
        if found < 0:
            return False
        at = found + len(piece)
    return True


def quote_page(text: str, pages: Sequence[Mapping[str, object]]) -> Mapping[str, object] | None:
    """The page whose sentence the quote copies: the whole sentence, or pieces of it in order
    joined by "....", without its final full stop."""
    pieces = [p.strip(" ,;:") for p in norm(text).split("....") if p.strip(" ,;:")]
    for page in pages:
        for sentence in page.get("sentences", []):  # type: ignore[union-attr]
            if _in_order(pieces, norm(str(sentence))):
                return page
    return None


def problems(word: str, text: str, pages: Sequence[Mapping[str, object]]) -> list[str]:
    """Why a picked quote cannot go on its card; empty when it can."""
    found = []
    page = quote_page(text, pages)
    if page is None:
        found.append("absente de la page")
    elif not public_domain(page):
        found.append(
            f"droits : auteur mort en {page.get('author_death')}, paru en {page.get('year')}"
        )
    if len(norm(text)) > MAX_QUOTE:
        found.append(f"{len(norm(text))} caractères")
    # A stem, so that a plural or a conjugated verb still counts.
    stem = norm(word).lower()
    if stem[: max(4, len(stem) - 2)] not in norm(text).lower():
        found.append("le mot n'y est pas")
    return found


# --- Search ---------------------------------------------------------------------------------------


class Wikisource:
    def __init__(self) -> None:
        self.http = httpx.Client(headers={"User-Agent": gravures.USER_AGENT}, timeout=60)
        self.deaths: dict[str, int | None] = (
            json.loads(AUTHORS_FILE.read_text(encoding="utf-8")) if AUTHORS_FILE.exists() else {}
        )
        self.lock = threading.Lock()

    def close(self) -> None:
        self.http.close()
        AUTHORS_FILE.parent.mkdir(parents=True, exist_ok=True)
        AUTHORS_FILE.write_text(json.dumps(self.deaths, ensure_ascii=False, indent=1), "utf-8")

    def api(self, url: str, **params: str) -> dict:
        for attempt in range(5):
            response = self.http.get(url, params={"format": "json", "formatversion": "2", **params})
            if response.status_code == 429 or response.status_code >= 500:
                time.sleep(5 * (attempt + 1))
                continue
            response.raise_for_status()
            return response.json()
        response.raise_for_status()
        return {}

    def search(self, query: str) -> list[dict]:
        found = self.api(
            API, action="query", list="search", srsearch=query, srnamespace="0", srlimit="20"
        )
        return found.get("query", {}).get("search", [])

    def page_html(self, title: str) -> str:
        parsed = self.api(API, action="parse", page=title, prop="text", disablelimitreport="1")
        return parsed.get("parse", {}).get("text", "")

    def death_year(self, author_page: str) -> int | None:
        with self.lock:
            if author_page in self.deaths:
                return self.deaths[author_page]
        pages = self.api(
            API,
            action="query",
            prop="pageprops",
            ppprop="wikibase_item",
            titles=f"Auteur:{author_page}",
        )
        item = (
            pages.get("query", {}).get("pages", [{}])[0].get("pageprops", {}).get("wikibase_item")
        )
        year = None
        if item:
            entity = self.api(WIKIDATA, action="wbgetentities", ids=item, props="claims")
            for claim in entity["entities"][item]["claims"].get("P570", []):
                value = claim.get("mainsnak", {}).get("datavalue", {}).get("value", {})
                match = re.match(r"[+-](\d{4})", value.get("time", ""))
                if match:
                    year = int(match.group(1))
                    break
        with self.lock:
            self.deaths[author_page] = year
        return year

    def pages_for(self, word: str) -> list[dict]:
        """Up to `PAGES_PER_WORD` pages that hold the word, the exact word first, then its other
        forms (plural, conjugated verb) found by the stemmed search."""
        hits: dict[str, dict] = {}
        for query in (f'"{word}"', word):
            for hit in self.search(f"{query} {EXCLUDED_FROM_SEARCH}"):
                hits.setdefault(hit["title"], hit)
        pages = []
        for title, hit in list(hits.items())[:HITS_PER_WORD]:
            if skipped_title(title):
                continue
            body = self.page_html(title)
            sentences = sentences_with(page_text(body), matched_forms(hit["snippet"]) | {word})
            if headword_article(title, word):
                sentences = sentences[1:]
            if not sentences:
                continue
            meta = work_metadata(body)
            death = self.death_year(meta["author_page"]) if meta["author_page"] else None
            pages.append(
                {
                    "title": title,
                    "url": PAGE_URL + title.replace(" ", "_"),
                    "author": meta["author"],
                    "year": meta["year"],
                    "author_death": death,
                    "sentences": sentences,
                }
            )
            if len(pages) >= PAGES_PER_WORD:
                break
        return pages


def _jsonl(path: Path) -> list[dict]:
    if not path.exists():
        return []
    return [json.loads(line) for line in path.read_text(encoding="utf-8").splitlines() if line]


def load_candidates() -> dict[str, dict]:
    return {row["id"]: row for row in _jsonl(CANDIDATES_FILE)}


def run_search(cards: Sequence[Card]) -> None:
    done = load_candidates()
    todo = [c for c in cards if c.id not in done]
    print(f"citations : {len(todo)} cartes à chercher, {len(done)} déjà faites", flush=True)
    CANDIDATES_FILE.parent.mkdir(parents=True, exist_ok=True)
    wiki = Wikisource()
    write = threading.Lock()
    started = time.monotonic()
    count = 0

    def one(card: Card) -> None:
        nonlocal count
        pages = wiki.pages_for(card.word)
        row = {
            "id": card.id,
            "word": card.word,
            "definition": card.definition,
            "collection": card.collection,
            "candidates": pages,
        }
        with write:
            with CANDIDATES_FILE.open("a", encoding="utf-8") as f:
                f.write(json.dumps(row, ensure_ascii=False) + "\n")
            count += 1
            left = (time.monotonic() - started) / count * (len(todo) - count)
            print(
                f"[{count}/{len(todo)}] {card.word} : {len(pages)} pages, "
                f"{sum(public_domain(p) for p in pages)} libres · reste environ {left / 60:.0f} min",
                flush=True,
            )

    try:
        with ThreadPoolExecutor(WORKERS) as pool:
            for future in [pool.submit(one, card) for card in todo]:
                future.result()
    finally:
        wiki.close()


# --- Apply ----------------------------------------------------------------------------------------


def load_picks(directory: Path = PICKS_DIR) -> dict[str, dict]:
    picks: dict[str, dict] = {}
    for path in sorted(directory.glob("*.json")):
        picks.update(json.loads(path.read_text(encoding="utf-8")))
    return picks


def accepted_quotes(
    picks: Mapping[str, Mapping[str, object]], candidates: Mapping[str, Mapping[str, object]]
) -> tuple[dict[str, dict[str, str]], list[str]]:
    """The catalogue quote of each pick that passes the checks, and why the others do not."""
    quotes: dict[str, dict[str, str]] = {}
    refused = []
    for card_id, pick in sorted(picks.items()):
        text, author = pick.get("quote_text"), pick.get("quote_author")
        if not text:
            continue
        card = candidates.get(card_id)
        if card is None:
            refused.append(f"{card_id} : carte inconnue")
            continue
        pages = card["candidates"]  # type: ignore[assignment]
        found = problems(str(card["word"]), str(text), pages)  # type: ignore[arg-type]
        if not author:
            found.append("pas d'auteur")
        if found:
            refused.append(f"{card['word']} : {', '.join(found)} · {text}")
            continue
        page = quote_page(str(text), pages)  # type: ignore[arg-type]
        quotes[card_id] = {
            "text": str(text).strip(),
            "author": str(author).strip(),
            "source": str(page["url"]) if page else "",
        }
    return quotes, refused


def run_apply() -> None:
    quotes, refused = accepted_quotes(load_picks(), load_candidates())
    QUOTES_FILE.parent.mkdir(parents=True, exist_ok=True)
    QUOTES_FILE.write_text(json.dumps(quotes, ensure_ascii=False, indent=1) + "\n", "utf-8")
    for line in refused:
        print(f"refusée · {line}")
    print(f"{len(quotes)} citations gardées, {len(refused)} refusées, dans {QUOTES_FILE}")


def load_quotes(path: Path = QUOTES_FILE) -> dict[str, dict[str, str]]:
    """The catalogue quote {"text", "author"} of each card that took one from Wikisource."""
    if not path.exists():
        return {}
    data = json.loads(path.read_text(encoding="utf-8"))
    return {card: {"text": q["text"], "author": q["author"]} for card, q in data.items()}
