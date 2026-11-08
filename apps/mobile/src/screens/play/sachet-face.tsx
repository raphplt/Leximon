import type { CatalogCollectionFile } from "@leximon/contract";
import {
  backTone,
  leafTile,
  type PackMotif,
  packLook,
  sealBeads,
  sealBox,
  sealGold,
  sealScallopPath,
  toyMatters,
  toy as toyValues,
} from "@leximon/tokens";
import { sachetContents } from "@leximon/view-model";
import { type ReactNode, useState } from "react";
import { StyleSheet } from "react-native";
import Animated, {
  type DerivedValue,
  useAnimatedProps,
  useAnimatedReaction,
} from "react-native-reanimated";
import Svg, {
  Circle,
  ClipPath,
  Defs,
  Ellipse,
  FeDropShadow,
  Filter,
  G,
  Line,
  LinearGradient,
  Mask,
  Path,
  Pattern,
  Polygon,
  RadialGradient,
  Rect,
  Stop,
  Image as SvgImage,
  Text as SvgText,
} from "react-native-svg";
import { scheduleOnRN } from "react-native-worklets";
import { catalogFileUrl } from "@/cards/catalog";
import { colors, fonts } from "@/theme";
import { LogoMarkShapes } from "@/ui/logo-mark";
import { displayBoldWidth } from "./glyph-widths";
import {
  asIs,
  type Box,
  cssLinear,
  cssLinearInShape,
  cssToCorner,
  type GradientLine,
  mixOklab,
  type Paint,
  stopColor,
} from "./sachet-paint";

/**
 * The front of the sachet, drawn after the web's CSS (apps/web/src/booster/sachet.module.css):
 * same grid, same layers, same colors. Its measures are in units of a 236 × 410 grid.
 *
 * It is cut in several drawings stacked in the web's order. Those that follow the light are
 * redrawn on every frame, so they hold only what moves; the print, with its blurred shadows, is
 * drawn once.
 */

export const GRID = { width: 236, height: 410 } as const;
/** The tear strip across the top, down to the dotted line. */
export const STRIP = 48;
const CRIMP = 22;
const TOOTH = 9;
const STRIP_BOX: Box = { x: 0, y: 0, width: GRID.width, height: STRIP };
const BODY_BOX: Box = { x: 0, y: STRIP, width: GRID.width, height: GRID.height - STRIP };
const CENTER = GRID.width / 2;
const SEAL_SIZE = 138;
const RIBBON = { width: 176, notch: 10, minHeight: 36, padding: 5, maxText: 136 } as const;
const NAME = { size: 15, line: 15.75 } as const;
const GOLD_TEXT = "rgba(255, 224, 138, 0.85)";

/** Where the light falls, in percent of the pouch: the web's `--holo-x` and `--holo-y`. */
export interface Light {
  readonly x: DerivedValue<number>;
  readonly y: DerivedValue<number>;
}

/** The crimps' teeth: one every 9 units, centred on the middle of the pouch. */
function toothCenters(): number[] {
  const side = Math.floor(CENTER / TOOTH);
  return Array.from({ length: 2 * side + 1 }, (_, index) => CENTER + (index - side) * TOOTH);
}

function toothLine(y: number, direction: 1 | -1, reversed: boolean): string {
  const centers = toothCenters();
  const ordered = reversed ? [...centers].reverse() : centers;
  return ordered
    .flatMap((center, index) => {
      const point = `L${center} ${y}`;
      if (index === ordered.length - 1) return [point];
      const valley = center + (reversed ? -TOOTH / 2 : TOOTH / 2);
      return [point, `L${valley} ${y + (direction * TOOTH) / 2}`];
    })
    .join(" ");
}

const FIRST_TOOTH = toothCenters()[0] ?? 0;

/** The strip: teeth along its top. */
export const STRIP_OUTLINE = [
  `M0 ${STRIP}`,
  `L0 ${FIRST_TOOTH}`,
  toothLine(0, 1, false),
  `L${GRID.width} ${FIRST_TOOTH}`,
  `L${GRID.width} ${STRIP}`,
  "Z",
].join(" ");

/** How far the stuffed pouch draws in from its edge, at `y`. */
function bite(y: number): number {
  const center = STRIP + (GRID.height - STRIP - CRIMP) / 2;
  const reach = 0.62 * (GRID.height - STRIP - CRIMP) * 0.97;
  const share = (y - center) / reach;
  return 3.5 * 0.97 * Math.sqrt(Math.max(0, 1 - share * share));
}

const SIDE_STEPS = Array.from({ length: 35 }, (_, index) => STRIP + (index * 340) / 34);
const CRIMP_TOP = GRID.height - CRIMP;

