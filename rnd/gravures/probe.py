"""Throwaway probe: search engraving candidates for a few catalogue words.

Queries the meaning of each word (not the rare word itself) on Wikimedia Commons,
and on the Met Open Access API for the first two runs, keeps the top hits with
their licence and date, and writes them to out/candidates-<run>.json for manual
judgement.

Runs:
  plain  one long English and one French query per word, as written from the definition
  style  same, with " engraving" appended to the English query
  multi  three short queries per word (2-3 words, print-making term included), Commons only

Stdlib only. Run: python3 rnd/gravures/probe.py multi
"""

import json
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

# Wikimedia asks for an identifiable User-Agent with a contact URL, and answers 429 otherwise.
UA = "LeximonRnD/0.1 (https://github.com/raphplt/Leximon) python-urllib/3"
OUT = Path(__file__).parent / "out"
TOP = 6

# Hand-written meaning queries, standing in for what a model would derive from the
# card definition: one English query (the language most Commons and Met records use)
# and one French query.
LONG_QUERIES = {
    "casoar": ("cassowary", "casoar gravure"),
    "clepsydre": ("clepsydra water clock", "clepsydre"),
    "cabasset": ("cabasset helmet", "cabasset casque"),
    "lavandière": ("washerwoman", "lavandière gravure"),
    "orviétan": ("charlatan quack selling remedies", "charlatan place publique gravure"),
    "défourner": ("baker oven bread peel", "boulanger four pain gravure"),
    "époussette": ("feather duster", "plumeau époussette"),
    "escogriffe": ("tall thin man caricature", "grand homme maigre caricature"),
    "coquefredouille": ("simpleton fool caricature", "niais sot caricature gravure"),
    "équanimité": ("allegory equanimity", "allégorie tempérance gravure"),
    "marsouin": ("porpoise", "marsouin gravure"),
    "sabord": ("gun port ship cannon", "sabord vaisseau canon"),
    "glanure": ("gleaners gleaning", "glaneuses glanage gravure"),
    "brimborion": ("trinkets knick-knacks", "babioles colifichets"),
    "turlupinade": ("Turlupin farce actor", "Turlupin farceur"),
}

# Commons ANDs every term: long queries return nothing. Short ones, several per word.
SHORT_QUERIES = {
    "casoar": ["cassowary engraving", "casoar gravure", "Casuarius plate"],
    "clepsydre": ["clepsydra", "water clock engraving", "clepsydre gravure"],
    "cabasset": ["cabasset", "morion engraving", "casque gravure"],
    "lavandière": ["washerwoman engraving", "lavandière gravure", "blanchisseuse"],
    "orviétan": ["charlatan engraving", "quack doctor engraving", "orviétan"],
    "défourner": ["baker oven engraving", "boulanger gravure", "bakery engraving"],
    "époussette": ["duster engraving", "broom engraving", "plumeau gravure"],
    "escogriffe": ["tall man caricature", "lanky caricature", "escogriffe"],
    "coquefredouille": ["simpleton caricature", "fool engraving", "niais caricature"],
    "équanimité": ["temperance allegory", "stoic engraving", "sérénité allégorie"],
    "marsouin": ["porpoise engraving", "marsouin gravure", "Phocoena plate"],
    "sabord": ["gunport", "ship of the line engraving", "vaisseau gravure"],
    "glanure": ["gleaners engraving", "glaneuses gravure", "gleaning"],
    "brimborion": ["trinkets engraving", "bric-a-brac caricature", "colifichets"],
    "turlupinade": ["Turlupin", "farceurs gravure", "Hôtel de Bourgogne farce"],
}

FREE_LICENCES = ("public domain", "cc0", "no restrictions", "pdm")


def get_json(url: str, attempts: int = 4) -> dict:
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    for attempt in range(attempts):
        try:
            with urllib.request.urlopen(req, timeout=30) as resp:
                return json.load(resp)
        except urllib.error.HTTPError as err:
            if err.code != 429 or attempt == attempts - 1:
                raise
            wait = int(err.headers.get("Retry-After") or 5 * (attempt + 1))
            print(f"  429, waiting {wait}s", flush=True)
            time.sleep(wait)
    raise RuntimeError("unreachable")


def strip_html(value: str) -> str:
    return re.sub(r"\s+", " ", re.sub(r"<[^>]+>", " ", value)).strip()


