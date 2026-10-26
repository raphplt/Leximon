import type { SoundCue } from "@leximon/view-model";

/**
 * Sound and vibration of the opening. Sounds are synthesized with the Web Audio API rather than
 * recorded: no file to load or license to track, and the tear can follow the finger grain by
 * grain. They can be swapped for designed samples later without touching the screens.
 *
 * The app plays the same cues from files rendered by apps/mobile/scripts/render_sounds.py: a cue
 * changed here is changed there too, then rendered again.
 */

/** `speech`: the word read aloud as its card settles, apart from the other sounds. */
export type FeedbackKind = "sound" | "speech" | "haptics";

const STORAGE_KEYS: Readonly<Record<FeedbackKind, string>> = {
  sound: "leximon.sound",
  speech: "leximon.speech",
  haptics: "leximon.haptics",
};

/** On unless the player turned it off. Storage can be missing or blocked: then it stays on. */
export function readPreference(kind: FeedbackKind): boolean {
  try {
    return window.localStorage.getItem(STORAGE_KEYS[kind]) !== "off";
  } catch {
    return true;
  }
}

export function writePreference(kind: FeedbackKind, enabled: boolean): void {
  try {
    window.localStorage.setItem(STORAGE_KEYS[kind], enabled ? "on" : "off");
  } catch {
    // Not remembered for the next visit; the choice still applies to this one.
  }
  preferences[kind] = enabled;
}

const preferences: Record<FeedbackKind, boolean | null> = {
  sound: null,
  speech: null,
  haptics: null,
};

function enabled(kind: FeedbackKind): boolean {
  preferences[kind] ??= readPreference(kind);
  return preferences[kind];
}

/** Whether a card says its word on its own once it settles; the listen button always works. */
export function speechOn(): boolean {
  return enabled("sound") && enabled("speech");
}

/** Vibration exists on Android browsers only; iPhones ignore it. */
export function canVibrate(): boolean {
  return typeof navigator !== "undefined" && typeof navigator.vibrate === "function";
}

export function vibrate(pattern: readonly number[]): void {
  if (pattern.length === 0 || !enabled("haptics") || !canVibrate()) return;
  navigator.vibrate([...pattern]);
}

let context: AudioContext | null = null;
let noise: AudioBuffer | null = null;

/** Browsers only let sound start from a gesture: every cue is played from one. */
function audio(): AudioContext | null {
  if (!enabled("sound") || typeof window === "undefined" || !("AudioContext" in window)) {
    return null;
  }
  context ??= new AudioContext();
  if (context.state === "suspended") void context.resume();
  return context;
}

function noiseBuffer(ctx: AudioContext): AudioBuffer {
  if (noise === null) {
    noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const data = noise.getChannelData(0);
    for (let i = 0; i < data.length; i += 1) data[i] = Math.random() * 2 - 1;
  }
  return noise;
}

interface NoiseOptions {
  readonly at?: number;
  readonly duration: number;
  readonly filter: BiquadFilterType;
  readonly frequency: number;
  /** Frequency reached at the end, for a sweep. */
  readonly frequencyTo?: number;
  readonly q?: number;
  readonly gain: number;
}

function noiseBurst(ctx: AudioContext, options: NoiseOptions): void {
  const start = ctx.currentTime + (options.at ?? 0);
  const source = ctx.createBufferSource();
  source.buffer = noiseBuffer(ctx);
  const filter = ctx.createBiquadFilter();
  filter.type = options.filter;
  filter.frequency.setValueAtTime(options.frequency, start);
  if (options.frequencyTo !== undefined) {
    filter.frequency.exponentialRampToValueAtTime(options.frequencyTo, start + options.duration);
  }
  filter.Q.value = options.q ?? 1;
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(
    options.gain,
    start + Math.min(0.01, options.duration / 4),
  );
  gain.gain.exponentialRampToValueAtTime(0.0001, start + options.duration);
  source.connect(filter).connect(gain).connect(ctx.destination);
  source.start(start, Math.random() * 0.5);
  source.stop(start + options.duration + 0.05);
}

interface ToneOptions {
  readonly at?: number;
  readonly frequency: number;
  readonly duration: number;
  readonly gain: number;
  readonly type?: OscillatorType;
  /** Frequency reached at the end, for a slide. */
  readonly frequencyTo?: number;
}

function tone(ctx: AudioContext, options: ToneOptions): void {
  const start = ctx.currentTime + (options.at ?? 0);
  const oscillator = ctx.createOscillator();
  oscillator.type = options.type ?? "sine";
  oscillator.frequency.setValueAtTime(options.frequency, start);
  if (options.frequencyTo !== undefined) {
    oscillator.frequency.exponentialRampToValueAtTime(
      options.frequencyTo,
      start + options.duration,
    );
  }
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(options.gain, start + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + options.duration);
  oscillator.connect(gain).connect(ctx.destination);
  oscillator.start(start);
  oscillator.stop(start + options.duration + 0.05);
}

/** Bell-like note: a fundamental and two quieter partials. */
function bell(ctx: AudioContext, frequency: number, at: number, gain: number, duration = 1): void {
  tone(ctx, { at, frequency, duration, gain });
  tone(ctx, { at, frequency: frequency * 2.01, duration: duration * 0.6, gain: gain * 0.35 });
  tone(ctx, { at, frequency: frequency * 3.02, duration: duration * 0.35, gain: gain * 0.15 });
}