/** The body: sides drawn in by the cards inside, flat crimp along the bottom, teeth below. */
export const BODY_OUTLINE = [
  `M${bite(STRIP)} ${STRIP}`,
  ...SIDE_STEPS.map((y) => `L${GRID.width - bite(y)} ${y}`),
  `L${GRID.width} ${CRIMP_TOP}`,
  `L${GRID.width} ${GRID.height - FIRST_TOOTH}`,
  toothLine(GRID.height, -1, true),
  `L0 ${GRID.height - FIRST_TOOTH}`,
  `L0 ${CRIMP_TOP}`,
  ...[...SIDE_STEPS].reverse().map((y) => `L${bite(y)} ${y}`),
  "Z",
].join(" ");

type StopList = readonly (readonly [offset: number, color: string])[];

function stops(list: StopList, paint: Paint) {
  // Two stops can share an offset (a hard edge): their place in the list is their key.
  return list.map(([offset, color], index) => {
    const stop = stopColor(paint(color));
    return (
      // biome-ignore lint/suspicious/noArrayIndexKey: a fixed list of stops
      <Stop key={index} offset={offset} stopColor={stop.color} stopOpacity={stop.opacity} />
    );
  });
}

function Linear({
  id,
  line,
  list,
  paint,
  inShape = false,
}: {
  readonly id: string;
  readonly line: GradientLine;
  readonly list: StopList;
  readonly paint: Paint;
  readonly inShape?: boolean;
}) {
  return (
    <LinearGradient
      id={id}
      gradientUnits={inShape ? "objectBoundingBox" : "userSpaceOnUse"}
      x1={line.x1}
      y1={line.y1}
      x2={line.x2}
      y2={line.y2}
    >
      {stops(list, paint)}
    </LinearGradient>
  );
}

/**
 * A CSS `repeating-linear-gradient` of hard stripes over `box`: the stripes start where the
 * gradient line starts and repeat every `period`.
 */
function Stripes({
  id,
  angle,
  period,
  box,
  bands,
  paint,
}: {
  readonly id: string;
  readonly angle: number;
  readonly period: number;
  readonly box: Box;
  readonly bands: readonly (readonly [from: number, to: number, color: string])[];
  readonly paint: Paint;
}) {
  const line = cssLinear(angle, box);
  return (
    <Pattern
      id={id}
      patternUnits="userSpaceOnUse"
      width={period}
      height={10}
      patternTransform={`translate(${line.x1} ${line.y1}) rotate(${angle - 90})`}
    >
      {bands.map(([from, to, color]) => (
        <Rect key={from} x={from} width={to - from} height={10} fill={paint(color)} />
      ))}
    </Pattern>
  );
}

function Outlines() {
  return (
    <>
      <ClipPath id="strip">
        <Path d={STRIP_OUTLINE} />
      </ClipPath>
      <ClipPath id="body">
        <Path d={BODY_OUTLINE} />
      </ClipPath>
    </>
  );
}

function Layer({ width, children }: { readonly width: number; readonly children: ReactNode }) {
  return (
    <Svg
      width={width}
      height={(width * GRID.height) / GRID.width}
      viewBox={`0 0 ${GRID.width} ${GRID.height}`}
      style={StyleSheet.absoluteFill}
      pointerEvents="none"
    >
      {children}
    </Svg>
  );
}

/**
 * A layer redrawn as the light moves. Android paints an SVG into a new bitmap each time: soft
 * light loses nothing at half the size, and the bitmap costs a quarter of the work.
 */
function LitLayer({ width, children }: { readonly width: number; readonly children: ReactNode }) {
  const half = width / 2;
  return (
    <Svg
      width={half}
      height={(half * GRID.height) / GRID.width}
      viewBox={`0 0 ${GRID.width} ${GRID.height}`}
      style={styles.lit}
      pointerEvents="none"
    >
      {children}
    </Svg>
  );
}

/** Which parts of the front a drawing holds, and how each is painted. */
export interface Region {
  readonly strip: Paint | null;
  readonly body: Paint | null;
}

