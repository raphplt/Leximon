"""The opening's sounds as WAV files, for the app, which plays files rather than synthesizing.

The web synthesizes each cue with the Web Audio API (apps/web/src/booster/feedback.ts). This
renders the same cues offline, node for node: the same white noise through the same biquad
filters, the same oscillators, the same exponential envelopes. A cue changed there is changed
here, then rendered again:

    uv run --no-project --with numpy python -I scripts/render_sounds.py assets/sounds

The tear's grains are random on the web; here a few are drawn once, with a fixed seed, and the
app picks among them.
"""

import math
import sys
import wave
from pathlib import Path

import numpy as np

RATE = 44100
rng = np.random.default_rng(1789)
NOISE = rng.uniform(-1, 1, RATE)

C5, E5, G5, A5 = 523.25, 659.25, 783.99, 880.0
C6, D6, E6, G6, C7 = 1046.5, 1174.66, 1318.51, 1567.98, 2093.0


def ramp(t, start, end, v0, v1):
    """An AudioParam set at `start` and ramped exponentially to `v1` at `end`, then held."""
    share = np.clip((t - start) / (end - start), 0, 1)
    return v0 * (v1 / v0) ** share


def envelope(t, start, attack, duration, gain):
    """0.0001 at the start, up to `gain` after `attack`, back down to 0.0001 at the end."""
    rise = ramp(t, start, start + attack, 0.0001, gain)
    fall = ramp(t, start + attack, start + duration, gain, 0.0001)
    return np.where(t < start + attack, rise, fall)


def biquad(signal, kind, frequency, q):
    """Web Audio's BiquadFilterNode, recomputed every sample since its frequency may move."""
    out = np.zeros_like(signal)
    x1 = x2 = y1 = y2 = 0.0
    for i, x in enumerate(signal):
        w0 = 2 * math.pi * frequency[i] / RATE
        cos, sin = math.cos(w0), math.sin(w0)
        if kind == "bandpass":
            alpha = sin / (2 * q)
            b0, b1, b2 = alpha, 0.0, -alpha
        else:
            # Low-pass and high-pass read Q in decibels.
            alpha = sin / (2 * 10 ** (q / 20))
            if kind == "lowpass":
                b0, b1, b2 = (1 - cos) / 2, 1 - cos, (1 - cos) / 2
            else:
                b0, b1, b2 = (1 + cos) / 2, -(1 + cos), (1 + cos) / 2
        a0, a1, a2 = 1 + alpha, -2 * cos, 1 - alpha
        y = (b0 * x + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2) / a0
        x2, x1, y2, y1 = x1, x, y1, y
        out[i] = y
    return out


class Cue:
    def __init__(self):
        self.parts = []

    def add(self, start, samples):
        self.parts.append((start, samples))

    def noise(self, duration, filter, frequency, gain, at=0.0, frequency_to=None, q=1.0):
        length = int((duration + 0.05) * RATE)
        offset = int(rng.uniform(0, 0.5) * RATE)
        source = np.resize(np.roll(NOISE, -offset), length)
        t = np.arange(length) / RATE
        cutoff = (
            np.full(length, frequency)
            if frequency_to is None
            else ramp(t, 0, duration, frequency, frequency_to)
        )
        filtered = biquad(source, filter, cutoff, q)
        self.add(at, filtered * envelope(t, 0, min(0.01, duration / 4), duration, gain))

    def tone(self, frequency, duration, gain, at=0.0, type="sine", frequency_to=None):
        length = int((duration + 0.05) * RATE)
        t = np.arange(length) / RATE
        pitch = (
            np.full(length, frequency)
            if frequency_to is None
            else ramp(t, 0, duration, frequency, frequency_to)
        )
        phase = np.cumsum(2 * math.pi * pitch / RATE)
        if type == "sine":
            wave_ = np.sin(phase)
        else:
            # Band-limited like Web Audio's: odd harmonics, each below the Nyquist frequency.
            wave_ = np.zeros(length)
            k = 0
            while (2 * k + 1) * max(frequency, frequency_to or 0) < RATE / 2:
                n = 2 * k + 1
                wave_ += (-1) ** k * np.sin(n * phase) / n**2
                k += 1
            wave_ *= 8 / math.pi**2
        self.add(at, wave_ * envelope(t, 0, 0.012, duration, gain))

    def bell(self, frequency, at, gain, duration=1.0):
        self.tone(frequency, duration, gain, at=at)
        self.tone(frequency * 2.01, duration * 0.6, gain * 0.35, at=at)
        self.tone(frequency * 3.02, duration * 0.35, gain * 0.15, at=at)

    def render(self):
        end = max(int(start * RATE) + len(samples) for start, samples in self.parts)
        mix = np.zeros(end)
        for start, samples in self.parts:
            begin = int(start * RATE)
            mix[begin : begin + len(samples)] += samples
        return np.clip(mix, -1, 1)


