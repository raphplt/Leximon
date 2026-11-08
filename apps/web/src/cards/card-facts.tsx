"use client";

import type { CatalogCard } from "@leximon/contract";
import { finderLine, frequencyLine } from "@leximon/view-model";
import { RarityLadder, RarityName } from "@/components/rarity-icon";
import { Icon } from "@/ui/icon";
import ui from "@/ui/ui.module.css";
import styles from "./card-facts.module.css";
import { useFinder } from "./finders";
import { useSpokenWord } from "./use-spoken-word";

/** What anyone can know of a card: its rarity, how it sounds, how rare it is in print. */
export function CardFacts({ card }: { readonly card: CatalogCard }) {
  return (
    <>
      <p className={styles.rarity}>
        <RarityName rarity={card.rarity} />
        <RarityLadder rarity={card.rarity} />
      </p>
      <Pronunciation card={card} />
      <p className={styles.frequency}>{frequencyLine(card.perBillion)}</p>
      <CardFinder cardId={card.id} />
    </>
  );
}

/** The patron who brought the word into the game, signed on the card for every player. */
function CardFinder({ cardId }: { readonly cardId: string }) {
  const finder = useFinder(cardId);
  if (finder === null) return null;
  return (
    <p className={styles.finder}>
      <Icon name="crown" size={18} />
      {finderLine(finder)}
    </p>
  );
}

/** The quote in full: the card face may have to shorten it. */
export function CardQuoteInFull({ card }: { readonly card: CatalogCard }) {
  if (card.quote === null) return null;
  return (
    <figure className={styles.quote}>
      <blockquote className={styles.quoteText}>« {card.quote.text} »</blockquote>
      <figcaption className={styles.quoteAuthor}>{card.quote.author}</figcaption>
    </figure>
  );
}

/** The word's origin, when the card has one. */
export function CardOrigin({ card }: { readonly card: CatalogCard }) {
  if (card.etymology === null) return null;
  return (
    <div className={styles.origin}>
      <p className={ui.kicker}>Origine{card.era !== null ? ` · ${card.era}` : ""}</p>
      <p className={styles.etymology}>{card.etymology}</p>
    </div>
  );
}

/** The word spoken by the catalogue's voice, with its phonetic notation. */
function Pronunciation({ card }: { readonly card: CatalogCard }) {
  const word = useSpokenWord(card);
  const spoken = card.pronunciation ?? null;
  if (spoken === null) return null;
  return (
    <p className={styles.spoken}>
      <button
        type="button"
        className={ui.round}
        onClick={word.play}
        aria-label={`Écouter ${card.word}`}
      >
        <Icon name="play" size={20} />
      </button>
      <span className={styles.ipa} lang="fr-Latn-fonipa">
        /{spoken.ipa}/
      </span>
    </p>
  );
}
