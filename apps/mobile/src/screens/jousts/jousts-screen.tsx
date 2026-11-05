import type { JoustDeckResponse, JoustsResponse, PlayerBadge } from "@leximon/contract";
import { collectionName, type LaunchJoustResult } from "@leximon/contract/client";
import {
  accessText,
  DECK_AUTO,
  DECK_RULES,
  deckRefusalText,
  deckSummary,
  EDIT_DECK,
  JOUSTS_RULES,
  JOUSTS_TITLE,
  joustLine,
  LAUNCH_FRIENDLY,
  LAUNCH_RANKED,
  launchRefusalText,
  NO_FRIENDS_TO_DEFY,
  NO_JOUSTS,
  PLAY_JOUST,
  playerName,
  SAVE_DECK,
  sortJousts,
  toggleDeckCard,
} from "@leximon/view-model";
import { randomUUID } from "expo-crypto";
import { router } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { api } from "@/api/client";
import { Card } from "@/cards/card";
import { useCatalog } from "@/cards/use-catalog";
import { useNow } from "@/player/shared";
import { CardRow, cardLabel, catalogCard } from "@/screens/trades/card-row";
import { fontSizes, fonts, paperColors, radii, space } from "@/theme";
import { Avatar } from "@/ui/avatar";
import { Button } from "@/ui/button";
import { FormError, Page, Paragraph } from "@/ui/page";
import { Panel } from "@/ui/panel";
import { Sheet } from "@/ui/sheet";
import { TextButton } from "@/ui/text-button";

const NO_ANSWER = "Le serveur ne répond pas. Réessaie.";

type Loaded =
  | { readonly state: "loading" }
  | { readonly state: "failed" }
  | { readonly state: "ready"; readonly jousts: JoustsResponse; readonly deck: JoustDeckResponse };

