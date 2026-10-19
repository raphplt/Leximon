"""Candidate words from Wiktionnaire categories (titles only: no Wiktionnaire text is reused).

Results are cached on disk; requests are spaced out to respect the Wikimedia API.
"""

import json
import time

import httpx

from .config import USER_AGENT, WIKTIONARY_DIR

API = "https://fr.wiktionary.org/w/api.php"
CATEGORIES = {
    "desuet": "Termes désuets en français",
    "vieilli": "Termes vieillis en français",
    "archaique": "Termes archaïques en français",
    "rare": "Termes rares en français",
    "litteraire": "Termes littéraires en français",
    "insulte": "Insultes en français",
}
PAUSE_SECONDS = 3.0
MAX_RETRIES = 8


def category_members(key: str, *, refresh: bool = False) -> list[str]:
    """Main-namespace page titles of a category, from the disk cache when available."""
    cache_file = WIKTIONARY_DIR / f"{key}.json"
    if cache_file.exists() and not refresh:
        return json.loads(cache_file.read_text(encoding="utf-8"))

    titles: list[str] = []
    params: dict[str, str] = {
        "action": "query",
        "list": "categorymembers",
        "cmtitle": f"Catégorie:{CATEGORIES[key]}",
        "cmnamespace": "0",
        "cmlimit": "500",
        "format": "json",
        "maxlag": "5",
    }
    with httpx.Client(headers={"User-Agent": USER_AGENT}, timeout=30) as client:
        while True:
            response = _get_with_backoff(client, params)
            payload = response.json()
            error = payload.get("error")
            if error is not None:
                if error.get("code") != "maxlag":
                    raise RuntimeError(f"Wiktionnaire API error: {error}")
                # The servers are lagging and ask clients to wait before retrying.
                time.sleep(10)
                continue
            titles += [member["title"] for member in payload["query"]["categorymembers"]]
            if "continue" not in payload:
                break
            params.update(payload["continue"])
            time.sleep(PAUSE_SECONDS)

    WIKTIONARY_DIR.mkdir(parents=True, exist_ok=True)
    cache_file.write_text(json.dumps(titles, ensure_ascii=False), encoding="utf-8")
    return titles


def _get_with_backoff(client: httpx.Client, params: dict[str, str]) -> httpx.Response:
    """GET that honours 429 / 503 with `Retry-After`, backing off exponentially otherwise."""
    for attempt in range(MAX_RETRIES):
        response = client.get(API, params=params)
        if response.status_code not in (429, 503):
            response.raise_for_status()
            return response
        retry_after = response.headers.get("retry-after", "")
        delay = float(retry_after) if retry_after.isdigit() else min(120.0, 5.0 * 2**attempt)
        time.sleep(delay)
    response.raise_for_status()
    return response
