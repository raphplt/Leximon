"""Throwaway: fetch the four 1280 px Commons thumbnails used by treat.py.

Goes through the imageinfo API (standard thumbnail size), one file per second.
Stdlib only. Run: python3 rnd/gravures/fetch_thumbs.py
"""

import json
import time
import urllib.parse
import urllib.request
from pathlib import Path

UA = "LeximonRnD/0.1 (https://github.com/raphplt/Leximon) python-urllib/3"
OUT = Path(__file__).parent / "out" / "thumbs"
FILES = {
    "casoar": "File:Engraving Casuarius casuarius.jpg",
    "vieux-niais": "File:Mr Vieux-niais.jpg",
    "sabord": "File:A wreathed gunport RMG PW6657.jpg",
    "orvietan": "File:Le marchand d'orviétan, Paris Musées 20230527124112.jpg",
}


def get(url: str) -> bytes:
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=60) as resp:
        return resp.read()


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    params = {
        "action": "query",
        "format": "json",
        "titles": "|".join(FILES.values()),
        "prop": "imageinfo",
        "iiprop": "url|extmetadata",
        "iiurlwidth": "1280",
        "iiextmetadatafilter": "LicenseShortName|Artist",
    }
    data = json.loads(get("https://commons.wikimedia.org/w/api.php?" + urllib.parse.urlencode(params)))
    by_title = {p["title"]: p["imageinfo"][0] for p in data["query"]["pages"].values()}
    for name, title in FILES.items():
        info = by_title[title]
        (OUT / f"{name}.jpg").write_bytes(get(info["thumburl"]))
        print(name, info["extmetadata"]["LicenseShortName"]["value"])
        time.sleep(1)


if __name__ == "__main__":
    main()
