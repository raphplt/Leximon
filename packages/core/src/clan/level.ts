/**
 * The clan's own level, apart from its members': XP from their correct answers and the weekly
 * tiers reached. Levels only open things seen by all (emblem items, banners, a fourth tier),
 * never a game advantage.
 */

import { type LevelCurve, levelOf, xpToReach } from "../progress/progress";
import type { EmblemItem } from "./clan";
import type { GoalTier } from "./goal";

export interface ClanXpRules {
  /** XP per correct answer of a member. */
  readonly xpPerAnswer: number;
  /** Answers of one member counted per week: past it, one player alone no longer lifts the clan. */
  readonly answersCountedPerMember: number;
  /** XP for each tier reached in the week. */
  readonly tierXp: Readonly<Record<GoalTier, number>>;
}

/** XP a week brings: each member's answers up to the cap, then the tiers reached. */
export function weekXp(
  rules: ClanXpRules,
  memberAnswers: readonly number[],
  reached: readonly GoalTier[],
): number {
  const answers = memberAnswers.reduce(
    (sum, count) => sum + Math.min(Math.max(0, count), rules.answersCountedPerMember),
    0,
  );
  return answers * rules.xpPerAnswer + reached.reduce((sum, tier) => sum + rules.tierXp[tier], 0);
}

export interface ClanLevelRules {
  /**
   * XP from level n to n + 1: `base + step × (n − 1)`. Not dated: the level is derived from the
   * stored XP, so the curve may only be lengthened beyond the highest level any clan reached.
   */
  readonly curve: LevelCurve;
  /** The level that opens the fourth weekly tier. */
  readonly illuminatedLevel: number;
  /** Banners come at this level, then every `bannerEvery` levels. */
  readonly bannerFrom: number;
  readonly bannerEvery: number;
  /** Banners (card ids of their engraving), in the order they open. Only appended to. */
  readonly banners: readonly string[];
  /** Emblem items, one at each other level from 2 on, in this order. Only appended to. */
  readonly emblemUnlocks: readonly EmblemItem[];
}

export function clanLevelOf(rules: ClanLevelRules, xp: number) {
  return levelOf(xp, rules.curve);
}

export function clanXpToReach(rules: ClanLevelRules, level: number): number {
  return xpToReach(level, rules.curve);
}

export type ClanUnlock =
  | { readonly kind: "illuminated" }
  | { readonly kind: "banner"; readonly id: string }
  | EmblemItem;

/** What each level from 2 to `level` opened, lowest first; levels past the lists open nothing. */
function unlocksUpTo(rules: ClanLevelRules, level: number): (ClanUnlock | null)[] {
  const opened: (ClanUnlock | null)[] = [];
  let banners = 0;
  let items = 0;
  for (let n = 2; n <= level; n++) {
    const bannerLevel = n >= rules.bannerFrom && (n - rules.bannerFrom) % rules.bannerEvery === 0;
    if (n === rules.illuminatedLevel) {
      opened.push({ kind: "illuminated" });
    } else if (bannerLevel && banners < rules.banners.length) {
      opened.push({ kind: "banner", id: rules.banners[banners++] ?? "" });
    } else if (items < rules.emblemUnlocks.length) {
      opened.push(rules.emblemUnlocks[items++] ?? null);
    } else {
      opened.push(null);
    }
  }
  return opened;
}

/** What reaching this level opens, `null` for level 1 or past the lists. */
export function clanLevelUnlock(rules: ClanLevelRules, level: number): ClanUnlock | null {
  if (level < 2) return null;
  return unlocksUpTo(rules, level).at(-1) ?? null;
}

export interface ClanUnlocks {
  readonly illuminated: boolean;
  readonly banners: readonly string[];
  readonly emblemItems: readonly EmblemItem[];
}

/** Everything a clan of this level has opened. */
export function clanUnlocks(rules: ClanLevelRules, level: number): ClanUnlocks {
  const opened = unlocksUpTo(rules, level).filter((unlock) => unlock !== null);
  return {
    illuminated: opened.some((unlock) => unlock.kind === "illuminated"),
    banners: opened.flatMap((unlock) => (unlock.kind === "banner" ? [unlock.id] : [])),
    emblemItems: opened.flatMap((unlock) =>
      unlock.kind === "engraving" || unlock.kind === "color" ? [unlock] : [],
    ),
  };
}

/** The next level that opens something, with what it opens; `null` once the lists are spent. */
export function nextClanUnlock(
  rules: ClanLevelRules,
  level: number,
): { readonly level: number; readonly unlock: ClanUnlock } | null {
  // Every list is spent by this level: a generous bound, still a few dozen steps.
  const horizon =
    Math.max(
      level,
      rules.illuminatedLevel,
      rules.bannerFrom + rules.bannerEvery * rules.banners.length,
    ) +
    rules.emblemUnlocks.length +
    1;
  const opened = unlocksUpTo(rules, horizon);
  for (let n = level + 1; n - 2 < opened.length; n++) {
    const unlock = opened[n - 2];
    if (unlock !== null && unlock !== undefined) return { level: n, unlock };
  }
  return null;
}
