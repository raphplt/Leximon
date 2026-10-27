/** How card values read, the same on every platform. */

import { capitalize, formatCount } from "./format";

/**
 * Discreet frequency figure printed on a card: "one occurrence in N words", e.g.
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
 * The same figure as a sentence, for the reveal and the share text: "Imprimé une fois sur
 * 17 milliards de mots." Below what Ngram measures, the word is simply not found in today's books.
 */
export function frequencyLine(perBillion: number | null): string {
  if (perBillion === null || perBillion <= 0) return "Introuvable dans les livres d'aujourd'hui.";
  const oneIn = 1e9 / perBillion;
  if (oneIn >= 1e9) return `Imprimé une fois sur ${largeCount(oneIn / 1e9, "milliard")} de mots.`;
  if (oneIn >= 1e6) return `Imprimé une fois sur ${largeCount(oneIn / 1e6, "million")} de mots.`;
  const rounded = Number(oneIn.toPrecision(2)).toLocaleString("fr-FR").replace(/\s/g, "\u00a0");
  return `Imprimé une fois sur ${rounded} mots.`;
}

/** What a player shares on a Légendaire: the word and its rarity. */
export function shareText(word: string, perBillion: number | null): string {
  return `${capitalize(word)}. ${frequencyLine(perBillion)}`;
}

/** URL path of a card's public page, the link a share carries. */
export function cardPath(cardId: string): string {
  return `/carte/${encodeURIComponent(cardId)}`;
}

/** Said when the share sheet is missing and the text and link went to the clipboard. */
export const CARD_SHARE_COPIED = "Copié, avec le lien de la carte.";

/** The browser refused the clipboard: the link, to copy by hand. */
export function cardShareRefused(url: string): string {
  return `Le navigateur a bloqué la copie. Lien de la carte : ${url}`;
}

/** Under a card's public page, for someone who does not play yet. */
export function cardPagePitch(cardCount: number): string {
  return `Leximon en a ${formatCount(cardCount)} comme celui-là, à collectionner en ouvrant des sachets gratuits chaque jour.`;
}
export const CARD_PAGE_ACTION = "Ouvrir mon premier sachet";
export const CARD_NOT_FOUND = "Cette carte est introuvable.";

/** The title of a card's public page and of its shared link. */
export function cardPageTitle(word: string): string {
  return `${capitalize(word)} · Leximon`;
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
