/**
 * The leagues' crests, drawn as illuminated arms: a shield with a field of heraldic colour
 * diapered with a fine pattern, a border of gold leaf, an emblem of its own for each league, and
 * more gold and foliage from one league to the next. Geometry only, on a 100 × 116 grid (the
 * view box starts at y = -6 so the Champion's crown fits), so that the web (`<svg>`) and mobile
 * (react-native-svg) draw the same crest.
 */

export type LeagueCrestId =
  | "page"
  | "ecuyer"
  | "chevalier"
  | "banneret"
  | "marechal"
  | "connetable"
  | "champion";

export const crestViewBox = "0 -6 100 116";
export const crestRatio = 1.16;

export type Tincture = "or" | "argent" | "gules" | "azure" | "vert" | "sable" | "purpure" | "ochre";

export const tinctureNames: readonly Tincture[] = [
  "or",
  "argent",
  "gules",
  "azure",
  "vert",
  "sable",
  "purpure",
  "ochre",
];

interface TinctureColors {
  readonly top: string;
  readonly bottom: string;
}

/** The illuminator's colours: gold leaf, lapis, vermilion, verdigris, and an iron-gall ink. */
const TINCTURES: Readonly<Record<Tincture, TinctureColors>> = {
  or: { top: "#F7DC8A", bottom: "#B98426" },
  argent: { top: "#FBF5E6", bottom: "#C8BFAE" },
  gules: { top: "#D9472B", bottom: "#8C2014" },
  azure: { top: "#4470C4", bottom: "#1C3676" },
  vert: { top: "#4F9B5B", bottom: "#225830" },
  sable: { top: "#463C36", bottom: "#17110E" },
  purpure: { top: "#8F4FA3", bottom: "#4A2160" },
  ochre: { top: "#E2BE72", bottom: "#A27533" },
};

const INK = "#2A1608";
const SHEEN = "#FFFFFF";

export interface CrestColors {
  readonly tinctures: Readonly<Record<Tincture, TinctureColors>>;
  readonly ink: string;
  readonly sheen: string;
}

/**
 * The colours a crest is painted in. A league not reached yet keeps its colours, darkened as if
 * in the shade, never greyed: the player sees what the next leagues look like.
 */
export function crestColors(dim: boolean): CrestColors {
  if (!dim) return { tinctures: TINCTURES, ink: INK, sheen: SHEEN };
  const shade = (color: string) => mix(color, INK, 0.28);
  const tinctures = Object.fromEntries(
    tinctureNames.map((name) => [
      name,
      { top: shade(TINCTURES[name].top), bottom: shade(TINCTURES[name].bottom) },
    ]),
  ) as Record<Tincture, TinctureColors>;
  return { tinctures, ink: INK, sheen: mix(SHEEN, INK, 0.28) };
}

/** What a layer is painted with: a tincture (its gradient), the ink, a sheen of light, the diaper. */
export type CrestPaint = Tincture | "ink" | "sheen" | "diaper";

export interface CrestLayer {
  readonly d: string;
  readonly fill?: CrestPaint;
  readonly stroke?: CrestPaint;
  readonly width?: number;
  readonly opacity?: number;
  readonly dash?: string;
  readonly cap?: "round" | "butt";
}

export interface CrestArt {
  /** The tile repeated over the field, painted flat. */
  readonly diaper: { readonly size: number; readonly layers: readonly CrestLayer[] };
  readonly layers: readonly CrestLayer[];
}

// --- Shapes --------------------------------------------------------------------------------------

const SHIELD = "M17 16 H83 V50 C83 75 68 91 50 101 C32 91 17 75 17 50 Z";
const FIELD = "M22.5 21.5 H77.5 V50 C77.5 72 64.5 86 50 94.8 C35.5 86 22.5 72 22.5 50 Z";
/** The middle of the border, where the gilder punched a row of dots. */
const PUNCHED =
  "M19.75 18.75 H80.25 V50 C80.25 73.5 66.3 88.5 50 97.9 C33.7 88.5 19.75 73.5 19.75 50 Z";
const FIELD_LIGHT = "M23.5 22.5 H76.5 V29 C60 26 40 27 23.5 36 Z";

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

function circle(cx: number, cy: number, r: number): string {
  return `M${round(cx - r)} ${round(cy)} A${r} ${r} 0 1 0 ${round(cx + r)} ${round(cy)} A${r} ${r} 0 1 0 ${round(cx - r)} ${round(cy)} Z`;
}

