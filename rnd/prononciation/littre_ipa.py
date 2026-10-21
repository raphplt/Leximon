"""Throwaway: Littré respelling ("ko-ro-gra-f'") to IPA with a small rule table, scored
against Wiktionnaire on every catalogue word that has both (out/sources.json, from sources.py).

The Littré notes each syllable with French spelling made regular: z is written when s
sounds [z], an apostrophe marks a sounded final consonant, "ll mouillées" means [j].
First reading only (before the first comma, semicolon or "ou").

Run: python3 rnd/prononciation/littre_ipa.py
"""

import json
import random
import re
from pathlib import Path

from g2p import lenient, no_schwa, tokens

OUT = Path(__file__).parent / "out"

# Longest match first. Nasal vowels only at the end of a syllable or before a consonant
# (handled in syllable_ipa).
VOWELS = [
    ("eau", "o"), ("au", "o"), ("oî", "wa"), ("ou", "u"), ("oi", "wa"), ("eû", "ø"), ("eu", "ø"), ("œu", "ø"),
    ("ai", "ɛ"), ("ei", "ɛ"), ("è", "ɛ"), ("ê", "ɛ"), ("é", "e"), ("â", "ɑ"), ("à", "a"), ("a", "a"),
    ("î", "i"), ("ï", "i"), ("i", "i"), ("ô", "o"), ("o", "ɔ"), ("û", "y"), ("ü", "y"), ("u", "y"),
    ("y", "i"), ("e", "ə"),
]
NASALS = [("oin", "wɛ̃"), ("ain", "ɛ̃"), ("ein", "ɛ̃"), ("in", "ɛ̃"), ("im", "ɛ̃"), ("an", "ɑ̃"), ("am", "ɑ̃"),
          ("en", "ɑ̃"), ("em", "ɑ̃"), ("on", "ɔ̃"), ("om", "ɔ̃"), ("un", "œ̃"), ("um", "œ̃")]
CONSONANTS = [
    ("ch", "ʃ"), ("gn", "ɲ"), ("gh", "ɡ"), ("qu", "k"), ("ph", "f"), ("th", "t"),
    ("ll", "l"), ("ss", "s"), ("b", "b"), ("c", "k"), ("d", "d"), ("f", "f"), ("g", "ɡ"),
    ("h", ""), ("j", "ʒ"), ("k", "k"), ("l", "l"), ("m", "m"), ("n", "n"), ("p", "p"),
    ("r", "ʁ"), ("s", "s"), ("t", "t"), ("v", "v"), ("w", "w"), ("x", "ks"), ("z", "z"),
    ("Y", "j"),  # ll mouillées
]
VOWEL_IPA = set("aeiouyøɛɔəɑœ")


def first_reading(pron: str) -> tuple[str, bool]:
    mouillees = "mouill" in pron
    pron = re.split(r"[,;.:(]| ou | et | [A-Z]", pron.replace("\xa0", " "))[0].strip()
    return pron, mouillees


def syllable_ipa(syl: str, mouillees: bool) -> list[str]:
    out: list[str] = []
    sounded_final = syl.endswith("'")
    syl = syl.rstrip("'").replace("'", "")
    if mouillees:
        syl = syl.replace("ill", "iY").replace("ll", "Y")
    i = 0
    while i < len(syl):
        rest = syl[i:]
        nasal = next((n for n in NASALS if rest.startswith(n[0])), None)
        if nasal:
            after = rest[len(nasal[0]) :]
            # Nasal at the end of the syllable or before a consonant, unless the n/m is sounded.
            if (not after and not sounded_final) or (after and after[0] not in "aeiouyéèêâîôûœ" and after[0] not in "nm"):
                out.append(nasal[1])
                i += len(nasal[0])
                continue
        vowel = next((v for v in VOWELS if rest.startswith(v[0])), None)
        if vowel:
            ipa = vowel[1]
            nxt = syl[i + len(vowel[0]) : i + len(vowel[0]) + 1]
            # i, u, ou before another vowel in the same syllable are glides.
            final_mute_e = syl[i + len(vowel[0]) :] == "e"
            if nxt and nxt in "aeiouyéèêâîôûœ" and ipa in ("i", "y", "u") and not final_mute_e:
                ipa = {"i": "j", "y": "ɥ", "u": "w"}[ipa]
            if ipa == "ə" and i + 1 < len(syl):  # e followed by a consonant in the syllable
                ipa = "ɛ"
            out.append(ipa)
            i += len(vowel[0])
            continue
        # gu and g before e, i: spelling habits the Littré keeps now and then (ghe, gie).
        if rest.startswith("gu") and rest[2:3] and rest[2] in "eiéèê":
            out.append("ɡ")
            i += 2
            continue
        if rest.startswith("g") and rest[1:2] and rest[1] in "eiéèê":
            out.append("ʒ")
            i += 1
            continue
        cons = next((c for c in CONSONANTS if rest.startswith(c[0])), None)
        if cons:
            if cons[1] and not (out and out[-1] == cons[1]):
                out.append(cons[1])
            i += len(cons[0])
            continue
        i += 1  # unknown character: skipped
    return out


