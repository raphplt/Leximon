"use client";

import type { BoosterWalletResponse } from "@leximon/contract";
import {
  ecuRules,
  ecusLabel,
  ecusPanel,
  MISSING_WORD_OPEN,
  RECYCLE_RULE,
} from "@leximon/view-model";
import { useShell } from "@/shell/shell-context";
import styles from "@/shell/stock-detail.module.css";
import { Button } from "@/ui/button";
import { ToyIcon } from "@/ui/toy";
import { RecycleButton } from "./recycle-button";

/** What the écus chip opens: the balance, how écus are won and spent, and both actions. */
export function EcusDetail({
  wallet,
  now,
  onClose,
}: {
  readonly wallet: BoosterWalletResponse;
  readonly now: number;
  readonly onClose: () => void;
}) {
  const { openMissingWord } = useShell();
  const [rule, gains, prices] = ecusPanel(ecuRules(now));
  return (
    <div className={styles.detail}>
      <div className={styles.line}>
        <ToyIcon name="ecu" size={42} />
        <p className={styles.lineText}>
          <strong className={styles.headline}>{ecusLabel(wallet.ecus)}</strong>
          <span className={styles.muted}>{rule}</span>
        </p>
      </div>
      <div className={styles.notes}>
        <p>{gains}</p>
        <p>{prices}</p>
        <p className={styles.muted}>{RECYCLE_RULE}</p>
      </div>
      <RecycleButton wide />
      <Button
        variant="primary"
        wide
        onClick={() => {
          onClose();
          openMissingWord();
        }}
      >
        {MISSING_WORD_OPEN}
      </Button>
    </div>
  );
}