def seal_break(cue):
    cue.noise(0.09, "bandpass", 1400, 0.5, q=0.8)
    cue.tone(140, 0.25, 0.35, frequency_to=60)
    tear_finish(cue)


def tear_finish(cue):
    cue.noise(0.28, "bandpass", 1800, 0.32, at=0.04, frequency_to=5200, q=1.4)


def card_slide(cue):
    cue.noise(0.16, "lowpass", 2200, 0.16, frequency_to=700)


def flip(cue):
    cue.noise(0.05, "highpass", 2600, 0.18)
    cue.noise(0.04, "bandpass", 1600, 0.1, at=0.05)


def chime_rare(cue):
    flip(cue)
    cue.bell(E6, 0.02, 0.1, 0.7)
    cue.bell(G6, 0.1, 0.08, 0.8)


def rumble(cue):
    cue.tone(70, 0.6, 0.25, type="triangle")
    cue.noise(0.6, "lowpass", 300, 0.12)


def chime_precious(cue):
    flip(cue)
    for index, note in enumerate([C6, E6, G6, C7]):
        cue.bell(note, 0.02 + index * 0.07, 0.09, 1)


def crack(cue):
    cue.noise(0.12, "bandpass", 900, 0.55, q=0.7)
    cue.noise(0.08, "bandpass", 1300, 0.4, at=0.18)
    cue.tone(90, 0.4, 0.35, frequency_to=45)


def fanfare_epic(cue):
    flip(cue)
    for note in [C5, E5, G5, C6]:
        cue.tone(note, 1.6, 0.07, at=0.05, type="triangle")
    cue.bell(G6, 0.25, 0.08, 1.2)
    cue.bell(C7, 0.4, 0.06, 1.2)


def shimmer(cue):
    for index, note in enumerate([C6, D6, E6, G6, A5 * 2, C7]):
        cue.bell(note, index * 0.11, 0.05, 0.6)
    cue.tone(55, 1.5, 0.2, type="triangle")


def fanfare_legendary(cue):
    cue.noise(0.12, "bandpass", 1000, 0.5)
    for note in [C5, E5, G5, C6, E6]:
        cue.tone(note, 2.4, 0.06, at=0.08, type="triangle")
    for index, note in enumerate([C6, E6, G6, C7, E6 * 2]):
        cue.bell(note, 0.3 + index * 0.09, 0.07, 1.4)


def new_card(cue):
    cue.bell(A5, 0, 0.06, 0.3)
    cue.bell(E6, 0.08, 0.06, 0.45)


def recap(cue):
    for note in [G5 / 2, C5, E5]:
        cue.tone(note, 0.9, 0.05, type="triangle")


def answer_right(cue):
    cue.bell(C6, 0, 0.06, 0.3)
    cue.bell(G6, 0.08, 0.06, 0.5)


def answer_wrong(cue):
    cue.tone(220, 0.24, 0.12, type="triangle", frequency_to=150)
    cue.noise(0.08, "lowpass", 400, 0.06)


CUES = {
    "seal-break": seal_break,
    "tear-finish": tear_finish,
    "card-slide": card_slide,
    "flip": flip,
    "chime-rare": chime_rare,
    "rumble": rumble,
    "chime-precious": chime_precious,
    "crack": crack,
    "fanfare-epic": fanfare_epic,
    "shimmer": shimmer,
    "fanfare-legendary": fanfare_legendary,
    "new-card": new_card,
    "recap": recap,
    "answer-right": answer_right,
    "answer-wrong": answer_wrong,
}
GRAINS = 6
"""The loudest grain the web plays: the app lowers each grain's volume from there."""
GRAIN_GAIN = 0.32


def tear_grain(cue):
    cue.noise(
        0.03 + rng.uniform() * 0.03,
        "bandpass",
        2400 + rng.uniform() * 3000,
        GRAIN_GAIN,
        q=1.2,
    )


def save(path, samples):
    with wave.open(str(path), "wb") as file:
        file.setnchannels(1)
        file.setsampwidth(2)
        file.setframerate(RATE)
        file.writeframes((samples * 32767).astype("<i2").tobytes())
    print(path.name, f"{len(samples) / RATE:.2f} s")


out = Path(sys.argv[1])
out.mkdir(parents=True, exist_ok=True)
for name, build in CUES.items():
    cue = Cue()
    build(cue)
    save(out / f"{name}.wav", cue.render())
for index in range(GRAINS):
    cue = Cue()
    tear_grain(cue)
    save(out / f"tear-grain-{index + 1}.wav", cue.render())
