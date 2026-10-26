"use client";

import type { CatalogCard } from "@leximon/contract";
import { type Catalog, collectionName } from "@leximon/contract/client";
import {
  CARD_REPORT,
  CARD_SHARE_COPIED,
  canOfferInTrade,
  cardPath,
  cardShareRefused,
  copiesLabel,
  masteryView,
  PIN_TEXTS,
  placePin,
  reviewLabel,
  unpin,
} from "@leximon/view-model";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { FeedbackDialog } from "@/beta/feedback-dialog";
import { type PackCollection, packOf } from "@/booster/pack-looks";
import { CardFacts, CardOrigin, CardQuoteInFull } from "@/cards/card-facts";
import { loadCatalog } from "@/cards/catalog";
import { useCardShare } from "@/cards/share-card";
import { CollectionSeal } from "@/components/collection-seal";
import { EngravingCredit } from "@/components/engraving-credit";
import { HoloCard } from "@/components/holo-card";
import { useHoloLight } from "@/components/use-holo-light";
import { useNarrow } from "@/lib/use-narrow";
import { useNow } from "@/lib/use-now";
import { noteCardRead, ownedCards, wordMemory } from "@/player/collection";
import { useShared } from "@/player/resource";
import { ReplacePin } from "@/profile/pin-picker";
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
  /** Every place was taken: the player picks which pinned card this one replaces. */
  const [replacing, setReplacing] = useState(false);
  const [reporting, setReporting] = useState(false);
  const pinnedNow = pins.profile?.pinned ?? [];
  const togglePin = () => {
    const me = pins.profile;
    if (me === null) return;
    if (pins.isPinned(card.id)) {
      void pins.setPins(unpin(me.pinned, card.id), PIN_TEXTS.removed);
      return;
    }
    const change = placePin(me.pinned, me.pinnedSlots, card.id, null);
    if (change.ok) void pins.setPins(change.cardIds, PIN_TEXTS.pinned);
    else setReplacing(true);
  };
  const replacePin = (index: number) => {
    setReplacing(false);
    const me = pins.profile;
    if (me === null) return;
    const change = placePin(me.pinned, me.pinnedSlots, card.id, index);
    if (change.ok) void pins.setPins(change.cardIds, PIN_TEXTS.pinned);
  };

  const quantity = owned?.get(card.id) ?? 0;
  // Opening the sheet is reading the card: the album stops calling it new.
  useEffect(() => {
    if (quantity > 0) noteCardRead(card.id);
  }, [card.id, quantity]);
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

        <CardQuoteInFull card={card} />
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
                onClick={togglePin}
                aria-pressed={pins.isPinned(card.id)}
              >
                <Icon name="pin" size={17} />
                {pins.isPinned(card.id) ? PIN_TEXTS.unpin : PIN_TEXTS.pin}
              </button>
            )}
            <ReplacePin
              open={replacing}
              word={card.word}
              pinned={pinnedNow}
              onPick={replacePin}
              onClose={() => setReplacing(false)}
            />
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

        <button type="button" className={styles.report} onClick={() => setReporting(true)}>
          {CARD_REPORT.button}
        </button>
        <FeedbackDialog
          open={reporting}
          onClose={() => setReporting(false)}
          screen={cardPath(card.id)}
          title={CARD_REPORT.title}
          label={CARD_REPORT.label}
        />
      </div>
    </div>
  );
}