/** The foil under everything: its colors, curving away towards both sides. */
export function BaseLayer({
  collection,
  width,
  region,
}: {
  readonly collection: CatalogCollectionFile;
  readonly width: number;
  readonly region: Region;
}) {
  const tone = backTone(collection.back);
  const foil: StopList = [
    [0, mixOklab(tone.light, "#ffffff", 0.22)],
    [0.55, tone.light],
    [1, tone.dark],
  ];
  const pillow: StopList = [
    [0, "rgba(0, 0, 0, 0.5)"],
    [0.09, "rgba(0, 0, 0, 0.12)"],
    [0.22, "rgba(0, 0, 0, 0)"],
    [0.78, "rgba(0, 0, 0, 0)"],
    [0.91, "rgba(0, 0, 0, 0.12)"],
    [1, "rgba(0, 0, 0, 0.5)"],
  ];
  const part = (name: "strip" | "body", box: Box, paint: Paint) => (
    <G clipPath={`url(#${name})`}>
      <Defs>
        <RadialGradient
          id={`${name}-foil`}
          cx={box.x + box.width / 2}
          cy={box.y + box.height * 0.42}
          fx={box.x + box.width / 2}
          fy={box.y + box.height * 0.42}
          rx={box.width * 0.7}
          ry={box.height * 0.55}
          gradientUnits="userSpaceOnUse"
        >
          {stops(foil, paint)}
        </RadialGradient>
        <Linear id={`${name}-pillow`} line={cssLinear(90, box)} list={pillow} paint={paint} />
      </Defs>
      <Rect {...box} fill={`url(#${name}-foil)`} />
      <Rect {...box} fill={`url(#${name}-pillow)`} />
    </G>
  );
  return (
    <Layer width={width}>
      <Defs>
        <Outlines />
      </Defs>
      {region.strip !== null && part("strip", STRIP_BOX, region.strip)}
      {region.body !== null && part("body", BODY_BOX, region.body)}
    </Layer>
  );
}

const AnimatedRect = Animated.createAnimatedComponent(Rect);
const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const AnimatedEllipse = Animated.createAnimatedComponent(Ellipse);

const BAND: StopList = [
  [0.34, "rgba(255, 255, 255, 0)"],
  [0.42, "rgba(255, 255, 255, 0.05)"],
  [0.48, "rgba(255, 255, 255, 0.2)"],
  [0.54, "rgba(255, 255, 255, 0.05)"],
  [0.62, "rgba(255, 255, 255, 0)"],
];

/** A band of light sweeping across the foil with the tilt, three pouches wide. */
function Band({
  box,
  light,
  paint,
  name,
}: {
  readonly box: Box;
  readonly light: Light;
  readonly paint: Paint;
  readonly name: string;
}) {
  const moved = useAnimatedProps(() => ({ x: (-2 * box.width * light.x.value) / 100 }));
  return (
    <G clipPath={`url(#${name})`}>
      <Defs>
        <Linear
          id={`${name}-band`}
          line={cssLinearInShape(112, box.width * 3, box.height)}
          list={BAND}
          paint={paint}
          inShape
        />
      </Defs>
      <AnimatedRect
        animatedProps={moved}
        y={box.y}
        width={box.width * 3}
        height={box.height}
        fill={`url(#${name}-band)`}
      />
    </G>
  );
}

export function BandLayer({
  width,
  light,
  region,
}: {
  readonly width: number;
  readonly light: Light;
  readonly region: Region;
}) {
  return (
    <LitLayer width={width}>
      <Defs>
        <Outlines />
      </Defs>
      {region.strip !== null && (
        <Band box={STRIP_BOX} light={light} paint={region.strip} name="strip" />
      )}
      {region.body !== null && (
        <Band box={BODY_BOX} light={light} paint={region.body} name="body" />
      )}
    </LitLayer>
  );
}

/** How the name sits on the ribbon: on one line, or balanced over two like the web's. */
export function ribbonLines(name: string): readonly string[] {
  const width = (text: string) => displayBoldWidth(text, NAME.size);
  if (width(name) <= RIBBON.maxText) return [name];
  const words = name.split(" ");
  let best: readonly string[] | null = null;
  let bestWidth = Number.POSITIVE_INFINITY;
  for (let cut = 1; cut < words.length; cut += 1) {
    const lines = [words.slice(0, cut).join(" "), words.slice(cut).join(" ")];
    const widest = Math.max(...lines.map(width));
    if (widest < bestWidth) {
      best = lines;
      bestWidth = widest;
    }
  }
  return best ?? [name];
}

/** Where the print sits: the web's flex column, centred above the bottom crimp. */
function printLayout(name: string) {
  const lines = ribbonLines(name);
  const ribbonHeight = Math.max(RIBBON.minHeight, lines.length * NAME.line + 2 * RIBBON.padding);
  // Brand, seal, ribbon pinned 30 units over the seal, contents 4 units up, 14 units apart.
  const content = 17 + 14 + SEAL_SIZE + 14 - 30 + ribbonHeight + 14 - 4 + 12;
  const brandTop = STRIP + (GRID.height - STRIP - CRIMP - content) / 2;
  const sealTop = brandTop + 17 + 14;
  const ribbonTop = sealTop + SEAL_SIZE + 14 - 30;
  return {
    lines,
    brandTop,
    sealTop,
    ribbonTop,
    ribbonHeight,
    contentsTop: ribbonTop + ribbonHeight + 14 - 4,
  };
}

const MOTIF_OPACITY = 0.11;

