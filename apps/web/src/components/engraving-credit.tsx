import type { CatalogCard } from "@leximon/contract";
import { creditLine, engravingOf, safeSourceUrl } from "@leximon/view-model";
import styles from "./engraving-credit.module.css";

/**
 * Credit of a card's engraving, under the card where it is shown large (the zoom dialogs). The
 * small card face has no room for it, and CC BY requires it somewhere the player can see.
 */
export function EngravingCredit({ card }: { readonly card: CatalogCard }) {
  const engraving = engravingOf(card);
  if (engraving === null) return null;
  const source = safeSourceUrl(engraving);
  return (
    <p className={styles.credit}>
      Gravure : {creditLine(engraving)}
      {source !== null && (
        <>
          {" · "}
          <a href={source} target="_blank" rel="noopener noreferrer">
            source
          </a>
        </>
      )}
    </p>
  );
}
