import type { CatalogCard } from "@leximon/contract";
import { type Catalog, collectionName } from "@leximon/contract/client";
import { masteryColors } from "@leximon/tokens";
import {
  canOfferInTrade,
  cardPath,
  copiesLabel,
  creditLine,
  engravingOf,
  frequencyLine,
  masteryView,
  reviewLabel,
  safeSourceUrl,
  shareText,
} from "@leximon/view-model";
import { router } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { useCallback, useEffect, useState } from "react";
import { Pressable, Share, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { Card } from "@/cards/card";
import { catalogInHand, loadCatalog } from "@/cards/catalog";
import { WEB_URL } from "@/config";
import { noteCardRead, ownedCards, wordMemory } from "@/player/collection";
import { useNow, useShared } from "@/player/shared";
import { progress as progressResource } from "@/player/state";
import { colors, fonts } from "@/theme";
import { Button } from "@/ui/button";
import { Icon } from "@/ui/icon";
import { Page, Paragraph } from "@/ui/page";
import { RarityName } from "@/ui/rarity-icon";

const CARD_MAX = 300;

/** The sheet of one card: the card large, what the player knows of it, actions. */
export function CardSheet({ cardId }: { readonly cardId: string }) {
  const [catalog, setCatalog] = useState<Catalog | null>(catalogInHand);
  const [failed, setFailed] = useState(false);
  const load = useCallback(() => {
    setFailed(false);
    loadCatalog()
      .then(setCatalog)
      .catch(() => setFailed(true));
  }, []);
  useEffect(load, [load]);
  const card = catalog?.cardsById.get(cardId);

  if (catalog === null) {
    return (
      <Page title="Carte">
        {failed ? (
          <>
            <Paragraph muted>Le catalogue ne répond pas.</Paragraph>
            <Button label="Réessayer" secondary onPress={load} />
          </>
        ) : (
          <Paragraph muted>Un instant…</Paragraph>
        )}
      </Page>
    );
  }
  if (card === undefined) {
    return (
      <Page title="Carte">
        <Paragraph>Cette carte n'existe pas.</Paragraph>
      </Page>
    );
  }
  return <SheetBody card={card} collection={collectionName(catalog, card.collectionId)} />;
}

function SheetBody({
  card,
  collection,
}: {
  readonly card: CatalogCard;
  readonly collection: string;
}) {
  const window = useWindowDimensions();
  const owned = useShared(ownedCards);
  const memory = useShared(wordMemory);
  const progress = useShared(progressResource);
  const now = useNow(60_000);
  const quantity = owned?.get(card.id) ?? 0;
  const tradeable = progress !== null && canOfferInTrade(quantity, progress.level, now);

  // Opening the sheet is reading the card: the album stops calling it new.
  useEffect(() => {
    if (quantity > 0) noteCardRead(card.id);
  }, [card.id, quantity]);

  const word = memory?.get(card.id);
  const mastery = masteryView(word, now);
  const review = reviewLabel(word, now);

  const share = () => {
    const url = `${WEB_URL}${cardPath(card.id)}`;
    const text = shareText(card.word, card.perBillion);
    // Closed or refused, the share sheet says it itself: nothing to add.
    Share.share({ message: `${text} ${url}`, url, title: "Leximon" }).catch(() => undefined);
  };

  return (
    <Page title={card.word}>
      <View style={styles.cardSide}>
        <Card
          card={card}
          collectionName={collection}
          width={Math.min(CARD_MAX, window.width - 48)}
        />
        <EngravingCredit card={card} />
      </View>

      <RarityName rarity={card.rarity} color={colors.text} />
      {card.pronunciation != null && <Text style={styles.ipa}>/{card.pronunciation.ipa}/</Text>}
      <Text style={styles.frequency}>{frequencyLine(card.perBillion)}</Text>

      {quantity > 0 && (
        <View style={styles.block}>
          <Text style={styles.kicker}>MAÎTRISE</Text>
          <View style={styles.steps}>
            {mastery.steps.map((step) => {
              const tone = step.reached ? masteryColors[step.level] : colors.track;
              return (
                <View key={step.level} style={styles.step}>
                  <View style={[styles.stepBar, { backgroundColor: tone }]} />
                  <Text
                    style={[styles.stepLabel, { color: step.reached ? tone : colors.textFaint }]}
                  >
                    {step.label}
                  </Text>
                </View>
              );
            })}
          </View>
          <Text style={styles.note}>{mastery.text}</Text>
        </View>
      )}

      <View style={styles.chips}>
        <Text style={styles.chip}>
          {quantity > 0 ? copiesLabel(quantity) : "Pas encore dans ton album"}
        </Text>
        <Text style={styles.chip}>{collection}</Text>
      </View>

      {card.quote !== null && (
        <View style={styles.quote}>
          <Text style={styles.quoteText}>« {card.quote.text} »</Text>
          <Text style={styles.quoteAuthor}>{card.quote.author}</Text>
        </View>
      )}

      {card.etymology !== null && (
        <View style={styles.block}>
          <Text style={styles.kicker}>
            ORIGINE{card.era !== null ? ` · ${card.era.toUpperCase()}` : ""}
          </Text>
          <Text style={styles.etymology}>{card.etymology}</Text>
        </View>
      )}

      {quantity > 0 ? (
        <View style={styles.actions}>
          {/* No shortcut to a question here: the card above shows its answer. */}
          {review !== null && <Text style={styles.later}>{review}</Text>}
          {tradeable && (
            <Button
              label="Proposer en échange"
              secondary
              onPress={() =>
                router.dismissTo({ pathname: "/echanges", params: { donne: card.id } })
              }
            />
          )}
          <Pressable onPress={share} accessibilityRole="button" style={styles.ghost}>
            <Icon name="share" size={17} color={colors.text} />
            <Text style={styles.ghostText}>Partager</Text>
          </Pressable>
        </View>
      ) : (
        <Text style={styles.note}>
          <Text style={styles.link} accessibilityRole="link" onPress={() => router.navigate("/")}>
            Ouvre des sachets
          </Text>{" "}
          pour la trouver, ou demande-la en échange.
        </Text>
      )}
    </Page>
  );
}

/**
 * Credit of the card's engraving, under the card shown large: the small card face has no room
 * for it, and CC BY requires it somewhere the player can see.
 */
function EngravingCredit({ card }: { readonly card: CatalogCard }) {
  const engraving = engravingOf(card);
  if (engraving === null) return null;
  const source = safeSourceUrl(engraving);
  return (
    <Text style={styles.credit}>
      Gravure : {creditLine(engraving)}
      {source !== null && (
        <>
          {" · "}
          <Text
            style={styles.link}
            accessibilityRole="link"
            onPress={() => void WebBrowser.openBrowserAsync(source)}
          >
            source
          </Text>
        </>
      )}
    </Text>
  );
}

const styles = StyleSheet.create({
  cardSide: { alignItems: "center", gap: 10, marginBottom: 4 },
  credit: {
    fontFamily: fonts.ui.medium,
    fontSize: 12,
    lineHeight: 17,
    color: colors.textFaint,
    textAlign: "center",
  },
  ipa: { fontFamily: fonts.text.regular, fontSize: 19, color: colors.textMuted },
  frequency: { fontFamily: fonts.text.italic, fontSize: 17, lineHeight: 24, color: "#D9D3E6" },
  block: { gap: 8 },
  kicker: {
    fontFamily: fonts.ui.extrabold,
    fontSize: 12,
    letterSpacing: 2,
    color: colors.textMuted,
  },
  steps: { flexDirection: "row", gap: 8 },
  step: { flex: 1, gap: 6 },
  stepBar: { height: 6, borderRadius: 3 },
  stepLabel: { fontFamily: fonts.ui.bold, fontSize: 13 },
  note: { fontFamily: fonts.ui.medium, fontSize: 15, lineHeight: 21, color: colors.textMuted },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    overflow: "hidden",
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 16,
    backgroundColor: colors.backgroundRaised,
    color: colors.text,
    fontFamily: fonts.ui.bold,
    fontSize: 14,
  },
  quote: { paddingLeft: 14, borderLeftWidth: 3, borderLeftColor: colors.track, gap: 6 },
  quoteText: { fontFamily: fonts.text.italic, fontSize: 18, lineHeight: 26, color: colors.text },
  quoteAuthor: { fontFamily: fonts.ui.semibold, fontSize: 14, color: colors.textMuted },
  etymology: { fontFamily: fonts.text.regular, fontSize: 17, lineHeight: 25, color: colors.text },
  actions: { gap: 10, alignItems: "flex-start" },
  later: { fontFamily: fonts.ui.bold, fontSize: 15, color: colors.text },
  ghost: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    minHeight: 44,
    paddingHorizontal: 14,
    borderRadius: 22,
    borderWidth: 2,
    borderColor: colors.track,
  },
  ghostText: { fontFamily: fonts.ui.bold, fontSize: 15, color: colors.text },
  link: { color: colors.accent, textDecorationLine: "underline" },
});
