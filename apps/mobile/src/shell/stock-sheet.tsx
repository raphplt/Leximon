import type { BoosterWalletResponse } from "@leximon/contract";
import { reserveView, stockView } from "@leximon/view-model";
import { router } from "expo-router";
import { StyleSheet, Text, View } from "react-native";
import { fontSizes, fonts, paperColors, radii, space } from "@/theme";
import { Button } from "@/ui/button";
import { Icon } from "@/ui/icon";
import { Sheet } from "@/ui/sheet";

/** What the stock chip opens: the free sachets, then the reserve of bonus ones. */
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
  const reserve = reserveView(wallet);
  return (
    <Sheet open={open} title="Tes sachets" onClose={onClose}>
      <View style={styles.line}>
        <View style={styles.sachet}>
          <Icon name="sachet" size={22} color={ink.pageInk} />
        </View>
        <View style={styles.lineText}>
          <Text style={styles.headline}>{stock.count}</Text>
          <Text style={styles.muted}>{stock.refillLine}</Text>
        </View>
      </View>
      <View style={styles.line}>
        <View style={[styles.sachet, styles.sachetGold]}>
          <Icon name="sachet" size={22} color={ink.actionInk} />
        </View>
        <View style={styles.lineText}>
          <Text style={styles.headline}>{reserve.headline}</Text>
          <Text style={styles.muted}>{reserve.places}</Text>
        </View>
      </View>
      <View style={styles.notes}>
        {reserve.garni !== null && <Text style={styles.garni}>{reserve.garni}</Text>}
        {reserve.rule !== null && <Text style={styles.note}>{reserve.rule}</Text>}
        <Text style={styles.muted}>{reserve.sources}</Text>
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

/** It is read on a sheet, a leaf of paper in « La Bibliothèque ». */
const ink = paperColors;

const styles = StyleSheet.create({
  line: { flexDirection: "row", alignItems: "center", gap: space.s6 },
  sachet: {
    width: 42,
    height: 42,
    borderRadius: radii.xl,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: ink.pageRaised,
  },
  sachetGold: { backgroundColor: ink.action },
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
  garni: {
    fontFamily: fonts.ui.bold,
    fontSize: fontSizes.label,
    lineHeight: 20,
    color: ink.rubric,
  },
});