/** A pointed leaf from its base, `length` long towards `angle` (degrees, y down). */
function leaf(x: number, y: number, angle: number, length: number, width: number): string {
  const a = (angle * Math.PI) / 180;
  const dx = Math.cos(a);
  const dy = Math.sin(a);
  const tipX = x + dx * length;
  const tipY = y + dy * length;
  const midX = x + (dx * length) / 2;
  const midY = y + (dy * length) / 2;
  const nx = -dy * width;
  const ny = dx * width;
  return `M${round(x)} ${round(y)} Q${round(midX + nx)} ${round(midY + ny)} ${round(tipX)} ${round(tipY)} Q${round(midX - nx)} ${round(midY - ny)} ${round(x)} ${round(y)} Z`;
}

/** A star of `points` points, the first one up. */
function star(cx: number, cy: number, outer: number, inner: number, points: number): string {
  const corners: string[] = [];
  for (let index = 0; index < points * 2; index++) {
    const radius = index % 2 === 0 ? outer : inner;
    const angle = (index / (points * 2)) * 2 * Math.PI - Math.PI / 2;
    corners.push(`${round(cx + radius * Math.cos(angle))} ${round(cy + radius * Math.sin(angle))}`);
  }
  return `M${corners.join(" L")} Z`;
}

const outlined = (d: string, fill: CrestPaint, width = 1.8): CrestLayer => ({
  d,
  fill,
  stroke: "ink",
  width,
});

/** A bar drawn as a stroke: ink first, then its colour inside. */
function bar(d: string, paint: CrestPaint, width: number, cap: "round" | "butt" = "round") {
  return [
    { d, stroke: "ink", width: width + 2.6, cap },
    { d, stroke: paint, width, cap },
  ] satisfies CrestLayer[];
}

// --- The diapers ---------------------------------------------------------------------------------

function lozenges(paint: Tincture, opacity: number): CrestArt["diaper"] {
  return {
    size: 8,
    layers: [
      { d: "M0 4 L4 0 L8 4 L4 8 Z", stroke: paint, width: 0.5, opacity },
      { d: circle(4, 4, 0.75), fill: paint, opacity: opacity + 0.15 },
    ],
  };
}

function quatrefoils(paint: Tincture, opacity: number): CrestArt["diaper"] {
  return {
    size: 7,
    layers: [
      { d: circle(3.5, 2.6, 0.55), fill: paint, opacity },
      { d: circle(3.5, 4.4, 0.55), fill: paint, opacity },
      { d: circle(2.6, 3.5, 0.55), fill: paint, opacity },
      { d: circle(4.4, 3.5, 0.55), fill: paint, opacity },
    ],
  };
}

function lis(x: number, y: number): string {
  return [
    `M${x} ${y - 3.5} C${x + 1} ${y - 2} ${x + 1} ${y - 0.5} ${x} ${y + 1} C${x - 1} ${y - 0.5} ${x - 1} ${y - 2} ${x} ${y - 3.5} Z`,
    `M${x} ${y} C${x + 1.5} ${y - 1.5} ${x + 3.2} ${y - 1} ${x + 2.6} ${y + 0.6} C${x + 2} ${y} ${x + 1.2} ${y + 0.2} ${x + 0.6} ${y + 1} Z`,
    `M${x} ${y} C${x - 1.5} ${y - 1.5} ${x - 3.2} ${y - 1} ${x - 2.6} ${y + 0.6} C${x - 2} ${y} ${x - 1.2} ${y + 0.2} ${x - 0.6} ${y + 1} Z`,
    `M${x - 1.7} ${y + 1} H${x + 1.7} V${y + 1.9} H${x - 1.7} Z`,
    `M${x - 0.4} ${y + 1.9} L${x} ${y + 3.4} L${x + 0.4} ${y + 1.9} Z`,
  ].join(" ");
}

const SEME_DE_LIS: CrestArt["diaper"] = {
  size: 11,
  layers: [
    { d: lis(2.75, 3), fill: "or", opacity: 0.85 },
    { d: lis(8.25, 8.5), fill: "or", opacity: 0.85 },
  ],
};

// --- The emblems ---------------------------------------------------------------------------------

