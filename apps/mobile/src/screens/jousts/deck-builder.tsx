import type { JoustDeckResponse } from "@leximon/contract";
import { toyMatters, toy as toyValues } from "@leximon/tokens";
import {
  COMPLETE_DECK,
  completeDeck,
  deckRefusalText,
  SAVE_DECK,
  toggleDeckCard,
} from "@leximon/view-model";
import { type ReactNode, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated, { Keyframe } from "react-native-reanimated";
import { api } from "@/api/client";
import { useCatalog } from "@/cards/use-catalog";
import { play } from "@/feedback/feedback";
import { catalogCard } from "@/screens/trades/card-row";
import { fontSizes, fonts, radii, space } from "@/theme";
import { Lettering, Toy } from "@/ui/toy";
import { ink, LeafKicker, MiniCard, Notice } from "./pieces";
import { NO_ANSWER } from "./use-launch";

/** A card dropped in its place lands with a little bounce. */
const dropIn = new Keyframe({
  0: { opacity: 0, transform: [{ translateY: -14 }, { scale: 1.12 }] },
  70: { opacity: 1, transform: [{ translateY: 2 }, { scale: 0.98 }] },
  100: { opacity: 1, transform: [{ translateY: 0 }, { scale: 1 }] },
}).duration(260);

const SLOTS_PER_ROW = 5;
const SLOT_GAP = space.s3;

/**
 * The deck being composed: its places, the gauge of its points, « Compléter pour moi », and the
 * words found that can enter it. Saved on the server, which checks it again.
 */
export function DeckBuilder({
  deck,
  initial,
  intro,
  onSaved,
}: {
  readonly deck: JoustDeckResponse;
  readonly initial: readonly string[];
  readonly intro?: ReactNode;
  readonly onSaved: () => void;
}) {
  const catalog = useCatalog();
  const [chosen, setChosen] = useState<readonly string[]>(initial);
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  // The places share the row's width, measured once laid out.
  const [rowWidth, setRowWidth] = useState(0);
  const slotWidth =
    rowWidth === 0 ? 56 : Math.floor((rowWidth - (SLOTS_PER_ROW - 1) * SLOT_GAP) / SLOTS_PER_ROW);
  const costs = new Map(deck.candidates.map((candidate) => [candidate.cardId, candidate.cost]));
  const costOf = (cardId: string) => costs.get(cardId) ?? 0;
  const spent = chosen.reduce((total, id) => total + costOf(id), 0);

  const toggle = (cardId: string) => {
    const next = toggleDeckCard(chosen, cardId, costOf, deck);
    setChosen(next.deck);
    setMessage(next.refused);
    if (next.refused === null) play("cardSlide");
  };

  const complete = () => {
    setChosen(completeDeck(chosen, deck.candidates, deck));
    setMessage(null);
    play("cardSlide");
  };

  const save = async () => {
    setSaving(true);
    setMessage(null);
    try {
      const result = await api.saveJoustDeck(chosen);
      if (result.kind === "saved") onSaved();
      else setMessage(deckRefusalText(result.reason));
    } catch {
      setMessage(NO_ANSWER);
    } finally {
      setSaving(false);
    }
  };

  const pool = [...deck.candidates].sort(
    (a, b) => b.cost - a.cost || a.cardId.localeCompare(b.cardId),
  );
  const canSave = chosen.length >= deck.min;
  return (
    <View style={styles.builder}>
      {intro}
      <View style={styles.slots} onLayout={(event) => setRowWidth(event.nativeEvent.layout.width)}>
        {Array.from({ length: deck.size }, (_, index) => {
          const cardId = chosen[index];
          if (cardId === undefined || catalog === null) {
            return (
              // biome-ignore lint/suspicious/noArrayIndexKey: places of the deck, in order
              <View key={index} style={[styles.slot, { width: slotWidth }]}>
                <Text style={styles.slotNumber}>{index + 1}</Text>
              </View>
            );
          }
          const card = catalogCard(catalog, cardId);
          return (
            <Pressable
              key={cardId}
              style={{ width: slotWidth }}
              onPress={() => toggle(cardId)}
              accessibilityRole="button"
              accessibilityLabel={`Retirer ${card.word}`}
            >
              <Animated.View entering={dropIn}>
                <MiniCard card={card} cost={costOf(cardId)} width={slotWidth} />
              </Animated.View>
            </Pressable>
          );
        })}
      </View>
      <View style={styles.gauge}>
        <Text style={styles.gaugeLabel}>Points</Text>
        <View style={styles.gaugeBar}>
          <View
            style={[styles.gaugeFill, { width: `${Math.min(100, (spent / deck.budget) * 100)}%` }]}
          />
        </View>
        <Text style={styles.gaugeFigure} accessibilityLiveRegion="polite">
          {spent} / {deck.budget}
        </Text>
      </View>
      <Notice>{message}</Notice>
      <View style={styles.actions}>
        <Toy
          matter={canSave ? "gold" : "locked"}
          large
          style={styles.action}
          accessibilityRole="button"
          accessibilityLabel={SAVE_DECK}
          disabled={saving || !canSave}
          onPress={() => void save()}
        >
          <Lettering size={fontSizes.lead}>{SAVE_DECK}</Lettering>
        </Toy>
        <Toy
          matter="paper"
          style={styles.action}
          accessibilityRole="button"
          accessibilityLabel={COMPLETE_DECK}
          disabled={chosen.length >= deck.size}
          onPress={complete}
        >
          <Lettering size={fontSizes.body}>{COMPLETE_DECK}</Lettering>
        </Toy>
      </View>
      <LeafKicker>Tes mots trouvés</LeafKicker>
      {catalog !== null && (
        <View style={styles.pool}>
          {pool.map((candidate) => {
            const card = catalogCard(catalog, candidate.cardId);
            const taken = chosen.includes(candidate.cardId);
            const fits = spent + candidate.cost <= deck.budget && chosen.length < deck.size;
            return (
              <Pressable
                key={candidate.cardId}
                style={[styles.poolCard, (taken || !fits) && styles.poolOff]}
                disabled={taken || !fits}
                accessibilityRole="button"
                accessibilityState={{ disabled: taken || !fits, selected: taken }}
                accessibilityLabel={`${card.word}, ${candidate.cost} points`}
                onPress={() => toggle(candidate.cardId)}
              >
                <MiniCard card={card} cost={candidate.cost} />
              </Pressable>
            );
          })}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  builder: { gap: space.s6 },
  slots: { flexDirection: "row", flexWrap: "wrap", gap: SLOT_GAP },
  slot: {
    minHeight: 52,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radii.sm,
    borderWidth: 2,
    borderStyle: "dashed",
    borderColor: ink.rule,
    backgroundColor: ink.well,
  },
  slotNumber: { fontFamily: fonts.ui.extrabold, fontSize: fontSizes.body, color: ink.pageInkFaint },
  gauge: { flexDirection: "row", alignItems: "center", gap: space.s4 },
  gaugeLabel: { fontFamily: fonts.ui.extrabold, fontSize: fontSizes.small, color: ink.pageInk },
  gaugeBar: {
    flex: 1,
    height: 14,
    overflow: "hidden",
    borderRadius: 7,
    borderWidth: 2,
    borderColor: toyValues.outline,
    backgroundColor: ink.track,
  },
  gaugeFill: { height: "100%", backgroundColor: toyMatters.gold.top },
  gaugeFigure: { fontFamily: fonts.ui.extrabold, fontSize: fontSizes.body, color: ink.pageInk },
  actions: { gap: space.s3 },
  action: { height: 50 },
  pool: { flexDirection: "row", flexWrap: "wrap", gap: space.s3, justifyContent: "center" },
  poolCard: { borderRadius: radii.sm },
  poolOff: { opacity: 0.4 },
});
