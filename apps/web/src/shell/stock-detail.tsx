"use client";

import type { BoosterWalletResponse } from "@leximon/contract";
import { reserveView, stockView } from "@leximon/view-model";
import { type ReactNode, type RefObject, useEffect, useRef } from "react";
import { ButtonLink } from "@/ui/button";
import { Icon } from "@/ui/icon";
import ui from "@/ui/ui.module.css";
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

/**
 * The detail under the chip, in the top bar. The bar's blur would hold a fixed scrim to its own
 * height, so a press outside the anchor closes it instead.
 */
export function StockPopover({
  title,
  anchor,
  onClose,
  children,
}: {
  readonly title: string;
  readonly anchor: RefObject<HTMLElement | null>;
  readonly onClose: () => void;
  readonly children: ReactNode;
}) {
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    box.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      onClose();
      anchor.current?.querySelector("button")?.focus();
    };
    const onPress = (event: PointerEvent) => {
      if (event.target instanceof Node && !anchor.current?.contains(event.target)) onClose();
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("pointerdown", onPress);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("pointerdown", onPress);
    };
  }, [anchor, onClose]);

  return (
    <div
      ref={box}
      role="dialog"
      aria-label={title}
      tabIndex={-1}
      className={`${styles.popover} ${ui.enter}`}
    >
      {children}
    </div>
  );
}
