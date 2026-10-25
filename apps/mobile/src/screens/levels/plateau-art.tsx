import type { PlateauLayout } from "@leximon/view-model";
import Svg, {
  Circle,
  Defs,
  Ellipse,
  G,
  LinearGradient,
  Path,
  Polygon,
  RadialGradient,
  Rect,
  Stop,
} from "react-native-svg";
import { colors } from "@/theme";

/** The three visible faces of a block seen from above, its top face `w` × `h`, `d` deep. */
function faces(cx: number, cy: number, w: number, h: number, d: number) {
  const [hw, hh] = [w / 2, h / 2];
  return {
    left: `${cx - hw},${cy} ${cx},${cy + hh} ${cx},${cy + hh + d} ${cx - hw},${cy + d}`,
    right: `${cx},${cy + hh} ${cx + hw},${cy} ${cx + hw},${cy + d} ${cx},${cy + hh + d}`,
    top: `${cx},${cy - hh} ${cx + hw},${cy} ${cx},${cy + hh} ${cx - hw},${cy}`,
  };
}

type Shades = readonly [string, string, string];

export type TileLook = "gold" | "cream" | "kraft" | "slate";

const LOOKS: Readonly<Record<TileLook, Shades>> = {
  gold: ["#F6C544", "#C99A12", "#9C7409"],
  cream: ["#F6F0E2", "#C9BFA6", "#A99F87"],
  kraft: ["#E3C393", "#B98C55", "#97703F"],
  slate: ["#4A5175", "#343B5C", "#2B3150"],
};

/** The colour of the mark on each look of tile. */
export const MARK_COLORS: Readonly<Record<TileLook, string>> = {
  gold: colors.accentInk,
  cream: colors.kraftTitle,
  kraft: colors.kraftTitle,
  slate: colors.textMuted,
};

/** The tile's box: its top face fills the upper 70 %. */
export const TILE_BOX = { width: 120, height: 84 } as const;

/** A level's tile: a block whose colours say whether the level is behind, next or ahead. */
export function TileBlock({
  look,
  selected,
  width,
}: {
  readonly look: TileLook;
  readonly selected: boolean;
  readonly width: number;
}) {
  const f = faces(60, 30, 118, 59, 24);
  const [top, left, right] = LOOKS[look];
  return (
    <Svg
      width={width}
      height={(width * TILE_BOX.height) / TILE_BOX.width}
      viewBox={`0 0 ${TILE_BOX.width} ${TILE_BOX.height}`}
    >
      <Polygon points={f.left} fill={left} />
      <Polygon points={f.right} fill={right} />
      <Polygon
        points={f.top}
        fill={top}
        stroke={selected ? colors.text : "transparent"}
        strokeWidth={3}
      />
    </Svg>
  );
}

function Block({
  x,
  y,
  w,
  h,
  d,
  shades,
}: {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
  readonly d: number;
  readonly shades: Shades;
}) {
  const f = faces(x, y, w, h, d);
  return (
    <G>
      <Polygon points={f.left} fill={shades[1]} />
      <Polygon points={f.right} fill={shades[2]} />
      <Polygon points={f.top} fill={shades[0]} />
    </G>
  );
}

const BURGUNDY: Shades = ["#5e2130", "#3f1520", "#2a0d15"];
const GREEN: Shades = ["#22493c", "#173329", "#0e221b"];
const KRAFT: Shades = ["#d9b486", "#b98c55", "#97703f"];
const WOOD: Shades = ["#6b4f31", "#4a3520", "#3a2918"];
const NIGHT: Shades = ["#2c3459", "#1f2440", "#161a2c"];
const STONE_DONE: Shades = ["#f0b92b", "#c99a12", "#9c7409"];
const STONE_AHEAD: Shades = ["#4a5175", "#343b5c", "#2b3150"];

function Books({ x, y }: { readonly x: number; readonly y: number }) {
  return (
    <G>
      <Block x={x} y={y + 12} w={70} h={35} d={12} shades={BURGUNDY} />
      <Block x={x + 4} y={y} w={64} h={32} d={10} shades={GREEN} />
      <Block x={x - 2} y={y - 10} w={58} h={29} d={9} shades={KRAFT} />
    </G>
  );
}

function Candle({ x, y }: { readonly x: number; readonly y: number }) {
  return (
    <G>
      <Block x={x} y={y} w={50} h={25} d={8} shades={WOOD} />
      <Rect x={x - 6} y={y - 46} width={12} height={44} rx={3} fill="#f6f0e2" />
      <Circle cx={x} cy={y - 54} r={28} fill="url(#plateau-flame)" />
      <Ellipse cx={x} cy={y - 56} rx={6} ry={10} fill="#ffd24d" />
    </G>
  );
}