/** The collection's pattern, faint on the foil, in screen points like the web's pixels. */
function Motif({
  motif,
  unit,
  paint,
}: {
  readonly motif: PackMotif;
  readonly unit: number;
  readonly paint: Paint;
}) {
  const px = (points: number) => points / unit;
  const ink = paint(colors.kraft);
  let pattern: ReactNode;
  if (motif === "dots") {
    pattern = (
      <Pattern
        id="motif"
        patternUnits="userSpaceOnUse"
        x={0}
        y={STRIP}
        width={px(22)}
        height={px(22)}
      >
        <Circle cx={px(11)} cy={px(11)} r={px(1.5)} fill={ink} />
      </Pattern>
    );
  } else if (motif === "hatch") {
    pattern = (
      <Stripes
        id="motif"
        angle={45}
        period={px(11)}
        box={BODY_BOX}
        bands={[[0, px(1), ink]]}
        paint={asIs}
      />
    );
  } else if (motif === "leaves") {
    pattern = (
      <Pattern
        id="motif"
        patternUnits="userSpaceOnUse"
        x={0}
        y={STRIP}
        width={px(leafTile.shown)}
        height={px(leafTile.shown)}
      >
        <G transform={`scale(${px(leafTile.shown / leafTile.size)})`}>
          {leafTile.fills.map((d) => (
            <Path key={d} d={d} fill={ink} />
          ))}
          {leafTile.stems.map((d) => (
            <Path key={d} d={d} fill="none" stroke={ink} strokeWidth={1} />
          ))}
        </G>
      </Pattern>
    );
  } else {
    pattern = (
      <Pattern
        id="motif"
        patternUnits="userSpaceOnUse"
        x={0}
        y={STRIP}
        width={px(24)}
        height={px(24)}
      >
        <Rect width={px(24)} height={px(1)} fill={ink} />
        <Rect width={px(1)} height={px(24)} fill={ink} />
      </Pattern>
    );
  }
  return (
    <>
      <Defs>{pattern}</Defs>
      <Rect
        {...BODY_BOX}
        fill="url(#motif)"
        opacity={motif === "leaves" ? leafTile.opacity : MOTIF_OPACITY}
      />
    </>
  );
}

/**
 * The collection's seal, hot-stamped in gold: rosette, beads, and its emblem on the field. Drawn
 * on a 120 × 120 grid, alone in its own `Svg` elsewhere than on the sachet.
 */
export function Seal({
  collection,
  paint,
}: {
  readonly collection: CatalogCollectionFile;
  readonly paint: Paint;
}) {
  const tone = backTone(collection.back);
  const look = packLook(collection.id);
  const engraving = collection.engraving?.ink;
  return (
    <G>
      <Defs>
        <LinearGradient id="gold" x1="0" y1="0" x2="1" y2="1">
          {stops(
            sealGold.map(([color, offset]) => [offset, color] as const),
            paint,
          )}
        </LinearGradient>
        <RadialGradient id="field" cx="0.5" cy="0.38" r="0.65">
          {stops(
            [
              [0, tone.light],
              [1, tone.dark],
            ],
            paint,
          )}
        </RadialGradient>
        {engraving !== undefined && (
          <>
            <LinearGradient id="ink" x1="0" y1="0" x2="0.6" y2="1">
              {stops(
                [
                  [0, "#fff3cf"],
                  [1, "#e0b04e"],
                ],
                paint,
              )}
            </LinearGradient>
            {/* The ink is black on transparent: its alpha, not its colour, draws the lines. */}
            <Mask id="engraving" maskType="alpha">
              <SvgImage
                href={catalogFileUrl(engraving)}
                x={22}
                y={21}
                width={76}
                height={78}
                preserveAspectRatio="xMidYMid meet"
              />
            </Mask>
            <ClipPath id="round">
              <Circle cx={60} cy={60} r={40} />
            </ClipPath>
          </>
        )}
      </Defs>
      <Path d={sealScallopPath} fill="url(#gold)" />
      <Path
        d={sealScallopPath}
        fill="none"
        stroke={paint("#5a3a0c")}
        strokeOpacity={0.45}
        strokeWidth={1}
      />
      <Circle cx={60} cy={60} r={49} fill="none" stroke={paint("#6b4510")} strokeOpacity={0.5} />
      {sealBeads.map(([x, y]) => (
        <Circle
          key={`${x}-${y}`}
          cx={x}
          cy={y}
          r={1.5}
          fill={paint("#6b4510")}
          fillOpacity={0.55}
        />
      ))}
      <Circle cx={60} cy={60} r={42} fill="url(#field)" />
      <Circle
        cx={60}
        cy={60}
        r={42}
        fill="none"
        stroke={paint("#2a1a04")}
        strokeOpacity={0.6}
        strokeWidth={2}
      />
      {engraving !== undefined ? (
        <G clipPath="url(#round)">
          <Rect x={18} y={18} width={84} height={84} fill="url(#ink)" mask="url(#engraving)" />
        </G>
      ) : (
        <G
          transform="translate(32 32) scale(0.875)"
          stroke={paint("#f3d58a")}
          strokeWidth={3.4}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          {look.emblem.map((d, index) => (
            <Path
              key={d}
              d={d}
              fill={index < look.solid ? "url(#gold)" : "none"}
              fillOpacity={index < look.solid ? 0.28 : 1}
            />
          ))}
        </G>
      )}
    </G>
  );
}

