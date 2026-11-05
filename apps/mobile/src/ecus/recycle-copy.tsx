import type { Rarity } from "@leximon/core";
import {
  ecuRules,
  RECYCLE_BUSY,
  RECYCLE_COPY_CONFIRM_ACTION,
  RECYCLE_COPY_KEEP,
  RECYCLE_FAILED,
  recycleCopyAction,
  recycleCopyConfirm,
  recycleCopyNeedsConfirm,
  recycledToast,
  recycleRefusalMessage,
} from "@leximon/view-model";
import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { play } from "@/feedback/feedback";
import { recycleCopyOf } from "@/player/ecus";
import { fontSizes, fonts, space } from "@/theme";
import { Button } from "@/ui/button";
import { useInk } from "@/ui/ink";
import { TextButton } from "@/ui/text-button";
import { toast } from "@/ui/toast";

/**
 * On a card's sheet: one double into écus, whatever the rarity. The rarest cards, never recycled
 * in bulk, ask once more.
 */
export function RecycleCopy({
  cardId,
  rarity,
  quantity,
}: {
  readonly cardId: string;
  readonly rarity: Rarity;
  readonly quantity: number;
}) {
  const ink = useInk();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const rules = ecuRules(Date.now());
  const label = recycleCopyAction(rules, rarity, quantity);
  if (label === null) return null;

  const recycle = () => {
    setBusy(true);
    recycleCopyOf(cardId)
      .then((result) => {
        if (result.kind === "refused") {
          toast(recycleRefusalMessage(result.reason));
          return;
        }
        play("coins");
        toast(recycledToast(result));
      })
      .catch(() => toast(RECYCLE_FAILED))
      .finally(() => {
        setBusy(false);
        setConfirming(false);
      });
  };

  if (confirming) {
    return (
      <View style={styles.confirm}>
        <Text style={[styles.text, { color: ink.pageInk }]}>
          {recycleCopyConfirm(rules, rarity, quantity)}
        </Text>
        <Button
          label={busy ? RECYCLE_BUSY : RECYCLE_COPY_CONFIRM_ACTION}
          disabled={busy}
          onPress={recycle}
        />
        <TextButton label={RECYCLE_COPY_KEEP} onPress={() => setConfirming(false)} />
      </View>
    );
  }
  return (
    <TextButton
      label={busy ? RECYCLE_BUSY : label}
      disabled={busy}
      onPress={() => (recycleCopyNeedsConfirm(rules, rarity) ? setConfirming(true) : recycle())}
    />
  );
}

const styles = StyleSheet.create({
  confirm: { gap: space.s3 },
  text: { fontFamily: fonts.ui.medium, fontSize: fontSizes.label, lineHeight: 20 },
});
