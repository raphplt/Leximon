"use client";

import {
  capitalize,
  OWN_WORD,
  SLIPPING_AWAY,
  SLIPPING_RIDDLE,
  type WordUnderCounter,
} from "@leximon/view-model";
import Link from "next/link";
import { CardBack } from "@/booster/card-back";
import { type Catalog, collectionName } from "@/cards/catalog";
import { Card } from "@/components/card";
import { useShell } from "@/shell/shell-context";
import { Button, ButtonLink } from "@/ui/button";
import ui from "@/ui/ui.module.css";
import styles from "./play.module.css";

const THUMB_WIDTH = 54;

/**
 * The word under the counter, with the start of its definition to make the player want the rest.
 * A word slipping away hides itself behind its card back, a riddle its review answers; one of the
 * album's, to read again, shows itself and opens its card.
 */
export function SlippingWord({
  catalog,
  word,
}: {
  readonly catalog: Catalog;
  readonly word: WordUnderCounter;
}) {
  const { openCard } = useShell();
  const card = catalog.cardsById.get(word.cardId);
  if (card === undefined) return null;
  const definition = <span className={styles.slippingDefinition}>{card.definition}</span>;

  if (word.kind === "slipping") {
    const review = `/defis?mot=${encodeURIComponent(card.id)}`;
    const tone = catalog.collections.find((c) => c.id === card.collectionId)?.back;
    return (
      <div className={styles.slipping}>
        <Link href={review} className={styles.slippingOpen}>
          <span className={styles.slippingCard}>
            <CardBack rarity={card.rarity} width={THUMB_WIDTH} tone={tone} />
          </span>
          <span className={styles.slippingBody}>
            <span className={styles.slippingText}>{SLIPPING_RIDDLE}</span>
            {definition}
          </span>
        </Link>
        <ButtonLink href={review} variant="secondary" small>
          {SLIPPING_AWAY.action}
        </ButtonLink>
      </div>
    );
  }

  const open = () => openCard(card.id);
  return (
    <div className={styles.slipping}>
      <button type="button" className={styles.slippingOpen} onClick={open}>
        <span className={styles.slippingCard}>
          <Card
            card={card}
            collectionName={collectionName(catalog, card.collectionId)}
            width={THUMB_WIDTH}
          />
        </span>
        <span className={styles.slippingBody}>
          <span className={ui.kicker}>{OWN_WORD.kicker}</span>
          <span className={styles.slippingText}>
            <em>{capitalize(card.word)}</em>
          </span>
          {definition}
        </span>
      </button>
      <Button variant="secondary" small onClick={open}>
        {word.fresh ? OWN_WORD.first : OWN_WORD.action}
      </Button>
    </div>
  );
}