/** Page: the goose quill of the one who learns to write. */
const QUILL: CrestLayer[] = [
  outlined("M68 27 C55 34 44 52 43 71 C60 62 72 45 68 27 Z", "argent"),
  { d: "M67 29 C60 42 51 57 43.5 70", stroke: "ink", width: 1.2 },
  { d: "M60 38 L55 40 M56 47 L50.5 49 M52 55 L47.5 57.5", stroke: "ink", width: 1, opacity: 0.6 },
  { d: "M64 42 L60 46 M60 51 L55.5 55", stroke: "ink", width: 1, opacity: 0.6 },
  ...bar("M43.5 70 L36 84", "or", 2.2),
  outlined("M36.5 83 L32 90 L35 85.5 Z", "ink", 1.2),
];

/** Écuyer: the spur, the squire's first gilt. */
const SPUR: CrestLayer[] = [
  ...bar("M30 34 C30 60 70 60 70 34", "or", 5.5),
  ...bar("M50 57.5 V63", "or", 4.5, "butt"),
  outlined(circle(30, 34, 3.6), "or", 1.6),
  outlined(circle(70, 34, 3.6), "or", 1.6),
  outlined(star(50, 74, 13, 5, 8), "or", 1.8),
  { d: circle(50, 74, 2.4), fill: "ink" },
];

/** Chevalier: the great helm, with its crest of red plumes. */
const HELM: CrestLayer[] = [
  outlined("M50 31 C47 21 55 12 66 12 C60 16 58 22 60 28 C56 26 53 27 50 31 Z", "gules"),
  outlined(
    "M35 46 C35 35 42 30.5 50 30.5 C58 30.5 65 35 65 46 V76 C65 80 60 82 50 82 C40 82 35 80 35 76 Z",
    "argent",
    2,
  ),
  { d: "M37 52 H63 V56.2 H37 Z", fill: "ink" },
  { d: "M50 31 V52 M50 56 V81.5", stroke: "ink", width: 1.4 },
  { d: "M39.5 45 C39.5 37 44 33.5 48 33.5", stroke: "sheen", width: 2, opacity: 0.7, cap: "round" },
  ...[64, 68.5, 73].flatMap((y) => [
    { d: circle(56.5, y, 0.95), fill: "ink" } satisfies CrestLayer,
    { d: circle(60, y, 0.95), fill: "ink" } satisfies CrestLayer,
  ]),
];

/** Banneret: the lance and its swallow-tailed banner, carried before his own men. */
const BANNER: CrestLayer[] = [
  ...bar("M38.5 90 L41 28", "or", 2.6),
  outlined("M41 18.5 L44.2 29 L37.8 29 Z", "argent", 1.6),
  outlined("M42 32 C52 28 60 36 73 31 L64.5 43 L73 55 C60 60 52 52 42 56 Z", "gules", 1.8),
  { d: "M56 33.5 C55 40 55.5 48 57 54.5", stroke: "ink", width: 1, opacity: 0.35 },
  ...bar("M51.5 37 V51 M45.5 44 H58", "or", 2.2, "butt").map((layer) =>
    layer.stroke === "ink" ? { ...layer, width: 4 } : layer,
  ),
];

/** Maréchal: two batons in saltire, blue strewn with gold, capped in gold. */
const BATONS: CrestLayer[] = [
  ...[
    ["M32 38 L68 82", "M32 38 L35.6 42.4 M64.4 77.6 L68 82"],
    ["M68 38 L32 82", "M68 38 L64.4 42.4 M35.6 77.6 L32 82"],
  ].flatMap(([shaft, caps]) => [
    { d: shaft as string, stroke: "ink", width: 10.5, cap: "butt" } satisfies CrestLayer,
    { d: shaft as string, stroke: "azure", width: 7.4, cap: "butt" } satisfies CrestLayer,
    {
      d: shaft as string,
      stroke: "or",
      width: 2.2,
      dash: "0 5.5",
      cap: "round",
    } satisfies CrestLayer,
    { d: caps as string, stroke: "ink", width: 11.5, cap: "butt" } satisfies CrestLayer,
    { d: caps as string, stroke: "or", width: 8.6, cap: "butt" } satisfies CrestLayer,
  ]),
];

