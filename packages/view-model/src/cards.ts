/** How card values read, the same on every platform. */

import { capitalize } from "./format";

/**
 * Discreet frequency figure printed on a card (P22): "one occurrence in N words", e.g.
 * "1/3,6 M" or "1/7,7 Md". Below what Ngram measures, "< 1/Md".
 */
export function formatOdds(perBillion: number | null): string {
  if (perBillion === null || perBillion <= 0) return "< 1/Md";
  const oneIn = 1e9 / perBillion;
  if (oneIn >= 1e9) return `1/${twoDigits(oneIn / 1e9)} Md`;
  if (oneIn >= 1e6) return `1/${twoDigits(oneIn / 1e6)} M`;
  return `1/${twoDigits(oneIn / 1e3)} k`;
}

/**
 * The same figure as a sentence, for the reveal and the share text: "Un mot imprimé sur
 * 17 milliards." Below what Ngram measures, the word is simply not found in today's books.
 */
export function frequencyLine(perBillion: number | null): string {
  if (perBillion === null || perBillion <= 0) return "Introuvable dans les livres d'aujourd'hui.";
  const oneIn = 1e9 / perBillion;
  if (oneIn >= 1e9) return `Un mot imprimé sur ${largeCount(oneIn / 1e9, "milliard")}.`;
  if (oneIn >= 1e6) return `Un mot imprimé sur ${largeCount(oneIn / 1e6, "million")}.`;
  const rounded = Number(oneIn.toPrecision(2)).toLocaleString("fr-FR").replace(/\s/g, "\u00a0");
  return `Un mot imprimé sur ${rounded}.`;
}

/** What a player shares on a Légendaire: the word first, its rarity, then the boast. */
export function shareText(word: string, perBillion: number | null): string {
  return `${capitalize(word)}. ${frequencyLine(perBillion)} Moi, je l'ai.`;
}

/** "1 milliard", "1,5 milliard", "17 milliards": the noun takes an s from 2 on. */
function largeCount(value: number, noun: string): string {
  const rounded = Number(value.toPrecision(2));
  return `${twoDigits(value)}\u00a0${noun}${rounded >= 2 ? "s" : ""}`;
}

/** Two significant digits, French decimal comma, no trailing zero. */
function twoDigits(value: number): string {
  const rounded = Number(value.toPrecision(2));
  return rounded.toLocaleString("fr-FR", { maximumFractionDigits: 1 }).replace(/\s/g, " ");
}
