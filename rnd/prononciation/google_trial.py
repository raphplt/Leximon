"""Throwaway trial: Google Cloud Text-to-Speech on the 20 hard words, raw and guided by
SSML <phoneme alphabet="ipa">, through the EU endpoint.

Needs GOOGLE_TTS_API_KEY in the repo .env (API key restricted to the Text-to-Speech API).
Cost: about 3 000 characters in all, inside the free monthly allowance.
Writes out/audio/<word>.google-<voice>-{raw,guided}.opus and out/google.json (errors included:
the docs disagree on whether Chirp 3 HD accepts <phoneme>).

Stdlib only. Run: python3 rnd/prononciation/google_trial.py
"""

import base64
import json
import os
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

HERE = Path(__file__).parent
OUT = HERE / "out"
ENV = HERE.parents[1] / ".env"
ENDPOINT = "https://eu-texttospeech.googleapis.com/v1/text:synthesize"
VOICES = ["fr-FR-Chirp3-HD-Charon", "fr-FR-Chirp3-HD-Kore", "fr-FR-Neural2-G"]


def api_key() -> str:
    if os.environ.get("GOOGLE_TTS_API_KEY"):
        return os.environ["GOOGLE_TTS_API_KEY"]
    for line in ENV.read_text().splitlines():
        if line.startswith("GOOGLE_TTS_API_KEY="):
            return line.split("=", 1)[1].strip().strip('"')
    sys.exit("GOOGLE_TTS_API_KEY missing from .env")


def synthesize(key: str, voice: str, payload: dict) -> bytes:
    body = json.dumps(
        {
            "input": payload,
            "voice": {"languageCode": "fr-FR", "name": voice},
            "audioConfig": {"audioEncoding": "OGG_OPUS", "sampleRateHertz": 24000},
        }
    ).encode()
    # Key in a header, not in the URL, so it never lands in a log line.
    req = urllib.request.Request(
        ENDPOINT, data=body, headers={"Content-Type": "application/json", "X-Goog-Api-Key": key}
    )
    with urllib.request.urlopen(req, timeout=60) as resp:
        return base64.b64decode(json.load(resp)["audioContent"])


def main() -> None:
    key = api_key()
    words = json.loads((HERE / "words20.json").read_text())
    rows: dict = {}
    for voice in VOICES:
        short = voice.removeprefix("fr-FR-").lower()
        for item in words:
            word, ipa = item["word"], item["ipa"]
            guided = f'<speak><phoneme alphabet="ipa" ph="{ipa}">{word}</phoneme></speak>'
            for kind, payload in (("raw", {"text": word}), ("guided", {"ssml": guided})):
                path = OUT / "audio" / f"{word}.google-{short}-{kind}.opus"
                entry = rows.setdefault(word, {}).setdefault(f"{short}-{kind}", {})
                try:
                    path.write_bytes(synthesize(key, voice, payload))
                    entry["bytes"] = path.stat().st_size
                except urllib.error.HTTPError as err:
                    entry["error"] = f"{err.code} {err.read().decode()[:200]}"
                time.sleep(0.2)
            print(word, short, {k: ("ok" if "bytes" in v else v["error"][:60]) for k, v in rows[word].items() if k.startswith(short)}, flush=True)
    (OUT / "google.json").write_text(json.dumps(rows, ensure_ascii=False, indent=1))


if __name__ == "__main__":
    main()
