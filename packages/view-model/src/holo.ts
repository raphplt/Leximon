import { type Rarity, rarityRank } from "@leximon/core";

/**
 * Light on a card held in the hand: where the light falls, how far the card tilts, and which
 * layers each rarity gets. Pure functions: the web turns them into CSS variables, the app into
 * animated values.
 */

/** Steepest tilt of a card under the finger or with the phone, in degrees. */
const MAX_TILT = 9;

export interface HoloLight {
  /** Where the light falls, in % of the card's width and height. */
  readonly x: number;
  readonly y: number;
  /** Rotation around the horizontal and vertical axes, in degrees. */
  readonly rotateX: number;
  readonly rotateY: number;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function light(x: number, y: number): HoloLight {
  return {
    x: x * 100,
    y: y * 100,
    // The card leans away from the finger, like a card pressed at that point.
    rotateX: (0.5 - y) * 2 * MAX_TILT,
    rotateY: (x - 0.5) * 2 * MAX_TILT,
  };
}

/** Light under a pointer at (`left`, `top`) px from the corner of a `width` × `height` card. */
export function holoFromPointer(
  left: number,
  top: number,
  width: number,
  height: number,
): HoloLight {
  if (width <= 0 || height <= 0) return light(0.5, 0.5);
  return light(clamp(left / width, 0, 1), clamp(top / height, 0, 1));
}

/** Range of the phone's tilt mapped to the whole card, in degrees either side of the rest. */
const ORIENTATION_RANGE = 25;
/** How a phone is usually held to look at it: tipped back about 45 degrees. */
const RESTING_BETA = 45;

/**
 * Light from the phone's tilt (`deviceorientation`): `beta` front to back, `gamma` left to
 * right, both in degrees.
 */
export function holoFromOrientation(beta: number, gamma: number): HoloLight {
  const x = 0.5 + clamp(gamma / ORIENTATION_RANGE, -1, 1) / 2;
  const y = 0.5 + clamp((beta - RESTING_BETA) / ORIENTATION_RANGE, -1, 1) / 2;
  return light(x, y);
}

export interface HoloLayers {
  /** Light patch following the finger: none on plain paper, soft, then bright. */
  readonly glare: "none" | "soft" | "bright";
  /** Metallic glint on the rarity gem. */
  readonly gem: boolean;
  /** Foil on the frame. */
  readonly frame: "none" | "cobalt" | "gold" | "iridescent";
  /** Glitter on the paper, visible where the light falls. */
  readonly glitter: "none" | "gold" | "rainbow";
  /** Rainbow sheen over the whole card. */
  readonly rainbow: boolean;
  /** A flash crossing the card every few seconds, even untouched. */
  readonly sweep: boolean;
}

/** The effects grow with the rarity: each one keeps the previous ones and adds its own. */
export function holoLayers(rarity: Rarity): HoloLayers {
  const rank = rarityRank(rarity);
  return {
    glare: rank === 0 ? "none" : rank === 1 ? "soft" : "bright",
    gem: rank >= rarityRank("rare"),
    frame:
      rarity === "precious"
        ? "cobalt"
        : rarity === "epic"
          ? "gold"
          : rarity === "legendary"
            ? "iridescent"
            : "none",
    glitter: rarity === "epic" ? "gold" : rarity === "legendary" ? "rainbow" : "none",
    rainbow: rarity === "legendary",
    sweep: rarity === "legendary",
  };
}
