"use client";

import type { CatalogCard } from "@leximon/contract";
import {
  canOfferInTrade,
  copiesLabel,
  frequencyLine,
  masteryView,
  reviewState,
  shareText,
} from "@leximon/view-model";
import Link from "next/link";
import { useEffect, useState } from "react";
import { type Catalog, collectionName, loadCatalog } from "@/cards/catalog";
import { useSpokenWord } from "@/cards/use-spoken-word";
import { EngravingCredit } from "@/components/engraving-credit";
import { HoloCard } from "@/components/holo-card";
import { RarityName } from "@/components/rarity-icon";
import { useHoloLight } from "@/components/use-holo-light";
import { useNarrow } from "@/lib/use-narrow";
import { useNow } from "@/lib/use-now";
import { ownedCards, wordMemory } from "@/player/collection";
import { useShared } from "@/player/resource";
import { useProgress } from "@/progress/use-progress";
import { ButtonLink } from "@/ui/button";
import { Dialog } from "@/ui/dialog";
import { Icon } from "@/ui/icon";
import { useToast } from "@/ui/toast";
import ui from "@/ui/ui.module.css";
import styles from "./card-sheet.module.css";

/** The sheet of one card (A-07 to A-10): the card large, what the player knows of it, actions. */
export function CardSheet({
  cardId,
  onClose,
}: {
  readonly cardId: string | null;
  readonly onClose: () => void;
}) {
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  useEffect(() => {
    if (cardId === null || catalog !== null) return;
    loadCatalog()
      .then(setCatalog)
      .catch(() => {
        // The sheet stays empty; closing and opening it again retries.
      });
  }, [cardId, catalog]);
  const card = cardId === null ? undefined : catalog?.cardsById.get(cardId);

  return (
    <Dialog open={cardId !== null} title={card?.word ?? "Carte"} onClose={onClose} variant="wide">
      {card !== undefined && catalog !== null && (
        <SheetBody
          card={card}
          collection={collectionName(catalog, card.collectionId)}
          onClose={onClose}
        />
      )}
    </Dialog>
  );
}

function SheetBody({
  card,
  collection,
  onClose,
}: {
  readonly card: CatalogCard;
  readonly collection: string;
  readonly onClose: () => void;
}) {
  const owned = useShared(ownedCards);
  const memory = useShared(wordMemory);
  const progress = useProgress();
  const now = useNow(60_000);
  const narrow = useNarrow();
  const light = useHoloLight(true);
  const toast = useToast();

  const quantity = owned?.get(card.id) ?? 0;
  const word = memory?.get(card.id);
  const mastery = masteryView(word, now);
  const review = reviewState(word, now);
  const tradeable = progress !== null && canOfferInTrade(quantity, progress.level, now);

  const share = async () => {
    const text = shareText(card.word, card.perBillion);
    try {
      if (typeof navigator.share === "function") {
        await navigator.share({ text });
        return;
      }
      await navigator.clipboard.writeText(text);
      toast(`Copié : « ${text} »`);
    } catch {
      // Sharing cancelled: nothing to say.
    }
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
        <p className={styles.rarity}>
          <RarityName rarity={card.rarity} />
        </p>
        <Pronunciation card={card} />
        <p className={styles.frequency}>{frequencyLine(card.perBillion)}</p>

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
          <span className={`${ui.chip} ${styles.chip}`}>{collection}</span>
        </p>

        {card.etymology !== null && (
          <div className={styles.block}>
            <p className={ui.kicker}>Origine{card.era !== null ? ` · ${card.era}` : ""}</p>
            <p className={styles.etymology}>{card.etymology}</p>
          </div>
        )}

        {quantity > 0 && (
          <div className={styles.actions}>
            {review.due ? (
              <ButtonLink href={`/defis?mot=${card.id}`} onClick={onClose}>
                Réviser ce mot
              </ButtonLink>
            ) : (
              <p className={styles.later}>{review.label}</p>
            )}
            {tradeable && (
              <ButtonLink href={`/echanges?donne=${card.id}`} variant="secondary" onClick={onClose}>
                Proposer en échange
              </ButtonLink>
            )}
            <button type="button" className={ui.ghost} onClick={() => void share()}>
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

/** The word spoken by the catalogue's voice (A-09, P57), with its phonetic notation. */
function Pronunciation({ card }: { readonly card: CatalogCard }) {
  const word = useSpokenWord(card);
  const spoken = card.pronunciation ?? null;
  if (spoken === null) return null;
  return (
    <p className={styles.spoken}>
      <button
        type="button"
        className={`${ui.round} ${word.playing ? styles.playing : ""}`}
        onClick={word.play}
        aria-label={`Écouter ${card.word}`}
      >
        <Icon name="sound" size={20} />
      </button>
      <span className={styles.ipa} lang="fr-Latn-fonipa">
        /{spoken.ipa}/
      </span>
    </p>
  );
}
