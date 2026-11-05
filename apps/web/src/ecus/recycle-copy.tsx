"use client";

import type { Rarity } from "@leximon/core";
import {
  ecuRules,
  RECYCLE_BUSY,
  RECYCLE_COPY_CONFIRM_ACTION,
  RECYCLE_COPY_KEEP,
  RECYCLE_FAILED,
  recycleCopyAction,
  recycleCopyConfirm,
  recycleCopyNeedsConfirm,
  recycledToast,
  recycleRefusalMessage,
} from "@leximon/view-model";
import { useState } from "react";
import { play } from "@/booster/feedback";
import { recycleCopyOf } from "@/player/ecus";
import { Button } from "@/ui/button";
import { useToast } from "@/ui/toast";
import { ToyIcon } from "@/ui/toy";
import ui from "@/ui/ui.module.css";
import styles from "./recycle-copy.module.css";

/**
 * On a card's sheet: one double into écus, whatever the rarity. The rarest cards, never recycled
 * in bulk, ask once more.
 */
export function RecycleCopy({
  cardId,
  rarity,
  quantity,
}: {
  readonly cardId: string;
  readonly rarity: Rarity;
  readonly quantity: number;
}) {
  const toast = useToast();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const rules = ecuRules(Date.now());
  const label = recycleCopyAction(rules, rarity, quantity);
  if (label === null) return null;

  const recycle = () => {
    setBusy(true);
    recycleCopyOf(cardId)
      .then((result) => {
        if (result.kind === "refused") {
          toast(recycleRefusalMessage(result.reason));
          return;
        }
        play("coins");
        toast(recycledToast(result));
      })
      .catch(() => toast(RECYCLE_FAILED))
      .finally(() => {
        setBusy(false);
        setConfirming(false);
      });
  };

  if (confirming) {
    return (
      <div className={styles.confirm}>
        <p className={styles.text}>{recycleCopyConfirm(rules, rarity, quantity)}</p>
        <div className={styles.buttons}>
          <Button small disabled={busy} onClick={recycle}>
            {busy ? RECYCLE_BUSY : RECYCLE_COPY_CONFIRM_ACTION}
          </Button>
          <Button small variant="ghost" onClick={() => setConfirming(false)}>
            {RECYCLE_COPY_KEEP}
          </Button>
        </div>
      </div>
    );
  }
  return (
    <button
      type="button"
      className={ui.ghost}
      disabled={busy}
      onClick={() => (recycleCopyNeedsConfirm(rules, rarity) ? setConfirming(true) : recycle())}
    >
      <ToyIcon name="ecu" size={18} />
      {busy ? RECYCLE_BUSY : label}
    </button>
  );
}
