/**
 * Which jousters the team should look at: the catalogue is public, so a script finds every word.
 * Nothing here sanctions anyone. It only sorts the ranked answers of the last days into a short
 * list a person reads.
 */
export interface SuspicionRules {
  /** How far back ranked answers are read. */
  readonly windowMs: number;
  /** Fewer questions than this say nothing yet. */
  readonly minServed: number;
  /** Nearly always right and answering faster than a definition is read. */
  readonly fast: { readonly minAccuracy: number; readonly maxMedianMs: number };
  /** Answer times too alike to be a person's, whatever the score. */
  readonly regular: { readonly maxSpreadMs: number };
  /** Never wrong over this many questions, at any pace: answers may be looked up. */
  readonly flawless: { readonly minServed: number };
}

export const JOUST_SUSPICION: SuspicionRules = {
  windowMs: 7 * 24 * 60 * 60 * 1000,
  minServed: 30,
  fast: { minAccuracy: 0.95, maxMedianMs: 2_000 },
  regular: { maxSpreadMs: 500 },
  flawless: { minServed: 50 },
};

/** A player's ranked questions over the window. */
export interface JousterStats {
  /** Questions shown, answered or not. */
  readonly served: number;
  readonly correct: number;
  /** Median time of the answers given; `null` without any. */
  readonly medianMs: number | null;
  /** Between the 10th and the 90th percentile of those times; `null` without any. */
  readonly spreadMs: number | null;
}

export const SUSPICION_REASONS = ["fast", "regular", "flawless"] as const;
export type SuspicionReason = (typeof SUSPICION_REASONS)[number];

/** Why a jouster is worth a look; empty for nearly everyone. */
export function suspicionReasons(rules: SuspicionRules, stats: JousterStats): SuspicionReason[] {
  if (stats.served < rules.minServed || stats.medianMs === null || stats.spreadMs === null) {
    return [];
  }
  const reasons: SuspicionReason[] = [];
  const accuracy = stats.correct / stats.served;
  if (accuracy >= rules.fast.minAccuracy && stats.medianMs <= rules.fast.maxMedianMs) {
    reasons.push("fast");
  }
  if (stats.spreadMs <= rules.regular.maxSpreadMs) reasons.push("regular");
  if (stats.served >= rules.flawless.minServed && stats.correct === stats.served) {
    reasons.push("flawless");
  }
  return reasons;
}
