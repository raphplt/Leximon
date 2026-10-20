"""Engraving candidates for every card of a catalogue release (docs/rnd/gravures.md).

Three steps, each resumable (a card already done is never redone, nor paid for twice):

1. queries: Haiku writes 4 to 6 short Wikimedia Commons queries from the word and its definition;
2. search: Commons, one request at a time, with a strict rights filter (licence, Gallica and
   British Museum copies, author dead before 1956), then up to 8 thumbnails per card;
3. pick: Sonnet looks at the thumbnails through the Message Batches API and picks the one that
   illustrates the word, or none.

Everything lives in data/gravures/ (git-ignored). Rejected Commons files are kept with their
reason, for auditing. Nothing here processes images: the human validation comes next."""

import asyncio
import base64
import hashlib
import html
import json
import re
import time
import unicodedata
from collections import Counter
from collections.abc import Callable, Iterable, Sequence
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass
from datetime import UTC, datetime
from pathlib import Path

import anthropic
import httpx

from . import llm
from .config import DATA_DIR

GRAVURES_DIR = DATA_DIR / "gravures"
QUERIES_FILE = GRAVURES_DIR / "queries.jsonl"
SEARCH_FILE = GRAVURES_DIR / "search.jsonl"
AUTHORS_FILE = GRAVURES_DIR / "authors.json"
BATCHES_FILE = GRAVURES_DIR / "batches.jsonl"
PICKS_FILE = GRAVURES_DIR / "picks.jsonl"
THUMBS_DIR = GRAVURES_DIR / "thumbs"

#: Generic on purpose: never any personal data (name, email, account) in a request.
USER_AGENT = "LeximonContentPipeline/0.1 (non-commercial research crawler)"
COMMONS_API = "https://commons.wikimedia.org/w/api.php"
WIKIDATA_API = "https://www.wikidata.org/w/api.php"
#: Seconds between two API requests (Commons and Wikidata together): one at a time, ~1 per second.
API_PAUSE_S = 1.0
MAX_API_PAUSE_S = 5.0
#: Commons serves thumbnails at standard widths only (250, 330, 500…). 330 px is the size the
#: vision measurement used, and keeps the pick step well inside its budget.
THUMB_WIDTH = 330
#: Thumbnail downloads in flight (Commons asks for at most 2 per client).
THUMB_WORKERS = 2
MAX_RETRIES = 6
#: Cards in a row the API refuses before the run stops (it resumes on the next launch).
MAX_CARD_FAILURES = 3
PER_QUERY = 10
MAX_CANDIDATES = 8
MIN_QUERIES, MAX_QUERIES = 4, 6
#: Author lookups by name on Wikidata per card, to bound the search time.
MAX_NAME_LOOKUPS = 6

QUERY_MODEL = "claude-haiku-5-5"
PICK_MODEL = "claude-sonnet-5-5"
PICK_EFFORT: llm.Effort = "medium"
#: The Message Batches API costs half the price of llm.PRICES.
BATCH_DISCOUNT = 0.5
#: Owner's cap for this whole step (queries and pick), whatever --yes says.
STEP_BUDGET_USD = 9.0
#: Estimates before a first measurement (vision measurement, R&D §6; Haiku query trial).
ESTIMATED_QUERY_USD = 0.0003
PICK_TEXT_TOKENS = 1300
PICK_OUTPUT_TOKENS = 400
#: Batches stay far below the API limits (100 000 requests, 256 MB).
MAX_BATCH_CARDS = 200
MAX_BATCH_BYTES = 100_000_000
POLL_SECONDS = 30

#: French copyright: the author died more than 70 years ago, so before 1 January 1956 in 2026.
DEATH_LIMIT = 1956
#: A work dated after this year with an unknown author may still be protected.
UNKNOWN_AUTHOR_LIMIT = 1930
#: A named author whose death is not found, on a work dated after this year, may have died
#: after 1955 (J. F. Horrabin, 1962, on a 1920 plate).
UNRESOLVED_AUTHOR_LIMIT = 1900
#: Works dated up to this year need no author lookup: their author cannot have died after 1955.
OLD_WORK_LIMIT = 1880


# --- Cards ---------------------------------------------------------------------------------------


@dataclass(frozen=True)
class Card:
    id: str
    word: str
    definition: str
    collection: str
    rarity: str


def load_cards(release_dir: Path) -> list[Card]:
    manifest = json.loads((release_dir / "manifest.json").read_text(encoding="utf-8"))
    cards = []
    for entry in manifest["collections"]:
        data = json.loads((release_dir / entry["file"]).read_text(encoding="utf-8"))
        cards += [
            Card(c["id"], c["word"], c["definition"], entry["id"], c["rarity"])
            for c in data["cards"]
        ]
    return cards


def select_cards(cards: Sequence[Card], ids: Sequence[str] | None, limit: int | None) -> list[Card]:
    """The cards named by `ids` (in that order), or all of them; then the first `limit`."""
    if ids:
        by_id = {c.id: c for c in cards}
        unknown = [i for i in ids if i not in by_id]
        if unknown:
            raise SystemExit(f"Cartes inconnues dans cette version : {', '.join(unknown)}")
        cards = [by_id[i] for i in ids]
    return list(cards[:limit] if limit is not None else cards)


def _jsonl(path: Path) -> list[dict]:
    if not path.exists():
        return []
    return [json.loads(line) for line in path.read_text(encoding="utf-8").splitlines() if line]


