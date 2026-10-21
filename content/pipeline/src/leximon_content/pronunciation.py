"""Pronunciation of every card (D-032, docs/rnd/prononciation.md): a phonetic notation checked
against two readings, then one synthetic voice reading the word guided by that notation.

The notation comes from the Littré respelling ("ko-ro-gra-f'"), turned into IPA by rules. It is
accepted when eSpeak NG reads the word the same way. When they disagree, the Wiktionnaire
notation decides between them and is never copied (`carte-mot`: Wiktionnaire only checks).
What nobody settles goes to the owner, in `corrections.json`.

Audio: Google Cloud Text-to-Speech, voice Chirp 3 HD Charon, EU endpoint, SSML `<phoneme>`.
Files are MP3 (read everywhere, old iPhones included), named after their content
(`prononciation/<card>.<hash12>.mp3`), like the engravings.
"""

import base64
import hashlib
import json
import re
import subprocess
import time
import unicodedata
from collections.abc import Mapping, Sequence
from dataclasses import asdict, dataclass
from pathlib import Path
from xml.sax.saxutils import escape, quoteattr

import httpx

from .config import DATA_DIR

PRONUNCIATION_DIR = DATA_DIR / "prononciation"
NOTATION_FILE = PRONUNCIATION_DIR / "notation.json"
#: The owner's notation for the words nobody settled: {"card-id": "ipa"}.
CORRECTIONS_FILE = PRONUNCIATION_DIR / "corrections.json"
WIKTIONARY_FILE = PRONUNCIATION_DIR / "wiktionnaire.json"
OUT_DIR = PRONUNCIATION_DIR / "out"
RENDERED_FILE = OUT_DIR / "rendered.json"
#: Published paths start with this folder, relative to the catalogue root (and to OUT_DIR).
PUBLISHED_FOLDER = "prononciation"
HASH_LENGTH = 12

VOICE = "fr-FR-Chirp3-HD-Charon"
TTS_ENDPOINT = "https://eu-texttospeech.googleapis.com/v1/text:synthesize"
#: Public price of Chirp 3 HD, in dollars per million characters (SSML tags are billed).
PRICE_PER_MILLION = 30.0
WIKTIONARY_API = "https://fr.wiktionary.org/w/api.php"
#: Wikimedia answers 429 to a User-Agent without a contact.
USER_AGENT = "LeximonContentPipeline/0.1 (https://leximon.fr; contact@leximon.fr)"

# --- Littré respelling to IPA ---------------------------------------------------------------------

_VOWEL_LETTERS = "aeiouyéèêâîôûœ"
# Longest match first.
_VOWELS = (
    ("eau", "o"), ("au", "o"), ("oî", "wa"), ("ou", "u"), ("oi", "wa"), ("eû", "ø"), ("eu", "ø"),
    ("œu", "ø"), ("ai", "ɛ"), ("ei", "ɛ"), ("è", "ɛ"), ("ê", "ɛ"), ("é", "e"), ("â", "ɑ"),
    ("à", "a"), ("a", "a"), ("î", "i"), ("ï", "i"), ("i", "i"), ("ô", "o"), ("o", "ɔ"),
    ("û", "y"), ("ü", "y"), ("u", "y"), ("y", "i"), ("e", "ə"),
)  # fmt: skip
_NASALS = (
    ("oin", "wɛ̃"), ("ain", "ɛ̃"), ("ein", "ɛ̃"), ("in", "ɛ̃"), ("im", "ɛ̃"), ("an", "ɑ̃"),
    ("am", "ɑ̃"), ("en", "ɑ̃"), ("em", "ɑ̃"), ("on", "ɔ̃"), ("om", "ɔ̃"), ("un", "œ̃"), ("um", "œ̃"),
)  # fmt: skip
_CONSONANTS = (
    ("ch", "ʃ"), ("gn", "ɲ"), ("gh", "ɡ"), ("qu", "k"), ("ph", "f"), ("th", "t"), ("ll", "l"),
    ("ss", "s"), ("b", "b"), ("c", "k"), ("d", "d"), ("f", "f"), ("g", "ɡ"), ("h", ""),
    ("j", "ʒ"), ("k", "k"), ("l", "l"), ("m", "m"), ("n", "n"), ("p", "p"), ("r", "ʁ"),
    ("s", "s"), ("t", "t"), ("v", "v"), ("w", "w"), ("x", "ks"), ("z", "z"),
    ("Y", "j"),  # ll mouillées
)  # fmt: skip


