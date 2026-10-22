/**
 * Pseudo of a player: unique, 3 to 20 characters, filtered when sent, changed at most
 * once a month. Pure functions: the server checks uniqueness on `key` with a unique index.
 *
 * The filter (`moderation/text-filter`) is a deterministic floor, not a judge: a pseudo it lets
 * through can still be reported.
 */

import type { EpochMs } from "../booster/refill";
import { isRefusedName } from "../moderation/text-filter";

export interface PseudoRules {
  /** Period start; the rules in force when the pseudo is sent apply. */
  readonly startsAt: EpochMs;
  readonly minLength: number;
  readonly maxLength: number;
  /** Time between two changes of pseudo. The first choice is free. */
  readonly changeEveryMs: number;
}

export type PseudoSchedule = readonly [PseudoRules, ...PseudoRules[]];

export function pseudoRulesAt(schedule: PseudoSchedule, time: EpochMs): PseudoRules {
  let active = schedule[0];
  for (const rules of schedule) {
    if (rules.startsAt > time) break;
    active = rules;
  }
  return active;
}

export type PseudoRefusal = "too_short" | "too_long" | "invalid_characters" | "refused";

export type PseudoCheck =
  | {
      readonly ok: true;
      /** As shown: trimmed, inner spaces collapsed. */
      readonly pseudo: string;
      /** Uniqueness key: "Râph", "raph" and "R.aph" are the same pseudo. */
      readonly key: string;
    }
  | { readonly ok: false; readonly reason: PseudoRefusal };

/**
 * Latin letters and digits, with single spaces, apostrophes, dots, hyphens or underscores between
 * them. Latin only: a Cyrillic "о" would let anyone pass for someone else.
 */
const SHAPE = /^[\p{Script=Latin}\p{Nd}]+(?:[ '._-][\p{Script=Latin}\p{Nd}]+)*$/u;
const SEPARATORS = /[ '._-]/g;

export function checkPseudo(rules: PseudoRules, raw: string): PseudoCheck {
  const pseudo = raw.normalize("NFC").trim().replaceAll(/\s+/g, " ");
  const length = [...pseudo].length;
  if (length > rules.maxLength) return { ok: false, reason: "too_long" };
  if (!SHAPE.test(pseudo)) {
    return { ok: false, reason: length < rules.minLength ? "too_short" : "invalid_characters" };
  }
  const key = pseudoKey(pseudo);
  if (length < rules.minLength || key.length < rules.minLength) {
    return { ok: false, reason: "too_short" };
  }
  if (isRefusedName(pseudo)) return { ok: false, reason: "refused" };
  return { ok: true, pseudo, key };
}

/** Lower case, without accents nor separators. */
export function pseudoKey(pseudo: string): string {
  return pseudo.normalize("NFD").replaceAll(/\p{M}/gu, "").toLowerCase().replaceAll(SEPARATORS, "");
}

/** When the player may change their pseudo again; `null` if they never chose one. */
export function nextPseudoChange(rules: PseudoRules, changedAt: EpochMs | null): EpochMs | null {
  return changedAt === null ? null : changedAt + rules.changeEveryMs;
}