def is_free(licence: str | None) -> bool:
    return bool(licence) and any(tag in licence.lower() for tag in FREE_LICENCES)


def commons_search(query: str) -> dict:
    # filetype:bitmap drops PDFs, DjVu and SVG; the licence filter is applied after.
    params = {
        "action": "query",
        "format": "json",
        "generator": "search",
        "gsrsearch": f"{query} filetype:bitmap",
        "gsrnamespace": "6",
        "gsrlimit": str(TOP),
        "prop": "imageinfo",
        "iiprop": "url|size|extmetadata",
        "iiurlwidth": "330",
        "iiextmetadatafilter": "LicenseShortName|Artist|DateTimeOriginal|ObjectName|ImageDescription|Categories",
    }
    t0 = time.perf_counter()
    data = get_json("https://commons.wikimedia.org/w/api.php?" + urllib.parse.urlencode(params))
    elapsed = time.perf_counter() - t0
    pages = sorted(data.get("query", {}).get("pages", {}).values(), key=lambda p: p["index"])
    hits = []
    for page in pages:
        info = page["imageinfo"][0]
        meta = {k: strip_html(v["value"]) for k, v in info.get("extmetadata", {}).items()}
        hits.append(
            {
                "title": page["title"],
                "url": info["descriptionurl"],
                "thumb": info.get("thumburl"),
                "size": [info.get("width"), info.get("height")],
                "licence": meta.get("LicenseShortName"),
                "free": is_free(meta.get("LicenseShortName")),
                "artist": meta.get("Artist", "")[:80],
                "date": meta.get("DateTimeOriginal", "")[:40],
                "description": meta.get("ImageDescription", "")[:200],
                "categories": meta.get("Categories", "")[:300],
            }
        )
    return {"query": query, "elapsed_s": round(elapsed, 2), "hits": hits}


def met_search(query: str) -> dict:
    base = "https://collectionapi.metmuseum.org/public/collection"
    # v1/search was retired on 2026-10-01; v1.1 is paginated by offset and limit.
    params = {"q": query, "hasImages": "true", "medium": "Prints", "limit": str(TOP), "offset": "0"}
    t0 = time.perf_counter()
    found = get_json(f"{base}/v1.1/search?" + urllib.parse.urlencode(params))
    hits = []
    for object_id in found.get("objectIDs") or []:
        try:
            obj = get_json(f"{base}/v1/objects/{object_id}")
        except urllib.error.HTTPError as err:
            if err.code == 404:  # the search index lists some withdrawn objects
                continue
            raise
        hits.append(
            {
                "title": obj.get("title"),
                "url": obj.get("objectURL"),
                "thumb": obj.get("primaryImageSmall"),
                "licence": "CC0" if obj.get("isPublicDomain") else "not public domain",
                "free": bool(obj.get("isPublicDomain")),
                "artist": obj.get("artistDisplayName"),
                "date": obj.get("objectDate"),
                "medium": obj.get("medium"),
            }
        )
        time.sleep(0.1)
    elapsed = round(time.perf_counter() - t0, 2)
    return {"query": query, "elapsed_s": elapsed, "total": found.get("total"), "hits": hits}


def run_long(style: str) -> dict:
    results = {}
    for word, (english, french) in LONG_QUERIES.items():
        print(word, flush=True)
        # Unauthenticated Commons: concurrency 1, under 5 req/s; we stay far below.
        commons_en = commons_search(english + style)
        time.sleep(1)
        commons_fr = commons_search(french)
        results[word] = {"commons_en": commons_en, "commons_fr": commons_fr, "met": met_search(english)}
        time.sleep(2)
    return results


def run_multi() -> dict:
    results = {}
    for word, queries in SHORT_QUERIES.items():
        print(word, flush=True)
        searches = []
        for query in queries:
            searches.append(commons_search(query))
            time.sleep(1)
        results[word] = searches
    return results


def main() -> None:
    run = sys.argv[1] if len(sys.argv) > 1 else "multi"
    if run == "plain":
        results = run_long("")
    elif run == "style":
        results = run_long(" engraving")
    elif run == "multi":
        results = run_multi()
    else:
        raise SystemExit(f"unknown run {run!r}: plain, style or multi")
    OUT.mkdir(exist_ok=True)
    (OUT / f"candidates-{run}.json").write_text(json.dumps(results, ensure_ascii=False, indent=1))


if __name__ == "__main__":
    main()