def first_reading(pron: str) -> tuple[str, bool]:
    """The first reading of a Littré respelling, and whether its "ll" are "mouillées" ([j])."""
    mouillees = "mouill" in pron
    reading = re.split(r"[,;.:(]| ou | et | [A-Z]", pron.replace("\xa0", " "))[0].strip()
    return reading, mouillees


def _syllable(syl: str, mouillees: bool) -> list[str]:
    out: list[str] = []
    # The apostrophe marks a sounded final consonant: "an-be-zas'".
    sounded_final = syl.endswith("'")
    syl = syl.rstrip("'").replace("'", "")
    if mouillees:
        syl = syl.replace("ill", "iY").replace("ll", "Y")
    i = 0
    while i < len(syl):
        rest = syl[i:]
        nasal = next((n for n in _NASALS if rest.startswith(n[0])), None)
        if nasal:
            after = rest[len(nasal[0]) :]
            # A nasal vowel ends the syllable or comes before a consonant other than n, m.
            if (not after and not sounded_final) or (
                after and after[0] not in _VOWEL_LETTERS and after[0] not in "nm"
            ):
                out.append(nasal[1])
                i += len(nasal[0])
                continue
        vowel = next((v for v in _VOWELS if rest.startswith(v[0])), None)
        if vowel:
            ipa = vowel[1]
            following = syl[i + len(vowel[0]) :]
            # i, u, ou before another vowel of the syllable are glides ("piè"), except before
            # a final mute e ("rie").
            if following[:1] and following[0] in _VOWEL_LETTERS and following != "e":
                ipa = {"i": "j", "y": "ɥ", "u": "w"}.get(ipa, ipa)
            if ipa == "ə" and following:  # e before a consonant of the same syllable
                ipa = "ɛ"
            out.append(ipa)
            i += len(vowel[0])
            continue
        if rest.startswith("gu") and rest[2:3] and rest[2] in "eiéèê":
            out.append("ɡ")
            i += 2
            continue
        if rest.startswith("g") and rest[1:2] and rest[1] in "eiéèê":
            out.append("ʒ")
            i += 1
            continue
        consonant = next((c for c in _CONSONANTS if rest.startswith(c[0])), None)
        if consonant and consonant[1] and not (out and out[-1] == consonant[1]):
            out.append(consonant[1])
        i += len(consonant[0]) if consonant else 1
    return out


def littre_to_ipa(pron: str) -> str:
    """IPA of a Littré respelling: "ko-ro-gra-f'" -> "kɔʁɔɡʁaf". Empty when there is none."""
    reading, mouillees = first_reading(pron)
    syllables = [s for s in re.split(r"[-\s]+", reading) if s]
    phones: list[str] = []
    for n, syl in enumerate(syllables):
        ph = _syllable(syl, mouillees)
        # A mute e closing the word is not sounded: "ko-ro-gra-fe".
        if n == len(syllables) - 1 and len(ph) > 1 and ph[-1] == "ə":
            ph = ph[:-1]
        phones += ph
    return "".join(phones)


# --- Comparing notations --------------------------------------------------------------------------

_DROP = set("ˈˌː.‿ ()-") | {"͡", "͜"}
_UNIFY = {"ɚ": "əʁ", "r": "ʁ", "ɐ": "a", "g": "ɡ", "ɜ": "ə"}
# Oppositions French speakers vary on: not an error.
_MERGE = {"ɛ": "e", "ɔ": "o", "œ": "ø", "ɑ": "a", "œ̃": "ɛ̃", "ɥ": "y", "w": "u"}
_VOWEL_PHONES = set("aeiouyøɛɔœɑə") | {"ɛ̃", "ɑ̃", "ɔ̃", "œ̃"}


