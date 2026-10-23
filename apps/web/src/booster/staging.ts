import { type Rarity, rarityRank } from "@leximon/core";
import type { SoundCue } from "./feedback";

/**
 * How each rarity is revealed. The announcement always comes before the face: the rarer the
 * card, the longer the player waits for it.
 */

export interface RarityStaging {
  /** What the card back does before the face shows. */
  readonly announce: "none" | "edge" | "tremble" | "crack" | "eclipse";
  /** The face shows at once, after the announcement, or when the player touches the card. */
  readonly flip: "instant" | "auto" | "touch";
  /** Length of the announcement before an automatic flip, in ms. */
  readonly announceMs: number;
  /** Length of the flip itself, in ms. */
  readonly flipMs: number;
  /** The screen darkens around the card. */
  readonly dim: boolean;
  /** The card is shown larger, turning once on itself. */
  readonly spotlight: boolean;
  readonly announceCue: SoundCue | null;
  readonly revealCue: SoundCue;
  /** Vibration patterns (ms on, ms off…), played where the device allows it. */
  readonly announceHaptic: readonly number[];
  readonly revealHaptic: readonly number[];
}

const STAGING: Readonly<Record<Rarity, RarityStaging>> = {
  common: {
    announce: "none",
    flip: "instant",
    announceMs: 0,
    flipMs: 300,
    dim: false,
    spotlight: false,
    announceCue: null,
    revealCue: "flip",
    announceHaptic: [],
    revealHaptic: [],
  },
  uncommon: {
    announce: "none",
    flip: "instant",
    announceMs: 0,
    flipMs: 300,
    dim: false,
    spotlight: false,
    announceCue: null,
    revealCue: "flip",
    announceHaptic: [],
    revealHaptic: [],
  },
  rare: {
    announce: "edge",
    flip: "auto",
    announceMs: 650,
    flipMs: 450,
    dim: false,
    spotlight: false,
    announceCue: null,
    revealCue: "chimeRare",
    announceHaptic: [],
    revealHaptic: [25],
  },
  precious: {
    announce: "tremble",
    flip: "touch",
    announceMs: 900,
    flipMs: 500,
    dim: false,
    spotlight: false,
    announceCue: "rumble",
    revealCue: "chimePrecious",
    announceHaptic: [15],
    revealHaptic: [25, 60, 25],
  },
  epic: {
    announce: "crack",
    flip: "touch",
    announceMs: 1100,
    flipMs: 900,
    dim: true,
    spotlight: false,
    announceCue: "crack",
    revealCue: "fanfareEpic",
    announceHaptic: [40],
    revealHaptic: [180],
  },
  legendary: {
    announce: "eclipse",
    flip: "touch",
    announceMs: 1500,
    flipMs: 1400,
    dim: true,
    spotlight: true,
    announceCue: "shimmer",
    revealCue: "fanfareLegendary",
    announceHaptic: [30, 80, 30, 80, 30],
    revealHaptic: [60, 50, 60, 50, 240],
  },
};

export interface StagingMode {
  /** The player asked the system for reduced motion: no effect at all. */
  readonly reducedMotion: boolean;
  /** The player asked to reveal everything: only a short announcement for the best cards. */
  readonly hurried: boolean;
}

export function stagingFor(rarity: Rarity, mode: StagingMode): RarityStaging {
  const staging = STAGING[rarity];
  if (mode.reducedMotion) {
    return {
      ...staging,
      announce: "none",
      flip: "instant",
      announceMs: 0,
      flipMs: 0,
      dim: false,
      spotlight: false,
    };
  }
  if (mode.hurried && staging.flip !== "instant") {
    return {
      ...staging,
      flip: "auto",
      announceMs: Math.round(staging.announceMs / 2),
      flipMs: Math.round(staging.flipMs / 2),
    };
  }
  return staging;
}

/** Rarities still shown, briefly, when the player reveals everything at once. */
export function keepsAnnouncementWhenHurried(rarity: Rarity): boolean {
  return rarityRank(rarity) >= rarityRank("epic");
}

/** Gap between two cards landing in the recap. */
export const CASCADE_STEP_MS = 80;

export interface CascadeStep {
  /** When the card lands, from the recap's start. */
  readonly delayMs: number;
  /** A brief shine of the rarity's colour as it lands: from Rare up. */
  readonly glint: boolean;
  /** Played as the card lands: the chime of a card the player has not seen turned over. */
  readonly cue: SoundCue | null;
}

/**
 * How the pack's cards land in the recap, one after the other. `seen` tells the cards already
 * turned over one by one: they land quietly, while a card skipped by « Tout révéler » keeps its
 * chime, so that a Rare or a Précieux is never missed.
 */
export function recapCascade(
  cards: readonly { readonly rarity: Rarity }[],
  seen: (index: number) => boolean,
  mode: Pick<StagingMode, "reducedMotion">,
): CascadeStep[] {
  return cards.map((card, index) => {
    if (mode.reducedMotion) return { delayMs: 0, glint: false, cue: null };
    const shines = rarityRank(card.rarity) >= rarityRank("rare");
    return {
      delayMs: index * CASCADE_STEP_MS,
      glint: shines,
      cue: shines && !seen(index) ? STAGING[card.rarity].revealCue : null,
    };
  });
}
