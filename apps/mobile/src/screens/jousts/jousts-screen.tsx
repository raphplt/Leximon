import type {
  JoustDeckResponse,
  JoustSummary,
  JoustsResponse,
  LaunchJoustRequest,
  PlayerBadge,
} from "@leximon/contract";
import { toyMatters, toy as toyValues } from "@leximon/tokens";
import {
  accessText,
  COMPOSE_DECK,
  DECK_NOT_SAVED,
  EDIT_DECK_SHORT,
  GUIDE_AGAIN,
  JOUST,
  JOUSTS_HELP_LABEL,
  JOUSTS_TITLE,
  joustHelp,
  joustRowState,
  joustSections,
  LAUNCH_FRIENDLY,
  launchRefusalText,
  NO_FRIENDS_TO_DEFY,
  NO_JOUSTS,
  outcomeWord,
  PLAY_JOUST,
  playerName,
  runSize,
  SEALED_RESULT,
} from "@leximon/view-model";
import { router, useFocusEffect } from "expo-router";
import { type ReactNode, useCallback, useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated, { FadeInUp } from "react-native-reanimated";
import { api } from "@/api/client";
import { useCatalog } from "@/cards/use-catalog";
import { MainAction } from "@/library/play-pieces";
import { useNow, useShared } from "@/player/shared";
import { profile } from "@/player/state";
import { catalogCard } from "@/screens/trades/card-row";
import { fontSizes, fonts, radii, space } from "@/theme";
import { Avatar } from "@/ui/avatar";
import { Button } from "@/ui/button";
import { Icon } from "@/ui/icon";
import { FormError, Page, Paragraph } from "@/ui/page";
import { Sheet } from "@/ui/sheet";
import { ParticleStage } from "@/ui/stage";
import { TextButton } from "@/ui/text-button";
import { Leaf, Lettering, Toy, ToyBody, ToyIcon } from "@/ui/toy";
import { DeckBuilder } from "./deck-builder";
import { Guide } from "./guide";
import { ink, LeafKicker, Looping, MiniCard, Notice, pieces } from "./pieces";
import { NO_ANSWER, useLaunch } from "./use-launch";

type Loaded =
  | { readonly state: "loading" }
  | { readonly state: "failed" }
  | { readonly state: "ready"; readonly jousts: JoustsResponse; readonly deck: JoustDeckResponse };

const FAN_CARD = 60;

/** Each leaf rises in turn when the screen appears. */
const rise = (index: number) => FadeInUp.delay(index * 90).duration(320);

/** The jousts' hall: the first visit, then « Jouter », the deck and the player's jousts. */
export function JoustsScreen() {
  return (
    <ParticleStage>
      <JoustsHall />
    </ParticleStage>
  );
}

function JoustsHall() {
  const [loaded, setLoaded] = useState<Loaded>({ state: "loading" });
  const [guideOpen, setGuideOpen] = useState(false);
  const me = useShared(profile);
  const opensAt = loaded.state === "ready" ? loaded.jousts.opensAtLevel : 0;
  const { launch, busy, refusal } = useLaunch(opensAt);

  const load = useCallback(() => {
    Promise.all([api.fetchJousts(), api.fetchJoustDeck()])
      .then(([jousts, deck]) => setLoaded({ state: "ready", jousts, deck }))
      .catch(() => setLoaded({ state: "failed" }));
  }, []);
  // Read again on each return from a joust: its row moved, and the guide closed if it launched it.
  useFocusEffect(
    useCallback(() => {
      setGuideOpen(false);
      load();
    }, [load]),
  );

  if (loaded.state !== "ready") {
    return (
      <Page title={JOUSTS_TITLE}>
        {loaded.state === "loading" && <Paragraph muted>Un instant…</Paragraph>}
        {loaded.state === "failed" && (
          <>
            <Paragraph muted>Les joutes n'ont pas pu être chargées. Réessaie.</Paragraph>
            <Button label="Réessayer" secondary onPress={load} />
          </>
        )}
      </Page>
    );
  }
  const { jousts, deck } = loaded;
  const closed = accessText(jousts.access, jousts.opensAtLevel);

  if (closed !== null) {
    return (
      <Page title={JOUSTS_TITLE}>
        <Leaf style={pieces.leaf}>
          <Text style={pieces.line}>{closed}</Text>
          {jousts.access === "account_required" && (
            <Button label="Créer mon compte" onPress={() => router.push("/compte")} />
          )}
          {jousts.access === "pseudo_required" && (
            <Button label="Choisir mon pseudo" onPress={() => router.push("/profil")} />
          )}
        </Leaf>
      </Page>
    );
  }

  const closeGuide = () => {
    setGuideOpen(false);
    // Shown once: the server keeps it done, for the web and the phone.
    api
      .markJoustGuideDone()
      .catch(() => undefined)
      .finally(load);
  };

  if (!jousts.guideDone || guideOpen) {
    return (
      <Page title={JOUSTS_TITLE}>
        <Guide
          deck={deck}
          deckSaved={jousts.deckSaved}
          jousted={jousts.jousts.length > 0}
          size={runSize(Date.now())}
          me={{ name: me?.pseudo ?? "Toi", avatar: me?.avatar ?? null, frame: me?.frame ?? null }}
          busy={busy}
          refusal={refusal}
          onDeckSaved={load}
          onLaunch={() => {
            api.markJoustGuideDone().catch(() => undefined);
            void launch({ kind: "ranked" });
          }}
          onClose={closeGuide}
        />
      </Page>
    );
  }

  return (
    <Home
      jousts={jousts}
      deck={deck}
      busy={busy}
      refusal={refusal}
      onLaunch={(request) => void launch(request)}
      onGuide={() => setGuideOpen(true)}
      onDeckSaved={load}
    />
  );
}

function Home({
  jousts,
  deck,
  busy,
  refusal,
  onLaunch,
  onGuide,
  onDeckSaved,
}: {
  readonly jousts: JoustsResponse;
  readonly deck: JoustDeckResponse;
  readonly busy: boolean;
  readonly refusal: string | null;
  readonly onLaunch: (request: LaunchJoustRequest) => void;
  readonly onGuide: () => void;
  readonly onDeckSaved: () => void;
}) {
  const catalog = useCatalog();
  const now = useNow(60_000);
  const [deckOpen, setDeckOpen] = useState(false);
  const [friendsOpen, setFriendsOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const sections = joustSections(jousts.jousts);
  const costs = new Map(deck.candidates.map((candidate) => [candidate.cardId, candidate.cost]));
  const spent = deck.cardIds.reduce((total, id) => total + (costs.get(id) ?? 0), 0);
  const ready = jousts.deckSaved && jousts.deckReady;
  const middle = (deck.cardIds.length - 1) / 2;
  // The fan closes up to hold in the leaf, whatever the phone's width.
  const [fanWidth, setFanWidth] = useState(0);
  const fanStep =
    deck.cardIds.length < 2 || fanWidth === 0
      ? FAN_CARD
      : Math.min(FAN_CARD * 0.8, (fanWidth - FAN_CARD - 8) / (deck.cardIds.length - 1));

  return (
    <Page title={JOUSTS_TITLE}>
      <View style={styles.home}>
        <Animated.View entering={rise(0)}>
          <Leaf style={pieces.leaf}>
            <View style={styles.helpCorner}>
              <Toy
                matter="paper"
                shape="round"
                style={styles.help}
                accessibilityRole="button"
                accessibilityLabel={JOUSTS_HELP_LABEL}
                onPress={() => setHelpOpen(true)}
              >
                <Lettering size={fontSizes.lead}>?</Lettering>
              </Toy>
            </View>
            <View style={styles.crest}>
              <ToyIcon name="jousts" size={64} />
            </View>
            {ready ? (
              <View style={pieces.actions}>
                <MainAction
                  label={JOUST}
                  disabled={busy}
                  onPress={() => onLaunch({ kind: "ranked" })}
                />
                <Toy
                  matter="paper"
                  style={styles.friend}
                  bodyStyle={styles.friendBody}
                  accessibilityRole="button"
                  accessibilityLabel={LAUNCH_FRIENDLY}
                  disabled={busy}
                  onPress={() => setFriendsOpen(true)}
                >
                  <Icon name="amis" size={18} color={ink.pageInk} />
                  <Text style={styles.friendText}>{LAUNCH_FRIENDLY}</Text>
                </Toy>
              </View>
            ) : (
              <View style={pieces.actions}>
                <MainAction
                  label={COMPOSE_DECK}
                  disabled={!jousts.deckReady}
                  onPress={() => setDeckOpen(true)}
                />
              </View>
            )}
            {!jousts.deckReady && (
              <Text style={[pieces.line, styles.centered]}>
                {launchRefusalText("deck_too_small", 0)}
              </Text>
            )}
            {jousts.deckReady && !jousts.deckSaved && (
              <Text style={[pieces.line, styles.centered]}>{DECK_NOT_SAVED}</Text>
            )}
            <Notice>{refusal}</Notice>
          </Leaf>
        </Animated.View>

        {jousts.deckSaved && (
          <Animated.View entering={rise(1)}>
            <Leaf style={pieces.leaf}>
              <View style={styles.deckHead}>
                <View style={styles.deckKicker}>
                  <LeafKicker>{`Ton deck · ${spent} / ${deck.budget} points`}</LeafKicker>
                </View>
                <Toy
                  matter="paper"
                  style={styles.edit}
                  bodyStyle={styles.editBody}
                  accessibilityRole="button"
                  accessibilityLabel={EDIT_DECK_SHORT}
                  onPress={() => setDeckOpen(true)}
                >
                  <Lettering size={fontSizes.small}>{EDIT_DECK_SHORT}</Lettering>
                </Toy>
              </View>
              {catalog !== null && (
                <Pressable
                  style={styles.fan}
                  onLayout={(event) => setFanWidth(event.nativeEvent.layout.width)}
                  onPress={() => setDeckOpen(true)}
                  accessibilityRole="button"
                  accessibilityLabel={EDIT_DECK_SHORT}
                >
                  {deck.cardIds.map((cardId, index) => {
                    const offset = index - middle;
                    return (
                      <View
                        key={cardId}
                        style={[
                          {
                            marginLeft: index === 0 ? 0 : fanStep - FAN_CARD,
                            transform: [
                              { translateY: Math.abs(offset) * 2.5 },
                              { rotate: `${offset * 3.5}deg` },
                            ],
                          },
                        ]}
                      >
                        <MiniCard card={catalogCard(catalog, cardId)} width={FAN_CARD} />
                      </View>
                    );
                  })}
                </Pressable>
              )}
            </Leaf>
          </Animated.View>
        )}

        <Animated.View entering={rise(2)}>
          <Leaf style={pieces.leaf}>
            {jousts.jousts.length === 0 && <Text style={pieces.line}>{NO_JOUSTS}</Text>}
            <JoustGroup title="À toi de jouer" jousts={sections.toPlay}>
              {(joust) => (
                <Looping kind="beat">
                  <JoustRow joust={joust} now={now} tone="play">
                    <ToyBody matter="gold" style={styles.rowAction}>
                      <Lettering size={fontSizes.small}>{PLAY_JOUST}</Lettering>
                    </ToyBody>
                  </JoustRow>
                </Looping>
              )}
            </JoustGroup>
            <JoustGroup title="Résultats à découvrir" jousts={sections.toDiscover}>
              {(joust) => (
                <JoustRow joust={joust} now={now} tone="sealed">
                  <Looping kind="wobble">
                    <View accessible accessibilityRole="image" accessibilityLabel={SEALED_RESULT}>
                      <ToyIcon name="mail" size={38} />
                    </View>
                  </Looping>
                </JoustRow>
              )}
            </JoustGroup>
            <JoustGroup title="En attente" jousts={sections.waiting}>
              {(joust) => <JoustRow joust={joust} now={now} clock />}
            </JoustGroup>
            <JoustGroup title="Terminées" jousts={sections.ended}>
              {(joust) => (
                <JoustRow joust={joust} now={now}>
                  <Text
                    style={[
                      styles.outcome,
                      joust.outcome === "won" && { color: toyMatters.green.bottom },
                    ]}
                  >
                    {outcomeWord(joust.outcome)}
                  </Text>
                </JoustRow>
              )}
            </JoustGroup>
          </Leaf>
        </Animated.View>
      </View>

      <Sheet open={helpOpen} title="La joute" onClose={() => setHelpOpen(false)}>
        {joustHelp(runSize(now)).map((line) => (
          <View key={line} style={styles.helpLine}>
            <View style={styles.bullet} />
            <Text style={styles.helpText}>{line}</Text>
          </View>
        ))}
        <TextButton
          label={GUIDE_AGAIN}
          onPress={() => {
            setHelpOpen(false);
            onGuide();
          }}
        />
      </Sheet>
      <Sheet open={deckOpen} title="Ton deck" onClose={() => setDeckOpen(false)}>
        {deckOpen && (
          <DeckBuilder
            deck={deck}
            initial={deck.saved || jousts.jousts.length > 0 ? deck.cardIds : []}
            onSaved={() => {
              setDeckOpen(false);
              onDeckSaved();
            }}
          />
        )}
      </Sheet>
      <FriendsSheet
        open={friendsOpen}
        busy={busy}
        onClose={() => setFriendsOpen(false)}
        onPick={(code) => {
          setFriendsOpen(false);
          onLaunch({ kind: "friendly", opponentCode: code });
        }}
      />
    </Page>
  );
}

function JoustGroup({
  title,
  jousts,
  children,
}: {
  readonly title: string;
  readonly jousts: readonly JoustSummary[];
  readonly children: (joust: JoustSummary) => ReactNode;
}) {
  if (jousts.length === 0) return null;
  return (
    <View style={styles.group}>
      <LeafKicker>{title}</LeafKicker>
      {jousts.map((joust) => (
        <View key={joust.id}>{children(joust)}</View>
      ))}
    </View>
  );
}

function JoustRow({
  joust,
  now,
  tone,
  clock = false,
  children,
}: {
  readonly joust: JoustSummary;
  readonly now: number;
  readonly tone?: "play" | "sealed";
  readonly clock?: boolean;
  readonly children?: ReactNode;
}) {
  const name = playerName(joust.opponent);
  const state = joustRowState(joust, now);
  return (
    <Pressable
      onPress={() => router.push({ pathname: "/joutes/[id]", params: { id: joust.id } })}
      style={({ pressed }) => [
        styles.row,
        tone === "play" && styles.rowPlay,
        tone === "sealed" && styles.rowSealed,
        pressed && styles.rowPressed,
      ]}
      accessibilityRole="button"
      accessibilityLabel={`${name}. ${state}`}
    >
      <Avatar
        avatar={joust.opponent?.avatar ?? null}
        frame={joust.opponent?.frame ?? null}
        size={40}
      />
      <View style={styles.rowText}>
        <Text style={styles.rowName} numberOfLines={1}>
          {name}
        </Text>
        <View style={styles.rowStateLine}>
          {clock && <Icon name="clock" size={13} color={ink.pageInkMuted} />}
          <Text style={styles.rowState} numberOfLines={2}>
            {state}
          </Text>
        </View>
      </View>
      {children}
    </Pressable>
  );
}

function FriendsSheet({
  open,
  busy,
  onClose,
  onPick,
}: {
  readonly open: boolean;
  readonly busy: boolean;
  readonly onClose: () => void;
  readonly onPick: (code: string) => void;
}) {
  const [players, setPlayers] = useState<readonly PlayerBadge[] | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (!open) return;
    setFailed(false);
    api
      .fetchJoustOpponents()
      .then((response) => setPlayers(response.players))
      .catch(() => setFailed(true));
  }, [open]);

  return (
    <Sheet open={open} title={LAUNCH_FRIENDLY} onClose={onClose}>
      <FormError message={failed ? NO_ANSWER : null} />
      {players !== null && players.length === 0 && (
        <Text style={pieces.line}>{NO_FRIENDS_TO_DEFY}</Text>
      )}
      {players?.map((player) => (
        <View key={player.code} style={styles.friendRow}>
          <Avatar avatar={player.avatar} frame={player.frame} size={40} />
          <Text style={[styles.rowName, styles.rowText]} numberOfLines={1}>
            {playerName(player)}
          </Text>
          <Button label="Défier" small disabled={busy} onPress={() => onPick(player.code)} />
        </View>
      ))}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  home: { gap: space.s8 },
  helpCorner: { position: "absolute", top: space.s4, right: space.s4, zIndex: 1 },
  help: { width: 40, height: 40 },
  crest: { alignItems: "center", paddingTop: space.s4 },
  friend: { height: 46, alignSelf: "center" },
  friendBody: { flexDirection: "row", gap: space.s3, paddingHorizontal: space.s8 },
  friendText: { fontFamily: fonts.ui.bold, fontSize: fontSizes.body, color: ink.pageInk },
  centered: { textAlign: "center" },
  deckHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: space.s4,
  },
  deckKicker: { flex: 1 },
  edit: { height: 34 },
  editBody: { paddingHorizontal: space.s6 },
  fan: {
    flexDirection: "row",
    justifyContent: "center",
    paddingTop: space.s4,
    paddingBottom: space.s8,
  },
  group: { gap: space.s4 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.s5,
    minHeight: 58,
    paddingHorizontal: space.s4,
    paddingVertical: space.s3,
    borderRadius: radii.lg,
    borderWidth: 2,
    borderColor: ink.rule,
    backgroundColor: ink.pageRaised,
  },
  rowPlay: {
    borderColor: toyMatters.gold.bottom,
    boxShadow: `0 0 0 3px ${toyMatters.gold.top}`,
  },
  rowSealed: { borderColor: toyMatters.red.bottom },
  rowPressed: { opacity: 0.8 },
  rowText: { flex: 1 },
  rowName: { fontFamily: fonts.ui.bold, fontSize: fontSizes.bodyLarge, color: ink.pageInk },
  rowStateLine: { flexDirection: "row", alignItems: "center", gap: space.s2 },
  rowState: {
    flexShrink: 1,
    fontFamily: fonts.ui.medium,
    fontSize: fontSizes.small,
    color: ink.pageInkMuted,
  },
  rowAction: { paddingHorizontal: space.s6, paddingVertical: space.s3 },
  outcome: { fontFamily: fonts.ui.extrabold, fontSize: fontSizes.label, color: ink.pageInkMuted },
  helpLine: { flexDirection: "row", alignItems: "flex-start", gap: space.s4 },
  bullet: {
    width: 7,
    height: 7,
    marginTop: 8,
    borderRadius: 4,
    backgroundColor: ink.rubric,
    borderWidth: 1,
    borderColor: toyValues.outline,
  },
  helpText: {
    flex: 1,
    fontFamily: fonts.ui.medium,
    fontSize: fontSizes.body,
    lineHeight: 21,
    color: ink.pageInk,
  },
  friendRow: { flexDirection: "row", alignItems: "center", gap: space.s6, minHeight: 52 },
});