// Notes in Hz.
const C5 = 523.25;
const E5 = 659.25;
const G5 = 783.99;
const A5 = 880;
const C6 = 1046.5;
const D6 = 1174.66;
const E6 = 1318.51;
const G6 = 1567.98;
const C7 = 2093;

const CUES: Readonly<Record<SoundCue, (ctx: AudioContext) => void>> = {
  sealBreak: (ctx) => {
    noiseBurst(ctx, { duration: 0.09, filter: "bandpass", frequency: 1400, q: 0.8, gain: 0.5 });
    tone(ctx, { frequency: 140, frequencyTo: 60, duration: 0.25, gain: 0.35 });
    CUES.tearFinish(ctx);
  },
  tearFinish: (ctx) => {
    noiseBurst(ctx, {
      at: 0.04,
      duration: 0.28,
      filter: "bandpass",
      frequency: 1800,
      frequencyTo: 5200,
      q: 1.4,
      gain: 0.32,
    });
  },
  cardSlide: (ctx) => {
    noiseBurst(ctx, {
      duration: 0.16,
      filter: "lowpass",
      frequency: 2200,
      frequencyTo: 700,
      gain: 0.16,
    });
  },
  flip: (ctx) => {
    noiseBurst(ctx, { duration: 0.05, filter: "highpass", frequency: 2600, gain: 0.18 });
    noiseBurst(ctx, { at: 0.05, duration: 0.04, filter: "bandpass", frequency: 1600, gain: 0.1 });
  },
  chimeRare: (ctx) => {
    CUES.flip(ctx);
    bell(ctx, E6, 0.02, 0.1, 0.7);
    bell(ctx, G6, 0.1, 0.08, 0.8);
  },
  rumble: (ctx) => {
    tone(ctx, { frequency: 70, duration: 0.6, gain: 0.25, type: "triangle" });
    noiseBurst(ctx, { duration: 0.6, filter: "lowpass", frequency: 300, gain: 0.12 });
  },
  chimePrecious: (ctx) => {
    CUES.flip(ctx);
    [C6, E6, G6, C7].forEach((note, index) => {
      bell(ctx, note, 0.02 + index * 0.07, 0.09, 1);
    });
  },
  crack: (ctx) => {
    noiseBurst(ctx, { duration: 0.12, filter: "bandpass", frequency: 900, q: 0.7, gain: 0.55 });
    noiseBurst(ctx, { at: 0.18, duration: 0.08, filter: "bandpass", frequency: 1300, gain: 0.4 });
    tone(ctx, { frequency: 90, frequencyTo: 45, duration: 0.4, gain: 0.35 });
  },
  fanfareEpic: (ctx) => {
    CUES.flip(ctx);
    for (const note of [C5, E5, G5, C6]) {
      tone(ctx, { at: 0.05, frequency: note, duration: 1.6, gain: 0.07, type: "triangle" });
    }
    bell(ctx, G6, 0.25, 0.08, 1.2);
    bell(ctx, C7, 0.4, 0.06, 1.2);
  },
  shimmer: (ctx) => {
    [C6, D6, E6, G6, A5 * 2, C7].forEach((note, index) => {
      bell(ctx, note, index * 0.11, 0.05, 0.6);
    });
    tone(ctx, { frequency: 55, duration: 1.5, gain: 0.2, type: "triangle" });
  },
  fanfareLegendary: (ctx) => {
    noiseBurst(ctx, { duration: 0.12, filter: "bandpass", frequency: 1000, gain: 0.5 });
    for (const note of [C5, E5, G5, C6, E6]) {
      tone(ctx, { at: 0.08, frequency: note, duration: 2.4, gain: 0.06, type: "triangle" });
    }
    [C6, E6, G6, C7, E6 * 2].forEach((note, index) => {
      bell(ctx, note, 0.3 + index * 0.09, 0.07, 1.4);
    });
  },
  newCard: (ctx) => {
    bell(ctx, A5, 0, 0.06, 0.3);
    bell(ctx, E6, 0.08, 0.06, 0.45);
  },
  recap: (ctx) => {
    for (const note of [G5 / 2, C5, E5]) {
      tone(ctx, { frequency: note, duration: 0.9, gain: 0.05, type: "triangle" });
    }
  },
};

/**
 * Each cue is also announced as a `leximon:cue` event on the window, so that a recording of the
 * game (demonstration videos) can lay the sounds on their own track.
 */
function announce(cue: SoundCue | "tearGrain"): void {
  window.dispatchEvent(new CustomEvent("leximon:cue", { detail: cue }));
}

export function play(cue: SoundCue | null): void {
  if (cue === null) return;
  announce(cue);
  const ctx = audio();
  if (ctx !== null) CUES[cue](ctx);
}

/** A grain of torn paper, played while the finger moves along the strip. */
export function playTearGrain(speed: number): void {
  announce("tearGrain");
  const ctx = audio();
  if (ctx === null) return;
  noiseBurst(ctx, {
    duration: 0.03 + Math.random() * 0.03,
    filter: "bandpass",
    frequency: 2400 + Math.random() * 3000,
    q: 1.2,
    gain: Math.min(0.32, 0.12 + speed * 0.08),
  });
}
