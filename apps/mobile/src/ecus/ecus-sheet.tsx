import { type BoosterWalletResponse, RARITY_LABELS } from "@leximon/contract";
import { toyMatters, toy as toyValues } from "@leximon/tokens";
import {
  ECUS_TITLE,
  ecuRules,
  ecusLabel,
  ecusTable,
  MISSING_WORD_OPEN,
  RECYCLE_RULE,
} from "@leximon/view-model";
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { alpha, fontSizes, fonts, paperColors, space } from "@/theme";
import { Button } from "@/ui/button";
import { Icon } from "@/ui/icon";
import { RarityName } from "@/ui/rarity-icon";
import { Sheet } from "@/ui/sheet";
import { ToyIcon } from "@/ui/toy";
import { openMissingWord } from "./missing-word";
import { RecycleButton } from "./recycle-button";

/** What the écus chip opens: the balance, where écus come from and what they buy, and both actions. */
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
  const table = ecusTable(ecuRules(now));
  const [doubles, ecus, missing] = table.flow;
  const [helping, setHelping] = useState(false);
  return (
    <Sheet open={open} title={ECUS_TITLE} onClose={onClose}>
      <View style={styles.balance}>
        <ToyIcon name="ecu" size={38} />
        <Text style={styles.balanceText}>{ecusLabel(wallet.ecus)}</Text>
      </View>

      <View style={styles.flow}>
        <View style={styles.step}>
          <View style={styles.pair}>
            <View style={[styles.mini, styles.miniBack]} />
            <View style={[styles.mini, styles.miniFront]} />
          </View>
          <Text style={styles.stepText}>{doubles}</Text>
        </View>
        <View style={styles.arrow}>
          <Icon name="chev" size={18} color={ink.pageInkMuted} />
        </View>
        <View style={styles.step}>
          <ToyIcon name="ecu" size={34} />
          <Text style={styles.stepText}>{ecus}</Text>
        </View>
        <View style={styles.arrow}>
          <Icon name="chev" size={18} color={ink.pageInkMuted} />
        </View>
        <View style={styles.step}>
          <View style={styles.mini}>
            <Text style={styles.question}>?</Text>
          </View>
          <Text style={styles.stepText}>{missing}</Text>
        </View>
      </View>

      <View>
        <View style={styles.row}>
          <View style={styles.rarity} />
          <View style={[styles.cell, styles.headCell]}>
            <Text style={styles.column}>{table.gainColumn}</Text>
            <Pressable
              onPress={() => setHelping((was) => !was)}
              hitSlop={10}
              style={[styles.round, helping && styles.roundOn]}
              accessibilityRole="button"
              accessibilityLabel="Le recyclage, la règle"
              accessibilityState={{ expanded: helping }}
            >
              <Icon name="help" size={18} color={ink.pageInkMuted} />
            </Pressable>
          </View>
          <View style={[styles.cell, styles.headCell]}>
            <Text style={styles.column}>{table.priceColumn}</Text>
          </View>
        </View>
        {helping && <Text style={styles.help}>{RECYCLE_RULE}</Text>}
        {table.rows.map((row) => (
          <View
            key={row.rarity}
            style={[styles.row, styles.line]}
            accessible
            accessibilityLabel={`${RARITY_LABELS[row.rarity]}, ${table.gainColumn} ${row.gain}, ${table.priceColumn} ${row.price}`}
          >
            <View style={styles.rarity}>
              <RarityName rarity={row.rarity} color={ink.pageInk} />
            </View>
            <View style={styles.cell}>
              <Text style={[styles.amount, styles.gain]}>{row.gain}</Text>
              <ToyIcon name="ecu" size={18} />
            </View>
            <View style={styles.cell}>
              <Text style={styles.amount}>{row.price}</Text>
              <ToyIcon name="ecu" size={18} />
            </View>
          </View>
        ))}
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
  balance: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: space.s5,
  },
  balanceText: {
    fontFamily: fonts.display,
    fontSize: fontSizes.title,
    fontVariant: ["tabular-nums"],
    color: ink.pageInk,
  },
  // Doubles become écus, écus become a missing word: the use of the pill in three steps.
  flow: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingVertical: space.s6,
    paddingHorizontal: space.s4,
    borderRadius: 14,
    backgroundColor: alpha(ink.pageInk, 0.06),
  },
  step: { flex: 1, alignItems: "center", gap: space.s3 },
  stepText: {
    fontFamily: fonts.ui.extrabold,
    fontSize: fontSizes.small,
    lineHeight: 16,
    textAlign: "center",
    color: ink.pageInk,
  },
  arrow: { height: 36, justifyContent: "center" },
  pair: { width: 36, height: 36 },
  mini: {
    width: 24,
    height: 33,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: toyValues.outline,
    borderRadius: 5,
    backgroundImage: `linear-gradient(180deg, ${toyMatters.paper.top} 50%, ${toyMatters.paper.bottom} 50%)`,
    boxShadow: `0 2px 0 ${toyValues.outline}`,
  },
  miniBack: { position: "absolute", left: 0, top: 0, transform: [{ rotate: "-8deg" }] },
  miniFront: { position: "absolute", left: 11, top: 2, transform: [{ rotate: "7deg" }] },
  question: { fontFamily: fonts.display, fontSize: 18, color: ink.rubric },
  // Rarity by rarity, what a double brings and what a missing word costs.
  row: { flexDirection: "row", alignItems: "center", gap: space.s3 },
  line: {
    paddingVertical: space.s3,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: ink.rule,
  },
  rarity: { flex: 1.4 },
  cell: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 3,
  },
  headCell: { alignItems: "flex-end", paddingBottom: space.s4 },
  column: {
    flexShrink: 1,
    fontFamily: fonts.ui.extrabold,
    fontSize: fontSizes.small,
    lineHeight: 16,
    textAlign: "right",
    color: ink.pageInkMuted,
  },
  round: {
    width: 26,
    height: 26,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 13,
  },
  roundOn: { backgroundColor: alpha(toyValues.outline, 0.1) },
  help: {
    marginBottom: space.s4,
    padding: space.s5,
    borderWidth: toyValues.outlineWidth,
    borderColor: toyValues.outline,
    borderRadius: 14,
    backgroundColor: ink.track,
    fontFamily: fonts.ui.medium,
    fontSize: fontSizes.label,
    lineHeight: 20,
    color: ink.pageInk,
  },
  amount: {
    fontFamily: fonts.ui.extrabold,
    fontSize: fontSizes.body,
    fontVariant: ["tabular-nums"],
    color: ink.pageInk,
  },
  gain: { color: ink.success },
});
