import { levelDescription, levelRatio, mailLabel, stockView } from "@leximon/view-model";
import { router } from "expo-router";
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNow } from "@/player/shared";
import { usePlayerView } from "@/player/use-player-view";
import {
  alpha,
  SHOWS_THEME_CHOICE as BOOK,
  colors,
  fontSizes,
  fonts,
  ROUND,
  radii,
  space,
} from "@/theme";
import { Avatar } from "@/ui/avatar";
import { Badge } from "@/ui/badge";
import { Icon } from "@/ui/icon";
import { LevelMedal, XpBar } from "@/ui/level";
import { Matter } from "@/ui/matter";
import { StockSheet } from "./stock-sheet";

const AVATAR = 46;

const INK = BOOK ? colors.bindingInk : colors.pageInk;
const BAR = BOOK ? colors.binding : colors.page;
const BOUND_CONTROL = BOOK
  ? { borderWidth: StyleSheet.hairlineWidth, borderColor: alpha(colors.gilt, 0.55) }
  : { backgroundColor: colors.pageRaised };

/** The band at the top of every tab: avatar and level, XP, stock, mail. */
export function TopBar() {
  const insets = useSafeAreaInsets();
  const view = usePlayerView();
  const now = useNow(15_000);
  const [stockOpen, setStockOpen] = useState(false);
  const { progress } = view;
  const stock = view.wallet === null ? null : stockView(view.wallet, now);
  return (
    <View style={[styles.bar, { paddingTop: insets.top + 8 }]}>
      <Matter kind="leather" />
      {BOOK && <View style={styles.gilding} />}
      <Pressable
        style={styles.avatar}
        onPress={() => router.push("/profil")}
        accessibilityRole="button"
        accessibilityLabel="Ton profil"
      >
        <View style={styles.avatarInner}>
          <Avatar avatar={view.profile?.avatar ?? null} frame={null} size={AVATAR - 8} />
        </View>
      </Pressable>
      {progress !== null && (
        <Pressable
          style={styles.xp}
          onPress={() => router.push("/niveaux")}
          accessibilityRole="button"
          accessibilityLabel={`Niveaux, ${levelDescription(progress)}`}
          hitSlop={8}
        >
          <LevelMedal level={progress.level} size={34} />
          <View style={styles.xpBar}>
            <XpBar ratio={levelRatio(progress)} thin onBinding />
          </View>
        </Pressable>
      )}
      <View style={styles.spacer} />
      {stock !== null && (
        <Pressable
          style={styles.chip}
          onPress={() => setStockOpen(true)}
          accessibilityRole="button"
          accessibilityLabel={stock.description}
        >
          <Icon name="sachet" size={16} color={INK} />
          <Text style={styles.chipText}>
            {stock.stored}/{stock.capacity}
          </Text>
        </Pressable>
      )}
      <Pressable
        style={styles.round}
        onPress={() => router.push("/courrier")}
        accessibilityRole="button"
        accessibilityLabel={mailLabel(view.mail)}
      >
        <Icon name="courrier" size={19} color={INK} />
        {view.mail > 0 && <Badge count={view.mail} ring={BAR} />}
      </Pressable>
      {view.wallet !== null && (
        <StockSheet
          wallet={view.wallet}
          now={now}
          open={stockOpen}
          onClose={() => setStockOpen(false)}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.s4,
    paddingHorizontal: space.s6,
    paddingBottom: BOOK ? space.s4 : space.s3,
    backgroundColor: BAR,
  },
  /** The two gilt rules along the leather's edge. */
  gilding: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: 4,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: colors.gilt,
  },
  avatar: {
    width: AVATAR,
    height: AVATAR,
    borderRadius: ROUND,
    backgroundColor: BOOK ? alpha(colors.gilt, 0.35) : colors.track,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarInner: {
    width: AVATAR - 8,
    height: AVATAR - 8,
    borderRadius: ROUND,
    backgroundColor: colors.pageRaised,
    alignItems: "center",
    justifyContent: "center",
  },
  xp: { width: 100, flexDirection: "row", alignItems: "center", gap: 5, marginLeft: space.s2 },
  xpBar: { flex: 1 },
  spacer: { flex: 1 },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    minHeight: 36,
    paddingHorizontal: 11,
    borderRadius: radii.pill,
    ...BOUND_CONTROL,
  },
  chipText: { fontFamily: fonts.ui.bold, fontSize: fontSizes.label, color: INK },
  round: {
    width: 40,
    height: 40,
    borderRadius: radii.pill,
    alignItems: "center",
    justifyContent: "center",
    ...BOUND_CONTROL,
  },
});
