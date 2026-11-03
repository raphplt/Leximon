"use client";

import type { CatalogCard } from "@leximon/contract";
import { CARD_PAGE_ACTION } from "@leximon/view-model";
import type { PackCollection } from "@/booster/pack-looks";
import { CollectionSeal } from "@/components/collection-seal";
import { EngravingCredit } from "@/components/engraving-credit";
import { HoloCard } from "@/components/holo-card";
import { useHoloLight } from "@/components/use-holo-light";
import { useNarrow } from "@/lib/use-narrow";
import { ButtonLink } from "@/ui/button";
import ui from "@/ui/ui.module.css";
import { CardFacts, CardOrigin, CardQuoteInFull } from "./card-facts";
import styles from "./public-card.module.css";

/** A card as anyone sees it from a shared link: the card, what it says, and the way in. */
export function PublicCardView({
  card,
  collectionName,
  seal,
  pitch,
}: {
  readonly card: CatalogCard;
  readonly collectionName: string;
  readonly seal: PackCollection | null;
  readonly pitch: string;
}) {
  const narrow = useNarrow();
  const light = useHoloLight(true);
  return (
    <div className={styles.layout}>
      <div
        className={styles.cardSide}
        ref={light.ref}
        onPointerMove={light.onPointerMove}
        onPointerLeave={light.onPointerLeave}
      >
        <HoloCard card={card} collectionName={collectionName} width={narrow ? 260 : 320} />
        <EngravingCredit card={card} />
      </div>
      <div className={`${styles.facts} ${ui.leaf}`}>
        <h1 className={`${ui.display} ${styles.word}`}>{card.word}</h1>
        <CardFacts card={card} />
        <p className={styles.chips}>
          <span className={ui.chip}>
            {seal !== null && <CollectionSeal collection={seal} size={24} />}
            {collectionName}
          </span>
        </p>
        <CardQuoteInFull card={card} />
        <CardOrigin card={card} />
        <div className={styles.pitch}>
          <p>{pitch}</p>
          <ButtonLink href="/jouer">{CARD_PAGE_ACTION}</ButtonLink>
        </div>
      </div>
    </div>
  );
}
