/**
 * The pack shape players see (P47) and the word the interface uses for it (P53): with the pouch,
 * « sachet » everywhere; with the fold, « pli ». Both nouns are masculine, so only the noun
 * changes in a sentence.
 */

export const PACK_SHAPES = ["pli", "sachet"] as const;
export type PackShape = (typeof PACK_SHAPES)[number];

/** The shape every player sees, until the owner picks one of the two (P47). */
export const PACK_SHAPE: PackShape = "pli";

export interface PackNoun {
  readonly one: string;
  readonly many: string;
}

export const PACK_NOUNS: Readonly<Record<PackShape, PackNoun>> = {
  pli: { one: "pli", many: "plis" },
  sachet: { one: "sachet", many: "sachets" },
};

/** Noun of the shape in force, also used by tests. */
export const DEFAULT_PACK_NOUN = PACK_NOUNS[PACK_SHAPE];

export function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** "1 pli", "3 sachets". */
export function countPacks(count: number, noun: PackNoun): string {
  return `${count} ${count > 1 ? noun.many : noun.one}`;
}

/** A shape asked for in the address (`?paquet=sachet`), to try it; `null` if none. */
export function packShapeFromSearch(search: string): PackShape | null {
  const asked = new URLSearchParams(search).get("paquet");
  return PACK_SHAPES.find((shape) => shape === asked) ?? null;
}
