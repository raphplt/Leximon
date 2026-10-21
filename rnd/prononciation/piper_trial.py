# /// script
# requires-python = ">=3.11"
# dependencies = ["piper-tts==1.8.0"]
# ///
"""Throwaway trial: local neural voice (Piper, fr_FR-siwis-medium) on the 20 hard words.

For each word, two readings:
  raw     Piper's own reading (eSpeak NG grapheme-to-phoneme)
  guided  the Wiktionnaire IPA fed straight to the model as phonemes
Writes Opus files to out/audio/ and out/piper.json (phonemes, sizes, timings).

The voice is not in the repo. Download it first (63 MB, CC BY 4.0 voice, SIWIS dataset):
  https://huggingface.co/rhasspy/piper-voices/tree/main/fr/fr_FR/siwis/medium
Run: uv run rnd/prononciation/piper_trial.py <dir with fr_FR-siwis-medium.onnx> [words.json]
(words.json: [{"word", "ipa"}], default words20.json; words40.json is the random sample)
"""

import json
import subprocess
import sys
import time
import unicodedata
import wave
from pathlib import Path

from piper import PiperVoice

OUT = Path(__file__).parent / "out"

VOWELS = set("aeiouyøɛɔœɑə")


def guided_phonemes(ipa: str) -> list[str]:
    """Wiktionnaire IPA to Piper phonemes: syllable dots dropped, stress on the last syllable
    as eSpeak NG writes it, nasal tilde kept as its own symbol."""
    syllables = [s for s in ipa.replace("‿", ".").split(".") if s]
    last = syllables[-1]
    # Stress mark goes before the vowel of the last syllable, like eSpeak NG output.
    for i, ch in enumerate(last):
        if ch in VOWELS:
            last = last[:i] + "ˈ" + last[i:]
            break
    text = "".join(syllables[:-1]) + last
    text = text.replace("(", "").replace(")", "")
    return list(unicodedata.normalize("NFD", text))


def to_opus(wav: Path) -> Path:
    opus = wav.with_suffix(".opus")
    subprocess.run(
        ["ffmpeg", "-y", "-loglevel", "error", "-i", str(wav), "-ac", "1", "-c:a", "libopus", "-b:a", "24k", str(opus)],
        check=True,
    )
    wav.unlink()
    return opus


def write_wav(path: Path, voice: PiperVoice, audio_chunks) -> None:
    with wave.open(str(path), "wb") as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)
        wf.setframerate(voice.config.sample_rate)
        for chunk in audio_chunks:
            wf.writeframes(chunk)


def main(model_dir: Path, words_file: Path) -> None:
    words = json.loads(words_file.read_text())
    voice = PiperVoice.load(str(model_dir / "fr_FR-siwis-medium.onnx"))
    known = set(voice.config.phoneme_id_map)
    audio_dir = OUT / "audio"
    audio_dir.mkdir(parents=True, exist_ok=True)
    rows = {}
    for item in words:
        word, ipa = item["word"], item["ipa"]
        t0 = time.perf_counter()
        raw_wav = audio_dir / f"{word}.piper-raw.wav"
        with wave.open(str(raw_wav), "wb") as wf:
            voice.synthesize_wav(word, wf)
        raw_ms = (time.perf_counter() - t0) * 1000
        raw = "".join(voice.phonemize(word)[0])

        phonemes = guided_phonemes(ipa)
        unknown = sorted({p for p in phonemes if p not in known})
        ids = voice.phonemes_to_ids([p for p in phonemes if p in known])
        audio = voice.phoneme_ids_to_audio(ids)
        pcm = (audio * 32767).clip(-32768, 32767).astype("<i2").tobytes()
        guided_wav = audio_dir / f"{word}.piper-guided.wav"
        write_wav(guided_wav, voice, [pcm])

        raw_opus, guided_opus = to_opus(raw_wav), to_opus(guided_wav)
        rows[word] = {
            "ipa": ipa,
            "raw_phonemes": raw,
            "guided_phonemes": unicodedata.normalize("NFC", "".join(phonemes)),
            "unknown_symbols": unknown,
            "raw_ms": round(raw_ms),
            "raw_bytes": raw_opus.stat().st_size,
            "guided_bytes": guided_opus.stat().st_size,
        }
        print(f"{word:16} raw {raw:20} guided {rows[word]['guided_phonemes']:20} {unknown or ''}")
    path = OUT / "piper.json"
    previous = json.loads(path.read_text()) if path.exists() else {}
    path.write_text(json.dumps(previous | rows, ensure_ascii=False, indent=1))
    sizes = sorted(r["guided_bytes"] for r in rows.values())
    times = sorted(r["raw_ms"] for r in rows.values())
    print(f"median Opus 24 kbit/s size {sizes[len(sizes) // 2] / 1024:.1f} KiB, median synthesis {times[len(times) // 2]} ms")


if __name__ == "__main__":
    main(Path(sys.argv[1]), Path(sys.argv[2]) if len(sys.argv) > 2 else Path(__file__).parent / "words20.json")
