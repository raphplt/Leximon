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

/** The three steps of mastery and what is left to climb, from the memory stability. */
export function masteryView(memory: WordMemory | undefined, now: number): MasteryView {
  const { ink, gilded } = masteryRulesAt(MASTERY_SCHEDULE, now).levelThresholdDays;
  const level = memory?.level ?? "sketch";
  const reachedIndex = LEVELS.indexOf(level);
  const steps = LEVELS.map((step, index) => ({
    level: step,
    label: MASTERY_LEVEL_LABELS[step],
    reached: index <= reachedIndex,
  }));
  if (memory === undefined) {
    return { steps, text: `Pas encore révisé. Un défi le met en route.` };
  }
  const held = Math.floor(memory.stability);
  switch (level) {
    case "sketch": {
      const left = Math.max(1, Math.ceil(ink - memory.stability));
      const retained =
        held < 1 ? "Retenu moins d'un jour" : `Retenu ${plural(held, "jour", "jours")} sur ${ink}`;
      return { steps, text: `${retained}. Encore ${left} pour l'Encre.` };
    }
    case "ink": {
      const left = Math.max(1, Math.ceil(gilded - memory.stability));
      return { steps, text: `Encore ${plural(left, "jour", "jours")} pour la Dorure.` };
    }
    case "gilded":
      return { steps, text: "Doré. Il ne bouge plus." };
  }
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

/** When the word can be reviewed: now, or « Revient dans 3 jours. » */
export function reviewState(
  memory: WordMemory | undefined,
  now: number,
): { readonly due: true } | { readonly due: false; readonly label: string } {
  if (memory === undefined || memory.due <= now) return { due: true };
  return { due: false, label: `Revient ${comeBackIn(memory.due - now)}.` };
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
