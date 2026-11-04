"use client";

import type { BoosterWalletResponse } from "@leximon/contract";
import { reserveView, stockView } from "@leximon/view-model";
import { ButtonLink } from "@/ui/button";
import { Icon } from "@/ui/icon";
import styles from "./stock-detail.module.css";

/** What the stock chip opens: the free sachets, then the reserve of bonus ones. */
export function StockDetail({
  wallet,
  now,
  onClose,
}: {
  readonly wallet: BoosterWalletResponse;
  readonly now: number;
  readonly onClose: () => void;
}) {
  const stock = stockView(wallet, now);
  const reserve = reserveView(wallet);
  return (
    <div className={styles.detail}>
      <div className={styles.line}>
        <span className={styles.sachet} aria-hidden="true">
          <Icon name="sachet" size={22} />
        </span>
        <p className={styles.lineText}>
          <strong className={styles.headline}>{stock.count}</strong>
          <span className={styles.muted}>{stock.refillLine}</span>
        </p>
      </div>
      <div className={styles.line}>
        <span className={`${styles.sachet} ${styles.sachetGold}`} aria-hidden="true">
          <Icon name="sachet" size={22} />
        </span>
        <p className={styles.lineText}>
          <strong className={styles.headline}>{reserve.headline}</strong>
          <span className={styles.muted}>{reserve.places}</span>
        </p>
      </div>
      <div className={styles.notes}>
        {reserve.garni !== null && <p className={styles.garni}>{reserve.garni}</p>}
        {reserve.rule !== null && <p>{reserve.rule}</p>}
        <p className={styles.muted}>{reserve.sources}</p>
      </div>
      {!stock.empty && (
        <ButtonLink href="/jouer" wide onClick={onClose}>
          {stock.action}
        </ButtonLink>
      )}
    </div>
  );
}
