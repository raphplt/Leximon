"use client";

import type { ProfileResponse } from "@leximon/contract";
import type { EpochMs } from "@leximon/core";
import { bannerTint } from "@leximon/tokens";
import {
  BANNER_BOUGHT_TOAST,
  BANNER_BUY_ACTION,
  BANNER_BUY_BUSY,
  BANNER_BUY_CANCEL,
  BANNER_BUY_FAILED,
  BANNER_MOTIFS_TITLE,
  BANNER_TINTS_TITLE,
  type BannerItem,
  bannerCanBuy,
  bannerItems,
  bannerLockedToast,
  bannerPurchaseConfirm,
  bannerPurchaseRefusalMessage,
  bannerStateLabel,
  bannerTintItems,
  ecusLabel,
  wornToast,
} from "@leximon/view-model";
import { useState } from "react";
import { play } from "@/booster/feedback";
import { ProfileBanner } from "@/components/profile-banner";
import { buyBanner } from "@/player/ecus";
import { wallet } from "@/player/player";
import { useShared } from "@/player/resource";
import { Button } from "@/ui/button";
import { Dialog } from "@/ui/dialog";
import { Icon } from "@/ui/icon";
import { useToast } from "@/ui/toast";
import styles from "./banner-panel.module.css";
import profileStyles from "./profile.module.css";
import type { useProfileActions } from "./use-profile-actions";

const STATE_CLASS = {
  worn: profileStyles.worn,
  owned: profileStyles.owned,
  for_sale: profileStyles.closed,
  locked: profileStyles.closed,
} as const;

/** The banner tab of the atelier: the cloth worn, its tint, then the motifs. */
export function BannerPanel({
  me,
  now,
  actions,
}: {
  readonly me: ProfileResponse;
  readonly now: EpochMs;
  readonly actions: ReturnType<typeof useProfileActions>;
}) {
  const toast = useToast();
  const [buying, setBuying] = useState<BannerItem | null>(null);
  const tints = bannerTintItems(me, now);
  const motifs = bannerItems(me, now);

  const chooseMotif = (item: BannerItem) => {
    if (item.state === "worn") return;
    if (item.state === "for_sale") setBuying(item);
    else if (item.state === "locked") toast(bannerLockedToast(item.source));
    else void actions.update({ bannerMotif: item.motif }, { success: wornToast("banners") });
  };

  return (
    <div id="atelier-items" role="tabpanel" aria-labelledby="tab-banners" className={styles.panel}>
      <div className={styles.preview}>
        <ProfileBanner banner={me.banner} className={styles.previewCloth} />
      </div>
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
              disabled={actions.busy}
              onClick={() => {
                if (item.worn) return;
                void actions.update({ bannerTint: item.tint }, { success: wornToast("banners") });
              }}
            >
              {item.worn && <Icon name="check" size={18} />}
            </button>
          </li>
        ))}
      </ul>
      <h2 className={styles.heading}>{BANNER_MOTIFS_TITLE}</h2>
      <ul className={profileStyles.items}>
        {motifs.map((item) => {
          const closed = item.state === "locked" || item.state === "for_sale";
          return (
            <li key={item.motif}>
              <button
                type="button"
                className={`${profileStyles.item} ${item.state === "locked" ? profileStyles.itemLocked : ""}`}
                aria-pressed={item.state === "worn"}
                aria-disabled={closed ? true : undefined}
                disabled={actions.busy}
                onClick={() => chooseMotif(item)}
              >
                <ProfileBanner
                  banner={{ motif: item.motif, tint: me.banner.tint }}
                  className={styles.swatch}
                />
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
      <Dialog
        open={buying !== null}
        title={buying?.name ?? ""}
        onClose={() => setBuying(null)}
        variant="center"
      >
        {buying !== null && (
          <BuyBanner
            item={buying}
            tint={me.banner.tint}
            onDone={(bought) => {
              setBuying(null);
              if (bought) {
                void actions.update(
                  { bannerMotif: bought.motif },
                  { success: BANNER_BOUGHT_TOAST },
                );
              }
            }}
          />
        )}
      </Dialog>
    </div>
  );
}

/** The motif on the cloth worn, its price, and what is left after. */
function BuyBanner({
  item,
  tint,
  onDone,
}: {
  readonly item: BannerItem;
  readonly tint: string;
  readonly onDone: (bought: BannerItem | null) => void;
}) {
  const toast = useToast();
  const purse = useShared(wallet);
  const [busy, setBusy] = useState(false);
  const price = item.source.kind === "ecus" ? item.source.price : 0;
  const ecus = purse?.ecus ?? 0;
  const canBuy = purse !== null && bannerCanBuy(price, ecus);

  const buy = () => {
    setBusy(true);
    buyBanner(item.motif)
      .then((result) => {
        if (result.kind === "refused") {
          toast(bannerPurchaseRefusalMessage(result.reason));
          onDone(null);
          return;
        }
        play("coins");
        onDone(item);
      })
      .catch(() => toast(BANNER_BUY_FAILED))
      .finally(() => setBusy(false));
  };

  return (
    <div className={styles.buy}>
      <ProfileBanner banner={{ motif: item.motif, tint }} className={styles.buyCloth} />
      {purse !== null && (
        <>
          <p className={styles.balance}>Tu as {ecusLabel(ecus)}.</p>
          <p>{bannerPurchaseConfirm(item.name, price, ecus)}</p>
        </>
      )}
      <div className={styles.buttons}>
        <Button disabled={busy || !canBuy} onClick={buy}>
          {busy ? BANNER_BUY_BUSY : BANNER_BUY_ACTION}
        </Button>
        <Button variant="ghost" onClick={() => onDone(null)}>
          {BANNER_BUY_CANCEL}
        </Button>
      </div>
    </div>
  );
}
