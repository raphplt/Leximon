import type { SoundCue } from "@leximon/view-model";
import { type AudioPlayer, createAudioPlayer, setAudioModeAsync } from "expo-audio";
import * as Haptics from "expo-haptics";
import * as SecureStore from "expo-secure-store";
import { Platform, Vibration } from "react-native";

/**
 * Sound and vibration of the opening. The sounds are the web's, rendered once to files
 * (scripts/render_sounds.py): the phone plays files where the browser synthesizes.
 */

/** `speech`: the word read aloud as its card settles, apart from the other sounds. */
export type FeedbackKind = "sound" | "speech" | "haptics";

const STORAGE_KEYS: Readonly<Record<FeedbackKind, string>> = {
  sound: "leximon_sound",
  speech: "leximon_speech",
  haptics: "leximon_haptics",
};

/** On unless the player turned it off. Storage can fail: then it stays on. */
export function readPreference(kind: FeedbackKind): boolean {
  try {
    return SecureStore.getItem(STORAGE_KEYS[kind]) !== "off";
  } catch {
    return true;
  }
}

export function writePreference(kind: FeedbackKind, enabled: boolean): void {
  preferences[kind] = enabled;
  SecureStore.setItemAsync(STORAGE_KEYS[kind], enabled ? "on" : "off").catch(() => {
    // Not remembered for the next launch; the choice still applies until then.
  });
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

/**
 * Android plays the web's patterns as they are written. iPhones have no vibrator to drive by
 * the millisecond: each pulse becomes a tap of the haptic engine, stronger as it lasts longer.
 */
export function vibrate(pattern: readonly number[]): void {
  if (pattern.length === 0 || !enabled("haptics")) return;
  if (Platform.OS === "android") {
    Vibration.vibrate([0, ...pattern]);
    return;
  }
  let at = 0;
  pattern.forEach((length, index) => {
    if (index % 2 === 0) setTimeout(() => void Haptics.impactAsync(impactOf(length)), at);
    at += length;
  });
}

function impactOf(length: number): Haptics.ImpactFeedbackStyle {
  if (length < 30) return Haptics.ImpactFeedbackStyle.Light;
  if (length < 100) return Haptics.ImpactFeedbackStyle.Medium;
  return Haptics.ImpactFeedbackStyle.Heavy;
}

const FILES: Readonly<Record<SoundCue, number>> = {
  sealBreak: require("../../assets/sounds/seal-break.wav"),
  tearFinish: require("../../assets/sounds/tear-finish.wav"),
  cardSlide: require("../../assets/sounds/card-slide.wav"),
  flip: require("../../assets/sounds/flip.wav"),
  chimeRare: require("../../assets/sounds/chime-rare.wav"),
  rumble: require("../../assets/sounds/rumble.wav"),
  chimePrecious: require("../../assets/sounds/chime-precious.wav"),
  crack: require("../../assets/sounds/crack.wav"),
  fanfareEpic: require("../../assets/sounds/fanfare-epic.wav"),
  shimmer: require("../../assets/sounds/shimmer.wav"),
  fanfareLegendary: require("../../assets/sounds/fanfare-legendary.wav"),
  newCard: require("../../assets/sounds/new-card.wav"),
  recap: require("../../assets/sounds/recap.wav"),
};

const GRAINS: readonly number[] = [
  require("../../assets/sounds/tear-grain-1.wav"),
  require("../../assets/sounds/tear-grain-2.wav"),
  require("../../assets/sounds/tear-grain-3.wav"),
  require("../../assets/sounds/tear-grain-4.wav"),
  require("../../assets/sounds/tear-grain-5.wav"),
  require("../../assets/sounds/tear-grain-6.wav"),
];
/** The volume the grain files are rendered at: the loudest grain the web plays. */
const GRAIN_GAIN = 0.32;

/** One player per file, made on first use and kept: the opening replays them all the time. */
const players = new Map<number, AudioPlayer>();
let audioReady = false;

function playerFor(file: number): AudioPlayer {
  if (!audioReady) {
    audioReady = true;
    // Sound effects: they respect the silent switch and never pause the player's music.
    void setAudioModeAsync({ playsInSilentMode: false, interruptionMode: "mixWithOthers" });
  }
  let player = players.get(file);
  if (player === undefined) {
    player = createAudioPlayer(file);
    players.set(file, player);
  }
  return player;
}

function start(file: number, volume = 1): void {
  const player = playerFor(file);
  player.volume = volume;
  void player.seekTo(0);
  player.play();
}

/** Loads the opening's sounds before the first one plays: a file loaded on demand lags. */
export function prepareSounds(): void {
  if (!enabled("sound")) return;
  for (const file of [...Object.values(FILES), ...GRAINS]) playerFor(file);
}

export function play(cue: SoundCue | null): void {
  if (cue === null || !enabled("sound")) return;
  start(FILES[cue]);
}

let nextGrain = 0;

/** A grain of torn paper, played while the finger moves along the strip. */
export function playTearGrain(speed: number): void {
  if (!enabled("sound")) return;
  const file = GRAINS[nextGrain % GRAINS.length];
  nextGrain += 1;
  if (file !== undefined) start(file, Math.min(GRAIN_GAIN, 0.12 + speed * 0.08) / GRAIN_GAIN);
}
