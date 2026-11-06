import type { ClanEntryMode } from "@leximon/contract";
import type { IconName } from "@leximon/tokens";
import { type ClanFact, clanFacts } from "@leximon/view-model";
import { StyleSheet, Text, View } from "react-native";
import { fontSizes, fonts, space } from "@/theme";
import { Icon } from "@/ui/icon";

const FACT_ICONS: Readonly<Record<ClanFact["kind"], IconName>> = {
  members: "amis",
  open: "porte",
  request: "courrier",
  invite: "cle",
};

/** The clan's size and how one enters it, each behind its icon. */
export function ClanFacts({
  clan,
  color,
  iconColor = color,
}: {
  readonly clan: { readonly memberCount: number; readonly entryMode: ClanEntryMode };
  readonly color: string;
  readonly iconColor?: string;
}) {
  return (
    <View style={styles.facts}>
      {clanFacts(clan).map((fact) => (
        <View key={fact.kind} style={styles.fact}>
          <Icon name={FACT_ICONS[fact.kind]} size={18} color={iconColor} />
          <Text style={[styles.label, { color }]}>{fact.label}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  facts: { flexDirection: "row", flexWrap: "wrap", gap: space.s4, columnGap: space.s10 },
  fact: { flexDirection: "row", alignItems: "center", gap: space.s3 },
  label: { fontFamily: fonts.ui.bold, fontSize: fontSizes.label },
});
