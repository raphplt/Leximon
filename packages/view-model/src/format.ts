/** Number and time formats shown to players, the same on every platform. */

const COUNT = new Intl.NumberFormat("fr-FR");

/**
 * French alphabetical order. One collator for every sort: `localeCompare` with a locale builds its
 * rules again on each comparison, which takes seconds over the catalogue on a phone's engine.
 */
const frenchCollator = new Intl.Collator("fr");

export function compareFrench(a: string, b: string): number {
  return frenchCollator.compare(a, b);
}

/** "1 240", with the narrow no-break space French uses between thousands. */
export function formatCount(value: number): string {
  return COUNT.format(value);
}

/** "1 coffret", "3 coffrets". */
export function plural(count: number, one: string, many: string): string {
  return `${formatCount(count)} ${count > 1 ? many : one}`;
}

/** A wait, rounded up to the minute: "18 min", "2 h 05". Never "0 min". */
export function formatWait(ms: number): string {
  const minutes = Math.max(1, Math.ceil(ms / 60_000));
  if (minutes < 60) return `${minutes} min`;
  return `${Math.floor(minutes / 60)} h ${String(minutes % 60).padStart(2, "0")}`;
}

/** « de Caractères et travers », « des Fondateurs », « du Grenier »: French contracts « de » with an article. */
export function ofName(name: string): string {
  if (name.startsWith("Les ")) return `des ${name.slice(4)}`;
  if (name.startsWith("Le ")) return `du ${name.slice(3)}`;
  return `de ${name}`;
}

export function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** The word for a pack: « sachet » everywhere, « pli » while that shape is tried. */
export interface PackNoun {
  readonly one: string;
  readonly many: string;
}

export const SACHET_NOUN: PackNoun = { one: "sachet", many: "sachets" };
