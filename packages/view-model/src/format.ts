/** Number and time formats shown to players, the same on every platform. */

const COUNT = new Intl.NumberFormat("fr-FR");

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

export function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** The word for a pack (P53): « sachet » everywhere, « pli » while that shape is tried. */
export interface PackNoun {
  readonly one: string;
  readonly many: string;
}

export const SACHET_NOUN: PackNoun = { one: "sachet", many: "sachets" };
