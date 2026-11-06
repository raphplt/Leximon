"use client";

import type { BoosterWalletResponse } from "@leximon/contract";
import { cssFill, rarityStyles } from "@leximon/tokens";
import { sachetsPanel, stockView } from "@leximon/view-model";
import type { CSSProperties } from "react";
import { RarityIcon } from "@/components/rarity-icon";
import { ButtonLink } from "@/ui/button";
import { HelpTip } from "@/ui/help-tip";
import { Icon } from "@/ui/icon";
import { ToyIcon } from "@/ui/toy";
import styles from "./stock-detail.module.css";

const GARNI_BADGE = {
  background: cssFill(rarityStyles.rare.band),
  color: rarityStyles.rare.bandInk,
} as CSSProperties;

function slotsOf(count: number): CSSProperties {
  return { "--slots": String(count) } as CSSProperties;
}

/** What the stock chip opens: the free sachets and the reserve as rows on their shelves. */
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
  const { free, reserve, sourcesTitle, sources } = sachetsPanel(wallet, now);
  return (
    <div className={styles.detail}>
      <section className={styles.shelf} aria-label={`${free.title}, ${free.figure}`}>
        <header className={styles.head}>
          <span className={styles.title}>{free.title}</span>
          <strong className={styles.figure}>{free.figure}</strong>
        </header>
        <div className={styles.slots} style={slotsOf(free.slots)} aria-hidden="true">
          {Array.from({ length: free.slots }, (_, index) => {
            const filled = index < free.filled;
            const next = index === free.filled && free.refill !== null;
            return (
              <span
                // biome-ignore lint/suspicious/noArrayIndexKey: the slots of a row never move
                key={index}
                className={`${styles.slot} ${filled ? styles.filled : styles.empty}`}
                style={
                  next ? ({ "--refill": String(free.refill ?? 0) } as CSSProperties) : undefined
                }
                data-next={next || undefined}
              >
                {filled && <ToyIcon name="sachet" size={28} />}
              </span>
            );
          })}
        </div>
        <span className={styles.ledge} aria-hidden="true" />
        <p className={free.refill === null ? styles.full : styles.note}>
          {free.refill !== null && <Icon name="clock" size={16} />}
          {free.note}
        </p>
      </section>

      <section className={styles.shelf} aria-label={`${reserve.title}, ${reserve.figure}`}>
        <header className={styles.head}>
          <span className={styles.title}>{reserve.title}</span>
          <HelpTip label={`${reserve.title}, la règle`} title={reserve.title}>
            <p>{reserve.help}</p>
          </HelpTip>
          <strong className={styles.figure}>{reserve.figure}</strong>
        </header>
        <div
          className={`${styles.slots} ${styles.small}`}
          style={slotsOf(reserve.slots)}
          aria-hidden="true"
        >
          {Array.from({ length: reserve.slots }, (_, index) => {
            const filled = index < reserve.filled;
            return (
              <span
                // biome-ignore lint/suspicious/noArrayIndexKey: the slots of a row never move
                key={index}
                className={`${styles.slot} ${filled ? styles.bonus : styles.empty}`}
              >
                {filled && <ToyIcon name="sachet" size={18} />}
                {index < reserve.garni && (
                  <span className={styles.garni} style={GARNI_BADGE}>
                    <RarityIcon rarity="rare" size="10px" />
                  </span>
                )}
              </span>
            );
          })}
        </div>
        <span className={styles.ledge} aria-hidden="true" />
        {reserve.garniLabel !== null && (
          <p className={styles.note}>
            <span className={styles.garniInline} style={GARNI_BADGE} aria-hidden="true">
              <RarityIcon rarity="rare" size="11px" />
            </span>
            {reserve.garniLabel}
          </p>
        )}
      </section>

      <section className={styles.sources}>
        <span className={styles.title}>{sourcesTitle}</span>
        <ul className={styles.sourceList}>
          {sources.map((source) => (
            <li key={source.icon} className={styles.source}>
              <ToyIcon name={source.icon} size={28} />
              {source.label}
            </li>
          ))}
        </ul>
      </section>

      {!stock.empty && (
        <ButtonLink href="/jouer" wide onClick={onClose}>
          {stock.action}
        </ButtonLink>
      )}
    </div>
  );
}
