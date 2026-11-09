import { room, toy, toyMatters } from "./library";

/**
 * The frames of an avatar, in the matters of the room: wood, gold, brass, leather, patina, paper,
 * ink, wax and nacre, from the plainest to the rarest. Each is a list of SVG paths around the
 * medallion, on the grid of the 84 px atelier preview, centred on 0 0: the medallion is the
 * circle of radius `AVATAR_MEDALLION`. A band is drawn as a toy: its thickness under it, a matter
 * lit from the top, an ink outline and a line of light along its top. The web and
 * react-native-svg both draw these paths, with the even-odd fill rule.
 */

export const AVATAR_MEDALLION = 42;

/** A matter: its gradient from top to bottom, and the colour of its thickness. */
export interface FrameMatter {
  readonly stops: readonly string[];
  readonly edge: string;
}

export const frameMatters = {
  wood: { stops: ["#9A6534", "#5E3A1A"], edge: room.shelf.top },
  gold: { stops: [toyMatters.gold.top, toyMatters.gold.bottom], edge: toyMatters.gold.edge },
  brass: { stops: ["#E8CB84", "#A8813A"], edge: "#6E5020" },
  indigo: { stops: ["#4A58B0", "#22307A"], edge: "#141C4E" },
  ink: { stops: ["#4466BC", "#16245A"], edge: "#0A1130" },
  /** Iron-gall ink, the brown black of the scribes. */
  gall: { stops: ["#4A3C38", "#140D0B"], edge: "#050302" },
  /** The brown calf of a binding. */
  calf: { stops: ["#86523A", "#4C2718"], edge: "#2C140B" },
  /** The black wax of a writing tablet, and the pale wood a stylus bares in it. */
  tablet: { stops: ["#3E3A30", "#1E1B15"], edge: "#100E0A" },
  boxwood: { stops: ["#DCCCAE", "#A8906E"], edge: "#6A5238" },
  /** A silk bookmark, faded to old rose. */
  silk: { stops: ["#DDA9A4", "#A9686C"], edge: "#6E3A42" },
  patina: { stops: ["#86C2A8", "#3F7A64"], edge: "#24493B" },
  red: { stops: [toyMatters.red.top, toyMatters.red.bottom], edge: toyMatters.red.edge },
  wax: { stops: ["#E2604A", "#A3201B"], edge: "#5E0F0C" },
  paper: { stops: [toyMatters.paper.top, toyMatters.paper.bottom], edge: toyMatters.paper.edge },
  nacre: {
    stops: ["#FFF0F6", "#F0C8E4", "#BEE0F2", "#D8F0C4", "#F6DCB0"],
    edge: "#A898B0",
  },
} as const satisfies Record<string, FrameMatter>;

export type FrameMatterName = keyof typeof frameMatters;

/** What paints a shape: a matter, the flat colour of its thickness, the ink, or the light. */
export type FrameInk = FrameMatterName | `${FrameMatterName}:edge` | "outline" | "sheen";

export interface FrameShape {
  readonly d: string;
  readonly fill?: FrameInk;
  /** Outlined shapes take `frameOutline` unless they say otherwise. */
  readonly stroke?: FrameInk;
  readonly strokeWidth?: number;
}

export interface AvatarFrame {
  /** Room the frame takes around the medallion in a layout; rays and lace spill over it. */
  readonly footprint: number;
  /** How far the drawing reaches from the centre. */
  readonly reach: number;
  readonly shapes: readonly FrameShape[];
  /** Shapes that slowly turn where motion is allowed, drawn under the others. */
  readonly turning?: readonly FrameShape[];
}

export const frameOutline = 1.4;
export const frameSheen = { color: "#FFFFFF", opacity: 0.55 } as const;

/** The thickness of a band, under it. */
const DEPTH = 1.6;
const R = AVATAR_MEDALLION;

const round = (value: number) => Number(value.toFixed(2));

