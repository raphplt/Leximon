# /// script
# requires-python = ">=3.11"
# dependencies = ["piper-tts==1.8.0"]
# ///
"""Throwaway: Piper's own reading (its bundled eSpeak NG) of every catalogue word with an IPA,
written to out/piper_g2p.json for g2p.py --source piper.

Run: uv run rnd/prononciation/piper_g2p.py <dir with fr_FR-siwis-medium.onnx>
"""

import json
import sys
from pathlib import Path

from piper import PiperVoice

OUT = Path(__file__).parent / "out"

voice = PiperVoice.load(str(Path(sys.argv[1]) / "fr_FR-siwis-medium.onnx"))
wikt = json.loads((OUT / "wiktionary.json").read_text())
readings = {w: "".join(voice.phonemize(w)[0]) for w, v in wikt.items() if v.get("ipa")}
(OUT / "piper_g2p.json").write_text(json.dumps(readings, ensure_ascii=False, indent=1))
print(len(readings))
