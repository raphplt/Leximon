import type { ProfileResponse } from "@leximon/contract";
import type { EpochMs } from "@leximon/core";
import { bannerTint, toyMatters, toy as toyValues } from "@leximon/tokens";
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
import { Pressable, StyleSheet, Text, View } from "react-native";
import { play } from "@/feedback/feedback";
import { buyBanner } from "@/player/ecus";
import { useShared } from "@/player/shared";
import { wallet } from "@/player/state";
import type { useProfileActions } from "@/profile/profile-actions";
import { fontSizes, fonts, paperColors, radii, space } from "@/theme";
import { Button } from "@/ui/button";
import { Icon } from "@/ui/icon";
import { Paragraph } from "@/ui/page";
import { ProfileBanner } from "@/ui/profile-banner";
import { Sheet } from "@/ui/sheet";
import { toast } from "@/ui/toast";
import { toyFace } from "@/ui/toy";
import { LockSeal, sunkInk, sunkTile } from "./lock-seal";

const GAP = 10;

/** The banner tab of the atelier: the cloth worn, its tint, then the motifs. */
export function BannerPanel({
  me,
  now,
  actions,
  width,
}: {
  readonly me: ProfileResponse;
  readonly now: EpochMs;
  readonly actions: ReturnType<typeof useProfileActions>;
  /** The width of the page's content. */
  readonly width: number;
}) {
  const [buying, setBuying] = useState<BannerItem | null>(null);
  const tints = bannerTintItems(me, now);
  const motifs = bannerItems(me, now);
  const itemWidth = Math.floor((width - GAP) / 2);

  const chooseMotif = (item: BannerItem) => {
    if (item.state === "worn") return;
    if (item.state === "for_sale") setBuying(item);
    else if (item.state === "locked") toast(bannerLockedToast(item.source));
    else void actions.update({ bannerMotif: item.motif }, { success: wornToast("banners") });
  };

  return (
    <View style={styles.panel}>
      <ProfileBanner banner={me.banner} style={styles.preview} />
      <Text style={styles.heading}>{BANNER_TINTS_TITLE}</Text>
      <View style={styles.tints}>
        {tints.map((item) => (
          <Pressable
            key={item.tint}
            disabled={actions.busy}
            onPress={() => {
              if (item.worn) return;
              void actions.update({ bannerTint: item.tint }, { success: wornToast("banners") });
            }}
            accessibilityRole="button"
            accessibilityLabel={item.name}
            accessibilityState={{ selected: item.worn }}
            style={({ pressed }) => [
              styles.tint,
              { backgroundColor: bannerTint(item.tint) },
              item.worn && styles.tintWorn,
              pressed && styles.pressed,
            ]}
          >
            {item.worn && <Icon name="check" size={18} color={toyMatters.gold.top} />}
          </Pressable>
        ))}
      </View>
      <Text style={styles.heading}>{BANNER_MOTIFS_TITLE}</Text>
      <View style={styles.grid}>
        {motifs.map((item) => {
          const worn = item.state === "worn";
          const locked = item.state === "locked";
          return (
            <Pressable
              key={item.motif}
              disabled={actions.busy}
              onPress={() => chooseMotif(item)}
              accessibilityRole="button"
              accessibilityState={{ selected: worn }}
              accessibilityLabel={`${item.name}, ${bannerStateLabel(item)}`}
              style={({ pressed }) => [
                styles.item,
                { width: itemWidth },
                locked ? sunkTile : toyFace(worn ? "gold" : "paper", "tile"),
                pressed && styles.pressed,
              ]}
            >
              <View style={styles.swatchArt}>
                <ProfileBanner
                  banner={{ motif: item.motif, tint: me.banner.tint }}
                  style={[styles.swatch, locked && styles.locked]}
                />
                {locked && <LockSeal />}
              </View>
              <Text style={[styles.name, locked && styles.sunk]} numberOfLines={1}>
                {item.name}
              </Text>
              <View style={styles.state}>
                {worn && <Icon name="check" size={13} color={toyValues.outline} />}
                <Text
                  style={[
                    styles.stateText,
                    worn && styles.stateWorn,
                    item.state === "owned" && styles.stateOwned,
                    locked && styles.sunk,
                  ]}
                >
                  {bannerStateLabel(item)}
                </Text>
              </View>
            </Pressable>
          );
        })}
      </View>
      <Sheet open={buying !== null} title={buying?.name ?? ""} onClose={() => setBuying(null)}>
        {buying !== null && (
          <BuyBanner
            item={buying}
            tint={me.banner.tint}
            onDone={(bought) => {
              setBuying(null);
              if (bought !== null) {
                void actions.update(
                  { bannerMotif: bought.motif },
                  { success: BANNER_BOUGHT_TOAST },
                );
              }
            }}
          />
        )}
      </Sheet>
    </View>
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
  const purse = useShared(wallet);
  const [busy, setBusy] = useState(false);
  const price = item.source.kind === "ecus" ? item.source.price : 0;
  const ecus = purse?.ecus ?? 0;

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
    <View style={styles.buy}>
      <ProfileBanner banner={{ motif: item.motif, tint }} style={styles.buyCloth} />
      {purse !== null && (
        <>
          <Paragraph>Tu as {ecusLabel(ecus)}.</Paragraph>
          <Paragraph>{bannerPurchaseConfirm(item.name, price, ecus)}</Paragraph>
        </>
      )}
      <Button
        label={busy ? BANNER_BUY_BUSY : BANNER_BUY_ACTION}
        disabled={busy || purse === null || !bannerCanBuy(price, ecus)}
        onPress={buy}
      />
      <Button label={BANNER_BUY_CANCEL} secondary onPress={() => onDone(null)} />
    </View>
  );
}

const cloth = {
  overflow: "hidden",
  borderWidth: toyValues.outlineWidth,
  borderColor: toyValues.outline,
} as const;

const styles = StyleSheet.create({
  panel: { gap: space.s6 },
  preview: { ...cloth, height: 96, borderRadius: radii.lg },
  heading: {
    marginTop: space.s3,
    fontFamily: fonts.ui.extrabold,
    fontSize: fontSizes.caption,
    letterSpacing: 0.8,
    textTransform: "uppercase",
    color: paperColors.pageInkMuted,
  },
  tints: { flexDirection: "row", flexWrap: "wrap", gap: space.s5 },
  tint: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 22,
    borderWidth: toyValues.outlineWidth,
    borderColor: toyValues.outline,
  },
  tintWorn: { borderWidth: 3, borderColor: toyMatters.gold.top },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: GAP },
  item: {
    alignItems: "center",
    gap: space.s3,
    marginBottom: 4,
    padding: space.s4,
    borderRadius: radii.xxl,
  },
  swatch: { ...cloth, height: 56, borderRadius: radii.md },
  swatchArt: { alignSelf: "stretch" },
  locked: { opacity: 0.3 },
  sunk: { color: sunkInk },
  pressed: { opacity: 0.7 },
  name: { fontFamily: fonts.ui.bold, fontSize: fontSizes.small, color: paperColors.pageInk },
  state: { flexDirection: "row", alignItems: "center", gap: space.s2 },
  stateText: {
    fontFamily: fonts.ui.extrabold,
    fontSize: fontSizes.caption,
    color: paperColors.pageInkFaint,
  },
  stateWorn: { color: toyValues.outline },
  stateOwned: { color: paperColors.rubric },
  buy: { gap: space.s5 },
  buyCloth: { ...cloth, height: 88, borderRadius: radii.md },
});
