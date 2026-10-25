import { type PackNoun, SACHET_NOUN } from "./format";

/**
 * The pack shape players see and the word the interface uses for it: with the pouch,
 * « sachet » everywhere; with the fold, « pli ». Both nouns are masculine, so only the noun
 * changes in a sentence.
 */

export const PACK_SHAPES = ["pli", "sachet"] as const;
export type PackShape = (typeof PACK_SHAPES)[number];

/** The shape every player sees, picked by the owner. */
export const PACK_SHAPE: PackShape = "sachet";

export const PACK_NOUNS: Readonly<Record<PackShape, PackNoun>> = {
  pli: { one: "pli", many: "plis" },
  sachet: SACHET_NOUN,
};

/** Noun of the shape in force, also used by tests. */
export const DEFAULT_PACK_NOUN = PACK_NOUNS[PACK_SHAPE];

/** "1 pli", "3 sachets". */
export function countPacks(count: number, noun: PackNoun): string {
  return `${count} ${count > 1 ? noun.many : noun.one}`;
}

/** What the screen tells the player to do with a sealed pack, until they close the hint. */
export const OPEN_HINTS: Readonly<Record<PackShape, string>> = {
  pli: "Tire sur la bande, ou touche le sceau.",
  sachet: "Tire sur le pointillé, ou touche le sachet.",
};