/** Connétable: the sword of the realm, point up. */
const SWORD: CrestLayer[] = [
  outlined("M50 24 L54 32 V68 H46 V32 Z", "argent", 1.8),
  { d: "M50 32 V66", stroke: "ink", width: 1, opacity: 0.45 },
  { d: "M47.6 33 V60", stroke: "sheen", width: 1.2, opacity: 0.7 },
  outlined("M35 67.5 C42 69 58 69 65 67.5 L63.5 73.5 C57 72.5 43 72.5 36.5 73.5 Z", "or", 1.8),
  outlined("M47.4 73 H52.6 V83 H47.4 Z", "gules", 1.6),
  { d: "M47.6 76 L52.4 78 M47.6 79.5 L52.4 81.5", stroke: "or", width: 0.9 },
  outlined(circle(50, 86.5, 3.8), "or", 1.6),
];

/** Champion: the gold laurel wreath round a star. */
function wreath(): CrestLayer[] {
  const cx = 50;
  const cy = 57;
  const radius = 19;
  const at = (degrees: number) => {
    const a = (degrees * Math.PI) / 180;
    return [cx + radius * Math.cos(a), cy + radius * Math.sin(a)] as const;
  };
  const leaves: CrestLayer[] = [];
  for (const side of [1, -1] as const) {
    for (let step = 0; step < 6; step++) {
      // Up each side, from the tie at the bottom to the gap at the top.
      const degrees = side === 1 ? 100 + step * 28 : 80 - step * 28;
      const [x, y] = at(degrees);
      const along = side === 1 ? degrees + 90 : degrees - 90;
      leaves.push(outlined(leaf(x, y, along - side * 35, 10.5, 3), "or", 1));
      leaves.push(outlined(leaf(x, y, along + side * 30, 9, 2.6), "or", 1));
    }
  }
  const [lx, ly] = at(100);
  const [tx, ty] = at(255);
  const [rx, ry] = at(80);
  const [ux, uy] = at(-75);
  return [
    {
      d: `M${round(lx)} ${round(ly)} A${radius} ${radius} 0 0 1 ${round(tx)} ${round(ty)}`,
      stroke: "ink",
      width: 1.6,
    },
    {
      d: `M${round(rx)} ${round(ry)} A${radius} ${radius} 0 0 0 ${round(ux)} ${round(uy)}`,
      stroke: "ink",
      width: 1.6,
    },
    ...leaves,
    outlined(circle(cx, cy + radius + 1, 2.6), "gules", 1.4),
    outlined(star(cx, cy, 9.5, 4, 5), "or", 1.6),
  ];
}

// --- The ornaments -------------------------------------------------------------------------------

/** A sprig of ivy, as in a manuscript's margin, on one side of the shield (`side` -1 left, 1 right). */
function ivy(side: -1 | 1): CrestLayer[] {
  const x = (dx: number) => round(50 + side * dx);
  const turn = (angle: number) => (side === -1 ? angle : 180 - angle);
  return [
    {
      d: `M${x(33)} 34 C${x(42)} 34 ${x(47.5)} 42 ${x(45)} 51 C${x(43)} 59 ${x(37.5)} 62 ${x(39.5)} 70 C${x(41.5)} 78 ${x(47.5)} 82 ${x(44)} 90 C${x(42)} 94.5 ${x(37.5)} 94.5 ${x(37.5)} 91 C${x(37.5)} 88.5 ${x(40.5)} 88.5 ${x(40.5)} 90.5`,
      stroke: "ink",
      width: 1.6,
    },
    {
      d: `M${x(44.5)} 53 C${x(48)} 55 ${x(48.5)} 59 ${x(46)} 60.5 C${x(44.5)} 61.3 ${x(43.5)} 59.5 ${x(45)} 59`,
      stroke: "ink",
      width: 1.2,
    },
    outlined(leaf(x(45.5), 45, turn(200), 9.5, 3.4), "or", 1.1),
    outlined(leaf(x(40), 64, turn(160), 9, 3.2), "vert", 1.1),
    outlined(leaf(x(43.5), 76, turn(215), 9.5, 3.4), "or", 1.1),
    outlined(leaf(x(43.5), 87, turn(140), 7.5, 2.8), "vert", 1.1),
    outlined(circle(x(38), 38.5, 1.7), "gules", 0.9),
    outlined(circle(x(47.5), 69, 1.6), "azure", 0.9),
    outlined(circle(x(36.5), 81, 1.7), "gules", 0.9),
  ];
}

