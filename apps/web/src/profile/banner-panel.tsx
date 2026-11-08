"use client";

import type { ProfileResponse } from "@leximon/contract";
import type { EpochMs } from "@leximon/core";
import { bannerTint } from "@leximon/tokens";
import {
  type Appearance,
  BANNER_BUY_ACTION,
  BANNER_BUY_BUSY,
  BANNER_BUY_CANCEL,
  BANNER_BUY_FAILED,
  BANNER_MOTIFS_TITLE,
  BANNER_TINTS_TITLE,
  bannerCanBuy,
  bannerItems,
  bannerPurchaseConfirm,
  bannerPurchaseRefusalMessage,
  bannerStateLabel,
  bannerTintItems,
  draftItems,
  ecusLabel,
} from "@leximon/view-model";
import { useState } from "react";
import { play } from "@/booster/feedback";
import { ProfileBanner } from "@/components/profile-banner";
import { buyBanner } from "@/player/ecus";
import { wallet } from "@/player/player";
import { useShared } from "@/player/resource";
import { Button } from "@/ui/button";
import { Icon } from "@/ui/icon";
import { useToast } from "@/ui/toast";
import styles from "./banner-panel.module.css";
import { LockSeal } from "./lock-seal";
import profileStyles from "./profile.module.css";

const STATE_CLASS = {
  worn: profileStyles.worn,
  owned: profileStyles.owned,
  for_sale: profileStyles.closed,
  locked: profileStyles.closed,
} as const;

/** The banner tab of the atelier: the tint of the draft, then its motif, any of them tried on. */
export function BannerPanel({
  me,
  now,
  look,
  onLook,
}: {
  readonly me: ProfileResponse;
  readonly now: EpochMs;
  readonly look: Appearance;
  readonly onLook: (next: Appearance) => void;
}) {
  const tints = bannerTintItems(
    { banner: { motif: look.bannerMotif, tint: look.bannerTint } },
    now,
  );
  const motifs = draftItems(bannerItems(me, now), (item) => item.motif === look.bannerMotif);

  return (
    <div id="atelier-items" role="tabpanel" aria-labelledby="tab-banners" className={styles.panel}>
      <h2 className={styles.heading}>{BANNER_TINTS_TITLE}</h2>
      <ul className={styles.tints}>
        {tints.map((item) => (
          <li key={item.tint}>
            <button
              type="button"
              className={styles.tint}
              style={{ background: bannerTint(item.tint) }}
              aria-pressed={item.worn}
              aria-label={item.name}
              title={item.name}
              onClick={() => onLook({ ...look, bannerTint: item.tint })}
            >
              {item.worn && <Icon name="check" size={18} />}
            </button>
          </li>
        ))}
      </ul>
      <h2 className={styles.heading}>{BANNER_MOTIFS_TITLE}</h2>
      <ul className={profileStyles.items}>
        {motifs.map((item) => {
          const locked = item.state === "locked";
          return (
            <li key={item.motif}>
              <button
                type="button"
                className={[
                  profileStyles.item,
                  locked ? profileStyles.itemLocked : "",
                  item.chosen && item.state !== "worn" ? profileStyles.itemTrying : "",
                ].join(" ")}
                aria-pressed={item.chosen}
                onClick={() => onLook({ ...look, bannerMotif: item.motif })}
              >
                <span className={`${profileStyles.itemArt} ${styles.swatchArt}`}>
                  <ProfileBanner
                    banner={{ motif: item.motif, tint: look.bannerTint }}
                    className={styles.swatch}
                  />
                  {locked && <LockSeal />}
                </span>
                <span className={profileStyles.itemName}>{item.name}</span>
                <span className={`${profileStyles.itemState} ${STATE_CLASS[item.state]}`}>
                  {item.state === "worn" && <Icon name="check" size={14} />}{" "}
                  {bannerStateLabel(item)}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** A motif for sale on the cloth of the draft, its price, and what is left after. */
export function BuyBanner({
  motif,
  name,
  price,
  tint,
  onDone,
}: {
  readonly motif: string;
  readonly name: string;
  readonly price: number;
  readonly tint: string;
  readonly onDone: (bought: boolean) => void;
}) {
  const toast = useToast();
  const purse = useShared(wallet);
  const [busy, setBusy] = useState(false);
  const ecus = purse?.ecus ?? 0;
  const canBuy = purse !== null && bannerCanBuy(price, ecus);

  const buy = () => {
    setBusy(true);
    buyBanner(motif)
      .then((result) => {
        if (result.kind === "refused") {
          toast(bannerPurchaseRefusalMessage(result.reason));
          onDone(false);
          return;
        }
        play("coins");
        onDone(true);
      })
      .catch(() => toast(BANNER_BUY_FAILED))
      .finally(() => setBusy(false));
  };

  return (
    <div className={styles.buy}>
      <ProfileBanner banner={{ motif, tint }} className={styles.buyCloth} />
      {purse !== null && (
        <>
          <p className={styles.balance}>Tu as {ecusLabel(ecus)}.</p>
          <p>{bannerPurchaseConfirm(name, price, ecus)}</p>
        </>
      )}
      <div className={styles.buttons}>
        <Button disabled={busy || !canBuy} onClick={buy}>
          {busy ? BANNER_BUY_BUSY : BANNER_BUY_ACTION}
        </Button>
        <Button variant="ghost" onClick={() => onDone(false)}>
          {BANNER_BUY_CANCEL}
        </Button>
      </div>
    </div>
  );
}
