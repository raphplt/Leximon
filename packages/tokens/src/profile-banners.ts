import { toyMatters } from "./library";

/**
 * The banner at the top of a profile: a cloth in a tint, a motif repeated over it, in gold, shade
 * and light. A motif is one tile of SVG paths, repeated in both directions, so that the same
 * drawing fills a phone and a wide screen. The web and react-native-svg both draw these paths.
 */

/** The tints of the cloth, all dark enough for the lettered name on them. */
export const bannerTints = {
  bordeaux: "#7A2230",
  bottle: "#1F4A3A",
  prussian: "#1E3456",
  leather: "#5A3418",
  bishop: "#3E2550",
  ochre: "#8A5A1A",
  ink: "#1C1C24",
  slate: "#3F4A52",
} as const;

export type BannerTint = keyof typeof bannerTints;

/** What paints a motif's shape. */
export const bannerInks = {
  gold: toyMatters.gold.top,
  shade: "#000000",
  light: "#FFFFFF",
} as const;

export type BannerInk = keyof typeof bannerInks;

export interface BannerShape {
  readonly d: string;
  readonly fill?: BannerInk;
  readonly stroke?: BannerInk;
  readonly strokeWidth?: number;
  readonly opacity: number;
}

export interface BannerMotif {
  readonly tile: { readonly width: number; readonly height: number };
  readonly shapes: readonly BannerShape[];
}

/** Over the motif, the cloth's relief: lit at the top, in shadow at the bottom. */
export const bannerRelief = {
  top: { color: bannerInks.light, opacity: 0.08 },
  bottom: { color: bannerInks.shade, opacity: 0.28 },
} as const;

const dot = (cx: number, cy: number, r: number) =>
  `M${cx - r} ${cy} A${r} ${r} 0 1 1 ${cx + r} ${cy} A${r} ${r} 0 1 1 ${cx - r} ${cy}Z`;

/** Four petals around a centre, as on a sown heraldic field. */
function quatrefoil(cx: number, cy: number, r: number): string {
  const h = r / 2;
  return [
    `M${cx} ${cy - r}`,
    `C${cx + h} ${cy - r} ${cx + h} ${cy - h / 2} ${cx} ${cy}`,
    `C${cx + h / 2} ${cy - h} ${cx + r} ${cy - h} ${cx + r} ${cy}`,
    `C${cx + r} ${cy + h} ${cx + h / 2} ${cy + h} ${cx} ${cy}`,
    `C${cx + h} ${cy + h / 2} ${cx + h} ${cy + r} ${cx} ${cy + r}`,
    `C${cx - h} ${cy + r} ${cx - h} ${cy + h / 2} ${cx} ${cy}`,
    `C${cx - h / 2} ${cy + h} ${cx - r} ${cy + h} ${cx - r} ${cy}`,
    `C${cx - r} ${cy - h} ${cx - h / 2} ${cy - h} ${cx} ${cy}`,
    `C${cx - h} ${cy - h / 2} ${cx - h} ${cy - r} ${cx} ${cy - r}Z`,
  ].join(" ");
}

