"use client";

import type { BoosterWalletResponse } from "@leximon/contract";
import {
  ecuRules,
  ecusLabel,
  ecusTable,
  MISSING_WORD_OPEN,
  RECYCLE_RULE,
} from "@leximon/view-model";
import { RarityName } from "@/components/rarity-icon";
import { useShell } from "@/shell/shell-context";
import { Button } from "@/ui/button";
import { HelpTip } from "@/ui/help-tip";
import { Icon } from "@/ui/icon";
import { ToyIcon } from "@/ui/toy";
import styles from "./ecus-detail.module.css";
import { RecycleButton } from "./recycle-button";

/** What the écus chip opens: the balance, where écus come from and what they buy, and both actions. */
export function EcusDetail({
  wallet,
  now,
  collectionId,
  onClose,
}: {
  readonly wallet: BoosterWalletResponse;
  readonly now: number;
  /** The collection the missing word is first looked for in, when opened from one. */
  readonly collectionId?: string | undefined;
  readonly onClose: () => void;
}) {
  const { openMissingWord } = useShell();
  const table = ecusTable(ecuRules(now));
  const [doubles, ecus, missing] = table.flow;
  return (
    <div className={styles.detail}>
      <p className={styles.balance}>
        <ToyIcon name="ecu" size={40} />
        {ecusLabel(wallet.ecus)}
      </p>

      <ol className={styles.flow}>
        <li className={styles.step}>
          <span className={styles.pair} aria-hidden="true">
            <span className={styles.mini} />
            <span className={styles.mini} />
          </span>
          {doubles}
        </li>
        <li className={styles.arrow} aria-hidden="true">
          <Icon name="chev" size={18} />
        </li>
        <li className={styles.step}>
          <ToyIcon name="ecu" size={36} />
          {ecus}
        </li>
        <li className={styles.arrow} aria-hidden="true">
          <Icon name="chev" size={18} />
        </li>
        <li className={styles.step}>
          <span className={`${styles.mini} ${styles.missing}`} aria-hidden="true">
            ?
          </span>
          {missing}
        </li>
      </ol>

      <table className={styles.table}>
        <thead>
          <tr>
            <td />
            <th scope="col">
              <span className={styles.column}>
                {table.gainColumn}
                <HelpTip label="Le recyclage, la règle" side="above">
                  <p>{RECYCLE_RULE}</p>
                </HelpTip>
              </span>
            </th>
            <th scope="col">{table.priceColumn}</th>
          </tr>
        </thead>
        <tbody>
          {table.rows.map((row) => (
            <tr key={row.rarity}>
              <th scope="row">
                <RarityName rarity={row.rarity} />
              </th>
              <td>
                <span className={styles.gain}>
                  <span className={styles.rowArrow} aria-hidden="true">
                    <Icon name="chev" size={14} />
                  </span>
                  {row.gain}
                  <ToyIcon name="ecu" size={18} />
                </span>
              </td>
              <td>
                <span className={styles.price}>
                  {row.price}
                  <ToyIcon name="ecu" size={18} />
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className={styles.actions}>
        <RecycleButton wide onOpen={onClose} />
        <Button
          variant="primary"
          wide
          onClick={() => {
            onClose();
            openMissingWord(collectionId);
          }}
        >
          {MISSING_WORD_OPEN}
        </Button>
      </div>
    </div>
  );
}