function point(radius: number, degrees: number): [number, number] {
  const angle = (degrees * Math.PI) / 180;
  return [round(radius * Math.cos(angle)), round(radius * Math.sin(angle))];
}

function circle(cx: number, cy: number, r: number): string {
  return `M${round(cx - r)} ${round(cy)}a${r} ${r} 0 1 0 ${round(r * 2)} 0a${r} ${r} 0 1 0 ${round(-r * 2)} 0Z`;
}

/** A ring between two radii, `dy` lower. */
function ring(inner: number, outer: number, dy = 0): string {
  return `${circle(0, dy, outer)}${circle(0, dy, inner)}`;
}

/** An arc along the top of a band, from -150° to -30°, where the lamp catches it. */
function topArc(radius: number): string {
  const [x1, y1] = point(radius, -150);
  const [x2, y2] = point(radius, -30);
  return `M${x1} ${y1}A${radius} ${radius} 0 0 1 ${x2} ${y2}`;
}

const outlined = (d: string, fill: FrameInk): FrameShape => ({ d, fill, stroke: "outline" });

/** A band of a matter, drawn as a toy. */
function band(inner: number, outer: number, matter: FrameMatterName): FrameShape[] {
  return [
    outlined(ring(inner, outer, DEPTH), `${matter}:edge`),
    outlined(ring(inner, outer), matter),
    { d: topArc((inner + outer) / 2), stroke: "sheen", strokeWidth: (outer - inner) * 0.28 },
  ];
}

/** Poured wax around the medallion: an outer edge that swells and thins, `dy` lower. */
function waxRing(dy: number): string {
  const steps = 120;
  const points = Array.from({ length: steps }, (_, index) => {
    const degrees = (index / steps) * 360;
    const angle = (degrees * Math.PI) / 180;
    const radius = R + 9 + 2 * Math.sin(angle * 5) + 1.1 * Math.sin(angle * 11 + 1);
    const [x, y] = point(radius, degrees);
    return `${x} ${round(y + dy)}`;
  });
  return `M${points.join("L")}Z${circle(0, dy, R)}`;
}

/** Pointed rays from a radius, every other one reaching `short` instead of `to` when given. */
function rays(from: number, to: number, count: number, width: number, short?: number): string {
  return Array.from({ length: count }, (_, index) => {
    const degrees = (index / count) * 360 - 90;
    const tip = short !== undefined && index % 2 === 1 ? short : to;
    const [ax, ay] = point(from, degrees - width / 2);
    const [bx, by] = point(tip, degrees);
    const [cx, cy] = point(from, degrees + width / 2);
    return `M${ax} ${ay}L${bx} ${by}L${cx} ${cy}Z`;
  }).join("");
}

/** Small round things set around the medallion: pearls, scallops, studs. */
function around(radius: number, count: number, size: number, offset = 0): string {
  return Array.from({ length: count }, (_, index) => {
    const [x, y] = point(radius, (index / count) * 360 + offset);
    return circle(x, y, size);
  }).join("");
}

/** A drop of ink hanging from the band at an angle, `length` long. */
function drop(degrees: number, from: number, length: number, width: number): string {
  const [x, y] = point(from - 1, degrees);
  const bottom = y + length;
  const r = width / 2;
  const side = (sign: number) =>
    `${round(x + sign * r * 0.6)} ${round(y + length * 0.45)} ${round(x + sign * r)} ${round(bottom - r * 1.3)} ${round(x + sign * r)} ${round(bottom - r)}`;
  return `M${round(x - r * 0.55)} ${y}C${side(-1)}A${r} ${r} 0 0 0 ${round(x + r)} ${round(bottom - r)}C${round(x + r)} ${round(bottom - r * 1.3)} ${round(x + r * 0.6)} ${round(y + length * 0.45)} ${round(x + r * 0.55)} ${y}Z`;
}

