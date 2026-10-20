import type { PackShape } from "@/lib/pack-shape";

/**
 * Props shared by the two pack shapes (P47, docs/cahiers-des-charges/ouverture.md): the rest of
 * the opening never knows which one it shows.
 */
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
