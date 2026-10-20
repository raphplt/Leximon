"""Throwaway: Commons candidates and thumbnails for the 50 words of the vision measurement.

For each word of vision_words.py: three short Commons queries (method C), a strict filter, and up
to 6 candidates taken in turn from each query, with their 330 px thumbnails.

Filter (as proposed in docs/rnd/gravures.md):
  - licence PD, CC0, PDM, "No restrictions" or CC BY 4.0 (no SA, no NC);
  - no Gallica / BnF / British Museum source (title, description, credit, artist);
  - author dead before 1956 when the file links the author to Wikidata (date of death, P570);
  - work dated after 1930 dropped unless its author is known to have died before 1956.

One request at a time, at most one per second, with an identifiable User-Agent (repository URL,
no personal data). Stdlib only. Writes out/vision/candidates.json and out/vision/thumbs/.
Run: python3 rnd/gravures/vision_fetch.py
"""

import json
import re
import time
import unicodedata
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

from vision_words import RUNS, WORDS

UA = "LeximonRnD/0.1 (https://github.com/raphplt/Leximon) python-urllib/3"
HERE = Path(__file__).parent
REPO = HERE.parents[1]
OUT = HERE / "out" / "vision"
PER_QUERY = 10
MAX_CANDIDATES = 6
THUMB_WIDTH = 330
DEATH_LIMIT = 1956  # author must have died before 1 January 1956 (70 years, in 2026)
FREE = ("public domain", "cc0", "pdm", "no restrictions")
BANNED_SOURCES = ("gallica", "btv1b", "bnf", "bibliothèque nationale de france", "british museum")
BM_NUMBER = re.compile(r"\(BM [0-9A-Z]{1,5},[0-9]")  # British Museum registration number in a file name


def get(url: str, attempts: int = 4) -> bytes:
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    for attempt in range(attempts):
        try:
            with urllib.request.urlopen(req, timeout=60) as resp:
                return resp.read()
        except urllib.error.HTTPError as err:
            if err.code != 429 or attempt == attempts - 1:
                raise
            wait = int(err.headers.get("Retry-After") or 5 * (attempt + 1))
            print(f"  429, waiting {wait}s", flush=True)
            time.sleep(wait)
    raise RuntimeError("unreachable")


def strip_html(value: str) -> str:
    return re.sub(r"\s+", " ", re.sub(r"<[^>]+>", " ", value)).strip()


def slug(word: str) -> str:
    return unicodedata.normalize("NFKD", word).encode("ascii", "ignore").decode()


def licence_ok(licence: str) -> bool:
    low = licence.lower()
    if "sa" in re.split(r"[\s\-]+", low) or "nc" in re.split(r"[\s\-]+", low):
        return False
    return any(tag in low for tag in FREE) or low.replace("-", " ").strip() == "cc by 4.0"


def first_year(value: str) -> int | None:
    match = re.search(r"\b(1[0-9]{3}|20[0-9]{2})\b", value)
    return int(match.group(1)) if match else None


def commons_search(query: str) -> list[dict]:
    params = {
        "action": "query",
        "format": "json",
        "generator": "search",
        "gsrsearch": f"{query} filetype:bitmap",
        "gsrnamespace": "6",
        "gsrlimit": str(PER_QUERY),
        "prop": "imageinfo",
        "iiprop": "url|size|extmetadata",
        "iiurlwidth": str(THUMB_WIDTH),
        "iiextmetadatafilter": "LicenseShortName|Artist|DateTimeOriginal|ImageDescription|Credit",
    }
    data = json.loads(get("https://commons.wikimedia.org/w/api.php?" + urllib.parse.urlencode(params)))
    pages = sorted(data.get("query", {}).get("pages", {}).values(), key=lambda p: p["index"])
    hits = []
    for page in pages:
        info = page["imageinfo"][0]
        raw = {k: v.get("value", "") for k, v in info.get("extmetadata", {}).items()}
        raw = {k: v if isinstance(v, str) else str(v) for k, v in raw.items()}
        hits.append(
            {
                "pageid": page["pageid"],
                "title": page["title"],
                "url": info["descriptionurl"],
                "thumb_url": info.get("thumburl"),
                "thumb_size": [info.get("thumbwidth"), info.get("thumbheight")],
                "licence": strip_html(raw.get("LicenseShortName", "")),
                "artist": strip_html(raw.get("Artist", ""))[:100],
                "artist_qids": sorted(set(re.findall(r"wikidata\.org/wiki/(Q\d+)", raw.get("Artist", "")))),
                "date": strip_html(raw.get("DateTimeOriginal", ""))[:60],
                "description": strip_html(raw.get("ImageDescription", ""))[:240],
                "credit": strip_html(raw.get("Credit", ""))[:200],
                "query": query,
            }
        )
    return hits


def creators(pageids: list[int]) -> dict[int, list[str]]:
    """Creator (P170) of each file from Commons structured data, when filled in."""
    if not pageids:
        return {}
    ids = "|".join(f"M{pid}" for pid in pageids)
    params = {"action": "wbgetentities", "format": "json", "ids": ids, "props": "claims"}
    data = json.loads(get("https://commons.wikimedia.org/w/api.php?" + urllib.parse.urlencode(params)))
    found: dict[int, list[str]] = {}
    for mid, entity in data.get("entities", {}).items():
        statements = entity.get("statements") or entity.get("claims") or {}
        if not isinstance(statements, dict):
            continue
        qids = []
        for claim in statements.get("P170", []):
            value = claim.get("mainsnak", {}).get("datavalue", {}).get("value", {})
            if isinstance(value, dict) and value.get("id"):
                qids.append(value["id"])
        found[int(mid[1:])] = qids
    return found