def phones(ipa: str) -> list[str]:
    """IPA as a list of phones, marks dropped, nasal vowels kept whole."""
    out: list[str] = []
    for ch in unicodedata.normalize("NFD", ipa):
        if ch in _DROP:
            continue
        if unicodedata.combining(ch):
            if out and ch == "̃":
                out[-1] += ch
            continue
        out.append(_UNIFY.get(ch, ch))
    return [unicodedata.normalize("NFC", p) for p in out]


def skeleton(ipa: str) -> list[str]:
    """What two readings must share to count as the same: no schwa, mid vowels merged, gn read
    [nj] or [ɲ], glides or hiatus, single or double consonants."""
    seq = "".join(_MERGE.get(p, p) + "|" for p in phones(ipa) if p != "ə")
    merged: list[str] = []
    for p in (p for p in seq.replace("n|j|", "ɲ|").split("|") if p):
        if p == "j" and merged and merged[-1] in ("i", "j"):
            continue
        if merged and p == merged[-1] and p not in _VOWEL_PHONES:
            continue
        merged.append(p)
    return merged


def same(a: str, b: str) -> bool:
    return bool(a) and bool(b) and skeleton(a) == skeleton(b)


def clean_espeak(reading: str) -> str:
    """eSpeak NG's IPA without stress marks; empty when it switched to another language
    ("(en)lˈeɪθɪfə(fr)"): that reading is worthless for a French word."""
    if "(" in reading:
        return ""
    return "".join(reading.split()).replace("ˈ", "").replace("ˌ", "")


# --- Deciding the notation ------------------------------------------------------------------------


@dataclass(frozen=True)
class Notation:
    card: str
    word: str
    littre: str
    littre_ipa: str
    espeak: str
    wiktionary: tuple[str, ...]
    #: The notation the voice reads, empty while it waits for the owner.
    ipa: str
    #: accord (Littré = eSpeak), littre or espeak (the Wiktionnaire decided), relu (owner),
    #: a-relire (waiting for the owner).
    status: str


def decide(
    card: str,
    word: str,
    littre: str,
    espeak: str,
    wiktionary: Sequence[str],
    correction: str | None = None,
) -> Notation:
    littre_ipa = littre_to_ipa(littre) if littre else ""
    espeak_ipa = clean_espeak(espeak)

    def notation(ipa: str, status: str) -> Notation:
        return Notation(card, word, littre, littre_ipa, espeak, tuple(wiktionary), ipa, status)

    if correction:
        return notation(correction, "relu")
    # eSpeak's reading carries the modern vowels; the Littré confirms the consonants.
    if same(littre_ipa, espeak_ipa):
        return notation(espeak_ipa, "accord")
    if any(same(littre_ipa, w) for w in wiktionary):
        return notation(littre_ipa, "littre")
    if any(same(espeak_ipa, w) for w in wiktionary):
        return notation(espeak_ipa, "espeak")
    return notation("", "a-relire")


# --- Audio files ----------------------------------------------------------------------------------


def ssml(word: str, ipa: str) -> str:
    return f'<speak><phoneme alphabet="ipa" ph={quoteattr(ipa)}>{escape(word)}</phoneme></speak>'


def content_hash(content: bytes) -> str:
    return hashlib.sha256(content).hexdigest()[:HASH_LENGTH]


def published_path(card: str, content: bytes) -> str:
    """`prononciation/<card>.<hash12>.mp3`, relative to the catalogue root."""
    return f"{PUBLISHED_FOLDER}/{card}.{content_hash(content)}.mp3"


def billed_characters(notations: Sequence[Notation]) -> int:
    return sum(len(ssml(n.word, n.ipa)) for n in notations)


def estimated_cost(characters: int) -> float:
    return characters * PRICE_PER_MILLION / 1_000_000


def stale(notation: Notation, rendered: Mapping[str, Mapping[str, object]]) -> bool:
    """True when the card has no file yet, or one read from another notation or voice."""
    entry = rendered.get(notation.card)
    return entry is None or entry.get("ipa") != notation.ipa or entry.get("voice") != VOICE


