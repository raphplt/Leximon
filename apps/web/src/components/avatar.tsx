"use client";

import { avatarName } from "@leximon/view-model";
import type { CSSProperties } from "react";
import { catalogFileUrl } from "@/cards/catalog";
import { cssUrl } from "@/cards/engraving";
import { useCatalog } from "@/cards/use-catalog";
import { Icon } from "@/ui/icon";
import styles from "./avatar.module.css";

/** Frames drawn by this component; another id (a newer catalogue) falls back on the simple one. */
const FRAMES = new Set(["simple", "gilded", "ink"]);

/**
 * The player's avatar (P58): a card's engraving printed in a medallion, inside the frame worn.
 * Decorative unless `label` is given; `frame: null` draws none. The silhouette stands in until
 * the catalogue is there.
 */
export function Avatar({
  avatar,
  frame,
  size,
  label,
  className,
}: {
  readonly avatar: string | null;
  readonly frame: string | null;
  readonly size: number;
  readonly label?: string | undefined;
  readonly className?: string | undefined;
}) {
  const catalog = useCatalog();
  const engraving = avatar === null ? null : (catalog?.cardsById.get(avatar)?.engraving ?? null);
  const style = {
    "--size": `${size}px`,
    "--k": size / 84,
    ...(engraving === null ? {} : { "--ink-src": cssUrl(catalogFileUrl(engraving.ink)) }),
  } as CSSProperties;
  const accessible =
    label === undefined
      ? { "aria-hidden": true }
      : { role: "img", "aria-label": avatar === null ? label : `${label}, ${avatarName(avatar)}` };
  return (
    <span
      className={`${styles.avatar} ${className ?? ""}`}
      data-frame={frame === null ? "none" : FRAMES.has(frame) ? frame : "simple"}
      style={style}
      {...accessible}
    >
      {engraving === null ? (
        <Icon name="profil" size={Math.round(size * 0.6)} />
      ) : (
        <span className={styles.ink} />
      )}
    </span>
  );
}