/** Slanted strips across a band, as the strands of a rope. */
function strands(inner: number, outer: number, count: number): string {
  return Array.from({ length: count }, (_, index) => {
    const start = (index / count) * 360;
    const span = 360 / count / 2;
    const [ax, ay] = point(inner, start);
    const [bx, by] = point(outer, start + span * 0.9);
    const [cx, cy] = point(outer, start + span * 1.9);
    const [dx, dy] = point(inner, start + span);
    return `M${ax} ${ay}L${bx} ${by}L${cx} ${cy}L${dx} ${dy}Z`;
  }).join("");
}

/** A point of a pen's path: where the nib is, and how wide its trace is there. */
interface NibPoint {
  readonly x: number;
  readonly y: number;
  readonly nx: number;
  readonly ny: number;
  readonly width: number;
}

/**
 * The broad nib of a scribe, held at a fixed slant: its trace is thin where the pen runs along the
 * slant and full across it, which gives a flourish its thick and thin.
 */
const NIB_SLANT = (-50 * Math.PI) / 180;

/**
 * A scribe's flourish around the medallion: one pen stroke that runs round it in cursive loops,
 * each loop an oval `rise` high and `sweep` long, centred `middle` from the centre and tilted.
 */
interface Flourish {
  readonly loops: number;
  readonly middle: number;
  readonly rise: number;
  readonly sweep: number;
  readonly tilt: number;
  /** How much every other loop grows, and the one between shrinks with a finer trace. */
  readonly swell: number;
  readonly thin: number;
  readonly full: number;
}

function flourishPath(flourish: Flourish, samplesPerLoop: number): NibPoint[] {
  const { loops, middle, rise, sweep, tilt, swell, thin, full } = flourish;
  const count = loops * samplesPerLoop;
  const sizeAt = (t: number) => 1 + swell * Math.sin((loops * t) / 2);
  const at = (t: number): [number, number] => {
    const phase = loops * t;
    const size = sizeAt(t);
    const out = -rise * size * Math.cos(phase);
    const along = sweep * size * Math.sin(phase);
    const radius = middle + out * Math.cos(tilt) - along * Math.sin(tilt);
    const back = out * Math.sin(tilt) + along * Math.cos(tilt);
    return [radius * Math.cos(t) - back * Math.sin(t), radius * Math.sin(t) + back * Math.cos(t)];
  };
  return Array.from({ length: count + 1 }, (_, index) => {
    const t = (index / count) * 2 * Math.PI;
    const [x, y] = at(t);
    const [ax, ay] = at(t - 1e-4);
    const [bx, by] = at(t + 1e-4);
    const direction = Math.atan2(by - ay, bx - ax);
    const length = Math.hypot(bx - ax, by - ay);
    const width =
      (thin + (full - thin) * Math.abs(Math.sin(direction - NIB_SLANT))) * Math.min(1, sizeAt(t));
    return { x, y, nx: -(by - ay) / length, ny: (bx - ax) / length, width };
  });
}

/** A tenth of the grid is finer than a pixel at every size shown, and keeps long traces light. */
const fine = (value: number) => Number(value.toFixed(1));

const side = (points: readonly NibPoint[], sign: number, dy: number) =>
  points.map(
    (p) =>
      `${fine(p.x + (sign * p.nx * p.width) / 2)} ${fine(p.y + (sign * p.ny * p.width) / 2 + dy)}`,
  );

/** The trace of a run of the nib, as a closed shape, `dy` lower. */
function trace(points: readonly NibPoint[], dy = 0): string {
  return `M${side(points, 1, dy).join("L")}L${side(points, -1, dy).reverse().join("L")}Z`;
}

/** The two edges of a run of the nib, open at its ends so that runs join without a seam. */
function traceEdges(points: readonly NibPoint[]): string {
  return `M${side(points, 1, 0).join("L")}M${side(points, -1, 0).join("L")}`;
}

