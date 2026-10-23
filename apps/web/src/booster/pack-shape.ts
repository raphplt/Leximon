import type { PackShape } from "@/lib/pack-shape";
import type { PackCollection } from "./pack-looks";

/**
 * Props shared by the two pack shapes: the rest of
 * the opening never knows which one it shows.
 */
export interface PackProps {
  /** `opening` once the player has opened it: the strip flies off and the cards come out. */
  readonly state: "sealed" | "empty" | "opening";
  /** The tear has really begun: time to ask the server for the cards. */
  readonly onTearStart: () => void;
  readonly onOpen: () => void;
  /** The collection the pack holds: the sachet takes its colors and emblem. */
  readonly collection: PackCollection;
  /** Empty, the share of the wait for the next one already gone: the color comes back up. */
  readonly refill?: number | null | undefined;
  /** Empty, the time left before the next one (« 12 min »), written on the pack. */
  readonly refillLabel?: string | null | undefined;
  /** Held still: a sachet waiting behind the counter's does not sway. */
  readonly still?: boolean | undefined;
}

/** What the screen tells the player to do with a sealed pack, until they close the hint. */
export const OPEN_HINTS: Readonly<Record<PackShape, string>> = {
  pli: "Tire sur la bande, ou touche le sceau.",
  sachet: "Tire sur le pointillé, ou touche le sachet.",
};
