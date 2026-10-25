/**
 * The web draws the sachet in CSS. These turn its colors and gradients into what SVG takes, so
 * that both platforms print the same pouch.
 */

type Rgba = readonly [red: number, green: number, blue: number, alpha: number];

function parse(color: string): Rgba {
  const hex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(color)?.[1];
  if (hex !== undefined) {
    const full = hex.length === 3 ? [...hex].map((digit) => digit + digit).join("") : hex;
    return [0, 2, 4].map((at) => Number.parseInt(full.slice(at, at + 2), 16)).concat(1) as [
      number,
      number,
      number,
      number,
    ];
  }
  const parts = /^rgba?\(([^)]+)\)$/.exec(color)?.[1]?.split(",").map(Number);
  if (parts === undefined || parts.length < 3 || parts.some(Number.isNaN)) {
    throw new Error(`Unreadable color: ${color}`);
  }
  return [parts[0] ?? 0, parts[1] ?? 0, parts[2] ?? 0, parts[3] ?? 1];
}

function format([red, green, blue, alpha]: Rgba): string {
  const channel = (value: number) => Math.round(Math.min(255, Math.max(0, value)));
  return `rgba(${channel(red)}, ${channel(green)}, ${channel(blue)}, ${alpha})`;
}

/** What a layer of the sachet does to every color it prints. */
export type Paint = (color: string) => string;

export const asIs: Paint = (color) => color;

/** CSS `saturate(0.4) brightness(0.75)`: the strip and the edges of an empty sachet. */
export const dimmed: Paint = (color) => {
  const [r, g, b, a] = parse(color);
  const s = 0.4;
  const saturated = [
    (0.213 + 0.787 * s) * r + (0.715 - 0.715 * s) * g + (0.072 - 0.072 * s) * b,
    (0.213 - 0.213 * s) * r + (0.715 + 0.285 * s) * g + (0.072 - 0.072 * s) * b,
    (0.213 - 0.213 * s) * r + (0.715 - 0.715 * s) * g + (0.072 + 0.928 * s) * b,
  ];
  return format([
    (saturated[0] ?? 0) * 0.75,
    (saturated[1] ?? 0) * 0.75,
    (saturated[2] ?? 0) * 0.75,
    a,
  ]);
};

/**
 * Grey blended in `saturation` mode: the color's luminosity without its hue. Luminosity adds up
 * like light, so greying each layer comes to greying what they make together.
 */
export const greyed: Paint = (color) => {
  const [r, g, b, a] = parse(color);
  const luminosity = 0.3 * r + 0.59 * g + 0.11 * b;
  return format([luminosity, luminosity, luminosity, a]);
};

function toLinear(channel: number): number {
  const c = channel / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

function fromLinear(value: number): number {
  const c = value <= 0.0031308 ? value * 12.92 : 1.055 * value ** (1 / 2.4) - 0.055;
  return c * 255;
}

function toOklab([r, g, b]: Rgba): readonly [number, number, number] {
  const [lr, lg, lb] = [toLinear(r), toLinear(g), toLinear(b)];
  const l = Math.cbrt(0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb);
  const m = Math.cbrt(0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb);
  const s = Math.cbrt(0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
}

function fromOklab([lightness, a, b]: readonly [number, number, number]): Rgba {
  const l = (lightness + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (lightness - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (lightness - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return [
    fromLinear(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s),
    fromLinear(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s),
    fromLinear(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s),
    1,
  ];
}

/** CSS `color-mix(in oklab, from, to share)`, for two opaque colors. */
export function mixOklab(from: string, to: string, share: number): string {
  const [a, b] = [toOklab(parse(from)), toOklab(parse(to))];
  return format(
    fromOklab(
      [0, 1, 2].map((i) => (a[i] ?? 0) * (1 - share) + (b[i] ?? 0) * share) as [
        number,
        number,
        number,
      ],
    ),
  );
}

export interface Box {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export interface GradientLine {
  readonly x1: number;
  readonly y1: number;
  readonly x2: number;
  readonly y2: number;
}

/** The two ends of a CSS `linear-gradient(<angle>)` laid over `box`, in its own coordinates. */
export function cssLinear(angle: number, box: Box): GradientLine {
  const radians = (angle * Math.PI) / 180;
  const dx = Math.sin(radians);
  const dy = -Math.cos(radians);
  const half = (Math.abs(box.width * dx) + Math.abs(box.height * dy)) / 2;
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  return { x1: cx - dx * half, y1: cy - dy * half, x2: cx + dx * half, y2: cy + dy * half };
}

/**
 * The same gradient as fractions of the shape it fills, so that it moves with the shape. SVG
 * stretches such a gradient with the shape: the ends are chosen so that, stretched, its lines
 * keep the CSS angle.
 */
export function cssLinearInShape(angle: number, width: number, height: number): GradientLine {
  const radians = (angle * Math.PI) / 180;
  const dx = Math.sin(radians);
  const dy = -Math.cos(radians);
  const length = Math.abs(width * dx) + Math.abs(height * dy);
  const gx = (width * dx) / length;
  const gy = (height * dy) / length;
  const norm = gx * gx + gy * gy;
  const vx = gx / norm;
  const vy = gy / norm;
  return { x1: 0.5 - vx / 2, y1: 0.5 - vy / 2, x2: 0.5 + vx / 2, y2: 0.5 + vy / 2 };
}

/** A CSS `linear-gradient(to bottom left | to bottom right)` laid over `box`. */
export function cssToCorner(toward: "bottom left" | "bottom right", box: Box): GradientLine {
  const norm = Math.hypot(box.width, box.height);
  const dx = (toward === "bottom left" ? -box.height : box.height) / norm;
  const dy = box.width / norm;
  const half = (box.width * box.height) / norm;
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  return { x1: cx - dx * half, y1: cy - dy * half, x2: cx + dx * half, y2: cy + dy * half };
}

/** A color as SVG takes it on a gradient stop: opaque, with its alpha apart. */
export function stopColor(color: string): { readonly color: string; readonly opacity: number } {
  const [r, g, b, a] = parse(color);
  return { color: format([r, g, b, 1]), opacity: a };
}
