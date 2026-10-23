"use client";

import type { CatalogCard } from "@leximon/contract";
import {
  CARD_SHARE_COPIED,
  canOfferInTrade,
  cardShareRefused,
  copiesLabel,
  masteryView,
  pinButtonLabel,
  reviewLabel,
} from "@leximon/view-model";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { type PackCollection, packOf } from "@/booster/pack-looks";
import { CardFacts, CardOrigin } from "@/cards/card-facts";
import { type Catalog, collectionName, loadCatalog } from "@/cards/catalog";
import { useCardShare } from "@/cards/share-card";
import { CollectionSeal } from "@/components/collection-seal";
import { EngravingCredit } from "@/components/engraving-credit";
import { HoloCard } from "@/components/holo-card";
import { useHoloLight } from "@/components/use-holo-light";
import { useNarrow } from "@/lib/use-narrow";
import { useNow } from "@/lib/use-now";
import { ownedCards, wordMemory } from "@/player/collection";
import { useShared } from "@/player/resource";
import { useProfileActions } from "@/profile/use-profile-actions";
import { useProgress } from "@/progress/use-progress";
import { ButtonLink } from "@/ui/button";
import { Dialog } from "@/ui/dialog";
import { Icon } from "@/ui/icon";
import { LoadFailed } from "@/ui/load-failed";
import { useToast } from "@/ui/toast";
import ui from "@/ui/ui.module.css";
import styles from "./card-sheet.module.css";

/** The sheet of one card: the card large, what the player knows of it, actions. */
export function CardSheet({
  cardId,
  onClose,
}: {
  readonly cardId: string | null;
  readonly onClose: () => void;
}) {
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [failed, setFailed] = useState(false);
  const load = useCallback(() => {
    setFailed(false);
    loadCatalog()
      .then(setCatalog)
      .catch(() => setFailed(true));
  }, []);
  useEffect(() => {
    if (cardId === null || catalog !== null) return;
    load();
  }, [cardId, catalog, load]);
  const card = cardId === null ? undefined : catalog?.cardsById.get(cardId);

  return (
    <Dialog open={cardId !== null} title={card?.word ?? "Carte"} onClose={onClose} variant="wide">
      {catalog === null && failed && <LoadFailed onRetry={load} />}
      {card !== undefined && catalog !== null && (
        <SheetBody
          card={card}
          collection={collectionName(catalog, card.collectionId)}
          seal={sealOf(catalog, card.collectionId)}
          onClose={onClose}
        />
      )}
    </Dialog>
  );
}

function sealOf(catalog: Catalog, collectionId: string): PackCollection | null {
  const file = catalog.collections.find((c) => c.id === collectionId);
  return file === undefined ? null : packOf(file);
}

function SheetBody({
  card,
  collection,
  seal,
  onClose,
}: {
  readonly card: CatalogCard;
  readonly collection: string;
  readonly seal: PackCollection | null;
  readonly onClose: () => void;
}) {
  const owned = useShared(ownedCards);
  const memory = useShared(wordMemory);
  const progress = useProgress();
  const now = useNow(60_000);
  const narrow = useNarrow();
  const light = useHoloLight(true);
  const toast = useToast();
  const pins = useProfileActions();

  const quantity = owned?.get(card.id) ?? 0;
  const word = memory?.get(card.id);
  const mastery = masteryView(word, now);
  const review = reviewLabel(word, now);
  const tradeable = progress !== null && canOfferInTrade(quantity, progress.level, now);

  const sharing = useCardShare(card);
  const share = async () => {
    const outcome = await sharing.share();
    if (outcome.kind === "copied") toast(CARD_SHARE_COPIED);
    if (outcome.kind === "failed") toast(cardShareRefused(outcome.url));
  };

  return (
    <div className={styles.sheet}>
      <div
        className={styles.cardSide}
        ref={light.ref}
        onPointerMove={light.onPointerMove}
        onPointerLeave={light.onPointerLeave}
      >
        <HoloCard card={card} collectionName={collection} width={narrow ? 250 : 300} />
        <EngravingCredit card={card} />
      </div>
      <div className={styles.facts}>
        <CardFacts card={card} />

        {quantity > 0 && (
          <div className={styles.block}>
            <p className={ui.kicker}>Maîtrise</p>
            <ol className={styles.steps}>
              {mastery.steps.map((step) => (
                <li key={step.level} className={step.reached ? styles[step.level] : styles.stepOff}>
                  <span className={styles.stepBar} />
                  {step.label}
                </li>
              ))}
            </ol>
            <p className={styles.note}>{mastery.text}</p>
          </div>
        )}

        <p className={styles.chips}>
          <span className={`${ui.chip} ${styles.chip}`}>
            {quantity > 0 ? copiesLabel(quantity) : "Pas encore dans ton album"}
          </span>
          <span className={`${ui.chip} ${styles.chip}`}>
            {seal !== null && <CollectionSeal collection={seal} size={24} />}
            {collection}
          </span>
        </p>

        <CardOrigin card={card} />

        {quantity > 0 && (
          <div className={styles.actions}>
            {/* No shortcut to a question here: the card above shows its answer. */}
            {review !== null && <p className={styles.later}>{review}</p>}
            {tradeable && (
              <ButtonLink href={`/echanges?donne=${card.id}`} variant="secondary" onClick={onClose}>
                Proposer en échange
              </ButtonLink>
            )}
            {pins.profile?.member === true && (
              <button
                type="button"
                className={ui.ghost}
                onClick={() => void pins.togglePin(card.id)}
                disabled={pins.busy}
                aria-pressed={pins.isPinned(card.id)}
              >
                <Icon name="pin" size={17} />
                {pinButtonLabel(pins.isPinned(card.id))}
              </button>
            )}
            <button
              type="button"
              className={ui.ghost}
              onPointerEnter={sharing.prepare}
              onPointerDown={sharing.prepare}
              onFocus={sharing.prepare}
              onClick={() => void share()}
            >
              <Icon name="share" size={17} />
              Partager
            </button>
          </div>
        )}
        {quantity === 0 && (
          <p className={styles.note}>
            <Link href="/jouer" onClick={onClose}>
              Ouvre des sachets
            </Link>{" "}
            pour la trouver, ou demande-la en échange.
          </p>
        )}
      </div>
    </div>
  );
}
