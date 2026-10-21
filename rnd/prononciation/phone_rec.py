# /// script
# requires-python = ">=3.11,<3.14"
# dependencies = ["torch==2.9.1", "transformers==4.57.1", "soundfile", "numpy", "phonemizer==3.3.0"]
# [[tool.uv.index]]
# name = "pytorch-cpu"
# url = "https://download.pytorch.org/whl/cpu"
# explicit = true
# [tool.uv.sources]
# torch = { index = "pytorch-cpu" }
# ///
"""Throwaway check: what does each audio file actually say, in phonemes?

Runs the multilingual phoneme recogniser facebook/wav2vec2-lv-60-espeak-cv-ft (eSpeak-style
IPA output, about 1.3 GB, downloaded once into the Hugging Face cache) on every audio file
given, and writes out/recognised.json. The recogniser is noisy (it was trained on Common
Voice); it is used only to check the one sound each hard word turns on (final consonant,
[k] against [ʃ], language switch), never as an overall score.

Run: uv run rnd/prononciation/phone_rec.py out/audio/*.opus out/human/*
"""

import json
import subprocess
import sys
from pathlib import Path

import numpy as np
import torch
from transformers import AutoModelForCTC, AutoProcessor

OUT = Path(__file__).parent / "out"
MODEL = "facebook/wav2vec2-lv-60-espeak-cv-ft"


def load_16k(path: Path) -> np.ndarray:
    raw = subprocess.run(
        ["ffmpeg", "-loglevel", "error", "-i", str(path), "-ac", "1", "-ar", "16000", "-f", "f32le", "-"],
        capture_output=True,
        check=True,
    ).stdout
    # Silence on both sides: the recogniser drops the edges of a clip under a second.
    pad = np.zeros(4000, dtype=np.float32)
    return np.concatenate([pad, np.frombuffer(raw, dtype=np.float32), pad])


def main(paths: list[Path]) -> None:
    processor = AutoProcessor.from_pretrained(MODEL)
    model = AutoModelForCTC.from_pretrained(MODEL).eval()
    path_out = OUT / "recognised.json"
    results = json.loads(path_out.read_text()) if path_out.exists() else {}
    for path in paths:
        audio = load_16k(path)
        inputs = processor(audio, sampling_rate=16000, return_tensors="pt")
        with torch.no_grad():
            logits = model(inputs.input_values).logits
        ids = torch.argmax(logits, dim=-1)
        text = processor.batch_decode(ids)[0]
        results[path.name] = text.replace(" ", "")
        print(f"{path.name:50} {results[path.name]}", flush=True)
    path_out.write_text(json.dumps(results, ensure_ascii=False, indent=1))


if __name__ == "__main__":
    main([Path(p) for p in sys.argv[1:]])
