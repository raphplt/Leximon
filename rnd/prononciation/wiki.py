"""Throwaway probe: pronunciation coverage of the catalogue on Wiktionnaire and Commons.

Stages (each caches its result in out/, rerun to resume):
  wiktionary  page wikitext, 50 titles per request: IPA from {{pron}} and audio files
              from {{écouter}}, French section only
  fr-ogg      existence of File:Fr-<word>.ogg on Commons, 50 titles per request
  lingualibre Commons search for Lingua Libre recordings "LL-Q150 (fra)-<speaker>-<word>.wav",
              one request per word not already linked from Wiktionnaire
  licences    extmetadata (licence, author) of every file found, 50 titles per request
  report      coverage figures

One request at a time, about one per second, identifiable User-Agent (Wikimedia policy).
Stdlib only. Run: python3 rnd/prononciation/wiki.py all
"""

import json
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from collections import Counter
from pathlib import Path

UA = "LeximonContentPipeline/0.1 (https://leximon.fr; contact@leximon.fr)"
ROOT = Path(__file__).resolve().parents[2]
RELEASE = ROOT / "content/releases/2026-10-20.3"
OUT = Path(__file__).parent / "out"
WIKT = "https://fr.wiktionary.org/w/api.php"
COMMONS = "https://commons.wikimedia.org/w/api.php"
PAUSE = 1.0


def load_words() -> list[str]:
    manifest = json.loads((RELEASE / "manifest.json").read_text())
    words = []
    for col in manifest["collections"]:
        cards = json.loads((RELEASE / col["file"]).read_text())["cards"]
        words += [c["word"] for c in cards]
    return words


_last = 0.0


def api(base: str, params: dict) -> dict:
    global _last
    wait = PAUSE - (time.monotonic() - _last)
    if wait > 0:
        time.sleep(wait)
    params = {"format": "json", "formatversion": "2", "maxlag": "5", **params}
    body = urllib.parse.urlencode(params).encode()
    req = urllib.request.Request(base, data=body, headers={"User-Agent": UA})
    for attempt in range(5):
        try:
            with urllib.request.urlopen(req, timeout=60) as resp:
                _last = time.monotonic()
                data = json.load(resp)
            if data.get("error", {}).get("code") == "maxlag":
                time.sleep(5 * (attempt + 1))
                continue
            return data
        except urllib.error.HTTPError as err:
            _last = time.monotonic()
            if err.code not in (429, 503) or attempt == 4:
                raise
            time.sleep(10 * (attempt + 1))
    raise RuntimeError("unreachable")


def chunks(items: list, n: int):
    for i in range(0, len(items), n):
        yield items[i : i + n]


def cached(name: str) -> dict:
    path = OUT / f"{name}.json"
    return json.loads(path.read_text()) if path.exists() else {}


def save(name: str, data: dict) -> None:
    OUT.mkdir(exist_ok=True)
    (OUT / f"{name}.json").write_text(json.dumps(data, ensure_ascii=False, indent=1))


# --- Wiktionnaire -------------------------------------------------------------

FR_SECTION = re.compile(r"^==\s*\{\{langue\|fr\}\}\s*==\s*$", re.M)
NEXT_LANG = re.compile(r"^==\s*\{\{langue\|", re.M)
PRON = re.compile(r"\{\{pron\|([^|}]*)\|fr\}\}")
ECOUTER = re.compile(r"\{\{écouter\|([^}]*)\}\}")


def french_section(text: str) -> str | None:
    m = FR_SECTION.search(text)
    if not m:
        return None
    rest = text[m.end() :]
    nxt = NEXT_LANG.search(rest)
    return rest[: nxt.start()] if nxt else rest


def parse_ecouter(args: str) -> dict:
    out = {"positional": []}
    for part in args.split("|"):
        if "=" in part:
            k, v = part.split("=", 1)
            out[k.strip()] = v.strip()
        else:
            out["positional"].append(part.strip())
    return out


def stage_wiktionary(words: list[str]) -> None:
    data = cached("wiktionary")
    todo = [w for w in words if w not in data]
    for batch in chunks(todo, 50):
        res = api(
            WIKT,
            {
                "action": "query",
                "prop": "revisions",
                "rvprop": "content",
                "rvslots": "main",
                "titles": "|".join(batch),
            },
        )
        norm = {n["to"]: n["from"] for n in res["query"].get("normalized", [])}
        for page in res["query"]["pages"]:
            word = norm.get(page["title"], page["title"])
            if page.get("missing"):
                data[word] = {"exists": False}
                continue
            text = page["revisions"][0]["slots"]["main"]["content"]
            sec = french_section(text)
            if sec is None:
                data[word] = {"exists": True, "french": False}
                continue
            ipa = [p.strip() for p in PRON.findall(sec) if p.strip()]
            audio = []
            for args in ECOUTER.findall(sec):
                parsed = parse_ecouter(args)
                if parsed.get("audio"):
                    audio.append(
                        {
                            "file": parsed["audio"],
                            "lang": parsed.get("lang"),
                            "place": parsed["positional"][0] if parsed["positional"] else None,
                            "ipa": parsed.get("pron"),
                        }
                    )
            data[word] = {"exists": True, "french": True, "ipa": ipa, "audio": audio}
        missing = [w for w in batch if w not in data]
        for w in missing:
            data[w] = {"exists": False}
        save("wiktionary", data)
        print(f"wiktionary {len(data)}/{len(words)}", flush=True)


