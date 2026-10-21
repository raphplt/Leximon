"""Throwaway probe: pronunciation in the sources the content skill allows (carte-mot).

  littre    <prononciation> of XMLittré (public domain, already used by the pipeline):
            coverage, then the respelling read by eSpeak NG ("ko-ro-gra-f'" read as French
            text), compared with the Wiktionnaire IPA through g2p.py
  lexique   phonological column of Lexique 3.83 (CC BY-SA): coverage only
  wikidata  French lexemes (CC0) with an IPA (P898) or an audio file (P443), one SPARQL query
  report    figures

Reads content/pipeline/data/ of the main checkout (not versioned). Writes out/sources.json.
Run: python3 rnd/prononciation/sources.py littre lexique wikidata report
"""

import csv
import json
import re
import subprocess
import sys
import unicodedata
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
from pathlib import Path

from g2p import lenient, no_schwa, tokens
from wiki import UA, load_words

OUT = Path(__file__).parent / "out"
DATA = Path("/home/raphael/dev/perso/Leximon/content/pipeline/data")
SPARQL = "https://query.wikidata.org/sparql"


def load() -> dict:
    path = OUT / "sources.json"
    return json.loads(path.read_text()) if path.exists() else {}


def save(data: dict) -> None:
    (OUT / "sources.json").write_text(json.dumps(data, ensure_ascii=False, indent=1))


def strip_accents_upper(word: str) -> str:
    return word.upper()


def stage_littre(words: list[str], data: dict) -> None:
    wanted = {w.upper(): w for w in words}
    found: dict[str, list[str]] = {}
    for xml in sorted((DATA / "littre").glob("*.xml")):
        for _, el in ET.iterparse(xml, events=("end",)):
            if el.tag != "entree":
                continue
            term = (el.get("terme") or "").strip()
            word = wanted.get(term)
            if word is not None:
                pron = el.find("entete/prononciation")
                if pron is not None and pron.text and pron.text.strip():
                    found.setdefault(word, []).append(pron.text.strip())
                else:
                    found.setdefault(word, [])
            el.clear()
    data["littre"] = found


def respelling_for_espeak(pron: str) -> str:
    """Littré respelling to plain text eSpeak NG can read: one reading only, the apostrophe
    after a final consonant means it is sounded (an-be-zas' -> an be zasse)."""
    pron = pron.split(",")[0].split(";")[0]
    pron = re.sub(r"\(.*?\)|\[.*?\]", "", pron)
    pron = pron.replace("ll mouillées", "").strip()
    pron = re.sub(r"([bcdfgklmnpqrstvxz])'", lambda m: m.group(1) + ("e" if m.group(1) not in "s" else "se"), pron)
    pron = pron.replace("'", "")
    return pron.replace("-", "")


def stage_lexique(words: list[str], data: dict) -> None:
    phon: dict[str, str] = {}
    with (DATA / "lexique/Lexique383.tsv").open(encoding="utf-8") as f:
        for row in csv.DictReader(f, delimiter="\t"):
            phon.setdefault(row["ortho"], row["phon"])
    data["lexique"] = {w: phon[w] for w in words if w in phon}


def stage_wikidata(words: list[str], data: dict) -> None:
    values = " ".join(f'"{w}"@fr' for w in words)
    query = f"""
SELECT ?lemma (SAMPLE(?ipa) AS ?ipa1) (COUNT(DISTINCT ?audio) AS ?audios) WHERE {{
  VALUES ?lemma {{ {values} }}
  ?lexeme dct:language wd:Q150 ; wikibase:lemma ?lemma .
  OPTIONAL {{ ?lexeme ontolex:lexicalForm ?form . ?form ontolex:representation ?lemma .
             OPTIONAL {{ ?form wdt:P898 ?ipa }} OPTIONAL {{ ?form wdt:P443 ?audio }} }}
}} GROUP BY ?lemma"""
    body = urllib.parse.urlencode({"query": query, "format": "json"}).encode()
    req = urllib.request.Request(SPARQL, data=body, headers={"User-Agent": UA, "Accept": "application/sparql-results+json"})
    with urllib.request.urlopen(req, timeout=120) as resp:
        rows = json.load(resp)["results"]["bindings"]
    data["wikidata"] = {
        r["lemma"]["value"]: {"ipa": r.get("ipa1", {}).get("value"), "audios": int(r["audios"]["value"])} for r in rows
    }


def stage_report(words: list[str], data: dict) -> None:
    n = len(words)
    pct = lambda k: f"{k} ({100 * k / n:.1f} %)"  # noqa: E731
    lit = data["littre"]
    with_pron = [w for w in words if lit.get(w)]
    print(f"littré entry {pct(sum(1 for w in words if w in lit))}, with pronunciation {pct(len(with_pron))}")
    print(f"lexique phon {pct(len(data['lexique']))}")
    wd = data["wikidata"]
    print(f"wikidata lexeme {pct(len(wd))}, IPA {pct(sum(1 for v in wd.values() if v['ipa']))}, audio {pct(sum(1 for v in wd.values() if v['audios']))}")

    wikt = json.loads((OUT / "wiktionary.json").read_text())
    both = [w for w in with_pron if wikt.get(w, {}).get("ipa")]
    texts = [respelling_for_espeak(lit[w][0]) for w in both]
    # One process per word: some respellings hold punctuation that eSpeak NG splits on.
    readings = [
        " ".join(subprocess.run(["espeak-ng", "-v", "fr", "-q", "--ipa", t], capture_output=True, text=True, check=True).stdout.split())
        for t in texts
    ]
    raw = json.loads((OUT / "g2p_piper.json").read_text())
    ok_respelling = ok_raw = rescued = broken = 0
    examples = []
    for w, text, got in zip(both, texts, readings, strict=True):
        refs = [lenient(no_schwa(tokens(i))) for i in dict.fromkeys(wikt[w]["ipa"])]
        a = lenient(no_schwa(tokens(got))) in refs and "(en)" not in got
        b = raw[w]["lenient"]
        ok_respelling += a
        ok_raw += b
        rescued += a and not b
        broken += b and not a
        if a and not b and len(examples) < 15:
            examples.append(f"  rescued {w}: littré {lit[w][0]!r} -> {got}; wikt {wikt[w]['ipa'][0]}")
    m = len(both)
    print(f"words with Littré respelling and Wiktionnaire IPA: {m}")
    print(f"  eSpeak NG on the word:       {ok_raw} ({100 * ok_raw / m:.1f} %)")
    print(f"  eSpeak NG on the respelling: {ok_respelling} ({100 * ok_respelling / m:.1f} %)")
    print(f"  rescued by the respelling {rescued}, broken by it {broken}")
    print("\n".join(examples))
    hard = [x["word"] for x in json.loads((Path(__file__).parent / "words20.json").read_text())]
    for w in hard:
        print(f"  {w}: littré {lit.get(w)}")


STAGES = {"littre": stage_littre, "lexique": stage_lexique, "wikidata": stage_wikidata, "report": stage_report}

if __name__ == "__main__":
    words = load_words()
    data = load()
    for name in sys.argv[1:]:
        STAGES[name](words, data)
        save(data)
