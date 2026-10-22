import type { PlateauLayout } from "@leximon/view-model";
import styles from "./level-road.module.css";

/** The three visible faces of a block seen from above, its top face `w` × `h`, `d` deep. */
function faces(cx: number, cy: number, w: number, h: number, d: number) {
  const [hw, hh] = [w / 2, h / 2];
  return {
    left: `${cx - hw},${cy} ${cx},${cy + hh} ${cx},${cy + hh + d} ${cx - hw},${cy + d}`,
    right: `${cx},${cy + hh} ${cx + hw},${cy} ${cx + hw},${cy + d} ${cx},${cy + hh + d}`,
    top: `${cx},${cy - hh} ${cx + hw},${cy} ${cx},${cy + hh} ${cx - hw},${cy}`,
  };
}

/** A level's tile: a block whose colors say whether the level is behind, next or ahead. */
export function TileBlock({
  look,
  glow,
}: {
  readonly look: "gold" | "cream" | "kraft" | "slate";
  readonly glow: boolean;
}) {
  const f = faces(60, 30, 118, 59, 24);
  return (
    <svg
      viewBox="0 0 120 84"
      className={`${styles.block} ${styles[look]} ${glow ? styles.blockGlow : ""}`}
      aria-hidden="true"
    >
      <polygon points={f.left} className={styles.blockLeft} />
      <polygon points={f.right} className={styles.blockRight} />
      <polygon points={f.top} className={styles.blockTop} />
    </svg>
  );
}

function Block({
  x,
  y,
  w,
  h,
  d,
  colors,
}: {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
  readonly d: number;
  readonly colors: readonly [string, string, string];
}) {
  const f = faces(x, y, w, h, d);
  return (
    <g>
      <polygon points={f.left} fill={colors[1]} />
      <polygon points={f.right} fill={colors[2]} />
      <polygon points={f.top} fill={colors[0]} />
    </g>
  );
}

const BURGUNDY = ["#5e2130", "#3f1520", "#2a0d15"] as const;
const GREEN = ["#22493c", "#173329", "#0e221b"] as const;
const KRAFT = ["#d9b486", "#b98c55", "#97703f"] as const;
const WOOD = ["#6b4f31", "#4a3520", "#3a2918"] as const;
const NIGHT = ["#2c3459", "#1f2440", "#161a2c"] as const;

function Books({ x, y }: { readonly x: number; readonly y: number }) {
  return (
    <g>
      <Block x={x} y={y + 12} w={70} h={35} d={12} colors={BURGUNDY} />
      <Block x={x + 4} y={y} w={64} h={32} d={10} colors={GREEN} />
      <Block x={x - 2} y={y - 10} w={58} h={29} d={9} colors={KRAFT} />
    </g>
  );
}

function Candle({ x, y }: { readonly x: number; readonly y: number }) {
  return (
    <g>
      <Block x={x} y={y} w={50} h={25} d={8} colors={WOOD} />
      <rect x={x - 6} y={y - 46} width={12} height={44} rx={3} fill="#f6f0e2" />
      <circle cx={x} cy={y - 54} r={28} fill="url(#plateau-flame)" />
      <ellipse cx={x} cy={y - 56} rx={6} ry={10} fill="#ffd24d" />
    </g>
  );
}

function Inkwell({ x, y }: { readonly x: number; readonly y: number }) {
  return (
    <g>
      <Block x={x} y={y} w={54} h={27} d={18} colors={NIGHT} />
      <path
        d={`M${x + 4} ${y - 6} L${x + 40} ${y - 70}`}
        stroke="#f6f0e2"
        strokeWidth={3}
        strokeLinecap="round"
      />
      <path d={`M${x + 40} ${y - 70} c 10 -10 18 -6 14 6 c -4 8 -12 10 -18 4`} fill="#f6f0e2" />
    </g>
  );
}

function Lamp({ x, y }: { readonly x: number; readonly y: number }) {
  return (
    <g>
      <rect x={x - 3} y={y - 80} width={6} height={80} fill="#6b4f31" />
      <circle cx={x} cy={y - 88} r={36} fill="url(#plateau-flame)" />
      <rect x={x - 10} y={y - 96} width={20} height={18} rx={4} fill="#ffd24d" />
    </g>
  );
}

/**
 * What stands on the plateau besides the tiles: the ground, a few things of a bookshop, and the
 * stepping stones between two levels. The tiles always zigzag the same way, so the props keep
 * their places in every quarter.
 */
export function PlateauDecor({ layout }: { readonly layout: PlateauLayout }) {
  const { width, height } = layout;
  return (
    <svg viewBox={`0 0 ${width} ${height}`} className={styles.decor} aria-hidden="true">
      <defs>
        <radialGradient id="plateau-ground" cx="0.5" cy="0.55">
          <stop offset="0" stopColor="#3a4268" />
          <stop offset="0.7" stopColor="#2b3150" />
          <stop offset="1" stopColor="#2b3150" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="plateau-flame">
          <stop offset="0" stopColor="#ffd24d" stopOpacity="0.35" />
          <stop offset="1" stopColor="#ffd24d" stopOpacity="0" />
        </radialGradient>
      </defs>
      <ellipse
        cx={width / 2}
        cy={height * 0.56}
        rx={width * 0.5}
        ry={height * 0.48}
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
          colors={
            stone.done ? ["#f0b92b", "#c99a12", "#9c7409"] : ["#4a5175", "#343b5c", "#2b3150"]
          }
        />
      ))}
    </svg>
  );
}