/** The collection's name on a kraft ribbon, notched at both ends, pinned across the seal. */
function Ribbon({
  lines,
  top,
  height,
  paint,
}: {
  readonly lines: readonly string[];
  readonly top: number;
  readonly height: number;
  readonly paint: Paint;
}) {
  const box: Box = { x: CENTER - RIBBON.width / 2, y: top, width: RIBBON.width, height };
  const right = box.x + box.width;
  const middle = top + height / 2;
  const points = [
    [box.x, top],
    [right, top],
    [right - RIBBON.notch, middle],
    [right, top + height],
    [box.x, top + height],
    [box.x + RIBBON.notch, middle],
  ]
    .map(([x, y]) => `${x},${y}`)
    .join(" ");
  // Each line's baseline: the lines are centred, Fraunces' ascent and descent in the line box.
  const firstBaseline = middle - (lines.length * NAME.line) / 2 + 13.29;
  return (
    <G transform={`rotate(-2.5 ${CENTER} ${middle})`}>
      <Defs>
        <Linear
          id="kraft"
          line={cssLinear(160, box)}
          list={[
            [0, "#ecd1a6"],
            [0.55, colors.kraft],
            [1, "#b88f5c"],
          ]}
          paint={paint}
        />
        <Linear
          id="kraft-shine"
          line={cssLinear(180, box)}
          list={[
            [0, "rgba(255, 255, 255, 0.28)"],
            [0.45, "rgba(255, 255, 255, 0)"],
          ]}
          paint={paint}
        />
      </Defs>
      <Polygon points={points} fill="url(#kraft)" />
      <Polygon points={points} fill="url(#kraft-shine)" />
      {lines.map((line, index) => (
        <SvgText
          key={line}
          x={CENTER}
          y={firstBaseline + index * NAME.line}
          fill={paint(colors.kraftTitle)}
          fontFamily={fonts.displayBold}
          fontSize={NAME.size}
          textAnchor="middle"
        >
          {line}
        </SvgText>
      ))}
    </G>
  );
}

const CONTENTS_SPACING = 2.2;

/**
 * Everything printed on the foil that never moves: the brushed grain, the pinches by the crimps,
 * the motif, the seal, the ribbon, the count of cards, the house seal, and the strip's dotted line.
 */