/** The jousts' hall: the deck, launching a joust, and the player's jousts. */
export function JoustsScreen() {
  const [loaded, setLoaded] = useState<Loaded>({ state: "loading" });
  const [refusal, setRefusal] = useState<string | null>(null);
  const [launching, setLaunching] = useState(false);
  const [deckOpen, setDeckOpen] = useState(false);
  const [friendsOpen, setFriendsOpen] = useState(false);
  // Kept until the server answers: a retry after a lost answer never launches twice.
  const pendingKey = useRef<string | null>(null);
  const now = useNow(60_000);

  const load = useCallback(() => {
    Promise.all([api.fetchJousts(), api.fetchJoustDeck()])
      .then(([jousts, deck]) => setLoaded({ state: "ready", jousts, deck }))
      .catch(() => setLoaded({ state: "failed" }));
  }, []);
  useEffect(load, [load]);

  const launch = async (request: Parameters<typeof api.launchJoust>[0]) => {
    if (loaded.state !== "ready") return;
    const key = pendingKey.current ?? randomUUID();
    pendingKey.current = key;
    setLaunching(true);
    setRefusal(null);
    let result: LaunchJoustResult;
    try {
      result = await api.launchJoust(request, key);
    } catch {
      setRefusal(NO_ANSWER);
      setLaunching(false);
      return;
    }
    pendingKey.current = null;
    setLaunching(false);
    setFriendsOpen(false);
    if (result.kind === "launched") {
      router.push({ pathname: "/joutes/[id]", params: { id: result.joustId } });
      return;
    }
    setRefusal(launchRefusalText(result.reason, loaded.jousts.opensAtLevel));
  };

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
        <Panel paper style={styles.panel}>
          <Text style={styles.line}>{closed}</Text>
          {jousts.access === "account_required" && (
            <Button label="Créer mon compte" onPress={() => router.push("/compte")} />
          )}
          {jousts.access === "pseudo_required" && (
            <Button label="Choisir mon pseudo" onPress={() => router.push("/profil")} />
          )}
        </Panel>
      </Page>
    );
  }

  return (
    <Page title={JOUSTS_TITLE}>
      <Panel paper style={styles.panel}>
        <Text style={styles.line}>{JOUSTS_RULES}</Text>
        <Button
          label={LAUNCH_RANKED}
          disabled={launching || !jousts.deckReady}
          onPress={() => void launch({ kind: "ranked" })}
        />
        <Button
          label={LAUNCH_FRIENDLY}
          secondary
          disabled={launching || !jousts.deckReady}
          onPress={() => setFriendsOpen(true)}
        />
        {!jousts.deckReady && (
          <Text style={styles.notice}>{launchRefusalText("deck_too_small", 0)}</Text>
        )}
        <FormError message={refusal} />
      </Panel>
      <DeckPanel deck={deck} onEdit={() => setDeckOpen(true)} />
      <Panel paper style={styles.panel}>
        <Text style={styles.kicker}>TES JOUTES</Text>
        {jousts.jousts.length === 0 ? (
          <Text style={styles.line}>{NO_JOUSTS}</Text>
        ) : (
          sortJousts(jousts.jousts).map((joust) => {
            const line = joustLine(joust, jousts.questions, now);
            const open = () => router.push({ pathname: "/joutes/[id]", params: { id: joust.id } });
            return (
              <Pressable
                key={joust.id}
                style={styles.row}
                onPress={open}
                accessibilityRole="button"
                accessibilityLabel={`${line.title}. ${line.detail}`}
              >
                <Avatar
                  avatar={joust.opponent?.avatar ?? null}
                  frame={joust.opponent?.frame ?? null}
                  size={40}
                />
                <View style={styles.rowText}>
                  <Text style={styles.rowTitle}>{line.title}</Text>
                  <Text style={styles.rowDetail}>{line.detail}</Text>
                </View>
                <Text style={line.toPlay ? styles.rowPlay : styles.rowSee}>
                  {line.toPlay ? PLAY_JOUST : "Voir"}
                </Text>
              </Pressable>
            );
          })
        )}
      </Panel>
      <DeckSheet
        open={deckOpen}
        deck={deck}
        onClose={() => setDeckOpen(false)}
        onSaved={() => {
          setDeckOpen(false);
          load();
        }}
      />
      <FriendsSheet
        open={friendsOpen}
        busy={launching}
        onClose={() => setFriendsOpen(false)}
        onPick={(code) => void launch({ kind: "friendly", opponentCode: code })}
      />
    </Page>
  );
}

function deckCost(deck: JoustDeckResponse, cardIds: readonly string[]): number {
  const costs = new Map(deck.candidates.map((candidate) => [candidate.cardId, candidate.cost]));
  return cardIds.reduce((total, id) => total + (costs.get(id) ?? 0), 0);
}

function DeckPanel({
  deck,
  onEdit,
}: {
  readonly deck: JoustDeckResponse;
  readonly onEdit: () => void;
}) {
  const catalog = useCatalog();
  const summary = deckSummary(
    deck.cardIds.length,
    deck.size,
    deckCost(deck, deck.cardIds),
    deck.budget,
  );
  return (
    <Panel paper style={styles.panel}>
      <Text style={styles.kicker}>TON DECK</Text>
      <Text style={styles.line}>
        {summary}. {deck.saved ? "" : DECK_AUTO}
      </Text>
      {catalog !== null && deck.cardIds.length > 0 && (
        <CardRow catalog={catalog} cardIds={deck.cardIds} width={60} />
      )}
      <TextButton label={EDIT_DECK} onPress={onEdit} />
    </Panel>
  );
}

