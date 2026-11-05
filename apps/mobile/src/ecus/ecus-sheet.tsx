import type { BoosterWalletResponse } from "@leximon/contract";
import {
  ECUS_TITLE,
  ecuRules,
  ecusLabel,
  ecusPanel,
  MISSING_WORD_OPEN,
  RECYCLE_RULE,
} from "@leximon/view-model";
import { StyleSheet, Text, View } from "react-native";
import { fontSizes, fonts, paperColors, space } from "@/theme";
import { Button } from "@/ui/button";
import { Sheet } from "@/ui/sheet";
import { ToyIcon } from "@/ui/toy";
import { openMissingWord } from "./missing-word";
import { RecycleButton } from "./recycle-button";

/** What the écus chip opens: the balance, how écus are won and spent, and both actions. */
export function EcusSheet({
  wallet,
  now,
  open,
  onClose,
}: {
  readonly wallet: BoosterWalletResponse;
  readonly now: number;
  readonly open: boolean;
  readonly onClose: () => void;
}) {
  const [rule, gains, prices] = ecusPanel(ecuRules(now));
  return (
    <Sheet open={open} title={ECUS_TITLE} onClose={onClose}>
      <View style={styles.line}>
        <ToyIcon name="ecu" size={42} />
        <View style={styles.lineText}>
          <Text style={styles.headline}>{ecusLabel(wallet.ecus)}</Text>
          <Text style={styles.muted}>{rule}</Text>
        </View>
      </View>
      <View style={styles.notes}>
        <Text style={styles.note}>{gains}</Text>
        <Text style={styles.note}>{prices}</Text>
        <Text style={styles.muted}>{RECYCLE_RULE}</Text>
      </View>
      <RecycleButton />
      <Button
        label={MISSING_WORD_OPEN}
        onPress={() => {
          onClose();
          openMissingWord();
        }}
      />
    </Sheet>
  );
}

/** It is read on a sheet, a leaf of paper. */
const ink = paperColors;

const styles = StyleSheet.create({
  line: { flexDirection: "row", alignItems: "center", gap: space.s6 },
  lineText: { flex: 1, gap: 1 },
  headline: { fontFamily: fonts.ui.bold, fontSize: fontSizes.bodyLarge, color: ink.pageInk },
  muted: {
    fontFamily: fonts.ui.medium,
    fontSize: fontSizes.label,
    lineHeight: 20,
    color: ink.pageInkMuted,
  },
  notes: {
    gap: space.s3,
    paddingTop: space.s6,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: ink.rule,
  },
  note: {
    fontFamily: fonts.ui.medium,
    fontSize: fontSizes.label,
    lineHeight: 20,
    color: ink.pageInk,
  },
});
