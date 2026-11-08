import { type JoustDeckResponse, RARITY_LABELS } from "@leximon/contract";
import { cardSize, toyMatters, toy as toyValues } from "@leximon/tokens";
import {
  COMPLETE_DECK,
  completeDeck,
  deckPoolGroups,
  deckRefusalText,
  deckRoomLine,
  plural,
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
import { Icon } from "@/ui/icon";
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
const POOL_PER_ROW = 3;
const POOL_GAP = space.s4;

/**
 * The deck being composed: its places as real cards, the gauge of its points and what room is
 * left, « Compléter pour moi », and the words found that can enter it, by rarity. Saved on the
 * server, which checks it again.
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
  // The cards share the row's width, measured once laid out.
  const [rowWidth, setRowWidth] = useState(0);
  const share = (perRow: number, gap: number, fallback: number) =>
    rowWidth === 0 ? fallback : Math.floor((rowWidth - (perRow - 1) * gap) / perRow);
  const slotWidth = share(SLOTS_PER_ROW, SLOT_GAP, 56);
  const poolWidth = share(POOL_PER_ROW, POOL_GAP, 96);
  const costs = new Map(deck.candidates.map((candidate) => [candidate.cardId, candidate.cost]));
  const costOf = (cardId: string) => costs.get(cardId) ?? 0;
  const traps = new Map(deck.trapped.map((card) => [card.cardId, card.count]));
  const spent = chosen.reduce((total, id) => total + costOf(id), 0);
  const left = deck.candidates.filter((candidate) => !chosen.includes(candidate.cardId));
  const cheapestLeft = left.length === 0 ? null : Math.min(...left.map((c) => c.cost));

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

  const groups =
    catalog === null
      ? []
      : deckPoolGroups(
          deck.candidates.map((candidate) => ({
            ...candidate,
            card: catalogCard(catalog, candidate.cardId),
          })),
        );
  const canSave = chosen.length >= deck.min;
  const slotHeight = (slotWidth * cardSize.height) / cardSize.width;
  return (
    <View style={styles.builder}>
      {intro}
      <View style={styles.tray}>
        <View style={styles.trayHead}>
          <LeafKicker>{`Ton deck · ${chosen.length} / ${plural(deck.size, "carte", "cartes")}`}</LeafKicker>
          <View style={styles.gauge}>
            <Text style={styles.gaugeLabel}>Points</Text>
            <View style={styles.gaugeBar}>
              <View
                style={[
                  styles.gaugeFill,
                  { width: `${Math.min(100, (spent / deck.budget) * 100)}%` },
                ]}
              />
            </View>
            <Text style={styles.gaugeFigure} accessibilityLiveRegion="polite">
              {spent} / {deck.budget}
            </Text>
          </View>
        </View>
        <View
          style={styles.slots}
          onLayout={(event) => setRowWidth(event.nativeEvent.layout.width)}
        >
          {Array.from({ length: deck.size }, (_, index) => {
            const cardId = chosen[index];
            if (cardId === undefined || catalog === null) {
              return (
                <View
                  // biome-ignore lint/suspicious/noArrayIndexKey: places of the deck, in order
                  key={index}
                  style={[styles.slot, { width: slotWidth, height: slotHeight }]}
                >
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
                  <MiniCard
                    card={card}
                    cost={costOf(cardId)}
                    trapped={traps.get(cardId) ?? 0}
                    width={slotWidth}
                  />
                </Animated.View>
              </Pressable>
            );
          })}
        </View>
        <Text style={styles.room} accessibilityLiveRegion="polite">
          {deckRoomLine(chosen.length, spent, deck, cheapestLeft)}
        </Text>
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
      </View>

      <LeafKicker>Tes mots trouvés</LeafKicker>
      {groups.map((group) => (
        <View key={group.rarity} style={styles.poolGroup}>
          <Text style={styles.poolHead}>
            {`${RARITY_LABELS[group.rarity]} · ${plural(group.cost, "point", "points")}`}
          </Text>
          <View style={styles.pool}>
            {group.cards.map((candidate) => {
              const taken = chosen.includes(candidate.cardId);
              const fits = spent + candidate.cost <= deck.budget && chosen.length < deck.size;
              return (
                <Pressable
                  key={candidate.cardId}
                  style={[{ width: poolWidth }, !taken && !fits && styles.poolOff]}
                  disabled={!taken && !fits}
                  accessibilityRole="button"
                  accessibilityState={{ disabled: !taken && !fits, selected: taken }}
                  accessibilityLabel={`${candidate.card.word}, ${plural(candidate.cost, "point", "points")}`}
                  onPress={() => toggle(candidate.cardId)}
                >
                  <MiniCard
                    card={candidate.card}
                    trapped={traps.get(candidate.cardId) ?? 0}
                    width={poolWidth}
                    style={taken && styles.poolTaken}
                  />
                  {taken && (
                    <View style={styles.takenMark}>
                      <View style={styles.takenSeal}>
                        <Icon name="check" size={20} color={toyMatters.paper.top} />
                      </View>
                    </View>
                  )}
                </Pressable>
              );
            })}
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  builder: { gap: space.s6 },
  tray: {
    gap: space.s5,
    padding: space.s5,
    borderRadius: radii.lg,
    borderWidth: 2,
    borderColor: ink.rule,
    backgroundColor: ink.well,
  },
  trayHead: { gap: space.s3 },
  // Room between the rows for the coins and seals that stand out of the cards.
  slots: { flexDirection: "row", flexWrap: "wrap", columnGap: SLOT_GAP, rowGap: space.s8 },
  slot: {
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radii.sm,
    borderWidth: 2,
    borderStyle: "dashed",
    borderColor: ink.rule,
    backgroundColor: ink.pageRaised,
  },
  slotNumber: { fontFamily: fonts.ui.extrabold, fontSize: fontSizes.body, color: ink.pageInkFaint },
  room: {
    fontFamily: fonts.ui.semibold,
    fontSize: fontSizes.small,
    lineHeight: 19,
    color: ink.pageInkMuted,
    textAlign: "center",
  },
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
  poolGroup: { gap: space.s3 },
  poolHead: { fontFamily: fonts.ui.extrabold, fontSize: fontSizes.small, color: ink.rubric },
  pool: { flexDirection: "row", flexWrap: "wrap", gap: POOL_GAP },
  poolOff: { opacity: 0.4 },
  poolTaken: { opacity: 0.45 },
  // Over the engraving, so that the word stays readable.
  takenMark: { position: "absolute", left: 0, right: 0, top: "9%", alignItems: "center" },
  takenSeal: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 18,
    borderWidth: 2,
    borderColor: toyValues.outline,
    backgroundColor: toyMatters.green.top,
  },
});
