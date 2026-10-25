import type { CatalogCard, CatalogEngraving } from "@leximon/contract";
import { type Rarity, rarityRank } from "@leximon/core";

/**
 * How a card's engraving is laid out: pure functions, in units of the 300 × 420 reference card.
 * Owner's choice (2026-10-20): the ink alone in the word's colour, over a misregistered plate of
 * the rarity colour from Rare upward; tall subjects break out upward into the header row.
 */

/** Engraving of a published card: `ink` and `fill` are alpha WebP files, relative to the catalogue. */
export type Engraving = CatalogEngraving;

/** Engraving slot of the reference card, between the rarity band and the word. */
export const ENGRAVING_SLOT = { width: 258, height: 118 } as const;
/** How far a tall subject may rise above the slot, into the header row. */
const OVERFLOW = 26;
/** Share of the slot width a tall subject may take: it sits right of centre. */
const TALL_MAX_WIDTH = 0.86;
/** Below this width / height ratio, a subject is tall enough to break out of the slot. */
const TALL_RATIO = 0.85;

/** Catalogues published before engravings have no such field: the card has no engraving. */
export function engravingOf(card: CatalogCard): Engraving | null {
  return card.engraving ?? null;
}

export function isTall(engraving: Pick<Engraving, "width" | "height">): boolean {
  return engraving.width / engraving.height < TALL_RATIO;
}

/** Only Rare and above get the second, colour plate: common cards stay one-colour prints. */
export function hasPlate(rarity: Rarity): boolean {
  return rarityRank(rarity) >= rarityRank("rare");
}

export interface EngravingBox {
  readonly tall: boolean;
  /** Size of the drawn image, in card units. */
  readonly width: number;
  readonly height: number;
}

/**
 * Size of the engraving on the card: contained in the slot, or, for a tall subject, contained in
 * the slot raised by the overflow, so it gains height without taking room from the text.
 */
export function engravingBox(engraving: Pick<Engraving, "width" | "height">): EngravingBox {
  const tall = isTall(engraving);
  const maxWidth = tall ? ENGRAVING_SLOT.width * TALL_MAX_WIDTH : ENGRAVING_SLOT.width;
  const maxHeight = tall ? ENGRAVING_SLOT.height + OVERFLOW : ENGRAVING_SLOT.height;
  const scale = Math.min(maxWidth / engraving.width, maxHeight / engraving.height);
  return { tall, width: engraving.width * scale, height: engraving.height * scale };
}

/** Credit shown to the player (CC BY requires it): the catalogue's line already holds author,
 * source and licence ("D'après X, 1849 · fonds (licence)"); `licence` alone is for filtering. */
export function creditLine(engraving: Pick<Engraving, "credit">): string {
  return engraving.credit;
}

/** A web address with a host and nothing a link could be tricked with: no space, no quote. */
const WEB_ADDRESS = /^https?:\/\/[^\s/?#"'<>]+[^\s"'<>]*$/i;

/** The source link, only if it is a plain web address (catalogue data is still external input). */
export function safeSourceUrl(engraving: Pick<Engraving, "sourceUrl">): string | null {
  return WEB_ADDRESS.test(engraving.sourceUrl) ? engraving.sourceUrl : null;
}
