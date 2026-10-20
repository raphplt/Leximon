import type { CatalogCard } from "@leximon/contract";
import styles from "./card-caption.module.css";
import { EngravingCredit } from "./engraving-credit";
import { RarityName } from "./rarity-icon";

/**
 * Under a card shown large (the zoom dialogs): its rarity named beside the gem, since the face
 * shows the gem alone, then the engraving credit.
 */
export function CardCaption({ card }: { readonly card: CatalogCard }) {
  return (
    <div className={styles.caption}>
      <p className={styles.rarity}>
        <RarityName rarity={card.rarity} />
      </p>
      <EngravingCredit card={card} />
    </div>
  );
}