def _append(path: Path, row: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("a", encoding="utf-8") as file:
        file.write(json.dumps(row, ensure_ascii=False) + "\n")


def _latest_by_card(path: Path, ok: Callable[[dict], bool]) -> dict[str, dict]:
    """The latest successful row of each card (a later run retries the failed ones)."""
    return {row["card"]: row for row in _jsonl(path) if ok(row)}


def load_queries() -> dict[str, dict]:
    return _latest_by_card(QUERIES_FILE, lambda r: not r.get("error"))


def load_searches() -> dict[str, dict]:
    return _latest_by_card(SEARCH_FILE, lambda r: True)


def load_picks() -> dict[str, dict]:
    return _latest_by_card(PICKS_FILE, lambda r: not r.get("error"))


def spent(path: Path) -> float:
    return sum(float(row.get("cost_usd", 0.0)) for row in _jsonl(path))


def check_budget(what: str, estimate: float) -> None:
    """Stops when the step would go over the owner's cap, --yes or not."""
    already = spent(QUERIES_FILE) + spent(PICKS_FILE)
    print(f"déjà dépensé pour les gravures : {already:.3f} $ (plafond {STEP_BUDGET_USD:.0f} $)")
    if already + estimate > STEP_BUDGET_USD:
        raise SystemExit(
            f"{what} : {already:.2f} $ + {estimate:.2f} $ dépasserait le plafond de "
            f"{STEP_BUDGET_USD:.0f} $. Arrêt."
        )


# --- 1. Queries ----------------------------------------------------------------------------------

QUERY_SYSTEM = """Tu prépares la recherche d'une image ancienne pour illustrer une carte de Leximon, un jeu de cartes sur les mots rares et anciens du français. Chaque carte porte une petite gravure du domaine public. On te donne le mot et sa définition.

Écris de 4 à 6 requêtes courtes pour le moteur de recherche de Wikimedia Commons, qui ne renvoie que les fichiers contenant tous les termes de la requête :
- de 2 à 4 mots chacune, en anglais pour la plupart, en français pour une ou deux ;
- sur le sujet concret à montrer : l'objet, l'outil, le vêtement, l'animal, la plante, le métier, le geste ou la scène que le mot désigne. Ne cherche pas le mot rare lui-même, sauf s'il désigne un nom propre ou un sujet connu (Lilliput, charivari) ;
- chacune avec un terme d'estampe : engraving, gravure, plate, illustration, lithograph, lithographie, etching, woodcut ou caricature ;
- pour un animal ou une plante, une requête avec le nom latin du genre ou de l'espèce suivi de « plate » (« Casuarius plate », « Pagurus bernhardus plate ») ;
- pour un mot abstrait (caractère, défaut, travers, sentiment, manière d'être), des scènes ou des caricatures qui montrent le trait : « miser caricature », « avare gravure », « dandy caricature », « sleepwalker engraving ».

Varie les angles : synonymes, objet et métier qui l'emploie, nom anglais et nom français. Dis aussi si le mot désigne quelque chose de concret (concrete), plutôt qu'une idée ou un trait de caractère."""

QUERY_SCHEMA: dict[str, object] = {
    "type": "object",
    "properties": {
        "concrete": {"type": "boolean"},
        "queries": {"type": "array", "items": {"type": "string"}},
    },
    "required": ["concrete", "queries"],
    "additionalProperties": False,
}

PLATE_TERMS = re.compile(
    r"\b(engravings?|gravures?|plates?|planches?|illustrations?|lithograph(s|ie|ies|y)?"
    r"|etchings?|woodcuts?|caricatures?|estampes?|prints?)\b",
    re.IGNORECASE,
)


def normalize_queries(raw: Iterable[object]) -> list[str]:
    """Trimmed, de-duplicated, at most six, and each with a print-making term: a plain query
    brings back modern photos (R&D §3)."""
    queries: list[str] = []
    seen: set[str] = set()
    for item in raw:
        query = " ".join(str(item).replace('"', " ").split())
        if not query:
            continue
        if not PLATE_TERMS.search(query):
            query += " engraving"
        if query.lower() not in seen:
            seen.add(query.lower())
            queries.append(query)
    return queries[:MAX_QUERIES]


def query_prompt(card: Card) -> str:
    return f"Mot : {card.word}\nDéfinition : {card.definition}"


async def write_queries(api: anthropic.AsyncAnthropic, card: Card) -> dict[str, object]:
    answer = await llm.ask_json(
        api, QUERY_MODEL, QUERY_SYSTEM, query_prompt(card), QUERY_SCHEMA, "low", max_tokens=2000
    )
    data = answer.data or {}
    queries = normalize_queries(data.get("queries") or [])  # type: ignore[arg-type]
    error = answer.error
    if error is None and len(queries) < MIN_QUERIES - 1:
        error = f"too few queries: {data.get('queries')!r}"
    return {
        "card": card.id,
        "word": card.word,
        "model": QUERY_MODEL,
        "concrete": data.get("concrete"),
        "queries": queries,
        "error": error,
        "usage": answer.usage,
        "cost_usd": round(answer.cost_usd, 7),
    }


async def run_queries(cards: Sequence[Card], yes: bool, concurrency: int = 8) -> None:
    from .curation import confirm_spend  # the shared --yes rule

    done = load_queries()
    todo = [c for c in cards if c.id not in done]
    if not todo:
        print("requêtes : déjà faites")
        return
    measured = [float(r["cost_usd"]) for r in done.values()]
    per_card = sum(measured) / len(measured) if measured else ESTIMATED_QUERY_USD
    estimate = per_card * len(todo)
    check_budget("requêtes", estimate)
    confirm_spend(f"requêtes de {len(todo)} cartes ({QUERY_MODEL})", estimate, yes)
    errors = 0

    def keep(row: dict[str, object]) -> None:
        nonlocal errors
        _append(QUERIES_FILE, row)
        errors += bool(row["error"])

    async with llm.client() as api:
        await llm.for_each(todo, lambda c: write_queries(api, c), keep, concurrency)
    total = sum(float(r["cost_usd"]) for r in _jsonl(QUERIES_FILE))
    print(f"requêtes : {len(todo) - errors} cartes, {errors} erreurs, {total:.4f} $ au total")


# --- 2. Rights filter (pure) ---------------------------------------------------------------------

FREE_LICENCES = (
    "public domain",
    "cc0",
    "pdm",
    "no restrictions",
    "no known copyright restrictions",
)
FREE_CODES = frozenset({"pd", "cc0", "pdm"})
RESTRICTED_TOKENS = frozenset({"sa", "nc", "nd"})
GALLICA = re.compile(
    r"gallica|btv1b|ark:/12148|\bbnf\b|biblioth[eè]que nationale de france", re.IGNORECASE
)
BRITISH_MUSEUM = re.compile(r"british ?museum|\(BM\b", re.IGNORECASE)
#: British Museum registration number in a file name: "BM Heal,60.11", "BM 1851,0901.12".
BM_NUMBER = re.compile(r"(^|[\s(_])BM[\s_]+[A-Za-z]*,?\s?[0-9]{1,4}[,.][0-9]")
ENCCRE = re.compile(r"enccre|mazarine", re.IGNORECASE)
UNKNOWN_AUTHOR = re.compile(
    r"^\W*$|^(unknown|anonym|anonyme|inconnu|auteur inconnu|unbekannt|onbekend|unidentified"
    r"|not provided|n/a|\{\{)",
    re.IGNORECASE,
)
YEAR = r"(1[0-9]{3}|20[0-9]{2})"


def strip_html(value: str) -> str:
    return " ".join(html.unescape(re.sub(r"<[^>]+>", " ", value)).split())


def licence_reason(short_name: str, code: str, usage_terms: str) -> str | None:
    """Why the licence is refused, or None. Only PD, CC0, PDM, "No restrictions" and CC BY 4.0
    pass: SA would bind the reworked image, NC and ND forbid the game's use."""
    combined = " ".join([short_name, code, usage_terms]).lower()
    tokens = set(re.split(r"[^a-z0-9]+", combined))
    if tokens & RESTRICTED_TOKENS or "sharealike" in combined or "share alike" in combined:
        return f"licence {short_name or code!r}"
    if "noncommercial" in combined or "non-commercial" in combined or "noderiv" in combined:
        return f"licence {short_name or code!r}"
    short = short_name.lower().replace("-", " ").strip()
    if any(tag in short for tag in FREE_LICENCES) or code.lower() in FREE_CODES:
        return None
    if short == "cc by 4.0" or code.lower() == "cc-by-4.0":
        return None
    return f"licence {short_name or code or 'inconnue'!r}"


def banned_source(fields: Sequence[str], title: str) -> str | None:
    """Gallica / BnF copies (paid reuse), British Museum photos (NC-SA), ENCCRE (NC-ND)."""
    haystack = " ".join(fields)
    if GALLICA.search(haystack):
        return "gallica-bnf"
    name = title.removeprefix("File:")
    if (
        BRITISH_MUSEUM.search(haystack)
        or "britishmuseum" in haystack.lower()
        or name.startswith(("BM ", "BM_"))
        or BM_NUMBER.search(name)
    ):
        return "british-museum"
    if ENCCRE.search(haystack):
        return "enccre-mazarine"
    return None


def artist_dates_text(raw_html: str) -> str:
    """The artist field as text, plus the `title` attributes Commons hides the dates in
    ("Australian author, artist and ornithologist (1886–1950)"); links dropped."""
    titles = re.findall(r'title="([^"]*)"', raw_html)
    titles = [t for t in titles if not t.startswith(("w:", "wikipedia:", "d:", "Q"))]
    return " ".join([strip_html(raw_html), *(html.unescape(t) for t in titles)])


def death_year(text: str) -> int | None:
    """The latest death year written in an artist text, or None. Several people (engraver and
    designer) give the latest death: the stricter one."""
    deaths: list[int] = []
    for match in re.finditer(
        rf"(\bfl\.?\s*|\bactive\s*)?\b{YEAR}\b[^()\d]{{0,30}}?[–—\u2010-][^()\d]{{0,30}}?\b{YEAR}\b",
        text,
        re.IGNORECASE,
    ):
        floruit, born, died = match.group(1), int(match.group(2)), int(match.group(3))
        if died < born or died - born > 110:
            continue
        # A floruit only says when the artist worked: allow 40 more years of life.
        deaths.append(died + 40 if floruit else died)
    for match in re.finditer(
        rf"(?:\bdied|\bd\.|†|\bmort(?:e)? en|\bdécédée? en|\bgestorben)\s*(?:in\s*)?{YEAR}\b",
        text,
        re.IGNORECASE,
    ):
        deaths.append(int(match.group(1)))
    return max(deaths, default=None)


def author_name(text: str) -> str | None:
    """The first name in an artist text, for a Wikidata lookup; None when unknown."""
    name = re.split(r"[(\[;,/]|\bafter\b|\bd'après\b|\bdesigned\b|\bengraved\b", text)[0].strip()
    if UNKNOWN_AUTHOR.search(name) or re.search(r"\d", name) or len(name.split()) > 6:
        return None
    return name[:80] or None


#: An institution or a scan credit in the artist field: no person to look up on Wikidata.
INSTITUTION = re.compile(
    r"archive|museum|library|librar|collection|\bscan\b|nypl|department|records|company|firm"
    r"|images|rijksmuseum|éditeur|editeur|staff|society|\bco\b|\binc\b",
    re.IGNORECASE,
)


def lookup_name(text: str) -> str | None:
    """The person to look up on Wikidata: "Last, First" turned around, institutions left out."""
    name = author_name(text)
    if name is None or INSTITUTION.search(text.split("(")[0]):
        return None
    parts = [p.strip() for p in re.split(r"[(\[;/]", text)[0].split(",")]
    if (
        len(parts) >= 2
        and len(parts[0].split()) == 1
        and 1 <= len(parts[1].split()) <= 3
        and not re.search(r"\d", parts[1])
    ):
        return f"{parts[1]} {parts[0]}"
    return name


def is_unknown_author(hit: dict) -> bool:
    return author_name(hit.get("artist", "")) is None and death_year(_dates(hit)) is None


def _dates(hit: dict) -> str:
    return hit.get("artist_dates") or hit.get("artist", "")


def work_year(date_text: str) -> int | None:
    match = re.search(rf"\b{YEAR}\b", date_text)
    return int(match.group(1)) if match else None


def rights_reason(hit: dict, death: int | None) -> tuple[str, str] | None:
    """(reason code, detail) when the file cannot be used, else None. `death` is the author's
    latest known death year, from the artist text or Wikidata."""
    if death is not None and death >= DEATH_LIMIT:
        return "author-died-after-1955", f"auteur mort en {death}"
    year = work_year(hit.get("date", ""))
    if death is None and year is not None:
        if is_unknown_author(hit):
            if year > UNKNOWN_AUTHOR_LIMIT:
                return "unknown-author-after-1930", f"daté {year}, auteur inconnu"
        elif year > UNRESOLVED_AUTHOR_LIMIT:
            return "author-death-unknown", f"daté {year}, date de mort de l'auteur introuvable"
    return None


def quick_reason(hit: dict) -> tuple[str, str] | None:
    """The checks that need no further request: thumbnail, licence, source."""
    if not hit.get("thumb_url"):
        return "no-thumbnail", "pas de vignette"
    reason = licence_reason(hit["licence"], hit["licence_code"], hit["usage_terms"])
    if reason:
        return "licence", reason
    fields = [
        hit["title"],
        hit["description"],
        hit["credit"],
        hit["artist"],
        hit["object_name"],
        *hit["categories"],
    ]
    source = banned_source(fields, hit["title"])
    if source:
        return source, f"source {source}"
    return None


def interleave(per_query: Sequence[Sequence[dict]]) -> list[dict]:
    """Rank 1 of each query, then rank 2…, each file once: every angle gets its chance."""
    seen: set[str] = set()
    ordered = []
    for rank in range(max((len(h) for h in per_query), default=0)):
        for hits in per_query:
            if rank < len(hits) and hits[rank]["title"] not in seen:
                seen.add(hits[rank]["title"])
                ordered.append(hits[rank])
    return ordered


def credit_line(hit: dict) -> str:
    """« Honoré Daumier, 1833 · Public domain · Wikimedia Commons » (the author is named
    whenever known: French moral right; required for CC BY)."""
    author = author_name(hit["artist"]) or ("auteur inconnu" if not hit["artist"] else None)
    who = author or hit["artist"][:80]
    year = work_year(hit.get("date", ""))
    line = f"{who}{f', {year}' if year else ''} · {hit['licence']} · Wikimedia Commons"
    if "by" in hit["licence"].lower().split() and hit.get("credit"):
        # CC BY: the credit the licensor asks for (Wellcome Collection…) is part of the licence.
        line += f" · {hit['credit'][:120]}"
    return line


# --- 2. Search (I/O) -----------------------------------------------------------------------------


class WikimediaUnavailable(RuntimeError):
    """The API kept refusing (429, maxlag, network): the card is retried on the next run."""


class Wikimedia:
    """One API request at a time, at most one per second, honouring maxlag and Retry-After."""

    def __init__(self) -> None:
        self.http = httpx.Client(
            headers={"User-Agent": USER_AGENT}, timeout=60, follow_redirects=True
        )
        self.last = 0.0
        #: Grows after each 429: Commons is telling us to slow down for good, not just once.
        self.pause = API_PAUSE_S
        self.requests: Counter[str] = Counter()
        self.authors: dict[str, dict] = (
            json.loads(AUTHORS_FILE.read_text(encoding="utf-8")) if AUTHORS_FILE.exists() else {}
        )

    def close(self) -> None:
        self.http.close()
        AUTHORS_FILE.parent.mkdir(parents=True, exist_ok=True)
        AUTHORS_FILE.write_text(json.dumps(self.authors, ensure_ascii=False), encoding="utf-8")

    def api(self, url: str, params: dict[str, str]) -> dict:
        params = {"format": "json", "formatversion": "2", **params}
        if url == COMMONS_API:
            # Wikidata's maxlag counts its query service lag, which only matters to bots that
            # edit: there it would refuse every read for hours. Reads stay paced instead.
            params["maxlag"] = "5"
        for attempt in range(MAX_RETRIES):
            wait = self.last + self.pause - time.monotonic()
            if wait > 0:
                time.sleep(wait)
            self.last = time.monotonic()
            host = httpx.URL(url).host
            self.requests[host] += 1
            try:
                response = self.http.get(url, params=params)
            except httpx.TransportError as error:
                print(f"  réseau : {error!r}, nouvel essai", flush=True)
                time.sleep(10 * (attempt + 1))
                continue
            if response.status_code in (429, 503):
                pause = _retry_after(response, 10 * (attempt + 1))
                self.pause = min(self.pause * 1.5, MAX_API_PAUSE_S)
                print(
                    f"  {host} : {response.status_code}, pause de {pause:.0f} s, puis une requête "
                    f"toutes les {self.pause:.1f} s",
                    flush=True,
                )
                time.sleep(pause)
                continue
            response.raise_for_status()
            payload = response.json()
            error = payload.get("error")
            if error and error.get("code") == "maxlag":
                pause = _retry_after(response, 10)
                print(f"  {host} : serveurs en retard (maxlag), pause de {pause:.0f} s", flush=True)
                time.sleep(pause)
                continue
            if error:
                raise RuntimeError(f"Wikimedia API error: {error}")
            return payload
        raise WikimediaUnavailable(f"{url} : {MAX_RETRIES} essais sans réponse")

    def search(self, query: str) -> list[dict]:
        payload = self.api(
            COMMONS_API,
            {
                "action": "query",
                "generator": "search",
                "gsrsearch": f"{query} filetype:bitmap",
                "gsrnamespace": "6",
                "gsrlimit": str(PER_QUERY),
                "prop": "imageinfo|categories",
                "cllimit": "max",
                "iiprop": "url|size|extmetadata",
                "iiurlwidth": str(THUMB_WIDTH),
                "iiextmetadatafilter": "LicenseShortName|License|UsageTerms|Artist|"
                "DateTimeOriginal|ImageDescription|Credit|ObjectName|AttributionRequired",
            },
        )
        pages = sorted(payload.get("query", {}).get("pages", []), key=lambda p: p["index"])
        return [hit for page in pages if (hit := _hit(page, query)) is not None]

    def death_by_qids(self, qids: Sequence[str]) -> int | None:
        missing = [q for q in qids if f"Q:{q}" not in self.authors]
        if missing:
            payload = self.api(
                WIKIDATA_API,
                {"action": "wbgetentities", "ids": "|".join(missing[:50]), "props": "claims"},
            )
            for qid, entity in payload.get("entities", {}).items():
                self.authors[f"Q:{qid}"] = {"death": _death_claim(entity), "human": _human(entity)}
        deaths = [self.authors.get(f"Q:{q}", {}).get("death") for q in qids]
        return max((d for d in deaths if d is not None), default=None)

    def death_by_name(self, name: str) -> int | None:
        """Humans whose label or alias is exactly this name; the latest death if several."""
        key = f"N:{_fold(name)}"
        if key not in self.authors:
            payload = self.api(
                WIKIDATA_API,
                {
                    "action": "wbsearchentities",
                    "search": name,
                    "language": "en",
                    "uselang": "en",
                    "type": "item",
                    "limit": "5",
                },
            )
            exact = [
                hit["id"]
                for hit in payload.get("search", [])
                if _fold(hit.get("match", {}).get("text", "")) == _fold(name)
            ]
            humans: list[str] = []
            if exact:
                self.death_by_qids(exact)
                humans = [q for q in exact if self.authors.get(f"Q:{q}", {}).get("human")]
            deaths = [self.authors[f"Q:{q}"]["death"] for q in humans]
            self.authors[key] = {
                "qids": humans,
                "death": max((d for d in deaths if d is not None), default=None),
            }
        return self.authors[key]["death"]


def _retry_after(response: httpx.Response, default: float) -> float:
    try:
        return max(1.0, float(response.headers.get("Retry-After", default)))
    except ValueError:
        return default


def _fold(text: str) -> str:
    plain = unicodedata.normalize("NFKD", text).encode("ascii", "ignore").decode().lower()
    return " ".join(re.sub(r"[^a-z0-9]+", " ", plain).split())


def _death_claim(entity: dict) -> int | None:
    years = []
    for claim in entity.get("claims", {}).get("P570", []):
        value = claim.get("mainsnak", {}).get("datavalue", {}).get("value", {})
        match = re.match(r"[+-](\d{4})", value.get("time", "") if isinstance(value, dict) else "")
        if match:
            years.append(int(match.group(1)))
    return max(years, default=None)


def _human(entity: dict) -> bool:
    for claim in entity.get("claims", {}).get("P31", []):
        value = claim.get("mainsnak", {}).get("datavalue", {}).get("value", {})
        if isinstance(value, dict) and value.get("id") == "Q5":
            return True
    return False


def _clean_url(url: str | None) -> str | None:
    return url.split("?utm_", 1)[0] if url else url


def _hit(page: dict, query: str) -> dict | None:
    infos = page.get("imageinfo") or []
    if not infos:
        return None
    info = infos[0]
    meta = {
        k: v.get("value", "") if isinstance(v.get("value", ""), str) else str(v.get("value"))
        for k, v in info.get("extmetadata", {}).items()
    }
    raw_artist = meta.get("Artist", "")
    return {
        "title": page["title"],
        "page_url": info.get("descriptionurl"),
        "original_url": _clean_url(info.get("url")),
        "original_size": [info.get("width"), info.get("height")],
        "thumb_url": _clean_url(info.get("thumburl")),
        "thumb_size": [info.get("thumbwidth"), info.get("thumbheight")],
        "licence": strip_html(meta.get("LicenseShortName", "")),
        "licence_code": strip_html(meta.get("License", "")),
        "usage_terms": strip_html(meta.get("UsageTerms", "")),
        "attribution_required": meta.get("AttributionRequired", "") == "true",
        "artist": strip_html(raw_artist)[:300],
        "artist_dates": artist_dates_text(raw_artist)[:500],
        "artist_qids": sorted(set(re.findall(r"wikidata\.org/wiki/(Q\d+)", raw_artist))),
        "date": strip_html(meta.get("DateTimeOriginal", ""))[:120],
        "description": strip_html(meta.get("ImageDescription", ""))[:400],
        "credit": strip_html(meta.get("Credit", ""))[:400],
        "object_name": strip_html(meta.get("ObjectName", ""))[:200],
        "categories": [c["title"].removeprefix("Category:") for c in page.get("categories", [])],
        "query": query,
    }


def media_type(raw: bytes) -> tuple[str, str]:
    """(media type, file suffix): Commons serves PNG, GIF or WebP thumbnails for some files."""
    if raw[:8] == b"\x89PNG\r\n\x1a\n":
        return "image/png", ".png"
    if raw[:4] == b"RIFF" and raw[8:12] == b"WEBP":
        return "image/webp", ".webp"
    if raw[:3] == b"GIF":
        return "image/gif", ".gif"
    return "image/jpeg", ".jpg"


def download(http: httpx.Client, url: str) -> bytes | None:
    for attempt in range(MAX_RETRIES):
        try:
            response = http.get(url)
        except httpx.TransportError:
            time.sleep(5 * (attempt + 1))
            continue
        if response.status_code in (429, 503):
            pause = _retry_after(response, 10 * (attempt + 1))
            print(f"  vignette : {response.status_code}, pause de {pause:.0f} s", flush=True)
            time.sleep(pause)
            continue
        if response.status_code != 200 or not response.content:
            return None
        return response.content
    return None


def candidates_for(wiki: Wikimedia, queries: Sequence[str]) -> tuple[list[dict], list[dict], int]:
    """Kept candidates (at most 8), rejected files with their reason, files found."""
    hits = interleave([wiki.search(q) for q in queries])
    kept: list[dict] = []
    rejected: list[dict] = []
    lookups = 0
    for hit in hits:
        if len(kept) >= MAX_CANDIDATES:
            break
        reason = quick_reason(hit)
        death = None
        if reason is None:
            death = death_year(_dates(hit))
            year = work_year(hit.get("date", ""))
            # Nobody who made a work before 1880 died after 1955: no Wikidata request for it.
            recent = year is None or year > OLD_WORK_LIMIT
            if death is None and recent and hit["artist_qids"]:
                death = wiki.death_by_qids(hit["artist_qids"])
            name = lookup_name(hit["artist"])
            if death is None and recent and name and lookups < MAX_NAME_LOOKUPS:
                cached = f"N:{_fold(name)}" in wiki.authors
                death = wiki.death_by_name(name)
                lookups += not cached
            reason = rights_reason(hit, death)
        if reason:
            rejected.append(
                {
                    "title": hit["title"],
                    "page_url": hit["page_url"],
                    "reason": reason[0],
                    "detail": reason[1],
                }
            )
            continue
        hit["author_death"] = death
        if death is None and not is_unknown_author(hit):
            hit["rights_note"] = "date de mort de l'auteur introuvable"
        kept.append(hit)
    return kept, rejected, len(hits)


def save_thumbs(http: httpx.Client, card_id: str, kept: list[dict]) -> list[dict]:
    """Downloads the thumbnails, numbered 1… in order. A failed download drops the candidate, and
    so does a thumbnail identical to an earlier one (the same plate uploaded twice)."""
    directory = THUMBS_DIR / card_id
    directory.mkdir(parents=True, exist_ok=True)
    with ThreadPoolExecutor(THUMB_WORKERS) as pool:
        payloads = list(pool.map(lambda h: download(http, h["thumb_url"]), kept))
    saved = []
    seen: set[str] = set()
    for hit, raw in zip(kept, payloads, strict=True):
        if raw is None or hashlib.sha1(raw).hexdigest() in seen:
            continue
        seen.add(hashlib.sha1(raw).hexdigest())
        number = len(saved) + 1
        _media, suffix = media_type(raw)
        path = directory / f"{number}{suffix}"
        path.write_bytes(raw)
        saved.append(
            {
                "n": number,
                "thumb": str(path.relative_to(GRAVURES_DIR)),
                "bytes": len(raw),
                "credit_line": credit_line(hit),
                **hit,
            }
        )
    (directory / "meta.json").write_text(
        json.dumps(saved, ensure_ascii=False, indent=1), encoding="utf-8"
    )
    return saved


def run_search(cards: Sequence[Card]) -> None:
    queries = load_queries()
    done = load_searches()
    todo = [c for c in cards if c.id not in done and c.id in queries]
    waiting = sum(c.id not in queries for c in cards)
    print(
        f"recherche : {len(todo)} cartes à chercher, {len(done)} déjà faites, "
        f"{waiting} sans requêtes (lancer gravures-queries)",
        flush=True,
    )
    wiki = Wikimedia()
    started = time.monotonic()
    failures = 0
    try:
        for index, card in enumerate(todo, start=1):
            card_queries = queries[card.id]["queries"]
            try:
                kept, rejected, found = candidates_for(wiki, card_queries)
            except WikimediaUnavailable as error:
                failures += 1
                print(
                    f"[{index}/{len(todo)}] {card.word} : remis à plus tard ({error})", flush=True
                )
                if failures >= MAX_CARD_FAILURES:
                    raise SystemExit(
                        "Wikimedia refuse trop souvent : arrêt, relancer plus tard."
                    ) from error
                time.sleep(60)
                continue
            failures = 0
            saved = save_thumbs(wiki.http, card.id, kept)
            _append(
                SEARCH_FILE,
                {
                    "card": card.id,
                    "word": card.word,
                    "collection": card.collection,
                    "queries": card_queries,
                    "found": found,
                    "examined": len(saved) + len(rejected) + (len(kept) - len(saved)),
                    "candidates": saved,
                    "rejected": rejected,
                    "searched_at": datetime.now(UTC).isoformat(timespec="seconds"),
                },
            )
            elapsed = time.monotonic() - started
            left = elapsed / index * (len(todo) - index)
            print(
                f"[{index}/{len(todo)}] {card.word} : {len(saved)} candidats, "
                f"{len(rejected)} écartés, {found} trouvés · requêtes {dict(wiki.requests)} · "
                f"reste environ {left / 60:.0f} min",
                flush=True,
            )
    finally:
        wiki.close()


# --- 3. Pick -------------------------------------------------------------------------------------

TECHNIQUES = [
    "gravure",  # burin, eau-forte, bois, taille-douce
    "lithographie",
    "dessin au trait",
    "dessin lavé ou aquarelle",
    "peinture",
    "photographie",
    "autre",
]

PICK_SYSTEM = """Tu aides à illustrer les cartes d'un jeu sur les mots rares et anciens du français.
Chaque carte porte une petite image ancienne, retraitée en encre seule (traits sombres sur fond
clair) et affichée dans un encart d'environ 270 sur 120 points.

On te donne un mot, sa définition et des images candidates numérotées, trouvées sur Wikimedia
Commons. Choisis celle qui illustre le mieux le sens du mot, ou « aucun » si aucune ne convient.

Un bon candidat :
- montre le sens du mot : l'objet, l'animal, le métier, le type humain ou la scène qu'il désigne,
  pas seulement un thème voisin ;
- est une gravure (burin, eau-forte, bois), une lithographie ou un dessin au trait. Une peinture,
  une aquarelle, une photographie ou un objet photographié ne passe pas le traitement en encre ;
- reste lisible en petit : un sujet net, pas une page de texte ni une scène minuscule.

Mieux vaut « aucun » qu'une image hors sujet ou qu'une peinture.

Réponds en JSON :
- choix : le numéro du meilleur candidat, ou "aucun" ;
- pertinence : de 0 (hors sujet) à 10 (illustre exactement le mot), pour le candidat choisi ; 0 si aucun ;
- technique_choix : la technique du candidat choisi, "sans objet" si aucun ;
- techniques : la technique de chaque candidat, dans l'ordre des numéros ;
- raison : une phrase courte."""


def pick_schema(count: int) -> dict[str, object]:
    return {
        "type": "object",
        "properties": {
            "choix": {"type": "string", "enum": [str(n) for n in range(1, count + 1)] + ["aucun"]},
            "pertinence": {"type": "integer"},
            "technique_choix": {"type": "string", "enum": [*TECHNIQUES, "sans objet"]},
            "techniques": {"type": "array", "items": {"type": "string", "enum": TECHNIQUES}},
            "raison": {"type": "string"},
        },
        "required": ["choix", "pertinence", "technique_choix", "techniques", "raison"],
        "additionalProperties": False,
    }


def pick_content(card: Card, candidates: Sequence[dict]) -> list[dict]:
    blocks: list[dict] = [
        {"type": "text", "text": f"Mot : {card.word}\nDéfinition : {card.definition}"}
    ]
    for cand in candidates:
        raw = (GRAVURES_DIR / cand["thumb"]).read_bytes()
        media, _suffix = media_type(raw)
        blocks.append({"type": "text", "text": f"Candidat {cand['n']} :"})
        blocks.append(
            {
                "type": "image",
                "source": {
                    "type": "base64",
                    "media_type": media,
                    "data": base64.standard_b64encode(raw).decode(),
                },
            }
        )
    blocks.append({"type": "text", "text": f"Choisis parmi les {len(candidates)} candidats."})
    return blocks


def pick_request(card: Card, candidates: Sequence[dict]) -> dict:
    return {
        "custom_id": card.id,
        "params": {
            "model": PICK_MODEL,
            "max_tokens": 4000,
            "system": PICK_SYSTEM,
            "messages": [{"role": "user", "content": pick_content(card, candidates)}],
            "output_config": {
                "format": {"type": "json_schema", "schema": pick_schema(len(candidates))},
                "effort": PICK_EFFORT,
            },
        },
    }


def request_bytes(candidates: Sequence[dict]) -> int:
    """Size of a pick request body: base64 images plus the prompt."""
    return sum(int(c["bytes"]) * 4 // 3 + 64 for c in candidates) + 4000


def split_batches(
    sizes: Sequence[tuple[str, int]],
    max_cards: int = MAX_BATCH_CARDS,
    max_bytes: int = MAX_BATCH_BYTES,
) -> list[list[str]]:
    """Consecutive groups of (card, request bytes), each within both limits."""
    batches: list[list[str]] = []
    current: list[str] = []
    weight = 0
    for card_id, size in sizes:
        if current and (len(current) >= max_cards or weight + size > max_bytes):
            batches.append(current)
            current, weight = [], 0
        current.append(card_id)
        weight += size
    if current:
        batches.append(current)
    return batches


def image_tokens(candidates: Sequence[dict]) -> int:
    # Vision docs: about width x height / 750 tokens per image.
    return sum(int(w or 0) * int(h or 0) // 750 for w, h in (c["thumb_size"] for c in candidates))


def batch_cost(usage: dict[str, int], model: str = PICK_MODEL) -> float:
    return llm.cost(model, usage) * BATCH_DISCOUNT


def estimate_pick(candidate_lists: Iterable[Sequence[dict]]) -> float:
    total = 0.0
    for candidates in candidate_lists:
        if candidates:
            usage = {
                "input_tokens": PICK_TEXT_TOKENS + image_tokens(candidates),
                "output_tokens": PICK_OUTPUT_TOKENS,
            }
            total += batch_cost(usage)
    return total


def pick_row(card: Card, candidates: Sequence[dict], batch_id: str | None, result: object) -> dict:
    """One line of picks.jsonl from a batch result (an errored request is a row with `error`)."""
    row: dict[str, object] = {
        "card": card.id,
        "word": card.word,
        "collection": card.collection,
        "rarity": card.rarity,
        "candidates": len(candidates),
        "model": PICK_MODEL,
        "effort": PICK_EFFORT,
        "batch_id": batch_id,
        "pick": None,
        "score": None,
        "technique": None,
        "techniques": None,
        "reason": None,
        "usage": {},
        "cost_usd": 0.0,
        "error": None,
    }
    kind = getattr(result, "type", None)
    if kind != "succeeded":
        row["error"] = f"batch result {kind}: {getattr(result, 'error', None)!r}"
        return row
    message = result.message  # type: ignore[attr-defined]
    usage = {key: getattr(message.usage, key, 0) or 0 for key in llm.USAGE_KEYS}
    row["usage"] = usage
    row["cost_usd"] = round(batch_cost(usage), 6)
    if message.stop_reason != "end_turn":
        row["error"] = f"stop_reason={message.stop_reason}"
        return row
    text = next((b.text for b in message.content if b.type == "text"), "")
    try:
        answer = json.loads(text)
    except json.JSONDecodeError as error:
        row["error"] = f"invalid output: {error}"
        return row
    choice = str(answer.get("choix"))
    if choice != "aucun" and not (choice.isdigit() and 1 <= int(choice) <= len(candidates)):
        row["error"] = f"invalid choice: {choice!r}"
        return row
    row.update(
        pick=int(choice) if choice != "aucun" else None,
        score=answer.get("pertinence"),
        technique=answer.get("technique_choix"),
        techniques=answer.get("techniques"),
        reason=answer.get("raison"),
    )
    if row["pick"] is not None:
        chosen = candidates[int(choice) - 1]
        row.update(
            pick_title=chosen["title"],
            pick_thumb=chosen["thumb"],
            pick_page=chosen["page_url"],
            pick_licence=chosen["licence"],
            pick_credit=chosen["credit_line"],
        )
    return row


def no_candidate_row(card: Card) -> dict:
    return {
        "card": card.id,
        "word": card.word,
        "collection": card.collection,
        "rarity": card.rarity,
        "candidates": 0,
        "model": None,
        "batch_id": None,
        "pick": None,
        "score": None,
        "reason": "aucun candidat après la recherche",
        "cost_usd": 0.0,
        "error": None,
    }


async def _collect(
    api: anthropic.AsyncAnthropic,
    batch_id: str,
    cards: dict[str, Card],
    searches: dict[str, dict],
) -> tuple[int, int, float]:
    done = load_picks()
    picks = errors = 0
    total = 0.0
    async for item in await api.messages.batches.results(batch_id):
        card = cards.get(item.custom_id)
        if card is None or card.id in done:
            continue
        row = pick_row(card, searches[card.id]["candidates"], batch_id, item.result)
        _append(PICKS_FILE, row)
        total += float(row["cost_usd"])  # type: ignore[arg-type]
        errors += bool(row["error"])
        picks += row["pick"] is not None
    _append(BATCHES_FILE, {"batch_id": batch_id, "collected": True})
    return picks, errors, total


async def run_pick(cards: Sequence[Card], catalogue: Sequence[Card], yes: bool) -> None:
    """Picks for `cards`; batches sent by an earlier, interrupted run are collected first
    (their cards are looked up in the whole `catalogue`)."""
    from .curation import confirm_spend  # the shared --yes rule

    searches = load_searches()
    done = load_picks()
    by_id = {c.id: c for c in cards}
    searched = [c for c in cards if c.id in searches and c.id not in done]
    print(f"choix : {len(searched)} cartes cherchées à traiter, {len(done)} déjà faites")

    for card in searched:
        if not searches[card.id]["candidates"]:
            _append(PICKS_FILE, no_candidate_row(card))
    events = _jsonl(BATCHES_FILE)
    collected = {e["batch_id"] for e in events if e.get("collected")}
    pending = [e for e in events if "cards" in e and e["batch_id"] not in collected]
    in_flight = {card_id for e in pending for card_id in e["cards"]}
    todo = [
        c
        for c in searched
        if searches[c.id]["candidates"] and c.id not in in_flight and c.id not in done
    ]

    async with llm.client() as api:
        if todo:
            estimate = estimate_pick(searches[c.id]["candidates"] for c in todo)
            check_budget("choix", estimate)
            confirm_spend(
                f"choix de {len(todo)} cartes ({PICK_MODEL}, batch à moitié prix)", estimate, yes
            )
            sizes = [(c.id, request_bytes(searches[c.id]["candidates"])) for c in todo]
            for group in split_batches(sizes):
                requests = [pick_request(by_id[i], searches[i]["candidates"]) for i in group]
                batch = await api.messages.batches.create(requests=requests)  # type: ignore[arg-type]
                event = {
                    "batch_id": batch.id,
                    "cards": group,
                    "submitted_at": datetime.now(UTC).isoformat(timespec="seconds"),
                }
                _append(BATCHES_FILE, event)
                pending.append(event)
                print(f"lot {batch.id} : {len(group)} cartes envoyées", flush=True)

        all_cards = {c.id: c for c in catalogue}
        total = picks = errors = 0
        while pending:
            for event in list(pending):
                batch = await api.messages.batches.retrieve(event["batch_id"])
                if batch.processing_status != "ended":
                    counts = batch.request_counts
                    print(
                        f"lot {batch.id} : {batch.processing_status}, {counts.succeeded} faits, "
                        f"{counts.processing} en cours",
                        flush=True,
                    )
                    continue
                p, e, t = await _collect(api, batch.id, all_cards, searches)
                picks, errors, total = picks + p, errors + e, total + t
                pending.remove(event)
                print(f"lot {batch.id} terminé : {p} choix, {e} erreurs, {t:.4f} $", flush=True)
            if pending:
                await asyncio.sleep(POLL_SECONDS)
    print(f"choix : {picks} images choisies, {errors} erreurs, {total:.4f} $ pour ce passage")
    print(f"coût total du choix : {spent(PICKS_FILE):.4f} $")


# --- Report --------------------------------------------------------------------------------------


def report(cards: Sequence[Card]) -> str:
    ids = {c.id for c in cards}
    searches = {k: v for k, v in load_searches().items() if k in ids}
    picks = {k: v for k, v in load_picks().items() if k in ids}
    with_candidates = sum(bool(s["candidates"]) for s in searches.values())
    chosen = sum(p["pick"] is not None for p in picks.values())
    reasons: dict[str, int] = {}
    for s in searches.values():
        for r in s["rejected"]:
            reasons[r["reason"]] = reasons.get(r["reason"], 0) + 1
    notes = sum(1 for s in searches.values() for c in s["candidates"] if c.get("rights_note"))
    lines = [
        f"{len(cards)} cartes, {len(searches)} cherchées, {with_candidates} avec au moins un "
        f"candidat, {len(picks)} passées au choix : {chosen} images choisies, "
        f"{len(picks) - chosen} sans image",
        "écartés : "
        + ", ".join(f"{k} {v}" for k, v in sorted(reasons.items(), key=lambda x: -x[1])),
        f"candidats gardés dont l'auteur n'a pas de date de mort connue : {notes}",
        f"coût : requêtes {spent(QUERIES_FILE):.4f} $, choix {spent(PICKS_FILE):.4f} $",
    ]
    return "\n".join(lines)
