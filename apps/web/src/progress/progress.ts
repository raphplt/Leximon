import type { Progress, ProgressGain } from "@leximon/contract";

/** "+35 XP", or `null` when nothing was earned (a wrong answer, a replayed request). */
export function xpGainLabel(gain: Pick<ProgressGain, "xpGained">): string | null {
  return gain.xpGained > 0 ? `+${gain.xpGained} XP` : null;
}

/** "Niveau 6 atteint !" when the action raised the level, else `null`. */
export function levelUpLabel(gain: Pick<ProgressGain, "levelUp" | "level">): string | null {
  return gain.levelUp ? `Niveau ${gain.level} atteint !` : null;
}

/** Share of the current level already done, between 0 and 1, for a progress ring or bar. */
export function levelRatio(progress: Pick<Progress, "xpIntoLevel" | "xpForNextLevel">): number {
  return Math.min(1, Math.max(0, progress.xpIntoLevel / progress.xpForNextLevel));
}

/** "Niveau 4 · 35 / 160 XP", read by screen readers on the level badge. */
export function levelDescription(progress: Progress): string {
  return `Niveau ${progress.level} · ${progress.xpIntoLevel} / ${progress.xpForNextLevel} XP`;
}
