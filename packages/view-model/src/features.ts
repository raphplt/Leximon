import type { Progress } from "@leximon/contract";
import {
  type EpochMs,
  FEATURES,
  type Feature,
  featureLevels,
  featuresOpenedAt,
  TRADE_SCHEDULE,
  UNLOCK_SCHEDULE,
  xpToReach,
} from "@leximon/core";
import { capitalize, plural } from "./format";

/**
 * Features opened by the account level. A closed feature stays visible with its level:
 * a badge « Niv. 10 », and a screen that says what opens it. A promise, not a wall.
 */

/** How a feature is named in a sentence: « Ouvre : les échanges ». */
export const FEATURE_NAMES: Readonly<Record<Feature, string>> = {
  choose_collection: "choisir la collection de ton sachet",
  trade: "les échanges",
  public_profile: "le profil public",
  trade_three: "les échanges à 3 cartes",
  join_clan: "les clans",
  create_clan: "créer un clan",
  jousts: "les joutes",
};

/** A feature in one or two words, under its level in the next rewards: « Échanges ». */
export const FEATURE_WORDS: Readonly<Record<Feature, string>> = {
  choose_collection: "Collections",
  trade: "Échanges",
  public_profile: "Profil",
  trade_three: "Échanges ×3",
  join_clan: "Clans",
  create_clan: "Ton clan",
  jousts: "Joutes",
};

export function levelsOfFeatures(now: EpochMs): Readonly<Record<Feature, number>> {
  return featureLevels(UNLOCK_SCHEDULE, TRADE_SCHEDULE, now);
}

export function isFeatureOpen(feature: Feature, level: number, now: EpochMs): boolean {
  return level >= levelsOfFeatures(now)[feature];
}

/** « Les clans, créer un clan » for the features a level opens; `null` when it opens none. */
export function opensAt(level: number, now: EpochMs): string | null {
  const opened = featuresOpenedAt(levelsOfFeatures(now), level);
  if (opened.length === 0) return null;
  return capitalize(opened.map((feature) => FEATURE_NAMES[feature]).join(", "));
}

/** Levels that open at least one feature, lowest first. */
export function featureMilestones(now: EpochMs): number[] {
  const levels = levelsOfFeatures(now);
  return [...new Set(FEATURES.map((feature) => levels[feature]))].sort((a, b) => a - b);
}

/** « Niv. 10 », the badge of a closed feature. */
export function levelBadge(level: number): string {
  return `Niv. ${level}`;
}

/** The screens a closed feature leads to. */
export type LockedFeature = "trade" | "join_clan" | "jousts";

const LOCKED_COPY: Readonly<Record<LockedFeature, { title: string; text: string }>> = {
  trade: {
    title: "Les échanges ouvrent au niveau",
    text: "Une carte contre une carte, avec les autres joueurs.",
  },
  join_clan: {
    title: "Les clans ouvrent au niveau",
    text: "Rejoins d'autres joueurs pour remplir un objectif commun chaque semaine et gagner des sachets bonus.",
  },
  jousts: {
    title: "Les joutes ouvrent au niveau",
    text: "Tes mots les plus rares contre ceux des autres.",
  },
};

export interface LockedScreen {
  readonly level: number;
  readonly title: string;
  readonly text: string;
  /** « Encore 3 niveaux ». */
  readonly left: string;
  /** Share of the XP towards the opening level, between 0 and 1. */
  readonly ratio: number;
}

/** What the screen of a closed feature says; `null` once it is open. */
export function lockedScreen(
  feature: LockedFeature,
  progress: Pick<Progress, "level" | "xp">,
  now: EpochMs,
): LockedScreen | null {
  const level = levelsOfFeatures(now)[feature];
  if (progress.level >= level) return null;
  const copy = LOCKED_COPY[feature];
  return {
    level,
    title: `${copy.title} ${level}`,
    text: copy.text,
    left: `Encore ${plural(level - progress.level, "niveau", "niveaux")}`,
    ratio: Math.min(1, progress.xp / xpToReach(level)),
  };
}

/** Said when a closed control without its own screen is touched: « Les clans, c'est au niveau 10. » */
export function lockedToast(feature: Feature, now: EpochMs): string {
  const level = levelsOfFeatures(now)[feature];
  return `${capitalize(FEATURE_NAMES[feature])}, c'est au niveau ${level}.`;
}

/** Open, but not built yet: the jousts, once decided. */
export const NOT_BUILT_COPY: Readonly<Record<"jousts", { title: string; text: string }>> = {
  jousts: {
    title: "Les joutes se préparent",
    text: "On en affûte les règles.",
  },
};
