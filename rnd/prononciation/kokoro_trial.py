# /// script
# requires-python = ">=3.11,<3.14"
# dependencies = ["kokoro==0.9.4", "soundfile", "numpy", "torch==2.9.1"]
# [[tool.uv.index]]
# name = "pytorch-cpu"
# url = "https://download.pytorch.org/whl/cpu"
# explicit = true
# [tool.uv.sources]
# torch = { index = "pytorch-cpu" }
# ///
"""Throwaway trial: Kokoro-82M (Apache 2.0 weights, French voice ff_siwis, SIWIS data CC BY)
on the hard words, raw (Kokoro's own eSpeak NG reading) and guided (phonemes given directly).

Weights download once into the Hugging Face cache (about 330 MB).
Writes out/audio/<word>.kokoro-raw.opus and .kokoro-guided.opus, and out/kokoro.json.
Run: uv run rnd/prononciation/kokoro_trial.py [words.json]
"""

import json
import subprocess
import sys
import time
from pathlib import Path

import numpy as np
import soundfile as sf
from kokoro import KPipeline

HERE = Path(__file__).parent
OUT = HERE / "out"
VOICE = "ff_siwis"
VOWELS = set("aeiouyøɛɔœɑə")


def guided_phonemes(ipa: str) -> str:
    """Wiktionnaire IPA as Kokoro expects it: no syllable dots, stress before the last vowel."""
    syllables = [s for s in ipa.replace("‿", ".").replace("(", "").replace(")", "").split(".") if s]
    last = syllables[-1]
    for i, ch in enumerate(last):
        if ch in VOWELS:
            last = last[:i] + "ˈ" + last[i:]
            break
    return "".join(syllables[:-1]) + last


def save_opus(audio: np.ndarray, path: Path) -> int:
    wav = path.with_suffix(".wav")
    sf.write(wav, audio, 24000)
    subprocess.run(
        ["ffmpeg", "-y", "-loglevel", "error", "-i", str(wav), "-ac", "1", "-c:a", "libopus", "-b:a", "24k", str(path)],
        check=True,
    )
    wav.unlink()
    return path.stat().st_size


def main(words_file: Path) -> None:
    words = json.loads(words_file.read_text())
    pipeline = KPipeline(lang_code="f", repo_id="hexgrad/Kokoro-82M")
    rows = {}
    for item in words:
        word, ipa = item["word"], item["ipa"]
        t0 = time.perf_counter()
        results = list(pipeline(word, voice=VOICE))
        raw_ms = (time.perf_counter() - t0) * 1000
        raw_audio = np.concatenate([r.audio.numpy() for r in results])
        raw_ph = "".join(r.phonemes for r in results)
        guided = guided_phonemes(ipa)
        g_results = list(pipeline.generate_from_tokens(tokens=guided, voice=VOICE))
        g_audio = np.concatenate([r.audio.numpy() for r in g_results])
        rows[word] = {
            "ipa": ipa,
            "raw_phonemes": raw_ph,
            "guided_phonemes": guided,
            "raw_ms": round(raw_ms),
            "raw_bytes": save_opus(raw_audio, OUT / "audio" / f"{word}.kokoro-raw.opus"),
            "guided_bytes": save_opus(g_audio, OUT / "audio" / f"{word}.kokoro-guided.opus"),
        }
        print(f"{word:16} raw {raw_ph:20} guided {guided:20} {raw_ms:.0f} ms", flush=True)
    path = OUT / "kokoro.json"
    previous = json.loads(path.read_text()) if path.exists() else {}
    path.write_text(json.dumps(previous | rows, ensure_ascii=False, indent=1))


if __name__ == "__main__":
    main(Path(sys.argv[1]) if len(sys.argv) > 1 else HERE / "words20.json")
