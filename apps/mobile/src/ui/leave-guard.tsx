import type { LeaveWords } from "@leximon/view-model";
import { useFocusEffect, useNavigation, usePreventRemove } from "expo-router";
import { type ReactNode, useCallback, useState } from "react";
import { BackHandler, StyleSheet, View } from "react-native";
import { MainAction, PaperAction } from "@/library/play-pieces";
import { space } from "@/theme";
import { Paragraph } from "./page";
import { Sheet } from "./sheet";

/**
 * Asks before a game in progress is left. A game that is its own screen (`onBack` absent) asks
 * when the screen would close, by the back button, a gesture or the screen's own way out. A game
 * played inside a tab asks on the back button and calls `onBack` once the player agrees.
 */
export function useLeaveGuard(
  active: boolean,
  words: LeaveWords,
  onBack?: () => void,
): {
  readonly ask: (leave: () => void) => void;
  /** The sheet is open: the screen waits. */
  readonly asking: boolean;
  readonly dialog: ReactNode;
} {
  const navigation = useNavigation();
  const [leaving, setLeaving] = useState<(() => void) | null>(null);

  const ask = useCallback(
    (leave: () => void) => {
      if (active) setLeaving(() => leave);
      else leave();
    },
    [active],
  );

  usePreventRemove(active && onBack === undefined, ({ data }) =>
    setLeaving(() => () => navigation.dispatch(data.action)),
  );

  useFocusEffect(
    useCallback(() => {
      if (!active || onBack === undefined) return;
      const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
        setLeaving(() => onBack);
        return true;
      });
      return () => subscription.remove();
    }, [active, onBack]),
  );

  const stay = () => setLeaving(null);
  const leave = () => {
    const go = leaving;
    setLeaving(null);
    go?.();
  };

  const dialog = (
    <Sheet open={leaving !== null} title={words.title} onClose={stay}>
      <Paragraph>{words.text}</Paragraph>
      <View style={styles.actions}>
        <MainAction label={words.stay} onPress={stay} />
        <PaperAction label={words.leave} onPress={leave} />
      </View>
    </Sheet>
  );
  return { ask, asking: leaving !== null, dialog };
}

const styles = StyleSheet.create({
  actions: { gap: space.s6, paddingBottom: space.s4 },
});
