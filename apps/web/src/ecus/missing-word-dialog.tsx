"use client";

import type { Rarity } from "@leximon/core";
import { cssFill, rarityStyles } from "@leximon/tokens";
import {
  ecuRules,
  ecusLabel,
  MISSING_WORD_BUSY,
  MISSING_WORD_FAILED,
  MISSING_WORD_GOT,
  MISSING_WORD_RULE,
  MISSING_WORD_TITLE,
  missingWordAction,
  missingWordBlocked,
  missingWordCollections,
  missingWordLockedLine,
  missingWordOptions,
  missingWordRefusalMessage,
  shortName,
} from "@leximon/view-model";
import { useState } from "react";
import { play } from "@/booster/feedback";
import { useCatalog } from "@/cards/use-catalog";
import { RarityIcon } from "@/components/rarity-icon";
import { ownedCards } from "@/player/collection";
import { buyMissingWord } from "@/player/ecus";
import { wallet } from "@/player/player";
import { useShared } from "@/player/resource";
import { useProgress } from "@/progress/use-progress";
import { useShell } from "@/shell/shell-context";
import { Button } from "@/ui/button";
import { Dialog } from "@/ui/dialog";
import { useToast } from "@/ui/toast";
import ui from "@/ui/ui.module.css";
import styles from "./missing-word-dialog.module.css";

/** Choose a collection and a rarity, see the price, and get a word drawn among the missing ones. */
export function MissingWordDialog({
  open,
  collectionId,
  onClose,
}: {
  readonly open: boolean;
  /** The collection shown first, e.g. the album's tab. */
  readonly collectionId: string | null;
  readonly onClose: () => void;
}) {
  return (
    <Dialog open={open} title={MISSING_WORD_TITLE} onClose={onClose} variant="center">
      {open && <MissingWordChoice collectionId={collectionId} onClose={onClose} />}
    </Dialog>
  );
}

function MissingWordChoice({
  collectionId,
  onClose,
}: {
  readonly collectionId: string | null;
  readonly onClose: () => void;
}) {
  const catalog = useCatalog();
  const owned = useShared(ownedCards);
  const currentWallet = useShared(wallet);
  const progress = useProgress();
  const { openCard } = useShell();
  const toast = useToast();
  const [picked, setPicked] = useState<string | null>(collectionId);
  const [rarity, setRarity] = useState<Rarity | null>(null);
  const [busy, setBusy] = useState(false);
  if (catalog === null || owned === null || currentWallet === null || progress === null) {
    return <p className={styles.rule}>{MISSING_WORD_RULE}</p>;
  }

  const now = Date.now();
  const ecus = currentWallet.ecus;
  const collections = missingWordCollections(catalog.collections, progress.level, now);
  const collection = collections.find((c) => c.id === picked) ?? collections[0];
  if (collection === undefined) return <p className={styles.rule}>{MISSING_WORD_RULE}</p>;
  const options = missingWordOptions(ecuRules(now), collection.cards, owned, ecus);
  const option =
    options.find((o) => o.rarity === rarity) ??
    options.find((o) => o.state === "open") ??
    options.find((o) => o.state === "too_poor") ??
    options[0];
  const blocked = option === undefined ? null : missingWordBlocked(option, ecus);
  const lockedLine = missingWordLockedLine(progress.level, now);

  const buy = () => {
    if (option === undefined) return;
    setBusy(true);
    buyMissingWord({ collectionId: collection.id, rarity: option.rarity })
      .then((result) => {
        if (result.kind === "refused") {
          toast(missingWordRefusalMessage(result.reason));
          return;
        }
        play("newCard");
        toast(MISSING_WORD_GOT);
        onClose();
        openCard(result.cardId);
      })
      .catch(() => toast(MISSING_WORD_FAILED))
      .finally(() => setBusy(false));
  };

  return (
    <div className={styles.choice}>
      <p className={styles.rule}>{MISSING_WORD_RULE}</p>
      <p className={styles.balance}>Tu as {ecusLabel(ecus)}.</p>
      <fieldset className={styles.collections}>
        <legend className={styles.hidden}>Collection</legend>
        {collections.map((c) => (
          <button
            key={c.id}
            type="button"
            className={ui.chip}
            aria-pressed={c.id === collection.id}
            onClick={() => {
              setPicked(c.id);
              setRarity(null);
            }}
          >
            {shortName(c.name)}
          </button>
        ))}
      </fieldset>
      {lockedLine !== null && <p className={styles.muted}>{lockedLine}</p>}
      <ul className={styles.options} aria-label="Rareté">
        {options.map((o) => {
          const style = rarityStyles[o.rarity];
          return (
            <li key={o.rarity}>
              <button
                type="button"
                className={styles.option}
                aria-pressed={o.rarity === option?.rarity}
                disabled={o.state === "complete"}
                onClick={() => setRarity(o.rarity)}
              >
                <span
                  className={styles.gem}
                  style={{ background: cssFill(style.band), color: style.bandInk }}
                  aria-hidden="true"
                >
                  <RarityIcon rarity={o.rarity} size="16px" />
                </span>
                <span className={styles.optionText}>
                  <strong>{o.label}</strong>
                  <span className={styles.muted}>{o.missingLine}</span>
                </span>
                <span className={styles.price}>{o.priceLabel}</span>
              </button>
            </li>
          );
        })}
      </ul>
      {blocked !== null && <p className={styles.blocked}>{blocked}</p>}
      {option !== undefined && (
        <Button wide disabled={busy || blocked !== null} onClick={buy}>
          {busy ? MISSING_WORD_BUSY : missingWordAction(option)}
        </Button>
      )}
    </div>
  );
}
