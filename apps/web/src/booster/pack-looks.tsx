import { backTone } from "@leximon/tokens";
import type { CSSProperties } from "react";

/** The collection a sachet holds, as the sachet draws it. */
export interface PackCollection {
  readonly id: string;
  readonly name: string;
  /** The `back` tone of the collection; night when absent. */
  readonly back: string | undefined;
}

interface PackLook {
  /** Strokes of the emblem, in a 64 × 64 box. */
  readonly emblem: readonly string[];
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
  motif: DOTS,
};

/** Each collection's emblem and motif; a collection missing here gets the book. */
const LOOKS: Readonly<Record<string, PackLook>> = {
  fondateurs: {
    emblem: [...BOOK.emblem, "m46 4 6 6-14 14-7 1 1-7z"],
    motif: DOTS,
  },
  caracteres: {
    emblem: [
      "M10 14h26v18c0 9-6 15-13 15S10 41 10 32z",
      "M17 26h3M27 26h3M18 36c3 2 7 2 10 0",
      "M36 22h18v14c0 8-5 13-11 13-3 0-6-1-8-3",
      "M41 32h3M49 32h3M42 43c2-2 6-2 8 0",
    ],
    motif: HATCH,
  },
  metiers: {
    emblem: [
      "M14 50 40 24",
      "m36 14 14 14-6 6-14-14z",
      "M44 50 22 28",
      "M14 18a8 8 0 0 0 10 10l-4 4-6-6z",
    ],
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

export function PackEmblem({
  collectionId,
  className,
}: {
  readonly collectionId: string;
  readonly className?: string | undefined;
}) {
  return (
    <svg
      viewBox="0 0 64 64"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth={2.4}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {lookOf(collectionId).emblem.map((d) => (
        <path key={d} d={d} />
      ))}
    </svg>
  );
}