function DeckSheet({
  open,
  deck,
  onClose,
  onSaved,
}: {
  readonly open: boolean;
  readonly deck: JoustDeckResponse;
  readonly onClose: () => void;
  readonly onSaved: () => void;
}) {
  const catalog = useCatalog();
  const [chosen, setChosen] = useState<readonly string[]>(deck.cardIds);
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    if (open) {
      setChosen(deck.cardIds);
      setMessage(null);
    }
  }, [open, deck.cardIds]);
  const costs = new Map(deck.candidates.map((candidate) => [candidate.cardId, candidate.cost]));
  const costOf = (cardId: string) => costs.get(cardId) ?? 0;

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

  const candidates = [...deck.candidates].sort(
    (a, b) => b.cost - a.cost || a.cardId.localeCompare(b.cardId),
  );
  return (
    <Sheet open={open} title="Ton deck" onClose={onClose}>
      <Text style={styles.line}>{DECK_RULES}</Text>
      <Text style={styles.deckCount} accessibilityLiveRegion="polite">
        {deckSummary(chosen.length, deck.size, deckCost(deck, chosen), deck.budget)}
      </Text>
      <FormError message={message} />
      {catalog !== null && (
        <View style={styles.pick}>
          {candidates.map((candidate) => {
            const card = catalogCard(catalog, candidate.cardId);
            const inDeck = chosen.includes(candidate.cardId);
            return (
              <Pressable
                key={candidate.cardId}
                style={[styles.pickCard, inDeck && styles.picked]}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: inDeck }}
                accessibilityLabel={`${cardLabel(card)}, ${candidate.cost} points`}
                onPress={() => {
                  const next = toggleDeckCard(chosen, candidate.cardId, costOf, deck);
                  setChosen(next.deck);
                  setMessage(next.refused);
                }}
              >
                <Card
                  card={card}
                  collectionName={collectionName(catalog, card.collectionId)}
                  width={88}
                />
                <Text style={styles.cost}>{candidate.cost} pts</Text>
              </Pressable>
            );
          })}
        </View>
      )}
      <Button
        label={SAVE_DECK}
        disabled={saving || chosen.length < deck.min}
        onPress={() => void save()}
      />
    </Sheet>
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
        <Text style={styles.line}>{NO_FRIENDS_TO_DEFY}</Text>
      )}
      {players?.map((player) => (
        <View key={player.code} style={styles.row}>
          <Avatar avatar={player.avatar} frame={player.frame} size={40} />
          <Text style={[styles.rowTitle, styles.rowText]}>{playerName(player)}</Text>
          <TextButton label="Défier" disabled={busy} onPress={() => onPick(player.code)} />
        </View>
      ))}
    </Sheet>
  );
}

/** What the panels hold is read on paper. */
const ink = paperColors;

const styles = StyleSheet.create({
  panel: { gap: space.s6 },
  kicker: {
    fontFamily: fonts.ui.extrabold,
    fontSize: fontSizes.caption,
    letterSpacing: 2,
    color: ink.pageInkMuted,
  },
  line: {
    fontFamily: fonts.ui.medium,
    fontSize: fontSizes.body,
    lineHeight: 21,
    color: ink.pageInkMuted,
  },
  notice: { fontFamily: fonts.ui.bold, fontSize: fontSizes.body, color: ink.pageInk },
  row: { flexDirection: "row", alignItems: "center", gap: space.s6, minHeight: 52 },
  rowText: { flex: 1 },
  rowTitle: { fontFamily: fonts.ui.bold, fontSize: fontSizes.bodyLarge, color: ink.pageInk },
  rowDetail: { fontFamily: fonts.ui.medium, fontSize: fontSizes.label, color: ink.pageInkMuted },
  rowPlay: { fontFamily: fonts.ui.extrabold, fontSize: fontSizes.body, color: ink.rubric },
  rowSee: { fontFamily: fonts.ui.bold, fontSize: fontSizes.body, color: ink.pageInkMuted },
  deckCount: { fontFamily: fonts.ui.bold, fontSize: fontSizes.bodyLarge, color: ink.pageInk },
  pick: { flexDirection: "row", flexWrap: "wrap", gap: space.s4, justifyContent: "center" },
  pickCard: {
    alignItems: "center",
    gap: space.s2,
    padding: space.s2,
    borderWidth: 3,
    borderColor: "transparent",
    borderRadius: radii.md,
    opacity: 0.6,
  },
  picked: { borderColor: ink.gilt, opacity: 1 },
  cost: { fontFamily: fonts.ui.bold, fontSize: fontSizes.label, color: ink.pageInk },
});