def years_in_artist(artist: str) -> int | None:
    """Death year written next to the name, as in "Grandville (Nancy, 1803 - Vanves, 1847)"."""
    years = [int(y) for y in re.findall(r"\b(1[0-9]{3})\b", artist)]
    return max(years) if len(years) >= 2 else None


def death_years(qids: list[str]) -> dict[str, int | None]:
    if not qids:
        return {}
    params = {"action": "wbgetentities", "format": "json", "ids": "|".join(qids), "props": "claims"}
    data = json.loads(get("https://www.wikidata.org/w/api.php?" + urllib.parse.urlencode(params)))
    years: dict[str, int | None] = {}
    for qid, entity in data.get("entities", {}).items():
        claims = entity.get("claims", {}).get("P570", [])
        year = None
        for claim in claims:
            time_value = claim.get("mainsnak", {}).get("datavalue", {}).get("value", {}).get("time", "")
            match = re.match(r"[+-](\d{4})", time_value)
            if match:
                year = max(year or 0, int(match.group(1)))
        years[qid] = year
    return years


def reject_reason(hit: dict) -> str | None:
    if not hit["thumb_url"]:
        return "no thumbnail"
    if not licence_ok(hit["licence"]):
        return f"licence {hit['licence']!r}"
    haystack = " ".join([hit["title"], hit["description"], hit["credit"], hit["artist"]]).lower()
    if any(source in haystack for source in BANNED_SOURCES) or BM_NUMBER.search(hit["title"]):
        return "banned source"
    deaths = [y for y in hit["death_years"].values() if y is not None]
    if hit["artist_years"]:
        deaths.append(hit["artist_years"])
    if deaths and max(deaths) >= DEATH_LIMIT:
        return f"author died {max(deaths)}"
    year = first_year(hit["date"])
    if year and year > 1930 and not deaths:
        return f"dated {year}, author unknown"
    return None


def definitions() -> dict[str, str]:
    """Published definition first, then the latest draft (redraft over draft) of the runs."""
    found: dict[str, str] = {}
    for release in sorted((REPO / "content" / "releases").glob("*/collections/*.json")):
        for card in json.loads(release.read_text())["cards"]:
            found[card["word"]] = card["definition"]
    drafted: dict[str, str] = {}
    runs_dir = REPO / "content" / "pipeline" / "data" / "runs"
    for runs in RUNS.values():
        for run in runs:
            for name in ("drafts.jsonl", "redrafts.jsonl"):  # a redraft replaces the draft
                path = runs_dir / run / name
                if not path.exists():
                    continue
                for line in path.read_text().splitlines():
                    row = json.loads(line)
                    if row.get("draft"):
                        drafted[row["word"]] = row["draft"]["definition"]
    return drafted | found


def interleave(per_query: list[list[dict]]) -> list[dict]:
    """Rank 1 of each query, then rank 2..., without duplicates."""
    seen: set[str] = set()
    ordered = []
    for rank in range(PER_QUERY):
        for hits in per_query:
            if rank < len(hits) and hits[rank]["title"] not in seen:
                seen.add(hits[rank]["title"])
                ordered.append(hits[rank])
    return ordered


def main() -> None:
    defs = definitions()
    OUT.mkdir(parents=True, exist_ok=True)
    out_file = OUT / "candidates.json"
    results = json.loads(out_file.read_text()) if out_file.exists() else {}
    timings = []
    for collection, words in WORDS.items():
        for word, queries in words.items():
            if word in results:
                continue
            print(word, flush=True)
            per_query = []
            for query in queries:
                t0 = time.perf_counter()
                per_query.append(commons_search(query))
                timings.append(time.perf_counter() - t0)
                time.sleep(1)
            hits = interleave(per_query)
            by_page = creators([hit["pageid"] for hit in hits][:50])
            time.sleep(1)
            for hit in hits:
                hit["artist_qids"] = sorted(set(hit["artist_qids"]) | set(by_page.get(hit["pageid"], [])))
                hit["artist_years"] = years_in_artist(hit["artist"])
            qids = sorted({q for hit in hits for q in hit["artist_qids"]})
            years = {}
            for start in range(0, len(qids), 50):
                years.update(death_years(qids[start : start + 50]))
                time.sleep(1)
            kept, rejected = [], []
            for hit in hits:
                hit["death_years"] = {q: years.get(q) for q in hit["artist_qids"]}
                reason = reject_reason(hit)
                if reason:
                    rejected.append({"title": hit["title"], "reason": reason})
                elif len(kept) < MAX_CANDIDATES:
                    kept.append(hit)
            thumbs_dir = OUT / "thumbs" / slug(word)
            thumbs_dir.mkdir(parents=True, exist_ok=True)
            for number, hit in enumerate(kept, start=1):
                data = get(hit["thumb_url"])
                suffix = ".png" if data[:8] == b"\x89PNG\r\n\x1a\n" else ".jpg"
                path = thumbs_dir / f"{number}{suffix}"
                path.write_bytes(data)
                hit["n"] = number
                hit["thumb"] = str(path.relative_to(HERE))
                time.sleep(1)
            results[word] = {
                "collection": collection,
                "definition": defs.get(word),
                "queries": queries,
                "hits": len(hits),
                "rejected": rejected,
                "candidates": kept,
            }
            out_file.write_text(json.dumps(results, ensure_ascii=False, indent=1))
    if timings:
        timings.sort()
        print(f"searches: {len(timings)}, median {timings[len(timings) // 2]:.2f}s")


if __name__ == "__main__":
    main()