def load_pronunciations(path: Path = RENDERED_FILE) -> dict[str, dict[str, object]]:
    """The catalogue `pronunciation` of every card with a file: {"ipa", "audio"}. Empty before
    the first `prononciation-audio`: every card is then released without one."""
    if not path.exists():
        return {}
    data = json.loads(path.read_text(encoding="utf-8"))
    return {card: {"ipa": e["ipa"], "audio": e["audio"]} for card, e in data["cards"].items()}


# --- I/O ------------------------------------------------------------------------------------------


def espeak_reading(word: str) -> str:
    result = subprocess.run(
        ["espeak-ng", "-v", "fr", "-q", "--ipa", word], capture_output=True, text=True, check=True
    )
    return " ".join(result.stdout.split())


_FR_SECTION = re.compile(r"^==\s*\{\{langue\|fr\}\}\s*==\s*$", re.M)
_NEXT_LANGUAGE = re.compile(r"^==\s*\{\{langue\|", re.M)
_PRON = re.compile(r"\{\{pron\|([^|}]*)\|fr\}\}")


def wiktionary_notations(text: str) -> list[str]:
    """Notations of the French section of a Wiktionnaire page, each once, in order."""
    start = _FR_SECTION.search(text)
    if start is None:
        return []
    rest = text[start.end() :]
    end = _NEXT_LANGUAGE.search(rest)
    section = rest[: end.start()] if end else rest
    return list(dict.fromkeys(p.strip() for p in _PRON.findall(section) if p.strip()))


def fetch_wiktionary(words: Sequence[str], cache: dict[str, list[str]]) -> dict[str, list[str]]:
    """Notations of each word on Wiktionnaire, 50 pages per request, one request a second,
    cached on disk (only to check, never copied into a card)."""
    todo = [w for w in words if w not in cache]
    with httpx.Client(headers={"User-Agent": USER_AGENT}, timeout=60) as http:
        for start in range(0, len(todo), 50):
            batch = todo[start : start + 50]
            response = _post_with_retry(
                http,
                WIKTIONARY_API,
                {
                    "action": "query",
                    "format": "json",
                    "formatversion": "2",
                    "prop": "revisions",
                    "rvprop": "content",
                    "rvslots": "main",
                    "titles": "|".join(batch),
                },
            )
            query = response.json()["query"]
            renamed = {n["to"]: n["from"] for n in query.get("normalized", [])}
            for page in query["pages"]:
                word = renamed.get(page["title"], page["title"])
                revisions = page.get("revisions")
                cache[word] = (
                    wiktionary_notations(revisions[0]["slots"]["main"]["content"])
                    if revisions
                    else []
                )
            for word in batch:
                cache.setdefault(word, [])
            WIKTIONARY_FILE.parent.mkdir(parents=True, exist_ok=True)
            WIKTIONARY_FILE.write_text(json.dumps(cache, ensure_ascii=False, indent=1))
            time.sleep(1)
    return cache


def _post_with_retry(http: httpx.Client, url: str, data: dict[str, str]) -> httpx.Response:
    for attempt in range(5):
        response = http.post(url, data=data)
        if response.status_code not in (429, 503):
            response.raise_for_status()
            return response
        time.sleep(10 * (attempt + 1))
    response.raise_for_status()
    return response


def synthesize(http: httpx.Client, api_key: str, word: str, ipa: str) -> bytes:
    response = http.post(
        TTS_ENDPOINT,
        # The key goes in a header, never in the URL, so that no log line holds it.
        headers={"X-Goog-Api-Key": api_key},
        json={
            "input": {"ssml": ssml(word, ipa)},
            "voice": {"languageCode": "fr-FR", "name": VOICE},
            "audioConfig": {"audioEncoding": "MP3", "sampleRateHertz": 24000},
        },
    )
    response.raise_for_status()
    return base64.b64decode(response.json()["audioContent"])


def read_json(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8")) if path.exists() else {}


def write_notations(notations: Sequence[Notation], path: Path = NOTATION_FILE) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    data = {n.card: asdict(n) for n in notations}
    path.write_text(json.dumps(data, ensure_ascii=False, indent=1), encoding="utf-8")


def read_notations(path: Path = NOTATION_FILE) -> list[Notation]:
    return [
        Notation(**{**entry, "wiktionary": tuple(entry["wiktionary"])})
        for entry in read_json(path).values()
    ]
