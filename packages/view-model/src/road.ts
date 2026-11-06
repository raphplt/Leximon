/** The level page draws a chapter as a road that winds down the page, a stop for each level. */

/** Height of a stop of the road, in pixels. */
export const ROAD_ROW = 104;

/** Where each stop stands across the road, in hundredths of its width: a gentle snake. */
const SWAY = [50, 72, 80, 64, 40, 24, 30, 52, 74, 62] as const;

export interface RoadStop {
  readonly x: number;
  readonly y: number;
  /** The side its tag goes: away from the edge it is nearest to. */
  readonly side: "left" | "right";
}

export interface RoadGeometry {
  readonly stops: readonly RoadStop[];
  readonly height: number;
  /** SVG path through every stop. */
  readonly ahead: string;
  /** SVG path through the stops reached, empty when fewer than two are. */
  readonly done: string;
}

function through(stops: readonly RoadStop[]): string {
  return stops
    .map((stop, k) => {
      const previous = stops[k - 1];
      if (previous === undefined) return `M${stop.x} ${stop.y}`;
      const middle = (previous.y + stop.y) / 2;
      return `C${previous.x} ${middle} ${stop.x} ${middle} ${stop.x} ${stop.y}`;
    })
    .join(" ");
}

/** The stops of `count` levels on a road `width` wide, `reached` of them already behind. */
export function roadGeometry(count: number, reached: number, width: number): RoadGeometry {
  const stops = Array.from({ length: count }, (_, k): RoadStop => {
    const sway = SWAY[k % SWAY.length] ?? 50;
    return {
      x: (sway / 100) * width,
      y: k * ROAD_ROW + ROAD_ROW / 2,
      side: sway > 50 ? "left" : "right",
    };
  });
  return {
    stops,
    height: count * ROAD_ROW,
    ahead: through(stops),
    done: reached < 2 ? "" : through(stops.slice(0, reached)),
  };
}