function Inkwell({ x, y }: { readonly x: number; readonly y: number }) {
  return (
    <G>
      <Block x={x} y={y} w={54} h={27} d={18} shades={NIGHT} />
      <Path
        d={`M${x + 4} ${y - 6} L${x + 40} ${y - 70}`}
        stroke="#f6f0e2"
        strokeWidth={3}
        strokeLinecap="round"
      />
      <Path d={`M${x + 40} ${y - 70} c 10 -10 18 -6 14 6 c -4 8 -12 10 -18 4`} fill="#f6f0e2" />
    </G>
  );
}

function Lamp({ x, y }: { readonly x: number; readonly y: number }) {
  return (
    <G>
      <Rect x={x - 3} y={y - 80} width={6} height={80} fill="#6b4f31" />
      <Circle cx={x} cy={y - 88} r={36} fill="url(#plateau-flame)" />
      <Rect x={x - 10} y={y - 96} width={20} height={18} rx={4} fill="#ffd24d" />
    </G>
  );
}

/**
 * What stands on the plateau besides the tiles: the ground, a few things of a bookshop, and the
 * stepping stones between two levels. The tiles always zigzag the same way, so the props keep
 * their places in every quarter.
 */
export function PlateauDecor({
  layout,
  width,
}: {
  readonly layout: PlateauLayout;
  readonly width: number;
}) {
  return (
    <Svg
      width={width}
      height={(width * layout.height) / layout.width}
      viewBox={`0 0 ${layout.width} ${layout.height}`}
      style={{ position: "absolute", top: 0, left: 0 }}
    >
      <Defs>
        <RadialGradient id="plateau-ground" cx="0.5" cy="0.55">
          <Stop offset="0" stopColor="#3a4268" />
          <Stop offset="0.7" stopColor="#2b3150" />
          <Stop offset="1" stopColor="#2b3150" stopOpacity="0" />
        </RadialGradient>
        <RadialGradient id="plateau-flame">
          <Stop offset="0" stopColor="#ffd24d" stopOpacity="0.35" />
          <Stop offset="1" stopColor="#ffd24d" stopOpacity="0" />
        </RadialGradient>
      </Defs>
      <Ellipse
        cx={layout.width / 2}
        cy={layout.height * 0.56}
        rx={layout.width * 0.5}
        ry={layout.height * 0.48}
        fill="url(#plateau-ground)"
      />
      <Books x={560} y={630} />
      <Inkwell x={140} y={470} />
      <Candle x={570} y={340} />
      <Lamp x={190} y={200} />
      {layout.stones.map((stone) => (
        <Block
          key={`${stone.x},${stone.y}`}
          x={stone.x}
          y={stone.y + 6}
          w={40}
          h={20}
          d={8}
          shades={stone.done ? STONE_DONE : STONE_AHEAD}
        />
      ))}
    </Svg>
  );
}

/** The fog over the levels far ahead, thinning towards the player. */
export function FogBank({ width, height }: { readonly width: number; readonly height: number }) {
  return (
    <Svg
      width={width}
      height={height}
      style={{ position: "absolute", top: 0, left: 0 }}
      pointerEvents="none"
    >
      <Defs>
        <LinearGradient id="plateau-fog" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#1F2337" stopOpacity="0.96" />
          <Stop offset="0.55" stopColor="#262B40" stopOpacity="0.82" />
          <Stop offset="1" stopColor="#262B40" stopOpacity="0" />
        </LinearGradient>
      </Defs>
      <Rect width={width} height={height} fill="url(#plateau-fog)" />
    </Svg>
  );
}

/** The golden halo under a tile where a coffret waits. */
export function TileHalo({ width }: { readonly width: number }) {
  return (
    <Svg width={width} height={width * 0.7}>
      <Defs>
        <RadialGradient id="tile-halo">
          <Stop offset="0" stopColor="#ffd24d" stopOpacity="0.8" />
          <Stop offset="1" stopColor="#ffd24d" stopOpacity="0" />
        </RadialGradient>
      </Defs>
      <Ellipse
        cx={width / 2}
        cy={width * 0.35}
        rx={width / 2}
        ry={width * 0.35}
        fill="url(#tile-halo)"
      />
    </Svg>
  );
}