/** A line of light along the full strokes of a run, on the side the lamp lights. */
function traceSheen(points: readonly NibPoint[]): string {
  const lit = points.map((p) => {
    const toward = p.ny < 0 ? 1 : -1;
    return {
      on: p.width > 2.2,
      at: `${fine(p.x + toward * p.nx * p.width * 0.2)} ${fine(p.y + toward * p.ny * p.width * 0.2)}`,
    };
  });
  return lit.map((p, index) => (p.on ? `${lit[index - 1]?.on ? "L" : "M"}${p.at}` : "")).join("");
}

/**
 * The flourish split in two layers: each loop's way up, then its way down, which crosses over the
 * way up as a later stroke of the pen lies over an earlier one.
 */
function flourishLayers(flourish: Flourish): [NibPoint[][], NibPoint[][]] {
  const perLoop = 20;
  const { loops } = flourish;
  const points = flourishPath(flourish, perLoop);
  const runs = Array.from({ length: loops * 2 }, (_, index) => {
    // Runs start half a loop early, so that each loop's apex is a cut between the two layers.
    const start = index * (perLoop / 2) - perLoop / 2;
    return Array.from({ length: perLoop / 2 + 1 }, (_, step) => {
      const at = (start + step + loops * perLoop) % (loops * perLoop);
      return points[at] as NibPoint;
    });
  });
  // The even runs come down from an apex, the odd ones climb to it.
  return [runs.filter((_, index) => index % 2 === 1), runs.filter((_, index) => index % 2 === 0)];
}

/**
 * The flourish in ink: the thickness of both layers first, so that no cut between two runs shows,
 * then each layer's trace, edges and light.
 */
function inkFlourish(layers: readonly NibPoint[][][]): FrameShape[] {
  return [
    ...layers.map(
      (runs): FrameShape => ({
        d: runs.map((run) => trace(run, 1)).join(""),
        fill: "gall:edge",
      }),
    ),
    ...layers.flatMap((runs): FrameShape[] => [
      { d: runs.map((run) => trace(run)).join(""), fill: "gall" },
      { d: runs.map(traceEdges).join(""), stroke: "outline", strokeWidth: 0.8 },
      { d: runs.map(traceSheen).join(""), stroke: "sheen", strokeWidth: 0.5 },
    ]),
  ];
}

/**
 * The paper a dark ornament is cut out of, as a thin rim around it: ink alone would vanish on the
 * dark shelves of the room. Drawn first, a hair lower, so that its path is its own.
 */
function paperRim(d: string, width: number): FrameShape {
  return { d, stroke: "paper", strokeWidth: width };
}

/** A scribe's flourish straight on the page, around a thin rule of ink. */
function cadelerFrame(flourish: Flourish): AvatarFrame {
  const [up, down] = flourishLayers(flourish);
  const rim = [...up, ...down].map((run) => trace(run, 0.4)).join("");
  return {
    footprint: 8,
    reach: R + 12,
    shapes: [
      paperRim(`${rim}${circle(0, 0.4, R + 1.6)}`, 2.6),
      ...band(R, R + 1.6, "gall"),
      ...inkFlourish([up, down]),
    ],
  };
}

/**
 * A ring of mosaic tesserae round the medallion, boxwood and calf set in dark grout: the token by
 * which the first Christians knew each other, worn by the first patrons.
 */