export const bannerMotifs = {
  /** A plain cloth: only its weave shows. */
  plain: {
    tile: { width: 8, height: 8 },
    shapes: [
      { d: "M0 4H8", stroke: "light", strokeWidth: 1, opacity: 0.05 },
      { d: "M4 0V8", stroke: "shade", strokeWidth: 1, opacity: 0.1 },
    ],
  },
  fleurons: {
    tile: { width: 32, height: 32 },
    shapes: [
      { d: quatrefoil(16, 16, 6), fill: "gold", opacity: 0.5 },
      {
        d: [dot(0, 0, 1.6), dot(32, 0, 1.6), dot(0, 32, 1.6), dot(32, 32, 1.6)].join(" "),
        fill: "gold",
        opacity: 0.4,
      },
    ],
  },
  scrolls: {
    tile: { width: 48, height: 24 },
    shapes: [
      { d: "M0 12 C8 4 16 4 24 12 S40 20 48 12", stroke: "gold", strokeWidth: 1.6, opacity: 0.45 },
      {
        d: "M12 7 C13 3 18 4 17 7 C16 9 13 8 14 6 M36 17 C35 21 30 20 31 17 C32 15 35 16 34 18",
        stroke: "gold",
        strokeWidth: 1.2,
        opacity: 0.4,
      },
    ],
  },
  /** An ogee lattice, a small flower in each cell. */
  damask: {
    tile: { width: 40, height: 56 },
    shapes: [
      {
        d: "M0 0 C0 14 20 14 20 28 C20 42 0 42 0 56 M40 0 C40 14 20 14 20 28 C20 42 40 42 40 56",
        stroke: "gold",
        strokeWidth: 1.3,
        opacity: 0.4,
      },
      {
        d: [
          quatrefoil(0, 28, 5),
          quatrefoil(40, 28, 5),
          quatrefoil(20, 0, 5),
          quatrefoil(20, 56, 5),
        ].join(" "),
        fill: "gold",
        opacity: 0.35,
      },
    ],
  },
  checky: {
    tile: { width: 24, height: 24 },
    shapes: [{ d: "M0 0H12V12H0Z M12 12H24V24H12Z", fill: "light", opacity: 0.1 }],
  },
  quarterly: {
    tile: { width: 80, height: 80 },
    shapes: [
      { d: "M0 0H40V40H0Z M40 40H80V80H40Z", fill: "shade", opacity: 0.22 },
      { d: "M40 0V80 M0 40H80", stroke: "gold", strokeWidth: 1.5, opacity: 0.35 },
    ],
  },
  /** Gold thread woven in: a wash of gold and a lattice of small lozenges. */
  cloth_of_gold: {
    tile: { width: 16, height: 16 },
    shapes: [
      { d: "M0 0H16V16H0Z", fill: "gold", opacity: 0.16 },
      { d: "M8 2 L14 8 L8 14 L2 8Z", stroke: "gold", strokeWidth: 1.2, opacity: 0.5 },
      { d: dot(8, 8, 1.2), fill: "gold", opacity: 0.7 },
      {
        d: [dot(0, 0, 0.9), dot(16, 0, 0.9), dot(0, 16, 0.9), dot(16, 16, 0.9)].join(" "),
        fill: "light",
        opacity: 0.3,
      },
    ],
  },
  binding: {
    tile: { width: 40, height: 40 },
    shapes: [
      { d: "M20 0 L40 20 L20 40 L0 20Z", stroke: "gold", strokeWidth: 1, opacity: 0.5 },
      { d: dot(20, 20, 2), fill: "gold", opacity: 0.6 },
      {
        d: [dot(0, 0, 1.2), dot(40, 0, 1.2), dot(0, 40, 1.2), dot(40, 40, 1.2)].join(" "),
        fill: "gold",
        opacity: 0.5,
      },
    ],
  },
  marbled: {
    tile: { width: 120, height: 48 },
    shapes: [
      { d: "M0 10 C20 2 40 2 60 10 S100 18 120 10", stroke: "light", strokeWidth: 4, opacity: 0.2 },
      {
        d: "M0 26 C20 18 40 18 60 26 S100 34 120 26",
        stroke: "gold",
        strokeWidth: 2.5,
        opacity: 0.35,
      },
      {
        d: "M0 40 C20 32 40 32 60 40 S100 48 120 40",
        stroke: "shade",
        strokeWidth: 3,
        opacity: 0.35,
      },
    ],
  },
  printer: {
    tile: { width: 24, height: 24 },
    shapes: [
      { d: `${dot(6, 6, 1.6)} ${dot(18, 18, 1.6)}`, fill: "gold", opacity: 0.5 },
      { d: `${dot(18, 6, 0.8)} ${dot(6, 18, 0.8)}`, fill: "light", opacity: 0.3 },
    ],
  },
} as const satisfies Record<string, BannerMotif>;

export type BannerMotifName = keyof typeof bannerMotifs;

/** A motif from its id; an unknown one (from a newer server) shows the plain cloth. */
export function bannerMotif(id: string): BannerMotif {
  return (bannerMotifs as Record<string, BannerMotif>)[id] ?? bannerMotifs.plain;
}

/** A tint from its id; an unknown one shows the bordeaux. */
export function bannerTint(id: string): string {
  return (bannerTints as Record<string, string>)[id] ?? bannerTints.bordeaux;
}

/** The whole banner as an SVG document, for images drawn without the DOM (the share image). */
export function bannerSvg(
  banner: { readonly motif: string; readonly tint: string },
  width: number,
  height: number,
): string {
  const motif = bannerMotif(banner.motif);
  const shapes = motif.shapes
    .map((shape) => {
      const fill = shape.fill === undefined ? "none" : bannerInks[shape.fill];
      const stroke =
        shape.stroke === undefined
          ? ""
          : ` stroke="${bannerInks[shape.stroke]}" stroke-width="${shape.strokeWidth ?? 1}"`;
      return `<path d="${shape.d}" fill="${fill}"${stroke} opacity="${shape.opacity}"/>`;
    })
    .join("");
  const { top, bottom } = bannerRelief;
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`,
    "<defs>",
    `<pattern id="m" width="${motif.tile.width}" height="${motif.tile.height}" patternUnits="userSpaceOnUse">${shapes}</pattern>`,
    `<linearGradient id="r" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${top.color}" stop-opacity="${top.opacity}"/><stop offset="0.45" stop-color="${top.color}" stop-opacity="0"/><stop offset="1" stop-color="${bottom.color}" stop-opacity="${bottom.opacity}"/></linearGradient>`,
    "</defs>",
    `<rect width="100%" height="100%" fill="${bannerTint(banner.tint)}"/>`,
    `<rect width="100%" height="100%" fill="url(#m)"/>`,
    `<rect width="100%" height="100%" fill="url(#r)"/>`,
    "</svg>",
  ].join("");
}
