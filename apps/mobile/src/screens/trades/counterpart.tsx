import type { PlayerBadge } from "@leximon/contract";
import { playerName } from "@leximon/view-model";
import { StyleSheet, Text, View } from "react-native";
import { fontSizes, fonts, space } from "@/theme";
import { Avatar } from "@/ui/avatar";
import { useInk } from "@/ui/ink";
import { LevelMedal } from "@/ui/level";

/** The other player of an offer: avatar, pseudo or code, level; « Un joueur parti » once gone. */
export function Counterpart({
  player,
  prefix = "",
}: {
  readonly player: PlayerBadge | null;
  readonly prefix?: string;
}) {
  const ink = useInk();
  return (
    <View style={styles.row}>
      <Avatar avatar={player?.avatar ?? null} frame={player?.frame ?? null} size={30} />
      <Text style={[styles.name, { color: ink.pageInk }]} numberOfLines={1}>
        {prefix}
        {playerName(player)}
      </Text>
      {player !== null && <LevelMedal level={player.level} size={26} labelled />}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: space.s5, flexShrink: 1 },
  name: {
    fontFamily: fonts.ui.extrabold,
    fontSize: fontSizes.bodyLarge,
    flexShrink: 1,
  },
});
