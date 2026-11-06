import { quarterAt } from "./rewards";

/** The level page draws a chapter as a road that winds down the page, a stop for each level. */

/** Height of a stop of the road, in pixels. */
export const ROAD_ROW = 104;

/** Room below the last stop, where the road reaches the sign to the next chapter. */
export const ROAD_END = 120;

/** Where each stop stands across the road, in hundredths of its width: a gentle snake. */
const SWAY = [50, 72, 80, 64, 40, 24, 30, 52, 74, 62] as const;

/** The odds and ends of a reading room laid along the road, in turn; names of toy icons. */
const DECOR = ["books", "candle", "ink", "scroll", "album"] as const;
export type RoadDecorKind = (typeof DECOR)[number];

export interface RoadStop {
  readonly x: number;
  readonly y: number;
  /** The side its tag goes: away from the edge it is nearest to. */
  readonly side: "left" | "right";
}

export interface RoadDecor {
  readonly kind: RoadDecorKind;
  readonly x: number;
  readonly y: number;
  /** Every other one is drawn a little smaller, so that the row does not look stamped. */
  readonly small: boolean;
}

export interface RoadGeometry {
  readonly stops: readonly RoadStop[];
  readonly decor: readonly RoadDecor[];
  /** Where the road ends, at the sign to the next chapter. */
  readonly end: { readonly x: number; readonly y: number };
  readonly height: number;
  /** SVG path from the top of the road through every stop to its end. */
  readonly ahead: string;
  /** SVG path of the part already walked; empty when no stop is reached. */
  readonly done: string;
}

interface Point {
  readonly x: number;
  readonly y: number;
}

function through(points: readonly Point[]): string {
  return points
    .map((point, k) => {
      const previous = points[k - 1];
      if (previous === undefined) return `M${point.x} ${point.y}`;
      const middle = (previous.y + point.y) / 2;
      return `C${previous.x} ${middle} ${point.x} ${middle} ${point.x} ${point.y}`;
    })
    .join(" ");
}

/**
 * The stops of `count` levels on a road `width` wide. The road comes in from the top, where the
 * chapter before ends, and leaves at the bottom; `reached` stops are behind the player, and
 * `passed` says the player has gone past the whole chapter.
 */
export function roadGeometry(
  count: number,
  reached: number,
  passed: boolean,
  width: number,
): RoadGeometry {
  const stops = Array.from({ length: count }, (_, k): RoadStop => {
    const sway = SWAY[k % SWAY.length] ?? 50;
    return {
      x: (sway / 100) * width,
      y: k * ROAD_ROW + ROAD_ROW / 2,
      side: sway > 50 ? "left" : "right",
    };
  });
  // Between two stops, on the side the road leaves free.
  const decor = stops.slice(1).map((stop, k): RoadDecor => {
    const before = stops[k] ?? stop;
    const middle = (before.x + stop.x) / 2;
    return {
      kind: DECOR[k % DECOR.length] ?? "books",
      x: (middle < width / 2 ? 0.86 : 0.14) * width,
      y: (k + 1) * ROAD_ROW,
      small: k % 2 === 1,
    };
  });
  const height = count * ROAD_ROW + ROAD_END;
  const start = { x: stops[0]?.x ?? width / 2, y: 0 };
  const end = { x: width / 2, y: height - ROAD_END / 2 };
  const walked = stops.slice(0, reached);
  return {
    stops,
    decor,
    end,
    height,
    ahead: through([start, ...stops, end]),
    done: reached === 0 ? "" : through([start, ...walked, ...(passed ? [end] : [])]),
  };
}

export interface ChapterSign {
  readonly index: number;
  readonly name: string;
  /** Whether the player may look at it already. */
  readonly open: boolean;
  /** « Chapitre III · Niveaux 21 à 30 », or when it shows: « Tu le verras au niveau 21. » */
  readonly note: string;
}

/**
 * The sign where a chapter's road ends, toward the next chapter; the player sees `ahead`
 * chapters past their own.
 */
export function nextChapterSign(shown: number, own: number, ahead: number): ChapterSign {
  const next = quarterAt(shown + 1);
  const open = next.index <= own + ahead;
  return {
    index: next.index,
    name: next.name,
    open,
    note: open
      ? `${next.chapter} · ${next.range}`
      : `Tu le verras au niveau ${quarterAt(next.index - ahead).first}.`,
  };
}
