import type { CatalogCard } from "@leximon/contract";
import { type Catalog, collectionName } from "@leximon/contract/client";
import { masteryColors } from "@leximon/tokens";
import {
  CARD_REPORT,
  canOfferInTrade,
  cardPath,
  copiesLabel,
  creditLine,
  engravingOf,
  frequencyLine,
  masteryView,
  PIN_TEXTS,
  placePin,
  reviewLabel,
  safeSourceUrl,
  shareText,
  unpin,
} from "@leximon/view-model";
import { router } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { useCallback, useEffect, useState } from "react";
import { Pressable, Share, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { catalogInHand, loadCatalog } from "@/cards/catalog";
import { HoloCard } from "@/cards/holo-card";
import { WEB_URL } from "@/config";
import { noteCardRead, ownedCards, wordMemory } from "@/player/collection";
import { useNow, useShared } from "@/player/shared";
import { progress as progressResource } from "@/player/state";
import { useProfileActions } from "@/profile/profile-actions";
import { FeedbackSheet } from "@/screens/profile/feedback-sheet";
import { ReplacePin } from "@/screens/profile/pin-picker";
import { colors, fontSizes, fonts, radii, space } from "@/theme";
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
            <Paragraph muted>Les cartes n'ont pas pu être chargées. Réessaie.</Paragraph>
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

  const pins = useProfileActions();
  /** Every place was taken: the player picks which pinned card this one replaces. */
  const [replacing, setReplacing] = useState(false);
  const [reporting, setReporting] = useState(false);
  const togglePin = () => {
    const me = pins.profile;
    if (me === null) return;
    if (pins.isPinned(card.id)) {
      void pins.setPins(unpin(me.pinned, card.id), PIN_TEXTS.removed);
      return;
    }
    const change = placePin(me.pinned, me.pinnedSlots, card.id, null);
    if (change.ok) void pins.setPins(change.cardIds, PIN_TEXTS.pinned);
    else setReplacing(true);
  };
  const replacePin = (index: number) => {
    setReplacing(false);
    const me = pins.profile;
    if (me === null) return;
    const change = placePin(me.pinned, me.pinnedSlots, card.id, index);
    if (change.ok) void pins.setPins(change.cardIds, PIN_TEXTS.pinned);
  };

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
        <HoloCard
          card={card}
          collectionName={collection}
          width={Math.min(CARD_MAX, window.width - 48)}
        />
        <EngravingCredit card={card} />
      </View>

      <RarityName rarity={card.rarity} color={colors.pageInk} />
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
                    style={[styles.stepLabel, { color: step.reached ? tone : colors.pageInkFaint }]}
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
          <View style={styles.ghosts}>
            {pins.profile?.member === true && (
              <Pressable
                onPress={togglePin}
                disabled={pins.busy}
                accessibilityRole="button"
                accessibilityState={{ selected: pins.isPinned(card.id) }}
                style={styles.ghost}
              >
                <Icon name="pin" size={17} color={colors.pageInk} />
                <Text style={styles.ghostText}>
                  {pins.isPinned(card.id) ? PIN_TEXTS.unpin : PIN_TEXTS.pin}
                </Text>
              </Pressable>
            )}
            <Pressable onPress={share} accessibilityRole="button" style={styles.ghost}>
              <Icon name="share" size={17} color={colors.pageInk} />
              <Text style={styles.ghostText}>Partager</Text>
            </Pressable>
          </View>
          <ReplacePin
            open={replacing}
            word={card.word}
            catalog={catalogInHand()}
            pinned={pins.profile?.pinned ?? []}
            onPick={replacePin}
            onClose={() => setReplacing(false)}
          />
        </View>
      ) : (
        <Text style={styles.note}>
          <Text style={styles.link} accessibilityRole="link" onPress={() => router.navigate("/")}>
            Ouvre des sachets
          </Text>{" "}
          pour la trouver, ou demande-la en échange.
        </Text>
      )}

      <Pressable
        onPress={() => setReporting(true)}
        accessibilityRole="button"
        hitSlop={8}
        style={styles.report}
      >
        <Text style={styles.reportText}>{CARD_REPORT.button}</Text>
      </Pressable>
      <FeedbackSheet
        open={reporting}
        onClose={() => setReporting(false)}
        screen={`/mobile${cardPath(card.id)}`}
        title={CARD_REPORT.title}
        label={CARD_REPORT.label}
      />
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
  cardSide: { alignItems: "center", gap: space.s5, marginBottom: space.s2 },
  credit: {
    fontFamily: fonts.ui.medium,
    fontSize: fontSizes.caption,
    lineHeight: 17,
    color: colors.pageInkFaint,
    textAlign: "center",
  },
  ipa: { fontFamily: fonts.text.regular, fontSize: fontSizes.subtitle, color: colors.pageInkMuted },
  frequency: {
    fontFamily: fonts.text.italic,
    fontSize: fontSizes.lead,
    lineHeight: 24,
    color: colors.pageInkSoft,
  },
  block: { gap: space.s4 },
  kicker: {
    fontFamily: fonts.ui.extrabold,
    fontSize: fontSizes.caption,
    letterSpacing: 2,
    color: colors.pageInkMuted,
  },
  steps: { flexDirection: "row", gap: space.s4 },
  step: { flex: 1, gap: space.s3 },
  stepBar: { height: 6, borderRadius: 3 },
  stepLabel: { fontFamily: fonts.ui.bold, fontSize: fontSizes.small },
  note: {
    fontFamily: fonts.ui.medium,
    fontSize: fontSizes.body,
    lineHeight: 21,
    color: colors.pageInkMuted,
  },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: space.s4 },
  chip: {
    overflow: "hidden",
    paddingHorizontal: space.s6,
    paddingVertical: 7,
    borderRadius: radii.xxl,
    backgroundColor: colors.pageRaised,
    color: colors.pageInk,
    fontFamily: fonts.ui.bold,
    fontSize: fontSizes.label,
  },
  quote: {
    paddingLeft: space.s7,
    borderLeftWidth: 3,
    borderLeftColor: colors.track,
    gap: space.s3,
  },
  quoteText: {
    fontFamily: fonts.text.italic,
    fontSize: fontSizes.subtitle,
    lineHeight: 26,
    color: colors.pageInk,
  },
  quoteAuthor: {
    fontFamily: fonts.ui.semibold,
    fontSize: fontSizes.label,
    color: colors.pageInkMuted,
  },
  etymology: {
    fontFamily: fonts.text.regular,
    fontSize: fontSizes.lead,
    lineHeight: 25,
    color: colors.pageInk,
  },
  actions: { gap: space.s5, alignItems: "flex-start" },
  later: { fontFamily: fonts.ui.bold, fontSize: fontSizes.body, color: colors.pageInk },
  ghosts: { flexDirection: "row", justifyContent: "center", gap: space.s5 },
  ghost: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.s4,
    minHeight: 44,
    paddingHorizontal: space.s7,
    borderRadius: radii.x4,
    borderWidth: 2,
    borderColor: colors.track,
  },
  ghostText: { fontFamily: fonts.ui.bold, fontSize: fontSizes.body, color: colors.pageInk },
  link: { color: colors.rubric, textDecorationLine: "underline" },
  report: { alignSelf: "flex-start", paddingVertical: space.s3 },
  reportText: {
    fontFamily: fonts.ui.medium,
    fontSize: fontSizes.label,
    color: colors.pageInkFaint,
    textDecorationLine: "underline",
  },
});
