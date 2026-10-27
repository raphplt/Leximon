"use client";

import type { BoosterWalletResponse } from "@leximon/contract";
import { reserveView } from "@leximon/view-model";
import { ButtonLink } from "@/ui/button";
import { Dialog } from "@/ui/dialog";
import { Icon } from "@/ui/icon";
import ui from "@/ui/ui.module.css";
import styles from "./reserve-dialog.module.css";

/** The reserve of bonus sachets, opened from the top bar's gold chip. */
export function ReserveDialog({
  wallet,
  open,
  onClose,
}: {
  readonly wallet: BoosterWalletResponse;
  readonly open: boolean;
  readonly onClose: () => void;
}) {
  const reserve = reserveView(wallet);
  return (
    <Dialog open={open} title="Ta réserve de sachets bonus" onClose={onClose} variant="center">
      <div className={styles.reserve}>
        <span className={styles.sachet} aria-hidden="true">
          <Icon name="sachet" size={34} />
        </span>
        <p className={`${ui.display} ${styles.headline}`}>{reserve.headline}</p>
        {reserve.garni !== null && <p className={styles.garni}>{reserve.garni}</p>}
        <p className={styles.places}>{reserve.places}</p>
        <p>{reserve.rule}</p>
        <p className={styles.sources}>{reserve.sources}</p>
        {reserve.openNow && (
          <ButtonLink href="/jouer" wide onClick={onClose}>
            Ouvrir un sachet bonus
          </ButtonLink>
        )}
      </div>
    </Dialog>
  );
}
