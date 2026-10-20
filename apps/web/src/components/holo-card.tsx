import type { CatalogCard } from "@leximon/contract";
import { cardSize } from "@leximon/tokens";
import type { CSSProperties } from "react";
import { holoLayers } from "@/cards/holo";
import { Card } from "./card";
import styles from "./holo-card.module.css";

interface HoloCardProps {
  readonly card: CatalogCard;
  readonly collectionName: string;
  readonly width?: number;
}

/**
 * A card that catches the light: it tilts and its foils move with the light that an ancestor
 * feeds through `useHoloLight`, or drift on their own until then. Meant for the one card the
 * player is looking at (revealed, zoomed); grids keep the plain `Card`.
 */
export function HoloCard({ card, collectionName, width = cardSize.width }: HoloCardProps) {
  const layers = holoLayers(card.rarity);
  const variables = { "--u": `${width / cardSize.width}px` } as CSSProperties;
  return (
    <div className={styles.holo} style={variables}>
      <div className={styles.tilt}>
        <Card card={card} collectionName={collectionName} width={width} />
        {layers.glare !== "none" && (
          <span className={layers.glare === "soft" ? styles.glareSoft : styles.glare} />
        )}
        {layers.gem && <span className={styles.gem} />}
        {layers.frame !== "none" && (
          <span className={`${styles.frame} ${styles[`frame-${layers.frame}`]}`} />
        )}
        {layers.glitter !== "none" && (
          <span className={`${styles.glitter} ${styles[`glitter-${layers.glitter}`]}`} />
        )}
        {layers.rainbow && <span className={styles.rainbow} />}
        {layers.sweep && <span className={styles.sweep} />}
      </div>
    </div>
  );
}
