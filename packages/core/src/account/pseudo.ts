/**
 * Pseudo of a player (P-08, N5): unique, 3 to 20 characters, filtered when sent, changed at most
 * once a month. Pure functions: the server checks uniqueness on `key` with a unique index.
 *
 * The filter is a deterministic floor, not a judge: a pseudo it lets through can still be reported.
 * It holds the slurs of the content pipeline (`content/pipeline/…/exclusions.py`, checked by a
 * test), common insults, and names that would pass for the game's staff.
 */

import type { EpochMs } from "../booster/refill";

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
  if (isRefused(pseudo)) return { ok: false, reason: "refused" };
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

// --- Filter --------------------------------------------------------------------------------------

/** Found anywhere in the pseudo: no ordinary word holds them. */
const CONTAINS = [
  // Slurs of the content pipeline.
  "bamboula",
  "bicot",
  "bougnoul",
  "boucaque",
  "chinetoque",
  "crouille",
  "meteque",
  "moricaud",
  "negre",
  "negresse",
  "negrillon",
  "negro",
  "niakoue",
  "rastaquouere",
  "youpin",
  "youtre",
  "encule",
  "fiotte",
  "gouine",
  "sodomite",
  "tantouze",
  "tarlouze",
  "petasse",
  "pouffiasse",
  "salope",
  "gogol",
  "mongol",
  // Insults and hate.
  "connard",
  "connasse",
  "enfoire",
  "batard",
  "salaud",
  "merde",
  "couille",
  "putain",
  "nazi",
  "hitler",
  "fuhrer",
  "pedophil",
  "porno",
  "fuck",
  "nigg",
  "bitch",
  // Staff.
  "leximon",
];

/** At the start of a word of the pseudo: "technique" holds "nique", "pedestre" holds "pede". */
const PREFIX = [
  "nique",
  "pute",
  "salop",
  "pedo",
  "bite",
  "rital",
  // "badminton" holds "admin".
  "admin",
  "moderat",
];

/** A whole word of the pseudo, or the whole pseudo: too short or too common to look inside words. */
const EXACT = [
  "con",
  "cul",
  "pd",
  "fdp",
  "ntm",
  "tg",
  "raton",
  "macaroni",
  "inverti",
  "pedale",
  "pede",
  "tapette",
  "viol",
  "kkk",
  "heil",
  "modo",
  "staff",
  "support",
  "officiel",
];

/** Digits used as letters: "s4lope" is still refused. */
const LEET: Readonly<Record<string, string>> = {
  "0": "o",
  "1": "i",
  "3": "e",
  "4": "a",
  "5": "s",
  "7": "t",
};

function isRefused(pseudo: string): boolean {
  const plain = pseudo.normalize("NFD").replaceAll(/\p{M}/gu, "").toLowerCase();
  const words = plain.split(SEPARATORS).filter((word) => word.length > 0);
  for (const variant of [words, words.map(unLeet)]) {
    const joined = variant.join("");
    if (CONTAINS.some((root) => joined.includes(root))) return true;
    if (variant.some((word) => PREFIX.some((root) => word.startsWith(root)))) return true;
    if ([...variant, joined].some((word) => EXACT.includes(word))) return true;
  }
  return false;
}

function unLeet(word: string): string {
  return [...word].map((char) => LEET[char] ?? char).join("");
}
