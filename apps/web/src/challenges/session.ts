import {
  type AnswerBonus,
  MASTERY_LEVEL_LABELS,
  type MasteryLevelCode,
  type ProgressGain,
} from "@leximon/contract";
import { DEFAULT_PACK_NOUN, type PackNoun } from "../lib/pack-shape";

/** Outcome of one answered question, kept for the recap. */
export interface AnsweredQuestion {
  readonly cardId: string;
  readonly correct: boolean;
  readonly levelUp: boolean;
  readonly level: MasteryLevelCode;
  readonly bonus: AnswerBonus;
  /** XP the answer earned (P48). */
  readonly progress: ProgressGain;
}

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

/** "dans 3 h", "demain", "dans 5 jours": when the next word comes back. */
export function nextDueLabel(nextDueAt: string | null, now: number): string | null {
  if (nextDueAt === null) return null;
  const wait = Date.parse(nextDueAt) - now;
  if (wait <= 0) return "maintenant";
  if (wait < HOUR) return `dans ${Math.max(1, Math.round(wait / 60_000))} min`;
  if (wait < DAY) return `dans ${Math.round(wait / HOUR)} h`;
  const days = Math.round(wait / DAY);
  return days <= 1 ? "demain" : `dans ${days} jours`;
}

export function levelUpLine(word: string, level: MasteryLevelCode): string {
  return `${word} passe à ${level === "ink" ? "l'" : "la "}${MASTERY_LEVEL_LABELS[level]} !`;
}

/** "4 bonnes réponses sur 5", plus the level ups, if any. */
export function recapLine(answers: readonly AnsweredQuestion[]): string {
  const right = answers.filter((answer) => answer.correct).length;
  const score =
    right === 0
      ? `Aucune bonne réponse sur ${answers.length}`
      : `${right} bonne${right > 1 ? "s" : ""} réponse${right > 1 ? "s" : ""} sur ${answers.length}`;
  const ups = answers.filter((answer) => answer.levelUp).length;
  return ups === 0
    ? score
    : `${score}, ${ups} carte${ups > 1 ? "s" : ""} montée${ups > 1 ? "s" : ""} de niveau`;
}

export function feedbackLine(correct: boolean): string {
  return correct ? "Bien vu." : "Raté. C'était celle-ci.";
}

function bonusCount(count: number, noun: PackNoun): string {
  return count === 1 ? `Un ${noun.one} bonus` : `${count} ${noun.many} bonus`;
}

/** What an answer earned: "Un pli bonus pour le défi du jour !", and what the cap took. */
export function bonusLines(bonus: AnswerBonus, noun: PackNoun = DEFAULT_PACK_NOUN): string[] {
  const lines: string[] = [];
  if (bonus.daily > 0) lines.push(`${bonusCount(bonus.daily, noun)} pour le défi du jour !`);
  if (bonus.gilded > 0) lines.push(`${bonusCount(bonus.gilded, noun)} pour la Dorure !`);
  const lost = bonus.daily + bonus.gilded - bonus.credited;
  if (lost > 0) {
    lines.push(
      `Réserve pleine, ${lost === 1 ? `ce ${noun.one} bonus est perdu` : `${lost} ${noun.many} bonus perdus`}.`,
    );
  }
  return lines;
}

/** "2 plis bonus gagnés…" for the recap, or `null` when the session earned none. */
export function sessionBonusLine(
  answers: readonly AnsweredQuestion[],
  noun: PackNoun = DEFAULT_PACK_NOUN,
): string | null {
  const won = answers.reduce((sum, answer) => sum + answer.bonus.credited, 0);
  if (won === 0) return null;
  const count = won === 1 ? `1 ${noun.one} bonus gagné` : `${won} ${noun.many} bonus gagnés`;
  return `${count}, en réserve.`;
}

/** "+75 XP gagnés pendant ce défi" for the recap, or `null` when the session earned none. */
export function sessionXpLine(answers: readonly AnsweredQuestion[]): string | null {
  const xp = answers.reduce((sum, answer) => sum + answer.progress.xpGained, 0);
  return xp === 0 ? null : `+${xp} XP`;
}
