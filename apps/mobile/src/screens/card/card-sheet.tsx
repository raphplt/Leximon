import type { CatalogCard } from "@leximon/contract";
import { type Catalog, collectionName } from "@leximon/contract/client";
import { masteryColors } from "@leximon/tokens";
import {
  CARD_REPORT,
  CARD_RUN_TEXTS,
  type CardRun,
  canOfferInTrade,
  cardPath,
  cardRun,
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
import { cardsAround } from "@/cards/card-run";
import { catalogInHand, loadCatalog } from "@/cards/catalog";
import { HoloCard } from "@/cards/holo-card";
import { WEB_URL } from "@/config";
import { noteCardRead, ownedCards, wordMemory } from "@/player/collection";
import { useNow, useShared } from "@/player/shared";
import { progress as progressResource } from "@/player/state";
import { useProfileActions } from "@/profile/profile-actions";
import { FeedbackSheet } from "@/screens/profile/feedback-sheet";
import { ReplacePin } from "@/screens/profile/pin-picker";
import { colors, fontSizes, fonts, paperColors, radii, space } from "@/theme";
import { Button } from "@/ui/button";
import { Icon } from "@/ui/icon";
import { Page, Paragraph } from "@/ui/page";
import { OnPaper } from "@/ui/panel";
import { RarityName } from "@/ui/rarity-icon";
import { Toy } from "@/ui/toy";

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
  return (
    <SheetBody
      card={card}
      run={cardRun(cardsAround(), card.id)}
      collection={collectionName(catalog, card.collectionId)}
    />
  );
}

/** An arrow beside the card, to the one before or after; greyed at either end. */
function TurnButton({
  label,
  icon,
  to,
}: {
  readonly label: string;
  readonly icon: "back" | "chev";
  readonly to: string | null;
}) {
  return (
    <Toy
      matter="paper"
      shape="round"
      style={[styles.turn, to === null && styles.turnOff]}
      bodyStyle={styles.turnBody}
      disabled={to === null}
      accessibilityRole="button"
      accessibilityLabel={label}
      // The same screen shows the next card: no pile of sheets to go back through.
      onPress={() => {
        if (to !== null) router.setParams({ id: to });
      }}
    >
      <Icon name={icon} size={20} color={paperColors.pageInk} />
    </Toy>
  );
}