def stage_wiktionary_caps(words: list[str]) -> None:
    """Pages missing in lowercase, retried capitalised: the catalogue stores proper nouns
    (Durandal, Artaban) in lowercase. Only reported, never merged into the coverage."""
    data = cached("wiktionary")
    missing = [w for w in words if not data.get(w, {}).get("exists")]
    titles = {w[0].upper() + w[1:]: w for w in missing}
    res = api(WIKT, {"action": "query", "titles": "|".join(titles), "prop": "revisions", "rvprop": "content", "rvslots": "main"})
    found = {}
    for page in res["query"]["pages"]:
        if page.get("missing"):
            continue
        sec = french_section(page["revisions"][0]["slots"]["main"]["content"]) or ""
        found[page["title"]] = {"ipa": PRON.findall(sec), "audio": [parse_ecouter(a).get("audio") for a in ECOUTER.findall(sec)]}
    save("wiktionary_caps", {"missing": missing, "found": found})
    print(f"missing {len(missing)}, found capitalised {len(found)}: {sorted(found)}")
    print(f"still missing: {sorted(set(missing) - {titles[t] for t in found if t in titles})}")


# --- Commons: Fr-<word>.ogg ---------------------------------------------------


def ogg_title(word: str) -> str:
    return f"File:Fr-{word}.ogg"


def stage_fr_ogg(words: list[str]) -> None:
    data = cached("fr_ogg")
    todo = [w for w in words if w not in data]
    for batch in chunks(todo, 50):
        titles = {ogg_title(w): w for w in batch}
        res = api(COMMONS, {"action": "query", "titles": "|".join(titles)})
        norm = {n["to"]: n["from"] for n in res["query"].get("normalized", [])}
        for page in res["query"]["pages"]:
            asked = norm.get(page["title"], page["title"])
            word = titles.get(asked)
            if word is None:
                continue
            data[word] = None if page.get("missing") else page["title"]
        for w in batch:
            data.setdefault(w, None)
        save("fr_ogg", data)
        print(f"fr-ogg {len(data)}/{len(words)}", flush=True)


# --- Commons: Lingua Libre ----------------------------------------------------


def stage_lingualibre(words: list[str]) -> None:
    # Words whose Wiktionnaire page already links a Lingua Libre file are skipped: a first
    # pass over 51 words found 31 by search and 29 through Wiktionnaire, never the reverse.
    data = cached("lingualibre")
    wikt = cached("wiktionary")
    linked = {w for w in words if any(a["file"].startswith("LL-") for a in wikt.get(w, {}).get("audio", []))}
    todo = [w for w in words if w not in data and w not in linked]
    for i, word in enumerate(todo):
        res = api(
            COMMONS,
            {
                "action": "query",
                "list": "search",
                "srnamespace": "6",
                "srlimit": "50",
                "srsearch": f'intitle:"LL-Q150 (fra)" intitle:"{word}"',
            },
        )
        suffix = f"-{word}.wav".lower()
        hits = [
            h["title"]
            for h in res["query"]["search"]
            if h["title"].startswith("File:LL-Q150 (fra)-") and h["title"].lower().endswith(suffix)
        ]
        data[word] = hits
        if i % 25 == 0 or i == len(todo) - 1:
            save("lingualibre", data)
            print(f"lingualibre {i + 1}/{len(todo)}", flush=True)
    save("lingualibre", data)


# --- Licences -----------------------------------------------------------------


def all_files(words: list[str]) -> dict[str, set[str]]:
    wikt, ogg, ll = cached("wiktionary"), cached("fr_ogg"), cached("lingualibre")
    files: dict[str, set[str]] = {}
    for w in words:
        found = set()
        if ogg.get(w):
            found.add(ogg[w])
        found.update(ll.get(w, []))
        for a in wikt.get(w, {}).get("audio", []):
            if a["lang"] in (None, "fr"):
                name = a["file"].replace("_", " ")
                found.add("File:" + name[0].upper() + name[1:])
        files[w] = found
    return files