export function PrintLayer({
  collection,
  width,
  region,
}: {
  readonly collection: CatalogCollectionFile;
  readonly width: number;
  readonly region: Region;
}) {
  const unit = width / GRID.width;
  const layout = printLayout(collection.name);
  const look = packLook(collection.id);
  const grain = (name: string, box: Box, paint: Paint) => (
    <G clipPath={`url(#${name})`}>
      <Defs>
        <Pattern id={`${name}-grain`} patternUnits="userSpaceOnUse" width={3} height={10}>
          <Rect width={1} height={10} fill={paint("rgba(255, 255, 255, 0.03)")} />
        </Pattern>
      </Defs>
      <Rect {...box} fill={`url(#${name}-grain)`} />
    </G>
  );
  const strip = region.strip;
  const body = region.body;
  return (
    <Layer width={width}>
      <Defs>
        <Outlines />
        <Filter id="seal-shadow" x="-20%" y="-20%" width="140%" height="140%">
          <FeDropShadow
            dx={0}
            dy={4 * (sealBox / SEAL_SIZE)}
            stdDeviation={2.5 * (sealBox / SEAL_SIZE)}
            floodColor="#000000"
            floodOpacity={0.5}
          />
        </Filter>
        <Filter id="mark-shadow" x="-30%" y="-30%" width="160%" height="160%">
          <FeDropShadow
            dx={0}
            dy={3 * (100 / 42)}
            stdDeviation={2 * (100 / 42)}
            floodColor="#000000"
            floodOpacity={0.45}
          />
        </Filter>
      </Defs>
      {strip !== null && (
        <>
          {grain("strip", STRIP_BOX, strip)}
          <G clipPath="url(#strip)">
            <Line
              x1={0}
              y1={STRIP - 1}
              x2={GRID.width}
              y2={STRIP - 1}
              stroke={strip("rgba(255, 224, 138, 0.55)")}
              strokeWidth={2}
              strokeDasharray="4 2"
            />
            <SvgText
              x={GRID.width - 14 - 0.4}
              y={35.3}
              fill={strip(GOLD_TEXT)}
              fontFamily={fonts.ui.bold}
              fontSize={10}
              letterSpacing={0.4}
              textAnchor="end"
            >
              déchirer ici ▸
            </SvgText>
          </G>
        </>
      )}
      {body !== null && (
        <>
          {grain("body", BODY_BOX, body)}
          <G clipPath="url(#body)">
            <Defs>
              <Linear
                id="pinch-top"
                line={cssLinear(180, BODY_BOX)}
                list={[
                  [0, "rgba(0, 0, 0, 0.35)"],
                  [0.07, "rgba(0, 0, 0, 0)"],
                ]}
                paint={body}
              />
              <Stripes
                id="wrinkles-top"
                angle={80}
                period={23}
                box={{ x: 0, y: STRIP, width: GRID.width, height: 16 }}
                bands={[
                  [18, 20, "rgba(255, 255, 255, 0.05)"],
                  [20, 23, "rgba(0, 0, 0, 0.12)"],
                ]}
                paint={body}
              />
              <Linear
                id="pinch-bottom"
                line={cssLinear(0, BODY_BOX)}
                list={[
                  [0, "rgba(0, 0, 0, 0.45)"],
                  [22 / BODY_BOX.height, "rgba(0, 0, 0, 0.45)"],
                  [22 / BODY_BOX.height, "rgba(0, 0, 0, 0)"],
                  [24 / BODY_BOX.height, "rgba(0, 0, 0, 0.2)"],
                  [40 / BODY_BOX.height, "rgba(0, 0, 0, 0)"],
                ]}
                paint={body}
              />
              <Stripes
                id="wrinkles-bottom"
                angle={100}
                period={27}
                box={{ x: 0, y: CRIMP_TOP - 18, width: GRID.width, height: 18 }}
                bands={[
                  [22, 24, "rgba(255, 255, 255, 0.05)"],
                  [24, 27, "rgba(0, 0, 0, 0.14)"],
                ]}
                paint={body}
              />
            </Defs>
            {/* The foil's edges catch the light on one side, fall into shadow on the other. */}
            <Rect
              x={0}
              y={STRIP}
              width={1}
              height={BODY_BOX.height}
              fill={body("rgba(255, 255, 255, 0.14)")}
            />
            <Rect
              x={GRID.width - 1}
              y={STRIP}
              width={1}
              height={BODY_BOX.height}
              fill={body("rgba(0, 0, 0, 0.35)")}
            />
            <Rect {...BODY_BOX} fill="url(#pinch-top)" />
            <Rect x={0} y={STRIP} width={GRID.width} height={16} fill="url(#wrinkles-top)" />
            <Rect {...BODY_BOX} fill="url(#pinch-bottom)" />
            <Rect
              x={0}
              y={CRIMP_TOP - 18}
              width={GRID.width}
              height={18}
              fill="url(#wrinkles-bottom)"
            />
            <Motif motif={look.motif} unit={unit} paint={body} />
            <GiltFrame paint={body} />
            <G
              filter="url(#seal-shadow)"
              transform={`translate(${CENTER - SEAL_SIZE / 2} ${layout.sealTop}) scale(${SEAL_SIZE / sealBox})`}
            >
              <Seal collection={collection} paint={body} />
            </G>
            <Ribbon
              lines={layout.lines}
              top={layout.ribbonTop}
              height={layout.ribbonHeight}
              paint={body}
            />
            <SvgText
              x={CENTER - CONTENTS_SPACING / 2}
              y={layout.contentsTop + 9.3}
              fill={body("rgba(255, 224, 138, 0.8)")}
              fontFamily={fonts.ui.extrabold}
              fontSize={10}
              letterSpacing={CONTENTS_SPACING}
              textAnchor="middle"
            >
              {sachetContents(Date.now()).toUpperCase()}
            </SvgText>
            <G
              filter="url(#mark-shadow)"
              transform={`rotate(-10 ${GRID.width - 10 - 21} ${GRID.height - 34 - 21}) translate(${GRID.width - 10 - 42} ${GRID.height - 34 - 42}) scale(${42 / 100})`}
            >
              <LogoMarkShapes id="mark" />
            </G>
          </G>
        </>
      )}
    </Layer>
  );
}

/** The gilt frame's border box, as on the web: 18 units under the strip, 16 in, 36 off the foot. */
const FRAME = {
  x: 16,
  y: STRIP + 18,
  width: GRID.width - 32,
  height: GRID.height - STRIP - 18 - 36,
  radius: 16,
  border: 4,
  ink: 1.5,
} as const;

