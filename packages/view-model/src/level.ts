import type { Progress, ProgressGain } from "@leximon/contract";
import {
  currentTitle,
  type EpochMs,
  LEVEL_REWARD_SCHEDULE,
  levelRewardRulesAt,
  XP_SCHEDULE,
  xpRulesAt,
  xpToReach,
} from "@leximon/core";
import { formatCount } from "./format";

/** The account level (P48) as screens show it: medal, headline, bar. */

/** "+35 XP", or `null` when nothing was earned (a wrong answer, a replayed request). */
export function xpGainLabel(gain: Pick<ProgressGain, "xpGained">): string | null {
  return gain.xpGained > 0 ? `+${formatCount(gain.xpGained)} XP` : null;
}

/** "Niveau 6 !" when the action raised the level, else `null`. */
export function levelUpLabel(gain: Pick<ProgressGain, "levelUp" | "level">): string | null {
  return gain.levelUp ? `Niveau ${gain.level} !` : null;
}

/** Share of the current level already done, between 0 and 1, for a progress ring or bar. */
export function levelRatio(progress: Pick<Progress, "xpIntoLevel" | "xpForNextLevel">): number {
  return Math.min(1, Math.max(0, progress.xpIntoLevel / progress.xpForNextLevel));
}

/** "Niveau 4, 35 sur 160 XP", read by screen readers on the level ring and bar. */
export function levelDescription(progress: Progress): string {
  return `Niveau ${progress.level}, ${formatCount(progress.xpIntoLevel)} sur ${formatCount(progress.xpForNextLevel)} XP`;
}

/** "260 / 400 XP". */
export function xpProgressLabel(progress: Progress): string {
  return `${formatCount(progress.xpIntoLevel)} / ${formatCount(progress.xpForNextLevel)} XP`;
}

/** The title the player carries (P58): the one of the highest milestone claimed, if any. */
export function playerTitle(claimed: readonly number[], now: EpochMs): string | null {
  return currentTitle(levelRewardRulesAt(LEVEL_REWARD_SCHEDULE, now), claimed);
}

/** XP still to earn before reaching `level`; 0 once reached. */
export function xpBefore(progress: Pick<Progress, "xp">, level: number): number {
  return Math.max(0, xpToReach(level) - progress.xp);
}

/** "Niveau 16 · encore 140 XP avant le 17", under the title of the level road. */
export function roadSubtitle(progress: Progress): string {
  const next = progress.level + 1;
  return `Niveau ${progress.level} · encore ${formatCount(xpBefore(progress, next))} XP avant le ${next}`;
}

export interface XpSource {
  readonly action: string;
  readonly xp: string;
}

/** Where XP comes from (P48), read from the rules in force: the table of the level road. */
export function xpSources(now: EpochMs): XpSource[] {
  const rules = xpRulesAt(XP_SCHEDULE, now);
  const newWord = Object.values(rules.newWord);
  return [
    { action: "Ouvrir un sachet", xp: String(rules.boosterOpened) },
    { action: "Premier sachet du jour", xp: `+${rules.firstBoosterOfDay}` },
    { action: "Mot nouveau", xp: `${Math.min(...newWord)} à ${Math.max(...newWord)}` },
    { action: "Bonne réponse", xp: String(rules.correctAnswer) },
    { action: "Mot à l'Encre ou à la Dorure", xp: String(rules.masteryLevelUp) },
    { action: "Échange conclu", xp: String(rules.tradeCompleted) },
  ];
}
