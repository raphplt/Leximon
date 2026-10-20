import { type ExperimentsResponse, packShapeSchema } from "@leximon/contract";
import { PACK_SHAPE_EXPERIMENT } from "@leximon/core";
import type { z } from "zod";

/**
 * The pack shape a player sees (P47), and the word the interface uses for it: whoever sees the
 * pouch reads « sachet » everywhere, whoever sees the fold reads « pli » (P53). Both nouns are
 * masculine, so only the noun changes in a sentence.
 */

export type PackShape = z.infer<typeof packShapeSchema>;

export interface PackNoun {
  readonly one: string;
  readonly many: string;
}

export const PACK_NOUNS: Readonly<Record<PackShape, PackNoun>> = {
  pli: { one: "pli", many: "plis" },
  sachet: { one: "sachet", many: "sachets" },
};

/** Noun used before the player's shape is known, and by tests. */
export const DEFAULT_PACK_NOUN = PACK_NOUNS.pli;

export function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** "1 pli", "3 sachets". */
export function countPacks(count: number, noun: PackNoun): string {
  return `${count} ${count > 1 ? noun.many : noun.one}`;
}

/** A shape asked for in the address (`?paquet=sachet`), to preview a variant; `null` if none. */
export function packShapeFromSearch(search: string): PackShape | null {
  const asked = packShapeSchema.safeParse(new URLSearchParams(search).get("paquet"));
  return asked.success ? asked.data : null;
}

/** The player's shape: a preview asked for wins, then their A/B variant, then the control. */
export function choosePackShape(
  preview: PackShape | null,
  variants: ExperimentsResponse["variants"] | null,
): PackShape {
  if (preview !== null) return preview;
  const variant = packShapeSchema.safeParse(variants?.[PACK_SHAPE_EXPERIMENT.key]);
  return variant.success ? variant.data : PACK_SHAPE_EXPERIMENT.variants[0];
}
