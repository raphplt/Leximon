import { backTone } from "@leximon/tokens";
import { type CSSProperties, useId } from "react";

/** The collection a sachet holds, as the sachet draws it. */
export interface PackCollection {
  readonly id: string;
  readonly name: string;
  /** The `back` tone of the collection; night when absent. */
  readonly back: string | undefined;
}

interface PackLook {
  /** Strokes of the emblem, in a 64 × 64 box; the first ones listed in `solid` are filled too. */
  readonly emblem: readonly string[];
  /** How many of the first strokes are closed shapes, filled with a wash of gold. */
  readonly solid: number;
  /** Faint pattern printed on the foil, in kraft. */
  readonly motif: string;
}

const DOTS = "radial-gradient(circle, currentColor 1.4px, transparent 1.6px) 0 0 / 22px 22px";
const HATCH = "repeating-linear-gradient(45deg, currentColor 0 1px, transparent 1px 11px)";
const GRID =
  "linear-gradient(currentColor 1px, transparent 1px) 0 0 / 24px 24px, linear-gradient(90deg, currentColor 1px, transparent 1px) 0 0 / 24px 24px";

const BOOK: PackLook = {
  emblem: [
    "M8 18c8-4 16-4 24 2 8-6 16-6 24-2v32c-8-4-16-4-24 2-8-6-16-6-24-2z",
    "M32 20v32",
    "M14 26c4-1 8-1 12 1M14 33c4-1 8-1 12 1M38 27c4-2 8-2 12-1M38 34c4-2 8-2 12-1",
  ],
  solid: 1,
  motif: DOTS,
};

/** Each collection's emblem and motif; a collection missing here gets the book. */
const LOOKS: Readonly<Record<string, PackLook>> = {
  fondateurs: {
    emblem: [BOOK.emblem[0] as string, "m46 4 6 6-14 14-7 1 1-7z", ...BOOK.emblem.slice(1)],
    solid: 2,
    motif: DOTS,
  },
  caracteres: {
    emblem: [
      "M10 14h26v18c0 9-6 15-13 15S10 41 10 32z",
      "M36 22h18v14c0 8-5 13-11 13-3 0-6-1-8-3",
      "M17 26h3M27 26h3M18 36c3 2 7 2 10 0",
      "M41 32h3M49 32h3M42 43c2-2 6-2 8 0",
    ],
    solid: 2,
    motif: HATCH,
  },
  metiers: {
    emblem: [
      "m36 14 14 14-6 6-14-14z",
      "M14 18a8 8 0 0 0 10 10l-4 4-6-6z",
      "M14 50 40 24",
      "M44 50 22 28",
    ],
    solid: 2,
    motif: GRID,
  },
};

function lookOf(collectionId: string): PackLook {
  return LOOKS[collectionId] ?? BOOK;
}

/** The colors and motif of a collection's sachet, as CSS variables. */
export function packVariables(collection: PackCollection): CSSProperties {
  const tone = backTone(collection.back);
  return {
    "--tone-light": tone.light,
    "--tone-dark": tone.dark,
    "--motif": lookOf(collection.id).motif,
  } as CSSProperties;
}

/** The scalloped rim of the seal: bumps of this many around a circle of radius 54. */
const SCALLOPS = 22;

const SCALLOP_PATH = (() => {
  const point = (k: number) => {
    const angle = (k / SCALLOPS) * 2 * Math.PI - Math.PI / 2;
    return `${(60 + 54 * Math.cos(angle)).toFixed(2)} ${(60 + 54 * Math.sin(angle)).toFixed(2)}`;
  };
  const bump = (54 * Math.PI) / SCALLOPS + 1.2;
  const arcs = Array.from(
    { length: SCALLOPS },
    (_, k) => `A${bump.toFixed(2)} ${bump.toFixed(2)} 0 0 1 ${point(k + 1)}`,
  );
  return `M${point(0)}${arcs.join("")}Z`;
})();

/** Beads around the engraved field, like on a coin. */
const BEADS = Array.from({ length: 36 }, (_, k) => {
  const angle = (k / 36) * 2 * Math.PI;
  // Rounded: the server and the browser must print the same figures.
  const at = (value: number) => Math.round(value * 100) / 100;
  return [at(60 + 45.5 * Math.cos(angle)), at(60 + 45.5 * Math.sin(angle))] as const;
});

/**
 * The collection's seal, hot-stamped in gold on the sachet: a scalloped rosette, a ring of beads,
 * and the emblem engraved in gold on a field of the sachet's dark tone.
 */
export function PackSeal({
  collectionId,
  className,
}: {
  readonly collectionId: string;
  readonly className?: string | undefined;
}) {
  // One gradient per seal: several sachets can share a page.
  const id = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const gold = `url(#${id}-gold)`;
  const look = lookOf(collectionId);
  return (
    <svg viewBox="0 0 120 120" className={className} aria-hidden="true">
      <defs>
        <linearGradient id={`${id}-gold`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#fff1c2" />
          <stop offset="0.35" stopColor="#e9bf62" />
          <stop offset="0.7" stopColor="#b98128" />
          <stop offset="1" stopColor="#7d5214" />
        </linearGradient>
        <radialGradient id={`${id}-field`} cx="0.5" cy="0.38" r="0.65">
          <stop offset="0" stopColor="var(--tone-light)" />
          <stop offset="1" stopColor="var(--tone-dark)" />
        </radialGradient>
      </defs>
      <path d={SCALLOP_PATH} fill={gold} />
      <path d={SCALLOP_PATH} fill="none" stroke="#5a3a0c" strokeOpacity={0.45} strokeWidth={1} />
      <circle cx={60} cy={60} r={49} fill="none" stroke="#6b4510" strokeOpacity={0.5} />
      {BEADS.map(([x, y]) => (
        <circle key={`${x}-${y}`} cx={x} cy={y} r={1.5} fill="#6b4510" fillOpacity={0.55} />
      ))}
      <circle cx={60} cy={60} r={42} fill={`url(#${id}-field)`} />
      <circle
        cx={60}
        cy={60}
        r={42}
        fill="none"
        stroke="#2a1a04"
        strokeOpacity={0.6}
        strokeWidth={2}
      />
      <g
        transform="translate(32 32) scale(0.875)"
        stroke="#f3d58a"
        strokeWidth={3.4}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {look.emblem.map((d, index) => (
          <path
            key={d}
            d={d}
            fill={index < look.solid ? gold : "none"}
            fillOpacity={index < look.solid ? 0.28 : undefined}
          />
        ))}
      </g>
    </svg>
  );
}