function tessereFrame(): AvatarFrame {
  const count = 30;
  const step = 360 / count;
  const inner = R + 1.1;
  const outer = R + 6.5;
  // A fixed unevenness rather than chance: the frame must draw the same on every screen.
  const tile = (index: number, dy: number) => {
    const start = index * step - 90 + 0.8;
    const end = start + step - 1.6;
    const lean = 0.5 * Math.sin(index * 2.7);
    const swell = 0.45 * Math.sin(index * 1.9 + 1);
    const corners = [
      point(inner, start + lean * 0.4),
      point(outer + swell, start - lean * 0.3),
      point(outer + swell, end - lean * 0.3),
      point(inner, end + lean * 0.4),
    ];
    return `M${corners.map(([x, y]) => `${x} ${round(y + dy)}`).join("L")}Z`;
  };
  const tiles = (matter: number, dy: number) =>
    Array.from({ length: count }, (_, index) => index)
      .filter((index) => (index % 3 === 1 ? 1 : 0) === matter)
      .map((index) => tile(index, dy))
      .join("");
  const lit = Array.from({ length: count }, (_, index) => index)
    .map((index) => {
      const start = index * step - 90 + 1.6;
      const end = start + step - 3.2;
      if (start < -150 || end > -30) return "";
      const [ax, ay] = point(outer - 0.9, start);
      const [bx, by] = point(outer - 0.9, end);
      return `M${ax} ${ay}L${bx} ${by}`;
    })
    .join("");
  return {
    footprint: 7,
    reach: R + 10,
    shapes: [
      outlined(ring(R, R + 7.6, DEPTH), "gall:edge"),
      outlined(ring(R, R + 7.6), "gall"),
      { d: `${tiles(0, 0.6)}${tiles(1, 0.6)}`, fill: "gall:edge" },
      { d: tiles(0, 0), fill: "boxwood" },
      { d: tiles(1, 0), fill: "calf" },
      { d: lit, stroke: "sheen", strokeWidth: 0.7 },
    ],
  };
}

const CADELER: Flourish = {
  loops: 16,
  middle: R + 6.2,
  rise: 3.8,
  sweep: 6.4,
  tilt: 0.45,
  swell: 0.35,
  thin: 0.35,
  full: 2.8,
};

/** Turns a point of a frame drawn on the top of the medallion to `degrees` around it. */
function turn(x: number, y: number, degrees: number): string {
  const angle = (degrees * Math.PI) / 180;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  return `${round(x * cos - y * sin)} ${round(x * sin + y * cos)}`;
}

/** A rounded bar across a band at `degrees`, from one radius to another, `dy` lower. */
function bar(degrees: number, from: number, to: number, width: number, dy = 0): string {
  const h = width / 2;
  const at = (x: number, y: number) => {
    const [px, py] = turn(x, y, degrees).split(" ").map(Number) as [number, number];
    return `${px} ${round(py + dy)}`;
  };
  return `M${at(from, -h)}L${at(to, -h)}A${h} ${h} 0 0 1 ${at(to, h)}L${at(from, h)}A${h} ${h} 0 0 1 ${at(from, -h)}Z`;
}

/** A piece of a ring between two radii and two angles, `dy` lower. */
function sector(inner: number, outer: number, start: number, end: number, dy = 0): string {
  const at = (radius: number, degrees: number) => {
    const [x, y] = point(radius, degrees);
    return `${x} ${round(y + dy)}`;
  };
  const large = end - start > 180 ? 1 : 0;
  return `M${at(outer, start)}A${outer} ${outer} 0 ${large} 1 ${at(outer, end)}L${at(inner, end)}A${inner} ${inner} 0 ${large} 0 ${at(inner, start)}Z`;
}

/**
 * A spine bent round the medallion: brown calf with raised bands, the cords a binder sews the
 * quires on, each between two blind-tooled rules, and a small tooled lozenge in each panel.
 */