function SheetBody({
  card,
  run,
  collection,
}: {
  readonly card: CatalogCard;
  readonly run: CardRun | null;
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
    <Page title={card.word} desk>
      <View style={styles.cardSide}>
        <View style={styles.turning}>
          {run !== null && (
            <TurnButton label={CARD_RUN_TEXTS.previous} icon="back" to={run.previous} />
          )}
          <HoloCard
            card={card}
            collectionName={collection}
            width={Math.min(CARD_MAX, window.width - (run === null ? 48 : 136))}
          />
          {run !== null && <TurnButton label={CARD_RUN_TEXTS.next} icon="chev" to={run.next} />}
        </View>
        {run !== null && <Text style={styles.place}>{run.place}</Text>}
        <EngravingCredit card={card} />
      </View>

      <OnPaper>
        <RarityName rarity={card.rarity} color={ink.pageInk} />
        {card.pronunciation != null && <Text style={styles.ipa}>/{card.pronunciation.ipa}/</Text>}
        <Text style={styles.frequency}>{frequencyLine(card.perBillion)}</Text>

        {quantity > 0 && (
          <View style={styles.block}>
            <Text style={styles.kicker}>MAÎTRISE</Text>
            <View style={styles.steps}>
              {mastery.steps.map((step) => {
                const tone = step.reached ? masteryColors[step.level] : ink.track;
                return (
                  <View key={step.level} style={styles.step}>
                    <View style={[styles.stepBar, { backgroundColor: tone }]} />
                    <Text
                      style={[styles.stepLabel, { color: step.reached ? tone : ink.pageInkFaint }]}
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
                  <Icon name="pin" size={17} color={ink.pageInk} />
                  <Text style={styles.ghostText}>
                    {pins.isPinned(card.id) ? PIN_TEXTS.unpin : PIN_TEXTS.pin}
                  </Text>
                </Pressable>
              )}
              <Pressable onPress={share} accessibilityRole="button" style={styles.ghost}>
                <Icon name="share" size={17} color={ink.pageInk} />
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
      </OnPaper>
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
            style={styles.creditLink}
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

/** The facts are read on paper: the same roles, in brown ink. */
const ink = paperColors;

const styles = StyleSheet.create({
  cardSide: { alignItems: "center", gap: space.s5, marginBottom: space.s2 },
  turning: { flexDirection: "row", alignItems: "center", gap: space.s3 },
  turn: { width: 40, height: 44 },
  turnBody: { alignItems: "center", justifyContent: "center" },
  turnOff: { opacity: 0.35 },
  place: { fontFamily: fonts.ui.bold, fontSize: fontSizes.caption, color: colors.pageInkMuted },
  credit: {
    fontFamily: fonts.ui.medium,
    fontSize: fontSizes.caption,
    lineHeight: 17,
    color: colors.pageInkFaint,
    textAlign: "center",
  },
  creditLink: { color: colors.rubric, textDecorationLine: "underline" },
  ipa: { fontFamily: fonts.text.regular, fontSize: fontSizes.subtitle, color: ink.pageInkMuted },
  frequency: {
    fontFamily: fonts.text.italic,
    fontSize: fontSizes.lead,
    lineHeight: 24,
    color: ink.pageInkSoft,
  },
  block: { gap: space.s4 },
  kicker: {
    fontFamily: fonts.ui.extrabold,
    fontSize: fontSizes.caption,
    letterSpacing: 2,
    color: ink.pageInkMuted,
  },
  steps: { flexDirection: "row", gap: space.s4 },
  step: { flex: 1, gap: space.s3 },
  stepBar: { height: 6, borderRadius: 3 },
  stepLabel: { fontFamily: fonts.ui.bold, fontSize: fontSizes.small },
  note: {
    fontFamily: fonts.ui.medium,
    fontSize: fontSizes.body,
    lineHeight: 21,
    color: ink.pageInkMuted,
  },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: space.s4 },
  chip: {
    overflow: "hidden",
    paddingHorizontal: space.s6,
    paddingVertical: 7,
    borderRadius: radii.xxl,
    backgroundColor: ink.pageRaised,
    color: ink.pageInk,
    fontFamily: fonts.ui.bold,
    fontSize: fontSizes.label,
  },
  quote: {
    paddingLeft: space.s7,
    borderLeftWidth: 3,
    borderLeftColor: ink.track,
    gap: space.s3,
  },
  quoteText: {
    fontFamily: fonts.text.italic,
    fontSize: fontSizes.subtitle,
    lineHeight: 26,
    color: ink.pageInk,
  },
  quoteAuthor: {
    fontFamily: fonts.ui.semibold,
    fontSize: fontSizes.label,
    color: ink.pageInkMuted,
  },
  etymology: {
    fontFamily: fonts.text.regular,
    fontSize: fontSizes.lead,
    lineHeight: 25,
    color: ink.pageInk,
  },
  actions: { gap: space.s5, alignItems: "flex-start" },
  later: { fontFamily: fonts.ui.bold, fontSize: fontSizes.body, color: ink.pageInk },
  ghosts: { flexDirection: "row", justifyContent: "center", gap: space.s5 },
  ghost: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.s4,
    minHeight: 44,
    paddingHorizontal: space.s7,
    borderRadius: radii.x4,
    borderWidth: 2,
    borderColor: ink.track,
  },
  ghostText: { fontFamily: fonts.ui.bold, fontSize: fontSizes.body, color: ink.pageInk },
  link: { color: ink.rubric, textDecorationLine: "underline" },
  report: { alignSelf: "flex-start", paddingVertical: space.s3 },
  reportText: {
    fontFamily: fonts.ui.medium,
    fontSize: fontSizes.label,
    color: ink.pageInkFaint,
    textDecorationLine: "underline",
  },
});
