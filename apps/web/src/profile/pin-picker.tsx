"use client";

import { RARITY_LABELS } from "@leximon/contract";
import { collectionName } from "@leximon/contract/client";
import { fullPinsLine, morePinsLine, PIN_TEXTS, pinCandidates } from "@leximon/view-model";
import { useEffect, useMemo, useState } from "react";
import { useCatalog } from "@/cards/use-catalog";
import { Card } from "@/components/card";
import { RarityName } from "@/components/rarity-icon";
import { ownedCards } from "@/player/collection";
import { useShared } from "@/player/resource";
import { Dialog } from "@/ui/dialog";
import { Icon } from "@/ui/icon";
import styles from "./pin-picker.module.css";

/**
 * Which card goes in a place of the profile: the player's cards, rarest first, with a search.
 * Those already pinned stay listed, greyed, so the player sees what is already shown.
 */
export function PinPicker({
  open,
  title,
  pinned,
  onPick,
  onClose,
}: {
  readonly open: boolean;
  readonly title: string;
  readonly pinned: readonly string[];
  readonly onPick: (cardId: string) => void;
  readonly onClose: () => void;
}) {
  const catalog = useCatalog();
  const owned = useShared(ownedCards);
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (open) {
      setSearch("");
      ownedCards.ensure();
    }
  }, [open]);

  const list = useMemo(
    () =>
      catalog === null || owned === null
        ? null
        : pinCandidates(catalog.cardsById.values(), owned, pinned, search),
    [catalog, owned, pinned, search],
  );

  return (
    <Dialog open={open} title={title} onClose={onClose} variant="center">
      <div className={styles.picker}>
        <label className={styles.search}>
          <Icon name="search" size={18} />
          <input
            type="search"
            placeholder={PIN_TEXTS.search}
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </label>
        {list === null ? (
          <p className={styles.note}>Chargement de tes cartes…</p>
        ) : list.items.length === 0 ? (
          <p className={styles.note}>{search === "" ? PIN_TEXTS.noCards : PIN_TEXTS.noMatch}</p>
        ) : (
          <ul className={styles.list}>
            {list.items.map((item) => (
              <li key={item.cardId}>
                <button
                  type="button"
                  className={styles.row}
                  disabled={item.pinned}
                  onClick={() => onPick(item.cardId)}
                  aria-label={`${item.word}, ${RARITY_LABELS[item.rarity]}${
                    item.pinned ? `, ${PIN_TEXTS.alreadyPinned.toLowerCase()}` : ""
                  }`}
                >
                  <span className={styles.word}>{item.word}</span>
                  {item.pinned ? (
                    <span className={styles.already}>
                      <Icon name="pin" size={14} />
                      {PIN_TEXTS.alreadyPinned}
                    </span>
                  ) : (
                    <span className={styles.rarity}>
                      <RarityName rarity={item.rarity} />
                    </span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        )}
        {list !== null && list.more > 0 && <p className={styles.note}>{morePinsLine(list.more)}</p>}
      </div>
    </Dialog>
  );
}

/**
 * Pinning from a card's sheet with every place taken: the pinned cards, and a touch on one
 * puts the new card in its place.
 */
export function ReplacePin({
  open,
  word,
  pinned,
  onPick,
  onClose,
}: {
  readonly open: boolean;
  readonly word: string;
  readonly pinned: readonly string[];
  readonly onPick: (index: number) => void;
  readonly onClose: () => void;
}) {
  const catalog = useCatalog();
  return (
    <Dialog open={open} title={PIN_TEXTS.fullTitle} onClose={onClose} variant="center">
      <div className={styles.picker}>
        <p className={styles.lead}>{fullPinsLine(word)}</p>
        <ul className={styles.faces}>
          {pinned.map((cardId, index) => {
            const card = catalog?.cardsById.get(cardId);
            return (
              <li key={cardId}>
                <button
                  type="button"
                  className={styles.face}
                  onClick={() => onPick(index)}
                  aria-label={`Remplacer ${card?.word ?? "cette carte"}`}
                >
                  {card === undefined || catalog === null ? (
                    <span className={styles.facePlaceholder} />
                  ) : (
                    <Card
                      card={card}
                      collectionName={collectionName(catalog, card.collectionId)}
                      width={112}
                    />
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </Dialog>
  );
}