function nerverFrame(): AvatarFrame {
  const bands = 10;
  const angles = Array.from({ length: bands }, (_, index) => (index / bands) * 360 - 90);
  const raised = (dy: number) => angles.map((degrees) => bar(degrees, R - 0.4, R + 6, 3, dy));
  const rules = angles.flatMap((degrees) =>
    [-3.2, 3.2].map((offset) => {
      const [ax, ay] = point(R + 0.6, degrees + offset);
      const [bx, by] = point(R + 4.2, degrees + offset);
      return `M${ax} ${ay}L${bx} ${by}`;
    }),
  );
  const lozenges = angles.map((degrees) => {
    const middle = degrees + 180 / bands;
    return `M${turn(R + 1.1, 0, middle)}L${turn(R + 2.4, 1.3, middle)}L${turn(R + 3.7, 0, middle)}L${turn(R + 2.4, -1.3, middle)}Z`;
  });
  return {
    footprint: 6,
    reach: R + 9,
    shapes: [
      paperRim(`${ring(R, R + 4.8, 0.8)}${raised(0.8).join("")}`, 4),
      ...band(R, R + 4.8, "calf"),
      { d: rules.join(""), stroke: "calf:edge", strokeWidth: 0.6 },
      { d: lozenges.join(""), fill: "calf:edge" },
      outlined(raised(DEPTH).join(""), "calf:edge"),
      outlined(raised(0).join(""), "calf"),
      {
        d: angles
          .map((degrees) => `M${turn(R + 0.8, -0.7, degrees)}L${turn(R + 5.2, -0.7, degrees)}`)
          .join(""),
        stroke: "sheen",
        strokeWidth: 0.9,
      },
    ],
  };
}

/** Lines a stylus scratched in the wax of a leaf: runs of upright strokes, a word at a time. */
function scratches(start: number, end: number): string {
  const middle = R + 3.5;
  const strokes: string[] = [];
  let degrees = start;
  let index = 0;
  while (degrees < end) {
    // A fixed pattern rather than chance: the frame must draw the same on every screen.
    const height = 0.9 + 0.7 * Math.abs(Math.sin(index * 2.3));
    const lean = 0.5;
    const [ax, ay] = point(middle - height, degrees);
    const [bx, by] = point(middle + height, degrees + lean);
    strokes.push(`M${ax} ${ay}L${bx} ${by}`);
    index += 1;
    degrees += index % 5 === 0 ? 4.6 : 2.2;
  }
  return strokes.join("");
}

/** An arc of a circle, clockwise from one angle to another. */
function arc(radius: number, start: number, end: number): string {
  const [x1, y1] = point(radius, start);
  const [x2, y2] = point(radius, end);
  return `M${x1} ${y1}A${radius} ${radius} 0 ${end - start > 180 ? 1 : 0} 1 ${x2} ${y2}`;
}

/** Where the lamp catches a piece of ring: the part of it between -150° and -30°. */
function litArc(radius: number, start: number, end: number): string {
  const from = Math.max(start, -150);
  const to = Math.min(end, -30);
  return from < to ? arc(radius, from, to) : "";
}

/**
 * A polyptych of wax tablets laid round the medallion: four leaves of boxwood, their black wax
 * scratched with writing, laced together through holes at their ends.
 */
function polyptyqueFrame(): AvatarFrame {
  const gaps = [-135, -45, 45, 135];
  const leaves = gaps.map((gap) => [gap + 4, gap + 86] as const);
  const wood = (dy: number) => leaves.map(([start, end]) => sector(R, R + 6, start, end, dy));
  const wax = leaves.map(([start, end]) => sector(R + 1.5, R + 4.5, start + 3, end - 3));
  const holes = leaves.flatMap(([start, end]) => [
    point(R + 3, start + 1.5),
    point(R + 3, end - 1.5),
  ]);
  // A thong through the holes of two leaves, `dy` lower for its shadow.
  const laces = (dy: number) =>
    gaps
      .map((gap) => {
        const [ax, ay] = point(R + 3, gap - 5.5);
        const [bx, by] = point(R + 3, gap + 5.5);
        const [cx, cy] = point(R + 8.4, gap);
        return `M${ax} ${round(ay + dy)}Q${cx} ${round(cy + dy)} ${bx} ${round(by + dy)}`;
      })
      .join("");
  return {
    footprint: 6,
    reach: R + 10,
    shapes: [
      paperRim(`${wood(0.8).join("")}${laces(0.9)}`, 4),
      outlined(wood(DEPTH).join(""), "boxwood:edge"),
      outlined(wood(0).join(""), "boxwood"),
      {
        d: leaves.map(([start, end]) => litArc(R + 5.3, start + 1, end - 1)).join(""),
        stroke: "sheen",
        strokeWidth: 0.8,
      },
      { ...outlined(wax.join(""), "tablet"), strokeWidth: 0.7 },
      {
        d: leaves.map(([start, end]) => scratches(start + 5, end - 5)).join(""),
        stroke: "boxwood",
        strokeWidth: 0.4,
      },
      { d: holes.map(([x, y]) => circle(x, y, 0.7)).join(""), fill: "tablet:edge" },
      { d: laces(0.5), stroke: "outline", strokeWidth: 2.2 },
      { d: laces(0), stroke: "calf", strokeWidth: 1.2 },
    ],
  };
}

