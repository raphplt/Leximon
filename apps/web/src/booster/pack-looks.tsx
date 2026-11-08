import type { CatalogCollectionFile } from "@leximon/contract";
import {
  backTone,
  leafTile,
  type PackMotif,
  packLook,
  sealBeads,
  sealGold,
  sealScallopPath,
} from "@leximon/tokens";
import { type CSSProperties, useId } from "react";
import { catalogFileUrl } from "../cards/catalog";

/** The collection a sachet holds, as the sachet draws it. */
export interface PackCollection {
  readonly id: string;
  readonly name: string;
  /** The `back` tone of the collection; night when absent. */
  readonly back: string | undefined;
  /** Ink of the engraving in its seal, relative to the catalogue; its drawn emblem when absent. */
  readonly engraving?: string | undefined;
}

/** How a published collection's sachet looks, without its cards. */
export function packOf(collection: CatalogCollectionFile): PackCollection {
  return {
    id: collection.id,
    name: collection.name,
    back: collection.back,
    engraving: collection.engraving?.ink,
  };
}

/** The leaves tile as an SVG mask: CSS gradients cannot draw a leaf. */
const LEAF_MASK = (() => {
  const { size, shown, fills, stems } = leafTile;
  const svg = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">`,
    ...fills.map((d) => `<path d="${d}"/>`),
    ...stems.map((d) => `<path d="${d}" fill="none" stroke="#000"/>`),
    "</svg>",
  ].join("");
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}") 0 0 / ${shown}px ${shown}px`;
})();

/** The foil's motif in CSS, drawn in currentColor, and the mask that cuts it when it has one. */
const MOTIFS: Readonly<Record<PackMotif, { background: string; mask?: string; opacity?: number }>> =
  {
    dots: {
      background: "radial-gradient(circle, currentColor 1.4px, transparent 1.6px) 0 0 / 22px 22px",
    },
    hatch: {
      background: "repeating-linear-gradient(45deg, currentColor 0 1px, transparent 1px 11px)",
    },
    grid: {
      background:
        "linear-gradient(currentColor 1px, transparent 1px) 0 0 / 24px 24px, linear-gradient(90deg, currentColor 1px, transparent 1px) 0 0 / 24px 24px",
    },
    leaves: { background: "currentColor", mask: LEAF_MASK, opacity: leafTile.opacity },
  };

/** The colors and motif of a collection's sachet, as CSS variables. */
export function packVariables(collection: PackCollection): CSSProperties {
  const tone = backTone(collection.back);
  const motif = MOTIFS[packLook(collection.id).motif];
  return {
    "--tone-light": tone.light,
    "--tone-dark": tone.dark,
    "--motif": motif.background,
    "--motif-mask": motif.mask ?? "none",
    "--motif-opacity": motif.opacity ?? 0.11,
  } as CSSProperties;
}

/**
 * The collection's seal, hot-stamped in gold on the sachet: a scalloped rosette, a ring of beads,
 * and the emblem engraved in gold on a field of the sachet's dark tone.
 */
export function PackSeal({
  collectionId,
  engraving,
  className,
}: {
  readonly collectionId: string;
  /** Ink of the collection's engraving, relative to the catalogue. */
  readonly engraving?: string | undefined;
  readonly className?: string | undefined;
}) {
  // One gradient per seal: several sachets can share a page.
  const id = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const gold = `url(#${id}-gold)`;
  const look = packLook(collectionId);
  return (
    <svg viewBox="0 0 120 120" className={className} aria-hidden="true">
      <defs>
        <linearGradient id={`${id}-gold`} x1="0" y1="0" x2="1" y2="1">
          {sealGold.map(([color, offset]) => (
            <stop key={offset} offset={offset} stopColor={color} />
          ))}
        </linearGradient>
        <radialGradient id={`${id}-field`} cx="0.5" cy="0.38" r="0.65">
          <stop offset="0" stopColor="var(--tone-light)" />
          <stop offset="1" stopColor="var(--tone-dark)" />
        </radialGradient>
        {engraving !== undefined && (
          <>
            <linearGradient id={`${id}-ink`} x1="0" y1="0" x2="0.6" y2="1">
              <stop offset="0" stopColor="#fff3cf" />
              <stop offset="1" stopColor="#e0b04e" />
            </linearGradient>
            {/* The ink is black on transparent: its alpha, not its colour, draws the lines. */}
            <mask id={`${id}-engraving`} style={{ maskType: "alpha" }}>
              <image
                href={catalogFileUrl(engraving)}
                x={22}
                y={21}
                width={76}
                height={78}
                preserveAspectRatio="xMidYMid meet"
              />
            </mask>
            <clipPath id={`${id}-round`}>
              <circle cx={60} cy={60} r={40} />
            </clipPath>
          </>
        )}
      </defs>
      <path d={sealScallopPath} fill={gold} />
      <path d={sealScallopPath} fill="none" stroke="#5a3a0c" strokeOpacity={0.45} strokeWidth={1} />
      <circle cx={60} cy={60} r={49} fill="none" stroke="#6b4510" strokeOpacity={0.5} />
      {sealBeads.map(([x, y]) => (
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
      {engraving !== undefined ? (
        <g clipPath={`url(#${id}-round)`}>
          <rect
            x={18}
            y={18}
            width={84}
            height={84}
            fill={`url(#${id}-ink)`}
            mask={`url(#${id}-engraving)`}
          />
        </g>
      ) : (
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
      )}
    </svg>
  );
}
