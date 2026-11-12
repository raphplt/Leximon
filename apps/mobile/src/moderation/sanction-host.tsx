import type { Sanction } from "@leximon/contract";
import { CONTEST_HINT, contestState, sanctionTitle, sanctionUntil } from "@leximon/view-model";
import { useState } from "react";
import {
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api } from "@/api/client";
import { useNow, useShared } from "@/player/shared";
import { sanctions } from "@/player/state";
import { alpha, colors, fontSizes, fonts, paperColors, radii, space } from "@/theme";
import { Button } from "@/ui/button";
import { KeyboardLift } from "@/ui/keyboard-lift";
import { ToastHost, toast } from "@/ui/toast";
import { Leaf } from "@/ui/toy";

/**
 * A sanction the player has not read yet: what was done, why, until when, and how to contest
 * it. Opens over the game; closing it marks them read.
 */
export function SanctionHost() {
  const all = useShared(sanctions);
  const now = useNow(60_000);
  const window = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [closed, setClosed] = useState(false);
  const unseen = all?.filter((sanction) => !sanction.seen) ?? [];

  const close = () => {
    setClosed(true);
    if (all !== null) sanctions.publish(all.map((sanction) => ({ ...sanction, seen: true })));
    void api.markSanctionsSeen().catch(() => undefined);
  };

  return (
    <Modal
      visible={!closed && unseen.length > 0}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={close}
    >
      <KeyboardLift style={styles.backdrop}>
        <View
          style={[
            styles.centered,
            {
              paddingTop: Math.max(space.s24, insets.top + space.s4),
              paddingBottom: Math.max(space.s24, insets.bottom + space.s4),
            },
          ]}
        >
          <Leaf style={[styles.leaf, { width: Math.min(400, window.width - 32) }]}>
            <ScrollView contentContainerStyle={styles.inner} keyboardShouldPersistTaps="handled">
              <Text style={styles.title} accessibilityRole="header">
                {unseen.length > 1 ? "Des sanctions te concernent" : "Une sanction te concerne"}
              </Text>
              {unseen.map((sanction) => (
                <SanctionCard key={sanction.id} sanction={sanction} now={now} />
              ))}
              <Button label="J'ai lu" onPress={close} />
            </ScrollView>
          </Leaf>
        </View>
      </KeyboardLift>
      <ToastHost />
    </Modal>
  );
}

function SanctionCard({ sanction, now }: { readonly sanction: Sanction; readonly now: number }) {
  const [writing, setWriting] = useState(false);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const until = sanctionUntil(sanction, now);
  const state = contestState(sanction);

  const send = async () => {
    if (text.trim() === "") return;
    setBusy(true);
    try {
      const sent = await api.contestSanction(sanction.id, text.trim());
      toast(sent ? "Contestation envoyée." : "Cette sanction ne peut plus être contestée.");
      const current = sanctions.current();
      if (current !== null) {
        sanctions.publish(
          current.map((s) =>
            s.id === sanction.id
              ? {
                  ...s,
                  contestable: false,
                  contestedAt: sent ? new Date().toISOString() : s.contestedAt,
                }
              : s,
          ),
        );
      }
      setWriting(false);
    } catch {
      toast("La contestation n'a pas été envoyée. Réessaie.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.sanction}>
      <Text style={styles.sanctionTitle}>{sanctionTitle(sanction.kind)}</Text>
      <Text style={styles.reason}>{sanction.reason}</Text>
      {sanction.content !== null && <Text style={styles.content}>« {sanction.content} »</Text>}
      {until !== null && <Text style={styles.detail}>{until}</Text>}
      {state !== null && <Text style={styles.detail}>{state}</Text>}
      {sanction.contestable &&
        (writing ? (
          <>
            <Text style={styles.detail}>{CONTEST_HINT}</Text>
            <TextInput
              style={styles.field}
              value={text}
              maxLength={2000}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
              selectionColor={ink.rubric}
              accessibilityLabel={CONTEST_HINT}
              onChangeText={setText}
            />
            <Button
              label="Envoyer ma contestation"
              disabled={busy || text.trim() === ""}
              onPress={() => void send()}
            />
          </>
        ) : (
          <Button label="Contester" secondary onPress={() => setWriting(true)} />
        ))}
    </View>
  );
}

/** The notice pops up on a leaf of paper. */
const ink = paperColors;

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: alpha(colors.scrim, 0.82) },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: space.s24,
  },
  leaf: { maxHeight: "100%", backgroundColor: ink.paper },
  inner: { gap: space.s7, padding: 22 },
  title: {
    fontFamily: fonts.display,
    fontSize: fontSizes.titleLarge,
    lineHeight: 29,
    color: ink.pageInk,
  },
  sanction: {
    gap: space.s4,
    padding: space.s7,
    borderRadius: radii.xxl,
    backgroundColor: ink.panel,
  },
  sanctionTitle: {
    fontFamily: fonts.ui.extrabold,
    fontSize: fontSizes.bodyLarge,
    color: ink.danger,
  },
  reason: {
    fontFamily: fonts.ui.semibold,
    fontSize: fontSizes.body,
    lineHeight: 21,
    color: ink.pageInk,
  },
  content: {
    fontFamily: fonts.text.italic,
    fontSize: fontSizes.bodyLarge,
    lineHeight: 22,
    color: ink.pageInkMuted,
  },
  detail: {
    fontFamily: fonts.ui.medium,
    fontSize: fontSizes.small,
    lineHeight: 18,
    color: ink.pageInkMuted,
  },
  field: {
    minHeight: 96,
    padding: space.s6,
    borderRadius: radii.xl,
    borderWidth: 2,
    borderColor: ink.track,
    backgroundColor: ink.well,
    color: ink.pageInk,
    fontFamily: fonts.ui.medium,
    fontSize: fontSizes.body,
  },
});