def stage_licences(words: list[str]) -> None:
    data = cached("licences")
    wanted = sorted({f for fs in all_files(words).values() for f in fs})
    todo = [f for f in wanted if f not in data]
    for batch in chunks(todo, 50):
        res = api(
            COMMONS,
            {
                "action": "query",
                "titles": "|".join(batch),
                "prop": "imageinfo",
                "iiprop": "extmetadata|size|mime|url",
                "iiextmetadatafilter": "LicenseShortName|LicenseUrl|Artist|AttributionRequired|Credit",
            },
        )
        norm = {n["to"]: n["from"] for n in res["query"].get("normalized", [])}
        for page in res["query"]["pages"]:
            title = norm.get(page["title"], page["title"])
            if page.get("missing") or "imageinfo" not in page:
                data[title] = None
                continue
            info = page["imageinfo"][0]
            meta = {k: v.get("value") for k, v in info.get("extmetadata", {}).items()}
            data[title] = {
                "licence": meta.get("LicenseShortName"),
                "licenceUrl": meta.get("LicenseUrl"),
                "artist": re.sub(r"<[^>]+>", "", meta.get("Artist") or "").strip(),
                "attribution": meta.get("AttributionRequired"),
                "size": info.get("size"),
                "duration": info.get("duration"),
                "mime": info.get("mime"),
                "url": info.get("url"),
            }
        for f in batch:
            data.setdefault(f, None)
        save("licences", data)
        print(f"licences {len(data)}/{len(wanted)}", flush=True)


# --- Report -------------------------------------------------------------------


def stage_report(words: list[str]) -> None:
    wikt, ogg, ll, lic = (
        cached("wiktionary"),
        cached("fr_ogg"),
        cached("lingualibre"),
        cached("licences"),
    )
    n = len(words)
    pct = lambda k: f"{k} ({100 * k / n:.1f} %)"  # noqa: E731
    exists = sum(1 for w in words if wikt.get(w, {}).get("exists"))
    french = sum(1 for w in words if wikt.get(w, {}).get("french"))
    with_ipa = sum(1 for w in words if wikt.get(w, {}).get("ipa"))
    print(f"words {n}")
    print(f"wiktionnaire page {pct(exists)}, French section {pct(french)}, IPA {pct(with_ipa)}")
    multi_ipa = sum(1 for w in words if len(set(wikt.get(w, {}).get("ipa", []))) > 1)
    print(f"  several distinct IPA {pct(multi_ipa)}")

    files = all_files(words)
    valid = {w: {f for f in fs if lic.get(f)} for w, fs in files.items()}
    print(f"Fr-<word>.ogg {pct(sum(1 for w in words if ogg.get(w)))}")
    print(f"Lingua Libre {pct(sum(1 for w in words if ll.get(w)))}")
    from_wikt = {
        w
        for w in words
        for a in wikt.get(w, {}).get("audio", [])
        if a["lang"] in (None, "fr") and lic.get("File:" + a["file"][0].upper() + a["file"][1:].replace("_", " "))
    }
    print(f"audio referenced by Wiktionnaire {pct(len(from_wikt))}")
    any_audio = [w for w in words if valid[w]]
    print(f"any human recording {pct(len(any_audio))}")
    print(f"  IPA and recording {pct(sum(1 for w in any_audio if wikt.get(w, {}).get('ipa')))}")
    print(f"  neither {pct(sum(1 for w in words if not valid[w] and not wikt.get(w, {}).get('ipa')))}")

    used = {f for fs in valid.values() for f in fs}
    licences = Counter(lic[f]["licence"] for f in used)
    print("licences of found files:", dict(licences.most_common()))
    artists = Counter(lic[f]["artist"] for f in used)
    print(f"distinct authors {len(artists)}; top:", artists.most_common(8))
    durations = sorted(lic[f]["duration"] or 0 for f in used)
    sizes = sorted(lic[f]["size"] or 0 for f in used)
    if used:
        mid = len(used) // 2
        print(f"median duration {durations[mid]:.2f} s, median size {sizes[mid] / 1024:.0f} KiB")
    print("mimes:", dict(Counter(lic[f]["mime"] for f in used)))

    # By collection and rarity
    manifest = json.loads((RELEASE / "manifest.json").read_text())
    for col in manifest["collections"]:
        cards = json.loads((RELEASE / col["file"]).read_text())["cards"]
        by = Counter()
        tot = Counter()
        for c in cards:
            tot[c["rarity"]] += 1
            by[c["rarity"]] += bool(valid[c["word"]])
        audio = sum(by.values())
        print(f"{col['id']}: audio {audio}/{len(cards)}", {r: f"{by[r]}/{tot[r]}" for r in tot})
    allr, hit, ipa_r = Counter(), Counter(), Counter()
    for col in manifest["collections"]:
        for c in json.loads((RELEASE / col["file"]).read_text())["cards"]:
            allr[c["rarity"]] += 1
            hit[c["rarity"]] += bool(valid[c["word"]])
            ipa_r[c["rarity"]] += bool(wikt.get(c["word"], {}).get("ipa"))
    for r in allr:
        print(f"rarity {r}: audio {hit[r]}/{allr[r]}, IPA {ipa_r[r]}/{allr[r]}")


STAGES = {
    "wiktionary": stage_wiktionary,
    "wiktionary-caps": stage_wiktionary_caps,
    "fr-ogg": stage_fr_ogg,
    "lingualibre": stage_lingualibre,
    "licences": stage_licences,
    "report": stage_report,
}

if __name__ == "__main__":
    words = load_words()
    names = list(STAGES) if sys.argv[1:] == ["all"] else sys.argv[1:]
    for name in names:
        STAGES[name](words)
