import type { BoosterWalletResponse } from "@leximon/contract";
import { toyMatters, toy as toyValues } from "@leximon/tokens";
import { SACHETS_TITLE, sachetsPanel, stockView } from "@leximon/view-model";
import { router } from "expo-router";
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { alpha, fontSizes, fonts, paperColors, space } from "@/theme";
import { Button } from "@/ui/button";
import { Icon } from "@/ui/icon";
import { RarityChip } from "@/ui/rarity-icon";
import { Sheet } from "@/ui/sheet";
import { ToyIcon } from "@/ui/toy";

/** What the stock chip opens: the free sachets and the reserve as rows on their shelves. */
export function StockSheet({
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
  const stock = stockView(wallet, now);
  const { free, reserve, sourcesTitle, sources } = sachetsPanel(wallet, now);
  const [helping, setHelping] = useState(false);
  return (
    <Sheet open={open} title={SACHETS_TITLE} onClose={onClose}>
      <View accessible accessibilityLabel={`${free.title}, ${free.figure}, ${free.note}`}>
        <View style={styles.head}>
          <Text style={styles.title}>{free.title}</Text>
          <Text style={styles.figure}>{free.figure}</Text>
        </View>
        <View style={styles.slots}>
          {Array.from({ length: free.slots }, (_, index) => {
            const filled = index < free.filled;
            const next = index === free.filled && free.refill !== null;
            return (
              <View
                // biome-ignore lint/suspicious/noArrayIndexKey: the slots of a row never move
                key={index}
                style={[styles.slot, filled ? styles.filled : styles.empty]}
              >
                {filled && <ToyIcon name="sachet" size={26} />}
                {next && (
                  <View style={[styles.refill, { height: `${(free.refill ?? 0) * 100}%` }]} />
                )}
              </View>
            );
          })}
        </View>
        <View style={styles.noteRow}>
          {free.refill !== null && <Icon name="clock" size={16} color={ink.pageInkMuted} />}
          <Text style={[styles.note, free.refill === null && styles.full]}>{free.note}</Text>
        </View>
      </View>

      <View>
        <View style={styles.head}>
          <Text style={styles.title}>{reserve.title}</Text>
          <Pressable
            onPress={() => setHelping((was) => !was)}
            hitSlop={10}
            style={[styles.round, helping && styles.roundOn]}
            accessibilityRole="button"
            accessibilityLabel={`${reserve.title}, la règle`}
            accessibilityState={{ expanded: helping }}
          >
            <Icon name="help" size={20} color={ink.pageInkMuted} />
          </Pressable>
          <Text style={styles.figure}>{reserve.figure}</Text>
        </View>
        {helping && <Text style={styles.help}>{reserve.help}</Text>}
        <View style={[styles.slots, styles.small]} accessible={false}>
          {Array.from({ length: reserve.slots }, (_, index) => {
            const filled = index < reserve.filled;
            return (
              <View
                // biome-ignore lint/suspicious/noArrayIndexKey: the slots of a row never move
                key={index}
                style={[
                  styles.slot,
                  styles.smallSlot,
                  filled ? styles.bonus : [styles.empty, styles.smallEmpty],
                ]}
              >
                {filled && <ToyIcon name="sachet" size={16} />}
                {index < reserve.garni && (
                  <View style={styles.garni}>
                    <RarityChip rarity="rare" size={15} />
                  </View>
                )}
              </View>
            );
          })}
        </View>
        {reserve.garniLabel !== null && (
          <View style={styles.noteRow}>
            <RarityChip rarity="rare" size={17} />
            <Text style={styles.note}>{reserve.garniLabel}</Text>
          </View>
        )}
      </View>

      <View style={styles.sources}>
        <Text style={styles.title}>{sourcesTitle}</Text>
        <View style={styles.sourceList}>
          {sources.map((source) => (
            <View key={source.icon} style={styles.source}>
              <ToyIcon name={source.icon} size={26} />
              <Text style={styles.sourceLabel}>{source.label}</Text>
            </View>
          ))}
        </View>
      </View>

      {!stock.empty && (
        <Button
          label={stock.action}
          onPress={() => {
            onClose();
            router.navigate("/");
          }}
        />
      )}
    </Sheet>
  );
}

/** It is read on a sheet, a leaf of paper. */
const ink = paperColors;

const styles = StyleSheet.create({
  head: { flexDirection: "row", alignItems: "center", gap: space.s3, marginBottom: space.s4 },
  title: {
    fontFamily: fonts.displayBold,
    fontSize: fontSizes.body,
    color: ink.pageInkMuted,
  },
  figure: {
    marginLeft: "auto",
    fontFamily: fonts.display,
    fontSize: fontSizes.titleSmall,
    fontVariant: ["tabular-nums"],
    color: ink.pageInk,
  },
  round: {
    width: 30,
    height: 30,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 15,
  },
  roundOn: { backgroundColor: alpha(toyValues.outline, 0.1) },
  help: {
    marginBottom: space.s5,
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
  // The sachets stand in a niche hollowed in the paper, spread along it; on a narrow phone the
  // places shrink, never wrap.
  slots: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: space.s4,
    paddingVertical: space.s4,
    paddingHorizontal: space.s5,
    borderRadius: 14,
    backgroundColor: alpha(ink.pageInk, 0.07),
    boxShadow: `inset 0 2px 3px ${alpha(toyValues.outline, 0.18)}, 0 1px 0 ${alpha(toyMatters.paper.top, 0.8)}`,
  },
  small: { gap: space.s2, paddingVertical: space.s3, borderRadius: 11 },
  slot: {
    flex: 1,
    maxWidth: 44,
    aspectRatio: 0.8,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 10,
  },
  smallSlot: { maxWidth: 27, borderRadius: 7 },
  filled: {
    borderWidth: toyValues.outlineWidth,
    borderColor: toyValues.outline,
    backgroundImage: `linear-gradient(180deg, ${toyMatters.paper.top} 50%, ${toyMatters.paper.bottom} 50%)`,
    boxShadow: `inset 0 -3px 0 ${toyMatters.paper.edge}`,
  },
  bonus: {
    borderWidth: 2,
    borderColor: toyValues.outline,
    backgroundImage: `linear-gradient(180deg, ${toyMatters.gold.top} 50%, ${toyMatters.gold.bottom} 50%)`,
    boxShadow: `inset 0 -2px 0 ${toyMatters.gold.edge}`,
  },
  empty: {
    overflow: "hidden",
    borderWidth: 2,
    borderStyle: "dashed",
    borderColor: alpha(ink.pageInk, 0.3),
    backgroundColor: alpha(ink.pageInk, 0.05),
  },
  smallEmpty: { borderWidth: 1.5 },
  // The next free sachet fills from the bottom as its time comes.
  refill: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: alpha(toyMatters.gold.top, 0.7),
  },
  garni: { position: "absolute", top: -6, right: -6 },
  noteRow: { flexDirection: "row", alignItems: "center", gap: space.s3, marginTop: space.s5 },
  note: { fontFamily: fonts.ui.bold, fontSize: fontSizes.label, color: ink.pageInkMuted },
  full: { color: ink.success },
  sources: {
    gap: space.s5,
    paddingTop: space.s8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: ink.rule,
  },
  sourceList: { flexDirection: "row", flexWrap: "wrap", rowGap: space.s4 },
  source: { width: "50%", flexDirection: "row", alignItems: "center", gap: space.s4 },
  sourceLabel: {
    flex: 1,
    fontFamily: fonts.ui.bold,
    fontSize: fontSizes.label,
    lineHeight: 18,
    color: ink.pageInk,
  },
});
