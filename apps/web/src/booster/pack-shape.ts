/**
 * The two pack shapes compared by an A/B test (P47, docs/cahiers-des-charges/ouverture.md).
 * Both take the same props, so the rest of the opening never knows which one it shows.
 */

export const PACK_SHAPES = ["pli", "sachet"] as const;
export type PackShape = (typeof PACK_SHAPES)[number];

export interface PackProps {
  /** `opening` once the player has opened it: the strip flies off and the cards come out. */
  readonly state: "sealed" | "empty" | "opening";
  /** The tear has really begun: time to ask the server for the cards. */
  readonly onTearStart: () => void;
  readonly onOpen: () => void;
}

/** What the screen tells the player to do with a sealed pack. */
export const OPEN_HINTS: Readonly<Record<PackShape, string>> = {
  pli: "Déchire la bande ou touche le sceau",
  sachet: "Déchire le haut du sachet ou touche-le",
};

/**
 * The shape asked for in the address (`?paquet=sachet`), the fold otherwise. Only a way to see
 * both shapes until the A/B test assigns one per player.
 */
export function packShapeFromSearch(search: string): PackShape {
  const asked = new URLSearchParams(search).get("paquet");
  return PACK_SHAPES.find((shape) => shape === asked) ?? "pli";
}