/**
 * The silk ribbon of a bookmark round the medallion, its woven edges a shade darker, tied in a
 * bow under it.
 */
function nonpareilleFrame(): AvatarFrame {
  const loop = (sign: number) =>
    `M0 ${R + 2.4}C${sign * 3} ${R - 2.4} ${sign * 12.6} ${R - 3} ${sign * 13.2} ${R + 2.4}C${sign * 13.8} ${R + 7.8} ${sign * 5.4} ${R + 7} 0 ${R + 3.6}Z`;
  const fold = (sign: number) =>
    `M${sign * 1.6} ${R + 3}C${sign * 4.6} ${R + 1.2} ${sign * 8} ${R + 1.4} ${sign * 9.4} ${R + 3.2}C${sign * 7.4} ${R + 3.4} ${sign * 4.4} ${R + 4} ${sign * 1.6} ${R + 4}Z`;
  const tail = (sign: number) =>
    `M${sign * 0.4} ${R + 4}C${sign * 2.4} ${R + 7.6} ${sign * 3.8} ${R + 10.6} ${sign * 6.2} ${R + 14.2}L${sign * 4.1} ${R + 13}L${sign * 3.5} ${R + 15.6}C${sign * 2} ${R + 11.8} ${sign * 0.6} ${R + 8.6} ${sign * -1} ${R + 4.8}Z`;
  return {
    footprint: 5,
    reach: R + 16,
    shapes: [
      ...band(R, R + 4.2, "silk"),
      {
        d: `${circle(0, 0, R + 0.8)}${circle(0, 0, R + 3.4)}`,
        stroke: "silk:edge",
        strokeWidth: 0.45,
      },
      outlined(`${tail(-1)}${tail(1)}`, "silk:edge"),
      outlined(`${loop(-1)}${loop(1)}`, "silk"),
      { d: `${fold(-1)}${fold(1)}`, fill: "silk:edge" },
      {
        d: [-1, 1]
          .map(
            (sign) =>
              `M${sign * 2.4} ${R}C${sign * 6} ${R - 1.4} ${sign * 10} ${R - 1.6} ${sign * 11.4} ${R + 0.6}`,
          )
          .join(""),
        stroke: "sheen",
        strokeWidth: 0.7,
      },
      outlined(bar(90, R + 1, R + 5, 3.4), "silk"),
    ],
  };
}

