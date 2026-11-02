import type { FeedEvent, FriendReactionKind } from "@leximon/contract";
import { type Catalog, collectionName } from "@leximon/contract/client";
import {
  FEED_EMPTY,
  feedLine,
  feedReactions,
  messageTime,
  withReaction,
} from "@leximon/view-model";
import { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { api } from "@/api/client";
import { catalogInHand, loadCatalog } from "@/cards/catalog";
import { useShared } from "@/player/shared";
import { profile } from "@/player/state";
import { openCard } from "@/screens/trades/card-row";
import { fontSizes, fonts, paperColors, space } from "@/theme";
import { Avatar } from "@/ui/avatar";
import { Chip } from "@/ui/chip";
import { Panel } from "@/ui/panel";
import { TextButton } from "@/ui/text-button";
import { toast } from "@/ui/toast";

/** What friends found lately, with the reactions they got. */
export function FriendFeed({ now }: { readonly now: number }) {
  const [events, setEvents] = useState<readonly FeedEvent[] | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [failed, setFailed] = useState(false);
  const [picking, setPicking] = useState<number | null>(null);
  const [catalog, setCatalog] = useState<Catalog | null>(catalogInHand);
  const me = useShared(profile);

  useEffect(() => {
    loadCatalog().then(setCatalog, () => undefined);
    api
      .fetchFeed()
      .then((page) => {
        setEvents(page.events);
        setHasMore(page.hasMore);
      })
      .catch(() => setFailed(true));
  }, []);

  const loadOlder = async () => {
    const last = events?.at(-1);
    if (last === undefined) return;
    const page = await api.fetchFeed(last.id).catch(() => null);
    if (page === null) return;
    setEvents((current) => [...(current ?? []), ...page.events]);
    setHasMore(page.hasMore);
  };

  const choose = async (event: FeedEvent, reaction: FriendReactionKind) => {
    setPicking(null);
    const next = event.mine === reaction ? null : reaction;
    const swap = (to: FeedEvent) =>
      setEvents((current) => current?.map((e) => (e.id === event.id ? to : e)) ?? null);
    swap(withReaction(event, next));
    try {
      const result = await api.react(event.id, next);
      if (result.kind === "refused") throw new Error(result.reason);
    } catch {
      swap(event);
      toast("La réaction n'a pas été envoyée. Réessaie.");
    }
  };

  return (
    <Panel paper>
      <Text style={styles.kicker}>LE FIL DES AMIS</Text>
      {events === null ? (
        <Text style={styles.small}>{failed ? "Le fil ne répond pas." : "Un instant…"}</Text>
      ) : events.length === 0 ? (
        <Text style={styles.empty}>{FEED_EMPTY}</Text>
      ) : (
        events.map((event) => {
          const self = me !== null && event.player.code === me.playerCode;
          const card = "cardId" in event ? (catalog?.cardsById.get(event.cardId) ?? null) : null;
          const collection =
            event.kind === "collection_complete" && catalog !== null
              ? collectionName(catalog, event.collectionId)
              : null;
          const line = feedLine(event, self, card, collection);
          const reactions = feedReactions(event, { self, picking: picking === event.id });
          return (
            <View key={event.id} style={styles.event}>
              <Avatar avatar={event.player.avatar} frame={null} size={36} />
              <View style={styles.body}>
                <Text style={styles.line}>
                  {line.before}
                  {line.word !== null && (
                    <Text
                      style={[styles.word, card !== null && styles.wordLink]}
                      onPress={card === null ? undefined : () => openCard(card.id)}
                      accessibilityRole={card === null ? undefined : "link"}
                    >
                      {line.word}
                    </Text>
                  )}
                  {line.after}
                </Text>
                <View style={styles.reactions}>
                  <Text style={styles.faint}>{messageTime(event.createdAt, now)}</Text>
                  {reactions.chips.map((chip) => (
                    <Chip
                      key={chip.id}
                      label={chip.count > 0 ? `${chip.label} · ${chip.count}` : chip.label}
                      on={chip.mine}
                      disabled={self}
                      onPress={() => void choose(event, chip.id)}
                    />
                  ))}
                  {reactions.canReact && (
                    <Chip label="Réagir" on={false} onPress={() => setPicking(event.id)} />
                  )}
                </View>
              </View>
            </View>
          );
        })
      )}
      {hasMore && <TextButton label="Plus ancien" onPress={() => void loadOlder()} />}
    </Panel>
  );
}

/** What the panels hold is read on paper in « La Bibliothèque ». */
const ink = paperColors;

const styles = StyleSheet.create({
  kicker: {
    fontFamily: fonts.ui.extrabold,
    fontSize: fontSizes.caption,
    letterSpacing: 2,
    color: ink.pageInkMuted,
  },
  small: { fontFamily: fonts.ui.medium, fontSize: fontSizes.small, color: ink.pageInkMuted },
  faint: { fontFamily: fonts.ui.medium, fontSize: fontSizes.caption, color: ink.pageInkFaint },
  empty: {
    fontFamily: fonts.text.italic,
    fontSize: fontSizes.lead,
    lineHeight: 24,
    color: ink.pageInkMuted,
  },
  event: { flexDirection: "row", gap: space.s6 },
  body: { flex: 1, gap: space.s3 },
  line: {
    fontFamily: fonts.ui.medium,
    fontSize: fontSizes.body,
    lineHeight: 21,
    color: ink.pageInk,
  },
  word: { fontFamily: fonts.text.italic, fontSize: fontSizes.lead },
  wordLink: { color: ink.rubric, textDecorationLine: "underline" },
  reactions: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: space.s3 },
});
