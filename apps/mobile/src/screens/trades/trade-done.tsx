import type { Trade } from "@leximon/contract";
import { type Catalog, collectionName } from "@leximon/contract/client";
import { type TradeDone, tradeDoneAction, tradeDoneTitle, tradesDone } from "@leximon/view-model";
import { router, usePathname } from "expo-router";
import * as SecureStore from "expo-secure-store";
import { useEffect, useState } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import Animated, { ZoomIn } from "react-native-reanimated";
import { api } from "@/api/client";
import { Card } from "@/cards/card";
import { catalogInHand, loadCatalog } from "@/cards/catalog";
import { ownedCards, refreshIfRead } from "@/player/collection";
import { useShared } from "@/player/shared";
import { mailbox } from "@/player/state";
import { alpha, colors, fontSizes, fonts, space } from "@/theme";
import { Button } from "@/ui/button";
import { TextButton } from "@/ui/text-button";
import { catalogCard, openCard } from "./card-row";

const SHOWN_KEY = "leximon_trades_done";
/** Enough to cover every letter still unread; older ids drop off. */
const SHOWN_KEPT = 40;
/** How fresh the mail must be when the player moves to another tab. */
const MAIL_MAX_AGE_MS = 2 * 60_000;

function readShown(): ReadonlySet<number> {
  try {
    const kept: unknown = JSON.parse(SecureStore.getItem(SHOWN_KEY) ?? "[]");
    return new Set(Array.isArray(kept) ? kept.filter((id) => typeof id === "number") : []);
  } catch {
    return new Set();
  }
}

function writeShown(shown: ReadonlySet<number>): void {
  SecureStore.setItemAsync(SHOWN_KEY, JSON.stringify([...shown].slice(-SHOWN_KEPT))).catch(() => {
    // Not remembered: the moment shows once more, and the mail still holds the letter.
  });
}

/**
 * An offer the other player accepted while its sender was away: the cards that came in, big,
 * the next time the sender comes by. Once per letter on this device; the mail keeps the letter.
 */
export function TradeDoneMoment() {
  const box = useShared(mailbox);
  const pathname = usePathname();
  const [shown, setShown] = useState<ReadonlySet<number>>(readShown);
  /** `null` once looked for and not found on the first page of sent offers. */
  const [trades, setTrades] = useState<ReadonlyMap<string, Trade | null>>(new Map());
  const [catalog, setCatalog] = useState<Catalog | null>(catalogInHand);

  // Moving between tabs is when an acceptance can show up, without a poll of its own.
  // biome-ignore lint/correctness/useExhaustiveDependencies: on each new tab
  useEffect(() => {
    mailbox.read(MAIL_MAX_AGE_MS).catch(() => {});
  }, [pathname]);

  const next: TradeDone | undefined = box === null ? undefined : tradesDone(box.letters, shown)[0];
  const tradeId = next?.tradeId;

  useEffect(() => {
    if (tradeId === undefined || trades.has(tradeId)) return;
    // The sender's copies changed on the other side: the album reads them again.
    refreshIfRead(ownedCards);
    loadCatalog()
      .then(setCatalog)
      .catch(() => {});
    api
      .fetchTrades("outgoing")
      .then((page) => page.trades)
      .catch(() => [])
      .then((found) => {
        // Shown without its cards when missing: the trade sits in Échanges all the same.
        setTrades(
          (current) =>
            new Map([
              ...current,
              [tradeId, null],
              ...found.map((trade) => [trade.id, trade] as const),
            ]),
        );
      });
  }, [tradeId, trades]);

  const close = () => {
    if (next === undefined) return;
    const after = new Set([...shown, next.letterId]);
    setShown(after);
    writeShown(after);
  };

  const open = next !== undefined && trades.has(next.tradeId);
  return (
    <Modal visible={open} transparent animationType="fade" onRequestClose={close}>
      <View style={styles.backdrop}>
        {next !== undefined && (
          <Moment
            key={next.letterId}
            done={next}
            catalog={catalog}
            trade={trades.get(next.tradeId) ?? null}
            onClose={close}
          />
        )}
      </View>
    </Modal>
  );
}

function Moment({
  done,
  catalog,
  trade,
  onClose,
}: {
  readonly done: TradeDone;
  readonly catalog: Catalog | null;
  readonly trade: Trade | null;
  readonly onClose: () => void;
}) {
  // The sender gave `give` and asked for `want`: what they wanted is what came in.
  const received = trade?.want ?? [];
  const given = trade?.give ?? [];
  const width = received.length > 1 ? 96 : 168;

  const act = () => {
    onClose();
    const only = received[0];
    if (received.length === 1 && only !== undefined) openCard(only);
    else if (received.length === 0) router.navigate("/echanges");
    else router.navigate("/album");
  };

  return (
    <View style={styles.moment}>
      <Text style={styles.kicker}>ÉCHANGE CONCLU</Text>
      <Text style={styles.title} accessibilityRole="header">
        {tradeDoneTitle(done.player)}
      </Text>
      {catalog !== null && received.length > 0 && (
        <>
          <View style={styles.cards}>
            {received.map((cardId, index) => {
              const card = catalogCard(catalog, cardId);
              return (
                <Animated.View key={cardId} entering={ZoomIn.delay(160 + index * 140)}>
                  <Pressable
                    onPress={() => {
                      onClose();
                      openCard(cardId);
                    }}
                    accessibilityRole="button"
                    accessibilityLabel={`Lire ${card.word}`}
                  >
                    <View importantForAccessibility="no-hide-descendants">
                      <Card
                        card={card}
                        collectionName={collectionName(catalog, card.collectionId)}
                        width={width}
                      />
                    </View>
                  </Pressable>
                </Animated.View>
              );
            })}
          </View>
          {given.length > 0 && (
            <Text style={styles.given}>
              Contre{" "}
              {given.map((cardId, index) => (
                <Text key={cardId}>
                  {index > 0 && (index === given.length - 1 ? " et " : ", ")}
                  <Text style={styles.word}>{catalogCard(catalog, cardId).word}</Text>
                </Text>
              ))}
              .
            </Text>
          )}
        </>
      )}
      <View style={styles.actions}>
        <Button
          label={received.length === 0 ? "Voir mes échanges" : tradeDoneAction(received.length)}
          onPress={act}
        />
        <TextButton label="Plus tard" onPress={onClose} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: "center",
    padding: space.s10,
    backgroundColor: alpha(colors.scrim, 0.78),
  },
  moment: {
    alignItems: "center",
    gap: space.s7,
    paddingVertical: space.s14,
    paddingHorizontal: space.s10,
    borderRadius: 24,
    backgroundColor: colors.sheet,
  },
  kicker: {
    fontFamily: fonts.ui.extrabold,
    fontSize: fontSizes.caption,
    letterSpacing: 2,
    color: colors.success,
  },
  title: {
    fontFamily: fonts.display,
    fontSize: fontSizes.heading,
    lineHeight: 34,
    color: colors.pageInk,
    textAlign: "center",
  },
  cards: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: space.s5 },
  given: {
    fontFamily: fonts.text.regular,
    fontSize: fontSizes.lead,
    lineHeight: 24,
    color: colors.pageInkMuted,
    textAlign: "center",
  },
  word: { fontFamily: fonts.text.italic, color: colors.pageInk },
  actions: { alignSelf: "stretch", gap: space.s2, marginTop: space.s3 },
});
