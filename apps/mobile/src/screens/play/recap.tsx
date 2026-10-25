import { type Catalog, cardOrPlaceholder } from "@leximon/contract/client";
import { cardSize, colors } from "@leximon/tokens";
import {
  collectionProgress,
  levelRatio,
  levelUpLabel,
  openAgainLabel,
  recap,
  xpGainLabel,
} from "@leximon/view-model";
import { router } from "expo-router";
import { useState } from "react";
import { ScrollView, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import Animated, { FadeInRight } from "react-native-reanimated";
import { Card } from "@/cards/card";
import { useNow, useShared } from "@/player/shared";
import { progress as progressResource, wallet as walletResource } from "@/player/state";
import { TAB_BAR_RISE } from "@/shell/tab-bar";
import { fonts } from "@/theme";
import { Button } from "@/ui/button";
import { XpBar } from "@/ui/level";
import { RarityName } from "@/ui/rarity-icon";
import { isNewAt, type Pack } from "./pack";

const GAP = 14;
/** Room left at the edge for the next card to show. */
const PEEK = 96;
const CARD_MAX = 260;
/** Height kept around the cards: the recap's lines and buttons. */
const CHROME = 300;
const STEP_MS = 80;

/** What the sachet gave, one card after the other, and the level it raised. */
export function Recap({
  catalog,
  pack,
  mustSignUp,
  onOpen,
}: {
  readonly catalog: Catalog;
  readonly pack: Pack;
  readonly mustSignUp: boolean;
  readonly onOpen: () => void;
}) {
  const window = useWindowDimensions();
  const [room, setRoom] = useState(window.height);
  const now = useNow(15_000);
  const progressNow = useShared(progressResource);
  const wallet = useShared(walletResource);
  const width = Math.floor(
    Math.max(
      160,
      Math.min(CARD_MAX, window.width - PEEK, ((room - CHROME) * cardSize.width) / cardSize.height),
    ),
  );
  const [active, setActive] = useState(0);
  const { best, fresh } = recap(pack.cards, pack.quantitiesBefore);
  const progress = collectionProgress(pack.collectionCardIds, pack.quantitiesBefore, pack.cards);
  const xp = xpGainLabel(pack.progress);
  const levelUp = levelUpLabel(pack.progress);
  const canOpen = wallet !== null && (wallet.stored > 0 || wallet.bonus > 0);
  return (
    <View style={styles.recap} onLayout={(event) => setRoom(event.nativeEvent.layout.height)}>
      <Text style={styles.kicker}>TON SACHET</Text>
      <View style={styles.line}>
        {best !== null && <RarityName rarity={best.rarity} text={best.label} color={colors.text} />}
        {best !== null && <Text style={styles.lineText}>·</Text>}
        <Text style={styles.lineText}>{fresh}</Text>
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        snapToInterval={width + GAP}
        decelerationRate="fast"
        contentContainerStyle={{ gap: GAP, paddingHorizontal: (window.width - width) / 2 }}
        onScroll={(event) =>
          setActive(Math.round(event.nativeEvent.contentOffset.x / (width + GAP)))
        }
        scrollEventThrottle={32}
        style={styles.carousel}
      >
        {pack.cards.map((drawn, index) => (
          <Animated.View
            // biome-ignore lint/suspicious/noArrayIndexKey: a pack can hold the same card twice.
            key={index}
            entering={FadeInRight.delay(index * STEP_MS).duration(260)}
          >
            <Card
              card={cardOrPlaceholder(catalog, drawn.cardId, drawn.rarity)}
              collectionName={pack.collectionName}
              width={width}
            />
            {isNewAt(pack, index) && <Text style={styles.new}>Nouveau</Text>}
          </Animated.View>
        ))}
      </ScrollView>
      <View style={styles.dots} importantForAccessibility="no-hide-descendants">
        {pack.cards.map((_, index) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: one dot per card of the pack.
          <View key={index} style={[styles.dot, index === active && styles.dotOn]} />
        ))}
      </View>
      {xp !== null && <Text style={styles.xp}>{xp}</Text>}
      {progressNow !== null && (
        <View style={styles.bar}>
          <XpBar ratio={levelRatio(progressNow)} thin />
        </View>
      )}
      {levelUp !== null && <Text style={styles.levelUp}>{levelUp}</Text>}
      <Text style={styles.progress}>
        {pack.collectionName} · {progress.owned} / {progress.total}
        {progress.gained > 0 && <Text style={styles.gained}> (+{progress.gained})</Text>}
      </Text>
      <View style={styles.actions}>
        {!mustSignUp && (
          <Button
            label={wallet === null ? "Ouvrir un autre sachet" : openAgainLabel(wallet, now)}
            disabled={!canOpen}
            onPress={onOpen}
          />
        )}
        <Button label="Voir mon album" secondary onPress={() => router.navigate("/album")} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  recap: { flex: 1, alignItems: "center", paddingTop: 12, gap: 8 },
  kicker: {
    fontFamily: fonts.ui.extrabold,
    fontSize: 12,
    letterSpacing: 2,
    color: colors.textMuted,
  },
  line: { flexDirection: "row", alignItems: "center", gap: 8 },
  lineText: { fontFamily: fonts.ui.bold, fontSize: 15, color: colors.text },
  carousel: { flexGrow: 0, paddingVertical: 14 },
  new: {
    position: "absolute",
    top: -10,
    right: -6,
    overflow: "hidden",
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 12,
    backgroundColor: colors.sticker,
    color: "#fff",
    fontFamily: fonts.ui.extrabold,
    fontSize: 12,
  },
  dots: { flexDirection: "row", gap: 6 },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.outline },
  dotOn: { backgroundColor: colors.accent },
  xp: { fontFamily: fonts.display, fontSize: 26, color: colors.accent, marginTop: 4 },
  bar: { width: 200 },
  levelUp: { fontFamily: fonts.ui.extrabold, fontSize: 16, color: colors.text },
  progress: { fontFamily: fonts.ui.semibold, fontSize: 14, color: colors.textMuted },
  gained: { color: colors.success },
  actions: {
    alignSelf: "stretch",
    paddingHorizontal: 24,
    paddingBottom: TAB_BAR_RISE,
    gap: 10,
    marginTop: 6,
  },
});
