"""Throwaway probe: how often does eSpeak NG read a catalogue word as Wiktionnaire writes it?

eSpeak NG is the grapheme-to-phoneme step of Piper and Kokoro, and the browser voice on
most Linux machines, so its raw reading is a lower bound for "unguided" synthesis.

For each word with an IPA on Wiktionnaire (out/wiktionary.json, from wiki.py), compares the
eSpeak NG reading with every Wiktionnaire variant after normalisation:
  strict   identical phonemes (stress, length and syllable marks dropped)
  lenient  mid-vowel and a/ɑ, ɛ̃/œ̃ oppositions merged (regional variation, not an error)
A word passes if one variant matches.

Writes out/g2p.json and prints the figures. Run: python3 rnd/prononciation/g2p.py
With --source piper, uses Piper's own reading (out/piper_g2p.json, from piper_g2p.py): its
bundled eSpeak NG switches to English less often than the system one (1.52).
"""

import json
import subprocess
import sys
import unicodedata
from pathlib import Path

OUT = Path(__file__).parent / "out"

DROP = set("ˈˌː.‿ ()-") | {"͡", "͜"}
# eSpeak NG writes a few French phonemes differently from Wiktionnaire.
UNIFY = {"ɚ": "əʁ", "r": "ʁ", "ɐ": "a", "ɡ": "ɡ", "g": "ɡ", "ɜ": "ə"}
LENIENT = {"ɛ": "e", "ɔ": "o", "œ": "ø", "ə": "ø", "ɑ": "a", "œ̃": "ɛ̃"}


def tokens(ipa: str) -> list[str]:
    ipa = unicodedata.normalize("NFD", ipa)
    out: list[str] = []
    for ch in ipa:
        if ch in DROP:
            continue
        if unicodedata.combining(ch):
            if out and ch == "̃":
                out[-1] += ch
            continue
        out.append(UNIFY.get(ch, ch))
    return [unicodedata.normalize("NFC", t) for t in out]


VOWELS = set("aeiouyøɛɔœɑə") | {"ɛ̃", "ɑ̃", "ɔ̃", "œ̃"}


def lenient(toks: list[str]) -> list[str]:
    # Also merges what French speakers vary on: optional schwa, gn read [nj] or [ɲ],
    # glides against hiatus (ébrouer [ebʁwe] or [ebʁue], câprière [kapʁiɛʁ] or [kapʁijɛʁ]),
    # and geminates (callipédie [kalipedi] or [kallipedi]).
    seq = "".join(LENIENT.get(t, t) + "|" for t in toks).replace("n|j|", "ɲ|")
    out = [t for t in seq.split("|") if t]
    out = [{"ɥ": "y", "w": "u"}.get(t, t) for t in out]
    merged: list[str] = []
    for t in out:
        if t == "j" and merged and merged[-1] in ("i", "j"):
            continue
        if merged and t == merged[-1] and t not in VOWELS:
            continue
        merged.append(t)
    return merged


def no_schwa(toks: list[str]) -> list[str]:
    return [t for t in toks if t != "ə"]


def category(got: str, ref: list[str]) -> str:
    """Rough label for a miss, for the report."""
    if "(en)" in got or any(m in got for m in ("θ", "ɹ", "ɪ", "ː")):
        return "langue"
    g, r = tokens(got), tokens(ref[0])
    if len(r) > len(g) and r[: len(g)] == g or (r and g and r[-1] in "stkpʁl" and g[-1] != r[-1] and r[:-1][-2:] == g[-2:]):
        return "finale"
    if "ʃ" in g and "k" in r and "ʃ" not in r:
        return "ch-grec"
    return "autre"


def espeak(words: list[str]) -> dict[str, str]:
    # One process for all words, one per line, keeps it under a second.
    res = subprocess.run(
        ["espeak-ng", "-v", "fr", "-q", "--ipa"],
        input="\n".join(words),
        capture_output=True,
        text=True,
        check=True,
    )
    lines = [line.strip() for line in res.stdout.splitlines() if line.strip()]
    if len(lines) != len(words):
        return {w: subprocess.run(["espeak-ng", "-v", "fr", "-q", "--ipa", w], capture_output=True, text=True).stdout.strip() for w in words}
    return dict(zip(words, lines, strict=True))


def main() -> None:
    wikt = json.loads((OUT / "wiktionary.json").read_text())
    words = [w for w, v in wikt.items() if v.get("ipa")]
    piper = sys.argv[1:] == ["--source", "piper"]
    readings = json.loads((OUT / "piper_g2p.json").read_text()) if piper else espeak(words)
    rows = {}
    strict = loose = 0
    for w in words:
        ref = [tokens(i) for i in dict.fromkeys(wikt[w]["ipa"])]
        got = tokens(readings[w])
        s = any(got == r for r in ref)
        lo = any(lenient(no_schwa(got)) == lenient(no_schwa(r)) for r in ref)
        strict += s
        loose += lo
        rows[w] = {"espeak": readings[w], "wiktionary": wikt[w]["ipa"], "strict": s, "lenient": lo}
        if not lo:
            rows[w]["category"] = category(readings[w], wikt[w]["ipa"])
    (OUT / ("g2p_piper.json" if piper else "g2p.json")).write_text(json.dumps(rows, ensure_ascii=False, indent=1))
    n = len(words)
    print(f"words with IPA {n}")
    print(f"eSpeak NG strict match {strict} ({100 * strict / n:.1f} %)")
    print(f"eSpeak NG lenient match {loose} ({100 * loose / n:.1f} %)")
    misses = [w for w in words if not rows[w]["lenient"]]
    cats: dict[str, list[str]] = {}
    for w in misses:
        cats.setdefault(rows[w]["category"], []).append(w)
    for cat, ws in cats.items():
        print(f"{cat}: {len(ws)}")
        for w in ws[:25]:
            print(f"  {w}: espeak {rows[w]['espeak']}  wikt {' / '.join(dict.fromkeys(rows[w]['wiktionary']))}")


if __name__ == "__main__":
    main()