/** A gilt frame inside the edge, lined with ink on both sides. */
function GiltFrame({ paint }: { readonly paint: Paint }) {
  const box = { x: FRAME.x, y: FRAME.y, width: FRAME.width, height: FRAME.height };
  // Each line is a stroke centered on its path: a path sits half a stroke inside its edge.
  const ring = (inset: number, stroke: number, color: string) => (
    <Rect
      x={FRAME.x + inset + stroke / 2}
      y={FRAME.y + inset + stroke / 2}
      width={FRAME.width - 2 * inset - stroke}
      height={FRAME.height - 2 * inset - stroke}
      rx={Math.max(0, FRAME.radius - inset - stroke / 2)}
      fill="none"
      stroke={color}
      strokeWidth={stroke}
    />
  );
  return (
    <>
      <Defs>
        <Linear
          id="gilt-frame"
          line={cssLinear(160, box)}
          list={[
            [0, toyMatters.gold.top],
            [1, toyMatters.gold.bottom],
          ]}
          paint={paint}
        />
      </Defs>
      {ring(-FRAME.ink, FRAME.ink, paint(toyValues.outline))}
      {ring(0, FRAME.border, "url(#gilt-frame)")}
      {ring(FRAME.border, FRAME.ink, paint(toyValues.outline))}
    </>
  );
}

const BRAND = { text: "LEXIMON", size: 17, spacing: 3.4 } as const;
/** The web's `--holo-x` steps the brand's gold follows: a re-render per step, not per frame. */
const BRAND_STEP = 3;

/** « Leximon » in gold, its shine following the light. */
export function BrandLayer({
  collection,
  width,
  light,
  paint,
}: {
  readonly collection: CatalogCollectionFile;
  readonly width: number;
  readonly light: Light;
  readonly paint: Paint;
}) {
  const [shine, setShine] = useState(50);
  useAnimatedReaction(
    () => Math.round(light.x.value / BRAND_STEP) * BRAND_STEP,
    (step, previous) => {
      if (step !== previous) scheduleOnRN(setShine, step);
    },
  );
  const { brandTop } = printLayout(collection.name);
  const boxWidth = displayBoldWidth(BRAND.text, BRAND.size) + BRAND.text.length * BRAND.spacing;
  const box: Box = { x: CENTER - boxWidth / 2, y: brandTop, width: boxWidth, height: BRAND.size };
  const at = shine / 100;
  const text = {
    x: CENTER - BRAND.spacing / 2,
    // Fraunces' ascent and descent in a line box as tall as the type.
    y: brandTop + 14.65,
    fontFamily: fonts.displayBold,
    fontSize: BRAND.size,
    letterSpacing: BRAND.spacing,
    textAnchor: "middle" as const,
  };
  return (
    <Layer width={width}>
      <Defs>
        <Linear
          id="brand"
          line={cssLinear(100, box)}
          list={[
            [0.2, "#b07a1c"],
            [at - 0.1, "#fff3c4"],
            [at, "#ffe08a"],
            [at + 0.25, "#b07a1c"],
          ]}
          paint={paint}
        />
      </Defs>
      <SvgText {...text} y={text.y + 2} fill={paint("rgba(0, 0, 0, 0.45)")}>
        {BRAND.text}
      </SvgText>
      <SvgText {...text} fill="url(#brand)">
        {BRAND.text}
      </SvgText>
    </Layer>
  );
}

const CREASE: StopList = [
  [0.44, "rgba(0, 0, 0, 0)"],
  [0.49, "rgba(0, 0, 0, 0.22)"],
  [0.52, "rgba(255, 255, 255, 0.07)"],
  [0.57, "rgba(255, 255, 255, 0)"],
];

/**
 * The pouch is full of cards: it bulges. Laid over the print, so that the seal and the ribbon
 * follow the curve: the sides fall into shadow, both ends flatten into their crimps, and the foil
 * creases where the crimps pinch the corners.
 */
