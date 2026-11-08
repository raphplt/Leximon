/**
 * The banner at the top of a profile: a tint, free among a few, and a motif the player earns. A
 * motif comes from what the player reached (a level, a league, a complete collection), so that a
 * player already past it has it, or is bought once with écus. A motif earned is never lost.
 */

import type { EpochMs } from "../booster/refill";
import { type League, leagueRank } from "../joust/leagues";

export interface BannerRules {
  /** Period start; the rules in force at the time of each action apply. */
  readonly startsAt: EpochMs;
  /** Every tint, all free. The first one is worn until the player chooses. */
  readonly tints: readonly [string, ...string[]];
  /** Worn until the player chooses, and on a private profile. */
  readonly startingMotif: string;
  /** Account level reached → motif. */
  readonly levels: Readonly<Record<number, string>>;
  /** League reached once, even if left since → motif. */
  readonly leagues: Readonly<Partial<Record<League, string>>>;
  /** Given by the first complete collection. */
  readonly completeCollection: string;
  /** Motif → its price in écus, fixed and known in advance. */
  readonly forEcus: Readonly<Record<string, number>>;
}

export type BannerSchedule = readonly [BannerRules, ...BannerRules[]];

export function bannerRulesAt(schedule: BannerSchedule, time: EpochMs): BannerRules {
  let active = schedule[0];
  for (const rules of schedule) {
    if (rules.startsAt > time) break;
    active = rules;
  }
  return active;
}

/** What the player reached that gives motifs. */
export interface BannerProgress {
  readonly level: number;
  /** The highest league reached, ever; `null` before the first ranked joust. */
  readonly bestLeague: League | null;
  readonly completeCollections: number;
  /** Motifs bought with écus. */
  readonly bought: readonly string[];
}

/** How a motif is earned, for the atelier to say it. */
export type BannerSource =
  | { readonly kind: "start" }
  | { readonly kind: "level"; readonly level: number }
  | { readonly kind: "league"; readonly league: League }
  | { readonly kind: "collection" }
  | { readonly kind: "ecus"; readonly price: number };

/** Every motif of the rules with how it is earned, in the order of the atelier. */
export function bannerCatalog(
  rules: BannerRules,
): readonly { readonly motif: string; readonly source: BannerSource }[] {
  const levels = Object.entries(rules.levels)
    .map(([level, motif]) => ({ level: Number(level), motif }))
    .sort((a, b) => a.level - b.level);
  const leagues = Object.entries(rules.leagues) as [League, string][];
  leagues.sort(([a], [b]) => leagueRank(a) - leagueRank(b));
  return [
    { motif: rules.startingMotif, source: { kind: "start" } },
    ...levels.map(({ level, motif }) => ({ motif, source: { kind: "level", level } as const })),
    ...leagues.map(([league, motif]) => ({ motif, source: { kind: "league", league } as const })),
    { motif: rules.completeCollection, source: { kind: "collection" } },
    ...Object.entries(rules.forEcus).map(([motif, price]) => ({
      motif,
      source: { kind: "ecus", price } as const,
    })),
  ];
}

/** The motifs the player may wear. */
export function bannerMotifsOwned(rules: BannerRules, progress: BannerProgress): Set<string> {
  const owned = new Set([rules.startingMotif]);
  for (const [level, motif] of Object.entries(rules.levels)) {
    if (progress.level >= Number(level)) owned.add(motif);
  }
  if (progress.bestLeague !== null) {
    for (const [league, motif] of Object.entries(rules.leagues) as [League, string][]) {
      if (leagueRank(progress.bestLeague) >= leagueRank(league)) owned.add(motif);
    }
  }
  if (progress.completeCollections > 0) owned.add(rules.completeCollection);
  for (const motif of progress.bought) {
    if (motif in rules.forEcus) owned.add(motif);
  }
  return owned;
}

/** The banner worn: the one chosen while it is still allowed, else the starting one. */
export function wornBanner(
  rules: BannerRules,
  owned: ReadonlySet<string>,
  chosen: { readonly motif: string | null; readonly tint: string | null },
): { readonly motif: string; readonly tint: string } {
  return {
    motif: chosen.motif !== null && owned.has(chosen.motif) ? chosen.motif : rules.startingMotif,
    tint: chosen.tint !== null && rules.tints.includes(chosen.tint) ? chosen.tint : rules.tints[0],
  };
}

export type BannerPurchaseRefusal = "not_for_sale" | "already_owned" | "not_enough_ecus";

/** Whether the player may buy a motif with écus now; `null` when they may. */
export function bannerPurchaseRefusal(
  rules: BannerRules,
  owned: ReadonlySet<string>,
  motif: string,
  balance: number,
): BannerPurchaseRefusal | null {
  const price = rules.forEcus[motif];
  if (price === undefined) return "not_for_sale";
  if (owned.has(motif)) return "already_owned";
  if (balance < price) return "not_enough_ecus";
  return null;
}