export const avatarFrames = {
  simple: { footprint: 5, reach: R + 8, shapes: band(R, R + 5, "wood") },
  gilded: { footprint: 7, reach: R + 10, shapes: band(R, R + 7, "gold") },
  ink: {
    footprint: 7,
    reach: R + 20,
    shapes: [
      outlined(drop(76, R + 7, 13, 5.8), "ink"),
      outlined(drop(100, R + 7, 9, 4.4), "ink"),
      outlined(drop(122, R + 7, 11, 4.6), "ink"),
      ...band(R, R + 7, "ink"),
    ],
  },
  pearls: {
    footprint: 8,
    reach: R + 14,
    shapes: [...band(R, R + 4, "brass"), outlined(around(R + 8, 20, 3.6), "nacre")],
  },
  verdigris: {
    footprint: 9,
    reach: R + 12,
    shapes: [...band(R + 3, R + 9, "patina"), ...band(R, R + 3, "brass")],
  },
  twist: {
    footprint: 8,
    reach: R + 11,
    shapes: [...band(R, R + 8.5, "red"), outlined(strands(R, R + 8.5, 16), "gold")],
  },
  lace: {
    footprint: 8,
    reach: R + 14,
    shapes: [
      outlined(around(R + 6.5, 18, 5.5), "paper"),
      { d: ring(R + 1, R + 6.8), fill: "paper" },
      { d: around(R + 8, 18, 1.3), fill: "paper:edge" },
      ...band(R, R + 3, "brass"),
    ],
  },
  indigo: {
    footprint: 9,
    reach: R + 12,
    shapes: [
      ...band(R, R + 9, "indigo"),
      { d: circle(0, 0, R + 2.3), stroke: "gold", strokeWidth: 1.4 },
      { d: circle(0, 0, R + 6.7), stroke: "gold", strokeWidth: 1.4 },
    ],
  },
  wax: {
    footprint: 9,
    reach: R + 15,
    shapes: [
      outlined(waxRing(DEPTH), "wax:edge"),
      outlined(waxRing(0), "wax"),
      { d: topArc(R + 5), stroke: "sheen", strokeWidth: 2.2 },
    ],
  },
  rays: {
    footprint: 7,
    reach: R + 21,
    shapes: [outlined(rays(R + 3, R + 19, 20, 9, R + 12), "gold"), ...band(R, R + 6, "gold")],
  },
  "bright-gold": {
    footprint: 10,
    reach: R + 13,
    shapes: [
      ...band(R, R + 10, "gold"),
      { d: circle(0, 0, R + 5), stroke: "gold:edge", strokeWidth: 1.1 },
      outlined(around(R + 5, 8, 2.2, 22.5), "brass"),
    ],
  },
  iridescent: {
    footprint: 9,
    reach: R + 12,
    shapes: [...band(R + 2, R + 9, "nacre"), ...band(R, R + 2, "gold")],
  },
  "royal-sun": {
    footprint: 8,
    reach: R + 23,
    turning: [outlined(rays(R + 5, R + 21, 24, 8, R + 13), "gold")],
    shapes: [...band(R, R + 7, "gold"), outlined(around(R + 3.5, 4, 3, 45), "red")],
  },
  cadeler: cadelerFrame(CADELER),
  tessere: tessereFrame(),
  nerver: nerverFrame(),
  polyptyque: polyptyqueFrame(),
  nonpareille: nonpareilleFrame(),
} as const satisfies Record<string, AvatarFrame>;

export type AvatarFrameName = keyof typeof avatarFrames;

/** The frame of an id; another id (a newer catalogue) falls back on the simple one. */
export function avatarFrame(id: string): AvatarFrame {
  return Object.hasOwn(avatarFrames, id)
    ? avatarFrames[id as AvatarFrameName]
    : avatarFrames.simple;
}

/** How an ink paints: a flat colour, or the gradient of a matter from top to bottom. */
export function framePaint(
  ink: FrameInk,
): { readonly color: string } | { readonly matter: FrameMatterName } {
  if (ink === "outline") return { color: toy.outline };
  if (ink === "sheen") return { color: frameSheen.color };
  const [matter, part] = ink.split(":") as [FrameMatterName, string | undefined];
  return part === "edge" ? { color: frameMatters[matter].edge } : { matter };
}

/** The matters a frame paints with a gradient, each once. */
export function frameGradients(frame: AvatarFrame): FrameMatterName[] {
  const inks = [...(frame.turning ?? []), ...frame.shapes].flatMap((shape) => [
    shape.fill,
    shape.stroke,
  ]);
  const matters = inks.flatMap((ink) => {
    if (ink === undefined) return [];
    const paint = framePaint(ink);
    return "matter" in paint ? [paint.matter] : [];
  });
  return [...new Set(matters)];
}