export function VolumeLayer({ width }: { readonly width: number }) {
  const crease = { width: BODY_BOX.width * 0.32, height: BODY_BOX.height * 0.15 };
  const low = CRIMP_TOP - crease.height;
  const corners: readonly [string, "bottom left" | "bottom right", Box][] = [
    ["tl", "bottom left", { x: 0, y: STRIP, ...crease }],
    ["tr", "bottom right", { x: GRID.width - crease.width, y: STRIP, ...crease }],
    ["bl", "bottom right", { x: 0, y: low, ...crease }],
    ["br", "bottom left", { x: GRID.width - crease.width, y: low, ...crease }],
  ];
  return (
    <Layer width={width}>
      <Defs>
        <Outlines />
        {corners.map(([id, toward, box]) => (
          <Linear key={id} id={id} line={cssToCorner(toward, box)} list={CREASE} paint={asIs} />
        ))}
        <Linear
          id="ends"
          line={cssLinear(180, BODY_BOX)}
          list={[
            [0, "rgba(0, 0, 0, 0.3)"],
            [0.13, "rgba(0, 0, 0, 0)"],
            [0.8, "rgba(0, 0, 0, 0)"],
            [0.94, "rgba(0, 0, 0, 0.38)"],
          ]}
          paint={asIs}
        />
        <Linear
          id="sides"
          line={cssLinear(90, BODY_BOX)}
          list={[
            [0.02, "rgba(0, 0, 0, 0.42)"],
            [0.13, "rgba(0, 0, 0, 0.16)"],
            [0.3, "rgba(0, 0, 0, 0)"],
            [0.7, "rgba(0, 0, 0, 0)"],
            [0.87, "rgba(0, 0, 0, 0.16)"],
            [0.98, "rgba(0, 0, 0, 0.42)"],
          ]}
          paint={asIs}
        />
      </Defs>
      <G clipPath="url(#body)">
        {corners.map(([id, , box]) => (
          <Rect key={id} {...box} fill={`url(#${id})`} />
        ))}
        <Rect {...BODY_BOX} fill="url(#ends)" />
        <Rect {...BODY_BOX} fill="url(#sides)" />
      </G>
    </Layer>
  );
}

const GLARE: StopList = [
  [0, "rgba(255, 246, 220, 0.3)"],
  [22 / 48, "rgba(190, 200, 255, 0.1)"],
  [1, "rgba(190, 200, 255, 0)"],
];

/** The crown of the bulge, a little towards the light, and the spot where the light falls. */
export function LightLayer({
  width,
  light,
  region,
}: {
  readonly width: number;
  readonly light: Light;
  readonly region: Region;
}) {
  const crown = useAnimatedProps(() => ({
    cx: ((25 + light.x.value * 0.5) / 100) * GRID.width,
  }));
  // A circle reaching the farthest corner of the pouch, faded out at 48 % of it.
  const spot = useAnimatedProps(() => {
    const x = (light.x.value / 100) * GRID.width;
    const y = (light.y.value / 100) * GRID.height;
    const far = Math.hypot(Math.max(x, GRID.width - x), Math.max(y, GRID.height - y));
    return { cx: x, cy: y, r: far * 0.48 };
  });
  const glare = (name: string, paint: Paint) => (
    <G clipPath={`url(#${name})`}>
      <Defs>
        <RadialGradient id={`${name}-glare`} cx="0.5" cy="0.5" r="0.5">
          {stops(GLARE, paint)}
        </RadialGradient>
      </Defs>
      <AnimatedCircle animatedProps={spot} fill={`url(#${name}-glare)`} />
    </G>
  );
  return (
    <LitLayer width={width}>
      <Defs>
        <Outlines />
        <RadialGradient id="crown" cx="0.5" cy="0.5" r="0.5">
          {stops(
            [
              [0, "rgba(255, 255, 255, 0.14)"],
              [1, "rgba(255, 255, 255, 0)"],
            ],
            asIs,
          )}
        </RadialGradient>
      </Defs>
      {region.body !== null && (
        <G clipPath="url(#body)">
          <AnimatedEllipse
            animatedProps={crown}
            cy={STRIP + BODY_BOX.height * 0.4}
            rx={BODY_BOX.width * 0.34 * 0.7}
            ry={BODY_BOX.height * 0.4 * 0.7}
            fill="url(#crown)"
          />
        </G>
      )}
      {region.strip !== null && glare("strip", region.strip)}
      {region.body !== null && glare("body", region.body)}
    </LitLayer>
  );
}

/** The ribs pressed into both crimps, over everything. */
export function RibsLayer({ width, region }: { readonly width: number; readonly region: Region }) {
  const ribs = (name: string, y: number, height: number, paint: Paint) => (
    <G clipPath={`url(#${name})`}>
      <Defs>
        <Pattern id={`${name}-ribs`} patternUnits="userSpaceOnUse" width={6} height={10}>
          <Rect width={2} height={10} fill={paint("rgba(255, 255, 255, 0.16)")} />
        </Pattern>
      </Defs>
      <Rect x={0} y={y} width={GRID.width} height={height} fill={`url(#${name}-ribs)`} />
    </G>
  );
  return (
    <Layer width={width}>
      <Defs>
        <Outlines />
      </Defs>
      {region.strip !== null && ribs("strip", 0, 18, region.strip)}
      {region.body !== null && ribs("body", CRIMP_TOP, CRIMP, region.body)}
    </Layer>
  );
}

const styles = StyleSheet.create({
  lit: {
    position: "absolute",
    top: 0,
    left: 0,
    transformOrigin: "left top",
    transform: [{ scale: 2 }],
  },
});
