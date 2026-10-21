"""Throwaway: download one human recording for the 20 hard words and for 40 random words
with a recording, then measure duration, peak and mean level, and leading/trailing silence
with ffmpeg. Writes out/human/ (audio, not versioned) and out/human.json.

Uses the licences found by wiki.py. One download at a time, identifiable User-Agent.
Run: python3 rnd/prononciation/human_sample.py
"""

import json
import random
import re
import subprocess
import time
import urllib.request
from pathlib import Path

from wiki import UA, all_files, cached, load_words

OUT = Path(__file__).parent / "out"


def measure(path: Path) -> dict:
    vol = subprocess.run(
        ["ffmpeg", "-hide_banner", "-i", str(path), "-af", "volumedetect,silencedetect=n=-45dB:d=0.15", "-f", "null", "-"],
        capture_output=True,
        text=True,
    ).stderr
    dur = float(re.search(r"Duration: (\d+):(\d+):([\d.]+)", vol).group(3))
    mean = float(re.search(r"mean_volume: (-?[\d.]+) dB", vol).group(1))
    peak = float(re.search(r"max_volume: (-?[\d.]+) dB", vol).group(1))
    starts = [float(x) for x in re.findall(r"silence_start: (-?[\d.]+)", vol)]
    ends = [float(x) for x in re.findall(r"silence_end: ([\d.]+)", vol)]
    lead = ends[0] if starts and starts[0] <= 0.01 and ends else 0.0
    trail = dur - starts[-1] if starts and (len(ends) < len(starts)) else 0.0
    return {"duration": dur, "mean_db": mean, "peak_db": peak, "lead_silence": round(lead, 2), "trail_silence": round(trail, 2)}


def main() -> None:
    words = load_words()
    lic = cached("licences")
    files = {w: sorted(f for f in fs if lic.get(f)) for w, fs in all_files(words).items()}
    hard = [x["word"] for x in json.loads((Path(__file__).parent / "words20.json").read_text())]
    rng = random.Random(20261021)
    pool = [w for w in words if files[w] and w not in hard]
    sample = [w for w in hard if files[w]] + rng.sample(pool, 40)
    dest = OUT / "human"
    dest.mkdir(parents=True, exist_ok=True)
    rows = cached("human")
    for w in sample:
        if w in rows:
            continue
        title = files[w][0]
        meta = lic[title]
        path = dest / f"{w}{Path(meta['url']).suffix}"
        if not path.exists():
            req = urllib.request.Request(meta["url"], headers={"User-Agent": UA})
            with urllib.request.urlopen(req, timeout=60) as resp:
                path.write_bytes(resp.read())
            time.sleep(1)
        opus = path.with_suffix(".opus")
        subprocess.run(
            ["ffmpeg", "-y", "-loglevel", "error", "-i", str(path), "-ac", "1", "-c:a", "libopus", "-b:a", "24k", str(opus)],
            check=True,
        )
        rows[w] = {
            "file": title,
            "licence": meta["licence"],
            "artist": meta["artist"],
            "recordings": len(files[w]),
            "hard": w in hard,
            "source_bytes": path.stat().st_size,
            "opus_bytes": opus.stat().st_size,
            **measure(path),
        }
        print(w, rows[w]["duration"], rows[w]["mean_db"], rows[w]["peak_db"], rows[w]["lead_silence"], rows[w]["trail_silence"], flush=True)
    (OUT / "human.json").write_text(json.dumps(rows, ensure_ascii=False, indent=1))


if __name__ == "__main__":
    main()