const CORNER_BALLS: CrestLayer[] = [
  outlined(circle(17, 16, 3.2), "or", 1.5),
  outlined(circle(83, 16, 3.2), "or", 1.5),
];

const GEM: CrestLayer[] = [
  outlined(circle(50, 16, 3.6), "gules", 1.6),
  { d: circle(49, 15, 1), fill: "sheen", opacity: 0.8 },
];

const CROWN: CrestLayer[] = [
  outlined("M30.5 13 L28.5 0 L38 6 L44 -3 L50 4.5 L56 -3 L62 6 L71.5 0 L69.5 13 Z", "or", 2),
  outlined("M30 11 H70 V17 H30 Z", "or", 2),
  outlined(circle(39.5, 14, 1.8), "gules", 1.1),
  outlined(circle(50, 14, 2.1), "azure", 1.1),
  outlined(circle(60.5, 14, 1.8), "gules", 1.1),
  ...[
    [28.5, 0],
    [44, -3],
    [56, -3],
    [71.5, 0],
  ].map(([cx, cy]) => outlined(circle(cx as number, cy as number, 1.7), "argent", 1)),
];

// --- The arms ------------------------------------------------------------------------------------

interface Blazon {
  readonly field: Tincture;
  readonly border: Tincture;
  readonly diaper: CrestArt["diaper"];
  readonly emblem: readonly CrestLayer[];
  /** Gold and foliage, added from one league to the next. */
  readonly rank: number;
}

const BLAZONS: Readonly<Record<LeagueCrestId, Blazon>> = {
  page: { field: "vert", border: "ochre", diaper: lozenges("ochre", 0.3), emblem: QUILL, rank: 0 },
  ecuyer: {
    field: "purpure",
    border: "or",
    diaper: quatrefoils("or", 0.45),
    emblem: SPUR,
    rank: 1,
  },
  chevalier: { field: "azure", border: "or", diaper: lozenges("or", 0.28), emblem: HELM, rank: 2 },
  banneret: { field: "sable", border: "or", diaper: lozenges("or", 0.3), emblem: BANNER, rank: 3 },
  marechal: {
    field: "argent",
    border: "or",
    diaper: lozenges("gules", 0.22),
    emblem: BATONS,
    rank: 4,
  },
  connetable: { field: "azure", border: "or", diaper: SEME_DE_LIS, emblem: SWORD, rank: 5 },
  champion: {
    field: "gules",
    border: "or",
    diaper: quatrefoils("or", 0.4),
    emblem: wreath(),
    rank: 6,
  },
};

function arms(blazon: Blazon): CrestArt {
  const { rank } = blazon;
  return {
    diaper: blazon.diaper,
    layers: [
      ...(rank >= 3 ? [...ivy(-1), ...ivy(1)] : []),
      outlined(SHIELD, blazon.border, 2.6),
      ...(rank >= 2
        ? [
            {
              d: PUNCHED,
              stroke: "ink",
              width: 1.3,
              opacity: 0.4,
              dash: "0 3",
              cap: "round",
            } satisfies CrestLayer,
          ]
        : []),
      outlined(FIELD, blazon.field, 1.3),
      { d: FIELD, fill: "diaper" },
      { d: FIELD_LIGHT, fill: "sheen", opacity: 0.14 },
      ...blazon.emblem,
      ...(rank >= 4 ? CORNER_BALLS : []),
      ...(rank === 5 ? GEM : []),
      ...(rank >= 6 ? CROWN : []),
    ],
  };
}

export const leagueCrests: Readonly<Record<LeagueCrestId, CrestArt>> = {
  page: arms(BLAZONS.page),
  ecuyer: arms(BLAZONS.ecuyer),
  chevalier: arms(BLAZONS.chevalier),
  banneret: arms(BLAZONS.banneret),
  marechal: arms(BLAZONS.marechal),
  connetable: arms(BLAZONS.connetable),
  champion: arms(BLAZONS.champion),
};

/** `color` moved towards `toward` by `amount` (0 to 1), both as `#RRGGBB`. */
function mix(color: string, toward: string, amount: number): string {
  const channel = (hex: string, at: number) => Number.parseInt(hex.slice(at, at + 2), 16);
  const parts = [1, 3, 5].map((at) =>
    Math.round(channel(color, at) * (1 - amount) + channel(toward, at) * amount),
  );
  return `#${parts.map((part) => part.toString(16).padStart(2, "0")).join("")}`;
}
