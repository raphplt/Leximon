import { levelDescription, levelRatio, mailLabel, stockView } from "@leximon/view-model";
import { router } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNow } from "@/player/shared";
import { usePlayerView } from "@/player/use-player-view";
import { colors, fonts } from "@/theme";
import { Avatar } from "@/ui/avatar";
import { Badge } from "@/ui/badge";
import { Icon } from "@/ui/icon";
import { LevelMedal, XpBar } from "@/ui/level";

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
          accessibilityLabel={`Chemin des niveaux, ${levelDescription(progress)}`}
          hitSlop={8}
        >
          <LevelMedal level={progress.level} size={34} />
          <View style={styles.xpBar}>
            <XpBar ratio={levelRatio(progress)} thin />
          </View>
        </Pressable>
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
        onPress={() => router.push("/courrier")}
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
  avatar: {
    width: AVATAR,
    height: AVATAR,
    borderRadius: 999,
    backgroundColor: colors.track,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarInner: {
    width: AVATAR - 8,
    height: AVATAR - 8,
    borderRadius: 999,
    backgroundColor: colors.backgroundRaised,
    alignItems: "center",
    justifyContent: "center",
  },
  xp: { width: 100, flexDirection: "row", alignItems: "center", gap: 5, marginLeft: 4 },
  xpBar: { flex: 1 },
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
