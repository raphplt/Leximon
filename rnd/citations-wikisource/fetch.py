"""Quote candidates from fr.wikisource for cards without a Littré quote (spike, throwaway).

For each card: full-text search of the word in the main namespace, then the sentences of each
page that hold one of the matched forms, with the work's author, the author's death year
(Wikidata) and the edition year when the page gives it.

    uv run --project content/pipeline python rnd/citations-wikisource/fetch.py <cards.json> <out.json>
    uv run --project content/pipeline python rnd/citations-wikisource/fetch.py --metadata <out.json>

cards.json: [{"id", "word", "definition"}, …]
"""

import html
import json
import re
import sys
import time
from html.parser import HTMLParser

import httpx
from urllib.parse import unquote

API = "https://fr.wikisource.org/w/api.php"
WIKIDATA = "https://www.wikidata.org/w/api.php"
USER_AGENT = "LeximonContentPipeline/0.1 (https://leximon.fr; contact@leximon.fr)"
SKIP_TITLES = re.compile(
    r"Table|Index|Dictionnaire|Lexique|Glossaire|Vocabulaire|Sommaire|Errata", re.I
)
HITS_PER_WORD = 6
SENTENCES_PER_PAGE = 3
MAX_SENTENCE = 400
BLOCK = "\u2029"  # paragraph boundary: the page's own line breaks are only wrapping

http = httpx.Client(headers={"User-Agent": USER_AGENT}, timeout=60)


def api(url: str, **params: str) -> dict:
    for attempt in range(4):
        response = http.get(url, params={"format": "json", "formatversion": "2", **params})
        if response.status_code == 429 or response.status_code >= 500:
            time.sleep(5 * (attempt + 1))
            continue
        response.raise_for_status()
        time.sleep(0.15)
        return response.json()
    response.raise_for_status()
    return {}


class TextOnly(HTMLParser):
    """Visible text of a parsed page, without the header, notes and edit links."""

    SKIP = {"style", "script", "sup"}
    SKIP_CLASSES = ("ws-noexport", "headertemplate", "references", "mw-editsection", "pagenum")

    def __init__(self) -> None:
        super().__init__()
        self.parts: list[str] = []
        self.depth = 0
        self.stack: list[bool] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        if tag in ("br", "img", "hr", "input", "meta", "link", "wbr"):
            return
        classes = dict(attrs).get("class") or ""
        skipped = tag in self.SKIP or any(c in classes for c in self.SKIP_CLASSES)
        self.stack.append(skipped)
        self.depth += skipped
        if tag in ("p", "div", "li", "td", "h2", "h3"):
            self.parts.append(BLOCK)

    def handle_endtag(self, tag: str) -> None:
        if tag in ("br", "img", "hr", "input", "meta", "link", "wbr") or not self.stack:
            return
        self.depth -= self.stack.pop()

    def handle_data(self, data: str) -> None:
        if not self.depth:
            self.parts.append(data.replace("\n", " "))


def page_text(page: str) -> str:
    parser = TextOnly()
    parser.feed(page)
    return re.sub(r"[ \t ]+", " ", "".join(parser.parts))


def sentences_with(text: str, forms: set[str]) -> list[str]:
    pattern = re.compile(
        r"(?<![\w-])(" + "|".join(re.escape(f) for f in forms) + r")(?![\w-])", re.I
    )
    found = []
    for paragraph in text.split(BLOCK):
        for sentence in re.split(r"(?<=[.!?…])\s+(?=[«A-ZÀ-Ý—])", paragraph.strip()):
            if pattern.search(sentence) and 20 <= len(sentence) <= MAX_SENTENCE:
                found.append(sentence.strip())
    return found[:SENTENCES_PER_PAGE]


def page_html(title: str) -> str:
    return api(API, action="parse", page=title, prop="text", disablelimitreport="1").get("parse", {}).get("text", "")


def work_metadata(page: str) -> dict[str, str | None]:
    """Author and year from the page's hidden `ws-data` block (the header's microdata)."""
    data = page[page.find('id="ws-data"') :][:4000]
    author_html = re.search(r'<span class="ws-author">(.*?)</span>(?=<span class="ws-)', data)
    linked = re.search(r'href="/wiki/Auteur:([^"#?]+)"', author_html.group(1)) if author_html else None
    if linked:
        author = unquote(linked.group(1)).replace("_", " ")
    elif author_html:
        author = html.unescape(re.sub(r"<[^>]+>", "", author_html.group(1))).strip() or None
    else:
        author = None
    year = re.search(r'<span class="ws-year">\D*?(1[0-9]{3})', data)
    return {"author": author, "year": year.group(1) if year else None}


death_cache: dict[str, int | None] = {}


def death_year(author: str) -> int | None:
    if author in death_cache:
        return death_cache[author]
    pages = api(API, action="query", prop="pageprops", ppprop="wikibase_item", titles=f"Auteur:{author}")
    item = pages.get("query", {}).get("pages", [{}])[0].get("pageprops", {}).get("wikibase_item")
    year = None
    if item:
        claims = api(WIKIDATA, action="wbgetentities", ids=item, props="claims")["entities"][item]["claims"]
        for claim in claims.get("P570", []):
            value = claim.get("mainsnak", {}).get("datavalue", {}).get("value", {})
            match = re.match(r"[+-](\d{4})", value.get("time", ""))
            if match:
                year = int(match.group(1))
                break
    death_cache[author] = year
    return year


def candidates(word: str) -> list[dict]:
    hits = api(API, action="query", list="search", srsearch=f'"{word}"', srnamespace="0", srlimit="20")
    found = []
    for hit in hits.get("query", {}).get("search", []):
        if SKIP_TITLES.search(hit["title"]):
            continue
        forms = {html.unescape(m) for m in re.findall(r'<span class="searchmatch">(.*?)</span>', hit["snippet"])}
        forms |= {word}
        page = page_html(hit["title"])
        sentences = sentences_with(page_text(page), forms)
        if not sentences:
            continue
        meta = work_metadata(page)
        found.append(
            {
                "title": hit["title"],
                "url": "https://fr.wikisource.org/wiki/" + hit["title"].replace(" ", "_"),
                **meta,
                "author_death": death_year(meta["author"]) if meta["author"] else None,
                "sentences": sentences,
            }
        )
        if len(found) >= HITS_PER_WORD:
            break
    return found


def refresh_metadata(path: str) -> None:
    """Recomputes author, year and death of the pages already found, without searching again."""
    cards = json.loads(open(path, encoding="utf-8").read())
    for card in cards:
        for found in card["candidates"]:
            meta = work_metadata(page_html(found["title"]))
            found.update(meta)
            found["author_death"] = death_year(meta["author"]) if meta["author"] else None
        print(card["word"], [(f["author"], f["author_death"], f["year"]) for f in card["candidates"]], flush=True)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(cards, f, ensure_ascii=False, indent=1)


def main() -> None:
    if sys.argv[1] == "--metadata":
        refresh_metadata(sys.argv[2])
        return
    cards = json.loads(open(sys.argv[1], encoding="utf-8").read())
    out: list[dict] = []
    for index, card in enumerate(cards, start=1):
        found = candidates(card["word"])
        out.append({**card, "candidates": found})
        print(f"[{index}/{len(cards)}] {card['word']} : {len(found)} pages", flush=True)
        with open(sys.argv[2], "w", encoding="utf-8") as f:
            json.dump(out, f, ensure_ascii=False, indent=1)


if __name__ == "__main__":
    main()
