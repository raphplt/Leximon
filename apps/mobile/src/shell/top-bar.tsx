import {
  levelDescription,
  levelRatio,
  mailLabel,
  stockView,
  xpProgressLabel,
} from "@leximon/view-model";
import { router } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNow } from "@/player/shared";
import { usePlayerView } from "@/player/use-player-view";
import { colors, fonts } from "@/theme";
import { Badge } from "@/ui/badge";
import { Icon } from "@/ui/icon";
import { LevelMedal, LevelRing, XpBar } from "@/ui/level";

const AVATAR = 46;

/** The band at the top of every tab: avatar and level, XP, stock, bonus, mail. */
export function TopBar() {
  const insets = useSafeAreaInsets();
  const view = usePlayerView();
  const now = useNow(15_000);
  const { progress } = view;
  const stock = view.wallet === null ? null : stockView(view.wallet, now);
  return (
    <View style={[styles.bar, { paddingTop: insets.top + 8 }]}>
      <Pressable
        style={styles.avatar}
        onPress={() => router.push("/compte")}
        accessibilityRole="button"
        accessibilityLabel={
          progress === null ? "Ton compte" : `${levelDescription(progress)}. Ton compte`
        }
      >
        {progress !== null && <LevelRing ratio={levelRatio(progress)} size={AVATAR} />}
        <View style={styles.avatarInner}>
          <Icon name="profil" size={24} color={colors.textMuted} />
        </View>
        {progress !== null && (
          <View style={styles.level}>
            <LevelMedal level={progress.level} size={24} />
          </View>
        )}
      </Pressable>
      {progress !== null && (
        <View style={styles.xp}>
          <Text style={styles.xpText}>{xpProgressLabel(progress)}</Text>
          <XpBar ratio={levelRatio(progress)} thin />
        </View>
      )}
      <View style={styles.spacer} />
      {stock !== null && (
        <View style={styles.chip} accessible accessibilityLabel={stock.description}>
          <Icon name="sachet" size={16} color={colors.text} />
          <Text style={styles.chipText}>
            {stock.stored}/{stock.capacity}
          </Text>
        </View>
      )}
      {stock !== null && stock.bonus > 0 && (
        <View
          style={[styles.chip, styles.chipGold]}
          accessible
          accessibilityLabel={`Réserve, ${stock.bonus} sachets bonus`}
        >
          <Text style={[styles.chipText, styles.chipGoldText]}>+{stock.bonus}</Text>
        </View>
      )}
      <Pressable
        style={styles.round}
        accessibilityRole="button"
        accessibilityLabel={mailLabel(view.mail)}
      >
        <Icon name="courrier" size={19} color={colors.text} />
        {view.mail > 0 && <Badge count={view.mail} ring={colors.background} />}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingBottom: 6,
    backgroundColor: colors.background,
  },
  avatar: { width: AVATAR, height: AVATAR, alignItems: "center", justifyContent: "center" },
  avatarInner: {
    width: AVATAR - 8,
    height: AVATAR - 8,
    borderRadius: 999,
    backgroundColor: colors.backgroundRaised,
    alignItems: "center",
    justifyContent: "center",
  },
  level: {
    position: "absolute",
    right: -7,
    bottom: -5,
    borderRadius: 999,
    borderWidth: 2,
    borderColor: colors.background,
  },
  xp: { width: 84, gap: 4, marginLeft: 4 },
  xpText: { fontFamily: fonts.ui.extrabold, fontSize: 11, color: colors.textMuted },
  spacer: { flex: 1 },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    minHeight: 36,
    paddingHorizontal: 11,
    borderRadius: 999,
    backgroundColor: colors.backgroundRaised,
  },
  chipText: { fontFamily: fonts.ui.bold, fontSize: 14, color: colors.text },
  chipGold: { backgroundColor: "rgba(255, 210, 77, 0.14)" },
  chipGoldText: { color: colors.accent },
  round: {
    width: 40,
    height: 40,
    borderRadius: 999,
    backgroundColor: colors.backgroundRaised,
    alignItems: "center",
    justifyContent: "center",
  },
});
