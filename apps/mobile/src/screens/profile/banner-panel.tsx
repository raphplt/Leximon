import type { ProfileResponse } from "@leximon/contract";
import type { EpochMs } from "@leximon/core";
import { bannerTint, toyMatters, toy as toyValues } from "@leximon/tokens";
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
import { Pressable, StyleSheet, Text, View } from "react-native";
import { play } from "@/feedback/feedback";
import { buyBanner } from "@/player/ecus";
import { useShared } from "@/player/shared";
import { wallet } from "@/player/state";
import { colors, fontSizes, fonts, paperColors, radii, space } from "@/theme";
import { Button } from "@/ui/button";
import { Icon } from "@/ui/icon";
import { Paragraph } from "@/ui/page";
import { ProfileBanner } from "@/ui/profile-banner";
import { toast } from "@/ui/toast";
import { toyFace } from "@/ui/toy";
import { LockSeal, sunkInk, sunkTile, tryingRing } from "./lock-seal";

const GAP = 10;

/** The banner tab of the atelier: the tint of the draft, then its motif, any of them tried on. */
export function BannerPanel({
  me,
  now,
  look,
  onLook,
  width,
}: {
  readonly me: ProfileResponse;
  readonly now: EpochMs;
  readonly look: Appearance;
  readonly onLook: (next: Appearance) => void;
  /** The width of the page's content. */
  readonly width: number;
}) {
  const tints = bannerTintItems(
    { banner: { motif: look.bannerMotif, tint: look.bannerTint } },
    now,
  );
  const motifs = draftItems(bannerItems(me, now), (item) => item.motif === look.bannerMotif);
  const itemWidth = Math.floor((width - GAP) / 2);

  return (
    <View style={styles.panel}>
      <Text style={styles.heading}>{BANNER_TINTS_TITLE}</Text>
      <View style={styles.tints}>
        {tints.map((item) => (
          <Pressable
            key={item.tint}
            onPress={() => onLook({ ...look, bannerTint: item.tint })}
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
              onPress={() => onLook({ ...look, bannerMotif: item.motif })}
              accessibilityRole="button"
              accessibilityState={{ selected: item.chosen }}
              accessibilityLabel={`${item.name}, ${bannerStateLabel(item)}`}
              style={({ pressed }) => [
                styles.item,
                { width: itemWidth },
                locked ? sunkTile : toyFace(worn ? "gold" : "paper", "tile"),
                item.chosen && !worn && tryingRing,
                pressed && styles.pressed,
              ]}
            >
              <View style={styles.swatchArt}>
                <ProfileBanner
                  banner={{ motif: item.motif, tint: look.bannerTint }}
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
    </View>
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
  const purse = useShared(wallet);
  const [busy, setBusy] = useState(false);
  const ecus = purse?.ecus ?? 0;

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
    <View style={styles.buy}>
      <ProfileBanner banner={{ motif, tint }} style={styles.buyCloth} />
      {purse !== null && (
        <>
          <Paragraph>Tu as {ecusLabel(ecus)}.</Paragraph>
          <Paragraph>{bannerPurchaseConfirm(name, price, ecus)}</Paragraph>
        </>
      )}
      <Button
        label={busy ? BANNER_BUY_BUSY : BANNER_BUY_ACTION}
        disabled={busy || purse === null || !bannerCanBuy(price, ecus)}
        onPress={buy}
      />
      <Button label={BANNER_BUY_CANCEL} secondary onPress={() => onDone(false)} />
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
  heading: {
    fontFamily: fonts.displayBold,
    marginTop: space.s3,
    fontSize: fontSizes.body,
    color: colors.pageInkMuted,
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
