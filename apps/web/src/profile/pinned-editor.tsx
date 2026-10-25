"use client";

import { collectionName } from "@leximon/contract/client";
import {
  movePin,
  PIN_TEXTS,
  pinnedSlotsLabel,
  placePin,
  replaceTitle,
  unpin,
} from "@leximon/view-model";
import { type RefObject, useEffect, useRef, useState } from "react";
import { useCatalog } from "@/cards/use-catalog";
import { Card } from "@/components/card";
import { useNarrow } from "@/lib/use-narrow";
import { Icon } from "@/ui/icon";
import ui from "@/ui/ui.module.css";
import { PinPicker } from "./pin-picker";
import styles from "./profile.module.css";
import { useProfileActions } from "./use-profile-actions";

/**
 * The player's own pinned cards, arranged in place: an empty place opens the picker, each card
 * moves earlier or later, changes for another or leaves by the cross on its corner. A touch on the card opens its sheet.
 */
export function PinnedCardsEditor({
  pinned,
  slots,
  onOpen,
}: {
  readonly pinned: readonly string[];
  readonly slots: number;
  readonly onOpen: (cardId: string) => void;
}) {
  const catalog = useCatalog();
  const narrow = useNarrow();
  const actions = useProfileActions();
  /** The place being filled: an index replaces its card, `null` takes a free place. */
  const [picking, setPicking] = useState<{ readonly at: number | null } | null>(null);
  const list = useRef<HTMLUListElement>(null);
  const refocus = useRefocus(list, pinned);
  const empty = Math.max(0, slots - pinned.length);
  const wordOf = (cardId: string | undefined) =>
    (cardId === undefined ? undefined : catalog?.cardsById.get(cardId)?.word) ?? "cette carte";

  const place = (cardId: string) => {
    const at = picking?.at ?? null;
    setPicking(null);
    const change = placePin(pinned, slots, cardId, at);
    refocus(null);
    if (change.ok) {
      void actions.setPins(change.cardIds, at === null ? PIN_TEXTS.pinned : PIN_TEXTS.replaced);
    }
  };

  return (
    <section className={`${ui.panel} ${styles.panel}`} aria-labelledby="pinned-title">
      <div className={styles.panelHead}>
        <h2 id="pinned-title" className={`${ui.display} ${styles.panelTitle}`}>
          Cartes épinglées
        </h2>
        <span className={styles.panelMeta}>{pinnedSlotsLabel(slots)}</span>
      </div>
      <ul ref={list} className={styles.pins}>
        {pinned.map((cardId, index) => {
          const card = catalog?.cardsById.get(cardId);
          const word = wordOf(cardId);
          return (
            <li key={cardId} className={styles.pin}>
              <button
                type="button"
                className={styles.pinButton}
                onClick={() => onOpen(cardId)}
                aria-label={`Ouvrir ${word}`}
              >
                {card === undefined || catalog === null ? (
                  <span className={styles.pinPlaceholder} />
                ) : (
                  <Card
                    card={card}
                    collectionName={collectionName(catalog, card.collectionId)}
                    width={narrow ? 130 : 150}
                  />
                )}
              </button>
              <button
                type="button"
                className={styles.pinRemove}
                onClick={() => {
                  refocus(["empty", "empty"]);
                  void actions.setPins(unpin(pinned, cardId), PIN_TEXTS.removed);
                }}
                aria-label={`${PIN_TEXTS.remove} ${word}`}
                title={PIN_TEXTS.remove}
              >
                <Icon name="close" size={14} />
              </button>
              <div className={styles.pinTools}>
                <button
                  type="button"
                  className={styles.pinTool}
                  disabled={index === 0}
                  data-pin-tool={`${cardId} earlier`}
                  onClick={() => {
                    refocus([`${cardId} earlier`, `${cardId} later`]);
                    void actions.setPins(movePin(pinned, index, -1), null);
                  }}
                  aria-label={`${PIN_TEXTS.earlier} ${word}`}
                  title={PIN_TEXTS.earlier}
                >
                  <Icon name="back" size={16} />
                </button>
                <button
                  type="button"
                  className={`${styles.pinTool} ${styles.pinToolText}`}
                  onClick={() => setPicking({ at: index })}
                  aria-label={`${PIN_TEXTS.change} ${word}`}
                >
                  {PIN_TEXTS.change}
                </button>
                <button
                  type="button"
                  className={styles.pinTool}
                  disabled={index === pinned.length - 1}
                  data-pin-tool={`${cardId} later`}
                  onClick={() => {
                    refocus([`${cardId} later`, `${cardId} earlier`]);
                    void actions.setPins(movePin(pinned, index, 1), null);
                  }}
                  aria-label={`${PIN_TEXTS.later} ${word}`}
                  title={PIN_TEXTS.later}
                >
                  <Icon name="chev" size={16} />
                </button>
              </div>
            </li>
          );
        })}
        {Array.from({ length: empty }, (_, index) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: empty places have no identity
          <li key={`empty-${index}`} className={styles.pin}>
            <button
              type="button"
              className={styles.emptySlot}
              data-pin-tool="empty"
              onClick={() => setPicking({ at: null })}
            >
              <Icon name="plus" size={24} />
              <span>{PIN_TEXTS.emptySlot}</span>
            </button>
          </li>
        ))}
      </ul>
      <PinPicker
        open={picking !== null}
        title={
          picking === null || picking.at === null
            ? PIN_TEXTS.pickerTitle
            : replaceTitle(wordOf(pinned[picking.at]))
        }
        pinned={pinned}
        onPick={place}
        onClose={() => setPicking(null)}
      />
    </section>
  );
}

/**
 * Gives the focus back after a change, once the new order shows: to the same arrow on the card
 * that moved, or to the other one when the card reached the end of the row, or to the first free
 * place after a removal. Without it, the focus falls back to the page at each move.
 */
function useRefocus(list: RefObject<HTMLUListElement | null>, pinned: readonly string[]) {
  const target = useRef<readonly [string, string] | null>(null);
  // biome-ignore lint/correctness/useExhaustiveDependencies: runs once the pinned cards change
  useEffect(() => {
    const wanted = target.current;
    if (wanted === null) return;
    target.current = null;
    const tool = (name: string) =>
      list.current?.querySelector<HTMLButtonElement>(`[data-pin-tool="${CSS.escape(name)}"]`);
    const [first, second] = wanted;
    const button = tool(first);
    (button?.disabled === false ? button : tool(second))?.focus();
  }, [pinned]);
  return (tools: readonly [string, string] | null) => {
    target.current = tools;
  };
}
