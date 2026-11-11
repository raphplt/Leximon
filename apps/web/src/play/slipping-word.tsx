"use client";

import { type Catalog, collectionName } from "@leximon/contract/client";
import {
  capitalize,
  OWN_WORD,
  SLIPPING_AWAY,
  SLIPPING_RIDDLE,
  type WordUnderCounter,
} from "@leximon/view-model";
import Link from "next/link";
import { CardBack } from "@/booster/card-back";
import { Card } from "@/components/card";
import { useShell } from "@/shell/shell-context";
import { Button, ButtonLink } from "@/ui/button";
import { Icon } from "@/ui/icon";
import ui from "@/ui/ui.module.css";
import styles from "./play.module.css";

const THUMB_WIDTH = 54;
const COMPACT_THUMB_WIDTH = 38;

/**
 * The word under the counter, with the start of its definition to make the player want the rest.
 * A word slipping away hides itself behind its card back, a riddle its review answers; one of the
 * album's, to read again, shows itself and opens its card. `compact`: a tag beside the button,
 * touched as a whole, without a button of its own.
 */
export function SlippingWord({
  catalog,
  word,
  compact = false,
}: {
  readonly catalog: Catalog;
  readonly word: WordUnderCounter;
  readonly compact?: boolean;
}) {
  const { openCard } = useShell();
  const card = catalog.cardsById.get(word.cardId);
  if (card === undefined) return null;
  const definition = <span className={styles.slippingDefinition}>{card.definition}</span>;
  const thumb = compact ? COMPACT_THUMB_WIDTH : THUMB_WIDTH;
  const frame = `${styles.slipping} ${ui.leaf} ${compact ? styles.slippingCompact : ""}`;
  const go = compact && (
    <span className={styles.slippingGo} aria-hidden="true">
      <Icon name="chev" size={16} />
    </span>
  );

  if (word.kind === "slipping") {
    const review = `/defis?mot=${encodeURIComponent(card.id)}`;
    const tone = catalog.collections.find((c) => c.id === card.collectionId)?.back;
    return (
      <div className={frame}>
        <Link href={review} className={styles.slippingOpen}>
          <span className={styles.slippingCard}>
            <CardBack rarity={card.rarity} width={thumb} tone={tone} />
          </span>
          <span className={styles.slippingBody}>
            <span className={styles.slippingText}>{SLIPPING_RIDDLE}</span>
            {definition}
          </span>
          {go}
        </Link>
        {!compact && (
          <ButtonLink href={review} variant="secondary" small>
            {SLIPPING_AWAY.action}
          </ButtonLink>
        )}
      </div>
    );
  }

  const open = () => openCard(card.id);
  return (
    <div className={frame}>
      <button type="button" className={styles.slippingOpen} onClick={open}>
        <span className={styles.slippingCard}>
          <Card
            card={card}
            collectionName={collectionName(catalog, card.collectionId)}
            width={thumb}
          />
        </span>
        <span className={styles.slippingBody}>
          <span className={ui.kicker}>{OWN_WORD.kicker}</span>
          <span className={styles.slippingText}>
            <em>{capitalize(card.word)}</em>
          </span>
          {definition}
        </span>
        {go}
      </button>
      {!compact && (
        <Button variant="secondary" small onClick={open}>
          {word.fresh ? OWN_WORD.first : OWN_WORD.action}
        </Button>
      )}
    </div>
  );
}