def littre_to_ipa(pron: str) -> str:
    reading, mouillees = first_reading(pron)
    syllables = [s for s in re.split(r"[-\s]+", reading) if s]
    phones: list[str] = []
    for n, syl in enumerate(syllables):
        ph = syllable_ipa(syl, mouillees)
        # A mute e closing the last syllable is not sounded (ko-ro-gra-fe).
        if n == len(syllables) - 1 and ph and ph[-1] == "ə" and len(ph) > 1:
            ph = ph[:-1]
        phones += ph
    return "".join(phones)


def main() -> None:
    src = json.loads((OUT / "sources.json").read_text())
    wikt = json.loads((OUT / "wiktionary.json").read_text())
    raw = json.loads((OUT / "g2p_piper.json").read_text())
    words = [w for w, p in src["littre"].items() if p and wikt.get(w, {}).get("ipa")]
    rows = {}
    for w in words:
        got = littre_to_ipa(src["littre"][w][0])
        refs = [lenient(no_schwa(tokens(i))) for i in dict.fromkeys(wikt[w]["ipa"])]
        g = lenient(no_schwa(tokens(got)))
        espeak = lenient(no_schwa(tokens(raw[w]["espeak"])))
        rows[w] = {"littre": src["littre"][w][0], "ipa": got, "ok": g in refs, "agree_espeak": g == espeak, "espeak_ok": raw[w]["lenient"]}
    n = len(rows)
    ok = sum(r["ok"] for r in rows.values())
    agree = [r for r in rows.values() if r["agree_espeak"]]
    dis = [r for r in rows.values() if not r["agree_espeak"]]
    print(f"words {n}; Littré rules match Wiktionnaire {ok} ({100 * ok / n:.1f} %)")
    print(f"agree with eSpeak NG {len(agree)} ({100 * len(agree) / n:.1f} %), of which right {sum(r['ok'] for r in agree)}")
    print(
        f"disagree {len(dis)}: Littré right {sum(r['ok'] and not r['espeak_ok'] for r in dis)}, "
        f"eSpeak right {sum(r['espeak_ok'] and not r['ok'] for r in dis)}, both {sum(r['ok'] and r['espeak_ok'] for r in dis)}, "
        f"neither {sum(not r['ok'] and not r['espeak_ok'] for r in dis)}"
    )
    (OUT / "littre_ipa.json").write_text(json.dumps(rows, ensure_ascii=False, indent=1))
    rng = random.Random(3)
    misses = [w for w, r in rows.items() if not r["ok"]]
    for w in rng.sample(misses, min(25, len(misses))):
        print(f"  {w}: {rows[w]['littre'][:40]!r} -> {rows[w]['ipa']}  wikt {wikt[w]['ipa'][0]}")
    hard = [x["word"] for x in json.loads((Path(__file__).parent / "words20.json").read_text())]
    print("hard words right:", sum(rows[w]["ok"] for w in hard if w in rows), "/", len(hard))


if __name__ == "__main__":
    main()
