import { MASTERY_LEVEL_LABELS, type MasteryLevelCode } from "@leximon/contract";
import { MASTERY_SCHEDULE, masteryRulesAt } from "@leximon/core";
import type { WordMemory } from "./album";
import { isFeatureOpen } from "./features";
import { plural } from "./format";

/** The card sheet: what the player knows of one card. */

export interface MasteryStep {
  readonly label: string;
  readonly reached: boolean;
  readonly level: MasteryLevelCode;
}

export interface MasteryView {
  readonly steps: readonly MasteryStep[];
  /** « Retenu 3 jours sur 7. Encore 4 pour l'Encre. » */
  readonly text: string;
}

const LEVELS: readonly MasteryLevelCode[] = ["sketch", "ink", "gilded"];

/** The three steps of mastery and what it takes to climb the next one. */
export function masteryView(memory: WordMemory | undefined, now: number): MasteryView {
  const rules = masteryRulesAt(MASTERY_SCHEDULE, now);
  const level = memory?.level ?? "sketch";
  const reachedIndex = LEVELS.indexOf(level);
  const steps = LEVELS.map((step, index) => ({
    level: step,
    label: MASTERY_LEVEL_LABELS[step],
    reached: index <= reachedIndex,
  }));
  if (memory === undefined) {
    return { steps, text: "Pas encore révisé." };
  }
  if (level === "gilded") return { steps, text: "Doré. Il ne bouge plus." };
  const next = level === "sketch" ? "ink" : "gilded";
  const days = rules.levelThresholdDays[next];
  const name = next === "ink" ? "l'Encre" : "la Dorure";
  // Answers are never taken early: the next one comes at the due date at the soonest.
  const nextGap =
    memory.lastReviewedAt === null ? 0 : (Math.max(memory.due, now) - memory.lastReviewedAt) / DAY;
  return {
    steps,
    text:
      nextGap >= days
        ? `Juste à la prochaine révision, et c'est ${name}.`
        : `Retrouve-le ${days} jours après une révision, et c'est ${name}.`,
  };
}

/** « 1 exemplaire », « 3 exemplaires · 2 doubles ». */
export function copiesLabel(quantity: number): string {
  if (quantity <= 1) return "1 exemplaire";
  return `${quantity} exemplaires · ${plural(quantity - 1, "double", "doubles")}`;
}

/** A double can go to trade once the trades are open. */
export function canOfferInTrade(quantity: number, level: number, now: number): boolean {
  return quantity > 1 && isFeatureOpen("trade", level, now);
}

/** Where the word stands in the challenges: « Il t'attend dans les défis. », « Revient dans 3 jours. » */
export function reviewLabel(memory: WordMemory | undefined, now: number): string | null {
  if (memory === undefined) return null;
  if (memory.due <= now) return "Il t'attend dans les défis.";
  return `Revient ${comeBackIn(memory.due - now)}.`;
}

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

/** « dans 20 min », « dans 3 h », « demain », « dans 5 jours ». */
export function comeBackIn(wait: number): string {
  if (wait < HOUR) return `dans ${Math.max(1, Math.round(wait / 60_000))} min`;
  if (wait < DAY) return `dans ${Math.round(wait / HOUR)} h`;
  const days = Math.round(wait / DAY);
  return days <= 1 ? "demain" : `dans ${days} jours`;
}

/** A mistake spotted on a card: sent as feedback from the card's page, so we know which. */
export const CARD_REPORT = {
  button: "Signaler une erreur",
  title: "Une erreur sur cette carte ?",
  label: "Définition, citation, gravure ou son : dis ce qui cloche.",
} as const;
